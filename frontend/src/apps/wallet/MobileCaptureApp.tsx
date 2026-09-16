import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, MonoLabel } from '@/components/primitives'
import { connectSession, type RealtimeSession } from '@/lib/realtimeSession'
import { ocrService, type ParsedCccdFields } from '@/services/ocrService'
import { qrService, type ScannedCccd } from '@/services/qrService'
import { CameraCapture } from './components/CameraCapture'
import type { HandoffEvent } from './handoffProtocol'
import type { IdentityForm } from './types'

type Stage = 'front' | 'review' | 'back' | 'face' | 'done'

const STEP_LABEL: Record<Exclude<Stage, 'done'>, string> = {
  front: 'Step 1 of 3',
  review: 'Step 1 of 3',
  back: 'Step 2 of 3',
  face: 'Step 3 of 3',
}

const FIELD_LABELS: [keyof IdentityForm, string][] = [
  ['cccd', 'Số CCCD'],
  ['name', 'Họ và tên'],
  ['dob', 'Ngày sinh'],
  ['sex', 'Giới tính'],
  ['nationality', 'Quốc tịch'],
  ['origin', 'Quê quán'],
  ['residence', 'Nơi thường trú'],
  ['expiry', 'Có giá trị đến'],
]

function readCard(dataUrl: string): Promise<ParsedCccdFields> {
  return ocrService
    .recognizeCccd(dataUrl)
    .then((result) => result.fields)
    .catch(() => ({}))
}

export function MobileCaptureApp() {
  const [params] = useSearchParams()
  const sessionId = params.get('session') ?? ''
  const [stage, setStage] = useState<Stage>('front')
  const [reading, setReading] = useState(false)
  const [fields, setFields] = useState<Partial<IdentityForm>>({})
  const sessionRef = useRef<RealtimeSession<HandoffEvent> | null>(null)
  const detectedRef = useRef<ScannedCccd | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const session = connectSession<HandoffEvent>(sessionId, () => {})
    sessionRef.current = session
    session.send({ type: 'connected' })
    return () => session.close()
  }, [sessionId])

  // Quét liên tục trên luồng video: khi khung hình nào đọc được thẻ thì tự bấm chụp, người dùng
  // chỉ việc giơ thẻ vào khung.
  const onFrame = useCallback((frame: ImageData) => {
    const card = qrService.decodeImageData(frame)
    if (card) detectedRef.current = card
    return card !== null
  }, [])

  // Ảnh chỉ tồn tại trong biến cục bộ của hàm này rồi bị bỏ đi: không gửi qua WebSocket, không lưu
  // xuống đâu cả. Chỉ các trường chữ đọc được mới đi về máy tính.
  const onFrontCaptured = (dataUrl: string) => {
    setReading(true)
    setStage('review')
    const detected = detectedRef.current
    Promise.all([
      detected ? Promise.resolve(detected) : qrService.readCccdQr(dataUrl).catch(() => null),
      readCard(dataUrl),
    ])
      .then(([card, scanned]) => {
        const merged: Partial<IdentityForm> = { ...scanned, ...(card ?? {}) }
        if (merged.cccd) merged.nationality = 'Việt Nam'
        setFields(merged)
      })
      .finally(() => setReading(false))
  }

  const retake = () => {
    detectedRef.current = null
    setFields({})
    setStage('front')
  }

  const confirmScan = () => {
    sessionRef.current?.send({ type: 'front-captured', fields })
    setStage('back')
  }

  const onBackCaptured = () => {
    sessionRef.current?.send({ type: 'back-captured' })
    setStage('face')
  }

  const onFaceCaptured = () => {
    sessionRef.current?.send({ type: 'face-captured' })
    sessionRef.current?.send({ type: 'done' })
    setStage('done')
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center text-ink-3 text-sm">
        Invalid link — scan the QR code from your wallet again.
      </div>
    )
  }

  const readable = Boolean(fields.cccd)

  return (
    <div className="min-h-screen bg-bg-page text-ink flex flex-col items-center px-5 py-8 gap-6">
      <div className="flex items-center gap-2.5">
        <div
          className="w-[26px] h-[26px] rounded-[8px]"
          style={{ background: 'linear-gradient(145deg,#2A2C33,#0E0F12)' }}
        />
        <div className="text-sm font-semibold">Vaulta</div>
      </div>

      {stage !== 'done' && (
        <div className="w-full max-w-[420px]">
          <MonoLabel>{STEP_LABEL[stage]}</MonoLabel>
          <div className="text-xl font-medium mt-2 mb-5">
            {stage === 'front'
              ? 'Quét mặt trước thẻ căn cước'
              : stage === 'review'
                ? 'Kiểm tra thông tin trên thẻ'
                : stage === 'back'
                  ? 'Quét mặt sau thẻ căn cước'
                  : 'Xác thực khuôn mặt'}
          </div>

          {stage === 'review' ? (
            <div>
              {reading ? (
                <div className="py-20 text-center text-sm text-ink-3">Đang đọc thẻ…</div>
              ) : readable ? (
                <>
                  <div className="border border-line rounded-2xl bg-bg-sunken p-4">
                    <div className="flex flex-col gap-2.5">
                      {FIELD_LABELS.map(([key, label]) => (
                        <div key={key} className="flex gap-3 text-[13px] leading-snug">
                          <div className="w-[104px] shrink-0 text-ink-3">{label}</div>
                          <div className={fields[key] ? 'text-ink' : 'text-ink-4'}>
                            {fields[key] || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-[12px] text-ink-4 mt-3 leading-relaxed">
                    Ảnh vừa chụp không được lưu lại và không rời khỏi điện thoại. Thông tin còn
                    thiếu có thể bổ sung ở bước xác nhận trên máy tính.
                  </div>
                  <div className="flex gap-3 mt-5">
                    <Button variant="secondary" onClick={retake}>
                      Chụp lại
                    </Button>
                    <button
                      type="button"
                      onClick={confirmScan}
                      className="flex-1 bg-ink text-white py-3.5 rounded-[13px] text-[15px] font-medium cursor-pointer"
                    >
                      Tiếp tục
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="text-[15px] leading-relaxed">Chưa đọc được thẻ</div>
                  <div className="text-[13px] text-ink-3 mt-2 leading-relaxed">
                    Đặt trọn tấm thẻ trong khung, giữ máy chắc tay ở nơi đủ sáng và tránh bóng loá
                    trên mặt thẻ.
                  </div>
                  <button
                    type="button"
                    onClick={retake}
                    className="w-full mt-6 bg-ink text-white py-3.5 rounded-[13px] text-[15px] font-medium cursor-pointer"
                  >
                    Chụp lại
                  </button>
                </div>
              )}
            </div>
          ) : (
            <CameraCapture
              key={stage}
              facingMode={stage === 'face' ? 'user' : 'environment'}
              frameShape={stage === 'face' ? 'oval' : 'card'}
              hint={stage === 'face' ? 'FACE' : 'CCCD'}
              instruction={
                stage === 'face'
                  ? 'Nhìn thẳng vào camera'
                  : 'Đặt trọn tấm thẻ trong khung, máy sẽ tự chụp khi đọc được'
              }
              onFrame={stage === 'front' ? onFrame : undefined}
              onCapture={stage === 'front' ? onFrontCaptured : stage === 'back' ? onBackCaptured : onFaceCaptured}
            />
          )}
        </div>
      )}

      {stage === 'done' && (
        <div className="text-center mt-16">
          <div className="w-16 h-16 rounded-full bg-green text-white text-2xl flex items-center justify-center mx-auto mb-4">
            ✓
          </div>
          <div className="text-xl font-medium">Đã hoàn tất các bước</div>
          <div className="text-sm text-ink-3 mt-2">Quay lại máy tính để tiếp tục.</div>
        </div>
      )}
    </div>
  )
}

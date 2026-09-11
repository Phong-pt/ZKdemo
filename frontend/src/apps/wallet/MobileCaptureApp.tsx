import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MonoLabel } from '@/components/primitives'
import { connectSession, type RealtimeSession } from '@/lib/realtimeSession'
import { ocrService, type OcrResult } from '@/services/ocrService'
import { CameraCapture } from './components/CameraCapture'
import type { HandoffEvent } from './handoffProtocol'

type Stage = 'front' | 'ocr' | 'back' | 'face' | 'done'

const STEP_LABEL: Record<Exclude<Stage, 'done'>, string> = {
  front: 'Step 1 of 3',
  ocr: 'Step 1 of 3',
  back: 'Step 2 of 3',
  face: 'Step 3 of 3',
}

export function MobileCaptureApp() {
  const [params] = useSearchParams()
  const sessionId = params.get('session') ?? ''
  const [stage, setStage] = useState<Stage>('front')
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocr, setOcr] = useState<OcrResult | null>(null)
  const sessionRef = useRef<RealtimeSession<HandoffEvent> | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const session = connectSession<HandoffEvent>(sessionId, () => {})
    sessionRef.current = session
    session.send({ type: 'connected' })
    return () => session.close()
  }, [sessionId])

  // Ảnh chỉ tồn tại trong biến cục bộ của hàm này rồi bị bỏ đi: không gửi qua WebSocket, không
  // lưu xuống đâu cả. Chỉ kết quả OCR được hiển thị tại chỗ để thấy máy thật sự có đọc thẻ.
  const onFrontCaptured = (dataUrl: string) => {
    setOcrRunning(true)
    setStage('ocr')
    ocrService
      .recognizeCccd(dataUrl)
      .then((result) => setOcr(result))
      .catch(() => setOcr({ text: '', fields: {} }))
      .finally(() => setOcrRunning(false))
  }

  const confirmOcr = () => {
    sessionRef.current?.send({ type: 'front-captured' })
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

  const ocrLines = (ocr?.text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)

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
              ? 'Scan the front of your ID'
              : stage === 'ocr'
                ? 'Reading your ID'
                : stage === 'back'
                  ? 'Scan the back of your ID'
                  : 'Verify your face'}
          </div>

          {stage === 'ocr' ? (
            <div>
              {ocrRunning ? (
                <div className="py-20 text-center text-sm text-ink-3">Đang đọc thẻ bằng OCR…</div>
              ) : (
                <div className="border border-line rounded-2xl bg-bg-sunken p-4">
                  <MonoLabel>OCR output</MonoLabel>
                  {ocrLines.length > 0 ? (
                    <div className="mt-3 font-mono text-[11px] leading-[1.6] text-ink-2 break-words">
                      {ocrLines.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-[13px] text-ink-3">
                      Không đọc được chữ nào từ ảnh vừa chụp.
                    </div>
                  )}
                </div>
              )}
              <div className="text-[12px] text-ink-4 mt-3 leading-relaxed">
                Ảnh vừa chụp không được lưu lại và không rời khỏi điện thoại — phần trên chỉ để minh
                hoạ OCR đọc được gì. Ví trên máy tính sẽ dùng bộ dữ liệu demo.
              </div>
              {!ocrRunning && (
                <button
                  type="button"
                  onClick={confirmOcr}
                  className="w-full mt-5 bg-ink text-white py-3.5 rounded-[13px] text-[15px] font-medium cursor-pointer"
                >
                  Tiếp tục
                </button>
              )}
            </div>
          ) : (
            <CameraCapture
              key={stage}
              facingMode={stage === 'face' ? 'user' : 'environment'}
              frameShape={stage === 'face' ? 'oval' : 'card'}
              hint={stage === 'face' ? 'FACE' : 'CCCD'}
              instruction={stage === 'face' ? 'Look directly at the camera' : 'Place your ID inside the frame'}
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
          <div className="text-xl font-medium">All steps complete</div>
          <div className="text-sm text-ink-3 mt-2">Return to your computer to continue.</div>
        </div>
      )}
    </div>
  )
}

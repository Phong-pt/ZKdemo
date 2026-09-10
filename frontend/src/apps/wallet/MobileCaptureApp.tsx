import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MonoLabel } from '@/components/primitives'
import { connectSession, type RealtimeSession } from '@/lib/realtimeSession'
import { ocrService } from '@/services/ocrService'
import { CameraCapture } from './components/CameraCapture'
import type { HandoffEvent } from './handoffProtocol'

type Stage = 'front' | 'back' | 'face' | 'done'

export function MobileCaptureApp() {
  const [params] = useSearchParams()
  const sessionId = params.get('session') ?? ''
  const [stage, setStage] = useState<Stage>('front')
  const [ocrRunning, setOcrRunning] = useState(false)
  const sessionRef = useRef<RealtimeSession<HandoffEvent> | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const session = connectSession<HandoffEvent>(sessionId, () => {})
    sessionRef.current = session
    session.send({ type: 'connected' })
    return () => session.close()
  }, [sessionId])

  const onFrontCaptured = (dataUrl: string) => {
    setOcrRunning(true)
    ocrService
      .recognizeCccd(dataUrl)
      .then((fields) => {
        sessionRef.current?.send({ type: 'front-captured', image: dataUrl, fields })
      })
      .catch(() => {
        sessionRef.current?.send({ type: 'front-captured', image: dataUrl, fields: {} })
      })
      .finally(() => {
        setOcrRunning(false)
        setStage('back')
      })
  }

  const onBackCaptured = (dataUrl: string) => {
    sessionRef.current?.send({ type: 'back-captured', image: dataUrl })
    setStage('face')
  }

  const onFaceCaptured = (dataUrl: string) => {
    sessionRef.current?.send({ type: 'face-captured', image: dataUrl })
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
          <MonoLabel>{stage === 'front' ? 'Step 1 of 3' : stage === 'back' ? 'Step 2 of 3' : 'Step 3 of 3'}</MonoLabel>
          <div className="text-xl font-medium mt-2 mb-5">
            {stage === 'front'
              ? 'Scan the front of your ID'
              : stage === 'back'
                ? 'Scan the back of your ID'
                : 'Verify your face'}
          </div>
          {ocrRunning ? (
            <div className="py-24 text-center text-sm text-ink-3">Reading your ID…</div>
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

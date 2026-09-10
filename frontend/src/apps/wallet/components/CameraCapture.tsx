import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/primitives'

export interface CameraCaptureProps {
  facingMode?: 'environment' | 'user'
  frameShape?: 'card' | 'oval'
  hint: string
  instruction: string
  onCapture: (dataUrl: string) => void
}

export function CameraCapture({ facingMode = 'user', frameShape = 'card', hint, instruction, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setReady(false)

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Không truy cập được camera')
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [facingMode, retryKey])

  const capture = () => {
    const video = videoRef.current
    if (!video || !ready) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    onCapture(canvas.toDataURL('image/jpeg', 0.92))
  }

  return (
    <div>
      <div
        className="relative mx-4 rounded-3xl overflow-hidden aspect-video"
        style={{ background: 'linear-gradient(160deg,#1A1C20,#0A0B0D)' }}
      >
        {!error && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }}
          />
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-8 text-white/70 text-sm">
            Không truy cập được camera: {error}. Kiểm tra quyền truy cập camera cho trình duyệt.
          </div>
        )}
        {ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="border-2 flex items-center justify-center"
              style={{
                width: frameShape === 'oval' ? 190 : 260,
                height: frameShape === 'oval' ? 240 : 165,
                borderRadius: frameShape === 'oval' ? '120px / 150px' : 14,
                borderColor: 'rgba(255,255,255,.85)',
              }}
            >
              <div className="font-mono text-[9px] text-white/50 tracking-[0.1em] text-center px-2.5">{hint}</div>
            </div>
          </div>
        )}
        {ready && !error && (
          <div className="absolute left-0 right-0 bottom-4 text-center text-white/80 text-xs px-6">
            {instruction}
          </div>
        )}
      </div>
      <div className="flex justify-center mt-6">
        {error ? (
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            Thử lại
          </Button>
        ) : (
          <button
            type="button"
            onClick={capture}
            disabled={!ready}
            className="w-[66px] h-[66px] rounded-full border-[3px] border-ink p-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="w-full h-full rounded-full bg-ink" />
          </button>
        )}
      </div>
    </div>
  )
}

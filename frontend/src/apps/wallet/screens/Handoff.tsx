import { Card, MonoLabel } from '@/components/primitives'
import { KycProgressHeader } from '../components/KycProgressHeader'
import { QrCode } from '../components/QrCode'
import { mobileCaptureUrl } from '../handoffProtocol'

export interface HandoffProps {
  sessionId: string
  marks: number
}

function mark(index: number, current: number): [string, string] {
  if (current > index) return ['✓', '#17795E']
  if (current === index) return ['●', '#16171A']
  return ['○', '#B4B6BC']
}

const CHECKLIST_LABELS = [
  'Connected to phone',
  'Front side scanned',
  'Back side scanned',
  'Face verification',
  'Secure verification',
]

export function Handoff({ sessionId, marks }: HandoffProps) {
  const url = mobileCaptureUrl(sessionId)
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const syncWidth = 50 + marks * 10
  const syncStatus =
    marks === 0 ? 'Waiting for phone…' : marks < 5 ? 'Identity verification in progress' : 'Handing back to desktop…'

  return (
    <Card
      elevated
      padding="none"
      className="w-full max-w-[720px] overflow-hidden"
      style={{ borderRadius: 26, boxShadow: '0 30px 60px -45px rgba(20,22,28,.3)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <KycProgressHeader step={2} total={3} widthPercentOverride={syncWidth} widthTransitionMs={500} />

      <div className="px-8 py-10">
        <div className="text-[26px] font-medium tracking-[-0.028em]">Continue on your phone</div>
        <div className="text-sm text-ink-3 mt-2.5 leading-[1.55] max-w-[420px]">
          Scan this QR code with your phone's camera to open the capture page there. Document scanning
          requires a phone camera.
        </div>

        <div className="flex gap-7 mt-7 flex-wrap items-start">
          <div className="p-4 border border-line rounded-[18px] bg-bg-surface">
            <QrCode value={url} size={200} />
          </div>
          <div className="flex-1 basis-[220px] min-w-[200px]">
            <MonoLabel>Open on phone</MonoLabel>
            <div className="text-xs text-ink-3 mt-2 break-all">{url}</div>
            <div className="h-px bg-line-2 my-5" />
            <div className="flex flex-col gap-3">
              {CHECKLIST_LABELS.map((label, i) => {
                const [icon, color] = mark(i + 1, marks)
                return (
                  <div key={label} className="flex items-center gap-2.5 text-sm" style={{ color }}>
                    {icon} {label}
                  </div>
                )
              })}
            </div>
            <div className="mt-[22px] flex items-center gap-2.5 text-[13px] text-ink-3">
              <span className="w-2 h-2 rounded-full bg-blue animate-[breathe_1.4s_ease-in-out_infinite] inline-block" />
              {syncStatus}
            </div>
          </div>
        </div>
        {isLocalhost && (
          <div className="text-xs text-ink-5 mt-7">
            Bạn đang mở trang ở "localhost" nên điện thoại không mở được link này — chạy qua địa chỉ
            mạng nội bộ của máy, hoặc dùng bản deploy công khai.
          </div>
        )}
      </div>
    </Card>
  )
}

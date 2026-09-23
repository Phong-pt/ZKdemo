import { Card } from '@/components/primitives'
import { KycProgressHeader } from '../components/KycProgressHeader'

export interface KycDocPickerProps {
  onPickDocument: () => void
}

export function KycDocPicker({ onPickDocument }: KycDocPickerProps) {
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
      <KycProgressHeader step={1} total={3} />

      <div className="px-8 py-10">
        <div className="text-[26px] font-medium tracking-[-0.028em]">Verify your identity</div>
        <div className="text-sm text-ink-3 mt-2.5">Choose a document to verify your identity.</div>

        <div className="flex flex-col gap-3 mt-[26px]">
          <div
            role="button"
            tabIndex={0}
            onClick={onPickDocument}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onPickDocument()
            }}
            className="flex items-center gap-4 p-5 border border-line rounded-2xl transition-[border-color,transform] duration-150 ease-out hover:border-ink hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="w-[46px] h-8 rounded-md bg-line-2 border border-line" />
            <div>
              <div className="text-[15px] font-medium">Driver's License</div>
              <div className="text-xs text-ink-4 mt-0.5">Front and back</div>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={onPickDocument}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onPickDocument()
            }}
            className="flex items-center gap-4 p-5 border-2 border-ink rounded-2xl bg-bg-sunken transition-transform duration-150 ease-out hover:-translate-y-0.5 cursor-pointer"
          >
            <div
              className="w-[46px] h-8 rounded-md"
              style={{ background: 'linear-gradient(145deg,#2C2E36,#0F1013)' }}
            />
            <div className="flex-1">
              <div className="text-[15px] font-medium">National ID / CCCD</div>
              <div className="text-xs text-ink-4 mt-0.5">Recommended · fastest verification</div>
            </div>
            <div className="w-5 h-5 rounded-full bg-ink text-white text-[11px] flex items-center justify-center">
              ✓
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={onPickDocument}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onPickDocument()
            }}
            className="flex items-center gap-4 p-5 border border-line rounded-2xl transition-[border-color,transform] duration-150 ease-out hover:border-ink hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="w-[34px] h-11 rounded-[5px] bg-line-2 border border-line" />
            <div>
              <div className="text-[15px] font-medium">Passport</div>
              <div className="text-xs text-ink-4 mt-0.5">Photo page only</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

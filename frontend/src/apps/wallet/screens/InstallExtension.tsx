import { Button, Card, MonoLabel } from '@/components/primitives'
import type { InstallState } from '../types'

export interface InstallExtensionProps {
  productName: string
  install: InstallState
  installPct: number
  onInstall: () => void
}

const CHECKLIST = [
  'Keys never leave your device',
  'Works with your identity credential',
  'Passkey-protected approvals',
]

export function InstallExtension({ productName, install, installPct, onInstall }: InstallExtensionProps) {
  const pct = Math.round(installPct)
  const label = installPct < 55 ? 'Downloading wallet…' : 'Installing wallet…'

  return (
    <Card
      elevated
      className="w-full max-w-[880px] flex gap-11 items-center flex-wrap"
      style={{ borderRadius: 26, padding: 48, boxShadow: '0 30px 60px -45px rgba(20,22,28,.3)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="flex-1 basis-[300px] min-w-0">
        <div className="text-[30px] font-medium tracking-[-0.03em]">Your wallet is ready</div>
        <div className="text-[15px] text-ink-3 mt-3 leading-[1.55]">
          Install the wallet extension to continue. It keeps your keys on this device and signs requests
          locally.
        </div>
        <div className="flex flex-col gap-2.5 my-6">
          {CHECKLIST.map((item) => (
            <div key={item} className="flex gap-2.5 items-center text-sm text-ink-2">
              <span className="text-green">✓</span> {item}
            </div>
          ))}
        </div>

        {install === 'idle' && <Button onClick={onInstall}>Install Wallet</Button>}

        {install === 'busy' && (
          <div>
            <div className="flex justify-between text-[13px] text-ink-3 mb-2">
              <span>{label}</span>
              <MonoLabel as="span" uppercase={false} tracking="0">
                {pct}%
              </MonoLabel>
            </div>
            <div className="h-1.5 bg-line-2 rounded-[3px] overflow-hidden">
              <div
                className="h-full bg-ink rounded-[3px] transition-[width] duration-300 ease-out"
                style={{ width: `${installPct}%` }}
              />
            </div>
          </div>
        )}

        {install === 'done' && (
          <div className="inline-flex items-center gap-2.5 bg-green-bg text-green px-5 py-3.5 rounded-[13px] text-[15px] font-medium">
            ✓ Wallet installed
          </div>
        )}
      </div>

      <div className="flex-none basis-[300px] flex justify-center">
        <div
          className="w-[300px] rounded-[16px] border border-line overflow-hidden bg-bg-sunken"
          style={{ boxShadow: '0 24px 50px -35px rgba(20,22,28,.5)' }}
        >
          <div className="h-[34px] bg-bg-page border-b border-line flex items-center gap-1.5 px-3">
            <span className="w-2 h-2 rounded-full bg-line" />
            <span className="w-2 h-2 rounded-full bg-line" />
            <span className="w-2 h-2 rounded-full bg-line" />
            <div className="flex-1" />
            <div
              className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center"
              style={{ background: 'linear-gradient(145deg,#2A2C33,#0E0F12)' }}
            >
              <div className="w-[7px] h-[7px] rounded-[2px] border-2 border-bg-sunken" />
            </div>
          </div>
          <div className="p-[18px]">
            <div className="text-[13px] font-medium mb-1">{productName} Wallet</div>
            <div className="text-xs text-ink-4 mb-3.5">Browser extension</div>
            <div className="h-2 bg-line-2 rounded-[4px] mb-2" />
            <div className="h-2 w-[70%] bg-line-2 rounded-[4px]" />
          </div>
        </div>
      </div>
    </Card>
  )
}

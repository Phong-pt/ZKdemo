import { Card, MonoLabel } from '@/components/primitives'

export interface PasskeySetupProps {
  onCreatePasskey: () => void
}

export function PasskeySetup({ onCreatePasskey }: PasskeySetupProps) {
  return (
    <Card
      elevated
      className="w-full max-w-[460px] text-center"
      style={{ borderRadius: 26, padding: 40, boxShadow: '0 30px 60px -45px rgba(20,22,28,.3)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <MonoLabel tracking="0.12em" className="mb-3.5 text-left">
        Step 2 of 2
      </MonoLabel>
      <div className="w-24 h-24 mx-auto mt-2 mb-6 rounded-[26px] bg-bg-sunken border border-line-2 flex items-center justify-center">
        <div className="w-11 h-11 border-[3px] border-ink rounded-[14px] relative">
          <span className="absolute left-[9px] top-3 w-[5px] h-[5px] rounded-full bg-ink" />
          <span className="absolute right-[9px] top-3 w-[5px] h-[5px] rounded-full bg-ink" />
          <span className="absolute left-[11px] right-[11px] bottom-[9px] h-[3px] rounded-[2px] bg-ink" />
        </div>
      </div>
      <div className="text-[25px] font-medium tracking-[-0.025em]">Create your passkey</div>
      <div className="text-sm text-ink-3 mt-2.5 leading-[1.55]">
        Passkeys provide secure, passwordless access to your wallet using Face ID or Touch ID.
      </div>
      <button
        type="button"
        onClick={onCreatePasskey}
        className="w-full mt-7 bg-ink text-white py-3.5 rounded-[13px] text-[15px] font-medium cursor-pointer"
      >
        Create passkey
      </button>
    </Card>
  )
}

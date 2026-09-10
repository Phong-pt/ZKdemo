import { Card, MonoLabel } from '@/components/primitives'
import { barColor, computeStrength, STRENGTH_LABELS } from '../passwordStrength'

export interface PasswordSetupProps {
  pw: string
  pw2: string
  onPwChange: (value: string) => void
  onPw2Change: (value: string) => void
  onSubmit: () => void
}

export function PasswordSetup({ pw, pw2, onPwChange, onPw2Change, onSubmit }: PasswordSetupProps) {
  const strength = computeStrength(pw)
  const pwOk = pw.length >= 8 && pw === pw2
  const matchLabel = pw2 ? (pw === pw2 ? 'Passwords match' : 'Passwords do not match') : ''

  return (
    <Card
      elevated
      className="w-full max-w-[460px]"
      style={{ borderRadius: 26, padding: 40, boxShadow: '0 30px 60px -45px rgba(20,22,28,.3)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <MonoLabel tracking="0.12em" className="mb-3.5">
        Step 1 of 2
      </MonoLabel>
      <div className="text-[25px] font-medium tracking-[-0.025em]">Create your wallet password</div>
      <div className="text-sm text-ink-3 mt-2.5 leading-[1.5]">
        This password protects access to your wallet on this device.
      </div>

      <div className="mt-[26px] flex flex-col gap-3.5">
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => onPwChange(e.target.value)}
          className="w-full px-4 py-3.5 border border-line rounded-[12px] text-sm bg-bg-sunken transition-colors duration-150 ease-out focus:outline-none focus:border-blue"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={pw2}
          onChange={(e) => onPw2Change(e.target.value)}
          className="w-full px-4 py-3.5 border border-line rounded-[12px] text-sm bg-bg-sunken transition-colors duration-150 ease-out focus:outline-none focus:border-blue"
        />
      </div>

      <div className="flex gap-1.5 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 h-1 rounded-[2px]" style={{ background: barColor(strength, i) }} />
        ))}
      </div>
      <div className="flex justify-between mt-2.5 text-xs text-ink-4">
        <span>{STRENGTH_LABELS[strength]}</span>
        <span>{matchLabel}</span>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!pwOk}
        className="w-full mt-[26px] text-center text-white py-3.5 rounded-[13px] text-[15px] font-medium transition-colors duration-150 ease-out"
        style={{ background: pwOk ? '#16171A' : '#C9C9C3', cursor: pwOk ? 'pointer' : 'not-allowed' }}
      >
        Create password
      </button>
    </Card>
  )
}

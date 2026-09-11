import { useState } from 'react'
import { Card, MonoLabel } from '@/components/primitives'

export interface VerifierLoginProps {
  busy: boolean
  error: string | null
  onSubmit: (email: string) => void
}

const inputClass =
  'w-full px-[15px] py-3.5 border border-line rounded-xl text-sm bg-bg-sunken transition-colors duration-150 ease-out focus:outline-none focus:border-blue'

export function VerifierLogin({ busy, error, onSubmit }: VerifierLoginProps) {
  const [email, setEmail] = useState('')

  const submit = () => {
    if (email.trim() && !busy) onSubmit(email.trim())
  }

  return (
    <div className="min-h-screen bg-bg-page text-ink flex items-center justify-center p-6">
      <Card
        elevated
        padding="none"
        className="w-full max-w-[420px] overflow-hidden"
        style={{ borderRadius: 26, boxShadow: '0 30px 60px -45px rgba(20,22,28,.3)' }}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="px-8 pt-9 pb-7 border-b border-line-2">
          <MonoLabel>Verifier portal</MonoLabel>
          <div className="text-[26px] font-medium tracking-[-0.028em] mt-3">Sign in</div>
          <div className="text-sm text-ink-3 mt-2.5">
            Use the company email your organisation registered with the Issuer.
          </div>
        </div>

        <div className="px-8 py-7">
          <div className="text-[13px] font-medium mb-2">Work email</div>
          <input
            value={email}
            placeholder="you@ntq-solution.com.vn"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            className={inputClass}
          />
          {error && (
            <div className="text-[13px] mt-3" style={{ color: '#B4763A' }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!email.trim() || busy}
            className="w-full mt-6 text-center text-white py-3.5 rounded-[13px] text-[15px] font-medium transition-colors duration-150 ease-out"
            style={{
              background: email.trim() && !busy ? '#16171A' : '#C9C9C3',
              cursor: email.trim() && !busy ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </div>
      </Card>
    </div>
  )
}

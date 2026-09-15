import { useEffect, useRef, useState } from 'react'
import { Card, MonoLabel } from '@/components/primitives'
import { authService, demoAccount, type GoogleAccount } from '@/services/authService'

export interface VerifierLoginProps {
  busy: boolean
  error: string | null
  onSubmit: (account: GoogleAccount) => void
}

const DEMO_VERIFIER = 'verifier@ntq-solution.com.vn'

export function VerifierLogin({ busy, error, onSubmit }: VerifierLoginProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (buttonRef.current) {
      authService.mountSignInButton(buttonRef.current, onSubmit).then((ok) => {
        if (!cancelled) setMounted(ok)
      })
    }
    return () => {
      cancelled = true
    }
  }, [onSubmit])

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
            Sign in with the Google account of your company. Only domains your organisation registered with
            the Issuer can open this portal.
          </div>
        </div>

        <div className="px-8 py-7 flex flex-col items-center gap-3">
          <div ref={buttonRef} style={{ minHeight: 44 }} />
          {!mounted && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSubmit(demoAccount(DEMO_VERIFIER))}
                className="w-full text-center text-white py-3.5 rounded-[13px] text-[15px] font-medium disabled:opacity-50"
                style={{ background: '#16171A' }}
              >
                {busy ? 'Checking…' : `Continue as ${DEMO_VERIFIER}`}
              </button>
              <div className="text-[12px] text-ink-4 text-center leading-relaxed">
                Google Sign-In chưa được cấu hình (thiếu GOOGLE_CLIENT_ID) — dùng tài khoản demo ở trên.
              </div>
            </>
          )}
          {busy && mounted && <div className="text-[13px] text-ink-3">Checking…</div>}
          {error && (
            <div className="text-[13px] text-center" style={{ color: '#B4763A' }}>
              {error}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

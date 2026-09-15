import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiClient, setAuthToken, type VerificationSession } from '@/services/apiClient'
import { authService, demoAccount, type GoogleAccount } from '@/services/authService'

const labels: Record<string, string> = {
  cccd: 'ID number (CCCD)',
  name: 'Full name',
  dob: 'Date of birth',
  nationality: 'Nationality',
  address: 'Address',
}

const DEMO_LABELS = ['nguoi-dung-a', 'nguoi-dung-b']

export function PresentationApp() {
  const { sessionId = '' } = useParams()
  return <PresentationSession key={sessionId} sessionId={sessionId} />
}

function SignInGate({ onAccount }: { onAccount: (account: GoogleAccount) => void }) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (buttonRef.current) {
      authService.mountSignInButton(buttonRef.current, onAccount).then((ok) => {
        if (!cancelled) setMounted(ok)
      })
    }
    return () => {
      cancelled = true
    }
  }, [onAccount])

  return (
    <>
      <p className="mt-3 text-ink-3">
        Sign in with the account that holds this credential. The verifier never sees which account you use —
        it only receives the proof.
      </p>
      <div className="mt-5 flex flex-col items-center gap-3">
        <div ref={buttonRef} style={{ minHeight: 44 }} />
        {!mounted &&
          DEMO_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => onAccount(demoAccount(label))}
              className="w-full border border-line rounded-xl p-3 text-sm"
            >
              Continue as {demoAccount(label).email}
            </button>
          ))}
      </div>
    </>
  )
}

function PresentationSession({ sessionId }: { sessionId: string }) {
  const [account, setAccount] = useState<GoogleAccount | null>(null)
  const [session, setSession] = useState<VerificationSession | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    if (!account) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const result = await apiClient.getRequest(sessionId)
        if (cancelled) return
        setSession(result)
        if (result.status !== 'pending') return
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được yêu cầu')
      }
      if (!cancelled) timer = setTimeout(poll, 1000)
    }
    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [sessionId, account])

  const signIn = (chosen: GoogleAccount) => {
    setAuthToken(chosen.token)
    setAccount(chosen)
  }

  const respond = async (approve: boolean) => {
    if (!session || submitting.current) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      const result = approve
        ? await apiClient.approveRequest(sessionId, session.revealed_attrs.filter((key) => selected[key]))
        : await apiClient.declineRequest(sessionId)
      setSession(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được phản hồi')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  const sharing = session?.revealed_attrs.filter((key) => selected[key]).length ?? 0

  return (
    <main className="min-h-screen bg-bg-page p-6 flex justify-center items-start text-ink">
      <section className="w-full max-w-lg bg-bg-surface border border-line rounded-[24px] p-8">
        <div className="font-mono text-xs text-ink-4">WALLET · VERIFICATION REQUEST</div>
        <h1 className="text-[26px] font-medium mt-4">
          {account ? (session?.name ?? 'Loading request…') : 'Approve from your wallet'}
        </h1>
        {error && <p role="alert" className="mt-4 text-amber">{error}</p>}

        {!account && <SignInGate onAccount={signIn} />}

        {account && session && (
          <>
            <p className="mt-3 text-ink-3">{session.purpose}</p>
            <p className="mt-1 text-xs text-ink-4">Signed in as {account.email}</p>
            {session.status === 'pending' ? (
              <>
                <p className="mt-5 text-sm text-ink-3">
                  Nothing is shared until you turn it on. Attributes you leave off stay inside the proof —
                  the verifier still learns the credential is valid and yours.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  {session.revealed_attrs.map((key) => (
                    <label key={key} className="flex gap-3 border border-line rounded-xl p-4">
                      <input
                        type="checkbox"
                        checked={!!selected[key]}
                        disabled={busy}
                        onChange={(event) => setSelected((s) => ({ ...s, [key]: event.target.checked }))}
                      />
                      {labels[key] ?? key}
                    </label>
                  ))}
                </div>
                <p className="mt-4 text-sm text-green">
                  Sharing {sharing} of {session.revealed_attrs.length} requested attribute(s).
                </p>
                <button
                  disabled={busy}
                  onClick={() => void respond(true)}
                  className="w-full mt-6 bg-ink text-white rounded-xl p-3 disabled:opacity-50"
                >
                  {busy ? 'Processing…' : 'Approve verification'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void respond(false)}
                  className="w-full mt-3 border border-line rounded-xl p-3 disabled:opacity-50"
                >
                  Decline
                </button>
              </>
            ) : (
              <p role="status" className="mt-6 text-lg">
                {session.status === 'verified'
                  ? 'Verification complete ✓'
                  : session.status === 'expired'
                    ? 'Request expired'
                    : 'Verification declined'}
              </p>
            )}
          </>
        )}

        <Link to="/" className="inline-block mt-6 text-sm text-blue">
          Open identity wallet / issue credential
        </Link>
      </section>
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiClient, type VerificationSession } from '@/services/apiClient'

const labels: Record<string, string> = { name: 'Full name', dob: 'Date of birth', nationality: 'Nationality', address: 'Address' }

export function PresentationApp() {
  const { sessionId = '' } = useParams()
  return <PresentationSession key={sessionId} sessionId={sessionId} />
}

function PresentationSession({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<VerificationSession | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let initialized = false
    const poll = async () => {
      try {
        const result = await apiClient.getRequest(sessionId)
        if (cancelled) return
        setSession(result)
        if (!initialized) {
          setSelected(Object.fromEntries(result.revealed_attrs.map((key) => [key, true])))
          initialized = true
        }
        if (result.status !== 'pending') return
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được yêu cầu')
      }
      if (!cancelled) timer = setTimeout(poll, 1000)
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [sessionId])

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

  return (
    <main className="min-h-screen bg-bg-page p-6 flex justify-center items-start text-ink">
      <section className="w-full max-w-lg bg-bg-surface border border-line rounded-[24px] p-8">
        <div className="font-mono text-xs text-ink-4">WALLET · VERIFICATION REQUEST</div>
        <h1 className="text-[26px] font-medium mt-4">{session?.name ?? 'Loading request…'}</h1>
        {error && <p role="alert" className="mt-4 text-amber">{error}</p>}
        {session && <>
          <p className="mt-3 text-ink-3">{session.purpose}</p>
          {session.status === 'pending' ? <>
            <p className="mt-5 text-sm text-ink-3">Choose the attributes to disclose from the credential issued to this demo wallet. Other attributes remain hidden.</p>
            <div className="mt-4 flex flex-col gap-3">
              {session.revealed_attrs.map((key) => <label key={key} className="flex gap-3 border border-line rounded-xl p-4">
                <input type="checkbox" checked={!!selected[key]} disabled={busy} onChange={(event) => setSelected((s) => ({ ...s, [key]: event.target.checked }))} />
                {labels[key] ?? key}
              </label>)}
            </div>
            <p className="mt-4 text-sm text-green">The issuer signature and possession of the credential will be verified.</p>
            <button disabled={busy} onClick={() => void respond(true)} className="w-full mt-6 bg-ink text-white rounded-xl p-3 disabled:opacity-50">{busy ? 'Processing…' : 'Approve verification'}</button>
            <button disabled={busy} onClick={() => void respond(false)} className="w-full mt-3 border border-line rounded-xl p-3 disabled:opacity-50">Decline</button>
          </> : <p role="status" className="mt-6 text-lg">{session.status === 'verified' ? 'Verification complete ✓' : session.status === 'expired' ? 'Request expired' : 'Verification declined'}</p>}
        </>}
        <Link to="/" className="inline-block mt-6 text-sm text-blue">Open identity wallet / issue credential</Link>
      </section>
    </main>
  )
}

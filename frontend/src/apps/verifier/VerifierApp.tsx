import { useCallback, useEffect, useRef, useState } from 'react'
import { publish, subscribe } from '@/lib/sessionBus'
import { apiClient, setAuthToken } from '@/services/apiClient'
import { authService, type GoogleAccount } from '@/services/authService'
import {
  buildDiscCards,
  buildLogRecord,
  buildReceivedList,
  buildRequestedAttrs,
  buildResultRows,
  buildWithheldList,
  buildZkNote,
  disclosurePercent,
  predicateText,
  proofCount,
  revealedClaims,
  sharedNowClaims,
  withheldClaims,
} from './derived'
import { DetailModal } from './components/DetailModal'
import { Sidebar } from './components/Sidebar'
import { WalletPhone } from './components/WalletPhone'
import { Activity } from './screens/Activity'
import { CreateWizard } from './screens/CreateWizard'
import { Dashboard } from './screens/Dashboard'
import { LiveSession } from './screens/LiveSession'
import { Result } from './screens/Result'
import { Settings } from './screens/Settings'
import { Templates } from './screens/Templates'
import { VerifierLogin } from './screens/VerifierLogin'
import {
  CLAIM_TO_BACKEND_ATTR,
  createInitialVerifierState,
  type Template,
  type View,
  type VerifierState,
} from './types'

const AUTH_STORAGE_KEY = 'verifier-auth'

type VerifierBusEvent =
  | { type: 'simulate-scan' }
  | { type: 'to-disclosure' }
  | { type: 'decline' }
  | { type: 'approve' }
  | { type: 'phone-done' }

export function VerifierApp() {
  const [state, setState] = useState<VerifierState>(createInitialVerifierState)
  const stateRef = useRef(state)
  stateRef.current = state

  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)

  const timers = useRef<number[]>([])
  const expiryInterval = useRef<number | null>(null)

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (expiryInterval.current !== null) {
      clearInterval(expiryInterval.current)
      expiryInterval.current = null
    }
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!stored) return
      const { email, orgName, token } = JSON.parse(stored) as { email: string; orgName: string; token: string }
      setAuthToken(token)
      setState((s) => ({ ...s, authed: true, orgEmail: email, orgName }))
    } catch {
      // ignore malformed/missing storage
    }
  }, [])

  const login = useCallback((account: GoogleAccount) => {
    setAuthToken(account.token)
    setState((s) => ({ ...s, loginBusy: true, loginError: null }))
    apiClient
      .verifierLogin()
      .then((result) => {
        if (!result.authorized || !result.org_name) {
          setAuthToken(null)
          setState((s) => ({
            ...s,
            loginBusy: false,
            loginError: `${result.email} không thuộc tổ chức verifier nào đã đăng ký với issuer.`,
          }))
          return
        }
        try {
          localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({ email: result.email, orgName: result.org_name, token: account.token }),
          )
        } catch {
          // localStorage unavailable — auth just won't survive a refresh
        }
        setState((s) => ({ ...s, authed: true, orgEmail: result.email, orgName: result.org_name!, loginBusy: false }))
      })
      .catch((err: unknown) => {
        setAuthToken(null)
        const message = err instanceof Error ? err.message : 'Không kết nối được tới backend — thử lại.'
        setState((s) => ({ ...s, loginBusy: false, loginError: message }))
      })
  }, [])

  const logout = useCallback(() => {
    clearTimers()
    authService.signOut()
    setAuthToken(null)
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // ignore
    }
    setState(createInitialVerifierState())
  }, [clearTimers])

  const startExpiry = useCallback(() => {
    if (expiryInterval.current !== null) clearInterval(expiryInterval.current)
    expiryInterval.current = window.setInterval(() => {
      setState((s) => ({ ...s, expiry: Math.max(0, s.expiry - 1) }))
    }, 1000)
  }, [])

  const restart = useCallback(() => {
    clearTimers()
    setState((s) => ({ ...createInitialVerifierState(), authed: s.authed, orgEmail: s.orgEmail, orgName: s.orgName }))
    setError(null)
  }, [clearTimers])

  const navigate = useCallback((view: View) => {
    setState((s) => {
      if (view === 'create') return { ...s, view: s.requestPending ? 'live' : 'create' }
      return { ...s, view }
    })
  }, [])

  const startCreate = useCallback(() => {
    clearTimers()
    setError(null)
    setState((s) => ({ ...s, view: 'create', wizard: 1, vstep: 0, gstep: 0, phone: 'idle', disc: {}, result: null, requestPending: false }))
  }, [clearTimers])

  const onName = useCallback((value: string) => setState((s) => ({ ...s, name: value })), [])
  const onDesc = useCallback((value: string) => setState((s) => ({ ...s, desc: value })), [])
  const onPurpose = useCallback((value: string) => setState((s) => ({ ...s, purpose: value })), [])

  const toggleReveal = useCallback((key: string) => {
    setState((s) => ({ ...s, reveal: { ...s.reveal, [key]: !s.reveal[key] } }))
  }, [])
  const toggleCond = useCallback((key: string) => {
    setState((s) => ({ ...s, conds: { ...s.conds, [key]: !s.conds[key] } }))
  }, [])
  const toggleAge = useCallback(() => setState((s) => ({ ...s, ageOn: !s.ageOn })), [])
  const ageMinus = useCallback(() => setState((s) => ({ ...s, age: Math.max(13, s.age - 1) })), [])
  const agePlus = useCallback(() => setState((s) => ({ ...s, age: Math.min(99, s.age + 1) })), [])

  const wizBack = useCallback(() => {
    setState((s) => (s.wizard === 1 ? { ...s, view: 'dashboard' } : { ...s, wizard: s.wizard - 1 }))
  }, [])

  const wizNext = useCallback(async () => {
    const current = stateRef.current
    if (current.wizard < 5) {
      setState((s) => ({ ...s, wizard: s.wizard + 1 }))
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setError(null)
    try {
      const claims = revealedClaims(current)
      const session = await apiClient.createRequest({
        name: current.name,
        purpose: current.purpose || current.desc,
        revealed_attrs: claims.map((c) => CLAIM_TO_BACKEND_ATTR[c.key]),
        conditions: [...Object.keys(current.conds).filter((k) => current.conds[k]), ...(current.ageOn ? ['age'] : [])],
      })
      clearTimers()
      setState((s) => ({ ...s, sessionId: session.id, view: 'live', vstep: 0, phone: 'idle',
        disc: {}, result: null, requestPending: true, expiry: Math.max(0, Math.ceil(session.expires_at - Date.now() / 1000)) }))
      startExpiry()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được yêu cầu')
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }, [clearTimers, startExpiry])

  useEffect(() => {
    if (!state.requestPending) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const session = await apiClient.getRequest(state.sessionId)
        if (cancelled) return
        if (session.status !== 'pending') {
          clearTimers()
          setState((s) => {
            const result = session.result ?? { verified: false, revealed: {} }
            const next = { ...s, result, requestPending: false, phone: 'idle' as const, vstep: result.verified ? 8 : 0 }
            return { ...next, view: 'result', log: [buildLogRecord(next, session.id, result.verified), ...s.log] }
          })
          if (session.status === 'expired') setError('Phiên xác minh đã hết hạn. Hãy tạo yêu cầu mới.')
          return
        }
        setState((s) => ({ ...s, expiry: Math.max(0, Math.ceil(session.expires_at - Date.now() / 1000)) }))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được phiên')
      }
      if (!cancelled) timer = setTimeout(poll, 1000)
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [state.requestPending, state.sessionId, clearTimers])

  const applyTemplate = useCallback((t: Template) => {
    if (t.name === 'Student verification' || t.name === 'Employment verification') {
      setError('Demo chưa có credential sinh viên hoặc việc làm.')
      return
    }
    clearTimers()
    setError(null)
    setState((s) => ({
      ...s,
      view: 'create',
      wizard: 5,
      name: t.name,
      desc: t.desc,
      purpose: t.purpose,
      reveal: t.reveal,
      ageOn: t.ageOn,
      age: t.age,
      conds: t.conds,
      disc: {},
      result: null,
      requestPending: false,
      phone: 'idle',
    }))
  }, [clearTimers])

  const openDetail = useCallback((entry: VerifierState['log'][number]) => setState((s) => ({ ...s, detail: entry })), [])
  const closeDetail = useCallback(() => setState((s) => ({ ...s, detail: null })), [])

  const toggleDisc = useCallback((key: string) => {
    setState((s) => {
      if (!s.reveal[key]) return s
      return { ...s, disc: { ...s.disc, [key]: s.disc[key] === false } }
    })
  }, [])

  const simulateScan = useCallback(() => publish<VerifierBusEvent>(stateRef.current.sessionId, { type: 'simulate-scan' }), [])
  const toDisclosure = useCallback(() => publish<VerifierBusEvent>(stateRef.current.sessionId, { type: 'to-disclosure' }), [])
  const decline = useCallback(() => publish<VerifierBusEvent>(stateRef.current.sessionId, { type: 'decline' }), [])
  const approve = useCallback(() => publish<VerifierBusEvent>(stateRef.current.sessionId, { type: 'approve' }), [])
  const phoneDone = useCallback(() => publish<VerifierBusEvent>(stateRef.current.sessionId, { type: 'phone-done' }), [])

  const runVerification = useCallback(() => {
    const current = stateRef.current
    setState((s) => ({ ...s, vstep: 3 }))
    const attrs = sharedNowClaims(current).map((c) => CLAIM_TO_BACKEND_ATTR[c.key])
    apiClient.approveRequest(current.sessionId, attrs).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Xác minh thất bại')
      setState((s) => s.sessionId === current.sessionId ? { ...s, phone: 'disclosure', vstep: 2 } : s)
    })
  }, [])

  useEffect(() => {
    return subscribe<VerifierBusEvent>(state.sessionId, (event) => {
      if (stateRef.current.view !== 'live' || stateRef.current.expiry <= 0) return
      if (event.type === 'simulate-scan') {
        setState((s) => ({ ...s, phone: 'scan' }))
        after(1300, () => setState((s) => ({ ...s, phone: 'request', vstep: 1 })))
        after(2600, () => setState((s) => ({ ...s, vstep: 2 })))
        return
      }
      if (event.type === 'to-disclosure') {
        setState((s) => ({ ...s, phone: 'disclosure' }))
        return
      }
      if (event.type === 'decline') {
        void apiClient.declineRequest(state.sessionId).catch((err: Error) => setError(err.message))
        return
      }
      if (event.type === 'approve') {
        if (stateRef.current.phone !== 'disclosure') return
        setState((s) => ({ ...s, phone: 'generating', gstep: 0 }))
        ;[500, 1100, 1800, 2500, 3100].forEach((ms, i) => after(ms, () => setState((s) => ({ ...s, gstep: i + 1 }))))
        after(3600, () => {
          setState((s) => ({ ...s, phone: 'sent' }))
          runVerification()
        })
        return
      }
      if (event.type === 'phone-done') {
        setState((s) => ({ ...s, phone: 'idle' }))
      }
    })
  }, [state.sessionId, after, runVerification])

  const activeCount = state.requestPending ? 1 : 0
  const completedCount = state.log.filter((r) => r.result === 'Verified').length
  const successRate = state.log.length ? Math.round((completedCount / state.log.length) * 100) : 0

  const shared = sharedNowClaims(state)
  const withheld = withheldClaims(state)
  const proofN = proofCount(state)
  const sharingCount = `${shared.length} ${shared.length === 1 ? 'attribute' : 'attributes'}`
  const provingCount = `${proofN} ${proofN === 1 ? 'condition' : 'conditions'}`
  const notSharingText = withheld.slice(0, 4).map((c) => c.label).join(', ')

  if (!state.authed) {
    return <VerifierLogin busy={state.loginBusy} error={state.loginError} onSubmit={login} />
  }

  return (
    <div className="min-h-screen bg-bg-page text-ink flex gap-[22px] items-start flex-wrap justify-center p-6">
      <Sidebar orgName={state.orgName} view={state.view} onNavigate={navigate} onRestart={restart} onLogout={logout} />

      <div className="flex-1 basis-[720px] min-w-80 max-w-[920px] flex flex-col gap-[22px]">
        {error && <div role="alert" className="border border-line rounded-xl p-4 text-amber">{error}</div>}
        {creating && <div role="status" className="text-sm text-ink-3">Đang tạo phiên xác minh…</div>}
        {state.view === 'dashboard' && (
          <Dashboard
            activeCount={activeCount}
            completedCount={completedCount}
            successRate={successRate}
            log={state.log}
            onCreateRequest={startCreate}
            onViewAllActivity={() => navigate('activity')}
            onOpenDetail={openDetail}
          />
        )}
        {state.view === 'templates' && <Templates onUse={applyTemplate} />}
        {state.view === 'activity' && <Activity log={state.log} onOpenDetail={openDetail} />}
        {state.view === 'settings' && <Settings orgName={state.orgName} />}
        {state.view === 'create' && (
          <CreateWizard
            state={state}
            onName={onName}
            onDesc={onDesc}
            onPurpose={onPurpose}
            onToggleReveal={toggleReveal}
            onToggleAge={toggleAge}
            onAgeMinus={ageMinus}
            onAgePlus={agePlus}
            onToggleCond={toggleCond}
            onBack={wizBack}
            onNext={wizNext}
          />
        )}
        {state.view === 'live' && (
          <LiveSession
            name={state.name}
            verificationUrl={`${window.location.origin}/present/${state.sessionId}`}
            requestId={state.sessionId}
            vstep={state.vstep}
            expirySeconds={state.expiry}
            sessionText={
              state.vstep === 1
                ? 'A wallet has connected to your verification request.'
                : state.vstep === 2
                  ? 'Waiting for user approval…'
                  : 'Presentation received. No raw attributes stored.'
            }
            predicateText={predicateText(state)}
            phoneIdle={state.phone === 'idle'}
            onSimulateScan={simulateScan}
          />
        )}
        {state.view === 'result' && (
          <Result
            verified={state.log[0]?.result === 'Verified'}
            name={state.name}
            requestId={state.sessionId}
            resultRows={buildResultRows(state)}
            receivedList={buildReceivedList(state)}
            withheldList={buildWithheldList(state)}
            disclosurePct={disclosurePercent(state)}
            onBackToDashboard={() => navigate('dashboard')}
            onNewRequest={startCreate}
          />
        )}
      </div>

      {state.phone !== 'idle' && (
        <WalletPhone
          phone={state.phone}
          requestId={state.sessionId}
          orgName={state.orgName}
          purposeText={state.purpose || state.desc}
          requestedAttrs={buildRequestedAttrs(state)}
          zkNote={buildZkNote(state)}
          discCards={buildDiscCards(state).map((c) => ({ ...c, onToggle: () => toggleDisc(c.key) }))}
          sharingCount={sharingCount}
          provingCount={provingCount}
          notSharingText={notSharingText}
          gstep={state.gstep}
          onToDisclosure={toDisclosure}
          onApprove={approve}
          onDecline={decline}
          onDone={phoneDone}
        />
      )}

      {state.detail && <DetailModal entry={state.detail} onClose={closeDetail} />}
    </div>
  )
}

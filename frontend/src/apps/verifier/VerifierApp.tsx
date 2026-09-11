import { useCallback, useEffect, useRef, useState } from 'react'
import { publish, subscribe } from '@/lib/sessionBus'
import { apiClient } from '@/services/apiClient'
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
  EXPIRY_START_SECONDS,
  REQUEST_ID,
  type Template,
  type View,
  type VerifierState,
} from './types'

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

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
      const { email, orgName } = JSON.parse(stored) as { email: string; orgName: string }
      setState((s) => ({ ...s, authed: true, orgEmail: email, orgName }))
    } catch {
      // ignore malformed/missing storage
    }
  }, [])

  const login = useCallback((email: string) => {
    setState((s) => ({ ...s, loginBusy: true, loginError: null }))
    apiClient
      .verifierLogin(email)
      .then((result) => {
        if (!result.authorized || !result.org_name) {
          setState((s) => ({
            ...s,
            loginBusy: false,
            loginError: 'Email domain này chưa được issuer đăng ký cho tổ chức nào.',
          }))
          return
        }
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ email, orgName: result.org_name }))
        } catch {
          // localStorage unavailable — auth just won't survive a refresh
        }
        setState((s) => ({ ...s, authed: true, orgEmail: email, orgName: result.org_name!, loginBusy: false }))
      })
      .catch(() => {
        setState((s) => ({ ...s, loginBusy: false, loginError: 'Không kết nối được tới backend — thử lại.' }))
      })
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // ignore
    }
    setState(createInitialVerifierState())
  }, [])

  const startExpiry = useCallback(() => {
    if (expiryInterval.current !== null) clearInterval(expiryInterval.current)
    expiryInterval.current = window.setInterval(() => {
      setState((s) => ({ ...s, expiry: Math.max(0, s.expiry - 1) }))
    }, 1000)
  }, [])

  const restart = useCallback(() => {
    clearTimers()
    setState((s) => ({ ...createInitialVerifierState(), authed: s.authed, orgEmail: s.orgEmail, orgName: s.orgName }))
    apiClient.reset().catch(() => {})
  }, [clearTimers])

  const navigate = useCallback((view: View) => {
    setState((s) => {
      if (view === 'create') return { ...s, view: s.vstep > 0 ? 'live' : 'create' }
      return { ...s, view }
    })
  }, [])

  const startCreate = useCallback(() => {
    setState((s) => ({ ...s, view: 'create', wizard: 1, vstep: 0, gstep: 0, phone: 'idle', disc: {} }))
  }, [])

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

  const wizNext = useCallback(() => {
    setState((s) => {
      if (s.wizard < 5) return { ...s, wizard: s.wizard + 1 }
      startExpiry()
      return { ...s, view: 'live', vstep: 0, phone: 'idle', expiry: EXPIRY_START_SECONDS }
    })
  }, [startExpiry])

  const applyTemplate = useCallback((t: Template) => {
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
    }))
  }, [])

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
    setState((s) => ({ ...s, vstep: 3 }))
    ;[700, 1500, 2300, 3100, 3900].forEach((ms, i) => after(ms, () => setState((s) => ({ ...s, vstep: 4 + i }))))

    const revealKeys = revealedClaims(stateRef.current)
      .map((c) => CLAIM_TO_BACKEND_ATTR[c.key])
      .filter((k): k is string => Boolean(k))

    Promise.all([apiClient.verifyPresentation(revealKeys), delay(4700)])
      .then(([result]) => {
        setState((s) => {
          const record = buildLogRecord(s, REQUEST_ID, result.verified)
          return { ...s, view: 'result', log: [record, ...s.log] }
        })
      })
      .catch((err: unknown) => {
        console.error('Xác minh thất bại:', err)
        setState((s) => {
          const record = buildLogRecord(s, REQUEST_ID, false)
          return { ...s, view: 'result', log: [record, ...s.log] }
        })
      })
      .finally(() => {
        if (expiryInterval.current !== null) {
          clearInterval(expiryInterval.current)
          expiryInterval.current = null
        }
      })
  }, [after])

  useEffect(() => {
    return subscribe<VerifierBusEvent>(state.sessionId, (event) => {
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
        setState((s) => ({ ...s, phone: 'idle', vstep: 0 }))
        return
      }
      if (event.type === 'approve') {
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

  const activeCount = state.view === 'live' ? 1 : 0
  const completedCount = state.log.filter((r) => r.result === 'Verified').length
  const successRate = Math.round((completedCount / state.log.length) * 100)

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
            requestId={REQUEST_ID}
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
            requestId={REQUEST_ID}
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
          requestId={REQUEST_ID}
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { connectSession } from '@/lib/realtimeSession'
import { apiClient, type IdentityAttributes } from '@/services/apiClient'
import { authService, DEMO_GOOGLE_ACCOUNT } from '@/services/authService'
import { kycService } from '@/services/kycService'
import { walletService } from '@/services/walletService'
import { IdentityCardModal } from './components/IdentityCardModal'
import { Header } from './components/Header'
import { PasskeyModal } from './components/PasskeyModal'
import type { HandoffEvent } from './handoffProtocol'
import { GoogleModal } from './screens/GoogleModal'
import { Handoff } from './screens/Handoff'
import { InstallExtension } from './screens/InstallExtension'
import { KycDocPicker } from './screens/KycDocPicker'
import { KycReview } from './screens/KycReview'
import { Landing } from './screens/Landing'
import { PasskeySetup } from './screens/PasskeySetup'
import { PasswordSetup } from './screens/PasswordSetup'
import { Processing } from './screens/Processing'
import { SignedIn } from './screens/SignedIn'
import { Verified } from './screens/Verified'
import { WalletDashboard } from './screens/WalletDashboard'
import { createInitialWalletState, STAGE_LABELS, type IdentityForm, type WalletState } from './types'

const PRODUCT_NAME = 'Vaulta'

export function WalletApp() {
  const [state, setState] = useState<WalletState>(createInitialWalletState)
  const stateRef = useRef(state)
  stateRef.current = state

  const requestId = useRef(0)
  const timers = useRef<number[]>([])

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
  }, [])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const restart = useCallback(() => {
    requestId.current += 1
    clearTimers()
    setState(createInitialWalletState())
    apiClient.reset().catch(() => {})
  }, [clearTimers])

  const startGoogle = useCallback(() => {
    setState((s) => ({ ...s, step: 'google' }))
  }, [])

  const pickAccount = useCallback(() => {
    const id = ++requestId.current
    setState((s) => ({ ...s, googleBusy: true }))
    authService.signInWithGoogle().then((account) => {
      if (requestId.current !== id) return
      setState((s) => ({ ...s, step: 'signedin', googleBusy: false, account }))
      after(4000, () => setState((s) => ({ ...s, step: 'install' })))
    })
  }, [after])

  const installWallet = useCallback(() => {
    const id = ++requestId.current
    setState((s) => ({ ...s, install: 'busy', installPct: 0 }))
    walletService
      .installExtension((pct) => {
        if (requestId.current !== id) return
        setState((s) => ({ ...s, installPct: pct }))
      })
      .then(() => {
        if (requestId.current !== id) return
        after(700, () => setState((s) => ({ ...s, install: 'done' })))
        after(2000, () => setState((s) => ({ ...s, step: 'password' })))
      })
  }, [after])

  const onPwChange = useCallback((value: string) => setState((s) => ({ ...s, pw: value })), [])
  const onPw2Change = useCallback((value: string) => setState((s) => ({ ...s, pw2: value })), [])

  const submitPassword = useCallback(() => {
    setState((s) => {
      if (s.pw.length >= 8 && s.pw === s.pw2) return { ...s, step: 'passkey' }
      return s
    })
  }, [])

  const createPasskey = useCallback(() => {
    const id = ++requestId.current
    setState((s) => ({ ...s, passkey: 'scanning', passkeyError: null }))
    const displayName = stateRef.current.account?.name ?? 'Wallet user'
    walletService
      .createPasskey(displayName)
      .then(() => {
        if (requestId.current !== id) return
        setState((s) => ({ ...s, passkey: 'done' }))
      })
      .catch((err: unknown) => {
        if (requestId.current !== id) return
        const message = err instanceof Error ? err.message : 'Không tạo được passkey'
        setState((s) => ({ ...s, passkey: 'idle', passkeyError: message }))
      })
  }, [])

  const finishPasskey = useCallback(() => {
    setState((s) => ({ ...s, step: 'wallet', passkey: 'idle' }))
  }, [])

  const startKyc = useCallback(() => setState((s) => ({ ...s, step: 'kycdoc' })), [])
  const pickDocument = useCallback(() => setState((s) => ({ ...s, step: 'handoff' })), [])

  const rescan = useCallback(() => {
    setState((s) => ({
      ...s,
      step: 'handoff',
      handoffSessionId: crypto.randomUUID(),
      marks: 0,
      frontImage: null,
      backImage: null,
      faceImage: null,
    }))
  }, [])

  useEffect(() => {
    if (state.step !== 'handoff') return
    const session = connectSession<HandoffEvent>(state.handoffSessionId, (event) => {
      if (event.type === 'connected') {
        setState((s) => ({ ...s, marks: Math.max(s.marks, 1) }))
      } else if (event.type === 'front-captured') {
        setState((s) => ({
          ...s,
          marks: 2,
          frontImage: event.image,
          identityForm: {
            cccd: event.fields.cccd ?? s.identityForm.cccd,
            name: event.fields.name ?? s.identityForm.name,
            dob: event.fields.dob ?? s.identityForm.dob,
            nationality: event.fields.nationality ?? s.identityForm.nationality,
            address: event.fields.address ?? s.identityForm.address,
          },
        }))
      } else if (event.type === 'back-captured') {
        setState((s) => ({ ...s, marks: 3, backImage: event.image }))
      } else if (event.type === 'face-captured') {
        setState((s) => ({ ...s, marks: 4, faceImage: event.image }))
      } else if (event.type === 'done') {
        setState((s) => ({ ...s, marks: 5 }))
        after(700, () => setState((s) => ({ ...s, step: 'kycreview' })))
      }
    })
    return () => session.close()
  }, [state.step, state.handoffSessionId, after])

  const onIdentityFieldChange = useCallback((field: keyof IdentityForm, value: string) => {
    setState((s) => ({ ...s, identityForm: { ...s.identityForm, [field]: value } }))
  }, [])

  const startProcessing = useCallback(() => {
    const id = ++requestId.current
    const identity: IdentityAttributes = { ...stateRef.current.identityForm }
    setState((s) => ({ ...s, step: 'processing', proc: 0, processingError: null }))
    kycService
      .runProcessing(identity, (step) => {
        if (requestId.current !== id) return
        setState((s) => ({ ...s, proc: step }))
      })
      .then((verifiedIdentity) => {
        if (requestId.current !== id) return
        setState((s) => ({ ...s, step: 'verified', verifiedIdentity }))
      })
      .catch((err: unknown) => {
        if (requestId.current !== id) return
        const message = err instanceof Error ? err.message : 'Không thể kết nối tới backend'
        setState((s) => ({ ...s, proc: 0, processingError: message }))
      })
  }, [])

  const toWallet = useCallback(() => setState((s) => ({ ...s, step: 'wallet' })), [])
  const openCard = useCallback(() => setState((s) => ({ ...s, cardOpen: true })), [])
  const closeCard = useCallback(() => setState((s) => ({ ...s, cardOpen: false })), [])

  return (
    <div className="min-h-screen bg-bg-page text-ink flex flex-col items-center gap-6 px-6 pt-7 pb-16">
      <Header productName={PRODUCT_NAME} stageLabel={STAGE_LABELS[state.step]} onRestart={restart} />

      {state.step === 'landing' && <Landing onStartGoogle={startGoogle} />}

      {state.step === 'google' && (
        <GoogleModal
          productName={PRODUCT_NAME}
          account={DEMO_GOOGLE_ACCOUNT}
          busy={state.googleBusy}
          onPickAccount={pickAccount}
        />
      )}

      {state.step === 'signedin' && state.account && <SignedIn account={state.account} />}

      {state.step === 'install' && (
        <InstallExtension
          productName={PRODUCT_NAME}
          install={state.install}
          installPct={state.installPct}
          onInstall={installWallet}
        />
      )}

      {state.step === 'password' && (
        <PasswordSetup
          pw={state.pw}
          pw2={state.pw2}
          onPwChange={onPwChange}
          onPw2Change={onPw2Change}
          onSubmit={submitPassword}
        />
      )}

      {state.step === 'passkey' && <PasskeySetup onCreatePasskey={createPasskey} />}
      {state.passkey !== 'idle' && <PasskeyModal passkey={state.passkey} onFinish={finishPasskey} />}
      {state.step === 'passkey' && state.passkeyError && (
        <div className="text-sm text-center -mt-2" style={{ color: '#B4763A' }}>
          {state.passkeyError}
        </div>
      )}

      {state.step === 'wallet' && state.account && (
        <WalletDashboard
          account={state.account}
          verifiedIdentity={state.verifiedIdentity}
          onStartKyc={startKyc}
          onOpenCard={openCard}
        />
      )}
      {state.step === 'wallet' && state.cardOpen && state.account && state.verifiedIdentity && (
        <IdentityCardModal account={state.account} identity={state.verifiedIdentity} onClose={closeCard} />
      )}

      {state.step === 'kycdoc' && <KycDocPicker onPickDocument={pickDocument} />}
      {state.step === 'handoff' && <Handoff sessionId={state.handoffSessionId} marks={state.marks} />}
      {state.step === 'kycreview' && (
        <KycReview
          form={state.identityForm}
          frontImage={state.frontImage}
          backImage={state.backImage}
          faceImage={state.faceImage}
          onChange={onIdentityFieldChange}
          onRetake={rescan}
          onSubmit={startProcessing}
        />
      )}
      {state.step === 'processing' && (
        <Processing proc={state.proc} error={state.processingError} onRetry={startProcessing} />
      )}
      {state.step === 'verified' && <Verified onOpenWallet={toWallet} />}
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { connectSession } from '@/lib/realtimeSession'
import { apiClient, setAuthToken, type IdentityAttributes } from '@/services/apiClient'
import { authService, type GoogleAccount } from '@/services/authService'
import { kycService } from '@/services/kycService'
import { walletService, walletStore } from '@/services/walletService'
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
import {
  createInitialWalletState,
  EMPTY_IDENTITY_FORM,
  STAGE_LABELS,
  type IdentityForm,
  type WalletState,
} from './types'

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
    walletStore.clearAll()
    setState(createInitialWalletState())
    apiClient.reset().catch(() => {})
  }, [clearTimers])

  const startGoogle = useCallback(() => {
    setState((s) => ({ ...s, step: 'google' }))
  }, [])

  const onAccount = useCallback(
    (account: GoogleAccount) => {
      setAuthToken(account.token)
      setState((s) => ({ ...s, step: 'signedin', account }))
      // Ví gắn với tài khoản Google chứ không gắn với phiên. Máy này đã cài ví cho tài khoản đó
      // rồi thì đăng nhập lại chỉ phải mở khoá bằng passkey; chưa cài thì mới đi qua cài đặt.
      const device = walletStore.get(account.email)
      apiClient
        .me()
        .catch(() => null)
        .then((me) => {
          const identity = me?.has_credential ? me.identity : null
          after(1600, () =>
            setState((s) => ({
              ...s,
              step: device ? (device.passkeyId ? 'unlock' : 'wallet') : 'install',
              verifiedIdentity: identity
                ? {
                    name: identity.name,
                    dob: identity.dob,
                    nationality: identity.nationality,
                    document: 'National ID (CCCD)',
                  }
                : null,
            })),
          )
        })
    },
    [after],
  )

  // Đăng xuất chỉ rời phiên; credential của tài khoản đó vẫn nằm nguyên trong ví phía máy chủ,
  // đăng nhập lại là thấy lại thẻ. Muốn xoá sạch mọi ví thì dùng "Restart demo".
  const signOut = useCallback(() => {
    requestId.current += 1
    clearTimers()
    authService.signOut()
    setAuthToken(null)
    setState(createInitialWalletState())
  }, [clearTimers])

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
        after(2000, () =>
          setState((s) => ({ ...s, step: s.account?.isGoogle ? 'passkey' : 'password' })),
        )
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

  const passkeyAbort = useRef<AbortController | null>(null)

  const createPasskey = useCallback(() => {
    const id = ++requestId.current
    const controller = new AbortController()
    passkeyAbort.current = controller
    setState((s) => ({ ...s, passkey: 'scanning', passkeyError: null }))
    const displayName = stateRef.current.account?.name ?? 'Wallet user'
    walletService
      .createPasskey(displayName, controller.signal)
      .then((passkeyId) => {
        if (requestId.current !== id) return
        walletStore.save(stateRef.current.account?.email ?? '', passkeyId)
        setState((s) => ({ ...s, passkey: 'done' }))
      })
      .catch((err: unknown) => {
        if (requestId.current !== id) return
        const message = err instanceof Error ? err.message : 'Không tạo được passkey'
        setState((s) => ({ ...s, passkey: 'idle', passkeyError: message }))
      })
  }, [])

  const unlockWallet = useCallback(() => {
    const id = ++requestId.current
    const controller = new AbortController()
    passkeyAbort.current = controller
    setState((s) => ({ ...s, passkey: 'scanning', passkeyError: null }))
    const passkeyId = walletStore.get(stateRef.current.account?.email ?? '')?.passkeyId ?? ''
    walletService
      .unlockWithPasskey(passkeyId, controller.signal)
      .then(() => {
        if (requestId.current !== id) return
        setState((s) => ({ ...s, passkey: 'done' }))
      })
      .catch((err: unknown) => {
        if (requestId.current !== id) return
        const message = err instanceof Error ? err.message : 'Không mở được ví bằng passkey'
        setState((s) => ({ ...s, passkey: 'idle', passkeyError: message }))
      })
  }, [])

  const cancelPasskey = useCallback(() => {
    passkeyAbort.current?.abort()
  }, [])

  const finishPasskey = useCallback(() => {
    setState((s) => ({ ...s, step: 'wallet', passkey: 'idle' }))
  }, [])

  // Máy không có thiết bị xác thực thì vẫn coi là đã cài ví, chỉ không có passkey để mở khoá —
  // lần đăng nhập sau vào thẳng ví thay vì bắt cài lại từ đầu.
  const skipPasskey = useCallback(() => {
    passkeyAbort.current?.abort()
    walletStore.save(stateRef.current.account?.email ?? '', null)
    setState((s) => ({ ...s, step: 'wallet', passkey: 'idle', passkeyError: null }))
  }, [])

  const startKyc = useCallback(() => setState((s) => ({ ...s, step: 'kycdoc' })), [])
  const pickDocument = useCallback(() => setState((s) => ({ ...s, step: 'handoff' })), [])

  const rescan = useCallback(() => {
    setState((s) => ({
      ...s,
      step: 'handoff',
      handoffSessionId: crypto.randomUUID(),
      marks: 0,
    }))
  }, [])

  useEffect(() => {
    if (state.step !== 'handoff') return
    const session = connectSession<HandoffEvent>(state.handoffSessionId, (event) => {
      if (event.type === 'connected') {
        setState((s) => ({ ...s, marks: Math.max(s.marks, 1) }))
      } else if (event.type === 'front-captured') {
        const scanned = event.fields
        setState((s) => ({ ...s, marks: 2, identityForm: { ...EMPTY_IDENTITY_FORM, ...scanned } }))
        // Quê quán và ngày hết hạn không nằm trong mã QR của thẻ, hỏi issuer theo số vừa quét.
        if (scanned.cccd) {
          apiClient
            .ekycLookup(scanned.cccd)
            .then((extra) =>
              setState((s) => ({ ...s, identityForm: { ...s.identityForm, ...extra } })),
            )
            .catch(() => {})
        }
      } else if (event.type === 'back-captured') {
        setState((s) => ({ ...s, marks: 3 }))
      } else if (event.type === 'face-captured') {
        setState((s) => ({ ...s, marks: 4 }))
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
      <Header
        productName={PRODUCT_NAME}
        stageLabel={STAGE_LABELS[state.step]}
        accountEmail={state.account?.email}
        onRestart={restart}
        onSignOut={signOut}
      />

      {state.step === 'landing' && <Landing onStartGoogle={startGoogle} />}

      {state.step === 'google' && <GoogleModal productName={PRODUCT_NAME} onAccount={onAccount} />}

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
      {state.step === 'unlock' && <PasskeySetup mode="unlock" onCreatePasskey={unlockWallet} />}
      {state.passkey !== 'idle' && (
        <PasskeyModal
          passkey={state.passkey}
          mode={state.step === 'unlock' ? 'unlock' : 'create'}
          onFinish={finishPasskey}
          onCancel={cancelPasskey}
        />
      )}
      {(state.step === 'passkey' || state.step === 'unlock') && state.passkeyError && (
        <div className="text-sm text-center -mt-2 flex flex-col items-center gap-2">
          <span style={{ color: '#B4763A' }}>{state.passkeyError}</span>
          <button type="button" onClick={skipPasskey} className="text-ink-3 underline cursor-pointer">
            Máy này không có thiết bị xác thực — tiếp tục không dùng passkey (demo)
          </button>
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

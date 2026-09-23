import { useCallback, useEffect, useRef, useState } from 'react'
import { connectSession } from '@/lib/realtimeSession'
import { apiClient, setAuthToken, type IdentityAttributes } from '@/services/apiClient'
import { authService, isTokenExpired, type GoogleAccount } from '@/services/authService'
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
import {
  createInitialWalletState,
  EMPTY_IDENTITY_FORM,
  STAGE_LABELS,
  type IdentityForm,
  type WalletState,
} from './types'

const PRODUCT_NAME = 'NX Cred'

// Phiên đăng nhập sống qua việc tải lại trang. Mốc thời gian được làm mới đều đặn khi tab còn
// mở, nên thực tế TTL này tính từ lúc người dùng đóng tab: quay lại trong vòng năm phút thì vẫn
// còn phiên, lâu hơn thì phải đăng nhập lại. Bấm Sign out là xoá ngay lập tức.
const SESSION_KEY = 'nxcred-wallet-session'
const SESSION_TTL_MS = 5 * 60 * 1000
const SESSION_HEARTBEAT_MS = 30 * 1000

function loadSession(): GoogleAccount | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const { account, savedAt } = JSON.parse(raw) as { account: GoogleAccount; savedAt: number }
    if (Date.now() - savedAt > SESSION_TTL_MS || isTokenExpired(account.token)) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return account
  } catch {
    return null
  }
}

function saveSession(account: GoogleAccount | null): void {
  try {
    if (account) localStorage.setItem(SESSION_KEY, JSON.stringify({ account, savedAt: Date.now() }))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Tab ẩn danh chặn localStorage: phiên chỉ sống trong bộ nhớ, tải lại trang là mất.
  }
}

export function WalletApp() {
  const [state, setState] = useState<WalletState>(createInitialWalletState)
  const stateRef = useRef(state)
  stateRef.current = state

  const requestId = useRef(0)
  const issuanceAbort = useRef<AbortController | null>(null)
  const timers = useRef<number[]>([])

  const after = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timers.current.push(id)
  }, [])

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  useEffect(() => () => { clearTimers(); issuanceAbort.current?.abort() }, [clearTimers])

  // Tab còn mở thì phiên còn sống; TTL chỉ bắt đầu đếm từ lúc đóng tab.
  useEffect(() => {
    if (!state.account) return
    const timer = window.setInterval(
      () => saveSession(stateRef.current.account),
      SESSION_HEARTBEAT_MS,
    )
    return () => window.clearInterval(timer)
  }, [state.account])

  const restart = useCallback(() => {
    issuanceAbort.current?.abort()
    requestId.current += 1
    clearTimers()
    saveSession(null)
    setAuthToken(null)
    setState(createInitialWalletState())
  }, [clearTimers])

  const startGoogle = useCallback(() => {
    setState((s) => ({ ...s, step: 'google' }))
  }, [])

  const onAccount = useCallback(
    (account: GoogleAccount) => {
      const id = ++requestId.current
      issuanceAbort.current?.abort()
      clearTimers()
      setAuthToken(account.token)
      saveSession(account)
      setState((s) => ({ ...s, step: 'signedin', account }))
      // Ví và passkey gắn với tài khoản Google ở phía máy chủ, không gắn với trình duyệt. Nhờ vậy
      // đăng nhập từ điện thoại hay máy khác vẫn bị đòi đúng passkey đã đăng ký, thay vì được cài
      // ví mới — muốn vào thì phải có thiết bị giữ passkey đó (WebAuthn lo phần quét chéo thiết bị).
      apiClient
        .me()
        .then((me) => {
          if (requestId.current !== id) return
          const identity = me.has_credential ? me.identity : null
          const next = !me.wallet_ready ? 'install' : me.has_passkey ? 'unlock' : 'wallet'
          after(1600, () =>
            setState((s) => ({
              ...s,
              step: next,
              loadError: null,
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
        // Hỏi máy chủ hỏng thì dừng lại chứ tuyệt đối không mặc định cho cài ví mới: đúng lúc đó
        // là lúc ta không biết tài khoản đã có ví hay chưa, cho qua là mở toang cửa.
        .catch((err: unknown) => {
          if (requestId.current !== id) return
          const message = err instanceof Error ? err.message : 'Không kết nối được máy chủ'
          setState((s) => ({ ...s, loadError: message }))
        })
    },
    [after, clearTimers],
  )

  // Mở lại trang thì lấy phiên cũ ra dùng tiếp thay vì bắt đăng nhập lại từ đầu.
  useEffect(() => {
    const stored = loadSession()
    if (stored) onAccount(stored)
    // Chỉ chạy đúng một lần lúc mở trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đăng xuất chỉ rời phiên; credential của tài khoản đó vẫn nằm nguyên trong ví phía máy chủ,
  // đăng nhập lại là thấy lại thẻ. Muốn xoá sạch mọi ví thì dùng "Restart demo".
  const signOut = useCallback(() => {
    issuanceAbort.current?.abort()
    requestId.current += 1
    clearTimers()
    authService.signOut()
    setAuthToken(null)
    saveSession(null)
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
    walletService
      .createPasskey(controller.signal)
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

  const unlockWallet = useCallback(() => {
    const id = ++requestId.current
    const controller = new AbortController()
    passkeyAbort.current = controller
    setState((s) => ({ ...s, passkey: 'scanning', passkeyError: null }))
    walletService
      .unlockWithPasskey(controller.signal)
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

  const finishPasskey = useCallback(async () => {
    const id = requestId.current
    try {
      const me = await apiClient.me()
      if (requestId.current !== id) return
      setState(s => ({...s, step: 'wallet', passkey: 'idle', loadError: null,
        verifiedIdentity: me.identity ? { name: me.identity.name, dob: me.identity.dob,
          nationality: me.identity.nationality, document: 'National ID (CCCD)' } : null }))
    } catch (err) {
      if (requestId.current === id) setState(s => ({...s, passkey: 'idle', passkeyError: err instanceof Error ? err.message : 'Không đọc được ví'}))
    }
  }, [])

  // Máy không có thiết bị xác thực thì vẫn coi là đã cài ví, chỉ không có passkey để mở khoá —
  // lần đăng nhập sau vào thẳng ví thay vì bắt cài lại từ đầu.
  const skipPasskey = useCallback(async () => {
    passkeyAbort.current?.abort()
    const id = requestId.current
    try {
      await apiClient.passkeySkip()
      if (requestId.current !== id) return
      setState((s) => ({ ...s, step: 'wallet', passkey: 'idle', passkeyError: null }))
    } catch (err) {
      if (requestId.current !== id) return
      setState(s => ({...s, passkeyError: err instanceof Error ? err.message : 'Không thể tiếp tục'}))
    }
  }, [])

  const startKyc = useCallback(() => setState((s) => ({ ...s, step: 'kycdoc' })), [])
  const pickDocument = useCallback(() => setState((s) => ({ ...s, step: 'handoff' })), [])

  const rescan = useCallback(() => {
    setState((s) => ({
      ...s,
      step: 'handoff',
      handoffSessionId: crypto.randomUUID(),
      marks: 0,
      simulatingHandoff: false,
      handoffError: null,
    }))
  }, [])

  // Mô phỏng đúng chuỗi sự kiện điện thoại đẩy về: nối máy, quét mặt trước kèm dữ liệu thẻ, mặt
  // sau, khuôn mặt, xong. Dữ liệu là một hồ sơ thật trong cơ sở dữ liệu căn cước của issuer, nên
  // bước duyệt ở cổng issuer vẫn đối chiếu từng trường như với thẻ quét thật.
  const simulateHandoff = useCallback(() => {
    const id = ++requestId.current
    setState((s) => ({ ...s, simulatingHandoff: true, handoffError: null }))
    apiClient
      .ekycDemoRecord()
      .then((record) => {
        if (requestId.current !== id) return
        setState((s) => ({ ...s, marks: 1 }))
        after(450, () => setState((s) => ({ ...s, marks: 2, identityForm: { ...record } })))
        after(900, () => setState((s) => ({ ...s, marks: 3 })))
        after(1350, () => setState((s) => ({ ...s, marks: 4 })))
        after(1800, () => setState((s) => ({ ...s, marks: 5 })))
        after(2500, () => setState((s) => ({ ...s, step: 'kycreview', simulatingHandoff: false })))
      })
      .catch((err: unknown) => {
        if (requestId.current !== id) return
        const message = err instanceof Error ? err.message : 'Không lấy được hồ sơ căn cước mẫu'
        setState((s) => ({ ...s, simulatingHandoff: false, handoffError: message }))
      })
  }, [after])

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
            .then((extra) => {
              if (stateRef.current.handoffSessionId !== state.handoffSessionId || stateRef.current.identityForm.cccd !== scanned.cccd) return
              setState((s) => ({ ...s, identityForm: { ...s.identityForm, ...extra } }))
            })
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

  const startProcessing = useCallback((resumeIdentity?: IdentityAttributes) => {
    issuanceAbort.current?.abort()
    const controller = new AbortController()
    issuanceAbort.current = controller
    const id = ++requestId.current
    const identity: IdentityAttributes = resumeIdentity || { ...stateRef.current.identityForm }
    setState((s) => ({ ...s, step: 'processing', proc: 0, processingError: null }))
    kycService
      .runProcessing(identity, (step) => {
        if (requestId.current !== id) return
        setState((s) => ({ ...s, proc: step }))
      }, controller.signal)
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

  useEffect(() => {
    if (state.step !== 'wallet' || !state.account || state.verifiedIdentity) return
    let active = true
    apiClient.currentIssuance().then(request => {
      if (!active || !request) return
      setState(s => ({...s, identityForm: request.attributes}))
      startProcessing(request.attributes)
    }).catch(err => {
      if (active) setState(s => ({...s, loadError: err instanceof Error ? err.message : 'Không đọc được yêu cầu đang chờ'}))
    })
    return () => { active = false }
  }, [state.step, state.account, state.verifiedIdentity, startProcessing])

  const editIssuance = useCallback(async () => {
    issuanceAbort.current?.abort()
    requestId.current += 1
    try {
      const request = await apiClient.currentIssuance()
      if (request) await apiClient.cancelIssuance(request.id)
      setState(s => ({...s, step: 'kycreview', processingError: null}))
    } catch (err) {
      setState(s => ({...s, processingError: err instanceof Error ? err.message : 'Không thể hủy yêu cầu'}))
    }
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
      {state.step === 'signedin' && state.loadError && (
        <div className="text-sm text-center flex flex-col items-center gap-2">
          <span style={{ color: '#B4763A' }}>
            Không đọc được ví của tài khoản này: {state.loadError}
          </span>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => state.account && onAccount(state.account)}
              className="text-ink-3 underline cursor-pointer"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={signOut}
              className="text-ink-3 underline cursor-pointer"
            >
              Đăng nhập lại
            </button>
          </div>
        </div>
      )}

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
          {state.step === 'passkey' && <button type="button" onClick={skipPasskey} className="text-ink-3 underline cursor-pointer">
            Máy này không có thiết bị xác thực — tiếp tục không dùng passkey (demo)
          </button>}
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
      {state.step === 'wallet' && state.loadError && <p role="alert" className="text-sm text-red-700">{state.loadError}. Hãy đăng nhập lại để tiếp tục.</p>}
      {state.step === 'wallet' && state.cardOpen && state.account && state.verifiedIdentity && (
        <IdentityCardModal account={state.account} identity={state.verifiedIdentity} onClose={closeCard} />
      )}

      {state.step === 'kycdoc' && <KycDocPicker onPickDocument={pickDocument} />}
      {state.step === 'handoff' && (
        <Handoff
          sessionId={state.handoffSessionId}
          marks={state.marks}
          simulating={state.simulatingHandoff}
          error={state.handoffError}
          onSimulate={simulateHandoff}
        />
      )}
      {state.step === 'kycreview' && (
        <KycReview
          form={state.identityForm}
          onChange={onIdentityFieldChange}
          onRetake={rescan}
          onSubmit={() => startProcessing()}
        />
      )}
      {state.step === 'processing' && (
        <Processing proc={state.proc} error={state.processingError} onRetry={() => startProcessing()} onEdit={editIssuance} />
      )}
      {state.step === 'verified' && <Verified onOpenWallet={toWallet} />}
    </div>
  )
}

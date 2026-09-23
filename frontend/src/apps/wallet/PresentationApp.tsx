import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { WalletPhone } from '@/apps/verifier/components/WalletPhone'
import { CLAIMS, CLAIM_TO_BACKEND_ATTR, type PhoneState } from '@/apps/verifier/types'
import { apiClient, setAuthToken, type VerificationSession } from '@/services/apiClient'
import { walletService } from '@/services/walletService'
import { authService, demoAccount, type GoogleAccount } from '@/services/authService'

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
    <div className="w-full max-w-[420px] bg-bg-surface border border-line rounded-[24px] p-8 text-center">
      <div className="font-mono text-xs text-ink-4">NX CRED · YÊU CẦU XÁC MINH</div>
      <h1 className="text-[22px] font-medium mt-4">Mở ví để duyệt yêu cầu</h1>
      <p className="mt-3 text-[13px] text-ink-3 leading-[1.6]">
        Đăng nhập bằng tài khoản đang giữ thẻ định danh. Bên xác minh không biết bạn dùng tài
        khoản nào — họ chỉ nhận được bằng chứng.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <div ref={buttonRef} style={{ minHeight: 44 }} />
        {!mounted &&
          DEMO_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => onAccount(demoAccount(label))}
              className="w-full border border-line rounded-xl p-3 text-sm cursor-pointer"
            >
              Continue as {demoAccount(label).email}
            </button>
          ))}
      </div>
    </div>
  )
}

const GENERATING_TICK_MS = 420

function PresentationSession({ sessionId }: { sessionId: string }) {
  const [account, setAccount] = useState<GoogleAccount | null>(null)
  const [session, setSession] = useState<VerificationSession | null>(null)
  const [phone, setPhone] = useState<Exclude<PhoneState, 'idle'>>('scan')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [gstep, setGstep] = useState(0)
  const [error, setError] = useState<string | null>(null)
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
        // Yêu cầu vừa tải về: bật sẵn đúng những trường verifier hỏi, các trường còn lại vẫn nằm
        // trong danh sách nhưng bị khoá ở trạng thái không chia sẻ.
        setSelected((current) =>
          Object.keys(current).length
            ? current
            : Object.fromEntries(result.revealed_attrs.map((key) => [key, true])),
        )
        setPhone((current) =>
          current === 'scan' && result.status === 'pending' ? 'request' : current,
        )
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

  useEffect(() => {
    if (phone !== 'generating') return
    const timer = setInterval(() => setGstep((step) => Math.min(step + 1, 5)), GENERATING_TICK_MS)
    return () => clearInterval(timer)
  }, [phone])

  const signIn = useCallback((chosen: GoogleAccount) => {
    setAuthToken(chosen.token)
    setAccount(chosen)
  }, [])

  const requested = useMemo(() => new Set(session?.revealed_attrs ?? []), [session])

  const discCards = CLAIMS.map((claim) => {
    const attr = CLAIM_TO_BACKEND_ATTR[claim.key]
    const required = requested.has(attr)
    const on = required && !!selected[attr]
    return {
      key: claim.key,
      label: claim.label.toUpperCase(),
      value: on ? 'Value from your signed credential' : 'Not shared',
      valueColor: on ? '#16171A' : '#8A8C94',
      note: required
        ? on
          ? 'Required by this request'
          : 'Turned off — the verifier will see nothing'
        : 'Privacy protected ✓',
      noteColor: on ? '#8A8C94' : '#17795E',
      switchBg: on ? '#17795E' : '#DCDCD6',
      knobOn: on,
      border: on ? '#16171A' : '#EFEFEB',
      bg: on ? '#FBFBF9' : '#FFFFFF',
      // Verifier không hỏi trường này thì người dùng cũng không có gì để quyết định: nó nằm ngoài
      // yêu cầu nên vĩnh viễn không được chia sẻ.
      disabled: !required,
      onToggle: () => setSelected((s) => ({ ...s, [attr]: !s[attr] })),
    }
  })

  const requestedAttrs = CLAIMS.filter((claim) => requested.has(CLAIM_TO_BACKEND_ATTR[claim.key])).map(
    (claim) => ({
      label: claim.label,
      value: 'Only shared with your approval',
      tag: 'REVEAL',
      tagBg: '#F5F5F1',
      tagFg: '#6E7079',
    }),
  )
  const conditionAttrs = (session?.conditions ?? []).map((key) => ({
    label: key === 'credValid' ? 'Credential validity' : key,
    value: 'Proven without revealing data',
    tag: 'PROVE',
    tagBg: '#EEF2FD',
    tagFg: '#2F5FE0',
  }))

  const sharingKeys = CLAIMS.filter(
    (claim) => requested.has(CLAIM_TO_BACKEND_ATTR[claim.key]) && selected[CLAIM_TO_BACKEND_ATTR[claim.key]],
  )
  const notSharing = CLAIMS.filter((claim) => !sharingKeys.includes(claim))

  const respond = async (approve: boolean) => {
    if (!session || submitting.current) return
    submitting.current = true
    setError(null)
    setGstep(0)
    setPhone(approve ? 'generating' : 'sent')
    try {
      if (approve && (await apiClient.me()).wallet_locked) {
        await walletService.unlockWithPasskey()
      }
      const attrs = session.revealed_attrs.filter((key) => selected[key])
      const result = approve
        ? await apiClient.approveRequest(sessionId, attrs)
        : await apiClient.declineRequest(sessionId)
      setSession(result)
      setPhone('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được phản hồi')
      setPhone('disclosure')
    } finally {
      submitting.current = false
    }
  }

  if (!account) {
    return (
      <main className="min-h-screen bg-bg-page p-6 flex justify-center items-start text-ink">
        <SignInGate onAccount={signIn} />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg-page p-4 flex flex-col items-center gap-3 text-ink">
      {error && (
        <p role="alert" className="text-sm" style={{ color: '#B4763A' }}>
          {error}
        </p>
      )}
      <WalletPhone
        bare
        phone={phone}
        requestId={sessionId.slice(0, 10)}
        orgName={session?.org_name ?? 'Đang tải…'}
        purposeText={session?.purpose ?? ''}
        requestedAttrs={[...requestedAttrs, ...conditionAttrs]}
        zkNote="Chỉ những trường bạn đồng ý mới nằm trong bằng chứng gửi đi. Phần còn lại vẫn được chứng minh là hợp lệ mà không lộ giá trị."
        discCards={discCards}
        sharingCount={`${sharingKeys.length} of ${CLAIMS.length} attributes`}
        provingCount={`${session?.conditions.length ?? 0} statement(s)`}
        notSharingText={notSharing.slice(0, 4).map((claim) => claim.label).join(', ')}
        gstep={gstep}
        onToDisclosure={() => setPhone('disclosure')}
        onApprove={() => void respond(true)}
        onDecline={() => void respond(false)}
        onDone={() => window.location.assign('/')}
      />
      <div className="text-xs text-ink-4">Đăng nhập bằng {account.email}</div>
    </main>
  )
}

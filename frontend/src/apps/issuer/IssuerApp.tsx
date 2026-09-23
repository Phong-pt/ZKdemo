import { useCallback, useEffect, useState } from 'react'

type Checks = {
  database: boolean
  not_issued: boolean
  nonce: boolean
  proof: boolean
  checked_at: number
}
type Request = {
  id: string
  email: string
  wallet_id: string
  status: string
  created_at: number
  expires_at: number
  attributes: Record<string, string>
  nonce: string
  checks: Checks | null
  reason: string | null
  proof: Record<string, string>
  public_key: Record<string, string>
  signature: Record<string, string>
  database: {
    found: boolean
    already_issued: boolean
    matches: boolean
    fields: { name: string; submitted: string; stored: string | null; matches: boolean }[]
  }
}
type Registry = {
  state: string
  busy: boolean
  configured: boolean
  error?: string
  address?: string
  issuer_address?: string
  schema_id?: string
  cred_def_id?: string
  attributes: string[]
  transactions: Record<string, { hash: string; state: string; block?: number; gas?: number }>
}

const labels: Record<string, string> = {
  pending: 'Chờ xét duyệt',
  signed: 'Đã ký · chờ ví',
  issued: 'Ví đã nhận',
  rejected: 'Từ chối',
  expired: 'Hết hạn',
  not_published: 'Chưa công bố',
  publishing: 'Đang gửi giao dịch',
  published: 'Đã xác nhận trên chain',
  error: 'Chưa hoàn tất',
}
const fieldLabels: Record<string, string> = {
  cccd: 'Số CCCD',
  name: 'Họ tên',
  dob: 'Ngày sinh',
  sex: 'Giới tính',
  nationality: 'Quốc tịch',
  origin: 'Quê quán',
  residence: 'Nơi thường trú',
  expiry: 'Hết hạn',
}
const section = 'rounded-[22px] border border-line bg-white p-6'
const button =
  'rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const secondary =
  'rounded-xl border border-line bg-white px-4 py-3 text-sm cursor-pointer disabled:opacity-40'

function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${['issued', 'published', 'confirmed'].includes(status) ? 'bg-green-bg text-green' : ['rejected', 'expired', 'error', 'failed'].includes(status) ? 'bg-red-50 text-red-700' : 'bg-blue-bg text-blue'}`}
    >
      {labels[status] || status}
    </span>
  )
}

function BigNumber({ name, value, note }: { name: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-sunken p-4">
      <div className="flex justify-between gap-3">
        <strong className="text-sm font-mono">{name}</strong>
        <span className="text-xs text-ink-4">{value.length} ký tự</span>
      </div>
      <div className="text-xs text-ink-3 mt-1 mb-3">{note}</div>
      <code className="block max-h-24 overflow-y-auto break-all text-[11px] leading-relaxed text-ink-2">
        {value}
      </code>
    </div>
  )
}

function Blockchain({
  registry,
  publish,
  busy,
}: {
  registry: Registry | null
  publish: () => void
  busy: boolean
}) {
  if (!registry) return <div className={section}>Đang đọc trạng thái registry…</div>
  return (
    <div className="space-y-5">
      <div className={section}>
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div>
            <div className="font-mono text-[10px] tracking-widest text-ink-4">
              PUBLIC REGISTRY · ETHEREUM SEPOLIA
            </div>
            <h2 className="text-xl mt-2 font-medium">Schema căn cước công dân</h2>
          </div>
          <Badge status={registry.state} />
        </div>
        <p className="text-sm text-ink-3 mt-3 leading-relaxed">
          Công bố khuôn mẫu CCCD và khóa công khai của issuer. Các credential cùng schema dùng chung
          bản đăng ký này. Khi duyệt ký, hệ thống tự bắt đầu công bố nếu cần.
        </p>
        <div className="mt-5 rounded-xl bg-bg-sunken p-4">
          <div className="font-mono text-sm">
            nationalIdentity <span className="text-ink-4">/ 1.0</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {registry.attributes.map((a) => (
              <span
                key={a}
                className="rounded-md border border-line bg-white px-2 py-1 text-xs font-mono"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 border-l-2 border-green pl-3 text-sm text-ink-3">
          Chỉ tên thuộc tính và khóa công khai được đưa lên chain. Số CCCD, hồ sơ eKYC và link
          secret không nằm trong giao dịch.
        </div>
        {!registry.configured && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Chưa cấu hình Sepolia cho backend. Cần SEPOLIA_RPC_URL và ISSUER_PRIVATE_KEY của ví
            testnet trong .env.
          </div>
        )}
        {registry.error && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {registry.error}
          </div>
        )}
        <button
          onClick={publish}
          disabled={busy || registry.busy || !registry.configured}
          className={`${button} mt-5`}
        >
          {registry.busy
            ? 'Đang chờ mạng xác nhận…'
            : registry.state === 'published'
              ? 'Kiểm tra lại bản đăng ký'
              : 'Công bố schema & khóa công khai'}
        </button>
      </div>
      <div className={section}>
        <h3 className="font-medium">Bằng chứng trên blockchain</h3>
        <p className="text-sm text-ink-3 mt-2">
          Mỗi liên kết mở dữ liệu giao dịch thực trên Etherscan. Schema đã tồn tại sẽ được đọc và
          đối chiếu, không tạo giao dịch trùng.
        </p>
        {registry.address && (
          <a
            target="_blank"
            rel="noreferrer"
            className="block text-blue font-mono text-xs break-all my-4"
            href={`https://sepolia.etherscan.io/address/${registry.address}`}
          >
            Contract: {registry.address} ↗
          </a>
        )}
        {Object.entries(registry.transactions).length === 0 && (
          <div className="py-6 text-sm text-ink-4">Chưa gửi giao dịch nào từ cổng issuer.</div>
        )}
        {Object.entries(registry.transactions).map(([key, tx]) => (
          <div key={key} className="py-4 border-t border-line">
            <div className="flex justify-between">
              <span className="text-sm font-medium">
                {(
                  {
                    deploy: 'Triển khai smart contract',
                    schema: 'Đăng ký schema CCCD',
                    credential_definition: 'Công bố khóa issuer',
                  } as Record<string, string>
                )[key] || key}
              </span>
              <Badge status={tx.state} />
            </div>
            <a
              target="_blank"
              rel="noreferrer"
              className="block font-mono text-xs text-blue break-all mt-2"
              href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
            >
              {tx.hash} ↗
            </a>
            {tx.block && (
              <div className="text-xs text-ink-4 mt-2">
                Block {tx.block} · Gas {tx.gas}
              </div>
            )}
          </div>
        ))}
        {registry.schema_id && (
          <div className="text-xs text-ink-3 break-all font-mono mt-4">
            Schema ID: {registry.schema_id}
            <br />
            Credential definition: {registry.cred_def_id}
          </div>
        )}
      </div>
    </div>
  )
}

export function IssuerApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem('issuer-token') || '')
  const [entry, setEntry] = useState('')
  const [requests, setRequests] = useState<Request[]>([])
  const [registry, setRegistry] = useState<Registry | null>(null)
  const [selected, setSelected] = useState('')
  const [tab, setTab] = useState<'requests' | 'registry'>('requests')
  const [detail, setDetail] = useState<'identity' | 'proof'>('identity')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')

  const call = useCallback(
    async <T,>(path: string, method = 'GET', body?: unknown): Promise<T> => {
      const response = await fetch(`/api/issuer${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Issuer-Token': token },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(
          typeof data.detail === 'string' ? data.detail : 'Không tải được dữ liệu issuer',
        )
      return data as T
    },
    [token],
  )

  const refresh = useCallback(async () => {
    const [items, chain] = await Promise.all([
      call<Request[]>('/requests'),
      call<Registry>('/registry'),
    ])
    setRequests(items)
    setRegistry(chain)
  }, [call])

  useEffect(() => {
    if (!token) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        await refresh()
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Lỗi kết nối')
      }
      if (active) timer = setTimeout(poll, 2000)
    }
    void poll()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [token, refresh])

  const item = requests.find((r) => r.id === selected) || requests[0]
  const act = async (path: string, body?: unknown) => {
    setBusy(true)
    setError('')
    try {
      await call(path, 'POST', body)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thực hiện được thao tác')
    } finally {
      setBusy(false)
    }
  }

  if (!token)
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-6">
        <form
          className={`${section} w-full max-w-md`}
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            try {
              const r = await fetch('/api/issuer/requests', {
                headers: { 'X-Issuer-Token': entry },
              })
              if (!r.ok) {
                const data = await r.json()
                throw new Error(data.detail)
              }
              sessionStorage.setItem('issuer-token', entry)
              setToken(entry)
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Lỗi đăng nhập')
            } finally {
              setBusy(false)
            }
          }}
        >
          <div className="font-mono text-xs tracking-widest text-ink-4">
            NX CRED / ISSUER PORTAL
          </div>
          <h1 className="text-3xl font-medium tracking-tight mt-4">Cổng cấp danh tính</h1>
          <p className="text-sm text-ink-3 mt-3 mb-6">
            Đối chiếu hồ sơ eKYC, kiểm chứng yêu cầu ký mù và quản lý schema công khai.
          </p>
          <label className="text-sm">
            Mã truy cập issuer
            <input
              autoComplete="current-password"
              type="password"
              required
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className="block w-full rounded-xl border border-line px-4 py-3 mt-2"
            />
          </label>
          <div className="text-xs text-ink-4 mt-2">Docker demo mặc định: issuer-demo-local</div>
          {error && (
            <p role="alert" className="text-red-700 text-sm mt-3">
              {error}
            </p>
          )}
          <button disabled={busy} className={`${button} w-full mt-5`}>
            {busy ? 'Đang kết nối…' : 'Vào cổng issuer'}
          </button>
          <a href="/" className="block mt-5 text-sm text-ink-3">
            ← Trở về ví
          </a>
        </form>
      </div>
    )

  return (
    <div className="min-h-screen bg-bg-page text-ink md:flex">
      <aside className="md:w-[232px] md:min-h-screen shrink-0 border-r border-line bg-white p-6 md:sticky md:top-0 md:h-screen flex flex-col">
        <div className="font-semibold text-lg tracking-tight">
          ◈ NX Cred <span className="text-ink-4 font-normal">Issuer</span>
        </div>
        <div className="font-mono text-[10px] text-ink-4 tracking-widest mt-2 mb-10">
          IDENTITY AUTHORITY
        </div>
        <button
          onClick={() => setTab('requests')}
          className={`text-left rounded-xl px-4 py-3 text-sm mb-2 cursor-pointer ${tab === 'requests' ? 'bg-ink text-white' : 'text-ink-3'}`}
        >
          Hồ sơ chờ cấp{' '}
          <span className="float-right">
            {requests.filter((r) => r.status === 'pending').length}
          </span>
        </button>
        <button
          onClick={() => setTab('registry')}
          className={`text-left rounded-xl px-4 py-3 text-sm cursor-pointer ${tab === 'registry' ? 'bg-ink text-white' : 'text-ink-3'}`}
        >
          Schema & blockchain
        </button>
        <div className="mt-auto pt-10 text-sm flex flex-col gap-4">
          <a href="/" target="_blank" rel="noreferrer">
            Mở ví ↗
          </a>
          <a href="/verifier" target="_blank" rel="noreferrer">
            Mở verifier ↗
          </a>
          <button
            className="text-left text-ink-4 cursor-pointer"
            onClick={() => {
              sessionStorage.removeItem('issuer-token')
              setToken('')
              setRequests([])
              setRegistry(null)
            }}
          >
            Đăng xuất issuer
          </button>
        </div>
      </aside>
      <main className="p-6 lg:p-10 min-w-0 flex-1 max-w-[1440px]">
        <div className="flex justify-between items-start gap-5 mb-8">
          <div>
            <div className="font-mono text-[10px] text-ink-4 tracking-widest">
              ISSUANCE WORKSPACE
            </div>
            <h1 className="text-3xl tracking-tight font-medium mt-2">
              {tab === 'requests' ? 'Xét duyệt & ký credential' : 'Đăng ký công khai'}
            </h1>
            <p className="text-sm text-ink-3 mt-2">
              {tab === 'requests'
                ? 'Yêu cầu được gửi từ tài khoản ví sau bước xác nhận eKYC.'
                : 'Nguồn schema và khóa kiểm chứng cho verifier.'}
            </p>
          </div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              setTab('registry')
            }}
            className="shrink-0"
          >
            <Badge status={registry?.state || 'not_published'} />
          </a>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700"
          >
            {error}
            <button onClick={() => setError('')} className="float-right cursor-pointer">
              ×
            </button>
          </div>
        )}
        {tab === 'registry' ? (
          <Blockchain
            registry={registry}
            busy={busy}
            publish={() => void act('/registry/publish')}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                ['Chờ duyệt', requests.filter((r) => r.status === 'pending').length],
                ['Đã ký', requests.filter((r) => ['signed', 'issued'].includes(r.status)).length],
                ['Đã về ví', requests.filter((r) => r.status === 'issued').length],
              ].map(([label, count]) => (
                <div key={label} className={`${section} !p-5`}>
                  <div className="text-xs text-ink-4">{label}</div>
                  <div className="text-3xl mt-2">{count}</div>
                </div>
              ))}
            </div>
            <div className="grid xl:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
              <div className={`${section} !p-3`}>
                <div className="text-xs text-ink-4 px-3 py-2">YÊU CẦU TỪ VÍ</div>
                {requests.length === 0 && (
                  <p className="p-4 text-sm text-ink-3 leading-relaxed">
                    Chưa có hồ sơ. Mở ví, đăng nhập và hoàn tất eKYC để gửi yêu cầu tới đây.
                  </p>
                )}
                {requests.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelected(r.id)
                      setReason('')
                    }}
                    className={`block text-left w-full rounded-xl p-3 my-1 cursor-pointer ${r.id === item?.id ? 'bg-bg-page' : 'hover:bg-bg-sunken'}`}
                  >
                    <div className="font-medium text-sm truncate">{r.attributes.name}</div>
                    <div className="text-xs text-ink-4 truncate mt-1 mb-2">{r.email}</div>
                    <Badge status={r.status} />
                  </button>
                ))}
              </div>
              {item && (
                <div className="space-y-5">
                  <div className={section}>
                    <div className="flex justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-medium">{item.attributes.name}</h2>
                        <div className="text-xs text-ink-4 mt-1">
                          {item.email} · {new Date(item.created_at * 1000).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <Badge status={item.status} />
                    </div>
                    <div className="font-mono text-[10px] text-ink-4 break-all mt-3">
                      REQUEST {item.id} · WALLET {item.wallet_id}
                    </div>
                    <div className="flex gap-6 mt-6 border-b border-line text-sm">
                      <button
                        className={`pb-3 cursor-pointer ${detail === 'identity' ? 'border-b-2 border-ink' : 'text-ink-4'}`}
                        onClick={() => setDetail('identity')}
                      >
                        Hồ sơ & CSDL
                      </button>
                      <button
                        className={`pb-3 cursor-pointer ${detail === 'proof' ? 'border-b-2 border-ink' : 'text-ink-4'}`}
                        onClick={() => setDetail('proof')}
                      >
                        Commitment & ZK proof
                      </button>
                    </div>
                    {detail === 'identity' ? (
                      <div className="mt-4">
                        <div className="text-xs text-ink-3 mb-4">
                          CSDL demo issuer ·{' '}
                          {item.database.found ? 'Tìm thấy hồ sơ' : 'Không tìm thấy CCCD'}
                          {item.database.already_issued ? ' · Đã cấp credential' : ''}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-[11px] text-ink-4">
                              <tr>
                                <th className="py-2">Thuộc tính</th>
                                <th>Ví gửi</th>
                                <th>CSDL issuer</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.database.fields.map((f) => (
                                <tr key={f.name} className="border-t border-line">
                                  <td className="py-3 pr-3 text-ink-3">{fieldLabels[f.name]}</td>
                                  <td className="pr-3">{f.submitted}</td>
                                  <td className={f.matches ? 'text-green' : 'text-red-700'}>
                                    {f.stored ?? 'Không có'} {f.matches ? '✓' : '≠'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 mt-5">
                        <div className="rounded-xl bg-blue-bg p-4 text-sm text-blue leading-relaxed">
                          Issuer nhận U = S^v′ · R^linkSecret mod n và proof chứng minh biết các bí
                          mật tạo U. Link secret và v′ không được gửi đến cổng issuer. Các giá trị
                          bên dưới lấy từ yêu cầu thực; số lớn giữ dạng chuỗi để không mất độ chính
                          xác.
                        </div>
                        <BigNumber
                          name="nonce"
                          value={item.nonce}
                          note={`Challenge từ issuer · hết hạn ${new Date(item.expires_at * 1000).toLocaleTimeString('vi-VN')} · dùng một lần`}
                        />
                        <BigNumber name="U" value={item.proof.u} note="Commitment đã làm mù" />
                        <BigNumber
                          name="c"
                          value={item.proof.c}
                          note="Fiat–Shamir challenge: H(U, Ũ, nonce)"
                        />
                        <BigNumber
                          name="v̂"
                          value={item.proof.v_hat}
                          note="Response: ṽ + c · v′ (không phải v′ gốc)"
                        />
                        <BigNumber
                          name="lŝ"
                          value={item.proof.ls_hat}
                          note="Response: lś̃ + c · linkSecret (không phải link secret gốc)"
                        />
                        <details className="text-sm">
                          <summary className="cursor-pointer text-ink-3 py-2">
                            Tham số công khai n, S, R
                          </summary>
                          <div className="space-y-3">
                            {Object.entries(item.public_key).map(([k, v]) => (
                              <BigNumber
                                key={k}
                                name={k}
                                value={v}
                                note="Tham số công khai CL signature"
                              />
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                  <div className={section}>
                    <h3 className="font-medium">Kiểm chứng trước khi ký</h3>
                    <div className="grid sm:grid-cols-2 gap-3 mt-4">
                      {(
                        [
                          ['database', 'Hồ sơ khớp CSDL'],
                          ['not_issued', 'CCCD chưa được cấp'],
                          ['nonce', 'Nonce đúng phiên, còn hạn'],
                          ['proof', 'ZK proof hợp lệ'],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="rounded-xl bg-bg-sunken p-3 text-sm">
                          <span
                            className={
                              item.checks
                                ? item.checks[key]
                                  ? 'text-green'
                                  : 'text-red-700'
                                : 'text-ink-4'
                            }
                          >
                            {item.checks ? (item.checks[key] ? '✓' : '✕') : '○'}
                          </span>{' '}
                          {label}
                        </div>
                      ))}
                    </div>
                    {item.checks && (
                      <p className="text-xs text-ink-4 mt-3">
                        Kết quả kiểm tra lúc{' '}
                        {new Date(item.checks.checked_at * 1000).toLocaleTimeString('vi-VN')}. Khi
                        ký, backend kiểm tra lại toàn bộ và tiêu thụ nonce.
                      </p>
                    )}
                    {item.status === 'pending' ? (
                      <>
                        <div className="flex flex-wrap gap-3 mt-5">
                          <button
                            disabled={busy}
                            onClick={() => void act(`/requests/${item.id}/check`)}
                            className={secondary}
                          >
                            Kiểm tra CSDL & proof
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void act(`/requests/${item.id}/approve`)}
                            className={button}
                          >
                            {busy ? 'Đang xử lý…' : 'Duyệt & ký mù'}
                          </button>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Lý do từ chối (nếu có)"
                            className="min-w-0 flex-1 border border-line rounded-xl px-3 text-sm"
                          />
                          <button
                            disabled={busy}
                            className="rounded-xl px-4 py-3 text-sm text-red-700 border border-red-100 cursor-pointer"
                            onClick={() =>
                              void act(`/requests/${item.id}/reject`, {
                                reason: reason || 'Issuer từ chối hồ sơ',
                              })
                            }
                          >
                            Từ chối
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-ink-3 mt-4">
                        {item.status === 'issued'
                          ? 'Ví đã giải mù, kiểm tra chữ ký và lưu credential.'
                          : item.status === 'signed'
                            ? 'Nonce đã được tiêu thụ. Đang chờ ví nhận và giải mù chữ ký.'
                            : item.reason || 'Nonce đã hết hạn; ví cần gửi yêu cầu mới.'}
                      </p>
                    )}
                    {Object.keys(item.signature).length > 0 && (
                      <details className="mt-4">
                        <summary className="text-sm text-ink-3 cursor-pointer">
                          Chữ ký mù trả về ví (A, e, v″)
                        </summary>
                        <div className="space-y-3 mt-3">
                          {Object.entries(item.signature).map(([k, v]) => (
                            <BigNumber
                              key={k}
                              name={k}
                              value={v}
                              note="Thành phần chữ ký do issuer tạo"
                            />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

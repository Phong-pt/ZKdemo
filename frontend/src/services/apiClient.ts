export interface IdentityAttributes {
  cccd: string
  name: string
  dob: string
  sex: string
  nationality: string
  origin: string
  residence: string
  expiry: string
}

export interface IssueResponse {
  issued: boolean
  identity: Record<string, string>
}

export interface VerifyResponse {
  verified: boolean
  revealed: Record<string, string>
}

export interface VerificationSession {
  id: string
  name: string
  // Tên tổ chức verifier, backend gắn vào lúc tạo yêu cầu từ domain email người đăng nhập.
  org_name: string
  purpose: string
  revealed_attrs: string[]
  conditions: string[]
  status: 'pending' | 'verified' | 'rejected' | 'declined' | 'expired'
  expires_at: number
  result: VerifyResponse | null
}

export interface VerifierLoginResponse {
  authorized: boolean
  org_name: string | null
  email: string
}

export interface MeResponse {
  email: string
  name: string
  wallet_id: string
  has_credential: boolean
  identity: Record<string, string> | null
  // Ví đã được cài cho tài khoản này chưa, và có passkey bảo vệ không. Cả hai nằm ở máy chủ nên
  // máy nào đăng nhập cũng thấy, không phụ thuộc vào trình duyệt đang dùng.
  wallet_ready: boolean
  has_passkey: boolean
}

// Options WebAuthn do máy chủ phát: các trường nhị phân được mã hoá base64url để đi qua JSON,
// trình duyệt cần chúng ở dạng ArrayBuffer nên walletService sẽ giải mã trước khi gọi WebAuthn.
export interface PasskeyCreationOptions {
  rp: { id: string; name: string }
  user: { id: string; name: string; displayName: string }
  challenge: string
  excludeCredentials?: { id: string; type: string; transports?: string[] }[]
}

export interface PasskeyRequestOptions {
  challenge: string
  rpId: string
  allowCredentials?: { id: string; type: string; transports?: string[] }[]
}

export interface ConfigResponse {
  google_client_id: string
  verifier_domains: string[]
}

// Token của phiên đang đăng nhập; mọi endpoint xác định ví theo token này chứ không theo cookie.
let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const apiClient = {
  createRequest: (request: { name: string; purpose: string; revealed_attrs: string[]; conditions: string[] }) =>
    apiFetch<VerificationSession>('/requests', { method: 'POST', body: JSON.stringify(request) }),
  getRequest: (id: string) => apiFetch<VerificationSession>(`/requests/${encodeURIComponent(id)}`),
  approveRequest: (id: string, attrs: string[]) =>
    apiFetch<VerificationSession>(`/requests/${encodeURIComponent(id)}/approve`, {
      method: 'POST', body: JSON.stringify({ revealed_attrs: attrs }),
    }),
  declineRequest: (id: string) =>
    apiFetch<VerificationSession>(`/requests/${encodeURIComponent(id)}/decline`, { method: 'POST' }),
  config: () => apiFetch<ConfigResponse>('/config'),
  // Hai trường mã QR trên thẻ không chứa, lấy từ hồ sơ issuer theo số CCCD vừa quét được.
  ekycLookup: (cccd: string) =>
    apiFetch<{ origin: string; expiry: string }>(`/ekyc/lookup?cccd=${encodeURIComponent(cccd)}`),
  issueCredential: (identity: IdentityAttributes) =>
    apiFetch<IssueResponse>('/issue', { method: 'POST', body: JSON.stringify(identity) }),
  verifyPresentation: (revealedAttrs: string[]) =>
    apiFetch<VerifyResponse>('/verify', {
      method: 'POST',
      body: JSON.stringify({ revealed_attrs: revealedAttrs }),
    }),
  reset: () => apiFetch<{ reset: boolean }>('/reset', { method: 'POST' }),
  verifierLogin: () => apiFetch<VerifierLoginResponse>('/verifier/login', { method: 'POST' }),
  me: () => apiFetch<MeResponse>('/me'),
  passkeyRegisterOptions: () =>
    apiFetch<PasskeyCreationOptions>('/passkey/register/options', { method: 'POST' }),
  passkeyRegisterVerify: (credential: unknown) =>
    apiFetch<{ verified: boolean }>('/passkey/register/verify', {
      method: 'POST',
      body: JSON.stringify(credential),
    }),
  passkeyLoginOptions: () =>
    apiFetch<PasskeyRequestOptions>('/passkey/login/options', { method: 'POST' }),
  passkeyLoginVerify: (credential: unknown) =>
    apiFetch<{ verified: boolean }>('/passkey/login/verify', {
      method: 'POST',
      body: JSON.stringify(credential),
    }),
  passkeySkip: () => apiFetch<{ saved: boolean }>('/passkey/skip', { method: 'POST' }),
}

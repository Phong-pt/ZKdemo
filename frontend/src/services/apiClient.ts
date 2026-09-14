export interface IdentityAttributes {
  cccd: string
  name: string
  dob: string
  nationality: string
  address: string
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
}

export interface ConfigResponse {
  google_client_id: string
  verifier_domains: string[]
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
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
  issueCredential: (identity: IdentityAttributes) =>
    apiFetch<IssueResponse>('/issue', { method: 'POST', body: JSON.stringify(identity) }),
  verifyPresentation: (revealedAttrs: string[]) =>
    apiFetch<VerifyResponse>('/verify', {
      method: 'POST',
      body: JSON.stringify({ revealed_attrs: revealedAttrs }),
    }),
  reset: () => apiFetch<{ reset: boolean }>('/reset', { method: 'POST' }),
  verifierLogin: (email: string) =>
    apiFetch<VerifierLoginResponse>('/verifier/login', { method: 'POST', body: JSON.stringify({ email }) }),
}

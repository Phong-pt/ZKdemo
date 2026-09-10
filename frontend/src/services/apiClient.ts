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

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const apiClient = {
  issueCredential: (identity: IdentityAttributes) =>
    apiFetch<IssueResponse>('/issue', { method: 'POST', body: JSON.stringify(identity) }),
  verifyPresentation: (revealedAttrs: string[]) =>
    apiFetch<VerifyResponse>('/verify', {
      method: 'POST',
      body: JSON.stringify({ revealed_attrs: revealedAttrs }),
    }),
  reset: () => apiFetch<{ reset: boolean }>('/reset', { method: 'POST' }),
}

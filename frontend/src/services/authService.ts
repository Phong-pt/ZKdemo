import { apiClient } from './apiClient'

export interface GoogleAccount {
  name: string
  email: string
  avatarInitial: string
  // ID-token do Google ký; mọi lời gọi API kèm theo nó để backend biết đây là ví của ai.
  token: string
}

// Chỉ dùng khi máy chủ chưa cấu hình GOOGLE_CLIENT_ID: token "demo:..." cho phép app chạy trọn
// luồng mà không cần OAuth. Mỗi nhãn là một ví riêng, nên vẫn diễn được cảnh đổi tài khoản.
export function demoAccount(label = 'demo'): GoogleAccount {
  return {
    name: label.split('@')[0],
    email: label.includes('@') ? label : `${label}@demo.local`,
    avatarInitial: label.charAt(0).toUpperCase(),
    token: `demo:${label}`,
  }
}

function decodeIdToken(token: string): { name: string; email: string } {
  const payload = token.split('.')[1]
  const bytes = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  const json = decodeURIComponent(
    bytes
      .split('')
      .map((char) => '%' + char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
  const claims = JSON.parse(json) as { name?: string; email?: string }
  return { name: claims.name ?? claims.email ?? 'Google user', email: claims.email ?? '' }
}

interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

let clientIdPromise: Promise<string> | null = null

function fetchClientId(): Promise<string> {
  if (!clientIdPromise) {
    clientIdPromise = apiClient
      .config()
      .then((config) => config.google_client_id)
      .catch(() => '')
  }
  return clientIdPromise
}

function waitForGis(timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      if (window.google) return resolve(true)
      if (Date.now() - start > timeoutMs) return resolve(false)
      setTimeout(check, 100)
    }
    check()
  })
}

let initialized = false
let currentOnSignIn: ((account: GoogleAccount) => void) | null = null

export const authService = {
  async mountSignInButton(el: HTMLElement, onSignIn: (account: GoogleAccount) => void): Promise<boolean> {
    const clientId = await fetchClientId()
    if (!clientId) return false
    const ready = await waitForGis()
    if (!ready || !window.google) return false

    currentOnSignIn = onSignIn
    if (!initialized) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          const { name, email } = decodeIdToken(response.credential)
          currentOnSignIn?.({
            name,
            email,
            avatarInitial: (name || email || '?').charAt(0).toUpperCase(),
            token: response.credential,
          })
        },
      })
      initialized = true
    }
    window.google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      width: 320,
      text: 'continue_with',
    })
    return true
  },

  signOut() {
    window.google?.accounts.id.disableAutoSelect()
  },
}

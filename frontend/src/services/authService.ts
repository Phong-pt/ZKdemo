import { apiClient } from './apiClient'

export interface GoogleAccount {
  name: string
  email: string
  avatarInitial: string
}

// Đăng nhập Google là thật, nhưng danh tính hiển thị luôn là persona demo này (khớp
// DEMO_CCCD_IDENTITY) — người test đăng nhập bằng tài khoản Gmail nào cũng ra cùng một ví demo,
// nên không có dữ liệu cá nhân thật nào của người test lọt vào luồng.
export const DEMO_GOOGLE_ACCOUNT: GoogleAccount = {
  name: 'Phạm Thế Phong',
  email: 'phong.pham.demo@gmail.com',
  avatarInitial: 'P',
}

interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
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
        callback: () => currentOnSignIn?.(DEMO_GOOGLE_ACCOUNT),
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
}

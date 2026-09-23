import type { GoogleAccount } from '@/services/authService'
import type { VerifiedIdentity } from '@/services/kycService'

export type Step =
  | 'landing'
  | 'google'
  | 'signedin'
  | 'install'
  | 'password'
  | 'passkey'
  | 'unlock'
  | 'wallet'
  | 'kycdoc'
  | 'handoff'
  | 'kycreview'
  | 'processing'
  | 'verified'

export type InstallState = 'idle' | 'busy' | 'done'
export type PasskeyState = 'idle' | 'scanning' | 'done'

// Khớp đúng tám trường in trên mặt trước CCCD, cùng thứ tự với issuer.ATTRIBUTE_NAMES.
export interface IdentityForm {
  cccd: string
  name: string
  dob: string
  sex: string
  nationality: string
  origin: string
  residence: string
  expiry: string
}

export interface WalletState {
  step: Step
  account: GoogleAccount | null
  install: InstallState
  installPct: number
  pw: string
  pw2: string
  passkey: PasskeyState
  passkeyError: string | null
  // Lỗi khi hỏi máy chủ xem tài khoản đã có ví chưa; còn lỗi thì không được đi tiếp.
  loadError: string | null
  verifiedIdentity: VerifiedIdentity | null
  cardOpen: boolean
  handoffSessionId: string
  marks: number
  // Nút mô phỏng ở màn QR: đang chạy, và lỗi nếu không lấy được hồ sơ mẫu từ issuer.
  simulatingHandoff: boolean
  handoffError: string | null
  identityForm: IdentityForm
  proc: number
  processingError: string | null
}

export const STAGE_LABELS: Record<Step, string> = {
  landing: 'Landing',
  google: 'Google sign-in',
  signedin: 'Signed in',
  install: 'Extension',
  password: 'Wallet setup',
  passkey: 'Wallet setup',
  unlock: 'Unlock wallet',
  wallet: 'Wallet',
  kycdoc: 'eKYC 1/3',
  handoff: 'eKYC 2/3',
  kycreview: 'eKYC 3/3',
  processing: 'Securing',
  verified: 'Verified',
}

export const EMPTY_IDENTITY_FORM: IdentityForm = {
  cccd: '',
  name: '',
  dob: '',
  nationality: '',
  sex: '',
  origin: '',
  residence: '',
  expiry: '',
}

export function createInitialWalletState(): WalletState {
  return {
    step: 'landing',
    account: null,
    install: 'idle',
    installPct: 0,
    pw: '',
    pw2: '',
    passkey: 'idle',
    passkeyError: null,
    loadError: null,
    verifiedIdentity: null,
    cardOpen: false,
    handoffSessionId: crypto.randomUUID(),
    marks: 0,
    simulatingHandoff: false,
    handoffError: null,
    identityForm: { ...EMPTY_IDENTITY_FORM },
    proc: 0,
    processingError: null,
  }
}

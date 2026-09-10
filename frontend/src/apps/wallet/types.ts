import type { GoogleAccount } from '@/services/authService'
import type { VerifiedIdentity } from '@/services/kycService'

export type Step =
  | 'landing'
  | 'google'
  | 'signedin'
  | 'install'
  | 'password'
  | 'passkey'
  | 'wallet'
  | 'kycdoc'
  | 'handoff'
  | 'kycreview'
  | 'processing'
  | 'verified'

export type InstallState = 'idle' | 'busy' | 'done'
export type PasskeyState = 'idle' | 'scanning' | 'done'

export interface IdentityForm {
  cccd: string
  name: string
  dob: string
  nationality: string
  address: string
}

export interface WalletState {
  step: Step
  googleBusy: boolean
  account: GoogleAccount | null
  install: InstallState
  installPct: number
  pw: string
  pw2: string
  passkey: PasskeyState
  passkeyError: string | null
  verifiedIdentity: VerifiedIdentity | null
  cardOpen: boolean
  handoffSessionId: string
  marks: number
  frontImage: string | null
  backImage: string | null
  faceImage: string | null
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
  address: '',
}

export function createInitialWalletState(): WalletState {
  return {
    step: 'landing',
    googleBusy: false,
    account: null,
    install: 'idle',
    installPct: 0,
    pw: '',
    pw2: '',
    passkey: 'idle',
    passkeyError: null,
    verifiedIdentity: null,
    cardOpen: false,
    handoffSessionId: crypto.randomUUID(),
    marks: 0,
    frontImage: null,
    backImage: null,
    faceImage: null,
    identityForm: { ...EMPTY_IDENTITY_FORM },
    proc: 0,
    processingError: null,
  }
}

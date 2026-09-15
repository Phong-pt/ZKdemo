import type { VerifyResponse } from '@/services/apiClient'
export type View = 'dashboard' | 'create' | 'templates' | 'activity' | 'settings' | 'live' | 'result'
export type PhoneState = 'idle' | 'scan' | 'request' | 'disclosure' | 'generating' | 'sent'

export interface Claim {
  key: string
  label: string
  desc: string
}

export interface Condition {
  key: string
  label: string
  desc: string
}

// Every claim here maps to a real signed attribute of the credential (see CLAIM_TO_BACKEND_ATTR).
// Anything the issuer does not sign has no place in this list: the wizard could offer it, but no
// proof could ever back it.
export const CLAIMS: Claim[] = [
  { key: 'cccd', label: 'ID number (CCCD)', desc: 'Reveal the full national ID number — the most identifying field in the credential.' },
  { key: 'fullName', label: 'Full name', desc: "Reveal the user's legal name." },
  { key: 'dob', label: 'Date of birth', desc: "Reveal the user's exact date of birth." },
  { key: 'nationality', label: 'Nationality', desc: "Reveal the user's nationality." },
  { key: 'address', label: 'Address', desc: 'Reveal the full residential address.' },
]

export const CLAIM_TO_BACKEND_ATTR: Record<string, string> = {
  cccd: 'cccd',
  fullName: 'name',
  dob: 'dob',
  nationality: 'nationality',
  address: 'address',
}

export const CONDS: Condition[] = [
  { key: 'nationalityVN', label: 'Nationality = Vietnam', desc: 'Prove nationality matches without revealing the value.' },
  { key: 'residencyVN', label: 'Residency = Vietnam', desc: 'Prove country of residence without revealing the address.' },
  { key: 'credValid', label: 'Credential is valid', desc: 'Prove the credential signature and schema are valid.' },
  { key: 'notRevoked', label: 'Credential is not revoked', desc: 'Prove non-revocation against the registry.' },
]

export interface Template {
  name: string
  desc: string
  purpose: string
  reveal: Record<string, boolean>
  ageOn: boolean
  age: number
  conds: Record<string, boolean>
  proveTag: string
  revealTag: string
}

export const TEMPLATES: Template[] = [
  {
    name: 'Age verification',
    desc: 'Prove the user is over the threshold. Nothing revealed.',
    purpose: 'Required to access this service.',
    reveal: {},
    ageOn: true,
    age: 18,
    conds: { credValid: true },
    proveTag: 'AGE ≥ 18',
    revealTag: 'REVEAL: NONE',
  },
  {
    name: 'Identity verification',
    desc: 'Reveal the legal name and prove the credential is valid.',
    purpose: 'Required to open an account.',
    reveal: { fullName: true },
    ageOn: false,
    age: 18,
    conds: { credValid: true },
    proveTag: 'CRED VALID',
    revealTag: 'REVEAL: NAME',
  },
  {
    name: 'Nationality verification',
    desc: 'Prove nationality equals Vietnam without revealing documents.',
    purpose: 'Required for regional eligibility.',
    reveal: {},
    ageOn: false,
    age: 18,
    conds: { nationalityVN: true, credValid: true },
    proveTag: 'NATIONALITY = VN',
    revealTag: 'REVEAL: NONE',
  },
  {
    name: 'Employment verification',
    desc: 'Prove an employment credential is held and valid.',
    purpose: 'Required to confirm your employer.',
    reveal: {},
    ageOn: false,
    age: 18,
    conds: { credValid: true },
    proveTag: 'CRED VALID',
    revealTag: 'REVEAL: NONE',
  },
  {
    name: 'Student verification',
    desc: 'Prove student status is true without the full credential.',
    purpose: 'Required for the student discount.',
    reveal: {},
    ageOn: false,
    age: 18,
    conds: { credValid: true },
    proveTag: 'STUDENT = TRUE',
    revealTag: 'REVEAL: NONE',
  },
]

export interface LogEntry {
  id: string
  date: string
  purpose: string
  result: 'Verified' | 'Declined'
  color: string
  disclosed: string
  request: string
  revealed: string
  proven: string
  withheld: string
}

export interface VerifierState {
  authed: boolean
  orgName: string
  orgEmail: string
  loginBusy: boolean
  loginError: string | null
  view: View
  wizard: number
  name: string
  desc: string
  purpose: string
  reveal: Record<string, boolean>
  ageOn: boolean
  age: number
  conds: Record<string, boolean>
  phone: PhoneState
  vstep: number
  gstep: number
  disc: Record<string, boolean>
  expiry: number
  detail: LogEntry | null
  log: LogEntry[]
  requestPending: boolean
  result: VerifyResponse | null
  sessionId: string
}

export const REQUEST_ID = 'VER-8F2A-19C4'
export const EXPIRY_START_SECONDS = 598

export function createInitialVerifierState(): VerifierState {
  return {
    authed: false,
    orgName: '',
    orgEmail: '',
    loginBusy: false,
    loginError: null,
    view: 'dashboard',
    wizard: 1,
    name: 'Identity verification',
    desc: 'Verify a signed identity credential.',
    purpose: 'Required to access this service.',
    reveal: { fullName: true },
    ageOn: false,
    age: 18,
    conds: { credValid: true },
    phone: 'idle',
    vstep: 0,
    gstep: 0,
    disc: {},
    expiry: EXPIRY_START_SECONDS,
    detail: null,
    log: [],
    requestPending: false,
    result: null,
    sessionId: crypto.randomUUID(),
  }
}

export function mark(index: number, current: number): [string, string] {
  if (current > index) return ['✓', '#17795E']
  if (current === index) return ['●', '#16171A']
  return ['○', '#B4B6BC']
}

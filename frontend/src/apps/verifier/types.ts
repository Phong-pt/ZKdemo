export type View = 'dashboard' | 'create' | 'templates' | 'activity' | 'settings' | 'live' | 'result'
export type PhoneState = 'idle' | 'scan' | 'request' | 'disclosure' | 'generating' | 'sent'

export type ClaimGroup = 'identity' | 'residency' | 'other'

export interface Claim {
  key: string
  group: ClaimGroup
  label: string
  desc: string
  value: string
}

export interface Condition {
  key: string
  label: string
  desc: string
}

// fullName/dob/nationality/address are backed by a real credential attribute (see
// CLAIM_TO_BACKEND_ATTR below) — their `value` here matches wallet.EKYC_DATA in the Python core
// exactly, since the wizard/phone screens display it before the real /api/verify call resolves.
// docType/country/issuer/status have no corresponding signed attribute in the credential yet, so
// they stay illustrative-only (not sent to the backend, never really proven/revealed).
export const CLAIMS: Claim[] = [
  { key: 'fullName', group: 'identity', label: 'Full name', desc: "Reveal the user's legal name.", value: 'Phạm Thế Phong' },
  { key: 'dob', group: 'identity', label: 'Date of birth', desc: "Reveal the user's exact date of birth.", value: '05/05/2005' },
  { key: 'nationality', group: 'identity', label: 'Nationality', desc: "Reveal the user's nationality.", value: 'Việt Nam' },
  { key: 'docType', group: 'identity', label: 'Identity document type', desc: 'Reveal which document backs the credential.', value: 'National ID (CCCD)' },
  { key: 'country', group: 'residency', label: 'Country of residence', desc: 'Reveal the country the user lives in.', value: 'Việt Nam' },
  { key: 'address', group: 'residency', label: 'Address', desc: 'Reveal the full residential address.', value: 'Tổ 1, Phường Đoàn Kết, Thành phố Lai Châu' },
  { key: 'issuer', group: 'other', label: 'Credential issuer', desc: 'Reveal which authority issued the credential.', value: 'Government Identity Authority' },
  { key: 'status', group: 'other', label: 'Verification status', desc: 'Reveal whether the credential is active.', value: 'Active' },
]

export const CLAIM_TO_BACKEND_ATTR: Record<string, string> = {
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
    conds: { credValid: true, notRevoked: true },
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
    conds: { credValid: true, notRevoked: true },
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
    reveal: { issuer: true },
    ageOn: false,
    age: 18,
    conds: { credValid: true, notRevoked: true },
    proveTag: 'CRED VALID',
    revealTag: 'REVEAL: ISSUER',
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

const INITIAL_LOG: LogEntry[] = [
  {
    id: 'VER-3B71',
    date: 'Sep 08, 2026',
    purpose: 'Nationality check',
    result: 'Verified',
    color: '#17795E',
    disclosed: '0 attributes + 1 proof',
    request: 'Nationality = Vietnam',
    revealed: 'None',
    proven: 'Nationality = Vietnam',
    withheld: 'Name, DOB, address, ID number',
  },
  {
    id: 'VER-2C09',
    date: 'Sep 05, 2026',
    purpose: 'Age verification',
    result: 'Declined',
    color: '#B4763A',
    disclosed: '—',
    request: 'Age ≥ 21',
    revealed: 'None',
    proven: 'None',
    withheld: 'All attributes',
  },
]

export interface VerifierState {
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
  sessionId: string
}

export const REQUEST_ID = 'VER-8F2A-19C4'
export const EXPIRY_START_SECONDS = 598

export function createInitialVerifierState(): VerifierState {
  return {
    view: 'dashboard',
    wizard: 1,
    name: 'Age verification',
    desc: 'Verify that the user is above the required age.',
    purpose: 'Required to access this service.',
    reveal: { fullName: true },
    ageOn: true,
    age: 18,
    conds: { credValid: true, notRevoked: true },
    phone: 'idle',
    vstep: 0,
    gstep: 0,
    disc: {},
    expiry: EXPIRY_START_SECONDS,
    detail: null,
    log: INITIAL_LOG,
    sessionId: crypto.randomUUID(),
  }
}

export function mark(index: number, current: number): [string, string] {
  if (current > index) return ['✓', '#17795E']
  if (current === index) return ['●', '#16171A']
  return ['○', '#B4B6BC']
}

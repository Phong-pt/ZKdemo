import type { ActiveSchemaResponse, VerifyResponse } from '@/services/apiClient'
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

// Nhãn và mô tả tiếng Việt cho từng thuộc tính. Đây chỉ là từ điển HIỂN THỊ — thuộc tính nào tồn
// tại là do schema issuer đã đăng ký trên chain quyết định, không phải do danh sách này. Xem
// claimsFor(): thuộc tính nào chain có mà đây chưa có nhãn thì vẫn hiện được.
export const CLAIM_META: Record<string, { label: string; desc: string }> = {
  cccd: { label: 'Số / No.', desc: 'Số căn cước 12 chữ số — trường định danh mạnh nhất trên thẻ.' },
  name: { label: 'Họ và tên / Full name', desc: 'Tên đầy đủ in trên thẻ.' },
  dob: { label: 'Ngày sinh / Date of birth', desc: 'Ngày tháng năm sinh chính xác.' },
  sex: { label: 'Giới tính / Sex', desc: 'Giới tính ghi trên thẻ.' },
  nationality: { label: 'Quốc tịch / Nationality', desc: 'Quốc tịch ghi trên thẻ.' },
  origin: { label: 'Quê quán / Place of origin', desc: 'Quê quán ghi trên thẻ.' },
  residence: { label: 'Nơi thường trú / Place of residence', desc: 'Địa chỉ thường trú đầy đủ.' },
  expiry: { label: 'Có giá trị đến / Date of expiry', desc: 'Ngày hết hạn của thẻ.' },
}

// Dựng danh sách claim theo đúng thứ tự thuộc tính của schema. `key` chính là tên thuộc tính mà
// backend và contract dùng, nên không cần bảng ánh xạ nào ở giữa.
export function claimsFor(attributes: string[]): Claim[] {
  return attributes.map((key) => {
    const meta = CLAIM_META[key]
    return meta
      ? { key, ...meta }
      : { key, label: key, desc: 'Thuộc tính do issuer đăng ký trên chain; giao diện chưa có nhãn riêng.' }
  })
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
    reveal: { name: true },
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
  // Tên hiển thị lấy từ hồ sơ Google của người đang đăng nhập.
  orgUser: string
  loginBusy: boolean
  loginError: string | null
  // Khuôn mẫu đang có hiệu lực, đọc từ backend (backend đọc từ contract). Mọi danh sách thuộc
  // tính trong Portal đều suy ra từ đây.
  schema: ActiveSchemaResponse
  schemaError: string | null
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

// Rỗng là có chủ ý: danh sách thuộc tính chỉ xuất hiện sau khi đọc được schema từ backend, để
// không bao giờ có một bản chép tay trong frontend chạy song song với bản trên chain.
export const EMPTY_SCHEMA: ActiveSchemaResponse = {
  attributes: [],
  source: 'local',
  name: 'nationalIdentity',
  version: '1.0',
  schema_id: null,
  issuer: null,
}

export function createInitialVerifierState(): VerifierState {
  return {
    authed: false,
    orgName: '',
    orgEmail: '',
    orgUser: '',
    loginBusy: false,
    loginError: null,
    schema: EMPTY_SCHEMA,
    schemaError: null,
    view: 'dashboard',
    wizard: 1,
    name: 'Identity verification',
    desc: 'Verify a signed identity credential.',
    purpose: 'Required to access this service.',
    reveal: { name: true },
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

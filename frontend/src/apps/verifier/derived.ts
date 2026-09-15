import { CLAIMS, CLAIM_TO_BACKEND_ATTR, CONDS, type Claim, type LogEntry, type VerifierState } from './types'

export function revealedClaims(state: VerifierState): Claim[] {
  return CLAIMS.filter((c) => state.reveal[c.key])
}

export function withheldClaims(state: VerifierState): Claim[] {
  return CLAIMS.filter((c) => !isSharedNow(state, c.key))
}

export function activeConds(state: VerifierState) {
  return CONDS.filter((c) => state.conds[c.key])
}

export function proofCount(state: VerifierState): number {
  return activeConds(state).length + (state.ageOn ? 1 : 0)
}

export function disclosurePercent(state: VerifierState): number {
  return Math.round((sharedNowClaims(state).length / CLAIMS.length) * 100)
}

export function minimalLabel(pct: number): string {
  if (pct <= 30) return 'Minimal disclosure'
  if (pct <= 60) return 'Moderate disclosure'
  return 'Broad disclosure — reconsider'
}

export function claimBoxStyle(on: boolean) {
  return {
    tick: on ? '✓' : '',
    border: on ? '#16171A' : '#E6E6E2',
    bg: on ? '#FBFBF9' : '#FFFFFF',
    boxBorder: on ? '#16171A' : '#D8D8D2',
    boxBg: on ? '#16171A' : 'transparent',
  }
}

export function isSharedNow(state: VerifierState, key: string): boolean {
  return state.result ? Object.hasOwn(state.result.revealed, CLAIM_TO_BACKEND_ATTR[key]) : state.disc[key] !== false && !!state.reveal[key]
}

export function predicateText(state: VerifierState): string {
  return state.ageOn ? `age ≥ ${state.age}` : 'credential validity'
}

export interface RequestedAttrView {
  label: string
  value: string
  tag: string
  tagBg: string
  tagFg: string
}

export function buildRequestedAttrs(state: VerifierState): RequestedAttrView[] {
  const revealed = revealedClaims(state).map((c) => ({
    label: c.label,
    value: 'Only shared with your approval',
    tag: 'REVEAL',
    tagBg: '#F5F5F1',
    tagFg: '#6E7079',
  }))
  const ageRow = state.ageOn
    ? [{ label: 'Age', value: `${state.age} years or older`, tag: 'PROVE', tagBg: '#EEF2FD', tagFg: '#2F5FE0' }]
    : []
  const condRows = activeConds(state).map((c) => ({
    label: c.label,
    value: 'Proven without revealing data',
    tag: 'PROVE',
    tagBg: '#EEF2FD',
    tagFg: '#2F5FE0',
  }))
  return [...revealed, ...ageRow, ...condRows]
}

export function buildZkNote(state: VerifierState): string {
  if (state.ageOn) {
    return `Your exact date of birth will NOT be shared. The wallet proves you are ${state.age}+ without revealing your age.`
  }
  return 'Only approved attributes are included in the presentation. This demo runs wallet cryptography on the backend.'
}

export interface DiscCardView {
  key: string
  label: string
  value: string
  valueColor: string
  note: string
  noteColor: string
  switchBg: string
  knobOn: boolean
  border: string
  bg: string
  disabled: boolean
  required: boolean
}

export function buildDiscCards(state: VerifierState): DiscCardView[] {
  return CLAIMS.map((c) => {
    const required = !!state.reveal[c.key]
    const on = state.disc[c.key] !== false && required
    return {
      key: c.key,
      label: c.label.toUpperCase(),
      value: on ? 'Value from your signed credential' : c.key === 'dob' && state.ageOn ? 'Only the age requirement will be proven.' : 'Not shared',
      valueColor: on ? '#16171A' : '#8A8C94',
      note: required ? (on ? 'Required by this request' : 'Turned off — the verifier will see nothing') : 'Privacy protected ✓',
      noteColor: on ? '#8A8C94' : '#17795E',
      switchBg: on ? '#17795E' : '#DCDCD6',
      knobOn: on,
      border: on ? '#16171A' : '#EFEFEB',
      bg: on ? '#FBFBF9' : '#FFFFFF',
      disabled: !required,
      required,
    }
  })
}

export function sharedNowClaims(state: VerifierState): Claim[] {
  return CLAIMS.filter((c) => isSharedNow(state, c.key))
}

export function buildResultRows(state: VerifierState): Array<{ label: string; value: string; color: string }> {
  return CLAIMS.map((c) => {
    const value = state.result?.revealed[CLAIM_TO_BACKEND_ATTR[c.key]]
    return { label: c.label, value: value ?? 'Not disclosed', color: value === undefined ? '#8A8C94' : '#16171A' }
  })
}

export function buildReceivedList(state: VerifierState): string[] {
  if (!state.result?.verified) return []
  return [...sharedNowClaims(state).map((c) => c.label), 'Valid credential signature']
}

export function buildWithheldList(state: VerifierState): string[] {
  return [...withheldClaims(state).map((c) => c.label), 'ID number']
}

export function buildLogRecord(state: VerifierState, requestId: string, verified: boolean): LogEntry {
  const revealed = sharedNowClaims(state)
  const withheld = withheldClaims(state)
  const conds = activeConds(state)
  const proven = [...(state.ageOn ? [`Age ≥ ${state.age}`] : []), ...conds.map((c) => c.label)]
  return {
    id: requestId,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }),
    purpose: state.name,
    result: verified ? 'Verified' : 'Declined',
    color: verified ? '#17795E' : '#B4763A',
    disclosed: verified ? `${revealed.length} attribute(s) + ${conds.length + (state.ageOn ? 1 : 0)} proof(s)` : '—',
    request: state.ageOn ? `Age ≥ ${state.age}` : 'Credential valid',
    revealed: verified ? revealed.map((c) => c.label).join(', ') || 'None' : 'None',
    proven: verified ? proven.join(', ') || 'None' : 'None',
    withheld: verified ? withheld.map((c) => c.label).join(', ') : 'All attributes',
  }
}

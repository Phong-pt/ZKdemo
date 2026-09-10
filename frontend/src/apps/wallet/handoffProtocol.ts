import type { IdentityForm } from './types'

export type HandoffEvent =
  | { type: 'connected' }
  | { type: 'front-captured'; image: string; fields: Partial<IdentityForm> }
  | { type: 'back-captured'; image: string }
  | { type: 'face-captured'; image: string }
  | { type: 'done' }

export function mobileCaptureUrl(sessionId: string): string {
  return `${window.location.protocol}//${window.location.host}/mobile-capture?session=${sessionId}`
}

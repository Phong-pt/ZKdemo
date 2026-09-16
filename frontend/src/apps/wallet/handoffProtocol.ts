import type { IdentityForm } from './types'

// Ảnh chụp KHÔNG bao giờ rời điện thoại. 'front-captured' mang theo các trường điện thoại đọc
// được từ mã QR trên thẻ (và OCR bù hai trường QR không có), chứ không mang ảnh — desktop dựa vào
// đó điền sẵn form xác nhận eKYC.
export type HandoffEvent =
  | { type: 'connected' }
  | { type: 'front-captured'; fields: Partial<IdentityForm> }
  | { type: 'back-captured' }
  | { type: 'face-captured' }
  | { type: 'done' }

export function mobileCaptureUrl(sessionId: string): string {
  return `${window.location.protocol}//${window.location.host}/mobile-capture?session=${sessionId}`
}

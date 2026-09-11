// Ảnh chụp KHÔNG bao giờ rời điện thoại: các sự kiện dưới đây chỉ báo tiến độ, không mang
// payload ảnh. Desktop tự điền DEMO_CCCD_IDENTITY khi nhận 'front-captured'.
export type HandoffEvent =
  | { type: 'connected' }
  | { type: 'front-captured' }
  | { type: 'back-captured' }
  | { type: 'face-captured' }
  | { type: 'done' }

export function mobileCaptureUrl(sessionId: string): string {
  return `${window.location.protocol}//${window.location.host}/mobile-capture?session=${sessionId}`
}

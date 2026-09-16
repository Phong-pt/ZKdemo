import type { IdentityForm } from './types'

// Quét CCCD bất kỳ đều trả về đúng bộ dữ liệu này — OCR vẫn chạy thật (xem MobileCaptureApp)
// để giữ đúng cảm giác đang quét, nhưng kết quả bị bỏ qua để demo luôn ra kết quả ổn định,
// khớp với issuer.EKYC_DB[0] ở lõi Python.
export const DEMO_CCCD_IDENTITY: IdentityForm = {
  cccd: '012205007445',
  name: 'Phạm Thế Phong',
  dob: '05/05/2005',
  sex: 'Nam',
  nationality: 'Việt Nam',
  origin: 'Lai Châu',
  residence: 'Tổ 1, Phường Đoàn Kết, Thành phố Lai Châu',
  expiry: '05/05/2030',
}

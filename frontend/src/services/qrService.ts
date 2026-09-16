import jsQR from 'jsqr'

// Mã QR in ở mặt trước CCCD gắn chip chứa 7 trường ngăn nhau bằng dấu "|", theo đúng thứ tự:
// số CCCD | số CMND cũ | họ tên | ngày sinh | giới tính | nơi thường trú | ngày cấp.
// Hai trường ngày viết liền kiểu ddmmyyyy. QR không chứa quốc tịch, quê quán và ngày hết hạn —
// ba trường đó phải lấy từ OCR hoặc người dùng tự điền ở bước xác nhận.
export interface ScannedCccd {
  cccd: string
  name: string
  dob: string
  sex: string
  residence: string
}

function slashDate(raw: string): string {
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}` : raw
}

export function parseCccdQrPayload(payload: string): ScannedCccd | null {
  const parts = payload.split('|')
  if (parts.length < 6) return null
  const [cccd, , name, dob, sex, residence] = parts
  if (!/^\d{12}$/.test(cccd.trim())) return null
  return {
    cccd: cccd.trim(),
    name: name.trim(),
    dob: slashDate(dob.trim()),
    sex: sex.trim(),
    residence: residence.trim(),
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Không đọc được ảnh vừa chụp'))
    image.src = src
  })
}

export const qrService = {
  decodeImageData(frame: ImageData): ScannedCccd | null {
    // Ảnh chụp thẻ hay bị ngược sáng nên thử cả bản đảo màu.
    const found = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' })
    return found ? parseCccdQrPayload(found.data) : null
  },

  async readCccdQr(imageDataUrl: string): Promise<ScannedCccd | null> {
    const image = await loadImage(imageDataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0)
    return qrService.decodeImageData(context.getImageData(0, 0, canvas.width, canvas.height))
  },
}

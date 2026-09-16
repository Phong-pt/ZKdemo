import { createWorker } from 'tesseract.js'

// Tám trường in ở mặt trước CCCD. Tesseract đọc tiếng Việt có dấu khá phập phù, nên đây chỉ là
// nguồn phụ: mã QR trên thẻ mới là nguồn chính (xem qrService). OCR gánh đúng hai trường mà QR
// không chứa — quê quán và ngày hết hạn — và làm phương án dự phòng khi không quét được QR.
export interface ParsedCccdFields {
  cccd?: string
  name?: string
  dob?: string
  sex?: string
  nationality?: string
  origin?: string
  residence?: string
  expiry?: string
}

export interface OcrResult {
  text: string
  fields: ParsedCccdFields
}

function afterLabel(lines: string[], label: RegExp): string | undefined {
  const index = lines.findIndex((line) => label.test(line))
  if (index === -1) return undefined
  // Nhãn và giá trị có khi nằm chung một dòng, có khi giá trị rơi xuống dòng kế tiếp.
  const sameLine = lines[index].replace(label, '').replace(/^[:.\s]+/, '').trim()
  if (sameLine.length > 2) return sameLine
  return lines[index + 1]?.trim()
}

function parseFields(text: string): ParsedCccdFields {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const result: ParsedCccdFields = {}

  const cccdMatch = text.match(/\b(\d{12})\b/)
  if (cccdMatch) result.cccd = cccdMatch[1]

  const dates = [...text.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((match) => match[1])
  const labelledDob = afterLabel(lines, /ng[àa]y sinh|date of birth/i)?.match(/\d{2}\/\d{2}\/\d{4}/)
  const labelledExpiry = afterLabel(lines, /c[óo] gi[áa] tr[ịi] [đd][ếe]n|date of expiry/i)?.match(
    /\d{2}\/\d{2}\/\d{4}/,
  )
  result.dob = labelledDob?.[0] ?? dates[0]
  // Không nhãn thì suy theo thứ tự in trên thẻ: ngày sinh nằm trên, hạn dùng nằm dưới cùng.
  result.expiry = labelledExpiry?.[0] ?? (dates.length > 1 ? dates[dates.length - 1] : undefined)

  const name = afterLabel(lines, /h[ọo] v[àa] t[êe]n|full name/i)
  // Nhãn "Họ và tên" in nhỏ nên OCR hay đọc trượt, trong khi họ tên lại là dòng chữ to nhất thẻ và
  // in hoa toàn bộ — bắt theo đặc điểm đó chắc ăn hơn là bám vào nhãn.
  const shouted = lines.find(
    (line) =>
      line === line.toUpperCase() &&
      !/\d/.test(line) &&
      !/full name|h[ọo] v[àa] t[êe]n|nationality|qu[ốo]c t[ịi]ch|residence|origin|sex/i.test(line) &&
      line.trim().split(/\s+/).length >= 2 &&
      line.replace(/\s/g, '').length >= 6,
  )
  const picked = name ?? shouted
  if (picked) result.name = picked.replace(/[^A-Za-zÀ-ỹ\s]/g, '').trim()

  if (/n[ữu]\b/i.test(text) && !/\bnam\b/i.test(text)) result.sex = 'Nữ'
  else if (/\bnam\b/i.test(text)) result.sex = 'Nam'

  if (/vi[ệe]t nam/i.test(text)) result.nationality = 'Việt Nam'

  const origin = afterLabel(lines, /qu[êe] qu[áa]n|place of origin/i)
  if (origin) result.origin = origin
  const residence = afterLabel(lines, /n[ơo]i th[ưu][ờo]ng tr[úu]|place of residence/i)
  if (residence) result.residence = residence

  return result
}

export const ocrService = {
  async recognizeCccd(imageDataUrl: string): Promise<OcrResult> {
    const worker = await createWorker('vie')
    try {
      const {
        data: { text },
      } = await worker.recognize(imageDataUrl)
      return { text, fields: parseFields(text) }
    } finally {
      await worker.terminate()
    }
  },
}

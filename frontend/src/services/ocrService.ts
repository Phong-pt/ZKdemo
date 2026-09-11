import { createWorker } from 'tesseract.js'

export interface ParsedCccdFields {
  cccd?: string
  name?: string
  dob?: string
  nationality?: string
  address?: string
}

export interface OcrResult {
  text: string
  fields: ParsedCccdFields
}

function parseFields(text: string): ParsedCccdFields {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const result: ParsedCccdFields = {}

  const cccdMatch = text.match(/(?:S[ốo]|No)[.:\s]*([0-9]{9,12})/i)
  if (cccdMatch) result.cccd = cccdMatch[1]

  const dobMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/)
  if (dobMatch) result.dob = dobMatch[1]

  const nameMatch = text.match(/(?:H[ọo] v[àa] t[êe]n|Full name)[.:\s]*\n?([A-ZÀ-Ỹ][A-ZÀ-Ỹ\s]{2,40})/i)
  if (nameMatch) result.name = nameMatch[1].trim()

  if (/Vi[ệe]t Nam/i.test(text)) result.nationality = 'Việt Nam'

  const addrIdx = lines.findIndex((line) => /th[ưu]\s?[ờo]ng tr[úu]|residence|qu[êe] qu[áa]n/i.test(line))
  if (addrIdx !== -1 && lines[addrIdx + 1]) result.address = lines[addrIdx + 1]

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

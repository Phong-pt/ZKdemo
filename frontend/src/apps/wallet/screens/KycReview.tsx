import { Card } from '@/components/primitives'
import { KycProgressHeader } from '../components/KycProgressHeader'
import type { IdentityForm } from '../types'

export interface KycReviewProps {
  form: IdentityForm
  frontImage: string | null
  backImage: string | null
  faceImage: string | null
  onChange: (field: keyof IdentityForm, value: string) => void
  onRetake: () => void
  onSubmit: () => void
}

const FIELDS: Array<[key: keyof IdentityForm, label: string, placeholder: string]> = [
  ['cccd', 'CCCD number', '012345678901'],
  ['name', 'Full name', 'NGUYEN VAN A'],
  ['dob', 'Date of birth', '01/01/1990'],
  ['nationality', 'Nationality', 'Việt Nam'],
  ['address', 'Address', 'Residential address'],
]

const inputClass =
  'w-full px-[15px] py-3.5 border border-line rounded-xl text-sm bg-bg-sunken transition-colors duration-150 ease-out focus:outline-none focus:border-blue'

export function KycReview({ form, frontImage, backImage, faceImage, onChange, onRetake, onSubmit }: KycReviewProps) {
  const complete = Object.values(form).every((value) => value.trim().length > 0)

  return (
    <Card
      elevated
      padding="none"
      className="w-full max-w-[680px] overflow-hidden"
      style={{ borderRadius: 26, boxShadow: '0 30px 60px -45px rgba(20,22,28,.3)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <KycProgressHeader step={3} total={3} />

      <div className="px-8 py-9">
        <div className="text-[26px] font-medium tracking-[-0.028em]">Confirm your details</div>
        <div className="text-sm text-ink-3 mt-2.5">
          We read this from your ID automatically — fix anything that isn't right before continuing.
        </div>

        <div className="flex gap-4 mt-6 items-center flex-wrap">
          {frontImage && (
            <img src={frontImage} alt="Captured ID front" className="w-[100px] h-[64px] object-cover rounded-xl border border-line" />
          )}
          {backImage && (
            <img src={backImage} alt="Captured ID back" className="w-[100px] h-[64px] object-cover rounded-xl border border-line" />
          )}
          {faceImage && (
            <img src={faceImage} alt="Captured selfie" className="w-[64px] h-[64px] object-cover rounded-xl border border-line" />
          )}
          <button
            type="button"
            onClick={onRetake}
            className="text-[13px] text-ink-3 cursor-pointer self-center transition-colors duration-150 ease-out hover:text-ink"
          >
            Scan again
          </button>
        </div>

        <div className="mt-7 flex flex-col gap-3.5">
          {FIELDS.map(([key, label, placeholder]) => (
            <div key={key}>
              <div className="text-[13px] font-medium mb-2">{label}</div>
              <input
                value={form[key]}
                placeholder={placeholder}
                onChange={(e) => onChange(key, e.target.value)}
                className={inputClass}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!complete}
          className="w-full mt-7 text-center text-white py-3.5 rounded-[13px] text-[15px] font-medium transition-colors duration-150 ease-out"
          style={{ background: complete ? '#16171A' : '#C9C9C3', cursor: complete ? 'pointer' : 'not-allowed' }}
        >
          Confirm & continue
        </button>
      </div>
    </Card>
  )
}

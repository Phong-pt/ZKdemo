export interface Step1BasicsProps {
  name: string
  desc: string
  purpose: string
  onName: (value: string) => void
  onDesc: (value: string) => void
  onPurpose: (value: string) => void
}

const inputClass =
  'w-full px-[15px] py-3.5 border border-line rounded-xl text-sm bg-bg-sunken transition-colors duration-150 ease-out focus:outline-none focus:border-blue'

export function Step1Basics({ name, desc, purpose, onName, onDesc, onPurpose }: Step1BasicsProps) {
  return (
    <div>
      <div className="text-[26px] font-medium tracking-[-0.03em]">What do you need to verify?</div>
      <div className="text-sm text-ink-3 mt-2.5">Request only the claims necessary for your use case.</div>
      <div className="mt-7 flex flex-col gap-[18px]">
        <div>
          <div className="text-[13px] font-medium mb-2">Verification name</div>
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Age verification"
            className={inputClass}
          />
        </div>
        <div>
          <div className="text-[13px] font-medium mb-2">Description</div>
          <input
            value={desc}
            onChange={(e) => onDesc(e.target.value)}
            placeholder="Verify that the user is above the required age."
            className={inputClass}
          />
        </div>
        <div>
          <div className="text-[13px] font-medium mb-2">
            Purpose shown to the user <span className="text-ink-5 font-normal">optional</span>
          </div>
          <input
            value={purpose}
            onChange={(e) => onPurpose(e.target.value)}
            placeholder="Required to access this service."
            className={inputClass}
          />
        </div>
      </div>
    </div>
  )
}

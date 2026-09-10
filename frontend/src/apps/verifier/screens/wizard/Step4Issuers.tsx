const ISSUER_ROWS: Array<[label: string, value: string]> = [
  ['Schema', 'nationalIdentity:1.2'],
  ['Cred. definition', 'CLD:3:CL:8821:default'],
  ['Revocation registry', 'rev:8821:0 · live'],
]

export function Step4Issuers() {
  return (
    <div>
      <div className="text-[26px] font-medium tracking-[-0.03em]">Trusted credentials</div>
      <div className="text-sm text-ink-3 mt-2.5">Only credentials from these issuers can satisfy the request.</div>

      <div className="mt-[26px] border-2 border-ink rounded-[18px] p-6 bg-bg-sunken">
        <div className="flex justify-between gap-3.5 items-start flex-wrap">
          <div className="flex gap-3.5 items-center">
            <div
              className="w-11 h-11 rounded-xl"
              style={{ background: 'linear-gradient(145deg,#2C2E36,#0F1013)' }}
            />
            <div>
              <div className="text-base font-medium">Government-issued Identity Credential</div>
              <div className="text-[13px] text-ink-3 mt-1">Government Identity Authority</div>
            </div>
          </div>
          <div className="text-[13px] text-green">Trusted ✓</div>
        </div>
        <div className="h-px bg-line-2 my-5" />
        {ISSUER_ROWS.map(([label, value]) => (
          <div key={label} className="flex justify-between text-[13px] py-1.5">
            <span className="text-ink-3">{label}</span>
            <span className="font-mono text-xs">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border border-dashed border-line rounded-[18px] p-[22px] text-ink-5 text-[13px]">
        + Add another trusted issuer
      </div>
    </div>
  )
}

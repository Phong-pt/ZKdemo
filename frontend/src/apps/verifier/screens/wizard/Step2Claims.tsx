import { claimBoxStyle } from '../../derived'
import type { Claim } from '../../types'

export interface Step2ClaimsProps {
  claims: Claim[]
  schemaError: string | null
  reveal: Record<string, boolean>
  onToggle: (key: string) => void
}

function ClaimRow({ claim, on, onToggle }: { claim: Claim; on: boolean; onToggle: () => void }) {
  const style = claimBoxStyle(on)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() }
      }}
      className="flex gap-3.5 items-start px-4 py-[15px] rounded-2xl cursor-pointer mb-2.5 transition-colors duration-150 ease-out hover:border-ink"
      style={{ border: `1px solid ${style.border}`, background: style.bg }}
    >
      <div
        className="w-[18px] h-[18px] rounded-[5px] text-white text-[11px] flex items-center justify-center flex-none mt-0.5"
        style={{ border: `1.5px solid ${style.boxBorder}`, background: style.boxBg }}
      >
        {style.tick}
      </div>
      <div>
        <div className="text-sm font-medium">{claim.label}</div>
        <div className="text-[12.5px] text-ink-4 mt-0.5">{claim.desc}</div>
      </div>
    </div>
  )
}

export function Step2Claims({ claims, schemaError, reveal, onToggle }: Step2ClaimsProps) {
  return (
    <div>
      <div className="text-[26px] font-medium tracking-[-0.03em]">Information to request</div>
      <div className="text-sm text-ink-3 mt-2.5">
        Ask only for what you need. Anything you leave off is never sent to you.
      </div>

      {schemaError && (
        <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {schemaError}
        </div>
      )}

      <div className="mt-[26px]">
        {claims.length === 0 && !schemaError && (
          <div className="text-sm text-ink-4">Đang đọc schema từ registry…</div>
        )}
        {claims.map((claim) => (
          <ClaimRow key={claim.key} claim={claim} on={!!reveal[claim.key]} onToggle={() => onToggle(claim.key)} />
        ))}
      </div>
    </div>
  )
}

import { MonoLabel } from '@/components/primitives'
import { claimBoxStyle } from '../../derived'
import { CLAIMS, CLAIM_TO_BACKEND_ATTR, type Claim, type ClaimGroup } from '../../types'

export interface Step2ClaimsProps {
  reveal: Record<string, boolean>
  onToggle: (key: string) => void
}

const GROUPS: Array<[label: string, group: ClaimGroup]> = [
  ['Identity', 'identity'],
  ['Residency', 'residency'],
  ['Other', 'other'],
]

function ClaimRow({ claim, on, onToggle }: { claim: Claim; on: boolean; onToggle: () => void }) {
  const supported = !!CLAIM_TO_BACKEND_ATTR[claim.key]
  const style = claimBoxStyle(on)
  return (
    <div
      role="button"
      aria-disabled={!supported}
      tabIndex={supported ? 0 : -1}
      onClick={() => { if (supported) onToggle() }}
      onKeyDown={(e) => {
        if (supported && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onToggle() }
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
        <div className="text-[12.5px] text-ink-4 mt-0.5">{supported ? claim.desc : 'Not supported by this credential yet.'}</div>
      </div>
    </div>
  )
}

export function Step2Claims({ reveal, onToggle }: Step2ClaimsProps) {
  return (
    <div>
      <div className="text-[26px] font-medium tracking-[-0.03em]">Information to request</div>
      <div className="text-sm text-ink-3 mt-2.5">
        Ask only for what you need. Anything you leave off is never sent to you.
      </div>
      <div className="mt-[26px]">
        {GROUPS.map(([label, group]) => (
          <div key={group}>
            <MonoLabel className="mb-3 mt-[22px] first:mt-0">{label}</MonoLabel>
            {CLAIMS.filter((c) => c.group === group).map((claim) => (
              <ClaimRow key={claim.key} claim={claim} on={!!reveal[claim.key]} onToggle={() => onToggle(claim.key)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

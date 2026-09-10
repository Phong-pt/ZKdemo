import { MonoLabel } from '@/components/primitives'
import { activeConds, disclosurePercent, minimalLabel, revealedClaims, withheldClaims } from '../../derived'
import type { VerifierState } from '../../types'

export interface Step5ReviewProps {
  state: VerifierState
}

export function Step5Review({ state }: Step5ReviewProps) {
  const revealed = revealedClaims(state)
  const withheld = withheldClaims(state)
  const conds = activeConds(state)
  const proveList = [
    ...(state.ageOn ? [{ label: `Age ≥ ${state.age}` }] : []),
    ...conds.map((c) => ({ label: c.label })),
  ]
  const notRequested = [...withheld.map((c) => ({ label: c.label })), { label: 'ID number' }, { label: 'Document number' }]
  const pct = disclosurePercent(state)
  const meterOn = Math.max(1, Math.round(pct / 10))

  return (
    <div>
      <div className="text-[26px] font-medium tracking-[-0.03em]">Review verification request</div>
      <div className="text-sm text-ink-3 mt-2.5">
        {state.name} · {state.desc}
      </div>

      <div className="mt-[26px] flex gap-4 flex-wrap">
        <div className="flex-1 basis-[260px] border border-line-2 rounded-2xl p-5">
          <MonoLabel className="mb-3">Reveal</MonoLabel>
          {revealed.map((c) => (
            <div key={c.key} className="text-sm py-1.5">
              ✓ {c.label}
            </div>
          ))}
          {revealed.length === 0 && <div className="text-[13px] text-ink-4">Nothing revealed</div>}
        </div>
        <div className="flex-1 basis-[260px] border border-line-2 rounded-2xl p-5">
          <MonoLabel tone="blue" className="mb-3">
            Prove
          </MonoLabel>
          {proveList.map((r) => (
            <div key={r.label} className="text-sm py-1.5">
              ✓ {r.label}
            </div>
          ))}
          {proveList.length === 0 && <div className="text-[13px] text-ink-4">No conditions</div>}
        </div>
      </div>

      <div className="mt-4 border border-line-2 rounded-2xl p-5">
        <MonoLabel className="mb-3">Not requested</MonoLabel>
        <div className="flex gap-2 flex-wrap">
          {notRequested.map((r) => (
            <div key={r.label} className="text-[13px] text-ink-4 border border-line-2 rounded-full px-3 py-1.5">
              ✕ {r.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl p-[22px]" style={{ border: '1px solid #D9E6DF', background: '#F4FAF7' }}>
        <div className="flex justify-between items-baseline">
          <div className="text-[15px] font-medium text-green">{minimalLabel(pct)}</div>
          <div className="font-mono text-xs text-green">{pct}% disclosure</div>
        </div>
        <div className="flex gap-1 mt-3.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="flex-1 h-2 rounded-[2px]"
              style={{ background: i < meterOn ? '#17795E' : '#DCE8E2' }}
            />
          ))}
        </div>
        <div className="text-[12.5px] mt-3" style={{ color: '#5E7A6E' }}>
          Only the information required for this verification will be requested.
        </div>
      </div>
    </div>
  )
}

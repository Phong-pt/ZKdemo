import { MonoLabel } from '@/components/primitives'
import { claimBoxStyle } from '../../derived'
import { CONDS } from '../../types'

export interface Step3ConditionsProps {
  ageOn: boolean
  age: number
  conds: Record<string, boolean>
  onToggleAge: () => void
  onAgeMinus: () => void
  onAgePlus: () => void
  onToggleCond: (key: string) => void
}

export function Step3Conditions({
  ageOn,
  age,
  conds,
  onToggleAge,
  onAgeMinus,
  onAgePlus,
  onToggleCond,
}: Step3ConditionsProps) {
  const ageBorder = ageOn ? '#16171A' : '#E6E6E2'
  const ageBg = ageOn ? '#FBFBF9' : '#FFFFFF'
  const ageSwitchBg = ageOn ? '#17795E' : '#DCDCD6'

  return (
    <div>
      <div className="text-[26px] font-medium tracking-[-0.03em]">Proof conditions</div>
      <div className="text-sm text-ink-3 mt-2.5">
        Ask the wallet to <strong className="font-medium">prove</strong> a statement instead of revealing the
        underlying data.
      </div>

      <div className="mt-[26px] rounded-[18px] p-[22px]" style={{ border: `1px solid ${ageBorder}`, background: ageBg }}>
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <MonoLabel tracking="0.16em">Age</MonoLabel>
            <div className="text-base font-medium mt-2">Prove that user is</div>
          </div>
          <button
            type="button"
            onClick={onToggleAge}
            className="w-[46px] h-[26px] rounded-full p-[3px] cursor-pointer transition-colors duration-200 ease-out flex-none"
            style={{ background: ageSwitchBg }}
          >
            <div
              className="w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-out"
              style={{ transform: `translateX(${ageOn ? 20 : 0}px)` }}
            />
          </button>
        </div>
        <div className="flex items-center gap-2.5 mt-4 flex-wrap">
          <div className="font-mono text-sm border border-line bg-bg-surface rounded-[10px] px-3.5 py-2.5">≥</div>
          <button
            type="button"
            onClick={onAgeMinus}
            className="w-[38px] h-[38px] border border-line bg-bg-surface rounded-[10px] flex items-center justify-center cursor-pointer text-base transition-colors duration-150 ease-out hover:border-ink"
          >
            −
          </button>
          <div className="font-mono text-xl min-w-[52px] text-center">{age}</div>
          <button
            type="button"
            onClick={onAgePlus}
            className="w-[38px] h-[38px] border border-line bg-bg-surface rounded-[10px] flex items-center justify-center cursor-pointer text-base transition-colors duration-150 ease-out hover:border-ink"
          >
            +
          </button>
          <div className="text-sm text-ink-3">years old</div>
        </div>
        <div className="mt-[18px] pt-4 border-t border-line-2 flex gap-2.5 items-center text-[13px] text-green">
          ✓ Privacy preserving
        </div>
        <div className="text-[12.5px] text-ink-4 mt-1.5">
          The exact date of birth will not be shared. The wallet returns a zero-knowledge proof of the predicate{' '}
          <span className="font-mono">age ≥ {age}</span>.
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {CONDS.map((cond) => {
          const on = !!conds[cond.key]
          const style = claimBoxStyle(on)
          return (
            <div
              key={cond.key}
              role="button"
              tabIndex={0}
              onClick={() => onToggleCond(cond.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onToggleCond(cond.key)
              }}
              className="flex gap-3.5 items-center p-4 rounded-2xl cursor-pointer transition-colors duration-150 ease-out hover:border-ink"
              style={{ border: `1px solid ${style.border}`, background: style.bg }}
            >
              <div
                className="w-[18px] h-[18px] rounded-[5px] text-white text-[11px] flex items-center justify-center flex-none"
                style={{ border: `1.5px solid ${style.boxBorder}`, background: style.boxBg }}
              >
                {style.tick}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{cond.label}</div>
                <div className="text-[12.5px] text-ink-4 mt-0.5">{cond.desc}</div>
              </div>
              <div className="font-mono text-[10px] tracking-[0.08em] px-2.5 py-1.5 rounded-full bg-blue-bg text-blue">
                PROVE
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

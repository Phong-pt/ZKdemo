import { motion } from 'framer-motion'
import { MonoLabel } from '@/components/primitives'
import type { VerifierState } from '../types'
import { Step1Basics } from './wizard/Step1Basics'
import { Step2Claims } from './wizard/Step2Claims'
import { Step3Conditions } from './wizard/Step3Conditions'
import { Step4Issuers } from './wizard/Step4Issuers'
import { Step5Review } from './wizard/Step5Review'

export interface CreateWizardProps {
  state: VerifierState
  onName: (value: string) => void
  onDesc: (value: string) => void
  onPurpose: (value: string) => void
  onToggleReveal: (key: string) => void
  onToggleAge: () => void
  onAgeMinus: () => void
  onAgePlus: () => void
  onToggleCond: (key: string) => void
  onBack: () => void
  onNext: () => void
}

export function CreateWizard({
  state,
  onName,
  onDesc,
  onPurpose,
  onToggleReveal,
  onToggleAge,
  onAgeMinus,
  onAgePlus,
  onToggleCond,
  onBack,
  onNext,
}: CreateWizardProps) {
  const backLabel = state.wizard === 1 ? 'Cancel' : 'Back'
  const nextLabel = state.wizard === 5 ? 'Create request' : 'Continue'

  return (
    <motion.div
      className="bg-bg-surface border border-line rounded-[24px] overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="px-8 py-5 border-b border-line-2 flex items-center justify-between gap-4">
        <div className="text-[13px] font-medium">New verification request</div>
        <div className="flex items-center gap-2.5">
          <div className="w-[150px] h-1 bg-line-2 rounded-[2px] overflow-hidden">
            <div
              className="h-full bg-ink transition-[width] duration-300 ease-out"
              style={{ width: `${(state.wizard / 5) * 100}%` }}
            />
          </div>
          <MonoLabel as="span" size="md" tone="ink-4" tracking="0" uppercase={false}>
            {state.wizard} / 5
          </MonoLabel>
        </div>
      </div>

      <div className="px-8 pt-9 pb-8">
        {state.wizard === 1 && (
          <Step1Basics name={state.name} desc={state.desc} purpose={state.purpose} onName={onName} onDesc={onDesc} onPurpose={onPurpose} />
        )}
        {state.wizard === 2 && <Step2Claims reveal={state.reveal} onToggle={onToggleReveal} />}
        {state.wizard === 3 && (
          <Step3Conditions
            ageOn={state.ageOn}
            age={state.age}
            conds={state.conds}
            onToggleAge={onToggleAge}
            onAgeMinus={onAgeMinus}
            onAgePlus={onAgePlus}
            onToggleCond={onToggleCond}
          />
        )}
        {state.wizard === 4 && <Step4Issuers />}
        {state.wizard === 5 && <Step5Review state={state} />}

        <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-line-2">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3.5 border border-line rounded-xl text-sm cursor-pointer text-ink-3 transition-colors duration-150 ease-out hover:border-ink hover:text-ink"
          >
            {backLabel}
          </button>
          <button
            type="button"
            onClick={onNext}
            className="px-6 py-3.5 bg-ink text-white rounded-xl text-sm font-medium cursor-pointer transition-transform duration-150 ease-out hover:-translate-y-0.5"
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

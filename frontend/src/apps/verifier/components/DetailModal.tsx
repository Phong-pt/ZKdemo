import { motion } from 'framer-motion'
import { MonoLabel } from '@/components/primitives'
import type { LogEntry } from '../types'

export interface DetailModalProps {
  entry: LogEntry
  onClose: () => void
}

export function DetailModal({ entry, onClose }: DetailModalProps) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-6 z-[60] overflow-auto"
      style={{ background: 'rgba(18,19,23,.55)', backdropFilter: 'blur(7px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-full bg-bg-surface rounded-[24px] p-[30px]"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
        transition={{ duration: 0.3, ease: 'easeOut', times: [0, 0.6, 1] }}
      >
        <MonoLabel tracking="0.14em">{entry.id}</MonoLabel>
        <div className="text-[22px] font-medium tracking-[-0.025em] mt-2.5">Verification details</div>
        <div className="text-[13px] text-ink-3 mt-1.5">
          {entry.purpose} · {entry.date}
        </div>

        <div className="h-px bg-line-2 my-5" />
        <MonoLabel className="mb-2.5">Request</MonoLabel>
        <div className="text-sm">{entry.request}</div>

        <div className="h-px bg-line-2 my-[18px]" />
        <MonoLabel className="mb-2.5">Revealed</MonoLabel>
        <div className="text-sm">{entry.revealed}</div>

        <div className="h-px bg-line-2 my-[18px]" />
        <MonoLabel tone="blue" className="mb-2.5">
          Proven
        </MonoLabel>
        <div className="text-sm">{entry.proven}</div>

        <div className="h-px bg-line-2 my-[18px]" />
        <MonoLabel className="mb-2.5">Not revealed</MonoLabel>
        <div className="text-sm text-ink-3">{entry.withheld}</div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 text-center border border-line py-3 rounded-xl text-sm cursor-pointer transition-colors duration-150 ease-out hover:border-ink"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}

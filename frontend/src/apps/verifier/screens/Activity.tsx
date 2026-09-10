import { motion } from 'framer-motion'
import { HistoryTable } from '../components/HistoryTable'
import type { LogEntry } from '../types'

export interface ActivityProps {
  log: LogEntry[]
  onOpenDetail: (entry: LogEntry) => void
}

export function Activity({ log, onOpenDetail }: ActivityProps) {
  return (
    <motion.div
      className="bg-bg-surface border border-line rounded-[24px] p-9"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="text-[26px] font-medium tracking-[-0.03em]">Verification history</div>
      <div className="text-sm text-ink-3 mt-2.5">Every request, and exactly what was disclosed.</div>
      <div className="mt-[22px]">
        <HistoryTable log={log} onOpenDetail={onOpenDetail} />
      </div>
    </motion.div>
  )
}

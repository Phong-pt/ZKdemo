import { motion } from 'framer-motion'
import { MonoLabel } from '@/components/primitives'
import { HistoryTable } from '../components/HistoryTable'
import type { LogEntry } from '../types'

export interface DashboardProps {
  activeCount: number
  completedCount: number
  successRate: number
  log: LogEntry[]
  onCreateRequest: () => void
  onViewAllActivity: () => void
  onOpenDetail: (entry: LogEntry) => void
}

export function Dashboard({
  activeCount,
  completedCount,
  successRate,
  log,
  onCreateRequest,
  onViewAllActivity,
  onOpenDetail,
}: DashboardProps) {
  const stats = [
    ['ACTIVE', activeCount, 'Awaiting wallet'],
    ['COMPLETED', completedCount, 'Verified proofs'],
    ['REJECTED', 3, 'Declined by user'],
    ['SUCCESS RATE', `${successRate}%`, 'Last 30 days'],
  ] as const

  return (
    <motion.div
      className="flex flex-col gap-[22px]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="bg-bg-surface border border-line rounded-[24px] p-9">
        <div className="flex justify-between gap-6 items-start flex-wrap">
          <div className="flex-1 basis-80">
            <div className="text-[30px] font-medium tracking-[-0.03em]">Identity verification</div>
            <div className="text-[15px] text-ink-3 mt-2.5">Request only the information you need.</div>
          </div>
          <button
            type="button"
            onClick={onCreateRequest}
            className="bg-ink text-white px-[22px] py-3.5 rounded-[13px] text-sm font-medium cursor-pointer whitespace-nowrap transition-transform duration-150 ease-out hover:-translate-y-0.5"
          >
            Create verification request
          </button>
        </div>
        <div className="flex gap-3.5 mt-8 flex-wrap">
          {stats.map(([label, value, caption]) => (
            <div key={label} className="flex-1 basis-[150px] border border-line-2 rounded-2xl p-[18px]">
              <MonoLabel>{label}</MonoLabel>
              <div className="text-[28px] font-medium mt-2 tracking-[-0.02em]">{value}</div>
              <div className="text-xs text-ink-4 mt-0.5">{caption}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-surface border border-line rounded-[24px] px-8 py-[30px]">
        <div className="flex justify-between items-baseline mb-5">
          <div className="text-lg font-medium tracking-[-0.02em]">Recent verifications</div>
          <button
            type="button"
            onClick={onViewAllActivity}
            className="text-[13px] text-ink-3 cursor-pointer transition-colors duration-150 ease-out hover:text-ink"
          >
            View all
          </button>
        </div>
        <HistoryTable log={log} onOpenDetail={onOpenDetail} />
      </div>
    </motion.div>
  )
}

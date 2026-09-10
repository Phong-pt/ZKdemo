import type { LogEntry } from '../types'

export interface HistoryTableProps {
  log: LogEntry[]
  onOpenDetail: (entry: LogEntry) => void
}

const GRID_COLS = '1.1fr 1fr 1.4fr 1fr 1.3fr'

export function HistoryTable({ log, onOpenDetail }: HistoryTableProps) {
  return (
    <>
      <div
        className="grid gap-3 font-mono text-[10px] tracking-[0.12em] text-ink-5 pb-3 border-b border-line-2"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <div>ID</div>
        <div>DATE</div>
        <div>PURPOSE</div>
        <div>RESULT</div>
        <div>DISCLOSED</div>
      </div>
      {log.map((row) => (
        <div
          key={row.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpenDetail(row)}
          className="grid gap-3 text-[13px] py-3.5 border-b border-line-2 cursor-pointer items-center transition-colors duration-150 ease-out hover:bg-bg-sunken"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <div className="font-mono text-xs">{row.id}</div>
          <div className="text-ink-3">{row.date}</div>
          <div>{row.purpose}</div>
          <div style={{ color: row.color }}>{row.result}</div>
          <div className="text-ink-3">{row.disclosed}</div>
        </div>
      ))}
    </>
  )
}

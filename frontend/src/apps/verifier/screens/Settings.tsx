import { motion } from 'framer-motion'

export interface SettingsProps {
  orgName: string
}

const ROWS: Array<[label: string, value: string, mono?: boolean, color?: string]> = [
  ['Verifier DID', 'did:indy:vn:8FA2…19C4', true],
  ['Data retention', 'Proof result only · 90 days'],
  ['Raw attribute storage', 'Disabled ✓', false, '#17795E'],
]

export function Settings({ orgName }: SettingsProps) {
  return (
    <motion.div
      className="bg-bg-surface border border-line rounded-[24px] p-9"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="text-[26px] font-medium tracking-[-0.03em]">Settings</div>
      <div className="text-sm text-ink-3 mt-2.5">Organisation and trust configuration.</div>
      <div className="mt-[26px] flex flex-col gap-3.5">
        <div className="flex justify-between px-[18px] py-4 border border-line-2 rounded-2xl text-sm">
          <span className="text-ink-3">Organisation</span>
          <span>{orgName}</span>
        </div>
        {ROWS.map(([label, value, mono, color]) => (
          <div key={label} className="flex justify-between px-[18px] py-4 border border-line-2 rounded-2xl text-sm">
            <span className="text-ink-3">{label}</span>
            <span className={mono ? 'font-mono text-xs' : undefined} style={color ? { color } : undefined}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

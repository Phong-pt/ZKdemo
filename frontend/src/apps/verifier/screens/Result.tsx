import { motion } from 'framer-motion'
import { MonoLabel } from '@/components/primitives'

export interface ResultRow {
  label: string
  value: string
  color: string
}

export interface ResultProps {
  verified: boolean
  name: string
  requestId: string
  resultRows: ResultRow[]
  receivedList: string[]
  withheldList: string[]
  disclosurePct: number
  onBackToDashboard: () => void
  onNewRequest: () => void
}

export function Result({
  verified,
  name,
  requestId,
  resultRows,
  receivedList,
  withheldList,
  disclosurePct,
  onBackToDashboard,
  onNewRequest,
}: ResultProps) {
  const privacyPct = 100 - disclosurePct
  const statusColor = verified ? '#17795E' : '#B4763A'
  const credentialRows: Array<[label: string, value: string, color?: string]> = verified
    ? [
        ['Credential', 'Government Identity Credential ✓'],
        ['Credential status', 'Valid ✓', '#17795E'],
        ['Issuer', 'Trusted Government Issuer ✓', '#17795E'],
      ]
    : [['Credential', 'Proof could not be verified', '#B4763A']]

  return (
    <motion.div
      className="flex flex-col gap-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="bg-bg-surface border border-line rounded-[24px] px-9 py-10 text-center">
        <div className="relative w-[88px] h-[88px] mx-auto mb-6">
          <span
            className="absolute inset-0 rounded-full opacity-[.13] animate-[pulseRing_2s_ease-out_infinite]"
            style={{ background: statusColor }}
          />
          <motion.div
            className="absolute inset-0 rounded-full text-white text-[34px] flex items-center justify-center"
            style={{ background: statusColor }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
            transition={{ duration: 0.4, ease: 'easeOut', times: [0, 0.6, 1] }}
          >
            {verified ? '✓' : '✕'}
          </motion.div>
        </div>
        <div className="text-[28px] font-medium tracking-[-0.03em]">
          {verified ? 'Identity verified' : 'Verification declined'}
        </div>
        <MonoLabel tone={verified ? 'green' : 'amber'} tracking="0.16em" className="mt-2.5">
          {verified ? 'VERIFIED' : 'DECLINED'} · {requestId}
        </MonoLabel>
        <div className="text-sm text-ink-3 mt-2">{name}</div>
      </div>

      <div className="bg-bg-surface border border-line rounded-[24px] px-8 py-[30px]">
        <MonoLabel className="mb-4">Results</MonoLabel>
        {resultRows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 text-sm py-2.5 border-b border-line-2">
            <span className="text-ink-3">{row.label}</span>
            <span style={{ color: row.color }} className="text-right">
              {row.value}
            </span>
          </div>
        ))}
        <div className="h-px bg-line-2 my-5" />
        {credentialRows.map(([label, value, color]) => (
          <div key={label} className="flex justify-between text-sm py-1.5">
            <span className="text-ink-3">{label}</span>
            <span style={color ? { color } : undefined}>{value}</span>
          </div>
        ))}
      </div>

      <div
        className="rounded-[24px] px-8 py-[34px] text-white"
        style={{ background: 'linear-gradient(145deg,#2C2E36,#0F1013)' }}
      >
        <MonoLabel tone="white-dim" tracking="0.16em">
          Privacy protected
        </MonoLabel>
        <div className="text-2xl font-medium tracking-[-0.028em] mt-3">
          Minimum necessary information disclosed.
        </div>
        <div className="flex gap-4 mt-[26px] flex-wrap">
          <div className="flex-1 basis-[220px]">
            <div className="text-xs text-white/55 mb-2.5">You received</div>
            {receivedList.map((label) => (
              <div key={label} className="text-sm py-1.5" style={{ color: '#8FE0BE' }}>
                ✓ {label}
              </div>
            ))}
          </div>
          <div className="flex-1 basis-[220px]">
            <div className="text-xs text-white/55 mb-2.5">You did not receive</div>
            {withheldList.map((label) => (
              <div key={label} className="text-sm py-1.5 text-white/60">
                ✕ {label}
              </div>
            ))}
          </div>
        </div>
        <div className="h-px bg-white/[.12] my-[26px]" />
        <div className="flex gap-6 flex-wrap">
          <div className="flex-1 basis-[200px]">
            <div className="flex justify-between text-xs text-white/60">
              <span>Disclosure</span>
              <span>{disclosurePct}%</span>
            </div>
            <div className="h-1.5 bg-white/[.12] rounded-[3px] mt-2 overflow-hidden">
              <div className="h-full bg-white rounded-[3px]" style={{ width: `${disclosurePct}%` }} />
            </div>
          </div>
          <div className="flex-1 basis-[200px]">
            <div className="flex justify-between text-xs text-white/60">
              <span>Privacy preserved</span>
              <span>{privacyPct}%</span>
            </div>
            <div className="h-1.5 bg-white/[.12] rounded-[3px] mt-2 overflow-hidden">
              <div className="h-full rounded-[3px]" style={{ width: `${privacyPct}%`, background: '#8FE0BE' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="flex-1 basis-[200px] text-center bg-ink text-white py-3.5 rounded-[13px] text-sm font-medium cursor-pointer"
        >
          Back to dashboard
        </button>
        <button
          type="button"
          onClick={onNewRequest}
          className="flex-1 basis-[200px] text-center border border-line bg-bg-surface py-3.5 rounded-[13px] text-sm cursor-pointer transition-colors duration-150 ease-out hover:border-ink"
        >
          New request
        </button>
      </div>
    </motion.div>
  )
}

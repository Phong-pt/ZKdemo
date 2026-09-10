import { motion } from 'framer-motion'
import { MonoLabel } from '@/components/primitives'
import { mark } from '../types'
import type { PhoneState } from '../types'

export interface RequestedAttr {
  label: string
  value: string
  tag: string
  tagBg: string
  tagFg: string
}

export interface DiscCard {
  key: string
  label: string
  value: string
  valueColor: string
  note: string
  noteColor: string
  switchBg: string
  knobOn: boolean
  border: string
  bg: string
  disabled: boolean
  onToggle: () => void
}

export interface WalletPhoneProps {
  phone: Exclude<PhoneState, 'idle'>
  requestId: string
  orgName: string
  purposeText: string
  requestedAttrs: RequestedAttr[]
  zkNote: string
  discCards: DiscCard[]
  sharingCount: string
  provingCount: string
  notSharingText: string
  gstep: number
  onToDisclosure: () => void
  onApprove: () => void
  onDecline: () => void
  onDone: () => void
}

const GENERATING_STEPS = [
  'Preparing credentials',
  'Checking requested claims',
  'Creating zero-knowledge proof',
  'Protecting undisclosed information',
  'Generating presentation',
]

export function WalletPhone({
  phone,
  requestId,
  orgName,
  purposeText,
  requestedAttrs,
  zkNote,
  discCards,
  sharingCount,
  provingCount,
  notSharingText,
  gstep,
  onToDisclosure,
  onApprove,
  onDecline,
  onDone,
}: WalletPhoneProps) {
  return (
    <motion.div
      className="flex-none sticky top-6 flex flex-col items-center gap-2.5"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div
        className="w-[330px] h-[690px] p-[11px]"
        style={{ borderRadius: 46, background: '#0A0B0D', boxShadow: '0 50px 90px -45px rgba(10,11,13,.85)' }}
      >
        <div className="w-full h-full rounded-[36px] overflow-hidden bg-bg-surface flex flex-col">
          <div className="h-11 flex items-center justify-between px-6 text-xs font-mono flex-none">
            <span>9:41</span>
            <span>5G ▮</span>
          </div>

          {phone === 'scan' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="relative w-[70px] h-[70px]">
                <span className="absolute inset-0 rounded-full border-2 border-blue opacity-30 animate-[pulseRing_1.8s_ease-out_infinite]" />
                <div className="absolute inset-0 rounded-full border-2 border-ink flex items-center justify-center text-xl">
                  ◱
                </div>
              </div>
              <div className="text-lg font-medium">Connecting to verifier</div>
              <div className="text-[13px] text-ink-4">{requestId}</div>
            </div>
          )}

          {phone === 'request' && (
            <div className="flex-1 overflow-auto px-[22px] pt-2 pb-[26px]">
              <MonoLabel>Verification request</MonoLabel>
              <div className="flex items-center gap-2.5 mt-3.5">
                <div
                  className="w-[34px] h-[34px] rounded-[10px]"
                  style={{ background: 'linear-gradient(145deg,#2C2E36,#0F1013)' }}
                />
                <div>
                  <div className="text-[15px] font-medium">{orgName}</div>
                  <div className="text-xs text-ink-4">Verified organisation ✓</div>
                </div>
              </div>
              <div className="text-[13px] text-ink-3 mt-4 leading-[1.5]">{purposeText}</div>
              <div className="h-px bg-line-2 my-[18px]" />
              <div className="text-[13px] font-medium mb-3">This verifier is requesting:</div>
              {requestedAttrs.map((a) => (
                <div key={a.label} className="border border-line-2 rounded-xl px-3.5 py-3.5 mb-2.5">
                  <div className="flex justify-between gap-2.5">
                    <div className="text-[13.5px] font-medium">{a.label}</div>
                    <div
                      className="font-mono text-[9px] tracking-[0.08em] px-2 py-1 rounded-full h-fit"
                      style={{ background: a.tagBg, color: a.tagFg }}
                    >
                      {a.tag}
                    </div>
                  </div>
                  <div className="text-[12.5px] text-ink-4 mt-1">{a.value}</div>
                </div>
              ))}
              <div
                className="rounded-xl p-3.5 mt-3 text-[12.5px] leading-[1.5]"
                style={{ border: '1px solid #D9E6DF', background: '#F4FAF7', color: '#17795E' }}
              >
                {zkNote}
              </div>
              <button
                type="button"
                onClick={onToDisclosure}
                className="w-full mt-[18px] text-center bg-ink text-white py-3.5 rounded-xl text-sm font-medium cursor-pointer"
              >
                Review what you share
              </button>
            </div>
          )}

          {phone === 'disclosure' && (
            <div className="flex-1 overflow-auto px-[22px] pt-2 pb-[26px]">
              <div className="text-[19px] font-medium tracking-[-0.02em]">You choose what to share</div>
              <div className="text-[12.5px] text-ink-4 mt-2 leading-[1.5]">
                This request does not require you to share your full identity.
              </div>
              <div className="mt-[18px] flex flex-col gap-2.5">
                {discCards.map((d) => (
                  <div key={d.key} className="rounded-2xl p-3.5" style={{ border: `1px solid ${d.border}`, background: d.bg }}>
                    <div className="flex justify-between items-center gap-2.5">
                      <MonoLabel size="xs" tracking="0.12em">
                        {d.label}
                      </MonoLabel>
                      <button
                        type="button"
                        onClick={d.onToggle}
                        disabled={d.disabled}
                        className="w-[42px] h-6 rounded-full p-[3px] flex-none transition-colors duration-200 ease-out"
                        style={{ background: d.switchBg, cursor: d.disabled ? 'not-allowed' : 'pointer' }}
                      >
                        <div
                          className="w-[18px] h-[18px] rounded-full bg-white transition-transform duration-200 ease-out"
                          style={{ transform: `translateX(${d.knobOn ? 18 : 0}px)` }}
                        />
                      </button>
                    </div>
                    <div className="text-sm mt-2" style={{ color: d.valueColor }}>
                      {d.value}
                    </div>
                    <div className="text-[11.5px] mt-1" style={{ color: d.noteColor }}>
                      {d.note}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border border-line-2 rounded-2xl p-3.5 bg-bg-sunken">
                <div className="flex justify-between text-[12.5px] py-0.5">
                  <span className="text-ink-3">Sharing</span>
                  <span>{sharingCount}</span>
                </div>
                <div className="flex justify-between text-[12.5px] py-0.5">
                  <span className="text-ink-3">Proving</span>
                  <span>{provingCount}</span>
                </div>
                <div className="flex justify-between gap-3 text-[12.5px] py-0.5">
                  <span className="text-ink-3">Not sharing</span>
                  <span className="text-right">{notSharingText}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onApprove}
                className="w-full mt-4 text-center bg-ink text-white py-3.5 rounded-xl text-sm font-medium cursor-pointer"
              >
                Approve verification
              </button>
              <button
                type="button"
                onClick={onDecline}
                className="w-full mt-2.5 text-center text-ink-4 text-[13px] cursor-pointer"
              >
                Decline
              </button>
            </div>
          )}

          {phone === 'generating' && (
            <div className="flex-1 flex flex-col justify-center px-[26px] py-[30px]">
              <div
                className="relative w-24 h-24 mx-auto mb-[26px] rounded-[26px] overflow-hidden"
                style={{ background: 'linear-gradient(145deg,#2C2E36,#0F1013)' }}
              >
                <div
                  className="absolute left-0 right-0 h-[30%] animate-[sweep_1.6s_linear_infinite]"
                  style={{ background: 'linear-gradient(180deg,transparent,rgba(143,224,190,.5),transparent)' }}
                />
              </div>
              <div className="text-lg font-medium text-center">Creating your proof</div>
              <div className="mt-[22px] flex flex-col gap-2.5">
                {GENERATING_STEPS.map((label, i) => {
                  const [icon, color] = mark(i + 1, gstep)
                  return (
                    <div key={label} className="flex gap-2 text-[13px]" style={{ color }}>
                      {icon} {label}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {phone === 'sent' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3.5 p-8 text-center">
              <motion.div
                className="w-16 h-16 rounded-full bg-green text-white text-2xl flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
                transition={{ duration: 0.35, ease: 'easeOut', times: [0, 0.6, 1] }}
              >
                ✓
              </motion.div>
              <div className="text-lg font-medium">Verification sent</div>
              <div className="text-[13px] text-ink-4 leading-[1.5]">
                Only the information you approved was shared. Your undisclosed data remains private.
              </div>
              <button
                type="button"
                onClick={onDone}
                className="mt-2.5 border border-line px-6 py-2.5 rounded-xl text-[13px] cursor-pointer transition-colors duration-150 ease-out hover:border-ink"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
      <MonoLabel tracking="0.1em">User wallet</MonoLabel>
    </motion.div>
  )
}

import { motion } from 'framer-motion'
import type { PasskeyState } from '../types'

export interface PasskeyModalProps {
  passkey: Exclude<PasskeyState, 'idle'>
  onFinish: () => void
  onCancel: () => void
  mode?: 'create' | 'unlock'
}

const COPY = {
  create: {
    scanning: 'Look at your device to create the passkey.',
    doneTitle: 'Passkey created',
    doneHint: 'Stored securely on this device.',
  },
  unlock: {
    scanning: 'Look at your device to unlock your wallet.',
    doneTitle: 'Wallet unlocked',
    doneHint: 'Welcome back.',
  },
}

export function PasskeyModal({ passkey, onFinish, onCancel, mode = 'create' }: PasskeyModalProps) {
  const copy = COPY[mode]
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(18,19,23,.55)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <motion.div
        className="w-[340px] text-center"
        style={{
          background: 'rgba(255,255,255,.92)',
          borderRadius: 24,
          padding: 34,
          boxShadow: '0 40px 80px -30px rgba(0,0,0,.5)',
        }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
        transition={{ duration: 0.3, ease: 'easeOut', times: [0, 0.6, 1] }}
      >
        {passkey === 'scanning' && (
          <div>
            <div className="relative w-[86px] h-[86px] mx-auto mb-5">
              <span className="absolute inset-0 rounded-full border-2 border-ink opacity-20 animate-[pulseRing_1.6s_ease-out_infinite]" />
              <span className="absolute inset-0 rounded-[26px] border-[3px] border-ink animate-[breathe_1.6s_ease-in-out_infinite]" />
            </div>
            <div className="text-[17px] font-medium">Face ID</div>
            <div className="text-[13px] text-ink-3 mt-2">{copy.scanning}</div>
            <button
              type="button"
              onClick={onCancel}
              className="mt-[18px] text-[13px] text-ink-3 cursor-pointer underline"
            >
              Cancel
            </button>
          </div>
        )}

        {passkey === 'done' && (
          <div>
            <motion.div
              className="w-[66px] h-[66px] mx-auto mb-[18px] rounded-full bg-green text-white text-[28px] flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
              transition={{ duration: 0.35, ease: 'easeOut', times: [0, 0.6, 1] }}
            >
              ✓
            </motion.div>
            <div className="text-[17px] font-medium">{copy.doneTitle}</div>
            <div className="text-[13px] text-ink-3 mt-2">{copy.doneHint}</div>
            <button
              type="button"
              onClick={onFinish}
              className="mt-[22px] bg-ink text-white py-3 px-4 rounded-xl text-sm font-medium cursor-pointer w-full"
            >
              Continue
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

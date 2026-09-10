import { motion } from 'framer-motion'
import { Card } from '@/components/primitives'

export interface VerifiedProps {
  onOpenWallet: () => void
}

export function Verified({ onOpenWallet }: VerifiedProps) {
  return (
    <Card
      elevated
      className="w-full max-w-[520px] text-center"
      style={{ borderRadius: 26, padding: '56px 44px', boxShadow: '0 30px 60px -45px rgba(20,22,28,.3)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="relative w-24 h-24 mx-auto mb-[26px]">
        <span className="absolute inset-0 rounded-full bg-green opacity-[.14] animate-[pulseRing_2s_ease-out_infinite]" />
        <motion.div
          className="absolute inset-0 rounded-full bg-green text-white text-[38px] flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
          transition={{ duration: 0.45, ease: 'easeOut', times: [0, 0.6, 1] }}
        >
          ✓
        </motion.div>
      </div>
      <div className="text-[28px] font-medium tracking-[-0.028em]">Identity verified</div>
      <div className="text-sm text-ink-3 mt-3 leading-[1.55]">
        Your identity credential has been issued and added to your wallet.
      </div>
      <button
        type="button"
        onClick={onOpenWallet}
        className="w-full mt-[30px] bg-ink text-white py-3.5 rounded-[13px] text-[15px] font-medium cursor-pointer"
      >
        Open wallet
      </button>
    </Card>
  )
}

import { motion } from 'framer-motion'
import { Card } from '@/components/primitives'
import type { GoogleAccount } from '@/services/authService'

export interface SignedInProps {
  account: GoogleAccount
}

export function SignedIn({ account }: SignedInProps) {
  return (
    <Card
      elevated
      className="w-full max-w-[520px] text-center"
      style={{ borderRadius: 26, padding: '52px 44px', boxShadow: '0 30px 60px -45px rgba(20,22,28,.35)' }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="relative w-[82px] h-[82px] mx-auto mb-[22px]">
        <span className="absolute inset-0 rounded-full bg-green opacity-[.18] animate-[pulseRing_2s_ease-out_infinite]" />
        <div
          className="absolute inset-0 rounded-full text-white flex items-center justify-center text-[30px] font-medium"
          style={{ background: 'linear-gradient(145deg,#3D6BEA,#2438A8)' }}
        >
          {account.avatarInitial}
        </div>
        <motion.div
          className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full bg-green border-[3px] border-bg-surface text-white text-sm flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut', times: [0, 0.6, 1] }}
        >
          ✓
        </motion.div>
      </div>
      <div className="text-[26px] font-medium tracking-[-0.025em]">You're signed in</div>
      <div className="text-[15px] text-ink mt-3.5">{account.name}</div>
      <div className="text-sm text-ink-3">{account.email}</div>
      <div className="mt-[30px] h-[3px] bg-line-2 rounded-[2px] overflow-hidden">
        <div
          className="h-full w-full animate-[shimmer_1.4s_linear_infinite]"
          style={{
            background: 'linear-gradient(90deg,transparent,#16171A,transparent)',
            backgroundSize: '220% 100%',
          }}
        />
      </div>
      <div className="text-[13px] text-ink-3 mt-3.5">Your wallet is being prepared…</div>
    </Card>
  )
}

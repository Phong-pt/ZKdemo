import { motion } from 'framer-motion'
import type { GoogleAccount } from '@/services/authService'

export interface GoogleModalProps {
  productName: string
  account: GoogleAccount
  busy: boolean
  onPickAccount: () => void
}

export function GoogleModal({ productName, account, busy, onPickAccount }: GoogleModalProps) {
  return (
    <motion.div
      className="w-full max-w-[1000px] flex justify-center py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <motion.div
        className="w-[420px] max-w-full bg-bg-surface border border-line overflow-hidden"
        style={{ borderRadius: 20, boxShadow: '0 40px 80px -45px rgba(20,22,28,.5)' }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
        transition={{ duration: 0.35, ease: 'easeOut', times: [0, 0.6, 1] }}
      >
        <div className="px-7 pt-[26px] pb-[18px] border-b border-line-2">
          <div className="text-[13px] text-ink-3 mb-2.5">Sign in with Google</div>
          <div className="text-[19px] font-medium tracking-[-0.02em]">Choose an account</div>
          <div className="text-[13px] text-ink-3 mt-1.5">to continue to {productName}</div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={onPickAccount}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onPickAccount()
          }}
          className="flex items-center gap-3.5 px-7 py-[18px] cursor-pointer transition-colors duration-150 ease-out hover:bg-bg-muted"
        >
          <div
            className="w-[38px] h-[38px] rounded-full text-white flex items-center justify-center text-[15px] font-medium"
            style={{ background: 'linear-gradient(145deg,#3D6BEA,#2438A8)' }}
          >
            {account.avatarInitial}
          </div>
          <div>
            <div className="text-sm font-medium">{account.name}</div>
            <div className="text-[13px] text-ink-3">{account.email}</div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 px-7 py-[18px] border-t border-line-2 text-ink-3 text-sm">
          <div className="w-[38px] h-[38px] rounded-full border border-dashed border-line" />
          Use another account
        </div>

        {busy && (
          <div className="px-7 pb-[22px] pt-4 flex items-center gap-2.5 text-[13px] text-ink-3">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-line animate-[spin_0.7s_linear_infinite] inline-block border-t-ink" />
            Signing you in…
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

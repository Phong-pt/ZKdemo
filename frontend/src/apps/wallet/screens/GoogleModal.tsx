import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { authService, demoAccount, type GoogleAccount } from '@/services/authService'

const DEMO_LABELS = ['nguoi-dung-a', 'nguoi-dung-b']

export interface GoogleModalProps {
  productName: string
  onAccount: (account: GoogleAccount) => void
}

export function GoogleModal({ productName, onAccount }: GoogleModalProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (buttonRef.current) {
      authService.mountSignInButton(buttonRef.current, onAccount).then((ok) => {
        if (!cancelled) setMounted(ok)
      })
    }
    return () => {
      cancelled = true
    }
  }, [onAccount])

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

        <div className="px-7 py-[22px] flex flex-col items-center gap-3">
          <div ref={buttonRef} style={{ minHeight: 44 }} />
          {!mounted && DEMO_LABELS.map((label) => {
            const account = demoAccount(label)
            return (
              <div
                key={label}
                role="button"
                tabIndex={0}
                onClick={() => onAccount(account)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onAccount(account)
                }}
                className="w-full flex items-center gap-3.5 px-4 py-[14px] rounded-xl border border-line cursor-pointer transition-colors duration-150 ease-out hover:bg-bg-muted"
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
            )
          })}
          {!mounted && (
            <div className="text-[12px] text-ink-4 text-center leading-relaxed">
              Google Sign-In chưa được cấu hình (thiếu biến môi trường GOOGLE_CLIENT_ID) — chọn một trong hai
              tài khoản demo ở trên; mỗi tài khoản là một ví riêng.
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

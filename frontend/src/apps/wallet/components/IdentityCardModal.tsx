import { motion } from 'framer-motion'
import { MonoLabel } from '@/components/primitives'
import type { GoogleAccount } from '@/services/authService'
import type { VerifiedIdentity } from '@/services/kycService'

export interface IdentityCardModalProps {
  account: GoogleAccount
  identity: VerifiedIdentity
  onClose: () => void
}

const INFO_ROWS: Array<[label: string, key: keyof VerifiedIdentity]> = [
  ['Name', 'name'],
  ['Date of birth', 'dob'],
  ['Nationality', 'nationality'],
  ['Document', 'document'],
]

const VERIFICATION_ROWS = ['Document verified', 'Face verified', 'Identity verified']
const SECURITY_ROWS = ['Passkey enabled', 'Wallet secured']

export function IdentityCardModal({ account, identity, onClose }: IdentityCardModalProps) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-6 z-[60] overflow-auto"
      style={{ background: 'rgba(18,19,23,.6)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="w-[440px] max-w-full bg-bg-surface overflow-hidden"
        style={{ borderRadius: 26, boxShadow: '0 50px 90px -40px rgba(0,0,0,.6)' }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
        transition={{ duration: 0.35, ease: 'easeOut', times: [0, 0.6, 1] }}
      >
        <div className="p-7 text-white" style={{ background: 'linear-gradient(145deg,#2C2E36,#0B0C0F)' }}>
          <MonoLabel tone="white-dim" size="sm" tracking="0.2em">
            VERIFIED IDENTITY
          </MonoLabel>
          <div className="flex items-center gap-3.5 mt-[22px]">
            <div
              className="w-[50px] h-[50px] rounded-2xl flex items-center justify-center text-lg"
              style={{ background: 'linear-gradient(145deg,#3D6BEA,#2438A8)' }}
            >
              {account.avatarInitial}
            </div>
            <div>
              <div className="text-lg font-medium uppercase">{identity.name}</div>
              <div className="text-xs text-white/60 mt-1">Verified ✓</div>
            </div>
          </div>
        </div>

        <div className="px-7 pt-[26px] pb-[30px]">
          <MonoLabel className="mb-3">Personal information</MonoLabel>
          {INFO_ROWS.map(([label, key]) => (
            <div key={key} className="flex justify-between text-sm py-2.5">
              <span className="text-ink-3">{label}</span>
              <span>{identity[key]}</span>
            </div>
          ))}

          <div className="h-px bg-line-2 my-[18px]" />
          <MonoLabel className="mb-3">Verification</MonoLabel>
          {VERIFICATION_ROWS.map((label) => (
            <div key={label} className="flex gap-2 text-sm py-1.5 text-ink-2">
              <span className="text-green">✓</span> {label}
            </div>
          ))}

          <div className="h-px bg-line-2 my-[18px]" />
          <MonoLabel className="mb-3">Security</MonoLabel>
          {SECURITY_ROWS.map((label) => (
            <div key={label} className="flex gap-2 text-sm py-1.5 text-ink-2">
              <span className="text-green">✓</span> {label}
            </div>
          ))}

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-[22px] text-center border border-line py-3.5 rounded-xl text-sm cursor-pointer transition-colors duration-150 ease-out hover:border-ink"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

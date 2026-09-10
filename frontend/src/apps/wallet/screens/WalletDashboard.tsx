import { motion } from 'framer-motion'
import { QrGrid } from '@/components/QrGrid'
import { Button, MonoLabel } from '@/components/primitives'
import type { GoogleAccount } from '@/services/authService'
import type { VerifiedIdentity } from '@/services/kycService'

export interface WalletDashboardProps {
  account: GoogleAccount
  verifiedIdentity: VerifiedIdentity | null
  onStartKyc: () => void
  onOpenCard: () => void
}

const PLACEHOLDER_CARDS = ['Membership', 'Payment', 'Credential']

export function WalletDashboard({ account, verifiedIdentity, onStartKyc, onOpenCard }: WalletDashboardProps) {
  const verified = verifiedIdentity !== null
  const cardCountLabel = verified ? '4 cards' : 'No cards yet'

  return (
    <motion.div
      className="w-full max-w-[1180px] flex gap-6 items-start flex-wrap"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="flex-1 basis-[260px] min-w-[240px] bg-bg-surface border border-line rounded-[24px] p-[26px]">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full text-white flex items-center justify-center text-[17px]"
            style={{ background: 'linear-gradient(145deg,#3D6BEA,#2438A8)' }}
          >
            {account.avatarInitial}
          </div>
          <div>
            <div className="text-sm font-medium">{account.name}</div>
            <div className="text-xs text-ink-4">{account.email}</div>
          </div>
        </div>

        <div className="h-px bg-line-2 my-[22px]" />
        <MonoLabel className="mb-3">Identity</MonoLabel>
        <div className="flex items-center gap-2 text-sm" style={{ color: verified ? '#17795E' : '#B4763A' }}>
          {verified ? '✓' : '!'} {verified ? 'Verified' : 'Verification required'}
        </div>
        {!verified && (
          <div>
            <div className="text-xs text-ink-4 mt-2 leading-[1.5]">
              Chưa thực hiện định danh. Xác minh để nhận thẻ định danh và ký giao dịch.
            </div>
            <Button variant="primary" size="sm" onClick={onStartKyc} className="w-full mt-4">
              Complete eKYC
            </Button>
          </div>
        )}

        <div className="h-px bg-line-2 my-[22px]" />
        <MonoLabel className="mb-3">Security</MonoLabel>
        <div className="flex items-center gap-2 text-sm text-ink-2 mb-2">
          <span className="text-green">✓</span> Passkey enabled
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <span className="text-green">✓</span> Wallet secured
        </div>

        <div className="h-px bg-line-2 my-[22px]" />
        <MonoLabel className="mb-2.5">Balance</MonoLabel>
        <div className="text-2xl font-medium tracking-[-0.02em]">0.842 ETH</div>
        <div className="text-xs text-ink-4 mt-1">≈ $2,164.30</div>
      </div>

      <div className="flex-[3_1_560px] min-w-[300px] bg-bg-surface border border-line rounded-[24px] p-8">
        <div className="flex justify-between items-baseline mb-[26px]">
          <div className="text-[22px] font-medium tracking-[-0.025em]">Wallet</div>
          <div className="text-xs text-ink-4">{cardCountLabel}</div>
        </div>

        {!verified && (
          <div
            role="button"
            tabIndex={0}
            onClick={onStartKyc}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onStartKyc()
            }}
            className="border border-dashed border-line rounded-[20px] h-[210px] flex flex-col items-center justify-center gap-2 cursor-pointer bg-bg-sunken transition-colors duration-150 ease-out hover:border-ink"
          >
            <div className="text-[26px] text-ink-5 font-light">+</div>
            <div className="text-[15px] font-medium">Add identity</div>
            <div className="text-[13px] text-ink-4">Your wallet is empty</div>
          </div>
        )}

        {verifiedIdentity && (
          <div className="flex flex-col gap-4">
            <motion.div
              role="button"
              tabIndex={0}
              onClick={onOpenCard}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onOpenCard()
              }}
              className="relative text-white cursor-pointer transition-transform duration-200 ease-out hover:-translate-y-1.5"
              style={{
                borderRadius: 22,
                padding: 26,
                background: 'linear-gradient(145deg,#2C2E36 0%,#141519 55%,#0B0C0F 100%)',
                boxShadow: '0 30px 60px -40px rgba(11,12,15,.9)',
              }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: [0.85, 1.04, 1] }}
              transition={{ duration: 0.5, ease: 'easeOut', times: [0, 0.6, 1] }}
            >
              <div className="flex justify-between items-start">
                <MonoLabel tone="white-dim" size="sm" tracking="0.2em">
                  VERIFIED IDENTITY
                </MonoLabel>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-[34px] h-[25px] rounded-[5px]"
                    style={{ background: 'linear-gradient(140deg,#DCCCA4,#96855E)' }}
                  />
                  <div className="w-[30px] h-[30px] rounded-lg bg-white/10 flex items-center justify-center text-xs">
                    ✓
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-[34px]">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: 'linear-gradient(145deg,#3D6BEA,#2438A8)' }}
                >
                  {verifiedIdentity.name.charAt(0)}
                </div>
                <div>
                  <div className="text-xl font-medium tracking-[-0.015em] uppercase">{verifiedIdentity.name}</div>
                  <div className="text-xs text-white/60 mt-1.5">Identity verified ✓ · National ID</div>
                </div>
                <div className="flex-1" />
                <div className="w-[52px] h-[52px] rounded-[10px] bg-white/90 opacity-85 overflow-hidden">
                  <QrGrid size={52} cell={2} />
                </div>
              </div>
            </motion.div>

            <div className="flex flex-col gap-3">
              {PLACEHOLDER_CARDS.map((title) => (
                <div
                  key={title}
                  className="rounded-[18px] px-6 py-5 bg-bg-muted border flex justify-between items-center transition-transform duration-200 ease-out hover:-translate-y-1"
                  style={{ borderColor: '#EAEAE5' }}
                >
                  <div>
                    <div className="text-[15px] font-medium">{title}</div>
                    <div className="text-xs text-ink-4 mt-1">Not added</div>
                  </div>
                  <div className="text-xs text-ink-4">+</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-px bg-line-2 mt-7 mb-5" />
        <MonoLabel className="mb-3.5">Recent activity</MonoLabel>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between text-sm">
            <span>Wallet created</span>
            <span className="text-ink-4">Today</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Passkey registered</span>
            <span className="text-ink-4">Today</span>
          </div>
          {verified && (
            <div className="flex justify-between text-sm">
              <span>Identity credential issued</span>
              <span className="text-ink-4">Just now</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

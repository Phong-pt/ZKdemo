import { motion } from 'framer-motion'
import { useState } from 'react'
import { QrCode } from '@/apps/wallet/components/QrCode'
import { mark } from '../types'

export interface LiveSessionProps {
  verificationUrl: string
  name: string
  requestId: string
  vstep: number
  expirySeconds: number
  sessionText: string
  predicateText: string
  phoneIdle: boolean
  onSimulateScan: () => void
}

const CHECKLIST_PREFIX = [
  'Wallet connected',
  'User reviewing disclosure',
  'Proof received',
  'Credential signature checked',
  'Issuer trusted',
]
const CHECKLIST_SUFFIX = ['Checking presentation challenge', 'Waiting for verification result']

function statusFor(vstep: number): { label: string; color: string } {
  if (vstep >= 8) return { label: 'Verified', color: '#17795E' }
  if (vstep === 0) return { label: 'Waiting for wallet', color: '#B4763A' }
  if (vstep === 1) return { label: 'Wallet connected', color: '#2F5FE0' }
  if (vstep === 2) return { label: 'Waiting for user approval', color: '#2F5FE0' }
  return { label: 'Verifying proof', color: '#2F5FE0' }
}

export function LiveSession({
  verificationUrl,
  name,
  requestId,
  vstep,
  expirySeconds,
  sessionText,
  predicateText,
  phoneIdle,
  onSimulateScan,
}: LiveSessionProps) {
  const [copyStatus, setCopyStatus] = useState('')
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(verificationUrl); setCopyStatus('Link copied') }
    catch { setCopyStatus('Copy the link below') }
  }
  const status = statusFor(vstep)
  const mins = Math.floor(expirySeconds / 60)
  const secs = expirySeconds % 60
  const expiry = `${mins}:${String(secs).padStart(2, '0')}`
  const verifyWidth = Math.min(100, (vstep / 8) * 100)

  return (
    <motion.div
      className="bg-bg-surface border border-line rounded-[24px] overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="px-8 py-5 border-b border-line-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-[13px] font-medium">{name}</div>
          <div className="font-mono text-[11px] text-ink-4">{requestId}</div>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: status.color }}>
          <span
            className="w-[7px] h-[7px] rounded-full animate-[breathe_1.4s_ease-in-out_infinite] inline-block"
            style={{ background: status.color }}
          />
          {status.label}
        </div>
      </div>

      <div className="px-8 py-[38px]">
        {vstep === 0 && (
          <div className="text-center">
            <div className="text-[26px] font-medium tracking-[-0.03em]">Scan to verify</div>
            <div className="text-sm text-ink-3 mt-2.5">
              Ask the user to scan this QR code with their identity wallet.
            </div>
            <div className="inline-block p-5 border border-line rounded-[22px] mt-[26px]">
              <QrCode value={verificationUrl} size={216} />
            </div>
            <div className="font-mono text-xs text-ink-4 mt-4">Connection expires in {expiry}</div>
            <div className="flex gap-2.5 justify-center mt-[22px] flex-wrap">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="px-[18px] py-2.5 border border-line rounded-xl text-[13px] cursor-pointer transition-colors duration-150 ease-out hover:border-ink"
              >
                Copy verification link
              </button>
              <button
                type="button"
                onClick={() => window.open(verificationUrl, '_blank', 'noopener,noreferrer')}
                className="px-[18px] py-2.5 border border-line rounded-xl text-[13px] cursor-pointer transition-colors duration-150 ease-out hover:border-ink"
              >
                Open wallet
              </button>
            </div>
            <div className="mt-3 text-xs text-ink-3" role="status">{copyStatus}</div>
            <a className="block mt-2 text-xs text-blue break-all" href={verificationUrl}>{verificationUrl}</a>
            {phoneIdle && expirySeconds > 0 && (
              <button
                type="button"
                onClick={onSimulateScan}
                className="inline-block mt-[26px] px-5 py-3 border border-ink rounded-xl text-[13px] font-medium cursor-pointer transition-colors duration-150 ease-out hover:bg-ink hover:text-white"
              >
                Simulate user scanning →
              </button>
            )}
          </div>
        )}

        {vstep > 0 && (
          <div>
            <div className="flex gap-4 items-center p-5 border border-line-2 rounded-[18px] bg-bg-sunken">
              <div className="relative w-[46px] h-[46px] flex-none">
                <span className="absolute inset-0 rounded-full border-[1.5px] border-blue opacity-30 animate-[pulseRing_1.8s_ease-out_infinite]" />
                <div className="absolute inset-0 rounded-full bg-blue-bg text-blue flex items-center justify-center text-base">
                  ◆
                </div>
              </div>
              <div>
                <div className="text-[15px] font-medium">Anonymous wallet session</div>
                <div className="text-[13px] text-ink-3 mt-1">{sessionText}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {[...CHECKLIST_PREFIX, `Checking ${predicateText}`, ...CHECKLIST_SUFFIX].map(
                (label, i) => {
                  const [icon, color] = mark(i + 1, vstep)
                  return (
                    <div key={label} className="flex items-center gap-2.5 text-sm" style={{ color }}>
                      {icon} {label}
                    </div>
                  )
                },
              )}
            </div>

            <div className="mt-[26px] h-1.5 bg-line-2 rounded-[3px] overflow-hidden">
              <div
                className="h-full bg-ink rounded-[3px] transition-[width] duration-500 ease-out"
                style={{ width: `${verifyWidth}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

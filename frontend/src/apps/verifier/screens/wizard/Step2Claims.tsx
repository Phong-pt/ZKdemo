import { claimBoxStyle } from '../../derived'
import type { Claim } from '../../types'
import type { ActiveSchemaResponse } from '@/services/apiClient'

export interface Step2ClaimsProps {
  claims: Claim[]
  schema: ActiveSchemaResponse
  schemaError: string | null
  reveal: Record<string, boolean>
  onToggle: (key: string) => void
}

function ClaimRow({ claim, on, onToggle }: { claim: Claim; on: boolean; onToggle: () => void }) {
  const style = claimBoxStyle(on)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() }
      }}
      className="flex gap-3.5 items-start px-4 py-[15px] rounded-2xl cursor-pointer mb-2.5 transition-colors duration-150 ease-out hover:border-ink"
      style={{ border: `1px solid ${style.border}`, background: style.bg }}
    >
      <div
        className="w-[18px] h-[18px] rounded-[5px] text-white text-[11px] flex items-center justify-center flex-none mt-0.5"
        style={{ border: `1.5px solid ${style.boxBorder}`, background: style.boxBg }}
      >
        {style.tick}
      </div>
      <div>
        <div className="text-sm font-medium">{claim.label}</div>
        <div className="text-[12.5px] text-ink-4 mt-0.5">{claim.desc}</div>
      </div>
    </div>
  )
}

export function Step2Claims({ claims, schema, schemaError, reveal, onToggle }: Step2ClaimsProps) {
  const fromChain = schema.source === 'chain'
  return (
    <div>
      <div className="text-[26px] font-medium tracking-[-0.03em]">Information to request</div>
      <div className="text-sm text-ink-3 mt-2.5">
        Ask only for what you need. Anything you leave off is never sent to you.
      </div>

      {/* Nguồn của danh sách dưới đây. Verifier chỉ hỏi được trong phạm vi schema issuer đã đăng
          ký; đây là chỗ nói rõ phạm vi đó đến từ đâu. */}
      <div
        className="mt-4 rounded-xl px-4 py-3 text-[12.5px]"
        style={
          fromChain
            ? { border: '1px solid #D9E6DF', background: '#F4FAF7', color: '#17795E' }
            : { border: '1px solid #E6E6E2', background: '#FBFBF9', color: '#6E7079' }
        }
      >
        <span className="font-mono">
          {schema.name}:{schema.version}
        </span>{' '}
        — {claims.length} thuộc tính,{' '}
        {fromChain
          ? 'đọc từ contract CredentialRegistry trên Ethereum Sepolia'
          : 'đọc từ khoá cục bộ của issuer (chain chưa cấu hình)'}
        {fromChain && schema.issuer && (
          <div className="mt-1 font-mono text-[11px] break-all" style={{ color: '#5E7A6E' }}>
            issuer {schema.issuer}
          </div>
        )}
      </div>

      {schemaError && (
        <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          {schemaError}
        </div>
      )}

      <div className="mt-[26px]">
        {claims.length === 0 && !schemaError && (
          <div className="text-sm text-ink-4">Đang đọc schema từ registry…</div>
        )}
        {claims.map((claim) => (
          <ClaimRow key={claim.key} claim={claim} on={!!reveal[claim.key]} onToggle={() => onToggle(claim.key)} />
        ))}
      </div>
    </div>
  )
}

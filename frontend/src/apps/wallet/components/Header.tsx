import { Button, MonoLabel } from '@/components/primitives'

export interface HeaderProps {
  productName: string
  stageLabel: string
  accountEmail?: string
  onRestart: () => void
  onSignOut?: () => void
}

export function Header({ productName, stageLabel, accountEmail, onRestart, onSignOut }: HeaderProps) {
  return (
    <div className="w-full max-w-[1180px] flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <div className="w-[26px] h-[26px] rounded-[8px] bg-[linear-gradient(145deg,#2A2C33,#0E0F12)] flex items-center justify-center">
          <div className="w-[9px] h-[9px] rounded-[3px] border-2 border-bg-page" />
        </div>
        <div className="text-sm font-semibold tracking-[-0.01em]">{productName}</div>
      </div>
      <div className="flex items-center gap-2.5">
        <MonoLabel tone="ink-4" tracking="0.04em">
          {stageLabel}
        </MonoLabel>
        <a href="/issuer" target="_blank" rel="noreferrer" className="text-xs text-ink-3 hover:text-ink">Issuer ↗</a>
        {accountEmail && <div className="text-[12px] text-ink-3 max-w-[220px] truncate">{accountEmail}</div>}
        {accountEmail && onSignOut && (
          <Button variant="secondary" size="sm" pill onClick={onSignOut}>
            Sign out
          </Button>
        )}
        <Button variant="secondary" size="sm" pill onClick={onRestart}>
          Về màn đăng nhập
        </Button>
      </div>
    </div>
  )
}

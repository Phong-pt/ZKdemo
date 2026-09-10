import { Button, MonoLabel } from '@/components/primitives'

export interface HeaderProps {
  productName: string
  stageLabel: string
  onRestart: () => void
}

export function Header({ productName, stageLabel, onRestart }: HeaderProps) {
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
        <Button variant="secondary" size="sm" pill onClick={onRestart}>
          Restart demo
        </Button>
      </div>
    </div>
  )
}

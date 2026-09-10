import { MonoLabel } from '@/components/primitives'

export interface KycProgressHeaderProps {
  step: number
  total: number
  widthPercentOverride?: number
  widthTransitionMs?: number
}

export function KycProgressHeader({ step, total, widthPercentOverride, widthTransitionMs = 400 }: KycProgressHeaderProps) {
  const widthPercent = widthPercentOverride ?? (step / total) * 100
  return (
    <div className="px-8 py-5 border-b border-line-2 flex items-center justify-between">
      <div className="text-[13px] font-medium">Identity verification</div>
      <div className="flex items-center gap-2.5">
        <div className="w-[120px] h-1 bg-line-2 rounded-[2px] overflow-hidden">
          <div
            className="h-full bg-ink"
            style={{ width: `${widthPercent}%`, transition: `width ${widthTransitionMs}ms ease` }}
          />
        </div>
        <MonoLabel as="span" size="md" tone="ink-4" tracking="0" uppercase={false}>
          {step} / {total}
        </MonoLabel>
      </div>
    </div>
  )
}

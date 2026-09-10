import { cn } from '@/lib/cn'
import type { View } from '../types'

export interface SidebarProps {
  orgName: string
  view: View
  onNavigate: (view: View) => void
  onRestart: () => void
}

const NAV_ITEMS: Array<[label: string, view: View]> = [
  ['Dashboard', 'dashboard'],
  ['Verification requests', 'create'],
  ['Templates', 'templates'],
  ['Activity', 'activity'],
  ['Settings', 'settings'],
]

export function Sidebar({ orgName, view, onNavigate, onRestart }: SidebarProps) {
  return (
    <div className="flex-none w-[228px] sticky top-6 bg-bg-surface border border-line rounded-[22px] p-[22px_18px] flex flex-col gap-1 min-h-[520px]">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div
          className="w-[26px] h-[26px] rounded-[8px] flex items-center justify-center"
          style={{ background: 'linear-gradient(145deg,#2A2C33,#0E0F12)' }}
        >
          <div className="w-[9px] h-[9px] rounded-[3px] border-2 border-bg-page" />
        </div>
        <div>
          <div className="text-[13px] font-semibold tracking-[-0.01em]">{orgName}</div>
          <div className="text-[11px] text-ink-5">Verifier portal</div>
        </div>
      </div>

      {NAV_ITEMS.map(([label, itemView]) => {
        const active = view === itemView || (itemView === 'create' && view === 'live')
        return (
          <button
            key={itemView}
            type="button"
            onClick={() => onNavigate(itemView)}
            className={cn(
              'text-left px-3 py-2.5 rounded-[11px] text-sm cursor-pointer transition-colors duration-150 ease-out',
              active ? 'bg-ink text-white' : 'bg-transparent text-ink-2 hover:bg-bg-muted',
            )}
          >
            {label}
          </button>
        )
      })}

      <div className="flex-1 min-h-6" />

      <div className="border-t border-line-2 pt-4 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full text-white text-[13px] flex items-center justify-center"
          style={{ background: 'linear-gradient(145deg,#3D6BEA,#2438A8)' }}
        >
          A
        </div>
        <div>
          <div className="text-[13px]">Anh Tran</div>
          <div className="text-[11px] text-ink-5">Compliance</div>
        </div>
      </div>
      <button
        type="button"
        onClick={onRestart}
        className="mt-3 text-center text-xs text-ink-3 border border-line py-2 rounded-[10px] cursor-pointer transition-colors duration-150 ease-out hover:border-ink hover:text-ink"
      >
        Restart demo
      </button>
    </div>
  )
}

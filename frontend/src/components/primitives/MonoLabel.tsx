import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type Tone = 'ink' | 'ink-2' | 'ink-3' | 'ink-4' | 'ink-5' | 'white' | 'white-dim' | 'blue' | 'green' | 'amber'

export interface MonoLabelProps {
  as?: ElementType
  size?: Size
  tone?: Tone
  tracking?: string
  uppercase?: boolean
  className?: string
  children: ReactNode
}

const sizeClass: Record<Size, string> = {
  xs: 'text-[9px] tracking-[0.16em]',
  sm: 'text-[10px] tracking-[0.14em]',
  md: 'text-[11px] tracking-[0.12em]',
  lg: 'text-[13px] tracking-[0.1em]',
  xl: 'text-[28px] tracking-[0.22em]',
}

const toneClass: Record<Tone, string> = {
  ink: 'text-ink',
  'ink-2': 'text-ink-2',
  'ink-3': 'text-ink-3',
  'ink-4': 'text-ink-4',
  'ink-5': 'text-ink-5',
  white: 'text-white',
  'white-dim': 'text-white/60',
  blue: 'text-blue',
  green: 'text-green',
  amber: 'text-amber',
}

export function MonoLabel({
  as: Tag = 'div',
  size = 'sm',
  tone = 'ink-5',
  tracking,
  uppercase = true,
  className,
  children,
}: MonoLabelProps) {
  return (
    <Tag
      className={cn(
        'font-mono',
        sizeClass[size],
        toneClass[tone],
        uppercase && 'uppercase',
        className,
      )}
      style={tracking ? { letterSpacing: tracking } : undefined}
    >
      {children}
    </Tag>
  )
}

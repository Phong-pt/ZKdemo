import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/cn'

type Surface = 'surface' | 'sunken' | 'muted' | 'dark'
type Radius = 'pill' | 'sm' | 'md' | 'lg'
type Padding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends HTMLMotionProps<'div'> {
  surface?: Surface
  radius?: Radius
  padding?: Padding
  elevated?: boolean
  bordered?: boolean
}

const surfaceClass: Record<Surface, string> = {
  surface: 'bg-bg-surface text-ink',
  sunken: 'bg-bg-sunken text-ink',
  muted: 'bg-bg-muted text-ink',
  dark: 'bg-[linear-gradient(145deg,#2C2E36,#0F1013)] text-white',
}

const radiusClass: Record<Radius, string> = {
  pill: 'rounded-full',
  sm: 'rounded-[12px]',
  md: 'rounded-[16px]',
  lg: 'rounded-[24px]',
}

const paddingClass: Record<Padding, string> = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-9',
}

export function Card({
  surface = 'surface',
  radius = 'lg',
  padding = 'lg',
  elevated = false,
  bordered = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <motion.div
      className={cn(
        surfaceClass[surface],
        radiusClass[radius],
        paddingClass[padding],
        bordered && surface !== 'dark' && 'border border-line',
        elevated && 'shadow-float',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

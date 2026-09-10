import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'success'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant
  size?: Size
  pill?: boolean
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-ink text-white hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-18px_rgba(20,22,28,0.9)]',
  secondary: 'bg-bg-surface text-ink border border-line hover:border-ink',
  ghost: 'bg-transparent text-ink-3 hover:text-ink',
  success: 'bg-green-bg text-green',
}

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-[22px] py-[14px] text-[15px]',
  lg: 'px-7 py-4 text-[15px]',
}

const sizeRadiusClass: Record<Size, string> = {
  sm: 'rounded-[12px]',
  md: 'rounded-[14px]',
  lg: 'rounded-[16px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-[transform,box-shadow,border-color,color] duration-150 ease-out cursor-pointer',
        variantClass[variant],
        sizeClass[size],
        pill ? 'rounded-full' : sizeRadiusClass[size],
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

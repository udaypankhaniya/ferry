import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

// Token-driven button. The blue accent is interaction-only (primary), so it
// never collides with the trust hues (green/amber). All interaction states
// (hover/focus-visible/active/disabled) are covered; focus ring is the global
// :focus-visible baseline plus per-variant where useful.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-sm font-medium select-none whitespace-nowrap ' +
    'transition-colors duration-[120ms] cursor-pointer ' +
    'disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent',
        secondary:
          'bg-bg-elevated text-text-primary border border-border-hairline hover:border-border-strong',
        ghost: 'bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12px]',
        md: 'h-8 px-3 text-[13px]',
        lg: 'h-9 px-4 text-[13px]',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size={size === 'sm' ? 12 : 14} />}
      {children}
    </button>
  )
})

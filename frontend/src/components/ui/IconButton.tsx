import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

// Square, icon-only button. `label` is REQUIRED → enforces aria-label + title
// so icon-only controls are never inaccessible.
export const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-sm shrink-0 cursor-pointer ' +
    'transition-colors duration-[120ms] disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        ghost: 'bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
        solid: 'bg-bg-elevated text-text-primary border border-border-hairline hover:border-border-strong',
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
      },
      size: { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  }
)

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>,
    VariantProps<typeof iconButtonVariants> {
  label: string
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant, size, label, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  )
})

import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

// Small status pill. Tinted background (token + low alpha) with matching text —
// readable in both themes without per-theme overrides.
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-bg-elevated text-text-secondary',
        info: 'bg-info/15 text-info',
        success: 'bg-local-safe/15 text-local-safe',
        warning: 'bg-cloud-caution/15 text-cloud-caution',
        danger: 'bg-danger/15 text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

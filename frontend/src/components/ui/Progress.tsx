import { cn } from '../../lib/cn'

// Determinate progress bar. Width is a genuinely computed value → inline style
// is the correct exception to the no-inline-styles rule. Accent-filled.
export function Progress({
  value,
  className,
  tone = 'accent',
}: {
  value: number // 0–100
  className?: string
  tone?: 'accent' | 'danger' | 'success'
}) {
  const pct = Math.max(0, Math.min(100, value))
  const fill = tone === 'danger' ? 'bg-danger' : tone === 'success' ? 'bg-local-safe' : 'bg-accent'
  return (
    <div
      className={cn('h-1 w-full overflow-hidden rounded-full bg-bg-elevated', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-[180ms]', fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}

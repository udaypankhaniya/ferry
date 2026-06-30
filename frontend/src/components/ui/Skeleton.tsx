import { cn } from '../../lib/cn'

// Loading placeholder. Pulse is disabled automatically under
// prefers-reduced-motion (global rule neutralizes animation duration).
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('animate-pulse rounded-sm bg-bg-elevated', className)} style={style} aria-hidden="true" />
}

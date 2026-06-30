import { cn } from '../../lib/cn'

// Designed empty/zero state: optional icon, title, description, optional action.
// Use for "no hosts", "empty directory", "no history", etc. — never a blank pane.
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {icon && <div className="text-text-tertiary [&>svg]:h-7 [&>svg]:w-7">{icon}</div>}
      <div className="text-[13px] font-medium text-text-secondary">{title}</div>
      {description && <div className="max-w-[40ch] text-[12px] leading-relaxed text-text-tertiary">{description}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

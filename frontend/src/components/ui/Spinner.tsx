import { cn } from '../../lib/cn'

// Inline loading indicator. Inherits currentColor so it matches its context
// (e.g. inside a button it takes the button's text color).
export function Spinner({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

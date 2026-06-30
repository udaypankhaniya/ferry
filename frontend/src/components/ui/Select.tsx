import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

// Native <select> styled to match Input. Native keeps OS-correct keyboard and
// option rendering (a Radix Select is overkill here and heavier). A custom
// chevron is layered via a wrapper so we don't fight the native arrow.
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref
) {
  return (
    <div className="relative inline-flex w-full">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-8 w-full appearance-none rounded-sm bg-bg-elevated border pl-2.5 pr-7 text-[13px] text-text-primary',
          'outline-none transition-colors duration-[120ms] cursor-pointer',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          invalid
            ? 'border-danger focus-visible:border-danger'
            : 'border-border-hairline hover:border-border-strong focus-visible:border-accent',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary"
        width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
})

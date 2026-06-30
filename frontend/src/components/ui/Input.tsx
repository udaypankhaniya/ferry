import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

// Text input. Focus shows the global :focus-visible ring; border also shifts to
// accent on focus for a VS-like field. `invalid` flips the border to danger.
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-8 w-full rounded-sm bg-bg-elevated border px-2.5 text-[13px] text-text-primary',
        'placeholder:text-text-tertiary outline-none transition-colors duration-[120ms]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        invalid
          ? 'border-danger focus-visible:border-danger'
          : 'border-border-hairline hover:border-border-strong focus-visible:border-accent',
        className
      )}
      {...props}
    />
  )
})

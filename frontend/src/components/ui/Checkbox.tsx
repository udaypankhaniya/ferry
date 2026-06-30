import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

// Native checkbox tinted with the accent (accent-color). Native = correct
// keyboard + screen-reader behavior for free. Pair with a <label> for a hit
// target; `label` prop renders an inline labeled control.
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, id, ...props },
  ref
) {
  const input = (
    <input
      ref={ref}
      type="checkbox"
      id={id}
      className={cn(
        'h-3.5 w-3.5 shrink-0 cursor-pointer rounded-[3px] disabled:opacity-50 disabled:cursor-not-allowed',
        '[accent-color:var(--color-accent)]',
        className
      )}
      {...props}
    />
  )
  if (!label) return input
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer text-[13px] text-text-primary select-none">
      {input}
      {label}
    </label>
  )
})

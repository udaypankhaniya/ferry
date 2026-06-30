import { useId } from 'react'
import { cn } from '../../lib/cn'

// Label + control + optional hint/error, wired with a shared id so the label's
// htmlFor matches the control (accessible forms). Render-prop passes the id down.
export interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (id: string) => React.ReactNode
}

export function FormField({ label, hint, error, required, className, children }: FormFieldProps) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-[12px] font-medium text-text-secondary">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children(id)}
      {error ? (
        <span className="text-[11px] text-danger">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-text-tertiary">{hint}</span>
      ) : null}
    </div>
  )
}

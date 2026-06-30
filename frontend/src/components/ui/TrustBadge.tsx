import { cn } from '../../lib/cn'
import type { AIProvider } from '../../types'

// THE trust signal — one component used in the title bar, status bar, and AI
// panel header so they always agree. Green = local, amber = cloud. Uses the
// trust hues directly (text + dot), never the blue accent. Color is paired with
// a text label so it's not the only signal (a11y).
export type TrustKind = 'local' | 'cloud'

export function providerTrust(p: AIProvider): { kind: TrustKind; label: string } {
  if (p === 'ollama') return { kind: 'local', label: 'Ollama · local' }
  if (p === 'anthropic') return { kind: 'cloud', label: 'Claude · cloud' }
  return { kind: 'cloud', label: 'OpenAI · cloud' }
}

export function TrustBadge({
  provider,
  className,
  bordered = false,
}: {
  provider: AIProvider
  className?: string
  bordered?: boolean
}) {
  const { kind, label } = providerTrust(provider)
  const hue = kind === 'local' ? 'text-local-safe' : 'text-cloud-caution'
  const dot = kind === 'local' ? 'bg-local-safe' : 'bg-cloud-caution'
  const glow = kind === 'local'
    ? 'shadow-[0_0_8px_rgba(16,185,129,0.45)]'
    : 'shadow-[0_0_8px_rgba(245,158,11,0.45)]'
  const pill = kind === 'local'
    ? 'border-local-safe/20 bg-local-safe/10'
    : 'border-cloud-caution/20 bg-cloud-caution/10'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-medium leading-none',
        hue,
        bordered && cn('rounded-full border px-2 py-1', pill),
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot, glow)} />
      {label}
    </span>
  )
}

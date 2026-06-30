import { Activity } from 'lucide-react'
import { useAIStore } from '../../stores/aiStore'
import { useSiteStore } from '../../stores/siteStore'
import { useTransferStore } from '../../stores/transferStore'
import { TrustBadge } from '../ui'
import { cn } from '../../lib/cn'

export function StatusBar() {
  const { activeSite, connectionState } = useSiteStore()
  const { queue } = useTransferStore()
  const { provider } = useAIStore()

  const active = queue.filter((t) => t.status === 'active').length
  const failed = queue.filter((t) => t.status === 'failed').length

  const connColor =
    connectionState === 'connected' ? 'text-local-safe'
      : connectionState === 'connecting' ? 'text-cloud-caution'
        : connectionState === 'error' ? 'text-danger'
          : 'text-text-tertiary'

  const connDot =
    connectionState === 'connected' ? 'bg-local-safe shadow-[0_0_8px_rgba(16,185,129,0.45)]'
      : connectionState === 'connecting' ? 'bg-cloud-caution animate-pulse'
        : connectionState === 'error' ? 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.45)]'
          : 'bg-text-tertiary/40'

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-9 shrink-0 select-none items-center rounded-xl border border-border-hairline bg-bg-surface shadow-(--shadow-panel) px-4 text-[11px]"
    >
      {/* connection */}
      <span className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 font-medium', connColor)}>
        <span className={cn('inline-block h-2 w-2 rounded-full', connDot)} />
        {activeSite ? (
          <span className="font-mono text-[11px] tracking-wide text-text-primary">
            {activeSite.username}@{activeSite.host}
          </span>
        ) : (
          'no connection'
        )}
      </span>

      <span className="mx-2 h-3.5 w-px bg-border-strong/60" />

      {/* transfers */}
      <span className="flex items-center gap-1.5 px-2 text-text-secondary">
        {active > 0 && (
          <>
            <Activity size={10} className="text-accent" />
            <span className="text-accent">{active} transfer{active > 1 ? 's' : ''}</span>
          </>
        )}
        {failed > 0 && (
          <span className={cn('text-danger', active > 0 && 'ml-1')}>
            {failed} failed
          </span>
        )}
        {active === 0 && failed === 0 && (
          <span className="text-text-tertiary">no transfers</span>
        )}
      </span>

      <span className="flex-1" />

      {activeSite && (
        <>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            {activeSite.protocol} / SSH
          </span>
          <span className="mx-3 h-3.5 w-px bg-border-strong/60" />
        </>
      )}

      <TrustBadge provider={provider} bordered />
    </div>
  )
}

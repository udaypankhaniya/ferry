import { useState, useEffect } from 'react'
import { MoreHorizontal, Plus, Server, AlertCircle, Loader2, Search } from 'lucide-react'
import { useSiteStore } from '../../stores/siteStore'
import { useAppStore } from '../../stores/appStore'
import { AddSiteModal } from './AddSiteModal'
import { CredentialModal } from './CredentialModal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { getSites, createSite, updateSite, deleteSite } from '../../lib/siteService'
import { hasCredential, storeCredential, connect, disconnect, listDir } from '../../lib/sshService'
import { homeDir, listLocalDir } from '../../lib/localfs'
import { getLastLocalPath } from '../../lib/configService'
import { Input, IconButton, Button, EmptyState, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, toast } from '../ui'
import { cn } from '../../lib/cn'
import type { Site, ConnectionState } from '../../types'

function StatusDot({ active, state }: { active: boolean; state: ConnectionState }) {
  if (!active) return <span className="h-2 w-2 shrink-0 rounded-full bg-border-strong" />
  if (state === 'connected') return <span className="h-2 w-2 shrink-0 rounded-full bg-local-safe shadow-[0_0_8px_rgba(16,185,129,0.45)]" />
  if (state === 'connecting') return <span className="h-2 w-2 shrink-0 rounded-full bg-cloud-caution animate-pulse" />
  if (state === 'error') return <span className="h-2 w-2 shrink-0 rounded-full bg-danger shadow-[0_0_8px_rgba(239,68,68,0.45)]" />
  return <span className="h-2 w-2 shrink-0 rounded-full bg-border-strong" />
}

function SiteRow({ site, active, onConnect, onEdit, onDelete }: {
  site: Site; active: boolean
  onConnect: () => void; onEdit: () => void; onDelete: () => void
}) {
  const { connectionState } = useSiteStore()

  return (
    <div className="my-0.5">
      <div
        onClick={onConnect}
        className={cn(
          'group flex items-center gap-2.5 rounded-md py-1.5 pl-2.5 pr-1.5 cursor-pointer select-none transition-colors',
          active
            ? 'bg-accent/10 text-accent shadow-[inset_2px_0_0_var(--color-accent)]'
            : 'hover:bg-bg-hover'
        )}
      >
        <StatusDot active={active} state={connectionState} />
        <span className="min-w-0 flex-1">
          <div className={cn(
            'truncate text-[13px] font-medium',
            active ? 'text-text-primary' : 'text-text-primary'
          )}>
            {site.name || site.host}
          </div>
          <div className="truncate text-[11px] text-text-tertiary">
            {site.host}:{site.port} · {site.protocol.toUpperCase()}
          </div>
        </span>
        <Menu>
          <MenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              aria-label="Host actions"
              className="shrink-0 rounded-sm p-0.5 text-text-tertiary opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-text-primary cursor-pointer transition-opacity"
            >
              <MoreHorizontal size={14} />
            </button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => onConnect()}>{active ? 'Disconnect' : 'Connect'}</MenuItem>
            <MenuItem onSelect={() => onEdit()}>Edit</MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={() => onDelete()}>Delete</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </div>
  )
}

export function SiteManager() {
  const { sites, activeSite, connectionState, errorMessage, setSites, setActiveSite, setConnectionState, setLocalPane, setRemotePane } = useSiteStore()
  const { siteRailCollapsed, setAIPanelCollapsed } = useAppStore()

  function explainError() {
    if (!errorMessage || !activeSite) return
    setAIPanelCollapsed(false)
    window.dispatchEvent(new CustomEvent('ferry:ask-ai', {
      detail: `Connecting to ${activeSite.name || activeSite.host} (${activeSite.host}:${activeSite.port}, ${activeSite.protocol.toUpperCase()}) failed with:\n${errorMessage}`,
    }))
  }

  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editSite, setEditSite] = useState<Site | null>(null)
  const [credSite, setCredSite] = useState<Site | null>(null)
  const [deletePending, setDeletePending] = useState<Site | null>(null)

  useEffect(() => {
    getSites().then((list) => setSites(list || [])).catch(console.error)
  }, [setSites])

  useEffect(() => {
    const onConnect = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      const site = sites.find((s) => s.id === id)
      if (site) void handleConnect(site)
    }
    const onDisconnect = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      const site = sites.find((s) => s.id === id)
      if (site && activeSite?.id === id) void handleConnect(site)
    }
    window.addEventListener('ferry:connect', onConnect)
    window.addEventListener('ferry:disconnect', onDisconnect)
    return () => {
      window.removeEventListener('ferry:connect', onConnect)
      window.removeEventListener('ferry:disconnect', onDisconnect)
    }
  })

  useEffect(() => {
    Promise.all([homeDir(), getLastLocalPath().catch(() => '')]).then(([home, saved]) => {
      const target = saved || home
      listLocalDir(target)
        .then((entries) => setLocalPane({ path: target, entries: entries || [], loading: false }))
        .catch(() =>
          listLocalDir(home)
            .then((entries) => setLocalPane({ path: home, entries: entries || [], loading: false }))
            .catch(() => setLocalPane({ loading: false }))
        )
    }).catch(console.error)
  }, [setLocalPane])

  const filtered = sites.filter(
    (s) => s.name?.toLowerCase().includes(search.toLowerCase()) || s.host.toLowerCase().includes(search.toLowerCase())
  )
  const groups = filtered.reduce<Record<string, Site[]>>((acc, s) => {
    const g = s.group || 'Hosts'
    acc[g] = [...(acc[g] ?? []), s]
    return acc
  }, {})

  async function handleConnect(site: Site) {
    if (activeSite?.id === site.id && connectionState === 'connected') {
      setConnectionState('idle')
      setActiveSite(null)
      setRemotePane({ path: '/', entries: [], loading: false })
      await disconnect(site.id).catch(console.error)
      return
    }
    setActiveSite(site)
    setConnectionState('connecting')
    const hasCred = await hasCredential(site.id).catch(() => false)
    if (!hasCred && site.authType !== 'agent') {
      setCredSite(site)
      return
    }
    await doConnect(site)
  }

  async function doConnect(site: Site, secret?: string) {
    setCredSite(null)
    if (secret && site.authType !== 'agent') {
      await storeCredential(site.id, secret).catch(console.error)
    }
    try {
      setConnectionState('connecting')
      await connect(site.id)
      setConnectionState('connected')
      toast(`Connected · ${site.name || site.host}`, 'success')
      const entries = await listDir(site.id, '/').catch(() => [])
      setRemotePane({ path: '/', entries: entries || [], loading: false })
    } catch (err: unknown) {
      setConnectionState('error', String(err))
    }
  }

  async function handleAddSite(data: Omit<Site, 'id'>, secret?: string) {
    const site: Site = { ...data, id: crypto.randomUUID(), name: data.name || data.host }
    await createSite(site).catch(console.error)
    if (secret && data.authType !== 'agent') {
      await storeCredential(site.id, secret).catch(console.error)
    }
    setSites([...sites, site])
    setShowAdd(false)
  }

  async function handleDeleteSite() {
    if (!deletePending) return
    await deleteSite(deletePending.id).catch(console.error)
    setSites(sites.filter((s) => s.id !== deletePending.id))
    if (activeSite?.id === deletePending.id) setActiveSite(null)
    setDeletePending(null)
  }

  // ── Collapsed icon rail ──
  if (siteRailCollapsed) {
    return (
      <div className="flex w-full flex-col items-center gap-1 bg-bg-surface py-2">
        <IconButton
          label="New connection"
          variant="solid"
          onClick={() => setShowAdd(true)}
          className="mb-1"
        >
          <Plus size={15} />
        </IconButton>
        {sites.map((s) => (
          <button
            key={s.id}
            title={s.name || s.host}
            onClick={() => handleConnect(s)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-sm text-[12px] font-semibold cursor-pointer transition-colors',
              activeSite?.id === s.id
                ? 'bg-accent-subtle text-accent border border-accent/20'
                : 'text-text-secondary hover:bg-bg-hover border border-transparent'
            )}
          >
            {(s.name || s.host)[0]?.toUpperCase()}
          </button>
        ))}
        <AddSiteModal open={showAdd} onSave={handleAddSite} onClose={() => setShowAdd(false)} />
        <CredentialModal
          open={!!credSite} site={credSite}
          onConnect={(s) => doConnect(credSite!, s)}
          onClose={() => { setCredSite(null); setConnectionState('idle') }}
        />
      </div>
    )
  }

  // ── Expanded sidebar ──
  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-bg-surface">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-hairline">
        <span className="text-[13px] font-semibold tracking-tight text-text-primary">Hosts</span>
        <IconButton label="New connection" size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} />
        </IconButton>
      </div>

      {/* search */}
      <div className="border-b border-border-hairline bg-bg-inset/40 p-2.5">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter hosts"
            className="h-8 w-full pl-8 text-[12px]"
          />
        </div>
      </div>

      {/* site list */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groups).map(([group, groupSites]) => (
          <div key={group} className="mb-4 last:mb-0">
            <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {group}
            </div>
            {groupSites.map((site) => (
              <SiteRow
                key={site.id}
                site={site}
                active={activeSite?.id === site.id}
                onConnect={() => handleConnect(site)}
                onEdit={() => setEditSite(site)}
                onDelete={() => setDeletePending(site)}
              />
            ))}
          </div>
        ))}
        {sites.length === 0 && (
          <EmptyState
            icon={<Server size={20} />}
            title="No hosts yet"
            description="Add your first SSH or SFTP connection."
            action={
              <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
                <Plus size={13} />Add host
              </Button>
            }
          />
        )}
      </div>

      {/* connection status footer */}
      {activeSite && connectionState === 'error' && (
        <div className="border-t border-border-hairline bg-danger-dim px-3 py-2 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] text-danger font-medium">
            <AlertCircle size={11} />
            Connection failed
          </div>
          {errorMessage && (
            <div className="line-clamp-2 text-[11px] text-text-tertiary leading-relaxed">{errorMessage}</div>
          )}
          <button
            onClick={explainError}
            className="self-start text-[11px] text-info hover:underline cursor-pointer"
          >
            Ask AI to explain
          </button>
        </div>
      )}
      {activeSite && connectionState !== 'error' && (
        <div className={cn(
          'flex items-center gap-1.5 border-t border-border-hairline px-3 py-1.5 text-[11px]',
          connectionState === 'connected' ? 'text-local-safe' : 'text-text-tertiary'
        )}>
          {connectionState === 'connecting'
            ? <Loader2 size={10} className="animate-spin" />
            : <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          }
          {connectionState === 'connected'
            ? `Connected · ${activeSite.host}`
            : connectionState === 'connecting'
              ? 'Connecting…'
              : ''}
        </div>
      )}

      <AddSiteModal open={showAdd} onSave={handleAddSite} onClose={() => setShowAdd(false)} />
      <AddSiteModal
        open={!!editSite}
        initial={editSite ?? undefined}
        onSave={async (data, secret) => {
          if (!editSite) return
          const updated: Site = { ...editSite, ...data }
          await updateSite(updated).catch(console.error)
          if (secret && data.authType !== 'agent') {
            await storeCredential(updated.id, secret).catch(console.error)
          }
          setSites(sites.map((s) => s.id === updated.id ? updated : s))
          setEditSite(null)
        }}
        onClose={() => setEditSite(null)}
      />
      <CredentialModal
        open={!!credSite} site={credSite}
        onConnect={(s) => doConnect(credSite!, s)}
        onClose={() => { setCredSite(null); setConnectionState('idle') }}
      />
      <ConfirmDialog
        open={!!deletePending}
        title="Delete connection"
        message={`Remove "${deletePending?.name || deletePending?.host}"? Credentials remain in the OS keychain.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteSite}
        onCancel={() => setDeletePending(null)}
      />
    </div>
  )
}

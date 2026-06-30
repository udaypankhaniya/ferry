import { useRef, useEffect, useState } from 'react'
import { useSiteStore } from '../../stores/siteStore'
import { useTransferStore } from '../../stores/transferStore'
import { PaneView } from './PaneView'
import { ResizeDivider } from '../common/ResizeDivider'
import { listLocalDir, mkdirLocal, removeLocal, renameLocal } from '../../lib/localfs'
import { listDir, mkdirRemote, removeFile, renameFile, uploadFile, downloadFile } from '../../lib/sshService'
import { setLastLocalPath } from '../../lib/configService'
import type { FileEntry, TransferItem } from '../../types'

export function FileBrowser() {
  const {
    localPane, remotePane, activeSite,
    setLocalPane, setRemotePane, toggleLocalSelected, toggleRemoteSelected,
  } = useSiteStore()
  const { addItem, updateItem, panelOpen, togglePanel } = useTransferStore()
  const [leftRatio, setLeftRatio] = useState(0.5)
  const panesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!localPane.path || localPane.path === '/') return
    const t = setTimeout(() => { void setLastLocalPath(localPane.path) }, 400)
    return () => clearTimeout(t)
  }, [localPane.path])

  useEffect(() => {
    if (!localPane.path || !localPane.loading) return
    listLocalDir(localPane.path)
      .then((entries) => setLocalPane({ entries: entries || [], loading: false }))
      .catch(() => setLocalPane({ entries: [], loading: false }))
  }, [localPane.path, localPane.loading, setLocalPane])

  useEffect(() => {
    if (!remotePane.loading || !remotePane.path || !activeSite) return
    listDir(activeSite.id, remotePane.path)
      .then((entries) => setRemotePane({ entries: entries || [], loading: false }))
      .catch(() => setRemotePane({ entries: [], loading: false }))
  }, [remotePane.path, remotePane.loading, activeSite?.id, setRemotePane])

  function reloadLocal() { setLocalPane({ entries: [], loading: true }) }
  function reloadRemote() { setRemotePane({ entries: [], loading: true }) }

  async function handleLocalDelete(entry: FileEntry) {
    await removeLocal(entry.path).catch(console.error)
    reloadLocal()
  }
  async function handleLocalRename(entry: FileEntry, newName: string) {
    const dir = localPane.path.endsWith('/') ? localPane.path : localPane.path + '/'
    await renameLocal(entry.path, dir + newName).catch(console.error)
    reloadLocal()
  }
  async function handleLocalMkdir(name: string) {
    const dir = localPane.path.endsWith('/') ? localPane.path : localPane.path + '/'
    await mkdirLocal(dir + name).catch(console.error)
    reloadLocal()
  }

  async function handleRemoteDelete(entry: FileEntry) {
    if (!activeSite) return
    await removeFile(activeSite.id, entry.path).catch(console.error)
    reloadRemote()
  }
  async function handleRemoteRename(entry: FileEntry, newName: string) {
    if (!activeSite) return
    const dir = remotePane.path.endsWith('/') ? remotePane.path : remotePane.path + '/'
    await renameFile(activeSite.id, entry.path, dir + newName).catch(console.error)
    reloadRemote()
  }
  async function handleRemoteMkdir(name: string) {
    if (!activeSite) return
    const dir = remotePane.path.endsWith('/') ? remotePane.path : remotePane.path + '/'
    await mkdirRemote(activeSite.id, dir + name).catch(console.error)
    reloadRemote()
  }

  // Run (or re-run) a transfer using its stored src/dest paths. Shared by the
  // initial up/download and the retry flow so a failed item can actually restart.
  function runTransfer(item: Pick<TransferItem, 'id' | 'siteId' | 'direction' | 'srcPath' | 'destPath'>) {
    if (!panelOpen) togglePanel()
    const op = item.direction === 'upload'
      ? uploadFile(item.id, item.siteId, item.srcPath, item.destPath)
      : downloadFile(item.id, item.siteId, item.srcPath, item.destPath)
    op
      .then(() => {
        updateItem(item.id, { status: 'done', progress: 100, speedBps: 0 })
        item.direction === 'upload' ? reloadRemote() : reloadLocal()
      })
      .catch((err: unknown) => updateItem(item.id, { status: 'failed', error: String(err) }))
  }

  function handleUpload(entry: FileEntry) {
    if (!activeSite) return
    const id = crypto.randomUUID()
    const remoteDir = remotePane.path.endsWith('/') ? remotePane.path : remotePane.path + '/'
    const remoteDest = remoteDir + entry.name
    addItem({ id, siteId: activeSite.id, filename: entry.name, direction: 'upload', srcPath: entry.path, destPath: remoteDest, progress: 0, bytesTotal: entry.size, bytesDone: 0, speedBps: 0, etaSecs: 0, status: 'active' })
    runTransfer({ id, siteId: activeSite.id, direction: 'upload', srcPath: entry.path, destPath: remoteDest })
  }

  function handleDownload(entry: FileEntry) {
    if (!activeSite) return
    const id = crypto.randomUUID()
    const localDir = localPane.path.endsWith('/') ? localPane.path : localPane.path + '/'
    const localDest = localDir + entry.name
    addItem({ id, siteId: activeSite.id, filename: entry.name, direction: 'download', srcPath: entry.path, destPath: localDest, progress: 0, bytesTotal: entry.size, bytesDone: 0, speedBps: 0, etaSecs: 0, status: 'active' })
    runTransfer({ id, siteId: activeSite.id, direction: 'download', srcPath: entry.path, destPath: localDest })
  }

  // Retry bridge — TransferQueue's retry button dispatches this; we re-run using
  // the item's stored paths (queue is read fresh so the latest item is used).
  useEffect(() => {
    const onRetry = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      const item = useTransferStore.getState().queue.find((t) => t.id === id)
      if (!item) return
      updateItem(id, { status: 'active', progress: 0, bytesDone: 0, speedBps: 0, etaSecs: 0, error: undefined })
      runTransfer(item)
    }
    window.addEventListener('ferry:retry-transfer', onRetry)
    return () => window.removeEventListener('ferry:retry-transfer', onRetry)
  })

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* dual pane — each pane is self-contained (header · breadcrumb · list) */}
      <div ref={panesRef} className="flex flex-1 min-h-0">
        <div className="flex min-w-0" style={{ flex: leftRatio }}>
          <PaneView
            label="local"
            path={localPane.path}
            entries={localPane.entries}
            loading={localPane.loading}
            selected={localPane.selected}
            onNavigate={(p) => setLocalPane({ path: p, entries: [], loading: true })}
            onToggleSelect={toggleLocalSelected}
            onDoubleClick={(entry) => { if (entry.isDir) setLocalPane({ path: entry.path, entries: [], loading: true }) }}
            onDelete={handleLocalDelete}
            onRename={handleLocalRename}
            onMkdir={handleLocalMkdir}
            onTransfer={handleUpload}
            onRefresh={reloadLocal}
          />
        </div>

        <ResizeDivider
          direction="vertical"
          onDelta={(dx) => {
            const total = panesRef.current?.offsetWidth ?? 0
            if (!total) return
            setLeftRatio((r) => Math.max(0.2, Math.min(0.8, r + dx / total)))
          }}
        />

        <div className="flex min-w-0" style={{ flex: 1 - leftRatio }}>
          <PaneView
            label="remote"
            path={remotePane.path}
            entries={remotePane.entries}
            loading={remotePane.loading}
            selected={remotePane.selected}
            onNavigate={(p) => setRemotePane({ path: p, entries: [], loading: true })}
            onToggleSelect={toggleRemoteSelected}
            onDoubleClick={(entry) => { if (entry.isDir) setRemotePane({ path: entry.path, entries: [], loading: true }) }}
            onDelete={handleRemoteDelete}
            onRename={handleRemoteRename}
            onMkdir={handleRemoteMkdir}
            onTransfer={handleDownload}
            onRefresh={reloadRemote}
          />
        </div>
      </div>
    </div>
  )
}

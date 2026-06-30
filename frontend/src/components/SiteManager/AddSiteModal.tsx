import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Modal } from '../common/Modal'
import { FormField, Input, Select, Button, IconButton } from '../ui'
import type { Site } from '../../types'

interface Props {
  open: boolean
  initial?: Partial<Site>
  onSave: (site: Omit<Site, 'id'>, secret?: string) => void
  onClose: () => void
}

const DEFAULT: Omit<Site, 'id'> = {
  name: '', host: '', port: 22, protocol: 'sftp', username: '', authType: 'password', keyPath: '', group: '',
}

export function AddSiteModal({ open, initial, onSave, onClose }: Props) {
  const [form, setForm] = useState<Omit<Site, 'id'>>({ ...DEFAULT, ...initial })
  const [secret, setSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setError('')
  }

  function handleSave() {
    if (!form.host.trim()) return setError('Host is required.')
    if (!form.username.trim()) return setError('Username is required.')
    onSave(form, secret.trim() || undefined)
    setForm({ ...DEFAULT })
    setSecret('')
  }

  const needsSecret = form.authType === 'password' || form.authType === 'key'
  const secretLabel = form.authType === 'key' ? 'Key passphrase' : 'Password'
  const secretPlaceholder = form.authType === 'key'
    ? 'Passphrase (leave blank if key has none)'
    : 'Saved to keychain — leave blank to prompt on connect'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit connection' : 'New connection'}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-sm bg-danger/15 px-2.5 py-1.5 text-[12px] text-danger">{error}</div>
        )}

        <FormField label="Label">
          {(id) => <Input id={id} placeholder="My Server (optional)" value={form.name} onChange={(e) => set('name', e.target.value)} />}
        </FormField>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <FormField label="Host" required>
            {(id) => <Input id={id} placeholder="192.168.1.1 or hostname" value={form.host} onChange={(e) => set('host', e.target.value)} />}
          </FormField>
          <FormField label="Port">
            {(id) => <Input id={id} type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} className="w-20" />}
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FormField label="Username" required>
            {(id) => <Input id={id} placeholder="root" value={form.username} onChange={(e) => set('username', e.target.value)} />}
          </FormField>
          <FormField label="Protocol">
            {(id) => (
              <Select id={id} value={form.protocol} onChange={(e) => set('protocol', e.target.value as Site['protocol'])}>
                <option value="sftp">SFTP</option>
                <option value="ssh">SSH (terminal only)</option>
                <option value="ftp">FTP</option>
              </Select>
            )}
          </FormField>
        </div>

        <FormField label="Authentication">
          {(id) => (
            <Select id={id} value={form.authType} onChange={(e) => set('authType', e.target.value as Site['authType'])}>
              <option value="password">Password</option>
              <option value="key">Private key file</option>
              <option value="agent">SSH agent</option>
            </Select>
          )}
        </FormField>

        {form.authType === 'key' && (
          <FormField label="Key file path">
            {(id) => <Input id={id} placeholder="~/.ssh/id_rsa" value={form.keyPath ?? ''} onChange={(e) => set('keyPath', e.target.value)} className="font-mono" />}
          </FormField>
        )}

        {needsSecret && (
          <FormField label={secretLabel} hint="Stored in OS keychain — never in plaintext.">
            {(id) => (
              <div className="flex gap-1.5">
                <Input id={id} type={showSecret ? 'text' : 'password'} placeholder={secretPlaceholder} value={secret} onChange={(e) => setSecret(e.target.value)} className="flex-1" />
                <IconButton label={showSecret ? 'Hide' : 'Show'} variant="solid" type="button" onClick={() => setShowSecret((s) => !s)}>
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </IconButton>
              </div>
            )}
          </FormField>
        )}

        <FormField label="Group">
          {(id) => <Input id={id} placeholder="Production, Staging… (optional)" value={form.group ?? ''} onChange={(e) => set('group', e.target.value)} />}
        </FormField>
      </div>
    </Modal>
  )
}

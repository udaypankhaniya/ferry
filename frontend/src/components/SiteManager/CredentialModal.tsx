import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Modal } from '../common/Modal'
import { FormField, Input, Button, IconButton } from '../ui'
import type { Site } from '../../types'

interface Props {
  open: boolean
  site: Site | null
  onConnect: (secret: string) => void
  onClose: () => void
}

export function CredentialModal({ open, site, onConnect, onClose }: Props) {
  const [secret, setSecret] = useState('')
  const [show, setShow] = useState(false)

  if (!site) return null

  function handleConnect() {
    onConnect(secret)
    setSecret('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Connect to ${site.name || site.host}`}
      width={360}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConnect}>Connect</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="text-[12px] text-text-secondary">
          <span className="text-text-tertiary">{site.username}@</span>
          <span className="font-mono">{site.host}:{site.port}</span>
          <span className="ml-2 text-[11px] text-text-tertiary">{site.protocol.toUpperCase()}</span>
        </div>

        {site.authType === 'password' ? (
          <FormField label="Password" required>
            {(id) => (
              <div className="flex gap-1.5">
                <Input
                  id={id}
                  type={show ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  autoFocus
                  className="flex-1"
                />
                <IconButton label={show ? 'Hide password' : 'Show password'} variant="solid" onClick={() => setShow((s) => !s)}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </IconButton>
              </div>
            )}
          </FormField>
        ) : site.authType === 'key' ? (
          <FormField label="Private key path" required>
            {(id) => (
              <Input id={id} placeholder="~/.ssh/id_rsa" value={secret} onChange={(e) => setSecret(e.target.value)} autoFocus className="font-mono" />
            )}
          </FormField>
        ) : (
          <div className="py-2 text-[12px] text-text-secondary">Using SSH agent — no credential needed.</div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-local-safe" />
          Credentials are stored in the OS keychain — never in plaintext files.
        </div>
      </div>
    </Modal>
  )
}

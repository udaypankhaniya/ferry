import { Modal } from './Modal'
import { Button } from '../ui'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onCancel }: Props) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width={360}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-text-secondary">{message}</p>
    </Modal>
  )
}

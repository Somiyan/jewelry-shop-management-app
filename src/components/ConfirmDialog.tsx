import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export interface ConfirmDialogProps {
  open: boolean
  /** Ask the question: "Delete this product?" */
  title: string
  /** One line on what happens, including anything irreversible. */
  message?: ReactNode
  /** Says what happens: "Delete product", not "OK". */
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` for destructive actions. Default `default`. */
  tone?: 'default' | 'danger'
  /** Spinner on the confirm button while the action runs. */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** The app's replacement for `window.confirm`. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onCancel}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message ? (
        <p className="text-sm text-ink-muted">{message}</p>
      ) : (
        <p className="text-sm text-ink-muted">This cannot be undone.</p>
      )}
    </Modal>
  )
}

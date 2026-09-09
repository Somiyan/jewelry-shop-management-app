import { useState } from 'react'
import type { BelowValueWarning, SalesPolicy } from '../../api/sales'
import { AlertIcon, Button, FigureStack, Modal, Textarea } from '../../components'

interface Props {
  open: boolean
  onClose: () => void
  warnings: BelowValueWarning[]
  policy: SalesPolicy | null
  submitting: boolean
  /** Set after a checkout attempt comes back with a reason-required 400. */
  serverError?: string | null
  onConfirm: (reason: string) => void
}

/**
 * The below-current-value confirmation gate. Shown proactively before
 * checkout is even called (see `ReviewStep`), and reused if the server still
 * rejects with a 409/403 — e.g. a rate changed between preview and submit.
 *
 * Every flagged line is listed with its own current value, selling price and
 * difference (per item 13 of the brief) — never a single rolled-up total.
 */
export default function BelowValueApprovalModal({
  open,
  onClose,
  warnings,
  policy,
  submitting,
  serverError,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  // Fail-safe when the policy hasn't loaded: treat approval as required and
  // as something this user cannot self-grant, rather than silently letting
  // a below-value sale through.
  const allowConfirmation = policy?.allowBelowCurrentPriceSale ?? false
  const canApprove = policy?.canApproveBelowValueSale ?? false
  const reasonRequired = !allowConfirmation
  const needsManagerApproval = reasonRequired && !canApprove

  const reasonError = touched && reasonRequired && !reason.trim() ? 'A reason is required for manager approval.' : undefined

  function handleClose() {
    setReason('')
    setTouched(false)
    onClose()
  }

  function handleConfirm() {
    if (reasonRequired && !reason.trim()) {
      setTouched(true)
      return
    }
    onConfirm(reason.trim())
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Selling below current value"
      description={
        warnings.length === 1
          ? '1 item in this sale is priced below its current value.'
          : `${warnings.length} items in this sale are priced below their current value.`
      }
      size="md"
      footer={
        needsManagerApproval ? (
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              {allowConfirmation ? 'Go back' : 'Cancel'}
            </Button>
            <Button onClick={handleConfirm} loading={submitting}>
              {allowConfirmation ? 'Continue anyway' : 'Approve & continue'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <ul className="divide-y divide-line rounded-panel border border-line">
          {warnings.map((warning) => (
            <li key={warning.productId} className="p-3">
              <p className="text-sm font-medium text-ink">{warning.productName}</p>
              <div className="mt-2">
                <FigureStack
                  size="sm"
                  rows={[
                    { label: 'Current value', value: warning.currentValue },
                    { label: 'Selling price', value: warning.sellingValue },
                    { label: 'Difference', value: warning.difference, tone: 'danger' },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>

        {needsManagerApproval ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm text-warning"
          >
            <AlertIcon size={16} className="mt-0.5 shrink-0" />
            <span>
              This sale needs manager approval. Ask a manager to sign in and approve it before you can
              complete this sale.
            </span>
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="below-value-reason" className="text-sm font-medium text-ink">
              Reason{reasonRequired ? '' : ' (optional)'}
            </label>
            <Textarea
              id="below-value-reason"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby={reasonError ? 'below-value-reason-error' : undefined}
              aria-invalid={reasonError ? true : undefined}
              invalid={Boolean(reasonError)}
              placeholder={
                reasonRequired
                  ? 'Why is this sale priced below current value?'
                  : 'Optional — kept on the sale record.'
              }
            />
            {reasonError && (
              <p id="below-value-reason-error" role="alert" className="text-sm text-danger">
                {reasonError}
              </p>
            )}
          </div>
        )}

        {serverError && (
          <p role="alert" className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertIcon size={16} className="mt-0.5 shrink-0" />
            {serverError}
          </p>
        )}
      </div>
    </Modal>
  )
}

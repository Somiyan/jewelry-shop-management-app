import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getReceipt, paymentMethodLabel, type Receipt } from '../api/payments'
import { Badge, Button, ChevronLeftIcon, FigureStack, PrintIcon, Skeleton, SkeletonText } from '../components'
import { extractErrorMessage, formatDateTime } from '../utils/format'

/**
 * Printable payment receipt. Deliberately rendered outside the app shell (no
 * sidebar/header) so `window.print()` prints just the receipt. The toolbar at
 * the top is hidden via `@media print`.
 */
export default function PaymentReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setReceipt(await getReceipt(id))
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto min-h-dvh w-full max-w-xl bg-canvas px-4 py-5 sm:py-8">
      <style>{'@media print { .no-print { display: none !important; } }'}</style>

      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" leftIcon={<ChevronLeftIcon size={16} />} onClick={() => navigate(-1)}>
          Back
        </Button>
        {receipt && (
          <Button leftIcon={<PrintIcon size={16} />} onClick={() => window.print()}>
            Print
          </Button>
        )}
      </div>

      {loading && (
        <div className="rounded-panel border border-line bg-surface p-5">
          <Skeleton className="h-6 w-40" />
          <SkeletonText lines={6} className="mt-4" />
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {!loading && !error && receipt && (
        <article className="rounded-panel border border-line bg-surface p-5 sm:p-6">
          <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-lg font-semibold text-ink">Payment receipt</p>
              <p className="mt-0.5 font-mono text-xs text-ink-muted">{receipt.receiptNumber}</p>
            </div>
            {receipt.voided && <Badge tone="danger">Voided</Badge>}
          </header>

          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-ink-muted">Customer</dt>
              <dd className="text-ink">{receipt.customer.name}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block sm:text-right">
              <dt className="text-ink-muted">Invoice no.</dt>
              <dd className="font-mono text-ink">{receipt.invoiceNumber}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-ink-muted">Phone</dt>
              <dd className="font-mono text-ink">{receipt.customer.phone}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block sm:text-right">
              <dt className="text-ink-muted">Payment date</dt>
              <dd className="font-mono text-ink">{formatDateTime(receipt.paymentDate)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-ink-muted">Method</dt>
              <dd className="text-ink">{paymentMethodLabel(receipt.paymentMethod)}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block sm:text-right">
              <dt className="text-ink-muted">Reference</dt>
              <dd className="font-mono text-ink">{receipt.reference || '—'}</dd>
            </div>
            {receipt.recordedBy && (
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-ink-muted">Recorded by</dt>
                <dd className="text-ink">{receipt.recordedBy}</dd>
              </div>
            )}
          </dl>

          <div className="mt-5 border-t border-line pt-4">
            <FigureStack
              rows={[
                { label: 'Previous balance', value: receipt.previousBalance },
                { label: 'Payment received', value: receipt.paymentReceived, tone: 'success' },
              ]}
              total={{ label: 'Remaining balance', value: receipt.remainingBalance }}
            />
          </div>

          {receipt.notes && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs text-ink-muted">Notes</p>
              <p className="mt-1 text-sm text-ink">{receipt.notes}</p>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-ink-muted">Thank you for your payment.</p>
        </article>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../api/client'
import { Badge, Button, Card, FigureStack, type FigureRow } from '../../components'
import { AlertIcon, CheckIcon, DownloadIcon, PrintIcon, ReceiptIcon } from '../../components/icons'
import { extractErrorMessage } from '../../utils/format'
import { invoicePaymentStatusLabel, paymentStatusTone } from '../../utils/ui'
import type { WizardState } from './state'

interface Props {
  state: WizardState
  onStartNewSale: () => void
}

export default function SuccessStep({ state, onStartNewSale }: Props) {
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

  const result = state.result
  if (!result) return null
  const { order, invoice, lifecycleWarning } = result
  const balanceDue = invoice.finalAmount - invoice.amountPaid

  // GST is broken into CGST+SGST or IGST, never shown as one flat "Tax" row,
  // to match the assay-stack figure elsewhere in the app. Older invoices
  // (recorded before billing type existed) fall back to the plain figure.
  const gstRows: FigureRow[] =
    invoice.billingType === 'GST'
      ? invoice.isInterState
        ? [{ label: 'IGST', value: invoice.igstAmount ?? 0, tone: 'muted' }]
        : [
            { label: 'CGST', value: invoice.cgstAmount ?? 0, tone: 'muted' },
            { label: 'SGST', value: invoice.sgstAmount ?? 0, tone: 'muted' },
          ]
      : invoice.billingType === 'NON_GST'
        ? [{ label: 'GST', value: 'Not applicable', tone: 'muted' }]
        : [{ label: 'Tax', value: invoice.taxAmount, tone: 'muted' }]

  async function ensurePdf(): Promise<string | null> {
    if (pdfBlobUrl) return pdfBlobUrl
    setPdfError(null)
    setPdfLoading(true)
    try {
      const response = await apiClient.get(`/invoices/generate-pdf/${invoice._id}`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      setPdfBlobUrl(url)
      return url
    } catch (err) {
      setPdfError(extractErrorMessage(err))
      return null
    } finally {
      setPdfLoading(false)
    }
  }

  async function handleDownload() {
    const url = await ensurePdf()
    if (!url) return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${invoice.invoiceNumber}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  async function handlePrint() {
    const url = await ensurePdf()
    if (!url) return
    window.open(url, '_blank')
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckIcon size={24} />
        </span>
        <div>
          <p className="text-xl font-semibold text-ink">Sale completed</p>
          <p className="mt-1 text-sm text-ink-muted">
            Order #{order._id.slice(-8)} · Invoice {invoice.invoiceNumber}
          </p>
        </div>
      </div>

      <Card className="w-full text-left">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-ink-muted">Customer</p>
            <p className="font-medium text-ink">{state.customer?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {invoice.billingType && <Badge tone="neutral">{invoice.billingType === 'GST' ? 'GST' : 'Non-GST'}</Badge>}
            <Badge tone={paymentStatusTone(invoice.paymentStatus)}>
              {invoicePaymentStatusLabel(invoice.paymentStatus)}
            </Badge>
          </div>
        </div>

        {lifecycleWarning && (
          <p
            role="status"
            className="mb-4 flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-sm text-warning"
          >
            <AlertIcon size={16} className="mt-0.5 shrink-0" />
            {lifecycleWarning}
          </p>
        )}

        <FigureStack
          rows={[
            { label: 'Subtotal', value: invoice.subtotal, tone: 'muted' },
            ...gstRows,
            { label: 'Discount', value: -invoice.discount, tone: 'muted' },
            { label: 'Amount paid', value: invoice.amountPaid, tone: 'success' },
            { label: 'Balance due', value: balanceDue, tone: balanceDue > 0 ? 'danger' : 'muted' },
          ]}
          total={{ label: 'Final amount', value: invoice.finalAmount }}
        />

        {pdfError && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            <AlertIcon size={16} className="mt-0.5 shrink-0" />
            {pdfError}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<DownloadIcon size={16} />}
            loading={pdfLoading}
            onClick={handleDownload}
          >
            Download PDF
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<PrintIcon size={16} />}
            loading={pdfLoading}
            onClick={handlePrint}
          >
            Print
          </Button>
          <Link to="/invoices" className="inline-flex">
            <Button size="sm" variant="ghost" leftIcon={<ReceiptIcon size={16} />}>
              View invoice
            </Button>
          </Link>
          <Button size="sm" variant="ghost" disabled title="No SMS/email/WhatsApp provider is configured yet">
            Send invoice (coming soon)
          </Button>
        </div>
      </Card>

      <Button onClick={onStartNewSale}>Start new sale</Button>
    </div>
  )
}

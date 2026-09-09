import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import {
  addPayment,
  getInvoicePayments,
  paymentMethodLabel as paymentRecordMethodLabel,
  paymentMethodOptions,
  paymentSourceLabel,
  reversePayment,
  type Payment,
  type PaymentMethod as PaymentRecordMethod,
} from '../api/payments'
import { useAuth } from '../auth'
import {
  Badge,
  Button,
  Card,
  type Column,
  DataTable,
  DownloadIcon,
  Drawer,
  EmptyState,
  Field,
  FigureStack,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Pagination,
  PlusIcon,
  PrintIcon,
  ReceiptIcon,
  SearchInput,
  Select,
  Textarea,
  cx,
  pageCount,
  paginate,
  useToast,
} from '../components'
import { extractErrorMessage, formatCurrency, formatDate } from '../utils/format'
import { invoicePaymentStatusLabel, paymentStatusTone } from '../utils/ui'

type PaymentMethod = 'cash' | 'card' | 'upi' | 'cheque'
type PaymentStatus = 'pending' | 'paid' | 'partial'

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'upi', 'cheque']

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  cheque: 'Cheque',
}

/** Column-sort order only — the status itself is always derived server-side. */
const PAYMENT_STATUS_ORDER: PaymentStatus[] = ['pending', 'partial', 'paid']

const PAGE_SIZE = 10

interface CustomerRef {
  _id: string
  name: string
  phone: string
}

/** Fetched separately for the invoice preview — the invoice list only populates name/phone. */
interface CustomerDetail extends CustomerRef {
  email?: string
  address?: string
  billingAddress?: string
  state?: string
}

interface Order {
  _id: string
  customerId: CustomerRef | string
  totalAmount: number
  status: string
  createdAt: string
}

interface InvoiceItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
  /** Print-layout fields added to the invoice contract; absent on older invoices. */
  hsnCode?: string
  purity?: number
  grossWeight?: number
  netWeight?: number
  ratePerGram?: number
  labourCharge?: number
}

interface OldGoldExchange {
  date?: string
  weight?: number
  rate?: number
  amount?: number
}

interface Invoice {
  _id: string
  invoiceNumber: string
  orderId: string
  customerId: CustomerRef | string
  invoiceDate: string
  items: InvoiceItem[]
  subtotal: number
  discount: number
  discountPercentage: number
  taxAmount: number
  finalAmount: number
  amountPaid?: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  /** Present on `GET /invoices/:id`; the authoritative derived balance. */
  outstanding?: number
  notes?: string
  oldGoldExchange?: OldGoldExchange
}

function customerLabel(customerId: CustomerRef | string): string {
  if (typeof customerId === 'string') return customerId
  return `${customerId.name} (${customerId.phone})`
}

function customerName(customerId: CustomerRef | string): string {
  if (typeof customerId === 'string') return customerId
  return customerId.name
}

function customerPhone(customerId: CustomerRef | string): string | null {
  if (typeof customerId === 'string') return null
  return customerId.phone
}

function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method
}

export default function InvoicingPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasRole } = useAuth()
  const canManagePayments = hasRole('admin', 'manager')

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [discountPercentage, setDiscountPercentage] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)

  const [oldGoldOpen, setOldGoldOpen] = useState(false)
  const [oldGoldDate, setOldGoldDate] = useState('')
  const [oldGoldWeight, setOldGoldWeight] = useState('')
  const [oldGoldRate, setOldGoldRate] = useState('')
  const [oldGoldAmount, setOldGoldAmount] = useState('')

  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null)
  const [detailCustomer, setDetailCustomer] = useState<CustomerDetail | null>(null)
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)
  const [printLoadingId, setPrintLoadingId] = useState<string | null>(null)

  // Fresh payment state for the open invoice — fetched on open and refreshed
  // after every payment action so the summary panel never drifts from the
  // server's derived paymentStatus.
  const [paymentInfo, setPaymentInfo] = useState<{
    amountPaid: number
    paymentStatus: PaymentStatus
    outstanding: number
    finalAmount: number
  } | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  const [showAddPayment, setShowAddPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentRecordMethod, setPaymentRecordMethod] = useState<PaymentRecordMethod>('cash')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentFormError, setPaymentFormError] = useState<string | null>(null)
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [lastRecordedPaymentId, setLastRecordedPaymentId] = useState<string | null>(null)

  const [reversingPayment, setReversingPayment] = useState<Payment | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseReasonError, setReverseReasonError] = useState<string | null>(null)
  const [reversing, setReversing] = useState(false)

  const fetchAll = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [invoicesRes, ordersRes] = await Promise.all([
        apiClient.get<Invoice[]>('/invoices'),
        apiClient.get<Order[]>('/orders'),
      ])
      setInvoices(invoicesRes.data)
      setOrders(ordersRes.data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const invoicedOrderIds = useMemo(
    () => new Set(invoices.map((invoice) => invoice.orderId)),
    [invoices],
  )

  const filteredInvoices = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return invoices
    return invoices.filter((invoice) => {
      const matchesNumber = invoice.invoiceNumber.toLowerCase().includes(term)
      const label = customerLabel(invoice.customerId).toLowerCase()
      return matchesNumber || label.includes(term)
    })
  }, [invoices, search])

  const detailInvoice = useMemo(
    () => invoices.find((invoice) => invoice._id === detailInvoiceId) ?? null,
    [invoices, detailInvoiceId],
  )

  // The invoice list only populates the customer's name/phone. Fetch the full
  // customer record for the preview's address/state/email lines; degrade
  // gracefully (blank fields) if it fails.
  useEffect(() => {
    if (!detailInvoice) {
      setDetailCustomer(null)
      return
    }
    const customerId =
      typeof detailInvoice.customerId === 'string' ? detailInvoice.customerId : detailInvoice.customerId._id
    let cancelled = false
    apiClient
      .get<CustomerDetail>(`/customers/${customerId}`)
      .then(({ data }) => {
        if (!cancelled) setDetailCustomer(data)
      })
      .catch(() => {
        if (!cancelled) setDetailCustomer(null)
      })
    return () => {
      cancelled = true
    }
  }, [detailInvoice])

  // SGST/CGST are each half of taxAmount; the percentage shown is derived the
  // same way the backend PDF renderer computes it (taxAmount / subtotal * 100, halved).
  const halfTaxPct = useMemo(() => {
    if (!detailInvoice || !detailInvoice.subtotal) return 0
    return (detailInvoice.taxAmount / detailInvoice.subtotal) * 100 / 2
  }, [detailInvoice])

  // Deep link from elsewhere (e.g. a customer's purchase history): /invoices?invoice=<id>
  // opens that invoice's detail drawer once the list has loaded.
  useEffect(() => {
    const invoiceParam = searchParams.get('invoice')
    if (!invoiceParam) return
    if (!invoices.some((invoice) => invoice._id === invoiceParam)) return
    setDetailInvoiceId(invoiceParam)
    const next = new URLSearchParams(searchParams)
    next.delete('invoice')
    setSearchParams(next, { replace: true })
  }, [invoices, searchParams, setSearchParams])

  const loadPaymentPanel = useCallback(async (invoiceId: string) => {
    setPaymentsLoading(true)
    try {
      const [invoiceRes, paymentRows] = await Promise.all([
        apiClient.get<Invoice>(`/invoices/${invoiceId}`),
        getInvoicePayments(invoiceId),
      ])
      const record = invoiceRes.data
      const amountPaid = record.amountPaid ?? 0
      setPaymentInfo({
        amountPaid,
        paymentStatus: record.paymentStatus,
        outstanding: record.outstanding ?? Math.max(record.finalAmount - amountPaid, 0),
        finalAmount: record.finalAmount,
      })
      setPayments(paymentRows)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setPaymentsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!detailInvoiceId) {
      setPaymentInfo(null)
      setPayments([])
      setLastRecordedPaymentId(null)
      return
    }
    void loadPaymentPanel(detailInvoiceId)
  }, [detailInvoiceId, loadPaymentPanel])

  // Fresh figures once loaded; falls back to the list snapshot while the fetch is in flight.
  const effectivePayment = useMemo(() => {
    if (paymentInfo) return paymentInfo
    if (!detailInvoice) return null
    const amountPaid = detailInvoice.amountPaid ?? 0
    return {
      amountPaid,
      paymentStatus: detailInvoice.paymentStatus,
      outstanding: detailInvoice.outstanding ?? Math.max(detailInvoice.finalAmount - amountPaid, 0),
      finalAmount: detailInvoice.finalAmount,
    }
  }, [paymentInfo, detailInvoice])

  const paidPercent = effectivePayment && effectivePayment.finalAmount > 0
    ? Math.min(100, Math.round((effectivePayment.amountPaid / effectivePayment.finalAmount) * 100))
    : 0

  function openAddPayment() {
    if (!effectivePayment) return
    setPaymentAmount(effectivePayment.outstanding > 0 ? effectivePayment.outstanding.toFixed(2) : '')
    setPaymentRecordMethod('cash')
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setPaymentReference('')
    setPaymentNotes('')
    setPaymentFormError(null)
    setShowAddPayment(true)
  }

  function closeAddPayment() {
    setShowAddPayment(false)
    setPaymentFormError(null)
  }

  async function handleAddPaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!detailInvoice || !effectivePayment) return

    const amountNum = Number(paymentAmount)
    if (!paymentAmount || Number.isNaN(amountNum) || amountNum <= 0) {
      setPaymentFormError('Enter an amount greater than zero.')
      return
    }
    if (amountNum > effectivePayment.outstanding) {
      setPaymentFormError(
        `Payment cannot exceed the outstanding balance of ${formatCurrency(effectivePayment.outstanding)}.`,
      )
      return
    }

    setPaymentFormError(null)
    setSubmittingPayment(true)
    try {
      const response = await addPayment(detailInvoice._id, {
        amount: amountNum,
        method: paymentRecordMethod,
        date: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
      })
      setShowAddPayment(false)
      setLastRecordedPaymentId(response.payment._id)
      await Promise.all([loadPaymentPanel(detailInvoice._id), fetchAll()])
      toast.success(`Payment of ${formatCurrency(amountNum)} recorded`)
    } catch (err) {
      const message = extractErrorMessage(err)
      setPaymentFormError(message)
      toast.error(message)
    } finally {
      setSubmittingPayment(false)
    }
  }

  function openReversePayment(payment: Payment) {
    setReversingPayment(payment)
    setReverseReason('')
    setReverseReasonError(null)
  }

  async function handleReverseConfirm() {
    if (!reversingPayment || !detailInvoice) return
    if (!reverseReason.trim()) {
      setReverseReasonError('Enter a reason for the reversal.')
      return
    }
    setReverseReasonError(null)
    setReversing(true)
    try {
      await reversePayment(reversingPayment._id, reverseReason.trim())
      setReversingPayment(null)
      setReverseReason('')
      await Promise.all([loadPaymentPanel(detailInvoice._id), fetchAll()])
      toast.success('Payment reversed')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setReversing(false)
    }
  }

  const currentPage = Math.min(page, pageCount(filteredInvoices.length, PAGE_SIZE))
  const pageRows = paginate(filteredInvoices, currentPage, PAGE_SIZE)

  function changeSearch(next: string) {
    setSearch(next)
    setPage(1)
  }

  function openCreateForm() {
    setShowCreateForm(true)
    setSelectedOrderId('')
    setPaymentMethod('cash')
    setDiscountPercentage('')
    setNotes('')
    setFormError(null)
    setOldGoldOpen(false)
    setOldGoldDate('')
    setOldGoldWeight('')
    setOldGoldRate('')
    setOldGoldAmount('')
  }

  function closeCreateForm() {
    setShowCreateForm(false)
    setFormError(null)
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedOrderId) {
      setFormError('Please select an order.')
      return
    }
    setFormError(null)
    setIsSubmittingForm(true)
    try {
      const oldGoldExchange =
        oldGoldOpen && (oldGoldDate || oldGoldWeight || oldGoldRate || oldGoldAmount)
          ? {
              date: oldGoldDate || undefined,
              weight: oldGoldWeight ? Number(oldGoldWeight) : undefined,
              rate: oldGoldRate ? Number(oldGoldRate) : undefined,
              amount: oldGoldAmount ? Number(oldGoldAmount) : undefined,
            }
          : undefined
      const body = {
        orderId: selectedOrderId,
        discountPercentage: discountPercentage ? Number(discountPercentage) : undefined,
        paymentMethod,
        notes: notes || undefined,
        oldGoldExchange,
      }
      await apiClient.post('/invoices', body)
      closeCreateForm()
      toast.success('Invoice generated')
      await fetchAll()
    } catch (err) {
      const message = extractErrorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSubmittingForm(false)
    }
  }

  async function handleDownloadPdf(invoice: Invoice) {
    setPdfLoadingId(invoice._id)
    try {
      const response = await apiClient.get(`/invoices/generate-pdf/${invoice._id}`, {
        responseType: 'blob',
      })
      const blobUrl = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = `${invoice.invoiceNumber}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(blobUrl)
      toast.success(`Invoice ${invoice.invoiceNumber} downloaded`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setPdfLoadingId(null)
    }
  }

  /** Print reuses the server PDF: it opens in a new tab where the browser can print it. */
  async function handlePrint(invoice: Invoice) {
    setPrintLoadingId(invoice._id)
    try {
      const response = await apiClient.get(`/invoices/generate-pdf/${invoice._id}`, {
        responseType: 'blob',
      })
      const blobUrl = URL.createObjectURL(response.data)
      const printWindow = window.open(blobUrl, '_blank')
      if (!printWindow) {
        URL.revokeObjectURL(blobUrl)
        toast.error('Allow pop-ups for this site to print the invoice.')
        return
      }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      toast.info('Invoice opened in a new tab. Use your browser print dialog.')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setPrintLoadingId(null)
    }
  }

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice no.',
      width: '150px',
      sortable: true,
      sortValue: (invoice) => invoice.invoiceNumber,
      render: (invoice) => (
        <span className="font-mono text-sm font-medium text-ink">{invoice.invoiceNumber}</span>
      ),
    },
    {
      key: 'invoiceDate',
      header: 'Date',
      width: '130px',
      sortable: true,
      sortValue: (invoice) => new Date(invoice.invoiceDate),
      render: (invoice) => (
        <span className="font-mono text-sm">{formatDate(invoice.invoiceDate)}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (invoice) => customerName(invoice.customerId),
      render: (invoice) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{customerName(invoice.customerId)}</p>
          {customerPhone(invoice.customerId) && (
            <p className="truncate font-mono text-xs text-ink-muted">
              {customerPhone(invoice.customerId)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'finalAmount',
      header: 'Amount',
      align: 'right',
      width: '150px',
      sortable: true,
      sortValue: (invoice) => invoice.finalAmount,
      render: (invoice) => (
        <span className="font-mono text-sm font-medium">{formatCurrency(invoice.finalAmount)}</span>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Payment',
      width: '120px',
      sortable: true,
      sortValue: (invoice) => PAYMENT_STATUS_ORDER.indexOf(invoice.paymentStatus),
      render: (invoice) => (
        <Badge tone={paymentStatusTone(invoice.paymentStatus)} dot>
          {invoicePaymentStatusLabel(invoice.paymentStatus)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Download',
      align: 'right',
      width: '90px',
      headerClassName: 'sr-only',
      render: (invoice) => (
        <IconButton
          label={`Download invoice ${invoice.invoiceNumber}`}
          size="sm"
          loading={pdfLoadingId === invoice._id}
          onClick={(event) => {
            event.stopPropagation()
            handleDownloadPdf(invoice)
          }}
        >
          <DownloadIcon size={16} />
        </IconButton>
      ),
    },
  ]

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'date',
      header: 'Date',
      width: '110px',
      render: (row) => (
        <span className={cx('font-mono text-sm', row.status === 'REVERSED' && 'text-ink-muted line-through')}>
          {formatDate(row.date)}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (row) => (
        <div className="min-w-0">
          <span className="text-sm text-ink">{paymentRecordMethodLabel(row.method)}</span>
          {paymentSourceLabel(row.source) && (
            <span className="block text-xs text-ink-muted">{paymentSourceLabel(row.source)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: '120px',
      render: (row) => (
        <span
          className={cx(
            'font-mono text-sm font-medium',
            row.status === 'REVERSED' ? 'text-ink-muted line-through' : 'text-ink',
          )}
        >
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => <span className="font-mono text-xs text-ink-muted">{row.reference || '—'}</span>,
    },
    {
      key: 'recordedBy',
      header: 'Recorded by',
      render: (row) => <span className="text-sm text-ink-muted">{row.createdBy?.username ?? 'System'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.status === 'REVERSED' ? (
          <Badge tone="danger">Voided</Badge>
        ) : (
          <Badge tone="success" dot>
            Active
          </Badge>
        ),
    },
    {
      key: 'rowActions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate(`/payments/${row._id}/receipt`)}>
            Receipt
          </Button>
          {row.status === 'ACTIVE' && canManagePayments && (
            <Button size="sm" variant="danger" onClick={() => openReversePayment(row)}>
              Reverse
            </Button>
          )}
        </div>
      ),
    },
  ]

  const emptyState =
    search.trim() !== '' ? (
      <EmptyState
        icon={<ReceiptIcon size={20} />}
        title="No invoices match that search"
        description="Check the invoice number, customer name or phone number and try again."
        action={
          <Button variant="secondary" onClick={() => changeSearch('')}>
            Clear search
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<ReceiptIcon size={20} />}
        title="No invoices yet"
        description="Generate an invoice from a completed order, or start a new sale at the counter."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button leftIcon={<PlusIcon size={16} />} onClick={openCreateForm}>
              Generate invoice
            </Button>
            <Button variant="secondary" onClick={() => navigate('/sales/new')}>
              New sale
            </Button>
          </div>
        }
      />
    )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Invoicing"
        description="Generate, share and track payment on every invoice."
        actions={
          <Button leftIcon={<PlusIcon size={16} />} onClick={openCreateForm}>
            Generate invoice
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onValueChange={changeSearch}
          placeholder="Search invoice number, customer or phone"
          className="w-full sm:max-w-sm"
        />
        <p className="text-xs text-ink-muted">
          <span className="font-mono text-ink">{filteredInvoices.length}</span>{' '}
          {filteredInvoices.length === 1 ? 'invoice' : 'invoices'}
        </p>
      </div>

      {loadError && (
        <p role="alert" className="rounded-panel bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <DataTable
          columns={columns}
          rows={pageRows}
          getRowId={(invoice) => invoice._id}
          isLoading={isLoading}
          emptyState={emptyState}
          onRowClick={(invoice) => setDetailInvoiceId(invoice._id)}
          caption="Invoices"
          initialSort={{ key: 'invoiceDate', direction: 'desc' }}
          renderMobileCard={(invoice) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium text-ink">
                    {invoice.invoiceNumber}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {customerName(invoice.customerId)} ·{' '}
                    <span className="font-mono">{formatDate(invoice.invoiceDate)}</span>
                  </p>
                </div>
                <Badge tone={paymentStatusTone(invoice.paymentStatus)} dot>
                  {invoicePaymentStatusLabel(invoice.paymentStatus)}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
                <span className="font-mono text-sm font-semibold text-ink">
                  {formatCurrency(invoice.finalAmount)}
                </span>
                <IconButton
                  label={`Download invoice ${invoice.invoiceNumber}`}
                  size="sm"
                  variant="secondary"
                  loading={pdfLoadingId === invoice._id}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDownloadPdf(invoice)
                  }}
                >
                  <DownloadIcon size={16} />
                </IconButton>
              </div>
            </div>
          )}
        />

        {filteredInvoices.length > PAGE_SIZE && (
          <Pagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            totalItems={filteredInvoices.length}
            onPageChange={setPage}
            itemLabel="invoices"
            className="rounded-panel border border-line bg-surface"
          />
        )}
      </div>

      {/* Generate invoice */}
      <Drawer
        open={showCreateForm}
        onClose={closeCreateForm}
        title="Generate invoice"
        description="Pick an order; the amounts come straight from it."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeCreateForm}>
              Cancel
            </Button>
            <Button type="submit" form="create-invoice-form" loading={isSubmittingForm}>
              Generate invoice
            </Button>
          </>
        }
      >
        <form id="create-invoice-form" onSubmit={handleCreateSubmit} className="space-y-4" noValidate>
          <Field
            label="Order"
            required
            hint="Orders that already have an invoice cannot be picked again."
            error={formError === 'Please select an order.' ? formError : undefined}
          >
            <Select
              required
              value={selectedOrderId}
              onChange={(event) => setSelectedOrderId(event.target.value)}
            >
              <option value="">Select an order…</option>
              {orders.map((order) => {
                const alreadyInvoiced = invoicedOrderIds.has(order._id)
                return (
                  <option key={order._id} value={order._id} disabled={alreadyInvoiced}>
                    {customerLabel(order.customerId)} · {formatCurrency(order.totalAmount)} ·{' '}
                    {order.status}
                    {alreadyInvoiced ? ' (already invoiced)' : ''}
                  </option>
                )
              })}
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Payment method">
              <Select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                options={PAYMENT_METHODS.map((method) => ({
                  value: method,
                  label: paymentMethodLabel(method),
                }))}
              />
            </Field>
            <Field label="Discount %" hint="Optional. Applied by the server.">
              <Input
                type="number"
                min="0"
                max="100"
                value={discountPercentage}
                onChange={(event) => setDiscountPercentage(event.target.value)}
                className="font-mono"
              />
            </Field>
          </div>

          <Field label="Notes" hint="Optional. Printed on the invoice.">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
          </Field>

          <div className="rounded-control border border-line">
            <button
              type="button"
              onClick={() => setOldGoldOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium text-ink"
              aria-expanded={oldGoldOpen}
            >
              Old gold exchange (optional)
              <span className="text-xs font-normal text-ink-muted">{oldGoldOpen ? 'Hide' : 'Add'}</span>
            </button>
            {oldGoldOpen && (
              <div className="grid grid-cols-1 gap-4 border-t border-line p-3 sm:grid-cols-2">
                <Field label="Date">
                  <Input
                    type="date"
                    value={oldGoldDate}
                    onChange={(event) => setOldGoldDate(event.target.value)}
                  />
                </Field>
                <Field label="Weight (g)">
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    inputMode="decimal"
                    value={oldGoldWeight}
                    onChange={(event) => setOldGoldWeight(event.target.value)}
                    className="font-mono"
                  />
                </Field>
                <Field label="Rate per gram">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={oldGoldRate}
                    onChange={(event) => setOldGoldRate(event.target.value)}
                    className="font-mono"
                  />
                </Field>
                <Field label="Amount">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={oldGoldAmount}
                    onChange={(event) => setOldGoldAmount(event.target.value)}
                    className="font-mono"
                  />
                </Field>
              </div>
            )}
          </div>

          {formError && formError !== 'Please select an order.' && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
        </form>
      </Drawer>

      {/* Invoice detail */}
      <Drawer
        open={detailInvoice !== null}
        onClose={() => setDetailInvoiceId(null)}
        title={detailInvoice ? `Invoice ${detailInvoice.invoiceNumber}` : 'Invoice'}
        description={detailInvoice ? formatDate(detailInvoice.invoiceDate) : undefined}
        size="lg"
        footer={
          detailInvoice ? (
            <>
              <Button
                variant="secondary"
                leftIcon={<PrintIcon size={16} />}
                loading={printLoadingId === detailInvoice._id}
                onClick={() => handlePrint(detailInvoice)}
              >
                Print
              </Button>
              <Button
                leftIcon={<DownloadIcon size={16} />}
                loading={pdfLoadingId === detailInvoice._id}
                onClick={() => handleDownloadPdf(detailInvoice)}
              >
                Download PDF
              </Button>
            </>
          ) : undefined
        }
      >
        {detailInvoice && (
          <div className="space-y-4">
            {/*
              This panel is a deliberate exception to the app's design system: it is a
              read-only preview of the shop's own printed tax invoice (see
              backend/src/services/invoicePdfRenderer.js), so it uses the shop's real
              paper-stationery styling (maroon wordmark, black hairlines) rather than
              app tokens. The surrounding drawer chrome (title, footer buttons, the
              Payment card below) stays on the app's own design system.
            */}
            <article className="overflow-hidden rounded-panel border border-line bg-white text-neutral-900 shadow-raise">
              <div className="p-4 sm:p-6">
                {/* Shop header */}
                <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-4">
                  <div className="min-w-0">
                    <p className="text-2xl font-bold leading-tight" style={{ color: '#c0392b' }}>
                      Sonali Jewellers
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-800">
                      Dealers in fine gold ornaments
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-neutral-500">
                      Shop No. A-002, Rupali Darshan CHS., Near Hanuman Mandir, Bhayandar (E), Thane -
                      401105.
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-neutral-500">
                    <p className="font-mono text-sm font-semibold text-neutral-900">
                      {detailInvoice.invoiceNumber}
                    </p>
                    <p className="font-mono">{formatDate(detailInvoice.invoiceDate)}</p>
                  </div>
                </header>

                <p className="mt-3 text-center text-sm font-bold" style={{ color: '#c0392b' }}>
                  TAX INVOICE
                </p>

                {/* Customer info | invoice no. / date */}
                <div className="mt-3 grid grid-cols-1 gap-4 border-b border-neutral-800 pb-4 text-xs sm:grid-cols-2">
                  <dl className="space-y-1">
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">Name</dt>
                      <dd className="min-w-0">{customerName(detailInvoice.customerId)}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">Address</dt>
                      <dd className="min-w-0">
                        {detailCustomer?.address || detailCustomer?.billingAddress || '—'}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">State</dt>
                      <dd className="min-w-0">{detailCustomer?.state || '—'}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">Contact</dt>
                      <dd className="min-w-0 font-mono">
                        {customerPhone(detailInvoice.customerId) ?? '—'}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 font-semibold">Email</dt>
                      <dd className="min-w-0">{detailCustomer?.email || '—'}</dd>
                    </div>
                  </dl>
                  <dl className="space-y-1 sm:text-right">
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <dt className="font-semibold">Invoice No.</dt>
                      <dd className="font-mono">{detailInvoice.invoiceNumber}</dd>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <dt className="font-semibold">Date</dt>
                      <dd className="font-mono">{formatDate(detailInvoice.invoiceDate)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Line items — mirrors the printed item table's columns */}
                <div className="mt-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[720px] border-collapse text-xs">
                    <caption className="sr-only">Invoice line items</caption>
                    <thead>
                      <tr className="bg-neutral-100 text-neutral-700">
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-center font-semibold">
                          Sr.No
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-left font-semibold">
                          Description
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-center font-semibold">
                          HSN code
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-center font-semibold">
                          Purity
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-center font-semibold">
                          Qty
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-right font-semibold">
                          Gross
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-right font-semibold">
                          Net
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-right font-semibold">
                          Rate
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-right font-semibold">
                          Labour
                        </th>
                        <th scope="col" className="border border-neutral-300 px-2 py-1.5 text-right font-semibold">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailInvoice.items.map((item, index) => (
                        <tr key={`${item.productId}-${index}`}>
                          <td className="border border-neutral-300 px-2 py-1.5 text-center font-mono">
                            {index + 1}
                          </td>
                          <td className="border border-neutral-300 px-2 py-1.5">{item.name}</td>
                          <td className="border border-neutral-300 px-2 py-1.5 text-center font-mono">
                            {item.hsnCode || '—'}
                          </td>
                          <td className="border border-neutral-300 px-2 py-1.5 text-center font-mono">
                            {typeof item.purity === 'number' ? `${item.purity}%` : '—'}
                          </td>
                          <td className="border border-neutral-300 px-2 py-1.5 text-center font-mono">
                            {item.quantity}
                          </td>
                          <td className="border border-neutral-300 px-2 py-1.5 text-right font-mono">
                            {typeof item.grossWeight === 'number' ? item.grossWeight.toFixed(3) : '—'}
                          </td>
                          <td className="border border-neutral-300 px-2 py-1.5 text-right font-mono">
                            {typeof item.netWeight === 'number' ? item.netWeight.toFixed(3) : '—'}
                          </td>
                          <td className="border border-neutral-300 px-2 py-1.5 text-right font-mono">
                            {typeof item.ratePerGram === 'number' ? formatCurrency(item.ratePerGram) : '—'}
                          </td>
                          <td className="border border-neutral-300 px-2 py-1.5 text-right font-mono">
                            {typeof item.labourCharge === 'number' ? formatCurrency(item.labourCharge) : '—'}
                          </td>
                          <td className="border border-neutral-300 px-2 py-1.5 text-right font-mono">
                            {formatCurrency(item.totalPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Order no. / date / running total */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y border-neutral-800 py-2 text-xs">
                  <span>
                    Order No.:{' '}
                    <span className="font-mono">
                      {detailInvoice.orderId ? detailInvoice.orderId.slice(-8) : '—'}
                    </span>
                  </span>
                  <span>
                    Date: <span className="font-mono">{formatDate(detailInvoice.invoiceDate)}</span>
                  </span>
                  <span className="font-semibold">
                    Total: <span className="font-mono">{formatCurrency(detailInvoice.subtotal)}</span>
                  </span>
                </div>

                {/* Old gold exchange, if the shop recorded a trade-in for this sale */}
                {detailInvoice.oldGoldExchange && (
                  <div className="mt-3 rounded-control border border-neutral-300 p-3 text-xs">
                    <p className="mb-1.5 font-semibold">Old gold exchange</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                      <p>
                        Date:{' '}
                        <span className="font-mono">{formatDate(detailInvoice.oldGoldExchange.date)}</span>
                      </p>
                      <p>
                        Weight:{' '}
                        <span className="font-mono">
                          {typeof detailInvoice.oldGoldExchange.weight === 'number'
                            ? `${detailInvoice.oldGoldExchange.weight.toFixed(3)} g`
                            : '—'}
                        </span>
                      </p>
                      <p>
                        Rate:{' '}
                        <span className="font-mono">
                          {typeof detailInvoice.oldGoldExchange.rate === 'number'
                            ? formatCurrency(detailInvoice.oldGoldExchange.rate)
                            : '—'}
                        </span>
                      </p>
                      <p>
                        Amount:{' '}
                        <span className="font-mono">
                          {typeof detailInvoice.oldGoldExchange.amount === 'number'
                            ? formatCurrency(detailInvoice.oldGoldExchange.amount)
                            : '—'}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Totals — the app's own assay stack fits naturally here */}
                <div className="mt-4 ml-auto w-full sm:max-w-sm">
                  <FigureStack
                    rows={[
                      {
                        label: `SGST (${halfTaxPct.toFixed(2)}%)`,
                        value: detailInvoice.taxAmount / 2,
                      },
                      {
                        label: `CGST (${halfTaxPct.toFixed(2)}%)`,
                        value: detailInvoice.taxAmount / 2,
                      },
                      {
                        label: 'Discount',
                        hint:
                          detailInvoice.discountPercentage > 0
                            ? `${detailInvoice.discountPercentage}% of subtotal`
                            : undefined,
                        value: detailInvoice.discount ? -detailInvoice.discount : 0,
                        tone: detailInvoice.discount ? 'success' : 'default',
                      },
                    ]}
                    total={{ label: 'Grand total', value: detailInvoice.finalAmount }}
                  />

                  {effectivePayment && effectivePayment.paymentStatus !== 'pending' && (
                    <div className="mt-3 border-t border-neutral-300 pt-3">
                      <FigureStack
                        size="sm"
                        rows={[{ label: 'Amount paid', value: effectivePayment.amountPaid, tone: 'success' }]}
                        total={{
                          label: 'Balance due',
                          value: effectivePayment.outstanding,
                          tone: effectivePayment.outstanding > 0 ? 'danger' : 'default',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Payment method / status */}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-neutral-500">Payment:</span>
                  <span>{paymentMethodLabel(detailInvoice.paymentMethod)}</span>
                  {effectivePayment && (
                    <Badge tone={paymentStatusTone(effectivePayment.paymentStatus)} dot>
                      {invoicePaymentStatusLabel(effectivePayment.paymentStatus)}
                    </Badge>
                  )}
                </div>

                {detailInvoice.notes && (
                  <div className="mt-3 border-t border-neutral-300 pt-3">
                    <p className="text-xs text-neutral-500">Notes</p>
                    <p className="mt-1 text-xs">{detailInvoice.notes}</p>
                  </div>
                )}

                {/* Signatory */}
                <div className="mt-8 flex justify-end">
                  <div className="text-center text-xs">
                    <p className="font-semibold">For Sonali Jewellers</p>
                    <p className="mt-8 border-t border-neutral-800 pt-1">Authorised signatory</p>
                  </div>
                </div>
              </div>
            </article>

            <Card
              title="Payment"
              description="What has been collected against this invoice."
              actions={
                effectivePayment && effectivePayment.outstanding > 0 ? (
                  <Button size="sm" leftIcon={<PlusIcon size={16} />} onClick={openAddPayment}>
                    Add payment
                  </Button>
                ) : undefined
              }
            >
              {effectivePayment && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                    <div className="flex items-baseline justify-between gap-3 sm:block">
                      <p className="text-xs text-ink-muted">Invoice total</p>
                      <p className="font-mono text-sm font-semibold text-ink">
                        {formatCurrency(effectivePayment.finalAmount)}
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 sm:block">
                      <p className="text-xs text-ink-muted">Paid</p>
                      <p className="font-mono text-sm font-semibold text-success">
                        {formatCurrency(effectivePayment.amountPaid)}
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 sm:block">
                      <p className="text-xs text-ink-muted">Outstanding</p>
                      <p
                        className={cx(
                          'font-mono text-sm font-semibold',
                          effectivePayment.outstanding > 0 ? 'text-warning' : 'text-ink-muted',
                        )}
                      >
                        {formatCurrency(effectivePayment.outstanding)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={paymentStatusTone(effectivePayment.paymentStatus)} dot>
                        <span aria-live="polite">{invoicePaymentStatusLabel(effectivePayment.paymentStatus)}</span>
                      </Badge>
                      <span className="font-mono text-xs text-ink-muted">{paidPercent}% paid</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Percentage of invoice paid"
                      aria-valuenow={paidPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-live="polite"
                      className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-sunken"
                    >
                      <div
                        className={cx(
                          'h-full rounded-pill transition-[width] duration-150',
                          paidPercent >= 100 ? 'bg-success' : 'bg-accent',
                        )}
                        style={{ width: `${paidPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {lastRecordedPaymentId && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-control bg-success-soft px-3 py-2 text-sm text-success">
                  <span>Payment recorded.</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/payments/${lastRecordedPaymentId}/receipt`)}
                    >
                      View receipt
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setLastRecordedPaymentId(null)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-2 text-sm font-semibold text-ink">Payment history</h3>
                <DataTable
                  columns={paymentColumns}
                  rows={payments}
                  getRowId={(row) => row._id}
                  isLoading={paymentsLoading}
                  caption="Payment history"
                  emptyState={
                    <p className="px-4 py-6 text-center text-sm text-ink-muted">
                      No payments recorded yet.
                    </p>
                  }
                  renderMobileCard={(row) => (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={cx(
                              'font-mono text-sm font-medium',
                              row.status === 'REVERSED' ? 'text-ink-muted line-through' : 'text-ink',
                            )}
                          >
                            {formatCurrency(row.amount)}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatDate(row.date)} · {paymentRecordMethodLabel(row.method)}
                          </p>
                        </div>
                        {row.status === 'REVERSED' ? (
                          <Badge tone="danger">Voided</Badge>
                        ) : (
                          <Badge tone="success" dot>
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted">
                        Recorded by {row.createdBy?.username ?? 'System'}
                        {row.reference ? ` · Ref ${row.reference}` : ''}
                      </p>
                      <div className="flex gap-2 border-t border-line pt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/payments/${row._id}/receipt`)}
                        >
                          Receipt
                        </Button>
                        {row.status === 'ACTIVE' && canManagePayments && (
                          <Button size="sm" variant="danger" onClick={() => openReversePayment(row)}>
                            Reverse
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                />
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <Button variant="secondary" size="sm" disabled>
                  Send to customer
                </Button>
                <p className="mt-1.5 text-xs text-ink-muted">
                  Sending by email or SMS is not available yet. Download or print the invoice
                  instead.
                </p>
              </div>
            </Card>
          </div>
        )}
      </Drawer>

      {/* Add payment */}
      <Modal
        open={showAddPayment}
        onClose={closeAddPayment}
        title="Add payment"
        description={
          effectivePayment
            ? `Outstanding balance ${formatCurrency(effectivePayment.outstanding)}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeAddPayment} disabled={submittingPayment}>
              Cancel
            </Button>
            <Button type="submit" form="add-payment-form" loading={submittingPayment}>
              Record payment
            </Button>
          </>
        }
      >
        <form id="add-payment-form" onSubmit={handleAddPaymentSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Amount" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              className="font-mono"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Payment method">
              <Select
                value={paymentRecordMethod}
                onChange={(event) => setPaymentRecordMethod(event.target.value as PaymentRecordMethod)}
                options={paymentMethodOptions()}
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Reference" hint="Optional. Cheque no., UTR, transaction id.">
            <Input
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
            />
          </Field>
          <Field label="Notes" hint="Optional.">
            <Textarea
              value={paymentNotes}
              onChange={(event) => setPaymentNotes(event.target.value)}
              rows={2}
            />
          </Field>

          {paymentFormError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {paymentFormError}
            </p>
          )}
        </form>
      </Modal>

      {/* Reverse payment — a hand-built Modal rather than ConfirmDialog: the
          reason field is required block content (Field + Textarea), and
          ConfirmDialog's `message` renders inside a <p>, which cannot
          legally contain block elements. */}
      <Modal
        open={reversingPayment !== null}
        onClose={() => {
          if (!reversing) {
            setReversingPayment(null)
            setReverseReason('')
            setReverseReasonError(null)
          }
        }}
        title="Reverse this payment?"
        size="sm"
        closeOnBackdrop={!reversing}
        closeOnEscape={!reversing}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={reversing}
              onClick={() => {
                setReversingPayment(null)
                setReverseReason('')
                setReverseReasonError(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" loading={reversing} onClick={handleReverseConfirm}>
              Reverse payment
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            {reversingPayment
              ? `This voids the ${formatCurrency(reversingPayment.amount)} payment recorded on ${formatDate(reversingPayment.date)}. It will no longer count toward the invoice's paid amount.`
              : null}
          </p>
          <Field label="Reason" required error={reverseReasonError}>
            <Textarea
              value={reverseReason}
              onChange={(event) => {
                setReverseReason(event.target.value)
                if (reverseReasonError) setReverseReasonError(null)
              }}
              rows={2}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}

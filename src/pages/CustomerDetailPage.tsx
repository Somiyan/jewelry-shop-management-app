import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getCustomerLedger,
  getCustomerPayments,
  getCustomerSummary,
  getCustomerPurchases,
  type CustomerLedgerEntry,
  type CustomerPaymentRow,
  type CustomerPurchaseRecord,
  type CustomerSummary,
} from '../api/customers'
import { paymentMethodLabel, paymentSourceLabel } from '../api/payments'
import {
  AlertIcon,
  Badge,
  Button,
  Card,
  type Column,
  DataTable,
  EditIcon,
  EmptyState,
  FileTextIcon,
  InboxIcon,
  PageHeader,
  ReceiptIcon,
  SkeletonText,
  StatCard,
  TagIcon,
  Tabs,
  UsersIcon,
  type TabItem,
} from '../components'
import { extractErrorMessage, formatCurrency, formatDate } from '../utils/format'
import { customerPaymentStatusTone, paymentStatusTone } from '../utils/ui'

type TabId = 'overview' | 'purchases' | 'payments' | 'ledger'

const TABS: TabItem<TabId>[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'purchases', label: 'Purchase history' },
  { id: 'payments', label: 'Payments' },
  { id: 'ledger', label: 'Ledger' },
]

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink">{value}</dd>
    </div>
  )
}

const PURCHASE_STATUS_LABEL: Record<string, string> = {
  pending: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [tab, setTab] = useState<TabId>('overview')

  const [summary, setSummary] = useState<CustomerSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [purchases, setPurchases] = useState<CustomerPurchaseRecord[] | null>(null)
  const [purchasesLoading, setPurchasesLoading] = useState(false)
  const [purchasesError, setPurchasesError] = useState<string | null>(null)

  const [payments, setPayments] = useState<CustomerPaymentRow[] | null>(null)
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)

  const [ledger, setLedger] = useState<CustomerLedgerEntry[] | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    if (!id) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      setSummary(await getCustomerSummary(id))
    } catch (err) {
      setSummaryError(extractErrorMessage(err))
    } finally {
      setSummaryLoading(false)
    }
  }, [id])

  const loadPurchases = useCallback(async () => {
    if (!id) return
    setPurchasesLoading(true)
    setPurchasesError(null)
    try {
      setPurchases(await getCustomerPurchases(id))
    } catch (err) {
      setPurchasesError(extractErrorMessage(err))
    } finally {
      setPurchasesLoading(false)
    }
  }, [id])

  const loadPayments = useCallback(async () => {
    if (!id) return
    setPaymentsLoading(true)
    setPaymentsError(null)
    try {
      setPayments(await getCustomerPayments(id))
    } catch (err) {
      setPaymentsError(extractErrorMessage(err))
    } finally {
      setPaymentsLoading(false)
    }
  }, [id])

  const loadLedger = useCallback(async () => {
    if (!id) return
    setLedgerLoading(true)
    setLedgerError(null)
    try {
      setLedger(await getCustomerLedger(id))
    } catch (err) {
      setLedgerError(extractErrorMessage(err))
    } finally {
      setLedgerLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  // Each tab's data loads the first time it is opened, then is cached in state.
  useEffect(() => {
    if (tab === 'purchases' && purchases === null) void loadPurchases()
    if (tab === 'payments' && payments === null) void loadPayments()
    if (tab === 'ledger' && ledger === null) void loadLedger()
  }, [tab, purchases, payments, ledger, loadPurchases, loadPayments, loadLedger])

  const customer = summary?.customer

  const purchaseColumns: Column<CustomerPurchaseRecord>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice no.',
      sortable: true,
      sortValue: (row) => row.invoiceNumber,
      render: (row) => <span className="font-mono text-sm font-medium text-ink">{row.invoiceNumber}</span>,
    },
    {
      key: 'invoiceDate',
      header: 'Date',
      sortable: true,
      sortValue: (row) => new Date(row.invoiceDate),
      render: (row) => <span className="font-mono text-sm">{formatDate(row.invoiceDate)}</span>,
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => (
        <span className="block max-w-64 truncate text-ink-muted">
          {row.items.map((item) => item.name).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'finalAmount',
      header: 'Invoice amount',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.finalAmount,
      render: (row) => <span className="font-mono text-sm">{formatCurrency(row.finalAmount)}</span>,
    },
    {
      key: 'amountPaid',
      header: 'Paid',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.amountPaid,
      render: (row) => (
        <span className="font-mono text-sm text-success">{formatCurrency(row.amountPaid)}</span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.balance,
      render: (row) => (
        <span className={`font-mono text-sm ${row.balance > 0 ? 'text-warning' : 'text-ink-muted'}`}>
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Status',
      render: (row) => (
        <Badge tone={paymentStatusTone(row.paymentStatus)} dot>
          {PURCHASE_STATUS_LABEL[row.paymentStatus] ?? row.paymentStatus}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Open</span>,
      align: 'right',
      render: (row) => (
        <div onClick={(event) => event.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/invoices?invoice=${row._id}`)}
          >
            Open invoice
          </Button>
        </div>
      ),
    },
  ]

  const purchaseTotals = (purchases ?? []).reduce(
    (acc, row) => ({
      value: acc.value + row.finalAmount,
      paid: acc.paid + row.amountPaid,
      outstanding: acc.outstanding + row.balance,
    }),
    { value: 0, paid: 0, outstanding: 0 },
  )

  const paymentColumns: Column<CustomerPaymentRow>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (row) => new Date(row.date),
      render: (row) => (
        <span className={`font-mono text-sm ${row.status === 'REVERSED' ? 'text-ink-muted line-through' : ''}`}>
          {formatDate(row.date)}
        </span>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice',
      render: (row) => (
        <span className="font-mono text-sm text-ink-muted">{row.invoiceId?.invoiceNumber ?? '—'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.amount,
      render: (row) => (
        <span
          className={`font-mono text-sm ${row.status === 'REVERSED' ? 'text-ink-muted line-through' : 'text-ink'}`}
        >
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (row) => (
        <div className="min-w-0">
          <span className="text-sm text-ink-muted">{paymentMethodLabel(row.method)}</span>
          {paymentSourceLabel(row.source) && (
            <span className="block text-xs text-ink-muted">{paymentSourceLabel(row.source)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => <span className="text-ink-muted">{row.reference || '—'}</span>,
    },
    {
      key: 'recordedBy',
      header: 'Recorded by',
      render: (row) => <span className="text-ink-muted">{row.createdBy?.username ?? 'System'}</span>,
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
  ]

  const ledgerColumns: Column<CustomerLedgerEntry>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="font-mono text-sm">{formatDate(row.date)}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge tone={row.type === 'invoice' ? 'info' : 'success'} dot>
          {row.type === 'invoice' ? 'Invoice' : 'Payment'}
        </Badge>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => (
        <span className="font-mono text-sm text-ink-muted">{row.reference || '—'}</span>
      ),
    },
    {
      key: 'debit',
      header: 'Debit',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-sm text-ink">
          {row.debit ? formatCurrency(row.debit) : '—'}
        </span>
      ),
    },
    {
      key: 'credit',
      header: 'Credit',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-sm text-success">
          {row.credit ? formatCurrency(row.credit) : '—'}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-sm font-semibold text-ink">{formatCurrency(row.balance)}</span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={customer?.name ?? (summaryLoading ? 'Loading…' : 'Customer')}
        description={customer?.phone}
        breadcrumb={[{ label: 'Customers', to: '/customers' }, { label: customer?.name ?? 'Customer' }]}
        actions={
          customer ? (
            <Button
              variant="secondary"
              leftIcon={<EditIcon size={16} />}
              onClick={() => navigate(`/customers?edit=${customer._id}`)}
            >
              Edit customer
            </Button>
          ) : undefined
        }
      />

      {summaryError && !summaryLoading && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {summaryError}
        </p>
      )}

      <Tabs items={TABS} value={tab} onChange={setTab} label="Customer detail" />

      {tab === 'overview' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="Total purchases"
              value={formatCurrency(summary?.totalInvoiced)}
              isLoading={summaryLoading}
              icon={<ReceiptIcon size={16} />}
            />
            <StatCard
              label="Total paid"
              value={formatCurrency(summary?.totalPaid)}
              isLoading={summaryLoading}
              icon={<TagIcon size={16} />}
            />
            <StatCard
              label="Outstanding"
              value={formatCurrency(summary?.pendingBalance)}
              isLoading={summaryLoading}
              icon={<AlertIcon size={16} />}
              meta={
                summary && summary.paymentStatus !== 'no-invoices' ? (
                  <Badge tone={customerPaymentStatusTone(summary.paymentStatus)} dot>
                    {summary.paymentStatus === 'paid' ? 'No outstanding' : 'Outstanding'}
                  </Badge>
                ) : undefined
              }
            />
            <StatCard
              label="Orders"
              value={(summary?.orderCount ?? 0).toLocaleString('en-IN')}
              isLoading={summaryLoading}
              icon={<UsersIcon size={16} />}
            />
            <StatCard
              label="Invoices"
              value={(summary?.invoiceCount ?? 0).toLocaleString('en-IN')}
              isLoading={summaryLoading}
              icon={<FileTextIcon size={16} />}
            />
          </div>

          {summary && summary.creditBalance > 0 && (
            <p className="rounded-control bg-info-soft px-3 py-2 text-sm text-info">
              This customer has a credit balance of{' '}
              <span className="font-mono">{formatCurrency(summary.creditBalance)}</span> from
              overpayment.
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Contact" padding="sm">
              {summaryLoading || !customer ? (
                <SkeletonText lines={4} />
              ) : (
                <dl className="divide-y divide-line">
                  <DetailRow label="Phone" value={<span className="font-mono">{customer.phone}</span>} />
                  <DetailRow label="Email" value={customer.email || '—'} />
                  <DetailRow label="Address" value={customer.address || '—'} />
                  <DetailRow label="Customer since" value={formatDate(customer.createdAt)} />
                  <DetailRow
                    label="Last invoice"
                    value={summary?.lastInvoiceDate ? formatDate(summary.lastInvoiceDate) : '—'}
                  />
                </dl>
              )}
            </Card>

            <Card title="Billing" padding="sm">
              {summaryLoading || !customer ? (
                <SkeletonText lines={4} />
              ) : (
                <dl className="divide-y divide-line">
                  <DetailRow label="Billing address" value={customer.billingAddress || '—'} />
                  <DetailRow label="City" value={customer.city || '—'} />
                  <DetailRow label="State" value={customer.state || '—'} />
                  <DetailRow
                    label="GSTIN"
                    value={customer.gstin ? <span className="font-mono">{customer.gstin}</span> : '—'}
                  />
                  <DetailRow
                    label="Loyalty points"
                    value={<span className="font-mono">{customer.loyaltyPoints ?? 0}</span>}
                  />
                </dl>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'purchases' && (
        <div className="flex flex-col gap-3">
          {purchasesError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {purchasesError}
            </p>
          )}
          <DataTable
            columns={purchaseColumns}
            rows={purchases ?? []}
            getRowId={(row) => row._id}
            isLoading={purchasesLoading}
            caption="Purchase history"
            initialSort={{ key: 'invoiceDate', direction: 'desc' }}
            emptyState={
              <EmptyState
                icon={<InboxIcon size={20} />}
                title="No purchases yet"
                description="Invoices generated for this customer will appear here."
              />
            }
            renderMobileCard={(row) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-ink">{row.invoiceNumber}</p>
                    <p className="truncate text-xs text-ink-muted">{formatDate(row.invoiceDate)}</p>
                  </div>
                  <Badge tone={paymentStatusTone(row.paymentStatus)} dot>
                    {PURCHASE_STATUS_LABEL[row.paymentStatus] ?? row.paymentStatus}
                  </Badge>
                </div>
                <p className="truncate text-xs text-ink-muted">
                  {row.items.map((item) => item.name).join(', ') || '—'}
                </p>
                <dl className="flex flex-col gap-1 border-t border-line pt-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Amount</dt>
                    <dd className="font-mono text-sm">{formatCurrency(row.finalAmount)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Paid</dt>
                    <dd className="font-mono text-sm text-success">{formatCurrency(row.amountPaid)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Balance</dt>
                    <dd className="font-mono text-sm text-warning">{formatCurrency(row.balance)}</dd>
                  </div>
                </dl>
                <div onClick={(event) => event.stopPropagation()}>
                  <Button
                    variant="secondary"
                    className="mt-1"
                    onClick={() => navigate(`/invoices?invoice=${row._id}`)}
                  >
                    Open invoice
                  </Button>
                </div>
              </div>
            )}
          />

          {purchases && purchases.length > 0 && (
            <Card padding="sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-ink-muted">Total purchase value</p>
                  <p className="font-mono text-base font-semibold text-ink">
                    {formatCurrency(purchaseTotals.value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Total paid</p>
                  <p className="font-mono text-base font-semibold text-success">
                    {formatCurrency(purchaseTotals.paid)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Total outstanding</p>
                  <p className="font-mono text-base font-semibold text-warning">
                    {formatCurrency(purchaseTotals.outstanding)}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="flex flex-col gap-3">
          {paymentsError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {paymentsError}
            </p>
          )}
          <DataTable
            columns={paymentColumns}
            rows={payments ?? []}
            getRowId={(row) => row._id}
            isLoading={paymentsLoading}
            caption="Payments"
            emptyState={
              <EmptyState
                icon={<ReceiptIcon size={20} />}
                title="No payments recorded"
                description="Payments recorded against this customer's invoices will appear here."
              />
            }
            renderMobileCard={(row) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${row.status === 'REVERSED' ? 'text-ink-muted line-through' : 'text-ink'}`}
                    >
                      {formatCurrency(row.amount)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatDate(row.date)} · {paymentMethodLabel(row.method)}
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
                  Invoice {row.invoiceId?.invoiceNumber ?? '—'} · Recorded by{' '}
                  {row.createdBy?.username ?? 'System'}
                </p>
              </div>
            )}
          />
        </div>
      )}

      {tab === 'ledger' && (
        <div className="flex flex-col gap-3">
          {ledgerError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {ledgerError}
            </p>
          )}
          <DataTable
            columns={ledgerColumns}
            rows={ledger ?? []}
            getRowId={(row) => `${row.date}-${row.type}-${row.reference ?? ''}-${row.balance}`}
            isLoading={ledgerLoading}
            caption="Customer ledger"
            emptyState={
              <EmptyState
                icon={<FileTextIcon size={20} />}
                title="Ledger is empty"
                description="Invoices and payments for this customer will build the ledger here."
              />
            }
            renderMobileCard={(row) => (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-sm text-ink">{formatDate(row.date)}</span>
                  <Badge tone={row.type === 'invoice' ? 'info' : 'success'} dot>
                    {row.type === 'invoice' ? 'Invoice' : 'Payment'}
                  </Badge>
                </div>
                {row.reference && (
                  <p className="font-mono text-xs text-ink-muted">{row.reference}</p>
                )}
                <dl className="flex flex-col gap-1 border-t border-line pt-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Debit</dt>
                    <dd className="font-mono text-sm">{row.debit ? formatCurrency(row.debit) : '—'}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Credit</dt>
                    <dd className="font-mono text-sm text-success">
                      {row.credit ? formatCurrency(row.credit) : '—'}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Balance</dt>
                    <dd className="font-mono text-sm font-semibold">{formatCurrency(row.balance)}</dd>
                  </div>
                </dl>
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}

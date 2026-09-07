import { type Dispatch } from 'react'
import { apiClient } from '../../api/client'
import {
  AlertIcon,
  Badge,
  Button,
  Card,
  DataTable,
  EditIcon,
  FigureStack,
  MetalSwatch,
  useToast,
  type Column,
} from '../../components'
import { extractErrorMessage, formatCurrency } from '../../utils/format'
import ActionBar from './ActionBar'
import { cartSubtotal, lineTaxTotal, lineTotal, type Action, type WizardState } from './state'
import type { CartLine, CheckoutResult } from './types'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  cheque: 'Cheque',
  'bank-transfer': 'Bank transfer',
  other: 'Other',
}

const COMM_PREF_LABELS: Record<string, string> = {
  sms: 'SMS',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

interface Props {
  state: WizardState
  dispatch: Dispatch<Action>
  onEditProducts: () => void
  onEditCustomer: () => void
  onEditBilling: () => void
  onBack: () => void
}

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="ghost" size="sm" leftIcon={<EditIcon size={16} />} onClick={onClick}>
      {label}
    </Button>
  )
}

export default function ReviewStep({
  state,
  dispatch,
  onEditProducts,
  onEditCustomer,
  onEditBilling,
  onBack,
}: Props) {
  const toast = useToast()
  const subtotal = cartSubtotal(state.cart)
  const orderDiscount = Number(state.orderDiscount) || 0
  const totalTax = state.cart.reduce((sum, line) => sum + lineTaxTotal(line), 0)
  const grandTotal = Math.max(subtotal - orderDiscount, 0)
  const amountPaid = Number(state.amountPaid) || 0
  const balanceDue = grandTotal - amountPaid

  async function handleConfirm() {
    if (!state.customer || state.isSubmitting) return
    dispatch({ type: 'CHECKOUT_START' })
    try {
      const body = {
        customerId: state.customer._id,
        items: state.cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discount: line.discount || undefined,
        })),
        discount: orderDiscount || undefined,
        billingAddress: state.billingAddress || undefined,
        communicationPreferences: state.communicationPreferences.length
          ? state.communicationPreferences
          : undefined,
        payment: { method: state.paymentMethod, amountPaid },
        notes: state.notes || undefined,
      }
      const { data } = await apiClient.post<CheckoutResult>('/sales/checkout', body)
      dispatch({ type: 'CHECKOUT_SUCCESS', result: data })
    } catch (err) {
      const message = extractErrorMessage(err)
      dispatch({ type: 'CHECKOUT_ERROR', message })
      toast.error(message)
    }
  }

  const effectiveBillingAddress = state.billingAddress || state.customer?.address || '—'

  const columns: Column<CartLine>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (line) => (
        <span className="block">
          <span className="block font-medium text-ink">{line.name}</span>
          <span className="mt-0.5 block font-mono text-xs text-ink-muted">{line.sku}</span>
        </span>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      width: '72px',
      render: (line) => <span className="font-mono">{line.quantity}</span>,
    },
    {
      key: 'unitPrice',
      header: 'Unit price',
      align: 'right',
      render: (line) => (
        <span className="font-mono">
          {line.unitPrice != null ? formatCurrency(line.unitPrice) : '—'}
        </span>
      ),
    },
    {
      key: 'discount',
      header: 'Discount',
      align: 'right',
      render: (line) => (
        <span className="font-mono">{line.discount ? `-${formatCurrency(line.discount)}` : '—'}</span>
      ),
    },
    {
      key: 'tax',
      header: 'Tax',
      align: 'right',
      render: (line) => <span className="font-mono">{formatCurrency(lineTaxTotal(line))}</span>,
    },
    {
      key: 'total',
      header: 'Line total',
      align: 'right',
      render: (line) => (
        <span className="font-mono font-semibold">{formatCurrency(lineTotal(line))}</span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <Card
        title="Customer"
        actions={<EditButton label="Edit" onClick={onEditCustomer} />}
        className="scroll-mt-4"
      >
        <p className="text-sm font-medium text-ink">{state.customer?.name}</p>
        <p className="mt-0.5 font-mono text-sm text-ink-muted">{state.customer?.phone}</p>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">{effectiveBillingAddress}</p>
        {state.communicationPreferences.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            Invoice sent via
            {state.communicationPreferences.map((pref) => (
              <Badge key={pref} tone="info">
                {COMM_PREF_LABELS[pref] ?? pref}
              </Badge>
            ))}
          </p>
        )}
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">Products</h2>
          <EditButton label="Edit" onClick={onEditProducts} />
        </div>
        <DataTable
          columns={columns}
          rows={state.cart}
          getRowId={(line) => line.productId}
          caption="Items in this sale"
          renderMobileCard={(line) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{line.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                    <span className="font-mono">{line.sku}</span>
                    <MetalSwatch
                      metal={line.metalType}
                      label={`${line.metalType} ${line.purity}`}
                      className="text-xs capitalize text-ink-muted"
                    />
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-ink">
                  {formatCurrency(lineTotal(line))}
                </span>
              </div>
              <p className="mt-2 font-mono text-xs text-ink-muted">
                {line.quantity} ×{' '}
                {line.unitPrice != null ? formatCurrency(line.unitPrice) : '—'}
                {line.discount ? ` − ${formatCurrency(line.discount)}` : ''}
              </p>
            </div>
          )}
        />

        <Card className="mt-3">
          <FigureStack
            rows={[
              { label: 'Items subtotal', value: subtotal },
              ...(orderDiscount > 0
                ? [{ label: 'Order discount', value: -orderDiscount, tone: 'success' as const }]
                : []),
              { label: 'Tax included in prices', value: totalTax },
            ]}
            total={{ label: 'Order total', value: grandTotal }}
          />
        </Card>
      </section>

      <Card title="Payment" actions={<EditButton label="Edit" onClick={onEditBilling} />}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-muted">Method</span>
          <Badge tone="neutral">
            {PAYMENT_METHOD_LABELS[state.paymentMethod] ?? state.paymentMethod}
          </Badge>
        </div>
        <FigureStack
          size="sm"
          rows={[
            { label: 'Order total', value: grandTotal },
            { label: 'Amount paid', value: amountPaid },
            {
              label: 'Balance due',
              value: balanceDue,
              tone: balanceDue > 0 ? 'danger' : 'success',
            },
          ]}
        />
        {state.notes && (
          <p className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">{state.notes}</p>
        )}
      </Card>

      <ActionBar
        back={{ label: 'Back', onClick: onBack, disabled: state.isSubmitting }}
        primary={{
          label: state.isSubmitting ? 'Confirming sale' : 'Confirm sale',
          onClick: handleConfirm,
          loading: state.isSubmitting,
        }}
        message={
          state.checkoutError ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              <AlertIcon size={16} className="mt-0.5 shrink-0" />
              <span>
                {state.checkoutError} Nothing has been charged — your cart and details are still
                here, so you can fix it and confirm again.
              </span>
            </p>
          ) : (
            <p className="text-xs text-ink-muted">
              Confirming reserves the stock, creates the order and issues the invoice. This cannot be
              undone from here.
            </p>
          )
        }
      />
    </div>
  )
}

import axios from 'axios'
import { type Dispatch, useState } from 'react'
import { checkout, type BelowValueApproval, type CheckoutRejection } from '../../api/sales'
import {
  AlertIcon,
  Badge,
  Button,
  Card,
  DataTable,
  EditIcon,
  FigureStack,
  MetalSwatch,
  Skeleton,
  useToast,
  type Column,
} from '../../components'
import { extractErrorMessage, formatCurrency } from '../../utils/format'
import ActionBar from './ActionBar'
import BelowValueApprovalModal from './BelowValueApprovalModal'
import { formatMakingCharge } from './pricing-format'
import { amountPaidValue, orderTotal, type Action, type WizardState } from './state'
import type { BelowValueWarning, SaleLine } from './types'

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
  const { calculation, isCalculating, calculationError } = state
  const amountPaid = amountPaidValue(state)
  const grandTotal = orderTotal(state)
  const balanceDue = grandTotal - amountPaid

  const [approvalOpen, setApprovalOpen] = useState(false)
  const [approvalWarnings, setApprovalWarnings] = useState<BelowValueWarning[]>([])
  const [approvalServerError, setApprovalServerError] = useState<string | null>(null)

  const effectiveBillingAddress = state.billingAddress || state.customer?.address || '—'

  async function runCheckout(approval: BelowValueApproval | undefined) {
    if (!state.customer || !calculation) return
    dispatch({ type: 'CHECKOUT_START' })
    setApprovalServerError(null)
    try {
      const body = {
        customerId: state.customer._id,
        items: state.cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discount: line.discount || undefined,
          makingChargeOverride: line.makingChargeOverride,
        })),
        billingType: state.billingType,
        discount: Number(state.orderDiscount) || undefined,
        billingAddress: state.billingAddress || undefined,
        communicationPreferences: state.communicationPreferences.length
          ? state.communicationPreferences
          : undefined,
        payment: { method: state.paymentMethod, amountPaid },
        notes: state.notes || undefined,
        belowValueApproval: approval,
      }
      const data = await checkout(body)
      setApprovalOpen(false)
      dispatch({ type: 'CHECKOUT_SUCCESS', result: data })
    } catch (err) {
      const status = axios.isAxiosError<CheckoutRejection>(err) ? err.response?.status : undefined
      const rejection = axios.isAxiosError<CheckoutRejection>(err) ? err.response?.data : undefined

      if (status === 409) {
        // Expected workflow, not an alarming error: the backend found
        // below-value lines and wants an explicit confirmation. The backend
        // does not currently echo `warnings` on this response body, so fall
        // back to the last successful calculation's warnings, which is the
        // same list in every case except the rare rate-changed-mid-checkout
        // race — acceptable, since that race re-triggers this same modal.
        dispatch({ type: 'CHECKOUT_NEEDS_APPROVAL' })
        setApprovalWarnings(rejection?.warnings?.length ? rejection.warnings : calculation.warnings)
        setApprovalOpen(true)
        return
      }

      if (status === 403) {
        dispatch({
          type: 'CHECKOUT_ERROR',
          message:
            rejection?.message ??
            'This sale needs manager approval. Ask a manager to approve it before you can complete this sale.',
        })
        return
      }

      if (status === 400 && approvalOpen) {
        // Reason was required but missing/rejected server-side — keep the
        // modal open and show it inline rather than bouncing to Review.
        setApprovalServerError(extractErrorMessage(err))
        dispatch({ type: 'CHECKOUT_NEEDS_APPROVAL' })
        return
      }

      const message = extractErrorMessage(err)
      dispatch({ type: 'CHECKOUT_ERROR', message })
      toast.error(message)
    }
  }

  function handleConfirm() {
    if (!state.customer || state.isSubmitting || !calculation) return
    if (calculation.warnings.length > 0 && !state.belowValueApproval) {
      setApprovalWarnings(calculation.warnings)
      setApprovalServerError(null)
      setApprovalOpen(true)
      return
    }
    runCheckout(state.belowValueApproval ?? undefined)
  }

  function handleApprovalConfirm(reason: string) {
    const approval: BelowValueApproval = { approved: true, reason: reason || undefined }
    dispatch({ type: 'SET_BELOW_VALUE_APPROVAL', approval })
    runCheckout(approval)
  }

  const columns: Column<SaleLine>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (line) => (
        <span className="block">
          <span className="block font-medium text-ink">{line.name}</span>
          <MetalSwatch metal={line.metalType} label={String(line.purity)} className="mt-0.5 text-xs text-ink-muted" />
        </span>
      ),
    },
    {
      key: 'weightGrams',
      header: 'Weight',
      align: 'right',
      render: (line) => <span className="font-mono">{line.weightGrams} g</span>,
    },
    {
      key: 'goldRate',
      header: 'Gold rate',
      align: 'right',
      render: (line) => <span className="font-mono">{formatCurrency(line.goldRate)}/g</span>,
    },
    {
      key: 'currentCost',
      header: 'Current cost',
      align: 'right',
      render: (line) => <span className="font-mono">{formatCurrency(line.currentCost)}</span>,
    },
    {
      key: 'makingCharge',
      header: 'Making charge',
      align: 'right',
      render: (line) => (
        <span className="block">
          <span className="font-mono">
            {formatMakingCharge(line.saleMakingChargeType, line.saleMakingChargeValue)}
          </span>
          {line.makingChargeAdjusted && (
            <span className="mt-0.5 block text-xs text-ink-muted">
              Default {formatMakingCharge(line.defaultMakingChargeType, line.defaultMakingChargeValue)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'sellingPrice',
      header: 'Selling price',
      align: 'right',
      render: (line) => (
        <span className="block">
          <span className="font-mono font-semibold">{formatCurrency(line.sellingPrice)}</span>
          {line.belowCurrentCost && (
            <span className="mt-0.5 block text-xs text-warning">
              {formatCurrency(Math.abs(line.difference))} below cost
            </span>
          )}
        </span>
      ),
    },
  ]

  const gstRows =
    calculation && calculation.billingType === 'GST'
      ? calculation.isInterState
        ? [{ label: 'IGST', value: calculation.igstAmount }]
        : [
            { label: 'CGST', value: calculation.cgstAmount },
            { label: 'SGST', value: calculation.sgstAmount },
          ]
      : [{ label: 'GST', value: 'Not applicable' }]

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
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <span className="text-xs text-ink-muted">Billing type</span>
          <Badge tone="neutral">{state.billingType === 'GST' ? 'GST' : 'Non-GST'}</Badge>
          {state.communicationPreferences.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
              Invoice via
              {state.communicationPreferences.map((pref) => (
                <Badge key={pref} tone="info">
                  {COMM_PREF_LABELS[pref] ?? pref}
                </Badge>
              ))}
            </span>
          )}
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">Products</h2>
          <EditButton label="Edit" onClick={onEditProducts} />
        </div>

        {calculation ? (
          <>
            <DataTable
              columns={columns}
              rows={calculation.lines}
              getRowId={(line) => line.productId}
              caption="Items in this sale, priced by the pricing service"
              renderMobileCard={(line) => (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{line.name}</p>
                      <MetalSwatch
                        metal={line.metalType}
                        label={`${line.purity} · ${line.weightGrams} g`}
                        className="mt-0.5 text-xs text-ink-muted"
                      />
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-ink">
                      {formatCurrency(line.sellingPrice)}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-xs text-ink-muted">
                    Current cost {formatCurrency(line.currentCost)} · making{' '}
                    {formatMakingCharge(line.saleMakingChargeType, line.saleMakingChargeValue)}
                  </p>
                  {line.belowCurrentCost && (
                    <p className="mt-1 text-xs text-warning">
                      {formatCurrency(Math.abs(line.difference))} below current cost
                    </p>
                  )}
                </div>
              )}
            />

            <Card className="mt-3">
              <FigureStack
                rows={[
                  { label: 'Current cost', value: calculation.currentCostTotal },
                  { label: 'Making charges', value: calculation.makingChargeTotal },
                  ...(calculation.lineDiscountTotal > 0
                    ? [{ label: 'Line discounts', value: -calculation.lineDiscountTotal, tone: 'success' as const }]
                    : []),
                  ...(calculation.orderDiscount > 0
                    ? [{ label: 'Order discount', value: -calculation.orderDiscount, tone: 'success' as const }]
                    : []),
                  { label: 'Taxable amount', value: calculation.taxableAmount },
                  ...gstRows,
                ]}
                total={{ label: 'Grand total', value: calculation.grandTotal }}
              />
            </Card>

            {calculation.warnings.length > 0 && (
              <div
                role="alert"
                className="mt-3 rounded-panel border border-warning bg-warning-soft p-3 text-sm text-warning"
              >
                <p className="flex items-start gap-2 font-medium">
                  <AlertIcon size={16} className="mt-0.5 shrink-0" />
                  {calculation.warnings.length === 1
                    ? '1 item is priced below its current cost.'
                    : `${calculation.warnings.length} items are priced below their current cost.`}
                </p>
                <ul className="mt-2 space-y-1 pl-6 text-xs">
                  {calculation.warnings.map((warning) => (
                    <li key={warning.productId} className="list-disc">
                      {warning.productName} — {formatCurrency(Math.abs(warning.difference))} below cost
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : calculationError ? (
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <AlertIcon size={16} className="mt-0.5 shrink-0" />
            {calculationError}
          </p>
        ) : (
          <Card>
            <div className="space-y-2" aria-live="polite" aria-busy={isCalculating}>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </Card>
        )}
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
          disabled: !calculation,
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

      <BelowValueApprovalModal
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        warnings={approvalWarnings}
        policy={state.salesPolicy}
        submitting={state.isSubmitting}
        serverError={approvalServerError}
        onConfirm={handleApprovalConfirm}
      />
    </div>
  )
}

import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../api/client'
import { useAuth } from '../../auth'
import {
  Badge,
  BoxIcon,
  Button,
  Card,
  Drawer,
  Field,
  FigureStack,
  Input,
  MetalSwatch,
  Modal,
  ScaleIcon,
  Select,
  Textarea,
  useToast,
} from '../../components'
import { extractErrorMessage, formatCurrency, formatDate, toDateInputValue } from '../../utils/format'
import { orderPaymentStatusTone } from '../../utils/ui'
import {
  customerName,
  customerPhone,
  fulfillmentLabel,
  fulfillmentTone,
  journeyPosition,
  priceVariancePercent,
  statusLabel,
} from './helpers'
import MarkReadyModal from './MarkReadyModal'
import OrderJourney from './OrderJourney'
import StatusOverride from './StatusOverride'
import {
  isCustomItem,
  PAYMENT_METHODS,
  type ConvertToProductResponse,
  type CreatedProduct,
  type CustomOrderItem,
  type Order,
  type OrderStatus,
  type PaymentMethod,
} from './types'

/** Sentence-cases the `paymentStatus` union (`unpaid`/`partial`/`paid`) for display. */
function paymentStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

/** Looks up the friendly label for a payment method, falling back to the raw
 * value for anything unrecognised rather than crashing. */
function paymentMethodLabel(method: string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method
}

interface CustomItemDetailProps {
  item: CustomOrderItem
  isCancelled: boolean
  isPrivileged: boolean
  /** Present only when this item was converted during the current session —
   * that is the one moment the SKU is in hand without a second fetch. */
  createdProduct?: CreatedProduct
  converting: boolean
  onMarkReady: () => void
  onConvert: () => void
  onViewProduct: (productId: string) => void
}

/**
 * One custom/made-to-order line. A finished item now IS stock, so the card
 * reads as inventory once converted: the badge says "In stock", the
 * confirmation names the SKU, and the specs actually recorded on the day sit
 * next to the estimate they were quoted against — that comparison is the audit
 * trail the shop argues from, and it lived nowhere in the app before.
 */
function CustomItemDetail({
  item,
  isCancelled,
  isPrivileged,
  createdProduct,
  converting,
  onMarkReady,
  onConvert,
  onViewProduct,
}: CustomItemDetailProps) {
  const isPending = item.fulfillmentStatus === 'pending'
  const hasFinals = item.finalNetWeight != null && item.finalPurity != null
  const variance = priceVariancePercent(item.estimatedPrice, item.finalPrice)
  const difference = item.finalPrice - item.estimatedPrice
  // Legacy only: items marked ready before conversion became automatic. Never
  // rendered for a converted item, which would 400 every time it was pressed.
  const showLegacyConvert = isPrivileged && !isCancelled && item.fulfillmentStatus === 'ready' && !item.productId

  return (
    <div className="rounded-panel border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">Custom order</Badge>
            <Badge tone={fulfillmentTone(item.fulfillmentStatus)}>{fulfillmentLabel(item.fulfillmentStatus)}</Badge>
          </div>
          <p className="mt-1 font-medium text-ink">{item.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <MetalSwatch metal={item.metalType} label={`${item.metalType} ${item.purity}%`} className="text-xs" />
            <span>·</span>
            <span>{item.category || 'Uncategorised'}</span>
            <span>·</span>
            <span className="font-mono">
              {hasFinals ? `${item.finalNetWeight} g final` : `${item.estimatedWeight} g est.`}
            </span>
            <span>·</span>
            <span className="font-mono">Qty {item.quantity}</span>
          </p>
          {item.description && <p className="mt-2 max-w-prose text-sm text-ink-muted">{item.description}</p>}
        </div>
      </div>

      <FigureStack
        rows={[
          { label: 'Metal value', value: item.spotPrice },
          { label: 'Making', value: item.markup },
          { label: 'GST', value: item.tax },
        ]}
        total={{ label: hasFinals ? 'Final value' : 'Estimated value', value: item.finalPrice }}
        size="sm"
      />

      {hasFinals && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-sm font-medium text-ink">Recorded when the piece was finished</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-ink-muted">Gross weight</dt>
              <dd className="font-mono text-sm text-ink">{item.finalGrossWeight} g</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Net weight</dt>
              <dd className="font-mono text-sm text-ink">{item.finalNetWeight} g</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Purity</dt>
              <dd className="font-mono text-sm text-ink">{item.finalPurity}%</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Rate used</dt>
              <dd className="font-mono text-sm text-ink">
                {item.finalGoldRate != null ? `${formatCurrency(item.finalGoldRate)} / g` : '—'}
              </dd>
            </div>
          </dl>

          <FigureStack
            className="mt-3"
            size="sm"
            rows={[
              { label: 'Estimated at booking', value: item.estimatedPrice },
              { label: 'Final value', value: item.finalPrice },
            ]}
            total={{
              label: 'Difference',
              value: `${difference < 0 ? '−' : '+'}${formatCurrency(Math.abs(difference))}`,
              hint:
                variance === null
                  ? 'No estimate was recorded for this item.'
                  : `${variance < 0 ? 'Under' : 'Over'} the estimate by ${Math.abs(variance).toFixed(1)}%.`,
              tone: variance !== null && Math.abs(variance) > 10 ? 'danger' : 'default',
            }}
          />
        </div>
      )}

      {createdProduct && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-control bg-success-soft px-3 py-2">
          <p className="flex items-center gap-2 text-sm text-success">
            <BoxIcon size={16} className="shrink-0" />
            <span>
              Added to inventory as <span className="font-mono font-medium">{createdProduct.sku}</span>
            </span>
          </p>
          <Button size="sm" variant="ghost" onClick={() => onViewProduct(createdProduct._id)}>
            View product
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {isPending &&
          (isCancelled ? (
            <p className="text-xs text-ink-muted">This order is cancelled. Reopen it before marking the item ready.</p>
          ) : (
            <Button size="sm" variant="secondary" leftIcon={<ScaleIcon size={16} />} onClick={onMarkReady}>
              Mark ready and add to stock
            </Button>
          ))}
        {showLegacyConvert && (
          <>
            <Button size="sm" variant="secondary" loading={converting} onClick={onConvert}>
              Add to stock
            </Button>
            <p className="text-xs text-ink-muted">
              Marked ready before stock was created automatically, so it still needs adding.
            </p>
          </>
        )}
        {item.productId && !createdProduct && (
          <Button size="sm" variant="ghost" onClick={() => onViewProduct(item.productId as string)}>
            View product
          </Button>
        )}
      </div>
    </div>
  )
}

interface Props {
  order: Order | null
  onClose: () => void
  onOrderUpdated: (order: Order) => void
}

/** Order detail: the journey indicator, delivery editor, and the line-item
 * list — stock-linked lines exactly as before, custom/made-to-order lines with
 * their fulfillment badge, the mark-ready action, and the estimate-vs-final
 * audit trail once the piece has been made. */
export function OrderDetailDrawer({ order, onClose, onOrderUpdated }: Props) {
  const toast = useToast()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const isPrivileged = hasRole('admin', 'manager')

  const [editingDelivery, setEditingDelivery] = useState(false)
  const [editDeliveryDate, setEditDeliveryDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [statusUpdating, setStatusUpdating] = useState(false)
  const [markReadyIndex, setMarkReadyIndex] = useState<number | null>(null)
  const [convertingIndex, setConvertingIndex] = useState<number | null>(null)
  /** Products created during this session, keyed `orderId:itemIndex`. The order
   * item only stores a productId, so the SKU — the thing staff actually read
   * out — is only in hand right after conversion. Keying by order as well as
   * index means one order's confirmation can never surface on another. */
  const [createdProducts, setCreatedProducts] = useState<Record<string, CreatedProduct>>({})

  const [addPaymentOpen, setAddPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  if (!order) return null

  function openAddPayment() {
    setPaymentAmount('')
    setPaymentMethod('cash')
    setPaymentDate(toDateInputValue(new Date().toISOString()))
    setPaymentReference('')
    setPaymentNotes('')
    setPaymentError(null)
    setAddPaymentOpen(true)
  }

  async function handleAddPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!order) return
    setPaymentError(null)
    const amount = Number(paymentAmount)
    if (!paymentAmount || !(amount > 0)) {
      setPaymentError('Enter an amount greater than 0.')
      return
    }
    setPaymentSubmitting(true)
    try {
      const { data } = await apiClient.post<Order>(`/orders/${order._id}/advance-payments`, {
        amount,
        method: paymentMethod,
        date: paymentDate || undefined,
        reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      })
      setAddPaymentOpen(false)
      toast.success('Payment recorded')
      onOrderUpdated(data)
    } catch (err) {
      setPaymentError(extractErrorMessage(err))
    } finally {
      setPaymentSubmitting(false)
    }
  }

  function openDeliveryEditor() {
    if (!order) return
    setEditingDelivery(true)
    setEditDeliveryDate(toDateInputValue(order.deliveryDate))
    setEditNotes(order.notes ?? '')
    setEditError(null)
  }

  async function handleDeliverySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!order) return
    setEditError(null)
    setIsSavingEdit(true)
    try {
      const { data } = await apiClient.put<Order>(`/orders/${order._id}`, {
        deliveryDate: editDeliveryDate || undefined,
        notes: editNotes || undefined,
      })
      setEditingDelivery(false)
      toast.success('Delivery details saved')
      onOrderUpdated(data)
    } catch (err) {
      setEditError(extractErrorMessage(err))
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleStatusChange(status: OrderStatus) {
    if (!order) return
    setStatusUpdating(true)
    try {
      const { data } = await apiClient.patch<Order>(`/orders/${order._id}/status`, { status })
      toast.success(`Order moved to ${statusLabel(status).toLowerCase()}`)
      onOrderUpdated(data)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleConvertLegacyItem(index: number) {
    if (!order) return
    setConvertingIndex(index)
    try {
      const { data } = await apiClient.post<ConvertToProductResponse>(
        `/orders/${order._id}/items/${index}/convert-to-product`,
        {},
      )
      setCreatedProducts((prev) => ({ ...prev, [`${order._id}:${index}`]: data.product }))
      toast.success(`Added to inventory as ${data.product.sku}`)
      onOrderUpdated(data.order)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setConvertingIndex(null)
    }
  }

  const markReadyItem = markReadyIndex !== null ? order.items[markReadyIndex] : null
  const position = journeyPosition(order.status)
  const isCancelled = position.cancelled
  // The one forward move nothing automates, so it stays a plain visible action.
  const canStartManufacturing = !isCancelled && !position.offJourney && position.index <= 1 && order.status !== 'in_manufacturing'

  return (
    <>
      <Drawer
        open={order !== null}
        onClose={onClose}
        title={`Order for ${customerName(order.customerId)}`}
        description={`Placed ${formatDate(order.createdAt)}`}
        size="lg"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          <Card
            title="Order journey"
            description={`Currently ${statusLabel(order.status)}.`}
            actions={
              isCancelled ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange('confirmed')}
                >
                  Reopen order
                </Button>
              ) : order.status !== 'completed' ? (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange('cancelled')}
                >
                  Cancel order
                </Button>
              ) : undefined
            }
          >
            <OrderJourney status={order.status} />

            <div className="mt-4 border-t border-line pt-3">
              {canStartManufacturing && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mb-3"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange('in_manufacturing')}
                >
                  Start manufacturing
                </Button>
              )}
              <StatusOverride status={order.status} disabled={statusUpdating} onSelect={handleStatusChange} />
            </div>
          </Card>

          <Card
            title="Customer and delivery"
            actions={!editingDelivery ? <Button variant="ghost" size="sm" onClick={openDeliveryEditor}>Edit</Button> : undefined}
          >
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-muted">Customer</dt>
                <dd className="text-right text-ink">{customerName(order.customerId)}</dd>
              </div>
              {customerPhone(order.customerId) && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Phone</dt>
                  <dd className="text-right font-mono text-ink">{customerPhone(order.customerId)}</dd>
                </div>
              )}
            </dl>

            {editingDelivery ? (
              <form onSubmit={handleDeliverySubmit} className="mt-4 space-y-3 border-t border-line pt-4">
                <Field label="Delivery date" error={editError ?? undefined}>
                  <Input type="date" value={editDeliveryDate} onChange={(e) => setEditDeliveryDate(e.target.value)} />
                </Field>
                <Field label="Notes">
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" loading={isSavingEdit}>
                    Save changes
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditingDelivery(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="mt-2 space-y-2 border-t border-line pt-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Delivery date</dt>
                  <dd className="text-right font-mono text-ink">{formatDate(order.deliveryDate)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Notes</dt>
                  <dd className="max-w-[60%] text-right text-ink">{order.notes || '—'}</dd>
                </div>
              </dl>
            )}
          </Card>

          <Card
            title="Advance / token payments"
            description={
              order.advancePayments.length > 0
                ? `${order.advancePayments.length} payment${order.advancePayments.length === 1 ? '' : 's'} recorded.`
                : 'No payments recorded yet.'
            }
            actions={
              <Button variant="secondary" size="sm" onClick={openAddPayment}>
                Add payment
              </Button>
            }
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs text-ink-muted">Payment status</span>
              <Badge tone={orderPaymentStatusTone(order.paymentStatus)}>{paymentStatusLabel(order.paymentStatus)}</Badge>
            </div>

            {order.advancePayments.length > 0 && (
              <ul className="mb-3 divide-y divide-line border-y border-line">
                {[...order.advancePayments]
                  .reverse()
                  .map((payment) => (
                    <li key={payment._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-ink">{formatCurrency(payment.amount)}</span>
                        <Badge tone="neutral">{paymentMethodLabel(payment.method)}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <span className="font-mono">{formatDate(payment.date)}</span>
                        {payment.reference && <span className="font-mono">Ref {payment.reference}</span>}
                      </div>
                    </li>
                  ))}
              </ul>
            )}

            <FigureStack
              size="sm"
              rows={[{ label: 'Advance received', value: order.advanceTotal, tone: 'success' }]}
              total={{ label: 'Balance due', value: order.balanceDue }}
            />
          </Card>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-ink">
              Line items <span className="font-mono text-sm font-normal text-ink-muted">({order.items.length})</span>
            </h3>
            {order.items.map((item, index) => {
              if (isCustomItem(item)) {
                return (
                  <CustomItemDetail
                    key={index}
                    item={item}
                    isCancelled={isCancelled}
                    isPrivileged={isPrivileged}
                    createdProduct={createdProducts[`${order._id}:${index}`]}
                    converting={convertingIndex === index}
                    onMarkReady={() => setMarkReadyIndex(index)}
                    onConvert={() => handleConvertLegacyItem(index)}
                    onViewProduct={(productId) => navigate(`/products/${productId}`)}
                  />
                )
              }

              return (
                <div key={index} className="rounded-panel border border-line bg-surface p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{item.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                        <MetalSwatch metal={item.metalType} label={`${item.metalType} ${item.purity}`} className="text-xs" />
                        <span className="font-mono">{item.weightGrams} g</span>
                        <span>·</span>
                        <span className="font-mono">Qty {item.quantity}</span>
                      </p>
                    </div>
                  </div>
                  <FigureStack
                    rows={[
                      { label: 'Metal value', hint: `${item.weightGrams} g × ${item.quantity}`, value: item.spotPrice },
                      { label: 'Making', value: item.markup },
                      { label: 'Labour', value: item.laborCost },
                      { label: 'GST', value: item.tax },
                      ...(item.discount ? [{ label: 'Discount', value: -item.discount, tone: 'success' as const }] : []),
                    ]}
                    total={{ label: 'Line total', value: item.finalPrice }}
                    size="sm"
                  />
                </div>
              )
            })}
          </section>

          <Card title="Order total">
            <FigureStack
              rows={[
                ...order.items.map((item) => ({ label: item.name, hint: `Quantity ${item.quantity}`, value: item.finalPrice })),
                ...(order.discount ? [{ label: 'Order discount', value: -order.discount, tone: 'success' as const }] : []),
              ]}
              total={{ label: 'Order total', value: order.totalAmount }}
            />
          </Card>
        </div>
      </Drawer>

      {markReadyItem && isCustomItem(markReadyItem) && markReadyIndex !== null && (
        <MarkReadyModal
          open
          orderId={order._id}
          itemIndex={markReadyIndex}
          item={markReadyItem}
          isPrivileged={isPrivileged}
          onClose={() => setMarkReadyIndex(null)}
          onSuccess={(updated, createdProduct) => {
            const index = markReadyIndex
            setMarkReadyIndex(null)
            if (createdProduct && index !== null) {
              setCreatedProducts((prev) => ({ ...prev, [`${order._id}:${index}`]: createdProduct }))
            }
            onOrderUpdated(updated)
          }}
        />
      )}

      <Modal
        open={addPaymentOpen}
        onClose={paymentSubmitting ? () => {} : () => setAddPaymentOpen(false)}
        title="Add payment"
        description={`Record an installment toward the ${formatCurrency(order.balanceDue)} balance due.`}
        closeOnBackdrop={!paymentSubmitting}
        closeOnEscape={!paymentSubmitting}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddPaymentOpen(false)} disabled={paymentSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="add-payment-form" loading={paymentSubmitting}>
              Record payment
            </Button>
          </>
        }
      >
        <form id="add-payment-form" onSubmit={handleAddPayment} className="space-y-3" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Method">
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                options={PAYMENT_METHODS}
              />
            </Field>
            <Field label="Date">
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </Field>
            <Field label="Reference" hint="Optional.">
              <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
            </Field>
            <Field label="Notes" hint="Optional." className="sm:col-span-2">
              <Textarea rows={2} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
            </Field>
          </div>
          {paymentError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {paymentError}
            </p>
          )}
        </form>
      </Modal>
    </>
  )
}

export default OrderDetailDrawer

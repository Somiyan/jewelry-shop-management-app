import { useState } from 'react'
import { apiClient } from '../../api/client'
import { Button, Field, FigureStack, Input, Modal, Tabs, useToast, type TabItem } from '../../components'
import { extractErrorMessage, formatCurrency } from '../../utils/format'
import { toNumber } from '../productShared'
import type { CreatedProduct, CustomOrderItem, MakingChargeType, MarkReadyResponse } from './types'

const makingChargeTabs: TabItem<MakingChargeType>[] = [
  { id: 'percentage', label: 'Percentage' },
  { id: 'per_gram', label: '₹ per gram' },
]

interface ReadyRequestBody {
  finalGrossWeight: number
  finalNetWeight: number
  finalPurity: number
  wastagePercentage?: number
  makingChargeType?: MakingChargeType
  makingChargeValue?: number
  goldRateOverride?: number
  confirmVariance?: boolean
  sku?: string
  barcode?: string
}

interface VarianceResponse {
  requiresConfirmation: true
  estimatedPrice: number
  recalculatedFinalPrice: number
  variancePercent: number
}

interface Props {
  open: boolean
  orderId: string
  itemIndex: number
  item: CustomOrderItem
  isPrivileged: boolean
  onClose: () => void
  onSuccess: (order: MarkReadyResponse, createdProduct: CreatedProduct | null) => void
}

/**
 * Records the final specs for a custom/made-to-order item — and, since the
 * backend now converts on the same request, creates the product and books it
 * into stock. That is the part the salesperson has to understand before they
 * press the button, so it is stated at the top of the sheet and again on the
 * button itself.
 *
 * Weights and purity are always editable — wastage/making-charge/rate-override
 * are admin/manager only, matching ProductFormPage's restricted-field
 * convention, and are simply omitted from the request body for a
 * non-privileged user (rather than sent-but-disabled) so the backend never
 * sees them as "touched".
 */
export function MarkReadyModal({ open, orderId, itemIndex, item, isPrivileged, onClose, onSuccess }: Props) {
  const toast = useToast()

  const [finalGrossWeight, setFinalGrossWeight] = useState(String(item.estimatedWeight))
  const [finalNetWeight, setFinalNetWeight] = useState(String(item.estimatedWeight))
  const [finalPurity, setFinalPurity] = useState(String(item.purity))
  const [wastagePercentage, setWastagePercentage] = useState(String(item.wastagePercentage ?? 0))
  const [makingChargeType, setMakingChargeType] = useState<MakingChargeType>(item.makingChargeType)
  const [makingChargeValue, setMakingChargeValue] = useState(String(item.makingChargeValue))
  const [rateOverride, setRateOverride] = useState('')
  const [sku, setSku] = useState('')
  const [barcode, setBarcode] = useState('')

  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Set when the order itself blocks the action (it was cancelled), which no
   * amount of re-entering weights will fix — so the submit is closed off
   * rather than left to fail again. */
  const [blocked, setBlocked] = useState(false)
  const [variance, setVariance] = useState<{ response: VarianceResponse; body: ReadyRequestBody } | null>(null)

  const grossNum = toNumber(finalGrossWeight)
  const netNum = toNumber(finalNetWeight)
  const purityNum = toNumber(finalPurity)

  const errors = {
    gross: grossNum === null || grossNum <= 0 ? 'Required, greater than 0.' : undefined,
    net: netNum === null || netNum <= 0 ? 'Required, greater than 0.' : undefined,
    purity: purityNum === null || purityNum <= 0 || purityNum > 100 ? 'Must be between 0 and 100.' : undefined,
    grossVsNet:
      grossNum !== null && netNum !== null && netNum > grossNum ? 'Net weight cannot exceed gross weight.' : undefined,
  }
  const hasErrors = Boolean(errors.gross || errors.net || errors.purity || errors.grossVsNet)

  function buildBody(confirmVariance?: boolean): ReadyRequestBody {
    const body: ReadyRequestBody = {
      finalGrossWeight: Number(finalGrossWeight),
      finalNetWeight: Number(finalNetWeight),
      finalPurity: Number(finalPurity),
    }
    if (isPrivileged) {
      body.wastagePercentage = Number(wastagePercentage) || 0
      body.makingChargeType = makingChargeType
      body.makingChargeValue = Number(makingChargeValue) || 0
      const override = toNumber(rateOverride)
      if (override !== null && override > 0) body.goldRateOverride = override
    }
    const trimmedSku = sku.trim()
    const trimmedBarcode = barcode.trim()
    if (trimmedSku) body.sku = trimmedSku
    if (trimmedBarcode) body.barcode = trimmedBarcode
    if (confirmVariance) body.confirmVariance = true
    return body
  }

  async function submit(body: ReadyRequestBody) {
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiClient.patch<MarkReadyResponse | VarianceResponse>(
        `/orders/${orderId}/items/${itemIndex}/ready`,
        body,
      )
      if ('requiresConfirmation' in data && data.requiresConfirmation) {
        setVariance({ response: data, body })
        return
      }
      const order = data as MarkReadyResponse
      const product = order.createdProduct ?? null
      toast.success(product ? `Added to inventory as ${product.sku}` : 'Item marked ready')
      onSuccess(order, product)
    } catch (err) {
      const message = extractErrorMessage(err)
      setError(message)
      setBlocked(/cancelled/i.test(message))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit() {
    setSubmitAttempted(true)
    if (hasErrors) return
    submit(buildBody())
  }

  function confirmAnyway() {
    if (!variance) return
    submit({ ...variance.body, confirmVariance: true })
  }

  if (variance) {
    const { estimatedPrice, recalculatedFinalPrice, variancePercent } = variance.response
    return (
      <Modal
        open={open}
        onClose={loading ? () => {} : onClose}
        title="Price differs from the estimate"
        description="The recalculated final price is more than 10% away from the original estimate. Confirm before this is saved and the piece is added to stock."
        closeOnBackdrop={!loading}
        closeOnEscape={!loading}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVariance(null)} disabled={loading}>
              Adjust
            </Button>
            <Button variant="danger" onClick={confirmAnyway} loading={loading} disabled={blocked}>
              Confirm and add to stock
            </Button>
          </>
        }
      >
        <FigureStack
          rows={[
            { label: 'Estimated price', value: estimatedPrice },
            { label: 'Recalculated final price', value: recalculatedFinalPrice },
          ]}
          total={{ label: 'Variance', value: `${variancePercent.toFixed(1)}%`, tone: 'danger' }}
        />
        {error && (
          <p role="alert" className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title="Mark ready and add to stock"
      description={item.name}
      size="lg"
      closeOnBackdrop={!loading}
      closeOnEscape={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={blocked}>
            Mark ready and add to stock
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-control bg-info-soft px-3 py-2.5 text-sm text-info">
          Saving this records the final specs, creates the product and books it into stock. The piece becomes sellable
          straight away, and this order moves on once every custom item is done.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Final gross weight" required error={submitAttempted ? errors.gross : undefined}>
            <Input
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={finalGrossWeight}
              onChange={(e) => setFinalGrossWeight(e.target.value)}
              className="font-mono"
              rightSlot={<span className="pr-2 text-xs text-ink-muted">g</span>}
            />
          </Field>
          <Field
            label="Final net weight"
            required
            error={submitAttempted ? errors.net ?? errors.grossVsNet : undefined}
          >
            <Input
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={finalNetWeight}
              onChange={(e) => setFinalNetWeight(e.target.value)}
              className="font-mono"
              rightSlot={<span className="pr-2 text-xs text-ink-muted">g</span>}
            />
          </Field>
          <Field label="Final purity %" required error={submitAttempted ? errors.purity : undefined}>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={finalPurity}
              onChange={(e) => setFinalPurity(e.target.value)}
              className="font-mono"
            />
          </Field>
        </div>

        {isPrivileged ? (
          <div className="grid grid-cols-1 gap-4 rounded-panel border border-line p-3 sm:grid-cols-2">
            <Field label="Wastage %">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={wastagePercentage}
                onChange={(e) => setWastagePercentage(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Override gold rate" hint="Optional. Leave blank to use the live rate.">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={rateOverride}
                onChange={(e) => setRateOverride(e.target.value)}
                className="font-mono"
              />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-ink">Making charge</p>
              <Tabs
                items={makingChargeTabs}
                value={makingChargeType}
                onChange={setMakingChargeType}
                label="Making charge type"
                className="mb-3"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={makingChargeValue}
                onChange={(e) => setMakingChargeValue(e.target.value)}
                className="w-full font-mono sm:max-w-xs"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-control border border-line px-3 py-2.5 text-sm">
            <p className="text-ink-muted">Wastage, making charge and rate override</p>
            <p className="font-mono tabular-nums text-ink">
              {item.wastagePercentage ?? 0}% wastage ·{' '}
              {item.makingChargeType === 'percentage'
                ? `${item.makingChargeValue}% making`
                : `${formatCurrency(item.makingChargeValue)}/g making`}
            </p>
            <p className="mt-1 text-xs text-ink-muted">Only admins and managers can change this.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 rounded-panel border border-line p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-ink">Inventory details</p>
            <p className="mt-0.5 text-xs text-ink-muted">Both optional — fill these in only if the tag is already made.</p>
          </div>
          <Field label="SKU" hint="Leave blank and one is generated from the category, e.g. SN-0006.">
            <Input value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" placeholder="Auto" />
          </Field>
          <Field label="Barcode" hint="Optional.">
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="font-mono" />
          </Field>
        </div>

        <p className="rounded-control bg-sunken px-3 py-2 text-xs text-ink-muted">
          Original estimate: <span className="font-mono text-ink">{formatCurrency(item.estimatedPrice)}</span>. If the
          recalculated price is more than 10% away from this, you'll be asked to confirm before it's saved.
        </p>

        {error && (
          <div role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            <p>{error}</p>
            {blocked && (
              <p className="mt-1 text-xs text-danger">
                Reopen the order from the journey panel, then mark this item ready.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default MarkReadyModal

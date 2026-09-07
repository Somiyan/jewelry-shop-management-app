import { useState } from 'react'
import {
  Badge,
  Button,
  Field,
  FigureStack,
  Input,
  MetalSwatch,
  Modal,
  Select,
  Tabs,
  Textarea,
  type TabItem,
} from '../../components'
import { formatCurrency } from '../../utils/format'
import { toNumber } from '../productShared'
import { estimateCustomItem, defaultSizeUnitForCategory, relativeTime } from './helpers'
import {
  ORDER_PURITY_PRESETS,
  SIZE_UNITS,
  resolvedCategory,
  resolvedPurity,
  type Category,
  type CustomItemDraft,
  type MakingChargeType,
  type MetalRatesResponse,
  type MetalType,
  type SizeUnit,
} from './types'

const purityOptions = [...ORDER_PURITY_PRESETS, { value: 'custom', label: 'Custom' }]
const metalOptions: { value: MetalType; label: string }[] = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
]
const makingChargeTabs: TabItem<MakingChargeType>[] = [
  { id: 'percentage', label: 'Percentage' },
  { id: 'per_gram', label: '₹ per gram' },
]

interface Props {
  open: boolean
  draft: CustomItemDraft
  isEditing: boolean
  categories: Category[]
  categoriesError: string | null
  metalRates: MetalRatesResponse | null
  ratesLoading: boolean
  ratesError: string | null
  canOverrideRate: boolean
  onClose: () => void
  onSave: (draft: CustomItemDraft) => void
}

interface FormErrors {
  itemName?: string
  category?: string
  weight?: string
  purity?: string
}

function computeErrors(draft: CustomItemDraft): FormErrors {
  const errors: FormErrors = {}
  if (!draft.itemName.trim()) errors.itemName = 'Give this piece a name — it prints on the karigar slip.'
  if (!resolvedCategory(draft)) errors.category = 'Pick a category, or choose "Other" and name it.'
  const weight = toNumber(draft.estimatedWeight)
  if (weight === null || weight <= 0) errors.weight = 'Estimated weight must be greater than 0.'
  const purity = resolvedPurity(draft)
  if (purity === null || purity <= 0 || purity > 100) errors.purity = 'Purity must be a percentage between 0 and 100.'
  return errors
}

/**
 * Add/edit a custom, made-to-order line item. Two columns from `sm`: specs on
 * the left, live rate + making charge + the estimate on the right — the
 * "assay stack" preview is clearly labelled an estimate throughout, since the
 * committed price only exists once `POST /api/orders` actually runs.
 */
export function CustomItemModal({
  open,
  draft: initialDraft,
  isEditing,
  categories,
  categoriesError,
  metalRates,
  ratesLoading,
  ratesError,
  canOverrideRate,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<CustomItemDraft>(initialDraft)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)

  function update<K extends keyof CustomItemDraft>(key: K, value: CustomItemDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function selectCategory(value: string) {
    update('categorySelect', value)
    // Only auto-suggest a size unit while the field is still at its default —
    // don't clobber something the user already picked deliberately.
    if (draft.sizeUnit === 'custom' && value !== '__other__') {
      update('sizeUnit', defaultSizeUnitForCategory(value))
    }
  }

  const errors = computeErrors(draft)
  const hasErrors = Object.keys(errors).length > 0

  const liveRate =
    metalRates === null
      ? null
      : (draft.metalType === 'gold' ? metalRates.gold : metalRates.silver)?.ratePerGram ?? null
  const rateUpdatedAt =
    metalRates === null ? null : (draft.metalType === 'gold' ? metalRates.gold : metalRates.silver)?.createdAt ?? null

  const rateOverrideNum = canOverrideRate ? toNumber(draft.rateOverride) : null
  const effectiveRate = rateOverrideNum ?? liveRate

  const weightNum = toNumber(draft.estimatedWeight) ?? 0
  const purityNum = resolvedPurity(draft) ?? 0
  const makingValueNum = toNumber(draft.makingChargeValue) ?? 0
  const quantityNum = toNumber(draft.quantity) ?? 1

  const estimate =
    effectiveRate !== null && effectiveRate > 0 && weightNum > 0 && purityNum > 0
      ? estimateCustomItem(weightNum, purityNum, draft.makingChargeType, makingValueNum, effectiveRate, quantityNum)
      : null

  function handleSubmit() {
    setSubmitAttempted(true)
    if (hasErrors) return
    onSave(draft)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit custom item' : 'Add custom item'}
      description="A made-to-order piece — no stock is touched until it's manufactured and converted later."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{isEditing ? 'Save item' : 'Add item'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* ---- specs column ---- */}
        <div className="flex flex-col gap-4">
          <Field label="Item name" required error={submitAttempted ? errors.itemName : undefined}>
            <Input
              value={draft.itemName}
              onChange={(e) => update('itemName', e.target.value)}
              placeholder="e.g. Bridal choker, custom design"
            />
          </Field>

          <Field
            label="Category"
            required
            error={submitAttempted ? errors.category : undefined}
            hint={categoriesError ? 'Category list unavailable — choose "Other" and type it in.' : undefined}
          >
            <Select value={draft.categorySelect} onChange={(e) => selectCategory(e.target.value)}>
              <option value="">Select a category…</option>
              {categories.map((category) => (
                <option key={category._id} value={category.name}>
                  {category.name}
                </option>
              ))}
              <option value="__other__">Other…</option>
            </Select>
          </Field>
          {draft.categorySelect === '__other__' && (
            <Field label="Category name" required error={submitAttempted ? errors.category : undefined}>
              <Input
                value={draft.categoryOther}
                onChange={(e) => update('categoryOther', e.target.value)}
                placeholder="Name this category"
              />
            </Field>
          )}

          <Field
            label="Description / customer requirement"
            hint="What the karigar needs to know — design notes, references, anything discussed at the counter."
          >
            <Textarea
              value={draft.description}
              onChange={(e) => update('description', e.target.value)}
              rows={5}
              placeholder="e.g. Antique finish, temple-style border, customer's own stone to be set…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Metal type">
              <Select
                value={draft.metalType}
                onChange={(e) => update('metalType', e.target.value as MetalType)}
                options={metalOptions}
              />
            </Field>
            <Field label="Quantity">
              <Input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={draft.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>

          <Field
            label="Estimated weight"
            required
            error={submitAttempted ? errors.weight : undefined}
            hint="Not the final weight — this is the estimate used to quote the customer."
          >
            <Input
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={draft.estimatedWeight}
              onChange={(e) => update('estimatedWeight', e.target.value)}
              className="font-mono"
              rightSlot={<span className="pr-2 text-xs text-ink-muted">g</span>}
            />
          </Field>

          <Field label="Purity" required error={submitAttempted ? errors.purity : undefined}>
            <Select value={draft.purityPreset} onChange={(e) => update('purityPreset', e.target.value)} options={purityOptions} />
          </Field>
          {draft.purityPreset === 'custom' && (
            <Field label="Custom purity %" required error={submitAttempted ? errors.purity : undefined}>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                value={draft.purityCustom}
                onChange={(e) => update('purityCustom', e.target.value)}
                className="font-mono"
              />
            </Field>
          )}

          <Field
            label="Wastage %"
            hint="Optional. Only affects the shop's internal cost estimate at this stage — never the customer-facing price."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={draft.wastagePercentage}
              onChange={(e) => update('wastagePercentage', e.target.value)}
              className="font-mono"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Size / length" hint="Optional.">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.sizeValue}
                onChange={(e) => update('sizeValue', e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Unit">
              <Select
                value={draft.sizeUnit}
                onChange={(e) => update('sizeUnit', e.target.value as SizeUnit)}
                options={SIZE_UNITS}
              />
            </Field>
          </div>
        </div>

        {/* ---- pricing column ---- */}
        <div className="flex flex-col gap-4">
          <div className="rounded-panel border border-line bg-sunken p-3">
            <div className="flex items-center justify-between gap-3">
              <MetalSwatch metal={draft.metalType} label={`${draft.metalType} live rate`} />
              <span className="font-mono text-sm tabular-nums text-ink">
                {ratesLoading ? 'Loading…' : liveRate !== null ? `${formatCurrency(liveRate)} / g` : '—'}
              </span>
            </div>
            {liveRate !== null && (
              <p className="mt-1 text-xs text-ink-muted">Live rate · updated {relativeTime(rateUpdatedAt)}</p>
            )}
            {ratesError && <p className="mt-1 text-xs text-danger">Live rate unavailable — {ratesError}</p>}
          </div>

          {canOverrideRate && (
            <Field label="Override rate" hint="Admin/manager only. Leave blank to use the live rate above.">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.rateOverride}
                onChange={(e) => update('rateOverride', e.target.value)}
                className="font-mono"
              />
            </Field>
          )}
          {rateOverrideNum !== null && rateOverrideNum > 0 && (
            <Badge tone="warning">Custom rate — {formatCurrency(rateOverrideNum)} / g</Badge>
          )}

          <div className="flex flex-col gap-3 rounded-panel border border-line p-3">
            <p className="text-sm font-medium text-ink">Making charge</p>
            <Tabs
              items={makingChargeTabs}
              value={draft.makingChargeType}
              onChange={(next) => update('makingChargeType', next)}
              label="Making charge type"
            />
            <Field
              label={draft.makingChargeType === 'percentage' ? 'Making charge %' : 'Making charge (₹ per gram)'}
              hideLabel
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draft.makingChargeValue}
                onChange={(e) => update('makingChargeValue', e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>

          <div className="rounded-panel border border-line p-3">
            <p className="text-xs text-ink-muted">Estimated item value</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-ink">
              {estimate ? `~${formatCurrency(estimate.subtotal)}` : '—'}
            </p>
            <p className="text-xs text-ink-muted">
              {estimate ? 'Before tax · calculated on save' : 'Enter weight, purity and a rate to see an estimate'}
            </p>

            {estimate && (
              <>
                <button
                  type="button"
                  onClick={() => setCalcOpen((v) => !v)}
                  className="mt-2 text-xs font-medium text-accent hover:underline"
                >
                  {calcOpen ? 'Hide calculation' : 'View calculation'}
                </button>
                {calcOpen && (
                  <div className="mt-3 border-t border-line pt-3">
                    <FigureStack
                      size="sm"
                      rows={[
                        {
                          label: 'Metal value',
                          hint: `${weightNum} g × ${purityNum}% × ${formatCurrency(effectiveRate ?? 0)}/g`,
                          value: estimate.metalValue,
                        },
                        {
                          label: 'Making charge',
                          hint:
                            draft.makingChargeType === 'percentage'
                              ? `${makingValueNum}% of metal value`
                              : `${formatCurrency(makingValueNum)}/g × ${weightNum} g`,
                          value: estimate.making,
                        },
                      ]}
                      total={{ label: 'Estimated value', hint: 'Before tax', value: estimate.subtotal }}
                    />
                    <p className="mt-2 text-xs text-ink-muted">
                      Tax and the committed final price are calculated by the server when the order is saved.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default CustomItemModal

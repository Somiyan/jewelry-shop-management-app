import { type Dispatch, type FormEvent, useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import {
  AlertIcon,
  Badge,
  BoxIcon,
  Button,
  Card,
  ChevronDownIcon,
  Drawer,
  EmptyState,
  Field,
  FigureStack,
  IconButton,
  Input,
  MetalSwatch,
  PlusIcon,
  SearchInput,
  Select,
  Skeleton,
  Textarea,
  TrashIcon,
  useToast,
} from '../../components'
import type { MakingChargeType, SaleLine } from '../../api/sales'
import { PURITY_PRESETS } from '../productShared'
import { cx } from '../../utils/cx'
import { extractErrorMessage, formatCurrency } from '../../utils/format'
import { stockLevelLabel, stockLevelTone } from '../../utils/ui'
import ActionBar from './ActionBar'
import { BILLING_TYPES, MAKING_CHARGE_TYPES, formatMakingCharge } from './pricing-format'
import { cartItemCount, type Action, type WizardState } from './state'
import TabToggle from './TabToggle'
import type { CartLine, MetalType, Product, ProductType } from './types'

const PRODUCT_TYPES: ProductType[] = ['ring', 'necklace', 'bracelet', 'earring', 'pendant']
const METAL_TYPES: MetalType[] = ['gold', 'silver']

const NEW_PRODUCT_FORM_ID = 'new-product-form'

const PURITY_SELECT_OPTIONS = [...PURITY_PRESETS, { value: 'custom', label: 'Custom' }]

interface NewProductForm {
  name: string
  type: ProductType
  metalType: MetalType
  purityPreset: string
  purityCustom: string
  /** Quick-add treats gross and net weight as the same figure — no separate stone weight tracked here. Matches the Product module's own required fields, just without the two-field split. */
  weightGrams: string
  wastagePercentage: string
  makingChargeType: MakingChargeType
  makingChargeValue: string
  sku: string
  quantity: string
  barcode: string
  category: string
  hsnCode: string
  image: string
  description: string
}

const emptyNewProduct: NewProductForm = {
  name: '',
  type: 'ring',
  metalType: 'gold',
  purityPreset: '91.6',
  purityCustom: '',
  weightGrams: '',
  wastagePercentage: '0',
  makingChargeType: 'percentage',
  makingChargeValue: '0',
  sku: '',
  quantity: '',
  barcode: '',
  category: '',
  hsnCode: '',
  image: '',
  description: '',
}

/** Title-cases the API's lowercase enum values for display only. */
function sentence(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** No minus glyph exists in the icon set; the stepper needs one. */
function MinusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14" />
    </svg>
  )
}

interface Props {
  state: WizardState
  dispatch: Dispatch<Action>
  onContinue: () => void
}

export default function ProductStep({ state, dispatch, onContinue }: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<'existing' | 'new'>('existing')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [cartOpen, setCartOpen] = useState(false)

  const [form, setForm] = useState<NewProductForm>(emptyNewProduct)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsSearching(true)
    const handle = setTimeout(() => {
      apiClient
        .get<Product[]>('/products', { params: { inStock: 'true', ...(q.trim() ? { q: q.trim() } : {}) } })
        .then(({ data }) => {
          if (cancelled) return
          setResults(data)
          setSearchError(null)
        })
        .catch((err: unknown) => {
          if (!cancelled) setSearchError(extractErrorMessage(err))
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [q])

  function updateField<K extends keyof NewProductForm>(key: K, value: NewProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSelectProduct(product: Product) {
    if (product.level === 'red') return
    dispatch({ type: 'ADD_OR_BUMP_CART_LINE', product })
    toast.success(`${product.name} added to the cart`)
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const purity = form.purityPreset === 'custom' ? Number(form.purityCustom) : Number(form.purityPreset)
    if (!purity || purity <= 0 || purity > 100) {
      setFormError('Enter a purity percentage between 0 and 100.')
      return
    }
    const weight = Number(form.weightGrams)
    if (!weight || weight <= 0) {
      setFormError('Enter a weight greater than 0.')
      return
    }

    setIsSubmittingForm(true)
    try {
      const body = {
        name: form.name,
        type: form.type,
        metalType: form.metalType,
        purity,
        // Quick add: gross and net weight are the same figure here — no
        // separate stone weight tracked. Matches the Product module's own
        // required fields (see ProductFormPage), just without the two-field
        // split; edit the product later in Stock if that distinction matters.
        grossWeight: weight,
        netWeight: weight,
        wastagePercentage: Number(form.wastagePercentage) || 0,
        makingChargeType: form.makingChargeType,
        makingChargeValue: Number(form.makingChargeValue) || 0,
        sku: form.sku,
        quantity: Number(form.quantity),
        barcode: form.barcode || undefined,
        category: form.category || undefined,
        hsnCode: form.hsnCode || undefined,
        image: form.image || undefined,
        description: form.description || undefined,
      }
      const { data } = await apiClient.post<Product>('/products', body)
      dispatch({ type: 'ADD_OR_BUMP_CART_LINE', product: data })
      setForm(emptyNewProduct)
      setTab('existing')
      toast.success(`${data.name} created and added to the cart`)
    } catch (err) {
      const message = extractErrorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSubmittingForm(false)
    }
  }

  const itemCount = cartItemCount(state.cart)
  const isEmpty = state.cart.length === 0
  const { calculation, isCalculating, calculationError } = state
  const canAdjustMakingCharge = state.salesPolicy?.canAdjustMakingCharge ?? false

  const totals = calculation ? (
    <FigureStack
      rows={[
        {
          label: itemCount === 1 ? '1 item · current cost' : `${itemCount} items · current cost`,
          value: calculation.currentCostTotal,
        },
        { label: 'Making charges', value: calculation.makingChargeTotal },
        ...(calculation.lineDiscountTotal > 0
          ? [{ label: 'Line discounts', value: -calculation.lineDiscountTotal, tone: 'success' as const }]
          : []),
        {
          label: calculation.billingType === 'GST' ? 'GST' : 'Tax (Non-GST bill)',
          value: calculation.taxAmount,
        },
      ]}
      total={{ label: 'Cart total', value: calculation.grandTotal }}
    />
  ) : calculationError ? (
    <p role="alert" className="flex items-start gap-2 text-sm text-danger">
      <AlertIcon size={16} className="mt-0.5 shrink-0" />
      {calculationError}
    </p>
  ) : (
    <div className="space-y-2" aria-live="polite" aria-busy="true">
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-2/3" />
    </div>
  )

  const cartLines = (
    <div className="divide-y divide-line">
      {state.cart.map((line) => (
        <CartLineRow
          key={line.productId}
          line={line}
          dispatch={dispatch}
          calcLine={calculation?.lines.find((l) => l.productId === line.productId)}
          canAdjustMakingCharge={canAdjustMakingCharge}
          isCalculating={isCalculating}
        />
      ))}
    </div>
  )

  // Same choice as the Billing step, surfaced here too so the salesperson can
  // see GST-inclusive vs Non-GST pricing while still building the cart —
  // switching here only recalculates tax, same as everywhere else this
  // control appears; the cart itself is never affected.
  const billingTypeToggle = (
    <div className="border-b border-line p-3 sm:p-4">
      <TabToggle
        label="Billing type"
        value={state.billingType}
        onChange={(value) => dispatch({ type: 'SET_BILLING_TYPE', value })}
        options={BILLING_TYPES}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <TabToggle
        label="Product source"
        value={tab}
        onChange={(value) => {
          setTab(value)
          if (value === 'existing') setFormError(null)
        }}
        options={[
          { value: 'existing', label: 'Existing product' },
          { value: 'new', label: 'New product' },
        ]}
      />

      <Card padding="none">
        <div className="border-b border-line p-3 sm:p-4">
          <SearchInput
            value={q}
            onValueChange={setQ}
            placeholder="Search by name, SKU, barcode or category"
            aria-label="Search products"
            autoFocus
          />
          {searchError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {searchError}
            </p>
          )}
        </div>

        <div className="max-h-[26rem] overflow-y-auto">
          {isSearching && results.length === 0 ? (
            <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <li key={row} className="rounded-panel border border-line bg-surface p-3">
                  <Skeleton className="h-3.5 w-3/5" />
                  <Skeleton className="mt-2 h-2.5 w-1/3" />
                  <Skeleton className="mt-3 h-2.5 w-2/5" />
                  <Skeleton className="mt-4 h-4 w-1/2" />
                </li>
              ))}
            </ul>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<BoxIcon size={20} />}
              title="No products match that search"
              description="Try a different name, SKU or barcode — or add the piece as a new product."
              action={
                <Button variant="secondary" leftIcon={<PlusIcon size={16} />} onClick={() => setTab('new')}>
                  New product
                </Button>
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((product) => (
                <li key={product._id} className="h-full">
                  <ProductResultCard product={product} onSelect={handleSelectProduct} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card
        title="Cart"
        description={isEmpty ? undefined : `${itemCount} item${itemCount === 1 ? '' : 's'}`}
        padding="none"
      >
        {isEmpty ? (
          <EmptyState
            icon={<BoxIcon size={20} />}
            title="Nothing in the cart yet"
            description="Search above and tap a product to add it. Quantities and discounts can be adjusted here."
          />
        ) : (
          <>
            {billingTypeToggle}
            {cartLines}
            <div className="border-t border-line p-3 sm:p-4">{totals}</div>
          </>
        )}
      </Card>

      <ActionBar
        summary={
          !isEmpty && (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-expanded={cartOpen}
              className="flex w-full items-center justify-between gap-3 rounded-control bg-sunken px-3 py-2.5 text-left md:hidden"
            >
              <span className="text-sm text-ink">
                {itemCount} item{itemCount === 1 ? '' : 's'} in cart
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-ink" aria-live="polite">
                  {calculation ? formatCurrency(calculation.grandTotal) : '…'}
                </span>
                <ChevronDownIcon size={16} className="rotate-180 text-ink-muted" />
              </span>
            </button>
          )
        }
        primary={{
          label: 'Continue to customer',
          onClick: onContinue,
          disabled: isEmpty,
        }}
      />

      <Drawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Cart"
        description={`${itemCount} item${itemCount === 1 ? '' : 's'}`}
        size="md"
        footer={
          <Button fullWidth onClick={() => setCartOpen(false)}>
            Back to search
          </Button>
        }
      >
        {isEmpty ? (
          <p className="text-sm text-ink-muted">Nothing in the cart yet.</p>
        ) : (
          <div className="-mx-4">
            {billingTypeToggle}
            {cartLines}
            <div className="border-t border-line px-4 pt-4">{totals}</div>
          </div>
        )}
      </Drawer>

      <Drawer
        open={tab === 'new'}
        onClose={() => setTab('existing')}
        title="New product"
        description="Created in stock, then added straight to this sale."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTab('existing')}>
              Cancel
            </Button>
            <Button type="submit" form={NEW_PRODUCT_FORM_ID} loading={isSubmittingForm}>
              Create product
            </Button>
          </>
        }
      >
        <form
          id={NEW_PRODUCT_FORM_ID}
          onSubmit={handleCreateProduct}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          noValidate
        >
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>
          <Field label="SKU" required>
            <Input value={form.sku} onChange={(event) => updateField('sku', event.target.value)} />
          </Field>
          <Field label="Type" required>
            <Select
              value={form.type}
              onChange={(event) => updateField('type', event.target.value as ProductType)}
              options={PRODUCT_TYPES.map((type) => ({ value: type, label: sentence(type) }))}
            />
          </Field>
          <Field label="Metal" required>
            <Select
              value={form.metalType}
              onChange={(event) => updateField('metalType', event.target.value as MetalType)}
              options={METAL_TYPES.map((metal) => ({ value: metal, label: sentence(metal) }))}
            />
          </Field>
          <Field label="Purity" required>
            <Select
              value={form.purityPreset}
              onChange={(event) => updateField('purityPreset', event.target.value)}
              options={PURITY_SELECT_OPTIONS}
            />
          </Field>
          {form.purityPreset === 'custom' && (
            <Field label="Custom purity" required hint="Percentage, e.g. 91.6.">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={form.purityCustom}
                onChange={(event) => updateField('purityCustom', event.target.value)}
                className="font-mono"
              />
            </Field>
          )}
          <Field label="Weight" required hint="In grams — used as both gross and net weight for a quick add.">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.weightGrams}
              onChange={(event) => updateField('weightGrams', event.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Quantity" required hint="Pieces available to sell.">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              value={form.quantity}
              onChange={(event) => updateField('quantity', event.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Wastage" hint="Percentage. Affects cost, not selling price.">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.wastagePercentage}
              onChange={(event) => updateField('wastagePercentage', event.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Making charge">
            <div className="flex items-center gap-2">
              <TabToggle
                label="Making charge type"
                value={form.makingChargeType}
                onChange={(value) => updateField('makingChargeType', value)}
                options={MAKING_CHARGE_TYPES}
              />
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={form.makingChargeValue}
                onChange={(event) => updateField('makingChargeValue', event.target.value)}
                className="w-24 shrink-0 font-mono"
              />
            </div>
          </Field>
          <Field label="Barcode" hint="Optional.">
            <Input
              value={form.barcode}
              onChange={(event) => updateField('barcode', event.target.value)}
            />
          </Field>
          <Field label="Category" hint="Optional.">
            <Input
              value={form.category}
              onChange={(event) => updateField('category', event.target.value)}
            />
          </Field>
          <Field label="HSN code" hint="Optional. Printed on the invoice line.">
            <Input
              value={form.hsnCode}
              onChange={(event) => updateField('hsnCode', event.target.value)}
            />
          </Field>
          <Field label="Image URL" hint="Optional." className="sm:col-span-2">
            <Input value={form.image} onChange={(event) => updateField('image', event.target.value)} />
          </Field>
          <Field label="Description" hint="Optional." className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
            />
          </Field>

          {formError && (
            <p
              role="alert"
              className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2"
            >
              {formError}
            </p>
          )}

          <p className="text-xs text-ink-muted sm:col-span-2">
            The price is calculated by the shop's pricing service once the product is saved.
          </p>
        </form>
      </Drawer>
    </div>
  )
}

/**
 * A search result, presented as a self-contained ledger entry rather than a
 * product photo tile — the real catalogue has almost no photos, so identity
 * here comes from typography plus the metal dot, not an image slot. Price is
 * the largest figure on the card (it's what the salesperson and customer
 * actually care about); a hairline rule separates "what it is" from "what it
 * costs", echoing the assay-stack rule-above-total without duplicating it.
 *
 * Out of stock gets a full status-tinted card, not just a corner badge — a
 * dimmed row (or a small chip alone) is too easy to miss while tapping
 * through a grid quickly during a live sale.
 */
function ProductResultCard({
  product,
  onSelect,
}: {
  product: Product
  onSelect: (product: Product) => void
}) {
  const outOfStock = product.level === 'red'

  return (
    <button
      type="button"
      disabled={outOfStock}
      onClick={() => onSelect(product)}
      aria-label={`Add ${product.name} to the cart`}
      className={cx(
        'flex h-full w-full flex-col rounded-panel border p-3 text-left transition-colors duration-150',
        outOfStock
          ? 'cursor-not-allowed border-danger/40 bg-danger-soft'
          : 'border-line bg-surface hover:border-accent/40 hover:bg-sunken',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span
          className={cx(
            'min-w-0 flex-1 truncate text-sm font-medium',
            outOfStock ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {product.name}
        </span>
        <Badge tone={stockLevelTone(product.level)} dot className="shrink-0">
          {stockLevelLabel(product.level)}
          {!outOfStock && <span className="font-mono"> · {product.quantity}</span>}
        </Badge>
      </span>

      <span className="mt-1 block truncate font-mono text-xs text-ink-muted">{product.sku}</span>

      <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
        <MetalSwatch
          metal={product.metalType}
          label={`${sentence(product.metalType)} ${product.purity}`}
          className="text-xs text-ink-muted"
        />
        <span className="font-mono">{product.weightGrams} g</span>
        {product.category && <span className="truncate">{product.category}</span>}
      </span>

      <span className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
        {product.price ? (
          <span
            className={cx(
              'font-mono text-base font-semibold tabular-nums',
              outOfStock ? 'text-ink-muted' : 'text-ink',
            )}
          >
            {formatCurrency(product.price.finalPrice)}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-warning">
            <AlertIcon size={12} className="shrink-0" />
            {product.priceError ?? 'Price unavailable'}
          </span>
        )}
      </span>
    </button>
  )
}

interface CartLineRowProps {
  line: CartLine
  dispatch: Dispatch<Action>
  calcLine: SaleLine | undefined
  canAdjustMakingCharge: boolean
  isCalculating: boolean
}

function CartLineRow({ line, dispatch, calcLine, canAdjustMakingCharge, isCalculating }: CartLineRowProps) {
  const activeType: MakingChargeType =
    line.makingChargeOverride?.type ?? calcLine?.saleMakingChargeType ?? 'percentage'
  const activeValue =
    line.makingChargeOverride?.value ?? calcLine?.saleMakingChargeValue ?? calcLine?.defaultMakingChargeValue ?? 0

  function setMakingCharge(patch: { type?: MakingChargeType; value?: number }) {
    dispatch({
      type: 'SET_LINE_MAKING_CHARGE',
      productId: line.productId,
      override: { type: patch.type ?? activeType, value: patch.value ?? activeValue },
    })
  }

  return (
    <div className="p-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{line.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
            <span className="font-mono">{line.sku}</span>
            <MetalSwatch
              metal={line.metalType}
              label={`${sentence(line.metalType)} ${line.purity}`}
              className="text-xs text-ink-muted"
            />
            <span className="font-mono">{line.weightGrams}g</span>
          </p>
        </div>
        <IconButton
          label={`Remove ${line.name}`}
          variant="danger"
          size="sm"
          onClick={() => dispatch({ type: 'REMOVE_CART_LINE', productId: line.productId })}
        >
          <TrashIcon size={16} />
        </IconButton>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <IconButton
          label={`Decrease quantity of ${line.name}`}
          variant="secondary"
          disabled={line.quantity <= 1}
          onClick={() =>
            dispatch({
              type: 'UPDATE_CART_LINE',
              productId: line.productId,
              patch: { quantity: line.quantity - 1 },
            })
          }
        >
          <MinusIcon />
        </IconButton>
        <span
          className="w-10 text-center font-mono text-sm text-ink"
          aria-live="polite"
          aria-label={`Quantity ${line.quantity}`}
        >
          {line.quantity}
        </span>
        <IconButton
          label={`Increase quantity of ${line.name}`}
          variant="secondary"
          disabled={line.quantity >= line.availableQuantity}
          onClick={() =>
            dispatch({
              type: 'UPDATE_CART_LINE',
              productId: line.productId,
              patch: { quantity: line.quantity + 1 },
            })
          }
        >
          <PlusIcon size={16} />
        </IconButton>
        <span className="ml-1 text-xs text-ink-muted">
          of <span className="font-mono">{line.availableQuantity}</span> in stock
        </span>
      </div>

      <div className="mt-3 rounded-panel bg-sunken p-3" aria-live="polite">
        {calcLine ? (
          <>
            <FigureStack
              size="sm"
              rows={[
                { label: 'Current cost', value: calcLine.currentCost },
                { label: 'Making charge', value: calcLine.makingChargeAmount },
              ]}
              total={{ label: 'Calculated selling price', value: calcLine.calculatedSellingPrice }}
            />

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink">Making charge</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {calcLine.makingChargeAdjusted ? (
                    <>
                      Default: {formatMakingCharge(calcLine.defaultMakingChargeType, calcLine.defaultMakingChargeValue)}
                      {' · Applied: '}
                      {formatMakingCharge(calcLine.saleMakingChargeType, calcLine.saleMakingChargeValue)}
                    </>
                  ) : (
                    <>Default: {formatMakingCharge(calcLine.defaultMakingChargeType, calcLine.defaultMakingChargeValue)}</>
                  )}
                </p>
              </div>

              {canAdjustMakingCharge ? (
                <div className="flex flex-wrap items-center gap-2">
                  <TabToggle
                    label={`Making charge type for ${line.name}`}
                    value={activeType}
                    onChange={(value) => setMakingCharge({ type: value })}
                    options={MAKING_CHARGE_TYPES}
                  />
                  <Field
                    label={`Making charge value for ${line.name}`}
                    hideLabel
                    id={`making-charge-${line.productId}`}
                    className="w-24 shrink-0"
                  >
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={activeValue || ''}
                      onChange={(event) => setMakingCharge({ value: Number(event.target.value) || 0 })}
                      className="text-right font-mono"
                    />
                  </Field>
                </div>
              ) : (
                <div className="flex items-center gap-2" aria-disabled="true">
                  <span className="inline-flex h-10 items-center rounded-control border border-line bg-surface px-3 text-sm text-ink-muted sm:h-9">
                    {activeType === 'percentage' ? 'Percentage' : 'Per gram'}
                  </span>
                  <Field
                    label={`Making charge value for ${line.name}`}
                    hideLabel
                    id={`making-charge-${line.productId}`}
                    className="w-24 shrink-0"
                  >
                    <Input
                      type="number"
                      value={activeValue}
                      disabled
                      readOnly
                      className="text-right font-mono"
                    />
                  </Field>
                </div>
              )}
            </div>

            {calcLine.makingChargeOverrideIgnored && (
              <p className="mt-2 text-xs text-warning">
                Making charge reverted to default — you don't have permission to adjust it.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
              <Field
                label="Discount"
                hideLabel
                id={`discount-${line.productId}`}
                className="w-28 shrink-0"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={line.discount || ''}
                  placeholder="Discount"
                  onChange={(event) =>
                    dispatch({
                      type: 'UPDATE_CART_LINE',
                      productId: line.productId,
                      patch: { discount: Number(event.target.value) || 0 },
                    })
                  }
                  className="text-right font-mono"
                />
              </Field>
              <div className="text-right">
                <p className="text-xs text-ink-muted">Final selling price</p>
                <p className="font-mono text-sm font-semibold text-ink">
                  {formatCurrency(calcLine.sellingPrice)}
                </p>
              </div>
            </div>

            <div className="mt-2">
              {calcLine.belowCurrentCost ? (
                <Badge tone="warning" icon={<AlertIcon size={12} />}>
                  {formatCurrency(Math.abs(calcLine.difference))} below current cost
                </Badge>
              ) : (
                <Badge tone="success">Above current cost</Badge>
              )}
            </div>
          </>
        ) : isCalculating ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            {line.unitPrice != null ? `${formatCurrency(line.unitPrice)} each (last known price)` : 'Price unavailable'}
          </p>
        )}
      </div>
    </div>
  )
}

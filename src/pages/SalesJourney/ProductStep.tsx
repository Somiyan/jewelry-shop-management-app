import { type Dispatch, type FormEvent, useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import {
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
import { cx } from '../../utils/cx'
import { extractErrorMessage, formatCurrency } from '../../utils/format'
import { stockLevelLabel, stockLevelTone } from '../../utils/ui'
import ActionBar from './ActionBar'
import {
  cartGross,
  cartItemCount,
  cartSubtotal,
  cartTaxTotal,
  lineTotal,
  type Action,
  type WizardState,
} from './state'
import TabToggle from './TabToggle'
import type { CartLine, MetalType, Product, ProductType, Purity } from './types'

const PRODUCT_TYPES: ProductType[] = ['ring', 'necklace', 'bracelet', 'earring', 'pendant']
const METAL_TYPES: MetalType[] = ['gold', 'silver']
const PURITIES: Purity[] = ['24K', '22K', '18K', '925']

const NEW_PRODUCT_FORM_ID = 'new-product-form'

interface NewProductForm {
  name: string
  type: ProductType
  metalType: MetalType
  purity: Purity
  weightGrams: string
  sku: string
  quantity: string
  barcode: string
  category: string
  image: string
  description: string
}

const emptyNewProduct: NewProductForm = {
  name: '',
  type: 'ring',
  metalType: 'gold',
  purity: '22K',
  weightGrams: '',
  sku: '',
  quantity: '',
  barcode: '',
  category: '',
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
        .get<Product[]>('/products', { params: q.trim() ? { q: q.trim() } : {} })
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
    setIsSubmittingForm(true)
    try {
      const body = {
        name: form.name,
        type: form.type,
        metalType: form.metalType,
        purity: form.purity,
        weightGrams: Number(form.weightGrams),
        sku: form.sku,
        quantity: Number(form.quantity),
        barcode: form.barcode || undefined,
        category: form.category || undefined,
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

  const subtotal = cartSubtotal(state.cart)
  const gross = cartGross(state.cart)
  const taxTotal = cartTaxTotal(state.cart)
  const lineDiscounts = gross - subtotal
  const itemCount = cartItemCount(state.cart)
  const isEmpty = state.cart.length === 0

  const totals = (
    <FigureStack
      rows={[
        {
          label: itemCount === 1 ? '1 item' : `${itemCount} items`,
          value: gross,
          hint: 'At the shop price on record',
        },
        ...(lineDiscounts > 0
          ? [{ label: 'Line discounts', value: -lineDiscounts, tone: 'success' as const }]
          : []),
        { label: 'Tax included in prices', value: taxTotal },
      ]}
      total={{ label: 'Cart subtotal', value: subtotal }}
    />
  )

  const cartLines = (
    <div className="divide-y divide-line">
      {state.cart.map((line) => (
        <CartLineRow key={line.productId} line={line} dispatch={dispatch} />
      ))}
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
            <ul className="divide-y divide-line">
              {[0, 1, 2, 3].map((row) => (
                <li key={row} className="flex items-center justify-between gap-4 px-3 py-3.5 sm:px-4">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-3 w-20" />
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
            <ul className="divide-y divide-line">
              {results.map((product) => (
                <li key={product._id}>
                  <ProductResultRow product={product} onSelect={handleSelectProduct} />
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
                <span className="font-mono text-sm font-semibold text-ink">
                  {formatCurrency(subtotal)}
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
              value={form.purity}
              onChange={(event) => updateField('purity', event.target.value as Purity)}
              options={PURITIES.map((purity) => ({ value: purity, label: purity }))}
            />
          </Field>
          <Field label="Weight" required hint="In grams, to two decimals.">
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

function ProductResultRow({
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
        'flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors duration-150 sm:px-4',
        outOfStock ? 'cursor-not-allowed opacity-60' : 'hover:bg-sunken',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{product.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
          <span className="font-mono">{product.sku}</span>
          <MetalSwatch
            metal={product.metalType}
            label={`${sentence(product.metalType)} ${product.purity}`}
            className="text-xs text-ink-muted"
          />
          <span className="font-mono">{product.weightGrams} g</span>
          {product.category && <span className="truncate">{product.category}</span>}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="font-mono text-sm font-medium text-ink">
          {product.price ? formatCurrency(product.price.finalPrice) : '—'}
        </span>
        <Badge tone={stockLevelTone(product.level)} dot>
          {stockLevelLabel(product.level)}
          {!outOfStock && <span className="font-mono"> · {product.quantity}</span>}
        </Badge>
        {!product.price && (
          <span className="text-xs text-warning">
            {product.priceError ?? 'Price unavailable'}
          </span>
        )}
      </span>
    </button>
  )
}

function CartLineRow({ line, dispatch }: { line: CartLine; dispatch: Dispatch<Action> }) {
  const total = lineTotal(line)

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
            <span className="font-mono">
              {line.unitPrice != null ? `${formatCurrency(line.unitPrice)} each` : 'Price unavailable'}
            </span>
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

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
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
          </div>
          <span className="text-xs text-ink-muted">
            of <span className="font-mono">{line.availableQuantity}</span> in stock
          </span>
        </div>

        <div className="flex items-end gap-3">
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
          <span className="min-w-24 pb-2.5 text-right font-mono text-sm font-semibold text-ink">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  )
}

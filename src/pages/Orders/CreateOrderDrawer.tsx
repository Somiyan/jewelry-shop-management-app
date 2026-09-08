import { type FormEvent, useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import { useAuth } from '../../auth'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  Field,
  FigureStack,
  IconButton,
  Input,
  MetalSwatch,
  PlusIcon,
  Select,
  Tabs,
  Textarea,
  TrashIcon,
  useToast,
  type TabItem,
} from '../../components'
import { extractErrorMessage, formatCurrency } from '../../utils/format'
import { toNumber } from '../productShared'
import CustomItemCard from './CustomItemCard'
import CustomItemModal from './CustomItemModal'
import { derivePaymentStatus, duplicateDraft, emptyCustomItemDraft, estimateCustomItem } from './helpers'
import { OrderSummaryInline } from './OrderSummary'
import {
  PAYMENT_METHODS,
  resolvedCategory,
  resolvedPurity,
  type Category,
  type CustomItemDraft,
  type CustomerOption,
  type MetalRatesResponse,
  type OrderLine,
  type PaymentMethod,
  type Product,
} from './types'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The "New order" flow — counter-speed entry for both selling existing stock
 * and taking a custom/made-to-order piece, on the same order. Lives entirely
 * inside a Drawer so it unmounts (and resets) cleanly between opens, the same
 * pattern the rest of the app uses for a create flow.
 */
export function CreateOrderDrawer({ open, onClose, onCreated }: Props) {
  const toast = useToast()
  const { hasRole } = useAuth()
  const canOverrideRate = hasRole('admin', 'manager')
  const isPrivilegedAdvance = hasRole('admin', 'manager')

  // ---- customer ----
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState('')

  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null)
  const [newCustomerSubmitting, setNewCustomerSubmitting] = useState(false)

  // ---- items: stock ----
  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<OrderLine[]>([{ productId: '', quantity: '1' }])

  // ---- items: custom ----
  const [itemMode, setItemMode] = useState<'stock' | 'custom'>('stock')
  const [customItems, setCustomItems] = useState<CustomItemDraft[]>([])
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customModalDraft, setCustomModalDraft] = useState<CustomItemDraft>(emptyCustomItemDraft())
  const [customModalEditingIndex, setCustomModalEditingIndex] = useState<number | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [metalRates, setMetalRates] = useState<MetalRatesResponse | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [ratesError, setRatesError] = useState<string | null>(null)

  // ---- advance / token ----
  const [advanceEnabled, setAdvanceEnabled] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('cash')
  const [advanceDate, setAdvanceDate] = useState(todayDateInput())
  const [advanceReference, setAdvanceReference] = useState('')
  const [advanceNotes, setAdvanceNotes] = useState('')

  // ---- delivery / discount / notes ----
  const [deliveryDate, setDeliveryDate] = useState('')
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')

  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)

  useEffect(() => {
    apiClient
      .get<Product[]>('/products')
      .then(({ data }) => setProducts(data))
      .catch(() => {
        // Product picker will just show empty; error surfaces elsewhere.
      })
  }, [])

  useEffect(() => {
    apiClient
      .get<Category[]>('/categories', { params: { active: true } })
      .then(({ data }) => setCategories(Array.isArray(data) ? data : []))
      .catch((err) => setCategoriesError(extractErrorMessage(err)))
  }, [])

  useEffect(() => {
    setRatesLoading(true)
    apiClient
      .get<MetalRatesResponse>('/rates/current')
      .then(({ data }) => {
        setMetalRates(data)
        setRatesError(null)
      })
      .catch((err) => setRatesError(extractErrorMessage(err)))
      .finally(() => setRatesLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(() => {
      apiClient
        .get<CustomerOption[]>('/customers', {
          params: customerQuery.trim() ? { q: customerQuery.trim() } : {},
        })
        .then(({ data }) => {
          if (!cancelled) setCustomerOptions(data)
        })
        .catch(() => {
          // ignore; typeahead is best-effort
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [customerQuery])

  function updateLine(index: number, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function stepQuantity(index: number, delta: number) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line
        const product = products.find((p) => p._id === line.productId)
        const next = (Number(line.quantity) || 0) + delta
        const max = product?.quantity ?? Number.POSITIVE_INFINITY
        return { ...line, quantity: String(Math.min(Math.max(next, 1), max)) }
      }),
    )
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: '', quantity: '1' }])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function estimatedLineTotal(line: OrderLine): number | null {
    const product = products.find((p) => p._id === line.productId)
    const quantity = Number(line.quantity)
    if (!product || !product.price || !quantity || quantity <= 0) return null
    return product.price.finalPrice * quantity
  }

  const estimatedStockTotal = lines.reduce((sum, line) => sum + (estimatedLineTotal(line) ?? 0), 0)

  function customItemEstimate(draft: CustomItemDraft): number | null {
    const weight = toNumber(draft.estimatedWeight)
    const purity = resolvedPurity(draft)
    const quantity = toNumber(draft.quantity) ?? 1
    const makingValue = toNumber(draft.makingChargeValue) ?? 0
    const rateOverride = toNumber(draft.rateOverride)
    const liveRate = (draft.metalType === 'gold' ? metalRates?.gold : metalRates?.silver)?.ratePerGram ?? null
    const rate = rateOverride ?? liveRate
    if (!weight || !purity || !rate) return null
    return estimateCustomItem(weight, purity, draft.makingChargeType, makingValue, rate, quantity).subtotal
  }

  const estimatedCustomTotal = customItems.reduce((sum, draft) => sum + (customItemEstimate(draft) ?? 0), 0)
  const estimatedTotal = estimatedStockTotal + estimatedCustomTotal
  const itemCount = lines.filter((line) => line.productId).length + customItems.length

  const advanceAmountNum = advanceEnabled ? Number(advanceAmount) || 0 : 0
  const balance = estimatedTotal - advanceAmountNum
  const paymentStatus = derivePaymentStatus(advanceEnabled, advanceAmountNum, estimatedTotal)
  const advanceExceedsTotal = advanceEnabled && advanceAmountNum > estimatedTotal && estimatedTotal > 0

  function openAddCustomItem() {
    setCustomModalDraft(emptyCustomItemDraft())
    setCustomModalEditingIndex(null)
    setCustomModalOpen(true)
  }

  function openEditCustomItem(index: number) {
    setCustomModalDraft(customItems[index])
    setCustomModalEditingIndex(index)
    setCustomModalOpen(true)
  }

  function handleSaveCustomItem(draft: CustomItemDraft) {
    if (customModalEditingIndex === null) {
      setCustomItems((prev) => [...prev, draft])
    } else {
      const index = customModalEditingIndex
      setCustomItems((prev) => prev.map((d, i) => (i === index ? draft : d)))
    }
    setCustomModalOpen(false)
  }

  function duplicateCustomItem(index: number) {
    setCustomItems((prev) => {
      const copy = duplicateDraft(prev[index])
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]
    })
  }

  function removeCustomItem(index: number) {
    setCustomItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCreateCustomer() {
    setNewCustomerError(null)
    if (!newName.trim() || !newPhone.trim()) {
      setNewCustomerError('Name and phone are required.')
      return
    }
    setNewCustomerSubmitting(true)
    try {
      const { data } = await apiClient.post<CustomerOption>('/customers', {
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        address: newAddress.trim() || undefined,
      })
      setSelectedCustomerId(data._id)
      setSelectedCustomerLabel(`${data.name} (${data.phone})`)
      setCustomerMode('existing')
      toast.success(`${data.name} added and selected for this order`)
    } catch (err) {
      setNewCustomerError(extractErrorMessage(err))
    } finally {
      setNewCustomerSubmitting(false)
    }
  }

  function buildCustomItemPayload(draft: CustomItemDraft) {
    const sizeValue = toNumber(draft.sizeValue)
    return {
      isCustomOrder: true as const,
      itemName: draft.itemName.trim(),
      category: resolvedCategory(draft),
      description: draft.description.trim() || undefined,
      metalType: draft.metalType,
      estimatedWeight: toNumber(draft.estimatedWeight),
      purity: resolvedPurity(draft),
      wastagePercentage: draft.wastagePercentage.trim() ? toNumber(draft.wastagePercentage) : undefined,
      sizeValue: sizeValue ?? undefined,
      sizeUnit: sizeValue !== null ? draft.sizeUnit : undefined,
      makingChargeType: draft.makingChargeType,
      makingChargeValue: toNumber(draft.makingChargeValue) ?? 0,
      quantity: draft.quantity.trim() ? toNumber(draft.quantity) : undefined,
      goldRateOverride:
        canOverrideRate && draft.rateOverride.trim() ? toNumber(draft.rateOverride) : undefined,
    }
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!selectedCustomerId) {
      setFormError('Please select a customer.')
      return
    }
    const stockItems = lines
      .filter((line) => line.productId && Number(line.quantity) > 0)
      .map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }))
    const customPayloadItems = customItems.map(buildCustomItemPayload)
    const items = [...stockItems, ...customPayloadItems]
    if (items.length === 0) {
      setFormError('Please add at least one item — from stock or a custom order.')
      return
    }

    setIsSubmittingForm(true)
    try {
      const body: Record<string, unknown> = {
        customerId: selectedCustomerId,
        items,
        deliveryDate: deliveryDate || undefined,
        discount: discount ? Number(discount) : undefined,
        notes: notes || undefined,
      }
      if (advanceEnabled && advanceAmountNum > 0) {
        body.advance = {
          amount: advanceAmountNum,
          method: advanceMethod,
          date: advanceDate || undefined,
          reference: advanceReference.trim() || undefined,
          notes: advanceNotes.trim() || undefined,
        }
      }
      await apiClient.post('/orders', body)
      toast.success('Order created')
      onCreated()
    } catch (err) {
      const message = extractErrorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSubmittingForm(false)
    }
  }

  const itemModeTabs: TabItem<'stock' | 'custom'>[] = [
    { id: 'stock', label: 'From stock' },
    { id: 'custom', label: 'Custom order', count: customItems.length || undefined },
  ]

  const customerModeTabs: TabItem<'existing' | 'new'>[] = [
    { id: 'existing', label: 'Existing customer' },
    { id: 'new', label: 'New customer' },
  ]

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="New order"
        description="Sell from stock, take a custom/made-to-order piece, or both on the same order."
        size="lg"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <OrderSummaryInline
              itemCount={itemCount}
              estimatedTotal={estimatedTotal}
              advanceEnabled={advanceEnabled}
              advanceAmount={advanceAmountNum}
            />
            <div className="flex gap-2 sm:justify-end">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" form="create-order-form" loading={isSubmittingForm}>
                Create order
              </Button>
            </div>
          </div>
        }
      >
        <form id="create-order-form" onSubmit={handleCreateSubmit} className="space-y-5" noValidate>
          {/* ---- Customer ---- */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">Customer</h3>
            {selectedCustomerId ? (
              <div className="flex items-center justify-between gap-3 rounded-control border border-line bg-sunken px-3 py-2">
                <span className="min-w-0 truncate text-sm text-ink">{selectedCustomerLabel}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCustomerId('')
                    setSelectedCustomerLabel('')
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Tabs
                  items={customerModeTabs}
                  value={customerMode}
                  onChange={setCustomerMode}
                  label="Customer source"
                />

                {customerMode === 'existing' ? (
                  <div>
                    <Field
                      label="Find a customer"
                      hideLabel
                      hint="Search by name or phone number."
                      error={formError === 'Please select a customer.' ? formError : undefined}
                    >
                      <Input
                        type="text"
                        value={customerQuery}
                        onChange={(event) => setCustomerQuery(event.target.value)}
                        placeholder="Search by name or phone"
                      />
                    </Field>
                    {customerOptions.length > 0 && (
                      <ul className="mt-2 max-h-52 overflow-y-auto rounded-control border border-line bg-surface">
                        {customerOptions.map((customer) => (
                          <li key={customer._id} className="border-b border-line last:border-b-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCustomerId(customer._id)
                                setSelectedCustomerLabel(`${customer.name} (${customer.phone})`)
                                setCustomerOptions([])
                              }}
                              className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-sunken"
                            >
                              <span className="truncate">{customer.name}</span>
                              <span className="shrink-0 font-mono text-xs text-ink-muted">{customer.phone}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 rounded-panel border border-line p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Name" required>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                      </Field>
                      <Field label="Phone" required>
                        <Input
                          type="tel"
                          inputMode="tel"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          className="font-mono"
                        />
                      </Field>
                      <Field label="Email" hint="Optional.">
                        <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                      </Field>
                      <Field label="Address" hint="Optional.">
                        <Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
                      </Field>
                    </div>
                    {newCustomerError && (
                      <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
                        {newCustomerError}
                      </p>
                    )}
                    <Button size="sm" onClick={handleCreateCustomer} loading={newCustomerSubmitting}>
                      Add customer
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ---- Items ---- */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Items</h3>
            </div>
            <Tabs items={itemModeTabs} value={itemMode} onChange={setItemMode} label="Add item" />

            {itemMode === 'stock' && (
              <div className="space-y-2">
                {lines.map((line, index) => {
                  const product = products.find((p) => p._id === line.productId)
                  const lineTotal = estimatedLineTotal(line)
                  const quantity = Number(line.quantity) || 0
                  return (
                    <div key={index} className="space-y-3 rounded-panel border border-line bg-surface p-3">
                      <Field label={`Product ${index + 1}`} hideLabel>
                        <Select
                          value={line.productId}
                          onChange={(event) => updateLine(index, { productId: event.target.value })}
                          aria-label={`Product for line ${index + 1}`}
                        >
                          <option value="">Select a product…</option>
                          {products.map((p) => (
                            <option key={p._id} value={p._id} disabled={p.quantity <= 0}>
                              {p.name} ({p.sku}) — {p.quantity} in stock
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1">
                          <IconButton
                            label={`Decrease quantity on line ${index + 1}`}
                            size="sm"
                            variant="secondary"
                            disabled={quantity <= 1}
                            onClick={() => stepQuantity(index, -1)}
                          >
                            <span aria-hidden="true" className="text-base leading-none">
                              −
                            </span>
                          </IconButton>
                          <Input
                            type="number"
                            min="1"
                            max={product?.quantity}
                            value={line.quantity}
                            onChange={(event) => updateLine(index, { quantity: event.target.value })}
                            aria-label={`Quantity on line ${index + 1}`}
                            className="w-16 text-center font-mono"
                          />
                          <IconButton
                            label={`Increase quantity on line ${index + 1}`}
                            size="sm"
                            variant="secondary"
                            disabled={product ? quantity >= product.quantity : false}
                            onClick={() => stepQuantity(index, 1)}
                          >
                            <PlusIcon size={16} />
                          </IconButton>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-medium text-ink">
                            {lineTotal !== null ? formatCurrency(lineTotal) : '—'}
                          </span>
                          <IconButton
                            label={`Remove line ${index + 1}`}
                            size="sm"
                            variant="danger"
                            disabled={lines.length === 1}
                            onClick={() => removeLine(index)}
                          >
                            <TrashIcon size={16} />
                          </IconButton>
                        </div>
                      </div>

                      {product && (
                        <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                          <MetalSwatch
                            metal={product.metalType}
                            label={`${product.metalType} ${product.purity}`}
                            className="text-xs"
                          />
                          {product.quantity <= 0 && <Badge tone="danger">Out of stock</Badge>}
                          {product.priceError && <span>{product.priceError}</span>}
                        </p>
                      )}
                    </div>
                  )
                })}
                <Button variant="secondary" size="sm" leftIcon={<PlusIcon size={16} />} onClick={addLine}>
                  Add product line
                </Button>
              </div>
            )}

            {itemMode === 'custom' && (
              <Button variant="secondary" size="sm" leftIcon={<PlusIcon size={16} />} onClick={openAddCustomItem}>
                Add custom item
              </Button>
            )}

            {customItems.length > 0 && (
              <div className="space-y-2">
                {customItems.map((draft, index) => (
                  <CustomItemCard
                    key={draft.id}
                    draft={draft}
                    metalRates={metalRates}
                    onEdit={() => openEditCustomItem(index)}
                    onDuplicate={() => duplicateCustomItem(index)}
                    onRemove={() => removeCustomItem(index)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ---- Advance / token payment ---- */}
          <section className="space-y-3">
            <Checkbox
              label="Record an advance / token payment"
              checked={advanceEnabled}
              onChange={(e) => setAdvanceEnabled(e.target.checked)}
            />
            {advanceEnabled && (
              <div className="space-y-3 rounded-panel border border-line p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Amount">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field label="Method">
                    <Select
                      value={advanceMethod}
                      onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethod)}
                      options={PAYMENT_METHODS}
                    />
                  </Field>
                  <Field label="Date">
                    <Input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} />
                  </Field>
                  <Field label="Reference" hint="Optional.">
                    <Input value={advanceReference} onChange={(e) => setAdvanceReference(e.target.value)} />
                  </Field>
                  <Field label="Notes" hint="Optional." className="sm:col-span-2">
                    <Textarea rows={2} value={advanceNotes} onChange={(e) => setAdvanceNotes(e.target.value)} />
                  </Field>
                </div>
                {advanceExceedsTotal && !isPrivilegedAdvance && (
                  <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">
                    This advance is more than the estimated order value. Only admins and managers can record an
                    advance larger than the total — the server will reject this on save.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ---- Delivery / discount / notes ---- */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Delivery date" hint="Optional.">
              <Input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
            </Field>
            <Field label="Discount" hint="Optional flat amount.">
              <Input
                type="number"
                min="0"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Notes" hint="Optional." className="sm:col-span-2">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
            </Field>
          </section>

          <Card title="Order summary" description={`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`} padding="md">
            <FigureStack
              rows={[
                ...lines
                  .filter((line) => line.productId)
                  .map((line, index) => {
                    const product = products.find((p) => p._id === line.productId)
                    const lineTotal = estimatedLineTotal(line)
                    return {
                      label: product?.name ?? `Line ${index + 1}`,
                      hint: `Quantity ${Number(line.quantity) || 0}`,
                      value: lineTotal === null ? '—' : lineTotal,
                    }
                  }),
                ...customItems.map((draft) => {
                  const estimate = customItemEstimate(draft)
                  return {
                    label: draft.itemName || 'Custom item',
                    hint: 'Custom order · before tax',
                    value: estimate === null ? 'calculated on save' : estimate,
                  }
                }),
              ]}
              total={{
                label: 'Estimated order value',
                hint: customItems.length > 0 ? 'Custom items shown before tax' : undefined,
                value: estimatedTotal,
              }}
            />
            {advanceEnabled && advanceAmountNum > 0 && (
              <div className="mt-4 border-t border-line pt-4">
                <FigureStack
                  size="sm"
                  rows={[{ label: 'Advance received', value: advanceAmountNum, tone: 'success' }]}
                  total={{ label: 'Balance due', value: balance }}
                />
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-xs text-ink-muted">Payment status</span>
              <Badge tone={paymentStatus.tone}>{paymentStatus.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              This is an estimate based on current prices. The final total, including tax, is calculated by the
              server when the order is created.
            </p>
          </Card>

          {formError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
        </form>
      </Drawer>

      <CustomItemModal
        open={customModalOpen}
        draft={customModalDraft}
        isEditing={customModalEditingIndex !== null}
        categories={categories}
        categoriesError={categoriesError}
        metalRates={metalRates}
        ratesLoading={ratesLoading}
        ratesError={ratesError}
        canOverrideRate={canOverrideRate}
        onClose={() => setCustomModalOpen(false)}
        onSave={handleSaveCustomItem}
      />
    </>
  )
}

export default CreateOrderDrawer

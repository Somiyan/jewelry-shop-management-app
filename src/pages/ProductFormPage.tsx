import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useAuth } from '../auth'
import {
  AlertIcon,
  Button,
  Card,
  ConfirmDialog,
  Field,
  FigureStack,
  Input,
  MetalSwatch,
  PageHeader,
  Select,
  StatCard,
  Tabs,
  Textarea,
  useToast,
  type TabItem,
} from '../components'
import { extractErrorMessage, formatCurrency, formatDate } from '../utils/format'
import {
  METAL_TYPES,
  PURITY_PRESETS,
  SIZE_UNITS,
  formatPercent,
  formatWeight,
  metalLabel,
  normalizeProduct,
  sizeUnitLabel,
  toNumber,
  useDebouncedValue,
  type Category,
  type MakingChargeType,
  type MetalRatesResponse,
  type MetalType,
  type PricingPreviewResult,
  type Product,
  type ProductType,
  type SizeUnit,
} from './productShared'

interface FormState {
  name: string
  sku: string
  category: string
  description: string
  barcode: string
  hsnCode: string
  image: string
  type: ProductType
  metalType: MetalType
  quantity: string
  grossWeight: string
  netWeight: string
  purityPreset: string
  purityCustom: string
  wastagePercentage: string
  sizeValue: string
  sizeUnit: SizeUnit
  makingChargeType: MakingChargeType
  makingChargeValue: string
  rateOverride: string
  purchaseCostOverride: string
}

const emptyForm: FormState = {
  name: '',
  sku: '',
  category: '',
  description: '',
  barcode: '',
  hsnCode: '',
  image: '',
  type: 'ring',
  metalType: 'gold',
  quantity: '',
  grossWeight: '',
  netWeight: '',
  purityPreset: '91.6',
  purityCustom: '',
  wastagePercentage: '0',
  sizeValue: '',
  sizeUnit: 'mm',
  makingChargeType: 'percentage',
  makingChargeValue: '0',
  rateOverride: '',
  purchaseCostOverride: '',
}

const metalOptions = METAL_TYPES.map((metal) => ({ value: metal, label: metalLabel(metal) }))
const purityOptions = [...PURITY_PRESETS, { value: 'custom', label: 'Custom' }]
const sizeUnitOptions = SIZE_UNITS.map((unit) => ({ value: unit, label: sizeUnitLabel(unit) }))
const makingChargeTabs: TabItem<MakingChargeType>[] = [
  { id: 'percentage', label: 'Percentage' },
  { id: 'per_gram', label: 'Amount per gram' },
]
const reverseModeTabs: TabItem<'sellingPrice' | 'purchaseCost'>[] = [
  { id: 'sellingPrice', label: 'Target selling price' },
  { id: 'purchaseCost', label: 'Target purchase cost' },
]

interface FormErrors {
  name?: string
  sku?: string
  quantity?: string
  grossWeight?: string
  netWeight?: string
  purity?: string
  wastagePercentage?: string
  makingChargeValue?: string
}

function computeErrors(form: FormState, isEditing: boolean): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = 'Enter a product name.'
  if (!form.sku.trim()) errors.sku = 'Enter a SKU.'

  if (!isEditing) {
    if (form.quantity.trim() === '') {
      errors.quantity = 'Enter the opening stock quantity.'
    } else if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0) {
      errors.quantity = 'Quantity must be a whole number of 0 or more.'
    }
  }

  const gross = toNumber(form.grossWeight)
  if (form.grossWeight.trim() === '') errors.grossWeight = 'Enter the gross weight.'
  else if (gross === null || gross <= 0) errors.grossWeight = 'Gross weight must be greater than 0.'

  const net = toNumber(form.netWeight)
  if (form.netWeight.trim() === '') errors.netWeight = 'Enter the net weight.'
  else if (net === null || net <= 0) errors.netWeight = 'Net weight must be greater than 0.'
  else if (gross !== null && net > gross) errors.netWeight = 'Net weight cannot be greater than gross weight.'

  if (form.purityPreset === 'custom') {
    const custom = toNumber(form.purityCustom)
    if (form.purityCustom.trim() === '') errors.purity = 'Enter a purity percentage.'
    else if (custom === null || custom <= 0 || custom > 100) {
      errors.purity = 'Purity must be a percentage between 0 and 100.'
    }
  }

  const wastage = toNumber(form.wastagePercentage)
  if (form.wastagePercentage.trim() !== '' && (wastage === null || wastage < 0)) {
    errors.wastagePercentage = 'Wastage cannot be negative.'
  }

  const making = toNumber(form.makingChargeValue)
  if (form.makingChargeValue.trim() !== '' && (making === null || making < 0)) {
    errors.makingChargeValue = 'Making charge cannot be negative.'
  }

  return errors
}

function productToForm(product: Product): FormState {
  const preset = PURITY_PRESETS.find((option) => Number(option.value) === product.purity)
  return {
    name: product.name,
    sku: product.sku,
    category: product.category ?? '',
    description: product.description ?? '',
    barcode: product.barcode ?? '',
    hsnCode: product.hsnCode ?? '',
    image: product.image ?? '',
    type: product.type,
    metalType: product.metalType,
    quantity: String(product.quantity),
    grossWeight: product.grossWeight ? String(product.grossWeight) : '',
    netWeight: product.netWeight ? String(product.netWeight) : '',
    purityPreset: preset ? preset.value : product.purity ? 'custom' : '91.6',
    purityCustom: !preset && product.purity ? String(product.purity) : '',
    wastagePercentage: String(product.wastagePercentage ?? 0),
    sizeValue: product.sizeLength ? String(product.sizeLength.value) : '',
    sizeUnit: product.sizeLength?.unit ?? 'mm',
    makingChargeType: product.makingChargeType ?? 'percentage',
    makingChargeValue: String(product.makingChargeValue ?? 0),
    rateOverride: '',
    purchaseCostOverride: '',
  }
}

function formatSolved(field: 'makingChargeValue' | 'wastagePercentage', value: number, makingChargeType: MakingChargeType): string {
  if (field === 'wastagePercentage') return formatPercent(value)
  return makingChargeType === 'percentage' ? formatPercent(value) : `${formatCurrency(value)} / g`
}

/**
 * Create/edit a jewellery product. Two columns from `lg`: form on the left,
 * a sticky "assay stack" pricing summary on the right, which recalculates
 * live from the backend's forward pricing-preview endpoint as the user types.
 */
export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { hasRole } = useAuth()

  const [loading, setLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  const [metalRates, setMetalRates] = useState<MetalRatesResponse | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)
  const [ratesError, setRatesError] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(emptyForm)
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [baseline, setBaseline] = useState<string | null>(null)

  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [pendingNavigateTo, setPendingNavigateTo] = useState<string | null>(null)

  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  const [reverseMode, setReverseMode] = useState<'sellingPrice' | 'purchaseCost'>('sellingPrice')
  const [reverseTarget, setReverseTarget] = useState('')
  const [reverseLoading, setReverseLoading] = useState(false)
  const [reverseError, setReverseError] = useState<string | null>(null)
  const [reverseResult, setReverseResult] = useState<Record<string, unknown> | null>(null)
  const [pendingApply, setPendingApply] = useState<{
    field: 'makingChargeValue' | 'wastagePercentage'
    value: number
    previous: number | null
  } | null>(null)

  const [preview, setPreview] = useState<PricingPreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  /* ---------------------------------------------------------- data loads --- */

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<Category[]>('/categories', { params: { active: true } })
      .then(({ data }) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) setCategoriesError(extractErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setRatesLoading(true)
    apiClient
      .get<MetalRatesResponse>('/rates/current')
      .then(({ data }) => {
        if (!cancelled) {
          setMetalRates(data)
          setRatesError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setRatesError(extractErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    apiClient
      .get<Record<string, unknown>>(`/products/${id}`)
      .then(({ data }) => {
        if (cancelled) return
        const product = normalizeProduct(data)
        setOriginalProduct(product)
        setForm(productToForm(product))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(extractErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  /* -------------------------------------------------- dirty-state guard --- */

  useEffect(() => {
    if (isEditing && loading) return
    setBaseline((current) => current ?? JSON.stringify(form))
  }, [isEditing, loading, form])

  const isDirty = baseline !== null && JSON.stringify(form) !== baseline

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  /* ------------------------------------------------------------ helpers --- */

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  const errors = useMemo(() => computeErrors(form, isEditing), [form, isEditing])
  const restrictedEditable = !isEditing || hasRole('admin', 'manager')
  const canOverrideRate = hasRole('admin', 'manager')

  const netWeightNum = toNumber(form.netWeight)
  const purityValueNum =
    form.purityPreset === 'custom' ? toNumber(form.purityCustom) : toNumber(form.purityPreset)
  const wastageNum = toNumber(form.wastagePercentage) ?? 0
  const makingValueNum = toNumber(form.makingChargeValue) ?? 0
  const effectiveGoldPercentage = purityValueNum !== null ? purityValueNum + wastageNum : null

  const liveRate =
    metalRates === null
      ? null
      : (form.metalType === 'gold' ? metalRates.gold?.ratePerGram : metalRates.silver?.ratePerGram) ?? null
  const rateOverrideNum = canOverrideRate ? toNumber(form.rateOverride) : null
  const effectiveRate = rateOverrideNum ?? liveRate ?? null
  const purchaseRateForCalc = isEditing ? (originalProduct?.purchaseMetalRate ?? null) : effectiveRate

  const canPreview =
    netWeightNum !== null &&
    netWeightNum > 0 &&
    purityValueNum !== null &&
    purityValueNum > 0 &&
    purityValueNum <= 100 &&
    wastageNum >= 0 &&
    makingValueNum >= 0 &&
    effectiveRate !== null &&
    effectiveRate > 0 &&
    purchaseRateForCalc !== null &&
    purchaseRateForCalc > 0

  const previewBody = canPreview
    ? {
        netWeight: netWeightNum,
        purity: purityValueNum,
        wastagePercentage: wastageNum,
        makingChargeType: form.makingChargeType,
        makingChargeValue: makingValueNum,
        purchaseMetalRate: purchaseRateForCalc,
        currentMetalRate: effectiveRate,
      }
    : null

  const debouncedPreviewKey = useDebouncedValue(previewBody ? JSON.stringify(previewBody) : '', 250)

  useEffect(() => {
    if (!debouncedPreviewKey) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    apiClient
      .post<PricingPreviewResult>('/products/pricing/preview', JSON.parse(debouncedPreviewKey))
      .then(({ data }) => {
        if (!cancelled) {
          setPreview(data)
          setPreviewError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null)
          setPreviewError(extractErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedPreviewKey])

  function proposeApply(field: 'makingChargeValue' | 'wastagePercentage', value: number) {
    const currentStr = field === 'makingChargeValue' ? form.makingChargeValue : form.wastagePercentage
    const current = toNumber(currentStr)
    if (current !== null && Math.abs(current - value) > 0.005) {
      setPendingApply({ field, value, previous: current })
    } else {
      updateField(field, String(value))
    }
  }

  function applyPending() {
    if (!pendingApply) return
    updateField(pendingApply.field, String(pendingApply.value))
    setPendingApply(null)
  }

  async function handleSolve() {
    setReverseError(null)
    setReverseResult(null)
    const target = toNumber(reverseTarget)
    if (target === null || target <= 0) {
      setReverseError('Enter a target amount greater than 0.')
      return
    }
    if (netWeightNum === null || netWeightNum <= 0 || purityValueNum === null || effectiveRate === null) {
      setReverseError('Enter net weight, purity and a metal rate first.')
      return
    }
    setReverseLoading(true)
    try {
      const body =
        reverseMode === 'sellingPrice'
          ? {
              mode: form.makingChargeType,
              targetSellingPrice: target,
              netWeight: netWeightNum,
              purity: purityValueNum,
              currentMetalRate: effectiveRate,
            }
          : {
              targetPurchaseCost: target,
              netWeight: netWeightNum,
              purity: purityValueNum,
              purchaseMetalRate: purchaseRateForCalc ?? effectiveRate,
            }
      const { data } = await apiClient.post<Record<string, unknown>>('/products/pricing/preview', body)
      setReverseResult(data)
    } catch (err) {
      setReverseError(extractErrorMessage(err))
    } finally {
      setReverseLoading(false)
    }
  }

  const solvedMakingCharge =
    reverseResult && typeof reverseResult.makingChargeValue === 'number'
      ? reverseResult.makingChargeValue
      : reverseResult && typeof reverseResult.requiredMakingChargeValue === 'number'
        ? reverseResult.requiredMakingChargeValue
        : null
  const solvedWastage =
    reverseResult && typeof reverseResult.wastagePercentage === 'number'
      ? reverseResult.wastagePercentage
      : reverseResult && typeof reverseResult.requiredWastagePercentage === 'number'
        ? reverseResult.requiredWastagePercentage
        : null

  function handleCancelClick() {
    const target = isEditing && id ? `/products/${id}` : '/stock'
    if (isDirty) {
      setPendingNavigateTo(target)
      setShowDiscardConfirm(true)
    } else {
      navigate(target)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setTouched({
      name: true,
      sku: true,
      quantity: true,
      grossWeight: true,
      netWeight: true,
      purityPreset: true,
      purityCustom: true,
      wastagePercentage: true,
      makingChargeValue: true,
    })

    const nextErrors = computeErrors(form, isEditing)
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError('Fix the highlighted fields before saving.')
      return
    }
    if (effectiveRate === null || effectiveRate <= 0) {
      setSubmitError('A metal rate is required. Check the live rate feed above or set an override.')
      return
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      type: form.type,
      metalType: form.metalType,
      sku: form.sku.trim(),
      image: form.image.trim() || undefined,
      description: form.description.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      hsnCode: form.hsnCode.trim() || undefined,
      category: form.category.trim() || undefined,
      grossWeight: Number(form.grossWeight),
      netWeight: Number(form.netWeight),
      purity: purityValueNum,
      makingChargeType: form.makingChargeType,
      makingChargeValue: makingValueNum,
    }
    if (form.sizeValue.trim()) {
      body.sizeLength = { value: Number(form.sizeValue), unit: form.sizeUnit }
    }
    if (!isEditing) {
      body.quantity = Number(form.quantity)
      body.purchaseMetalRate = effectiveRate
    }
    if (restrictedEditable) {
      body.wastagePercentage = wastageNum
    }
    if (isEditing && hasRole('admin', 'manager') && form.purchaseCostOverride.trim()) {
      body.purchaseCost = Number(form.purchaseCostOverride)
    }

    setSubmitting(true)
    try {
      const response = isEditing
        ? await apiClient.put(`/products/${id}`, body)
        : await apiClient.post('/products', body)
      setBaseline(JSON.stringify(form))
      toast.success(isEditing ? 'Product updated' : 'Product created')
      const newId = isEditing ? id : (response.data as { _id?: string } | undefined)?._id
      navigate(newId ? `/products/${newId}` : '/stock')
    } catch (err) {
      const message = extractErrorMessage(err)
      setSubmitError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  /* ------------------------------------------------------------- render --- */

  if (isEditing && loading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Loading product…" />
        <Card>
          <p className="text-sm text-ink-muted">Fetching the product's details…</p>
        </Card>
      </div>
    )
  }

  if (isEditing && loadError) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Edit product" />
        <Card>
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <AlertIcon size={16} className="mt-0.5 shrink-0" />
            {loadError}
          </p>
        </Card>
      </div>
    )
  }

  const schemaIncomplete =
    isEditing && originalProduct !== null && (!originalProduct.grossWeight || !originalProduct.netWeight)

  const actions = (
    <>
      <Button type="button" variant="secondary" onClick={handleCancelClick} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" form="product-form" loading={submitting}>
        {isEditing ? 'Save changes' : 'Create product'}
      </Button>
    </>
  )

  const calcLines: string[] = []
  if (
    preview &&
    netWeightNum !== null &&
    purityValueNum !== null &&
    effectiveGoldPercentage !== null &&
    purchaseRateForCalc !== null &&
    effectiveRate !== null
  ) {
    calcLines.push(
      'Purchase cost',
      `  ${formatWeight(netWeightNum)} × ${effectiveGoldPercentage.toFixed(2)}% × ${formatCurrency(purchaseRateForCalc)}/g`,
      `  = ${formatCurrency(preview.purchaseCost)}`,
      '',
      'Current cost',
      `  ${formatWeight(netWeightNum)} × ${effectiveGoldPercentage.toFixed(2)}% × ${formatCurrency(effectiveRate)}/g`,
      `  = ${formatCurrency(preview.currentCost)}`,
      '',
    )
    if (form.makingChargeType === 'percentage') {
      calcLines.push(
        'Selling price (percentage making charge)',
        `  ${formatWeight(netWeightNum)} × (${purityValueNum.toFixed(2)}% + ${makingValueNum.toFixed(2)}%) × ${formatCurrency(effectiveRate)}/g`,
        `  = ${formatCurrency(preview.subtotal)}`,
      )
    } else {
      calcLines.push(
        'Selling price (per-gram making charge)',
        `  ${formatWeight(netWeightNum)} × ${purityValueNum.toFixed(2)}% × ${formatCurrency(effectiveRate)}/g + ${formatWeight(netWeightNum)} × ${formatCurrency(makingValueNum)}/g`,
        `  = ${formatCurrency(preview.subtotal)}`,
      )
    }
    calcLines.push('', '+ GST', `  = ${formatCurrency(preview.finalPrice)}`)
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={isEditing ? `Edit ${originalProduct?.name ?? 'product'}` : 'Add product'}
        description="Jewellery details drive the price — pricing recalculates live as you type."
        breadcrumb={[
          { label: 'Stock', to: '/stock' },
          { label: isEditing ? 'Edit product' : 'New product' },
        ]}
        actions={<div className="hidden gap-2 sm:flex">{actions}</div>}
      />

      {schemaIncomplete && (
        <p className="rounded-control border border-line bg-warning-soft px-3 py-2 text-sm text-warning">
          This product was added before jewellery details were tracked. Fill in the fields below to
          complete its record.
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <form id="product-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          {/* 1. Product information */}
          <Card title="Product information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required error={touched.name ? errors.name : undefined} className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} autoComplete="off" />
              </Field>
              <Field label="SKU" required error={touched.sku ? errors.sku : undefined}>
                <Input
                  value={form.sku}
                  onChange={(e) => updateField('sku', e.target.value)}
                  autoComplete="off"
                  className="font-mono"
                />
              </Field>
              <Field label="Barcode" hint="Optional. Must be unique when set.">
                <Input
                  value={form.barcode}
                  onChange={(e) => updateField('barcode', e.target.value)}
                  autoComplete="off"
                  className="font-mono"
                />
              </Field>
              <Field label="HSN code" hint="Optional. GST harmonized system code.">
                <Input
                  value={form.hsnCode}
                  onChange={(e) => updateField('hsnCode', e.target.value)}
                  autoComplete="off"
                  className="font-mono"
                />
              </Field>
              <Field label="Category" hint={categoriesError ? 'Category list unavailable — type a name.' : 'Optional grouping.'}>
                {categoriesError ? (
                  <Input value={form.category} onChange={(e) => updateField('category', e.target.value)} autoComplete="off" />
                ) : (
                  <Select
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    placeholder="No category"
                    options={categories.map((c) => ({ value: c.name, label: c.name }))}
                  />
                )}
              </Field>
              {!isEditing ? (
                <Field
                  label="Opening quantity"
                  required
                  error={touched.quantity ? errors.quantity : undefined}
                  hint="Pieces on hand when this product is created."
                >
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(e) => updateField('quantity', e.target.value)}
                    className="font-mono"
                  />
                </Field>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-ink">Quantity in stock</p>
                  <div className="flex h-11 items-center rounded-control border border-line bg-sunken px-3 font-mono text-sm tabular-nums text-ink-muted md:h-10">
                    {originalProduct?.quantity ?? 0}
                  </div>
                  <p className="text-xs text-ink-muted">Adjust stock levels from the product list.</p>
                </div>
              )}
              <Field label="Image URL" hint="Optional.">
                <Input type="url" value={form.image} onChange={(e) => updateField('image', e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Description" hint="Optional." className="sm:col-span-2">
                <Textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} />
              </Field>
            </div>
          </Card>

          {/* 2. Jewellery details */}
          <Card title="Jewellery details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Metal">
                <Select
                  value={form.metalType}
                  onChange={(e) => updateField('metalType', e.target.value as MetalType)}
                  options={metalOptions}
                />
              </Field>
              <div />
              <Field
                label="Gross weight (g)"
                required
                error={touched.grossWeight ? errors.grossWeight : undefined}
              >
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  value={form.grossWeight}
                  onChange={(e) => updateField('grossWeight', e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field
                label="Net weight (g)"
                required
                error={touched.netWeight ? errors.netWeight : undefined}
                hint="Weight of precious metal only, excluding stones/findings."
              >
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  inputMode="decimal"
                  value={form.netWeight}
                  onChange={(e) => updateField('netWeight', e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="Purity" required error={touched.purityPreset ? errors.purity : undefined}>
                <Select
                  value={form.purityPreset}
                  onChange={(e) => updateField('purityPreset', e.target.value)}
                  options={purityOptions}
                />
              </Field>
              {form.purityPreset === 'custom' && (
                <Field
                  label="Custom purity %"
                  required
                  error={touched.purityCustom ? errors.purity : undefined}
                  hint="A percentage, e.g. 95.8 — not karat."
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    inputMode="decimal"
                    value={form.purityCustom}
                    onChange={(e) => updateField('purityCustom', e.target.value)}
                    className="font-mono"
                  />
                </Field>
              )}
              <Field label="Size / length" hint="Optional.">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={form.sizeValue}
                  onChange={(e) => updateField('sizeValue', e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="Unit">
                <Select
                  value={form.sizeUnit}
                  onChange={(e) => updateField('sizeUnit', e.target.value as SizeUnit)}
                  options={sizeUnitOptions}
                />
              </Field>
            </div>
          </Card>

          {/* 3. Wastage */}
          <Card title="Wastage">
            <div className="flex flex-col gap-3">
              {restrictedEditable ? (
                <Field
                  label="Wastage %"
                  error={touched.wastagePercentage ? errors.wastagePercentage : undefined}
                  hint="Added on top of purity for the purchase-cost calculation only — selling price ignores wastage."
                  className="sm:max-w-xs"
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.wastagePercentage}
                    onChange={(e) => updateField('wastagePercentage', e.target.value)}
                    className="font-mono"
                  />
                </Field>
              ) : (
                <div className="flex flex-col gap-1.5 sm:max-w-xs">
                  <p className="text-sm font-medium text-ink">Wastage %</p>
                  <div className="flex h-11 items-center rounded-control border border-line bg-sunken px-3 font-mono text-sm tabular-nums text-ink-muted md:h-10">
                    {formatPercent(wastageNum)}
                  </div>
                  <p className="text-xs text-ink-muted">Only admins and managers can change this.</p>
                </div>
              )}
              <p className="rounded-control bg-sunken px-3 py-2 text-xs text-ink-muted">
                Purity <span className="font-mono tabular-nums text-ink">{formatPercent(purityValueNum ?? 0)}</span>
                {' + wastage '}
                <span className="font-mono tabular-nums text-ink">{formatPercent(wastageNum)}</span>
                {' = effective '}
                <span className="font-mono tabular-nums text-ink">
                  {formatPercent((purityValueNum ?? 0) + wastageNum)}
                </span>
              </p>
            </div>
          </Card>

          {/* 4. Precious metal rate */}
          <Card title="Precious metal rate" description="Used to calculate the making charge and selling price.">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 rounded-control bg-sunken px-3 py-2.5">
                <MetalSwatch metal={form.metalType} label={`${metalLabel(form.metalType)} live rate`} />
                <span className="font-mono text-sm tabular-nums text-ink">
                  {ratesLoading ? 'Loading…' : liveRate !== null ? `${formatCurrency(liveRate)} / g` : '—'}
                </span>
              </div>
              {ratesError && <p className="text-xs text-danger">Live rate unavailable — {ratesError}</p>}

              {canOverrideRate && (
                <Field
                  label="Override rate (admin/manager)"
                  hint="Used instead of the live rate above for this product's calculations. Leave blank to use the live rate."
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.rateOverride}
                    onChange={(e) => updateField('rateOverride', e.target.value)}
                    className="font-mono"
                  />
                </Field>
              )}

              {isEditing ? (
                <div className="rounded-control border border-line px-3 py-2.5 text-sm">
                  <p className="text-ink-muted">Purchase rate (locked at creation)</p>
                  <p className="font-mono tabular-nums text-ink">
                    {originalProduct?.purchaseMetalRate ? `${formatCurrency(originalProduct.purchaseMetalRate)} / g` : '—'}
                    {originalProduct?.createdAt && (
                      <span className="ml-2 font-sans text-xs text-ink-muted">
                        on {formatDate(originalProduct.createdAt)}
                      </span>
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-ink-muted">
                  This rate locks in as the product's purchase rate the moment it is created.
                </p>
              )}

              {isEditing &&
                (hasRole('admin', 'manager') ? (
                  <Field
                    label="Purchase cost override"
                    hint="Only admins and managers can correct the frozen purchase cost. Leave blank to keep the calculated value."
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.purchaseCostOverride}
                      onChange={(e) => updateField('purchaseCostOverride', e.target.value)}
                      className="font-mono"
                    />
                  </Field>
                ) : (
                  <div className="rounded-control border border-line px-3 py-2.5 text-sm">
                    <p className="text-ink-muted">Purchase cost</p>
                    <p className="font-mono tabular-nums text-ink">
                      {originalProduct ? formatCurrency(originalProduct.purchaseCost) : '—'}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">Only admins and managers can change this.</p>
                  </div>
                ))}
            </div>
          </Card>

          {/* 5. Making charges */}
          <Card title="Making charges">
            {restrictedEditable ? (
              <div className="flex flex-col gap-4">
                <Tabs
                  items={makingChargeTabs}
                  value={form.makingChargeType}
                  onChange={(next) => updateField('makingChargeType', next)}
                  label="Making charge type"
                />
                {form.makingChargeType === 'percentage' ? (
                  <Field
                    label="Making charge %"
                    error={touched.makingChargeValue ? errors.makingChargeValue : undefined}
                    hint="Percentage of the metal value at purity."
                    className="sm:max-w-xs"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.makingChargeValue}
                      onChange={(e) => updateField('makingChargeValue', e.target.value)}
                      className="font-mono"
                    />
                  </Field>
                ) : (
                  <Field
                    label="Making charge (₹ per gram)"
                    error={touched.makingChargeValue ? errors.makingChargeValue : undefined}
                    hint="Flat amount added per gram of net weight."
                    className="sm:max-w-xs"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.makingChargeValue}
                      onChange={(e) => updateField('makingChargeValue', e.target.value)}
                      className="font-mono"
                    />
                  </Field>
                )}
              </div>
            ) : (
              <div className="rounded-control border border-line px-3 py-2.5 text-sm sm:max-w-xs">
                <p className="text-ink-muted">
                  Making charge ({form.makingChargeType === 'percentage' ? 'percentage' : 'per gram'})
                </p>
                <p className="font-mono tabular-nums text-ink">
                  {form.makingChargeType === 'percentage'
                    ? formatPercent(makingValueNum)
                    : `${formatCurrency(makingValueNum)} / g`}
                </p>
                <p className="mt-1 text-xs text-ink-muted">Only admins and managers can change this.</p>
              </div>
            )}
          </Card>

          {/* 6. Price-based calculation (advanced, admin/manager only) */}
          {hasRole('admin', 'manager') && (
            <Card
              title="Price-based calculation"
              description="Advanced. Solve the required wastage or making charge from a target price."
            >
              <button
                type="button"
                onClick={() => setAdvancedOpen((open) => !open)}
                className="text-sm font-medium text-accent hover:underline"
              >
                {advancedOpen ? 'Hide' : 'Work backwards from a target price'}
              </button>

              {advancedOpen && (
                <div className="mt-4 flex flex-col gap-4">
                  <Tabs
                    items={reverseModeTabs}
                    value={reverseMode}
                    onChange={(next) => {
                      setReverseMode(next)
                      setReverseResult(null)
                      setReverseError(null)
                    }}
                    label="Solve for"
                  />
                  <Field
                    label={reverseMode === 'sellingPrice' ? 'Target selling price (₹)' : 'Target purchase cost (₹)'}
                    className="sm:max-w-xs"
                  >
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={reverseTarget}
                      onChange={(e) => setReverseTarget(e.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <div>
                    <Button variant="secondary" size="sm" onClick={handleSolve} loading={reverseLoading}>
                      Solve
                    </Button>
                  </div>
                  {reverseError && <p className="text-xs text-danger">{reverseError}</p>}
                  {reverseResult && (
                    <div className="rounded-control bg-sunken px-3 py-2.5 text-sm">
                      {reverseMode === 'sellingPrice' && solvedMakingCharge !== null && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-ink-muted">Required making charge</span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono tabular-nums text-ink">
                              {formatSolved('makingChargeValue', solvedMakingCharge, form.makingChargeType)}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => proposeApply('makingChargeValue', solvedMakingCharge)}
                            >
                              Apply to form
                            </Button>
                          </span>
                        </div>
                      )}
                      {reverseMode === 'purchaseCost' && solvedWastage !== null && (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-ink-muted">Required wastage</span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono tabular-nums text-ink">{formatPercent(solvedWastage)}</span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => proposeApply('wastagePercentage', solvedWastage)}
                            >
                              Apply to form
                            </Button>
                          </span>
                        </div>
                      )}
                      {solvedMakingCharge === null && solvedWastage === null && (
                        <p className="text-xs text-ink-muted">
                          The server didn't return a recognised field for this mode yet — check the reverse
                          calculation endpoint's response shape once it's finalised.
                        </p>
                      )}
                    </div>
                  )}
                  {pendingApply && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-warning-soft px-3 py-2.5 text-sm text-ink">
                      <span>
                        Replace{' '}
                        <span className="font-mono tabular-nums">
                          {formatSolved(pendingApply.field, pendingApply.previous ?? 0, form.makingChargeType)}
                        </span>{' '}
                        with{' '}
                        <span className="font-mono tabular-nums">
                          {formatSolved(pendingApply.field, pendingApply.value, form.makingChargeType)}
                        </span>
                        ?
                      </span>
                      <span className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setPendingApply(null)}>
                          Keep current
                        </Button>
                        <Button size="sm" onClick={applyPending}>
                          Apply
                        </Button>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {submitError && (
            <p role="alert" className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              <AlertIcon size={16} className="mt-0.5 shrink-0" />
              {submitError}
            </p>
          )}
        </form>

        {/* 7. Pricing summary */}
        <div className="lg:sticky lg:top-[calc(var(--spacing-header)+1.25rem)]">
          <Card title="Pricing summary" description={previewLoading ? 'Recalculating…' : undefined}>
            {!canPreview ? (
              originalProduct?.price ? (
                <div className="flex flex-col gap-5">
                  <p className="text-xs text-warning">
                    Showing the last saved price — enter weight, purity and a metal rate above to recalculate.
                  </p>
                  <FigureStack
                    rows={[
                      { label: 'Metal value', value: originalProduct.price.basePrice },
                      { label: 'Making charge', value: originalProduct.price.makingChargeAmount },
                      { label: 'GST', value: originalProduct.price.tax },
                    ]}
                    total={{ label: 'Selling price', value: originalProduct.price.finalPrice }}
                  />
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Enter net weight, purity and a metal rate to see pricing.</p>
              )
            ) : previewError ? (
              <p className="flex items-start gap-2 text-sm text-danger">
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                Unable to calculate pricing. {previewError}
              </p>
            ) : preview ? (
              <div className="flex flex-col gap-5">
                <FigureStack
                  rows={[
                    {
                      label: 'Metal value',
                      value: preview.basePrice,
                      hint: effectiveRate !== null ? `${formatCurrency(effectiveRate)} / g` : 'Rate not set',
                    },
                    {
                      label: 'Making charge',
                      value: preview.makingChargeAmount,
                      hint:
                        form.makingChargeType === 'percentage'
                          ? `${formatPercent(makingValueNum)} of metal value`
                          : `${formatCurrency(makingValueNum)} / g`,
                    },
                    { label: 'GST', value: preview.tax },
                  ]}
                  total={{ label: 'Selling price', value: preview.finalPrice }}
                />

                <div className="flex flex-col gap-3">
                  <StatCard
                    label="Purchase cost"
                    value={formatCurrency(preview.purchaseCost)}
                    meta={purchaseRateForCalc !== null ? `Locked at ${formatCurrency(purchaseRateForCalc)} / g` : undefined}
                  />
                  <StatCard
                    label="Current cost"
                    value={formatCurrency(preview.currentCost)}
                    meta={effectiveRate !== null ? `At today's ${formatCurrency(effectiveRate)} / g` : undefined}
                  />
                </div>
                <p className="text-xs text-ink-muted">
                  Purchase and current cost are internal figures — they are not part of the selling price above.
                </p>

                <div>
                  <button
                    type="button"
                    onClick={() => setCalcOpen((open) => !open)}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    {calcOpen ? 'Hide calculation' : 'View calculation'}
                  </button>
                  {calcOpen && (
                    <pre className="m-0 mt-3 whitespace-pre-wrap rounded-control bg-sunken px-3 py-3 font-mono text-xs leading-relaxed text-ink-muted">
                      {calcLines.join('\n')}
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Calculating…</p>
            )}
          </Card>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="sticky bottom-[calc(var(--spacing-bottomnav)+env(safe-area-inset-bottom))] z-20 -mx-4 flex gap-3 border-t border-line bg-surface px-4 py-3 sm:hidden">
        <Button type="button" variant="secondary" fullWidth onClick={handleCancelClick} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" form="product-form" fullWidth loading={submitting}>
          {isEditing ? 'Save changes' : 'Create product'}
        </Button>
      </div>

      <ConfirmDialog
        open={showDiscardConfirm}
        title="Discard unsaved changes?"
        message="Your edits to this product will be lost."
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={() => {
          setShowDiscardConfirm(false)
          if (pendingNavigateTo) navigate(pendingNavigateTo)
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  )
}

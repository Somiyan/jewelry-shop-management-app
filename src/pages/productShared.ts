/**
 * Shared types and small pure helpers for the jewellery product form and
 * detail pages. Kept out of the design-system `components/` folder because
 * these are product-domain shapes, not reusable UI — but shared between
 * ProductFormPage and ProductDetailPage so the two stay in lock-step with
 * the backend pricing contract.
 */
import { useEffect, useState } from 'react'

export type MetalType = 'gold' | 'silver'
export type ProductType = 'ring' | 'necklace' | 'bracelet' | 'earring' | 'pendant'
export type SizeUnit = 'mm' | 'cm' | 'inch' | 'size'
export type MakingChargeType = 'percentage' | 'per_gram'

export const PRODUCT_TYPES: ProductType[] = ['ring', 'necklace', 'bracelet', 'earring', 'pendant']
export const METAL_TYPES: MetalType[] = ['gold', 'silver']
export const SIZE_UNITS: SizeUnit[] = ['mm', 'cm', 'inch', 'size']

/** Common purity presets shown in the Select, as plain percentages. */
export const PURITY_PRESETS = [
  { value: '99.9', label: '99.9% (fine gold / silver)' },
  { value: '99.5', label: '99.5%' },
  { value: '91.6', label: '91.6% (22K)' },
  { value: '90', label: '90%' },
  { value: '75', label: '75% (18K)' },
]

export interface Category {
  _id: string
  name: string
  description?: string
  isActive: boolean
}

export interface MetalRate {
  ratePerGram: number
  updatedAt?: string
  source?: string
}

export interface MetalRatesResponse {
  gold: MetalRate | null
  silver: MetalRate | null
}

export interface SizeLength {
  value: number
  unit: SizeUnit
}

/** The enriched breakdown the backend attaches to a product under `price`. */
export interface ProductPriceBreakdown {
  spotPricePerGram: number
  weightGrams: number
  basePrice: number
  markup: number
  laborCost: number
  subtotal: number
  tax: number
  finalPrice: number
  purity: number
  wastagePercentage: number
  effectiveGoldPercentage: number
  makingChargeType: MakingChargeType
  makingChargeValue: number
  makingChargeAmount: number
  purchaseMetalRate: number
  purchaseCost: number
  currentMetalRate: number
  currentCost: number
}

export interface Product {
  _id: string
  name: string
  type: ProductType
  metalType: MetalType
  sku: string
  quantity: number
  image?: string
  description?: string
  barcode?: string
  hsnCode?: string
  category?: string
  grossWeight: number
  netWeight: number
  purity: number
  wastagePercentage: number
  sizeLength?: SizeLength
  makingChargeType: MakingChargeType
  makingChargeValue: number
  purchaseMetalRate: number
  purchaseCost: number
  price: ProductPriceBreakdown | null
  priceError?: string
  level?: 'red' | 'yellow' | 'green'
  createdAt: string
  updatedAt: string
}

/**
 * Response shape of the forward-mode `/products/pricing/preview` call — it is
 * the exact same breakdown shape the backend attaches to a saved product
 * under `price`, just computed live from unsaved form inputs instead of a
 * persisted document.
 */
export type PricingPreviewResult = ProductPriceBreakdown

export interface AuditLogEntry {
  field: string
  oldValue: unknown
  newValue: unknown
  userId?: { username: string } | string | null
  reason?: string
  at: string
}

export function sentence(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function formatWeight(grams: number | null | undefined): string {
  if (grams === null || grams === undefined || Number.isNaN(grams)) return '—'
  return `${grams.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

/** Parses a form text input into a finite number, or null when not parseable. */
export function toNumber(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Debounces a value by `delayMs`. Used to throttle the live pricing-preview
 * call while the user is still typing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

/**
 * Normalizes a raw `/api/products/:id` (or list) response into the new
 * jewellery-product shape, tolerating the current (pre-migration) backend
 * which may still return the legacy `weightGrams` + string-enum `purity`
 * fields instead of `grossWeight` / `netWeight` / numeric `purity`. Never
 * invents pricing — only fills structural defaults so the form doesn't crash
 * against a product that hasn't been migrated yet.
 */
export function normalizeProduct(raw: Record<string, unknown>): Product {
  const legacyWeight = typeof raw.weightGrams === 'number' ? raw.weightGrams : undefined
  const purityRaw = raw.purity
  const purity = typeof purityRaw === 'number' && Number.isFinite(purityRaw) ? purityRaw : 0
  const sizeLength =
    raw.sizeLength &&
    typeof raw.sizeLength === 'object' &&
    typeof (raw.sizeLength as Record<string, unknown>).value === 'number'
      ? (raw.sizeLength as SizeLength)
      : undefined

  return {
    _id: String(raw._id ?? ''),
    name: typeof raw.name === 'string' ? raw.name : '',
    type: (raw.type as ProductType) ?? 'ring',
    metalType: (raw.metalType as MetalType) ?? 'gold',
    sku: typeof raw.sku === 'string' ? raw.sku : '',
    quantity: typeof raw.quantity === 'number' ? raw.quantity : 0,
    image: typeof raw.image === 'string' ? raw.image : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    barcode: typeof raw.barcode === 'string' ? raw.barcode : undefined,
    hsnCode: typeof raw.hsnCode === 'string' ? raw.hsnCode : undefined,
    category: typeof raw.category === 'string' ? raw.category : undefined,
    grossWeight: typeof raw.grossWeight === 'number' ? raw.grossWeight : (legacyWeight ?? 0),
    netWeight: typeof raw.netWeight === 'number' ? raw.netWeight : (legacyWeight ?? 0),
    purity,
    wastagePercentage: typeof raw.wastagePercentage === 'number' ? raw.wastagePercentage : 0,
    sizeLength,
    makingChargeType: raw.makingChargeType === 'per_gram' ? 'per_gram' : 'percentage',
    makingChargeValue: typeof raw.makingChargeValue === 'number' ? raw.makingChargeValue : 0,
    purchaseMetalRate: typeof raw.purchaseMetalRate === 'number' ? raw.purchaseMetalRate : 0,
    purchaseCost: typeof raw.purchaseCost === 'number' ? raw.purchaseCost : 0,
    price: (raw.price as ProductPriceBreakdown | null) ?? null,
    priceError: typeof raw.priceError === 'string' ? raw.priceError : undefined,
    level: (raw.level as Product['level']) ?? undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  }
}

export function metalLabel(metal: MetalType): string {
  return metal === 'gold' ? 'Gold' : 'Silver'
}

export function sizeUnitLabel(unit: SizeUnit): string {
  switch (unit) {
    case 'mm':
      return 'mm'
    case 'cm':
      return 'cm'
    case 'inch':
      return 'inch'
    case 'size':
    default:
      return 'ring size'
  }
}

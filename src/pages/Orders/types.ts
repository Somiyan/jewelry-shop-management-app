/**
 * Shared types for the Orders page and its custom/made-to-order workflow.
 * Mirrors the backend contract in orderController.js / models/Order.js
 * exactly — do not invent fields here that the API doesn't send.
 */

export type MetalType = 'gold' | 'silver'
export type MakingChargeType = 'percentage' | 'per_gram'
export type SizeUnit = 'mm' | 'cm' | 'inch' | 'size' | 'custom'
/**
 * A custom item now goes straight from `pending` to `converted` — marking it
 * ready creates its product in the same request. `ready` only ever appears on
 * records written before that automation landed, so it is still handled
 * everywhere but is never produced by a current flow.
 */
export type FulfillmentStatus = 'pending' | 'ready' | 'converted'
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'cheque' | 'bank-transfer' | 'other'

/**
 * `status` enum, additive over the original five values. Treated as a plain
 * string everywhere a value might not be one of these (e.g. legacy `draft`
 * data) — never crash on an unrecognised status.
 */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'in_manufacturing'
  | 'ready'
  | 'delivered'
  | 'completed'
  | 'cancelled'

/** Every forward status, ranked oldest-first. Drives the status filter tabs and
 * the manual override select. `cancelled` is a terminal side-state, not a step
 * on this line, and is handled separately. */
export const TRACKER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'in_manufacturing',
  'ready',
  'delivered',
  'completed',
]

export const ORDER_STATUSES: OrderStatus[] = [...TRACKER_STATUSES, 'cancelled']

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  in_manufacturing: 'In manufacturing',
  ready: 'Ready',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/**
 * The five stages a custom order actually travels through, as a customer would
 * describe them. Deliberately shorter than `ORDER_STATUSES`: `pending`,
 * `processing` and legacy `draft` are book-keeping values that map onto one of
 * these positions rather than earning a stage of their own.
 *
 * `advance` records what moves an order into the stage. The backend now promotes
 * ready/delivered/completed by itself, and saying so on the stage is the only
 * reliable way to stop staff clicking at an order that is already moving.
 */
export type JourneyStageId = 'confirmed' | 'in_manufacturing' | 'ready' | 'delivered' | 'completed'

export interface JourneyStage {
  id: JourneyStageId
  label: string
  advance: 'manual' | 'automatic'
  /** One line naming the event that lands the order in this stage. */
  detail: string
}

export const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: 'confirmed',
    label: 'Confirmed',
    advance: 'manual',
    detail: 'Set when the order is booked at the counter.',
  },
  {
    id: 'in_manufacturing',
    label: 'In manufacturing',
    advance: 'manual',
    detail: 'Set by hand when the piece goes to the karigar.',
  },
  {
    id: 'ready',
    label: 'Ready',
    advance: 'automatic',
    detail: 'Sets itself once every custom item has been marked ready.',
  },
  {
    id: 'delivered',
    label: 'Delivered',
    advance: 'automatic',
    detail: 'Sets itself when the finished piece is sold to the customer.',
  },
  {
    id: 'completed',
    label: 'Completed',
    advance: 'automatic',
    detail: 'Sets itself once the order is delivered and fully paid.',
  },
]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'other', label: 'Other' },
]

export const SIZE_UNITS: { value: SizeUnit; label: string }[] = [
  { value: 'mm', label: 'mm' },
  { value: 'cm', label: 'cm' },
  { value: 'inch', label: 'inch' },
  { value: 'size', label: 'Ring size' },
  { value: 'custom', label: 'Custom' },
]

/** The order-entry purity presets called for in the brief — a smaller set
 * than the product form's, which also lists 99.5%/90%. */
export const ORDER_PURITY_PRESETS = [
  { value: '99.9', label: '99.9% (fine)' },
  { value: '91.6', label: '91.6% (22K)' },
  { value: '75', label: '75% (18K)' },
]

export interface CustomerRef {
  _id: string
  name: string
  phone: string
}

export interface CustomerOption {
  _id: string
  name: string
  phone: string
  loyaltyPoints?: number
  email?: string
  address?: string
}

export interface Category {
  _id: string
  name: string
  description?: string
  isActive: boolean
}

export interface MetalRate {
  ratePerGram: number
  createdAt?: string
}

export interface MetalRatesResponse {
  gold: MetalRate | null
  silver: MetalRate | null
}

export interface ProductPrice {
  spotPricePerGram: number
  weightGrams: number
  basePrice: number
  markup: number
  laborCost: number
  subtotal: number
  tax: number
  finalPrice: number
}

export interface Product {
  _id: string
  name: string
  sku: string
  metalType: string
  purity: string | number
  quantity: number
  price: ProductPrice | null
  priceError?: string
}

/** A stock-linked line item — unchanged shape, sells against a real Product. */
export interface StockOrderItem {
  isCustomOrder?: false
  productId: string
  name: string
  metalType: string
  purity: string | number
  weightGrams: number
  quantity: number
  spotPrice: number
  markup: number
  laborCost: number
  tax: number
  finalPrice: number
  discount?: number
}

/** A custom/made-to-order line item — no Product, no stock movement. */
export interface CustomOrderItem {
  isCustomOrder: true
  name: string
  category: string
  description?: string
  metalType: MetalType
  purity: number
  wastagePercentage?: number
  estimatedWeight: number
  weightGrams: number
  sizeValue?: number
  sizeUnit?: SizeUnit
  makingChargeType: MakingChargeType
  makingChargeValue: number
  quantity: number
  spotPrice: number
  markup: number
  laborCost: number
  tax: number
  finalPrice: number
  estimatedPrice: number
  fulfillmentStatus: FulfillmentStatus
  productId?: string
  finalGrossWeight?: number
  finalNetWeight?: number
  finalPurity?: number
  finalMakingChargeType?: MakingChargeType
  finalMakingChargeValue?: number
  finalGoldRate?: number
}

/** The product the backend creates when a custom item is marked ready. Only
 * the fields the order UI reads are declared — the API returns the full
 * document. */
export interface CreatedProduct {
  _id: string
  name: string
  sku: string
  quantity: number
  metalType?: string
  purity?: string | number
}

/** `PATCH /orders/:id/items/:itemIndex/ready` success shape: the updated order,
 * with the newly created product alongside it (`null` when the item already
 * had one). */
export type MarkReadyResponse = Order & { createdProduct: CreatedProduct | null }

/** `POST /orders/:id/items/:itemIndex/convert-to-product` success shape — the
 * legacy path, kept for items marked ready before conversion was automatic. */
export interface ConvertToProductResponse {
  order: Order
  product: CreatedProduct
}

export type OrderItem = StockOrderItem | CustomOrderItem

export function isCustomItem(item: OrderItem): item is CustomOrderItem {
  return item.isCustomOrder === true
}

export type OrderPaymentStatus = 'unpaid' | 'partial' | 'paid'

/** A single entry in the append-only advance/token payment ledger. Replaces
 * the old single-snapshot `Advance` — an order can now be paid off across
 * several installments while a custom piece is being manufactured. */
export interface AdvancePayment {
  _id: string
  amount: number
  method: PaymentMethod
  date: string
  reference: string
  notes: string
  /** User id, not populated — never render as a name. */
  recordedBy?: string
  /** Absent on payments migrated from the old single-advance snapshot. */
  createdAt?: string
}

export interface Order {
  _id: string
  customerId: CustomerRef | string
  items: OrderItem[]
  totalAmount: number
  discount?: number
  status: OrderStatus | string
  deliveryDate?: string
  notes?: string
  /** Full ledger, oldest first as pushed. */
  advancePayments: AdvancePayment[]
  /** Derived server-side — sum of `advancePayments`. Never trust a stale
   * client sum in its place. */
  advanceTotal: number
  /** Derived server-side — `totalAmount - advanceTotal`. */
  balanceDue: number
  /** Derived server-side. */
  paymentStatus: OrderPaymentStatus
  createdAt: string
  updatedAt?: string
}

/** A stock line in the "from stock" tab — unchanged from the original form. */
export interface OrderLine {
  productId: string
  quantity: string
}

/** Client-side draft of a custom/made-to-order item, before it is submitted.
 * String-typed number fields follow the same convention as ProductFormPage's
 * FormState — easiest to bind directly to inputs, parsed with `toNumber`. */
export interface CustomItemDraft {
  /** Client-only key for list rendering / edit-in-place. Never sent to the API. */
  id: string
  itemName: string
  /** One of the Category Master names, or `__other__` to reveal free text. */
  categorySelect: string
  categoryOther: string
  description: string
  metalType: MetalType
  estimatedWeight: string
  purityPreset: string
  purityCustom: string
  wastagePercentage: string
  sizeValue: string
  sizeUnit: SizeUnit
  makingChargeType: MakingChargeType
  makingChargeValue: string
  quantity: string
  /** admin/manager only. */
  rateOverride: string
}

/** Resolves the effective category string, honouring the "Other" escape hatch. */
export function resolvedCategory(draft: CustomItemDraft): string {
  return draft.categorySelect === '__other__' ? draft.categoryOther.trim() : draft.categorySelect
}

/** Resolves the effective purity number, honouring the "Custom" preset. */
export function resolvedPurity(draft: CustomItemDraft): number | null {
  const raw = draft.purityPreset === 'custom' ? draft.purityCustom : draft.purityPreset
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

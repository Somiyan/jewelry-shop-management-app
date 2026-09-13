import type { MakingChargeOverride } from '../../api/sales'

export type MetalType = 'gold' | 'silver'
export type ProductType = 'ring' | 'necklace' | 'bracelet' | 'earring' | 'pendant'
export type StockLevel = 'red' | 'yellow' | 'green'
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'cheque' | 'bank-transfer' | 'other'
export type CommPref = 'sms' | 'email' | 'whatsapp'
export type PaymentStatus = 'pending' | 'paid' | 'partial'

/**
 * The sales pricing/checkout types live in `src/api/sales.ts` — this is the
 * single source of truth for their shape (mirrors the backend contract
 * exactly). Re-exported here so the rest of the wizard can keep importing
 * from `./types` without caring which module owns the definition.
 */
export type {
  BelowValueApproval,
  BelowValueWarning,
  BillingType,
  CalculateSalePayload,
  CheckoutPayload,
  CheckoutResult,
  InvoiceResult,
  MakingChargeOverride,
  MakingChargeType,
  OrderResult,
  SaleCalculation,
  SaleLine,
  SalesPolicy,
} from '../../api/sales'

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
  type: ProductType
  metalType: MetalType
  /** Purity PERCENTAGE (e.g. 91.6 for 22K gold) — never a karat label. Matches the Product module's own schema exactly. */
  purity: number
  weightGrams: number
  sku: string
  quantity: number
  image?: string
  description?: string
  barcode?: string
  category?: string
  price: ProductPrice | null
  priceError?: string
  level: StockLevel
  createdAt: string
  updatedAt: string
}

export interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  address?: string
  notes?: string
  loyaltyPoints: number
  totalPurchases: number
  billingAddress?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
  communicationPreferences?: CommPref[]
  createdAt?: string
  updatedAt?: string
}

export interface CartLine {
  productId: string
  name: string
  sku: string
  metalType: string
  purity: string
  weightGrams: number
  category?: string
  unitPrice: number | null
  unitTax: number
  availableQuantity: number
  quantity: number
  discount: number
  /**
   * The only making-charge state the frontend owns. Everything else about a
   * line's price (current cost, selling price, tax) comes from the latest
   * `/sales/calculate` response and is never duplicated here.
   */
  makingChargeOverride?: MakingChargeOverride
}

/** The wizard sequence. Numbering these in the UI is legitimate — it is a
 *  genuine ordered flow, the one place in the app where step numbers belong. */
export const STEP_LABELS = ['Products', 'Customer', 'Billing', 'Review', 'Done'] as const
export type StepIndex = 0 | 1 | 2 | 3 | 4

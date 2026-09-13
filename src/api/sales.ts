/**
 * Sales pricing & checkout API.
 *
 * GST/Non-GST billing, making-charge adjustment and the below-current-value
 * approval gate are all business rules enforced server-side. This module
 * never computes a price, a tax figure or a making-charge amount — it only
 * sends the customer's/salesperson's choices to the backend and returns
 * exactly what `POST /api/sales/calculate` and `POST /api/sales/checkout`
 * respond with, for the Sales Journey wizard to render as-is.
 */
import { apiClient } from './client'

/* ---------------------------------------------------------------- types --- */

export type BillingType = 'GST' | 'NON_GST'
export type MakingChargeType = 'percentage' | 'per_gram'

export interface MakingChargeOverride {
  type: MakingChargeType
  value: number
}

/** GET /sales/policy — call once per wizard session (or cache it). */
export interface SalesPolicy {
  /** Preselect this on the Billing step. */
  defaultBillingType: BillingType
  /** false = only a user with `canApproveBelowValueSale` may complete a below-value sale. */
  allowBelowCurrentPriceSale: boolean
  /** THIS user's permission — gates the making-charge input's editability. */
  canAdjustMakingCharge: boolean
  /** THIS user's permission — relevant only when `allowBelowCurrentPriceSale` is false. */
  canApproveBelowValueSale: boolean
}

export interface SaleLineItemInput {
  productId: string
  quantity: number
  discount?: number
  makingChargeOverride?: MakingChargeOverride
}

export interface CalculateSalePayload {
  items: SaleLineItemInput[]
  /** Omit to use the policy default. */
  billingType?: BillingType
  /** Needed for accurate inter-state detection; omit before a customer is picked. */
  customerId?: string
  /** Order-level discount, applied before tax. */
  discount?: number
}

/** One priced line from `POST /sales/calculate` — render every field, never re-derive one. */
export interface SaleLine {
  productId: string
  name: string
  metalType: string
  quantity: number
  purity: string | number
  grossWeight: number
  netWeight: number
  weightGrams: number
  hsnCode: string
  /** Live rate used for this line. */
  goldRate: number
  /** Wastage-inclusive cost — identical to what Product Detail shows for this product. The reference figure for this line. */
  currentCost: number
  /** currentCost + makingChargeAmount, before this line's own discount. */
  calculatedSellingPrice: number
  /** Product Master's configured default — always shown for reference. */
  defaultMakingChargeType: MakingChargeType
  defaultMakingChargeValue: number
  /** What's actually applied to this sale (may equal the default). */
  saleMakingChargeType: MakingChargeType
  saleMakingChargeValue: number
  makingChargeAdjusted: boolean
  makingChargeAmount: number
  /** This line's own discount. */
  discount: number
  /** Pre-tax, post making-charge, post line-discount. calculatedSellingPrice - discount. */
  sellingPrice: number
  /** This line's share of GST (0 for Non-GST). */
  tax: number
  /** sellingPrice + tax — what this line actually costs the customer. */
  finalPrice: number
  /** sellingPrice - currentCost. Negative = below cost. */
  difference: number
  marginPercent: number
  belowCurrentCost: boolean
  /** True if an override was sent but the user isn't permitted — backend fell back to default. */
  makingChargeOverrideIgnored: boolean
}

export interface BelowValueWarning {
  warning: 'SELLING_BELOW_CURRENT_COST'
  productId: string
  productName: string
  currentCost: number
  sellingValue: number
  difference: number
  requiresApproval: boolean
}

/** The full response from `POST /sales/calculate` — the single source of truth for every price shown from the Products step onward. */
export interface SaleCalculation {
  billingType: BillingType
  isInterState: boolean
  shopGstin: string
  shopState: string
  lines: SaleLine[]
  /** Sum of every line's currentCost — the "Current cost" figure in the cart summary. */
  currentCostTotal: number
  makingChargeTotal: number
  lineDiscountTotal: number
  /** Sum of sellingPrice across lines, pre order-discount. */
  subtotal: number
  orderDiscount: number
  /** subtotal - orderDiscount. Discount is applied before tax. */
  taxableAmount: number
  taxAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  /** taxableAmount + taxAmount. */
  grandTotal: number
  /** One entry per below-value line, not one generic invoice-level flag. */
  warnings: BelowValueWarning[]
  allowBelowCurrentPriceSale: boolean
  canAdjustMakingCharge: boolean
  customerGstin: string
}

export interface BelowValueApproval {
  approved: boolean
  /** Required when `allowBelowCurrentPriceSale` is false; optional otherwise. */
  reason?: string
}

export interface CheckoutPayload {
  customerId: string
  items: SaleLineItemInput[]
  billingType?: BillingType
  discount?: number
  billingAddress?: string
  communicationPreferences?: string[]
  payment: { method: string; amountPaid: number; reference?: string }
  notes?: string
  /** One blanket approval covering every flagged line in this sale. */
  belowValueApproval?: BelowValueApproval
}

export interface OrderResult {
  _id: string
  status: string
  totalAmount: number
  createdAt: string
  billingType?: BillingType
  isInterState?: boolean
  cgstAmount?: number
  sgstAmount?: number
  igstAmount?: number
}

export interface InvoiceResult {
  _id: string
  invoiceNumber: string
  orderId: string
  subtotal: number
  discount: number
  taxAmount: number
  finalAmount: number
  amountPaid: number
  paymentMethod: string
  paymentStatus: 'pending' | 'paid' | 'partial'
  billingType?: BillingType
  isInterState?: boolean
  cgstAmount?: number
  sgstAmount?: number
  igstAmount?: number
  customerGstin?: string
  shopGstin?: string
}

export interface CheckoutResult {
  order: OrderResult
  invoice: InvoiceResult
  /** Non-fatal: the sale went through even if a related order's lifecycle status couldn't update. */
  lifecycleWarning?: string | null
}

/**
 * The shape a 409/403 checkout rejection carries in its response body per the
 * API contract. NOTE: as of this build the backend's generic error handler
 * does not yet forward `warnings`/`requiresApproval` onto the JSON body (it
 * only sends `message`) — see the frontend's below-value approval flow for
 * how it stays correct regardless, by falling back to the last successful
 * `/sales/calculate` response.
 */
export interface CheckoutRejection {
  message: string
  warnings?: BelowValueWarning[]
  requiresApproval?: boolean
}

/* ------------------------------------------------------------ endpoints --- */

export async function getSalesPolicy(): Promise<SalesPolicy> {
  const { data } = await apiClient.get<SalesPolicy>('/sales/policy')
  return data
}

/** Pure preview, no side effects — safe to call as often as needed (debounced). */
export async function calculateSale(payload: CalculateSalePayload): Promise<SaleCalculation> {
  const { data } = await apiClient.post<SaleCalculation>('/sales/calculate', payload)
  return data
}

export async function checkout(payload: CheckoutPayload): Promise<CheckoutResult> {
  const { data } = await apiClient.post<CheckoutResult>('/sales/checkout', payload)
  return data
}

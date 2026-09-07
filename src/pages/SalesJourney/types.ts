export type MetalType = 'gold' | 'silver'
export type Purity = '24K' | '22K' | '18K' | '925'
export type ProductType = 'ring' | 'necklace' | 'bracelet' | 'earring' | 'pendant'
export type StockLevel = 'red' | 'yellow' | 'green'
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'cheque' | 'bank-transfer' | 'other'
export type CommPref = 'sms' | 'email' | 'whatsapp'
export type PaymentStatus = 'pending' | 'paid' | 'partial'

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
  purity: Purity
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
  category?: string
  unitPrice: number | null
  unitTax: number
  availableQuantity: number
  quantity: number
  discount: number
}

export interface OrderResult {
  _id: string
  status: string
  totalAmount: number
  createdAt: string
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
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
}

export interface CheckoutResult {
  order: OrderResult
  invoice: InvoiceResult
}

/** The wizard sequence. Numbering these in the UI is legitimate — it is a
 *  genuine ordered flow, the one place in the app where step numbers belong. */
export const STEP_LABELS = ['Products', 'Customer', 'Billing', 'Review', 'Done'] as const
export type StepIndex = 0 | 1 | 2 | 3 | 4

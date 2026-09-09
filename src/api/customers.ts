/**
 * Customers API — contacts plus the financial rollups (outstanding balance,
 * purchase history, ledger) that live alongside them.
 *
 * `Customer` is the single source of truth for the shape returned by
 * `/customers` — pages import it from here rather than redeclaring it.
 */
import { apiClient } from './client'

/* ---------------------------------------------------------------- types --- */

export type CommunicationChannel = 'sms' | 'email' | 'whatsapp'

/** Legacy embedded purchase entry, still returned on the base customer record. */
export interface CustomerPurchase {
  orderId: string
  amount: number
  date: string
}

/** Derived, read-only status — never sent back to the server. */
export type CustomerPaymentStatus = 'no-invoices' | 'outstanding' | 'paid'

export interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  address?: string
  billingAddress?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
  communicationPreferences?: CommunicationChannel[]
  notes?: string
  loyaltyPoints: number
  totalPurchases: number
  purchases?: CustomerPurchase[]
  createdAt?: string
  updatedAt?: string

  /** Financial rollup — present on every row from `GET /customers` and the summary endpoint. */
  totalInvoiced?: number
  invoiceCount?: number
  /** Sum of ACTIVE (non-reversed) payments. */
  totalPaid?: number
  orderCount?: number
  /** "Outstanding" — never negative, clamped at 0. */
  pendingBalance?: number
  /** >0 only when the customer has overpaid. Show only when positive. */
  creditBalance?: number
  paymentStatus?: CustomerPaymentStatus
  lastInvoiceDate?: string | null
}

export interface CustomerFormPayload {
  name: string
  phone: string
  email?: string
  address?: string
  billingAddress?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
  communicationPreferences?: CommunicationChannel[]
  notes?: string
}

export type CustomerOutstandingFilter = 'outstanding' | 'paid' | 'none'

export type CustomerSort =
  | 'name'
  | 'highest-outstanding'
  | 'lowest-outstanding'
  | 'highest-purchase'
  | 'recent-purchase'

export interface ListCustomersParams {
  q?: string
  outstanding?: CustomerOutstandingFilter
  sort?: CustomerSort
}

/** The KPI set for a customer's profile page. */
export interface CustomerSummary {
  customer: Customer
  totalInvoiced: number
  invoiceCount: number
  totalPaid: number
  orderCount: number
  pendingBalance: number
  creditBalance: number
  paymentStatus: CustomerPaymentStatus
  lastInvoiceDate: string | null
}

export interface CustomerPurchaseItem {
  name: string
  quantity: number
}

export type PurchaseInvoicePaymentStatus = 'pending' | 'partial' | 'paid'

export interface CustomerPurchaseRecord {
  _id: string
  invoiceNumber: string
  orderId: { _id: string; orderNumber: string; status: string } | null
  invoiceDate: string
  items: CustomerPurchaseItem[]
  finalAmount: number
  amountPaid: number
  balance: number
  paymentStatus: PurchaseInvoicePaymentStatus
}

export type CustomerLedgerEntryType = 'invoice' | 'payment'

export interface CustomerLedgerEntry {
  date: string
  type: CustomerLedgerEntryType
  reference: string | null
  debit: number
  credit: number
  /** Running outstanding balance after this entry. */
  balance: number
  method?: string
  recordedBy?: string | null
}

export interface CustomerPaymentRow {
  _id: string
  invoiceId: { _id: string; invoiceNumber: string }
  customerId: string
  amount: number
  method: string
  date: string
  reference?: string
  notes?: string
  source: 'manual' | 'order-advance' | 'legacy-migration'
  status: 'ACTIVE' | 'REVERSED'
  reversal?: { reason: string; reversedBy?: string; reversedAt?: string }
  createdBy?: { _id: string; username: string } | null
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------ endpoints --- */

export async function listCustomers(params: ListCustomersParams = {}): Promise<Customer[]> {
  const query: Record<string, string> = {}
  if (params.q?.trim()) query.q = params.q.trim()
  if (params.outstanding) query.outstanding = params.outstanding
  if (params.sort) query.sort = params.sort
  const { data } = await apiClient.get<Customer[]>('/customers', { params: query })
  return data
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data } = await apiClient.get<Customer>(`/customers/${id}`)
  return data
}

export async function createCustomer(payload: CustomerFormPayload): Promise<Customer> {
  const { data } = await apiClient.post<Customer>('/customers', payload)
  return data
}

export async function updateCustomer(id: string, payload: CustomerFormPayload): Promise<Customer> {
  const { data } = await apiClient.put<Customer>(`/customers/${id}`, payload)
  return data
}

export async function getCustomerSummary(id: string): Promise<CustomerSummary> {
  const { data } = await apiClient.get<CustomerSummary>(`/customers/${id}/summary`)
  return data
}

/** Purchase history — one row per invoice. */
export async function getCustomerPurchases(id: string): Promise<CustomerPurchaseRecord[]> {
  const { data } = await apiClient.get<CustomerPurchaseRecord[]>(`/customers/${id}/purchases`)
  return data
}

/** Chronological (oldest first) debit/credit ledger with a running balance. */
export async function getCustomerLedger(id: string): Promise<CustomerLedgerEntry[]> {
  const { data } = await apiClient.get<CustomerLedgerEntry[]>(`/customers/${id}/ledger`)
  return data
}

/** Every payment across all of this customer's invoices, newest first. */
export async function getCustomerPayments(id: string): Promise<CustomerPaymentRow[]> {
  const { data } = await apiClient.get<CustomerPaymentRow[]>(`/customers/${id}/payments`)
  return data
}

/* -------------------------------------------------------------- helpers --- */

export const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  sms: 'SMS',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

/** Most recent purchase date from the legacy embedded `purchases` array, or null. */
export function lastPurchaseDate(customer: Customer): string | null {
  const purchases = customer.purchases
  if (!purchases || purchases.length === 0) return null
  return purchases.reduce<string | null>((latest, purchase) => {
    if (!purchase.date) return latest
    if (!latest) return purchase.date
    return new Date(purchase.date) > new Date(latest) ? purchase.date : latest
  }, null)
}

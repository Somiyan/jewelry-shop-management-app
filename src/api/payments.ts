/**
 * Payments API — recording, reversing and receipting payments against an
 * invoice. Pricing/derivation stays server-side: this module never computes
 * a balance, it only reads what the backend already derived.
 */
import { apiClient } from './client'

/* ---------------------------------------------------------------- types --- */

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'cheque' | 'bank-transfer' | 'other'

/** `order-advance` = deposit paid before the invoice existed; `legacy-migration` = predates payment tracking. */
export type PaymentSource = 'manual' | 'order-advance' | 'legacy-migration'

export type PaymentRecordStatus = 'ACTIVE' | 'REVERSED'

export interface PaymentUserRef {
  _id: string
  username: string
  role?: string
}

export interface PaymentReversal {
  reason: string
  reversedBy?: PaymentUserRef | string
  reversedAt?: string
}

export interface Payment {
  _id: string
  invoiceId: string
  customerId: string
  amount: number
  method: PaymentMethod
  date: string
  reference?: string
  notes?: string
  source: PaymentSource
  status: PaymentRecordStatus
  reversal?: PaymentReversal
  createdBy?: PaymentUserRef | null
  createdAt: string
  updatedAt: string
}

export interface AddPaymentPayload {
  amount: number
  method?: PaymentMethod
  /** ISO string. Defaults to now on the server. */
  date?: string
  reference?: string
  notes?: string
}

export interface PaymentReceiptSnapshot {
  previousBalance: number
  paymentReceived: number
  remainingBalance: number
}

/** Slim view of the invoice a payment was recorded against — enough to refresh a summary panel. */
export interface InvoicePaymentSnapshot {
  _id: string
  invoiceNumber: string
  finalAmount: number
  amountPaid: number
  paymentStatus: 'pending' | 'partial' | 'paid'
  outstanding: number
}

export interface AddPaymentResponse {
  payment: Payment
  invoice: InvoicePaymentSnapshot
  receipt: PaymentReceiptSnapshot
}

export interface ReversePaymentResponse {
  payment: Payment
  invoice: InvoicePaymentSnapshot
}

export interface UpdatePaymentPayload {
  reference?: string
  notes?: string
}

export interface Receipt {
  receiptNumber: string
  customer: { _id: string; name: string; phone: string; email?: string }
  invoiceNumber: string
  paymentDate: string
  amountReceived: number
  paymentMethod: PaymentMethod
  reference?: string
  notes?: string
  recordedBy?: string
  previousBalance: number
  paymentReceived: number
  remainingBalance: number
  voided: boolean
}

/** Cheap balance check, matches the shape returned inline elsewhere. */
export interface InvoiceOutstanding {
  finalAmount: number
  amountPaid: number
  outstanding: number
  paymentStatus: 'pending' | 'partial' | 'paid'
}

/* ------------------------------------------------------------ endpoints --- */

/** Payment history for one invoice, oldest first. */
export async function getInvoicePayments(invoiceId: string): Promise<Payment[]> {
  const { data } = await apiClient.get<Payment[]>(`/invoices/${invoiceId}/payments`)
  return data
}

export async function getInvoiceOutstanding(invoiceId: string): Promise<InvoiceOutstanding> {
  const { data } = await apiClient.get<InvoiceOutstanding>(`/invoices/${invoiceId}/outstanding`)
  return data
}

export async function addPayment(
  invoiceId: string,
  payload: AddPaymentPayload,
): Promise<AddPaymentResponse> {
  const { data } = await apiClient.post<AddPaymentResponse>(`/invoices/${invoiceId}/payments`, payload)
  return data
}

/** Immutable once recorded — only `reference`/`notes` can be edited; reverse + re-add for anything else. */
export async function updatePayment(paymentId: string, payload: UpdatePaymentPayload): Promise<Payment> {
  const { data } = await apiClient.put<Payment>(`/payments/${paymentId}`, payload)
  return data
}

export async function reversePayment(paymentId: string, reason: string): Promise<ReversePaymentResponse> {
  const { data } = await apiClient.post<ReversePaymentResponse>(`/payments/${paymentId}/reverse`, {
    reason,
  })
  return data
}

export async function getReceipt(paymentId: string): Promise<Receipt> {
  const { data } = await apiClient.get<Receipt>(`/payments/${paymentId}/receipt`)
  return data
}

/* -------------------------------------------------------------- helpers --- */

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'upi', 'cheque', 'bank-transfer', 'other']

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  cheque: 'Cheque',
  'bank-transfer': 'Bank transfer',
  other: 'Other',
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method
}

export function paymentMethodOptions(): { value: PaymentMethod; label: string }[] {
  return PAYMENT_METHODS.map((method) => ({ value: method, label: paymentMethodLabel(method) }))
}

/** Label for how a payment entered the ledger — advances and legacy rows are shown, not hidden. */
export function paymentSourceLabel(source: PaymentSource): string | null {
  switch (source) {
    case 'order-advance':
      return 'Advance'
    case 'legacy-migration':
      return 'Recorded before payment tracking'
    case 'manual':
    default:
      return null
  }
}

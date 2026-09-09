import type { BillingType, MakingChargeType } from '../../api/sales'
import { formatCurrency } from '../../utils/format'

/** Shared option list for the making-charge type toggle (ProductStep, ReviewStep). */
export const MAKING_CHARGE_TYPES: { value: MakingChargeType; label: string }[] = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'per_gram', label: 'Per gram' },
]

/** Shared option list for the GST / Non-GST toggle (ProductStep, BillingStep). */
export const BILLING_TYPES: { value: BillingType; label: string }[] = [
  { value: 'GST', label: 'GST' },
  { value: 'NON_GST', label: 'Non-GST' },
]

/** "10%" or "₹40/g" — the compact form used in captions and table cells. */
export function formatMakingCharge(type: MakingChargeType, value: number): string {
  return type === 'percentage' ? `${value}%` : `${formatCurrency(value)}/g`
}

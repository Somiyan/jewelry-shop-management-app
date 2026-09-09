import type { CustomerPaymentStatus } from '../api/customers'
import type { RateSourceType, RateStatusLabel } from '../api/rates'
import type { BadgeTone } from '../components/Badge'

export type { BadgeTone }

/**
 * Legacy helper for pages not yet on `<Badge>`; it now returns the same token
 * classes the Badge component uses, so old and new markup match.
 */
export function badgeClasses(tone: BadgeTone): string {
  switch (tone) {
    case 'success':
      return 'bg-success-soft text-success'
    case 'warning':
      return 'bg-warning-soft text-warning'
    case 'danger':
      return 'bg-danger-soft text-danger'
    case 'info':
      return 'bg-info-soft text-info'
    case 'gold':
      return 'bg-sunken text-gold'
    case 'silver':
      return 'bg-sunken text-silver'
    case 'neutral':
    default:
      return 'bg-sunken text-ink-muted'
  }
}

export function paymentStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'paid':
      return 'success'
    case 'partial':
      return 'warning'
    case 'pending':
    default:
      return 'danger'
  }
}

/**
 * Copy for an invoice's derived `paymentStatus` ('pending'/'partial'/'paid').
 * Sentence case, spelled out — never rely on the badge colour alone.
 */
export function invoicePaymentStatusLabel(status: string): string {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'partial':
      return 'Partially paid'
    case 'pending':
    default:
      return 'Unpaid'
  }
}

/** Tone for a customer's rolled-up `paymentStatus` (outstanding balance across all invoices). */
export function customerPaymentStatusTone(status: CustomerPaymentStatus | undefined): BadgeTone {
  switch (status) {
    case 'paid':
      return 'success'
    case 'outstanding':
      return 'warning'
    case 'no-invoices':
    default:
      return 'neutral'
  }
}

export function customerPaymentStatusLabel(status: CustomerPaymentStatus | undefined): string {
  switch (status) {
    case 'paid':
      return 'No outstanding'
    case 'outstanding':
      return 'Outstanding'
    case 'no-invoices':
    default:
      return 'No invoices'
  }
}

/** Tone for an order's derived `paymentStatus` (`unpaid`/`partial`/`paid`) —
 * distinct from `paymentStatusTone`, which maps the invoice status union
 * (`paid`/`partial`/`pending`). */
export function orderPaymentStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'paid':
      return 'success'
    case 'partial':
      return 'warning'
    case 'unpaid':
    default:
      return 'danger'
  }
}

export function orderStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'delivered':
    case 'completed':
      return 'success'
    case 'ready':
      return 'info'
    case 'processing':
    case 'confirmed':
    case 'in_manufacturing':
      return 'warning'
    case 'cancelled':
      return 'danger'
    case 'pending':
      return 'danger'
    // Unrecognised/legacy statuses (e.g. `draft`) get a neutral tone rather
    // than defaulting to danger, which would misrepresent them as a problem.
    default:
      return 'neutral'
  }
}

export type StockLevel = 'red' | 'yellow' | 'green'

export function stockLevelTone(level: StockLevel): BadgeTone {
  switch (level) {
    case 'red':
      return 'danger'
    case 'yellow':
      return 'warning'
    case 'green':
    default:
      return 'success'
  }
}

export function stockLevelLabel(level: StockLevel): string {
  switch (level) {
    case 'red':
      return 'Out of stock'
    case 'yellow':
      return 'Low stock'
    case 'green':
    default:
      return 'In stock'
  }
}

/**
 * Tone for a rate's derived status label. STALE is a warning, not an error:
 * the rate still works, it is just old enough that the shop should re-check it.
 */
export function rateStatusTone(label: RateStatusLabel): BadgeTone {
  switch (label) {
    case 'LIVE':
      return 'success'
    case 'MANUAL':
      return 'info'
    case 'STALE':
      return 'warning'
    case 'NONE':
    default:
      return 'neutral'
  }
}

/**
 * Badge text for a rate status. Sentence case per DESIGN.md; the point is that
 * the status is spelled out at all, so colour is never carrying it alone.
 */
export function rateStatusLabelText(label: RateStatusLabel): string {
  switch (label) {
    case 'LIVE':
      return 'Live'
    case 'MANUAL':
      return 'Manual'
    case 'STALE':
      return 'Stale'
    case 'NONE':
    default:
      return 'Not set'
  }
}

/** How a rate got into the ledger. */
export function rateSourceLabel(sourceType: RateSourceType | undefined): string {
  return sourceType === 'LIVE_API' ? 'Live API' : 'Manual'
}

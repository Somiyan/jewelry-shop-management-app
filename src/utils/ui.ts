import type { BadgeTone } from '../components/Badge'

/**
 * Legacy raw class strings. Phase 2 replaces every call site with the
 * `<Input>` / `<Field>` components — do not use these in new code.
 */
export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
export const labelClass = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300'

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

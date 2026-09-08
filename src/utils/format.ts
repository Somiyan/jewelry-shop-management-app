import axios from 'axios'

export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
})

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return currencyFormatter.format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function extractErrorMessage(err: unknown): string {
  return axios.isAxiosError<{ message?: string }>(err)
    ? (err.response?.data?.message ?? 'Unable to reach the server. Please try again.')
    : 'Something went wrong. Please try again.'
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "4 minutes ago" / "2 days ago" from an ISO timestamp. */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return 'never updated'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return 'never updated'
  const seconds = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return relativeFormatter.format(Math.round(seconds), 'second')
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2592000) return relativeFormatter.format(Math.round(seconds / 86400), 'day')
  return relativeFormatter.format(Math.round(seconds / 2592000), 'month')
}

/** "8 Sep 2026, 2:26 pm" — used where the exact instant matters (audit rows). */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Start of the given calendar day (from a `<input type="date">` value), as ISO. */
export function dayStartIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** End of the given calendar day, so a `to` filter includes that whole day. */
export function dayEndIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

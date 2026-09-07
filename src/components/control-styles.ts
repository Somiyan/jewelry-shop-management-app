import { cx } from '../utils/cx'

/**
 * Shared field styling for Input / Select / Textarea so every control in the app
 * has the same height, hairline and focus treatment.
 * Touch targets stay 44px on small screens and tighten to 40px from `md`.
 */
export const controlBase =
  'w-full rounded-control border bg-surface text-sm text-ink placeholder:text-ink-muted/70 transition-colors outline-none disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-muted'

export const controlHeight = 'h-11 md:h-10'

export function controlClass(invalid?: boolean, extra?: string): string {
  return cx(
    controlBase,
    invalid ? 'border-danger focus:border-danger' : 'border-line focus:border-accent',
    extra,
  )
}

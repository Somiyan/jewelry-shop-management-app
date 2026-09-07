import { cx } from '../utils/cx'

export interface MetalSwatchProps {
  /** Free-form metal string from the API, e.g. "gold", "Silver", "22K gold". */
  metal: string
  /** Overrides the printed text. Defaults to `metal`. */
  label?: string
  /** Dot only, no text. Give the parent cell its own accessible text. */
  hideLabel?: boolean
  className?: string
}

function swatchColor(metal: string): string {
  const value = metal.toLowerCase()
  if (value.includes('gold')) return 'bg-gold'
  if (value.includes('silver') || value.includes('platinum')) return 'bg-silver'
  return 'bg-ink-muted'
}

/** The only place gold/silver colour is allowed: identifying the merchandise. */
export function MetalSwatch({ metal, label, hideLabel, className }: MetalSwatchProps) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm text-ink', className)}>
      <span
        className={cx('h-2 w-2 shrink-0 rounded-full', swatchColor(metal))}
        aria-hidden="true"
      />
      {hideLabel ? <span className="sr-only">{label ?? metal}</span> : (label ?? metal)}
    </span>
  )
}

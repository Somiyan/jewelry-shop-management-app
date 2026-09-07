import type { ReactNode } from 'react'
import { formatCurrency } from '../utils/format'
import { cx } from '../utils/cx'

export interface FigureRow {
  label: ReactNode
  /** Numbers are run through `format`; strings are printed as given. */
  value: number | string
  /** Quiet second line under the label, e.g. "8.42 g @ 6,240.00 / g". */
  hint?: ReactNode
  /** Heavier weight for a sub-total inside the stack. */
  emphasis?: boolean
  tone?: 'default' | 'muted' | 'success' | 'danger'
}

export interface FigureStackProps {
  /** The breakdown lines, in the order the backend returned them. */
  rows: FigureRow[]
  /** Rendered below a hairline rule, in the total treatment. */
  total?: FigureRow
  /** Number formatter. Defaults to INR currency. */
  format?: (value: number) => string
  size?: 'sm' | 'md'
  className?: string
}

const tones = {
  default: 'text-ink',
  muted: 'text-ink-muted',
  success: 'text-success',
  danger: 'text-danger',
} as const

/**
 * The assay stack: a price breakdown read like an assay certificate — labels on
 * the left, decimal-aligned tabular figures on the right, a hairline above the
 * total. Render exactly the rows the backend's pricing service returns; never
 * recompute a figure here.
 */
export function FigureStack({
  rows,
  total,
  format = formatCurrency,
  size = 'md',
  className,
}: FigureStackProps) {
  const figureSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const labelSize = size === 'sm' ? 'text-xs' : 'text-sm'

  function print(value: number | string): string {
    return typeof value === 'number' ? format(value) : value
  }

  return (
    <dl className={cx('w-full', className)}>
      {rows.map((row, index) => (
        <div
          key={index}
          className={cx(
            'flex items-baseline justify-between gap-6',
            size === 'sm' ? 'py-1' : 'py-1.5',
          )}
        >
          <dt className={cx('min-w-0', labelSize, tones[row.tone ?? 'muted'])}>
            <span className={cx(row.emphasis && 'font-medium text-ink')}>{row.label}</span>
            {row.hint && <span className="block text-xs text-ink-muted">{row.hint}</span>}
          </dt>
          <dd
            className={cx(
              'shrink-0 text-right font-mono tabular-nums',
              figureSize,
              row.emphasis ? 'font-semibold text-ink' : tones[row.tone ?? 'default'],
            )}
          >
            {print(row.value)}
          </dd>
        </div>
      ))}

      {total && (
        <div className="mt-1 flex items-baseline justify-between gap-6 border-t border-line pt-2.5">
          <dt className={cx('font-semibold text-ink', size === 'sm' ? 'text-sm' : 'text-base')}>
            {total.label}
            {total.hint && (
              <span className="block text-xs font-normal text-ink-muted">{total.hint}</span>
            )}
          </dt>
          <dd
            className={cx(
              'shrink-0 text-right font-mono font-semibold tabular-nums',
              size === 'sm' ? 'text-sm' : 'text-base',
              tones[total.tone ?? 'default'],
            )}
          >
            {print(total.value)}
          </dd>
        </div>
      )}
    </dl>
  )
}

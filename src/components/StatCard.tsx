import type { ReactNode } from 'react'
import { cx } from '../utils/cx'
import { Skeleton } from './Skeleton'
import { TrendDownIcon, TrendUpIcon } from './icons'

export interface StatDelta {
  /** Pre-formatted, e.g. "+12.4%" or "3 fewer". */
  label: string
  direction: 'up' | 'down' | 'flat'
  /** Set when a rise is bad (e.g. expenses). Default false. */
  invertTone?: boolean
}

export interface StatCardProps {
  label: string
  /** Pre-formatted figure. Rendered in mono. */
  value: ReactNode
  /** Quiet line under the figure, e.g. "vs. last month". */
  meta?: ReactNode
  delta?: StatDelta
  /** 16px icon shown top-right in a quiet chip. */
  icon?: ReactNode
  isLoading?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  meta,
  delta,
  icon,
  isLoading,
  className,
}: StatCardProps) {
  const good = delta ? (delta.invertTone ? delta.direction === 'down' : delta.direction === 'up') : false
  const deltaTone =
    !delta || delta.direction === 'flat' ? 'text-ink-muted' : good ? 'text-success' : 'text-danger'

  return (
    <div className={cx('rounded-panel border border-line bg-surface p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-sunken text-ink-muted">
            {icon}
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-7 w-28" />
      ) : (
        <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">
          {value}
        </p>
      )}

      {(delta || meta) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {delta && (
            <span className={cx('inline-flex items-center gap-1 font-medium', deltaTone)}>
              {delta.direction === 'up' && <TrendUpIcon size={14} />}
              {delta.direction === 'down' && <TrendDownIcon size={14} />}
              {delta.label}
            </span>
          )}
          {meta && <span className="text-ink-muted">{meta}</span>}
        </div>
      )}
    </div>
  )
}

import type { ReactNode } from 'react'
import { cx } from '../utils/cx'

export interface CardProps {
  children: ReactNode
  /** Renders a bordered header strip. */
  title?: ReactNode
  /** Quiet line under the title. */
  description?: ReactNode
  /** Header right-hand slot — buttons, filters, a badge. */
  actions?: ReactNode
  /** Bordered strip below the body. */
  footer?: ReactNode
  /** Body padding. Use `none` when the card wraps a DataTable. */
  padding?: 'none' | 'sm' | 'md'
  className?: string
  /** Applies to the body wrapper only. */
  bodyClassName?: string
}

const paddings = { none: '', sm: 'p-3', md: 'p-4 sm:p-5' } as const

/** Hairline panel. Cards never carry a shadow — separation is by border. */
export function Card({
  children,
  title,
  description,
  actions,
  footer,
  padding = 'md',
  className,
  bodyClassName,
}: CardProps) {
  return (
    <section className={cx('rounded-panel border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(paddings[padding], bodyClassName)}>{children}</div>
      {footer && (
        <footer className="border-t border-line px-4 py-3 sm:px-5">{footer}</footer>
      )}
    </section>
  )
}

import type { ReactNode } from 'react'
import { cx } from '../utils/cx'

export interface EmptyStateProps {
  /** 20–24px icon. Rendered in a quiet sunken circle. */
  icon?: ReactNode
  title: string
  /** One line: what goes here and why it is empty. */
  description?: string
  /** Primary action — an invitation, not a dead end. */
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken text-ink-muted">
          {icon}
        </span>
      )}
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

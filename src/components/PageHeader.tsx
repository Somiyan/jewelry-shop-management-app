import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../utils/cx'
import { ChevronRightIcon } from './icons'

export interface Breadcrumb {
  label: string
  /** Omit on the current page. */
  to?: string
}

export interface PageHeaderProps {
  title: string
  /** One quiet line under the title. */
  description?: ReactNode
  breadcrumb?: Breadcrumb[]
  /** Right-hand actions. They wrap under the title on phones. */
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
              {breadcrumb.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <ChevronRightIcon size={12} className="text-ink-muted/70" />}
                  {crumb.to ? (
                    <Link to={crumb.to} className="hover:text-ink hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
    </div>
  )
}

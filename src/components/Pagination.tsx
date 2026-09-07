import { cx } from '../utils/cx'
import { pageCount } from '../utils/paginate'
import { IconButton } from './IconButton'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { Select } from './Select'

export interface PaginationProps {
  /** 1-based current page. */
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  /** Omit to hide the page-size select. */
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  /** Plural noun used in the summary line. Default "results". */
  itemLabel?: string
  className?: string
}

function pageWindow(current: number, total: number): number[] {
  const span = 5
  let start = Math.max(1, current - Math.floor(span / 2))
  const end = Math.min(total, start + span - 1)
  start = Math.max(1, end - span + 1)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

/** Client-side pager. Pair with `paginate(rows, page, pageSize)`. */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'results',
  className,
}: PaginationProps) {
  const total = pageCount(totalItems, pageSize)
  const current = Math.min(Math.max(1, page), total)
  const first = totalItems === 0 ? 0 : (current - 1) * pageSize + 1
  const last = Math.min(current * pageSize, totalItems)

  return (
    <div
      className={cx(
        'flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-ink-muted">
        Showing <span className="font-mono text-ink">{first}</span>–
        <span className="font-mono text-ink">{last}</span> of{' '}
        <span className="font-mono text-ink">{totalItems}</span> {itemLabel}
      </p>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Rows
            <Select
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              aria-label="Rows per page"
              className="h-9 w-20 md:h-8"
              options={pageSizeOptions.map((size) => ({ value: String(size), label: String(size) }))}
            />
          </label>
        )}

        <nav aria-label="Pagination" className="flex items-center gap-1">
          <IconButton
            label="Previous page"
            size="sm"
            variant="secondary"
            disabled={current <= 1}
            onClick={() => onPageChange(current - 1)}
          >
            <ChevronLeftIcon size={16} />
          </IconButton>

          <span className="hidden items-center gap-1 sm:flex">
            {pageWindow(current, total).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === current ? 'page' : undefined}
                className={cx(
                  'h-8 min-w-8 rounded-control px-2 font-mono text-xs transition-colors',
                  item === current
                    ? 'bg-accent text-accent-ink'
                    : 'text-ink-muted hover:bg-sunken hover:text-ink',
                )}
              >
                {item}
              </button>
            ))}
          </span>

          <span className="font-mono text-xs text-ink-muted sm:hidden">
            {current} / {total}
          </span>

          <IconButton
            label="Next page"
            size="sm"
            variant="secondary"
            disabled={current >= total}
            onClick={() => onPageChange(current + 1)}
          >
            <ChevronRightIcon size={16} />
          </IconButton>
        </nav>
      </div>
    </div>
  )
}

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../utils/cx'
import { ChevronDownIcon } from './icons'
import { Skeleton } from './Skeleton'

export type ColumnAlign = 'left' | 'center' | 'right'
export type SortDirection = 'asc' | 'desc'

export interface Column<T> {
  /** Stable identifier, also used as the sort key. */
  key: string
  header: ReactNode
  /** Cell contents for a row. Wrap figures in `font-mono`. */
  render: (row: T) => ReactNode
  /** Figures use `right`. Default `left`. */
  align?: ColumnAlign
  /** Enables client-side sorting on this column. */
  sortable?: boolean
  /** Any CSS width, e.g. "120px" or "20%". */
  width?: string
  /**
   * Value used for sorting. Required for meaningful sort on computed cells;
   * without it the raw `row[key]` property is used.
   */
  sortValue?: (row: T) => string | number | Date | null | undefined
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  /** Stable React key per row. */
  getRowId: (row: T) => string
  /** Renders skeleton rows instead of data. */
  isLoading?: boolean
  /** Skeleton rows to draw while loading. Default 5. */
  skeletonRows?: number
  /** Shown when there are no rows and we are not loading. Use `<EmptyState>`. */
  emptyState?: ReactNode
  onRowClick?: (row: T) => void
  /**
   * Card body for one row below `md`. Provide this on every table — a table
   * without it falls back to horizontal scrolling on phones.
   */
  renderMobileCard?: (row: T) => ReactNode
  /** Starting sort. Sorting stays client-side and local to the table. */
  initialSort?: { key: string; direction: SortDirection }
  /** Extra classes per row (`<tr>` on desktop, card wrapper on mobile). */
  rowClassName?: (row: T) => string
  /** Screen-reader description of the table. */
  caption?: string
  className?: string
}

function compare(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

const alignClass: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

/**
 * The one table in the app. Sorts client-side, renders skeleton and empty
 * states, and degrades to a card list below `md` via `renderMobileCard`.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading = false,
  skeletonRows = 5,
  emptyState,
  onRowClick,
  renderMobileCard,
  initialSort,
  rowClassName,
  caption,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(
    initialSort ?? null,
  )

  const sortedRows = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((item) => item.key === sort.key)
    if (!column?.sortable) return rows
    const accessor =
      column.sortValue ?? ((row: T) => (row as Record<string, unknown>)[column.key] as never)
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => factor * compare(accessor(a), accessor(b)))
  }, [rows, sort, columns])

  function toggleSort(key: string) {
    setSort((current) =>
      current?.key === key
        ? current.direction === 'asc'
          ? { key, direction: 'desc' }
          : null
        : { key, direction: 'asc' },
    )
  }

  const isEmpty = !isLoading && sortedRows.length === 0
  const hasMobileCards = Boolean(renderMobileCard)

  const rowInteractionProps = onRowClick
    ? (row: T) => ({
        onClick: () => onRowClick(row),
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onRowClick(row)
          }
        },
        tabIndex: 0,
      })
    : () => ({})

  return (
    <div className={className}>
      {/* Desktop / tablet: the table proper. */}
      <div
        className={cx(
          'overflow-hidden rounded-panel border border-line bg-surface',
          hasMobileCards && 'hidden md:block',
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-full border-collapse text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="bg-sunken">
                {columns.map((column) => {
                  const active = sort?.key === column.key
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      style={column.width ? { width: column.width } : undefined}
                      aria-sort={
                        column.sortable
                          ? active
                            ? sort?.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                          : undefined
                      }
                      className={cx(
                        'px-3 py-2.5 text-xs font-medium text-ink-muted first:pl-4 last:pr-4',
                        alignClass[column.align ?? 'left'],
                        column.headerClassName,
                      )}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className={cx(
                            'inline-flex items-center gap-1 rounded-control transition-colors hover:text-ink',
                            column.align === 'right' && 'flex-row-reverse',
                            active && 'text-ink',
                          )}
                        >
                          {column.header}
                          <ChevronDownIcon
                            size={14}
                            className={cx(
                              'transition-transform',
                              active ? 'opacity-100' : 'opacity-35',
                              active && sort?.direction === 'asc' && 'rotate-180',
                            )}
                          />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: skeletonRows }, (_, index) => (
                  <tr key={`skeleton-${index}`} className="border-t border-line">
                    {columns.map((column) => (
                      <td key={column.key} className="h-10 px-3 py-2 first:pl-4 last:pr-4">
                        <Skeleton
                          className={cx('h-3', column.align === 'right' ? 'ml-auto w-16' : 'w-24')}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

              {isEmpty && (
                <tr className="border-t border-line">
                  <td colSpan={columns.length} className="p-0">
                    {emptyState ?? (
                      <p className="px-4 py-10 text-center text-sm text-ink-muted">
                        Nothing to show yet.
                      </p>
                    )}
                  </td>
                </tr>
              )}

              {!isLoading &&
                sortedRows.map((row) => (
                  <tr
                    key={getRowId(row)}
                    {...rowInteractionProps(row)}
                    className={cx(
                      'border-t border-line transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-sunken',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cx(
                          'h-10 px-3 py-2 text-ink first:pl-4 last:pr-4',
                          alignClass[column.align ?? 'left'],
                          column.className,
                        )}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phones: the same rows as a card list. */}
      {hasMobileCards && (
        <div className="flex flex-col gap-2 md:hidden">
          {isLoading &&
            Array.from({ length: skeletonRows }, (_, index) => (
              <div key={`m-skeleton-${index}`} className="rounded-panel border border-line bg-surface p-4">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="mt-3 h-4 w-2/3" />
              </div>
            ))}

          {isEmpty && (
            <div className="rounded-panel border border-line bg-surface">
              {emptyState ?? (
                <p className="px-4 py-10 text-center text-sm text-ink-muted">Nothing to show yet.</p>
              )}
            </div>
          )}

          {!isLoading &&
            sortedRows.map((row) => {
              const interactive = Boolean(onRowClick)
              return (
                <div
                  key={getRowId(row)}
                  {...rowInteractionProps(row)}
                  role={interactive ? 'button' : undefined}
                  className={cx(
                    'rounded-panel border border-line bg-surface p-4 text-sm',
                    interactive && 'cursor-pointer transition-colors hover:bg-sunken',
                    rowClassName?.(row),
                  )}
                >
                  {renderMobileCard?.(row)}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

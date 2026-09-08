import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  formatRate,
  getRateHistory,
  metalLabel,
  updatedByName,
  type MetalType,
  type RateDoc,
  type RateSourceType,
} from '../api/rates'
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  Input,
  MetalSwatch,
  PageHeader,
  Pagination,
  Select,
  paginate,
  type Column,
} from '../components'
import { InboxIcon } from '../components/icons'
import { cx } from '../utils/cx'
import { dayEndIso, dayStartIso, extractErrorMessage, formatDateTime } from '../utils/format'
import { rateSourceLabel } from '../utils/ui'

/* ---------------------------------------------------------------- types --- */

/** A history entry with its diff against the next-older record for the same metal. */
interface HistoryRow extends RateDoc {
  previousRate: number | null
  change: number | null
}

interface Filters {
  metal: '' | MetalType
  sourceType: '' | RateSourceType
  from: string
  to: string
}

const emptyFilters: Filters = { metal: '', sourceType: '', from: '', to: '' }

/* ------------------------------------------------------------- helpers --- */

/**
 * Pairs each record with the next-older record for the same metal so a row can
 * show what the rate moved from. The oldest record per metal in the fetched
 * page has no predecessor here — the diff is within what was loaded.
 */
function withDiffs(history: RateDoc[]): HistoryRow[] {
  const byMetal = new Map<MetalType, RateDoc[]>()
  for (const record of history) {
    const group = byMetal.get(record.metalType) ?? []
    group.push(record)
    byMetal.set(record.metalType, group)
  }

  const rows: HistoryRow[] = []
  for (const group of byMetal.values()) {
    const sorted = [...group].sort(
      (a, b) => new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime(),
    )
    sorted.forEach((record, index) => {
      const previous = sorted[index + 1] ?? null
      rows.push({
        ...record,
        previousRate: previous ? previous.ratePerGram : null,
        change: previous ? record.ratePerGram - previous.ratePerGram : null,
      })
    })
  }

  return rows.sort((a, b) => new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime())
}

function changeClass(change: number | null): string {
  if (change === null || change === 0) return 'text-ink-muted'
  return change > 0 ? 'text-success' : 'text-danger'
}

function changeText(change: number | null): string {
  if (change === null) return 'first recorded'
  if (change === 0) return 'no change'
  return `${change > 0 ? '+' : '−'}${formatRate(Math.abs(change))}`
}

/* ---------------------------------------------------------------- page --- */

export default function RateHistoryPage() {
  const [history, setHistory] = useState<RateDoc[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const fetchHistory = useCallback(async (active: Filters) => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await getRateHistory({
        metal: active.metal || undefined,
        sourceType: active.sourceType || undefined,
        from: dayStartIso(active.from),
        to: dayEndIso(active.to),
        limit: 200,
      })
      setHistory(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
      setHistory([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchHistory(filters)
  }, [fetchHistory, filters])

  const rows = useMemo(() => withDiffs(history), [history])
  const pagedRows = useMemo(() => paginate(rows, page, pageSize), [rows, page, pageSize])

  // Filters are applied server-side; changing one restarts paging at page 1.
  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  function clearFilters() {
    setFilters(emptyFilters)
    setPage(1)
  }

  const hasFilters =
    filters.metal !== '' || filters.sourceType !== '' || filters.from !== '' || filters.to !== ''

  const columns: Column<HistoryRow>[] = [
    {
      key: 'effectiveAt',
      header: 'Date & time',
      sortable: true,
      sortValue: (row) => row.effectiveAt,
      render: (row) => <span className="text-ink">{formatDateTime(row.effectiveAt)}</span>,
    },
    {
      key: 'metalType',
      header: 'Metal',
      render: (row) => <MetalSwatch metal={row.metalType} label={metalLabel[row.metalType]} />,
    },
    {
      key: 'ratePerGram',
      header: 'Rate / g',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.ratePerGram,
      render: (row) => (
        <span className="block">
          <span className="block font-mono text-ink">{formatRate(row.ratePerGram)}</span>
          <span className={cx('block text-xs', changeClass(row.change))}>
            {row.change === null || row.change === 0 ? (
              changeText(row.change)
            ) : (
              <span className="font-mono">{changeText(row.change)}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: 'sourceType',
      header: 'Source',
      render: (row) => (
        <Badge tone={row.sourceType === 'LIVE_API' ? 'info' : 'neutral'}>
          {rateSourceLabel(row.sourceType)}
        </Badge>
      ),
    },
    {
      key: 'updatedBy',
      header: 'Updated by',
      render: (row) => <span className="text-ink-muted">{updatedByName(row.updatedBy)}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <span className="block max-w-56 truncate text-ink-muted" title={row.reason || undefined}>
          {row.reason || '—'}
        </span>
      ),
    },
  ]

  const emptyState = hasFilters ? (
    <EmptyState
      icon={<InboxIcon size={20} />}
      title="No rate changes match these filters"
      description="Widen the date range, or clear the filters to see the full history."
      action={
        <Button size="sm" variant="secondary" onClick={clearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<InboxIcon size={20} />}
      title="No rate history yet"
      description="Gold and silver rate changes are recorded here as an audit trail."
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Rate history"
        description="Every gold and silver rate ever recorded, newest first. Records are appended, never edited."
        breadcrumb={[{ label: 'Precious metal rates', to: '/metal-rates' }, { label: 'History' }]}
        actions={
          <Link to="/metal-rates" className="text-sm font-medium text-accent hover:underline">
            Back to rates
          </Link>
        }
      />

      <div className="rounded-panel border border-line bg-surface p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Metal">
            <Select
              value={filters.metal}
              onChange={(event) => update('metal', event.target.value as '' | MetalType)}
              placeholder="All metals"
              options={[
                { value: 'gold', label: 'Gold' },
                { value: 'silver', label: 'Silver' },
              ]}
            />
          </Field>

          <Field label="Source">
            <Select
              value={filters.sourceType}
              onChange={(event) => update('sourceType', event.target.value as '' | RateSourceType)}
              placeholder="All sources"
              options={[
                { value: 'LIVE_API', label: 'Live API' },
                { value: 'MANUAL', label: 'Manual' },
              ]}
            />
          </Field>

          <Field label="From">
            <Input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => update('from', event.target.value)}
            />
          </Field>

          <Field label="To">
            <Input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => update('to', event.target.value)}
            />
          </Field>
        </div>

        {hasFilters && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted" aria-live="polite">
              {isLoading ? 'Loading rate history' : `${rows.length} matching records`}
            </p>
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {loadError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError} Check your connection and try again.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <DataTable
          columns={columns}
          rows={pagedRows}
          getRowId={(row) => row._id}
          isLoading={isLoading}
          emptyState={emptyState}
          initialSort={{ key: 'effectiveAt', direction: 'desc' }}
          caption="Precious metal rate history"
          renderMobileCard={(row) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <MetalSwatch metal={row.metalType} label={metalLabel[row.metalType]} />
                <span className="text-xs text-ink-muted">{formatDateTime(row.effectiveAt)}</span>
              </div>

              <div className="flex items-end justify-between gap-3">
                <span>
                  <span className="block font-mono text-lg font-semibold text-ink">
                    {formatRate(row.ratePerGram)}
                  </span>
                  <span className="text-xs text-ink-muted">per gram</span>
                </span>
                <span className={cx('text-xs', changeClass(row.change))}>
                  {changeText(row.change)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.sourceType === 'LIVE_API' ? 'info' : 'neutral'}>
                  {rateSourceLabel(row.sourceType)}
                </Badge>
                <span className="text-xs text-ink-muted">by {updatedByName(row.updatedBy)}</span>
              </div>

              {row.reason && <p className="text-xs text-ink-muted">{row.reason}</p>}
            </div>
          )}
        />

        {rows.length > pageSize && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            itemLabel="records"
          />
        )}
      </div>
    </div>
  )
}

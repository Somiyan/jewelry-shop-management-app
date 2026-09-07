import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import {
  DataTable,
  EmptyState,
  MetalSwatch,
  PageHeader,
  Pagination,
  Select,
  paginate,
  type Column,
} from '../components'
import { InboxIcon } from '../components/icons'
import { extractErrorMessage, formatDate } from '../utils/format'

/* ---------------------------------------------------------------- types --- */

type MetalType = 'gold' | 'silver'

interface UpdatedByRef {
  _id: string
  username: string
}

interface RateDoc {
  _id: string
  metalType: MetalType
  ratePerGram: number
  unit: 'gram'
  reason: string
  effectiveAt: string
  createdAt: string
  updatedBy: UpdatedByRef | string
}

/** A history entry with its diff against the next-older record for the same metal. */
interface HistoryRow extends RateDoc {
  previousRate: number | null
  change: number | null
}

const metalLabel: Record<MetalType, string> = { gold: 'Gold', silver: 'Silver' }

/* ------------------------------------------------------------- helpers --- */

function updatedByName(updatedBy: RateDoc['updatedBy'] | undefined): string {
  if (!updatedBy) return 'unknown'
  return typeof updatedBy === 'string' ? updatedBy : updatedBy.username
}

const rateFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

function formatRate(value: number): string {
  return rateFormatter.format(value)
}

/**
 * Pairs each record with the next-older record for the same metal so the
 * table can show a previous rate and a signed change. The oldest record per
 * metal in the fetched page has no previous entry.
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

/* ---------------------------------------------------------------- page --- */

export default function RateHistoryPage() {
  const [history, setHistory] = useState<RateDoc[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [metalFilter, setMetalFilter] = useState<'' | MetalType>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const fetchHistory = useCallback(async (metal: '' | MetalType) => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const params: Record<string, string | number> = { limit: 200 }
      if (metal) params.metal = metal
      const { data } = await apiClient.get<RateDoc[]>('/precious-metal-rates/history', { params })
      setHistory(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchHistory(metalFilter)
  }, [fetchHistory, metalFilter])

  useEffect(() => {
    setPage(1)
  }, [metalFilter])

  const rows = useMemo(() => withDiffs(history), [history])
  const pagedRows = useMemo(() => paginate(rows, page, pageSize), [rows, page, pageSize])

  const columns: Column<HistoryRow>[] = [
    {
      key: 'effectiveAt',
      header: 'Date',
      sortable: true,
      sortValue: (row) => row.effectiveAt,
      render: (row) => <span className="text-ink">{formatDate(row.effectiveAt)}</span>,
    },
    {
      key: 'metalType',
      header: 'Metal',
      render: (row) => <MetalSwatch metal={row.metalType} label={metalLabel[row.metalType]} />,
    },
    {
      key: 'previousRate',
      header: 'Previous rate',
      align: 'right',
      render: (row) => (
        <span className="font-mono tabular-nums text-ink-muted">
          {row.previousRate === null ? '—' : formatRate(row.previousRate)}
        </span>
      ),
    },
    {
      key: 'ratePerGram',
      header: 'New rate',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.ratePerGram,
      render: (row) => (
        <span className="font-mono tabular-nums text-ink">{formatRate(row.ratePerGram)}</span>
      ),
    },
    {
      key: 'change',
      header: 'Change',
      align: 'right',
      render: (row) => {
        if (row.change === null) return <span className="font-mono text-ink-muted">—</span>
        const positive = row.change > 0
        const flat = row.change === 0
        return (
          <span
            className={
              flat
                ? 'font-mono tabular-nums text-ink-muted'
                : positive
                  ? 'font-mono tabular-nums text-success'
                  : 'font-mono tabular-nums text-danger'
            }
          >
            {flat ? '±' : positive ? '+' : '-'}
            {formatRate(Math.abs(row.change))}
          </span>
        )
      },
    },
    {
      key: 'updatedBy',
      header: 'Updated by',
      render: (row) => <span className="text-ink-muted">{updatedByName(row.updatedBy)}</span>,
    },
  ]

  const emptyState = metalFilter ? (
    <EmptyState
      icon={<InboxIcon size={20} />}
      title="No rate history for this metal"
      description="Rate changes will appear here once one is recorded."
    />
  ) : (
    <EmptyState
      icon={<InboxIcon size={20} />}
      title="No rate history yet"
      description="Gold and silver rate changes will be recorded here as an audit trail."
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Rate history"
        description="Every gold and silver rate change, newest first."
        breadcrumb={[{ label: 'Metal rates', to: '/metal-rates' }, { label: 'History' }]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-40">
          <Select
            value={metalFilter}
            onChange={(event) => setMetalFilter(event.target.value as '' | MetalType)}
            aria-label="Filter by metal"
            placeholder="All metals"
            options={[
              { value: 'gold', label: 'Gold' },
              { value: 'silver', label: 'Silver' },
            ]}
          />
        </div>
        <Link to="/metal-rates" className="text-sm font-medium text-accent hover:underline">
          Back to metal rates
        </Link>
      </div>

      {loadError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError}
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
                <span className="text-xs text-ink-muted">{formatDate(row.effectiveAt)}</span>
              </div>
              <dl className="flex items-baseline justify-between gap-3">
                <div>
                  <dt className="text-xs text-ink-muted">Previous</dt>
                  <dd className="font-mono text-sm tabular-nums text-ink-muted">
                    {row.previousRate === null ? '—' : formatRate(row.previousRate)}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-ink-muted">New rate</dt>
                  <dd className="font-mono text-sm tabular-nums text-ink">{formatRate(row.ratePerGram)}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-ink-muted">Change</dt>
                  <dd
                    className={
                      row.change === null || row.change === 0
                        ? 'font-mono text-sm tabular-nums text-ink-muted'
                        : row.change > 0
                          ? 'font-mono text-sm tabular-nums text-success'
                          : 'font-mono text-sm tabular-nums text-danger'
                    }
                  >
                    {row.change === null
                      ? '—'
                      : `${row.change === 0 ? '±' : row.change > 0 ? '+' : '-'}${formatRate(Math.abs(row.change))}`}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-ink-muted">Updated by {updatedByName(row.updatedBy)}</p>
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
            itemLabel="changes"
          />
        )}
      </div>
    </div>
  )
}

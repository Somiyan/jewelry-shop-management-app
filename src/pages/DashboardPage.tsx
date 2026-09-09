import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiClient } from '../api/client'
import { useAuth } from '../auth'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  MetalSwatch,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  Tabs,
  buttonClass,
} from '../components'
import {
  AlertIcon,
  BoxIcon,
  CheckIcon,
  FileTextIcon,
  ReceiptIcon,
  TagIcon,
  TrendUpIcon,
  UsersIcon,
} from '../components/icons'
import { formatCurrency, formatDate } from '../utils/format'
import {
  orderStatusTone,
  paymentStatusTone,
  stockLevelLabel,
  stockLevelTone,
  type StockLevel,
} from '../utils/ui'

/* ---------------------------------------------------------------- types --- */

interface DashboardSummary {
  dailySales: number
  monthlyRevenue: number
  monthlyExpenses: number
  profitMargin: number
  totalInvoices: number
  /** Sum of per-invoice outstanding, clamped at 0 each. */
  totalOutstanding: number
  /** Count of invoices with outstanding > 0. */
  pendingInvoices: number
  /** Sum of payments recorded today. */
  collectedToday: number
  /** Sum of all active payments, all time. */
  totalCollected: number
}

interface RevenuePoint {
  period: string
  revenue: number
}

interface InventoryLine {
  productId: string
  name: string
  quantity: number
  /** Absent when the product could not be priced — `error` is set instead. */
  unitValue?: number
  lineValue?: number
  error?: string
}

interface InventoryValue {
  totalValue: number
  breakdown: InventoryLine[]
}

interface StockStatusRow {
  productId: string
  name: string
  sku: string
  quantity: number
  level: StockLevel
}

interface MetalPriceRow {
  _id: string
  metalType: 'gold' | 'silver'
  purity: string
  spotPrice: number
  currency: string
  source: string
  lastUpdated: string
}

interface PartyRef {
  _id?: string
  name?: string
  phone?: string
}

interface OrderRow {
  _id: string
  customerId?: PartyRef | null
  totalAmount: number
  status: string
  orderDate: string
}

interface InvoiceRow {
  _id: string
  invoiceNumber: string
  customerId?: PartyRef | null
  finalAmount: number
  paymentStatus: string
  invoiceDate: string
}

type RevenuePeriod = 'daily' | 'monthly' | 'yearly'

/** A panel's data plus its own loading/error state, so one failure is local. */
interface Panel<T> {
  data: T | null
  loading: boolean
  failed: boolean
}

const idle = <T,>(): Panel<T> => ({ data: null, loading: true, failed: false })

/* ------------------------------------------------------------- helpers --- */

const compactCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Sentence case for API enum strings like "pending" or "bank-transfer". */
function sentence(value: string): string {
  if (!value) return '—'
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ')
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "4 minutes ago" / "2 days ago" from an ISO timestamp. */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never updated'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never updated'
  const seconds = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return relative.format(Math.round(seconds), 'second')
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2592000) return relative.format(Math.round(seconds / 86400), 'day')
  return relative.format(Math.round(seconds / 2592000), 'month')
}

/** Turns the API's period key into something readable on an axis. */
function periodLabel(value: string, period: RevenuePeriod): string {
  if (period === 'yearly') return value
  if (period === 'monthly') {
    const date = new Date(`${value}-01T00:00:00`)
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  }
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface ChartColors {
  accent: string
  line: string
  inkMuted: string
}

const fallbackColors: ChartColors = {
  accent: '#0a6b63',
  line: '#e2e7ec',
  inkMuted: '#5b6878',
}

/**
 * Recharts paints SVG attributes, not classes, so the tokens have to be read
 * off the document. Re-reads when the theme attribute or OS scheme changes.
 */
function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(fallbackColors)

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement)
      const token = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback
      setColors({
        accent: token('--color-accent', fallbackColors.accent),
        line: token('--color-line', fallbackColors.line),
        inkMuted: token('--color-ink-muted', fallbackColors.inkMuted),
      })
    }
    read()

    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', read)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', read)
    }
  }, [])

  return colors
}

/** Inline, panel-local failure. The rest of the dashboard keeps working. */
function PanelError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 py-2 text-sm text-ink-muted">
      <p className="flex items-start gap-2">
        <AlertIcon size={16} className="mt-0.5 shrink-0 text-danger" />
        Unable to load {what}. Check your connection and try again.
      </p>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- page --- */

export default function DashboardPage() {
  const { user } = useAuth()
  const colors = useChartColors()

  const [summary, setSummary] = useState<Panel<DashboardSummary>>(idle)
  const [inventory, setInventory] = useState<Panel<InventoryValue>>(idle)
  const [stock, setStock] = useState<Panel<StockStatusRow[]>>(idle)
  const [prices, setPrices] = useState<Panel<MetalPriceRow[]>>(idle)
  const [orders, setOrders] = useState<Panel<OrderRow[]>>(idle)
  const [invoices, setInvoices] = useState<Panel<InvoiceRow[]>>(idle)
  const [revenue, setRevenue] = useState<Panel<RevenuePoint[]>>(idle)
  const [period, setPeriod] = useState<RevenuePeriod>('daily')
  const [activity, setActivity] = useState<'orders' | 'invoices'>('orders')

  const loadSummary = useCallback(async () => {
    setSummary((state) => ({ ...state, loading: true, failed: false }))
    try {
      const { data } = await apiClient.get<DashboardSummary>('/financial/dashboard')
      setSummary({ data, loading: false, failed: false })
    } catch {
      setSummary({ data: null, loading: false, failed: true })
    }
  }, [])

  const loadInventory = useCallback(async () => {
    setInventory((state) => ({ ...state, loading: true, failed: false }))
    try {
      const { data } = await apiClient.get<InventoryValue>('/financial/inventory-value')
      setInventory({ data, loading: false, failed: false })
    } catch {
      setInventory({ data: null, loading: false, failed: true })
    }
  }, [])

  const loadStock = useCallback(async () => {
    setStock((state) => ({ ...state, loading: true, failed: false }))
    try {
      const { data } = await apiClient.get<StockStatusRow[]>('/stock/status')
      setStock({ data, loading: false, failed: false })
    } catch {
      setStock({ data: null, loading: false, failed: true })
    }
  }, [])

  const loadPrices = useCallback(async () => {
    setPrices((state) => ({ ...state, loading: true, failed: false }))
    try {
      const { data } = await apiClient.get<MetalPriceRow[]>('/prices')
      setPrices({ data, loading: false, failed: false })
    } catch {
      setPrices({ data: null, loading: false, failed: true })
    }
  }, [])

  const loadOrders = useCallback(async () => {
    setOrders((state) => ({ ...state, loading: true, failed: false }))
    try {
      const { data } = await apiClient.get<OrderRow[]>('/orders')
      setOrders({ data, loading: false, failed: false })
    } catch {
      setOrders({ data: null, loading: false, failed: true })
    }
  }, [])

  const loadInvoices = useCallback(async () => {
    setInvoices((state) => ({ ...state, loading: true, failed: false }))
    try {
      const { data } = await apiClient.get<InvoiceRow[]>('/invoices')
      setInvoices({ data, loading: false, failed: false })
    } catch {
      setInvoices({ data: null, loading: false, failed: true })
    }
  }, [])

  const loadRevenue = useCallback(async (next: RevenuePeriod) => {
    setRevenue((state) => ({ ...state, loading: true, failed: false }))
    try {
      const { data } = await apiClient.get<RevenuePoint[]>('/financial/revenue', {
        params: { period: next },
      })
      setRevenue({ data, loading: false, failed: false })
    } catch {
      setRevenue({ data: null, loading: false, failed: true })
    }
  }, [])

  // One failing endpoint must never blank the page.
  const loadAll = useCallback(() => {
    void Promise.allSettled([
      loadSummary(),
      loadInventory(),
      loadStock(),
      loadPrices(),
      loadOrders(),
      loadInvoices(),
      loadRevenue(period),
    ])
  }, [
    loadSummary,
    loadInventory,
    loadStock,
    loadPrices,
    loadOrders,
    loadInvoices,
    loadRevenue,
    period,
  ])

  useEffect(() => {
    void Promise.allSettled([
      loadSummary(),
      loadInventory(),
      loadStock(),
      loadPrices(),
      loadOrders(),
      loadInvoices(),
    ])
  }, [loadSummary, loadInventory, loadStock, loadPrices, loadOrders, loadInvoices])

  useEffect(() => {
    void loadRevenue(period)
  }, [loadRevenue, period])

  const attention = stock.data ?? []
  const recentOrders = useMemo(() => (orders.data ?? []).slice(0, 5), [orders.data])
  const recentInvoices = useMemo(() => (invoices.data ?? []).slice(0, 5), [invoices.data])
  const pricedLines = (inventory.data?.breakdown ?? []).filter((line) => !line.error)
  const unpricedLines = (inventory.data?.breakdown ?? []).filter((line) => line.error)

  const chartData = useMemo(
    () => (revenue.data ?? []).map((point) => ({ ...point, label: periodLabel(point.period, period) })),
    [revenue.data, period],
  )

  const greeting = user?.username ? `Welcome back, ${user.username}.` : 'Today at a glance.'

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description={`${greeting} ${formatDate(new Date().toISOString())}`}
        actions={
          <Button variant="secondary" onClick={loadAll}>
            Refresh
          </Button>
        }
      />

      {/* KPIs: 1 col on a phone, 2 from sm, 3 from lg, 6 across on very wide screens. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Today's sales"
          value={summary.failed ? '—' : formatCurrency(summary.data?.dailySales)}
          isLoading={summary.loading}
          icon={<TagIcon size={16} />}
          meta="Since midnight"
        />
        <StatCard
          label="Revenue this month"
          value={summary.failed ? '—' : formatCurrency(summary.data?.monthlyRevenue)}
          isLoading={summary.loading}
          icon={<TrendUpIcon size={16} />}
          meta={
            summary.data ? `Expenses ${formatCurrency(summary.data.monthlyExpenses)}` : undefined
          }
        />
        <StatCard
          label="Profit margin"
          value={summary.failed ? '—' : `${(summary.data?.profitMargin ?? 0).toFixed(2)}%`}
          isLoading={summary.loading}
          icon={<ReceiptIcon size={16} />}
          meta="This month"
        />
        <StatCard
          label="Invoices"
          value={summary.failed ? '—' : (summary.data?.totalInvoices ?? 0).toLocaleString('en-IN')}
          isLoading={summary.loading}
          icon={<FileTextIcon size={16} />}
          meta="All time"
        />
        <StatCard
          label="Inventory value"
          value={inventory.failed ? '—' : formatCurrency(inventory.data?.totalValue)}
          isLoading={inventory.loading}
          icon={<BoxIcon size={16} />}
          meta={
            inventory.data
              ? `${pricedLines.length} priced${unpricedLines.length ? `, ${unpricedLines.length} unpriced` : ''}`
              : undefined
          }
        />
        <StatCard
          label="Needs attention"
          value={stock.failed ? '—' : attention.length.toLocaleString('en-IN')}
          isLoading={stock.loading}
          icon={<AlertIcon size={16} />}
          meta="Low or out of stock"
        />
        <StatCard
          label="Total outstanding"
          value={summary.failed ? '—' : formatCurrency(summary.data?.totalOutstanding)}
          isLoading={summary.loading}
          icon={<AlertIcon size={16} />}
          meta="Across all invoices"
        />
        <StatCard
          label="Collected today"
          value={summary.failed ? '—' : formatCurrency(summary.data?.collectedToday)}
          isLoading={summary.loading}
          icon={<TagIcon size={16} />}
          meta="Payments recorded since midnight"
        />
        <StatCard
          label="Total collected"
          value={summary.failed ? '—' : formatCurrency(summary.data?.totalCollected)}
          isLoading={summary.loading}
          icon={<ReceiptIcon size={16} />}
          meta="All active payments, all time"
        />
        <StatCard
          label="Pending invoices"
          value={summary.failed ? '—' : (summary.data?.pendingInvoices ?? 0).toLocaleString('en-IN')}
          isLoading={summary.loading}
          icon={<FileTextIcon size={16} />}
          meta="With an outstanding balance"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* On a phone this stack comes first: what needs doing, then how to do it. */}
        <div className="flex min-w-0 flex-col gap-5 lg:order-2 lg:col-span-1">
          <Card
            title="Needs attention"
            description="Products at or below the reorder threshold"
            actions={
              attention.length > 0 ? (
                <Link
                  to="/stock"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  View all
                </Link>
              ) : undefined
            }
            padding={stock.loading || stock.failed || attention.length > 0 ? 'md' : 'none'}
          >
            {stock.loading ? (
              <ListSkeleton rows={3} />
            ) : stock.failed ? (
              <PanelError what="stock levels" onRetry={loadStock} />
            ) : attention.length === 0 ? (
              <EmptyState
                icon={<CheckIcon size={20} />}
                title="Everything's in stock."
                description="No product has fallen to its reorder level."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {attention.slice(0, 6).map((item) => (
                  <li
                    key={item.productId}
                    className="flex items-center justify-between gap-3 rounded-control bg-sunken px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">{item.sku}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm text-ink">{item.quantity}</span>
                      <Badge tone={stockLevelTone(item.level)} dot>
                        {stockLevelLabel(item.level)}
                      </Badge>
                    </span>
                  </li>
                ))}
                {attention.length > 6 && (
                  <li className="pt-1 text-xs text-ink-muted">
                    {attention.length - 6} more need attention.
                  </li>
                )}
              </ul>
            )}
          </Card>

          <Card title="Quick actions">
            <div className="flex flex-col gap-2">
              <Link to="/sales/new" className={buttonClass('primary', 'md', 'w-full')}>
                <TagIcon size={16} />
                New sale
              </Link>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link to="/stock" className={buttonClass('secondary', 'md', 'w-full')}>
                  <BoxIcon size={16} />
                  Add product
                </Link>
                <Link to="/customers" className={buttonClass('secondary', 'md', 'w-full')}>
                  <UsersIcon size={16} />
                  Add customer
                </Link>
              </div>
            </div>
          </Card>

          <Card
            title="Metal prices"
            description="Manual refresh only — rates are never polled."
            actions={
              <Button size="sm" variant="secondary" loading={prices.loading} onClick={loadPrices}>
                Refresh
              </Button>
            }
            padding={prices.loading || prices.failed || (prices.data?.length ?? 0) > 0 ? 'md' : 'none'}
          >
            {prices.loading ? (
              <ListSkeleton rows={3} />
            ) : prices.failed ? (
              <PanelError what="metal prices" onRetry={loadPrices} />
            ) : (prices.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<AlertIcon size={20} />}
                title="No metal rates yet"
                description="Products cannot be priced until a gold or silver rate is recorded for each purity you sell."
              />
            ) : (
              <ul className="divide-y divide-line">
                {(prices.data ?? []).map((price) => (
                  <li
                    key={price._id}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0">
                      <MetalSwatch
                        metal={price.metalType}
                        label={`${price.purity} ${price.metalType}`}
                        className="font-medium"
                      />
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {sentence(price.source)} · updated {relativeTime(price.lastUpdated)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm font-semibold text-ink">
                        {formatCurrency(price.spotPrice)}
                      </span>
                      <span className="block text-xs text-ink-muted">per gram</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:order-1 lg:col-span-2">
          <Card
            title="Revenue"
            description="Sales recorded against invoices"
            actions={
              <div className="w-36">
                <Select
                  aria-label="Revenue period"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as RevenuePeriod)}
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly' },
                  ]}
                />
              </div>
            }
          >
            {revenue.loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : revenue.failed ? (
              <PanelError what="the revenue chart" onRetry={() => void loadRevenue(period)} />
            ) : chartData.length === 0 ? (
              <EmptyState
                icon={<TrendUpIcon size={20} />}
                title="No revenue recorded yet"
                description="Completed sales appear here as soon as the first invoice is paid."
                action={
                  <Link to="/sales/new" className={buttonClass('primary', 'sm')}>
                    Start a sale
                  </Link>
                }
              />
            ) : (
              <div className="min-w-0">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={colors.accent} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke={colors.line}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: colors.line }}
                      tick={{ fill: colors.inkMuted, fontSize: 11 }}
                      minTickGap={16}
                    />
                    <YAxis
                      width={64}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: colors.inkMuted, fontSize: 11 }}
                      tickFormatter={(value: number) => compactCurrency.format(value)}
                    />
                    <Tooltip
                      cursor={{ stroke: colors.line, strokeWidth: 1 }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const raw = payload[0]?.value
                        const value = typeof raw === 'number' ? raw : Number(raw)
                        return (
                          <div className="rounded-panel border border-line bg-surface px-3 py-2 shadow-raise">
                            <p className="text-xs text-ink-muted">{String(label ?? '')}</p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-ink">
                              {formatCurrency(value)}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={colors.accent}
                      strokeWidth={2}
                      fill="url(#revenue-fill)"
                      dot={false}
                      activeDot={{ r: 4, fill: colors.accent, stroke: colors.accent }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card
            title="Recent activity"
            padding="none"
            actions={
              <Link
                to={activity === 'orders' ? '/orders' : '/invoices'}
                className="text-sm font-medium text-accent hover:underline"
              >
                View all
              </Link>
            }
          >
            <Tabs
              label="Recent activity"
              value={activity}
              onChange={setActivity}
              className="px-2"
              items={[
                { id: 'orders', label: 'Orders', count: recentOrders.length },
                { id: 'invoices', label: 'Invoices', count: recentInvoices.length },
              ]}
            />

            <div className="px-4 py-3 sm:px-5">
              {activity === 'orders' ? (
                orders.loading ? (
                  <ListSkeleton />
                ) : orders.failed ? (
                  <PanelError what="recent orders" onRetry={loadOrders} />
                ) : recentOrders.length === 0 ? (
                  <EmptyState
                    icon={<ReceiptIcon size={20} />}
                    title="No orders yet"
                    description="Orders taken at the counter will show up here."
                    action={
                      <Link to="/sales/new" className={buttonClass('primary', 'sm')}>
                        Start a sale
                      </Link>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {recentOrders.map((order) => (
                      <li key={order._id}>
                        <Link
                          to="/orders"
                          className="flex items-center justify-between gap-3 py-2.5 transition-colors first:pt-0 hover:text-ink"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">
                              {order.customerId?.name ?? 'Walk-in customer'}
                            </span>
                            <span className="block truncate text-xs text-ink-muted">
                              {formatDate(order.orderDate)}
                              {order.customerId?.phone ? ` · ${order.customerId.phone}` : ''}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            <span className="font-mono text-sm text-ink">
                              {formatCurrency(order.totalAmount)}
                            </span>
                            <Badge tone={orderStatusTone(order.status)} dot>
                              {sentence(order.status)}
                            </Badge>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )
              ) : invoices.loading ? (
                <ListSkeleton />
              ) : invoices.failed ? (
                <PanelError what="recent invoices" onRetry={loadInvoices} />
              ) : recentInvoices.length === 0 ? (
                <EmptyState
                  icon={<FileTextIcon size={20} />}
                  title="No invoices yet"
                  description="Generate an invoice from an order to start billing."
                  action={
                    <Link to="/invoices" className={buttonClass('primary', 'sm')}>
                      Go to invoices
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {recentInvoices.map((invoice) => (
                    <li key={invoice._id}>
                      <Link
                        to="/invoices"
                        className="flex items-center justify-between gap-3 py-2.5 transition-colors first:pt-0 hover:text-ink"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {invoice.customerId?.name ?? 'Walk-in customer'}
                          </span>
                          <span className="block truncate font-mono text-xs text-ink-muted">
                            {invoice.invoiceNumber} · {formatDate(invoice.invoiceDate)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <span className="font-mono text-sm text-ink">
                            {formatCurrency(invoice.finalAmount)}
                          </span>
                          <Badge tone={paymentStatusTone(invoice.paymentStatus)} dot>
                            {sentence(invoice.paymentStatus)}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiClient } from '../api/client'
import {
  AlertIcon,
  Badge,
  Button,
  Card,
  EmptyState,
  FigureStack,
  InboxIcon,
  MetalSwatch,
  PageHeader,
  StatCard,
} from '../components'
import { extractErrorMessage, formatCurrency, formatDate } from '../utils/format'
import { stockLevelLabel, stockLevelTone } from '../utils/ui'
import {
  formatPercent,
  formatWeight,
  metalLabel,
  normalizeProduct,
  sentence,
  sizeUnitLabel,
  type AuditLogEntry,
  type Product,
} from './productShared'

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink">{value}</dd>
    </div>
  )
}

function auditUserLabel(entry: AuditLogEntry): string {
  if (!entry.userId) return 'System'
  if (typeof entry.userId === 'string') return entry.userId
  return entry.userId.username ?? 'Unknown user'
}

function auditValueLabel(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  return String(value)
}

/** Read-only overview of a jewellery product: details, pricing and change history. */
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    apiClient
      .get<Record<string, unknown>>(`/products/${id}`)
      .then(({ data }) => {
        if (!cancelled) setProduct(normalizeProduct(data))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(extractErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setAuditLoading(true)
    apiClient
      .get<AuditLogEntry[]>('/audit-log', { params: { entity: 'Product', entityId: id } })
      .then(({ data }) => {
        if (!cancelled) setAuditLog(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        // Change history is a nice-to-have; treat a failure the same as "no
        // history yet" rather than surfacing an error for a still-in-progress
        // backend endpoint.
        if (!cancelled) setAuditLog([])
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Loading product…" />
        <Card>
          <p className="text-sm text-ink-muted">Fetching the product's details…</p>
        </Card>
      </div>
    )
  }

  if (loadError || !product) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Product" breadcrumb={[{ label: 'Stock', to: '/stock' }]} />
        <Card>
          <p role="alert" className="flex items-start gap-2 text-sm text-danger">
            <AlertIcon size={16} className="mt-0.5 shrink-0" />
            {loadError ?? 'Product not found.'}
          </p>
        </Card>
      </div>
    )
  }

  const effectiveGoldPercentage = product.purity + product.wastagePercentage

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku}`}
        breadcrumb={[{ label: 'Stock', to: '/stock' }, { label: product.name }]}
        actions={
          <Button onClick={() => navigate(`/products/${product._id}/edit`)}>Edit product</Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {product.level && (
          <Badge tone={stockLevelTone(product.level)} dot>
            {stockLevelLabel(product.level)}
          </Badge>
        )}
        <MetalSwatch metal={product.metalType} label={`${metalLabel(product.metalType)} · ${formatPercent(product.purity)}`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-5">
          <Card title="Product information">
            <dl className="divide-y divide-line">
              {product.category && <DetailRow label="Category" value={product.category} />}
              {product.barcode && (
                <DetailRow label="Barcode" value={<span className="font-mono">{product.barcode}</span>} />
              )}
              <DetailRow label="Created" value={formatDate(product.createdAt)} />
              <DetailRow label="Last updated" value={formatDate(product.updatedAt)} />
            </dl>
            {product.description && (
              <p className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">{product.description}</p>
            )}
          </Card>

          <Card title="Jewellery details">
            <dl className="divide-y divide-line">
              <DetailRow label="Gross weight" value={<span className="font-mono tabular-nums">{formatWeight(product.grossWeight)}</span>} />
              <DetailRow label="Net weight" value={<span className="font-mono tabular-nums">{formatWeight(product.netWeight)}</span>} />
              <DetailRow label="Purity" value={<span className="font-mono tabular-nums">{formatPercent(product.purity)}</span>} />
              <DetailRow label="Wastage" value={<span className="font-mono tabular-nums">{formatPercent(product.wastagePercentage)}</span>} />
              <DetailRow
                label="Effective %"
                value={<span className="font-mono tabular-nums">{formatPercent(effectiveGoldPercentage)}</span>}
              />
              {product.sizeLength && (
                <DetailRow
                  label="Size / length"
                  value={
                    <span className="font-mono tabular-nums">
                      {product.sizeLength.value} {sizeUnitLabel(product.sizeLength.unit)}
                    </span>
                  }
                />
              )}
              <DetailRow
                label="Making charge"
                value={
                  <span className="font-mono tabular-nums">
                    {product.makingChargeType === 'percentage'
                      ? formatPercent(product.makingChargeValue)
                      : `${formatCurrency(product.makingChargeValue)} / g`}
                  </span>
                }
              />
            </dl>
          </Card>

          <Card title="Inventory">
            <dl className="divide-y divide-line">
              <DetailRow label="Quantity in stock" value={<span className="font-mono tabular-nums">{product.quantity}</span>} />
              {product.level && (
                <DetailRow label="Stock level" value={<Badge tone={stockLevelTone(product.level)}>{stockLevelLabel(product.level)}</Badge>} />
              )}
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card title="Pricing" description="Calculated by the server from the current spot price.">
            {product.price ? (
              <div className="flex flex-col gap-5">
                <FigureStack
                  rows={[
                    { label: 'Metal value', value: product.price.basePrice },
                    { label: 'Making charge', value: product.price.makingChargeAmount },
                    { label: 'GST', value: product.price.tax },
                  ]}
                  total={{ label: 'Selling price', value: product.price.finalPrice }}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <StatCard
                    label="Purchase cost"
                    value={formatCurrency(product.price.purchaseCost)}
                    meta={`Locked at ${formatCurrency(product.price.purchaseMetalRate)} / g`}
                  />
                  <StatCard
                    label="Current cost"
                    value={formatCurrency(product.price.currentCost)}
                    meta={`At today's ${formatCurrency(product.price.currentMetalRate)} / g`}
                  />
                </div>
                <p className="text-xs text-ink-muted">
                  Purchase and current cost are internal figures — they are not part of the selling price above.
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                {product.priceError ?? 'No price available yet. Set up a metal rate and pricing rule to see a breakdown.'}
              </p>
            )}
          </Card>

          <Card title="Change history" description="Recorded edits to this product.">
            {auditLoading ? (
              <p className="text-sm text-ink-muted">Loading history…</p>
            ) : auditLog.length === 0 ? (
              <EmptyState
                icon={<InboxIcon size={20} />}
                title="No changes recorded yet"
                description="Edits to this product's price-affecting fields will appear here."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {auditLog.map((entry, index) => (
                  <li key={index} className="flex flex-col gap-1 py-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-ink">{sentence(entry.field)}</span>
                      <span className="text-xs text-ink-muted">{formatDate(entry.at)}</span>
                    </div>
                    <p className="text-ink-muted">
                      <span className="font-mono tabular-nums">{auditValueLabel(entry.oldValue)}</span>
                      {' → '}
                      <span className="font-mono tabular-nums text-ink">{auditValueLabel(entry.newValue)}</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {auditUserLabel(entry)}
                      {entry.reason ? ` · ${entry.reason}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <p className="text-xs text-ink-muted">
        Need to view the full catalogue? <Link to="/stock" className="text-accent hover:underline">Back to stock</Link>.
      </p>
    </div>
  )
}

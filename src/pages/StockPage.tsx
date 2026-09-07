import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import {
  AlertIcon,
  Badge,
  BoxIcon,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FigureStack,
  IconButton,
  Input,
  InboxIcon,
  MetalSwatch,
  Modal,
  PageHeader,
  Pagination,
  PlusIcon,
  SearchInput,
  Select,
  Textarea,
  TrashIcon,
  EditIcon,
  DownloadIcon,
  paginate,
  useToast,
  type Column,
} from '../components'
import { extractErrorMessage, formatCurrency, formatDate } from '../utils/format'
import { stockLevelLabel, stockLevelTone } from '../utils/ui'

type MetalType = 'gold' | 'silver'
type Purity = '24K' | '22K' | '18K' | '925'
type ProductType = 'ring' | 'necklace' | 'bracelet' | 'earring' | 'pendant'
type StockLevel = 'red' | 'yellow' | 'green'

interface ProductPrice {
  spotPricePerGram: number
  weightGrams: number
  basePrice: number
  markup: number
  laborCost: number
  subtotal: number
  tax: number
  finalPrice: number
}

interface Product {
  _id: string
  name: string
  type: ProductType
  metalType: MetalType
  purity: Purity
  weightGrams: number
  sku: string
  quantity: number
  image?: string
  description?: string
  barcode?: string
  category?: string
  price: ProductPrice | null
  priceError?: string
  level: StockLevel
  createdAt: string
  updatedAt: string
}

interface LowStockAlert {
  productId: string
  name: string
  sku: string
  quantity: number
  level: StockLevel
}

interface ImportError {
  row: number
  sku?: string
  message: string
}

interface ImportResult {
  insertedCount: number
  errors: ImportError[]
}

const PRODUCT_TYPES: ProductType[] = ['ring', 'necklace', 'bracelet', 'earring', 'pendant']
const METAL_TYPES: MetalType[] = ['gold', 'silver']
const typeOptions = PRODUCT_TYPES.map((type) => ({ value: type, label: sentence(type) }))
const metalOptions = METAL_TYPES.map((metal) => ({ value: metal, label: sentence(metal) }))

const CSV_COLUMNS = 'name, type, metalType, purity, weightGrams, sku, quantity, description'

function sentence(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatWeight(grams: number): string {
  return `${grams.toLocaleString('en-IN', { maximumFractionDigits: 3 })} g`
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink">{value}</dd>
    </div>
  )
}

export default function StockPage() {
  const toast = useToast()
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [metalTypeFilter, setMetalTypeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])

  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null)
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [isAdjusting, setIsAdjusting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [detailProduct, setDetailProduct] = useState<Product | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Debounced search — the list refreshes as you type instead of on submit.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 250)
    return () => window.clearTimeout(timer)
  }, [q])

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const params: Record<string, string> = {}
      if (debouncedQ.trim()) params.q = debouncedQ.trim()
      if (metalTypeFilter) params.metalType = metalTypeFilter
      if (typeFilter) params.type = typeFilter
      const { data } = await apiClient.get<Product[]>('/products', { params })
      setProducts(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [debouncedQ, metalTypeFilter, typeFilter])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const refreshLowStock = useCallback(() => {
    apiClient
      .get<LowStockAlert[]>('/stock/status')
      .then(({ data }) => setLowStockAlerts(data))
      .catch(() => {
        // Optional callout; ignore failures (e.g. endpoint not deployed yet).
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<LowStockAlert[]>('/stock/status')
      .then(({ data }) => {
        if (!cancelled) setLowStockAlerts(data)
      })
      .catch(() => {
        // Optional callout; ignore failures (e.g. endpoint not deployed yet).
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, metalTypeFilter, typeFilter])

  const hasFilters = Boolean(debouncedQ.trim() || metalTypeFilter || typeFilter)
  const activeFilterCount = (metalTypeFilter ? 1 : 0) + (typeFilter ? 1 : 0)

  const pagedProducts = useMemo(
    () => paginate(products, page, pageSize),
    [products, page, pageSize],
  )

  function clearFilters() {
    setQ('')
    setMetalTypeFilter('')
    setTypeFilter('')
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/products/${deleteTarget._id}`)
      const name = deleteTarget.name
      setDeleteTarget(null)
      setDetailProduct((current) => (current?._id === deleteTarget._id ? null : current))
      await fetchProducts()
      refreshLowStock()
      toast.success(`${name} deleted`)
    } catch (err) {
      const message = extractErrorMessage(err)
      setLoadError(message)
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  function openAdjustForm(product: Product) {
    setAdjustingProduct(product)
    setAdjustQuantity(String(product.quantity))
    setAdjustNotes('')
    setAdjustError(null)
  }

  function closeAdjustForm() {
    setAdjustingProduct(null)
    setAdjustQuantity('')
    setAdjustNotes('')
    setAdjustError(null)
  }

  async function handleAdjustSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!adjustingProduct) return
    if (adjustQuantity.trim() === '' || Number(adjustQuantity) < 0) {
      setAdjustError('Enter the new quantity on hand (0 or more).')
      return
    }
    setAdjustError(null)
    setIsAdjusting(true)
    try {
      await apiClient.patch(`/products/${adjustingProduct._id}/stock`, {
        quantity: Number(adjustQuantity),
        notes: adjustNotes || undefined,
      })
      const name = adjustingProduct.name
      const newQuantity = Number(adjustQuantity)
      closeAdjustForm()
      await fetchProducts()
      refreshLowStock()
      toast.success(`Stock for ${name} set to ${newQuantity}`)
    } catch (err) {
      const message = extractErrorMessage(err)
      setAdjustError(message)
      toast.error(message)
    } finally {
      setIsAdjusting(false)
    }
  }

  function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    setCsvFile(event.target.files?.[0] ?? null)
    setImportResult(null)
    setImportError(null)
  }

  function openImport() {
    setCsvFile(null)
    setImportResult(null)
    setImportError(null)
    setImportOpen(true)
  }

  function closeImport() {
    setImportOpen(false)
    setCsvFile(null)
    setImportResult(null)
    setImportError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleCsvImport() {
    if (!csvFile) return
    setIsImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      const { data } = await apiClient.post<ImportResult>('/products/import', formData)
      setImportResult(data)
      setCsvFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchProducts()
      refreshLowStock()
      if (data.errors.length > 0) {
        toast.warning(
          `Imported ${data.insertedCount} product(s), ${data.errors.length} row(s) skipped`,
        )
      } else {
        toast.success(`Imported ${data.insertedCount} product(s)`)
      }
    } catch (err) {
      const message = extractErrorMessage(err)
      setImportError(message)
      toast.error(message)
    } finally {
      setIsImporting(false)
    }
  }

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {sentence(row.type)}
            {row.category ? ` · ${row.category}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      sortValue: (row) => row.sku,
      render: (row) => <span className="font-mono text-xs text-ink-muted">{row.sku}</span>,
    },
    {
      key: 'metal',
      header: 'Metal',
      render: (row) => (
        <MetalSwatch metal={row.metalType} label={`${sentence(row.metalType)} ${row.purity}`} />
      ),
    },
    {
      key: 'weightGrams',
      header: 'Weight',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.weightGrams,
      render: (row) => (
        <span className="font-mono tabular-nums">{formatWeight(row.weightGrams)}</span>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.quantity,
      render: (row) => <span className="font-mono tabular-nums">{row.quantity}</span>,
    },
    {
      key: 'level',
      header: 'Status',
      render: (row) => <Badge tone={stockLevelTone(row.level)} dot>{stockLevelLabel(row.level)}</Badge>,
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.price?.finalPrice ?? null,
      render: (row) =>
        row.price ? (
          <span className="font-mono tabular-nums">{formatCurrency(row.price.finalPrice)}</span>
        ) : (
          <span className="text-xs text-ink-muted">Not priced</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '150px',
      render: (row) => (
        <div className="flex justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
          <IconButton label={`Adjust stock for ${row.name}`} size="sm" onClick={() => openAdjustForm(row)}>
            <BoxIcon size={16} />
          </IconButton>
          <IconButton label={`Edit ${row.name}`} size="sm" onClick={() => navigate(`/products/${row._id}/edit`)}>
            <EditIcon size={16} />
          </IconButton>
          <IconButton
            label={`Delete ${row.name}`}
            size="sm"
            variant="danger"
            onClick={() => setDeleteTarget(row)}
          >
            <TrashIcon size={16} />
          </IconButton>
        </div>
      ),
    },
  ]

  const emptyState = hasFilters ? (
    <EmptyState
      icon={<InboxIcon size={20} />}
      title="No products match these filters"
      description="Try a different search term, or clear the filters to see the full catalogue."
      action={
        <Button variant="secondary" onClick={clearFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<BoxIcon size={20} />}
      title="No products yet"
      description="Add your first piece to start tracking stock levels and prices."
      action={
        <Button leftIcon={<PlusIcon size={16} />} onClick={() => navigate('/products/new')}>
          Add product
        </Button>
      }
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Stock"
        description="Products, stock levels and backend-calculated prices."
        actions={
          <>
            <Button variant="secondary" leftIcon={<DownloadIcon size={16} />} onClick={openImport}>
              Import CSV
            </Button>
            <Button leftIcon={<PlusIcon size={16} />} onClick={() => navigate('/products/new')}>
              Add product
            </Button>
          </>
        }
      />

      {lowStockAlerts.length > 0 && (
        <div className="rounded-panel border border-line bg-warning-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertIcon size={16} />
            {lowStockAlerts.length} product{lowStockAlerts.length === 1 ? '' : 's'} need restocking
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {lowStockAlerts.map((alert) => (
              <li
                key={alert.productId}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink"
              >
                <span>{alert.name}</span>
                <span className="font-mono text-xs text-ink-muted">{alert.sku}</span>
                <span className="font-mono tabular-nums text-ink-muted">{alert.quantity} left</span>
                <Badge tone={stockLevelTone(alert.level)}>{stockLevelLabel(alert.level)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Toolbar: search always visible, filters inline on md+ and in a sheet on phones. */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={q}
          onValueChange={setQ}
          placeholder="Search name, SKU, barcode"
          className="min-w-48 flex-1"
        />

        <div className="hidden items-center gap-2 md:flex">
          <div className="w-40">
            <Select
              value={metalTypeFilter}
              onChange={(event) => setMetalTypeFilter(event.target.value)}
              aria-label="Filter by metal"
              placeholder="All metals"
              options={metalOptions}
            />
          </div>
          <div className="w-40">
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter by product type"
              placeholder="All types"
              options={typeOptions}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>

        <Button variant="secondary" className="md:hidden" onClick={() => setFiltersOpen(true)}>
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
      </div>

      {loadError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <DataTable
          columns={columns}
          rows={pagedProducts}
          getRowId={(row) => row._id}
          isLoading={isLoading}
          emptyState={emptyState}
          initialSort={{ key: 'name', direction: 'asc' }}
          onRowClick={(row) => setDetailProduct(row)}
          caption="Products in stock"
          renderMobileCard={(row) => (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{row.name}</p>
                  <p className="truncate font-mono text-xs text-ink-muted">{row.sku}</p>
                </div>
                <Badge tone={stockLevelTone(row.level)} dot>
                  {stockLevelLabel(row.level)}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-3">
                <MetalSwatch
                  metal={row.metalType}
                  label={`${sentence(row.metalType)} ${row.purity}`}
                />
                <span className="font-mono text-xs tabular-nums text-ink-muted">
                  {formatWeight(row.weightGrams)}
                </span>
              </div>

              <dl className="flex items-baseline justify-between gap-3">
                <div>
                  <dt className="text-xs text-ink-muted">In stock</dt>
                  <dd className="font-mono text-sm tabular-nums text-ink">{row.quantity}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs text-ink-muted">Price</dt>
                  <dd className="font-mono text-sm tabular-nums text-ink">
                    {row.price ? formatCurrency(row.price.finalPrice) : 'Not priced'}
                  </dd>
                </div>
              </dl>

              <div
                className="flex flex-wrap gap-2 border-t border-line pt-3"
                onClick={(event) => event.stopPropagation()}
              >
                <Button variant="secondary" onClick={() => setDetailProduct(row)}>
                  Details
                </Button>
                <Button variant="secondary" onClick={() => openAdjustForm(row)}>
                  Adjust stock
                </Button>
                <Button variant="secondary" onClick={() => navigate(`/products/${row._id}/edit`)}>
                  Edit
                </Button>
                <IconButton
                  label={`Delete ${row.name}`}
                  variant="danger"
                  className="ml-auto"
                  onClick={() => setDeleteTarget(row)}
                >
                  <TrashIcon size={16} />
                </IconButton>
              </div>
            </div>
          )}
        />

        {products.length > pageSize && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={products.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            itemLabel="products"
            className="rounded-panel border border-line bg-surface"
          />
        )}
      </div>

      {/* Mobile filter sheet */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                clearFilters()
                setFiltersOpen(false)
              }}
            >
              Clear filters
            </Button>
            <Button fullWidth onClick={() => setFiltersOpen(false)}>
              Show results
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Metal">
            <Select
              value={metalTypeFilter}
              onChange={(event) => setMetalTypeFilter(event.target.value)}
              placeholder="All metals"
              options={metalOptions}
            />
          </Field>
          <Field label="Product type">
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              placeholder="All types"
              options={typeOptions}
            />
          </Field>
        </div>
      </Drawer>

      {/* Product detail with the assay-style price breakdown — a quick glance;
          "View full details" opens the dedicated product page. */}
      <Drawer
        open={detailProduct !== null}
        onClose={() => setDetailProduct(null)}
        title={detailProduct?.name ?? 'Product'}
        description={detailProduct ? `SKU ${detailProduct.sku}` : undefined}
        size="md"
        footer={
          detailProduct ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  const product = detailProduct
                  setDetailProduct(null)
                  openAdjustForm(product)
                }}
              >
                Adjust stock
              </Button>
              <Button onClick={() => navigate(`/products/${detailProduct._id}/edit`)}>
                Edit product
              </Button>
            </>
          ) : undefined
        }
      >
        {detailProduct && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={stockLevelTone(detailProduct.level)} dot>
                  {stockLevelLabel(detailProduct.level)}
                </Badge>
                <MetalSwatch
                  metal={detailProduct.metalType}
                  label={`${sentence(detailProduct.metalType)} ${detailProduct.purity}`}
                />
              </div>
              <Link
                to={`/products/${detailProduct._id}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                View full details
              </Link>
            </div>

            <Card title="Details" padding="sm">
              <dl className="divide-y divide-line">
                <DetailRow label="Type" value={sentence(detailProduct.type)} />
                {detailProduct.category && (
                  <DetailRow label="Category" value={detailProduct.category} />
                )}
                {detailProduct.barcode && (
                  <DetailRow
                    label="Barcode"
                    value={<span className="font-mono">{detailProduct.barcode}</span>}
                  />
                )}
                <DetailRow
                  label="Weight"
                  value={
                    <span className="font-mono tabular-nums">
                      {formatWeight(detailProduct.weightGrams)}
                    </span>
                  }
                />
                <DetailRow
                  label="In stock"
                  value={<span className="font-mono tabular-nums">{detailProduct.quantity}</span>}
                />
                <DetailRow label="Last updated" value={formatDate(detailProduct.updatedAt)} />
              </dl>
              {detailProduct.description && (
                <p className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">
                  {detailProduct.description}
                </p>
              )}
            </Card>

            <Card
              title="Price breakdown"
              description="Calculated by the server from the current spot price."
              padding="sm"
            >
              {detailProduct.price ? (
                <FigureStack
                  rows={[
                    {
                      label: 'Metal value',
                      value: detailProduct.price.basePrice,
                      hint: `${formatWeight(detailProduct.price.weightGrams)} @ ${formatCurrency(
                        detailProduct.price.spotPricePerGram,
                      )} / g`,
                    },
                    { label: 'Making', value: detailProduct.price.markup },
                    { label: 'Labour', value: detailProduct.price.laborCost },
                    { label: 'Subtotal', value: detailProduct.price.subtotal, emphasis: true },
                    { label: 'GST', value: detailProduct.price.tax },
                  ]}
                  total={{ label: 'Total', value: detailProduct.price.finalPrice }}
                />
              ) : (
                <p className="text-sm text-ink-muted">
                  {detailProduct.priceError ??
                    'No price available yet. Set up a pricing rule for this metal to see a breakdown.'}
                </p>
              )}
            </Card>
          </div>
        )}
      </Drawer>

      {/* Stock adjustment */}
      <Modal
        open={adjustingProduct !== null}
        onClose={closeAdjustForm}
        title="Adjust stock"
        description={adjustingProduct ? `${adjustingProduct.name} · ${adjustingProduct.sku}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeAdjustForm} disabled={isAdjusting}>
              Cancel
            </Button>
            <Button type="submit" form="adjust-form" loading={isAdjusting}>
              Save adjustment
            </Button>
          </>
        }
      >
        <form id="adjust-form" onSubmit={handleAdjustSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex items-baseline justify-between rounded-control bg-sunken px-3 py-2">
            <span className="text-sm text-ink-muted">Current quantity</span>
            <span className="font-mono text-sm tabular-nums text-ink">
              {adjustingProduct?.quantity ?? 0}
            </span>
          </div>

          <Field
            label="New quantity"
            required
            hint="This is the absolute count on hand, not a change amount."
            error={adjustError ?? undefined}
          >
            <Input
              type="number"
              min="0"
              inputMode="numeric"
              value={adjustQuantity}
              onChange={(event) => setAdjustQuantity(event.target.value)}
              className="font-mono"
            />
          </Field>

          <Field label="Notes" hint="Optional. Recorded on the stock transaction.">
            <Textarea
              value={adjustNotes}
              onChange={(event) => setAdjustNotes(event.target.value)}
              rows={2}
            />
          </Field>
        </form>
      </Modal>

      {/* CSV import */}
      <Modal
        open={importOpen}
        onClose={closeImport}
        title="Import products from CSV"
        description="Rows are validated before anything is written."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeImport} disabled={isImporting}>
              Close
            </Button>
            <Button onClick={handleCsvImport} disabled={!csvFile} loading={isImporting}>
              Import file
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-control bg-sunken px-3 py-2">
            <p className="text-xs font-medium text-ink">Expected columns</p>
            <p className="mt-1 font-mono text-xs text-ink-muted">{CSV_COLUMNS}</p>
            <p className="mt-2 text-xs text-ink-muted">
              name, type, metalType, purity, weightGrams and sku are required on every row.
            </p>
          </div>

          <Field label="CSV file" required>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-control file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-sunken"
            />
          </Field>

          {importError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {importError}
            </p>
          )}

          {importResult && (
            <div className="rounded-panel border border-line">
              <p className="border-b border-line px-3 py-2 text-sm text-ink">
                Inserted{' '}
                <span className="font-mono tabular-nums">{importResult.insertedCount}</span>{' '}
                product{importResult.insertedCount === 1 ? '' : 's'}
                {importResult.errors.length > 0 && (
                  <>
                    {' · '}
                    <span className="font-mono tabular-nums">{importResult.errors.length}</span> row
                    {importResult.errors.length === 1 ? '' : 's'} skipped
                  </>
                )}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="max-h-56 overflow-y-auto px-3 py-2">
                  {importResult.errors.map((rowError) => (
                    <li
                      key={`${rowError.row}-${rowError.sku ?? ''}`}
                      className="flex gap-2 py-1 text-sm text-ink-muted"
                    >
                      <span className="shrink-0 font-mono text-xs text-danger">
                        Row {rowError.row}
                      </span>
                      <span className="min-w-0">
                        {rowError.sku ? `${rowError.sku} — ` : ''}
                        {rowError.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this product?"
        message={
          deleteTarget
            ? `${deleteTarget.name} (SKU ${deleteTarget.sku}) will be removed from the catalogue. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete product"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

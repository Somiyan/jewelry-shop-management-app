import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../api/client'
import {
  Badge,
  Button,
  type Column,
  DataTable,
  EmptyState,
  InboxIcon,
  PageHeader,
  Pagination,
  PlusIcon,
  type TabItem,
  Tabs,
  pageCount,
  paginate,
} from '../components'
import CreateOrderDrawer from './Orders/CreateOrderDrawer'
import { customerName, customerPhone, statusLabel } from './Orders/helpers'
import OrderDetailDrawer from './Orders/OrderDetailDrawer'
import { isCustomItem, ORDER_STATUSES, STATUS_LABELS, type Order, type OrderStatus } from './Orders/types'
import { extractErrorMessage, formatCurrency, formatDate } from '../utils/format'
import { orderStatusTone } from '../utils/ui'

const PAGE_SIZE = 10

/** Custom items still waiting on the karigar. Surfaced in the list because it
 * is what decides whether an order can move on — everything past 'ready' now
 * advances by itself once these reach zero. */
function toBeMadeCount(order: Order): number {
  return order.items.filter((item) => isCustomItem(item) && item.fulfillmentStatus === 'pending').length
}

export default function OrdersPage() {
  const navigate = useNavigate()

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [page, setPage] = useState(1)

  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const url = statusFilter ? `/orders/by-status/${statusFilter}` : '/orders'
      const { data } = await apiClient.get<Order[]>(url)
      setOrders(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const detailOrder = useMemo(
    () => orders.find((order) => order._id === detailOrderId) ?? null,
    [orders, detailOrderId],
  )

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const order of orders) counts.set(order.status, (counts.get(order.status) ?? 0) + 1)
    return counts
  }, [orders])

  const tabs: TabItem<OrderStatus | 'all'>[] = [
    { id: 'all', label: 'All', count: statusFilter === '' ? orders.length : undefined },
    ...ORDER_STATUSES.map((status) => ({
      id: status,
      label: STATUS_LABELS[status],
      count:
        statusFilter === '' ? (statusCounts.get(status) ?? 0) : statusFilter === status ? orders.length : undefined,
    })),
  ]

  const currentPage = Math.min(page, pageCount(orders.length, PAGE_SIZE))
  const pageRows = paginate(orders, currentPage, PAGE_SIZE)

  function changeStatusFilter(next: OrderStatus | '') {
    setStatusFilter(next)
    setPage(1)
  }

  function openDetail(order: Order) {
    setDetailOrderId(order._id)
  }

  function closeDetail() {
    setDetailOrderId(null)
  }

  function handleOrderUpdated(updated: Order) {
    setOrders((prev) => prev.map((order) => (order._id === updated._id ? updated : order)))
  }

  function handleOrderCreated() {
    setShowCreateForm(false)
    fetchOrders()
  }

  const columns: Column<Order>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      width: '130px',
      sortable: true,
      sortValue: (order) => new Date(order.createdAt),
      render: (order) => <span className="font-mono text-sm">{formatDate(order.createdAt)}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      sortValue: (order) => customerName(order.customerId),
      render: (order) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{customerName(order.customerId)}</p>
          {customerPhone(order.customerId) && (
            <p className="truncate font-mono text-xs text-ink-muted">{customerPhone(order.customerId)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      width: '90px',
      render: (order) => {
        const toBeMade = toBeMadeCount(order)
        return (
          <div className="text-right">
            <span className="font-mono text-sm">{order.items.length}</span>
            {order.items.some((item) => item.isCustomOrder) && (
              <span className="block text-xs text-ink-muted">
                {toBeMade > 0 ? `${toBeMade} to be made` : 'incl. custom'}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      width: '150px',
      sortable: true,
      sortValue: (order) => order.totalAmount,
      render: (order) => (
        <span className="font-mono text-sm font-medium">{formatCurrency(order.totalAmount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      sortable: true,
      sortValue: (order) => ORDER_STATUSES.indexOf(order.status as OrderStatus),
      render: (order) => (
        <Badge tone={orderStatusTone(order.status)} dot>
          {statusLabel(order.status)}
        </Badge>
      ),
    },
    {
      key: 'deliveryDate',
      header: 'Delivery',
      width: '130px',
      sortable: true,
      sortValue: (order) => (order.deliveryDate ? new Date(order.deliveryDate) : null),
      render: (order) => (
        <span className="font-mono text-sm text-ink-muted">{formatDate(order.deliveryDate)}</span>
      ),
    },
  ]

  const emptyState =
    statusFilter === '' ? (
      <EmptyState
        icon={<InboxIcon size={20} />}
        title="No orders yet"
        description="Orders appear here once a sale is recorded at the counter, or a custom piece is booked."
        action={
          <Button leftIcon={<PlusIcon size={16} />} onClick={() => navigate('/sales/new')}>
            New sale
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<InboxIcon size={20} />}
        title={`No ${statusLabel(statusFilter).toLowerCase()} orders`}
        description="Nothing sits at this stage right now. Try another stage or view every order."
        action={
          <Button variant="secondary" onClick={() => changeStatusFilter('')}>
            Show all orders
          </Button>
        }
      />
    )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Orders"
        description="Track every order from the counter through to delivery. Ready, delivered and completed set themselves as pieces are finished, sold and paid for."
        actions={
          <Button leftIcon={<PlusIcon size={16} />} onClick={() => setShowCreateForm(true)}>
            New order
          </Button>
        }
      />

      <Tabs
        items={tabs}
        value={statusFilter === '' ? 'all' : statusFilter}
        onChange={(id) => changeStatusFilter(id === 'all' ? '' : id)}
        label="Order status"
      />

      {loadError && (
        <p role="alert" className="rounded-panel bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <DataTable
          columns={columns}
          rows={pageRows}
          getRowId={(order) => order._id}
          isLoading={isLoading}
          emptyState={emptyState}
          onRowClick={openDetail}
          caption="Orders"
          initialSort={{ key: 'createdAt', direction: 'desc' }}
          renderMobileCard={(order) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{customerName(order.customerId)}</p>
                  <p className="truncate text-xs text-ink-muted">
                    <span className="font-mono">{formatDate(order.createdAt)}</span>
                    {customerPhone(order.customerId) && (
                      <>
                        {' · '}
                        <span className="font-mono">{customerPhone(order.customerId)}</span>
                      </>
                    )}
                  </p>
                </div>
                <Badge tone={orderStatusTone(order.status)} dot>
                  {statusLabel(order.status)}
                </Badge>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                <span className="text-xs text-ink-muted">
                  <span className="font-mono">{order.items.length}</span>{' '}
                  {order.items.length === 1 ? 'item' : 'items'}
                  {order.items.some((item) => item.isCustomOrder) &&
                    (toBeMadeCount(order) > 0 ? ` · ${toBeMadeCount(order)} to be made` : ' · includes custom')}{' '}
                  · delivery{' '}
                  <span className="font-mono">{formatDate(order.deliveryDate)}</span>
                </span>
                <span className="font-mono text-sm font-semibold text-ink">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          )}
        />

        {orders.length > PAGE_SIZE && (
          <Pagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            totalItems={orders.length}
            onPageChange={setPage}
            itemLabel="orders"
            className="rounded-panel border border-line bg-surface"
          />
        )}
      </div>

      <CreateOrderDrawer
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onCreated={handleOrderCreated}
      />

      <OrderDetailDrawer order={detailOrder} onClose={closeDetail} onOrderUpdated={handleOrderUpdated} />
    </div>
  )
}

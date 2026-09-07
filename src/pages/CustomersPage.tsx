import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/client'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Drawer,
  EditIcon,
  EmptyState,
  Field,
  Input,
  InboxIcon,
  PageHeader,
  Pagination,
  PlusIcon,
  SearchInput,
  Skeleton,
  SkeletonText,
  Textarea,
  UsersIcon,
  paginate,
  useToast,
  type Column,
} from '../components'
import { extractErrorMessage, formatCurrency, formatDate } from '../utils/format'

type CommunicationChannel = 'sms' | 'email' | 'whatsapp'

interface Purchase {
  orderId: string
  amount: number
  date: string
}

interface Customer {
  _id: string
  name: string
  phone: string
  email?: string
  address?: string
  billingAddress?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
  communicationPreferences?: CommunicationChannel[]
  notes?: string
  loyaltyPoints: number
  totalPurchases: number
  purchases?: Purchase[]
  createdAt?: string
  updatedAt?: string
}

interface CustomerFormState {
  name: string
  phone: string
  email: string
  address: string
  billingAddress: string
  city: string
  state: string
  pincode: string
  gstin: string
  communicationPreferences: CommunicationChannel[]
  notes: string
}

const CHANNELS: { value: CommunicationChannel; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  sms: 'SMS',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

const emptyForm: CustomerFormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  billingAddress: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  communicationPreferences: [],
  notes: '',
}

type CustomerFormErrors = Partial<Record<keyof CustomerFormState, string>>

function customerToForm(customer: Customer): CustomerFormState {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? '',
    address: customer.address ?? '',
    billingAddress: customer.billingAddress ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    pincode: customer.pincode ?? '',
    gstin: customer.gstin ?? '',
    communicationPreferences: customer.communicationPreferences ?? [],
    notes: customer.notes ?? '',
  }
}

function validateCustomerForm(form: CustomerFormState): CustomerFormErrors {
  const errors: CustomerFormErrors = {}
  if (!form.name.trim()) errors.name = 'Enter the customer name.'
  if (!form.phone.trim()) errors.phone = 'Enter a phone number.'
  if (form.email.trim() && !form.email.includes('@')) errors.email = 'Enter a valid email address.'
  return errors
}

/** Most recent purchase date, or null when there are none. */
function lastPurchaseDate(customer: Customer): string | null {
  const purchases = customer.purchases
  if (!purchases || purchases.length === 0) return null
  return purchases.reduce<string | null>((latest, purchase) => {
    if (!purchase.date) return latest
    if (!latest) return purchase.date
    return new Date(purchase.date) > new Date(latest) ? purchase.date : latest
  }, null)
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink">{value}</dd>
    </div>
  )
}

export default function CustomersPage() {
  const toast = useToast()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [formState, setFormState] = useState<CustomerFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)

  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null)
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // Debounced search — no submit button needed at the counter.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 250)
    return () => window.clearTimeout(timer)
  }, [q])

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const params: Record<string, string> = {}
      if (debouncedQ.trim()) params.q = debouncedQ.trim()
      const { data } = await apiClient.get<Customer[]>('/customers', { params })
      setCustomers(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [debouncedQ])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ])

  const pagedCustomers = useMemo(
    () => paginate(customers, page, pageSize),
    [customers, page, pageSize],
  )

  const loadCustomerDetail = useCallback(async (customerId: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const { data } = await apiClient.get<Customer>(`/customers/${customerId}`)
      setDetailCustomer(data)
    } catch (err) {
      setDetailError(extractErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  function openDetail(customer: Customer) {
    setDetailCustomerId(customer._id)
    setDetailCustomer(null)
    setDetailError(null)
    loadCustomerDetail(customer._id)
  }

  function closeDetail() {
    setDetailCustomerId(null)
    setDetailCustomer(null)
    setDetailError(null)
  }

  function openAddForm() {
    setEditingCustomerId(null)
    setFormState(emptyForm)
    setFormErrors({})
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(customer: Customer) {
    setEditingCustomerId(customer._id)
    setFormState(customerToForm(customer))
    setFormErrors({})
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingCustomerId(null)
    setFormState(emptyForm)
    setFormErrors({})
    setFormError(null)
  }

  function updateFormField<K extends keyof CustomerFormState>(key: K, value: CustomerFormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }))
    setFormErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  function toggleChannel(channel: CommunicationChannel, checked: boolean) {
    setFormState((prev) => ({
      ...prev,
      communicationPreferences: checked
        ? [...prev.communicationPreferences, channel]
        : prev.communicationPreferences.filter((item) => item !== channel),
    }))
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const errors = validateCustomerForm(formState)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmittingForm(true)
    try {
      const body = {
        name: formState.name,
        phone: formState.phone,
        email: formState.email || undefined,
        address: formState.address || undefined,
        notes: formState.notes || undefined,
        billingAddress: formState.billingAddress || undefined,
        city: formState.city || undefined,
        state: formState.state || undefined,
        pincode: formState.pincode || undefined,
        gstin: formState.gstin || undefined,
        communicationPreferences: formState.communicationPreferences,
      }
      if (editingCustomerId) {
        await apiClient.put(`/customers/${editingCustomerId}`, body)
      } else {
        await apiClient.post('/customers', body)
      }
      const editedId = editingCustomerId
      closeForm()
      await fetchCustomers()
      if (editedId && detailCustomerId === editedId) {
        await loadCustomerDetail(editedId)
      }
      toast.success(editedId ? 'Customer updated' : 'Customer added')
    } catch (err) {
      const message = extractErrorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSubmittingForm(false)
    }
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.name}</p>
          {row.city && <p className="truncate text-xs text-ink-muted">{row.city}</p>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      sortable: true,
      sortValue: (row) => row.phone,
      render: (row) => <span className="font-mono text-sm text-ink-muted">{row.phone}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      sortValue: (row) => row.email ?? '',
      render: (row) => (
        <span className="block max-w-56 truncate text-ink-muted">{row.email || '—'}</span>
      ),
    },
    {
      key: 'loyaltyPoints',
      header: 'Points',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.loyaltyPoints ?? 0,
      render: (row) => (
        <span className="font-mono tabular-nums">{row.loyaltyPoints ?? 0}</span>
      ),
    },
    {
      key: 'totalPurchases',
      header: 'Total purchases',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.totalPurchases ?? 0,
      render: (row) => (
        <span className="font-mono tabular-nums">{formatCurrency(row.totalPurchases)}</span>
      ),
    },
    {
      key: 'lastPurchase',
      header: 'Last purchase',
      align: 'right',
      sortable: true,
      sortValue: (row) => {
        const date = lastPurchaseDate(row)
        return date ? new Date(date) : null
      },
      render: (row) => {
        const date = lastPurchaseDate(row)
        return (
          <span className="font-mono text-xs tabular-nums text-ink-muted">
            {date ? formatDate(date) : '—'}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '110px',
      render: (row) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="secondary" leftIcon={<EditIcon size={14} />} onClick={() => openEditForm(row)}>
            Edit
          </Button>
        </div>
      ),
    },
  ]

  const emptyState = debouncedQ.trim() ? (
    <EmptyState
      icon={<InboxIcon size={20} />}
      title="No customers match that search"
      description="Try a different name or phone number, or clear the search to see everyone."
      action={
        <Button variant="secondary" onClick={() => setQ('')}>
          Clear search
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<UsersIcon size={20} />}
      title="No customers yet"
      description="Add a customer to keep purchase history and loyalty points together."
      action={
        <Button leftIcon={<PlusIcon size={16} />} onClick={openAddForm}>
          Add customer
        </Button>
      }
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description="Contacts, billing details, loyalty points and purchase history."
        actions={
          <Button leftIcon={<PlusIcon size={16} />} onClick={openAddForm}>
            Add customer
          </Button>
        }
      />

      <SearchInput
        value={q}
        onValueChange={setQ}
        placeholder="Search by name or phone"
        className="max-w-md"
      />

      {loadError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <DataTable
          columns={columns}
          rows={pagedCustomers}
          getRowId={(row) => row._id}
          isLoading={isLoading}
          emptyState={emptyState}
          initialSort={{ key: 'name', direction: 'asc' }}
          onRowClick={openDetail}
          caption="Customers"
          renderMobileCard={(row) => {
            const last = lastPurchaseDate(row)
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{row.name}</p>
                    <p className="truncate font-mono text-xs text-ink-muted">{row.phone}</p>
                    {row.email && (
                      <p className="truncate text-xs text-ink-muted">{row.email}</p>
                    )}
                  </div>
                  <Badge tone="info">
                    <span className="font-mono tabular-nums">{row.loyaltyPoints ?? 0}</span> pts
                  </Badge>
                </div>

                <dl className="flex items-baseline justify-between gap-3">
                  <div>
                    <dt className="text-xs text-ink-muted">Total purchases</dt>
                    <dd className="font-mono text-sm tabular-nums text-ink">
                      {formatCurrency(row.totalPurchases)}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-ink-muted">Last purchase</dt>
                    <dd className="font-mono text-sm tabular-nums text-ink">
                      {last ? formatDate(last) : '—'}
                    </dd>
                  </div>
                </dl>

                <div
                  className="flex flex-wrap gap-2 border-t border-line pt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button variant="secondary" onClick={() => openDetail(row)}>
                    View details
                  </Button>
                  <Button variant="secondary" onClick={() => openEditForm(row)}>
                    Edit
                  </Button>
                </div>
              </div>
            )
          }}
        />

        {customers.length > pageSize && (
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={customers.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            itemLabel="customers"
            className="rounded-panel border border-line bg-surface"
          />
        )}
      </div>

      {/* Customer detail. While the edit drawer is open this panel steps aside,
          then returns with the refreshed record once the form closes. */}
      <Drawer
        open={detailCustomerId !== null && !showForm}
        onClose={closeDetail}
        title={detailCustomer?.name ?? 'Customer'}
        description={detailCustomer?.phone}
        size="lg"
        footer={
          detailCustomer ? (
            <Button
              onClick={() => {
                const customer = detailCustomer
                openEditForm(customer)
              }}
            >
              Edit customer
            </Button>
          ) : undefined
        }
      >
        {detailLoading && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-16 w-full rounded-panel" />
            <Skeleton className="h-40 w-full rounded-panel" />
            <SkeletonText lines={4} />
          </div>
        )}

        {!detailLoading && detailError && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
            {detailError}
          </p>
        )}

        {!detailLoading && !detailError && detailCustomer && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-panel border border-line bg-surface p-3">
                <p className="text-xs font-medium text-ink-muted">Loyalty points</p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-ink">
                  {detailCustomer.loyaltyPoints ?? 0}
                </p>
              </div>
              <div className="rounded-panel border border-line bg-surface p-3">
                <p className="text-xs font-medium text-ink-muted">Total purchases</p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-ink">
                  {formatCurrency(detailCustomer.totalPurchases)}
                </p>
              </div>
            </div>

            <Card title="Contact" padding="sm">
              <dl className="divide-y divide-line">
                <DetailRow
                  label="Phone"
                  value={<span className="font-mono">{detailCustomer.phone}</span>}
                />
                <DetailRow label="Email" value={detailCustomer.email || '—'} />
                <DetailRow label="Address" value={detailCustomer.address || '—'} />
                <DetailRow label="Customer since" value={formatDate(detailCustomer.createdAt)} />
              </dl>
            </Card>

            <Card title="Billing" padding="sm">
              <dl className="divide-y divide-line">
                <DetailRow label="Billing address" value={detailCustomer.billingAddress || '—'} />
                <DetailRow label="City" value={detailCustomer.city || '—'} />
                <DetailRow label="State" value={detailCustomer.state || '—'} />
                <DetailRow
                  label="PIN code"
                  value={
                    detailCustomer.pincode ? (
                      <span className="font-mono tabular-nums">{detailCustomer.pincode}</span>
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailRow
                  label="GSTIN"
                  value={
                    detailCustomer.gstin ? (
                      <span className="font-mono">{detailCustomer.gstin}</span>
                    ) : (
                      '—'
                    )
                  }
                />
              </dl>
            </Card>

            <Card title="Communication preferences" padding="sm">
              {detailCustomer.communicationPreferences &&
              detailCustomer.communicationPreferences.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detailCustomer.communicationPreferences.map((channel) => (
                    <Badge key={channel} tone="info">
                      {CHANNEL_LABELS[channel] ?? channel}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">No channels selected.</p>
              )}
            </Card>

            {detailCustomer.notes && (
              <Card title="Notes" padding="sm">
                <p className="text-sm text-ink-muted">{detailCustomer.notes}</p>
              </Card>
            )}

            <Card
              title="Purchase history"
              description={
                detailCustomer.purchases && detailCustomer.purchases.length > 0
                  ? `${detailCustomer.purchases.length} order${detailCustomer.purchases.length === 1 ? '' : 's'}`
                  : undefined
              }
              padding="none"
            >
              {detailCustomer.purchases && detailCustomer.purchases.length > 0 ? (
                <ul className="divide-y divide-line">
                  {detailCustomer.purchases.map((purchase, index) => (
                    <li
                      key={`${purchase.orderId}-${index}`}
                      className="flex items-baseline justify-between gap-4 px-4 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-ink">{formatDate(purchase.date)}</span>
                        <span className="block font-mono text-xs text-ink-muted">
                          Order {String(purchase.orderId).slice(-6)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
                        {formatCurrency(purchase.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-ink-muted">
                  No purchases recorded yet.
                </p>
              )}
            </Card>
          </div>
        )}
      </Drawer>

      {/* Add / edit customer */}
      <Drawer
        open={showForm}
        onClose={closeForm}
        title={editingCustomerId ? 'Edit customer' : 'Add customer'}
        description={
          editingCustomerId
            ? 'Update contact and billing details.'
            : 'Name and phone are enough to get started.'
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={isSubmittingForm}>
              Cancel
            </Button>
            <Button type="submit" form="customer-form" loading={isSubmittingForm}>
              {editingCustomerId ? 'Save changes' : 'Create customer'}
            </Button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleFormSubmit} className="flex flex-col gap-5" noValidate>
          <FormSection title="Basic information">
            <Field label="Name" required error={formErrors.name}>
              <Input
                value={formState.name}
                onChange={(event) => updateFormField('name', event.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field label="Phone" required error={formErrors.phone}>
              <Input
                type="tel"
                inputMode="tel"
                value={formState.phone}
                onChange={(event) => updateFormField('phone', event.target.value)}
                autoComplete="tel"
                className="font-mono"
              />
            </Field>
          </FormSection>

          <FormSection title="Contact">
            <Field label="Email" hint="Optional." error={formErrors.email}>
              <Input
                type="email"
                value={formState.email}
                onChange={(event) => updateFormField('email', event.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Address" hint="Optional.">
              <Input
                value={formState.address}
                onChange={(event) => updateFormField('address', event.target.value)}
                autoComplete="street-address"
              />
            </Field>
          </FormSection>

          <FormSection title="Billing">
            <Field label="Billing address" className="sm:col-span-2">
              <Input
                value={formState.billingAddress}
                onChange={(event) => updateFormField('billingAddress', event.target.value)}
              />
            </Field>
            <Field label="City">
              <Input
                value={formState.city}
                onChange={(event) => updateFormField('city', event.target.value)}
              />
            </Field>
            <Field label="State">
              <Input
                value={formState.state}
                onChange={(event) => updateFormField('state', event.target.value)}
              />
            </Field>
            <Field label="PIN code">
              <Input
                inputMode="numeric"
                value={formState.pincode}
                onChange={(event) => updateFormField('pincode', event.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="GSTIN" hint="Needed for a business invoice.">
              <Input
                value={formState.gstin}
                onChange={(event) => updateFormField('gstin', event.target.value)}
                className="font-mono"
              />
            </Field>
          </FormSection>

          <FormSection title="Preferences">
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm font-medium text-ink">
                How this customer wants to hear from you
              </legend>
              <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                {CHANNELS.map((channel) => (
                  <Checkbox
                    key={channel.value}
                    label={channel.label}
                    checked={formState.communicationPreferences.includes(channel.value)}
                    onChange={(event) => toggleChannel(channel.value, event.target.checked)}
                  />
                ))}
              </div>
            </fieldset>
          </FormSection>

          <FormSection title="Notes">
            <Field label="Notes" hint="Optional. Sizes, preferences, anything worth remembering." className="sm:col-span-2">
              <Textarea
                value={formState.notes}
                onChange={(event) => updateFormField('notes', event.target.value)}
                rows={3}
              />
            </Field>
          </FormSection>

          {formError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
        </form>
      </Drawer>
    </div>
  )
}

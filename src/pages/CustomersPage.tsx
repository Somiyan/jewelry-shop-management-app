import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createCustomer,
  listCustomers,
  updateCustomer,
  type CommunicationChannel,
  type Customer,
  type CustomerOutstandingFilter,
  type CustomerSort,
} from '../api/customers'
import {
  Badge,
  Button,
  Checkbox,
  type Column,
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
  Select,
  Textarea,
  UsersIcon,
  paginate,
  useToast,
} from '../components'
import { extractErrorMessage, formatCurrency, formatDate } from '../utils/format'
import { customerPaymentStatusTone } from '../utils/ui'

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

const OUTSTANDING_FILTERS: { value: '' | CustomerOutstandingFilter; label: string }[] = [
  { value: '', label: 'All customers' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'paid', label: 'Fully paid' },
]

const SORT_OPTIONS: { value: CustomerSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'highest-outstanding', label: 'Highest outstanding' },
  { value: 'lowest-outstanding', label: 'Lowest outstanding' },
  { value: 'highest-purchase', label: 'Highest purchase' },
  { value: 'recent-purchase', label: 'Recent purchase' },
]

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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/** Currency figure plus a spelled-out status — colour never carries the meaning alone. */
function OutstandingIndicator({ customer }: { customer: Customer }) {
  const pending = customer.pendingBalance ?? 0
  const credit = customer.creditBalance ?? 0
  const hasOutstanding = pending > 0
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-mono text-sm tabular-nums text-ink">{formatCurrency(pending)}</span>
      <Badge tone={hasOutstanding ? 'warning' : 'success'} dot>
        {hasOutstanding ? 'Outstanding' : 'No outstanding'}
      </Badge>
      {credit > 0 && (
        <span className="text-xs text-info">Credit {formatCurrency(credit)}</span>
      )}
    </div>
  )
}

export default function CustomersPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [outstandingFilter, setOutstandingFilter] = useState<'' | CustomerOutstandingFilter>('')
  const [sortBy, setSortBy] = useState<CustomerSort>('name')

  const [showForm, setShowForm] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [formState, setFormState] = useState<CustomerFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)

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
      const data = await listCustomers({
        q: debouncedQ,
        outstanding: outstandingFilter || undefined,
        sort: sortBy,
      })
      setCustomers(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [debouncedQ, outstandingFilter, sortBy])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, outstandingFilter, sortBy])

  // Deep link from elsewhere in the app: /customers?edit=<id> opens the edit drawer once loaded.
  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || isLoading) return
    const customer = customers.find((item) => item._id === editId)
    if (customer) {
      openEditForm(customer)
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
    }
  }, [customers, isLoading, searchParams, setSearchParams])

  const pagedCustomers = useMemo(
    () => paginate(customers, page, pageSize),
    [customers, page, pageSize],
  )

  function openDetail(customer: Customer) {
    navigate(`/customers/${customer._id}`)
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
        await updateCustomer(editingCustomerId, body)
      } else {
        await createCustomer(body)
      }
      closeForm()
      await fetchCustomers()
      toast.success(editingCustomerId ? 'Customer updated' : 'Customer added')
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
      key: 'totalInvoiced',
      header: 'Total purchases',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.totalInvoiced ?? row.totalPurchases ?? 0,
      render: (row) => (
        <span className="font-mono tabular-nums">
          {formatCurrency(row.totalInvoiced ?? row.totalPurchases)}
        </span>
      ),
    },
    {
      key: 'pendingBalance',
      header: 'Outstanding',
      align: 'right',
      width: '150px',
      sortable: true,
      sortValue: (row) => row.pendingBalance ?? 0,
      render: (row) => <OutstandingIndicator customer={row} />,
    },
    {
      key: 'lastInvoiceDate',
      header: 'Last purchase',
      align: 'right',
      sortable: true,
      sortValue: (row) => (row.lastInvoiceDate ? new Date(row.lastInvoiceDate) : null),
      render: (row) => (
        <span className="font-mono text-xs tabular-nums text-ink-muted">
          {row.lastInvoiceDate ? formatDate(row.lastInvoiceDate) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '160px',
      render: (row) => (
        <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => openDetail(row)}>
            View
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<EditIcon size={14} />} onClick={() => openEditForm(row)}>
            Edit
          </Button>
        </div>
      ),
    },
  ]

  const isFiltered = debouncedQ.trim() !== '' || outstandingFilter !== ''

  const emptyState = isFiltered ? (
    <EmptyState
      icon={<InboxIcon size={20} />}
      title="No customers match your filters"
      description="Try a different name or phone number, or clear the filters to see everyone."
      action={
        <Button
          variant="secondary"
          onClick={() => {
            setQ('')
            setOutstandingFilter('')
          }}
        >
          Clear filters
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
        description="Contacts, billing details, loyalty points and outstanding balances."
        actions={
          <Button leftIcon={<PlusIcon size={16} />} onClick={openAddForm}>
            Add customer
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={q}
          onValueChange={setQ}
          placeholder="Search by name or phone"
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            aria-label="Filter by outstanding balance"
            value={outstandingFilter}
            onChange={(event) => setOutstandingFilter(event.target.value as '' | CustomerOutstandingFilter)}
            options={OUTSTANDING_FILTERS}
            className="sm:w-44"
          />
          <Select
            aria-label="Sort customers"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as CustomerSort)}
            options={SORT_OPTIONS.map((option) => ({ ...option, label: `Sort: ${option.label}` }))}
            className="sm:w-52"
          />
        </div>
      </div>

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
            const hasOutstanding = (row.pendingBalance ?? 0) > 0
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

                <dl className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Purchases</dt>
                    <dd className="font-mono text-sm tabular-nums text-ink">
                      {formatCurrency(row.totalInvoiced ?? row.totalPurchases)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Paid</dt>
                    <dd className="font-mono text-sm tabular-nums text-ink">
                      {formatCurrency(row.totalPaid ?? 0)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-ink-muted">Outstanding</dt>
                    <dd className="font-mono text-sm tabular-nums text-ink">
                      {formatCurrency(row.pendingBalance ?? 0)}
                    </dd>
                  </div>
                </dl>

                <Badge tone={customerPaymentStatusTone(row.paymentStatus)} dot className="w-fit">
                  {hasOutstanding ? 'Outstanding' : row.paymentStatus === 'no-invoices' ? 'No invoices' : 'No outstanding'}
                </Badge>

                <div
                  className="flex flex-wrap gap-2 border-t border-line pt-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button variant="secondary" onClick={() => openDetail(row)}>
                    View history
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

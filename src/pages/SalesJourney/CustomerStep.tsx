import { type Dispatch, type FormEvent, useEffect, useState } from 'react'
import { apiClient } from '../../api/client'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Drawer,
  EmptyState,
  Field,
  Input,
  PlusIcon,
  SearchInput,
  Skeleton,
  Textarea,
  UsersIcon,
  useToast,
} from '../../components'
import { extractErrorMessage } from '../../utils/format'
import ActionBar from './ActionBar'
import type { Action, WizardState } from './state'
import TabToggle from './TabToggle'
import type { CommPref, Customer } from './types'

const NEW_CUSTOMER_FORM_ID = 'new-customer-form'

interface NewCustomerForm {
  name: string
  phone: string
  email: string
  address: string
  notes: string
  billingAddress: string
  city: string
  state: string
  pincode: string
  gstin: string
  communicationPreferences: CommPref[]
}

const emptyForm: NewCustomerForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  billingAddress: '',
  city: '',
  state: '',
  pincode: '',
  gstin: '',
  communicationPreferences: [],
}

const COMM_PREFS: { value: CommPref; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

interface Props {
  state: WizardState
  dispatch: Dispatch<Action>
  onContinue: () => void
  onBack: () => void
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h3 className="border-b border-line pb-2 text-sm font-semibold text-ink sm:col-span-2">
      {children}
    </h3>
  )
}

export default function CustomerStep({ state, dispatch, onContinue, onBack }: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<'existing' | 'new'>('existing')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [form, setForm] = useState<NewCustomerForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsSearching(true)
    const handle = setTimeout(() => {
      apiClient
        .get<Customer[]>('/customers', { params: q.trim() ? { q: q.trim() } : {} })
        .then(({ data }) => {
          if (cancelled) return
          setResults(data)
          setSearchError(null)
        })
        .catch((err: unknown) => {
          if (!cancelled) setSearchError(extractErrorMessage(err))
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [q])

  function updateField<K extends keyof NewCustomerForm>(key: K, value: NewCustomerForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleFormCommPref(pref: CommPref) {
    setForm((prev) => ({
      ...prev,
      communicationPreferences: prev.communicationPreferences.includes(pref)
        ? prev.communicationPreferences.filter((p) => p !== pref)
        : [...prev.communicationPreferences, pref],
    }))
  }

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setIsSubmitting(true)
    try {
      const body = {
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        billingAddress: form.billingAddress || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        gstin: form.gstin || undefined,
        communicationPreferences: form.communicationPreferences.length
          ? form.communicationPreferences
          : undefined,
      }
      const { data } = await apiClient.post<Customer>('/customers', body)
      dispatch({ type: 'SET_CUSTOMER', customer: data })
      setForm(emptyForm)
      setTab('existing')
      toast.success(`${data.name} added and selected for this sale`)
    } catch (err) {
      const message = extractErrorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const customer = state.customer

  if (customer) {
    return (
      <div className="space-y-4">
        <Card
          title="Selected customer"
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => dispatch({ type: 'CHANGE_CUSTOMER' })}
            >
              Change customer
            </Button>
          }
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-ink">{customer.name}</p>
              <p className="mt-0.5 font-mono text-sm text-ink-muted">{customer.phone}</p>
              {customer.email && <p className="text-sm text-ink-muted">{customer.email}</p>}
              {(customer.billingAddress || customer.address) && (
                <p className="mt-1 max-w-prose text-sm text-ink-muted">
                  {customer.billingAddress || customer.address}
                </p>
              )}
              {customer.gstin && (
                <p className="mt-1 text-xs text-ink-muted">
                  GSTIN <span className="font-mono">{customer.gstin}</span>
                </p>
              )}
            </div>
            <Badge tone="info">
              <span className="font-mono">{customer.loyaltyPoints ?? 0}</span> loyalty points
            </Badge>
          </div>
        </Card>

        <ActionBar
          back={{ label: 'Back', onClick: onBack }}
          primary={{ label: 'Continue to billing', onClick: onContinue }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <TabToggle
        label="Customer source"
        value={tab}
        onChange={(value) => {
          setTab(value)
          if (value === 'existing') setFormError(null)
        }}
        options={[
          { value: 'existing', label: 'Existing customer' },
          { value: 'new', label: 'New customer' },
        ]}
      />

      <Card padding="none">
        <div className="border-b border-line p-3 sm:p-4">
          <SearchInput
            value={q}
            onValueChange={setQ}
            placeholder="Search by name or phone"
            aria-label="Search customers"
            autoFocus
          />
          {searchError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {searchError}
            </p>
          )}
        </div>

        <div className="max-h-[26rem] overflow-y-auto">
          {isSearching && results.length === 0 ? (
            <ul className="divide-y divide-line">
              {[0, 1, 2, 3].map((row) => (
                <li key={row} className="flex items-center justify-between gap-4 px-3 py-3.5 sm:px-4">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-24" />
                </li>
              ))}
            </ul>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<UsersIcon size={20} />}
              title="No customers match that search"
              description="Check the spelling or the phone number — or add them as a new customer."
              action={
                <Button
                  variant="secondary"
                  leftIcon={<PlusIcon size={16} />}
                  onClick={() => setTab('new')}
                >
                  New customer
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {results.map((result) => (
                <li key={result._id}>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'SET_CUSTOMER', customer: result })
                      toast.success(`${result.name} selected for this sale`)
                    }}
                    aria-label={`Select ${result.name}`}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-sunken sm:px-4"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {result.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {result.email ?? result.city ?? result.address ?? 'No email on record'}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-sm text-ink">{result.phone}</span>
                      <span className="text-xs text-ink-muted">
                        <span className="font-mono">{result.loyaltyPoints ?? 0}</span> points
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <ActionBar
        back={{ label: 'Back', onClick: onBack }}
        primary={{
          label: 'Continue to billing',
          onClick: onContinue,
          disabled: true,
        }}
        message={
          <p className="text-xs text-ink-muted">
            Pick a customer to continue. Every sale is billed to a customer record.
          </p>
        }
      />

      <Drawer
        open={tab === 'new'}
        onClose={() => setTab('existing')}
        title="New customer"
        description="Saved to the customer book, then selected for this sale."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setTab('existing')}>
              Cancel
            </Button>
            <Button type="submit" form={NEW_CUSTOMER_FORM_ID} loading={isSubmitting}>
              Create customer
            </Button>
          </>
        }
      >
        <form
          id={NEW_CUSTOMER_FORM_ID}
          onSubmit={handleCreateCustomer}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          noValidate
        >
          <SectionHeading>Basic</SectionHeading>
          <Field label="Name" required>
            <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
          </Field>
          <Field label="Phone" required>
            <Input
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              className="font-mono"
            />
          </Field>

          <SectionHeading>Contact</SectionHeading>
          <Field label="Email" hint="Optional.">
            <Input
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </Field>
          <Field label="Address" hint="Optional.">
            <Input
              value={form.address}
              onChange={(event) => updateField('address', event.target.value)}
            />
          </Field>

          <SectionHeading>Billing</SectionHeading>
          <Field
            label="Billing address"
            hint="Optional. Used on invoices when it differs from the address."
            className="sm:col-span-2"
          >
            <Input
              value={form.billingAddress}
              onChange={(event) => updateField('billingAddress', event.target.value)}
            />
          </Field>
          <Field label="City" hint="Optional.">
            <Input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
          </Field>
          <Field label="State" hint="Optional.">
            <Input
              value={form.state}
              onChange={(event) => updateField('state', event.target.value)}
            />
          </Field>
          <Field label="Pincode" hint="Optional.">
            <Input
              inputMode="numeric"
              value={form.pincode}
              onChange={(event) => updateField('pincode', event.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="GSTIN" hint="Optional. Required for a business invoice.">
            <Input
              value={form.gstin}
              onChange={(event) => updateField('gstin', event.target.value)}
              className="font-mono uppercase"
            />
          </Field>

          <SectionHeading>Preferences</SectionHeading>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-ink">Communication preferences</legend>
            <p className="mt-0.5 text-xs text-ink-muted">
              How this customer prefers to receive invoices and updates. Optional.
            </p>
            <div className="mt-1 flex flex-wrap gap-x-6">
              {COMM_PREFS.map((pref) => (
                <Checkbox
                  key={pref.value}
                  label={pref.label}
                  checked={form.communicationPreferences.includes(pref.value)}
                  onChange={() => toggleFormCommPref(pref.value)}
                />
              ))}
            </div>
          </fieldset>
          <Field label="Notes" hint="Optional." className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
            />
          </Field>

          {formError && (
            <p
              role="alert"
              className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger sm:col-span-2"
            >
              {formError}
            </p>
          )}
        </form>
      </Drawer>
    </div>
  )
}

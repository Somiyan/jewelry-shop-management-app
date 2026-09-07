import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '../api/client'
import { useAuth } from '../auth'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Textarea,
  DataTable,
  useToast,
  type Column,
} from '../components'
import { AlertIcon, EditIcon, InboxIcon, PlusIcon, TagIcon } from '../components/icons'
import { extractErrorMessage, formatDate } from '../utils/format'

/* ---------------------------------------------------------------- types --- */

interface Category {
  _id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
}

interface CategoryFormState {
  name: string
  description: string
}

type CategoryFormErrors = Partial<Record<keyof CategoryFormState, string>>

const emptyForm: CategoryFormState = { name: '', description: '' }

function categoryToForm(category: Category): CategoryFormState {
  return { name: category.name, description: category.description ?? '' }
}

function validateForm(form: CategoryFormState): CategoryFormErrors {
  const errors: CategoryFormErrors = {}
  if (!form.name.trim()) errors.name = 'Enter a category name.'
  return errors
}

/* ---------------------------------------------------------------- page --- */

export default function CategoryMasterPage() {
  const { hasRole } = useAuth()
  const toast = useToast()
  const allowed = hasRole('admin', 'manager')

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [q, setQ] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<CategoryFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const { data } = await apiClient.get<Category[]>('/categories')
      setCategories(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) void fetchCategories()
  }, [allowed, fetchCategories])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return categories
    return categories.filter(
      (category) =>
        category.name.toLowerCase().includes(term) ||
        (category.description ?? '').toLowerCase().includes(term),
    )
  }, [categories, q])

  function openAddForm() {
    setEditingId(null)
    setFormState(emptyForm)
    setFormErrors({})
    setFormError(null)
    setShowForm(true)
  }

  function openEditForm(category: Category) {
    setEditingId(category._id)
    setFormState(categoryToForm(category))
    setFormErrors({})
    setFormError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setFormState(emptyForm)
    setFormErrors({})
    setFormError(null)
  }

  function updateField<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setFormState((prev) => ({ ...prev, [key]: value }))
    setFormErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const errors = validateForm(formState)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const body = {
        name: formState.name.trim(),
        description: formState.description.trim() || undefined,
      }
      if (editingId) {
        await apiClient.put(`/categories/${editingId}`, body)
      } else {
        await apiClient.post('/categories', body)
      }
      const wasEditing = Boolean(editingId)
      closeForm()
      await fetchCategories()
      toast.success(wasEditing ? 'Category updated' : 'Category created')
    } catch (err) {
      const message = extractErrorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleActive(category: Category) {
    setTogglingId(category._id)
    try {
      await apiClient.put(`/categories/${category._id}`, { isActive: !category.isActive })
      await fetchCategories()
      toast.success(category.isActive ? 'Category deactivated' : 'Category activated')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setTogglingId(null)
    }
  }

  if (!allowed) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Categories" />
        <EmptyState
          icon={<AlertIcon size={20} />}
          title="You don't have access to this page"
          description="Category management is limited to admin and manager accounts."
        />
      </div>
    )
  }

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => <span className="font-medium text-ink">{row.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-ink-muted">{row.description || '—'}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (row) => (
        <Badge tone={row.isActive ? 'success' : 'neutral'} dot>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.createdAt,
      render: (row) => <span className="font-mono text-xs text-ink-muted">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '210px',
      render: (row) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            loading={togglingId === row._id}
            onClick={() => handleToggleActive(row)}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <IconButton label={`Edit ${row.name}`} size="sm" onClick={() => openEditForm(row)}>
            <EditIcon size={16} />
          </IconButton>
        </div>
      ),
    },
  ]

  const emptyState = q.trim() ? (
    <EmptyState
      icon={<InboxIcon size={20} />}
      title="No categories match this search"
      description="Try a different search term, or clear it to see all categories."
      action={
        <Button variant="secondary" onClick={() => setQ('')}>
          Clear search
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<TagIcon size={20} />}
      title="No categories yet"
      description="Add a category to start organising products."
      action={
        <Button leftIcon={<PlusIcon size={16} />} onClick={openAddForm}>
          Add category
        </Button>
      }
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Categories"
        description="Product categories used across stock and the sales journey."
        actions={
          <Button leftIcon={<PlusIcon size={16} />} onClick={openAddForm}>
            Add category
          </Button>
        }
      />

      <SearchInput
        value={q}
        onValueChange={setQ}
        placeholder="Search categories"
        className="max-w-sm"
      />

      {loadError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(row) => row._id}
        isLoading={isLoading}
        emptyState={emptyState}
        initialSort={{ key: 'name', direction: 'asc' }}
        caption="Product categories"
        renderMobileCard={(row) => (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{row.name}</p>
                <p className="truncate text-xs text-ink-muted">{row.description || 'No description'}</p>
              </div>
              <Badge tone={row.isActive ? 'success' : 'neutral'} dot>
                {row.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <p className="text-xs text-ink-muted">Created {formatDate(row.createdAt)}</p>

            <div
              className="flex flex-wrap gap-2 border-t border-line pt-3"
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                variant="secondary"
                loading={togglingId === row._id}
                onClick={() => handleToggleActive(row)}
              >
                {row.isActive ? 'Deactivate' : 'Activate'}
              </Button>
              <Button variant="secondary" onClick={() => openEditForm(row)}>
                Edit
              </Button>
            </div>
          </div>
        )}
      />

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingId ? 'Edit category' : 'Add category'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" loading={isSubmitting}>
              {editingId ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <form id="category-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {formError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}
          <Field label="Name" required error={formErrors.name}>
            <Input
              value={formState.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="e.g. Rings"
              autoFocus
            />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea
              value={formState.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="What this category is for"
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}

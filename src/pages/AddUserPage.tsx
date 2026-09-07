import axios from 'axios'
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useAuth } from '../auth'
import type { Role } from '../auth'
import {
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SearchInput,
  Select,
  type BadgeTone,
  type Column,
  useToast,
} from '../components'
import { AlertIcon, PlusIcon, UsersIcon } from '../components/icons'
import { extractErrorMessage, formatDate } from '../utils/format'

interface StaffMember {
  _id: string
  username: string
  email: string
  role: Role
  permissions?: string[]
  createdAt?: string
}

interface FormErrors {
  username?: string
  email?: string
  password?: string
}

const roleOptions = [
  { value: 'staff', label: 'Staff' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
]

const roleTones: Record<Role, BadgeTone> = {
  admin: 'info',
  manager: 'warning',
  staff: 'neutral',
}

function roleLabel(role: Role): string {
  return roleOptions.find((option) => option.value === role)?.label ?? role
}

/* ------------------------------------------------------- the shared form --- */

interface StaffFormProps {
  /** Called after a successful create so the caller can toast/close/refresh. */
  onCreated: (username: string) => void
  /** Rendered at the end of the form. Omit to get a plain full-width submit button. */
  actions?: (state: { submitting: boolean }) => ReactNode
  submitLabel?: string
  /** Set when the submit control lives outside the form (a drawer footer). */
  formId?: string
  /** Mirrors the in-flight state so an external submit button can show it. */
  onSubmittingChange?: (submitting: boolean) => void
}

function StaffForm({
  onCreated,
  actions,
  submitLabel = 'Create account',
  formId,
  onSubmittingChange,
}: StaffFormProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function validate(): boolean {
    const next: FormErrors = {}
    if (!username.trim()) next.username = 'Enter a username.'
    if (!email.trim()) next.email = 'Enter an email address.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Enter a password.'
    else if (password.length < 6) next.password = 'Use at least 6 characters.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  useEffect(() => {
    onSubmittingChange?.(submitting)
  }, [submitting, onSubmittingChange])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      await apiClient.post('/users', {
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      })
      const created = username.trim()
      setUsername('')
      setEmail('')
      setPassword('')
      setRole('staff')
      setErrors({})
      onCreated(created)
    } catch (err) {
      setFormError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id={formId} className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <Field label="Username" required error={errors.username}>
        <Input
          name="username"
          type="text"
          autoComplete="off"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="jane.doe"
        />
      </Field>

      <Field label="Email" required error={errors.email}>
        <Input
          name="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="jane.doe@example.com"
        />
      </Field>

      <Field
        label="Password"
        required
        error={errors.password}
        hint="At least 6 characters. The member can change it later."
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </Field>

      <Field label="Role" hint="Admins can manage staff and pricing; managers cannot add staff.">
        <Select
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          options={roleOptions}
        />
      </Field>

      {formError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          {formError}
        </p>
      )}

      {actions ? (
        actions({ submitting })
      ) : (
        <Button type="submit" loading={submitting} fullWidth>
          {submitLabel}
        </Button>
      )}
    </form>
  )
}

/* ------------------------------------------------------------------ page --- */

export default function AddUserPage() {
  const { isAuthenticated } = useAuth()
  const toast = useToast()

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(isAuthenticated)
  const [loadFailed, setLoadFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const { data } = await apiClient.get<StaffMember[]>('/users')
      setStaff(Array.isArray(data) ? data : [])
    } catch (err) {
      // A 401 here is the unauthenticated bootstrap path, not an error worth showing.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status !== 401) setLoadFailed(true)
      setStaff([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) void loadStaff()
  }, [isAuthenticated, loadStaff])

  /* --- Bootstrap path: no session yet, so only the create form is shown. --- */
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink">
              Create a staff account
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              Set up the first admin to start using the shop.
            </p>
          </div>

          <div className="rounded-panel border border-line bg-surface p-5 sm:p-6">
            <StaffForm
              submitLabel="Create account"
              onCreated={(username) => toast.success(`Account "${username}" created.`)}
            />
          </div>

          <p className="mt-5 text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  /* --- Signed in: the full staff management page inside the app shell. --- */

  const needle = query.trim().toLowerCase()
  const rows = needle
    ? staff.filter(
        (member) =>
          member.username.toLowerCase().includes(needle) ||
          member.email.toLowerCase().includes(needle) ||
          member.role.toLowerCase().includes(needle),
      )
    : staff

  const columns: Column<StaffMember>[] = [
    {
      key: 'username',
      header: 'Username',
      sortable: true,
      render: (member) => <span className="font-medium text-ink">{member.username}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (member) => <span className="text-ink-muted">{member.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      width: '140px',
      render: (member) => <Badge tone={roleTones[member.role] ?? 'neutral'}>{roleLabel(member.role)}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Added',
      align: 'right',
      sortable: true,
      width: '140px',
      sortValue: (member) => (member.createdAt ? new Date(member.createdAt) : null),
      render: (member) => (
        <span className="font-mono text-ink-muted">{formatDate(member.createdAt)}</span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Staff accounts and the roles they sign in with."
        actions={
          <Button leftIcon={<PlusIcon size={16} />} onClick={() => setDrawerOpen(true)}>
            Add staff
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <SearchInput
          className="sm:max-w-xs"
          value={query}
          onValueChange={setQuery}
          placeholder="Search staff"
        />

        {loadFailed ? (
          <div className="rounded-panel border border-line bg-surface">
            <EmptyState
              icon={<AlertIcon size={20} />}
              title="Unable to load staff"
              description="Check your connection and try again."
              action={
                <Button variant="secondary" onClick={() => void loadStaff()}>
                  Try again
                </Button>
              }
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(member) => member._id}
            isLoading={loading}
            caption="Staff accounts"
            initialSort={{ key: 'createdAt', direction: 'desc' }}
            emptyState={
              <EmptyState
                icon={<UsersIcon size={20} />}
                title={needle ? 'No staff match that search' : 'No staff accounts yet'}
                description={
                  needle
                    ? 'Try a different name, email or role.'
                    : 'Add an account for everyone who works the counter.'
                }
                action={
                  needle ? undefined : (
                    <Button leftIcon={<PlusIcon size={16} />} onClick={() => setDrawerOpen(true)}>
                      Add staff
                    </Button>
                  )
                }
              />
            }
            renderMobileCard={(member) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{member.username}</p>
                    <p className="truncate text-xs text-ink-muted">{member.email}</p>
                  </div>
                  <Badge tone={roleTones[member.role] ?? 'neutral'}>{roleLabel(member.role)}</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  Added <span className="font-mono">{formatDate(member.createdAt)}</span>
                </p>
              </div>
            )}
          />
        )}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Add staff"
        description="They can sign in as soon as the account exists."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)} fullWidth>
              Cancel
            </Button>
            <Button type="submit" form="add-staff-form" loading={creating} fullWidth>
              Add staff
            </Button>
          </div>
        }
      >
        <StaffForm
          formId="add-staff-form"
          actions={() => null}
          onSubmittingChange={setCreating}
          onCreated={(username) => {
            toast.success(`Staff account "${username}" added.`)
            setCreating(false)
            setDrawerOpen(false)
            void loadStaff()
          }}
        />
      </Drawer>
    </div>
  )
}

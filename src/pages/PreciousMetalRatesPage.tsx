import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../api/client'
import { useAuth } from '../auth'
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  MetalSwatch,
  Modal,
  PageHeader,
  Skeleton,
  Textarea,
  useToast,
} from '../components'
import { AlertIcon, ReceiptIcon } from '../components/icons'
import { extractErrorMessage } from '../utils/format'

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

interface CurrentRates {
  gold: RateDoc | null
  silver: RateDoc | null
}

/* ------------------------------------------------------------- helpers --- */

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "4 minutes ago" / "2 days ago" from an ISO timestamp — local copy, see DashboardPage. */
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

function formatRatePerGram(rate: number): string {
  return `${new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(rate)} / gram`
}

function updatedByName(updatedBy: RateDoc['updatedBy'] | undefined): string {
  if (!updatedBy) return 'unknown'
  return typeof updatedBy === 'string' ? updatedBy : updatedBy.username
}

const metalLabel: Record<MetalType, string> = { gold: 'Gold', silver: 'Silver' }

/* -------------------------------------------------------------- rate card --- */

interface RateCardProps {
  metal: MetalType
  current: RateDoc | null
  isLoading: boolean
  onEdit: () => void
}

function RateCard({ metal, current, isLoading, onEdit }: RateCardProps) {
  return (
    <Card
      title={<MetalSwatch metal={metal} label={metalLabel[metal]} className="text-base font-semibold" />}
      actions={
        <Button size="sm" variant="secondary" onClick={onEdit}>
          {current ? 'Edit rate' : 'Set rate'}
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-9 w-40" />
      ) : current ? (
        <div>
          <p className="font-mono text-2xl font-semibold tracking-tight text-ink">
            {formatRatePerGram(current.ratePerGram)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Updated {relativeTime(current.effectiveAt)} by {updatedByName(current.updatedBy)}
          </p>
        </div>
      ) : (
        <EmptyState
          icon={<AlertIcon size={20} />}
          title="No rate configured"
          description={`Set a starting rate for ${metalLabel[metal].toLowerCase()} to price products in this metal.`}
        />
      )}
    </Card>
  )
}

/* ---------------------------------------------------------------- page --- */

export default function PreciousMetalRatesPage() {
  const { hasRole } = useAuth()
  const toast = useToast()
  const allowed = hasRole('admin', 'manager')

  const [rates, setRates] = useState<CurrentRates | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [editingMetal, setEditingMetal] = useState<MetalType | null>(null)
  const [newRate, setNewRate] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchRates = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const { data } = await apiClient.get<CurrentRates>('/precious-metal-rates/current')
      setRates(data)
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (allowed) void fetchRates()
  }, [allowed, fetchRates])

  function openEdit(metal: MetalType, current: RateDoc | null) {
    setEditingMetal(metal)
    setNewRate(current ? String(current.ratePerGram) : '')
    setReason('')
    setFormError(null)
  }

  function closeEdit() {
    setEditingMetal(null)
    setNewRate('')
    setReason('')
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingMetal) return
    setFormError(null)

    const rateValue = Number(newRate)
    if (newRate.trim() === '' || !Number.isFinite(rateValue) || rateValue <= 0) {
      setFormError('Enter a rate greater than zero.')
      return
    }
    if (!reason.trim()) {
      setFormError('Enter a reason for this rate change.')
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.post('/precious-metal-rates', {
        metalType: editingMetal,
        ratePerGram: rateValue,
        reason: reason.trim(),
      })
      closeEdit()
      await fetchRates()
      toast.success(`${metalLabel[editingMetal]} rate updated`)
    } catch (err) {
      const message = extractErrorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!allowed) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title="Metal rates" />
        <EmptyState
          icon={<AlertIcon size={20} />}
          title="You don't have access to this page"
          description="Precious metal rates are managed by admin and manager accounts."
        />
      </div>
    )
  }

  const editingCurrent =
    editingMetal === 'gold' ? rates?.gold ?? null : editingMetal === 'silver' ? rates?.silver ?? null : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Metal rates"
        description="Every update creates a new, dated rate record — rates are never edited in place."
        actions={
          <Link to="/metal-rates/history" className="text-sm font-medium text-accent hover:underline">
            View rate history
          </Link>
        }
      />

      {loadError && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RateCard
          metal="gold"
          current={rates?.gold ?? null}
          isLoading={isLoading}
          onEdit={() => openEdit('gold', rates?.gold ?? null)}
        />
        <RateCard
          metal="silver"
          current={rates?.silver ?? null}
          isLoading={isLoading}
          onEdit={() => openEdit('silver', rates?.silver ?? null)}
        />
      </div>

      <Modal
        open={editingMetal !== null}
        onClose={closeEdit}
        title={editingMetal ? `${editingCurrent ? 'Edit' : 'Set'} ${metalLabel[editingMetal].toLowerCase()} rate` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="rate-form" loading={isSubmitting} leftIcon={<ReceiptIcon size={16} />}>
              Update rate
            </Button>
          </>
        }
      >
        <form id="rate-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {formError && (
            <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          )}

          {editingCurrent && (
            <p className="text-sm text-ink-muted">
              Current rate{' '}
              <span className="font-mono text-ink">{formatRatePerGram(editingCurrent.ratePerGram)}</span>
            </p>
          )}

          <Field label="New rate per gram" required>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={newRate}
              onChange={(event) => setNewRate(event.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </Field>

          <Field label="Reason" required hint="Recorded permanently with this rate for the audit trail.">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Daily market update"
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}

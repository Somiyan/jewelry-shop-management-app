import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createRate,
  fetchAndStore,
  formatRate,
  getCurrentRates,
  getLiveRates,
  metalLabel,
  updateRate,
  updatedByName,
  type CurrentRatesResponse,
  type LiveRatesResponse,
  type MetalType,
  type RateDoc,
} from '../api/rates'
import { useAuth } from '../auth'
import {
  Badge,
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
import { AlertIcon, InfoIcon, TrendUpIcon } from '../components/icons'
import { cx } from '../utils/cx'
import { extractErrorMessage, formatDateTime, relativeTime } from '../utils/format'
import { rateSourceLabel, rateStatusLabelText, rateStatusTone } from '../utils/ui'

/* ------------------------------------------------------------- notices --- */

interface NoticeProps {
  tone: 'info' | 'warning' | 'danger'
  title?: string
  children: ReactNode
  /** `alert` for failures, `status` for progress and outcomes. */
  role?: 'alert' | 'status'
}

const noticeTones = {
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
} as const

/** Inline message strip. Colour never carries the meaning — the icon and words do. */
function Notice({ tone, title, children, role }: NoticeProps) {
  return (
    <div
      role={role}
      className={cx('flex items-start gap-2 rounded-control px-3 py-2 text-sm', noticeTones[tone])}
    >
      {tone === 'info' ? (
        <InfoIcon size={16} className="mt-0.5 shrink-0" />
      ) : (
        <AlertIcon size={16} className="mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        <div className={title ? 'mt-0.5' : undefined}>{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ rate card --- */

interface StoredRateCardProps {
  metal: MetalType
  rate: RateDoc | null
  isLoading: boolean
  canEdit: boolean
  onEdit: () => void
}

/** One metal's stored rate: the figure the shop is trading on, and its provenance. */
function StoredRateCard({ metal, rate, isLoading, canEdit, onEdit }: StoredRateCardProps) {
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <MetalSwatch metal={metal} label={metalLabel[metal]} className="text-base font-semibold" />
          {rate && (
            <Badge tone={rateStatusTone(rate.statusLabel)} dot>
              {rateStatusLabelText(rate.statusLabel)}
            </Badge>
          )}
        </span>
      }
      actions={
        canEdit && rate ? (
          <Button size="sm" variant="secondary" onClick={onEdit}>
            Edit rate
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : rate ? (
        <div className="flex flex-col gap-4">
          <p>
            <span className="font-mono text-2xl font-semibold tracking-tight text-ink">
              {formatRate(rate.ratePerGram)}
            </span>
            <span className="ml-1.5 text-sm text-ink-muted">per gram</span>
          </p>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Unit</dt>
              <dd className="text-sm text-ink">1 gram · {rate.currency}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Last updated</dt>
              <dd className="text-sm text-ink">
                {relativeTime(rate.effectiveAt)}
                <span className="block text-xs text-ink-muted">
                  {formatDateTime(rate.effectiveAt)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Source</dt>
              <dd className="text-sm text-ink">{rateSourceLabel(rate.sourceType)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Updated by</dt>
              <dd className="text-sm text-ink">{updatedByName(rate.updatedBy)}</dd>
            </div>
          </dl>

          {rate.reason && <p className="text-xs text-ink-muted">Reason: {rate.reason}</p>}
        </div>
      ) : (
        <EmptyState
          icon={<AlertIcon size={20} />}
          title="No rate recorded"
          description={`Set a starting rate for ${metalLabel[metal].toLowerCase()} so products in this metal can be priced.`}
          action={
            canEdit ? (
              <Button size="sm" onClick={onEdit}>
                Set rate
              </Button>
            ) : undefined
          }
        />
      )}
    </Card>
  )
}

/* ------------------------------------------------------- live preview --- */

interface PreviewRowProps {
  metal: MetalType
  liveRate: number | null
  storedRate: number | null
}

function PreviewRow({ metal, liveRate, storedRate }: PreviewRowProps) {
  const change = liveRate !== null && storedRate !== null ? liveRate - storedRate : null

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
      <MetalSwatch metal={metal} label={metalLabel[metal]} />
      {liveRate === null ? (
        <span className="text-sm text-ink-muted">Not quoted</span>
      ) : (
        <span className="text-right">
          <span className="block font-mono text-base font-semibold text-ink">
            {formatRate(liveRate)}
            <span className="text-sm font-normal text-ink-muted"> / g</span>
          </span>
          {storedRate !== null && (
            <span className="block text-xs text-ink-muted">
              stored <span className="font-mono">{formatRate(storedRate)}</span>
              {change !== null && change !== 0 && (
                <span className={change > 0 ? 'text-success' : 'text-danger'}>
                  {' '}
                  {change > 0 ? '+' : '−'}
                  <span className="font-mono">{formatRate(Math.abs(change))}</span>
                </span>
              )}
              {change === 0 && <span> · unchanged</span>}
            </span>
          )}
        </span>
      )}
    </li>
  )
}

/* ---------------------------------------------------------------- page --- */

type FetchPhase = 'idle' | 'fetching' | 'saving'

export default function PreciousMetalRatesPage() {
  const { hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('admin', 'manager')

  const [current, setCurrent] = useState<CurrentRatesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [preview, setPreview] = useState<LiveRatesResponse | null>(null)
  const [phase, setPhase] = useState<FetchPhase>('idle')
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [outcome, setOutcome] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  const [editingMetal, setEditingMetal] = useState<MetalType | null>(null)
  const [newRate, setNewRate] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const loadCurrent = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      setCurrent(await getCurrentRates())
    } catch (err) {
      setLoadError(extractErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCurrent()
  }, [loadCurrent])

  const gold = current?.gold ?? null
  const silver = current?.silver ?? null
  const liveRatesAvailable = current?.liveRatesAvailable ?? false

  /* ---- live rate: preview first, store only on confirmation ------------- */

  async function handleFetchLive() {
    setPhase('fetching')
    setFetchError(null)
    setOutcome(null)
    setStatusMessage('Fetching the live market rate.')
    try {
      const data = await getLiveRates()
      setPreview(data)
      setWarnings(data.warnings ?? [])
      setStatusMessage('Live market rate fetched. Review it, then store it.')
    } catch (err) {
      setPreview(null)
      setWarnings([])
      setFetchError(extractErrorMessage(err))
      setStatusMessage('Could not reach the rate provider. The stored rate is unchanged.')
    } finally {
      setPhase('idle')
    }
  }

  async function handleUseAndStore() {
    setPhase('saving')
    setFetchError(null)
    setStatusMessage('Storing the live rate.')
    try {
      const result = await fetchAndStore({ reason: 'Live rate reviewed and stored' })
      setCurrent((existing) => ({
        gold: result.current.gold,
        silver: result.current.silver,
        liveRatesAvailable: existing?.liveRatesAvailable ?? true,
      }))
      setWarnings(result.warnings ?? [])
      setPreview(null)

      const storedMetals = result.stored.map((doc) => metalLabel[doc.metalType].toLowerCase())
      const skippedMetals = result.skipped.map((item) => metalLabel[item.metalType].toLowerCase())

      if (storedMetals.length > 0) {
        const message = `Stored the live rate for ${storedMetals.join(' and ')}.`
        toast.success(message)
        setOutcome(
          skippedMetals.length > 0
            ? `${message} No change since the last update for ${skippedMetals.join(' and ')}.`
            : message,
        )
        setStatusMessage(message)
      } else {
        const message =
          skippedMetals.length > 0
            ? `No change since the last update for ${skippedMetals.join(' and ')}. The stored rate stays as it is.`
            : 'The provider returned no new rate. The stored rate stays as it is.'
        toast.info(message)
        setOutcome(message)
        setStatusMessage(message)
      }
    } catch (err) {
      const message = extractErrorMessage(err)
      setFetchError(message)
      setStatusMessage('Could not store the live rate. The stored rate is unchanged.')
      toast.error(message)
    } finally {
      setPhase('idle')
    }
  }

  function cancelPreview() {
    setPreview(null)
    setWarnings([])
    setStatusMessage('Live rate discarded. The stored rate is unchanged.')
  }

  /* ---- manual edit: appends a corrected record -------------------------- */

  function openEdit(metal: MetalType) {
    const rate = metal === 'gold' ? gold : silver
    setEditingMetal(metal)
    setNewRate(rate ? String(rate.ratePerGram) : '')
    setReason('')
    setFormError(null)
  }

  function closeEdit() {
    setEditingMetal(null)
    setNewRate('')
    setReason('')
    setFormError(null)
  }

  const editingRate = editingMetal === 'gold' ? gold : editingMetal === 'silver' ? silver : null

  async function handleSubmitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingMetal) return
    setFormError(null)

    const value = Number(newRate)
    if (newRate.trim() === '' || !Number.isFinite(value) || value <= 0) {
      setFormError('Enter a rate greater than zero.')
      return
    }
    if (!reason.trim()) {
      setFormError('Enter a reason. It is stored with the rate as part of the audit trail.')
      return
    }

    setIsSaving(true)
    try {
      if (editingRate) {
        await updateRate(editingRate._id, { ratePerGram: value, reason: reason.trim() })
      } else {
        await createRate({ metalType: editingMetal, ratePerGram: value, reason: reason.trim() })
      }
      const label = metalLabel[editingMetal]
      closeEdit()
      await loadCurrent()
      toast.success(`${label} rate recorded`)
      setStatusMessage(`${label} rate recorded and added to history.`)
    } catch (err) {
      const message = extractErrorMessage(err)
      setFormError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  /* ---- render ----------------------------------------------------------- */

  const isFetching = phase === 'fetching'
  const isStoring = phase === 'saving'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Precious metal rates"
        description="The stored rate is what the shop trades on. Fetching a live rate only shows you the market — nothing changes until you store it."
        actions={
          <Link to="/metal-rates/history" className="text-sm font-medium text-accent hover:underline">
            View rate history
          </Link>
        }
      />

      {/* Progress and outcome, announced without moving focus. */}
      <p aria-live="polite" className="sr-only">
        {statusMessage}
      </p>

      {loadError && (
        <Notice tone="danger" role="alert" title="Unable to load rates">
          {loadError} Check your connection and try again.
        </Notice>
      )}

      {/* ---- stored rate ---------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Stored rate</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Used for every price the app calculates. Editing appends a new record — history is never
            rewritten.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StoredRateCard
            metal="gold"
            rate={gold}
            isLoading={isLoading}
            canEdit={canManage}
            onEdit={() => openEdit('gold')}
          />
          <StoredRateCard
            metal="silver"
            rate={silver}
            isLoading={isLoading}
            canEdit={canManage}
            onEdit={() => openEdit('silver')}
          />
        </div>

        {!canManage && !isLoading && (
          <p className="text-xs text-ink-muted">
            Rates are changed by admin and manager accounts. You can view the current rate and its
            history.
          </p>
        )}
      </section>

      {/* ---- fetch live rate ------------------------------------------- */}
      {canManage && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Fetch live rate</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Reads today's market rate from the provider. You review it before anything is stored.
            </p>
          </div>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleFetchLive}
                  loading={isFetching}
                  disabled={!liveRatesAvailable || isStoring}
                  leftIcon={<TrendUpIcon size={16} />}
                >
                  {isFetching ? 'Fetching' : 'Fetch live rate'}
                </Button>
                {liveRatesAvailable && !preview && !isFetching && (
                  <span className="text-xs text-ink-muted">
                    Fetching does not change the stored rate.
                  </span>
                )}
              </div>

              {!liveRatesAvailable && !isLoading && (
                <Notice tone="info" title="Live rates are unavailable">
                  The rate provider is not configured on the server, so live market rates cannot be
                  fetched. A server administrator has to set it up — this cannot be done from the
                  browser. Until then, record rates manually with Edit rate.
                </Notice>
              )}

              {fetchError && (
                <Notice tone="danger" role="alert" title="Could not reach the rate provider">
                  {fetchError} Your stored rate is unchanged — carry on with it, or record a rate
                  manually.
                </Notice>
              )}

              {warnings.length > 0 && (
                <Notice tone="info" title="How the provider's figures were read">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </Notice>
              )}

              {outcome && !preview && (
                <Notice tone="info" role="status">
                  {outcome}
                </Notice>
              )}

              {preview && (
                <div className="rounded-panel border border-line bg-sunken p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-ink">Live market rate</h3>
                    <p className="text-xs text-ink-muted">
                      Fetched {relativeTime(preview.fetchedAt)}
                      {preview.city ? ` · ${preview.city}` : ''}
                    </p>
                  </div>

                  <ul className="mt-3 divide-y divide-line">
                    <PreviewRow
                      metal="gold"
                      liveRate={preview.gold?.ratePerGram ?? null}
                      storedRate={gold?.ratePerGram ?? null}
                    />
                    <PreviewRow
                      metal="silver"
                      liveRate={preview.silver?.ratePerGram ?? null}
                      storedRate={silver?.ratePerGram ?? null}
                    />
                  </ul>

                  <p className="mt-3 text-xs text-ink-muted">
                    Nothing is stored yet. Storing appends a new record for each metal whose rate has
                    moved.
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button onClick={handleUseAndStore} loading={isStoring}>
                      {isStoring ? 'Saving' : 'Use & store'}
                    </Button>
                    <Button variant="secondary" onClick={cancelPreview} disabled={isStoring}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* ---- edit modal -------------------------------------------------- */}
      <Modal
        open={editingMetal !== null}
        onClose={closeEdit}
        title={
          editingMetal
            ? `${editingRate ? 'Edit' : 'Set'} ${metalLabel[editingMetal].toLowerCase()} rate`
            : ''
        }
        description="Saving adds a new dated record. The earlier rate stays in history — nothing is overwritten."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" form="rate-form" loading={isSaving}>
              {isSaving ? 'Saving' : 'Save rate'}
            </Button>
          </>
        }
      >
        <form id="rate-form" className="flex flex-col gap-4" onSubmit={handleSubmitEdit}>
          {formError && (
            <Notice tone="danger" role="alert">
              {formError}
            </Notice>
          )}

          {editingRate && (
            <div className="rounded-control bg-sunken px-3 py-2">
              <p className="text-xs text-ink-muted">Current rate</p>
              <p className="font-mono text-base font-semibold text-ink">
                {formatRate(editingRate.ratePerGram)}
                <span className="text-sm font-normal text-ink-muted"> / g</span>
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {rateSourceLabel(editingRate.sourceType)} · updated{' '}
                {relativeTime(editingRate.effectiveAt)} by {updatedByName(editingRate.updatedBy)}
              </p>
            </div>
          )}

          <Field label="New rate per gram" required hint="Rupees per gram.">
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

          <Field label="Reason" required hint="Stored with the rate as part of the audit trail.">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Morning market rate, 8 Sep"
              rows={3}
            />
          </Field>
        </form>
      </Modal>
    </div>
  )
}

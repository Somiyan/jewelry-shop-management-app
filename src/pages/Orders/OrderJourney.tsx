import { AlertIcon, Badge, CheckIcon, cx } from '../../components'
import { journeyPosition, statusLabel } from './helpers'
import { JOURNEY_STAGES } from './types'

interface Props {
  status: string
  className?: string
}

/**
 * Where the order actually stands, read left to right. Deliberately not
 * interactive: the backend promotes ready/delivered/completed on its own now,
 * so a row of clickable stages would read as "press here to continue" when in
 * fact nothing is waiting on the salesperson. Manual control lives beside it
 * in `StatusOverride`, framed as the override it is.
 *
 * Below `sm` the line compresses to "Step 3 of 5 · Ready" plus a bar — the same
 * answer `SalesJourney/StepIndicator` gives to the same problem, since five
 * labelled stages cannot fit a 320px screen without wrapping into noise.
 */
export function OrderJourney({ status, className }: Props) {
  const position = journeyPosition(status)
  const total = JOURNEY_STAGES.length

  if (position.cancelled) {
    return (
      <div className={cx('flex items-start gap-2.5 rounded-control bg-danger-soft px-3 py-2.5', className)}>
        <AlertIcon size={16} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-danger">Cancelled</p>
          <p className="mt-0.5 text-xs text-danger">
            This order sits off the journey. Nothing moves it forward, and items cannot be marked ready until it is
            reopened.
          </p>
        </div>
      </div>
    )
  }

  // A status the journey has never heard of (or one dropped by a future
  // backend change): say what it is rather than guess at a position.
  if (position.offJourney) {
    return (
      <div className={cx('flex flex-wrap items-center gap-2', className)}>
        <Badge tone="neutral">{statusLabel(status) || 'Status not set'}</Badge>
        <p className="text-xs text-ink-muted">This status sits outside the standard order journey.</p>
      </div>
    )
  }

  const currentStage = JOURNEY_STAGES[position.index]

  return (
    <nav aria-label="Order journey" className={className}>
      {/* Phone: one line, a bar, and what moves the order on from here. */}
      <div className="sm:hidden">
        <p className="text-sm">
          <span className="text-ink-muted">
            Step {position.index + 1} of {total} ·{' '}
          </span>
          <span className="font-medium text-ink">{currentStage.label}</span>
        </p>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={position.index + 1}
          aria-valuetext={`Step ${position.index + 1} of ${total}: ${currentStage.label}`}
          className="mt-2 h-1 w-full overflow-hidden rounded-pill bg-sunken"
        >
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-150"
            style={{ width: `${((position.index + 1) / total) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-muted">{currentStage.detail}</p>
        {!position.exact && (
          <p className="mt-1 text-xs text-ink-muted">
            Recorded as <span className="text-ink">{statusLabel(status)}</span>.
          </p>
        )}
      </div>

      {/* Tablet and up: the full line, with each stage saying who moves it. */}
      <div className="hidden sm:block">
        <ol className="flex items-start gap-1">
          {JOURNEY_STAGES.map((stage, index) => {
            const done = index < position.index
            const current = index === position.index
            const reached = index <= position.index
            return (
              <li key={stage.id} className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                      current
                        ? 'border-accent bg-accent text-accent-ink'
                        : done
                          ? 'border-accent bg-surface text-accent'
                          : 'border-line bg-surface text-ink-muted',
                    )}
                  >
                    {done ? <CheckIcon size={13} /> : index + 1}
                  </span>
                  {index < total - 1 && (
                    <span aria-hidden="true" className={cx('h-px flex-1', reached ? 'bg-accent/40' : 'bg-line')} />
                  )}
                </div>
                <div className="mt-2 pr-2">
                  <p
                    className={cx(
                      'text-sm',
                      current ? 'font-semibold text-ink' : done ? 'font-medium text-ink' : 'text-ink-muted',
                    )}
                  >
                    {stage.label}
                    {current && <span className="sr-only"> (current stage)</span>}
                    {done && <span className="sr-only"> (done)</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {stage.advance === 'automatic' ? 'Sets itself' : 'Set by staff'}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
        <p className="mt-3 text-xs text-ink-muted">
          {currentStage.detail}
          {!position.exact && (
            <>
              {' '}
              Recorded as <span className="text-ink">{statusLabel(status)}</span>.
            </>
          )}
        </p>
      </div>
    </nav>
  )
}

export default OrderJourney

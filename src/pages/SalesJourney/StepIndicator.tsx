import { CheckIcon } from '../../components'
import { cx } from '../../utils/cx'
import { STEP_LABELS, type StepIndex } from './types'

interface Props {
  currentStep: StepIndex
  maxStepReached: StepIndex
  onJump: (step: StepIndex) => void
}

/**
 * Progress through the sale. Steps already reached stay clickable so the
 * salesperson can jump back mid-conversation; steps ahead are inert.
 * Below `sm` the strip compresses to "Step 2 of 5 · Customer" plus a bar —
 * five labelled pills would wrap into noise on a phone.
 */
export default function StepIndicator({ currentStep, maxStepReached, onJump }: Props) {
  const total = STEP_LABELS.length
  const currentLabel = STEP_LABELS[currentStep]

  return (
    <nav aria-label="Sale progress">
      {/* Phone: one line + a progress bar. */}
      <div className="sm:hidden">
        <p className="text-sm">
          <span className="text-ink-muted">
            Step {currentStep + 1} of {total} ·{' '}
          </span>
          <span className="font-medium text-ink">{currentLabel}</span>
        </p>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={currentStep + 1}
          aria-valuetext={`Step ${currentStep + 1} of ${total}: ${currentLabel}`}
          className="mt-2 h-1 w-full overflow-hidden rounded-pill bg-sunken"
        >
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-150"
            style={{ width: `${((currentStep + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Tablet and up: the full stepper. */}
      <ol className="hidden items-center gap-2 sm:flex">
        {STEP_LABELS.map((label, index) => {
          const step = index as StepIndex
          const isCurrent = step === currentStep
          const isComplete = step < currentStep
          const isReachable = step <= maxStepReached
          const isClickable = isReachable && !isCurrent

          return (
            <li key={label} className={cx('flex items-center gap-2', index < total - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => isClickable && onJump(step)}
                className={cx(
                  'inline-flex shrink-0 items-center gap-2 rounded-pill py-1.5 pl-1.5 pr-3 text-sm font-medium transition-colors duration-150',
                  'disabled:cursor-default',
                  isCurrent
                    ? 'bg-accent-soft text-accent'
                    : isReachable
                      ? 'text-ink hover:bg-sunken'
                      : 'text-ink-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold',
                    isCurrent
                      ? 'border-accent bg-accent text-accent-ink'
                      : isComplete
                        ? 'border-accent bg-surface text-accent'
                        : 'border-line bg-surface text-ink-muted',
                  )}
                >
                  {isComplete ? <CheckIcon size={13} /> : index + 1}
                </span>
                {label}
                {isComplete && <span className="sr-only">(completed)</span>}
              </button>
              {index < total - 1 && (
                <span
                  aria-hidden="true"
                  className={cx('h-px flex-1', isComplete ? 'bg-accent/40' : 'bg-line')}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

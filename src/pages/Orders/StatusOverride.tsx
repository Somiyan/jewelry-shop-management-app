import { useState } from 'react'
import { Button, ChevronDownIcon, Field, Select, cx } from '../../components'
import { statusLabel } from './helpers'
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from './types'

interface Props {
  status: string
  disabled: boolean
  onSelect: (status: OrderStatus) => void
}

/**
 * The manual escape hatch, kept deliberately quiet. Ready, delivered and
 * completed now set themselves, so a row of stage buttons as the primary
 * control would have staff fighting the automation — this is folded away
 * behind a disclosure and worded as a correction, not as the way to work an
 * order along. `in_manufacturing` and `cancelled` have no automatic trigger,
 * which is why the control has to stay reachable at all.
 */
export function StatusOverride({ status, disabled, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<string>(status)

  const known = (ORDER_STATUSES as string[]).includes(status)
  const options = [
    // A legacy status (`draft`, or anything else the enum has since dropped)
    // is listed but not selectable, so the select can never sit showing a
    // status the order isn't actually in.
    ...(known ? [] : [{ value: status, label: `${statusLabel(status)} (current)`, disabled: true }]),
    ...ORDER_STATUSES.map((value) => ({
      value: value as string,
      label: value === status ? `${STATUS_LABELS[value]} (current)` : STATUS_LABELS[value],
    })),
  ]

  function apply() {
    if (!choice || choice === status) return
    onSelect(choice as OrderStatus)
    setOpen(false)
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setChoice(status)
          setOpen((prev) => !prev)
        }}
        aria-expanded={open}
        leftIcon={
          <ChevronDownIcon size={14} className={cx('transition-transform duration-150', open && 'rotate-180')} />
        }
      >
        Change status manually
      </Button>

      {open && (
        <div className="mt-3 space-y-3 rounded-panel border border-line p-3">
          <p className="text-xs text-ink-muted">
            Ready, delivered and completed set themselves as the work progresses — marking items ready, selling the
            piece and clearing the balance each move this order on. Use this to record something done off-system, to
            start manufacturing, or to correct a mistake.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Set status to" className="sm:max-w-xs sm:flex-1">
              <Select value={choice} onChange={(e) => setChoice(e.target.value)} options={options} />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              onClick={apply}
              disabled={disabled || choice === status}
              className="shrink-0"
            >
              Apply status
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Currently <span className="text-ink">{statusLabel(status)}</span>.
          </p>
        </div>
      )}
    </div>
  )
}

export default StatusOverride

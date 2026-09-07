import type { ReactNode } from 'react'
import { Button } from '../../components'
import { cx } from '../../utils/cx'

interface ActionSpec {
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

interface Props {
  /** Optional strip above the buttons — the phone cart summary lives here. */
  summary?: ReactNode
  back?: ActionSpec
  primary?: ActionSpec
  /** Inline hint/error rendered above the buttons on every breakpoint. */
  message?: ReactNode
  className?: string
}

/**
 * The wizard's action row. On a phone it sticks to the bottom of the viewport,
 * just above the app's tab bar, so "continue" is always one thumb-reach away
 * without scrolling past the cart. From `md` it settles back into the flow as
 * an ordinary panel at the end of the step.
 */
export default function ActionBar({ summary, back, primary, message, className }: Props) {
  return (
    <div
      className={cx(
        'sticky bottom-[calc(var(--spacing-bottomnav)+env(safe-area-inset-bottom))] z-20',
        '-mx-4 border-t border-line bg-surface px-4 py-3 sm:-mx-6 sm:px-6',
        'md:static md:mx-0 md:rounded-panel md:border md:px-4',
        className,
      )}
    >
      {summary}
      {message && <div className="mb-3">{message}</div>}
      <div className={cx('flex items-center gap-3 md:justify-end', Boolean(summary) && 'mt-3')}>
        {back && (
          <Button variant="secondary" onClick={back.onClick} disabled={back.disabled}>
            {back.label}
          </Button>
        )}
        {primary && (
          <Button
            onClick={primary.onClick}
            disabled={primary.disabled}
            loading={primary.loading}
            className="flex-1 md:flex-none"
          >
            {primary.label}
          </Button>
        )}
      </div>
    </div>
  )
}

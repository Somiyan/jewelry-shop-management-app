import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cx } from '../utils/cx'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  /** Quiet line under the label. */
  hint?: ReactNode
}

export function Checkbox({ label, hint, className, id, ...props }: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`

  const input = (
    <input
      {...props}
      id={inputId}
      type="checkbox"
      aria-describedby={hint ? hintId : props['aria-describedby']}
      className={cx(
        'h-4 w-4 shrink-0 rounded-[3px] border border-line bg-surface accent-accent',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    />
  )

  if (!label && !hint) return input

  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className="flex h-5 items-center">{input}</span>
      <span className="flex flex-col gap-0.5">
        {label && (
          <label htmlFor={inputId} className="text-sm text-ink">
            {label}
          </label>
        )}
        {hint && (
          <span id={hintId} className="text-xs text-ink-muted">
            {hint}
          </span>
        )}
      </span>
    </div>
  )
}

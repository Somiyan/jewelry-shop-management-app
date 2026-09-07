import { useId, type ReactNode } from 'react'
import { cx } from '../utils/cx'
import { FieldContext, type FieldControlProps } from './field-context'

export interface FieldProps {
  label: ReactNode
  children: ReactNode
  /** Explicit control id. Generated when omitted. */
  id?: string
  required?: boolean
  /** Quiet helper text below the control. Hidden while an error is shown. */
  hint?: ReactNode
  /** Error message. Sets `aria-invalid` on the control and renders in danger tone. */
  error?: ReactNode
  className?: string
  /** Renders the label visually hidden but still announced. */
  hideLabel?: boolean
}

/**
 * Label + required marker + hint + error wrapper. Any Input/Select/Textarea
 * rendered inside picks up `id`, `aria-describedby` and `aria-invalid`
 * automatically through context — no manual wiring at the call site.
 */
export function Field({
  label,
  children,
  id,
  required,
  hint,
  error,
  className,
  hideLabel,
}: FieldProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const describedBy = cx(error ? errorId : '', !error && hint ? hintId : '').trim()

  const control: FieldControlProps = {
    id: controlId,
    required,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
  }

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={controlId}
        className={cx(
          'text-sm font-medium text-ink',
          hideLabel && 'sr-only absolute h-px w-px overflow-hidden',
        )}
      >
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <FieldContext.Provider value={control}>{children}</FieldContext.Provider>
      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

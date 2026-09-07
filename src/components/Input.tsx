import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx } from '../utils/cx'
import { controlClass, controlHeight } from './control-styles'
import { useFieldControl } from './field-context'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Force the error styling. A surrounding `<Field error>` sets this for you. */
  invalid?: boolean
  /** Small icon rendered inside the control, on the leading edge. */
  leftIcon?: ReactNode
  /** Content pinned to the trailing edge (unit label, button, …). */
  rightSlot?: ReactNode
}

export function Input({ invalid, leftIcon, rightSlot, className, ...props }: InputProps) {
  const field = useFieldControl()
  const isInvalid = invalid ?? field['aria-invalid'] === true

  const input = (
    <input
      {...field}
      {...props}
      className={cx(
        controlClass(isInvalid),
        controlHeight,
        leftIcon ? 'pl-9' : 'pl-3',
        rightSlot ? 'pr-10' : 'pr-3',
        className,
      )}
    />
  )

  if (!leftIcon && !rightSlot) return input

  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
          {leftIcon}
        </span>
      )}
      {input}
      {rightSlot && (
        <span className="absolute inset-y-0 right-1.5 flex items-center">{rightSlot}</span>
      )}
    </div>
  )
}

import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cx } from '../utils/cx'
import { controlClass, controlHeight } from './control-styles'
import { useFieldControl } from './field-context'
import { ChevronDownIcon } from './icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  /** Convenience: render these instead of writing `<option>` children. */
  options?: SelectOption[]
  /** Leading blank option, e.g. "All statuses". Only used with `options`. */
  placeholder?: string
  children?: ReactNode
}

export function Select({
  invalid,
  options,
  placeholder,
  className,
  children,
  ...props
}: SelectProps) {
  const field = useFieldControl()
  const isInvalid = invalid ?? field['aria-invalid'] === true

  return (
    <div className="relative">
      <select
        {...field}
        {...props}
        className={cx(
          controlClass(isInvalid),
          controlHeight,
          'appearance-none pl-3 pr-9',
          className,
        )}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDownIcon
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}

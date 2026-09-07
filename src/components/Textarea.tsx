import type { TextareaHTMLAttributes } from 'react'
import { cx } from '../utils/cx'
import { controlClass } from './control-styles'
import { useFieldControl } from './field-context'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export function Textarea({ invalid, className, rows = 3, ...props }: TextareaProps) {
  const field = useFieldControl()
  const isInvalid = invalid ?? field['aria-invalid'] === true

  return (
    <textarea
      {...field}
      {...props}
      rows={rows}
      className={cx(controlClass(isInvalid), 'min-h-20 px-3 py-2 leading-relaxed', className)}
    />
  )
}

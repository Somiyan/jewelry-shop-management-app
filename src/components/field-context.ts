import { createContext, useContext } from 'react'

export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  required?: boolean
}

export const FieldContext = createContext<FieldControlProps | null>(null)

/**
 * Props a form control should spread onto its element so it is wired to the
 * surrounding `<Field>` (label association, hint/error description, validity).
 * Returns an empty object when the control is used outside a Field.
 */
export function useFieldControl(): Partial<FieldControlProps> {
  return useContext(FieldContext) ?? {}
}

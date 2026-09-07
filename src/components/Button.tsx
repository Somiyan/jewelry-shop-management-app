import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../utils/cx'
import { buttonClass, type ButtonSize, type ButtonVariant } from './button-styles'
import { Spinner } from './Spinner'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Swaps the leading icon for a spinner and disables the button. */
  loading?: boolean
  /** 16px icon rendered before the label. */
  leftIcon?: ReactNode
  /** Stretches to the container width (useful in mobile action bars). */
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  fullWidth,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size), fullWidth && 'w-full', className)}
    >
      {loading ? <Spinner size={16} /> : leftIcon}
      {children}
    </button>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../utils/cx'
import type { ButtonSize, ButtonVariant } from './button-styles'
import { Spinner } from './Spinner'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Accessible name — required, an icon alone never names a control. */
  label: string
  /** The glyph. Use a 16px icon for `sm`, 20px for `md`. */
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Show the label as a native tooltip too. Default true. */
  showTitle?: boolean
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 w-9 md:h-8 md:w-8',
  md: 'h-11 w-11 md:h-10 md:w-10',
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-sunken',
  ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
  danger: 'text-danger hover:bg-danger-soft',
}

export function IconButton({
  label,
  children,
  variant = 'ghost',
  size = 'md',
  loading = false,
  showTitle = true,
  disabled,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={showTitle ? label : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-control transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55',
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {loading ? <Spinner size={16} /> : children}
    </button>
  )
}

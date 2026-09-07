import { cx } from '../utils/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-55'

const sizes: Record<ButtonSize, string> = {
  // Touch-sized on phones, tighter from md up.
  sm: 'h-9 px-3 text-sm md:h-8',
  md: 'h-11 px-4 text-sm md:h-10',
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-sunken',
  ghost: 'text-ink hover:bg-sunken',
  danger: 'bg-danger text-white hover:bg-danger/90',
}

/** Button styling as a plain string, for the rare case a `<Link>` must look like a button. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra?: string,
): string {
  return cx(base, sizes[size], variants[variant], extra)
}

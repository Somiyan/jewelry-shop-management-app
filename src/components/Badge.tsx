import type { ReactNode } from 'react'
import { cx } from '../utils/cx'

/**
 * Status colour is fixed application-wide — never re-pick a tone per page.
 * success: paid / delivered / in stock · warning: pending, partial, low stock
 * danger: failed, cancelled, out of stock · info: informational, ready
 * neutral: no status · gold / silver: metal type only.
 */
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold' | 'silver'

const tones: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  neutral: 'bg-sunken text-ink-muted',
  gold: 'bg-sunken text-gold',
  silver: 'bg-sunken text-silver',
}

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  /** 12px glyph before the label — colour never carries the meaning alone. */
  icon?: ReactNode
  /** Small solid dot before the label, in the tone colour. */
  dot?: boolean
  className?: string
}

export function Badge({ children, tone = 'neutral', icon, dot, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {icon}
      {children}
    </span>
  )
}

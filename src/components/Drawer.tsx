import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../hooks/useOverlay'
import { cx } from '../utils/cx'
import { IconButton } from './IconButton'
import { CloseIcon } from './icons'

export type DrawerSize = 'sm' | 'md' | 'lg'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  /** Required — names the dialog. Pass `hideTitle` to keep it visually quiet. */
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Sticky action row at the bottom of the panel. */
  footer?: ReactNode
  size?: DrawerSize
  /** Side the panel slides in from on `sm`+. Below `sm` it is always a bottom sheet. */
  side?: 'right' | 'left'
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  className?: string
}

const sizes: Record<DrawerSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
}

/**
 * Side panel with the same accessibility guarantees as Modal. Slides from the
 * right on tablet/desktop; becomes a bottom sheet below `sm`.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  side = 'right',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  initialFocusRef,
  className,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useOverlay({ open, panelRef, onClose, closeOnEscape, initialFocusRef })

  if (!open) return null

  return createPortal(
    <div
      className={cx(
        'fixed inset-0 z-50 flex items-end',
        side === 'right' ? 'sm:justify-end' : 'sm:justify-start',
      )}
    >
      <div
        className="anim-fade-in absolute inset-0 bg-ink/40"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        tabIndex={-1}
        className={cx(
          'anim-sheet-in relative flex max-h-[90dvh] w-full flex-col rounded-t-overlay bg-surface shadow-overlay outline-none',
          'sm:h-dvh sm:max-h-none sm:rounded-none',
          side === 'right' ? 'sm:anim-slide-in-right' : 'sm:anim-slide-in-left',
          sizes[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && (
              <p id={`${id}-description`} className="mt-0.5 text-xs text-ink-muted">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <IconButton label="Close" size="sm" onClick={onClose} className="-mr-1">
              <CloseIcon size={18} />
            </IconButton>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

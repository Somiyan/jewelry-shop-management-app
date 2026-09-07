import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useOverlay } from '../hooks/useOverlay'
import { cx } from '../utils/cx'
import { IconButton } from './IconButton'
import { CloseIcon } from './icons'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  open: boolean
  /** Called on Escape, backdrop click and the close button. */
  onClose: () => void
  /** Required — it names the dialog for assistive tech. */
  title: ReactNode
  /** Quiet line under the title, wired to `aria-describedby`. */
  description?: ReactNode
  children?: ReactNode
  /** Action row pinned to the bottom of the sheet. Right-aligned from `sm`. */
  footer?: ReactNode
  size?: ModalSize
  /** Clicking the backdrop closes. Default true. */
  closeOnBackdrop?: boolean
  /** Escape closes. Default true. */
  closeOnEscape?: boolean
  /** Show the header close button. Default true. */
  showCloseButton?: boolean
  /** Element focused on open. Defaults to the first focusable child. */
  initialFocusRef?: RefObject<HTMLElement | null>
  className?: string
}

const sizes: Record<ModalSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
}

/**
 * Dialog with a real focus trap, focus restore, Escape, scroll lock and
 * backdrop dismiss. Below `sm` it becomes a full-screen sheet.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  initialFocusRef,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useOverlay({ open, panelRef, onClose, closeOnEscape, initialFocusRef })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4">
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
          'anim-panel-in relative flex h-dvh w-full flex-col bg-surface shadow-overlay outline-none',
          'sm:h-auto sm:max-h-[85vh] sm:rounded-overlay',
          sizes[size],
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 sm:px-5">
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

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-line px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

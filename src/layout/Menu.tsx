import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../utils/cx'

export interface MenuProps {
  /** The trigger button's accessible name. */
  label: string
  /** Trigger contents. */
  trigger: ReactNode
  /** Panel contents. Call `close` after an item is chosen. */
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
  triggerClassName?: string
  panelClassName?: string
}

/**
 * Small popover used by the app shell (user menu, theme picker). Closes on
 * Escape and on outside click; the panel is the only place `shadow-raise`
 * appears outside modals.
 */
export function Menu({
  label,
  trigger,
  children,
  align = 'right',
  triggerClassName,
  panelClassName,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'inline-flex items-center gap-2 rounded-control transition-colors hover:bg-sunken',
          triggerClassName,
        )}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cx(
            'anim-fade-in absolute top-[calc(100%+6px)] z-40 min-w-52 rounded-panel border border-line bg-surface p-1 shadow-raise',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export interface MenuItemProps {
  onClick?: () => void
  icon?: ReactNode
  children: ReactNode
  /** Marks the item as the current choice. */
  selected?: boolean
  tone?: 'default' | 'danger'
}

export function MenuItem({ onClick, icon, children, selected, tone = 'default' }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm transition-colors',
        tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-sunken',
        selected && 'bg-accent-soft text-accent',
      )}
    >
      {icon}
      <span className="flex-1">{children}</span>
    </button>
  )
}

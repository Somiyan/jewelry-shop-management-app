import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

/**
 * Open overlays, bottom of the stack first. Only the top one answers Escape and
 * traps Tab, so a confirm dialog opened from a drawer behaves correctly.
 */
const overlayStack: object[] = []

/** Refcounted body scroll lock so nested overlays restore the original value once. */
let lockCount = 0
let lockedFrom = ''

export interface UseOverlayOptions {
  /** Whether the overlay is currently mounted and visible. */
  open: boolean
  /** The element that should trap focus. */
  panelRef: RefObject<HTMLElement | null>
  onClose: () => void
  /** Escape closes the overlay. Default true. */
  closeOnEscape?: boolean
  /** Element focused when the overlay opens. Defaults to the first focusable child. */
  initialFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Accessibility behaviour shared by Modal and Drawer: focus trap, focus restore
 * on close, Escape to close and a body scroll lock.
 */
export function useOverlay({
  open,
  panelRef,
  onClose,
  closeOnEscape = true,
  initialFocusRef,
}: UseOverlayOptions): void {
  const idRef = useRef({})

  // Stack registration.
  useEffect(() => {
    if (!open) return
    const id = idRef.current
    overlayStack.push(id)
    return () => {
      const index = overlayStack.indexOf(id)
      if (index >= 0) overlayStack.splice(index, 1)
    }
  }, [open])

  // Focus management: move focus in on open, restore it on close.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const frame = window.requestAnimationFrame(() => {
      const target =
        initialFocusRef?.current ?? (panel ? (focusableWithin(panel)[0] ?? panel) : null)
      target?.focus()
    })
    return () => {
      window.cancelAnimationFrame(frame)
      previouslyFocused?.focus?.()
    }
  }, [open, panelRef, initialFocusRef])

  // Escape to close + Tab cycling inside the panel — top overlay only.
  useEffect(() => {
    if (!open) return
    function isTop() {
      return overlayStack[overlayStack.length - 1] === idRef.current
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!isTop()) return
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = focusableWithin(panel)
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose, closeOnEscape, panelRef])

  // Body scroll lock.
  useEffect(() => {
    if (!open) return
    if (lockCount === 0) {
      lockedFrom = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    lockCount += 1
    return () => {
      lockCount -= 1
      if (lockCount === 0) document.body.style.overflow = lockedFrom
    }
  }, [open])
}

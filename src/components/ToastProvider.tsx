import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../utils/cx'
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons'
import { ToastContext, type Toast, type ToastApi, type ToastOptions, type ToastTone } from './toast-context'

const MAX_VISIBLE = 3
const DEFAULT_DURATION = 4000

const toneStyles: Record<ToastTone, { wrapper: string; icon: ReactNode }> = {
  success: { wrapper: 'border-success/40 text-success', icon: <CheckIcon size={16} /> },
  error: { wrapper: 'border-danger/40 text-danger', icon: <AlertIcon size={16} /> },
  warning: { wrapper: 'border-warning/40 text-warning', icon: <AlertIcon size={16} /> },
  info: { wrapper: 'border-info/40 text-info', icon: <InfoIcon size={16} /> },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<string, number>())

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (tone: ToastTone, message: string, options?: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const duration = options?.duration ?? DEFAULT_DURATION
      setToasts((current) => [...current, { id, tone, message, duration }].slice(-MAX_VISIBLE))
      if (duration > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), duration),
        )
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (message, options) => show('success', message, options),
      error: (message, options) => show('error', message, options),
      warning: (message, options) => show('warning', message, options),
      info: (message, options) => show('info', message, options),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:w-96 sm:flex-col-reverse sm:p-4"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cx(
                'anim-toast-in pointer-events-auto flex items-start gap-3 rounded-panel border bg-surface px-3 py-2.5 shadow-raise',
                toneStyles[toast.tone].wrapper,
              )}
            >
              <span className="mt-0.5 shrink-0">{toneStyles[toast.tone].icon}</span>
              <p className="flex-1 text-sm text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  /** Milliseconds before auto-dismiss. Default 4000. Pass 0 to keep it until dismissed. */
  duration?: number
}

export interface Toast {
  id: string
  tone: ToastTone
  message: string
  duration: number
}

export interface ToastApi {
  success: (message: string, options?: ToastOptions) => string
  error: (message: string, options?: ToastOptions) => string
  warning: (message: string, options?: ToastOptions) => string
  info: (message: string, options?: ToastOptions) => string
  /** Low-level escape hatch. */
  show: (tone: ToastTone, message: string, options?: ToastOptions) => string
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

/**
 * `const toast = useToast()` then `toast.success('Product created')`.
 * Messages are sentence case, say what happened, and never apologise.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside <ToastProvider>')
  return api
}

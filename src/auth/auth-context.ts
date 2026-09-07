import { createContext, useContext } from 'react'
import type { AuthUser, Role } from './types'

export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  /** Persists the session returned by the login endpoint. */
  login: (user: AuthUser, token: string) => void
  /** Clears the session. Pass `redirect` false to stay on the current route. */
  logout: (redirect?: boolean) => void
  /** Permission gate for UI. Admins always pass. */
  can: (action: string) => boolean
  /** Role gate for UI: `hasRole('admin', 'manager')`. */
  hasRole: (...roles: Role[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

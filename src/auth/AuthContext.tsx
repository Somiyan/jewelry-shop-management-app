import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAuth, setToken, setUnauthorizedHandler } from '../api/client'
import { AuthContext, type AuthContextValue } from './auth-context'
import { clearStoredUser, readStoredUser, writeStoredUser } from './storage'
import type { AuthUser, Role } from './types'
import { getToken } from '../api/client'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())
  const [token, setTokenState] = useState<string | null>(() => getToken())

  const login = useCallback((nextUser: AuthUser, nextToken: string) => {
    setToken(nextToken)
    writeStoredUser(nextUser)
    setTokenState(nextToken)
    setUser(nextUser)
  }, [])

  const logout = useCallback(
    (redirect = true) => {
      clearAuth()
      clearStoredUser()
      setTokenState(null)
      setUser(null)
      if (redirect) navigate('/login', { replace: true })
    },
    [navigate],
  )

  // A 401 from any request ends the session and returns the user to sign-in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth()
      clearStoredUser()
      setTokenState(null)
      setUser(null)
      if (window.location.pathname !== '/login') navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  const value = useMemo<AuthContextValue>(() => {
    const permissions = user?.permissions ?? []
    return {
      user,
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
      can: (action: string) =>
        user?.role === 'admin' || permissions.includes('all') || permissions.includes(action),
      hasRole: (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    }
  }, [user, token, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

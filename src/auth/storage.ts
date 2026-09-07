import { USER_KEY } from '../api/client'
import type { AuthUser } from './types'

export function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthUser
    return parsed && typeof parsed === 'object' && 'role' in parsed ? parsed : null
  } catch {
    return null
  }
}

export function writeStoredUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY)
}

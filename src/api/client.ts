import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api'

export const apiClient = axios.create({ baseURL })

const TOKEN_KEY = 'jewelry_shop_token'

/** Storage key for the persisted user object. Owned here so `clearAuth` can wipe both. */
export const USER_KEY = 'jewelry_shop_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** Clears the whole session (token + user). */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

/**
 * Registered by `AuthProvider` so a 401 can clear React state and route to
 * /login. Falls back to a hard redirect when no provider is mounted.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined
    const isLoginRequest = error?.config?.url?.includes('/auth/login')
    if (status === 401 && !isLoginRequest) {
      if (unauthorizedHandler) {
        unauthorizedHandler()
      } else {
        clearAuth()
        if (window.location.pathname !== '/login') window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)

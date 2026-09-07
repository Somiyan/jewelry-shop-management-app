export type Role = 'admin' | 'staff' | 'manager'

/** The user object returned by `POST /api/auth/login`. */
export interface AuthUser {
  _id: string
  username: string
  email: string
  role: Role
  /** Action strings the backend granted, e.g. "manage_stock". Admins bypass this list. */
  permissions: string[]
}

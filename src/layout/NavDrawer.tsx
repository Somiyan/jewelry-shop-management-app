import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { Badge } from '../components/Badge'
import { Drawer } from '../components/Drawer'
import { LogoutIcon } from '../components/icons'
import { cx } from '../utils/cx'
import type { NavItem } from './nav-items'
import { ThemeToggle } from './ThemeToggle'

export interface NavDrawerProps {
  open: boolean
  onClose: () => void
  items: NavItem[]
  title?: string
}

/** Navigation in a sheet: the `md`–`lg` menu trigger and the mobile "More" tab. */
export function NavDrawer({ open, onClose, items, title = 'Navigation' }: NavDrawerProps) {
  const { user, logout } = useAuth()

  return (
    <Drawer open={open} onClose={onClose} title={title} size="sm">
      <nav aria-label="Sections">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cx(
                      'flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent-soft text-accent'
                        : 'text-ink hover:bg-sunken',
                    )
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{user?.username ?? 'Signed in'}</p>
            {user?.role && (
              <span className="mt-1 inline-block">
                <Badge tone="info">{user.role}</Badge>
              </span>
            )}
          </div>
          <ThemeToggle />
        </div>

        <button
          type="button"
          onClick={() => {
            onClose()
            logout()
          }}
          className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft"
        >
          <LogoutIcon size={18} />
          Log out
        </button>
      </div>
    </Drawer>
  )
}

import { Badge } from '../components/Badge'
import { LogoutIcon, SettingsIcon } from '../components/icons'
import { useAuth } from '../auth'
import { useNavigate } from 'react-router-dom'
import { Menu, MenuItem } from './Menu'

function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0])
  return (letters.join('') || name.slice(0, 1) || '?').toUpperCase()
}

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const name = user?.username ?? 'Signed in'

  return (
    <Menu
      label="Account menu"
      triggerClassName="h-10 gap-2 px-1.5 pr-2 md:h-9"
      trigger={
        <>
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
          >
            {initials(name)}
          </span>
          <span className="hidden max-w-32 truncate text-sm text-ink lg:block">{name}</span>
        </>
      }
    >
      {(close) => (
        <>
          <div className="flex flex-col gap-1 px-2.5 py-2">
            <span className="truncate text-sm font-medium text-ink">{name}</span>
            {user?.email && <span className="truncate text-xs text-ink-muted">{user.email}</span>}
            {user?.role && (
              <span className="mt-1">
                <Badge tone="info">{user.role}</Badge>
              </span>
            )}
          </div>
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={<SettingsIcon size={16} />}
            onClick={() => {
              close()
              navigate('/users/add')
            }}
          >
            Settings
          </MenuItem>
          <MenuItem
            tone="danger"
            icon={<LogoutIcon size={16} />}
            onClick={() => {
              close()
              logout()
            }}
          >
            Log out
          </MenuItem>
        </>
      )}
    </Menu>
  )
}

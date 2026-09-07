import { NavLink } from 'react-router-dom'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons'
import { cx } from '../utils/cx'
import { useVisibleNavItems } from './nav-items'

export interface SidebarProps {
  /** Icon-rail mode. Forced below 1280px by AppLayout. */
  collapsed: boolean
  /** Omitted when the viewport is too narrow for the full sidebar. */
  onToggleCollapse?: () => void
}

/** Persistent navigation, `md` and up. Hidden on phones — see MobileNav. */
export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const navItems = useVisibleNavItems()
  return (
    <aside
      className={cx(
        'fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-line bg-surface md:flex',
        collapsed ? 'w-rail' : 'w-sidebar',
      )}
    >
      <div
        className={cx(
          'flex h-header shrink-0 items-center border-b border-line',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <span className="flex items-center gap-2 overflow-hidden">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control bg-accent font-mono text-sm font-semibold text-accent-ink"
          >
            SJ
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-[-0.01em] text-ink">
              Sonali Jewellers
            </span>
          )}
        </span>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to} className="group relative">
                <NavLink
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cx(
                      'flex h-10 items-center gap-3 rounded-control text-sm font-medium transition-colors',
                      collapsed ? 'justify-center px-0' : 'px-3',
                      isActive
                        ? 'bg-accent-soft text-accent'
                        : 'text-ink-muted hover:bg-sunken hover:text-ink',
                    )
                  }
                >
                  <Icon size={18} />
                  {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                </NavLink>
                {collapsed && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-control border border-line bg-surface px-2 py-1 text-xs text-ink shadow-raise group-hover:block"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {onToggleCollapse && (
        <div className={cx('border-t border-line p-2', collapsed && 'flex justify-center')}>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cx(
              'flex h-9 items-center gap-2 rounded-control text-xs font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink',
              collapsed ? 'w-9 justify-center' : 'w-full px-3',
            )}
          >
            {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      )}
    </aside>
  )
}

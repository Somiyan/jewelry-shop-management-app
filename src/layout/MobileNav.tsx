import { NavLink } from 'react-router-dom'
import { MoreIcon } from '../components/icons'
import { cx } from '../utils/cx'
import { navItems, primaryMobilePaths } from './nav-items'

export interface MobileNavProps {
  /** Opens the "More" sheet with the remaining sections. */
  onOpenMore: () => void
  /** Highlights the More tab while its sheet is open. */
  moreOpen?: boolean
}

const tabClass =
  'flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-control px-1 py-1 text-[11px] font-medium transition-colors'

/** Bottom tab bar below `md`. Five destinations, safe-area aware. */
export function MobileNav({ onOpenMore, moreOpen }: MobileNavProps) {
  const tabs = primaryMobilePaths
    .map((path) => navItems.find((item) => item.to === path))
    .filter((item): item is (typeof navItems)[number] => Boolean(item))

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex h-bottomnav items-stretch gap-1 px-2">
        {tabs.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(tabClass, isActive && !moreOpen ? 'text-accent' : 'text-ink-muted')
              }
            >
              <Icon size={20} />
              {item.label}
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={onOpenMore}
          aria-expanded={moreOpen}
          className={cx(tabClass, moreOpen ? 'text-accent' : 'text-ink-muted')}
        >
          <MoreIcon size={20} />
          More
        </button>
      </div>
    </nav>
  )
}

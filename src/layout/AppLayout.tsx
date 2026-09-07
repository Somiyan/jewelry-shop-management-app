import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { cx } from '../utils/cx'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { NavDrawer } from './NavDrawer'
import { primaryMobilePaths, useVisibleNavItems } from './nav-items'
import { Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'jewelry_shop_sidebar_collapsed'

/**
 * The frame every authenticated page renders inside.
 *   < 768px  no sidebar, bottom tab bar + "More" sheet
 *   768–1279 icon rail, full nav available from the header menu
 *   ≥ 1280px full sidebar, collapsible to the rail (persisted)
 */
export function AppLayout() {
  const wide = useMediaQuery('(min-width: 1280px)')
  const [userCollapsed, setUserCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === 'true',
  )
  const [navOpen, setNavOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const collapsed = wide ? userCollapsed : true
  const navItems = useVisibleNavItems()

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(userCollapsed))
  }, [userCollapsed])

  const moreItems = navItems.filter((item) => !primaryMobilePaths.includes(item.to))

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={wide ? () => setUserCollapsed((value) => !value) : undefined}
      />

      <div className={cx('flex min-h-dvh flex-col', collapsed ? 'md:pl-rail' : 'md:pl-sidebar')}>
        <Header onOpenNav={() => setNavOpen(true)} />

        <main className="flex-1 px-4 pb-[calc(var(--spacing-bottomnav)+env(safe-area-inset-bottom)+1rem)] pt-5 sm:px-6 md:pb-8">
          <div className="mx-auto w-full max-w-content">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNav onOpenMore={() => setMoreOpen(true)} moreOpen={moreOpen} />

      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} items={navItems} />
      <NavDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={moreItems}
        title="More"
      />
    </div>
  )
}

import type { ComponentType } from 'react'
import { useAuth } from '../auth'
import type { Role } from '../auth'
import type { IconProps } from '../components/icons'
import {
  BoxIcon,
  DashboardIcon,
  FileTextIcon,
  InboxIcon,
  ReceiptIcon,
  SettingsIcon,
  TagIcon,
  TrendUpIcon,
  UsersIcon,
} from '../components/icons'

export interface NavItem {
  to: string
  label: string
  icon: ComponentType<IconProps>
  /** Omit to show the item to every signed-in role. */
  roles?: Role[]
}

/** Only routes that actually exist. Never add a nav entry ahead of its module. */
export const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/sales/new', label: 'Sell', icon: TagIcon },
  { to: '/stock', label: 'Products', icon: BoxIcon },
  { to: '/customers', label: 'Customers', icon: UsersIcon },
  { to: '/orders', label: 'Orders', icon: ReceiptIcon },
  { to: '/invoices', label: 'Invoices', icon: FileTextIcon },
  { to: '/categories', label: 'Categories', icon: InboxIcon, roles: ['admin', 'manager'] },
  // Every signed-in role may read rates and their history; the fetch and edit
  // actions inside the page are what's gated to admin/manager.
  { to: '/metal-rates', label: 'Metal rates', icon: TrendUpIcon },
  { to: '/users/add', label: 'Settings', icon: SettingsIcon },
]

/** `navItems` filtered to what the signed-in user's role may see. */
export function useVisibleNavItems(): NavItem[] {
  const { user } = useAuth()
  return navItems.filter((item) => !item.roles || (user && item.roles.includes(user.role)))
}

/** The five destinations in the bottom tab bar; the rest live behind "More". */
export const primaryMobilePaths = ['/dashboard', '/sales/new', '/stock', '/customers']

export function titleForPath(pathname: string): string {
  const match = navItems.find(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  )
  return match?.label ?? 'Jewellery shop manager'
}

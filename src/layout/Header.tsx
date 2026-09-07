import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { apiClient } from '../api/client'
import { Button } from '../components/Button'
import { Drawer } from '../components/Drawer'
import { IconButton } from '../components/IconButton'
import { MenuIcon } from '../components/icons'
import { MetalSwatch } from '../components/MetalSwatch'
import { cx } from '../utils/cx'
import { titleForPath } from './nav-items'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export interface HeaderProps {
  /** Opens the navigation drawer. Shown below `xl`, where the sidebar is a rail. */
  onOpenNav: () => void
  className?: string
}

/* ------------------------------------------------------ live rate ticker --- */

type MetalType = 'gold' | 'silver'

interface RateDoc {
  _id: string
  metalType: MetalType
  ratePerGram: number
  unit: 'gram'
  reason: string
  effectiveAt: string
  createdAt: string
  updatedBy: { _id: string; username: string } | string
}

interface CurrentRates {
  gold: RateDoc | null
  silver: RateDoc | null
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "4 minutes ago" from an ISO timestamp — local copy, see DashboardPage. */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never updated'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never updated'
  const seconds = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return relative.format(Math.round(seconds), 'second')
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2592000) return relative.format(Math.round(seconds / 86400), 'day')
  return relative.format(Math.round(seconds / 2592000), 'month')
}

/** Rounded rupee figure for the compact ticker — full precision lives on the Metal rates page. */
function formatRateValue(rate: number): string {
  return `₹${Math.round(rate).toLocaleString('en-IN')}`
}

/**
 * Manual-refresh-only rate ticker for the header, matching the app's
 * convention of never polling metal rates. Fetches once on mount; below `sm`
 * it collapses to a tappable chip that opens a bottom sheet with both metals.
 */
function MetalRateTicker() {
  const [rates, setRates] = useState<CurrentRates | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)

  const fetchRates = useCallback(() => {
    setIsLoading(true)
    apiClient
      .get<CurrentRates>('/precious-metal-rates/current')
      .then(({ data }) => setRates(data))
      .catch(() => {
        // Decorative in the header — the Metal rates page surfaces the real error.
        setRates(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  const gold = rates?.gold ?? null
  const silver = rates?.silver ?? null
  const hasAnyRate = Boolean(gold || silver)

  // Nothing configured yet and nothing loading: there is genuinely nothing to show.
  if (!isLoading && !hasAnyRate) return null
  if (isLoading) return null

  return (
    <>
      {/* Desktop: full words, one decimal-free figure per metal. */}
      <div className="hidden shrink-0 items-center gap-1.5 font-mono text-sm text-ink-muted lg:flex">
        {gold && (
          <span>
            Gold <span className="text-ink">{formatRateValue(gold.ratePerGram)}</span>/g
          </span>
        )}
        {gold && silver && <span aria-hidden="true">&middot;</span>}
        {silver && (
          <span>
            Silver <span className="text-ink">{formatRateValue(silver.ratePerGram)}</span>/g
          </span>
        )}
      </div>

      {/* Tablet: abbreviated, still inline. */}
      <div className="hidden shrink-0 items-center gap-1.5 font-mono text-xs text-ink-muted sm:flex lg:hidden">
        {gold && (
          <span>
            Au <span className="text-ink">{formatRateValue(gold.ratePerGram)}</span>
          </span>
        )}
        {gold && silver && <span aria-hidden="true">&middot;</span>}
        {silver && (
          <span>
            Ag <span className="text-ink">{formatRateValue(silver.ratePerGram)}</span>
          </span>
        )}
      </div>

      {/* Phone: a tappable chip opening a bottom sheet with both metals. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="shrink-0 rounded-control border border-line bg-surface px-2 py-1 font-mono text-xs text-ink-muted transition-colors hover:bg-sunken sm:hidden"
      >
        {gold && <span className="text-ink">{formatRateValue(gold.ratePerGram)}</span>}
        {gold && <span className="mr-1">Au</span>}
        {gold && silver && <span className="mx-1" aria-hidden="true">|</span>}
        {silver && <span className="mr-1">Ag</span>}
        {silver && <span className="text-ink">{formatRateValue(silver.ratePerGram)}</span>}
      </button>

      <Drawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Metal rates"
        description="Manual refresh only — rates are never polled."
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <ul className="divide-y divide-line">
            {(['gold', 'silver'] as const).map((metal) => {
              const doc = metal === 'gold' ? gold : silver
              return (
                <li key={metal} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <MetalSwatch metal={metal} label={metal === 'gold' ? 'Gold' : 'Silver'} />
                  {doc ? (
                    <span className="text-right">
                      <span className="block font-mono text-sm font-semibold text-ink">
                        {formatRateValue(doc.ratePerGram)} / g
                      </span>
                      <span className="block text-xs text-ink-muted">
                        updated {relativeTime(doc.effectiveAt)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-ink-muted">Rates not set</span>
                  )}
                </li>
              )
            })}
          </ul>
          <Button variant="secondary" size="sm" onClick={fetchRates}>
            Refresh
          </Button>
        </div>
      </Drawer>
    </>
  )
}

/* ---------------------------------------------------------------- header --- */

/** Sticky top bar: route title, nav trigger, live rates, appearance and account. */
export function Header({ onOpenNav, className }: HeaderProps) {
  const { pathname } = useLocation()

  return (
    <header
      className={cx(
        'sticky top-0 z-30 flex h-header shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4',
        className,
      )}
    >
      <IconButton label="Open navigation" onClick={onOpenNav} className="xl:hidden">
        <MenuIcon size={20} />
      </IconButton>

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.01em] text-ink">
        {titleForPath(pathname)}
      </h1>

      <MetalRateTicker />

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}

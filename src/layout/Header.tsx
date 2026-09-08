import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  formatRate,
  getCurrentRates,
  metalLabel,
  type CurrentRatesResponse,
  type MetalType,
  type RateDoc,
} from '../api/rates'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { Drawer } from '../components/Drawer'
import { IconButton } from '../components/IconButton'
import { AlertIcon, MenuIcon } from '../components/icons'
import { MetalSwatch } from '../components/MetalSwatch'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { cx } from '../utils/cx'
import { relativeTime } from '../utils/format'
import { rateSourceLabel, rateStatusLabelText, rateStatusTone } from '../utils/ui'
import { titleForPath } from './nav-items'
import { Menu } from './Menu'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'

export interface HeaderProps {
  /** Opens the navigation drawer. Shown below `xl`, where the sidebar is a rail. */
  onOpenNav: () => void
  className?: string
}

/* ------------------------------------------------------ live rate ticker --- */

/** Rounded rupee figure for the compact ticker — full precision lives in the panel. */
function formatTickerValue(rate: number): string {
  return `₹${Math.round(rate).toLocaleString('en-IN')}`
}

/** A stored rate old enough that the shop should re-check it before quoting. */
function isStale(rate: RateDoc | null): boolean {
  return rate?.statusLabel === 'STALE'
}

interface RateDetailsProps {
  gold: RateDoc | null
  silver: RateDoc | null
  isRefreshing: boolean
  onRefresh: () => void
  onNavigate?: () => void
}

/**
 * Shared body of the rate popover (tablet/desktop) and bottom sheet (phone):
 * rate, when it was last updated, where it came from, and its status.
 */
function RateDetails({ gold, silver, isRefreshing, onRefresh, onNavigate }: RateDetailsProps) {
  const metals: { metal: MetalType; doc: RateDoc | null }[] = [
    { metal: 'gold', doc: gold },
    { metal: 'silver', doc: silver },
  ]

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line">
        {metals.map(({ metal, doc }) => (
          <li key={metal} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <MetalSwatch metal={metal} label={metalLabel[metal]} />
              {doc ? (
                <span className="font-mono text-sm font-semibold text-ink">
                  {formatRate(doc.ratePerGram)}
                  <span className="text-ink-muted"> / g</span>
                </span>
              ) : (
                <span className="text-xs text-ink-muted">Not set</span>
              )}
            </div>
            {doc && (
              <>
                <p className="text-xs text-ink-muted">Last updated {relativeTime(doc.effectiveAt)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-muted">
                    Source: {rateSourceLabel(doc.sourceType)}
                  </span>
                  <Badge tone={rateStatusTone(doc.statusLabel)} dot>
                    {rateStatusLabelText(doc.statusLabel)}
                  </Badge>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {(isStale(gold) || isStale(silver)) && (
        <p className="flex items-start gap-2 rounded-control bg-warning-soft px-2.5 py-2 text-xs text-warning">
          <AlertIcon size={14} className="mt-0.5 shrink-0" />
          <span>A stored rate is old. Check it before quoting a price.</span>
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={onRefresh} loading={isRefreshing}>
          Refresh
        </Button>
        <Link
          to="/metal-rates"
          onClick={onNavigate}
          className="text-sm font-medium text-accent hover:underline"
        >
          Manage rates
        </Link>
      </div>
      <p className="text-xs text-ink-muted">Rates refresh only when you ask — never in the background.</p>
    </div>
  )
}

/**
 * Manual-refresh-only rate ticker for the header. Fetches once on mount and
 * never polls. The whole rate area is a control at every breakpoint: it opens
 * a details popover from `sm` up and a bottom sheet on phones.
 */
function MetalRateTicker() {
  const [rates, setRates] = useState<CurrentRatesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const isPhone = !useMediaQuery('(min-width: 640px)')

  const load = useCallback((refresh = false) => {
    if (refresh) setIsRefreshing(true)
    getCurrentRates()
      .then(setRates)
      .catch(() => {
        // Quiet in the header — the Precious metal rates page surfaces the real error.
        setRates(null)
      })
      .finally(() => {
        setIsLoading(false)
        setIsRefreshing(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const gold = rates?.gold ?? null
  const silver = rates?.silver ?? null
  const hasAnyRate = Boolean(gold || silver)
  const stale = isStale(gold) || isStale(silver)

  // Nothing configured yet, or still loading: there is genuinely nothing to show.
  if (isLoading || !hasAnyRate) return null

  const staleDot = stale ? (
    <span className="flex shrink-0 items-center">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
      <span className="sr-only">Stale rate</span>
    </span>
  ) : null

  if (isPhone) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className="flex h-9 shrink-0 items-center gap-1 rounded-control border border-line bg-surface px-2 font-mono text-xs text-ink-muted transition-colors hover:bg-sunken"
        >
          <span className="sr-only">Metal rates, open details</span>
          {gold && (
            <span aria-hidden="true">
              Au <span className="text-ink">{formatTickerValue(gold.ratePerGram)}</span>
            </span>
          )}
          {/* Silver drops out under 400px so the route title keeps some width;
              both metals are always in the sheet. */}
          {gold && silver && (
            <span className="text-line max-[399px]:hidden" aria-hidden="true">
              |
            </span>
          )}
          {silver && (
            <span className="max-[399px]:hidden" aria-hidden="true">
              Ag <span className="text-ink">{formatTickerValue(silver.ratePerGram)}</span>
            </span>
          )}
          {staleDot}
        </button>

        <Drawer
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Metal rates"
          description="The rates the shop is currently trading on."
          size="sm"
        >
          <RateDetails
            gold={gold}
            silver={silver}
            isRefreshing={isRefreshing}
            onRefresh={() => load(true)}
            onNavigate={() => setSheetOpen(false)}
          />
        </Drawer>
      </>
    )
  }

  return (
    <Menu
      label="Metal rates, open details"
      kind="dialog"
      align="right"
      triggerClassName="h-9 shrink-0 px-2"
      panelClassName="w-72 p-3"
      trigger={
        <>
          {/* Desktop: full words. */}
          <span className="hidden items-center gap-1.5 font-mono text-sm text-ink-muted lg:flex">
            {gold && (
              <span>
                Gold <span className="text-ink">{formatTickerValue(gold.ratePerGram)}</span>/g
              </span>
            )}
            {gold && silver && <span aria-hidden="true">&middot;</span>}
            {silver && (
              <span>
                Silver <span className="text-ink">{formatTickerValue(silver.ratePerGram)}</span>/g
              </span>
            )}
          </span>

          {/* Tablet: abbreviated, still inline. */}
          <span className="flex items-center gap-1.5 font-mono text-xs text-ink-muted lg:hidden">
            {gold && (
              <span>
                Au <span className="text-ink">{formatTickerValue(gold.ratePerGram)}</span>
              </span>
            )}
            {gold && silver && <span aria-hidden="true">&middot;</span>}
            {silver && (
              <span>
                Ag <span className="text-ink">{formatTickerValue(silver.ratePerGram)}</span>
              </span>
            )}
          </span>

          {staleDot}
        </>
      }
    >
      {(close) => (
        <RateDetails
          gold={gold}
          silver={silver}
          isRefreshing={isRefreshing}
          onRefresh={() => load(true)}
          onNavigate={close}
        />
      )}
    </Menu>
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

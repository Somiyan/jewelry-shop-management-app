import { Badge } from '../../components'
import { formatCurrency } from '../../utils/format'
import { derivePaymentStatus } from './helpers'

interface Props {
  itemCount: number
  estimatedTotal: number
  advanceEnabled: boolean
  advanceAmount: number
}

/** Compact, always-reachable strip: pinned into the create-order Drawer's
 * footer alongside the Cancel/Create buttons so the running total and
 * payment status travel with the primary action on every breakpoint. */
export function OrderSummaryInline({ itemCount, estimatedTotal, advanceEnabled, advanceAmount }: Props) {
  const status = derivePaymentStatus(advanceEnabled, advanceAmount, estimatedTotal)
  const balance = estimatedTotal - advanceAmount

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-xs text-ink-muted">
        <span className="font-mono text-ink">{itemCount}</span> {itemCount === 1 ? 'item' : 'items'}
      </span>
      <span className="text-xs text-ink-muted">
        Est. value <span className="font-mono font-medium text-ink">{formatCurrency(estimatedTotal)}</span>
      </span>
      {advanceEnabled && advanceAmount > 0 && (
        <span className="text-xs text-ink-muted">
          Balance <span className="font-mono font-medium text-ink">{formatCurrency(balance)}</span>
        </span>
      )}
      <Badge tone={status.tone}>{status.label}</Badge>
    </div>
  )
}

export default OrderSummaryInline

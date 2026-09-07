import { Badge, CopyIcon, EditIcon, IconButton, MetalSwatch, TrashIcon } from '../../components'
import { formatCurrency } from '../../utils/format'
import { toNumber } from '../productShared'
import { estimateCustomItem } from './helpers'
import { resolvedCategory, resolvedPurity, type CustomItemDraft, type MetalRatesResponse } from './types'

interface Props {
  draft: CustomItemDraft
  metalRates: MetalRatesResponse | null
  onEdit: () => void
  onDuplicate: () => void
  onRemove: () => void
}

/** Summary card for an added-but-not-yet-submitted custom item, shown in the
 * order form's item list next to the stock lines. */
export function CustomItemCard({ draft, metalRates, onEdit, onDuplicate, onRemove }: Props) {
  const category = resolvedCategory(draft) || 'Uncategorised'
  const purity = resolvedPurity(draft)
  const weight = toNumber(draft.estimatedWeight)
  const quantity = toNumber(draft.quantity) ?? 1
  const makingValue = toNumber(draft.makingChargeValue) ?? 0
  const rateOverride = toNumber(draft.rateOverride)
  const liveRate = (draft.metalType === 'gold' ? metalRates?.gold : metalRates?.silver)?.ratePerGram ?? null
  const effectiveRate = rateOverride ?? liveRate

  const estimate =
    weight && purity && effectiveRate
      ? estimateCustomItem(weight, purity, draft.makingChargeType, makingValue, effectiveRate, quantity)
      : null

  return (
    <div className="space-y-3 rounded-panel border border-line bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">Custom order</Badge>
            <p className="truncate font-medium text-ink">{draft.itemName || 'Untitled item'}</p>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <MetalSwatch metal={draft.metalType} label={`${draft.metalType} ${purity ?? '—'}%`} className="text-xs" />
            <span>·</span>
            <span>{category}</span>
            <span>·</span>
            <span className="font-mono">{weight ?? '—'} g est.</span>
            <span>·</span>
            <span className="font-mono">Qty {quantity}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Edit item" size="sm" variant="secondary" onClick={onEdit}>
            <EditIcon size={16} />
          </IconButton>
          <IconButton label="Duplicate item" size="sm" variant="secondary" onClick={onDuplicate}>
            <CopyIcon size={16} />
          </IconButton>
          <IconButton label="Remove item" size="sm" variant="danger" onClick={onRemove}>
            <TrashIcon size={16} />
          </IconButton>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
        <span className="text-xs text-ink-muted">Estimated value (before tax)</span>
        <span className="font-mono text-sm font-medium text-ink">
          {estimate ? `~${formatCurrency(estimate.subtotal)}` : 'calculated on save'}
        </span>
      </div>
    </div>
  )
}

export default CustomItemCard

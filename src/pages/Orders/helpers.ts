/**
 * Pure helpers for the Orders page and its custom/made-to-order workflow.
 * Anything that touches money or weight math here is the ONE sanctioned
 * client-side pricing calculation in the app: a pre-tax optimistic preview
 * for an item that doesn't exist on the server yet, using the exact two
 * formulas the brief specifies (metal value, making charge). It is always
 * labelled "estimate" / "calculated on save" and is never used in place of
 * what `POST /api/orders` actually returns.
 */
import type { BadgeTone } from '../../components'
import type { CustomItemDraft, CustomOrderItem, MakingChargeType, Order, SizeUnit } from './types'
import { JOURNEY_STAGES, STATUS_LABELS, type JourneyStageId, type OrderStatus } from './types'

export function customerName(customerId: Order['customerId']): string {
  if (typeof customerId === 'string') return customerId
  return customerId.name
}

export function customerPhone(customerId: Order['customerId']): string | null {
  if (typeof customerId === 'string') return null
  return customerId.phone
}

/** Sentence-cases an unrecognised status (e.g. legacy `draft`) instead of crashing. */
export function statusLabel(status: string): string {
  const known = STATUS_LABELS[status as OrderStatus]
  if (known) return known
  const spaced = status.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Wording is from the salesperson's point of view, not the data model's:
 * an item is either still to be made, or it is stock they can sell.
 * `ready` survives only for records written before conversion became
 * automatic — new items never stop there.
 */
export function fulfillmentLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'To be made'
    case 'ready':
      return 'Ready'
    case 'converted':
      return 'In stock'
    default:
      return status
  }
}

export function fulfillmentTone(status: string): BadgeTone {
  switch (status) {
    case 'converted':
      return 'success'
    case 'ready':
      return 'info'
    case 'pending':
      return 'warning'
    default:
      return 'neutral'
  }
}

/** Where an order sits on the five-stage journey. `index` is -1 when the
 * status maps nowhere on the line — cancelled, or something unrecognised. */
export interface JourneyPosition {
  index: number
  /** False when the status is a book-keeping value (`pending`, `processing`,
   * legacy `draft`) shown at the nearest stage rather than being that stage. */
  exact: boolean
  cancelled: boolean
  /** True for a status that isn't on the line at all — render a plain badge. */
  offJourney: boolean
}

const STATUS_TO_STAGE: Record<string, JourneyStageId> = {
  draft: 'confirmed',
  pending: 'confirmed',
  confirmed: 'confirmed',
  processing: 'in_manufacturing',
  in_manufacturing: 'in_manufacturing',
  ready: 'ready',
  delivered: 'delivered',
  completed: 'completed',
}

export function journeyPosition(status: string): JourneyPosition {
  if (status === 'cancelled') return { index: -1, exact: false, cancelled: true, offJourney: true }
  const stageId = STATUS_TO_STAGE[status]
  if (!stageId) return { index: -1, exact: false, cancelled: false, offJourney: true }
  const index = JOURNEY_STAGES.findIndex((stage) => stage.id === stageId)
  return { index, exact: stageId === status, cancelled: false, offJourney: false }
}

/** Signed difference between what was quoted and what the piece actually came
 * to, as a percentage of the estimate. `null` when there is no estimate to
 * compare against — never divide by zero into a "0% variance" that lies. */
export function priceVariancePercent(estimatedPrice: number, finalPrice: number): number | null {
  if (!(estimatedPrice > 0)) return null
  return ((finalPrice - estimatedPrice) / estimatedPrice) * 100
}

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "4 minutes ago" / "2 days ago" from an ISO timestamp. Small local copy of
 * the one on DashboardPage — that one isn't exported, and this is a plain
 * pure function with no page-specific dependencies. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'unknown'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'unknown'
  const seconds = (then - Date.now()) / 1000
  const abs = Math.abs(seconds)
  if (abs < 60) return relativeFormatter.format(Math.round(seconds), 'second')
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(seconds / 3600), 'hour')
  if (abs < 2592000) return relativeFormatter.format(Math.round(seconds / 86400), 'day')
  return relativeFormatter.format(Math.round(seconds / 2592000), 'month')
}

/** Best-effort default unit for a size/length input, based on category name.
 * Deliberately shallow — falls back to "custom" rather than growing a big
 * lookup table. */
export function defaultSizeUnitForCategory(categoryName: string): SizeUnit {
  const key = categoryName.trim().toLowerCase()
  if (!key) return 'custom'
  if (key.includes('ring')) return 'size'
  if (key.includes('chain') || key.includes('necklace') || key.includes('mangalsutra')) return 'inch'
  if (key.includes('bali') || key.includes('tops') || key.includes('ear')) return 'mm'
  return 'custom'
}

export function newDraftId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function emptyCustomItemDraft(): CustomItemDraft {
  return {
    id: newDraftId(),
    itemName: '',
    categorySelect: '',
    categoryOther: '',
    description: '',
    metalType: 'gold',
    estimatedWeight: '',
    purityPreset: '91.6',
    purityCustom: '',
    wastagePercentage: '0',
    sizeValue: '',
    sizeUnit: 'custom',
    makingChargeType: 'percentage',
    makingChargeValue: '0',
    quantity: '1',
    rateOverride: '',
  }
}

export interface CustomItemEstimate {
  metalValue: number
  making: number
  /** Pre-tax subtotal for the full quantity — tax and the committed final
   * price are only known once the order is actually created server-side. */
  subtotal: number
  quantity: number
}

/**
 * The two formulas the brief hands us, applied client-side purely for an
 * optimistic "calculated on save" label. Matches the backend's
 * computePricingBreakdown for basePrice + makingChargeAmount exactly
 * (wastage deliberately plays no part in the selling price there either —
 * it only ever affects purchase cost, which doesn't exist yet for an
 * unmade item).
 */
export function estimateCustomItem(
  weight: number,
  purity: number,
  makingChargeType: MakingChargeType,
  makingChargeValue: number,
  ratePerGram: number,
  quantity: number,
): CustomItemEstimate {
  const metalValue = weight * (purity / 100) * ratePerGram
  const making =
    makingChargeType === 'per_gram' ? weight * makingChargeValue : weight * (makingChargeValue / 100) * ratePerGram
  const subtotal = (metalValue + making) * quantity
  return { metalValue: metalValue * quantity, making: making * quantity, subtotal, quantity }
}

/** Clones a draft with a fresh client-only id, for the "Duplicate" action. */
export function duplicateDraft(draft: CustomItemDraft): CustomItemDraft {
  return { ...draft, id: newDraftId() }
}

export function customItemSummaryLine(item: CustomOrderItem): string {
  const purityText = `${item.purity}%`
  return `${item.metalType} · ${purityText} · ${item.estimatedWeight} g est.`
}

/** Client-derived-from-visible-numbers label only — not a pricing rule. */
export function derivePaymentStatus(
  advanceEnabled: boolean,
  advanceAmount: number,
  total: number,
): { label: string; tone: BadgeTone } {
  if (!advanceEnabled || advanceAmount <= 0) return { label: 'Unpaid', tone: 'danger' }
  if (advanceAmount >= total && total > 0) return { label: 'Paid', tone: 'success' }
  return { label: 'Partially paid', tone: 'warning' }
}

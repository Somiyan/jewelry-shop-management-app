/**
 * Precious metal rates API.
 *
 * The single source of truth for rate shapes in the frontend — the header
 * ticker, the rate management page and the history page all import from here
 * rather than re-declaring `RateDoc`.
 *
 * Live provider access is a server concern: the browser never talks to the
 * rate provider and never sees a provider key. Everything goes through our own
 * `/api/rates/*` endpoints.
 */
import { apiClient } from './client'

/* ---------------------------------------------------------------- types --- */

export type MetalType = 'gold' | 'silver'
export type RateSourceType = 'LIVE_API' | 'MANUAL'
export type RateStatus = 'ACTIVE' | 'SUPERSEDED'

/** Derived server-side from the record's age and source — use this for the badge. */
export type RateStatusLabel = 'LIVE' | 'MANUAL' | 'STALE' | 'NONE'

export interface RateUserRef {
  _id: string
  username: string
  email?: string
  role?: string
}

/** How the provider's raw payload was interpreted. Explains the fetch warnings. */
export interface RateProviderMeta {
  sourcePath?: string
  rawValue?: number | string
  quotedGrams?: number
  purityToken?: string
  purityFraction?: number
  unitInferred?: boolean
}

export interface RateDoc {
  _id: string
  metalType: MetalType
  ratePerGram: number
  unit: 'gram'
  currency: string
  city: string
  /** Free-form provider name recorded by the server, e.g. 'manual'. */
  source: string
  sourceType: RateSourceType
  status: RateStatus
  statusLabel: RateStatusLabel
  reason: string
  effectiveAt: string
  fetchedAt: string | null
  createdAt: string
  updatedAt: string
  /** Null on rows written by the scheduled sync, which has no user. */
  updatedBy: RateUserRef | string | null
  /** Aliases kept by the API for older consumers. */
  metal: 'GOLD' | 'SILVER'
  rate: number
  providerMeta?: RateProviderMeta
}

export interface CurrentRatesResponse {
  gold: RateDoc | null
  silver: RateDoc | null
  /** False when the server has no rate provider configured — the UI must not offer a fetch. */
  liveRatesAvailable: boolean
}

/** One metal in a live preview. Nothing here is stored until the user says so. */
export interface LiveRateQuote {
  metal: 'GOLD' | 'SILVER'
  ratePerGram: number
  unit: 'gram'
  currency: string
  provenance?: Record<string, unknown>
}

export interface LiveRatesResponse {
  city: string
  effectiveAt: string
  fetchedAt: string
  attempts?: number
  /** Unit/purity inference notes. Show them: they explain how the figure was derived. */
  warnings: string[]
  gold: LiveRateQuote | null
  silver: LiveRateQuote | null
}

/** A metal the server chose not to re-record because the figure had not moved. */
export interface SkippedRate {
  metalType: MetalType
  ratePerGram: number
  reason: string
}

export interface FetchAndStoreResponse {
  stored: RateDoc[]
  skipped: SkippedRate[]
  warnings: string[]
  current: { gold: RateDoc | null; silver: RateDoc | null }
}

export interface CreateRatePayload {
  metalType: MetalType
  ratePerGram: number
  reason: string
  effectiveAt?: string
}

export interface UpdateRatePayload {
  ratePerGram: number
  /** Required by the server: a correction must say why. */
  reason: string
  effectiveAt?: string
}

/** An edit appends a corrected record; `supersededId` is the row it replaces. */
export interface UpdateRateResponse {
  rate: RateDoc
  supersededId: string
}

export interface RateHistoryQuery {
  metal?: MetalType
  sourceType?: RateSourceType
  /** ISO timestamps. */
  from?: string
  to?: string
  updatedBy?: string
  /** Server caps this at 200. */
  limit?: number
  /** Keyset cursor: return records created before this instant. */
  before?: string
}

/* ------------------------------------------------------------ endpoints --- */

/** Public. The rates the shop is currently trading on. */
export async function getCurrentRates(): Promise<CurrentRatesResponse> {
  const { data } = await apiClient.get<CurrentRatesResponse>('/rates/current')
  return data
}

/**
 * Preview the market rate. Requires FETCH_LIVE_RATES (admin/manager) and
 * stores nothing — the stored rate is untouched whatever this returns.
 */
export async function getLiveRates(city?: string): Promise<LiveRatesResponse> {
  const { data } = await apiClient.get<LiveRatesResponse>('/rates/live', {
    params: city ? { city } : undefined,
  })
  return data
}

/** Adopt the live rate: fetch again server-side, then persist. */
export async function fetchAndStore(
  payload: { city?: string; reason?: string } = {},
): Promise<FetchAndStoreResponse> {
  const { data } = await apiClient.post<FetchAndStoreResponse>('/rates/fetch-and-store', payload)
  return data
}

/** Manual entry for a metal that has no rate yet. */
export async function createRate(payload: CreateRatePayload): Promise<RateDoc> {
  const { data } = await apiClient.post<RateDoc>('/rates', payload)
  return data
}

/** Correct a rate. Appends a new record; the original stays in history. */
export async function updateRate(
  id: string,
  payload: UpdateRatePayload,
): Promise<UpdateRateResponse> {
  const { data } = await apiClient.put<UpdateRateResponse>(`/rates/${id}`, payload)
  return data
}

export async function getRateHistory(query: RateHistoryQuery = {}): Promise<RateDoc[]> {
  const params: Record<string, string | number> = {}
  if (query.metal) params.metal = query.metal
  if (query.sourceType) params.sourceType = query.sourceType
  if (query.from) params.from = query.from
  if (query.to) params.to = query.to
  if (query.updatedBy) params.updatedBy = query.updatedBy
  if (query.before) params.before = query.before
  params.limit = query.limit ?? 200

  const { data } = await apiClient.get<RateDoc[]>('/rates/history', { params })
  return data
}

/* -------------------------------------------------------------- helpers --- */

export const metalLabel: Record<MetalType, string> = { gold: 'Gold', silver: 'Silver' }

/**
 * Who recorded a rate. Rows written by the scheduled sync carry no user, so
 * they read as "System" rather than "unknown" — nothing is missing there.
 */
export function updatedByName(updatedBy: RateDoc['updatedBy'] | undefined): string {
  if (!updatedBy) return 'System'
  if (typeof updatedBy === 'string') return updatedBy
  return updatedBy.username || 'System'
}

/** Rate per gram in rupees, e.g. "₹14,850.00". */
const rateFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return rateFormatter.format(value)
}

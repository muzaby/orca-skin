export interface FreshnessInput {
  readonly now: number
  readonly lastSyncAt: number | null
  readonly freshnessMs?: number
}

export function isFresh({ now, lastSyncAt, freshnessMs = 5 * 60 * 1000 }: FreshnessInput): boolean {
  return lastSyncAt !== null && now - lastSyncAt <= freshnessMs
}

export interface RetentionInput {
  readonly now: number
  readonly headerDate: number | null
  readonly firstSeenAt: number
  readonly retentionDays?: number
}

export function isExpired({
  now,
  headerDate,
  firstSeenAt,
  retentionDays = 14
}: RetentionInput): boolean {
  const effective = headerDate !== null && Number.isFinite(headerDate) ? headerDate : firstSeenAt
  return now - effective > retentionDays * 24 * 60 * 60 * 1000
}

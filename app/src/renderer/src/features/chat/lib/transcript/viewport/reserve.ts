/**
 * Claude 0008 reserve-space calculation (EP-11 ② · p3, p4, p12).
 *
 * Formula: max(0, 0.5 * viewportHeight - (blocksTotalHeight - lastUserStart))
 * `blocksTotalHeight` MUST exclude the reserve gap itself so repeated measurements never oscillate (p12).
 */

export function reserveGap(
  viewportHeight: number,
  blocksTotalHeight: number,
  lastUserStart: number | undefined
): number {
  if (lastUserStart === undefined || viewportHeight <= 0) return 0
  const usedAfterLastUser = Math.max(0, blocksTotalHeight - lastUserStart)
  return Math.max(0, Math.round(0.5 * viewportHeight - usedAfterLastUser))
}

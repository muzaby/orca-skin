/**
 * Virtualizer range calculation for the shared transcript viewport (EP-17 ① · ΔV2 D-102).
 *
 * Mounts ONLY: visible ± overscan ∪ the scroll anchor block.
 * A user selection never adds rows — copy is the browser default over the rendered DOM,
 * and a newly mounted row cancels the selection instead (D-103 · selectionGuard.ts).
 */

export interface VisibleRange {
  readonly startIndex: number
  readonly endIndex: number
  readonly overscan: number
  readonly count: number
}

export function viewportMountSet(visible: VisibleRange, viewportAnchorIndex?: number): number[] {
  const { startIndex, endIndex, overscan, count } = visible
  if (count <= 0) return []

  const mounted = new Set<number>()
  if (startIndex <= endIndex) {
    const lo = Math.max(0, startIndex - overscan)
    const hi = Math.min(count - 1, endIndex + overscan)
    for (let i = lo; i <= hi; i++) mounted.add(i)
  }
  if (
    viewportAnchorIndex !== undefined &&
    viewportAnchorIndex >= 0 &&
    viewportAnchorIndex < count
  ) {
    mounted.add(viewportAnchorIndex)
  }
  return Array.from(mounted).sort((a, b) => a - b)
}

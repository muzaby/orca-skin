/**
 * Selection-aware virtualizer range calculation (EP-17 ①⑤ · c1, c2, c6, c10, c11, c15).
 *
 * Always mounts ONLY:
 *   visible ± overscan  ∪  focus ± overscan  ∪  selection endpoints  ∪  anchor
 * Regardless of selection span (even 5,000 blocks), NEVER mounts the entire selected range.
 */

export interface SelectionEndpoints {
  readonly anchorIndex: number
  readonly focusIndex: number
}

export interface VisibleRange {
  readonly startIndex: number
  readonly endIndex: number
  readonly overscan: number
  readonly count: number
}

export function selectionMountSet(
  visible: VisibleRange,
  selection: SelectionEndpoints | null,
  viewportAnchorIndex?: number
): number[] {
  const { startIndex, endIndex, overscan, count } = visible
  if (count <= 0) return []

  const mounted = new Set<number>()
  const addRange = (from: number, to: number): void => {
    const lo = Math.max(0, Math.min(from, to))
    const hi = Math.min(count - 1, Math.max(from, to))
    for (let i = lo; i <= hi; i++) mounted.add(i)
  }

  // 1. Visible window ± overscan
  if (startIndex <= endIndex) {
    addRange(startIndex - overscan, endIndex + overscan)
  }

  // 2. Selection endpoints + focus ± overscan (never full range between anchor & focus!)
  if (selection) {
    if (selection.anchorIndex >= 0 && selection.anchorIndex < count) {
      mounted.add(selection.anchorIndex)
    }
    if (selection.focusIndex >= 0 && selection.focusIndex < count) {
      addRange(selection.focusIndex - overscan, selection.focusIndex + overscan)
    }
  }

  // 3. Active scroll anchor block
  if (
    viewportAnchorIndex !== undefined &&
    viewportAnchorIndex >= 0 &&
    viewportAnchorIndex < count
  ) {
    mounted.add(viewportAnchorIndex)
  }

  return Array.from(mounted).sort((a, b) => a - b)
}

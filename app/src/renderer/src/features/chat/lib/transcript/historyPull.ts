import type { HistoryEdgeState } from './historyGesture'

export const HISTORY_PULL_HEIGHT_PX = 48

export function headInView(top: number, height: number, viewport: number, head: number): boolean {
  return top <= head || height <= viewport
}

// The request remains owned by the store. An additional upward wheel can only
// expose its indicator. Release is driven by request settlement, never a timer.
export function historyPull(
  opened: boolean,
  before: HistoryEdgeState | undefined,
  atTop: boolean,
  deltaY: number
): boolean {
  return before === 'loading' && (opened || (atTop && deltaY < 0))
}

import type { HistoryWindow } from '../../../../../shared/history-page'

export function withinHistoryUnit(edge: HistoryWindow['before']): boolean {
  return edge?.kind === 'withinTurn' || edge?.kind === 'withinUnit'
}

type EdgeState = 'loading' | 'error'
type SearchEdges = Pick<HistoryWindow, 'before' | 'after'> & {
  beforeState?: EdgeState
  afterState?: EdgeState
}

// A search target can have unread messages on both sides of the same turn.
export function idleSearchDirection(view: SearchEdges): 'before' | 'after' | undefined {
  if (view.beforeState === 'loading' || view.afterState === 'loading') return undefined
  if (withinHistoryUnit(view.before) && view.beforeState !== 'error') return 'before'
  if (view.after?.kind === 'withinTurn' && view.afterState !== 'error') return 'after'
  return undefined
}

import type { HistoryWindow } from '../../../../../shared/history-page'

type EdgeState = 'loading' | 'error'
type SearchEdges = Pick<HistoryWindow, 'before' | 'after'> & {
  beforeState?: EdgeState
  afterState?: EdgeState
}

// A search target can have unread messages on both sides of the same turn.
export function idleSearchDirection(view: SearchEdges): 'before' | 'after' | undefined {
  if (view.beforeState === 'loading' || view.afterState === 'loading') return undefined
  if (view.before?.kind === 'withinTurn' && view.beforeState !== 'error') return 'before'
  if (view.after?.kind === 'withinTurn' && view.afterState !== 'error') return 'after'
  return undefined
}

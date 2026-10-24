import { expect, it, vi } from 'vitest'
import { discardSessionWork } from './discard'

it('returns residual submissions, aborts the turn and discards the runtime', () => {
  const order: string[] = []
  const turn = { controller: new AbortController(), live: null }
  const deps = {
    activity: {
      residualAttemptIds: vi.fn(() => ['attempt-1', 'attempt-2']),
      setResidualAttempts: vi.fn((_sessionId: string, ids: readonly string[]) => {
        order.push(`residual:${ids.length}`)
      })
    },
    supervisor: {
      getBySession: vi.fn(() => turn),
      discardRuntime: vi.fn(() => {
        order.push(`discard:${turn.controller.signal.aborted}`)
        return true
      })
    },
    pendingMessages: {
      discardSubmitted: vi.fn((): Array<{ ids: string[] }> => {
        order.push('submitted')
        return [{ ids: ['m1'] }, { ids: ['m2', 'm3'] }]
      })
    }
  }
  const emit = vi.fn()

  discardSessionWork(deps, 'session-A', emit)

  expect(order).toEqual(['residual:0', 'discard:true', 'submitted'])
  expect(deps.supervisor.getBySession).toHaveBeenCalledWith('session-A')
  expect(deps.supervisor.discardRuntime).toHaveBeenCalledWith('session-A')
  expect(deps.pendingMessages.discardSubmitted).toHaveBeenCalledWith('session-A', [
    'attempt-1',
    'attempt-2'
  ])
  expect(emit).toHaveBeenCalledExactlyOnceWith({
    type: 'message.cancelled',
    sessionId: 'session-A',
    ids: ['m1', 'm2', 'm3']
  })

  deps.supervisor.getBySession.mockReturnValue(undefined as never)
  deps.pendingMessages.discardSubmitted.mockReturnValue([])
  emit.mockClear()
  discardSessionWork(deps, 'session-B', emit)
  expect(deps.supervisor.discardRuntime).toHaveBeenLastCalledWith('session-B')
  expect(emit).not.toHaveBeenCalled()
})

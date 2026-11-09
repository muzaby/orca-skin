import type { WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import type { SteerFlushBatch } from '../../adapters/common/turn'
import type { TurnContext } from '../../contracts/turn'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import type { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import { buildTurnRequest } from './turn-request'

vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))

function assemble(options: { dbSessionId: string | null; queueKey: string }): {
  queue: PendingMessageQueue
  request: ReturnType<typeof buildTurnRequest>
  reserve: (id: string) => SteerFlushBatch
  setBatches: (batches: SteerFlushBatch[]) => void
  send: ReturnType<typeof vi.fn>
} {
  const queue = new PendingMessageQueue()
  const key = options.dbSessionId ?? options.queueKey
  let batches: SteerFlushBatch[] = []
  const send = vi.fn()
  const turn = {
    dbSessionId: options.dbSessionId,
    blockedSubagents: new Set<string>()
  } as unknown as TurnContext<WebContents>
  const request = buildTurnRequest(
    {
      wc: { isDestroyed: () => false, send } as unknown as WebContents,
      pendingMessages: queue,
      activity: {} as SessionActivityProjector,
      chainId: 'chain-1',
      queueKey: options.queueKey,
      getActiveTurn: () => turn,
      getInitialBatches: () => batches,
      settleDeadBackgroundTasks: async () => {}
    },
    { sessionId: options.dbSessionId, text: 'x', cwd: '/w', extensions: { skills: [] } as never }
  )
  const reserve = (id: string): SteerFlushBatch => {
    queue.enqueue(key, { text: id }, Date.now(), id)
    return queue.reserveItem(key, id, 'chain-1')!
  }
  return { queue, request, reserve, setBatches: (next) => (batches = next), send }
}

describe('initial submission reopen delegates use the commit key and claims', () => {
  it.each([
    ['W1 a stored session keyed by its DB id', { dbSessionId: 's1', queueKey: 'q-other' }],
    ['W2 a new session keyed by its queue key', { dbSessionId: null, queueKey: 'new:1' }]
  ])('%s', (_name, options) => {
    const f = assemble(options)
    f.setBatches([f.reserve('m1')])
    expect(f.request.commitInitialSubmission!()).toBe(true)
    expect(f.request.canSubmitInitial!()).toBe(false)
    // The commit announced ownership for a stored session; the reopen must not announce anything.
    const ownership = f.send.mock.calls.length
    expect(ownership).toBe(options.dbSessionId ? 1 : 0)
    expect(f.request.canReopenInitialSubmission!()).toBe(true)
    expect(f.request.canSubmitInitial!()).toBe(false)
    expect(f.request.reopenInitialSubmission!()).toBe(true)
    expect(f.request.canSubmitInitial!()).toBe(true)
    expect(f.send.mock.calls.length).toBe(ownership)
  })

  it('W3 follows the current initial batches through the getter', () => {
    const f = assemble({ dbSessionId: 's1', queueKey: 'q-other' })
    const old = f.reserve('m1')
    f.setBatches([old])
    expect(f.request.commitInitialSubmission!()).toBe(true)
    f.queue.confirm('s1', { kind: 'echo', uuid: old.uuid })
    f.setBatches([f.reserve('m2')])
    expect(f.request.commitInitialSubmission!()).toBe(true)
    expect(f.request.canReopenInitialSubmission!()).toBe(true)
    expect(f.request.reopenInitialSubmission!()).toBe(true)
    expect(f.request.canSubmitInitial!()).toBe(true)
  })
  // canReopen 의 claim 항(verify r1 D1) — commit 과 같은 claim 을 보지 않으면(빈 claim 은 참) 이
  // 입력들이 참이 된다. 확정된 배치·held 로 돌아간 배치는 그 claim 으로 재개방할 수 없다.
  it.each([
    ['W1 stored session', { dbSessionId: 's1', queueKey: 'q-other' }, 'confirmed'],
    ['W1 stored session', { dbSessionId: 's1', queueKey: 'q-other' }, 'rolled back'],
    ['W2 new session', { dbSessionId: null, queueKey: 'new:1' }, 'confirmed'],
    ['W2 new session', { dbSessionId: null, queueKey: 'new:1' }, 'rolled back']
  ] as const)('%s refuses to reopen a batch that was %s', (_name, options, state) => {
    const f = assemble(options)
    const key = options.dbSessionId ?? options.queueKey
    const batch = f.reserve('m1')
    f.setBatches([batch])
    if (state === 'confirmed') {
      expect(f.request.commitInitialSubmission!()).toBe(true)
      f.queue.confirm(key, { kind: 'echo', uuid: batch.uuid })
    } else {
      f.request.rollbackInitialSubmission!()
      expect(f.queue.pending(key).map((item) => item.id)).toEqual(['m1'])
    }
    expect(f.request.canReopenInitialSubmission!()).toBe(false)
    expect(f.request.reopenInitialSubmission!()).toBe(false)
    expect(f.request.canSubmitInitial!()).toBe(false)
  })
})

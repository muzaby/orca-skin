import { describe, expect, it, vi } from 'vitest'
import type { ChatActivitySnapshot } from '../../../shared/ipc'
import { BackgroundTaskTracker } from './background-tasks'
import { PendingMessageQueue } from './pending-message-queue'
import { SessionActivityProjector } from './session-activity-projector'

function fixture(): {
  queue: PendingMessageQueue
  background: BackgroundTaskTracker
  emitted: ChatActivitySnapshot[]
  foreground: Map<string, ChatActivitySnapshot['foreground']>
  notifyLease: (key: string) => void
  projector: SessionActivityProjector
} {
  const queue = new PendingMessageQueue()
  const background = new BackgroundTaskTracker()
  const emitted: ChatActivitySnapshot[] = []
  const foreground = new Map<string, ChatActivitySnapshot['foreground']>()
  let leaseListener: ((key: string) => void) | undefined
  const projector = new SessionActivityProjector({
    queue,
    backgroundTasks: background,
    leases: {
      foreground: (sessionId) => foreground.get(sessionId) ?? 'idle',
      subscribe: (listener) => {
        leaseListener = listener
        return () => {
          leaseListener = undefined
        }
      }
    },
    emit: (snapshot) => emitted.push(snapshot)
  })
  return {
    queue,
    background,
    emitted,
    foreground,
    notifyLease: (key) => leaseListener?.(key),
    projector
  }
}

const flush = async (): Promise<void> => {
  await Promise.resolve()
}

describe('SessionActivityProjector', () => {
  it('큐의 여러 동기 전이를 한 revision 스냅샷으로 합쳐 중간 깜빡임을 노출하지 않는다', async () => {
    const f = fixture()
    f.queue.enqueue('s', { text: 'hello' }, 1, 'm1')
    const batch = f.queue.reserveHeld('s', 'turn-open', 'a1', 'c1')!
    f.queue.commit('s', batch.attemptId!, batch.chainId)
    await flush()

    expect(f.emitted).toHaveLength(1)
    expect(f.emitted[0]).toMatchObject({
      sessionId: 's',
      revision: 1,
      queuedCount: 0,
      deliveryPendingCount: 1,
      busy: true
    })
  })

  it('foreground·transport·background를 같은 권위 스냅샷에서 계산한다', async () => {
    const f = fixture()
    f.foreground.set('s', 'streaming')
    f.notifyLease('session:s')
    f.projector.setTransport('s', 'listening')
    f.background.started('s', 'task-1')
    await flush()

    expect(f.emitted.at(-1)).toMatchObject({
      foreground: 'streaming',
      transport: 'listening',
      busy: true,
      backgroundTaskCount: 1
    })
  })

  it('interrupt 생존 attempt만 residual로 세고 같은 메시지 id는 중복 계산하지 않는다', async () => {
    const f = fixture()
    f.queue.enqueue('s', { text: 'one' }, 1, 'm1')
    const batch = f.queue.reserveHeld('s', 'steer', 'a1', 'c1')!
    f.queue.commit('s', batch.attemptId!, batch.chainId)
    f.projector.setResidualAttempts('s', ['a1', 'a1', 'unknown'])
    await flush()

    expect(f.emitted.at(-1)?.residualCount).toBe(1)
    expect(f.projector.current('s').revision).toBe(f.emitted.at(-1)?.revision)
  })

  it('projection 승격 뒤 이전 lease 키의 지각 알림도 새 session 키로 흡수한다', async () => {
    const f = fixture()
    f.queue.enqueue('draft', { text: 'hello' }, 1, 'm1')
    await flush()
    const draftRevision = f.emitted.at(-1)!.revision

    f.queue.rekey('draft', 's')
    f.foreground.set('s', 'streaming')
    f.notifyLease('client:draft')
    await flush()

    expect(f.emitted.at(-1)).toMatchObject({
      sessionId: 's',
      foreground: 'streaming',
      queuedCount: 1
    })
    expect(f.emitted.at(-1)!.revision).toBeGreaterThan(draftRevision)
    expect(f.emitted.filter((snapshot) => snapshot.sessionId === 'draft')).toHaveLength(1)
  })

  it('dispose 후 이미 예약된 microtask가 이벤트를 방출하지 않는다', async () => {
    const f = fixture()
    const emit = vi.spyOn(f.emitted, 'push')
    f.queue.enqueue('s', { text: 'late' }, 1, 'm1')
    f.projector.dispose()
    await flush()
    expect(emit).not.toHaveBeenCalled()
  })

  it('삭제한 세션은 지각 lease·transport 알림으로 snapshot이 되살아나지 않는다', async () => {
    const f = fixture()
    f.queue.enqueue('s', { text: 'hello' }, 1, 'm1')
    await flush()
    expect(f.emitted).toHaveLength(1)

    f.projector.clear('s')
    f.notifyLease('session:s')
    f.projector.setTransport('s', 'idle')
    await flush()

    expect(f.emitted).toHaveLength(1)
  })
})

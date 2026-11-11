import { describe, expect, it, vi } from 'vitest'
import type { ChatActivitySnapshot } from '../../../shared/ipc'
import type { BackgroundEventSource } from '../../../shared/background-task'
import { BackgroundTaskTracker } from './background-tasks'
import { PendingMessageQueue } from './pending-message-queue'
import { SessionActivityProjector, sessionForeground } from './session-activity-projector'

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
  it('carries the canonical shared Spark count through start, live membership, completion, and reconnect', async () => {
    const f = fixture()
    const source = (sequence: number): BackgroundEventSource => ({
      generation: 'g',
      sequence,
      receivedAt: sequence,
      replay: false
    })
    try {
      f.background.observe({
        type: 'background.task',
        sessionId: 's',
        source: source(1),
        taskId: 'a',
        phase: 'started',
        patch: { status: 'running', isBackgrounded: true }
      })
      await flush()
      expect(f.emitted.at(-1)?.backgroundTaskCount).toBe(0)
      f.background.observe({
        type: 'background.snapshot',
        sessionId: 's',
        source: source(2),
        tasks: [{ taskId: 'a' }, { taskId: 'b' }, { taskId: 'ambient', ambient: true }]
      })
      await flush()
      expect(f.emitted.at(-1)?.backgroundTaskCount).toBe(2)
      f.background.observe({
        type: 'background.task',
        sessionId: 's',
        source: source(3),
        taskId: 'a',
        phase: 'notification',
        patch: { status: 'completed' }
      })
      f.background.observe({
        type: 'background.snapshot',
        sessionId: 's',
        source: source(4),
        tasks: [{ taskId: 'b' }, { taskId: 'ambient', ambient: true }]
      })
      await flush()
      expect(f.emitted.at(-1)?.backgroundTaskCount).toBe(1)
      f.background.observe({
        type: 'background.connection',
        sessionId: 's',
        source: source(5),
        state: 'resynchronizing'
      })
      await flush()
      expect(f.emitted.at(-1)?.backgroundTaskCount).toBe(0)
    } finally {
      f.projector.dispose()
    }
  })
  it('ready 수신 lease만 응답 foreground에서 제외하고 준비/활성 응답/종료를 구별한다', () => {
    expect(sessionForeground(undefined, 'ready')).toBe('idle')
    expect(sessionForeground({ kind: 'preparing', activeChild: null }, 'idle')).toBe('preparing')
    expect(sessionForeground({ kind: 'active', activeChild: {} }, 'idle')).toBe('streaming')
    expect(sessionForeground({ kind: 'active', activeChild: {} }, 'ready')).toBe('idle')
    expect(sessionForeground({ kind: 'active', activeChild: {} }, 'listening')).toBe('streaming')
    expect(sessionForeground({ kind: 'active', activeChild: null }, 'listening')).toBe('idle')
    expect(sessionForeground({ kind: 'closing', activeChild: {} }, 'listening')).toBe('idle')
  })

  it('publishes an early wakeup without inventing schedule entries and clears its flag on a full snapshot', async () => {
    const { projector, emitted } = fixture()
    projector.setSchedules('s', [], true)
    await flush()
    expect(projector.current('s')).toMatchObject({
      sessionSchedules: [],
      pendingSessionWakeup: true
    })
    const revision = emitted.at(-1)!.revision
    projector.setSchedules('s', [])
    await flush()
    expect(projector.current('s').pendingSessionWakeup).toBeUndefined()
    expect(emitted.at(-1)!.revision).toBeGreaterThan(revision)
    projector.dispose()
  })
  it('keeps live schedules available for reload and clears them on retirement/disposal', async () => {
    const { projector, emitted } = fixture()
    expect(projector.current('s').sessionSchedules).toBeUndefined()
    const schedules = [{ id: 'c', schedule: '*/5 * * * *', recurring: true, prompt: 'check' }]
    projector.setSchedules('s', schedules)
    await flush()
    expect(projector.current('s').sessionSchedules).toEqual(schedules)
    const revision = emitted.at(-1)!.revision
    projector.setSchedules(
      's',
      schedules.map((item) => ({ ...item }))
    )
    await flush()
    expect(emitted.at(-1)!.revision).toBe(revision)
    projector.setSchedules('s', [])
    await flush()
    expect(emitted.at(-1)!.sessionSchedules).toEqual([])
    projector.clear('s')
    projector.setSchedules('s', schedules)
    await flush()
    expect(emitted.at(-1)!.sessionSchedules).toEqual([])
    projector.dispose()
  })
  it('큐의 여러 동기 전이를 한 revision 스냅샷으로 합쳐 중간 깜빡임을 노출하지 않는다', async () => {
    const f = fixture()
    f.queue.enqueue('s', { text: 'hello' }, 1, 'm1')
    const batch = f.queue.reserveHeld('s', 'a1', 'c1')!
    f.queue.commitMany('s', [batch])
    await flush()

    expect(f.emitted).toHaveLength(1)
    expect(f.emitted[0]).toMatchObject({
      sessionId: 's',
      revision: 1,
      queuedCount: 0,
      deliveryPendingCount: 1
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
      backgroundTaskCount: 1
    })
  })

  it('interrupt 생존 attempt만 residual로 세고 같은 메시지 id는 중복 계산하지 않는다', async () => {
    const f = fixture()
    f.queue.enqueue('s', { text: 'one' }, 1, 'm1')
    const batch = f.queue.reserveHeld('s', 'a1', 'c1')!
    f.queue.commitMany('s', [batch])
    f.projector.setResidualAttempts('s', ['a1', 'a1', 'unknown'])
    await flush()

    expect(f.emitted.at(-1)?.residualCount).toBe(1)
    expect(f.projector.current('s').revision).toBe(f.emitted.at(-1)?.revision)
    f.projector.setResidualAttempts('s', ['unknown'])
    await flush()
    expect(f.emitted.at(-1)?.residualCount).toBe(0)
    // A confirmed batch is no longer open: its attempt id stops counting as residual.
    f.projector.setResidualAttempts('s', ['a1'])
    await flush()
    expect(f.emitted.at(-1)?.residualCount).toBe(1)
    f.queue.confirm('s', { kind: 'echo', uuid: 'a1' })
    f.projector.setResidualAttempts('s', ['a1', 'a1'])
    await flush()
    expect(f.emitted.at(-1)?.residualCount).toBe(0)
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

  it('P1/P2: emits waitPhase on streaming and skips recompute on duplicate setWaitPhase', async () => {
    const f = fixture()
    const recomputeSpy = vi.spyOn(
      f.projector as unknown as { recompute: (id: string) => void },
      'recompute'
    )
    f.foreground.set('s', 'streaming')
    f.projector.setWaitPhase('s', { kind: 'server' })
    await flush()
    expect(f.emitted).toHaveLength(1)
    expect(f.emitted[0]?.waitPhase).toEqual({ kind: 'server' })
    const rev = f.emitted[0]!.revision
    const recomputesAfterP1 = recomputeSpy.mock.calls.length

    // P2: setting the exact same waitPhase again returns early without scheduling recompute or emitting
    f.projector.setWaitPhase('s', { kind: 'server' })
    await flush()
    expect(recomputeSpy.mock.calls.length).toBe(recomputesAfterP1)
    expect(f.emitted).toHaveLength(1)
    expect(f.projector.current('s').revision).toBe(rev)
    f.projector.dispose()
  })

  it('P3: emits new snapshot when retry attempt changes from 1 to 2', async () => {
    const f = fixture()
    f.foreground.set('s', 'streaming')
    f.projector.setWaitPhase('s', { kind: 'retry', attempt: 1 })
    await flush()
    expect(f.emitted.at(-1)?.waitPhase).toEqual({ kind: 'retry', attempt: 1 })

    f.projector.setWaitPhase('s', { kind: 'retry', attempt: 2 })
    await flush()
    expect(f.emitted.at(-1)?.waitPhase).toEqual({ kind: 'retry', attempt: 2 })
    f.projector.dispose()
  })

  it('P4: clears waitPhase from snapshot when setWaitPhase(k, null) is called', async () => {
    const f = fixture()
    f.foreground.set('s', 'streaming')
    f.projector.setWaitPhase('s', { kind: 'model' })
    await flush()
    expect(f.emitted.at(-1)?.waitPhase).toEqual({ kind: 'model' })

    f.projector.setWaitPhase('s', null)
    await flush()
    expect(f.emitted.at(-1)?.waitPhase).toBeUndefined()
    f.projector.dispose()
  })

  it('P5: omits waitPhase from snapshot when foreground is idle', async () => {
    const f = fixture()
    f.foreground.set('s', 'idle')
    f.projector.setWaitPhase('s', { kind: 'model' })
    await flush()

    expect(f.projector.current('s').waitPhase).toBeUndefined()
    f.projector.dispose()
  })

  it('P6: promote("client-1", "s1") followed by setWaitPhase("client-1", {send}) updates s1', async () => {
    const f = fixture()
    f.foreground.set('client-1', 'preparing')
    f.foreground.set('s1', 'streaming')
    f.projector.setWaitPhase('client-1', { kind: 'server' })
    await flush()

    f.projector.promote('client-1', 's1')
    f.projector.setWaitPhase('client-1', { kind: 'send' })
    await flush()

    expect(f.projector.current('s1').waitPhase).toEqual({ kind: 'send' })
    f.projector.dispose()
  })

  it('P7: ignores setWaitPhase after clear("s1")', async () => {
    const f = fixture()
    f.foreground.set('s1', 'streaming')
    f.projector.setWaitPhase('s1', { kind: 'mcp' })
    await flush()
    const countBeforeClear = f.emitted.length

    f.projector.clear('s1')
    f.projector.setWaitPhase('s1', { kind: 'send' })
    await flush()

    expect(f.emitted).toHaveLength(countBeforeClear)
    f.projector.dispose()
  })

  it('P8: emits when waitPhase kind changes from {project} to {session} with all other fields identical', async () => {
    const f = fixture()
    f.foreground.set('s', 'streaming')
    f.projector.setWaitPhase('s', { kind: 'project' })
    await flush()
    const rev1 = f.emitted.at(-1)!.revision
    expect(f.emitted.at(-1)?.waitPhase).toEqual({ kind: 'project' })

    f.projector.setWaitPhase('s', { kind: 'session' })
    await flush()
    expect(f.emitted.at(-1)?.waitPhase).toEqual({ kind: 'session' })
    expect(f.emitted.at(-1)!.revision).toBeGreaterThan(rev1)
    f.projector.dispose()
  })

  it('P9: promote("client-1", "s1") transfers waitPhase set before promotion to s1', () => {
    const f = fixture()
    f.foreground.set('client-1', 'streaming')
    f.foreground.set('s1', 'streaming')
    f.projector.setWaitPhase('client-1', { kind: 'session' })
    f.projector.promote('client-1', 's1')

    expect(f.projector.current('s1').waitPhase).toEqual({ kind: 'session' })
    f.projector.dispose()
  })

  it('P10: clear("s1") deletes waitPhase from Map so later promote("client-2", "s1") leaves waitPhase undefined', () => {
    const f = fixture()
    f.foreground.set('s1', 'streaming')
    f.projector.setWaitPhase('s1', { kind: 'model' })
    f.projector.clear('s1')
    f.projector.promote('client-2', 's1')

    expect(f.projector.current('s1').waitPhase).toBeUndefined()
    f.projector.dispose()
  })

  it('P11: dispose() clears waitPhase from Map so current("s1").waitPhase is undefined', () => {
    const f = fixture()
    f.foreground.set('s1', 'streaming')
    f.projector.setWaitPhase('s1', { kind: 'model' })
    f.projector.dispose()

    expect(f.projector.current('s1').waitPhase).toBeUndefined()
  })
})

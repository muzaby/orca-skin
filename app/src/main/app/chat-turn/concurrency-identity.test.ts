import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONCURRENCY_ORDER,
  concurrencyFixtureRefs
} from '../../../shared/concurrency-order.testfixture'
import type { NormalizedEvent } from '../../../shared/ipc'
import { makeClassifiedError } from '../../infra/errors'
import type { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import { concurrencyFixture } from './concurrency-identity.testfixture'

// 정본 시드 — 어댑터 `providerEvents` 가 들어오는 진입점(`observe`)으로 live 집합을 세운다.
let backgroundSeedSequence = 0
function seedLiveBackgroundSnapshot(
  tracker: BackgroundTaskTracker,
  sessionId: string,
  taskIds: string[]
): void {
  backgroundSeedSequence += 1
  tracker.observe({
    type: 'background.snapshot',
    sessionId,
    tasks: taskIds.map((taskId) => ({ taskId })),
    source: {
      generation: 'seed',
      sequence: backgroundSeedSequence,
      receivedAt: backgroundSeedSequence,
      replay: false
    }
  })
}
function seedLiveBackgroundTask(
  tracker: BackgroundTaskTracker,
  sessionId: string,
  taskId: string
): void {
  seedLiveBackgroundSnapshot(tracker, sessionId, [taskId])
}

const terminal: NormalizedEvent = { type: 'telemetry', sessionId: 's1' }
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function expectedLists(id: string): unknown[] {
  return CONCURRENCY_ORDER.find((scenario) => scenario.id === id)!.lists.map((tags) => ({
    projectId: 'p1',
    turns: concurrencyFixtureRefs(tags)
  }))
}

afterEach(() => vi.useRealTimers())

describe('IT-03 coordinator identity snapshots and real Stop/send-now handlers', () => {
  it('SD-1 P1 emits the fixture list column through begin, promote, confirm and end', async () => {
    const f = concurrencyFixture()
    f.turn.isNewSession = true
    f.turn.dbSessionId = null
    f.turn.queueKey = 'draft:a'
    f.supervisor.startNew(f.turn.owner, f.turn)
    const running = f.coordinator.run(
      f.turn,
      { ...f.request, sessionId: null },
      { sharedPathProjectId: 'p1' }
    )
    try {
      f.emit(
        { type: 'session.updated', sessionId: 's1', patch: {} },
        { type: 'message.completed', sessionId: 's1', message: { text: 'done' } },
        terminal,
        { type: 'turn.ended', sessionId: 's1' }
      )
      await running
      expect(f.supervisor.getBySession('s1')).toBe(f.turn)
      expect(f.concurrency).toEqual(expectedLists('P1'))
    } finally {
      f.cleanup()
      await running
    }
  })

  it.each(['P2', 'P5', 'P7'] as const)(
    'SD-1 %s real continuation path produces fixture K',
    async (id) => {
      const f = concurrencyFixture()
      const running = f.run()
      try {
        await tick()
        if (id === 'P5') await f.stop()
        if (id === 'P7') {
          f.queueHeld('next', 'queued-next')
          await f.sendNow()
          f.emit(terminal)
          await vi.waitFor(() => expect(f.pushed).toEqual(['next']))
        }
        f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'answer' } }, terminal)
        await running
        expect(f.concurrency).toEqual(expectedLists(id))
        expect(f.supervisor.activeTurns.turns('p1')).toEqual([])
      } finally {
        f.cleanup()
        await running
      }
    }
  )

  it('listen receives the accounting project but does not enter the tracker', async () => {
    const f = concurrencyFixture()
    const run = vi.spyOn(f.coordinator, 'run')
    seedLiveBackgroundTask(f.backgroundTasks, 's1', 'background')
    const running = f.run()
    try {
      f.emit(terminal)
      await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2))
      expect(run.mock.calls[1][2]).toEqual({ sharedPathProjectId: 'p1', kind: 'listen' })
      expect(f.concurrency).toEqual(expectedLists('P2'))
      // 다음 snapshot 에서 빠지면 더는 대기가 아니다 — 중단 뒤 루프가 listen 을 다시 열지 않는다.
      seedLiveBackgroundSnapshot(f.backgroundTasks, 's1', [])
      await f.stop()
      f.emit(terminal)
      await running
      expect(f.concurrency).toEqual(expectedLists('P2'))
    } finally {
      f.cleanup()
      await running
    }
  })

  it('isolated accounting project produces no concurrency events even through continuation', async () => {
    const f = concurrencyFixture({ sharedPathProjectId: null })
    const running = f.run()
    try {
      await tick()
      f.queueHeld('next', 'queued-next')
      await f.sendNow()
      f.emit(terminal)
      await vi.waitFor(() => expect(f.pushed).toEqual(['next']))
      f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'answer' } }, terminal)
      await running
      expect(f.concurrency).toEqual([])
    } finally {
      f.cleanup()
      await running
    }
  })

  it('AC5 stream exception removes the live token', async () => {
    const error = makeClassifiedError('stream_error', 'broken stream')
    error.retryable = false
    const f = concurrencyFixture({ classifyError: () => error })
    vi.spyOn(f.runtime, 'send').mockImplementation(() =>
      (async function* (): AsyncGenerator<NormalizedEvent> {
        yield* []
        throw new Error('broken stream')
      })()
    )
    try {
      await f.coordinator.run(f.turn, f.request, { sharedPathProjectId: 'p1' })
      expect(f.concurrency).toEqual(expectedLists('P2'))
      expect(f.supervisor.activeTurns.turns('p1')).toEqual([])
    } finally {
      f.cleanup()
    }
  })

  it('AC5 cancellation before start never begins a token', async () => {
    const f = concurrencyFixture()
    f.turn.controller.abort()
    try {
      await f.coordinator.run(f.turn, f.request, { sharedPathProjectId: 'p1' })
      expect(f.concurrency).toEqual([])
    } finally {
      f.cleanup()
    }
  })

  it('AC5 retry ends each attempt before beginning again', async () => {
    vi.useFakeTimers()
    const error = makeClassifiedError('stream_error', 'retry')
    error.retryable = true
    const f = concurrencyFixture({ classifyError: () => error })
    const runtimeSend = f.runtime.send.bind(f.runtime)
    vi.spyOn(f.runtime, 'send')
      .mockImplementationOnce(() =>
        (async function* (): AsyncGenerator<NormalizedEvent> {
          yield* []
          throw new Error('retry')
        })()
      )
      .mockImplementation(runtimeSend)
    const running = f.coordinator.run(f.turn, f.request, { sharedPathProjectId: 'p1' })
    try {
      await vi.advanceTimersByTimeAsync(1_000)
      f.emit({ type: 'message.delta', sessionId: 's1', delta: { text: 'answer' } }, terminal)
      await running
      expect(f.concurrency).toEqual([...expectedLists('P2'), ...expectedLists('P2')])
    } finally {
      f.cleanup()
      await running
    }
  })
})

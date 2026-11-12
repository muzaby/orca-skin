import { describe, expect, it } from 'vitest'
import { scaleMs } from '../../../../scripts/test-time.mjs'
import { BackgroundTaskTracker } from './background-tasks'
import {
  applyBackgroundEvent,
  countedBackgroundTaskIds,
  emptyBackgroundState
} from '../../../shared/background-task'

describe('canonical Spark count (0249)', () => {
  it('uses the shared live set with ambient and unknown snapshots excluded', () => {
    const tracker = new BackgroundTaskTracker()
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 'a' }, { taskId: 'b' }, { taskId: 'ambient', ambient: true }]
    })
    tracker.restore('s', state)
    tracker.restore('unknown', { ...state, liveKnown: false })
    expect(tracker.count('s')).toBe(countedBackgroundTaskIds(state).length)
    expect(tracker.count('s')).toBe(2)
    expect(tracker.count('unknown')).toBe(0)
    tracker.observe({
      type: 'background.task',
      sessionId: 's',
      taskId: 'a',
      phase: 'notification',
      source: { generation: 'g', sequence: 2, receivedAt: 2, replay: false },
      patch: { status: 'completed' }
    })
    tracker.observe({
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 3, receivedAt: 3, replay: false },
      tasks: [{ taskId: 'b' }, { taskId: 'ambient', ambient: true }]
    })
    expect(tracker.count('s')).toBe(1)
    expect(tracker.count('s')).toBe(countedBackgroundTaskIds(tracker.getState('s')).length)
  })
})

// ── 0314 — 네 동작은 정본 상태만으로 답한다 (plan §10 규칙 A~D) ─────────────────
//
// 시드는 전부 `tracker.observe(event)` 다 — 어댑터 `providerEvents` 가 들어오는 그 진입점이다.

type Observed = Parameters<BackgroundTaskTracker['observe']>[0]
let seq = 0
const src = (generation = 'g'): Observed['source'] => {
  seq += 1
  return { generation, sequence: seq, receivedAt: seq, replay: false }
}
const call = (
  toolUseId: string,
  mode: 'foreground' | 'background',
  generation = 'g'
): Observed => ({
  type: 'background.call',
  sessionId: 's',
  toolUseId,
  phase: 'progress',
  patch: { mode, status: 'running' },
  source: src(generation)
})
const task = (
  taskId: string,
  phase: 'started' | 'notification',
  patch: Extract<Observed, { type: 'background.task' }>['patch'],
  toolUseId?: string,
  generation = 'g'
): Observed => ({
  type: 'background.task',
  sessionId: 's',
  taskId,
  ...(toolUseId ? { toolUseId } : {}),
  phase,
  patch,
  source: src(generation)
})
const snapshot = (taskIds: string[], generation = 'g'): Observed => ({
  type: 'background.snapshot',
  sessionId: 's',
  tasks: taskIds.map((taskId) => ({ taskId })),
  source: src(generation)
})
const connection = (
  state: Extract<Observed, { type: 'background.connection' }>['state'],
  generation = 'g'
): Observed => ({ type: 'background.connection', sessionId: 's', state, source: src(generation) })
const control = (taskId: string, state: 'requested' | 'acknowledged'): Observed => ({
  type: 'background.control',
  sessionId: 's',
  taskId,
  state,
  source: src()
})
const seeded = (...events: Observed[]): BackgroundTaskTracker => {
  const tracker = new BackgroundTaskTracker()
  for (const event of events) tracker.observe(event)
  return tracker
}
type TaskRecord = ReturnType<BackgroundTaskTracker['getState']>['tasks'][string]
const taskOf = (tracker: BackgroundTaskTracker, taskId: string, generation = 'g'): TaskRecord =>
  tracker.getState('s').tasks[JSON.stringify([generation, taskId])]

describe('규칙 A — isAsyncLaunched 는 정본 호출·작업 기록으로 답한다 (0314)', () => {
  it('A1 — 정본이 없는 세션은 false', () => {
    expect(new BackgroundTaskTracker().isAsyncLaunched('s', 'tu')).toBe(false)
  })

  it('A2 — 현재 세대 호출이 background 모드면 작업 연결 없이도 true', () => {
    const tracker = seeded(call('tu', 'background'))
    expect(tracker.getState('s').calls[JSON.stringify(['g', 'tu'])].taskId).toBeUndefined()
    expect(tracker.isAsyncLaunched('s', 'tu')).toBe(true)
  })

  it('A3 — 호출은 foreground 여도 연결된 작업이 isBackgrounded:true 면 true', () => {
    const tracker = seeded(
      call('tu', 'foreground'),
      task('t', 'started', { status: 'running', isBackgrounded: true }, 'tu')
    )
    expect(taskOf(tracker, 't').liveMembership).toBe('unknown')
    expect(tracker.isAsyncLaunched('s', 'tu')).toBe(true)
  })

  it('A4 — isBackgrounded 미설정이어도 연결된 작업이 snapshot 에 포함되면 true, 빠지면 false', () => {
    const tracker = seeded(
      call('tu', 'foreground'),
      task('t', 'started', { status: 'running' }, 'tu')
    )
    expect(tracker.isAsyncLaunched('s', 'tu')).toBe(false)
    tracker.observe(snapshot(['t']))
    expect(taskOf(tracker, 't').isBackgrounded).toBeUndefined()
    expect(tracker.isAsyncLaunched('s', 'tu')).toBe(true)
    tracker.observe(snapshot([]))
    expect(taskOf(tracker, 't').liveMembership).toBe('excluded')
    expect(tracker.isAsyncLaunched('s', 'tu')).toBe(false)
  })

  it('A5 — foreground 호출 · isBackgrounded:false 작업 · snapshot 없음이면 false', () => {
    const tracker = seeded(
      call('tu', 'foreground'),
      task('t', 'started', { status: 'running', isBackgrounded: false }, 'tu')
    )
    expect(tracker.isAsyncLaunched('s', 'tu')).toBe(false)
  })

  it('A6 — 새 세대 이벤트가 오면 이전 세대의 같은 toolUseId 는 false', () => {
    const tracker = seeded(call('tu', 'background'))
    expect(tracker.isAsyncLaunched('s', 'tu')).toBe(true)
    tracker.observe(connection('connected', 'g2'))
    expect(tracker.isAsyncLaunched('s', 'tu')).toBe(false)
  })
})

describe('규칙 B — hasPending 은 정본 대기 판정을 그대로 돌려준다 (0314)', () => {
  it('B1 — 정본이 없는 세션은 대기가 아니다', () => {
    expect(new BackgroundTaskTracker().hasPending('s')).toBe(false)
  })

  it('B4 → B2 — snapshot 에 작업이 있으면 대기이고, 연결이 terminated 되면 대기가 아니다', () => {
    const tracker = seeded(snapshot(['t']))
    expect(tracker.hasPending('s')).toBe(true)
    tracker.observe(connection('terminated'))
    expect(tracker.hasPending('s')).toBe(false)
  })

  it('B3 — 연결이 resynchronizing 이면 작업이 없어도 대기다', () => {
    const tracker = seeded(connection('connected'))
    expect(tracker.hasPending('s')).toBe(false)
    tracker.observe(connection('resynchronizing'))
    expect(tracker.hasPending('s')).toBe(true)
  })

  it('B5 — 영수증만 온 background 호출은 live 집합이 비어도 대기다', () => {
    const tracker = seeded(call('tu', 'background'))
    expect(tracker.count('s')).toBe(0)
    expect(tracker.hasPending('s')).toBe(true)
  })

  it('B6 · B7 — 포그라운드 running 작업은 대기가 아니고 백그라운드 running 작업은 대기다', () => {
    const foreground = seeded(task('t', 'started', { status: 'running', isBackgrounded: false }))
    expect(foreground.hasPending('s')).toBe(false)
    const background = seeded(task('t', 'started', { status: 'running', isBackgrounded: true }))
    expect(background.count('s')).toBe(0)
    expect(background.hasPending('s')).toBe(true)
  })

  it('B8 — snapshot 에서 빠진 running 작업은 대기가 아니다', () => {
    const tracker = seeded(
      task('t', 'started', { status: 'running', isBackgrounded: true }),
      snapshot(['t']),
      snapshot([])
    )
    expect(taskOf(tracker, 't')).toMatchObject({ status: 'running', liveMembership: 'excluded' })
    expect(tracker.hasPending('s')).toBe(false)
  })

  it.each(['requested', 'acknowledged'] as const)(
    'B9 — 중단 %s 인 백그라운드 작업은 live 집합에서 빠져도 대기다',
    (state) => {
      const tracker = seeded(
        task('t', 'started', { status: 'running', isBackgrounded: true }),
        snapshot(['t']),
        snapshot([])
      )
      expect(tracker.hasPending('s')).toBe(false)
      tracker.observe(control('t', state))
      expect(tracker.count('s')).toBe(0)
      expect(tracker.hasPending('s')).toBe(true)
    }
  )
})

describe('규칙 C — 레벨 신호(snapshot)가 live 집합을 교체한다 (0314)', () => {
  it('C1 — 첫 snapshot 부터 live 집합을 세운다', () => {
    const tracker = seeded(snapshot(['t']))
    expect(tracker.count('s')).toBe(1)
    expect(taskOf(tracker, 't').liveMembership).toBe('included')
  })

  it('C2 — 종료 통지 없이 빠진 작업은 대기·개수에서 빠지고 종료 상태를 지어내지 않는다', () => {
    const tracker = seeded(
      task('t', 'started', { status: 'running', isBackgrounded: true }),
      snapshot(['t'])
    )
    expect(tracker.hasPending('s')).toBe(true)
    tracker.observe(snapshot([]))
    expect(tracker.hasPending('s')).toBe(false)
    expect(tracker.count('s')).toBe(0)
    expect(taskOf(tracker, 't').status).toBe('running')
    expect(taskOf(tracker, 't').terminalEvidence).toEqual([])
  })

  it('C3 — 빠진 뒤 같은 작업의 started 가 다시 오면 unknown 으로 돌아가 대기다', () => {
    const tracker = seeded(
      task('t', 'started', { status: 'running', isBackgrounded: true }),
      snapshot(['t']),
      snapshot([])
    )
    tracker.observe(task('t', 'started', { status: 'running', isBackgrounded: true }))
    expect(taskOf(tracker, 't').liveMembership).toBe('unknown')
    expect(tracker.hasPending('s')).toBe(true)
  })

  it('C4 — 새 세대 첫 이벤트는 이전 세대 집합을 버리고 새 세대 작업을 지우지 않는다', () => {
    const tracker = seeded(snapshot(['old']))
    expect(tracker.count('s')).toBe(1)
    tracker.observe(task('new', 'started', { status: 'running', isBackgrounded: true }, 'tu', 'g2'))
    expect(tracker.getState('s').liveKnown).toBe(false)
    expect(tracker.count('s')).toBe(0)
    expect(taskOf(tracker, 'new', 'g2')).toMatchObject({
      status: 'running',
      liveMembership: 'unknown'
    })
  })
})

describe('규칙 D — 채널 사망과 확정 없는 중단 (0314)', () => {
  it('D1 — 연결 terminated 는 대기를 풀 뿐 합성 failed 를 만들지 않는다', () => {
    const tracker = seeded(
      task('t', 'started', { status: 'running', isBackgrounded: true }, 'tu'),
      snapshot(['t'])
    )
    expect(tracker.count('s')).toBe(1)
    tracker.observe(connection('terminated'))
    expect(tracker.hasPending('s')).toBe(false)
    expect(tracker.count('s')).toBe(0)
    expect(taskOf(tracker, 't').status).toBe('running')
    expect(taskOf(tracker, 't').terminalEvidence).toEqual([])
  })

  it('D3 — 정본에 작업이 있고 종료 통지가 없으면 waitForTask 는 timeout 이다', async () => {
    const tracker = seeded(task('t', 'started', { status: 'running', isBackgrounded: true }, 'tu'))
    await expect(tracker.waitForTask('s', 'tu', { timeoutMs: 5 })).resolves.toBe('timeout')
  })

  it('D4 — 정본이 없으면 waitForTask 는 즉시 settled 다', async () => {
    const tracker = new BackgroundTaskTracker()
    // timeout 이 먼저 이길 수 없는 값이다 — 대기로 바뀌면 이 케이스는 테스트 예산에서 끊긴다.
    await expect(tracker.waitForTask('s', 'tu', { timeoutMs: scaleMs(600_000) })).resolves.toBe(
      'settled'
    )
  })

  it('D4 — 종료 통지가 도착하면 그때 settled 다', async () => {
    const tracker = seeded(task('t', 'started', { status: 'running', isBackgrounded: true }, 'tu'))
    const waiting = tracker.waitForTask('s', 'tu', { timeoutMs: scaleMs(1_000) })
    let outcome: string | undefined
    void waiting.then((value) => (outcome = value))
    await Promise.resolve()
    expect(outcome).toBeUndefined()
    tracker.observe(task('t', 'notification', { status: 'completed' }, 'tu'))
    await expect(waiting).resolves.toBe('settled')
  })

  it('D4 — 다른 세션·다른 작업의 종료 통지에는 깨어나지 않는다', async () => {
    const tracker = seeded(
      task('t', 'started', { status: 'running', isBackgrounded: true }, 'tu'),
      task('t2', 'started', { status: 'running', isBackgrounded: true }, 'tu2')
    )
    const waiting = tracker.waitForTask('s', 'tu', { timeoutMs: 20 })
    tracker.observe(task('t2', 'notification', { status: 'completed' }, 'tu2'))
    tracker.observe({
      ...task('t', 'notification', { status: 'completed' }, 'tu'),
      sessionId: 'other'
    })
    await expect(waiting).resolves.toBe('timeout')
  })
})

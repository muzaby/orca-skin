import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import { stopSubagentTask, STOP_SETTLE_TIMEOUT_MS, type StopSubagentTracker } from './stop-subagent'

type W = string
type SubagentEvent = Extract<NormalizedEvent, { type: 'subagent.task' }>

interface LiveStub {
  backgroundTask: ReturnType<typeof vi.fn>
  stopTask: ReturnType<typeof vi.fn>
}

function liveStub(overrides: Partial<LiveStub> = {}): LiveStub {
  return {
    backgroundTask: vi.fn(async () => true),
    stopTask: vi.fn(async () => undefined),
    ...overrides
  }
}

function turnWith(opts: { live?: LiveStub | null; taskId?: string; subagentType?: string } = {}): {
  turn: TurnContext<W>
  openToolRuns: Map<string, { parentToolRunId?: string }>
} {
  const openToolRuns = new Map<string, { parentToolRunId?: string }>([['a1', {}]])
  const turn = {
    owner: 'owner-1',
    dbSessionId: 'sess-1',
    live: opts.live === undefined ? liveStub() : opts.live,
    openToolRuns,
    subagentTaskIds: new Map(opts.taskId ? [['a1', opts.taskId]] : []),
    subagentTypes: new Map(opts.subagentType ? [['a1', opts.subagentType]] : []),
    stoppedSubagents: new Set<string>(),
    blockedSubagents: new Set<string>()
  } as unknown as TurnContext<W>
  return { turn, openToolRuns }
}

function trackerStub(overrides: Partial<StopSubagentTracker> = {}): StopSubagentTracker {
  return {
    isAsyncLaunched: vi.fn(() => true),
    settled: vi.fn(),
    waitForTask: vi.fn(async () => 'settled' as const),
    ...overrides
  }
}

const req = { sessionId: 'sess-1', toolUseId: 'a1' }

describe('stopSubagentTask — 요청 (AC12·AC16)', () => {
  it('SDK 확정을 기다리며, 요청 시점에는 합성 정착을 하지 않는다', async () => {
    const { turn } = turnWith({ taskId: 'task-9' })
    const tracker = trackerStub()
    const settle = vi.fn()

    await stopSubagentTask(turn, req, { tracker, settle })

    // 0143 의 낙관 정착이 사라졌다 — 확정 전에는 transcript 를 건드리지 않는다(D-005).
    expect(settle).not.toHaveBeenCalled()
    expect(tracker.settled).not.toHaveBeenCalled()
    expect(tracker.waitForTask).toHaveBeenCalledWith('sess-1', 'a1', {
      timeoutMs: STOP_SETTLE_TIMEOUT_MS
    })
  })

  it('중단 표식을 남겨 뒤늦은 정착이 stopped 로 강등되게 한다', async () => {
    const { turn } = turnWith({ taskId: 'task-9', subagentType: 'Explore' })
    await stopSubagentTask(turn, req, { tracker: trackerStub(), settle: vi.fn() })
    expect(turn.stoppedSubagents.has('a1')).toBe(true)
    expect(turn.blockedSubagents.has('Explore')).toBe(true)
  })

  it('turn 전체를 중단하지 않는다 — 다른 열린 도구는 그대로다', async () => {
    const { turn, openToolRuns } = turnWith({ taskId: 'task-9' })
    openToolRuns.set('other-tool', {})
    await stopSubagentTask(turn, req, { tracker: trackerStub(), settle: vi.fn() })
    expect(openToolRuns.has('other-tool')).toBe(true)
    expect(openToolRuns.has('a1')).toBe(true)
  })

  it('이미 background 로 뜬 태스크는 backgroundTask 선행을 건너뛰고 stopTask 로 직행한다', async () => {
    const live = liveStub()
    const { turn } = turnWith({ live, taskId: 'task-9' })
    await stopSubagentTask(turn, req, {
      tracker: trackerStub({ isAsyncLaunched: vi.fn(() => true) }),
      settle: vi.fn()
    })
    expect(live.backgroundTask).not.toHaveBeenCalled()
    expect(live.stopTask).toHaveBeenCalledWith('task-9')
  })

  it('taskId 미상은 실패가 아니다 — backgroundTask 만 하고 coordinator 에 넘긴다', async () => {
    const live = liveStub()
    const { turn } = turnWith({ live })
    await stopSubagentTask(turn, req, {
      tracker: trackerStub({ isAsyncLaunched: vi.fn(() => false) }),
      settle: vi.fn()
    })
    expect(live.backgroundTask).toHaveBeenCalledWith('a1')
    expect(live.stopTask).not.toHaveBeenCalled()
    expect(turn.stoppedSubagents.has('a1')).toBe(true)
  })
})

describe('stopSubagentTask — 요청 실패 (AC14)', () => {
  it('채널이 죽었으면 throw 하고 중단 표식을 되돌린다', async () => {
    const { turn } = turnWith({ live: null, subagentType: 'Explore' })
    const tracker = trackerStub()

    await expect(stopSubagentTask(turn, req, { tracker, settle: vi.fn() })).rejects.toThrow(
      /channel is not live/
    )

    // 되돌리지 않으면 계속 도는 태스크의 나중 정착이 'stopped' 로 강등된다.
    expect(turn.stoppedSubagents.has('a1')).toBe(false)
    expect(turn.blockedSubagents.has('Explore')).toBe(false)
    expect(tracker.waitForTask).not.toHaveBeenCalled()
  })

  it('stopTask 가 거절하면 그대로 전파한다 — 삼키지 않는다', async () => {
    const live = liveStub({
      stopTask: vi.fn(async () => Promise.reject(new Error('stop rejected')))
    })
    const { turn } = turnWith({ live, taskId: 'task-9' })

    await expect(
      stopSubagentTask(turn, req, { tracker: trackerStub(), settle: vi.fn() })
    ).rejects.toThrow('stop rejected')
    expect(turn.stoppedSubagents.has('a1')).toBe(false)
  })
})

describe('stopSubagentTask — watchdog (AC15)', () => {
  it('확정이 없으면 합성 정착으로 마감한다 — 중단 중 고착 없음', async () => {
    const { turn } = turnWith({ taskId: 'task-9' })
    const tracker = trackerStub({ waitForTask: vi.fn(async () => 'timeout' as const) })
    const settle = vi.fn()
    const onWatchdog = vi.fn()

    await stopSubagentTask(turn, req, { tracker, settle, onWatchdog, timeoutMs: 5 })

    expect(onWatchdog).toHaveBeenCalledWith({ sessionId: 'sess-1', toolUseId: 'a1', timeoutMs: 5 })
    expect(tracker.settled).toHaveBeenCalledWith('sess-1', 'a1')
    expect(settle).toHaveBeenCalledTimes(1)
    const ev = settle.mock.calls[0][1] as SubagentEvent
    expect(ev).toMatchObject({ type: 'subagent.task', phase: 'settled', status: 'stopped' })
    // 사용자 자기 행위의 통지는 소음(0143) — background 플래그를 싣지 않는다.
    expect(ev.background).toBeUndefined()
  })

  it('확정이 오면 watchdog 은 발화하지 않는다', async () => {
    const { turn } = turnWith({ taskId: 'task-9' })
    const tracker = trackerStub()
    const onWatchdog = vi.fn()
    await stopSubagentTask(turn, req, { tracker, settle: vi.fn(), onWatchdog })
    expect(onWatchdog).not.toHaveBeenCalled()
    expect(tracker.settled).not.toHaveBeenCalled()
  })
})

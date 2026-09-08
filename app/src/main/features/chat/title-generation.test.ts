import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TurnContext } from '../../contracts/turn'
import type { RuntimeTitleAdapter } from '../../contracts/ports'
import type { DbQueries } from '../../infra/db'
import { TitleGenerator } from './title-generation'
import { broadcastSessionTitle } from '../../infra/ipc/send'

vi.mock('../../infra/ipc/send', () => ({ broadcastSessionTitle: vi.fn() }))

function turn(adapter: RuntimeTitleAdapter, sessionId = 's1'): TurnContext {
  return {
    agentKind: 'coding',
    controller: new AbortController(),
    owner: {},
    live: null,
    titleAdapter: adapter,
    providerKey: null,
    pendingUserText: null,
    firstUserText: '첫 질문',
    pendingAttachmentViews: [],
    dbSessionId: sessionId,
    pendingProjectId: null,
    isNewSession: true,
    sessionBaseline: null,
    sessionBaselineRef: null,
    cwd: '/work',
    extraDirs: [],
    titleGenerationStarted: false,
    currentAssistantMessageId: null,
    assistantText: '',
    pendingAskAnswers: [],
    askPendingIds: [],
    askResolved: new Map(),
    subagentTaskIds: new Map(),
    openToolRuns: new Map(),
    subagentTypes: new Map(),
    blockedSubagents: new Set(),
    stoppedSubagents: new Set()
  }
}

describe('TitleGenerator lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  function fixture(): {
    generator: TitleGenerator
    db: {
      getTitleSource: ReturnType<typeof vi.fn>
      updateSessionTitleAuto: ReturnType<typeof vi.fn>
    }
    complete: ReturnType<typeof vi.fn<RuntimeTitleAdapter['complete']>>
    adapter: RuntimeTitleAdapter
    resolve: (title: string) => void
  } {
    let resolve!: (title: string) => void
    const promise = new Promise<string>((done) => {
      resolve = done
    })
    const complete = vi.fn<RuntimeTitleAdapter['complete']>(() => promise)
    const adapter: RuntimeTitleAdapter = { id: 'claude', complete }
    const db = { getTitleSource: vi.fn(() => 'auto'), updateSessionTitleAuto: vi.fn(() => true) }
    return {
      generator: new TitleGenerator(db as unknown as DbQueries),
      db,
      complete,
      adapter,
      resolve
    }
  }

  it('정상 완료는 제목을 저장·발신하고 timer를 회수한다', async () => {
    const { generator, adapter, complete, resolve, db } = fixture()
    generator.maybeStart(turn(adapter))
    resolve('"정상 제목"')
    await Promise.resolve()
    expect(db.updateSessionTitleAuto).toHaveBeenCalledWith('s1', '정상 제목', expect.any(Number))
    expect(broadcastSessionTitle).toHaveBeenCalledExactlyOnceWith({
      sessionId: 's1',
      title: '정상 제목'
    })
    expect(vi.getTimerCount()).toBe(0)
    generator.dispose()
    expect(complete.mock.calls[0][0].signal?.aborted).toBe(false)
  })

  it('dispose는 진행 중 모든 제목 요청을 abort하며 반복 호출도 안전하다', async () => {
    const { generator, adapter, complete, resolve } = fixture()
    generator.maybeStart(turn(adapter))
    generator.maybeStart(turn(adapter, 's2'))
    const signals = complete.mock.calls.map(([req]) => req.signal!)
    expect(signals.every((signal) => !signal.aborted)).toBe(true)
    generator.dispose()
    generator.dispose()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    resolve('늦은 제목')
    await Promise.resolve()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('abort를 무시한 늦은 completion도 dispose 이후 DB와 renderer를 건드리지 않는다', async () => {
    const { generator, adapter, resolve, db } = fixture()
    generator.maybeStart(turn(adapter))
    generator.dispose()
    resolve('늦은 제목')
    await Promise.resolve()
    expect(db.updateSessionTitleAuto).not.toHaveBeenCalled()
    expect(broadcastSessionTitle).not.toHaveBeenCalled()
  })

  it('dispose 이후 새 이벤트는 DB 조회나 생성 요청을 시작하지 않는다', () => {
    const { generator, adapter, complete, db } = fixture()
    generator.dispose()
    generator.maybeStart(turn(adapter))
    expect(db.getTitleSource).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})

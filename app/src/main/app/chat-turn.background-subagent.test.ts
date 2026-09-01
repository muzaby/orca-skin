// 0212 AC25(ΔV1) — **관측 지점은 `turn.live.backgroundTask` 포트다.** renderer 경계(`chatApi`)
// 에서 인자를 세는 단언은 main 핸들러 본문을 지워도 초록이라 이 AC 를 닫지 못한다(r1 verify D3).
// `ipcMain.handle` 을 맵으로 포획해 실제 등록된 핸들러를 부르는 선례를 그대로 쓴다 —
// `chat-turn.runtime-tools.test.ts` 가 같은 `registerChatHandlers` 를 이 방식으로 부른다.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CHANNELS } from '../../shared/ipc'

const harness = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(
      (channel: string, handler: (event: unknown, raw: unknown) => Promise<unknown>) => {
        harness.handlers.set(channel, handler)
      }
    )
  }
}))

vi.mock('../infra/ipc/send', () => ({ sendChatEvent: vi.fn() }))

import { registerChatHandlers } from './chat-turn'

type Turn = { live: { backgroundTask: ReturnType<typeof vi.fn> } | null } | undefined

function install(turn: Turn): void {
  harness.handlers.clear()
  registerChatHandlers({
    ctx: {},
    supervisor: { getBySession: vi.fn(() => turn) },
    bus: { emit: vi.fn() },
    approvals: { isSessionAllowed: vi.fn(), register: vi.fn() },
    persistence: { flushAskAnswers: vi.fn(), finalizeTurn: vi.fn() },
    permissionModes: { setMode: vi.fn() },
    pendingMessages: { cancelAllHeld: vi.fn(() => []) },
    backgroundTasks: { clear: vi.fn(), settled: vi.fn(), isAsyncLaunched: vi.fn(() => false) },
    activity: { setTransport: vi.fn(), setResidualAttempts: vi.fn(), clear: vi.fn() },
    isUpdateInstallPending: () => false
  } as never)
}

function invoke(payload: unknown): Promise<unknown> {
  const handler = harness.handlers.get(CHANNELS.chatBackgroundSubagent)
  if (!handler) throw new Error('backgroundSubagent handler was not registered')
  return handler({ sender: {} }, payload)
}

function liveTurn(moved: boolean): { live: { backgroundTask: ReturnType<typeof vi.fn> } } {
  return { live: { backgroundTask: vi.fn(async () => moved) } }
}

describe('registerChatHandlers — chatBackgroundSubagent 배선 (0212 AR-04 · §10 EP-14)', () => {
  beforeEach(() => harness.handlers.clear())

  it('채널을 등록한다', () => {
    install(liveTurn(true))
    expect(harness.handlers.has(CHANNELS.chatBackgroundSubagent)).toBe(true)
  })

  it('요청받은 toolUseId 로 포트를 정확히 1회 부른다 — 두 요청의 인자가 각각 실린다', async () => {
    // 두 번 부르는 이유: 한 번이면 인자를 상수로 굳힌 배선도 통과한다. 호출 목록 전체를
    // 비교해야 "그 id 로" 가 잠긴다.
    const turn = liveTurn(true)
    install(turn)

    await invoke({ sessionId: 's1', toolUseId: 'use1' })
    await invoke({ sessionId: 's1', toolUseId: 'use2' })

    expect(turn.live.backgroundTask.mock.calls).toEqual([['use1'], ['use2']])
  })

  it('포트가 false 를 돌려주면 reject 한다 — 조용한 성공은 화면에서 무변화가 된다', async () => {
    const turn = liveTurn(false)
    install(turn)

    await expect(invoke({ sessionId: 's1', toolUseId: 'use1' })).rejects.toThrow(
      'no foreground task'
    )
    // 실패해도 포트에는 갔다 — 도달 전 조기 반환과 구분한다.
    expect(turn.live.backgroundTask.mock.calls).toEqual([['use1']])
  })

  it('턴이 없거나 live 런타임이 없으면 reject 한다', async () => {
    install(undefined)
    await expect(invoke({ sessionId: 's1', toolUseId: 'use1' })).rejects.toThrow('no active turn')

    install({ live: null })
    await expect(invoke({ sessionId: 's1', toolUseId: 'use1' })).rejects.toThrow('no live runtime')
  })

  it('스키마 위반 payload 는 reject 되고 포트에 닿지 않는다', async () => {
    const turn = liveTurn(true)
    install(turn)

    await expect(invoke({ sessionId: 's1' })).rejects.toThrow()
    expect(turn.live.backgroundTask).not.toHaveBeenCalled()
  })
})

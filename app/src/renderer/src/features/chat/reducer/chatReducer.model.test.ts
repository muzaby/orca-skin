import { describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import { type ChatAction, type ChatState, chatReducer, initialChatState } from './chatReducer'

const recv = (event: NormalizedEvent): ChatAction => ({ type: 'RECV_EVENT', event })

// 0119 — 진행 턴 provider 스냅샷(turnProviderKey): BEGIN_TURN 에서 고정, 턴 종료 4경로에서
// 초기화, SET_MODEL(선택 변경)로부터 보호. steer 게이트(lib/steerGate)가 이 값을 비교한다.
describe('chatReducer turnProviderKey 스냅샷(0119)', () => {
  const withProvider: ChatState = {
    ...initialChatState,
    sessionId: 's1',
    backend: 'claude',
    providerKey: 'claude-anthropic',
    modelFamily: 'opus'
  }

  it('BEGIN_TURN 은 현재 providerKey 를 스냅샷한다', () => {
    const next = chatReducer(withProvider, { type: 'BEGIN_TURN' })
    expect(next.inflight).toBe(true)
    expect(next.turnProviderKey).toBe('claude-anthropic')
  })

  it('SET_MODEL 은 providerKey 만 바꾸고 스냅샷은 건드리지 않는다', () => {
    const started = chatReducer(withProvider, { type: 'BEGIN_TURN' })
    const next = chatReducer(started, {
      type: 'SET_MODEL',
      providerKey: 'claude-zai',
      modelFamily: 'glm',
      modelAlias: null,
      adapter: 'claude'
    })
    expect(next.providerKey).toBe('claude-zai')
    expect(next.turnProviderKey).toBe('claude-anthropic')
  })

  it.each<[string, NormalizedEvent]>([
    ['telemetry', { type: 'telemetry', sessionId: 's1' }],
    ['turn.aborted', { type: 'turn.aborted', sessionId: 's1', reason: 'user_cancelled' }],
    [
      'error',
      {
        type: 'error',
        sessionId: 's1',
        error: { category: 'stream_error', message: 'x', retryable: true }
      }
    ]
  ])('%s 는 스냅샷을 초기화한다', (_label, event) => {
    const started = chatReducer(withProvider, { type: 'BEGIN_TURN' })
    const next = chatReducer(started, recv(event))
    expect(next.inflight).toBe(false)
    expect(next.turnProviderKey).toBeNull()
  })

  it('CANCEL_CHAT 도 스냅샷을 초기화한다', () => {
    const started = chatReducer(withProvider, { type: 'BEGIN_TURN' })
    const next = chatReducer(started, { type: 'CANCEL_CHAT' })
    expect(next.inflight).toBe(false)
    expect(next.turnProviderKey).toBeNull()
  })
})

// 0122 r2 — 세션 한정 비용 총합(sessionCostUsd): LOAD_SESSION 이 turn_usage 세션 SUM 으로
// 시드하고, 턴 종료(telemetry.costUsd)마다 누산한다. 압축/컨텍스트 게이트와 무관.
describe('chatReducer sessionCostUsd 누산(0122 r2)', () => {
  it('telemetry.costUsd 를 턴마다 누산한다', () => {
    let s = chatReducer(
      initialChatState,
      recv({ type: 'telemetry', sessionId: 's1', usage: { costUsd: 0.5 } })
    )
    expect(s.sessionCostUsd).toBeCloseTo(0.5, 10)
    s = chatReducer(s, recv({ type: 'telemetry', sessionId: 's1', usage: { costUsd: 0.25 } }))
    expect(s.sessionCostUsd).toBeCloseTo(0.75, 10)
  })

  it('costUsd 없는 telemetry 는 누산값을 건드리지 않는다(미보고 시 undefined 유지)', () => {
    const untouched = chatReducer(initialChatState, recv({ type: 'telemetry', sessionId: 's1' }))
    expect(untouched.sessionCostUsd).toBeUndefined()

    const seeded = chatReducer(
      initialChatState,
      recv({ type: 'telemetry', sessionId: 's1', usage: { costUsd: 0.3 } })
    )
    const next = chatReducer(seeded, recv({ type: 'telemetry', sessionId: 's1', usage: {} }))
    expect(next.sessionCostUsd).toBeCloseTo(0.3, 10)
  })

  it('LOAD_SESSION 은 costUsd 로 시드하고 이후 telemetry 가 그 위에 누산한다', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: { id: 's1', backend: 'claude', title: 't', messages: [], costUsd: 1.2 }
    })
    expect(loaded.sessionCostUsd).toBeCloseTo(1.2, 10)
    const next = chatReducer(
      loaded,
      recv({ type: 'telemetry', sessionId: 's1', usage: { costUsd: 0.05 } })
    )
    expect(next.sessionCostUsd).toBeCloseTo(1.25, 10)
  })

  it('costUsd 없는 LOAD_SESSION 은 undefined 로 시작한다', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: { id: 's1', backend: 'claude', title: 't', messages: [] }
    })
    expect(loaded.sessionCostUsd).toBeUndefined()
  })
})

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

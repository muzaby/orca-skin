// 0186 U10 — "Composer 가 보여주는 기준은 항상 텔레메트리가 업데이트되는 시점이다."
//
// 도넛의 주/월 사용량은 `lastTelemetryProviderKey` 로 조회한다. 현재 선택 provider
// (`state.providerKey`)로 그리면 **모델만 바꿔도 새 턴을 돌리기 전에 숫자가 갈아치워진다** —
// 그 회귀를 여기서 잠근다.

import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import type { NormalizedEvent, LoadedSession } from '../../../../../shared/ipc'

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})

const setModel = (s: ChatState, providerKey: string): ChatState =>
  chatReducer(s, { type: 'SET_MODEL', providerKey, modelFamily: null, adapter: null })

// 컨텍스트 토큰이 0 이 아니어야 도넛 소스로 채택된다(로컬 슬래시 명령 스킵 규칙).
const telemetry = (): NormalizedEvent =>
  ({
    type: 'telemetry',
    sessionId: 's1',
    usage: { inputTokens: 120, outputTokens: 30, model: 'claude-sonnet-4' }
  }) as NormalizedEvent

describe('chatReducer — 사용량 기준 provider (0186)', () => {
  it('telemetry 시점 provider 를 굳힌다', () => {
    let s = setModel(initialChatState, 'claude-gateway')
    s = chatReducer(s, { type: 'BEGIN_TURN' })
    s = chatReducer(s, recv(telemetry()))

    expect(s.lastTelemetryProviderKey).toBe('claude-gateway')
  })

  it('SET_MODEL 은 굳은 값을 바꾸지 않는다', () => {
    let s = setModel(initialChatState, 'claude-gateway')
    s = chatReducer(s, { type: 'BEGIN_TURN' })
    s = chatReducer(s, recv(telemetry()))

    // 사용자가 모델을 바꾼다 — 아직 새 턴을 돌리지 않았다.
    s = setModel(s, 'claude-anthropic')

    expect(s.providerKey).toBe('claude-anthropic') // 선택은 바뀌고
    expect(s.lastTelemetryProviderKey).toBe('claude-gateway') // 사용량 기준은 그대로
  })

  it('턴 도중 모델을 바꿔도 그 턴이 시작할 때의 provider 로 굳는다', () => {
    let s = setModel(initialChatState, 'claude-gateway')
    s = chatReducer(s, { type: 'BEGIN_TURN' }) // turnProviderKey = claude-gateway 고정
    s = setModel(s, 'claude-anthropic') // 턴 진행 중 변경
    s = chatReducer(s, recv(telemetry()))

    expect(s.lastTelemetryProviderKey).toBe('claude-gateway')
  })

  it('새 턴이 끝나면 그 턴의 provider 로 갱신된다', () => {
    let s = setModel(initialChatState, 'claude-gateway')
    s = chatReducer(s, { type: 'BEGIN_TURN' })
    s = chatReducer(s, recv(telemetry()))
    s = setModel(s, 'claude-anthropic')
    s = chatReducer(s, { type: 'BEGIN_TURN' })
    s = chatReducer(s, recv(telemetry()))

    expect(s.lastTelemetryProviderKey).toBe('claude-anthropic')
  })

  it('컨텍스트 0 인 턴은 기준을 갈아치우지 않는다', () => {
    let s = setModel(initialChatState, 'claude-gateway')
    s = chatReducer(s, { type: 'BEGIN_TURN' })
    s = chatReducer(s, recv(telemetry()))
    s = setModel(s, 'claude-anthropic')
    s = chatReducer(s, { type: 'BEGIN_TURN' })
    // /context 류 — 모델을 부르지 않아 컨텍스트 토큰이 0 이다.
    s = chatReducer(
      s,
      recv({ type: 'telemetry', sessionId: 's1', usage: { outputTokens: 0 } } as NormalizedEvent)
    )

    expect(s.lastTelemetryProviderKey).toBe('claude-gateway')
  })

  it('세션 복원은 그 세션의 provider_key 를 기준으로 삼는다', () => {
    const session = {
      id: 's9',
      backend: 'claude',
      title: null,
      projectId: null,
      providerKey: 'claude-bedrock',
      cwd: null,
      messages: [],
      lastTelemetry: { inputTokens: 90, outputTokens: 10, model: 'claude-sonnet-4' }
    } as unknown as LoadedSession

    const s = chatReducer(initialChatState, { type: 'LOAD_SESSION', session })

    expect(s.lastTelemetryProviderKey).toBe('claude-bedrock')
  })
})

import { describe, it, expect } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import { partsText, partsReasoning, partsToolCalls } from '../lib/parts'
import type { NormalizedEvent, LoadedSession } from '../../../../../shared/ipc'

const recv = (ev: NormalizedEvent): { type: 'RECV_EVENT'; event: NormalizedEvent } => ({
  type: 'RECV_EVENT',
  event: ev
})
const apply = (s: ChatState, evs: NormalizedEvent[]): ChatState =>
  evs.reduce((acc, ev) => chatReducer(acc, recv(ev)), s)

describe('chatReducer — AppMessagePart 모델', () => {
  it('한 턴의 reasoning/tool/text 가 같은 assistant 메시지에 순서대로 누적된다', () => {
    const start = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: '안녕' })
    const s = apply(start, [
      {
        type: 'message.reasoning',
        sessionId: 's',
        provider: 'claude-code',
        text: '생각',
        signature: 'sig'
      },
      {
        type: 'tool.call.started',
        sessionId: 's',
        provider: 'claude-code',
        toolRunId: 't1',
        toolName: 'Bash',
        args: { command: 'ls' }
      },
      {
        type: 'tool.call.completed',
        sessionId: 's',
        provider: 'claude-code',
        toolRunId: 't1',
        result: 'ok',
        isError: false
      },
      {
        type: 'message.completed',
        sessionId: 's',
        provider: 'claude-code',
        message: { text: '완료' }
      }
    ])
    // user 1 + assistant 1
    expect(s.messages).toHaveLength(2)
    expect(partsText(s.messages[0].parts)).toBe('안녕')
    const a = s.messages[1]
    expect(a.role).toBe('assistant')
    expect(partsReasoning(a.parts)).toEqual([{ text: '생각', signature: 'sig' }])
    expect(partsText(a.parts)).toBe('완료')
    expect(partsToolCalls(a.parts)).toEqual([
      {
        toolUseId: 't1',
        name: 'Bash',
        input: { command: 'ls' },
        result: { output: 'ok', isError: false }
      }
    ])
  })

  it('다음 user 메시지 후의 assistant 파트는 새 메시지에 묶인다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q1' })
    s = apply(s, [
      {
        type: 'message.completed',
        sessionId: 's',
        provider: 'claude-code',
        message: { text: 'a1' }
      }
    ])
    s = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: 'q2' })
    s = apply(s, [
      {
        type: 'message.completed',
        sessionId: 's',
        provider: 'claude-code',
        message: { text: 'a2' }
      }
    ])
    expect(s.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(partsText(s.messages[3].parts)).toBe('a2')
  })

  it('message.completed 가 pendingDelta 를 비운다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    s = apply(s, [
      { type: 'message.delta', sessionId: 's', provider: 'claude-code', delta: { text: 'hel' } }
    ])
    expect(s.pendingDelta).toBe('hel')
    s = apply(s, [
      {
        type: 'message.completed',
        sessionId: 's',
        provider: 'claude-code',
        message: { text: 'hello' }
      }
    ])
    expect(s.pendingDelta).toBe('')
    expect(partsText(s.messages[1].parts)).toBe('hello')
  })

  it('message.reasoning.delta 가 pendingReasoning 에 누적되고 완성 블록이 비운다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    s = apply(s, [
      {
        type: 'message.reasoning.delta',
        sessionId: 's',
        provider: 'claude-code',
        delta: { text: '먼저 ' }
      },
      {
        type: 'message.reasoning.delta',
        sessionId: 's',
        provider: 'claude-code',
        delta: { text: '확인' }
      }
    ])
    expect(s.pendingReasoning).toBe('먼저 확인')
    // 완성 사고 블록 → 영속 reasoning 파트 + 라이브 프리뷰 비움
    s = apply(s, [
      {
        type: 'message.reasoning',
        sessionId: 's',
        provider: 'claude-code',
        text: '먼저 확인',
        signature: 'sig'
      }
    ])
    expect(s.pendingReasoning).toBe('')
    expect(partsReasoning(s.messages[1].parts)).toEqual([{ text: '먼저 확인', signature: 'sig' }])
  })

  it('telemetry 가 미완 pendingReasoning 을 비운다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    s = apply(s, [
      {
        type: 'message.reasoning.delta',
        sessionId: 's',
        provider: 'claude-code',
        delta: { text: '생각만' }
      },
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: { inputTokens: 1, outputTokens: 1 }
      }
    ])
    expect(s.pendingReasoning).toBe('')
  })

  it('telemetry 가 lastTelemetry 를 저장하고 세션 비용을 누산한다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q1' })
    s = apply(s, [
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          costUsd: 0.01,
          model: 'opus',
          durationMs: 1000
        }
      }
    ])
    expect(s.lastTelemetry).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
      model: 'opus',
      durationMs: 1000
    })
    expect(s.sessionCostUsd).toBe(0.01)
    expect(s.pendingInputTokens).toBe(100)
    expect(s.lastTurnLatencyMs).toBeTypeOf('number')

    // 두 번째 턴 — costUsd 누산, lastTelemetry 교체
    s = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: 'q2' })
    s = apply(s, [
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: { inputTokens: 200, outputTokens: 80, costUsd: 0.02 }
      }
    ])
    expect(s.sessionCostUsd).toBeCloseTo(0.03)
    expect(s.lastTelemetry?.inputTokens).toBe(200)
  })

  it('costUsd 없는 telemetry 는 세션 누적을 건드리지 않는다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    s = apply(s, [
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.5 }
      }
    ])
    expect(s.sessionCostUsd).toBe(0.5)
    s = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: 'q2' })
    s = apply(s, [{ type: 'telemetry', sessionId: 's', provider: 'claude-code' }])
    expect(s.sessionCostUsd).toBe(0.5) // 변동 없음
  })

  it('NEW_CHAT 은 telemetry 상태를 리셋한다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    s = apply(s, [
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.5 }
      }
    ])
    s = chatReducer(s, { type: 'NEW_CHAT' })
    expect(s.lastTelemetry).toBeUndefined()
    expect(s.sessionCostUsd).toBeUndefined()
    expect(s.lastTurnLatencyMs).toBeUndefined()
  })

  it('LOAD_SESSION 은 parts 를 그대로 싣는다', () => {
    const session: LoadedSession = {
      id: 's1',
      backend: 'claude-code',
      title: 't',
      messages: [
        { role: 'user', createdAt: 1, parts: [{ type: 'text', text: '질문' }] },
        {
          role: 'assistant',
          createdAt: 2,
          parts: [
            { type: 'reasoning', text: '음' },
            { type: 'tool_call', toolRunId: 'x', toolName: 'Read', args: { path: 'a' } },
            { type: 'tool_result', toolRunId: 'x', result: 'data', isError: false },
            { type: 'text', text: '답변' }
          ]
        }
      ]
    }
    const s = chatReducer(initialChatState, { type: 'LOAD_SESSION', session })
    expect(s.sessionId).toBe('s1')
    expect(partsText(s.messages[1].parts)).toBe('답변')
    expect(partsToolCalls(s.messages[1].parts)).toEqual([
      {
        toolUseId: 'x',
        name: 'Read',
        input: { path: 'a' },
        result: { output: 'data', isError: false }
      }
    ])
  })
})

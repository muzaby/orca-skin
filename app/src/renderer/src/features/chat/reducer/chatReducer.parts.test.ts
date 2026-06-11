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

  it('스트리밍 델타 2종은 reducer 무변경(no-op) — 라이브 버퍼는 chatStore live 슬라이스 소관', () => {
    const start = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    const s = apply(start, [
      { type: 'message.delta', sessionId: 's', provider: 'claude-code', delta: { text: 'hel' } },
      {
        type: 'message.reasoning.delta',
        sessionId: 's',
        provider: 'claude-code',
        delta: { text: '생각' }
      }
    ])
    // 델타 프레임에 커밋 상태 identity 가 유지된다 → session 구독자 재렌더 0 (0008).
    expect(s).toBe(start)
  })

  it('message.completed 가 완성본을 text 파트로 커밋한다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    s = apply(s, [
      {
        type: 'message.completed',
        sessionId: 's',
        provider: 'claude-code',
        message: { text: 'hello' }
      }
    ])
    expect(partsText(s.messages[1].parts)).toBe('hello')
  })

  it('message.reasoning 완성 블록이 영속 reasoning 파트로 커밋된다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    s = apply(s, [
      {
        type: 'message.reasoning',
        sessionId: 's',
        provider: 'claude-code',
        text: '먼저 확인',
        signature: 'sig'
      }
    ])
    expect(partsReasoning(s.messages[1].parts)).toEqual([{ text: '먼저 확인', signature: 'sig' }])
  })

  it('COMMIT_PENDING_TEXT 가 잔여 라이브 텍스트를 text 파트로 굳히고, 빈 텍스트는 no-op', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    const noop = chatReducer(s, { type: 'COMMIT_PENDING_TEXT', text: '' })
    expect(noop).toBe(s)
    s = chatReducer(s, { type: 'COMMIT_PENDING_TEXT', text: '잘린 답변' })
    expect(s.messages).toHaveLength(2)
    expect(s.messages[1].role).toBe('assistant')
    expect(partsText(s.messages[1].parts)).toBe('잘린 답변')
  })

  it('SEND_USER_MESSAGE 가 sendCount 를 단조 증가시키고 NEW_CHAT 이 리셋한다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q1' })
    expect(s.sendCount).toBe(1)
    s = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: 'q2' })
    expect(s.sendCount).toBe(2)
    s = chatReducer(s, { type: 'NEW_CHAT' })
    expect(s.sendCount).toBe(0)
  })

  it('telemetry 가 lastTelemetry 를 저장하고 SEND 가 유지·교체한다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q1' })
    s = apply(s, [
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 300,
          model: 'opus'
        }
      }
    ])
    expect(s.lastTelemetry).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 300,
      model: 'opus'
    })

    // SEND 는 lastTelemetry 를 비우지 않는다 — 컨텍스트 도넛이 턴 진행 중에도 유지.
    const afterSend = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: 'mid' })
    expect(afterSend.lastTelemetry?.inputTokens).toBe(100)

    // 두 번째 턴 — lastTelemetry 교체
    s = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: 'q2' })
    s = apply(s, [
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: { inputTokens: 200, outputTokens: 80 }
      }
    ])
    expect(s.lastTelemetry?.inputTokens).toBe(200)
  })

  it('컨텍스트 0인 telemetry(/context 등)는 lastTelemetry 를 덮지 않고 턴만 종료한다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q1' })
    s = apply(s, [
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: { inputTokens: 5000, cacheReadTokens: 12000, model: 'opus' }
      }
    ])
    expect(s.lastTelemetry?.inputTokens).toBe(5000)

    // 빈 컨텍스트 턴 — usage 가 출력만/없음 → 직전 도넛 값 보존, 단 inflight 은 false 로.
    s = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: '/context' })
    s = apply(s, [
      { type: 'telemetry', sessionId: 's', provider: 'claude-code', usage: { outputTokens: 10 } }
    ])
    expect(s.lastTelemetry?.inputTokens).toBe(5000)
    expect(s.lastTelemetry?.cacheReadTokens).toBe(12000)
    expect(s.inflight).toBe(false)

    // usage 자체가 없는 telemetry 도 보존(회귀 가드).
    s = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: '/help' })
    s = apply(s, [{ type: 'telemetry', sessionId: 's', provider: 'claude-code' }])
    expect(s.lastTelemetry?.inputTokens).toBe(5000)

    // 컨텍스트 있는 턴은 정상 교체.
    s = chatReducer(s, { type: 'SEND_USER_MESSAGE', text: 'q2' })
    s = apply(s, [
      { type: 'telemetry', sessionId: 's', provider: 'claude-code', usage: { inputTokens: 8000 } }
    ])
    expect(s.lastTelemetry?.inputTokens).toBe(8000)
  })

  it('NEW_CHAT 은 telemetry 상태를 리셋한다', () => {
    let s = chatReducer(initialChatState, { type: 'SEND_USER_MESSAGE', text: 'q' })
    s = apply(s, [
      {
        type: 'telemetry',
        sessionId: 's',
        provider: 'claude-code',
        usage: { inputTokens: 10, outputTokens: 5 }
      }
    ])
    s = chatReducer(s, { type: 'NEW_CHAT' })
    expect(s.lastTelemetry).toBeUndefined()
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

  it('LOAD_SESSION 은 복원된 마지막 턴 telemetry 를 싣는다(컨텍스트 도넛 유지)', () => {
    const session: LoadedSession = {
      id: 's2',
      backend: 'claude-code',
      title: 't',
      messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q' }] }],
      lastTelemetry: { inputTokens: 1234, cacheReadTokens: 500, model: 'opus' }
    }
    const s = chatReducer(initialChatState, { type: 'LOAD_SESSION', session })
    expect(s.lastTelemetry?.inputTokens).toBe(1234)
    expect(s.lastTelemetry?.cacheReadTokens).toBe(500)
  })

  it('LOAD_SESSION_FROM_CACHE 는 캐시의 telemetry 를 복원한다', () => {
    const s = chatReducer(initialChatState, {
      type: 'LOAD_SESSION_FROM_CACHE',
      sessionId: 's3',
      cached: {
        title: 't',
        messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'q' }] }],
        lastTelemetry: { inputTokens: 777 }
      }
    })
    expect(s.lastTelemetry?.inputTokens).toBe(777)
  })
})

import { describe, it, expect } from 'vitest'
import { claudeToNormalized, type MapContext } from './claude-map'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

const ctx = (sessionId = 's1'): MapContext => ({ sessionId, cwd: '/w' })
const sdk = (m: unknown): SDKMessage => m as SDKMessage

describe('claudeToNormalized', () => {
  it('system/init → session.updated 이고 ctx.sessionId 를 갱신한다', () => {
    const c = ctx('')
    const out = claudeToNormalized(
      sdk({ type: 'system', subtype: 'init', session_id: 'new1', model: 'opus' }),
      c
    )
    expect(out).toEqual([
      {
        type: 'session.updated',
        sessionId: 'new1',
        patch: { model: 'opus', cwd: '/w' }
      }
    ])
    expect(c.sessionId).toBe('new1')
  })

  it('session_id 없는 init 은 무시([])', () => {
    expect(claudeToNormalized(sdk({ type: 'system', subtype: 'init' }), ctx())).toEqual([])
  })

  it('stream_event(text_delta) → message.delta', () => {
    const out = claudeToNormalized(
      sdk({ type: 'stream_event', event: { delta: { type: 'text_delta', text: 'hi' } } }),
      ctx()
    )
    expect(out).toEqual([{ type: 'message.delta', sessionId: 's1', delta: { text: 'hi' } }])
  })

  it('stream_event(thinking_delta) → message.reasoning.delta', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'stream_event',
        event: { delta: { type: 'thinking_delta', thinking: '음...' } }
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'message.reasoning.delta',
        sessionId: 's1',
        delta: { text: '음...' }
      }
    ])
  })

  it('stream_event(signature_delta) → [] (스트림에서 무시)', () => {
    expect(
      claudeToNormalized(
        sdk({
          type: 'stream_event',
          event: { delta: { type: 'signature_delta', signature: 'x' } }
        }),
        ctx()
      )
    ).toEqual([])
  })

  it('assistant → 콘텐츠 순서 보존(text 먼저 → tool.call.started)', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'done' },
            { type: 'tool_use', id: 't1', name: 'Bash', input: { cmd: 'ls' } }
          ]
        }
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'message.completed',
        sessionId: 's1',
        message: { text: 'done' }
      },
      {
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 't1',
        toolName: 'Bash',
        args: { cmd: 'ls' }
      }
    ])
  })

  it('assistant [text, tool, text] → text 가 도구 앞뒤로 분리 emit', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '확인할게요' },
            { type: 'tool_use', id: 't1', name: 'Read', input: { path: 'a.ts' } },
            { type: 'text', text: '완료' }
          ]
        }
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'message.completed',
        sessionId: 's1',
        message: { text: '확인할게요' }
      },
      {
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 't1',
        toolName: 'Read',
        args: { path: 'a.ts' }
      },
      {
        type: 'message.completed',
        sessionId: 's1',
        message: { text: '완료' }
      }
    ])
  })

  it('빈 텍스트 블록은 message.completed 를 만들지 않는다', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '' },
            { type: 'tool_use', id: 't1', name: 'Bash', input: {} }
          ]
        }
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 't1',
        toolName: 'Bash',
        args: {}
      }
    ])
  })

  it('assistant thinking 블록 → message.reasoning (signature 보존, text 와 공존)', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [
            { type: 'thinking', thinking: '먼저 확인하자', signature: 'sig1' },
            { type: 'text', text: '완료' }
          ]
        }
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'message.reasoning',
        sessionId: 's1',
        text: '먼저 확인하자',
        signature: 'sig1'
      },
      {
        type: 'message.completed',
        sessionId: 's1',
        message: { text: '완료' }
      }
    ])
  })

  it('signature 없는 thinking 블록 → message.reasoning (signature 생략)', () => {
    const out = claudeToNormalized(
      sdk({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 't' }] } }),
      ctx()
    )
    expect(out).toEqual([{ type: 'message.reasoning', sessionId: 's1', text: 't' }])
  })

  it('빈/공백 thinking 블록은 message.reasoning 을 emit 하지 않는다', () => {
    expect(
      claudeToNormalized(
        sdk({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: '' }] } }),
        ctx()
      )
    ).toEqual([])
    expect(
      claudeToNormalized(
        sdk({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: '  \n ' }] } }),
        ctx()
      )
    ).toEqual([])
  })

  it('user(tool_result) → tool.call.completed', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok', is_error: false }]
        }
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 't1',
        result: 'ok',
        isError: false
      }
    ])
  })

  it('result(usage) → telemetry', () => {
    const out = claudeToNormalized(
      sdk({ type: 'result', usage: { input_tokens: 10, output_tokens: 20 } }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'telemetry',
        sessionId: 's1',
        usage: { inputTokens: 10, outputTokens: 20 }
      }
    ])
  })

  it('result(usage 없음) → telemetry (usage 생략)', () => {
    expect(claudeToNormalized(sdk({ type: 'result' }), ctx())).toEqual([
      { type: 'telemetry', sessionId: 's1' }
    ])
  })

  it('result → telemetry 가 cost·duration·num_turns·캐시 토큰을 정규화한다', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'result',
        total_cost_usd: 0.0123,
        duration_ms: 4200,
        num_turns: 3,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 30,
          cache_creation_input_tokens: 10
        }
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'telemetry',
        sessionId: 's1',
        usage: {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 30,
          cacheCreationTokens: 10,
          costUsd: 0.0123,
          durationMs: 4200,
          numTurns: 3
        }
      }
    ])
  })

  it('result.modelUsage → camelCase 정규화 + 단일 모델이면 top-level model 채움', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'result',
        modelUsage: {
          'claude-opus-4': {
            costUSD: 0.05,
            inputTokens: 200,
            outputTokens: 80,
            cacheReadInputTokens: 5,
            cacheCreationInputTokens: 0
          }
        }
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'telemetry',
        sessionId: 's1',
        usage: {
          model: 'claude-opus-4',
          modelUsage: {
            'claude-opus-4': {
              costUsd: 0.05,
              inputTokens: 200,
              outputTokens: 80,
              cacheReadTokens: 5,
              cacheCreationTokens: 0
            }
          }
        }
      }
    ])
  })

  it('result.modelUsage 다중 모델이면 top-level model 을 안 채운다', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'result',
        modelUsage: {
          'claude-opus-4': { costUSD: 0.05 },
          'claude-haiku-4': { costUSD: 0.001 }
        }
      }),
      ctx()
    )
    const ev = out[0] as { usage?: { model?: string; modelUsage?: Record<string, unknown> } }
    expect(ev.usage?.model).toBeUndefined()
    expect(Object.keys(ev.usage?.modelUsage ?? {})).toEqual(['claude-opus-4', 'claude-haiku-4'])
  })

  it('result(잡음만, 의미있는 필드 없음) → telemetry (usage 생략)', () => {
    expect(
      claudeToNormalized(sdk({ type: 'result', subtype: 'success', is_error: false }), ctx())
    ).toEqual([{ type: 'telemetry', sessionId: 's1' }])
  })

  it('멀티스텝 턴: telemetry 컨텍스트 입력은 마지막 assistant 스냅샷(누적 아님), 비용은 result', () => {
    const c = ctx()
    // assistant#1 → tool → assistant#2 → result(usage 누적). ctx 는 스트림 전체 공유.
    claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }],
          usage: { input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 5000 }
        }
      }),
      c
    )
    claudeToNormalized(
      sdk({
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] }
      }),
      c
    )
    claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'done' }],
          usage: { input_tokens: 120, output_tokens: 30, cache_read_input_tokens: 5200 }
        }
      }),
      c
    )
    const out = claudeToNormalized(
      sdk({
        type: 'result',
        total_cost_usd: 0.02,
        usage: {
          input_tokens: 220, // 단계별 누적(100+120) — 이 값이 아니라 마지막 스냅샷을 써야 함
          output_tokens: 40,
          cache_read_input_tokens: 10200
        }
      }),
      c
    )
    const ev = out[0] as { usage?: Record<string, number> }
    // 컨텍스트 입력 3종 = 마지막 assistant(#2) 스냅샷. 누적(220/10200) 이 아님.
    expect(ev.usage?.inputTokens).toBe(120)
    expect(ev.usage?.cacheReadTokens).toBe(5200)
    expect(ev.usage?.cacheCreationTokens).toBeUndefined() // 스냅샷에 없으면 빠진다
    // 비용은 result 누적값 유지(사용자 결정).
    expect(ev.usage?.costUsd).toBe(0.02)
  })

  it('assistant usage 가 없으면 result.usage 로 graceful fallback', () => {
    const c = ctx()
    // usage 없는 assistant → 스냅샷 미갱신. result.usage 가 그대로 telemetry 가 된다.
    claudeToNormalized(
      sdk({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } }),
      c
    )
    const out = claudeToNormalized(
      sdk({ type: 'result', usage: { input_tokens: 77, cache_read_input_tokens: 33 } }),
      c
    )
    const ev = out[0] as { usage?: Record<string, number> }
    expect(ev.usage?.inputTokens).toBe(77)
    expect(ev.usage?.cacheReadTokens).toBe(33)
  })

  it('스냅샷이 input 만 줄 때 result 의 cache_read 를 보존한다(붕괴 방지)', () => {
    const c = ctx()
    // assistant usage 가 input_tokens 만 담고 cache 필드를 안 줌. result 는 cache_read 보유.
    claudeToNormalized(
      sdk({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'done' }], usage: { input_tokens: 4 } }
      }),
      c
    )
    const out = claudeToNormalized(
      sdk({
        type: 'result',
        usage: { input_tokens: 4, cache_read_input_tokens: 35000, cache_creation_input_tokens: 700 }
      }),
      c
    )
    const ev = out[0] as { usage?: Record<string, number> }
    // input 은 스냅샷(=result 와 동일) 4. cache 는 스냅샷에 없으니 result 값 보존 — delete 금지.
    expect(ev.usage?.inputTokens).toBe(4)
    expect(ev.usage?.cacheReadTokens).toBe(35000)
    expect(ev.usage?.cacheCreationTokens).toBe(700)
  })

  it('미사용 SDK 메시지 → []', () => {
    expect(claudeToNormalized(sdk({ type: 'system', subtype: 'compact_boundary' }), ctx())).toEqual(
      []
    )
  })
})

it('result 에러는 telemetry 와 error 이벤트를 함께 낸다', () => {
  const out = claudeToNormalized(
    sdk({ type: 'result', subtype: 'error_max_turns', is_error: true, message: 'bad request' }),
    ctx()
  )
  expect(out[0]).toEqual({ type: 'telemetry', sessionId: 's1' })
  expect(out[1]).toMatchObject({
    type: 'error',
    sessionId: 's1',
    error: { category: 'stream_error', message: 'bad request' }
  })
})

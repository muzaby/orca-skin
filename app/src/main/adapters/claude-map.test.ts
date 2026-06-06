import { describe, it, expect } from 'vitest'
import { claudeToNormalized, type MapContext } from './claude-map'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

const ctx = (sessionId = 's1'): MapContext => ({ provider: 'claude-code', sessionId, cwd: '/w' })
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
        provider: 'claude-code',
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
    expect(out).toEqual([
      { type: 'message.delta', sessionId: 's1', provider: 'claude-code', delta: { text: 'hi' } }
    ])
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
        provider: 'claude-code',
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

  it('assistant → tool.call.started + message.completed (순서 보존)', () => {
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
        type: 'tool.call.started',
        sessionId: 's1',
        provider: 'claude-code',
        toolRunId: 't1',
        toolName: 'Bash',
        args: { cmd: 'ls' }
      },
      {
        type: 'message.completed',
        sessionId: 's1',
        provider: 'claude-code',
        message: { text: 'done' }
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
        provider: 'claude-code',
        text: '먼저 확인하자',
        signature: 'sig1'
      },
      {
        type: 'message.completed',
        sessionId: 's1',
        provider: 'claude-code',
        message: { text: '완료' }
      }
    ])
  })

  it('signature 없는 thinking 블록 → message.reasoning (signature 생략)', () => {
    const out = claudeToNormalized(
      sdk({ type: 'assistant', message: { content: [{ type: 'thinking', thinking: 't' }] } }),
      ctx()
    )
    expect(out).toEqual([
      { type: 'message.reasoning', sessionId: 's1', provider: 'claude-code', text: 't' }
    ])
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
        provider: 'claude-code',
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
        provider: 'claude-code',
        usage: { inputTokens: 10, outputTokens: 20 }
      }
    ])
  })

  it('result(usage 없음) → telemetry (usage 생략)', () => {
    expect(claudeToNormalized(sdk({ type: 'result' }), ctx())).toEqual([
      { type: 'telemetry', sessionId: 's1', provider: 'claude-code' }
    ])
  })

  it('미사용 SDK 메시지 → []', () => {
    expect(claudeToNormalized(sdk({ type: 'system', subtype: 'compact_boundary' }), ctx())).toEqual(
      []
    )
  })
})

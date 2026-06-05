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

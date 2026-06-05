import { describe, it, expect } from 'vitest'
import { chatEventToNormalized, type MapContext } from './normalized'
import type { ChatEvent } from '../../shared/ipc'

const ctx = (sessionId = 's1'): MapContext => ({ provider: 'claude-code', sessionId, cwd: '/w' })

describe('chatEventToNormalized', () => {
  it('init → session.updated 이고 ctx.sessionId 를 갱신한다', () => {
    const c = ctx('')
    const out = chatEventToNormalized(
      { type: 'init', data: { sessionId: 'new1', model: 'opus', cwd: '/w' } } as ChatEvent,
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
    expect(c.sessionId).toBe('new1') // 부수효과로 갱신
  })

  it('assistant_delta → message.delta (sessionId/provider 주입)', () => {
    const out = chatEventToNormalized({ type: 'assistant_delta', data: { text: 'hi' } }, ctx())
    expect(out).toEqual([
      { type: 'message.delta', sessionId: 's1', provider: 'claude-code', delta: { text: 'hi' } }
    ])
  })

  it('assistant_message → message.completed', () => {
    const out = chatEventToNormalized({ type: 'assistant_message', data: { text: 'done' } }, ctx())
    expect(out).toEqual([
      {
        type: 'message.completed',
        sessionId: 's1',
        provider: 'claude-code',
        message: { text: 'done' }
      }
    ])
  })

  it('tool_use → tool.call.started (toolUseId → toolRunId)', () => {
    const out = chatEventToNormalized(
      { type: 'tool_use', data: { toolUseId: 't1', name: 'Bash', input: { cmd: 'ls' } } },
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
      }
    ])
  })

  it('tool_result → tool.call.completed (isError/durationMs 보존)', () => {
    const out = chatEventToNormalized(
      {
        type: 'tool_result',
        data: { toolUseId: 't1', output: 'ok', isError: false, durationMs: 12 }
      },
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'tool.call.completed',
        sessionId: 's1',
        provider: 'claude-code',
        toolRunId: 't1',
        result: 'ok',
        isError: false,
        durationMs: 12
      }
    ])
  })

  it('result → telemetry (usage 매핑)', () => {
    const out = chatEventToNormalized(
      { type: 'result', data: { usage: { inputTokens: 10, outputTokens: 20 } } },
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

  it('error → error (sessionId 알 수 없으면 생략)', () => {
    const out = chatEventToNormalized(
      { type: 'error', data: { code: 'sdk.crashed', message: 'boom', recoverable: true } },
      ctx('')
    )
    expect(out).toEqual([
      {
        type: 'error',
        provider: 'claude-code',
        error: { code: 'sdk.crashed', message: 'boom', recoverable: true }
      }
    ])
  })

  it('ask_question/plan_review 는 B2 까지 비운다([])', () => {
    expect(
      chatEventToNormalized(
        { type: 'ask_question', data: { requestId: 'r', questions: [] } },
        ctx()
      )
    ).toEqual([])
    expect(
      chatEventToNormalized({ type: 'plan_review', data: { requestId: 'r', plan: 'p' } }, ctx())
    ).toEqual([])
  })
})

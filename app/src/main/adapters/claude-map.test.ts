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
        parent_tool_use_id: 'parent-task-1',
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
        message: { text: 'done' },
        parentToolRunId: 'parent-task-1'
      },
      {
        type: 'tool.call.started',
        sessionId: 's1',
        toolRunId: 't1',
        toolName: 'Bash',
        args: { cmd: 'ls' },
        parentToolRunId: 'parent-task-1'
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
    // compact_boundary 는 0062 에서 session.compacted 로 정규화됨 — 미사용 예시는 status.
    expect(claudeToNormalized(sdk({ type: 'system', subtype: 'status' }), ctx())).toEqual([])
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

describe('claudeToNormalized — 서브에이전트(Task) 메타', () => {
  it('system task_started → subagent.task(started) (tool_use_id 키)', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'system',
        subtype: 'task_started',
        task_id: 'task-1',
        tool_use_id: 'agent-1',
        subagent_type: 'Explore',
        description: '구조 탐색'
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'subagent.task',
        sessionId: 's1',
        toolUseId: 'agent-1',
        phase: 'started',
        taskId: 'task-1',
        subagentType: 'Explore',
        description: '구조 탐색'
      }
    ])
  })

  it('system task_progress → subagent.task(progress) 에 duration/tool/last_tool 실린다', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'system',
        subtype: 'task_progress',
        task_id: 'task-1',
        tool_use_id: 'agent-1',
        usage: { duration_ms: 5000, tool_uses: 3, total_tokens: 1 },
        last_tool_name: 'Bash'
      }),
      ctx()
    )
    expect(out).toEqual([
      {
        type: 'subagent.task',
        sessionId: 's1',
        toolUseId: 'agent-1',
        phase: 'progress',
        taskId: 'task-1',
        durationMs: 5000,
        toolUses: 3,
        lastToolName: 'Bash'
      }
    ])
  })

  it('tool_use_id 없는 task_notification 은 앞선 task_id 매핑으로 부모 toolUseId 를 복원한다', () => {
    const c = ctx()
    claudeToNormalized(
      sdk({
        type: 'system',
        subtype: 'task_started',
        task_id: 'task-1',
        tool_use_id: 'agent-1',
        description: '구조 탐색'
      }),
      c
    )

    const out = claudeToNormalized(
      sdk({
        type: 'system',
        subtype: 'task_notification',
        task_id: 'task-1',
        status: 'stopped',
        summary: '사용자 중단'
      }),
      c
    )

    expect(out).toEqual([
      {
        type: 'subagent.task',
        sessionId: 's1',
        toolUseId: 'agent-1',
        phase: 'settled',
        taskId: 'task-1',
        status: 'stopped',
        summary: '사용자 중단'
      }
    ])
  })

  it('tool_use_id 없는 task_* / skip_transcript 는 드롭([])', () => {
    expect(
      claudeToNormalized(sdk({ type: 'system', subtype: 'task_started', task_id: 't' }), ctx())
    ).toEqual([])
    expect(
      claudeToNormalized(
        sdk({
          type: 'system',
          subtype: 'task_started',
          task_id: 't',
          tool_use_id: 'a',
          skip_transcript: true
        }),
        ctx()
      )
    ).toEqual([])
  })

  it('child assistant 의 message.model 을 subagent.task(progress) 로 캡처한다', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'assistant',
        parent_tool_use_id: 'agent-1',
        message: { model: 'claude-haiku-4-5', content: [{ type: 'text', text: '답변' }] }
      }),
      ctx()
    )
    expect(out).toContainEqual({
      type: 'subagent.task',
      sessionId: 's1',
      toolUseId: 'agent-1',
      phase: 'progress',
      model: 'claude-haiku-4-5'
    })
    // child 텍스트도 parentToolRunId 로 forward.
    expect(out).toContainEqual({
      type: 'message.completed',
      sessionId: 's1',
      message: { text: '답변' },
      parentToolRunId: 'agent-1'
    })
  })

  it('누산한 메타를 부모 Task tool_result(tool.call.completed)에 subagentMeta 로 영속한다', () => {
    const c = ctx()
    // 1) child assistant 모델 + 2) task_progress duration/tool 누산
    claudeToNormalized(
      sdk({
        type: 'assistant',
        parent_tool_use_id: 'agent-1',
        message: { model: 'claude-haiku-4-5', content: [] }
      }),
      c
    )
    claudeToNormalized(
      sdk({
        type: 'system',
        subtype: 'task_notification',
        task_id: 'task-1',
        tool_use_id: 'agent-1',
        status: 'completed',
        usage: { duration_ms: 9000, tool_uses: 4, total_tokens: 1 }
      }),
      c
    )
    // 3) 부모 Task 의 tool_result → subagentMeta 부착
    const out = claudeToNormalized(
      sdk({
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 'agent-1', content: 'ok' }] }
      }),
      c
    )
    expect(out).toEqual([
      {
        type: 'tool.call.completed',
        sessionId: 's1',
        toolRunId: 'agent-1',
        result: 'ok',
        isError: false,
        subagentMeta: { model: 'claude-haiku-4-5', durationMs: 9000, toolUses: 4 }
      }
    ])
  })
})

describe('claudeToNormalized — compact_boundary (0062)', () => {
  it('system/compact_boundary → session.compacted (trigger·preTokens 정규화)', () => {
    const out = claudeToNormalized(
      sdk({
        type: 'system',
        subtype: 'compact_boundary',
        compact_metadata: { trigger: 'manual', pre_tokens: 155_000 }
      }),
      ctx()
    )
    expect(out).toEqual([
      { type: 'session.compacted', sessionId: 's1', trigger: 'manual', preTokens: 155_000 }
    ])
  })

  it('메타 필드가 없거나 미지 값이면 optional 을 생략한다(방어)', () => {
    const out = claudeToNormalized(
      sdk({ type: 'system', subtype: 'compact_boundary', compact_metadata: { trigger: '??' } }),
      ctx()
    )
    expect(out).toEqual([{ type: 'session.compacted', sessionId: 's1' }])
    expect(claudeToNormalized(sdk({ type: 'system', subtype: 'compact_boundary' }), ctx())).toEqual(
      [{ type: 'session.compacted', sessionId: 's1' }]
    )
  })

  it('압축 턴 result — 경계 이전 스냅샷을 무효화하고 컨텍스트를 요약 크기(출력)로 근사한다 (r5)', () => {
    const c = ctx()
    // 경계 *이전* 요약 요청 usage — 압축 전 전체 이력이 실린 입력(155k 컨텍스트 상당).
    claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'summary...' }],
          usage: { input_tokens: 1200, output_tokens: 3000, cache_read_input_tokens: 150_000 }
        }
      }),
      c
    )
    claudeToNormalized(
      sdk({
        type: 'system',
        subtype: 'compact_boundary',
        compact_metadata: { trigger: 'manual', pre_tokens: 155_000 }
      }),
      c
    )
    const out = claudeToNormalized(
      sdk({
        type: 'result',
        total_cost_usd: 0.4,
        usage: { input_tokens: 1200, output_tokens: 3000, cache_read_input_tokens: 150_000 }
      }),
      c
    )
    const ev = out[0] as { usage?: Record<string, number> }
    // 컨텍스트 점유 = 압축 후 근사(출력 토큰 = 요약 크기). 압축 전 값(150k)에 고착 금지 —
    // 도넛/경고가 압축 완료 직후 해제되게 한다.
    expect(ev.usage?.inputTokens).toBe(3000)
    expect(ev.usage?.cacheReadTokens).toBeUndefined()
    expect(ev.usage?.cacheCreationTokens).toBeUndefined()
    // 비용·출력은 턴 누적 유지(원장 무손실).
    expect(ev.usage?.costUsd).toBe(0.4)
    expect(ev.usage?.outputTokens).toBe(3000)
  })

  it('경계 이후 assistant usage 가 오면(auto 압축 후 턴 계속) 실측 스냅샷이 우선한다', () => {
    const c = ctx()
    claudeToNormalized(sdk({ type: 'system', subtype: 'compact_boundary' }), c)
    // 압축 후 이어진 요청 — 작아진 실측 컨텍스트.
    claudeToNormalized(
      sdk({
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'continue' }],
          usage: { input_tokens: 80, output_tokens: 20, cache_read_input_tokens: 9000 }
        }
      }),
      c
    )
    const out = claudeToNormalized(
      sdk({ type: 'result', usage: { input_tokens: 160_000, cache_read_input_tokens: 200_000 } }),
      c
    )
    const ev = out[0] as { usage?: Record<string, number> }
    expect(ev.usage?.inputTokens).toBe(80)
    expect(ev.usage?.cacheReadTokens).toBe(9000)
  })
})

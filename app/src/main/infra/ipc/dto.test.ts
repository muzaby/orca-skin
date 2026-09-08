import type { TurnModelUsageRow, TurnUsageRow } from '../db/types'
import { describe, expect, it } from 'vitest'
import { partFromRow, toSessionListItem, usageRowToTelemetry } from './dto'
import type { LoadedPartRow, SessionListRow } from '../db/types'

const row = (over: Partial<LoadedPartRow>): LoadedPartRow => ({
  message_id: 1,
  role: 'user',
  created_at: 0,
  complete: 1,
  message_idx: 0,
  part_idx: 0,
  type: 'text',
  tool_run_id: null,
  payload_json: '{}',
  ...over
})

describe('partFromRow — attachment 파트', () => {
  it('attachment 파트를 payload_json 에서 그대로 복원한다(제네릭 로더)', () => {
    const attachments = [
      { id: 'a1', name: 'pic.png', mimeType: 'image/png', kind: 'image', previewDataUrl: 'd' },
      { id: 'a2', name: 'spec.md', mimeType: 'text/markdown', kind: 'file' }
    ]
    const part = partFromRow(
      row({ type: 'attachment', payload_json: JSON.stringify({ attachments }) })
    )
    expect(part).toEqual({ type: 'attachment', attachments })
  })
})

describe('session presentation DTO', () => {
  it.each(['coding', 'work'] as const)(
    'keeps %s independent from the execution backend',
    (kind) => {
      const session: SessionListRow = {
        id: 'session',
        backend: 'claude',
        agent_kind: kind,
        title: null,
        updated_at: 1,
        last_message_preview: null,
        project_id: null,
        title_source: 'auto',
        provider_key: null,
        cwd: 'C:/workspace',
        extra_dirs: null,
        pinned_at: null
      }
      expect(toSessionListItem(session)).toMatchObject({
        id: 'session',
        backend: 'claude',
        agentKind: kind
      })
    }
  )

  it.each(['ended', 'aborted', 'failed', 'unknown'] as const)(
    'restores the %s boundary without adding prose',
    (outcome) => {
      const boundary = { phase: 'end', id: 'fragment', outcome }
      expect(
        partFromRow(row({ type: 'response_boundary', payload_json: JSON.stringify({ boundary }) }))
      ).toEqual({ type: 'response_boundary', boundary })
    }
  )
})

const turn = (over: Partial<TurnUsageRow>): TurnUsageRow => ({
  id: 1,
  session_id: 's1',
  message_id: 10,
  created_at: 1,
  input_tokens: 100,
  output_tokens: 50,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 200,
  total_cost_usd: 0.01,
  ...over
})

const model = (over: Partial<TurnModelUsageRow>): TurnModelUsageRow => ({
  id: 1,
  turn_usage_id: 1,
  model: 'claude-opus-4-5',
  input_tokens: 100,
  output_tokens: 50,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 200,
  cost_usd: 0.01,
  context_window: null,
  ...over
})

describe('usageRowToTelemetry', () => {
  it('부모/자식 행을 ProviderReportedTelemetry 로 재구성한다(camelCase)', () => {
    expect(usageRowToTelemetry(turn({}), [model({})])).toEqual({
      model: 'claude-opus-4-5',
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 1000,
      cacheCreationTokens: 200,
      costUsd: 0.01,
      modelUsage: {
        'claude-opus-4-5': {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 1000,
          cacheCreationTokens: 200,
          costUsd: 0.01
        }
      }
    })
  })

  it('primary model 은 input_tokens 가 가장 큰 자식 행에서 고른다', () => {
    expect(
      usageRowToTelemetry(turn({}), [
        model({ model: 'claude-haiku-4', input_tokens: 10 }),
        model({ id: 2, model: 'claude-opus-4-5', input_tokens: 200 })
      ]).model
    ).toBe('claude-opus-4-5')
  })

  it('null 필드는 키를 생략한다(graceful)', () => {
    expect(
      usageRowToTelemetry(
        turn({ output_tokens: null, cache_creation_input_tokens: null, total_cost_usd: null }),
        [model({ output_tokens: null, cache_creation_input_tokens: null, cost_usd: null })]
      )
    ).toEqual({
      model: 'claude-opus-4-5',
      inputTokens: 100,
      cacheReadTokens: 1000,
      modelUsage: {
        'claude-opus-4-5': {
          inputTokens: 100,
          cacheReadTokens: 1000
        }
      }
    })
  })
})

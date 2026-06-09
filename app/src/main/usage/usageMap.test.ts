import { describe, it, expect } from 'vitest'
import { usageRowToTelemetry, hasContextTokens } from './usageMap'
import type { TurnModelUsageRow, TurnUsageRow } from '../db/types'

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

describe('hasContextTokens', () => {
  it('컨텍스트 3종이 모두 없거나 0이면 false (/context 류 빈 턴)', () => {
    expect(hasContextTokens({})).toBe(false)
    expect(hasContextTokens({ inputTokens: 0 })).toBe(false)
    expect(hasContextTokens({ outputTokens: 99 })).toBe(false)
  })

  it('input·cacheRead·cacheCreation 중 하나라도 1 이상이면 true', () => {
    expect(hasContextTokens({ inputTokens: 1 })).toBe(true)
    expect(hasContextTokens({ cacheReadTokens: 1 })).toBe(true)
    expect(hasContextTokens({ cacheCreationTokens: 1 })).toBe(true)
  })
})

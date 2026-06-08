import { describe, it, expect } from 'vitest'
import { usageRowToTelemetry } from './usageMap'
import type { UsageRow } from '../db/types'

const row = (over: Partial<UsageRow>): UsageRow => ({
  id: 1,
  session_id: 's1',
  model: 'claude-opus-4-5',
  created_at: 1,
  input_tokens: 100,
  output_tokens: 50,
  cache_read_tokens: 1000,
  cache_creation_tokens: 200,
  cost_usd: 0.01,
  ...over
})

describe('usageRowToTelemetry', () => {
  it('행을 ProviderReportedTelemetry 로 재구성한다(camelCase)', () => {
    expect(usageRowToTelemetry(row({}))).toEqual({
      model: 'claude-opus-4-5',
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 1000,
      cacheCreationTokens: 200,
      costUsd: 0.01
    })
  })

  it('null 필드는 키를 생략한다(graceful)', () => {
    expect(
      usageRowToTelemetry(
        row({ model: null, output_tokens: null, cache_creation_tokens: null, cost_usd: null })
      )
    ).toEqual({
      inputTokens: 100,
      cacheReadTokens: 1000
    })
  })
})

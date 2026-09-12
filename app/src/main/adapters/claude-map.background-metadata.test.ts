import { describe, expect, it } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { NormalizedEvent } from '../../shared/ipc'
import { claudeToNormalized, type MapContext } from './claude-map'

describe('0231 transcript metadata', () => {
  it('accounts query cumulative cost and model usage as deltas and resets with a new query', () => {
    const ctx: MapContext = { sessionId: 's', cwd: '/tmp' }
    const result = (id: string, cost: number, tokens: number, context = ctx): NormalizedEvent =>
      claudeToNormalized(
        {
          type: 'result',
          uuid: id,
          subtype: 'success',
          total_cost_usd: cost,
          usage: { input_tokens: 10, output_tokens: 2 },
          modelUsage: {
            model: {
              inputTokens: tokens,
              outputTokens: tokens / 2,
              costUSD: cost,
              contextWindow: 200000
            }
          }
        } as unknown as SDKMessage,
        context
      )[0]
    expect(result('r1', 1, 100)).toMatchObject({
      usage: { costUsd: 1, modelUsage: { model: { inputTokens: 100 } } }
    })
    expect(result('r2', 1.5, 150)).toMatchObject({
      usage: {
        inputTokens: 10,
        outputTokens: 2,
        costUsd: 0.5,
        modelUsage: {
          model: { inputTokens: 50, outputTokens: 25, costUsd: 0.5, contextWindow: 200000 }
        }
      }
    })
    expect(result('r3', 0.2, 20)).toMatchObject({
      usage: { costUsd: 0.2, modelUsage: { model: { inputTokens: 20 } } }
    })
    expect(result('r4', 0.4, 40, { sessionId: 's', cwd: '/tmp' })).toMatchObject({
      usage: { costUsd: 0.4, modelUsage: { model: { inputTokens: 40 } } }
    })
  })

  it('does not emit a second terminal or advance cumulative usage for a corrected result UUID', () => {
    const ctx: MapContext = { sessionId: 's', cwd: '/tmp' }
    const result = (uuid: string, total_cost_usd: number): NormalizedEvent[] =>
      claudeToNormalized(
        {
          type: 'result',
          uuid,
          subtype: 'success',
          total_cost_usd,
          usage: { input_tokens: 1 }
        } as unknown as SDKMessage,
        ctx
      )
    expect(result('r1', 1)).toHaveLength(1)
    expect(result('r1', 1.1)).toEqual([])
    expect(result('r2', 1.5)[0]).toMatchObject({ usage: { costUsd: 0.5 } })
  })
  it('retains input UUID arrays and queued count on result', () => {
    const events = claudeToNormalized(
      {
        type: 'result',
        subtype: 'success',
        user_message_uuid: 'b',
        user_message_uuids: ['a', 'b'],
        queued_turn_count: 0
      } as unknown as SDKMessage,
      { sessionId: 's', cwd: '/tmp' }
    )
    expect(events[0]).toMatchObject({
      type: 'telemetry',
      userMessageUuid: 'b',
      userMessageUuids: ['a', 'b'],
      queuedTurnCount: 0
    })
  })

  it('routes child thinking without replacing main context usage', () => {
    const ctx: MapContext = {
      sessionId: 's',
      cwd: '/tmp',
      lastAssistantUsage: { inputTokens: 100 }
    }
    const events = claudeToNormalized(
      {
        type: 'assistant',
        parent_tool_use_id: 'child',
        message: {
          content: [{ type: 'thinking', thinking: 'child thoughts' }],
          usage: { input_tokens: 7 }
        }
      } as unknown as SDKMessage,
      ctx
    )
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'message.reasoning',
        parentToolRunId: 'child',
        text: 'child thoughts'
      })
    )
    expect(ctx.lastAssistantUsage).toEqual({ inputTokens: 100 })
  })

  it('routes child text and thinking deltas to their parent tool', () => {
    const ctx: MapContext = { sessionId: 's', cwd: '/tmp' }
    for (const delta of [
      { type: 'text_delta', text: 'child text' },
      { type: 'thinking_delta', thinking: 'child thinking' }
    ]) {
      expect(
        claudeToNormalized(
          {
            type: 'stream_event',
            parent_tool_use_id: 'agent',
            event: { delta }
          } as unknown as SDKMessage,
          ctx
        )[0]
      ).toMatchObject({ parentToolRunId: 'agent' })
    }
  })
})

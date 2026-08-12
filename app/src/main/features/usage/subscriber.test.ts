// 0186 — 턴 종료 시 **전역 1회 + 영향받은 provider 1회만** 재집계한다는 성능 계약을 고정한다.
// provider 목록을 훑거나 전 provider 를 미리 계산하면 이 테스트가 깨진다.

import { describe, expect, it, vi } from 'vitest'
import type { NormalizedEvent } from '../../../shared/ipc'
import type { TurnContext } from '../../contracts/turn'
import type { DbQueries } from '../../infra/db'
import { recordTurnUsage } from './subscriber'
import type { UsageTracker } from './tracker'

function fakeDb(): { db: DbQueries; insertTurnUsage: ReturnType<typeof vi.fn> } {
  const insertTurnUsage = vi.fn().mockReturnValue(1)
  const db = {
    insertTurnUsage,
    insertTurnModelUsage: vi.fn()
  } as unknown as DbQueries
  return { db, insertTurnUsage }
}

function turnCtx(over: Partial<TurnContext> = {}): TurnContext {
  return {
    dbSessionId: 'sess-1',
    currentAssistantMessageId: 7,
    providerKey: 'claude-gateway',
    ...over
  } as TurnContext
}

function telemetry(): Extract<NormalizedEvent, { type: 'telemetry' }> {
  return {
    type: 'telemetry',
    sessionId: 'sess-1',
    usage: { inputTokens: 10, outputTokens: 4, costUsd: 0.5, model: 'claude-sonnet-4' }
  } as Extract<NormalizedEvent, { type: 'telemetry' }>
}

describe('recordTurnUsage', () => {
  it('영향받은 provider 만 재집계한다', () => {
    const { db } = fakeDb()
    const recordAndBroadcast = vi.fn()
    const cost = { recordAndBroadcast } as unknown as UsageTracker

    recordTurnUsage(db, cost, turnCtx({ providerKey: 'claude-gateway' }), telemetry())

    // 정확히 1회, 그리고 이 턴의 providerKey 만 넘긴다 — 전 provider 를 훑지 않는다.
    expect(recordAndBroadcast).toHaveBeenCalledTimes(1)
    expect(recordAndBroadcast).toHaveBeenCalledWith('claude-gateway')
  })

  it('providerKey 가 없는 턴은 전역만 갱신한다', () => {
    const { db } = fakeDb()
    const recordAndBroadcast = vi.fn()
    const cost = { recordAndBroadcast } as unknown as UsageTracker

    recordTurnUsage(db, cost, turnCtx({ providerKey: null }), telemetry())

    expect(recordAndBroadcast).toHaveBeenCalledWith(null)
  })

  it('컨텍스트 0 인 턴은 원장에 적재하지도, 갱신하지도 않는다', () => {
    const { db, insertTurnUsage } = fakeDb()
    const recordAndBroadcast = vi.fn()
    const cost = { recordAndBroadcast } as unknown as UsageTracker

    const empty = {
      type: 'telemetry',
      sessionId: 'sess-1',
      usage: { inputTokens: 0, outputTokens: 0 }
    } as Extract<NormalizedEvent, { type: 'telemetry' }>
    recordTurnUsage(db, cost, turnCtx(), empty)

    expect(insertTurnUsage).not.toHaveBeenCalled()
    expect(recordAndBroadcast).not.toHaveBeenCalled()
  })
})

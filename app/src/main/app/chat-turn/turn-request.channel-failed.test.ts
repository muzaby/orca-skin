import { describe, expect, it, vi } from 'vitest'
import type { ClientRef } from '../../contracts/client'
import type { TurnRequest } from '../../adapters/common/turn'
import type { TurnContext } from '../../contracts/turn'
import { PendingMessageQueue } from '../../features/chat/pending-message-queue'
import type { SessionActivityProjector } from '../../features/chat/session-activity-projector'
import { buildTurnRequest } from './turn-request'

// 0324 EP-11 — `harness.exited` 는 채널이 끊긴 시점의 활성 턴 세션으로 나간다.
describe('buildTurnRequest 채널 오류 통지', () => {
  function setup(onHarnessExited?: (sessionId: string | null) => void): {
    request: TurnRequest
    setTurn(dbSessionId: string | null): void
  } {
    let turn = {
      dbSessionId: null,
      blockedSubagents: new Set<string>()
    } as unknown as TurnContext<ClientRef>
    const request = buildTurnRequest(
      {
        wc: { isClosed: () => false, send: vi.fn() } as unknown as ClientRef,
        pendingMessages: new PendingMessageQueue(),
        activity: {} as SessionActivityProjector,
        queueKey: 'client:1',
        getActiveTurn: () => turn,
        getInitialBatches: () => [],
        ...(onHarnessExited ? { onHarnessExited } : {})
      },
      { sessionId: null, text: 'x', cwd: '/w', extensions: { skills: [] } as never }
    )
    return {
      request,
      setTurn: (dbSessionId: string | null) => {
        turn = { ...turn, dbSessionId }
      }
    }
  }

  it('채널이 끊긴 시점의 활성 턴 세션을 넘긴다 — 조립 시점 값으로 굳지 않는다', () => {
    const exited = vi.fn()
    const t = setup(exited)

    t.request.onChannelFailed?.()
    t.setTurn('confirmed-session')
    t.request.onChannelFailed?.()

    expect(exited.mock.calls).toEqual([[null], ['confirmed-session']])
  })

  it('받는 쪽이 없어도 던지지 않는다', () => {
    const t = setup()
    expect(() => t.request.onChannelFailed?.()).not.toThrow()
    expect(t.request.onChannelFailed).toBeTypeOf('function')
  })
})

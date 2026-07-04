import { describe, expect, it, vi } from 'vitest'
import { abortTurn } from './abort'
import type { TurnContext } from '../../contracts/turn'
import type { RuntimeLiveTurn } from '../../contracts/ports'

function fakeTurn(live: RuntimeLiveTurn | null = null): TurnContext<object> {
  return { controller: new AbortController(), owner: {}, live } as unknown as TurnContext<object>
}

describe('abortTurn (단일 abort 프리미티브)', () => {
  it('라이브 핸들에 원인을 표시하고 controller 를 abort 한다', () => {
    const markAborted = vi.fn()
    const turn = fakeTurn({ markAborted } as unknown as RuntimeLiveTurn)
    abortTurn(turn, 'user_cancelled')
    expect(markAborted).toHaveBeenCalledExactlyOnceWith('user_cancelled')
    expect(turn.controller.signal.aborted).toBe(true)
  })

  it('stall 원인도 그대로 전달한다', () => {
    const markAborted = vi.fn()
    const turn = fakeTurn({ markAborted } as unknown as RuntimeLiveTurn)
    abortTurn(turn, 'stall')
    expect(markAborted).toHaveBeenCalledExactlyOnceWith('stall')
    expect(turn.controller.signal.aborted).toBe(true)
  })

  it('live 가 아직 없으면(턴 시작 전) markAborted 없이 controller 만 abort 한다 — throw 금지', () => {
    const turn = fakeTurn(null)
    expect(() => abortTurn(turn, 'user_cancelled')).not.toThrow()
    expect(turn.controller.signal.aborted).toBe(true)
  })
})

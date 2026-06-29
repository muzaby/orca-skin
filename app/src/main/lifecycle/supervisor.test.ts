import { describe, expect, it, vi } from 'vitest'
import { RuntimeSupervisor, abortTurn } from './supervisor'
import { SessionRuntimeRegistry } from './session-registry'
import type { InflightTurn } from './turn-context'
import type { RuntimeLiveTurn } from './ports'

function fakeTurn(live: RuntimeLiveTurn | null = null): InflightTurn<object> {
  return { controller: new AbortController(), owner: {}, live } as unknown as InflightTurn<object>
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

describe('RuntimeSupervisor', () => {
  it('release 는 멱등 — 2회 호출돼도 registry.finish 효력은 1회뿐이다', () => {
    const registry = new SessionRuntimeRegistry<object>()
    const finishSpy = vi.spyOn(registry, 'finish')
    const supervisor = new RuntimeSupervisor<object>(registry)
    const turn = fakeTurn()

    supervisor.startResume('s1', turn)
    expect(supervisor.hasSession('s1')).toBe(true)

    supervisor.release(turn)
    expect(supervisor.hasSession('s1')).toBe(false)
    expect(supervisor.size).toBe(0)

    supervisor.release(turn)
    expect(finishSpy).toHaveBeenCalledTimes(1)
    expect(supervisor.size).toBe(0)
  })

  it('서로 다른 턴의 release 는 각자 1회씩 finish 된다', () => {
    const registry = new SessionRuntimeRegistry<object>()
    const finishSpy = vi.spyOn(registry, 'finish')
    const supervisor = new RuntimeSupervisor<object>(registry)
    const a = fakeTurn()
    const b = fakeTurn()
    supervisor.startResume('a', a)
    supervisor.startResume('b', b)

    supervisor.release(a)
    supervisor.release(b)
    supervisor.release(a)
    expect(finishSpy).toHaveBeenCalledTimes(2)
    expect(supervisor.size).toBe(0)
  })

  it('조회·승격은 내부 레지스트리에 그대로 위임된다', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const owner = {}
    const pending = fakeTurn()
    pending.owner = owner
    const resume = fakeTurn()

    supervisor.startNew(owner, pending)
    supervisor.startResume('s2', resume)
    expect(supervisor.hasPending(owner)).toBe(true)
    expect(supervisor.getBySession('s2')).toBe(resume)
    expect(supervisor.size).toBe(2)
    expect(supervisor.all()).toEqual(expect.arrayContaining([pending, resume]))

    supervisor.promote(pending, 's1')
    expect(supervisor.hasPending(owner)).toBe(false)
    expect(supervisor.getBySession('s1')).toBe(pending)
  })

  it('인자 없는 생성자는 자체 레지스트리를 갖는다(컴포지션 루트 기본 배선)', () => {
    const supervisor = new RuntimeSupervisor<object>()
    expect(supervisor.size).toBe(0)
    const turn = fakeTurn()
    supervisor.startResume('s1', turn)
    expect(supervisor.size).toBe(1)
  })
})

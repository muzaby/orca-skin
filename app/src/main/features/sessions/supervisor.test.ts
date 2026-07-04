import { describe, expect, it, vi } from 'vitest'
import { RuntimeSupervisor } from './supervisor'
import { SessionRuntimeRegistry } from './session-registry'
import type { InflightTurn } from '../../contracts/turn'
import type { ManagedRuntime, RuntimeLiveTurn } from '../../contracts/ports'
import type { SessionRuntimeState } from '../../contracts/session-state'

function fakeTurn(live: RuntimeLiveTurn | null = null): InflightTurn<object> {
  return { controller: new AbortController(), owner: {}, live } as unknown as InflightTurn<object>
}

function fakeManaged(
  state: SessionRuntimeState = 'live',
  reusable = true
): ManagedRuntime & { closed: number } {
  const rt = {
    closed: 0,
    state,
    reusable,
    close(): void {
      rt.closed += 1
      rt.state = 'closed'
    }
  }
  return rt as unknown as ManagedRuntime & { closed: number }
}

describe('RuntimeSupervisor', () => {
  it('release 는 멱등 — 2회 호출돼도 registry.finish 효력은 1회뿐이다', () => {
    const registry = new SessionRuntimeRegistry<object>()
    const finishSpy = vi.spyOn(registry, 'finish')
    const supervisor = new RuntimeSupervisor<object>({ registry })
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
    const supervisor = new RuntimeSupervisor<object>({ registry })
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

describe('RuntimeSupervisor 런타임 거버넌스(0054)', () => {
  it('정상 종료한 reusable 핸들은 idle 보존되고 같은 세션 acquire 가 재사용한다', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const rt = fakeManaged('live', true)
    supervisor.releaseRuntime('s1', rt)
    expect(rt.closed).toBe(0)

    const sentinel = fakeManaged()
    const got = supervisor.acquireRuntime('s1', () => sentinel)
    expect(got).toBe(rt)
    expect(got).not.toBe(sentinel)
  })

  it('풀에 없으면 acquireRuntime 은 factory 로 새 핸들을 만든다', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const made = fakeManaged()
    expect(supervisor.acquireRuntime('sX', () => made)).toBe(made)
    expect(supervisor.acquireRuntime(null, () => made)).toBe(made)
  })

  it('비-reusable(OneShot) 핸들은 releaseRuntime 이 즉시 close 하고 재사용하지 않는다', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const oneShot = fakeManaged('live', false)
    supervisor.releaseRuntime('s2', oneShot)
    expect(oneShot.closed).toBe(1)

    const fresh = fakeManaged()
    expect(supervisor.acquireRuntime('s2', () => fresh)).toBe(fresh)
  })

  it('비정상 종료(state!==live)한 reusable 핸들도 보존하지 않고 close 한다', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const errored = fakeManaged('error', true)
    supervisor.releaseRuntime('s3', errored)
    expect(errored.closed).toBe(1)
    const fresh = fakeManaged()
    expect(supervisor.acquireRuntime('s3', () => fresh)).toBe(fresh)
  })

  it('sessionId 가 null 이면 reusable 라도 보존 못 하고 close', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const rt = fakeManaged('live', true)
    supervisor.releaseRuntime(null, rt)
    expect(rt.closed).toBe(1)
  })

  it('closeIdleRuntimes 는 보존된 idle 핸들을 일괄 close 한다', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const a = fakeManaged('live', true)
    const b = fakeManaged('live', true)
    supervisor.releaseRuntime('a', a)
    supervisor.releaseRuntime('b', b)
    supervisor.closeIdleRuntimes()
    expect(a.closed).toBe(1)
    expect(b.closed).toBe(1)
    expect(supervisor.acquireRuntime('a', () => a)).toBe(a) // 풀 비었으므로 factory 반환
  })
})

describe('RuntimeSupervisor resource governance (0055)', () => {
  it('getRuntimePopulation 은 active + idle SessionRuntime 인구만 센다', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const turn = fakeTurn()
    supervisor.startResume('s1', turn)
    const rt = fakeManaged('live', true)
    supervisor.releaseRuntime('idle-1', rt)

    expect(supervisor.getRuntimePopulation()).toEqual({ active: 1, idle: 1, total: 2 })
  })

  it('기본 cap 정책은 무제한이라 idle 을 축출하지 않는다', () => {
    const supervisor = new RuntimeSupervisor<object>()
    const a = fakeManaged('live', true)
    const b = fakeManaged('live', true)
    supervisor.releaseRuntime('a', a)
    supervisor.releaseRuntime('b', b)

    expect(supervisor.getRuntimePopulation()).toEqual({ active: 0, idle: 2, total: 2 })
    expect(a.closed).toBe(0)
    expect(b.closed).toBe(0)
  })

  it('bounded cap 은 active 를 닫지 않고 idle target capacity 까지만 LRU 축출한다', async () => {
    const { BoundedRuntimeCapPolicy } = await import('./runtime-cap-policy')
    const supervisor = new RuntimeSupervisor<object>({
      capPolicy: new BoundedRuntimeCapPolicy(),
      capacity: 2
    })
    supervisor.startResume('active', fakeTurn())
    const oldest = fakeManaged('live', true)
    const newest = fakeManaged('live', true)

    supervisor.releaseRuntime('oldest', oldest)
    supervisor.releaseRuntime('newest', newest)

    expect(oldest.closed).toBe(1)
    expect(newest.closed).toBe(0)
    expect(supervisor.getRuntimePopulation()).toEqual({ active: 1, idle: 1, total: 2 })
  })

  it('ActiveTurnTracker 는 Supervisor 가 소유하고 getter 로 노출한다', async () => {
    const { ActiveTurnTracker } = await import('./active-turn-tracker')
    const events: Array<[string, number]> = []
    const activeTurns = new ActiveTurnTracker((projectId, count) => events.push([projectId, count]))
    const supervisor = new RuntimeSupervisor<object>({ activeTurns })

    supervisor.activeTurns.increment('p1')
    supervisor.activeTurns.decrement('p1')

    expect(events).toEqual([
      ['p1', 1],
      ['p1', 0]
    ])
  })
})

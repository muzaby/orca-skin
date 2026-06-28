import { describe, expect, it } from 'vitest'
import { TurnRegistry, type InflightTurn } from './turn-context'

// 레지스트리는 턴 객체 내부를 들여다보지 않으므로(키잉·동일성만) 최소 형태로 충분하다.
// owner 가 InflightTurn<W> 의 필드라 TurnRegistry<object> 와 맞물리도록 object 로 파라미터화한다.
function fakeTurn(): InflightTurn<object> {
  return { controller: new AbortController(), owner: {} } as unknown as InflightTurn<object>
}

describe('TurnRegistry', () => {
  it('resume 턴은 sessionId 로 키잉되고 finish 로 정리된다', () => {
    const reg = new TurnRegistry<object>()
    const turn = fakeTurn()
    reg.startResume('s1', turn)
    expect(reg.hasSession('s1')).toBe(true)
    expect(reg.getBySession('s1')).toBe(turn)
    reg.finish(turn)
    expect(reg.hasSession('s1')).toBe(false)
    expect(reg.size).toBe(0)
  })

  it('새-채팅 턴은 owner 슬롯에 보관되고 promote 로 sessionId 키로 승격된다', () => {
    const reg = new TurnRegistry<object>()
    const owner = {}
    const turn = fakeTurn()
    reg.startNew(owner, turn)
    expect(reg.hasPending(owner)).toBe(true)
    expect(reg.hasSession('s1')).toBe(false)

    turn.owner = owner
    reg.promote(turn, 's1')
    expect(reg.hasPending(owner)).toBe(false)
    expect(reg.getBySession('s1')).toBe(turn)
  })

  it('promote 는 pending 이 없으면 무해한 no-op (resume 턴의 session.updated)', () => {
    const reg = new TurnRegistry<object>()
    const turn = fakeTurn()
    reg.startResume('s1', turn)
    reg.promote(turn, 's1')
    expect(reg.getBySession('s1')).toBe(turn)
    expect(reg.size).toBe(1)
  })

  it('resume session.updated 는 같은 owner 의 새-채팅 pending 턴을 오승격하지 않는다', () => {
    const reg = new TurnRegistry<object>()
    const owner = {}
    const pending = fakeTurn()
    pending.owner = owner
    const resume = fakeTurn()
    resume.owner = owner

    reg.startNew(owner, pending)
    reg.startResume('resume-existing', resume)

    reg.promote(resume, 'resume-session')
    expect(reg.hasPending(owner)).toBe(true)
    expect(reg.getBySession('resume-session')).toBeUndefined()
    expect(reg.getBySession('resume-existing')).toBe(resume)

    reg.promote(pending, 'fresh-session')
    expect(reg.hasPending(owner)).toBe(false)
    expect(reg.getBySession('fresh-session')).toBe(pending)
  })

  it('서로 다른 세션의 동시 턴을 허용한다', () => {
    const reg = new TurnRegistry<object>()
    const a = fakeTurn()
    const b = fakeTurn()
    reg.startResume('s1', a)
    reg.startResume('s2', b)
    expect(reg.getBySession('s1')).toBe(a)
    expect(reg.getBySession('s2')).toBe(b)
    expect(reg.size).toBe(2)

    reg.finish(a)
    expect(reg.hasSession('s1')).toBe(false)
    expect(reg.getBySession('s2')).toBe(b)
  })

  it('같은 세션 중복은 hasSession 으로 가드 가능하다 (send 가드 시나리오)', () => {
    const reg = new TurnRegistry<object>()
    reg.startResume('s1', fakeTurn())
    expect(reg.hasSession('s1')).toBe(true)
    // 호출자(send)는 true 면 거부한다 — 레지스트리는 덮어쓰지 않을 책임이 호출자에 있음을 보장만.
  })

  it('all() 은 세션 키 + pending owner 양쪽의 진행 턴을 모두 반환한다 (shutdown 순회)', () => {
    const reg = new TurnRegistry<object>()
    const a = fakeTurn()
    const b = fakeTurn()
    const pending = fakeTurn()
    reg.startResume('s1', a)
    reg.startResume('s2', b)
    reg.startNew({}, pending)

    const all = reg.all()
    expect(all).toHaveLength(3)
    expect(all).toEqual(expect.arrayContaining([a, b, pending]))

    reg.finish(a)
    expect(reg.all()).toEqual(expect.arrayContaining([b, pending]))
    expect(reg.all()).toHaveLength(2)
  })

  it('승격 전 실패한 pending 턴도 finish 가 값 동일성으로 정리한다', () => {
    const reg = new TurnRegistry<object>()
    const owner = {}
    const turn = fakeTurn()
    reg.startNew(owner, turn)
    reg.finish(turn)
    expect(reg.hasPending(owner)).toBe(false)
    expect(reg.size).toBe(0)
  })
})

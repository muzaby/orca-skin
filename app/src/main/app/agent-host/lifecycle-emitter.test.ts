import { describe, expect, it } from 'vitest'
import { HostToShellSchema, type HostToShell } from '../../../shared/host-protocol'
import { LifecycleState } from '../shell/lifecycle-state'
import { createLifecycleEmitter, type LeaseIdentity } from './lifecycle-emitter'

interface Setup {
  emitter: ReturnType<typeof createLifecycleEmitter>
  emitted: HostToShell[]
  set(next: LeaseIdentity[]): void
  events(): string[]
}

function setup(): Setup {
  let leases: LeaseIdentity[] = []
  const emitted: HostToShell[] = []
  const emitter = createLifecycleEmitter({
    leases: () => leases,
    // 셸이 받는 것과 같은 스키마를 지난다.
    emit: (message) => emitted.push(HostToShellSchema.parse(message))
  })
  return {
    emitter,
    emitted,
    set: (next: LeaseIdentity[]) => {
      leases = next
      emitter.leasesChanged()
    },
    events: () =>
      emitted.flatMap((message) =>
        message.type === 'lifecycle' ? [`${message.event.type}:${message.event.sessionId}`] : []
      )
  }
}

const lease = (sessionId: string | null, logicalKey = `session:${sessionId}`): LeaseIdentity => ({
  logicalKey,
  sessionId
})

describe('수명 이벤트 방출', () => {
  it('세션의 lease 가 생기면 턴 시작 1건이다', () => {
    const t = setup()
    t.set([lease('s1')])
    expect(t.events()).toEqual(['turn.started:s1'])
  })

  it('lease 가 그대로인 변화 통지는 아무것도 보내지 않는다', () => {
    const t = setup()
    t.set([lease('s1')])
    t.set([lease('s1')])
    t.emitter.leasesChanged()
    expect(t.events()).toEqual(['turn.started:s1'])
  })

  it('세션의 lease 가 사라지면 턴 종료 1건이다', () => {
    const t = setup()
    t.set([lease('s1')])
    t.set([])
    expect(t.events()).toEqual(['turn.started:s1', 'turn.ended:s1'])
  })

  it('세션별로 따로 센다 — 한 세션의 해제가 다른 세션을 끝내지 않는다', () => {
    const t = setup()
    t.set([lease('s1'), lease('s2')])
    t.set([lease('s2')])
    expect(t.events()).toEqual(['turn.started:s1', 'turn.started:s2', 'turn.ended:s1'])
    t.set([])
    expect(t.events().at(-1)).toBe('turn.ended:s2')
  })

  it('승격은 새 식별자의 시작을 먼저, 옛 식별자의 종료를 나중에 보낸다', () => {
    const t = setup()
    t.set([lease(null, 'client:abc')])
    t.set([lease('s9', 'session:s9')])
    expect(t.events()).toEqual([
      'turn.started:client:abc',
      'turn.started:s9',
      'turn.ended:client:abc'
    ])

    // 셸의 활성 수가 승격 중에 0 을 지나지 않는다.
    const state = new LifecycleState()
    const counts: number[] = []
    state.onChange(() => counts.push(state.activeTurnCount()))
    for (const message of t.emitted) if (message.type === 'lifecycle') state.apply(message.event)
    expect(counts).toEqual([1, 2, 1])
  })

  it('승인 등록은 그 세션의 승인 대기 1건이다 — 세션 미확정이면 보내지 않는다', () => {
    const t = setup()
    t.emitter.approvalPending('s1')
    t.emitter.approvalPending(null)
    t.emitter.approvalPending(undefined)
    expect(t.events()).toEqual(['approval.pending:s1'])
  })

  it('세션 폐기는 세션 종료 1건이다', () => {
    const t = setup()
    t.emitter.sessionEnded('s1')
    expect(t.events()).toEqual(['session.ended:s1'])
  })

  it('채널 오류 종료는 하네스 종료 1건이다 — 세션 미확정이면 보내지 않는다', () => {
    const t = setup()
    t.emitter.harnessExited('s1')
    t.emitter.harnessExited(null)
    expect(t.events()).toEqual(['harness.exited:s1'])
  })
})

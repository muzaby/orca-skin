// 0166 A12·A13 — 재시작 게이트가 **lease 수명**을 본다. 구 구조(`supervisor.all()` = turn 집합)는
// child 교체 창에서 turn 이 0개라 "유휴" 로 오판했고, 그 창에서 업데이트가 설치될 수 있었다(D4).
import { describe, expect, it } from 'vitest'
import { canRestartForUpdate } from '../../../shared/update-restart'
import { RuntimeSupervisor } from './supervisor'
import { deriveLeaseGateState } from './restart-gate'
import { sessionLeaseKey } from './session-chain-lease'
import type { TurnContext } from '../../contracts/turn'

function turn(openToolRuns: string[] = []): TurnContext<string> {
  return {
    owner: 'w',
    controller: new AbortController(),
    openToolRuns: new Map(openToolRuns.map((id) => [id, { name: 'Bash' }]))
  } as unknown as TurnContext<string>
}

function acquire(supervisor: RuntimeSupervisor<string>, sessionId: string): string {
  const { lease, acquired } = supervisor.acquireChain({
    logicalKey: sessionLeaseKey(sessionId),
    sessionId,
    owner: 'w',
    requestedProviderKey: null
  })
  expect(acquired).toBe(true)
  return lease.leaseId
}

describe('deriveLeaseGateState — 작업 중 업데이트 설치 차단 (A12)', () => {
  it('lease 가 없으면 유휴 — 재시작 허용', () => {
    const gate = deriveLeaseGateState([])
    expect(gate).toEqual({ isGenerating: false, activeToolCallCount: 0 })
    expect(canRestartForUpdate({ ...gate, activeDbWriteCount: 0, isIndexing: false })).toBe(true)
  })

  it('**child 가 없는 lease(교체 창·준비 구간)도 생성 중이다** — 재시작 차단', () => {
    const supervisor = new RuntimeSupervisor<string>()
    acquire(supervisor, 's1') // preparing — activeChild 는 null
    const gate = deriveLeaseGateState(supervisor.allLeases())
    expect(gate.isGenerating).toBe(true)
    expect(gate.activeToolCallCount).toBe(0)
    expect(canRestartForUpdate({ ...gate, activeDbWriteCount: 0, isIndexing: false })).toBe(false)
  })

  it('active lease 의 열린 도구 호출 수를 합산한다', () => {
    const supervisor = new RuntimeSupervisor<string>()
    const leaseId = acquire(supervisor, 's1')
    supervisor.activateChain(
      leaseId,
      { state: 'live', reusable: true, close: () => {} } as never,
      'claude',
      turn(['t1', 't2'])
    )
    expect(deriveLeaseGateState(supervisor.allLeases())).toEqual({
      isGenerating: true,
      activeToolCallCount: 2
    })
  })

  it('여러 세션의 lease 를 함께 센다', () => {
    const supervisor = new RuntimeSupervisor<string>()
    acquire(supervisor, 's1')
    acquire(supervisor, 's2')
    expect(deriveLeaseGateState(supervisor.allLeases()).isGenerating).toBe(true)
  })
})

describe('lease 해제가 게이트를 되돌린다 (A13)', () => {
  it('마지막 lease 가 해제되면 유휴로 돌아온다', () => {
    const supervisor = new RuntimeSupervisor<string>()
    const first = acquire(supervisor, 's1')
    const second = acquire(supervisor, 's2')
    supervisor.releaseChain(first)
    expect(deriveLeaseGateState(supervisor.allLeases()).isGenerating).toBe(true)
    supervisor.releaseChain(second)
    expect(deriveLeaseGateState(supervisor.allLeases()).isGenerating).toBe(false)
  })

  it('lease 수명 전이마다 구독자에게 통지된다 — 게이트 refresh 훅이 걸리는 자리', () => {
    const supervisor = new RuntimeSupervisor<string>()
    const seen: string[] = []
    supervisor.subscribeLeases((key) => seen.push(key))
    const leaseId = acquire(supervisor, 's1')
    supervisor.activateChain(
      leaseId,
      { state: 'live', reusable: true, close: () => {} } as never,
      'claude',
      turn()
    )
    supervisor.releaseChain(leaseId)
    // acquire · activate · release 세 전이가 모두 통지된다.
    expect(seen).toEqual([sessionLeaseKey('s1'), sessionLeaseKey('s1'), sessionLeaseKey('s1')])
  })
})

describe('세션 전체 중단·종료가 lease runtime 을 닫는다 (A15·A17)', () => {
  it('closeAllLeaseRuntimes 는 준비 중 lease 를 abort 하고 active runtime 을 닫는다', () => {
    const supervisor = new RuntimeSupervisor<string>()
    acquire(supervisor, 's1')
    const activeId = acquire(supervisor, 's2')
    let closed = 0
    const child = turn()
    supervisor.activateChain(
      activeId,
      { state: 'live', reusable: true, close: () => (closed += 1) } as never,
      'claude',
      child
    )

    supervisor.closeAllLeaseRuntimes()

    // ① 준비 중 체인은 controller abort 로 spawn 을 막는다.
    expect(supervisor.getChainByKey(sessionLeaseKey('s1'))?.controller.signal.aborted).toBe(true)
    expect(supervisor.getChainByKey(sessionLeaseKey('s1'))?.kind).toBe('closing')
    // ② active child 도 abort ③ lease runtime close — 서브프로세스 잔존 방지(D5).
    expect(child.controller.signal.aborted).toBe(true)
    expect(closed).toBe(1)
  })
})

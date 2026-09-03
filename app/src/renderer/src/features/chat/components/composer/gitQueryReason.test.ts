// 0211 ΔV5 AT-62 / VP-63 — 계기 판정 **두 함수**와 그 값 집합 (D-099·D-101 · §10 EP-42).
//
// 사용자 결정: 변경 목록은 "오직 에이전트 메시지 턴 반환시" 만 싱크한다. 저장소·브랜치
// 이름은 세션의 식별이라 그 축에서 빠진다.
//
// **두 함수가 서로의 oracle 이다.** 하나만 재면 둘을 한 함수로 합친 변이가 통과한다 —
// 합치면 이름 조회까지 턴 종료로 묶여 앱을 다시 켠 세션에서 컴포저 git 행이 사라지거나
// (D-101 위반), 반대로 목록이 세션을 열 때마다 조회돼 D-099 가 절반만 적용된다.

import { describe, expect, it } from 'vitest'
import {
  gitSnapshotTriggerKey,
  gitStatusQueryReason,
  gitStatusTriggerKey,
  gitSummaryQueryReason
} from './useGitSnapshot'

describe('변경 목록의 계기 (gitSummaryQueryReason)', () => {
  it('마운트도 세션 전환도 계기가 아니고 턴 종료만 계기다', () => {
    // 세 값을 **한 묶음**으로 잰다. 하나만 보면 함수를 상수 `null` 로 만든 변이가 통과한다.
    expect(gitSummaryQueryReason(null, { busy: false })).toBeNull()
    expect(gitSummaryQueryReason({ busy: false }, { busy: false })).toBeNull()
    expect(gitSummaryQueryReason({ busy: false }, { busy: true })).toBeNull()
    expect(gitSummaryQueryReason({ busy: true }, { busy: false })).toBe('turn-end')
  })

  it('한 세션의 전 수명에서 조회 계기가 턴 수와 같다', () => {
    const reasons: string[] = []
    let previous: { busy: boolean } | null = null
    // 마운트 → 유휴 → 턴1(시작·종료) → 세션 키 변경(계기 아님) → 턴2(시작·종료)
    for (const busy of [false, false, true, false, false, true, false]) {
      const reason = gitSummaryQueryReason(previous, { busy })
      previous = { busy }
      if (reason) reasons.push(reason)
    }

    expect(reasons).toEqual(['turn-end', 'turn-end'])
  })
})

describe('저장소·브랜치 이름의 계기 (gitStatusQueryReason)', () => {
  it('마운트·좌표 변경·턴 종료 셋을 유지한다', () => {
    const a = gitStatusTriggerKey('/repo-a')
    const b = gitStatusTriggerKey('/repo-b')

    expect(gitStatusQueryReason(null, { identity: a, busy: false })).toBe('initial')
    expect(gitStatusQueryReason({ identity: a, busy: false }, { identity: b, busy: false })).toBe(
      'identity'
    )
    expect(gitStatusQueryReason({ identity: a, busy: true }, { identity: a, busy: false })).toBe(
      'turn-end'
    )
    expect(
      gitStatusQueryReason({ identity: a, busy: false }, { identity: a, busy: false })
    ).toBeNull()
  })
})

describe('두 함수는 같은 입력에서 다른 값을 낸다', () => {
  it('마운트에서 이름은 조회하고 목록은 조회하지 않는다', () => {
    const identity = gitStatusTriggerKey('/repo')

    expect(gitStatusQueryReason(null, { identity, busy: false })).toBe('initial')
    expect(gitSummaryQueryReason(null, { busy: false })).toBeNull()
  })

  it('세션 전환에서 이름은 조회하고 목록은 조회하지 않는다', () => {
    const previous = { identity: gitStatusTriggerKey('/repo-a'), busy: false }
    const next = { identity: gitStatusTriggerKey('/repo-b'), busy: false }

    expect(gitStatusQueryReason(previous, next)).toBe('identity')
    // 목록 축은 좌표를 보지 않는다 — 키가 바뀌어도 턴이 끝나지 않으면 조회가 없다.
    expect(gitSummaryQueryReason({ busy: previous.busy }, { busy: next.busy })).toBeNull()
    expect(gitSnapshotTriggerKey('/repo-a', 's')).not.toBe(gitSnapshotTriggerKey('/repo-b', 's'))
  })

  it('턴 종료에서만 두 함수가 같은 값을 낸다', () => {
    const identity = gitStatusTriggerKey('/repo')

    expect(gitStatusQueryReason({ identity, busy: true }, { identity, busy: false })).toBe(
      'turn-end'
    )
    expect(gitSummaryQueryReason({ busy: true }, { busy: false })).toBe('turn-end')
  })
})

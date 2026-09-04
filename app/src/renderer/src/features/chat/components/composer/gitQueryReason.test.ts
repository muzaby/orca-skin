// 0211 ΔV5 AT-62 · ΔV6 AT-71 / VP-63 · VP-72 — 계기 판정 **두 함수**와 그 값 집합
// (D-099·D-101·D-115 · §10 EP-42 · EP-46).
//
// 사용자 결정: 변경 목록은 "오직 에이전트 메시지 턴 반환시" 만 싱크한다. 저장소·브랜치
// 이름은 세션의 식별이라 그 축에서 빠진다.
//
// **ΔV6 — 그 “턴 반환” 의 출처가 `busy` 에서 Stop hook 으로 바뀌었다.** 두 함수의 입력이
// 이제 `turnEndTick` 이고, 그 값은 백엔드 `Stop` hook 이 낸 `turn.ended` 만 센다. `busy` 는
// `result` 메시지가 만드는 파생이라 사용자가 지목한 자리였다.
//
// **두 함수가 서로의 oracle 이다.** 하나만 재면 둘을 한 함수로 합친 변이가 통과한다 —
// 합치면 이름 조회까지 턴 종료로 묶여 앱을 다시 켠 세션에서 컴포저 git 행이 사라지거나
// (D-101 위반), 반대로 목록이 세션을 열 때마다 조회돼 D-099 가 절반만 적용된다.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  gitSnapshotTriggerKey,
  gitStatusQueryReason,
  gitStatusTriggerKey,
  gitSummaryQueryReason
} from './useGitSnapshot'

describe('변경 목록의 계기 (gitSummaryQueryReason)', () => {
  it('마운트도 세션 전환도 계기가 아니고 tick 증가만 계기다', () => {
    // 세 값을 **한 묶음**으로 잰다. 하나만 보면 함수를 상수 `null` 로 만든 변이가 통과한다.
    expect(gitSummaryQueryReason(null, { tick: 0 })).toBeNull()
    expect(gitSummaryQueryReason({ tick: 0 }, { tick: 0 })).toBeNull()
    expect(gitSummaryQueryReason({ tick: 3 }, { tick: 3 })).toBeNull()
    expect(gitSummaryQueryReason({ tick: 0 }, { tick: 1 })).toBe('turn-end')
  })

  it('한 세션의 전 수명에서 조회 계기가 Stop hook 수와 같다', () => {
    const reasons: string[] = []
    let previous: { tick: number } | null = null
    // 마운트 → 유휴 → 턴1 종료 → 세션 키 변경(계기 아님) → 턴2 종료
    for (const tick of [0, 0, 1, 1, 1, 2, 2]) {
      const reason = gitSummaryQueryReason(previous, { tick })
      previous = { tick }
      if (reason) reasons.push(reason)
    }

    expect(reasons).toEqual(['turn-end', 'turn-end'])
  })
})

describe('저장소·브랜치 이름의 계기 (gitStatusQueryReason)', () => {
  it('마운트·좌표 변경·턴 종료 셋을 유지한다', () => {
    const a = gitStatusTriggerKey('/repo-a')
    const b = gitStatusTriggerKey('/repo-b')

    expect(gitStatusQueryReason(null, { identity: a, tick: 0 })).toBe('initial')
    expect(gitStatusQueryReason({ identity: a, tick: 0 }, { identity: b, tick: 0 })).toBe(
      'identity'
    )
    expect(gitStatusQueryReason({ identity: a, tick: 0 }, { identity: a, tick: 1 })).toBe(
      'turn-end'
    )
    expect(gitStatusQueryReason({ identity: a, tick: 1 }, { identity: a, tick: 1 })).toBeNull()
  })
})

describe('두 함수는 같은 입력에서 다른 값을 낸다', () => {
  it('마운트에서 이름은 조회하고 목록은 조회하지 않는다', () => {
    const identity = gitStatusTriggerKey('/repo')

    expect(gitStatusQueryReason(null, { identity, tick: 0 })).toBe('initial')
    expect(gitSummaryQueryReason(null, { tick: 0 })).toBeNull()
  })

  it('세션 전환에서 이름은 조회하고 목록은 조회하지 않는다', () => {
    const previous = { identity: gitStatusTriggerKey('/repo-a'), tick: 4 }
    const next = { identity: gitStatusTriggerKey('/repo-b'), tick: 4 }

    expect(gitStatusQueryReason(previous, next)).toBe('identity')
    // 목록 축은 좌표를 보지 않는다 — 키가 바뀌어도 턴이 끝나지 않으면 조회가 없다.
    expect(gitSummaryQueryReason({ tick: previous.tick }, { tick: next.tick })).toBeNull()
    expect(gitSnapshotTriggerKey('/repo-a', 's')).not.toBe(gitSnapshotTriggerKey('/repo-b', 's'))
  })

  it('턴 종료에서만 두 함수가 같은 값을 낸다', () => {
    const identity = gitStatusTriggerKey('/repo')

    expect(gitStatusQueryReason({ identity, tick: 0 }, { identity, tick: 1 })).toBe('turn-end')
    expect(gitSummaryQueryReason({ tick: 0 }, { tick: 1 })).toBe('turn-end')
  })
})

// ΔV6 AT-71 — **옛 계기가 남지 않는다**(§10 EP-46). 이 축을 재지 않으면 `busy` 전이를 그대로
// 둔 채 tick 계기를 덧붙인 구현이 통과하고, 그것이 사용자가 없애라고 한 자리다.
describe('옛 계기(`busy`)는 두 함수 어디에도 없다 (D-115)', () => {
  it('두 함수의 입력에 `busy` 축이 없다 — 같은 tick 이면 무엇을 얹어도 null 이다', () => {
    const identity = gitStatusTriggerKey('/repo')
    // `busy` 축이 살아 있었다면 true→false 가 'turn-end' 였을 자리다.
    const withBusy = { tick: 7, busy: true } as unknown as { tick: number }
    const withoutBusy = { tick: 7, busy: false } as unknown as { tick: number }

    expect(gitSummaryQueryReason(withBusy, withoutBusy)).toBeNull()
    expect(
      gitStatusQueryReason({ identity, tick: 7 }, { identity, tick: 7, busy: false } as unknown as {
        identity: string
        tick: number
      })
    ).toBeNull()
  })
})

// ΔV6 AT-71 배선 축 — 순수 함수가 옳아도 **effect 가 옛 값을 보고 있으면** 계기가 둘이다.
// 여기서는 소스 배선을 센다: hook 파일이 `sessionBusy` 를 읽지 않고, 두 effect 의 deps 가
// `tick` 을 갖는다. 이 스윕은 **배선의 존재**만 보고 실행 순서를 보지 않는다 — 그 한계를
// 알고 쓴다(실행 축은 위 두 describe 의 값 대조가 갖는다).
describe('계기의 배선 (AT-71 · §10 EP-46)', () => {
  const source = readFileSync(new URL('./useGitSnapshot.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

  it('`sessionBusy` 를 읽지 않는다 — 옛 계기가 파일에서 사라졌다', () => {
    expect(source).not.toContain('sessionBusy')
    expect(source).not.toContain('busy')
  })

  it('두 effect 의 deps 가 `tick` 을 갖는다 — 둘 다 새 계기를 본다', () => {
    expect(source.match(/\[tick, refreshTick, run(Query|StatusQuery), \w+\]/g)).toHaveLength(2)
  })
})

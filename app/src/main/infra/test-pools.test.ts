// 풀 배선 (0298) — 신호가 없는 이 파일은 unit 풀이다. 워커 스레드에서 돌고 exe 가드가 걸려 있다.
// 분류·가드의 순수 계산은 `scripts/test-pools.test.mjs` 가 갖는다. io 쪽 배선은 `test-environment.test.ts`.
import { homedir } from 'node:os'
import { isMainThread } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'
import {
  UNIT_GUARD,
  drainGuardViolations,
  type UnitGuardState
} from '../../../scripts/test-pools.mjs'

const guard = (): UnitGuardState | undefined =>
  (process as unknown as Record<symbol, UnitGuardState | undefined>)[UNIT_GUARD]

describe('unit 풀 배선 (0298)', () => {
  it('워커 스레드에서 돌고 가드가 설치돼 있다', () => {
    expect(isMainThread).toBe(false)
    expect(guard()?.violations).toEqual([])
  })

  it('os.homedir() 는 setup 이 이 파일에 준 홈이다 — 스레드 env 사본에 맞춘다', () => {
    const host = (globalThis as unknown as Record<symbol, { root: string } | undefined>)[
      Symbol.for('orcinus-orca.test.host')
    ]
    const key = process.platform === 'win32' ? 'USERPROFILE' : 'HOME'
    expect(homedir()).toBe(process.env[key])
    expect(homedir().startsWith(host!.root)).toBe(true)
  })

  it('자식 프로세스 생성은 throw 하고, 호출자가 삼켜도 위반으로 남는다', () => {
    // 정적 신호(import)를 쓰지 않고 얻는다 — 신호가 놓친 형태를 런타임 가드가 막는지 보는 것이다.
    const cp = process.getBuiltinModule('node:child_process')
    expect(() => cp.spawnSync(process.execPath, ['-e', '0'])).toThrow(/\[test-pools\] unit 풀/)
    try {
      cp.spawn(process.execPath, ['-e', '0'])
    } catch {
      // production `runGit` 처럼 오류를 결과로 바꾸는 호출자를 흉내 낸다.
    }
    const state = guard()!
    expect(state.violations).toHaveLength(2)
    // 이 테스트가 일부러 만든 위반이다 — afterEach 가 red 로 만들기 전에 비운다.
    expect(drainGuardViolations(state)?.message).toMatch(/\[test-pools\] .*\(외 1건\)$/)
    expect(state.violations).toEqual([])
  })

  // 위 테스트와 달리 비우지 않는다 — setup 의 afterEach 가 이 테스트를 red 로 만들어야 `fails` 가 green 이다.
  it.fails('위반을 남긴 테스트는 호출자가 오류를 삼켜도 afterEach 가 red 로 만든다', () => {
    try {
      process.getBuiltinModule('node:child_process').spawnSync(process.execPath, ['-e', '0'])
    } catch {
      // 삼킨다.
    }
  })
})

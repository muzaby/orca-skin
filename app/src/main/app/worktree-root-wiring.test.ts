// AC3 · AC4 · EP-09 두 번째 좌표 · EP-13 — **worktree 루트를 파생하는 모든 호출이 dev 분기를 준다.**
//
// `paths.test.ts` 는 `managedWorktreesDir(true|false)` 가 각각 무엇을 돌려주는지 잠근다. 그런데
// 그 순수 함수에 **무엇이 들어가는지**는 컴포지션 루트 한 줄이 정하고, `bootstrap.ts` 를 모듈로
// import 하는 테스트는 하나도 없다 — `managedWorktreesDir(false)` 로 바꿔도 전 스위트가 초록이고
// typecheck 도 통과한다(둘 다 `boolean` 이다). 그러면 dev 가 prod worktree 루트를 공유하는데
// (EP-13 `실패 의미`) 아무도 모른다. verify r2 이후 분석에서 열린 자리다.
//
// **술어는 불변식의 주어(`managedWorktreesDir` 호출)로 쓴다** — 해법 이름(`import.meta.env.DEV`)
// 으로 세면 이미 고친 지점만 분모에 오른다. 정의 자신은 호출이 아니라 제외한다.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sourceFiles, stripCommentsAndStrings, toPosix } from '../infra/source-scan'

const MAIN_ROOT = fileURLToPath(new URL('..', import.meta.url))

// `(?:function\s+)?` 로 정의를 함께 잡은 뒤 걸러낸다 — 정의 파일을 경로로 면제하면 두 번째
// 정의가 생겼을 때 스윕이 그것을 못 본다.
const CALL = /(?:export\s+)?(?:function\s+)?managedWorktreesDir\s*\(([^)]*)\)/g

function callSites(): Array<{ file: string; arg: string }> {
  return sourceFiles(MAIN_ROOT).flatMap((file) => {
    const stripped = stripCommentsAndStrings(readFileSync(file, 'utf8'))
    return [...stripped.matchAll(CALL)]
      .filter((m) => !/function\s+$/.test(m[0].slice(0, m[0].indexOf('managedWorktreesDir'))))
      .map((m) => ({
        file: toPosix(file.slice(MAIN_ROOT.length)),
        arg: (m[1] ?? '').trim()
      }))
  })
}

describe('worktree 루트 배선 (AC3 · AC4 · EP-09 · EP-13)', () => {
  it('호출부는 컴포지션 루트 하나다 — 두 갈래가 생기면 dev/prod 가 섞인다', () => {
    // 차집합으로 본다. 총계가 아니라 "부팅 배선 밖의 잔여"가 이 주장의 관측값이다.
    expect(callSites().map((c) => c.file)).toEqual(['app/bootstrap.ts'])
  })

  it('그 호출이 dev 분기를 주입한다 — 상수를 넘기면 dev 가 prod 루트를 공유한다', () => {
    const sites = callSites()
    expect(sites.length).toBeGreaterThan(0)
    for (const site of sites) expect(site.arg).toBe('import.meta.env.DEV')
  })
})

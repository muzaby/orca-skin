// 위생 가드 (0173) — main 프로세스는 **Node 전역 fetch 를 쓰지 않는다**.
//
// 규칙을 문서에만 적으면 다음 사람이 또 쓴다. 이 저장소는 같은 이유로 마이그레이션 append-only
// 를 스크립트로 강제한다(`scripts/check-migrations-appendonly.mjs`) — 같은 방식을 하나 더 둔다.
//
// 왜 막는가: Node(undici) 스택은 OS 프록시·OS 인증서 저장소를 보지 않아, 사내 프록시 뒤의
// 사설 CA 서버로는 나가지 못한다. 근거와 대안은 `net-fetch.ts` 헤더.
//
// 이 테스트는 **소스를 문자열로 읽기만 한다** — electron 을 import 하지 않으므로 vitest(plain
// Node)에서 돈다.

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAIN_ROOT = join(__dirname, '..', '..')

// 전송 구현을 소유하는 유일한 파일. 여기서만 electron `net` 을 문다.
const ALLOWED = new Set(['net-fetch.ts'])

// 전역 호출만 잡는다 — `ses.fetch(`·`ctx.fetch(`·`this.deps.fetchImpl(` 같은 **메서드/속성 호출**은
// 대상이 아니다. 그래서 바로 앞 글자가 `.` 이거나 식별자면 제외한다.
const GLOBAL_FETCH = /(^|[^.\w$])fetch\s*\(/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) return []
    return [full]
  })
}

// 주석·문자열 안의 `fetch(` 는 규칙 위반이 아니다(설명하려면 이름을 적어야 한다).
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '``')
}

describe('main 은 전역 fetch 를 쓰지 않는다 (0173)', () => {
  it('net-fetch.ts 외에 전역 fetch 호출이 없다', () => {
    const offenders = sourceFiles(MAIN_ROOT)
      .filter((file) => !ALLOWED.has(file.slice(file.lastIndexOf('/') + 1)))
      .filter((file) => GLOBAL_FETCH.test(stripCommentsAndStrings(readFileSync(file, 'utf8'))))
      .map((file) => file.slice(MAIN_ROOT.length + 1))

    // 실패 메시지가 곧 수정 지시가 되게 파일 목록을 싣는다.
    expect(
      offenders,
      `전역 fetch 대신 주입된 fetchImpl 을 쓰세요: ${offenders.join(', ')}`
    ).toEqual([])
  })

  // 가드 자신이 맞게 도는지 — 오탐/미탐 양쪽을 고정한다. 이게 없으면 정규식이 아무것도 못 잡는
  // 상태로 "통과" 할 수 있다(측정력 0인 위생 테스트가 가장 나쁘다).
  it('메서드 호출은 잡지 않고 전역 호출만 잡는다', () => {
    expect(GLOBAL_FETCH.test('const res = await fetch(url)')).toBe(true)
    expect(GLOBAL_FETCH.test('return fetch(url, init)')).toBe(true)
    expect(GLOBAL_FETCH.test('await ses.fetch(url)')).toBe(false)
    expect(GLOBAL_FETCH.test('await ctx.fetch(url)')).toBe(false)
    expect(GLOBAL_FETCH.test('await this.deps.fetchImpl(url)')).toBe(false)
    expect(GLOBAL_FETCH.test('await fetchImpl(url)')).toBe(false)
  })

  it('주석·문자열 안의 fetch 는 위반이 아니다', () => {
    expect(GLOBAL_FETCH.test(stripCommentsAndStrings('// 전역 fetch(url) 을 쓰지 마라'))).toBe(
      false
    )
    expect(GLOBAL_FETCH.test(stripCommentsAndStrings("const msg = 'fetch(url) 금지'"))).toBe(false)
    expect(GLOBAL_FETCH.test(stripCommentsAndStrings('const res = await fetch(url)'))).toBe(true)
  })
})

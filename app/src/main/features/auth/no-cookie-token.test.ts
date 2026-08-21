// 위생 가드 (0195 D-006) — **토큰은 교환 응답 JSON 에서만 나온다.**
//
// 0181 은 세션 쿠키로 사내 API 를 GET 해 토큰을 받았고, 0195 가 그 경로를 지웠다(코드를 주지
// 않는 SP 는 `exchange` 자체를 선언하지 않는다). 규칙을 주석에만 적으면 다음 사람이 "쿠키에서
// 꺼내면 간단한데" 로 되돌린다 — `no-node-fetch.test.ts` 와 같은 방식으로 기계 강제한다.
//
// **술어는 해법 이름이 아니라 불변식의 주어다**: "쿠키를 읽는 호출이 있는가" 를 찾는다.
// "내가 만든 함수가 안 불린다" 를 찾으면 그 함수를 안 쓰는 새 코드가 그대로 통과한다.
//
// 쿠키 자체는 계속 쓰인다 — `sessions.send` 가 파티션·쿠키를 실어 보낸다(D-007). 금지되는 것은
// **jar 를 읽어 값을 꺼내는 것**이고, 그 표면은 `features/auth/**` 밖(`infra/browser-session.ts`
// 의 `clear`)에만 있다.
//
// 소스를 문자열로 읽기만 하므로 electron 을 물지 않는다.

import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'

const AUTH_ROOT = join(__dirname)

// Electron `Session.cookies` 표면 — `ses.cookies.get(...)` · `entry.ses.cookies.remove(...)`.
const COOKIE_READ = /\.cookies\b/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) return []
    return [full]
  })
}

// 주석·문자열 안의 `.cookies` 는 규칙 위반이 아니다(금지하려면 이름을 적어야 한다).
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '``')
}

// 보고 표기는 플랫폼 구분자를 타지 않는다 — CI 게이트는 windows 러너에서 돌고(`.github/
// workflows/ci.yml`), `join` 이 만든 `\` 를 그대로 내보내면 같은 위반이 OS 마다 다른 이름으로
// 보인다. 위반 목록은 사람이 읽고 비교하는 값이라 `/` 하나로 고정한다.
function toPosix(relative: string): string {
  return relative.split(sep).join('/')
}

function offendersIn(root: string): string[] {
  return sourceFiles(root)
    .filter((file) => COOKIE_READ.test(stripCommentsAndStrings(readFileSync(file, 'utf8'))))
    .map((file) => toPosix(file.slice(root.length + 1)))
}

describe('토큰은 쿠키에서 나오지 않는다 (0195 D-006)', () => {
  it('features/auth 안에 cookie jar 를 읽는 호출이 없다', () => {
    const offenders = offendersIn(AUTH_ROOT)

    expect(
      offenders,
      `토큰은 교환 응답 JSON 에서만 꺼냅니다 (D-006): ${offenders.join(', ')}`
    ).toEqual([])
  })

  // ── 가드 자신이 눈을 갖고 있는가 ──────────────────────────────────────────
  //
  // 세 판정 지점이 **각각 독립적으로** 눈이 멀 수 있다: 대상 집합(어느 파일을 훑는가) ·
  // 추출(어떤 토큰을 뽑는가) · 주석/문자열 제거(무엇을 실재로 세는가). 지점마다 하나씩 심는다.

  it('대상 집합 — 중첩 디렉토리의 위반을 잡고 테스트 파일은 세지 않는다', () => {
    const root = mkdtempSync(join(tmpdir(), 'orca-cookie-guard-'))
    mkdirSync(join(root, 'browser-session'), { recursive: true })
    writeFileSync(join(root, 'clean.ts'), 'export const a = 1\n')
    // 심은 결함 ①: 하위 디렉토리 — 훑기가 최상위에서 멈추면 이 줄이 보이지 않는다.
    writeFileSync(
      join(root, 'browser-session', 'runner.ts'),
      'const c = await entry.ses.cookies.get({ url })\n'
    )
    // 심은 결함 ②: 테스트 파일 — 프로덕션 규칙이라 대상이 아니다(세면 오탐이다).
    writeFileSync(join(root, 'runner.test.ts'), 'const c = await ses.cookies.get({ url })\n')

    expect(offendersIn(root)).toEqual(['browser-session/runner.ts'])
  })

  it('추출 — 쿠키 읽기 호출만 잡고 비슷한 이름은 잡지 않는다', () => {
    expect(COOKIE_READ.test('const c = await ses.cookies.get({ url })')).toBe(true)
    expect(COOKIE_READ.test('await entry.ses.cookies.remove(origin, name)')).toBe(true)
    // `cookie` presentation(`present.ts`)과 헤더 이름은 jar 읽기가 아니다.
    expect(COOKIE_READ.test("if (presentation.location === 'cookie') return req")).toBe(false)
    expect(COOKIE_READ.test('const cookieJar = sessions.acquire(group)')).toBe(false)
  })

  it('실재 판정 — 주석·문자열 안의 이름은 위반이 아니다', () => {
    expect(COOKIE_READ.test(stripCommentsAndStrings('// ses.cookies.get 을 쓰지 마라'))).toBe(false)
    expect(COOKIE_READ.test(stripCommentsAndStrings("const msg = '.cookies 금지'"))).toBe(false)
    expect(COOKIE_READ.test(stripCommentsAndStrings('const c = ses.cookies.get(url)'))).toBe(true)
  })
})

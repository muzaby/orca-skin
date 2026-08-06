// 위생 가드 (0178 정정) — **인증 소비 표면은 한 벌이다.**
//
// 0178 의 최초 구현은 "내부 api" 를 *사내(회사) API 클라이언트* 로 잘못 읽었다. 그래서 "회사
// 서버를 부르는 길" 만 신경 쓰고, **다른 모듈이 인증을 어떻게 받아 쓰는가**는 각자 두었다.
// 그 결과 MCP resolver 가 `InternalApi.token` 과 똑같은 모양을 손으로 다시 선언하고 있었다 —
// 계약은 `contracts/` 에 있는데 소비자는 그것을 모르는, 이름만 공유하는 두 벌이었다.
//
// 진짜 요구는 "**모듈간 api 로 쓸 수 있게, 인프라 기능처럼 지원하라**" 였다(사용자 정정
// 2026-08-06). 인프라 기능의 성질은 위치가 아니라 **형상이 하나**라는 것이다 — 소비자마다
// 자기 포트를 다시 선언하면 그 순간 인프라가 아니라 그냥 남의 클래스가 된다.
//
// 그래서 규칙: **인증 표면을 선언·구현하는 파일은 `InternalApi` 를 참조해야 한다.** 좁혀 쓰는
// 것은 `Pick<InternalApi, …>` 로 한다.
//
// 이 테스트는 **소스를 문자열로 읽기만 한다** — electron 을 import 하지 않으므로 vitest 에서 돈다.

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAIN_ROOT = join(__dirname, '..')

// `token(target: string): string | null` — 인증 표면의 지문. 선언이든 구현이든 이 모양이면
// 인증을 다루는 코드다.
const AUTH_TOKEN_MEMBER = /\btoken\s*\(\s*\w+\s*:\s*string\s*\)\s*:\s*string\s*\|\s*null/

// **주석·문자열은 먼저 지운다.** 이걸 빼먹으면 헤더에 적힌 `InternalApi` 한 마디가 검사를
// 통과시켜, 손으로 다시 선언한 포트를 가드가 그냥 놓친다(이 가드를 처음 쓸 때 실제로 그랬다).
function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '``')
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) return []
    return [full]
  })
}

describe('인증 소비 표면은 한 벌이다 (0178 정정)', () => {
  it('인증 표면을 다루는 파일은 모두 InternalApi 를 참조한다', () => {
    const offenders = sourceFiles(MAIN_ROOT)
      .map((file) => ({ file, code: stripCommentsAndStrings(readFileSync(file, 'utf8')) }))
      .filter(({ code }) => AUTH_TOKEN_MEMBER.test(code))
      // 참조는 **코드에** 있어야 한다 — 주석의 언급은 계약을 쓰고 있다는 증거가 아니다.
      .filter(({ code }) => !code.includes('InternalApi'))
      .map(({ file }) => file.slice(MAIN_ROOT.length + 1))

    // 실패 메시지가 곧 수정 지시가 되게 파일 목록을 싣는다.
    expect(
      offenders,
      `인증 포트를 손으로 다시 선언하지 말고 contracts/internal-api.ts 에서 가져오세요` +
        ` (좁히려면 Pick<InternalApi, …>): ${offenders.join(', ')}`
    ).toEqual([])
  })

  // 가드 자신이 맞게 도는지 — 이게 없으면 정규식이 아무것도 못 잡는 상태로 "통과" 할 수 있다.
  it('가드가 인증 표면 선언을 실제로 알아본다', () => {
    expect(AUTH_TOKEN_MEMBER.test('  token(target: string): string | null')).toBe(true)
    expect(AUTH_TOKEN_MEMBER.test('  token(target: string): string | null {')).toBe(true)
    expect(AUTH_TOKEN_MEMBER.test('  label(name: string): string')).toBe(false)
  })

  // 이 가드가 처음 통과한 이유가 정확히 이것이었다 — 주석의 `InternalApi` 가 검사를 속였다.
  it('주석·문자열의 InternalApi 언급은 계약을 쓴 것으로 치지 않는다', () => {
    const commentOnly = stripCommentsAndStrings(
      '// InternalApi.token 이 값을 준다\ninterface X { token(t: string): string | null }'
    )
    expect(AUTH_TOKEN_MEMBER.test(commentOnly)).toBe(true)
    expect(commentOnly.includes('InternalApi')).toBe(false)

    const realUse = stripCommentsAndStrings(
      "import type { InternalApi } from './internal-api'\ntype X = Pick<InternalApi, 'token'>"
    )
    expect(realUse.includes('InternalApi')).toBe(true)
  })

  // 실제로 지문을 가진 파일이 하나 이상 있어야 위 단언이 의미를 갖는다(0건이면 공허하게 통과).
  it('지문을 가진 파일이 실재한다 — 공허한 통과가 아니다', () => {
    const matched = sourceFiles(MAIN_ROOT).filter((file) =>
      AUTH_TOKEN_MEMBER.test(stripCommentsAndStrings(readFileSync(file, 'utf8')))
    )
    expect(matched.length).toBeGreaterThanOrEqual(3)
  })
})

// **소비자 쪽 파생 단언은 여기 없다.** 계약이 소비자를 import 하면 `contracts → features` 가 되어
// 레이어 규칙 위반이다(실제로 `boundaries/dependencies` 가 잡았다). 각 소비자가 자기 테스트에서
// 자기 포트가 `Pick<InternalApi, …>` 임을 고정한다 —
// `features/extensions/mcp/resolver.test.ts` · `features/connectors/runtime.test.ts`.

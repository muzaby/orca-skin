// 위생 가드용 소스 스윕 (0197 A-5). **테스트 전용 헬퍼다** — 런타임 경로에서 부르지 않는다.
//
// 두 가드가 같은 스윕을 쓴다: `infra/net/no-node-fetch.test.ts`(전역 `fetch` 금지, 0173)와
// `features/auth/no-cookie-token.test.ts`(cookie jar 읽기 금지, 0195 D-006). 0197 이전에는
// `sourceFiles`·`stripCommentsAndStrings` 가 **바이트 동일하게 두 벌** 있었고, 커밋 `88f27f0`
// 이 같은 경로-구분자 버그를 두 사본에서 함께 고쳐야 했다.
//
// `node:fs` 만 물고 electron 을 물지 않는다 — 두 가드 다 vitest(plain Node)에서 돈다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

// 프로덕션 `.ts` 만 — 테스트 파일은 프로덕션 규칙의 대상이 아니다(세면 오탐이다).
// 하위 디렉토리까지 내려간다: 최상위에서 멈추면 `browser-session/runner.ts` 같은 위반이 안 보인다.
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) return []
    return [full]
  })
}

// 주석·문자열 안의 이름은 규칙 위반이 아니다 — 금지하려면 그 이름을 적어야 하기 때문이다.
export function stripCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '``')
}

// 보고 표기는 플랫폼 구분자를 타지 않는다 — CI 게이트는 windows 러너에서 돈다(`.github/
// workflows/ci.yml`). `join` 이 만든 `\` 를 그대로 내보내면 같은 위반이 OS 마다 다른 이름으로
// 보이고, 이름으로 면제를 조회하는 가드는 그 면제가 조용히 풀린다.
export function toPosix(relative: string): string {
  return relative.split(sep).join('/')
}

// `root` 기준 상대 posix 경로로 위반 파일을 모은다. `exempt` 는 **파일 이름**(basename) 집합이다.
export function scanOffenders(
  root: string,
  offends: (strippedSource: string) => boolean,
  exempt: ReadonlySet<string> = new Set()
): string[] {
  return sourceFiles(root)
    .filter((file) => !exempt.has(file.slice(file.lastIndexOf(sep) + 1)))
    .filter((file) => offends(stripCommentsAndStrings(readFileSync(file, 'utf8'))))
    .map((file) => toPosix(file.slice(root.length + 1)))
}

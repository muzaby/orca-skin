// ${VAR} 환경변수 확장. 정규 소스(미확장)의 env/headers 문자열 값에서 모든 ${VAR} 를 치환한다.
// resolver 주입식이라 electron 없이 단위 테스트 가능. 기본 resolver 순서: safeStorage(비밀) →
// process.env (2단계. 앱 설정/.env 같은 3단계는 없음 — 설계 결정).
//
// 미해결 변수가 하나라도 있으면 해당 **서버 전체를 드롭** + 사유 기록한다. 조용한 빈 문자열
// 치환은 금지(비밀 누락을 숨기면 디버깅 불가 + 인증 없는 요청이 새어나감).

import type { OrcaMcpConfig, ClaudeMcp } from '../mcp/schema'

export type Resolver = (name: string) => string | undefined

export interface ExpandResult {
  servers: OrcaMcpConfig
  dropped: { name: string; reason: string }[]
}

// ${VAR} 플레이스홀더 패턴 (global — replace 용). 단일 스캔이 필요한 곳(store.ts)은
// .source 로 비-global 사본을 만들어 무상태 .exec 에 쓴다.
export const VAR_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

// 한 문자열 안의 모든 ${VAR} 치환. 미해결 변수는 missing 에 모은다.
export function expandVars(
  value: string,
  resolve: Resolver,
  missing: Set<string> = new Set()
): string {
  return value.replace(VAR_RE, (_m, name: string) => {
    const v = resolve(name)
    if (v === undefined) {
      missing.add(name)
      return ''
    }
    return v
  })
}

function expandRecord(
  rec: Record<string, string> | undefined,
  resolve: Resolver,
  missing: Set<string>
): Record<string, string> | undefined {
  if (!rec) return rec
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(rec)) out[k] = expandVars(v, resolve, missing)
  return out
}

function expandOne(server: ClaudeMcp, resolve: Resolver): { server: ClaudeMcp; missing: string[] } {
  const missing = new Set<string>()
  let next: ClaudeMcp
  if ('url' in server) {
    next = { ...server, headers: expandRecord(server.headers, resolve, missing) }
  } else {
    next = { ...server, env: expandRecord(server.env, resolve, missing) }
  }
  return { server: next, missing: [...missing] }
}

export function expandEnv(servers: OrcaMcpConfig, resolve: Resolver): ExpandResult {
  const out: OrcaMcpConfig = {}
  const dropped: { name: string; reason: string }[] = []
  for (const [name, server] of Object.entries(servers)) {
    const { server: expanded, missing } = expandOne(server, resolve)
    if (missing.length > 0) {
      dropped.push({ name, reason: `미해결 환경변수: ${missing.join(', ')}` })
      continue
    }
    out[name] = expanded
  }
  return { servers: out, dropped }
}

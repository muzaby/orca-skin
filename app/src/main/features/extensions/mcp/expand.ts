// MCP 서버 설정의 ${VAR} 확장 — 미해결 변수가 하나라도 있으면 해당 **서버 전체를 드롭** + 사유
// 기록한다(조용한 빈 문자열 치환 금지 — 비밀 누락을 숨기면 인증 없는 요청이 새어나간다). 순수 문자열
// 치환은 infra/vars(expandVars)에 위임하고, 여기선 OrcaMcpConfig 구조 순회만 담당한다(mcp feature 소관).

import type { OrcaMcpConfig, ClaudeMcp } from '../../../adapters/mcp-config'
import { expandVars, type Resolver } from '../../../infra/vars'

export interface ExpandResult {
  servers: OrcaMcpConfig
  dropped: { name: string; reason: string }[]
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

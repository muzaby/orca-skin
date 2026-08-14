// env 유틸 (handoff 0017 D2 분해 — 구 provider-settings.ts(현 harnesses/settings.ts) 의 "env 유틸" 책임, 그 전엔
// adapters/claude-env.ts). 어댑터-중립 — ${VAR} 확장 + subprocess env 레이어 병합.

import type { Resolver } from '../../infra/vars'
import { expandVars } from '../../infra/vars'

// env 레코드의 각 값에서 ${VAR} 확장. 미해결 변수가 있는 키는 **드롭** + missing 으로 보고
// (조용한 빈 문자열 치환 금지 — mcp/expand.ts 와 동일 정책).
export function expandEnvRecord(
  env: Record<string, string>,
  resolve: Resolver
): { env: Record<string, string>; missing: string[] } {
  const out: Record<string, string> = {}
  const missing = new Set<string>()
  for (const [key, value] of Object.entries(env)) {
    const before = new Set(missing)
    const expanded = expandVars(value, resolve, missing)
    const unresolved = [...missing].some((name) => !before.has(name))
    if (!unresolved) out[key] = expanded
  }
  return { env: out, missing: [...missing] }
}

function processEnvRecord(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

// SDK Options.env 는 subprocess env 전체를 대체하므로, overlay 가 있으면 완전한 베이스
// (base 또는 process.env 스냅샷) 위에 병합한다. overlay 없으면 base 그대로 (undefined 포함).
export function mergeEnvLayers(
  base: Record<string, string> | undefined,
  overlay: Record<string, string>
): Record<string, string> | undefined {
  if (Object.keys(overlay).length === 0) return base
  return { ...(base ?? processEnvRecord()), ...overlay }
}

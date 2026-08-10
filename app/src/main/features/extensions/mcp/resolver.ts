// MCP `${VAR}` · `${BINDING:id}` resolver 팩토리 (0157 — 구 2단계 resolver 대체).
//
// ── 무엇이 바뀌었나 ──────────────────────────────────────────────────────────
// 구 구현은 `secrets.get(name) ?? process.env[name]` 였다. `process.env` **전체**가 fallback
// 이라, 앱 프로세스 환경에 있는 임의의 값이 이름만 맞으면 MCP 설정으로 새어 들어갔다
// (도입 보고서 위험 #3). 이제 해석 순서는:
//
//   1. `${BINDING:<대상>}` → **`ProviderApi.token(providerId)`** (0181 이 복구). 소스가
//      미주입이거나 그 대상이 미인증이면 undefined 로 남는다.
//   2. `${VAR}`          → vault(safeStorage) 에 봉인된 비밀
//   3. `${VAR}`          → **명시 allowlist 에 있는 경우에만** process.env
//
// 미해결이면 undefined 를 돌려주고, expand.ts 가 해당 **서버 전체를 드롭**한다(fail-closed 유지).
//
// ── 남는 노출 (문서화된 예외) ────────────────────────────────────────────────
// 해석된 값은 여전히 `dist/plugins/orca/.mcp.json` 에 평문으로 렌더된다 — claude CLI 가 그
// 파일을 읽어 MCP 서버를 spawn 하므로 Orca 가 요청 주체가 아니기 때문이다. 이번 변경의 이득은
// 값이 디스크에서 사라지는 것이 아니라 **소유권 일원화**다: 회전·만료·logout 이 binding 하나로
// 일관되고, 출처가 broker 로 단일화돼 후속 proxy 단계를 코어 수정 없이 얹을 수 있다.
// (요구명세 §소비자 경계 / §MCP 통합)

import { BINDING_PREFIX, type Resolver } from '../../../infra/vars'
import type { SecretStore } from '../../../infra/config/secret-store'

interface ResolverOptions {
  secrets: SecretStore
  // orca.json 의 `secrets.envAllowlist`. **정확한 이름 일치만** 허용한다(패턴·접두사 없음).
  envAllowlist?: readonly string[]
  // `${BINDING:<대상>}` 의 토큰 소스 (0181). **미주입이면 모든 대상 참조가 미해결**이다 —
  // 조용히 빈 값으로 채우지 않는다(expand.ts 가 그 서버를 통째로 드롭한다).
  tokens?: (providerId: string) => string | null
}

export function makeResolver(opts: ResolverOptions): Resolver {
  const allowlist = new Set(opts.envAllowlist ?? [])
  return (name: string) => {
    if (name.startsWith(BINDING_PREFIX)) {
      // 대상 참조는 provider id 다. 미인증이면 null → undefined 로 접혀 미해결로 남고
      // expand.ts 가 그 서버를 드롭한다(fail-closed 유지).
      return opts.tokens?.(name.slice(BINDING_PREFIX.length)) ?? undefined
    }
    const sealed = opts.secrets.get(name)
    if (sealed !== undefined) return sealed
    // allowlist 밖의 이름은 process.env 에 있어도 보이지 않는다.
    return allowlist.has(name) ? process.env[name] : undefined
  }
}

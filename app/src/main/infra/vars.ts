// ${VAR} 환경변수 확장의 **중립 프리미티브**(infra). resolver 주입식이라 electron 없이 단위 테스트
// 가능. 기본 resolver 순서: safeStorage(비밀) → process.env (2단계). MCP 서버 구조를 순회하는
// expandEnv(OrcaMcpConfig 의존)는 mcp feature(`features/extensions/mcp/expand.ts`)로 분리했다 —
// infra 는 도메인 타입(OrcaMcpConfig)을 몰라야 한다.

export type Resolver = (name: string) => string | undefined

// ${VAR} 플레이스홀더 패턴 (global — replace 용). 단일 스캔이 필요한 곳(mcp store)은
// .source 로 비-global 사본을 만들어 무상태 .exec 에 쓴다.
export const VAR_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g

// ${BINDING:<bindingId>} — 인증 플랫폼 binding 참조 (0157). VAR_RE 와 **의도적으로 분리**한다:
// binding 참조는 env-var 이름이 아니므로, 이름 스캔(mcp store 의 authEnvKey 추출)이 이것을
// 환경변수로 오인하면 안 된다.
export const BINDING_RE = /\$\{BINDING:([A-Za-z0-9_-]+)\}/g

// resolver 에 binding 참조를 넘길 때 쓰는 접두사. resolver 는 이 접두사로 분기한다.
export const BINDING_PREFIX = 'BINDING:'

// 한 문자열 안의 모든 ${VAR} · ${BINDING:id} 치환. 미해결 참조는 missing 에 모은다.
// 미해결을 빈 문자열로 조용히 치환하지 않는 것이 핵심 — 호출부(mcp expand)가 missing 을 보고
// 해당 서버 전체를 드롭한다. 비밀 누락을 숨기면 인증 없는 요청이 새어나간다.
export function expandVars(
  value: string,
  resolve: Resolver,
  missing: Set<string> = new Set()
): string {
  const withBindings = value.replace(BINDING_RE, (_m, bindingId: string) => {
    const token = `${BINDING_PREFIX}${bindingId}`
    const v = resolve(token)
    if (v === undefined) {
      missing.add(token)
      return ''
    }
    return v
  })
  return withBindings.replace(VAR_RE, (_m, name: string) => {
    const v = resolve(name)
    if (v === undefined) {
      missing.add(name)
      return ''
    }
    return v
  })
}

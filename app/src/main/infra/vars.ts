// ${VAR} 환경변수 확장의 **중립 프리미티브**(infra). resolver 주입식이라 electron 없이 단위 테스트
// 가능. 기본 resolver 순서: safeStorage(비밀) → process.env (2단계). MCP 서버 구조를 순회하는
// expandEnv(OrcaMcpConfig 의존)는 mcp feature(`features/extensions/mcp/expand.ts`)로 분리했다 —
// infra 는 도메인 타입(OrcaMcpConfig)을 몰라야 한다.

export type Resolver = (name: string) => string | undefined

// ${VAR} 플레이스홀더 패턴 (global — replace 용). 단일 스캔이 필요한 곳(mcp store)은
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

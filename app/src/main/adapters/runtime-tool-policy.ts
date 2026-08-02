import type { RuntimeToolSnapshot } from './runtime-tools'

// Claude SDK가 부르는 MCP 도구의 완전 이름. readOnlyHint가 명시적으로 true일 때만
// 자동 통과시키고, 누락·false는 모두 승인 대상으로 fail-closed 처리한다.
export function runtimeApprovalToolNames(snapshot?: RuntimeToolSnapshot): ReadonlySet<string> {
  const names = new Set<string>()
  if (!snapshot) return names

  for (const [serverId, server] of snapshot.servers) {
    for (const tool of server.descriptor.tools) {
      if (tool.annotations?.readOnlyHint !== true) {
        names.add(`mcp__${serverId}__${tool.name}`)
      }
    }
  }
  return names
}

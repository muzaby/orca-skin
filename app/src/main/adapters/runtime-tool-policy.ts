import type { RuntimeToolSnapshot } from './runtime-tools'

// 모델이 보는 MCP 도구의 **완전 이름**. SDK 서버 키(`descriptor.id`)와 도구 이름을 잇는 규칙은
// 하나여야 한다 — 손으로 두 벌 적으면 GUI 가 나열한 이름과 승인 규칙이 조용히 어긋나고,
// 증상(자동 승인이라고 적힌 도구에 승인 창이 뜬다)이 원인에서 멀다.
export function runtimeToolFullName(serverId: string, toolName: string): string {
  return `mcp__${serverId}__${toolName}`
}

// 인증 대상 하나가 기여하는 런타임 도구 서버의 이름. **조립 지점은 여기 하나뿐이다** (0188) —
// 규칙(`<authId>-tools`)이 Plugin 쪽에 있으면 Plugin 이 늘 때마다 각자 조립해 서로 다른 문자열을
// 고를 수 있다. `runtimeToolFullName` 과 같은 이유로 같은 파일에 둔다.
export function authToolServerId(authId: string): string {
  return `${authId}-tools`
}

// Claude SDK가 부르는 MCP 도구의 완전 이름. readOnlyHint가 명시적으로 true일 때만
// 자동 통과시키고, 누락·false는 모두 승인 대상으로 fail-closed 처리한다.
export function runtimeApprovalToolNames(snapshot?: RuntimeToolSnapshot): ReadonlySet<string> {
  const names = new Set<string>()
  if (!snapshot) return names

  for (const [serverId, server] of snapshot.servers) {
    for (const tool of server.descriptor.tools) {
      if (tool.annotations?.readOnlyHint !== true) {
        names.add(runtimeToolFullName(serverId, tool.name))
      }
    }
  }
  return names
}

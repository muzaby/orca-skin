import type { AgentKind } from './agent-kind'

export interface AgentSessionPolicy {
  readonly allowDirectoryUpdates: boolean
  readonly directoryIdentity: 'windows' | 'exact'
  readonly allowContextFileOpen: boolean
}

// 기존 세션 능력의 순수 정의. busy·소유권·경로 검증은 Main 경계가 강제한다.
export const agentSessionPolicy = {
  work: {
    allowDirectoryUpdates: true,
    directoryIdentity: 'windows',
    allowContextFileOpen: true
  },
  code: {
    allowDirectoryUpdates: false,
    directoryIdentity: 'exact',
    allowContextFileOpen: false
  }
} as const satisfies Record<AgentKind, AgentSessionPolicy>

// OpenCode Code의 소스 패널은 Work와 동일한 컨텍스트 기능을 사용한다.
export function sessionContextPolicy(kind: AgentKind, backend: string | null): AgentSessionPolicy {
  return backend === 'opencode' && kind === 'code'
    ? agentSessionPolicy.work
    : agentSessionPolicy[kind]
}

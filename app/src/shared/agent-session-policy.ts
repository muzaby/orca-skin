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

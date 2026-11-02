import type { AgentKind } from './agent-kind'
import type { AgentEnvironment, Backend } from './ipc'

export const HARNESS_IDS = ['claude', 'opencode'] as const

export const HARNESS_CAPABILITIES = {
  claude: {
    label: 'Claude Code',
    shortLabel: 'Claude',
    agentKinds: ['code', 'work'],
    nativeAgents: false,
    continuity: true,
    subagentTile: 'subagent',
    permissionModes: true
  },
  opencode: {
    label: 'OpenCode',
    shortLabel: 'OpenCode',
    agentKinds: ['code'],
    nativeAgents: true,
    continuity: false,
    subagentTile: 'task',
    permissionModes: false
  }
} as const satisfies Record<
  Backend,
  {
    label: string
    shortLabel: string
    continuity: boolean
    subagentTile: 'subagent' | 'task'
    permissionModes: boolean
    agentKinds: readonly AgentKind[]
    nativeAgents: boolean
  }
>

// OpenCode 기본 primary 에이전트(0291 D-016). 실제 목록이 오기 전 Composer placeholder와
// main 정적 카탈로그가 같은 이름을 쓴다.
export const OPENCODE_DEFAULT_AGENTS = ['build', 'plan'] as const

export function isBackend(value: unknown): value is Backend {
  return typeof value === 'string' && HARNESS_IDS.some((id) => id === value)
}

export function supportsAgentKind(backend: Backend, kind: AgentKind): boolean {
  return (HARNESS_CAPABILITIES[backend].agentKinds as readonly AgentKind[]).includes(kind)
}

export interface HarnessPreferences {
  instructions: string
  /** Empty uses an installed executable from PATH. */
  executablePath?: string
}

export const CLAUDE_OUTPUT_STYLES = ['Concise', 'Explanatory', 'Learning', 'Proactive'] as const
export type ClaudeOutputStyle = (typeof CLAUDE_OUTPUT_STYLES)[number]
export const DEFAULT_CLAUDE_OUTPUT_STYLE: ClaudeOutputStyle = 'Concise'

export interface ClaudePreferences extends HarnessPreferences {
  outputStyle?: ClaudeOutputStyle
}

export interface OpenCodePreferences extends HarnessPreferences {
  autoApprovePermissions?: boolean
}

export interface HarnessSettings {
  claude?: ClaudePreferences
  opencode?: OpenCodePreferences
}

export const DEFAULT_OPENCODE_AUTO_APPROVE_PERMISSIONS = true

// 엔진&모델 카드 순서(0291 D-018) — `HARNESS_IDS` 순(Claude → OpenCode), 모르는 adapter 는 뒤.
// 같은 하네스 안에서는 입력 순서를 지킨다(안정 정렬).
export function orderAgentEnvironments<T extends Pick<AgentEnvironment, 'adapter'>>(
  agents: readonly T[]
): T[] {
  const rank = (adapter: string): number => {
    const index = HARNESS_IDS.findIndex((id) => id === adapter)
    return index < 0 ? HARNESS_IDS.length : index
  }
  return agents
    .map((agent, index) => ({ agent, index, rank: rank(agent.adapter) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.agent)
}

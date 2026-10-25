import type { AgentKind } from './agent-kind'
import type { Backend } from './ipc'

export const HARNESS_IDS = ['claude', 'opencode'] as const

export const HARNESS_CAPABILITIES = {
  claude: { label: 'Claude Code', agentKinds: ['code', 'work'], nativeAgents: false },
  opencode: { label: 'OpenCode', agentKinds: ['code'], nativeAgents: true }
} as const satisfies Record<
  Backend,
  {
    label: string
    agentKinds: readonly AgentKind[]
    nativeAgents: boolean
  }
>

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

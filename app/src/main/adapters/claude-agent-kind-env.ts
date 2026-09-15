import type { AgentKind } from '../../shared/agent-kind'
import type { AdapterSpawnEnvPatch } from './harness-config'

const CLAUDE_WORK_ENV = Object.freeze({
  CLAUDE_CODE_ENABLE_TODO_TOOLS: '1',
  CLAUDE_CODE_ENABLE_TASKS: '1',
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1'
}) satisfies AdapterSpawnEnvPatch

const CLAUDE_CODE_ENV = Object.freeze({
  CLAUDE_CODE_ENABLE_TODO_TOOLS: null,
  CLAUDE_CODE_ENABLE_TASKS: null,
  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: null
}) satisfies AdapterSpawnEnvPatch

/** Claude Code subprocess policy selected from the session's immutable agent kind. */
export function claudeAgentKindEnv(agentKind: AgentKind): AdapterSpawnEnvPatch {
  return agentKind === 'work' ? CLAUDE_WORK_ENV : CLAUDE_CODE_ENV
}

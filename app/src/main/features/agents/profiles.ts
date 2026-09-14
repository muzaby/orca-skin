import { DEFAULT_AGENT_KIND, isAgentKind, type AgentKind } from '../../../shared/agent-kind'
import { WORK_SYSTEM_PROMPT } from './work-system-prompt'

interface AgentProfile {
  readonly kind: AgentKind
  readonly persistResponseBoundaries: boolean
  readonly instructions?: string
  readonly key?: string
}

const PROFILES: Readonly<Record<AgentKind, AgentProfile>> = {
  code: Object.freeze({ kind: 'code', persistResponseBoundaries: false }),
  work: Object.freeze({
    kind: 'work',
    persistResponseBoundaries: true,
    key: 'work:4',
    instructions: WORK_SYSTEM_PROMPT
  })
}

export function resolveAgentProfile(kind: AgentKind): AgentProfile {
  return PROFILES[kind]
}

// The caller supplies the authoritative DB/lease birth value. Only a new birth defaults.
export function resolveAgentKind(
  requested: unknown,
  inherited: unknown
): { ok: true; kind: AgentKind } | { ok: false; reason: 'invalid' | 'mismatch' } {
  if (requested !== undefined && !isAgentKind(requested)) return { ok: false, reason: 'invalid' }
  if (inherited !== undefined && !isAgentKind(inherited)) return { ok: false, reason: 'invalid' }
  if (requested !== undefined && inherited !== undefined && requested !== inherited)
    return { ok: false, reason: 'mismatch' }
  return { ok: true, kind: inherited ?? requested ?? DEFAULT_AGENT_KIND }
}

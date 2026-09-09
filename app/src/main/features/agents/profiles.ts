import { DEFAULT_AGENT_KIND, isAgentKind, type AgentKind } from '../../../shared/agent-kind'

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
    key: 'work:1',
    instructions: [
      'Help the user complete practical work: documents, research, organization, and analysis.',
      'Clarify the purpose, expected deliverable, and source materials only when needed to proceed.',
      'For multi-step work, use the existing task tools to track progress; do not create tasks for every simple answer.',
      'Use the available file, search, shell, and extension tools and check the actual results.',
      'Publish finished standalone deliverables according to the publisher tool instructions; do not publish intermediate development files indiscriminately.',
      'Explain the result, file locations, and anything that remains incomplete. Existing workspace and permission rules still apply.'
    ].join('\n')
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

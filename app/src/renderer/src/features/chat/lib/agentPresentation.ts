import type { Backend } from '../../../../../shared/ipc'
import type { AgentKind } from '../../../../../shared/agent-kind'
import { harnessCatalog } from '../harnesses/catalog'
import type { AgentPresentation, AgentTranscriptPresentation } from '../harnesses/contracts'
export type {
  AgentComposerPresentation,
  AgentTranscriptPresentation,
  AgentPresentation
} from '../harnesses/contracts'
export { agentPresentation } from '../harnesses/claude/presentation'
export function agentUiPolicy(kind: AgentKind): AgentPresentation {
  return harnessCatalog('claude').agent[kind]
}
export function transcriptPresentation(
  kind: AgentKind,
  backend: Backend | null
): AgentTranscriptPresentation {
  return harnessCatalog(backend).transcript(kind)
}

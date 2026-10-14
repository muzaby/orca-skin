import { agentPresentation } from '../harnesses/claude/presentation'
import { openCodeTranscript } from '../harnesses/opencode/presentation'
export { agentPresentation } from '../harnesses/claude/presentation'
import type { Backend } from '../../../../../shared/ipc'
import type { AgentKind } from '../../../../../shared/agent-kind'
import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'

export interface AgentComposerPresentation {
  showGitRow: boolean
  showLandingCwdControls: boolean
}

export interface AgentTranscriptPresentation {
  surface?: 'opencode'
  turnProjection: 'standard' | 'work-activity'
  inlineSubagentDetail: boolean
  showTaskAgentLabel: boolean
  planBodyPlacement: 'approval-card' | 'right-panel'
  remountTranscriptBySession: boolean
}

export interface AgentPresentation {
  icon: IconName
  navIcon: IconName
  label: MessageKey
  greeting: MessageKey
  placeholder: MessageKey
  composer: AgentComposerPresentation
  transcript: AgentTranscriptPresentation
}

export function agentUiPolicy(kind: AgentKind): (typeof agentPresentation)[AgentKind] {
  return agentPresentation[kind]
}

export function transcriptPresentation(
  kind: AgentKind,
  backend: Backend | null
): AgentTranscriptPresentation {
  return backend === 'opencode' ? openCodeTranscript : agentPresentation[kind].transcript
}

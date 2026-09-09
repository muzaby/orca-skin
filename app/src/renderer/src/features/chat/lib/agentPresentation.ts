import type { AgentKind } from '../../../../../shared/agent-kind'
import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'

export interface AgentComposerPresentation {
  showGitRow: boolean
  showLandingCwdControls: boolean
}

export interface AgentTranscriptPresentation {
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

export const agentPresentation = {
  work: {
    icon: 'todo',
    navIcon: 'checklist',
    label: 'chat.agent.work',
    greeting: 'chat.agent.workGreeting',
    placeholder: 'chat.agent.workPlaceholder',
    composer: {
      showGitRow: false,
      showLandingCwdControls: false
    },
    transcript: {
      turnProjection: 'work-activity',
      inlineSubagentDetail: true,
      showTaskAgentLabel: false,
      planBodyPlacement: 'approval-card',
      remountTranscriptBySession: true
    }
  },
  code: {
    icon: 'terminal',
    navIcon: 'terminal2',
    label: 'chat.agent.code',
    greeting: 'landing.newChatGreeting',
    placeholder: 'chat.composer.placeholderIdle',
    composer: {
      showGitRow: true,
      showLandingCwdControls: true
    },
    transcript: {
      turnProjection: 'standard',
      inlineSubagentDetail: false,
      showTaskAgentLabel: true,
      planBodyPlacement: 'right-panel',
      remountTranscriptBySession: false
    }
  }
} as const satisfies Record<AgentKind, AgentPresentation>

export function agentUiPolicy(kind: AgentKind): (typeof agentPresentation)[AgentKind] {
  return agentPresentation[kind]
}

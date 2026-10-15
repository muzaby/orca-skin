import type { AgentKind } from '../../../../../../shared/agent-kind'
import type { AgentPresentation } from '../contracts'
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

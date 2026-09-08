import type { AgentKind } from '../../../../../shared/agent-kind'
import type { MessageKey } from '../../../shared/i18n'
import type { IconName } from '../../../shared/ui/Icon'

export const agentPresentation = {
  work: {
    icon: 'todo',
    label: 'chat.agent.work',
    greeting: 'chat.agent.workGreeting',
    description: 'chat.agent.workDescription',
    placeholder: 'chat.agent.workPlaceholder'
  },
  coding: {
    icon: 'terminal',
    label: 'chat.agent.coding',
    greeting: 'landing.newChatGreeting',
    description: 'chat.agent.codingDescription',
    placeholder: 'chat.composer.placeholderIdle'
  }
} as const satisfies Record<
  AgentKind,
  {
    icon: IconName
    label: MessageKey
    greeting: MessageKey
    description: MessageKey
    placeholder: MessageKey
  }
>

import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { useI18n } from '../../../shared/i18n'
import { chatActions, useChatSession } from '../store/chatStore'
import { agentPresentation } from '../lib/agentPresentation'

export function AgentModeToggle(): React.JSX.Element {
  const { tr } = useI18n()
  const kind = useChatSession((session) => session.agentKind)
  const locked = useChatSession((session) => session.agentKindLocked || session.sessionId != null)
  return (
    <div className="mb-4 flex flex-col items-center gap-g6">
      <div
        data-agent-mode-controls
        role="group"
        aria-label={tr('chat.agent.choose')}
        className="flex items-center gap-1 px-3 py-1"
      >
        <span aria-hidden="true" data-agent-mode-chevron="left" className="text-ink3">
          <Icon name="chevR" size={28} className="rotate-180" />
        </span>
        {(['work', 'coding'] as const).map((option) => (
          <span key={option} className="flex items-center gap-1">
            {option === 'coding' && (
              <span
                aria-hidden="true"
                data-agent-mode-separator="true"
                className="px-2 text-[32px] font-bold leading-none text-ink2"
              >
                /
              </span>
            )}
            <Button
              type="button"
              pressed={kind === option}
              disabled={locked}
              aria-label={tr(agentPresentation[option].label)}
              aria-pressed={kind === option}
              className={`min-h-20 w-24 rounded-full ${kind === option ? '[&>.btn-squish]:bg-selected-soft' : ''}`}
              onClick={() => chatActions.setAgentKind(option)}
            >
              <span
                className={`flex items-center justify-center ${kind === option ? 'text-selected' : 'text-ink2'}`}
              >
                <Icon name={agentPresentation[option].icon} size={36} />
              </span>
            </Button>
          </span>
        ))}
        <span aria-hidden="true" data-agent-mode-chevron="right" className="text-ink3">
          <Icon name="chevR" size={28} />
        </span>
      </div>
      <h1
        data-agent-mode-hero
        aria-live="polite"
        className="text-center font-serif text-[32px] font-normal tracking-tight text-ink"
      >
        {tr(agentPresentation[kind].greeting)}
      </h1>
    </div>
  )
}

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
            <span className="group/mode relative">
              <Button
                type="button"
                pressed={kind === option}
                disabled={locked}
                aria-label={tr(agentPresentation[option].label)}
                aria-pressed={kind === option}
                aria-describedby={`agent-mode-${option}`}
                className={`min-h-20 w-24 rounded-full ${kind === option ? '[&>.btn-squish]:bg-selected-soft' : ''}`}
                onClick={() => chatActions.setAgentKind(option)}
              >
                <span
                  className={`flex items-center justify-center ${kind === option ? 'text-selected' : 'text-ink2'}`}
                >
                  <Icon name={agentPresentation[option].icon} size={36} />
                </span>
              </Button>
              <span
                id={`agent-mode-${option}`}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-r4 border border-border bg-bg2 px-2 py-1 text-caption text-ink opacity-0 group-hover/mode:opacity-100 group-focus-within/mode:opacity-100"
              >
                {tr(agentPresentation[option].label)}
              </span>
            </span>
          </span>
        ))}
        <span aria-hidden="true" data-agent-mode-chevron="right" className="text-ink3">
          <Icon name="chevR" size={28} />
        </span>
      </div>
      <h1
        data-agent-mode-hero
        aria-live="polite"
        className="text-center font-serif text-[32px] font-bold tracking-tight text-ink"
      >
        {tr(agentPresentation[kind].greeting)}
      </h1>
    </div>
  )
}

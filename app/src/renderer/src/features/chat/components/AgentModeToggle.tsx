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
    <div className="mb-4 flex flex-col items-center gap-g3">
      <div
        role="group"
        aria-label={tr('chat.agent.choose')}
        className="flex rounded-r6 border border-border bg-bg2 p-1"
      >
        {(['work', 'coding'] as const).map((option) => (
          <span key={option} className="group/mode relative">
            <Button
              type="button"
              pressed={kind === option}
              disabled={locked}
              aria-label={tr(agentPresentation[option].label)}
              aria-pressed={kind === option}
              aria-describedby={`agent-mode-${option}`}
              className="min-h-14 w-24"
              onClick={() => chatActions.setAgentKind(option)}
            >
              <span className="flex items-center justify-center gap-2">
                <Icon name={agentPresentation[option].icon} size={24} />
                {kind === option && <Icon name="check" size={12} />}
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
        ))}
      </div>
      <p className="text-center text-caption text-ink2" role="status">
        {tr(agentPresentation[kind].description)}
      </p>
    </div>
  )
}

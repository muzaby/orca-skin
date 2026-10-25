import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { useI18n } from '../../../shared/i18n'
import { chatActions, useChatSession } from '../store/chatStore'
import { agentPresentation } from '../lib/agentPresentation'
import { HarnessLogo } from '../harnesses/registries/brand'

export function AgentModeToggle({ framed = false }: { framed?: boolean }): React.JSX.Element {
  const { tr } = useI18n()
  const kind = useChatSession((session) => session.agentKind)
  const locked = useChatSession((session) => session.agentKindLocked || session.sessionId != null)
  const separatorClass = 'px-2 font-sans text-[32px] font-bold leading-none text-ink2'
  return (
    <div className={`flex flex-col items-center gap-g6 ${framed ? '' : 'mb-4'}`}>
      <div
        data-agent-mode-controls
        role="group"
        aria-label={tr('chat.agent.choose')}
        className="flex items-center gap-1 px-3 py-1"
      >
        <span aria-hidden="true" data-agent-mode-chevron="left" className={separatorClass}>
          {'<'}
        </span>
        {(['work', 'code'] as const).map((option, index) => (
          <span key={option} className="flex items-center gap-1">
            {index > 0 && (
              <span aria-hidden="true" data-agent-mode-separator="true" className={separatorClass}>
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
        <span aria-hidden="true" data-agent-mode-chevron="right" className={separatorClass}>
          {'>'}
        </span>
      </div>
      <h1
        data-agent-mode-hero
        aria-live="polite"
        className="flex items-center justify-center gap-3 text-center font-serif text-[32px] font-normal tracking-tight text-ink"
      >
        <HarnessLogo backend="claude" className="size-9 shrink-0 text-spinner" />
        <span>{tr(agentPresentation[kind].greeting)}</span>
      </h1>
    </div>
  )
}

import { useI18n } from '../../../../../shared/i18n'
import { formatRelativeTime } from '../../../../../shared/i18n/datetime'
import type { Message } from '../../../reducer/chatReducer'
import { childMessageForParentToolRunId } from '../../../lib/parts'
import { AssistantMessage } from '../../../components/transcript/AssistantMessage'
import { openCodeTranscript } from '../presentation'
import { OpenCodeText } from '../transcript/Text'
import { AgentAvatar } from './chrome'
import type { SessionPanelModel } from './model'

export function AgentList({
  agents,
  onSelect
}: {
  agents: SessionPanelModel['agents']
  onSelect: (id: string) => void
}): React.JSX.Element {
  const { tr, locale } = useI18n()
  return (
    <div className="space-y-8 p-5">
      {(['running', 'completed'] as const).map((group) => {
        const items = agents.filter(
          (agent) => (agent.status === 'running') === (group === 'running')
        )
        return (
          <section key={group}>
            <h3 className="mb-3 text-caption text-oc-muted">
              {tr(
                group === 'running' ? 'chat.opencode.panel.active' : 'chat.opencode.panel.completed'
              )}{' '}
              · {items.length}
            </h3>
            {items.length === 0 && (
              <p className="text-footnote text-oc-faint">{tr('chat.opencode.panel.noAgents')}</p>
            )}
            {items.map((agent, index) => (
              <button
                key={agent.toolUseId}
                type="button"
                onClick={() => onSelect(agent.toolUseId)}
                className="flex w-full min-w-0 items-center gap-3 rounded-md py-3 text-left outline-none hover:bg-oc-layer-2 ring-focus"
              >
                <AgentAvatar index={index} />
                <span className="min-w-0 flex-1 truncate text-footnote text-oc-ink">
                  {agent.description}
                </span>
                <span className="shrink-0 text-right text-caption text-oc-faint">
                  {tr(`chat.toolMeta.agentStatus.${agent.status}`)}
                  <span className="block">{formatRelativeTime(agent.createdAtMs, locale)}</span>
                </span>
              </button>
            ))}
          </section>
        )
      })}
    </div>
  )
}

export function AgentDetail({
  agent,
  messages
}: {
  agent: SessionPanelModel['agents'][number]
  messages: Message[]
}): React.JSX.Element {
  const { tr } = useI18n()
  const child = childMessageForParentToolRunId(messages, agent.toolUseId)
  const input = agent.call.input
  const prompt =
    input && typeof input === 'object' && 'prompt' in input && typeof input.prompt === 'string'
      ? input.prompt
      : ''
  return (
    <div className="space-y-5 p-5">
      {prompt && (
        <div className="rounded-xl bg-oc-layer-2 p-3 text-footnote">
          <OpenCodeText source={prompt} />
        </div>
      )}
      {child && <AssistantMessage message={child} transcriptPolicy={openCodeTranscript} />}
      {agent.call.result && (
        <div
          className={`rounded-xl border p-4 ${agent.call.result.isError ? 'border-oc-bad/40 text-oc-bad' : 'border-oc-border'}`}
        >
          <OpenCodeText
            source={
              typeof agent.call.result.output === 'string'
                ? agent.call.result.output
                : (JSON.stringify(agent.call.result.output, null, 2) ?? '')
            }
          />
        </div>
      )}
      {!child && !agent.call.result && (
        <p className="text-footnote text-oc-muted">{tr('chat.opencode.panel.waitingAgent')}</p>
      )}
    </div>
  )
}

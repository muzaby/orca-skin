import { basenameForDisplay } from '../../../../../../../shared/path-basename'
import { useI18n } from '../../../../../shared/i18n'
import { Button } from '../../../../../shared/ui/Button'
import type { Message } from '../../../reducer/chatReducer'
import { useBackgroundStore } from '../../../store/backgroundStore'
import { chatActions, useChatSession } from '../../../store/chatStore'
import { AgentDetail, AgentList } from './AgentViews'
import { AgentAvatar, PanelRow } from './chrome'
import { activePanelProcesses, sessionPanelModel } from './model'
import { useOpenCodePanelNavigation } from './navigation'
import { OpenCodeSources } from './Sources'

const panelModels = new WeakMap<Message[], WeakMap<object, ReturnType<typeof sessionPanelModel>>>()
const emptyBackground = {}

function usePanelData(): {
  messages: Message[]
  model: ReturnType<typeof sessionPanelModel>
} {
  const sessionId = useChatSession((state) => state.sessionId)
  const messages = useChatSession((state) => state.messages)
  const background = useBackgroundStore((state) =>
    sessionId ? state.sessions[sessionId]?.state : undefined
  )
  let inputs = panelModels.get(messages)
  if (!inputs) panelModels.set(messages, (inputs = new WeakMap()))
  const backgroundKey = background ?? emptyBackground
  let model = inputs.get(backgroundKey)
  if (!model) {
    model = sessionPanelModel(messages, background)
    inputs.set(backgroundKey, model)
  }
  return { messages, model }
}

function useSelectedOpenCodeAgent(): ReturnType<typeof usePanelData> & {
  navigation: ReturnType<typeof useOpenCodePanelNavigation>
  detail:
    | Extract<
        NonNullable<ReturnType<typeof useOpenCodePanelNavigation>>['selection'],
        { id: 'subagent' | 'process' }
      >
    | undefined
  selected: string | null
  agent: ReturnType<typeof sessionPanelModel>['agents'][number] | undefined
} {
  const { messages, model } = usePanelData()
  const baseSelected = useChatSession((state) => state.selectedSubagentTaskId)
  const navigation = useOpenCodePanelNavigation()
  const detail = navigation?.selection?.id === 'subagent' ? navigation.selection : undefined
  const selected = detail ? detail.selectedId : baseSelected
  const agent = model.agents.find((item) => item.toolUseId === selected)
  return { messages, model, navigation, detail, selected, agent }
}

export function OpenCodeTaskContent(): React.JSX.Element {
  const { tr } = useI18n()
  const cwd = useChatSession((state) => state.cwd)
  const navigation = useOpenCodePanelNavigation()
  const { model } = usePanelData()
  const active = model.agents.filter((agent) => agent.status === 'running').length
  const processes = activePanelProcesses(model)
  return (
    <div data-component="opencode-session-panel" className="overflow-y-auto px-6 py-4">
      <div
        data-component="opencode-summary-title"
        className="truncate pb-2 text-footnote text-oc-muted"
        title={cwd ?? ''}
      >
        {cwd ? basenameForDisplay(cwd) : tr('chat.rightpanel.tiles.task')}
      </div>
      <PanelRow
        icon="commentAdd"
        focusKey="changes"
        onClick={(event) => navigation?.open({ id: 'diff' }, event.currentTarget)}
      >
        {tr('chat.opencode.panel.changes')}
      </PanelRow>
      {model.agents.length > 0 && (
        <section data-panel-group="agents" className="mt-3 border-t border-oc-border py-4">
          <h3 className="mb-2 text-caption text-oc-muted">{tr('chat.opencode.panel.agents')}</h3>
          <button
            type="button"
            onClick={(event) =>
              navigation?.open({ id: 'subagent', selectedId: null }, event.currentTarget)
            }
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-footnote text-oc-muted outline-none hover:bg-oc-hover ring-focus"
          >
            <span className="flex -space-x-1">
              {model.agents.slice(0, 3).map((agent, index) => (
                <AgentAvatar key={agent.toolUseId} index={index} />
              ))}
            </span>
            {tr('chat.opencode.panel.agentCounts', {
              active,
              completed: model.agents.length - active
            })}
          </button>
        </section>
      )}
      {processes.length > 0 && (
        <section data-panel-group="processes" className="mt-3 border-t border-oc-border py-4">
          <h3 className="mb-2 text-caption text-oc-muted">{tr('chat.opencode.panel.processes')}</h3>
          {processes.map((process) => (
            <PanelRow
              key={process.id}
              icon="terminal"
              title={process.command}
              onClick={(event) =>
                navigation?.open({ id: 'process', selectedId: process.id }, event.currentTarget)
              }
            >
              {process.command}
            </PanelRow>
          ))}
        </section>
      )}
      <OpenCodeSources onShowAll={(origin) => navigation?.open({ id: 'source' }, origin)} />
    </div>
  )
}

export function OpenCodeAgentContent(): React.JSX.Element {
  const { tr } = useI18n()
  const { messages, model, navigation, detail, selected, agent } = useSelectedOpenCodeAgent()
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {agent ? (
        <AgentDetail agent={agent} messages={messages} />
      ) : selected ? (
        <p className="p-5 text-footnote text-oc-muted">{tr('chat.opencode.panel.unavailable')}</p>
      ) : (
        <AgentList
          agents={model.agents}
          onSelect={(selectedId) =>
            detail
              ? navigation?.select?.({ id: 'subagent', selectedId })
              : chatActions.openSubagentTask(selectedId)
          }
        />
      )}
    </div>
  )
}

// The existing subagent tile owns list/detail navigation inside its single native header.
export function OpenCodeAgentHeader(): React.JSX.Element {
  const { tr } = useI18n()
  const { navigation, detail, selected, agent } = useSelectedOpenCodeAgent()
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {selected && (
        <Button
          iconOnly
          size="small"
          leadingIcon="arrowL"
          onClick={() =>
            detail
              ? navigation?.select?.({ id: 'subagent', selectedId: null })
              : chatActions.selectSubagentTask(null)
          }
          aria-label={tr('chat.subagentTile.backToList')}
        />
      )}
      <span
        className="min-w-0 flex-1 truncate text-footnote font-medium"
        title={agent?.description}
      >
        {agent?.description ?? tr('chat.opencode.panel.agents')}
      </span>
      {agent?.model && (
        <span className="max-w-32 truncate text-caption text-oc-faint" title={agent.model}>
          {agent.model}
        </span>
      )}
    </div>
  )
}

export function OpenCodeProcessContent(): React.JSX.Element {
  const { tr } = useI18n()
  const { model } = usePanelData()
  const baseSelected = useChatSession((state) => state.selectedProcessToolId)
  const navigation = useOpenCodePanelNavigation()
  const detail = navigation?.selection?.id === 'process' ? navigation.selection : undefined
  const selected = detail ? detail.selectedId : baseSelected
  const process = model.processes.find((item) => item.id === selected)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {process ? (
        <>
          <p className="mb-3 text-caption text-oc-muted">
            {tr(`chat.opencode.panel.processStatus.${process.status}`)}
          </p>
          <pre className="mb-4 whitespace-pre-wrap break-words rounded-lg bg-oc-layer-2 p-3 font-mono text-footnote">
            $ {process.command}
          </pre>
          {process.truncated && (
            <p className="mb-2 text-caption text-oc-muted">{tr('chat.opencode.panel.truncated')}</p>
          )}
          <pre
            data-component="opencode-process-output"
            className="whitespace-pre-wrap break-words font-mono text-footnote leading-relaxed"
          >
            {process.output || tr('chat.opencode.panel.noOutput')}
          </pre>
        </>
      ) : selected ? (
        <p className="text-footnote text-oc-muted">{tr('chat.opencode.panel.unavailable')}</p>
      ) : model.processes.length > 0 ? (
        model.processes.map((item) => (
          <PanelRow
            key={item.id}
            icon="terminal"
            title={item.command}
            onClick={() =>
              detail
                ? navigation?.select?.({ id: 'process', selectedId: item.id })
                : chatActions.openProcessTool(item.id)
            }
          >
            {item.command}
          </PanelRow>
        ))
      ) : (
        <p className="text-footnote text-oc-muted">{tr('chat.opencode.panel.noProcesses')}</p>
      )}
    </div>
  )
}

export function OpenCodeSourceContent(): React.JSX.Element {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <OpenCodeSources full />
    </div>
  )
}

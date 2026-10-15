import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { RightPanelProps } from '../../../components/rightpanel/RightPanel'
import { chatActions, useChatSession, useChatStore } from '../../../store/chatStore'
import { useBackgroundStore } from '../../../store/backgroundStore'
import { useI18n } from '../../../../../shared/i18n'
import { Icon } from '../../../../../shared/ui/Icon'
import { ResizableSidePane } from '../../../../../shared/ui/ResizableSidePane'
import { basenameForDisplay } from '../../../../../../../shared/path-basename'
import { DiffTileContent } from '../../../components/rightpanel/DiffTileContent'
import {
  PlanTileContent,
  PlanTileHeaderActions
} from '../../../components/rightpanel/PlanTileContent'
import { GitContextBar } from '../../../components/rightpanel/GitContextBar'
import { ArtifactViewer } from '../../../components/rightpanel/ArtifactViewer'
import { closeArtifactViewer, useArtifactViewerStore } from '../../../store/artifactViewerStore'
import { AgentDetail, AgentList } from './AgentViews'
import { AgentAvatar, PanelRow } from './chrome'
import { OpenCodeSources } from './Sources'
import { sessionPanelModel, type PanelView } from './model'

export function OpenCodeRightPanel({
  className = '',
  onExpandedChange
}: RightPanelProps): React.JSX.Element | null {
  const { tr } = useI18n()
  const activeKey = useChatStore((state) => state.activeKey)
  const sessionId = useChatSession((state) => state.sessionId)
  const cwd = useChatSession((state) => state.cwd)
  const messages = useChatSession((state) => state.messages)
  const widths = useChatSession((state) => state.rightPanelColWidths)
  const background = useBackgroundStore((state) =>
    sessionId ? state.sessions[sessionId]?.state : undefined
  )
  const selection = useArtifactViewerStore((state) => state.selection)
  const viewer = selection?.sessionKey === activeKey ? selection : null
  const model = useMemo(() => sessionPanelModel(messages, background), [messages, background])
  const [view, setView] = useState<PanelView>({ kind: 'summary' })
  const [expanded, setExpanded] = useState(false)
  const [menu, setMenu] = useState(false)
  const origin = useRef<string | null>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const previousView = useRef(view)
  useEffect(
    () =>
      useChatStore.subscribe((state, previous) => {
        if (state.activeKey !== activeKey) return
        const entry = state.sessions[activeKey]
        const reveal = entry?.panelReveal
        if (reveal === previous.sessions[activeKey]?.panelReveal) return
        if (reveal?.id === 'diff' || reveal?.id === 'plan') setView({ kind: reveal.id })
        if (reveal?.id === 'subagent') {
          const id = entry.session.selectedSubagentTaskId
          setView(id ? { kind: 'agent', id } : { kind: 'agents' })
        }
      }),
    [activeKey]
  )
  useLayoutEffect(() => {
    const isExpanded = viewer ? viewer.expanded : expanded
    onExpandedChange?.(activeKey, isExpanded)
    return () => onExpandedChange?.(activeKey, false)
  }, [activeKey, expanded, viewer, onExpandedChange])
  useEffect(() => () => closeArtifactViewer(activeKey), [activeKey])
  useLayoutEffect(() => {
    if (previousView.current === view) return
    previousView.current = view
    if (view.kind === 'summary') {
      const buttons = summaryRef.current?.querySelectorAll<HTMLButtonElement>('button')
      const target = Array.from(buttons ?? []).find(
        (button) => button.dataset.panelFocus === origin.current
      )
      ;(target ?? buttons?.[0])?.focus()
    } else backRef.current?.focus()
  }, [view])
  const navigate = (next: PanelView): void => {
    if (view.kind === 'summary')
      origin.current = (document.activeElement as HTMLElement | null)?.dataset.panelFocus ?? null
    setView(next)
    setMenu(false)
  }
  const back = (): void => {
    setView({ kind: view.kind === 'agent' ? 'agents' : 'summary' })
    if (view.kind !== 'agent') setExpanded(false)
  }
  const agent =
    view.kind === 'agent' ? model.agents.find((item) => item.toolUseId === view.id) : undefined
  const process =
    view.kind === 'process' ? model.processes.find((item) => item.id === view.id) : undefined
  const active = model.agents.filter((item) => item.status === 'running').length
  const title =
    agent?.description ??
    process?.command ??
    tr(
      view.kind === 'agents'
        ? 'chat.opencode.panel.agents'
        : view.kind === 'sources'
          ? 'chat.opencode.panel.sources'
          : view.kind === 'diff'
            ? 'chat.opencode.panel.changes'
            : 'chat.rightpanel.tiles.plan'
    )
  if (!sessionId && !viewer) return null
  return (
    <ResizableSidePane
      expanded={viewer ? viewer.expanded : expanded}
      lifecycleKey={activeKey}
      width={widths[0] ?? 360}
      onWidthChange={(width) => chatActions.setRightPanelColWidth(0, width)}
      label={tr('chat.rightpanel.panelResizeAria')}
      className={`my-3 mr-3 ${className}`}
    >
      {viewer && <ArtifactViewer key={viewer.request} selection={viewer} />}
      <aside
        data-component="opencode-session-panel"
        data-view={view.kind}
        className={`relative ${viewer ? 'hidden' : 'flex'} min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-[22px] border border-oc-border bg-oc-surface text-oc-ink shadow-oc-raised ${view.kind === 'summary' ? 'max-h-full flex-initial' : 'flex-1'}`}
        aria-label={tr('chat.opencode.panel.title')}
        aria-hidden={viewer ? true : undefined}
        inert={viewer ? true : undefined}
      >
        {view.kind === 'summary' ? (
          <div ref={summaryRef} className="overflow-y-auto px-6 py-4">
            <div className="flex items-center justify-between pb-2 text-footnote text-oc-muted">
              <span className="truncate" title={cwd ?? ''}>
                {cwd ? basenameForDisplay(cwd) : tr('chat.opencode.panel.title')}
              </span>
              <button
                type="button"
                aria-label={tr('chat.opencode.panel.menu')}
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
                className="rounded p-1 outline-none ring-focus"
              >
                <Icon name="kebab" size={16} />
              </button>
            </div>
            {menu && (
              <div className="mb-2 rounded-lg border border-oc-border p-2">
                <PanelRow icon="doc" onClick={() => navigate({ kind: 'plan' })}>
                  {tr('chat.rightpanel.tiles.plan')}
                </PanelRow>
              </div>
            )}
            <PanelRow icon="commentAdd" focusKey="diff" onClick={() => navigate({ kind: 'diff' })}>
              {tr('chat.opencode.panel.changes')}
            </PanelRow>
            <section className="mt-3 border-t border-oc-border py-4">
              <h3 className="mb-2 text-caption text-oc-muted">
                {tr('chat.opencode.panel.agents')}
              </h3>
              <button
                type="button"
                data-panel-focus="agents"
                onClick={() => navigate({ kind: 'agents' })}
                className="flex w-full items-center gap-2 rounded-md py-2 text-footnote text-oc-muted outline-none hover:bg-oc-hover ring-focus"
              >
                <span className="flex -space-x-1">
                  {model.agents.slice(0, 3).map((item, index) => (
                    <AgentAvatar key={item.toolUseId} index={index} />
                  ))}
                </span>
                {tr('chat.opencode.panel.agentCounts', {
                  active,
                  completed: model.agents.length - active
                })}
              </button>
            </section>
            <section className="border-t border-oc-border py-4">
              <h3 className="mb-2 text-caption text-oc-muted">
                {tr('chat.opencode.panel.processes')}
              </h3>
              {model.processes.length === 0 && (
                <p className="py-2 text-caption text-oc-faint">
                  {tr('chat.opencode.panel.noProcesses')}
                </p>
              )}
              {model.processes.map((item) => (
                <PanelRow
                  key={item.id}
                  icon="terminal"
                  title={item.command}
                  focusKey={`process:${item.id}`}
                  onClick={() => navigate({ kind: 'process', id: item.id })}
                >
                  {item.command}
                </PanelRow>
              ))}
            </section>
            <div className="border-t border-oc-border pt-3">
              <OpenCodeSources onShowAll={() => navigate({ kind: 'sources' })} />
            </div>
          </div>
        ) : (
          <>
            <header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-oc-border px-3">
              <button
                ref={backRef}
                type="button"
                onClick={back}
                aria-label={tr('chat.opencode.panel.back')}
                className="rounded p-1 outline-none ring-focus"
              >
                <Icon name="arrowL" size={18} />
              </button>
              {agent && <AgentAvatar index={model.agents.indexOf(agent)} />}
              <span className="min-w-0 flex-1 truncate text-footnote font-medium" title={title}>
                {title}
              </span>
              {agent?.model && (
                <span className="max-w-32 truncate text-caption text-oc-faint" title={agent.model}>
                  {agent.model}
                </span>
              )}
              {view.kind === 'plan' && <PlanTileHeaderActions />}
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-label={tr(
                  expanded ? 'chat.opencode.panel.collapse' : 'chat.opencode.panel.expand'
                )}
                className="rounded p-1 outline-none ring-focus"
              >
                <Icon name={expanded ? 'collapse' : 'expand'} size={16} />
              </button>
            </header>
            {view.kind === 'diff' && (
              <div className="shrink-0 border-b border-oc-border p-2">
                <GitContextBar expanded={expanded} onToggleExpand={() => setExpanded(!expanded)} />
              </div>
            )}
            <div
              key={view.kind === 'agent' || view.kind === 'process' ? view.id : view.kind}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              {view.kind === 'agents' && (
                <AgentList
                  agents={model.agents}
                  onSelect={(id) => navigate({ kind: 'agent', id })}
                />
              )}
              {agent && <AgentDetail agent={agent} messages={messages} />}
              {process && (
                <div className="p-4">
                  <p className="mb-3 text-caption text-oc-muted">
                    {tr(`chat.opencode.panel.processStatus.${process.status}`)}
                  </p>
                  <pre className="mb-4 whitespace-pre-wrap break-words rounded-lg bg-oc-layer-2 p-3 font-mono text-footnote">
                    $ {process.command}
                  </pre>
                  {process.truncated && (
                    <p className="mb-2 text-caption text-oc-muted">
                      {tr('chat.opencode.panel.truncated')}
                    </p>
                  )}
                  <pre
                    data-component="opencode-process-output"
                    className="whitespace-pre-wrap break-words font-mono text-footnote leading-relaxed"
                  >
                    {process.output || tr('chat.opencode.panel.noOutput')}
                  </pre>
                </div>
              )}
              {view.kind === 'sources' && (
                <div className="p-5">
                  <OpenCodeSources full />
                </div>
              )}
              {view.kind === 'plan' && <PlanTileContent />}
              {view.kind === 'diff' && <DiffTileContent />}
              {((view.kind === 'agent' && !agent) || (view.kind === 'process' && !process)) && (
                <p className="p-5 text-footnote text-oc-muted">
                  {tr('chat.opencode.panel.unavailable')}
                </p>
              )}
            </div>
          </>
        )}
      </aside>
    </ResizableSidePane>
  )
}

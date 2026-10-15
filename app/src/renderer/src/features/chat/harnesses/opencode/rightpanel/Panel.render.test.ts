import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { RightPanel } from '../../../components/rightpanel/RightPanel'
import { useChatStore } from '../../../store/chatStore'
import { AgentDetail, AgentList } from './AgentViews'
import { sessionPanelModel } from './model'
import type { Message } from '../../../reducer/chatReducer'

const initial = useChatStore.getInitialState()
const entry = initial.sessions[initial.activeKey]
const original = entry.session
afterEach(() => {
  entry.session = original
})
describe('OpenCode panel rendering', () => {
  it('dispatches the default OpenCode summary with Work context sources and no PR', () => {
    entry.session = {
      ...original,
      sessionId: 's',
      backend: 'opencode',
      agentKind: 'code',
      cwd: 'C:/workspace/orca',
      extraDirs: ['C:/refs'],
      rightPanelTiles: [{ id: 'task', tiles: ['task'] }]
    }
    const $ = load(renderToStaticMarkup(createElement(RightPanel)))
    expect($('[data-component="opencode-session-panel"]').length).toBe(1)
    for (const label of ['변경 사항', '소스', 'orca', 'refs', '폴더 추가'])
      expect($.html()).toContain(label)
    expect($('[data-panel-group]').length).toBe(0)
    expect($('[data-component="opencode-summary-title"] button').length).toBe(0)
    expect($('[data-context="task"] .app-frame-tile-header').length).toBe(0)
    expect($.text()).not.toContain('풀 리퀘스트')
    entry.session = {
      ...entry.session,
      backend: 'claude',
      rightPanelTiles: [{ id: 'plan', tiles: ['plan'] }]
    }
    const claude = load(renderToStaticMarkup(createElement(RightPanel)))
    expect(claude('[data-component="opencode-session-panel"]').length).toBe(0)
    expect(claude('[data-panel-tiles="plan"]').length).toBe(1)
  })
  it.each(['Task', 'Bash'] as const)(
    'shows only the populated %s group and hides it after removal',
    (toolName) => {
      entry.session = {
        ...original,
        backend: 'opencode',
        agentKind: 'code',
        cwd: 'C:/orca',
        rightPanelTiles: [{ id: 'task', tiles: ['task'] }]
      }
      const render = (): ReturnType<typeof load> =>
        load(renderToStaticMarkup(createElement(RightPanel)))
      expect(render()('[data-component="opencode-session-panel"] button').text()).toBe('변경 사항')
      expect(render()('[data-panel-group], [data-component="opencode-sources"]').length).toBe(0)
      entry.session = {
        ...entry.session,
        messages: [
          {
            role: 'assistant',
            createdAt: 1,
            parts: [
              {
                type: 'tool_call',
                toolRunId: 'tool',
                toolName,
                args: toolName === 'Task' ? { description: 'Inspect' } : { command: 'npm run dev' }
              }
            ]
          }
        ]
      }
      expect(render()('[data-panel-group]').attr('data-panel-group')).toBe(
        toolName === 'Task' ? 'agents' : 'processes'
      )
      entry.session = { ...entry.session, messages: [] }
      expect(render()('[data-panel-group]').length).toBe(0)
    }
  )
  it('keeps source add reachable in a full tile while hiding cwd-only summary context', () => {
    entry.session = {
      ...original,
      backend: 'opencode',
      agentKind: 'code',
      sessionId: 's',
      cwd: 'C:/orca',
      rightPanelTiles: [{ id: 'task', tiles: ['task', 'source'] }]
    }
    const render = (): ReturnType<typeof load> =>
      load(renderToStaticMarkup(createElement(RightPanel)))
    expect(render()('[data-context="task"] [data-component="opencode-sources"]').length).toBe(0)
    expect(render()('[data-context="source"] button[aria-label="폴더 추가"]').length).toBe(1)
    expect(render()('[data-context="source"]').text()).toContain('orca')
    entry.session = { ...entry.session, extraDirs: ['C:/refs'] }
    expect(render()('[data-context="task"] [data-component="opencode-sources"]').text()).toContain(
      'refs'
    )
    entry.session = { ...entry.session, extraDirs: [] }
    expect(render()('[data-context="task"] [data-component="opencode-sources"]').length).toBe(0)
  })
  it('keeps summary, diff and process tiles together with a single native diff header', () => {
    entry.session = {
      ...original,
      backend: 'opencode',
      agentKind: 'code',
      rightPanelTiles: [
        { id: 'task', tiles: ['task', 'diff'] },
        { id: 'process', tiles: ['process'] }
      ]
    }
    const $ = load(renderToStaticMarkup(createElement(RightPanel)))
    expect($('.app-frame-tile[data-context]')).toHaveLength(3)
    expect($('[data-context="diff"] .app-frame-tile-header')).toHaveLength(1)
    expect($('[data-diff-tile-header] button[aria-label="변경사항 닫기"]')).toHaveLength(1)
    expect($('[data-context="process"] .app-frame-tile-header')).toHaveLength(1)
  })
  it('renders grouped agents and child tool cards, result and model data', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        createdAt: Date.now(),
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'task',
            toolName: 'Task',
            args: { description: 'Inspect source', prompt: 'Inspect sample.md' }
          },
          { type: 'text', text: 'Child answer', parentToolRunId: 'task' },
          {
            type: 'tool_call',
            toolRunId: 'child:read',
            toolName: 'Read',
            args: { file_path: 'sample.md' },
            parentToolRunId: 'task'
          },
          {
            type: 'tool_result',
            toolRunId: 'child:read',
            result: '# sample',
            isError: false,
            parentToolRunId: 'task'
          },
          { type: 'tool_result', toolRunId: 'task', result: 'Inspection finished', isError: false }
        ]
      }
    ]
    const model = sessionPanelModel(messages)
    const list = load(
      renderToStaticMarkup(createElement(AgentList, { agents: model.agents, onSelect: () => {} }))
    )
    expect(list.text()).toContain('완료 · 1')
    expect(list('button').text()).toContain('Inspect source')
    const detail = load(
      renderToStaticMarkup(createElement(AgentDetail, { agent: model.agents[0], messages }))
    )
    expect(detail.text()).toContain('Child answer')
    expect(detail.text()).toContain('Inspection finished')
    expect(detail('[data-component="opencode-tool"]').length).toBe(1)
  })
})

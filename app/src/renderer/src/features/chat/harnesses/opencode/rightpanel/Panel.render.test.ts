import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { RightPanel } from '../../../components/rightpanel/RightPanel'
import { tileById } from '../../../components/rightpanel/tileRegistry'
import { useChatStore } from '../../../store/chatStore'
import { AgentDetail, AgentList } from './AgentViews'
import { sessionPanelModel } from './model'
import type { Message } from '../../../reducer/chatReducer'
import { OpenCodePanelNavigationContext, type OpenCodePanelSelection } from './navigation'

const initial = useChatStore.getInitialState()
const entry = initial.sessions[initial.activeKey]
const original = entry.session

function renderSelectionLayers(
  selection: Extract<OpenCodePanelSelection, { selectedId: string | null }>
): ReturnType<typeof load> {
  const messages: Message[] = [
    {
      role: 'assistant',
      createdAt: 1,
      parts: ['base', 'detail'].flatMap((layer): Message['parts'] => [
        {
          type: 'tool_call',
          toolRunId: `${layer}-subagent`,
          toolName: 'Task',
          args: { description: `${layer} agent`, prompt: `${layer} agent prompt` }
        },
        {
          type: 'tool_result',
          toolRunId: `${layer}-subagent`,
          result: `${layer} agent result`,
          isError: false
        },
        {
          type: 'tool_call',
          toolRunId: `${layer}-process`,
          toolName: 'Bash',
          args: { command: `echo ${layer} process` }
        },
        {
          type: 'tool_result',
          toolRunId: `${layer}-process`,
          result: `${layer} process result`,
          isError: false
        }
      ])
    }
  ]
  entry.session = {
    ...original,
    backend: 'opencode',
    agentKind: 'code',
    messages,
    selectedSubagentTaskId: 'base-subagent',
    selectedProcessToolId: 'base-process'
  }
  const { Content, HeaderContent } = tileById(selection.id, 'opencode')
  const content = (layer: string): React.ReactElement =>
    createElement(
      'section',
      { 'data-test-layer': layer },
      HeaderContent && createElement(HeaderContent),
      createElement(Content)
    )
  return load(
    renderToStaticMarkup(
      createElement(
        OpenCodePanelNavigationContext.Provider,
        { value: { open: () => {} } },
        content('base'),
        createElement(
          OpenCodePanelNavigationContext.Provider,
          { value: { open: () => {}, selection, select: () => {} } },
          content('detail')
        )
      )
    )
  )
}

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
  it('shows only active shell rows while keeping terminal detail readable', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        createdAt: 1,
        parts: [
          ...['first', 'second'].map((id): Message['parts'][number] => ({
            type: 'tool_call',
            toolRunId: id,
            toolName: 'Bash',
            args: { command: `echo ${id}` }
          })),
          {
            type: 'tool_call',
            toolRunId: 'agent',
            toolName: 'Task',
            args: { description: 'Independent agent' }
          }
        ]
      }
    ]
    entry.session = {
      ...original,
      backend: 'opencode',
      agentKind: 'code',
      cwd: 'C:/orca',
      extraDirs: ['C:/refs'],
      messages,
      rightPanelTiles: [{ id: 'task', tiles: ['task'] }]
    }
    const { Content } = tileById('process', 'opencode')
    const render = (): ReturnType<typeof load> =>
      load(
        renderToStaticMarkup(
          createElement(
            'div',
            null,
            createElement(RightPanel),
            createElement(
              OpenCodePanelNavigationContext.Provider,
              { value: { open: () => {}, selection: { id: 'process', selectedId: 'first' } } },
              createElement('section', { 'data-test-layer': 'detail' }, createElement(Content))
            )
          )
        )
      )
    const shellCommands = ($: ReturnType<typeof load>): string[] =>
      $('[data-panel-group="processes"] button')
        .toArray()
        .map((button) => $(button).text())
    expect(shellCommands(render())).toEqual(['echo first', 'echo second'])

    messages[0].parts.push({
      type: 'tool_result',
      toolRunId: 'first',
      result: 'first final log',
      isError: false
    })
    const partiallyFinished = render()
    expect(shellCommands(partiallyFinished)).toEqual(['echo second'])
    expect(
      partiallyFinished(
        '[data-test-layer="detail"] [data-component="opencode-process-output"]'
      ).text()
    ).toBe('first final log')

    messages[0].parts.push({
      type: 'tool_result',
      toolRunId: 'second',
      result: 'second final failure',
      isError: true
    })
    const finished = render()
    expect(finished('[data-panel-group="processes"]')).toHaveLength(0)
    expect(finished('[data-component="opencode-session-panel"]').text()).not.toContain(
      '백그라운드 프로세스'
    )
    expect(finished('[data-panel-group="agents"]')).toHaveLength(1)
    expect(finished('[data-component="opencode-sources"]')).toHaveLength(1)
    expect(finished('[data-panel-focus="changes"]').text()).toBe('변경 사항')
    expect(finished('[data-test-layer="detail"]').text()).toContain('first final log')
    expect(finished('[data-test-layer="detail"]').text()).not.toContain(
      '이 항목의 기록을 찾을 수 없습니다.'
    )

    messages[0].parts.push({
      type: 'tool_call',
      toolRunId: 'retry',
      toolName: 'Bash',
      args: { command: 'echo retry' }
    })
    expect(shellCommands(render())).toEqual(['echo retry'])
    expect(sessionPanelModel(messages).processes.map((process) => process.id)).toEqual([
      'first',
      'second',
      'retry'
    ])
  })
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
  it('renders directly configured task, diff and process tiles with a single native diff header', () => {
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
  describe.each(['subagent', 'process'] as const)('%s selection contexts', (id) => {
    const label = id === 'subagent' ? 'agent' : 'process'

    it('renders the local detail selection and preserves the base tile selection', () => {
      const $ = renderSelectionLayers({ id, selectedId: `detail-${id}` })
      const base = $('[data-test-layer="base"]')
      const detail = $('[data-test-layer="detail"]')
      expect(base.text()).toContain(`base ${label} result`)
      expect(base.text()).not.toContain(`detail ${label} result`)
      expect(detail.text()).toContain(`detail ${label} result`)
      expect(detail.text()).not.toContain(`base ${label} result`)
      if (id === 'subagent') {
        expect(base.find('[title="base agent"]')).toHaveLength(1)
        expect(detail.find('[title="detail agent"]')).toHaveLength(1)
      }
      expect(entry.session.selectedSubagentTaskId).toBe('base-subagent')
      expect(entry.session.selectedProcessToolId).toBe('base-process')
    })

    it('renders a missing local record as unavailable without falling back to the base selection', () => {
      const $ = renderSelectionLayers({ id, selectedId: 'missing-record' })
      expect($('[data-test-layer="base"]').text()).toContain(`base ${label} result`)
      expect($('[data-test-layer="detail"]').text()).toContain('이 항목의 기록을 찾을 수 없습니다.')
      expect($('[data-test-layer="detail"]').text()).not.toContain(`base ${label} result`)
      expect($('[data-test-layer="detail"]').text()).not.toContain(`detail ${label} result`)
    })

    it('renders the local list for null selection while the base stays on its selected record', () => {
      const $ = renderSelectionLayers({ id, selectedId: null })
      const detail = $('[data-test-layer="detail"]')
      expect($('[data-test-layer="base"]').text()).toContain(`base ${label} result`)
      expect(detail.find('button').text()).toContain(`base ${label}`)
      expect(detail.find('button').text()).toContain(`detail ${label}`)
      expect(detail.text()).not.toContain(`${label} result`)
    })
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

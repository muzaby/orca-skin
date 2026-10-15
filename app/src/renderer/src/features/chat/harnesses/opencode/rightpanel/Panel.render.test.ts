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
      extraDirs: ['C:/refs']
    }
    const $ = load(renderToStaticMarkup(createElement(RightPanel)))
    expect($('[data-component="opencode-session-panel"]').attr('data-view')).toBe('summary')
    for (const label of [
      '변경 사항',
      '하위 에이전트',
      '백그라운드 프로세스',
      '소스',
      'orca',
      'refs',
      '폴더 추가'
    ])
      expect($.html()).toContain(label)
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

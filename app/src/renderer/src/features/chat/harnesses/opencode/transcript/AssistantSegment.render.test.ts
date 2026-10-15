import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { describe, expect, it, vi } from 'vitest'
import { AssistantMessage, AssistantSegment } from '../../../components/transcript/AssistantMessage'
import { PendingAssistant } from '../../../components/transcript/PendingAssistant'
import { UserMessage } from '../../../components/transcript/UserMessage'
import { MessageMeta } from '../../../components/transcript/MessageMeta'
import { transcriptPresentation } from '../../../lib/agentPresentation'
import { chatReducer, initialChatState, type Message } from '../../../reducer/chatReducer'
import { installChatStoreHarness } from '../../../store/chatStore.testHarness'
import type { MessageSegment } from '../../../lib/parts'
import type { LoadedSession } from '../../../../../../../shared/ipc'
import { OpenCodeToolCard } from './ToolCard'
import { ToolBody } from './ToolBody'
import { describeTool } from '../toolPresentation'

vi.mock('../../../store/chatStore', async (original) => {
  const module = await original<typeof import('../../../store/chatStore')>()
  return {
    ...module,
    useChatSession: (select: (state: ReturnType<typeof module.getActiveChatSession>) => unknown) =>
      select(module.getActiveChatSession()),
    useLiveText: () => 'Live **answer**',
    useLiveReasoning: () => 'Live reasoning'
  }
})
const render = (element: ReturnType<typeof createElement>): ReturnType<typeof load> =>
  load(renderToStaticMarkup(element))
describe('harness transcript routing', () => {
  it.each([
    ['user-rejected', 'rejected'],
    ['cancelled', 'cancelled'],
    ['unknown', 'not_executed'],
    ['interrupted', 'aborted']
  ] as const)(
    'renders %s with its own outcome, without a completion label or spinner',
    (kind, outcome) => {
      const $ = render(
        createElement(OpenCodeToolCard, {
          call: {
            toolUseId: 't',
            name: 'Read',
            input: {},
            result: { output: 'receipt', isError: true, nonExecution: { source: 'sdk', kind } }
          }
        })
      )
      expect($('[data-outcome]').attr('data-outcome')).toBe(outcome)
      expect($('[data-component="opencode-spinner"]')).toHaveLength(0)
      expect($.text()).not.toContain('완료')
    }
  )
  it.each([
    ['Task', { description: 'Review changes' }, 'Review changes'],
    ['WebFetch', { url: 'https://example.com' }, 'https://example.com'],
    [
      'TodoWrite',
      { todos: [{ content: 'Review changes', status: 'completed' }] },
      'Review changes'
    ],
    ['mcp_widget', { custom: 'raw input' }, 'raw input']
  ])('renders the %s body from the native decoder', (name, input, visible) => {
    const view = describeTool({ toolUseId: 't', name: name as string, input })
    const $ = render(createElement(ToolBody, { view }))
    expect($.text()).toContain(visible)
    if (name === 'WebFetch') expect($('a').attr('href')).toBe('https://example.com')
  })
  it.each(['claude', 'opencode'] as const)(
    'separates committed and live text/reasoning for %s',
    (backend) => {
      installChatStoreHarness({ backend })
      const message: Message = {
        role: 'assistant',
        createdAt: 1,
        parts: [
          { type: 'reasoning', text: 'Reasoning' },
          { type: 'text', text: '**Answer**' }
        ]
      }
      const $ = render(
        createElement(AssistantMessage, {
          message,
          transcriptPolicy: transcriptPresentation('code', backend)
        })
      )
      expect($.text().indexOf('Reasoning')).toBeLessThan($.text().indexOf('Answer'))
      expect($('[data-component="opencode-text"]')).toHaveLength(backend === 'opencode' ? 1 : 0)
      expect($('details')).toHaveLength(backend === 'claude' ? 1 : 0)
      const live = render(
        createElement(PendingAssistant, { openCode: backend === 'opencode', showStatus: false })
      )
      expect(live.text()).toContain('Live answer')
      expect(live('[data-component="opencode-reasoning"]')).toHaveLength(
        backend === 'opencode' ? 1 : 0
      )
      expect(live('details')).toHaveLength(backend === 'claude' ? 1 : 0)
    }
  )
  it('handles every persisted segment kind in order', () => {
    installChatStoreHarness({ backend: 'opencode' })
    const segments: MessageSegment[] = [
      { kind: 'reasoning', items: [{ text: 'reason' }] },
      { kind: 'text', text: 'before' },
      { kind: 'tools', calls: [{ toolUseId: 't', name: 'mcp_widget', input: {} }] },
      {
        kind: 'ask',
        call: {
          toolUseId: 'ask',
          name: 'AskUserQuestion',
          input: { questions: [{ question: 'Which?', header: 'Q', options: [] }] },
          result: { output: { answers: { 'Which?': 'First' } }, isError: false }
        }
      },
      { kind: 'structured', value: { answer: 42 } },
      { kind: 'error', error: { category: 'unknown', message: 'native error' } },
      { kind: 'compact', trigger: 'auto', preTokens: 100, postTokens: 20 },
      { kind: 'fork' },
      { kind: 'subagent_notice', toolRunId: 'task', status: 'failed', summary: 'task failure' }
    ]
    const policy = transcriptPresentation('code', 'opencode')
    const $ = render(
      createElement(
        'div',
        {},
        segments.map((segment, index) =>
          createElement(
            'section',
            { 'data-segment': segment.kind, key: index },
            createElement(AssistantSegment, { segment, transcriptPolicy: policy })
          )
        )
      )
    )
    expect(
      $('[data-segment]')
        .map((_, el) => $(el).attr('data-segment'))
        .get()
    ).toEqual(segments.map((seg) => seg.kind))
    expect($('[data-segment]').filter((_, el) => $(el).text().trim() === '')).toHaveLength(0)
    expect($('[data-component="opencode-error"]').text()).toContain('native error')
    expect($('[data-component="opencode-structured"]').text()).toContain('42')
  })
  it('preserves native metadata through live reducer and session reload', () => {
    let state = chatReducer({ ...initialChatState, backend: 'opencode' }, { type: 'BEGIN_TURN' })
    state = chatReducer(state, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.started',
        sessionId: 's',
        toolRunId: 't',
        toolName: 'Edit',
        args: { file_path: 'a.ts', old_string: 'old', new_string: 'new' },
        providerTool: {
          name: 'edit',
          input: { filePath: 'a.ts', oldString: 'old', newString: 'new' }
        }
      }
    })
    state = chatReducer(state, {
      type: 'RECV_EVENT',
      event: {
        type: 'tool.call.completed',
        sessionId: 's',
        toolRunId: 't',
        result: 'done',
        isError: false,
        structuredOutput: { filediff: { file: 'a.ts', before: 'old', after: 'actual result' } }
      }
    })
    const reloaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: { id: 's', backend: 'opencode', messages: state.messages } as LoadedSession
    })
    for (const current of [state, reloaded]) {
      const $ = render(
        createElement(AssistantMessage, {
          message: current.messages.at(-1)!,
          transcriptPolicy: transcriptPresentation('code', 'opencode')
        })
      )
      expect($('[data-component="opencode-file-diff"]').text()).toContain('actual result')
      expect($('details pre').text()).toContain('filePath')
    }
  })
  it('selects the user bubble style while keeping one copy/time row and disabling OpenCode fork', () => {
    installChatStoreHarness({ backend: 'opencode' })
    const message: Message = {
      role: 'user',
      createdAt: 1,
      parts: [{ type: 'text', text: 'prompt' }]
    }
    const $ = render(
      createElement(
        'div',
        {},
        createElement(UserMessage, { message, openCode: true }),
        createElement(MessageMeta, { text: 'prompt', createdAt: 1, align: 'right', forkable: true })
      )
    )
    const bubble = $('.bg-bubble-user')
    expect(bubble).toHaveLength(1)
    expect(bubble.hasClass('text-ink')).toBe(true)
    expect(bubble.hasClass('rounded-[10px]')).toBe(true)
    expect(bubble.hasClass('bg-oc-bubble')).toBe(false)
    expect(bubble.hasClass('text-oc-bubble-ink')).toBe(false)
    expect($('button')).toHaveLength(1)
    expect($.text()).toContain('prompt')
  })
})

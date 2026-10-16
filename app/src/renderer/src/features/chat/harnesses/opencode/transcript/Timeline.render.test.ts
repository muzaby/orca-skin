import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import { installChatStoreHarness } from '../../../store/chatStore.testHarness'
import { TranscriptView } from '../../../components/transcript/TranscriptView'

const live = vi.hoisted(() => ({ text: '', reasoning: '' }))
beforeEach(() => {
  live.text = ''
  live.reasoning = ''
})
vi.mock('../../../store/chatStore', async (original) => {
  const module = await original<typeof import('../../../store/chatStore')>()
  return {
    ...module,
    useChatSession: (select: (state: ReturnType<typeof module.getActiveChatSession>) => unknown) =>
      select(module.getActiveChatSession()),
    useLiveText: () => live.text,
    useLiveReasoning: () => live.reasoning
  }
})
// Only the browser measurement is supplied: production dispatcher, projection,
// virtualizer, row renderers and store selectors are all executed.
vi.mock('@tanstack/react-virtual', async (original) => {
  const module = await original<typeof import('@tanstack/react-virtual')>()
  return {
    ...module,
    useVirtualizer: (options: Parameters<typeof module.useVirtualizer>[0]) =>
      module.useVirtualizer({ ...options, initialRect: { width: 1200, height: 10000 } })
  }
})
const user: Message = { role: 'user', createdAt: 10, parts: [{ type: 'text', text: 'Prompt' }] }
function render(messages: Message[], inflight = false): ReturnType<typeof load> {
  installChatStoreHarness({
    backend: 'opencode',
    messages,
    inflight,
    turnStartedAt: inflight ? Date.now() : null
  })
  return load(
    renderToStaticMarkup(
      createElement(TranscriptView, {
        backend: 'opencode',
        agentKind: 'code',
        messages,
        inflight,
        pendingSteer: [],
        loadingSession: false,
        anchored: true,
        scrollRef: { current: null },
        contentRef: { current: null },
        onScroll: () => {}
      })
    )
  )
}
describe('OpenCode production Timeline rendering', () => {
  it('renders live text without reasoning prose through the production timeline', () => {
    live.text = 'Live **answer**'
    live.reasoning = 'Live reasoning'
    const $ = render([user], true)
    expect($('[data-component="opencode-text"]').text()).toContain('Live answer')
    expect($('[data-component="opencode-text"] strong').text()).toBe('answer')
    expect($('[data-component="opencode-reasoning"]')).toHaveLength(0)
    expect($.text()).not.toContain('Live reasoning')
    expect($('details')).toHaveLength(0)
  })
  it('keeps a progress indicator when only reasoning is arriving', () => {
    live.reasoning = 'Internal reasoning without text'
    const $ = render([user], true)
    expect($.text()).not.toContain(live.reasoning)
    expect($('[data-component="opencode-spinner"]')).toHaveLength(1)
  })
  it('routes visible segments and collapsed native file tools without Claude reserved tail', () => {
    live.text = ''
    const assistant: Message = {
      role: 'assistant',
      createdAt: 20,
      parts: [
        { type: 'text', text: 'First paragraph' },
        { type: 'reasoning', text: 'Reasoning paragraph' },
        { type: 'tool_call', toolRunId: 'read', toolName: 'Read', args: { file_path: 'a.ts' } },
        { type: 'tool_call', toolRunId: 'grep', toolName: 'Grep', args: { pattern: 'answer' } },
        {
          type: 'tool_call',
          toolRunId: 'edit',
          toolName: 'Edit',
          args: { file_path: 'a.ts', old_string: 'before', new_string: 'after' }
        },
        { type: 'tool_result', toolRunId: 'edit', result: 'saved', isError: false },
        {
          type: 'tool_call',
          toolRunId: 'question',
          toolName: 'AskUserQuestion',
          args: { questions: [] }
        },
        { type: 'structured_output', value: { answer: 42 } },
        { type: 'error', error: { message: 'Oops' } },
        { type: 'compact_boundary', trigger: 'auto' },
        { type: 'fork_boundary' },
        { type: 'subagent_notice', toolRunId: 'task', status: 'completed', summary: 'Finished' }
      ]
    }
    const $ = render([user, assistant])
    expect(
      $('[data-timeline-row]')
        .map((_, element) => $(element).attr('data-timeline-row'))
        .get()
    ).toEqual([
      'user',
      'text',
      'tools',
      'tools',
      'ask',
      'structured',
      'error',
      'compact',
      'fork',
      'subagent_notice',
      'meta'
    ])
    expect($('[data-component="context-tool-group"]')).toHaveLength(1)
    const edit = $('[data-timeline-key="user:10:tool:edit"]')
    expect(edit.hasClass('pt-[8px]')).toBe(true)
    expect(edit.find('[data-component="opencode-file-diff"]')).toHaveLength(0)
    expect(edit.find('[data-slot="tool-diff-summary"]').text()).toBe('+1−1')
    expect(edit.text()).toContain('a.ts')
    expect(edit.text()).not.toContain('before')
    expect(edit.text()).not.toContain('after')
    expect($('[data-timeline-row="text"]').hasClass('pt-[16px]')).toBe(true)
    expect($('[data-timeline-scroll]').find('[class~="pb-[64px]"]')).toHaveLength(1)
    expect($('[class~="min-h-[50cqh]"]')).toHaveLength(0)
    expect($('.bg-bubble-user').hasClass('text-ink')).toBe(true)
    expect($('[data-timeline-scroll]').hasClass('bg-bg')).toBe(true)
  })
  it('keeps the streamed row identity on commit and removes Todo only from the normal transcript', () => {
    live.text = 'Live answer'
    const streaming = render([user], true)
    const key = streaming('[data-timeline-row="text"]').attr('data-timeline-key')
    expect(streaming('[data-timeline-row="text"]').text()).toContain('Live answer')
    live.text = ''
    const completed = render([
      user,
      {
        role: 'assistant',
        createdAt: 20,
        parts: [
          { type: 'text', text: 'Live answer' },
          {
            type: 'tool_call',
            toolRunId: 'todo',
            toolName: 'TodoWrite',
            args: { todos: [{ content: 'Retained task', status: 'pending' }] }
          },
          { type: 'tool_result', toolRunId: 'todo', result: 'updated', isError: false }
        ]
      }
    ])
    expect(completed('[data-timeline-row="text"]').attr('data-timeline-key')).toBe(key)
    expect(completed('[data-tool-kind="todo"]')).toHaveLength(0)
    expect(completed('[data-timeline-row="tools"]')).toHaveLength(0)
    expect(completed('[data-timeline-row="meta"]')).toHaveLength(1)
  })
})

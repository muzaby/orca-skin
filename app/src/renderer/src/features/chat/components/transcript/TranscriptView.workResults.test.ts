import { createElement } from 'react'
import { load } from 'cheerio'
import { renderWithTranscript as renderToStaticMarkup } from '../../harnesses/registries/transcript.testfixture'
import { describe, expect, it, vi } from 'vitest'
import { TranscriptView } from './TranscriptView'
import type { Message } from '../../reducer/chatReducer'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: options.count }, (_, index) => ({ index, start: index * 40 })),
    getTotalSize: () => options.count * 40,
    measureElement: vi.fn()
  })
}))
vi.mock('../../harnesses/common/transcript/MessageMeta', () => ({ MessageMeta: () => null }))
vi.mock('../../../../shared/ui/markdown/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => createElement('p', null, source)
}))

describe('TranscriptView Work result consumer chain', () => {
  it('passes a late result across a user boundary into the original tool block only', () => {
    const messages: Message[] = [
      { id: 'm-41', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'first' }] },
      {
        id: 'm-42',
        role: 'assistant',
        createdAt: 2,
        parts: [{ type: 'tool_call', toolRunId: 't', toolName: 'Read', args: {} }]
      },
      { id: 'm-47', role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'steered' }] },
      {
        id: 'm-48',
        role: 'assistant',
        createdAt: 4,
        parts: [
          { type: 'tool_result', toolRunId: 't', result: 'late-original-result', isError: false }
        ]
      }
    ]
    const html = renderToStaticMarkup(
      createElement(TranscriptView, {
        agentKind: 'work',
        messages,
        pendingSteer: [],
        inflight: false,
        loadingSession: false,
        anchored: false,
        scrollRef: { current: null },
        contentRef: { current: null },
        onScroll: vi.fn()
      })
    )
    const $ = load(html)
    const block = $('[data-block-key="m-42:tool:t"]')
    const tool = $('[data-work-tool="t"]')
    expect(block).toHaveLength(1)
    expect($('[data-work-tool]')).toHaveLength(1)
    expect(tool.closest('[data-block-key]')[0]).toBe(block[0])
    expect(tool.attr('data-part-key')).toBe('m-42:tool:t')
    expect(tool.attr('data-tool-status')).toBe('completed')
  })
})

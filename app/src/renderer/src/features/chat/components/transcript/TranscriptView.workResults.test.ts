import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TranscriptView } from './TranscriptView'
import type { Message } from '../../reducer/chatReducer'
import type { WorkToolResults } from '../../lib/workToolResults'

vi.mock('../../hooks/useTranscriptVirtualizer', () => ({
  useTranscriptVirtualizer: () => ({
    getVirtualItems: () => [{ index: 0, start: 0 }],
    getTotalSize: () => 100,
    measureElement: vi.fn()
  })
}))
vi.mock('./MessageMeta', () => ({ MessageMeta: () => null }))
vi.mock('../../../../shared/ui/markdown/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => createElement('p', null, source)
}))
vi.mock('./WorkActivity', () => ({
  WorkActivity: ({
    messages,
    toolResults
  }: {
    messages: Message[]
    toolResults?: WorkToolResults
  }) =>
    createElement(
      'span',
      {
        'data-work-call': messages.some((message) =>
          message.parts.some((part) => part.type === 'tool_call')
        )
      },
      (toolResults?.get('t')?.output as string) ?? 'no-result'
    )
}))

describe('TranscriptView Work result consumer chain', () => {
  it('passes a late result across a user boundary into the original virtual head Exchange only', () => {
    const messages: Message[] = [
      { role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'first' }] },
      {
        role: 'assistant',
        createdAt: 2,
        parts: [{ type: 'tool_call', toolRunId: 't', toolName: 'Read', args: {} }]
      },
      { role: 'user', createdAt: 3, parts: [{ type: 'text', text: 'steered' }] },
      {
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
    expect(html).toContain('data-work-call="true">late-original-result')
    expect(html).toContain('data-work-call="false">no-result')
  })
})

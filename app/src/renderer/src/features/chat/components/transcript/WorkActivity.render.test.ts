import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AssistantTurn } from './AssistantTurn'
import { Exchange } from './Exchange'
import type { Turn } from '../../lib/turns'

vi.mock('../../../../shared/ui/markdown/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => createElement('p', null, source)
}))
vi.mock('./MessageMeta', () => ({ MessageMeta: () => null }))
const turn: Turn = {
  role: 'assistant',
  startIndex: 0,
  messages: [
    {
      role: 'assistant',
      createdAt: 1,
      parts: [
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'r' } },
        { type: 'text', text: 'introduction' },
        {
          type: 'tool_call',
          toolRunId: 't',
          toolName: 'Read',
          args: { file_path: 'C:/private-tool-body' }
        },
        { type: 'text', text: 'conclusion' },
        { type: 'response_boundary', boundary: { phase: 'end', id: 'r', outcome: 'ended' } }
      ]
    }
  ]
}
describe('actual Work transcript branch', () => {
  it('renders intro and conclusion while a closed activity does not mount tool bodies', () => {
    const html = renderToStaticMarkup(
      createElement(AssistantTurn, { turn, agentKind: 'work', pending: true })
    )
    expect(html).toContain('data-agent="work"')
    expect(html).toContain('introduction')
    expect(html).toContain('conclusion')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('도구 1종')
    expect(html).not.toContain('private-tool-body')
  })
  it('keeps Coding tool body and legacy Work transcript on the original renderer', () => {
    const coding = renderToStaticMarkup(
      createElement(AssistantTurn, { turn, agentKind: 'coding', pending: true })
    )
    expect(coding).not.toContain('data-agent="work"')
    expect(coding).toContain('private-tool-body')
    const legacy = {
      ...turn,
      messages: turn.messages.map((message) => ({
        ...message,
        parts: message.parts.filter((part) => part.type !== 'response_boundary')
      }))
    }
    expect(
      renderToStaticMarkup(
        createElement(AssistantTurn, { turn: legacy, agentKind: 'work', pending: true })
      )
    ).not.toContain('data-agent="work"')
  })
  it('passes mode through the actual Exchange consumer and observes mode in both memo comparators', () => {
    const exchange = { startIndex: 0, turns: [turn] }
    const html = renderToStaticMarkup(
      createElement(Exchange, { exchange, reserve: false, pending: false, agentKind: 'work' })
    )
    expect(html).toContain('data-agent="work"')
    const compareTurn = (
      AssistantTurn as unknown as { compare: (a: unknown, b: unknown) => boolean }
    ).compare
    expect(compareTurn({ turn, agentKind: 'coding' }, { turn, agentKind: 'work' })).toBe(false)
    const compareExchange = (
      Exchange as unknown as { compare: (a: unknown, b: unknown) => boolean }
    ).compare
    expect(
      compareExchange({ exchange, agentKind: 'coding' }, { exchange, agentKind: 'work' })
    ).toBe(false)
  })
})

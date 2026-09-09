import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AssistantTurn } from './AssistantTurn'
import { Exchange } from './Exchange'
import type { Turn } from '../../lib/turns'
import { agentUiPolicy } from '../../lib/agentPresentation'

const workTranscript = agentUiPolicy('work').transcript
const codeTranscript = agentUiPolicy('code').transcript

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
      createElement(AssistantTurn, { turn, transcriptPolicy: workTranscript, pending: true })
    )
    expect(html).toContain('data-agent="work"')
    expect(html).toContain('introduction')
    expect(html).toContain('conclusion')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('도구 1회 호출')
    expect(html).not.toContain('private-tool-body')
  })
  it('preserves Code while applying Work tool rows to legacy history without boundaries', () => {
    const code = renderToStaticMarkup(
      createElement(AssistantTurn, { turn, transcriptPolicy: codeTranscript, pending: true })
    )
    expect(code).not.toContain('data-agent="work"')
    expect(code).toContain('private-tool-body')
    const legacy = {
      ...turn,
      messages: turn.messages.map((message) => ({
        ...message,
        parts: message.parts.filter((part) => part.type !== 'response_boundary')
      }))
    }
    expect(
      renderToStaticMarkup(
        createElement(AssistantTurn, {
          turn: legacy,
          transcriptPolicy: workTranscript,
          pending: true
        })
      )
    ).toContain('data-work-tools="true"')
  })
  it('passes mode through the actual Exchange consumer and observes mode in both memo comparators', () => {
    const exchange = { startIndex: 0, turns: [turn] }
    const html = renderToStaticMarkup(
      createElement(Exchange, {
        exchange,
        reserve: false,
        pending: false,
        transcriptPolicy: workTranscript
      })
    )
    expect(html).toContain('data-agent="work"')
    const compareTurn = (
      AssistantTurn as unknown as { compare: (a: unknown, b: unknown) => boolean }
    ).compare
    expect(
      compareTurn(
        { turn, transcriptPolicy: codeTranscript },
        { turn, transcriptPolicy: workTranscript }
      )
    ).toBe(false)
    const compareExchange = (
      Exchange as unknown as { compare: (a: unknown, b: unknown) => boolean }
    ).compare
    expect(
      compareExchange(
        { exchange, transcriptPolicy: codeTranscript },
        { exchange, transcriptPolicy: workTranscript }
      )
    ).toBe(false)
  })
})

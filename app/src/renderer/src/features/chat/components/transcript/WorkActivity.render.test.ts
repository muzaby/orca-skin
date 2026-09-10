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
  it.each(['ended', 'unknown'] as const)(
    'does not expose the internal %s response boundary as a message label',
    (outcome) => {
      const boundaryTurn: Turn = {
        ...turn,
        messages: turn.messages.map((message) => ({
          ...message,
          parts: message.parts.map((part) =>
            part.type === 'response_boundary' && part.boundary.phase === 'end'
              ? { ...part, boundary: { ...part.boundary, outcome } }
              : part
          )
        }))
      }
      const html = renderToStaticMarkup(
        createElement(AssistantTurn, {
          turn: boundaryTurn,
          transcriptPolicy: workTranscript,
          pending: true
        })
      )
      expect(html).toContain('conclusion')
      expect(html).not.toContain('응답 수신 마감')
      expect(html).not.toContain('응답 미확정')
      expect(html).not.toContain(`data-response-outcome="${outcome}"`)
    }
  )
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
  it('renders intermediate text between closed tool groups without a note label', () => {
    const message = turn.messages[0]
    const withIntermediateText: Turn = {
      ...turn,
      messages: [
        {
          ...message,
          parts: [
            ...message.parts.slice(0, 3),
            { type: 'text', text: 'visible-intermediate-text' },
            {
              type: 'tool_call',
              toolRunId: 'second',
              toolName: 'Bash',
              args: { command: 'private-second-tool' }
            },
            ...message.parts.slice(3)
          ]
        }
      ]
    }
    const html = renderToStaticMarkup(
      createElement(AssistantTurn, {
        turn: withIntermediateText,
        transcriptPolicy: workTranscript,
        pending: true
      })
    )
    const firstGroup = html.indexOf('data-work-activity="true"')
    const secondGroup = html.indexOf('data-work-activity="true"', firstGroup + 1)
    expect(firstGroup).toBeGreaterThan(-1)
    expect(secondGroup).toBeGreaterThan(firstGroup)
    expect(html.indexOf('visible-intermediate-text')).toBeGreaterThan(firstGroup)
    expect(html.indexOf('visible-intermediate-text')).toBeLessThan(secondGroup)
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2)
    expect(html).not.toContain('메모')
    expect(html).not.toContain('private-tool-body')
    expect(html).not.toContain('private-second-tool')
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

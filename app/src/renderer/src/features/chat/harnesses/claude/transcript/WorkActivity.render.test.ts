import { createElement } from 'react'
import { renderWithTranscript as renderToStaticMarkup } from '../../registries/transcript.testfixture'
import { describe, expect, it, vi } from 'vitest'
import { AssistantTurn } from './AssistantTurn'
import { Exchange } from './Exchange'
import type { Turn } from '../../../lib/turns'
import { agentUiPolicy } from '../../../lib/agentPresentation'
import { ActivityDisclosure } from './WorkActivity'
import { ClaudeToolGroup } from './ToolGroup'
import { setDisclosure, setDisclosureActiveSession } from '../../../store/disclosureStore'

const workTranscript = agentUiPolicy('work').transcript
const codeTranscript = agentUiPolicy('code').transcript

vi.mock('../../../../../shared/ui/markdown/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => createElement('p', null, source)
}))
vi.mock('../../common/transcript/MessageMeta', () => ({ MessageMeta: () => null }))
const turn: Turn = {
  role: 'assistant',
  startIndex: 0,
  messages: [
    {
      id: 'm-20',
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
    expect(html).toContain('도구 1개 사용함')
    expect(html).not.toContain('private-tool-body')
  })
  it('counts intermediate notes inside one closed tool group while retaining the final answer', () => {
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
    expect(secondGroup).toBe(-1)
    expect(html).not.toContain('visible-intermediate-text')
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(1)
    expect(html).toContain('도구 2개 사용함 · 1 노트')
    expect(html).toContain('introduction')
    expect(html).toContain('conclusion')
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

// 0331 ΔV6 EP-10′ — 0324 이전 간격(D-033 · VP-54). 실제 거리는 `--layout` toolSpacing 이 본다.
describe('AC10″ tool spacing classes', () => {
  const read = { toolUseId: 'read', name: 'Read', input: { file_path: 'a.ts' } }
  const agent = { toolUseId: 'agent', name: 'Agent', input: { description: 'inspect' } }

  it('AC10″ work rows use py-2', () => {
    setDisclosureActiveSession('spacing')
    setDisclosure('spacing', 'activity:spacing', true)
    const html = renderToStaticMarkup(
      createElement(ActivityDisclosure, {
        node: {
          kind: 'activity',
          key: 'activity:spacing',
          items: [
            {
              kind: 'segment',
              key: 'k1',
              messageId: 'm',
              segment: { kind: 'tools', calls: [read] }
            },
            { kind: 'segment', key: 'k2', messageId: 'm', segment: { kind: 'text', text: 'note' } },
            {
              kind: 'segment',
              key: 'k3',
              messageId: 'm',
              segment: { kind: 'tools', calls: [agent] }
            }
          ],
          toolCount: 2,
          noteCount: 1
        },
        transcriptPolicy: workTranscript
      })
    )
    // 세 자리의 행 div — 일반 도구(data-work-tool) · 메모(data-work-note) · 에이전트(둘 다 없음).
    const rows = [...html.matchAll(/<div([^>]*)class="(relative py-\d pl-\[30px\])"([^>]*)>/g)].map(
      (match) => ({
        attrs: match[1] + match[3],
        cls: match[2]
      })
    )
    const site = (test: (attrs: string) => boolean): string[] =>
      rows.filter((row) => test(row.attrs)).map((row) => row.cls)
    expect(site((a) => a.includes('data-work-tool="read"'))).toEqual(['relative py-2 pl-[30px]'])
    expect(site((a) => a.includes('data-work-note="true"'))).toEqual(['relative py-2 pl-[30px]'])
    expect(site((a) => !a.includes('data-work-tool') && !a.includes('data-work-note'))).toEqual([
      'relative py-2 pl-[30px]'
    ])
    expect(html).not.toContain('relative py-1 pl-[30px]')
  })

  it('AC10″ group cards use the item gap', () => {
    const html = renderToStaticMarkup(
      createElement(ClaudeToolGroup, {
        calls: [read, { ...read, toolUseId: 'read-2' }],
        transcriptPolicy: codeTranscript
      })
    )
    expect(html).toContain('flex flex-col gap-[var(--chat-item-gap)] rounded-r6')
    expect(html).not.toContain('flex flex-col gap-g2 rounded-r6')
  })
})

import { createElement } from 'react'
import { renderWithTranscript as renderToStaticMarkup } from '../../registries/transcript.testfixture'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from 'cheerio'
import { WorkActivity } from './WorkActivity'
import { WorkToolRow } from './WorkToolTimeline'
import type { Message } from '../../../reducer/chatReducer'
import { agentUiPolicy } from '../../../lib/agentPresentation'

const transcriptPolicy = agentUiPolicy('work').transcript

// 기존 React fixture 방식: 실제 disclosure callback과 재렌더 산출을 관측한다.
// DOM focus/native 이벤트 dispatch 검증은 앱 브라우저 게이트가 담당한다.
const harness = vi.hoisted(() => ({
  open: false,
  calls: 0,
  toggle: undefined as undefined | (() => void)
}))
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>()
  return {
    ...actual,
    useState: (initial: unknown) => {
      if (typeof initial === 'boolean' && harness.calls++ === 0)
        return [
          harness.open,
          (next: boolean) => {
            harness.open = next
          }
        ]
      return actual.useState(initial)
    }
  }
})
vi.mock('react/jsx-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-runtime')>()
  const capture = (type: unknown, props: Record<string, unknown>): void => {
    if (type === 'button' && typeof props['aria-expanded'] === 'boolean' && !harness.toggle)
      harness.toggle = props.onClick as () => void
  }
  return {
    ...actual,
    jsx: (type: Parameters<typeof actual.jsx>[0], props: Record<string, unknown>, key?: string) => {
      capture(type, props)
      return actual.jsx(type, props, key)
    },
    jsxs: (
      type: Parameters<typeof actual.jsxs>[0],
      props: Record<string, unknown>,
      key?: string
    ) => {
      capture(type, props)
      return actual.jsxs(type, props, key)
    }
  }
})
vi.mock('react/jsx-dev-runtime', async (original) => {
  const actual = await original<typeof import('react/jsx-dev-runtime')>()
  return {
    ...actual,
    jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
      const [type, rawProps] = args
      const props = rawProps as Record<string, unknown>
      if (type === 'button' && typeof props['aria-expanded'] === 'boolean' && !harness.toggle)
        harness.toggle = props.onClick as () => void
      return actual.jsxDEV(...args)
    }
  }
})
vi.mock('../../../../../shared/ui/markdown/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => createElement('p', null, source)
}))
const messages: Message[] = [
  {
    id: 'm-74',
    role: 'assistant',
    createdAt: 1,
    parts: [
      { type: 'response_boundary', boundary: { phase: 'begin', id: 'r' } },
      {
        type: 'tool_call',
        toolRunId: 'a',
        toolName: 'Read',
        args: { file_path: 'C:/activity-first' }
      },
      { type: 'text', text: 'middle-note' },
      {
        type: 'tool_call',
        toolRunId: 'b',
        toolName: 'Read',
        args: { file_path: 'C:/activity-second' }
      },
      { type: 'text', text: 'final-answer' },
      { type: 'response_boundary', boundary: { phase: 'end', id: 'r', outcome: 'ended' } }
    ]
  }
]
function render(): string {
  harness.calls = 0
  harness.toggle = undefined
  return renderToStaticMarkup(createElement(WorkActivity, { messages, transcriptPolicy }))
}
describe('Work activity disclosure lifecycle', () => {
  beforeEach(() => {
    harness.open = false
  })
  it('opens notes and their surrounding tools together in one ordered timeline', () => {
    const closed = render()
    expect(closed).not.toContain('middle-note')
    expect(closed).toContain('final-answer')
    expect(closed).toContain('1 노트')
    expect(closed).not.toContain('activity-first')
    expect(closed).not.toContain('activity-second')
    harness.toggle!()
    const opened = render()
    expect(opened).toContain('aria-expanded="true"')
    expect(opened.indexOf('activity-first')).toBeLessThan(opened.indexOf('middle-note'))
    expect(opened.indexOf('middle-note')).toBeLessThan(opened.indexOf('activity-second'))
    expect(opened.indexOf('activity-second')).toBeLessThan(opened.indexOf('final-answer'))
    expect(opened).toContain('data-work-note="true"')
    const $ = load(opened)
    const group = $('[data-work-activity]')
    expect(group).toHaveLength(1)
    expect(group.find('[data-work-note]')).toHaveLength(1)
    expect(
      group
        .find('[data-work-tools], [data-work-note]')
        .map((_, node) => ($(node).attr('data-work-note') ? 'note' : 'tools'))
        .get()
    ).toEqual(['tools', 'note', 'tools'])
    harness.toggle!()
    const collapsed = render()
    expect(collapsed).not.toContain('activity-first')
    expect(collapsed).not.toContain('activity-second')
    expect(collapsed).not.toContain('middle-note')
    expect(collapsed).toContain('final-answer')
  })
  it('opens a tool through its actual row callback and hides its request and response when closed', () => {
    const renderTool = (): string => {
      harness.calls = 0
      harness.toggle = undefined
      return renderToStaticMarkup(
        createElement(WorkToolRow, {
          call: {
            toolUseId: 'command-1',
            name: 'Bash',
            input: { description: '검증 명령', command: 'npm run check-exact-command' },
            result: { output: 'exact-result-line', isError: false }
          }
        })
      )
    }
    const closed = renderTool()
    expect(closed).toContain('검증 명령')
    expect(closed).not.toContain('check-exact-command')
    expect(closed).not.toContain('exact-result-line')
    harness.toggle!()
    const opened = renderTool()
    expect(opened).toContain('aria-expanded="true"')
    expect(opened).toContain('check-exact-command')
    expect(opened).toContain('exact-result-line')
    harness.toggle!()
    expect(renderTool()).not.toContain('exact-result-line')
  })
})

// 0331 AC2″ (ΔV7) — 메모 점은 보이는 메모 글이 있을 때만 있다.
describe('Work notes without visible text (0331 D-034)', () => {
  let sequence = 0
  const noteMessages = (note: string, final = 'final-answer'): Message[] => [
    {
      id: 'm-notes-' + ++sequence,
      role: 'assistant',
      createdAt: 1,
      parts: [
        { type: 'response_boundary', boundary: { phase: 'begin', id: 'r' } },
        { type: 'tool_call', toolRunId: 'a', toolName: 'Bash', args: { command: 'echo a' } },
        { type: 'text', text: note },
        { type: 'tool_call', toolRunId: 'b', toolName: 'Bash', args: { command: 'echo b' } },
        { type: 'text', text: final },
        { type: 'response_boundary', boundary: { phase: 'end', id: 'r', outcome: 'ended' } }
      ]
    }
  ]
  // 실제 disclosure 토글 콜백으로 펼친다 — 메시지 ID가 테스트마다 달라 store 상태가 섞이지 않는다.
  const renderOpen = (input: Message[]): ReturnType<typeof load> => {
    const once = (): string => {
      harness.calls = 0
      harness.toggle = undefined
      return renderToStaticMarkup(
        createElement(WorkActivity, { messages: input, transcriptPolicy })
      )
    }
    expect(once()).toContain('aria-expanded="false"')
    harness.toggle!()
    const opened = once()
    expect(opened).toContain('aria-expanded="true"')
    return load(opened)
  }
  it.each([
    '[ref]: https://example.com',
    '\u200b',
    '\u2060\ufeff',
    '\u00ad',
    '&nbsp;',
    '&#160; &#xA0;',
    '&ZeroWidthSpace;'
  ])('AC2″ renders no note dot for invisible text %j', (note) => {
    const $ = renderOpen(noteMessages(note))
    expect($('[data-work-tools]').length).toBeGreaterThan(0)
    expect($('[data-work-note]')).toHaveLength(0)
  })
  it('AC2″ keeps the dot for a visible note', () => {
    expect(renderOpen(noteMessages('visible note'))('[data-work-note]')).toHaveLength(1)
  })
  it.each([
    ['a parsed block', 'Long note paragraph. '.repeat(250)],
    ['the layout', 'Long note paragraph. '.repeat(3200)]
  ])("AC2″ shows a long note's source while the worker is pending %s", (_, note) => {
    const $ = renderOpen(noteMessages(note))
    const row = $('[data-work-note]')
    expect(row).toHaveLength(1)
    expect(row.find('[data-md-block-pending]').first().text()).toContain('Long note paragraph.')
  })
  it.each([
    ['a parsed block', 'Long final answer. '.repeat(300)],
    ['the layout', 'Long final answer. '.repeat(3500)]
  ])(
    'D-034 keeps the empty pending state for a long transcript body waiting for %s',
    (_, final) => {
      const $ = renderOpen(noteMessages('visible note', final))
      expect($.root().text()).not.toContain('Long final answer.')
      expect($('[data-md-block-pending]').length).toBeGreaterThan(0)
    }
  )
})

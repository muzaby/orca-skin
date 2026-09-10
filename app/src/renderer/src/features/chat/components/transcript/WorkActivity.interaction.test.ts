import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkActivity } from './WorkActivity'
import { WorkToolRow } from './WorkToolTimeline'
import type { Message } from '../../reducer/chatReducer'
import { agentUiPolicy } from '../../lib/agentPresentation'

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
vi.mock('../../../../shared/ui/markdown/Markdown', () => ({
  Markdown: ({ source }: { source: string }) => createElement('p', null, source)
}))
const messages: Message[] = [
  {
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
  it('keeps intermediate text visible while its surrounding tool groups open independently', () => {
    const closed = render()
    expect(closed).toContain('middle-note')
    expect(closed).not.toContain('activity-first')
    expect(closed).not.toContain('activity-second')
    harness.toggle!()
    const opened = render()
    expect(opened).toContain('aria-expanded="true"')
    expect(opened.indexOf('activity-first')).toBeLessThan(opened.indexOf('middle-note'))
    expect(opened.indexOf('middle-note')).toBeLessThan(opened.indexOf('final-answer'))
    expect(opened).not.toContain('activity-second')
    harness.toggle!()
    const collapsed = render()
    expect(collapsed).not.toContain('activity-first')
    expect(collapsed).not.toContain('activity-second')
    expect(collapsed).toContain('middle-note')
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

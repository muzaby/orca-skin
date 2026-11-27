import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { installFakeDom } from '../../../../shared/ui/renderHarness.testfixture'
import { HistoryEdge } from './HistoryEdge'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('../../../../shared/ui/renderHarness.testfixture')).fakeHooks
}))
vi.mock('../../../../shared/i18n', () => ({ useI18n: () => ({ tr: (key: string) => key }) }))

it('shows the pull indicator and disables only a pending return-to-latest button', () => {
  vi.useFakeTimers()
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const returnToLatest = vi.fn()
  try {
    for (const latestState of [undefined, 'loading', 'error'] as const) {
      dom.render(
        createElement(HistoryEdge, {
          direction: 'after',
          pulling: true,
          history: {
            before: 'ready',
            after: 'loading',
            latestState,
            returnToLatest,
            request: vi.fn()
          }
        })
      )
      const edge = dom.query('[data-history-edge="after"]')!
      expect(edge.getAttribute('data-history-state')).toBe('pull')
      const button = edge.children.at(-1)!
      expect(button.props.disabled).toBe(latestState === 'loading')
      expect(button.textContent).toBe(
        latestState === 'error'
          ? 'chat.transcript.historyRetryLatest'
          : 'chat.transcript.historyLatest'
      )
      if (latestState !== 'loading') dom.click(button)
    }
    expect(returnToLatest).toHaveBeenCalledTimes(2)
  } finally {
    dom.unmount()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})

it('AC4 four states have one height and only failure offers retry', () => {
  vi.useFakeTimers()
  const dom = installFakeDom({ innerWidth: 800, innerHeight: 600 })
  const request = vi.fn()
  const heights = new Set()
  try {
    for (const before of ['ready', 'end', 'loading', 'error'] as const) {
      for (const pulling of [false, true]) {
        dom.render(
          createElement(HistoryEdge, { direction: 'before', pulling, history: { before, request } })
        )
        const edge = dom.query('[data-history-edge="before"]')!
        heights.add(edge.props.className)
        expect(edge.textContent).toBe(before === 'error' ? 'chat.transcript.historyRetry' : '')
        const button = dom.query('[type="button"]')
        expect(Boolean(button)).toBe(before === 'error')
        if (button) dom.click(button)
        expect(Boolean(dom.query('[role="status"]'))).toBe(before === 'loading' && !pulling)
      }
    }
    expect(heights.size).toBe(1)
    expect(request.mock.calls).toEqual([['before'], ['before']])
  } finally {
    dom.unmount()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})

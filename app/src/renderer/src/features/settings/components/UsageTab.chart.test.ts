import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { expect, it, vi } from 'vitest'
import { UsageTab } from './UsageTab'
vi.mock('../hooks/useUsageStats', () => ({
  useUsageStats: () => ({
    loading: false,
    stats: {
      since: null,
      updatedAt: Date.UTC(2026, 0, 2),
      days: [
        {
          day: '2026-01-02',
          inputTokens: 10,
          outputTokens: 4,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          totalCostUsd: 0.1
        }
      ],
      models: []
    }
  })
}))
it('reserves the original chart height while loading, then renders the same accessible chart', async () => {
  const render = (): ReturnType<typeof load> => load(renderToStaticMarkup(createElement(UsageTab)))
  const first = render()
  expect(first('[aria-busy="true"]').hasClass('h-[180px]')).toBe(true)
  await vi.waitFor(() => expect(render()('[role="img"]')).toHaveLength(1))
  expect(render()('[role="img"]').hasClass('h-[180px]')).toBe(true)
})

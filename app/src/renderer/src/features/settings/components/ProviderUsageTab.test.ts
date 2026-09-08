import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AgentEnvironment } from '../../../../../shared/ipc'

// 실제 component의 상태와 callback을 구동한다. 브라우저 스케줄러 실증은 아니다.
const fixture = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0 }))
const sync = vi.hoisted(() => vi.fn())
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = fixture.cursor++
      if (!(index in fixture.values)) fixture.values[index] = initial
      return [
        fixture.values[index],
        (next: unknown) => {
          fixture.values[index] = next
        }
      ]
    },
    useCallback: (callback: unknown) => callback,
    useEffect: () => undefined
  }
})
vi.mock('../../../shared/i18n', () => ({
  useI18n: () => ({ tr: (key: string) => key, locale: 'ko' }),
  formatRelativeTime: (value: number) => `at-${value}`
}))
vi.mock('../../../shared/stores/usageStore', () => ({
  useProviderUsage: () => null,
  useProviderUsageUpdatedAt: () => 123,
  ensureProviderUsage: vi.fn(),
  setProviderLimit: vi.fn(),
  syncProviderUsage: sync
}))

import { ProviderUsageTab } from './ProviderUsageTab'

const provider = { key: 'claude-test', provider: 'test' } as AgentEnvironment
function draw(): ReactElement {
  fixture.cursor = 0
  return ProviderUsageTab({ provider })
}
function refreshCallback(node: unknown): (() => void) | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = refreshCallback(child)
      if (found) return found
    }
  }
  if (!isValidElement(node)) return undefined
  const { onRefresh, children } = (
    node as ReactElement<{
      onRefresh?: () => void
      children?: unknown
    }>
  ).props
  return onRefresh ?? refreshCallback(children)
}

beforeEach(() => {
  fixture.values = []
  fixture.cursor = 0
  sync.mockReset()
})

describe('provider usage refresh UI', () => {
  it('refreshes the selected provider and preserves timestamp while disabled and spinning', async () => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    sync.mockReturnValue(pending)
    const view = draw()
    expect(renderToStaticMarkup(view)).toContain('at-123')
    const click = refreshCallback(view)
    expect(click).toBeTypeOf('function')
    click!()
    expect(sync).toHaveBeenCalledWith('claude-test')
    const waiting = renderToStaticMarkup(draw())
    expect(waiting).toContain('disabled=""')
    expect(waiting).toContain('animate-spin')
    expect(waiting).toContain('at-123')
    finish()
    await pending
    const settled = renderToStaticMarkup(draw())
    expect(settled).not.toContain('disabled=""')
    expect(settled).not.toContain('animate-spin')
    expect(settled).not.toContain('usage.refreshFailed')
  })

  it('shows failure without losing the timestamp and clears the error when retry starts', async () => {
    let reject!: (error: Error) => void
    const pending = new Promise<void>((_resolve, fail) => {
      reject = fail
    })
    sync.mockReturnValue(pending)
    refreshCallback(draw())!()
    reject(new Error('refresh unavailable'))
    await pending.catch(() => undefined)
    const failed = draw()
    expect(renderToStaticMarkup(failed)).toContain('usage.refreshFailed')
    expect(renderToStaticMarkup(failed)).toContain('at-123')
    expect(renderToStaticMarkup(failed)).not.toContain('animate-spin')
    sync.mockResolvedValue(undefined)
    refreshCallback(failed)!()
    expect(renderToStaticMarkup(draw())).not.toContain('usage.refreshFailed')
    await Promise.resolve()
  })
})

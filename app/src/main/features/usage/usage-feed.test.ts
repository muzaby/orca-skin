import { describe, expect, it, vi } from 'vitest'
import { UsageFeed } from './usage-feed'
import type { UsageSample } from '../../contracts/usage-source'

function sample(overrides: Partial<UsageSample> = {}): UsageSample {
  return {
    sourceId: 'usage-corp',
    operation: 'quota',
    fetchedAt: 100,
    payload: { used: 1 },
    ...overrides
  }
}

describe('UsageFeed', () => {
  it('selector 가 일치하는 구독자 전부에 전달한다', () => {
    const feed = new UsageFeed()
    const bySource = vi.fn()
    const byOperation = vi.fn()
    const wildcard = vi.fn()
    const otherSource = vi.fn()
    const otherOperation = vi.fn()

    feed.subscribe({ sourceId: 'usage-corp' }, bySource)
    feed.subscribe({ operation: 'quota' }, byOperation)
    feed.subscribe({}, wildcard)
    feed.subscribe({ sourceId: 'usage-lab' }, otherSource)
    feed.subscribe({ sourceId: 'usage-corp', operation: 'detail' }, otherOperation)

    const delivered = feed.publish(sample())

    expect(delivered).toBe(3)
    expect(bySource).toHaveBeenCalledWith(sample())
    expect(byOperation).toHaveBeenCalledWith(sample())
    expect(wildcard).toHaveBeenCalledWith(sample())
    expect(otherSource).not.toHaveBeenCalled()
    expect(otherOperation).not.toHaveBeenCalled()
  })

  it('구독자 예외가 다른 구독자 전달을 막지 않는다', () => {
    const onError = vi.fn()
    const feed = new UsageFeed(onError)
    const survivor = vi.fn()

    feed.subscribe({}, () => {
      throw new Error('map exploded')
    })
    feed.subscribe({}, survivor)

    const delivered = feed.publish(sample())

    expect(delivered).toBe(2)
    expect(survivor).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      'usage sample listener threw',
      expect.objectContaining({ sourceId: 'usage-corp', operation: 'quota' })
    )
  })

  it('해지한 구독자는 이후 표본을 받지 않는다', () => {
    const feed = new UsageFeed()
    const listener = vi.fn()
    const unsubscribe = feed.subscribe({}, listener)

    feed.publish(sample())
    unsubscribe()
    feed.publish(sample({ fetchedAt: 200 }))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(feed.size).toBe(0)
  })
})

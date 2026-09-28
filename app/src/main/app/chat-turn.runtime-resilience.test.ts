import { describe, expect, it, vi } from 'vitest'
import { abortableDelay, RETRY_BACKOFF_MS } from '../features/chat/turn-coordinator'

describe('send runtime resilience helpers', () => {
  it('abortableDelay 는 retry backoff 중 abort 를 존중한다', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const pending = abortableDelay(RETRY_BACKOFF_MS[0], controller.signal)

    controller.abort()
    await expect(pending).rejects.toThrow('Aborted')
    vi.useRealTimers()
  })
})

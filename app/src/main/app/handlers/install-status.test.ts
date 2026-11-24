import { describe, expect, it, vi } from 'vitest'
import type { InstallStatus } from '../../../shared/ipc'
import { ClaudeAdapter } from '../../adapters/claude/adapter'
import { forwardInstallStatus } from './install-status'

async function* statuses(...records: InstallStatus[]): AsyncGenerator<InstallStatus> {
  await Promise.resolve()
  yield* records
}

describe('installation status forwarding', () => {
  it('forwards one terminal event and zero log batches from the Claude installer', async () => {
    const sent: InstallStatus[] = []
    await forwardInstallStatus(new ClaudeAdapter().install(), (item) => sent.push(item))
    expect(sent).toEqual([{ step: 'complete', done: true }])
  })

  it('keeps exact output across chunk boundaries and flushes it before terminal', async () => {
    const long = 'a'.repeat(16 * 1024 - 2) + '🐬' + '끝'.repeat(22_000)
    const sent: InstallStatus[] = []
    await forwardInstallStatus(
      statuses(
        { step: 'installing', progress: 0.3, log: 'a' },
        { step: 'installing', progress: 0.3, log: 'bc\n' },
        { step: 'installing', progress: 0.5, log: long },
        { step: 'failed', log: 'last', error: 'failed', done: true }
      ),
      (item) => sent.push(item)
    )
    expect(sent[0]).toEqual({ step: 'installing', progress: 0.3, log: 'abc\n' })
    expect(
      sent
        .slice(0, -1)
        .map((item) => item.log)
        .join('')
    ).toBe('abc\n' + long + 'last')
    expect(sent.every((item) => Buffer.byteLength(item.log ?? '') <= 16 * 1024)).toBe(true)
    expect(sent.at(-1)).toEqual({ step: 'failed', error: 'failed', done: true })
  })

  it('delivers a partial batch while the producer waits', async () => {
    vi.useFakeTimers()
    let resume!: () => void
    const gate = new Promise<void>((resolve) => {
      resume = resolve
    })
    async function* installing(): AsyncGenerator<InstallStatus> {
      yield { step: 'installing', log: 'pending' }
      await gate
      yield { step: 'complete', done: true }
    }
    try {
      const send = vi.fn()
      const running = forwardInstallStatus(installing(), send)
      await vi.advanceTimersByTimeAsync(15)
      expect(send).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(send).toHaveBeenCalledExactlyOnceWith({
        step: 'installing',
        log: 'pending',
        progress: undefined
      })
      resume()
      await running
      expect(send).toHaveBeenLastCalledWith({ step: 'complete', done: true })
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

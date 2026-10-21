import { expect, it, vi } from 'vitest'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { OpenCodeComposerCache } from './composer-cache'

it('allows native cold initialization, isolates caller cancellation and retains data after warm timeout', async () => {
  const budgets: { ms: number; controller: AbortController }[] = []
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController()
    budgets.push({ ms, controller })
    return controller.signal
  })
  const requests: {
    signal: AbortSignal
    resolve: (value: { data: { name: string }[] }) => void
  }[] = []
  const agents = vi.fn(
    (_params: unknown, options: { signal: AbortSignal }) =>
      new Promise<{ data: { name: string }[] }>((resolve, reject) => {
        requests.push({ signal: options.signal, resolve })
        options.signal.addEventListener('abort', () => reject(options.signal.reason), {
          once: true
        })
      })
  )
  const scope = new AbortController()
  const cache = new OpenCodeComposerCache(
    { app: { agents } } as unknown as OpencodeClient,
    'C:/project',
    scope.signal
  )
  try {
    const caller = new AbortController()
    const first = cache.agents(caller.signal)
    const firstFailure = expect(first).rejects.toThrow('caller closed')
    const shared = cache.agents(new AbortController().signal)
    expect(budgets.map((item) => item.ms)).toEqual([120000])
    expect(agents).toHaveBeenCalledOnce()
    caller.abort(new Error('caller closed'))
    await firstFailure
    expect(requests[0].signal.aborted).toBe(false)
    requests[0].resolve({ data: [{ name: 'Atlas' }] })
    await expect(shared).resolves.toEqual([{ name: 'Atlas' }])
    const warm = cache.agents(new AbortController().signal, true)
    const warmFailure = expect(warm).rejects.toThrow('warm timeout')
    expect(budgets.map((item) => item.ms)).toEqual([120000, 15000])
    budgets[1].controller.abort(new Error('warm timeout'))
    await warmFailure
    await expect(cache.agents(new AbortController().signal)).resolves.toEqual([{ name: 'Atlas' }])
    const retry = cache.agents(new AbortController().signal, true)
    const scopeFailure = expect(retry).rejects.toThrow('native disposed')
    scope.abort(new Error('native disposed'))
    await scopeFailure
    expect(requests[2].signal.aborted).toBe(true)
  } finally {
    timeout.mockRestore()
  }
})

import { afterEach, expect, it, vi } from 'vitest'
import { OpenCodeMcpReconcile } from './mcp-reconcile'
import type { SessionAdapter } from '../../../adapters/common/types'
import type { GovernedLiveTurn } from '../../../contracts/ports'
import type { ChatActivitySnapshot } from '../../../../shared/ipc'
afterEach(() => vi.useRealTimers())
it('has no timer until dirty and stops retrying once idle peers are reconciled', async () => {
  vi.useFakeTimers()
  const runtime = { responding: true }
  const activity = {
    foreground: 'idle',
    queuedCount: 0,
    deliveryPendingCount: 0,
    residualCount: 0,
    backgroundTaskCount: 0,
    pendingSessionWakeup: false
  } as ChatActivitySnapshot
  const reconcile = vi.fn(async () => {}),
    changed = vi.fn(async () => {})
  const service = new OpenCodeMcpReconcile({
    adapter: { reconcileConnections: reconcile } as unknown as SessionAdapter,
    peers: () => [{ cwd: '/w', runtime: runtime as GovernedLiveTurn, activity }],
    changed
  })
  expect(vi.getTimerCount()).toBe(0)
  service.changed()
  for (let i = 0; i < 10; i++) await Promise.resolve()
  expect(vi.getTimerCount()).toBe(1)
  runtime.responding = false
  await vi.advanceTimersByTimeAsync(500)
  expect(reconcile).toHaveBeenCalledTimes(2)
  expect(changed).toHaveBeenCalledTimes(2)
  expect(vi.getTimerCount()).toBe(0)
  service.close()
})

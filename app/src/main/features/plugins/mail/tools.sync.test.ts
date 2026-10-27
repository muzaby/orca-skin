import { expect, it, vi } from 'vitest'
import type { PluginAuth } from '../../../contracts/auth'
const boundary = vi.hoisted(() => ({
  signals: [] as AbortSignal[],
  complete: undefined as undefined | (() => void),
  close: vi.fn()
}))
vi.mock('../../../infra/config/user-data-path', () => ({ userDataPath: async () => 'unused' }))
vi.mock('./sync-manager', () => ({
  createMailSyncManager: async () => ({
    sync: (signal: AbortSignal) =>
      new Promise((resolve, reject) => {
        boundary.signals.push(signal)
        boundary.complete = () => resolve({ synced: true, fresh: false, lastSyncAt: 42 })
        signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
      }),
    close: boundary.close
  })
}))
import { mailTools } from './tools'

it('keeps another MCP caller alive when one shared sync caller is cancelled', async () => {
  const server = mailTools({ authId: 'mail', origin: 'pop3://mail.test:110' } as PluginAuth, {
    accountId: 'test'
  })
  const handler = server.implementations.find((tool) => tool.name === 'mail_sync')!.handler
  const a = new AbortController(),
    b = new AbortController()
  const first = handler({}, { scope: 'application', getSignal: () => a.signal })
  const second = handler({}, { scope: 'application', getSignal: () => b.signal })
  await vi.waitFor(() => expect(boundary.signals).toHaveLength(1))
  a.abort()
  expect((await first).isError).toBe(true)
  expect(boundary.signals[0].aborted).toBe(false)
  boundary.complete!()
  expect((await second).isError).not.toBe(true)
  expect(boundary.close).toHaveBeenCalledTimes(1)
  const c = new AbortController()
  const last = handler({}, { scope: 'application', getSignal: () => c.signal })
  await vi.waitFor(() => expect(boundary.signals).toHaveLength(2))
  c.abort()
  expect((await last).isError).toBe(true)
  expect(boundary.signals[1].aborted).toBe(true)
})

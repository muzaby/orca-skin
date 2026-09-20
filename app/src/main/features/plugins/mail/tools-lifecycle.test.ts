import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PluginAuth } from '../../../contracts/auth'
import { createMailSyncManager } from './sync-manager'
import { mailTools } from './tools'

vi.mock('./sync-manager', () => ({ createMailSyncManager: vi.fn() }))
vi.mock('../../../infra/config/user-data-path', () => ({ userDataPath: async () => '/user-data' }))

const auth: PluginAuth = {
  authId: 'mail',
  label: 'Mail',
  origin: 'pop3s://mail.test:995',
  snapshot: vi.fn(),
  request: vi.fn(),
  withCredential: vi.fn()
}
const options = { accountId: 'account', host: 'mail.test' }

describe('mail tool resource lifetime', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shares concurrent sync, closes once, and creates a fresh manager next time', async () => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    const manager = {
      sync: vi.fn(async () => {
        await pending
        return { synced: false, fresh: true, lastSyncAt: 1 }
      }),
      close: vi.fn()
    }
    vi.mocked(createMailSyncManager).mockResolvedValue(
      manager as unknown as Awaited<ReturnType<typeof createMailSyncManager>>
    )
    const tool = mailTools(auth, options).implementations[0]
    const calls = [tool.handler({}), tool.handler({}), tool.handler({})]
    finish()
    await Promise.all(calls)
    expect(createMailSyncManager).toHaveBeenCalledTimes(1)
    expect(manager.sync).toHaveBeenCalledTimes(1)
    expect(manager.close).toHaveBeenCalledTimes(1)
    await tool.handler({})
    expect(createMailSyncManager).toHaveBeenCalledTimes(2)
    expect(manager.close).toHaveBeenCalledTimes(2)
  })

  it('initialization failure is retried; operation failure still closes', async () => {
    const manager = { sync: vi.fn().mockRejectedValue(new Error('private-path')), close: vi.fn() }
    vi.mocked(createMailSyncManager)
      .mockRejectedValueOnce(new Error('private-path'))
      .mockResolvedValue(manager as unknown as Awaited<ReturnType<typeof createMailSyncManager>>)
    const tool = mailTools(auth, options).implementations[0]
    expect(await tool.handler({})).toMatchObject({ isError: true })
    const failure = await tool.handler({})
    expect(failure).toMatchObject({ isError: true })
    expect(JSON.stringify(failure)).not.toContain('private-path')
    expect(createMailSyncManager).toHaveBeenCalledTimes(2)
    expect(manager.close).toHaveBeenCalledTimes(1)
  })

  it('search never synchronizes and closes after reading', async () => {
    const manager = {
      search: vi.fn(() => ({ total: 0, results: [], stale: true, cacheAsOf: null })),
      sync: vi.fn(),
      close: vi.fn()
    }
    vi.mocked(createMailSyncManager).mockResolvedValue(
      manager as unknown as Awaited<ReturnType<typeof createMailSyncManager>>
    )
    await mailTools(auth, options).implementations[1].handler({ query: '회의' })
    expect(manager.search).toHaveBeenCalledWith('회의', 20)
    expect(manager.sync).not.toHaveBeenCalled()
    expect(manager.close).toHaveBeenCalledOnce()
  })
})

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
const options = { accountId: 'account' }

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

it.each([
  ['incremental', 'incremental', 1],
  ['full', 'incremental', 1],
  ['full', 'full', 1],
  ['incremental', 'full', 2]
] as const)('orders a running %s and requested %s flight', async (running, requested, count) => {
  vi.clearAllMocks()
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const modes: unknown[] = []
  const manager = {
    sync: vi.fn(async (_signal, _stage, mode) => {
      modes.push(mode)
      if (modes.length === 1) await pending
      return { synced: true, mode, newMails: 1, updatedMails: 3 }
    }),
    close: vi.fn()
  }
  vi.mocked(createMailSyncManager).mockResolvedValue(
    manager as unknown as Awaited<ReturnType<typeof createMailSyncManager>>
  )
  const tool = mailTools(auth, options).implementations[0]
  const first = tool.handler({ mode: running })
  await vi.waitFor(() => expect(modes).toEqual([running]))
  const second = tool.handler({ mode: requested })
  const third = tool.handler({ mode: requested })
  expect(modes).toEqual([running])
  finish()
  const results = await Promise.all([first, second, third])
  expect(modes).toEqual(count === 1 ? [running] : [running, requested])
  expect(results.map((r) => r.structuredContent?.mode)).toEqual([
    running,
    count === 1 ? running : requested,
    count === 1 ? running : requested
  ])
  expect(manager.close).toHaveBeenCalledTimes(count)
})

it('normalizes direct invalid sync modes to incremental', async () => {
  const manager = {
    sync: vi.fn(async () => ({ synced: false, fresh: true, lastSyncAt: null })),
    close: vi.fn()
  }
  vi.mocked(createMailSyncManager).mockResolvedValue(
    manager as unknown as Awaited<ReturnType<typeof createMailSyncManager>>
  )
  const tool = mailTools(auth, options).implementations[0]
  for (const mode of ['all', '', 1]) await tool.handler({ mode })
  expect(manager.sync.mock.calls).toEqual(
    Array.from({ length: 3 }, () => [expect.any(AbortSignal), undefined, 'incremental'])
  )
})

it('normalizes get inputs, closes local readers, and hides failures', async () => {
  const manager = { getMail: vi.fn(() => ({ text: 'page' })), sync: vi.fn(), close: vi.fn() }
  vi.mocked(createMailSyncManager).mockResolvedValue(
    manager as unknown as Awaited<ReturnType<typeof createMailSyncManager>>
  )
  const tool = mailTools(auth, options).implementations[3]
  await tool.handler({ mailId: '7', offset: '5', maxChars: '8' })
  expect(manager.getMail).toHaveBeenLastCalledWith('7', undefined, undefined)
  await tool.handler({ mailId: '7', offset: 37, maxChars: 113 })
  expect(manager.getMail).toHaveBeenLastCalledWith('7', 37, 113)
  expect(manager.sync).not.toHaveBeenCalled()
  expect(manager.close).toHaveBeenCalledTimes(2)
  manager.getMail.mockImplementation(() => {
    throw new Error('/private/user-data')
  })
  const failure = await tool.handler({ mailId: '7' })
  expect(failure.isError).toBe(true)
  expect(JSON.stringify(failure)).not.toContain('/private/user-data')
  expect(manager.close).toHaveBeenCalledTimes(3)
})

it.each([false, true])(
  'retries a queued full after failure and honors cancelled waiters (%s)',
  async (cancelled) => {
    vi.clearAllMocks()
    let fail!: (error: Error) => void
    const pending = new Promise<never>((_resolve, reject) => {
      fail = reject
    })
    const manager = {
      sync: vi.fn().mockResolvedValue({ synced: true, mode: 'full' }),
      close: vi.fn()
    }
    manager.sync.mockImplementationOnce(() => pending)
    vi.mocked(createMailSyncManager).mockResolvedValue(
      manager as unknown as Awaited<ReturnType<typeof createMailSyncManager>>
    )
    const tool = mailTools(auth, options).implementations[0]
    const first = tool.handler({})
    await vi.waitFor(() => expect(manager.sync).toHaveBeenCalledOnce())
    const controller = new AbortController()
    const second = tool.handler(
      { mode: 'full' },
      { scope: 'application', getSignal: () => controller.signal }
    )
    if (cancelled) controller.abort()
    fail(new Error('first failed'))
    expect((await first).isError).toBe(true)
    const response = await second
    if (cancelled) {
      expect(response).toMatchObject({ isError: true, structuredContent: { error: 'cancelled' } })
      expect(manager.sync).toHaveBeenCalledTimes(1)
    } else {
      expect(response.structuredContent).toMatchObject({ mode: 'full' })
      expect(manager.sync).toHaveBeenLastCalledWith(expect.any(AbortSignal), undefined, 'full')
      expect(manager.sync).toHaveBeenCalledTimes(2)
    }
  }
)

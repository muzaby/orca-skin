import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { RuntimeToolRegistry } from '../features/extensions/runtime-tool-registry'
import { createMailArchiveToolServer } from '../features/plugins/mail-archive/plugin'
import type { MailArchivePlugin } from '../features/plugins/mail-archive/plugin'
import { ARCHIVE_MCP_SERVER_ID } from '../../shared/mail-archive-plugin'

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  workers: vi.fn(),
  service: vi.fn(),
  close: vi.fn(),
  rpc: vi.fn().mockResolvedValue(null)
}))
vi.mock('electron', () => ({
  app: { getVersion: () => 'test', getPath: () => 'C:/user-data' },
  shell: {},
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {},
  net: {},
  session: {},
  safeStorage: {}
}))
vi.mock('../infra/settings-store', () => ({ SettingsStore: class {} }))
vi.mock('../features/plugins/mail-archive/service', () => ({
  createMailArchiveService: mocks.service
}))
vi.mock('../features/plugins/mail-archive/worker-host', () => ({
  createMailArchiveWorkerFactory: mocks.workers
}))
vi.mock('./handlers/mail-archive', () => ({ registerMailArchiveHandlers: vi.fn() }))
vi.mock('./handlers/mail-archive-plugin', () => ({
  registerMailArchivePluginHandlers: mocks.register
}))
import { Bootstrap } from './bootstrap'

it('installs one backend and trusted handlers without registering tools or modifying the deployment contract', async () => {
  const registry = new RuntimeToolRegistry()
  mocks.service.mockReturnValue({
    pluginRequest: mocks.rpc,
    stats: async () => ({ totalMessages: 0 }),
    close: mocks.close
  })
  const bootstrap = Object.create(Bootstrap.prototype) as {
    registerMailArchive(ctx: unknown): void
    shutdown(): void
    isTrustedArtifactSender: () => boolean
  }
  bootstrap.isTrustedArtifactSender = () => true
  const db = {
    getSessionById: vi.fn(() => ({ id: 'saved' })),
    listSessions: vi.fn(() => [{ id: 'saved' }])
  }
  bootstrap.registerMailArchive({ db, runtimeTools: registry })
  const plugin = mocks.register.mock.calls[0][0] as MailArchivePlugin
  try {
    await plugin.ready()
    expect(mocks.service).toHaveBeenCalledWith('C:/user-data', mocks.workers.mock.results[0].value)
    expect(db.listSessions).toHaveBeenCalledWith(-1)
    expect(mocks.rpc).toHaveBeenCalledWith({ operation: 'prune', sessionIds: ['saved'] })
    expect(mocks.register).toHaveBeenCalledWith(plugin, bootstrap.isTrustedArtifactSender)
    expect(registry.snapshot().servers.size).toBe(0)
    expect((await plugin.state('saved')).registered).toBe(false)
    const server = createMailArchiveToolServer()
    registry.add(server) // This is the deployment caller's responsibility.
    expect((await plugin.state('saved')).registered).toBe(true)
    const source = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/this\.registerMailArchive\(ctx\)/)
    bootstrap.shutdown()
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(registry.snapshot().servers.has(ARCHIVE_MCP_SERVER_ID)).toBe(true)
    const result = await server.implementations[0].handler(
      { query: '' },
      {
        cwd: '',
        extraDirs: [],
        getSignal: () => new AbortController().signal,
        waitForSession: async () => 'saved'
      }
    )
    expect(result.isError).toBe(true)
  } finally {
    plugin.close()
  }
})

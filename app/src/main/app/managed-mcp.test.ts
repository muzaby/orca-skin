import { expect, it, vi } from 'vitest'
import type { SettingsStore } from '../infra/settings-store'
import type { PluginAuth } from '../contracts/auth'
import type { OrcaMcpConfig } from '../adapters/common/mcp-config'
const storage = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, input: unknown) => Promise<unknown>>(),
  servers: {} as OrcaMcpConfig,
  secrets: new Map<string, string>()
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) =>
      storage.handlers.set(channel, handler)
  }
}))
vi.mock('../features/extensions/common/mcp/file', () => ({
  readMcpFile: () => ({ mcpServers: structuredClone(storage.servers) }),
  writeMcpFile: (value: { mcpServers: OrcaMcpConfig }) => {
    storage.servers = structuredClone(value.mcpServers)
  }
}))
vi.mock('../infra/config/secret-store', () => ({
  SecretStore: class {
    get(key: string): string | undefined {
      return storage.secrets.get(key)
    }
    has(key: string): boolean {
      return storage.secrets.has(key)
    }
    set(key: string, value: string): void {
      storage.secrets.set(key, value)
    }
    delete(key: string): void {
      storage.secrets.delete(key)
    }
  }
}))
vi.mock('../infra/config/orca-config', () => ({ secretEnvAllowlist: () => [] }))
import { McpStore } from '../features/extensions/common/mcp/store'
import { RuntimeToolRegistry } from '../features/extensions/common/runtime-tool-registry'
import { confluenceTools } from '../features/plugins/confluence/tools'
import { jiraTools } from '../features/plugins/jira/tools'
import { mailTools } from '../features/plugins/mail/tools'
import { createArtifactToolServer } from '../features/artifacts/tool'
import { createPluginBinding } from './deployment/plugins'
import { createManagedMcp } from './managed-mcp'
import { registerMcpHandlers } from './handlers/mcp'
import { CHANNELS } from '../../shared/ipc'

it('projects stored MCP and authenticated plugin bindings', async () => {
  storage.servers = {
    disabled: { command: 'disabled' },
    unresolved: { command: 'unresolved', env: { TOKEN: '${UNKNOWN}' } }
  }
  const state = { mcpEnabled: { disabled: false } as Record<string, boolean>, mcpMeta: {} }
  const settings = {
    getAll: () => state,
    patch: (patch: object) => Object.assign(state, patch)
  } as unknown as SettingsStore
  const mcp = new McpStore(settings)
  let valid = true
  let credentialRevision = 3
  const auth = (authId: string, origin: string): PluginAuth => ({
    authId,
    origin,
    label: authId,
    snapshot: () => ({
      authId,
      status: valid ? 'valid' : 'none',
      verified: valid,
      credentialRevision
    }),
    request: vi.fn(),
    withCredential: vi.fn()
  })
  const wiki = auth('wiki', 'https://wiki.test'),
    jira = auth('jira', 'https://jira.test'),
    mail = auth('mail', 'pop3s://mail.test:995')
  const registry = new RuntimeToolRegistry()
  const bindings = [
    confluenceTools(wiki),
    jiraTools(jira),
    mailTools(mail, { accountId: 'mail-user' }),
    createArtifactToolServer({ publish: vi.fn(), getRef: vi.fn() })
  ].map((server, index) =>
    createPluginBinding({ auth: [wiki, jira, mail, wiki][index], server, registry })
  )
  bindings.forEach((binding) => binding.sync())
  const managed = createManagedMcp(mcp, bindings)
  registerMcpHandlers({ mcp, deployExtensions: async () => managed.source.refresh() })
  const invoke = async (channel: string, input: unknown): Promise<unknown> =>
    storage.handlers.get(channel)!({}, input)
  const events: number[] = []
  managed.source.subscribe((revision) => events.push(revision))
  try {
    expect(
      [...managed.source.snapshot().plugins.values()].map((entry) => entry.identity.sourceId)
    ).toEqual(['wiki', 'jira', 'mail'])
    expect(managed.source.snapshot().users).toEqual({})
    const initial = managed.source.snapshot().revision
    managed.source.refresh()
    expect(managed.source.snapshot().revision).toBe(initial)
    await invoke(CHANNELS.mcpAdd, {
      name: 'stored',
      transport: 'http',
      url: 'https://user.test',
      auth: 'secret-user-0288',
      authEnvKey: 'TOKEN'
    })
    managed.source.refresh()
    expect(managed.source.snapshot().users).toEqual({
      stored: {
        type: 'http',
        url: 'https://user.test',
        headers: { Authorization: 'Bearer secret-user-0288' }
      }
    })
    expect(JSON.stringify(storage.servers)).not.toContain('secret-user-0288')
    await invoke(CHANNELS.mcpUpdate, { id: 'stored', enabled: false })
    managed.source.refresh()
    expect(managed.source.snapshot().users).toEqual({})
    await invoke(CHANNELS.mcpUpdate, { id: 'stored', enabled: true, auth: 'rotated-0288' })
    managed.source.refresh()
    expect(JSON.stringify(managed.source.snapshot().users)).toContain('rotated-0288')
    await invoke(CHANNELS.mcpDelete, { id: 'stored' })
    managed.source.refresh()
    expect(managed.source.snapshot().users).toEqual({})
    valid = false
    bindings.forEach((binding) => binding.sync())
    managed.source.refresh()
    expect(managed.source.snapshot().plugins.size).toBe(0)
    valid = true
    credentialRevision++
    bindings.forEach((binding) => binding.sync())
    managed.source.refresh()
    expect(managed.source.snapshot().plugins.size).toBe(3)
    expect(events).toHaveLength(6)
    const returned = managed.source.snapshot()
    returned.users.invented = { command: 'invented' }
    expect(managed.source.snapshot().users).toEqual({})
  } finally {
    await managed.mcpBridge.close()
  }
})

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { NativeResource } from '../../../shared/native-resources'
import { ClaudeProjectReconciliation } from './project-reconciliation'
import { readClaudeProjectSettings } from './project-settings'
import { readClaudePluginCatalog } from './plugin-catalog'
import { claudeNativeResources } from './native-resources'
let temp: string, cwd: string, root: string, plugin: string
const json = (path: string, value: unknown): void => {
  writeFileSync(path, JSON.stringify(value))
}
beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), 'orca-project-reconcile-'))
  cwd = join(temp, 'cwd')
  root = join(temp, 'root')
  plugin = join(temp, 'plugin')
  for (const path of [join(cwd, '.claude'), join(root, 'plugins'), join(plugin, '.claude-plugin')])
    mkdirSync(path, { recursive: true })
  json(join(plugin, '.claude-plugin/plugin.json'), { name: 'p' })
  json(join(root, 'settings.json'), { enabledPlugins: { 'p@m': true } })
  json(join(root, 'plugins/installed_plugins.json'), {
    plugins: { 'p@m': [{ scope: 'user', installPath: plugin }] }
  })
})
afterEach(() => rmSync(temp, { recursive: true, force: true }))
function fixture(): {
  reconcile: ClaudeProjectReconciliation
  resources: ReturnType<typeof claudeNativeResources>
  query: {
    mcpServerStatus: ReturnType<typeof vi.fn>
    toggleMcpServer: ReturnType<typeof vi.fn>
    applyFlagSettings: ReturnType<typeof vi.fn>
    reloadPlugins: ReturnType<typeof vi.fn>
  }
  persist: ReturnType<typeof vi.fn>
  revision(): string
} {
  const plugins = readClaudePluginCatalog(cwd, root, {}, true)
  let enabled = true
  const persist = vi.fn()
  const query = {
    mcpServerStatus: vi.fn(async () => []),
    toggleMcpServer: vi.fn(async () => {}),
    applyFlagSettings: vi.fn(
      async (settings: { enabledPlugins?: Record<string, unknown> | null }) => {
        enabled = settings.enabledPlugins?.['p@inline'] === true
      }
    ),
    reloadPlugins: vi.fn(async () => ({
      plugins: enabled ? [{ name: 'p', path: plugin }] : [],
      commands: [],
      agents: [],
      mcpServers: [],
      error_count: 0
    }))
  }
  const resources = claudeNativeResources(
    query,
    [],
    [],
    plugins.installations,
    { 'p@inline': true },
    persist
  )
  const reconcile = new ClaudeProjectReconciliation({
    cwd,
    root,
    plugins,
    list: resources.list,
    set: resources.set
  })
  return {
    reconcile,
    resources,
    query,
    persist,
    revision: () => readClaudeProjectSettings(cwd, root).revision
  }
}
it('shows external selection with actual status immediately, waits for idle, and never saves it back', async () => {
  const f = fixture()
  const file = join(cwd, '.claude/settings.local.json')
  json(file, { enabledPlugins: { 'p@m': false }, permissions: { allow: ['keep'] } })
  const bytes = readFileSync(file, 'utf8')
  expect(f.reconcile.preview(await f.resources.list())[0]).toMatchObject({
    enabled: false,
    status: 'enabled'
  })
  expect(await f.reconcile.reconcile(f.revision(), () => false)).toBe('pending')
  expect(f.query.reloadPlugins).not.toHaveBeenCalled()
  expect(await f.reconcile.reconcile(f.revision(), () => true)).toBe('applied')
  expect((await f.resources.list())[0]).toMatchObject({ enabled: false, status: 'disabled' })
  expect(f.persist).not.toHaveBeenCalled()
  expect(readFileSync(file, 'utf8')).toBe(bytes)
  await f.reconcile.reconcile(f.revision(), () => true)
  expect(f.query.reloadPlugins).toHaveBeenCalledOnce()
  // Removing a project override restores startup defaults even if global settings changed later.
  json(join(root, 'settings.json'), { enabledPlugins: { 'p@m': false } })
  json(file, {})
  expect(await f.reconcile.reconcile(f.revision(), () => true)).toBe('applied')
  expect((await f.resources.list())[0].enabled).toBe(true)
})
it.each(['plugin-mcp', 'definition', 'approval', 'unknown-plugin'])(
  'defers %s to normal reclamation without an SDK mutation',
  async (change) => {
    const f = fixture()
    if (change === 'plugin-mcp') json(join(plugin, '.mcp.json'), { mcpServers: { owned: {} } })
    json(
      join(cwd, '.claude/settings.local.json'),
      change === 'approval'
        ? { enabledMcpjsonServers: ['project'] }
        : { enabledPlugins: { [change === 'unknown-plugin' ? 'new@m' : 'p@m']: false } }
    )
    if (change === 'definition') json(join(cwd, '.mcp.json'), { mcpServers: { changed: {} } })
    expect(await f.reconcile.reconcile(f.revision(), () => true)).toBe('restart-required')
    expect(f.query.applyFlagSettings).not.toHaveBeenCalled()
  }
)
it('isolates project approvals from user MCP and detects revision changes before any SDK call', async () => {
  const items: NativeResource[] = ['user', 'project'].map((source) => ({
    id: source,
    name: source,
    kind: 'mcp',
    source,
    status: 'connected',
    enabled: true,
    canToggle: true
  }))
  const set = vi.fn(async () => {})
  const r = new ClaudeProjectReconciliation({
    cwd,
    root,
    plugins: readClaudePluginCatalog(cwd, root),
    list: async () => items,
    set
  })
  json(join(cwd, '.claude/settings.local.json'), { disabledMcpjsonServers: ['user', 'project'] })
  expect(r.preview(items).map((item) => item.enabled)).toEqual([true, false])
  expect(await r.reconcile('stale', () => true)).toBe('pending')
  expect(set).not.toHaveBeenCalled()
  expect(await r.reconcile(readClaudeProjectSettings(cwd, root).revision, () => true)).toBe(
    'restart-required'
  )
  expect(set).not.toHaveBeenCalled()
})

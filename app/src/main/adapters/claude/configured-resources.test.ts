import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportError } from '../../infra/error-report'
import {
  configuredClaudeResources,
  globalClaudeResources,
  nativePluginId
} from './configured-resources'
import { claudeNativeResources } from './native-resources'

vi.mock('../../infra/error-report', () => ({ reportError: vi.fn() }))

let temp: string
let cwd: string
let paths: { root: string; globalConfig: string }
const json = async (file: string, value: unknown): Promise<void> => {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value))
}
beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), 'orca-native-'))
  cwd = join(temp, 'project')
  paths = { root: join(temp, 'claude'), globalConfig: join(temp, '.claude.json') }
  await mkdir(join(cwd, '.git'), { recursive: true })
})
afterEach(async () => {
  await rm(temp, { recursive: true, force: true })
})

describe('configured Claude resources', () => {
  it('reads global defaults without project plugin installs or project MCP switches', async () => {
    const plugin = join(temp, 'global-plugin')
    const projectPlugin = join(temp, 'project-plugin')
    await json(join(plugin, '.claude-plugin/plugin.json'), { name: 'superpowers' })
    await json(join(projectPlugin, '.claude-plugin/plugin.json'), { name: 'project-only' })
    await json(join(paths.root, 'plugins/installed_plugins.json'), {
      plugins: {
        'superpowers@market': [{ scope: 'user', installPath: plugin }],
        'project@market': [{ scope: 'project', projectPath: homedir(), installPath: projectPlugin }]
      }
    })
    await json(join(paths.root, 'settings.json'), {
      enabledPlugins: { 'superpowers@market': false }
    })
    await json(paths.globalConfig, {
      mcpServers: { docs: { command: 'secret-command' } },
      projects: { [homedir()]: { disabledMcpServers: ['docs'] } }
    })
    const before = await readFile(paths.globalConfig, 'utf8')
    const resources = await globalClaudeResources(paths)
    expect(resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'docs', enabled: true, canToggle: false }),
        expect.objectContaining({ name: 'superpowers@market', enabled: false, canToggle: true })
      ])
    )
    expect(resources).toHaveLength(2)
    expect(JSON.stringify(resources)).not.toContain('secret-command')
    expect(await readFile(paths.globalConfig, 'utf8')).toBe(before)
  })
  it('reads scoped MCP metadata and disabled flags without exposing private configuration', async () => {
    await json(paths.globalConfig, {
      mcpServers: { user: { command: 'secret-command' }, shared: { url: 'secret-url' } },
      projects: {
        [cwd.replaceAll('\\', '/')]: {
          mcpServers: { local: { env: { SECRET: 'value' } } },
          disabledMcpServers: ['user']
        },
        [join(temp, 'other')]: { mcpServers: { unrelated: { command: 'x' } } }
      }
    })
    await json(join(cwd, '.mcp.json'), {
      mcpServers: { project: { command: 'p' }, shared: { command: 'p' }, sdk: { type: 'sdk' } }
    })
    const before = await readFile(paths.globalConfig, 'utf8')
    const rows = await configuredClaudeResources(cwd, paths)
    expect(rows.map((row) => row.name)).toEqual(['user', 'shared', 'project', 'local'])
    expect(rows[0]).toMatchObject({ status: 'disabled', enabled: false, canToggle: false })
    expect(
      rows.slice(1).every((row) => row.status === 'configured' && row.enabled && !row.canToggle)
    ).toBe(true)
    expect(JSON.stringify(rows)).not.toMatch(/secret|SECRET|value|unrelated|command|env|url/)
    expect(await readFile(paths.globalConfig, 'utf8')).toBe(before)
  })

  it('applies plugin scope and setting precedence, and shares identity with actual init observations', async () => {
    const active = join(temp, 'active')
    const off = join(temp, 'off')
    const installedOnly = join(temp, 'installed-only')
    await json(join(active, '.claude-plugin/plugin.json'), {
      name: 'active',
      description: 'Active native skills'
    })
    await json(join(paths.root, 'settings.json'), {
      enabledPlugins: { 'active@market': false, 'off@market': true }
    })
    await json(join(cwd, '.claude/settings.json'), { enabledPlugins: { 'active@market': true } })
    await json(join(cwd, '.claude/settings.local.json'), {
      enabledPlugins: { 'off@market': false }
    })
    await json(join(paths.root, 'plugins/installed_plugins.json'), {
      version: 2,
      plugins: {
        'active@market': [
          { scope: 'user', installPath: join(temp, 'old') },
          { scope: 'project', projectPath: cwd, installPath: active }
        ],
        'off@market': [{ scope: 'user', installPath: off }],
        'installed@market': [{ scope: 'local', projectPath: cwd, installPath: installedOnly }],
        'other@market': [
          {
            scope: 'project',
            projectPath: join(temp, 'other'),
            installPath: join(temp, 'other-plugin')
          }
        ]
      }
    })
    for (const directory of [off, installedOnly, join(temp, 'old')])
      await mkdir(directory, { recursive: true })
    const rows = await configuredClaudeResources(cwd, paths)
    expect(rows.find((item) => item.id === nativePluginId(active))?.description).toBe(
      'Active native skills'
    )
    expect(rows.find((item) => item.id === nativePluginId(join(temp, 'old')))).toMatchObject({
      name: 'active@market'
    })
    expect(rows.filter((item) => item.id !== nativePluginId(join(temp, 'old')))).toEqual([
      {
        id: nativePluginId(active),
        description: 'Active native skills',
        name: 'active@market',
        kind: 'plugin',
        status: 'configured',
        enabled: true,
        canToggle: false
      },
      {
        id: nativePluginId(off),
        name: 'off@market',
        kind: 'plugin',
        status: 'disabled',
        enabled: false,
        canToggle: false
      },
      {
        id: nativePluginId(installedOnly),
        name: 'installed@market',
        kind: 'plugin',
        status: 'installed',
        enabled: false,
        canToggle: false
      }
    ])
    const live = claudeNativeResources({
      mcpServerStatus: async () => [],
      toggleMcpServer: async () => {}
    })
    live.observePlugins([{ name: 'active', path: active }])
    expect((await live.list())[0]).toMatchObject({
      id: nativePluginId(active),
      description: 'Active native skills'
    })
    expect(JSON.stringify(rows)).not.toContain(temp)
  })

  it('reads bundled, inline and referenced plugin MCP metadata but blocks escaped paths', async () => {
    const installPath = join(temp, 'plugin')
    await json(join(paths.root, 'settings.json'), { enabledPlugins: { 'tools@market': true } })
    await json(join(paths.root, 'plugins/installed_plugins.json'), {
      version: 2,
      plugins: { 'tools@market': [{ scope: 'user', installPath }] }
    })
    await json(join(installPath, '.mcp.json'), { bundled: { command: 'hidden' } })
    await json(join(installPath, 'extra.json'), { mcpServers: { extra: { url: 'hidden' } } })
    await json(join(temp, 'outside.json'), { mcpServers: { outside: { command: 'hidden' } } })
    await json(join(installPath, '.claude-plugin/plugin.json'), {
      name: 'tools',
      mcpServers: [{ inline: { command: 'hidden' } }, './extra.json', '../outside.json']
    })
    const rows = await configuredClaudeResources(cwd, paths)
    expect(rows.filter((row) => row.kind === 'mcp').map((row) => row.id)).toEqual([
      'plugin:tools:bundled',
      'plugin:tools:inline',
      'plugin:tools:extra'
    ])
    expect(rows.every((row) => row.enabled && !row.canToggle)).toBe(true)
  })

  it('distinguishes absent metadata from malformed data with a redacted error', async () => {
    vi.mocked(reportError).mockClear()
    expect(await configuredClaudeResources(cwd, paths)).toEqual([])
    await json(paths.globalConfig, {})
    expect(reportError).not.toHaveBeenCalled()
    await writeFile(paths.globalConfig, '{"token":"super-secret"')
    expect(await configuredClaudeResources(cwd, paths)).toEqual([])
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][0]).toMatchObject({
      event: 'claude.native-settings.skipped',
      detail: expect.stringContaining(paths.globalConfig)
    })
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain('super-secret')
  })
})

it('lists every applicable install independently of flags, uses path boundaries and refreshes removal', async () => {
  const registry = join(paths.root, 'plugins/installed_plugins.json')
  const entries = {
    'superpowers@official': [
      { scope: 'user', installPath: join(temp, 'user-install') },
      { scope: 'project', projectPath: cwd, installPath: join(temp, 'project-install') },
      { scope: 'local', projectPath: cwd, installPath: join(temp, 'local-install') }
    ]
  }
  for (const entry of entries['superpowers@official'])
    await mkdir(entry.installPath, { recursive: true })
  await json(registry, { version: 2, plugins: entries })
  await json(join(cwd, '.claude/settings.json'), {
    enabledPlugins: { 'superpowers@official': false }
  })
  const rows = await configuredClaudeResources(cwd, paths)
  expect(rows).toHaveLength(3)
  expect(rows.every((item) => item.status === 'disabled')).toBe(true)
  const nested = join(cwd, 'child', 'nested-repo')
  await mkdir(join(nested, '.git'), { recursive: true })
  expect((await configuredClaudeResources(nested, paths)).map((item) => item.id)).toEqual([
    nativePluginId(join(temp, 'user-install')),
    nativePluginId(join(temp, 'project-install'))
  ])
  for (const outside of [join(temp, 'project-sibling'), join(temp, 'other'), temp]) {
    expect((await configuredClaudeResources(outside, paths)).map((item) => item.id)).toEqual([
      nativePluginId(join(temp, 'user-install'))
    ])
  }
  await json(join(cwd, '.claude/settings.json'), {
    enabledPlugins: { 'superpowers@official': true }
  })
  expect((await configuredClaudeResources(cwd, paths)).every((item) => item.enabled)).toBe(true)
  await json(registry, { version: 2, plugins: {} })
  expect(await configuredClaudeResources(cwd, paths)).toEqual([])
})

it('applies Orca plugin choices above user defaults and below project selections', async () => {
  const plugin = join(temp, 'fixture')
  await json(join(plugin, '.claude-plugin/plugin.json'), { name: 'fixture' })
  await json(join(paths.root, 'plugins/installed_plugins.json'), {
    plugins: { 'fixture@market': [{ scope: 'user', installPath: plugin }] }
  })
  await json(join(paths.root, 'settings.json'), { enabledPlugins: { 'fixture@market': true } })
  const choice = { 'plugin:fixture@market': false, 'mcp:fixture@market': true }
  expect((await configuredClaudeResources(cwd, paths, false, choice))[0].enabled).toBe(false)
  await json(join(cwd, '.claude/settings.json'), { enabledPlugins: { 'fixture@market': true } })
  expect((await configuredClaudeResources(cwd, paths, false, choice))[0].enabled).toBe(true)
  await json(join(cwd, '.claude/settings.local.json'), {
    enabledPlugins: { 'fixture@market': false }
  })
  expect((await configuredClaudeResources(cwd, paths, false, choice))[0].enabled).toBe(false)
})

it('omits installations whose directory no longer exists', async () => {
  const kept = join(temp, 'kept'),
    removed = join(temp, 'removed')
  for (const dir of [kept, removed])
    await json(join(dir, '.claude-plugin/plugin.json'), { name: dir === kept ? 'kept' : 'removed' })
  await json(join(paths.root, 'plugins/installed_plugins.json'), {
    plugins: {
      'kept@market': [{ scope: 'user', installPath: kept }],
      'removed@market': [{ scope: 'user', installPath: removed }]
    }
  })
  expect(await globalClaudeResources(paths)).toHaveLength(2)
  await rm(removed, { recursive: true })
  expect((await globalClaudeResources(paths)).map((item) => item.name)).toEqual(['kept@market'])
  expect((await configuredClaudeResources(cwd, paths)).map((item) => item.name)).toEqual([
    'kept@market'
  ])
})

describe('Claude settings read policy at every configured-resource reader site', () => {
  const SECRET = 'private-token-value'
  const BROKEN = `{"mcpServers":{"x":{"command":"c"}},"token":"${SECRET}",}`
  let p: string
  let q: string
  // Each file changes the rows on its own, so "skipped" is distinguishable from "used".
  beforeEach(async () => {
    vi.mocked(reportError).mockClear()
    p = join(temp, 'plugin-p')
    q = join(temp, 'plugin-q')
    await json(join(p, '.claude-plugin/plugin.json'), { name: 'pp', mcpServers: './extra.json' })
    await json(join(p, '.mcp.json'), { mcpServers: { bundled: { command: 'b' } } })
    await json(join(p, 'extra.json'), { mcpServers: { declared: { command: 'e' } } })
    await json(join(q, '.claude-plugin/plugin.json'), { name: 'qq' })
    await json(paths.globalConfig, { mcpServers: { global: { command: 'g' } } })
    await json(join(paths.root, 'settings.json'), { enabledPlugins: { 'q@m': true } })
    await json(join(cwd, '.claude/settings.json'), { disabledMcpjsonServers: ['project'] })
    await json(join(cwd, '.claude/settings.local.json'), { enabledPlugins: { 'p@m': true } })
    await json(join(cwd, '.mcp.json'), { mcpServers: { project: { command: 'p' } } })
    await json(join(paths.root, 'plugins/installed_plugins.json'), {
      plugins: {
        'p@m': [{ scope: 'user', installPath: p }],
        'q@m': [{ scope: 'user', installPath: q }]
      }
    })
  })
  const sites: Array<[string, () => string]> = [
    ['C68 global config', () => paths.globalConfig],
    ['C69 user settings', () => join(paths.root, 'settings.json')],
    ['C72 project settings', () => join(cwd, '.claude/settings.json')],
    ['C75 local settings', () => join(cwd, '.claude/settings.local.json')],
    ['C76 project .mcp.json', () => join(cwd, '.mcp.json')],
    ['C77 installed plugins', () => join(paths.root, 'plugins/installed_plugins.json')],
    ['C154 bundled plugin .mcp.json', () => join(p, '.mcp.json')],
    ['C163 declared plugin MCP file', () => join(p, 'extra.json')]
  ]
  const read = (): ReturnType<typeof configuredClaudeResources> =>
    configuredClaudeResources(cwd, paths)
  it.each(sites)('%s: empty content is no settings, silently', async (_site, file) => {
    await writeFile(file(), '')
    const empty = await read()
    await rm(file())
    expect(empty).toEqual(await read())
    expect(reportError).not.toHaveBeenCalled()
  })
  it.each(sites)(
    '%s: broken content is skipped like an absent file with one redacted warning',
    async (_site, file) => {
      const full = await read()
      await writeFile(file(), BROKEN)
      const skipped = await read()
      expect(await read()).toEqual(skipped)
      expect(reportError).toHaveBeenCalledOnce()
      const report = vi.mocked(reportError).mock.calls[0][0]
      expect(report).toMatchObject({
        event: 'claude.native-settings.skipped',
        level: 'warn',
        detail: expect.stringContaining(file()),
        data: { file: file(), reason: 'parse' }
      })
      expect(JSON.stringify(report)).not.toContain(SECRET)
      await rm(file())
      expect(skipped).toEqual(await read())
      expect(skipped).not.toEqual(full)
    }
  )
  const names = async (): Promise<string[]> => (await read()).map((item) => item.name).sort()
  it('C138 plugin manifest: an empty manifest keeps the plugin silently', async () => {
    await writeFile(join(p, '.claude-plugin/plugin.json'), '')
    expect(await names()).toEqual(['global', 'p@m', 'plugin:p:bundled', 'project', 'q@m'])
    expect(reportError).not.toHaveBeenCalled()
  })
  it('C138 plugin manifest: a broken manifest excludes only that plugin with one redacted warning', async () => {
    const manifest = join(p, '.claude-plugin/plugin.json')
    expect(await names()).toEqual([
      'global',
      'p@m',
      'plugin:pp:bundled',
      'plugin:pp:declared',
      'project',
      'q@m'
    ])
    await writeFile(manifest, `{"name":"pp","token":"${SECRET}"`)
    expect(await names()).toEqual(['global', 'project', 'q@m'])
    expect(await names()).toEqual(['global', 'project', 'q@m'])
    expect(reportError).toHaveBeenCalledOnce()
    const report = vi.mocked(reportError).mock.calls[0][0]
    expect(report).toMatchObject({
      detail: expect.stringContaining(manifest),
      data: { file: manifest, reason: 'parse' }
    })
    expect(JSON.stringify(report)).not.toContain(SECRET)
  })
})

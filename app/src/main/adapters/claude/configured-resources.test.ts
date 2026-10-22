import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  configuredClaudeResources,
  configuredClaudePluginDirectory,
  configuredClaudeMcpFile,
  nativePluginId
} from './configured-resources'
import { claudeNativeResources } from './native-resources'
import { globalClaudeResources } from './configured-resources'

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
  it('resolves the actual MCP declaration file across user, project, local and plugin precedence', async () => {
    await json(paths.globalConfig, {
      mcpServers: { global: { command: 'a' }, shared: { command: 'a' } },
      projects: { [cwd]: { mcpServers: { local: { command: 'b' } } } }
    })
    await json(join(cwd, '.mcp.json'), { mcpServers: { shared: { command: 'c' } } })
    const root = join(temp, 'plugin')
    await json(join(paths.root, 'plugins/installed_plugins.json'), {
      plugins: { 'p@market': [{ scope: 'user', installPath: root }] }
    })
    await json(join(root, '.claude-plugin/plugin.json'), {
      name: 'p',
      mcpServers: [{ inline: { command: 'd' } }, './extra.json']
    })
    await json(join(root, '.mcp.json'), { mcpServers: { bundled: { command: 'e' } } })
    await json(join(root, 'extra.json'), { external: { command: 'f' } })
    for (const [id, file] of [
      ['global', paths.globalConfig],
      ['local', paths.globalConfig],
      ['shared', join(cwd, '.mcp.json')],
      ['plugin:p:inline', join(root, '.claude-plugin/plugin.json')],
      ['plugin:p:bundled', join(root, '.mcp.json')],
      ['plugin:p:external', join(root, 'extra.json')]
    ])
      expect(await configuredClaudeMcpFile(cwd, id, paths)).toBe(file)
    expect(await configuredClaudeMcpFile(cwd, 'unknown', paths)).toBeUndefined()
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
    const rows = await configuredClaudeResources(cwd, paths)
    expect(rows.find((item) => item.id === nativePluginId(active))?.description).toBe(
      'Active native skills'
    )
    expect(await configuredClaudePluginDirectory(cwd, nativePluginId(active), paths)).toBe(active)
    expect(
      await configuredClaudePluginDirectory(join(temp, 'other'), nativePluginId(active), paths)
    ).toBeUndefined()
    expect(await configuredClaudePluginDirectory(cwd, active, paths)).toBeUndefined()
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
    expect(await configuredClaudeResources(cwd, paths)).toEqual([])
    await json(paths.globalConfig, {})
    await writeFile(paths.globalConfig, '{"token":"super-secret"')
    await expect(configuredClaudeResources(cwd, paths)).rejects.toThrow(
      'Claude 네이티브 확장 설정을 읽을 수 없습니다.'
    )
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
  await json(registry, { version: 2, plugins: entries })
  await json(join(cwd, '.claude/settings.json'), {
    enabledPlugins: { 'superpowers@official': false }
  })
  const rows = await configuredClaudeResources(cwd, paths)
  expect(rows).toHaveLength(3)
  expect(rows.every((item) => item.status === 'disabled')).toBe(true)
  for (const entry of entries['superpowers@official']) {
    expect(
      await configuredClaudePluginDirectory(cwd, nativePluginId(entry.installPath), paths)
    ).toBe(entry.installPath)
  }
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
  expect(await configuredClaudePluginDirectory(cwd, rows[0].id, paths)).toBeUndefined()
})

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  configuredClaudeResources,
  configuredClaudePluginDirectory,
  nativePluginId
} from './configured-resources'
import { claudeNativeResources } from './native-resources'

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
    const rows = await configuredClaudeResources(join(cwd, 'subdir'), paths)
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
    expect(rows).toEqual([
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
      id: rows[0].id,
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

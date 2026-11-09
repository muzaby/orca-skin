import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportError } from '../../infra/error-report'
import {
  claudePluginDefaults,
  configuredClaudeCommands,
  readClaudePluginCatalog,
  readClaudePluginCatalogAsync
} from './plugin-catalog'
vi.mock('../../infra/error-report', () => ({ reportError: vi.fn() }))
vi.mock('node:fs', async (original) => {
  const actual = await original<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
    readdirSync: vi.fn(actual.readdirSync)
  }
})

let temp: string
let cwd: string
let root: string
const write = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value))
}
function plugin(name: string): string {
  const path = join(temp, name)
  write(join(path, '.claude-plugin/plugin.json'), { name })
  write(
    join(path, 'skills', name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} description\n---\nprivate body`
  )
  return path
}
beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), 'orca-plugin-catalog-'))
  cwd = join(temp, 'project')
  root = join(temp, 'claude')
  mkdirSync(join(cwd, '.git'), { recursive: true })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  rmSync(temp, { recursive: true, force: true })
})

describe('native plugin catalog', () => {
  it.each(['win32', 'linux'] as const)(
    'keeps nested cwd selection identical for sync and async catalogs on %s',
    async (platform) => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
      const child = join(cwd, 'nested', 'child')
      mkdirSync(child, { recursive: true })
      const path = plugin('bundle')
      write(join(root, 'settings.json'), { enabledPlugins: { 'bundle@market': true } })
      write(join(root, 'plugins/installed_plugins.json'), {
        plugins: { 'bundle@market': [{ scope: 'user', installPath: path }] }
      })
      write(join(cwd, '.claude/settings.local.json'), {
        enabledPlugins: { 'bundle@market': false }
      })
      write(join(child, '.claude/settings.local.json'), {
        enabledPlugins: { 'bundle@market': true }
      })
      const sync = readClaudePluginCatalog(child, root)
      const asyncCatalog = await readClaudePluginCatalogAsync(child, root)
      expect(asyncCatalog).toEqual(sync)
      expect(asyncCatalog.commands.map((command) => command.name)).toEqual(
        platform === 'win32' ? ['bundle:bundle'] : []
      )
      vi.stubEnv('CLAUDE_CONFIG_DIR', root)
      expect(await configuredClaudeCommands(child, {})).toEqual(asyncCatalog.commands)
    }
  )
  it('reads defaults from settings alone without traversing installed plugin trees', () => {
    const path = plugin('bundle')
    write(join(root, 'settings.json'), {
      enabledPlugins: { active: true, off: false, array: [], object: {} }
    })
    write(join(root, 'plugins/installed_plugins.json'), {
      plugins: { active: [{ scope: 'user', installPath: path }] }
    })
    const overrides = { enabledPlugins: { active: false, extra: true } }
    const expected = readClaudePluginCatalog(cwd, root, overrides, true).defaults
    vi.mocked(readFileSync).mockClear()
    vi.mocked(readdirSync).mockClear()
    expect(claudePluginDefaults(root, overrides)).toEqual(expected)
    expect(readFileSync).toHaveBeenCalledExactlyOnceWith(join(root, 'settings.json'), 'utf8')
    expect(readdirSync).not.toHaveBeenCalled()
  })
  it('projects asynchronous menu reads identically to spawn without re-reading skill contents', async () => {
    const path = plugin('bundle')
    write(
      join(path, 'commands', 'check.md'),
      '---\ndescription: Check\nargument-hint: [file]\n---\nbody'
    )
    write(join(path, 'skills', 'internal', 'SKILL.md'), '---\nuser-invocable: false\n---\nhidden')
    write(join(root, 'settings.json'), { enabledPlugins: { 'bundle@market': true } })
    write(join(root, 'plugins/installed_plugins.json'), {
      plugins: { 'bundle@market': [{ scope: 'user', installPath: path }] }
    })
    vi.mocked(readFileSync).mockClear()
    vi.mocked(readdirSync).mockClear()
    vi.stubEnv('CLAUDE_CONFIG_DIR', root)
    expect(await configuredClaudeCommands(cwd, {})).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'bundle:check' })])
    )
    expect(readFileSync).not.toHaveBeenCalled()
    expect(readdirSync).not.toHaveBeenCalled()
    expect(await readClaudePluginCatalogAsync(cwd, root)).toEqual(
      readClaudePluginCatalog(cwd, root)
    )
    write(join(cwd, '.claude/settings.local.json'), { enabledPlugins: { 'bundle@market': false } })
    expect(await readClaudePluginCatalogAsync(cwd, root)).toEqual(
      readClaudePluginCatalog(cwd, root)
    )
    expect(await readClaudePluginCatalogAsync(cwd, root, {}, true)).toEqual(
      readClaudePluginCatalog(cwd, root, {}, true)
    )
    write(join(root, 'settings.json'), '{"secret":"private-value"')
    vi.mocked(reportError).mockClear()
    expect(await readClaudePluginCatalogAsync(cwd, root)).toEqual(
      readClaudePluginCatalog(cwd, root)
    )
    expect(reportError).toHaveBeenCalledOnce()
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain('private-value')
  })
  it('selects active installations by scope and precedence and refreshes every read', () => {
    const active = plugin('frontend-design')
    const disabled = plugin('disabled')
    const project = plugin('project-native')
    const other = plugin('other')
    write(join(root, 'settings.json'), {
      enabledPlugins: {
        'frontend@market': true,
        'disabled@market': true,
        'project@market': false,
        'other@market': true,
        'missing@market': true
      },
      env: { SECRET: 'private-auth' },
      model: 'private-model'
    })
    write(join(cwd, '.claude/settings.json'), { enabledPlugins: { 'project@market': true } })
    write(join(cwd, '.claude/settings.local.json'), {
      enabledPlugins: { 'disabled@market': false }
    })
    write(join(root, 'plugins/installed_plugins.json'), {
      plugins: {
        'frontend@market': [{ scope: 'user', installPath: active }],
        'disabled@market': [{ scope: 'user', installPath: disabled }],
        'project@market': [
          { scope: 'user', installPath: other },
          { scope: 'project', projectPath: cwd, installPath: project }
        ],
        'other@market': [
          { scope: 'local', projectPath: join(temp, 'elsewhere'), installPath: other }
        ],
        'installed@market': [{ scope: 'user', installPath: other }],
        'missing@market': [{ scope: 'user', installPath: join(temp, 'missing') }]
      }
    })
    const result = readClaudePluginCatalog(cwd, root)
    expect(result.roots).toEqual([active, project])
    expect(result.skills).toEqual([
      'frontend-design:frontend-design',
      'project-native:project-native'
    ])
    expect(result.commands.map((command) => command.name)).toEqual(result.skills)
    expect(JSON.stringify(result.commands)).not.toMatch(
      /private|installPath|SECRET|model|skillPath/
    )
    expect(
      readClaudePluginCatalog(cwd, root, { enabledPlugins: { 'project@market': false } }).roots
    ).toEqual([active, project])
    write(join(root, 'settings.json'), { enabledPlugins: { 'frontend@market': false } })
    expect(readClaudePluginCatalog(cwd, root).roots).toEqual([project])
  })

  it('discovers declared skill paths and legacy commands with descriptions, hints and invocation policy', () => {
    const path = plugin('bundle')
    write(join(path, '.claude-plugin/plugin.json'), {
      name: 'bundle',
      skills: ['./custom'],
      commands: ['./extra/legacy.md']
    })
    write(
      join(path, 'custom/alias/SKILL.md'),
      '---\nname: actual-name\ndescription: >-\n  First line\n  second line\nargument-hint: "[brief]"\n---\nprivate body'
    )
    write(
      join(path, 'skills/internal/SKILL.md'),
      '---\nname: internal\nuser-invocable: false # automatic only\n---\nhidden body'
    )
    write(
      join(path, 'skills/manual/SKILL.md'),
      '---\nname: manual\ndisable-model-invocation: true\ndescription: Manual only\n---\nmanual body'
    )
    write(join(path, 'extra/legacy.md'), "---\ndescription: 'Legacy description'\n---\nlegacy body")
    write(join(root, 'settings.json'), { enabledPlugins: { 'bundle@market': true } })
    write(join(root, 'plugins/installed_plugins.json'), {
      plugins: { 'bundle@market': [{ scope: 'user', installPath: path }] }
    })
    const result = readClaudePluginCatalog(cwd, root)
    expect(result.skills).toContain('bundle:internal')
    expect(result.commands.map((command) => command.name)).not.toContain('bundle:internal')
    expect(result.commands).toContainEqual({
      name: 'bundle:actual-name',
      description: 'First line second line',
      argumentHint: '[brief]',
      source: 'plugin'
    })
    expect(result.commands).toContainEqual({
      name: 'bundle:legacy',
      description: 'Legacy description',
      argumentHint: '',
      source: 'plugin'
    })
    expect(result.commands.some((command) => command.name === 'bundle:manual')).toBe(true)
  })

  it('reports invalid configuration without its contents and leaves absent installations empty', () => {
    const empty = {
      defaults: {},
      roots: [],
      skills: [],
      commands: [],
      files: [],
      installations: []
    }
    expect(readClaudePluginCatalog(cwd, root)).toEqual(empty)
    write(join(root, 'settings.json'), '{"secret":"private-value"')
    vi.mocked(reportError).mockClear()
    expect(readClaudePluginCatalog(cwd, root)).toEqual(empty)
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][0]).toMatchObject({
      event: 'claude.native-settings.skipped',
      title: 'configInvalid',
      level: 'warn',
      detail: expect.stringContaining(join(root, 'settings.json'))
    })
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain('private-value')
  })
})

it('excludes local installs from child cwd and selects the nearest project without relying on git root', () => {
  const outer = plugin('outer')
  const inner = plugin('inner')
  const local = plugin('local')
  write(join(root, 'settings.json'), {
    enabledPlugins: { 'tools@market': true, 'local@market': true }
  })
  write(join(root, 'plugins/installed_plugins.json'), {
    plugins: {
      'tools@market': [
        { scope: 'project', projectPath: cwd, installPath: outer },
        { scope: 'project', projectPath: join(cwd, 'nested'), installPath: inner }
      ],
      'local@market': [{ scope: 'local', projectPath: cwd, installPath: local }]
    }
  })
  expect(readClaudePluginCatalog(cwd, root).roots).toEqual([outer, local])
  expect(readClaudePluginCatalog(join(cwd, 'child'), root).roots).toEqual([outer])
  expect(readClaudePluginCatalog(join(cwd, 'nested', 'child'), root).roots).toEqual([inner])
  expect(readClaudePluginCatalog(join(cwd + '-sibling'), root).roots).toEqual([])
})

describe('Claude settings read policy at every catalog reader site', () => {
  const SECRET = 'private-token-value'
  const BROKEN = `{"enabledPlugins":{"a@m":true},"token":"${SECRET}",}`
  let a: string
  let b: string
  let c: string
  // Each document changes the result on its own, so "skipped" is distinguishable from "used".
  beforeEach(() => {
    vi.mocked(reportError).mockClear()
    a = plugin('alpha')
    b = plugin('beta')
    c = plugin('gamma')
    write(join(root, 'settings.json'), { enabledPlugins: { 'a@m': true, 'c@m': true } })
    write(join(cwd, '.claude/settings.json'), { enabledPlugins: { 'b@m': true } })
    write(join(cwd, '.claude/settings.local.json'), { enabledPlugins: { 'a@m': false } })
    write(join(root, 'plugins/installed_plugins.json'), {
      plugins: {
        'a@m': [{ scope: 'user', installPath: a }],
        'b@m': [{ scope: 'user', installPath: b }],
        'c@m': [{ scope: 'user', installPath: c }]
      }
    })
  })
  const documents = (): string[] => [
    join(root, 'settings.json'),
    join(cwd, '.claude/settings.json'),
    join(cwd, '.claude/settings.local.json'),
    join(root, 'plugins/installed_plugins.json')
  ]
  type Reader = () => unknown | Promise<unknown>
  const sites: Array<[string, () => string, Reader]> = [
    [
      'P26 claudePluginDefaults',
      () => join(root, 'settings.json'),
      () => claudePluginDefaults(root, { enabledPlugins: { 'z@m': true } })
    ],
    ...[0, 1, 2, 3].map((index): [string, () => string, Reader] => [
      `P281 readClaudePluginCatalog document ${index}`,
      () => documents()[index],
      () => readClaudePluginCatalog(cwd, root)
    ]),
    ...[0, 1, 2, 3].map((index): [string, () => string, Reader] => [
      `P331 readClaudePluginCatalogAsync document ${index}`,
      () => documents()[index],
      () => readClaudePluginCatalogAsync(cwd, root)
    ])
  ]
  it.each(sites)('%s: empty content is no settings, silently', async (_site, file, read) => {
    write(file(), '')
    const empty = await read()
    rmSync(file())
    expect(empty).toEqual(await read())
    expect(reportError).not.toHaveBeenCalled()
  })
  it.each(sites)(
    '%s: broken content is skipped like an absent file with one redacted warning',
    async (_site, file, read) => {
      const full = await read()
      write(file(), BROKEN)
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
      rmSync(file())
      expect(skipped).toEqual(await read())
      expect(skipped).not.toEqual(full)
    }
  )
  const manifests: Array<
    [string, (root: string) => Promise<{ roots: string[] }> | { roots: string[] }]
  > = [
    ['P295 readClaudePluginCatalog manifest', () => readClaudePluginCatalog(cwd, root)],
    ['P345 readClaudePluginCatalogAsync manifest', () => readClaudePluginCatalogAsync(cwd, root)]
  ]
  it.each(manifests)('%s: an empty manifest keeps the plugin silently', async (_site, read) => {
    write(join(b, '.claude-plugin/plugin.json'), '')
    const catalog = await read(root)
    expect(catalog.roots).toEqual([b, c])
    expect(reportError).not.toHaveBeenCalled()
  })
  it.each(manifests)(
    '%s: a broken manifest excludes only that plugin with one redacted warning',
    async (_site, read) => {
      const manifest = join(b, '.claude-plugin/plugin.json')
      write(manifest, `{"name":"beta","token":"${SECRET}"`)
      expect((await read(root)).roots).toEqual([c])
      expect((await read(root)).roots).toEqual([c])
      expect(reportError).toHaveBeenCalledOnce()
      const report = vi.mocked(reportError).mock.calls[0][0]
      expect(report).toMatchObject({
        detail: expect.stringContaining(manifest),
        data: { file: manifest, reason: 'parse' }
      })
      expect(JSON.stringify(report)).not.toContain(SECRET)
    }
  )
})

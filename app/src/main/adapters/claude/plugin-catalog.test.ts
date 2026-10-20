import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readClaudePluginCatalog } from './plugin-catalog'

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
afterEach(() => rmSync(temp, { recursive: true, force: true }))

describe('native plugin catalog', () => {
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
    const result = readClaudePluginCatalog(join(cwd, 'subdir'), root)
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
    ).toEqual([active])
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
    expect(readClaudePluginCatalog(cwd, root)).toEqual({
      roots: [],
      skills: [],
      commands: [],
      installations: []
    })
    write(join(root, 'settings.json'), '{"secret":"private-value"')
    expect(() => readClaudePluginCatalog(cwd, root)).toThrow(
      'Claude 네이티브 확장 설정을 읽을 수 없습니다.'
    )
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

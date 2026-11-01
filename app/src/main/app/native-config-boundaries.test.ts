import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { configuredClaudeResources } from '../adapters/claude/configured-resources'
import {
  readClaudePluginCatalog,
  readClaudePluginCatalogAsync
} from '../adapters/claude/plugin-catalog'
import { claudePluginProjectRoot } from '../adapters/claude/project-path'
import {
  claudeProjectSettingsFiles,
  readClaudeProjectSettings
} from '../adapters/claude/project-settings'
import { persistClaudePluginState } from '../adapters/claude/plugin-state'
import { configuredOpenCodeResources } from '../adapters/opencode/v1/configured-resources'

let root: string, cwd: string, native: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-config-boundaries-'))
  cwd = join(root, 'a/b/c')
  native = join(root, 'native')
  await Promise.all([mkdir(cwd, { recursive: true }), mkdir(native), mkdir(join(root, '.git'))])
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('carries BOM JSON through configured Claude resources', async () => {
  const globalConfig = join(root, '.claude.json')
  await writeFile(globalConfig, '\uFEFF' + JSON.stringify({ mcpServers: { bom: {} } }))
  expect(await configuredClaudeResources(cwd, { root: native, globalConfig })).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'bom', kind: 'mcp' })])
  )
})
it('carries BOM JSON through synchronous and asynchronous plugin catalogs', async () => {
  await writeFile(
    join(native, 'settings.json'),
    '\uFEFF' + JSON.stringify({ enabledPlugins: { 'bom@market': true } })
  )
  expect(readClaudePluginCatalog(cwd, native).defaults).toEqual({ 'bom@market': true })
  expect((await readClaudePluginCatalogAsync(cwd, native)).defaults).toEqual({ 'bom@market': true })
})
it('carries BOM JSON through native project settings', async () => {
  await writeFile(
    claudeProjectSettingsFiles(cwd, native)[3],
    '\uFEFF' + JSON.stringify({ projects: { [cwd]: { disabledMcpServers: ['bom'] } } })
  )
  expect(readClaudeProjectSettings(cwd, native).disabledMcp).toEqual(['bom'])
})
it('preserves existing BOM-prefixed settings through plugin state writes', async () => {
  await mkdir(join(root, '.claude'))
  const file = join(root, '.claude/settings.local.json')
  await writeFile(file, '\uFEFF' + JSON.stringify({ env: { KEEP: 'yes' } }))
  await persistClaudePluginState(root, 'bom@market', true)
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
    env: { KEEP: 'yes' },
    enabledPlugins: { 'bom@market': true }
  })
})
it('finds the Git root through the Claude project path consumer', () => {
  expect(claudePluginProjectRoot(cwd)).toBe(root)
})
it('includes the Git-root MCP through the Claude resource consumer', async () => {
  const globalConfig = join(root, '.claude.json')
  await writeFile(
    globalConfig,
    JSON.stringify({ projects: { [root]: { mcpServers: { ancestor: {} } } } })
  )
  expect(await configuredClaudeResources(cwd, { root: native, globalConfig })).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'ancestor' })])
  )
})
it('includes the Git-root MCP through the OpenCode resource consumer', async () => {
  await writeFile(
    join(root, 'opencode.json'),
    JSON.stringify({ mcp: { ancestor: { type: 'local', command: ['echo'] } } })
  )
  expect(await configuredOpenCodeResources(cwd, { XDG_CONFIG_HOME: native })).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'ancestor' })])
  )
})

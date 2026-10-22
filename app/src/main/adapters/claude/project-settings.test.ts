import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir, homedir } from 'node:os'
import { beforeEach, afterEach, expect, it } from 'vitest'
import { claudeLocalSettingsRoot } from './project-path'
import { claudeProjectSettingsFiles, readClaudeProjectSettings } from './project-settings'
import { persistClaudePluginState } from './plugin-state'

let temp: string, cwd: string, root: string
beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), 'orca-project-settings-'))
  cwd = join(temp, 'project/child')
  root = join(temp, 'native')
  mkdirSync(join(temp, 'project/.git'), { recursive: true })
  mkdirSync(join(claudeLocalSettingsRoot(cwd), '.claude'), { recursive: true })
  mkdirSync(root, { recursive: true })
})
afterEach(() => rmSync(temp, { recursive: true, force: true }))
it('fingerprints only project extension keys and native project state, excluding other cwd and Git-root state', () => {
  const files = claudeProjectSettingsFiles(cwd, root)
  writeFileSync(
    files[1],
    JSON.stringify({ enabledPlugins: { 'p@m': false }, permissions: { allow: ['x'] } })
  )
  writeFileSync(
    files[3],
    JSON.stringify({ projects: { [join(temp, 'project')]: { disabledMcpServers: ['native'] } } })
  )
  const before = readClaudeProjectSettings(cwd, root)
  expect(before.disabledMcp).toEqual([])
  writeFileSync(
    files[1],
    JSON.stringify({ permissions: { allow: ['y'] }, enabledPlugins: { 'p@m': false } })
  )
  writeFileSync(
    files[3],
    JSON.stringify({
      mcpServers: { unrelated: {} },
      projects: {
        [join(temp, 'project')]: { disabledMcpServers: ['native'], trust: true },
        '/other': { disabledMcpServers: ['other'] }
      }
    })
  )
  expect(readClaudeProjectSettings(cwd, root).revision).toBe(before.revision)
  writeFileSync(files[1], JSON.stringify({ enabledPlugins: { 'p@m': true } }))
  expect(readClaudeProjectSettings(cwd, root).revision).not.toBe(before.revision)
  expect(readClaudeProjectSettings(cwd, root).structure).toBe(before.structure)
  writeFileSync(files[2], JSON.stringify({ mcpServers: { project: { command: 'private' } } }))
  expect(readClaudeProjectSettings(cwd, root).structure).not.toBe(before.structure)
})
it('writes only plugin choices in the platform-native local directory and preserves permissions', async () => {
  const file = claudeProjectSettingsFiles(cwd, root)[1]
  const unrelated = {
    permissions: { allow: ['Bash(test)'] },
    hooks: {},
    env: { KEEP: 'yes' },
    model: 'keep'
  }
  writeFileSync(file, JSON.stringify(unrelated))
  if (process.platform !== 'win32') {
    await expect(persistClaudePluginState(cwd, 'p@m', false)).rejects.toThrow()
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(unrelated)
    return
  }
  await persistClaudePluginState(cwd, 'p@m', false)
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
    ...unrelated,
    enabledPlugins: { 'p@m': false }
  })
  if (process.platform === 'win32') expect(file).toBe(join(cwd, '.claude/settings.local.json'))
})
it('rejects malformed and non-object files without leaking their contents', () => {
  const file = claudeProjectSettingsFiles(cwd, root)[1]
  for (const text of [
    '{"token":"private"',
    '[]',
    'null',
    '{"enabledPlugins":[]}',
    '{"enabledMcpjsonServers":{}}'
  ]) {
    writeFileSync(file, text)
    expect(() => readClaudeProjectSettings(cwd, root)).toThrow(
      '프로젝트 확장 설정을 읽을 수 없습니다.'
    )
    expect(readFileSync(file, 'utf8')).toBe(text)
  }
})
it('distinguishes an explicitly selected config directory from legacy home state even at the same root', () => {
  const native = join(homedir(), '.claude')
  expect(claudeProjectSettingsFiles(cwd, native, true)[3]).toBe(join(native, '.claude.json'))
  expect(claudeProjectSettingsFiles(cwd, native, false)[3]).toBe(join(homedir(), '.claude.json'))
})

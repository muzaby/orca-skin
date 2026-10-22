import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  chmodSync,
  statSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { persistClaudePluginState } from './plugin-state'
let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-plugin-state-'))
  mkdirSync(join(root, '.git'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
it('merges sibling choices and preserves unrelated settings in the current work directory', async () => {
  const directory = join(root, '.claude'),
    file = join(directory, 'settings.local.json')
  mkdirSync(directory)
  writeFileSync(
    file,
    JSON.stringify({ env: { EXISTING: 'kept' }, enabledPlugins: { 'one@market': true } })
  )
  if (process.platform !== 'win32') chmodSync(file, 0o600)
  await Promise.all([
    persistClaudePluginState(root, 'two@market', true),
    persistClaudePluginState(root, 'one@market', false)
  ])
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
    env: { EXISTING: 'kept' },
    enabledPlugins: { 'one@market': false, 'two@market': true }
  })
  expect(readdirSync(directory)).toEqual(['settings.local.json'])
  if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
})
it('creates a private local settings file and refuses malformed settings without overwriting their bytes', async () => {
  const file = join(root, '.claude/settings.local.json')
  await persistClaudePluginState(root, 'one@market', true)
  expect(JSON.parse(readFileSync(file, 'utf8')).enabledPlugins['one@market']).toBe(true)
  for (const original of ['{invalid', '{"enabledPlugins":[]}']) {
    writeFileSync(file, original)
    await expect(persistClaudePluginState(root, 'one@market', false)).rejects.toThrow('저장')
    expect(readFileSync(file, 'utf8')).toBe(original)
  }
})

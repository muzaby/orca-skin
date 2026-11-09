import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportError } from '../../infra/error-report'
import type { TurnRequest } from '../common/turn'
import { ClaudeAdapter } from './adapter'
import { loadClaudeSdk } from './sdk'

const { query } = vi.hoisted(() => ({
  query: vi.fn(() => ({
    async *[Symbol.asyncIterator]() {
      yield* []
    },
    close: vi.fn(),
    setPermissionMode: vi.fn(),
    interrupt: vi.fn()
  }))
}))
vi.mock('@anthropic-ai/claude-agent-sdk', async (original) => ({
  ...(await original<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query
}))
vi.mock('../../infra/error-report', () => ({ reportError: vi.fn() }))

let temp: string
let cwd: string
let root: string
let first: string
let second: string
const write = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value))
}
const plugin = (name: string): string => {
  const path = join(temp, name)
  write(join(path, '.claude-plugin/plugin.json'), { name })
  return path
}
beforeEach(() => {
  query.mockClear()
  vi.mocked(reportError).mockClear()
  temp = mkdtempSync(join(tmpdir(), 'orca-native-settings-spawn-'))
  cwd = join(temp, 'project')
  root = join(temp, 'claude')
  mkdirSync(join(cwd, '.git'), { recursive: true })
  first = plugin('first')
  second = plugin('second')
  write(join(root, 'plugins/installed_plugins.json'), {
    plugins: {
      'first@m': [{ scope: 'user', installPath: first }],
      'second@m': [{ scope: 'user', installPath: second }]
    }
  })
  write(join(cwd, '.claude/settings.json'), {
    enabledPlugins: { 'first@m': true, 'second@m': true }
  })
})
afterEach(() => rmSync(temp, { recursive: true, force: true }))

const request = (): TurnRequest => ({
  sessionId: null,
  cwd,
  text: 'hello',
  env: { CLAUDE_CONFIG_DIR: root },
  extensions: { skills: [], hooks: { normalized: {} } }
})
const send = (adapter: ClaudeAdapter): Options => {
  const live = adapter.sendMessage(request())
  const options = (query.mock.calls.at(-1) as unknown as [{ options: Options }])[0].options
  live.close()
  return options
}
const roots = (options: Options): string[] =>
  (options.plugins ?? []).map((entry) => (entry as { path: string }).path)

describe('Claude spawn with empty or broken native settings', () => {
  it.each(['', '﻿', '  \n', 'null'])(
    'spawns silently when ~/.claude/settings.json content is %j',
    (text) => {
      write(join(root, 'settings.json'), text)
      const adapter = new ClaudeAdapter()
      expect(roots(send(adapter))).toEqual([first, second])
      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('spawns without a broken settings file and warns once across sends', () => {
    const file = join(root, 'settings.json')
    write(file, '{"enabledPlugins":{"first@m":true},"token":"private-value",}')
    const adapter = new ClaudeAdapter()
    expect(roots(send(adapter))).toEqual([first, second])
    expect(roots(send(new ClaudeAdapter()))).toEqual([first, second])
    expect(query).toHaveBeenCalledTimes(2)
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][0]).toMatchObject({
      event: 'claude.native-settings.skipped',
      detail: expect.stringContaining(file)
    })
    expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain('private-value')
  })

  it('leaves out only the plugin whose manifest is broken', () => {
    const manifest = join(first, '.claude-plugin/plugin.json')
    write(manifest, '{"name":"first",')
    const options = send(new ClaudeAdapter())
    expect(roots(options)).toEqual([second])
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][0]).toMatchObject({
      detail: expect.stringContaining(manifest)
    })
  })
})

// The spawn boundary is synchronous only on the warm SDK path (sdk.test.ts covers the cold import).
await loadClaudeSdk()

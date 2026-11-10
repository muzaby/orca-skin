import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { NativeResources } from '../../../shared/native-resources'
import { CHANNELS } from '../../../shared/ipc'

const f = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, callback: (event: unknown, payload: unknown) => Promise<unknown>) =>
      f.handlers.set(channel, callback)
  },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() }
}))
vi.mock('electron-store', () => ({ default: class {} }))
vi.mock('../../infra/error-report', () => ({ reportError: vi.fn() }))

import { reportError } from '../../infra/error-report'
import { extensionControl } from '../extension-control'
import { registerExtensionCatalogHandlers } from './extension-catalog'

let home: string
const write = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value))
}
// The production module reads `os.homedir()`, so the home is injected explicitly.
beforeEach(() => {
  f.handlers.clear()
  vi.mocked(reportError).mockClear()
  home = mkdtempSync(join(tmpdir(), 'orcinus-orca-nav-claude-settings-'))
  vi.stubEnv('HOME', home)
  vi.stubEnv('USERPROFILE', home)
  vi.stubEnv('CLAUDE_CONFIG_DIR', '')
  expect(homedir()).toBe(home)
  const plugin = join(home, 'plugins', 'docs')
  write(join(plugin, '.claude-plugin/plugin.json'), { name: 'docs' })
  write(join(home, '.claude/plugins/installed_plugins.json'), {
    plugins: { 'docs@m': [{ scope: 'user', installPath: plugin }] }
  })
  registerExtensionCatalogHandlers(extensionControl(), {
    plan: () => ({ targets: [], busy: 0 }),
    close: vi.fn()
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(home, { recursive: true, force: true })
})
const read = async (): Promise<NativeResources> =>
  (await f.handlers.get(CHANNELS.extensionCatalog)!({}, { backend: 'claude' })) as NativeResources

it.each(['', '﻿', 'null'])(
  'lists the plugin tab silently when ~/.claude/settings.json content is %j',
  async (text) => {
    write(join(home, '.claude/settings.json'), text)
    expect((await read()).items.map((item) => item.name)).toEqual(['docs@m'])
    expect(reportError).not.toHaveBeenCalled()
  }
)

it('lists the plugin tab without a broken ~/.claude/settings.json and warns once', async () => {
  const file = join(home, '.claude/settings.json')
  write(file, '{"enabledPlugins":{"docs@m":true},"token":"private-value",}')
  expect((await read()).items.map((item) => item.name)).toEqual(['docs@m'])
  expect((await read()).items.map((item) => item.name)).toEqual(['docs@m'])
  expect(reportError).toHaveBeenCalledOnce()
  expect(vi.mocked(reportError).mock.calls[0][0]).toMatchObject({
    event: 'claude.native-settings.skipped',
    detail: expect.stringContaining(file)
  })
  expect(JSON.stringify(vi.mocked(reportError).mock.calls)).not.toContain('private-value')
})

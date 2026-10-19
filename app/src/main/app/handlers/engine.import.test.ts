import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS } from '../../../shared/protocol'

const h = vi.hoisted(() => ({
  home: '',
  handlers: new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>()
}))
vi.mock('node:os', async (original) => ({
  ...(await original<typeof import('node:os')>()),
  homedir: () => h.home
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, callback: (event: unknown, payload: unknown) => Promise<unknown>) =>
      h.handlers.set(channel, callback)
  }
}))
vi.mock('../../infra/log/registry', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn() }) })
}))
vi.mock('../../features/harnesses/common/settings-write', () => ({
  addHarnessSettings: vi.fn(),
  updateHarnessSettings: vi.fn(),
  deleteHarnessSettings: vi.fn(),
  readHarnessSettings: vi.fn()
}))
import { registerEngineHandlers } from './engine'

let root: string
const invoke = (payload?: unknown): Promise<unknown> =>
  h.handlers.get(CHANNELS.engineImportUserSettings)!({}, payload)
function write(path: string, raw: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, raw)
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-engine-import-'))
  h.home = root
  vi.stubEnv('XDG_CONFIG_HOME', '')
  h.handlers.clear()
  registerEngineHandlers({ deployExtensions: vi.fn(), harnessSettings: { invalidateAll: vi.fn() } })
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(root, { recursive: true, force: true })
})

describe('engine settings import IPC', () => {
  it('reads the selected harness global file and preserves legacy Claude callers', async () => {
    const claude = '{ "env": {"fixture": "claude"} }'
    const opencode = '{ "model": "fixture/한글" }'
    write(join(root, '.claude', 'settings.json'), claude)
    write(join(root, '.config', 'opencode', 'opencode.json'), opencode)
    expect(await invoke({ engine: 'opencode' })).toEqual({ exists: true, settingsJson: opencode })
    expect(await invoke({ engine: 'claude' })).toEqual({ exists: true, settingsJson: claude })
    expect(await invoke()).toEqual({ exists: true, settingsJson: claude })
  })

  it('respects XDG_CONFIG_HOME without accepting renderer paths', async () => {
    const config = join(root, 'xdg')
    vi.stubEnv('XDG_CONFIG_HOME', config)
    write(join(config, 'opencode', 'opencode.json'), '{broken')
    write(join(root, '.config', 'opencode', 'opencode.json'), '{"fallback":true}')
    expect(
      await invoke({ engine: 'opencode', path: join(root, '.claude', 'settings.json') })
    ).toEqual({ exists: true, settingsJson: '{broken' })
  })

  it('returns missing for an absent or unreadable OpenCode file without reading Claude', async () => {
    write(join(root, '.claude', 'settings.json'), '{"claude":true}')
    expect(await invoke({ engine: 'opencode' })).toEqual({ exists: false, settingsJson: '' })
    mkdirSync(join(root, '.config', 'opencode', 'opencode.json'), { recursive: true })
    expect(await invoke({ engine: 'opencode' })).toEqual({ exists: false, settingsJson: '' })
  })

  it.each([{}, { engine: 'other' }, { engine: '../claude' }, 'opencode', null])(
    'rejects an invalid harness payload %j',
    async (payload) => {
      await expect(invoke(payload)).rejects.toThrow()
    }
  )
})

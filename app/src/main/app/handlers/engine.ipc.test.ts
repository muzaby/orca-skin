import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS, type AgentEnvironment, type Backend } from '../../../shared/ipc'
import { registerEngineHandlers } from './engine'
import { registerMiscHandlers } from './misc'
import { createHarnessSettingsService } from '../harnesses/registry'
import { ClaudeAdapter } from '../../adapters/claude/adapter'
import { OpenCodeAdapter } from '../../adapters/opencode/v1/adapter'
import { orcaConfigDir } from '../../infra/config/paths'

const fixture = vi.hoisted(() => ({
  home: '',
  rejected: vi.fn(),
  callbacks: new Map<string, (event: unknown, raw: unknown) => Promise<unknown>>()
}))
vi.mock('node:os', async (original) => ({
  ...(await original<typeof import('node:os')>()),
  homedir: () => fixture.home
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (name: string, callback: (event: unknown, raw: unknown) => Promise<unknown>) =>
      fixture.callbacks.set(name, callback)
  },
  BrowserWindow: {},
  Notification: {}
}))
vi.mock('../../infra/log/registry', () => ({
  getLogger: () => ({ child: () => ({ warn: fixture.rejected }) })
}))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn(), debug: vi.fn() }) }),
  setConsoleMirror: vi.fn()
}))
vi.mock('../../infra/ipc/send', () => ({ sendInstallStatus: vi.fn(), setWireLog: vi.fn() }))
vi.mock('../../infra/ipc/wire-log', () => ({ setWireSink: vi.fn() }))
vi.mock('../../infra/config/orca-config', () => ({ getOrcaConfig: () => ({}), appEnv: () => ({}) }))

const invoke = async (channel: string, raw?: unknown): Promise<unknown> =>
  fixture.callbacks.get(channel)!({}, raw)
const deploy = vi.fn(async () => {})
const acquire = vi.fn()
const fetchImpl = vi.fn()
const settingsJson = (backend: Backend, model: string): string =>
  JSON.stringify(
    backend === 'claude'
      ? { env: { ANTHROPIC_DEFAULT_SONNET_MODEL: model } }
      : { provider: { shared: { models: { [model]: { name: `OpenCode ${model}` } } } } }
  )
const file = (backend: Backend): string =>
  join(orcaConfigDir(), 'sources', 'settings', backend, 'shared', 'settings.json')

beforeEach(() => {
  fixture.home = mkdtempSync(join(tmpdir(), 'orca-engine-ipc-'))
  fixture.callbacks.clear()
  vi.clearAllMocks()
  const settings = createHarnessSettingsService()
  const claude = new ClaudeAdapter()
  const opencode = new OpenCodeAdapter({ acquire, installed: vi.fn(), close: vi.fn() }, fetchImpl)
  registerEngineHandlers({ deployExtensions: deploy, harnessSettings: settings })
  registerMiscHandlers({
    registry: {
      list: () => [{ id: 'claude' }, { id: 'opencode' }],
      get: (backend: Backend) => (backend === 'claude' ? claude : opencode)
    },
    harnessSettings: settings,
    debugMock: { log: false },
    mcp: { resolver: () => () => undefined }
  } as never)
})
afterEach(() => {
  rmSync(fixture.home, { recursive: true, force: true })
})

describe('engine IPC registration through the real validator and settings services', () => {
  it.each(['unknown', 'work', '../claude', '', null, 42])(
    'rejects an unregistered engine %j at the IPC boundary before any side effects',
    async (engine) => {
      await expect(
        invoke(CHANNELS.engineAdd, { engine, provider: 'shared', settingsJson: '{}' })
      ).rejects.toMatchObject({ name: 'ZodError' })
      expect(fixture.rejected).toHaveBeenCalledExactlyOnceWith('ipc.payload.rejected', {
        channel: CHANNELS.engineAdd,
        policy: 'reject'
      })
      expect(existsSync(orcaConfigDir())).toBe(false)
      expect(deploy).not.toHaveBeenCalled()
      expect(await invoke(CHANNELS.agentList)).toEqual([])
    }
  )

  it.each([
    [CHANNELS.engineAdd, { engine: 'opencode', provider: '', settingsJson: '{}' }],
    [CHANNELS.engineUpdate, { key: '', settingsJson: '{}' }],
    [CHANNELS.engineRead, { key: '' }],
    [CHANNELS.engineDelete, { key: '' }],
    [CHANNELS.engineImportUserSettings, { engine: 'unknown' }]
  ])('validates the registered %s payload', async (channel, raw) => {
    await expect(invoke(channel, raw)).rejects.toMatchObject({ name: 'ZodError' })
    expect(fixture.rejected).toHaveBeenCalledWith('ipc.payload.rejected', {
      channel,
      policy: 'reject'
    })
    expect(existsSync(orcaConfigDir())).toBe(false)
    expect(deploy).not.toHaveBeenCalled()
  })

  it.each(['claude', 'opencode'] as const)(
    'creates, reads, updates, lists and deletes only the selected %s engine',
    async (selected) => {
      const original = {
        claude: settingsJson('claude', 'claude-original'),
        opencode: settingsJson('opencode', 'open-original')
      }
      for (const backend of ['claude', 'opencode'] as const) {
        expect(
          await invoke(CHANNELS.engineAdd, {
            engine: backend,
            provider: 'shared',
            settingsJson: original[backend]
          })
        ).toEqual({ key: `${backend}-shared`, engine: backend, provider: 'shared' })
        expect(await invoke(CHANNELS.engineRead, { key: `${backend}-shared` })).toMatchObject({
          key: `${backend}-shared`,
          engine: backend,
          settingsJson: expect.any(String)
        })
      }
      const other = selected === 'claude' ? 'opencode' : 'claude'
      const untouched = readFileSync(file(other))
      const before = (await invoke(CHANNELS.agentList)) as AgentEnvironment[]
      expect(before.map((agent) => agent.key).sort()).toEqual(['claude-shared', 'opencode-shared'])
      expect(
        before.find((agent) => agent.adapter === 'claude')?.models.map((m) => m.model)
      ).toEqual(['claude-original'])
      expect(
        before.find((agent) => agent.adapter === 'opencode')?.models.map((m) => m.model)
      ).toEqual(['shared/open-original'])

      const next = settingsJson(selected, `${selected}-changed`)
      deploy.mockClear()
      await invoke(CHANNELS.engineUpdate, { key: `${selected}-shared`, settingsJson: next })
      const read = (await invoke(CHANNELS.engineRead, { key: `${selected}-shared` })) as {
        settingsJson: string
      }
      expect(JSON.parse(read.settingsJson)).toEqual(JSON.parse(next))
      expect(readFileSync(file(other))).toEqual(untouched)
      const changed = (await invoke(CHANNELS.agentList)) as AgentEnvironment[]
      expect(
        changed.find((agent) => agent.adapter === selected)?.models.map((m) => m.model)
      ).toEqual([selected === 'claude' ? 'claude-changed' : 'shared/opencode-changed'])
      expect(changed.find((agent) => agent.adapter === other)).toEqual(
        before.find((agent) => agent.adapter === other)
      )
      expect(deploy).toHaveBeenCalledTimes(selected === 'claude' ? 1 : 0)

      await invoke(CHANNELS.engineDelete, { key: `${selected}-shared` })
      expect(existsSync(file(selected))).toBe(false)
      expect(readFileSync(file(other))).toEqual(untouched)
      expect(
        ((await invoke(CHANNELS.agentList)) as AgentEnvironment[]).map((agent) => agent.key)
      ).toEqual([`${other}-shared`])
      expect(acquire).not.toHaveBeenCalled()
      expect(fetchImpl).not.toHaveBeenCalled()
    }
  )
})

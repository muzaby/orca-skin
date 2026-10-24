import { beforeEach, expect, it, vi } from 'vitest'
import type { NativeResources } from '../../../shared/native-resources'
import { CHANNELS } from '../../../shared/ipc'
const f = vi.hoisted(() => ({
  native: false,
  handlers: new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>(),
  open: vi.fn(async () => ''),
  read: vi.fn(),
  path: vi.fn(async () => '/installed/plugin')
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, callback: (event: unknown, payload: unknown) => Promise<unknown>) =>
      f.handlers.set(channel, callback)
  },
  shell: { openPath: f.open, showItemInFolder: f.open }
}))
vi.mock('electron-store', () => ({ default: class {} }))
vi.mock('../harnesses/registry', () => ({
  harnessModule: (backend: string) => ({
    globalResources: async () => {
      f.read(backend)
      return [
        {
          id: 'plugin-id',
          name: 'superpowers@market',
          kind: 'plugin',
          enabled: f.native,
          status: f.native ? 'configured' : 'disabled',
          canToggle: backend === 'claude',
          canOpen: true
        },
        {
          id: 'docs',
          name: 'docs',
          kind: 'mcp',
          enabled: true,
          status: 'configured',
          canToggle: backend === 'opencode',
          canOpen: false
        }
      ]
    },
    globalResourcePath: f.path
  })
}))
import { SettingsStore } from '../../infra/settings-store'
import { registerExtensionCatalogHandlers } from './extension-catalog'
import { extensionControl } from '../extension-control'

beforeEach(() => {
  f.handlers.clear()
  f.native = false
  f.open.mockClear()
  f.read.mockClear()
})
const invoke = async (channel: string, payload: unknown): Promise<NativeResources> =>
  (await f.handlers.get(channel)!({}, payload)) as NativeResources

it('reads native defaults without copying them and keeps supported explicit choices only in memory', async () => {
  const backend = { store: {} as Record<string, unknown> }
  const settings = new SettingsStore('test', backend)
  settings.patch({ language: 'sentinel-language' })
  const control = extensionControl()
  const processes = { plan: vi.fn(() => ({ targets: [], busy: 0 })), close: vi.fn() }
  registerExtensionCatalogHandlers(control, processes)
  expect((await invoke(CHANNELS.extensionCatalog, { backend: 'claude' })).items[0].enabled).toBe(
    false
  )
  expect(backend.store.nativeExtensionChoices).toBeUndefined()
  f.native = true
  expect((await invoke(CHANNELS.extensionCatalog, { backend: 'claude' })).items[0].enabled).toBe(
    true
  )
  const result = (await f.handlers.get(CHANNELS.extensionSetEnabled)!(
    {},
    {
      backend: 'claude',
      id: 'plugin-id',
      kind: 'plugin',
      enabled: false
    }
  )) as { status: 'applied'; resources: NativeResources }
  expect(result.status).toBe('applied')
  expect(processes.close).toHaveBeenCalledWith([])
  expect(result.resources.items[0]).toMatchObject({
    enabled: false,
    canToggle: true
  })
  expect(backend.store.nativeExtensionChoices).toBeUndefined()
  expect(control.global('claude')).toEqual({ 'plugin:superpowers@market': false })
  expect(backend.store.language).toBe('sentinel-language')
  await expect(
    invoke(CHANNELS.extensionSetEnabled, {
      backend: 'claude',
      id: 'docs',
      kind: 'mcp',
      enabled: false
    })
  ).rejects.toThrow('제어')
  await expect(
    invoke(CHANNELS.extensionSetEnabled, {
      backend: 'opencode',
      id: 'plugin-id',
      kind: 'plugin',
      enabled: false
    })
  ).rejects.toThrow('제어')
  await expect(
    invoke(CHANNELS.extensionOpen, { backend: 'opencode', id: 'docs', kind: 'mcp' })
  ).rejects.toThrow('위치')
  expect(f.open).not.toHaveBeenCalled()
  await invoke(CHANNELS.extensionOpen, { backend: 'claude', id: 'plugin-id', kind: 'plugin' })
  expect(f.open).toHaveBeenCalledWith('/installed/plugin')
  const reloaded = new SettingsStore('test', { store: JSON.parse(JSON.stringify(backend.store)) })
  expect(reloaded.getAll().nativeExtensionChoices).toBeUndefined()
  expect(extensionControl().global('claude')).toEqual({})
})

it('does not reactivate legacy choice bytes or accept writes through settings.patch', () => {
  const legacy = {
    nativeExtensionChoices: { claude: { 'plugin:old': true } },
    projectMcpChoices: { '/A': { docs: false } }
  }
  const backend = { store: { ...legacy } as Record<string, unknown> }
  const settings = new SettingsStore('test', backend)
  settings.getAll()
  expect(extensionControl().global('claude')).toEqual({})
  settings.patch({ nativeExtensionChoices: {} } as never)
  settings.patch({ projectMcpChoices: {} } as never)
  expect(backend.store.nativeExtensionChoices).toBeUndefined()
  expect(backend.store.projectMcpChoices).toEqual(legacy.projectMcpChoices)
})

it('saves and closes in the same synchronous section as the busy check', async () => {
  const order: string[] = []
  const control = extensionControl()
  const save = control.setGlobal.bind(control)
  vi.spyOn(control, 'setGlobal').mockImplementation((...args) => {
    order.push('save')
    save(...args)
  })
  const targets = [{ sessionId: 'claude-idle', busy: false }]
  const processes = {
    plan: vi.fn(() => {
      order.push('plan')
      queueMicrotask(() => order.push('intruder'))
      return { targets, busy: 0 }
    }),
    close: vi.fn(() => {
      order.push('close')
    })
  }
  registerExtensionCatalogHandlers(control, processes)
  await expect(
    invoke(CHANNELS.extensionSetEnabled, {
      backend: 'claude',
      id: 'plugin-id',
      kind: 'plugin',
      enabled: false
    })
  ).resolves.toMatchObject({ status: 'applied' })
  expect(order).toEqual(['plan', 'save', 'close', 'intruder'])
  expect(processes.close).toHaveBeenCalledExactlyOnceWith(targets)
  expect(control.global('claude')).toEqual({ 'plugin:superpowers@market': false })
})

it('rejects confirmed: false before planning or saving', async () => {
  const control = extensionControl()
  const save = vi.spyOn(control, 'setGlobal')
  const processes = { plan: vi.fn(() => ({ targets: [], busy: 1 })), close: vi.fn() }
  registerExtensionCatalogHandlers(control, processes)
  const request = { backend: 'claude', id: 'plugin-id', kind: 'plugin', enabled: false }
  await expect(
    invoke(CHANNELS.extensionSetEnabled, { ...request, confirmed: false })
  ).rejects.toThrow()
  expect(processes.plan).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
  expect(processes.close).not.toHaveBeenCalled()
  expect(control.global('claude')).toEqual({})
  await expect(
    invoke(CHANNELS.extensionSetEnabled, { ...request, confirmed: true })
  ).resolves.toMatchObject({ status: 'applied' })
  expect(processes.plan).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledExactlyOnceWith('claude', 'plugin:superpowers@market', false)
})

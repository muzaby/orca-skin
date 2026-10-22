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
  registerExtensionCatalogHandlers(control)
  expect((await invoke(CHANNELS.extensionCatalog, { backend: 'claude' })).items[0].enabled).toBe(
    false
  )
  expect(backend.store.nativeExtensionChoices).toBeUndefined()
  f.native = true
  expect((await invoke(CHANNELS.extensionCatalog, { backend: 'claude' })).items[0].enabled).toBe(
    true
  )
  const result = await invoke(CHANNELS.extensionSetEnabled, {
    backend: 'claude',
    id: 'plugin-id',
    kind: 'plugin',
    enabled: false
  })
  expect(result.items[0]).toMatchObject({ enabled: false, canToggle: true })
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
  expect(backend.store.nativeExtensionChoices).toEqual(legacy.nativeExtensionChoices)
  expect(backend.store.projectMcpChoices).toEqual(legacy.projectMcpChoices)
})

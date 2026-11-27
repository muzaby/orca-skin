import { beforeEach, expect, it, vi } from 'vitest'
import type { NativeResources } from '../../../shared/native-resources'
import { CHANNELS } from '../../../shared/ipc'
const f = vi.hoisted(() => ({
  native: false,
  open: vi.fn(async () => ''),
  reveal: vi.fn(),
  mcpOpen: false,
  read: vi.fn(),
  path: vi.fn(async () => '/installed/plugin')
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
          canOpen: f.mcpOpen
        }
      ]
    },
    globalResourcePath: f.path
  })
}))
import { SettingsStore } from '../../infra/settings-store'
import { registerExtensionCatalogHandlers } from './extension-catalog'
import { extensionControl } from '../extension-control'
import { installFakeShellServices } from '../../infra/shell-services.testfixture'
import { invokeChannel } from '../../infra/ipc/test-transport.testfixture'

// 폴더 열기는 셸 서비스로 간다(0324 EP-10).
installFakeShellServices({
  'external.openPath': f.open,
  'external.showItemInFolder': f.reveal
})

beforeEach(() => {
  f.native = false
  f.open.mockClear()
  f.reveal.mockClear()
  f.mcpOpen = false
  f.read.mockClear()
})
const invoke = async (channel: string, payload: unknown): Promise<NativeResources> =>
  (await invokeChannel(channel, payload)) as NativeResources

it('stores a preference only after durable write and keeps observations per session', async () => {
  const disk = { store: {} as Record<string, unknown> }
  const store = new SettingsStore('test', disk)
  const save = vi.fn(async (backend: 'claude' | 'opencode', key: string, enabled: boolean) =>
    store.setNativeExtensionChoice(backend, key, enabled)
  )
  const changed = vi.fn()
  const control = extensionControl({
    get: () => store.getAll().nativeExtensionChoices,
    setChoice: save
  })
  registerExtensionCatalogHandlers(
    control,
    changed,
    async () => [],
    async () =>
      [true, false].map((enabled, i) => ({
        sessionId: `S${i}`,
        items: [
          {
            id: 'plugin-id',
            kind: 'plugin',
            name: 'superpowers@market',
            enabled,
            status: enabled ? 'enabled' : 'disabled',
            canToggle: true
          }
        ]
      }))
  )
  const request = { backend: 'claude', kind: 'plugin', id: 'plugin-id', enabled: false }
  save.mockRejectedValueOnce(new Error('disk full'))
  await expect(invoke(CHANNELS.extensionSetEnabled, request)).rejects.toThrow('disk full')
  expect(changed).not.toHaveBeenCalled()
  expect(control.global('claude')).toEqual({})
  await expect(invoke(CHANNELS.extensionSetEnabled, request)).resolves.toMatchObject({
    status: 'applied',
    resources: {
      items: expect.arrayContaining([
        expect.objectContaining({
          selected: false,
          pendingSessions: 1,
          observations: [
            { sessionId: 'S0', status: 'enabled' },
            { sessionId: 'S1', status: 'disabled' }
          ]
        })
      ])
    }
  })
  expect(changed).toHaveBeenCalledExactlyOnceWith('claude')
  expect(new SettingsStore('test', disk).getAll().nativeExtensionChoices?.claude).toEqual({
    'plugin:superpowers@market': false
  })
  for (const [backend, kind, id] of [
    ['opencode', 'plugin', 'plugin-id'],
    ['claude', 'mcp', 'docs']
  ])
    await expect(
      invoke(CHANNELS.extensionSetEnabled, { backend, kind, id, enabled: true })
    ).rejects.toThrow('제어')
  expect(save).toHaveBeenCalledTimes(2)
  await invoke(CHANNELS.extensionOpen, { backend: 'claude', kind: 'plugin', id: 'plugin-id' })
  expect(f.open).toHaveBeenCalledWith('/installed/plugin')
})

it('retains saved native choices, discards project choices and rejects direct settings patches', () => {
  // `projectMcpChoices` 는 스키마에서 사라진 구 키다 — 남은 바이트가 로드를 막거나 다른 키를
  // 지우면 안 되고, patch 로 되살아나서도 안 된다.
  const legacy = {
    nativeExtensionChoices: { claude: { 'plugin:old': true } },
    projectMcpChoices: { '/A': { docs: false } },
    language: 'English'
  }
  const backend = { store: { ...legacy } as Record<string, unknown> }
  const settings = new SettingsStore('test', backend)
  expect(settings.getAll().language).toBe('English')
  expect(settings.getAll()).not.toHaveProperty('projectMcpChoices')
  expect(extensionControl().global('claude')).toEqual({})
  settings.patch({ nativeExtensionChoices: {} } as never)
  settings.patch({ projectMcpChoices: { '/B': { docs: true } } } as never)
  expect(backend.store.nativeExtensionChoices).toEqual(legacy.nativeExtensionChoices)
  expect(settings.getAll()).not.toHaveProperty('projectMcpChoices')
  expect(settings.getAll().language).toBe('English')
  expect(JSON.stringify(backend.store)).not.toContain('/B')
})

it('MCP 항목은 설정 파일을 탐색기에서 보여 주고 열지 않는다 (0324 EP-10)', async () => {
  f.mcpOpen = true
  registerExtensionCatalogHandlers(extensionControl())
  await invoke(CHANNELS.extensionOpen, { backend: 'claude', id: 'docs', kind: 'mcp' })
  expect(f.reveal).toHaveBeenCalledExactlyOnceWith('/installed/plugin')
  expect(f.open).not.toHaveBeenCalled()
})

// 0179 — `misc.ts` 분해 회귀. 채널 등록을 파일 사이로 옮기는 작업의 유일한 실패 모드는
// **하나가 조용히 사라지는 것**이다(핸들러 미등록 = renderer invoke 가 영영 pending).
// 현재 등록되어야 하는 채널을 리터럴로 고정하고 모듈들의 등록 집합과 대조한다.

import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import { AdapterRegistry } from '../../adapters/common/registry'
import type { SessionAdapter } from '../../adapters/common/types'

const registered = vi.hoisted(() => [] as string[])
const handlers = vi.hoisted(() => new Map<string, (event: unknown, raw: unknown) => unknown>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (event: unknown, raw: unknown) => unknown) => {
      registered.push(channel)
      handlers.set(channel, fn)
    })
  },
  BrowserWindow: { fromWebContents: vi.fn() },
  Notification: { isSupported: () => false },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() }
}))

const { registerMiscHandlers } = await import('./misc')
const { registerSettingsHandlers, registerSettingsReadHandler } = await import('./settings')
const { registerSkillsHandlers } = await import('./skills')
const { registerFilesHandlers } = await import('./files')
const { registerCostHandlers } = await import('./cost')

// 각 모듈이 현재 등록해야 하는 채널 전수. dev 전용 2종(debugGetMock·debugSetMock)은
// `import.meta.env.DEV` 게이트 안이라 vitest(DEV=true)에서도 등록된다.
const EXPECTED = [
  CHANNELS.backendList,
  CHANNELS.harnessRecheck,
  CHANNELS.agentList,
  CHANNELS.installStart,
  CHANNELS.settingsGet,
  CHANNELS.settingsSet,
  CHANNELS.skillsList,
  CHANNELS.skillsAuthor,
  CHANNELS.skillsUpload,
  CHANNELS.skillsSetEnabled,
  CHANNELS.skillsOpen,
  CHANNELS.skillsShowInFolder,
  CHANNELS.skillsRemove,
  CHANNELS.filesList,
  CHANNELS.filesPickAttachments,
  CHANNELS.filesPickDirectory,
  CHANNELS.filesOpenPath,
  CHANNELS.filesOpenContextFile,
  CHANNELS.filesReadAttachment,
  CHANNELS.searchMessages,
  CHANNELS.costUsage,
  CHANNELS.costRefreshUsage,
  CHANNELS.costSetProviderLimit,
  CHANNELS.costUsageStats,
  CHANNELS.notifyShow,
  CHANNELS.debugGetMock,
  CHANNELS.debugSetMock
]

const ctx = {
  registry: { describeAll: () => ({}), list: () => [], getActiveId: () => null },
  harnessSettings: { adapters: () => [], list: () => [] },
  settings: { getAll: () => ({ skillEnabled: {} }) },
  getSkills: () => [],
  getCwd: () => '/tmp',
  db: {},
  cost: {},
  debugMock: { log: false }
} as never

describe('handlers/misc 분해 (0179)', () => {
  it('preserves backend keys, rechecks the requested harness and refreshes after the install stream', async () => {
    const probe = vi
      .fn<SessionAdapter['isInstalled']>()
      .mockResolvedValue({ installed: false, usable: false, reason: 'missing' })
    const registry = new AdapterRegistry(
      [
        {
          id: 'claude',
          isInstalled: async () => ({ installed: true, version: '3.0' }),
          describe: () => ({ marker: 'claude' })
        },
        {
          id: 'opencode',
          isInstalled: probe,
          describe: () => ({ marker: 'opencode' }),
          install: async function* () {
            yield { step: 'complete', done: true }
          }
        }
      ] as unknown as SessionAdapter[],
      null
    )
    await registry.refreshInstallState()
    const changed = vi.fn()
    registry.onAvailabilityChange(changed)
    registerMiscHandlers({ registry, debugMock: { log: false } } as never)
    expect(handlers.get(CHANNELS.backendList)?.({}, undefined)).toEqual({
      backends: [
        {
          id: 'claude',
          installed: true,
          version: '3.0',
          usable: true,
          capabilities: { marker: 'claude' }
        },
        {
          id: 'opencode',
          installed: false,
          usable: false,
          unavailableReason: 'missing',
          capabilities: { marker: 'opencode' }
        }
      ]
    })
    probe.mockResolvedValue({ installed: true, version: '1.19', usable: true })
    await expect(
      handlers.get(CHANNELS.harnessRecheck)?.({}, { backend: 'opencode' })
    ).resolves.toEqual({ id: 'opencode', installed: true, version: '1.19', usable: true })
    expect(changed).toHaveBeenCalledOnce()
    const refresh = vi.spyOn(registry, 'refreshInstallState')
    const send = vi.fn()
    await handlers.get(CHANNELS.installStart)?.(
      { sender: { send, isDestroyed: () => false } },
      { backend: 'opencode' }
    )
    expect(send).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledExactlyOnceWith('opencode')
    expect(changed).toHaveBeenCalledOnce()
    registry.close()
  })
  it('모듈들이 필요한 채널을 정확히 등록한다 (중복 0)', () => {
    registered.length = 0

    // 0244 — 설정 읽기는 `start()` 첫 문장에서 따로 등록된다. 두 등록 함수를 합쳐도 설정
    // 채널이 정확히 1회씩이어야 한다(두 번째 `ipcMain.handle` 은 Electron 에서 throw).
    registerSettingsReadHandler((ctx as { settings: { getAll: () => never } }).settings)
    registerSettingsHandlers(ctx)
    registerSkillsHandlers(ctx)
    registerFilesHandlers(ctx)
    registerCostHandlers(ctx)
    registerMiscHandlers(ctx)

    expect([...registered].sort()).toEqual([...EXPECTED].sort())
    expect(new Set(registered).size).toBe(registered.length)
  })

  it('0244 — 조기 등록 읽기 핸들러는 SettingsStore.getAll() 의 공개 설정을 돌려주고 쓰기 모듈은 읽기를 등록하지 않는다', () => {
    registered.length = 0
    handlers.clear()
    const snapshot = { theme: 'dark', uiLocale: 'en' }
    registerSettingsReadHandler({ getAll: () => snapshot as never })
    expect(registered).toEqual([CHANNELS.settingsGet])
    expect(handlers.get(CHANNELS.settingsGet)?.({}, undefined)).toEqual(snapshot)

    registered.length = 0
    registerSettingsHandlers(ctx)
    expect(registered).toEqual([CHANNELS.settingsSet])
  })
})

// 0179 — `misc.ts` 분해 회귀. 채널 등록을 파일 사이로 옮기는 작업의 유일한 실패 모드는
// **하나가 조용히 사라지는 것**이다(핸들러 미등록 = renderer invoke 가 영영 pending).
// 등록 전수(0179 당시 26 → 0183 r2 에서 `cost:refreshProviderUsageReport` 제거로 25 →
// 0186 에서 `cost:summary`+`cost:providerSummaries` 가 `cost:usage` 하나로 접혀 24 →
// **0186 라운드 2 에서 원격 즉시 동기화 `cost:refreshUsage` 신설로 25**)를
// 리터럴로 고정하고, 5개 모듈의 등록 집합과 대조한다.

import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'

const registered = vi.hoisted(() => [] as string[])

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string) => {
      registered.push(channel)
    })
  },
  BrowserWindow: { fromWebContents: vi.fn() },
  Notification: { isSupported: () => false },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() }
}))

const { registerMiscHandlers } = await import('./misc')
const { registerSettingsHandlers } = await import('./settings')
const { registerSkillsHandlers } = await import('./skills')
const { registerFilesHandlers } = await import('./files')
const { registerCostHandlers } = await import('./cost')

// 분해 전 `misc.ts` 가 등록하던 채널 전수. dev 전용 2종(debugGetMock·debugSetMock)은
// `import.meta.env.DEV` 게이트 안이라 vitest(DEV=true)에서도 등록된다.
const EXPECTED = [
  CHANNELS.backendList,
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
  it('5개 모듈이 25개 채널을 정확히 그대로 등록한다 (중복 0)', () => {
    registered.length = 0

    registerSettingsHandlers(ctx)
    registerSkillsHandlers(ctx)
    registerFilesHandlers(ctx)
    registerCostHandlers(ctx)
    registerMiscHandlers(ctx)

    expect([...registered].sort()).toEqual([...EXPECTED].sort())
    expect(new Set(registered).size).toBe(registered.length)
  })
})

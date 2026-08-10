// 게이트 우회 토글이 **재시작 없이** 반영되는지 (0181).
//
// 회귀 위험은 "설정은 저장됐는데 화면이 옛 판정에 머무는 것" 이다 — 사용자는 토글을 켰는데
// 로그인 화면이 그대로라 토글이 고장 난 것처럼 보인다. 조용히 실패하는 종류라 테스트로 잡는다.

import { describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import type { RouterContext } from '../context'

const handlers = vi.hoisted(() => new Map<string, (raw: unknown) => unknown>())
const broadcast = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (event: unknown, raw: unknown) => unknown) => {
      handlers.set(channel, (raw) => fn({}, raw))
    })
  }
}))
vi.mock('../../infra/ipc/send', () => ({ broadcastProviderState: broadcast }))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ info: vi.fn(), warn: vi.fn() }) })
}))

const { registerSettingsHandlers } = await import('./settings')

function ctx(overrides: { providers?: RouterContext['providers'] } = {}): RouterContext {
  return {
    settings: {
      getAll: () => ({ authBypass: false }),
      patch: (raw: unknown) => ({ ...(raw as object), scheduler: {} })
    },
    scheduler: { applySettings: vi.fn() },
    ...overrides
  } as unknown as RouterContext
}

const platform = (): RouterContext['providers'] =>
  ({
    state: () => ({
      gate: { required: true, passed: true, bypassed: true },
      providers: [],
      step: null
    })
  }) as unknown as RouterContext['providers']

describe('settings:set — 게이트 우회 반영 (0181)', () => {
  it('authBypass 가 바뀌면 provider 상태를 push 한다', () => {
    broadcast.mockClear()
    registerSettingsHandlers(ctx({ providers: platform() }))
    handlers.get(CHANNELS.settingsSet)?.({ authBypass: true })
    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(broadcast.mock.calls[0]?.[0]).toMatchObject({ gate: { bypassed: true } })
  })

  it('무관한 키만 바뀌면 push 하지 않는다', () => {
    broadcast.mockClear()
    registerSettingsHandlers(ctx({ providers: platform() }))
    handlers.get(CHANNELS.settingsSet)?.({ theme: 'dark' })
    expect(broadcast).not.toHaveBeenCalled()
  })

  it('provider 플랫폼이 없으면 조용히 넘어간다 (테스트 하네스 경로)', () => {
    broadcast.mockClear()
    registerSettingsHandlers(ctx())
    expect(() => handlers.get(CHANNELS.settingsSet)?.({ authBypass: true })).not.toThrow()
    expect(broadcast).not.toHaveBeenCalled()
  })
})

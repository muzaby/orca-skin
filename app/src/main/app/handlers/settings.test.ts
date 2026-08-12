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

const recordAndBroadcast = vi.fn()

function ctx(overrides: { providers?: RouterContext['providers'] } = {}): RouterContext {
  return {
    settings: {
      getAll: () => ({ authBypass: false }),
      patch: (raw: unknown) => ({ ...(raw as object), scheduler: {} })
    },
    scheduler: { applySettings: vi.fn() },
    cost: { recordAndBroadcast },
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

// 같은 종류의 회귀 — 한도는 **사용량 뷰의 입력**(budget·pct)이라, 설정만 바꾸고 push 하지 않으면
// 도넛이 다음 턴 종료까지 옛 한도의 퍼센트를 보여준다 (0186 라운드 2 / PR 329 리뷰 P2-3).
describe('settings:set — 전역 월 한도 반영 (0186)', () => {
  it('spendingLimitUsd 가 바뀌면 사용량 뷰를 다시 push 한다', () => {
    recordAndBroadcast.mockClear()
    registerSettingsHandlers(ctx())
    handlers.get(CHANNELS.settingsSet)?.({ spendingLimitUsd: 300 })
    expect(recordAndBroadcast).toHaveBeenCalledTimes(1)
  })

  it('한도를 지우는(null) 것도 변경이다', () => {
    recordAndBroadcast.mockClear()
    registerSettingsHandlers(ctx())
    handlers.get(CHANNELS.settingsSet)?.({ spendingLimitUsd: null })
    expect(recordAndBroadcast).toHaveBeenCalledTimes(1)
  })

  it('무관한 키만 바뀌면 push 하지 않는다', () => {
    recordAndBroadcast.mockClear()
    registerSettingsHandlers(ctx())
    handlers.get(CHANNELS.settingsSet)?.({ theme: 'dark' })
    expect(recordAndBroadcast).not.toHaveBeenCalled()
  })
})

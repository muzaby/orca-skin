// 설정이 **파생 상태의 입력**인 자리가 재시작 없이 반영되는지 (0181 게이트 우회 · 0186 전역 한도).
//
// 회귀 위험은 둘 다 "설정은 저장됐는데 화면이 옛 값에 머무는 것" 이다 — 사용자는 토글/한도를
// 바꿨는데 화면이 그대로라 기능이 고장 난 것처럼 보인다. 조용히 실패하는 종류라 테스트로 잡는다.
//
// 0187 에서 판정이 `settings:set` 핸들러에서 이 모듈로 옮겨졌다 — 범용 핸들러가 provider
// 플랫폼과 사용량 tracker 를 알 이유가 없다. 지키는 동작은 그대로다.

import { describe, expect, it, vi } from 'vitest'
import type { ProviderPlatformState } from '../../shared/ipc'
import { registerSettingsReactions, type SettingsPatchSource } from './settings-reactions'

// `SettingsStore.patch` 대신 changedKeys 를 직접 흘려 넣는 최소 소스.
function fakeSettings(): SettingsPatchSource & { emit(keys: readonly string[]): void } {
  const listeners: ((next: unknown, keys: readonly string[]) => void)[] = []
  return {
    onPatch: (listener) => {
      listeners.push(listener)
    },
    emit: (keys) => {
      for (const listener of listeners) listener({}, keys)
    }
  }
}

const state = (): ProviderPlatformState =>
  ({
    gate: { required: true, passed: true, bypassed: true },
    providers: [],
    step: null
  }) as unknown as ProviderPlatformState

describe('게이트 우회 반영 (0181)', () => {
  it('authBypass 가 바뀌면 provider 상태를 push 한다', () => {
    const settings = fakeSettings()
    const broadcastProviderState = vi.fn()
    registerSettingsReactions(settings, {
      providers: { state },
      broadcastProviderState,
      cost: { recordAndBroadcast: vi.fn() }
    })

    settings.emit(['authBypass'])

    expect(broadcastProviderState).toHaveBeenCalledTimes(1)
    expect(broadcastProviderState.mock.calls[0]?.[0]).toMatchObject({ gate: { bypassed: true } })
  })

  it('무관한 키만 바뀌면 push 하지 않는다', () => {
    const settings = fakeSettings()
    const broadcastProviderState = vi.fn()
    registerSettingsReactions(settings, {
      providers: { state },
      broadcastProviderState,
      cost: { recordAndBroadcast: vi.fn() }
    })

    settings.emit(['theme'])

    expect(broadcastProviderState).not.toHaveBeenCalled()
  })

  it('provider 플랫폼이 없으면 조용히 넘어간다 (테스트 하네스 경로)', () => {
    const settings = fakeSettings()
    const broadcastProviderState = vi.fn()
    registerSettingsReactions(settings, {
      broadcastProviderState,
      cost: { recordAndBroadcast: vi.fn() }
    })

    expect(() => settings.emit(['authBypass'])).not.toThrow()
    expect(broadcastProviderState).not.toHaveBeenCalled()
  })
})

// 같은 종류의 회귀 — 한도는 **사용량 뷰의 입력**(budget·pct)이라, 설정만 바꾸고 push 하지 않으면
// 도넛이 다음 턴 종료까지 옛 한도의 퍼센트를 보여준다 (0186 라운드 2 / PR 329 리뷰 P2-3).
describe('전역 월 한도 반영 (0186)', () => {
  it('spendingLimitUsd 가 바뀌면 사용량 뷰를 다시 push 한다', () => {
    const settings = fakeSettings()
    const recordAndBroadcast = vi.fn()
    registerSettingsReactions(settings, {
      broadcastProviderState: vi.fn(),
      cost: { recordAndBroadcast }
    })

    settings.emit(['spendingLimitUsd'])

    expect(recordAndBroadcast).toHaveBeenCalledTimes(1)
  })

  it('무관한 키만 바뀌면 push 하지 않는다', () => {
    const settings = fakeSettings()
    const recordAndBroadcast = vi.fn()
    registerSettingsReactions(settings, {
      broadcastProviderState: vi.fn(),
      cost: { recordAndBroadcast }
    })

    settings.emit(['theme'])

    expect(recordAndBroadcast).not.toHaveBeenCalled()
  })
})

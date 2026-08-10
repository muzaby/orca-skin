// 게이트 우회 토글의 renderer 미러 (0181). 디버그 패널이 **두 곳**(게이트 화면·메인 셸)에
// 뜨므로 상태가 갈리면 한쪽에서 켠 값이 다른 쪽에 안 보인다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const settingsGet = vi.hoisted(() => vi.fn())
const settingsSet = vi.hoisted(() => vi.fn())
vi.mock('../../../shared/api/ipc', () => ({
  settingsApi: { get: settingsGet, set: settingsSet }
}))

const { bypassActions, useBypassStore } = await import('./bypassStore')

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('bypassStore', () => {
  beforeEach(() => {
    useBypassStore.setState({ bypass: null })
    settingsGet.mockReset().mockResolvedValue({ authBypass: false })
    settingsSet.mockReset().mockResolvedValue({})
  })

  it('하이드레이트 전에는 null 이다 — 토글이 꺼짐으로 깜빡이지 않는다', () => {
    expect(useBypassStore.getState().bypass).toBeNull()
  })

  it('설정에서 값을 읽어 미러한다', async () => {
    settingsGet.mockResolvedValue({ authBypass: true })
    bypassActions.hydrate()
    await flush()
    expect(useBypassStore.getState().bypass).toBe(true)
  })

  it('패널이 둘 다 마운트돼도 invoke 는 1회다', async () => {
    bypassActions.hydrate()
    bypassActions.hydrate()
    await flush()
    bypassActions.hydrate()
    expect(settingsGet).toHaveBeenCalledTimes(1)
  })

  it('읽기 실패는 우회하지 않는 쪽으로 둔다 (fail-closed)', async () => {
    settingsGet.mockRejectedValue(new Error('nope'))
    bypassActions.hydrate()
    await flush()
    expect(useBypassStore.getState().bypass).toBe(false)
  })

  it('토글은 낙관 갱신 후 영속한다', async () => {
    bypassActions.setBypass(true)
    // 응답을 기다리지 않고 즉시 반영된다 — 토글이 손끝에서 굳지 않게.
    expect(useBypassStore.getState().bypass).toBe(true)
    await flush()
    expect(settingsSet).toHaveBeenCalledWith({ authBypass: true })
  })

  it('영속 실패는 되돌린다 — 화면만 켜지고 게이트는 그대로인 상태를 만들지 않는다', async () => {
    settingsSet.mockRejectedValue(new Error('disk'))
    bypassActions.setBypass(true)
    await flush()
    expect(useBypassStore.getState().bypass).toBe(false)
  })
})

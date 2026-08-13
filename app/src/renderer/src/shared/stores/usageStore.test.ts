// 사용량 mirror 의 **경계 무효화 계약** (0186 라운드 2 / PR 329 리뷰 P0).
//
// 자정을 넘기면 캐시된 provider 뷰는 전부 어제 기준(week·month·resetAt)이다. Main 이 전역만
// 다시 밀면 renderer 의 provider mirror 는 영원히 stale 로 남는다 — `ensureProviderUsage` 가
// 키 존재만 보고 조기 반환하기 때문이다. 그래서 boundary delta 는 **map 을 비운다**.
//
// ⚠️ 여기서 검증되는 것은 store 계약까지다. 화면이 실제로 재조회하려면 소비 훅의 effect 의존이
// `[providerKey, provider]` 여야 하는데(그래야 "키는 그대로, 값만 사라짐" 이 재실행을 트리거한다)
// 이 저장소에는 testing-library·jsdom 이 없어 hook 렌더를 돌릴 수 없다 — 그쪽은 코드 리뷰 몫이다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsageDelta, UsageLimitsView } from '../../../../shared/usage/limits'

const usage = vi.hoisted(() => vi.fn())
const refreshUsage = vi.hoisted(() => vi.fn())
const setProviderLimitIpc = vi.hoisted(() => vi.fn())
const onUsage = vi.hoisted(() => vi.fn())
vi.mock('../api/ipc', () => ({
  costApi: {
    usage,
    refreshUsage,
    setProviderLimit: setProviderLimitIpc,
    onUsage
  }
}))

const {
  ensureProviderUsage,
  reloadProviderUsage,
  setProviderLimit,
  subscribeUsage,
  syncProviderUsage,
  useUsageStore
} = await import('./usageStore')

function view(used: number): UsageLimitsView {
  const bar = (period: 'week' | 'month'): UsageLimitsView['week'] => ({
    used,
    budget: 100,
    pct: used,
    period,
    resetAt: 0,
    unlimited: false,
    source: 'local'
  })
  return {
    week: bar('week'),
    month: bar('month'),
    budgetSource: 'configured',
    configuredLimitUsd: 100
  }
}

// subscribeUsage 가 등록한 리스너를 꺼내 delta 를 직접 흘려 넣는다.
function emit(delta: UsageDelta): void {
  const listener = onUsage.mock.calls.at(-1)?.[0] as (d: UsageDelta) => void
  listener(delta)
}

describe('usageStore', () => {
  beforeEach(() => {
    useUsageStore.setState({
      global: null,
      providers: {},
      providerUpdatedAt: {}
    })
    usage.mockReset().mockResolvedValue(view(1))
    refreshUsage.mockReset().mockResolvedValue(view(2))
    setProviderLimitIpc.mockReset().mockResolvedValue(view(3))
    onUsage.mockReset().mockReturnValue(() => {})
    subscribeUsage()
  })

  it('provider delta 는 그 키만 갈아끼운다', () => {
    emit({ scope: 'provider', providerKey: 'a', value: view(1) })
    emit({ scope: 'provider', providerKey: 'b', value: view(2) })

    const s = useUsageStore.getState()
    expect(s.providers.a?.week.used).toBe(1)
    expect(s.providers.b?.week.used).toBe(2)
  })

  it('global delta 는 provider mirror 를 건드리지 않는다', () => {
    emit({ scope: 'provider', providerKey: 'a', value: view(1) })
    emit({ scope: 'global', value: view(9) })

    const s = useUsageStore.getState()
    expect(s.global?.week.used).toBe(9)
    expect(s.providers.a?.week.used).toBe(1)
  })

  // ── P0 핵심 ────────────────────────────────────────────────────────────────
  it('boundary delta 는 전역을 갈아끼우고 **provider mirror 를 비운다**', () => {
    emit({ scope: 'provider', providerKey: 'a', value: view(1) })
    expect(useUsageStore.getState().providerUpdatedAt.a).toBeTypeOf('number')

    emit({ scope: 'boundary', value: view(9) })

    const s = useUsageStore.getState()
    expect(s.global?.week.used).toBe(9)
    expect(s.providers).toEqual({})
    // 타임스탬프도 함께 버린다 — 값이 없는데 "마지막 업데이트" 만 남으면 화면이 거짓말을 한다.
    expect(s.providerUpdatedAt).toEqual({})
  })

  it('경계 무효화 후 ensureProviderUsage 가 같은 키를 다시 조회한다', async () => {
    emit({ scope: 'provider', providerKey: 'a', value: view(1) })

    await ensureProviderUsage('a')
    expect(usage).not.toHaveBeenCalled() // 값이 있으면 조기 반환

    emit({ scope: 'boundary', value: view(9) })
    await ensureProviderUsage('a')

    expect(usage).toHaveBeenCalledWith('a')
    expect(useUsageStore.getState().providers.a?.week.used).toBe(1)
  })

  it('동기화는 원격 채널(refreshUsage)을 부른다 — 캐시 재조회가 아니다', async () => {
    await syncProviderUsage('a')

    expect(refreshUsage).toHaveBeenCalledWith('a')
    expect(usage).not.toHaveBeenCalled()
    expect(useUsageStore.getState().providers.a?.week.used).toBe(2)
  })

  it('원격 동기화 실패는 기존 provider 값과 timestamp 를 유지한다', async () => {
    emit({ scope: 'provider', providerKey: 'a', value: view(1) })
    const before = useUsageStore.getState()
    refreshUsage.mockRejectedValueOnce(new Error('remote unavailable'))

    await expect(syncProviderUsage('a')).rejects.toThrow('remote unavailable')

    expect(useUsageStore.getState().providers.a).toBe(before.providers.a)
    expect(useUsageStore.getState().providerUpdatedAt.a).toBe(before.providerUpdatedAt.a)
  })

  it('재적재는 로컬 정본 채널(usage)을 부른다', async () => {
    await reloadProviderUsage('a')

    expect(usage).toHaveBeenCalledWith('a')
    expect(refreshUsage).not.toHaveBeenCalled()
  })

  it('한도 쓰기는 되돌아온 뷰를 그대로 반영한다 — 재조회하지 않는다', async () => {
    await setProviderLimit('a', 50)

    expect(setProviderLimitIpc).toHaveBeenCalledWith('a', 50)
    expect(usage).not.toHaveBeenCalled()
    expect(useUsageStore.getState().providers.a?.week.used).toBe(3)
  })

  // scope 별 타임스탬프 (리뷰 P1-1) — 하나뿐이면 provider B 갱신 시각이 A 화면에 뜬다.
  it('provider 타임스탬프는 키마다 따로 움직인다', () => {
    emit({ scope: 'provider', providerKey: 'a', value: view(1) })
    const afterA = useUsageStore.getState().providerUpdatedAt

    emit({ scope: 'provider', providerKey: 'b', value: view(2) })
    const afterB = useUsageStore.getState().providerUpdatedAt

    expect(afterB.a).toBe(afterA.a)
    expect(afterB.b).toBeTypeOf('number')
  })

  it('global 갱신이 provider 타임스탬프를 밀지 않는다', () => {
    emit({ scope: 'provider', providerKey: 'a', value: view(1) })
    const before = useUsageStore.getState().providerUpdatedAt.a

    emit({ scope: 'global', value: view(9) })

    expect(useUsageStore.getState().providerUpdatedAt.a).toBe(before)
  })
})

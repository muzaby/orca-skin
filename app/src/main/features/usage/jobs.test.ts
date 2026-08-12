// 0186 P0-5 — `register()` 는 타이머를 만들지 않는다. **`schedule()` 까지 불렸는지**를 본다.
// register 호출만 세는 테스트는 "등록은 됐는데 영영 발화하지 않는" 잡을 통과시킨다.

import { describe, expect, it, vi } from 'vitest'
import {
  registerUsageJobs,
  USAGE_BOUNDARY_CRON,
  USAGE_FETCH_CRON,
  type UsageJobScheduler,
  type UsageJobTracker
} from './jobs'
import type { UsageFetcher } from './fetcher'

function fakeScheduler(): {
  scheduler: UsageJobScheduler
  register: ReturnType<typeof vi.fn>
  schedule: ReturnType<typeof vi.fn>
  actions: Map<string, () => void | Promise<void>>
} {
  const actions = new Map<string, () => void | Promise<void>>()
  const register = vi.fn((key: string, action: () => void | Promise<void>) => {
    actions.set(key, action)
  })
  const schedule = vi.fn()
  return { scheduler: { register, schedule } as UsageJobScheduler, register, schedule, actions }
}

function fakeTracker(): {
  tracker: UsageJobTracker
  recordAndBroadcast: ReturnType<typeof vi.fn>
  refreshProvider: ReturnType<typeof vi.fn>
} {
  const recordAndBroadcast = vi.fn()
  const refreshProvider = vi.fn().mockResolvedValue(undefined)
  return {
    tracker: { recordAndBroadcast, refreshProvider } as UsageJobTracker,
    recordAndBroadcast,
    refreshProvider
  }
}

const fetcher: UsageFetcher = { fetchUsage: vi.fn().mockResolvedValue(null) }

describe('registerUsageJobs', () => {
  it('경계 잡은 schedule 까지 된다', () => {
    const { scheduler, register, schedule } = fakeScheduler()
    const { tracker } = fakeTracker()

    registerUsageJobs(scheduler, tracker)

    expect(register).toHaveBeenCalledWith('usage-boundary', expect.any(Function))
    // 핵심 — register 만으로는 타이머가 없다.
    expect(schedule).toHaveBeenCalledWith('usage-boundary', {
      enabled: true,
      cron: USAGE_BOUNDARY_CRON
    })
  })

  it('경계 잡은 자정 cron 이다 (일 경계가 주·월 경계를 포함한다)', () => {
    expect(USAGE_BOUNDARY_CRON).toBe('0 0 * * *')
  })

  it('경계 잡 발화는 전역 재집계를 부른다', () => {
    const { scheduler, actions } = fakeScheduler()
    const { tracker, recordAndBroadcast } = fakeTracker()

    registerUsageJobs(scheduler, tracker)
    void actions.get('usage-boundary')?.()

    expect(recordAndBroadcast).toHaveBeenCalledTimes(1)
  })

  it('fetcher 미주입이면 usage-fetch 잡이 없다', () => {
    const { scheduler, register, schedule } = fakeScheduler()
    const { tracker } = fakeTracker()

    registerUsageJobs(scheduler, tracker)

    const registered = register.mock.calls.map((c) => c[0])
    const scheduled = schedule.mock.calls.map((c) => c[0])
    expect(registered).toEqual(['usage-boundary'])
    expect(scheduled).toEqual(['usage-boundary'])
    expect(registered).not.toContain('usage-fetch')
    expect(scheduled).not.toContain('usage-fetch')
  })

  it('fetcher 가 있으면 usage-fetch 를 register + schedule 한다', () => {
    const { scheduler, register, schedule } = fakeScheduler()
    const { tracker } = fakeTracker()

    registerUsageJobs(scheduler, tracker, { fetcher, providerKeys: () => ['claude-gateway'] })

    expect(register).toHaveBeenCalledWith('usage-fetch', expect.any(Function))
    expect(schedule).toHaveBeenCalledWith('usage-fetch', {
      enabled: true,
      cron: USAGE_FETCH_CRON
    })
  })

  it('원격 잡은 대상 provider 마다 갱신하고 signal 을 넘긴다', async () => {
    const { scheduler, actions } = fakeScheduler()
    const { tracker, refreshProvider } = fakeTracker()

    registerUsageJobs(scheduler, tracker, {
      fetcher,
      providerKeys: () => ['claude-gateway', 'claude-bedrock']
    })
    await actions.get('usage-fetch')?.()

    expect(refreshProvider).toHaveBeenCalledTimes(2)
    expect(refreshProvider).toHaveBeenNthCalledWith(1, 'claude-gateway', expect.any(AbortSignal))
    expect(refreshProvider).toHaveBeenNthCalledWith(2, 'claude-bedrock', expect.any(AbortSignal))
  })

  it('대상 목록은 발화 시점에 평가한다', async () => {
    const { scheduler, actions } = fakeScheduler()
    const { tracker, refreshProvider } = fakeTracker()
    let keys: string[] = []

    registerUsageJobs(scheduler, tracker, { fetcher, providerKeys: () => keys })
    keys = ['claude-gateway'] // 부팅 이후 선언이 채워진 상황
    await actions.get('usage-fetch')?.()

    expect(refreshProvider).toHaveBeenCalledWith('claude-gateway', expect.any(AbortSignal))
  })

  it('대상이 없으면 아무 것도 부르지 않는다', async () => {
    const { scheduler, actions } = fakeScheduler()
    const { tracker, refreshProvider } = fakeTracker()

    registerUsageJobs(scheduler, tracker, { fetcher })
    await actions.get('usage-fetch')?.()

    expect(refreshProvider).not.toHaveBeenCalled()
  })
})

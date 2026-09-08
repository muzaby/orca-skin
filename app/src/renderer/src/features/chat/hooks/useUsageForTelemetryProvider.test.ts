import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsageDelta, UsageLimitsView } from '../../../../../shared/usage/limits'
import { useUsageForTelemetryProvider } from './useUsageForTelemetryProvider'
import { subscribeUsage, useUsageStore } from '../../../shared/stores/usageStore'

const h = vi.hoisted(() => ({
  session: { lastTelemetryProviderKey: null as string | null, providerKey: 'selected' },
  effect: null as null | (() => void),
  deps: [] as unknown[],
  usage: vi.fn(),
  onUsage: vi.fn()
}))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect: (effect: () => void, deps: unknown[]) => {
    h.effect = effect
    h.deps = deps
  }
}))
vi.mock('../store/chatStore', () => ({
  useChatSession: (select: (state: typeof h.session) => unknown) => select(h.session)
}))
vi.mock('../../../shared/api/ipc', () => ({ costApi: { usage: h.usage, onUsage: h.onUsage } }))
vi.mock('../../../shared/stores/usageStore', async (original) => {
  const actual = await original<typeof import('../../../shared/stores/usageStore')>()
  return {
    ...actual,
    useGlobalUsage: () => actual.useUsageStore.getState().global,
    useProviderUsage: (key: string | null) =>
      key ? (actual.useUsageStore.getState().providers[key] ?? null) : null
  }
})

function view(used: number): UsageLimitsView {
  const bar = (period: 'week' | 'month'): UsageLimitsView['week'] => ({
    used,
    budget: 100,
    pct: used,
    period,
    resetAt: 0,
    unlimited: false,
    source: 'local' as const
  })
  return {
    week: bar('week'),
    month: bar('month'),
    budgetSource: 'configured',
    configuredLimitUsd: 100
  }
}
beforeEach(() => {
  h.session = { lastTelemetryProviderKey: null, providerKey: 'selected' }
  h.usage.mockReset().mockResolvedValue(view(2))
  h.onUsage.mockReset().mockReturnValue(() => {})
  useUsageStore.setState({ global: view(1), providers: {}, providerUpdatedAt: {} })
})

describe('actual telemetry usage hook and usage mirror', () => {
  it('holds the last telemetry provider when Composer selection changes, then refills after boundary invalidation', async () => {
    h.session.lastTelemetryProviderKey = 'telemetry-provider'
    expect(useUsageForTelemetryProvider()).toBe(useUsageStore.getState().global)
    h.effect?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(h.usage).toHaveBeenCalledExactlyOnceWith('telemetry-provider')
    const provider = useUsageStore.getState().providers['telemetry-provider']
    expect(useUsageForTelemetryProvider()).toBe(provider)
    const filledDeps = h.deps
    h.session.providerKey = 'another-selection'
    expect(useUsageForTelemetryProvider()).toBe(provider)
    h.effect?.()
    expect(h.usage).toHaveBeenCalledOnce()
    const cleanup = subscribeUsage()
    const emit = h.onUsage.mock.calls[0][0] as (delta: UsageDelta) => void
    const global = view(3)
    emit({ scope: 'boundary', value: global })
    expect(useUsageForTelemetryProvider()).toBe(global)
    expect(h.deps).not.toEqual(filledDeps)
    h.effect?.()
    await Promise.resolve()
    await Promise.resolve()
    expect(h.usage).toHaveBeenCalledTimes(2)
    expect(h.usage).toHaveBeenLastCalledWith('telemetry-provider')
    cleanup()
  })

  it('returns global or null without requesting the currently selected provider', () => {
    expect(useUsageForTelemetryProvider()).toBe(useUsageStore.getState().global)
    h.effect?.()
    useUsageStore.setState({ global: null })
    expect(useUsageForTelemetryProvider()).toBeNull()
    h.effect?.()
    expect(h.usage).not.toHaveBeenCalled()
  })
})

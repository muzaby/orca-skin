import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBootSteps, runBootSteps, type BootDependencies } from './steps'

function deps(overrides: Partial<BootDependencies> = {}): BootDependencies {
  return {
    getBootReport: vi.fn().mockResolvedValue({
      startedAt: 1,
      finishedAt: 2,
      durationMs: 1,
      status: 'ok',
      steps: [],
      warnings: []
    }),
    getLastSessionId: vi.fn().mockResolvedValue(null),
    initBackend: vi.fn().mockResolvedValue(undefined),
    initSessions: vi.fn().mockResolvedValue(undefined),
    initProjects: vi.fn().mockResolvedValue(undefined),
    initCost: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

describe('boot steps', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('lastSessionId 로 기존 채팅 랜딩 타겟을 만든다', async () => {
    const d = deps({ getLastSessionId: vi.fn().mockResolvedValue('s-1') })
    const events: string[] = []

    const result = await runBootSteps(
      createBootSteps(d),
      (event) => events.push(`${event.id}:${event.status}`),
      d
    )

    expect(result.landingTarget).toBe('/chat/s-1')
    expect(events).toContain('landing-target:running')
    expect(events).toContain('landing-target:ok')
  })

  it('main BootReport 조회 실패는 non-mandatory degrade 후 랜딩을 계속한다', async () => {
    const d = deps({ getBootReport: vi.fn().mockRejectedValue(new Error('report unavailable')) })
    const events: string[] = []

    const result = await runBootSteps(
      createBootSteps(d),
      (event) => events.push(`${event.id}:${event.status}`),
      d
    )

    expect(result.landingTarget).toBe('/new')
    expect(events).toContain('main-report:degraded')
  })

  it('landing-target 은 lastSessionId 를 한 번만 조회한다', async () => {
    const getLastSessionId = vi.fn().mockResolvedValue('s-1')
    const d = deps({ getLastSessionId })

    await runBootSteps(createBootSteps(d), () => undefined, d)

    expect(getLastSessionId).toHaveBeenCalledTimes(1)
  })

  it('warning threshold 초과는 UI event 가 아니라 console warning 으로만 남긴다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const d = deps()
    const events: string[] = []
    const steps = createBootSteps(d, {
      warningAfterMs: -1,
      mandatoryTimeoutMs: 10_000,
      optionalTimeoutMs: 10_000
    })

    await runBootSteps(steps, (event) => events.push(`${event.id}:${event.status}`), d)

    expect(events).not.toContain('landing-target:warning')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[boot] landing-target slow'))
  })

  it('비필수 단계 실패는 degrade 하고 랜딩을 계속한다', async () => {
    const d = deps({ initBackend: vi.fn().mockRejectedValue(new Error('backend unavailable')) })
    const events: string[] = []

    const result = await runBootSteps(
      createBootSteps(d),
      (event) => events.push(`${event.id}:${event.status}`),
      d
    )

    expect(result.landingTarget).toBe('/new')
    expect(events).toContain('backend:degraded')
  })

  it('필수 단계 실패는 부트를 중단한다', async () => {
    const d = deps({ getLastSessionId: vi.fn().mockRejectedValue(new Error('settings down')) })
    const events: string[] = []

    await expect(
      runBootSteps(createBootSteps(d), (event) => events.push(`${event.id}:${event.status}`), d)
    ).rejects.toThrow('settings down')

    expect(events).toContain('landing-target:failed')
  })
})

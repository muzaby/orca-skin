import { settingsApi, bootApi } from '../../shared/api/ipc'
import { initBackend } from '../../features/backend/store/backendStore'
import { initCost } from '../../features/cost/store/costStore'
import { initProjects } from '../../features/projects/store/projectsStore'
import { initSessions } from '../../features/sessions/store/sessionsStore'
import type { BootReport } from '../../../../shared/ipc'

export type BootStepId = 'main-report' | 'landing-target' | 'backend' | 'sessions' | 'projects-cost'

export interface BootTimingPolicy {
  warningAfterMs: number
  mandatoryTimeoutMs: number
  optionalTimeoutMs: number
}

// 제품 SLA 결정(0077 후속): 3초 초과는 진단 warning, 10초 초과는 필수 단계 failed / 선택 단계 degraded.
// BootScreen UI에는 warning을 노출하지 않고 console/diagnostic으로만 남긴다.
export const BOOT_TIMING_POLICY: BootTimingPolicy = {
  warningAfterMs: 3_000,
  mandatoryTimeoutMs: 10_000,
  optionalTimeoutMs: 10_000
}

export interface BootStep {
  id: BootStepId
  mandatory: boolean
  timeoutMs: number
  warningAfterMs: number
  run: () => Promise<void>
}

export interface BootStepEvent {
  id: BootStepId
  status: 'running' | 'ok' | 'failed' | 'degraded'
  durationMs?: number
  error?: unknown
}

export interface BootDependencies {
  getBootReport: () => Promise<BootReport>
  getLastSessionId: () => Promise<string | null>
  initBackend: () => Promise<void>
  initSessions: () => Promise<void>
  initProjects: () => Promise<void>
  initCost: () => Promise<void>
}

export interface BootRunResult {
  landingTarget: string
}

export const defaultBootDependencies: BootDependencies = {
  getBootReport: () => bootApi.report(),
  getLastSessionId: async () => {
    const settings = await settingsApi.get()
    return settings.lastSessionId ?? null
  },
  initBackend,
  initSessions,
  initProjects,
  initCost
}

function stepTimeout(mandatory: boolean, policy: BootTimingPolicy): number {
  return mandatory ? policy.mandatoryTimeoutMs : policy.optionalTimeoutMs
}

export function createBootSteps(
  deps: BootDependencies = defaultBootDependencies,
  policy: BootTimingPolicy = BOOT_TIMING_POLICY
): BootStep[] {
  const optionalTimeoutMs = stepTimeout(false, policy)
  const mandatoryTimeoutMs = stepTimeout(true, policy)
  return [
    {
      id: 'main-report',
      mandatory: false,
      timeoutMs: optionalTimeoutMs,
      warningAfterMs: policy.warningAfterMs,
      run: async () => {
        const report = await deps.getBootReport()
        const warningCount = report.steps.filter((step) => step.status !== 'ok').length
        if (report.status !== 'ok' || warningCount > 0) {
          console.warn(
            `[boot] main report ${report.status} (${report.durationMs ?? 0}ms, warnings=${warningCount})`
          )
        } else {
          console.log(`[boot] main report ok (${report.durationMs ?? 0}ms)`)
        }
      }
    },
    {
      id: 'landing-target',
      mandatory: true,
      timeoutMs: mandatoryTimeoutMs,
      warningAfterMs: policy.warningAfterMs,
      run: async () => undefined
    },
    {
      id: 'backend',
      mandatory: false,
      timeoutMs: optionalTimeoutMs,
      warningAfterMs: policy.warningAfterMs,
      run: deps.initBackend
    },
    {
      id: 'sessions',
      mandatory: false,
      timeoutMs: optionalTimeoutMs,
      warningAfterMs: policy.warningAfterMs,
      run: deps.initSessions
    },
    {
      id: 'projects-cost',
      mandatory: false,
      timeoutMs: optionalTimeoutMs,
      warningAfterMs: policy.warningAfterMs,
      run: async () => {
        const settled = await Promise.allSettled([deps.initProjects(), deps.initCost()])
        const rejected = settled.find((result) => result.status === 'rejected')
        if (rejected && rejected.status === 'rejected') throw rejected.reason
      }
    }
  ]
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function withTimeout<T>(promise: Promise<T>, ms: number, stepId: BootStepId): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`boot step timed out: ${stepId}`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function warnIfSlow(step: BootStep, durationMs: number): void {
  if (durationMs <= step.warningAfterMs) return
  console.warn(`[boot] ${step.id} slow (${durationMs}ms > ${step.warningAfterMs}ms) — SLA warning`)
}

export async function runBootSteps(
  steps: BootStep[] = createBootSteps(),
  onEvent: (event: BootStepEvent) => void = () => undefined,
  deps: BootDependencies = defaultBootDependencies
): Promise<BootRunResult> {
  let lastSessionId: string | null = null

  for (const step of steps) {
    const startedAt = performance.now()
    onEvent({ id: step.id, status: 'running' })
    console.log(`[boot] ${step.id} running`)

    try {
      if (step.id === 'landing-target') {
        lastSessionId = await withTimeout(deps.getLastSessionId(), step.timeoutMs, step.id)
      } else {
        await withTimeout(step.run(), step.timeoutMs, step.id)
      }
      const durationMs = Math.round(performance.now() - startedAt)
      onEvent({ id: step.id, status: 'ok', durationMs })
      console.log(`[boot] ${step.id} ok (${durationMs}ms)`)
      warnIfSlow(step, durationMs)
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt)
      onEvent({ id: step.id, status: step.mandatory ? 'failed' : 'degraded', durationMs, error })
      const message = `[boot] ${step.id} failed (${durationMs}ms): ${formatError(error)}`
      if (step.mandatory) {
        console.error(message)
        throw error
      }
      console.warn(message)
    }
  }

  return { landingTarget: lastSessionId ? `/chat/${lastSessionId}` : '/new' }
}

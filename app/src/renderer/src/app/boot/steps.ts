import { settingsApi, bootApi } from '../../shared/api/ipc'
import { initBackend } from '../../features/backend/store/backendStore'
import { initUsage } from '../../shared/stores/usageStore'
import { initProjects } from '../../features/projects/store/projectsStore'
import { initSessions } from '../../features/sessions/store/sessionsStore'
import type { BootReport } from '../../../../shared/ipc'

export type BootStepId =
  'main-ready' | 'main-report' | 'landing-target' | 'backend' | 'sessions' | 'projects-cost'

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

export interface BootRunResult {
  landingTarget: string
}

export interface BootStep {
  id: BootStepId
  mandatory: boolean
  // 단계가 랜딩 타겟 등 결과 조각을 만들면 반환한다 — 러너가 순서대로 병합한다.
  run: () => Promise<Partial<BootRunResult> | void>
}

export interface BootStepEvent {
  id: BootStepId
  status: 'running' | 'ok' | 'failed' | 'degraded'
  durationMs?: number
  error?: unknown
}

export interface BootDependencies {
  whenMainReady: () => Promise<void>
  getBootReport: () => Promise<BootReport>
  getLastSessionId: () => Promise<string | null>
  initBackend: () => Promise<void>
  initSessions: () => Promise<void>
  initProjects: () => Promise<void>
  initUsage: () => Promise<void>
}

export const defaultBootDependencies: BootDependencies = {
  whenMainReady: () => bootApi.whenReady(),
  getBootReport: () => bootApi.report(),
  getLastSessionId: async () => {
    const settings = await settingsApi.get()
    return settings.lastSessionId ?? null
  },
  initBackend,
  initSessions,
  initProjects,
  initUsage
}

export function createBootSteps(deps: BootDependencies = defaultBootDependencies): BootStep[] {
  return [
    {
      // 0109 — 창이 main start() 완료 이전에 뜨므로, 나머지 스텝(IPC invoke)이 미등록
      // 핸들러에 닿지 않도록 main 준비를 먼저 기다린다. 실패/타임아웃은 mandatory 규칙에
      // 따라 기존 BootScreen failed UX 로 표면화된다.
      id: 'main-ready',
      mandatory: true,
      run: async () => {
        await deps.whenMainReady()
      }
    },
    {
      id: 'main-report',
      mandatory: false,
      run: async () => {
        // 완료된 main 부트 리포트 스냅샷을 그대로 소비한다 — 요약(status/warnings)은 리포트가 이미 계산했다.
        const report = await deps.getBootReport()
        if (report.status !== 'ok') {
          console.warn(
            `[boot] main report ${report.status} (${report.durationMs}ms, warnings=${report.warnings.length})`
          )
        } else {
          console.log(`[boot] main report ok (${report.durationMs}ms)`)
        }
      }
    },
    {
      id: 'landing-target',
      mandatory: true,
      run: async () => {
        const lastSessionId = await deps.getLastSessionId()
        return { landingTarget: lastSessionId ? `/chat/${lastSessionId}` : '/new' }
      }
    },
    { id: 'backend', mandatory: false, run: deps.initBackend },
    { id: 'sessions', mandatory: false, run: deps.initSessions },
    {
      id: 'projects-cost',
      mandatory: false,
      run: async () => {
        const settled = await Promise.allSettled([deps.initProjects(), deps.initUsage()])
        const rejected = settled.find((result) => result.status === 'rejected')
        if (rejected && rejected.status === 'rejected') throw rejected.reason
      }
    }
  ]
}

export function formatError(error: unknown): string {
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

export async function runBootSteps(
  steps: BootStep[] = createBootSteps(),
  onEvent: (event: BootStepEvent) => void = () => undefined,
  policy: BootTimingPolicy = BOOT_TIMING_POLICY
): Promise<BootRunResult> {
  const result: Partial<BootRunResult> = {}

  for (const step of steps) {
    const startedAt = performance.now()
    const timeoutMs = step.mandatory ? policy.mandatoryTimeoutMs : policy.optionalTimeoutMs
    onEvent({ id: step.id, status: 'running' })
    console.log(`[boot] ${step.id} running`)

    try {
      const partial = await withTimeout(step.run(), timeoutMs, step.id)
      if (partial) Object.assign(result, partial)
      const durationMs = Math.round(performance.now() - startedAt)
      onEvent({ id: step.id, status: 'ok', durationMs })
      console.log(`[boot] ${step.id} ok (${durationMs}ms)`)
      if (durationMs > policy.warningAfterMs) {
        console.warn(
          `[boot] ${step.id} slow (${durationMs}ms > ${policy.warningAfterMs}ms) — SLA warning`
        )
      }
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

  return { landingTarget: result.landingTarget ?? '/new' }
}

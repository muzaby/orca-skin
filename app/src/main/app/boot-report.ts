import { z } from 'zod'
import { reportError } from '../infra/error-report'
import type { BootReport, BootReportStep, BootReportStatus } from '../../shared/ipc'
import { errorMessage } from '../infra/errors'
import { getLogger } from '../infra/log/registry'

type MaybePromise<T> = T | Promise<T>

interface StepOptions {
  critical: boolean
  label?: string
}

function now(): number {
  return Date.now()
}

export class BootReportRecorder {
  private readonly startedAt = now()
  private finishedAt: number | null = null
  private readonly steps: BootReportStep[] = []
  private readonly warnings: string[] = []

  async step<T>(id: string, options: StepOptions, fn: () => MaybePromise<T>): Promise<T> {
    const startedAt = now()
    try {
      const result = await fn()
      this.pushStep({ id, options, startedAt, status: 'ok' })
      return result
    } catch (error) {
      return this.recordFailure(id, options, startedAt, error)
    }
  }

  stepSync<T>(id: string, options: StepOptions, fn: () => T): T {
    const startedAt = now()
    try {
      const result = fn()
      this.pushStep({ id, options, startedAt, status: 'ok' })
      return result
    } catch (error) {
      return this.recordFailure(id, options, startedAt, error)
    }
  }

  // step/stepSync 공통 실패 경로: 리포트에 기록하고, critical 이면 rethrow, 아니면 warning 으로 degrade.
  private recordFailure<T>(id: string, options: StepOptions, startedAt: number, error: unknown): T {
    const message = errorMessage(error)
    this.pushStep({
      id,
      options,
      startedAt,
      status: options.critical ? 'failed' : 'warning',
      message
    })
    if (options.critical) throw error
    this.warnings.push(`${id}: ${message}`)
    return undefined as T
  }

  finish(): void {
    if (this.finishedAt === null) this.finishedAt = now()
    const report = this.getReport()
    getLogger().child('boot').info('boot.sequence.completed', {
      status: report.status,
      durationMs: report.durationMs,
      steps: report.steps.length,
      warnings: report.warnings.length
    })
  }

  getReport(): BootReport {
    const finishedAt = this.finishedAt ?? now()
    const status: BootReportStatus = this.steps.some(
      (step) => step.critical && step.status === 'failed'
    )
      ? 'failed'
      : this.steps.some((step) => step.status !== 'ok')
        ? 'warning'
        : 'ok'
    return {
      startedAt: this.startedAt,
      finishedAt,
      durationMs: finishedAt - this.startedAt,
      status,
      steps: this.steps.map((step) => ({ ...step })),
      warnings: [...this.warnings]
    }
  }

  private pushStep(input: {
    id: string
    options: StepOptions
    startedAt: number
    status: BootReportStep['status']
    message?: string
  }): void {
    const finishedAt = now()
    const durationMs = finishedAt - input.startedAt
    this.steps.push({
      id: input.id,
      ...(input.options.label ? { label: input.options.label } : {}),
      status: input.status,
      critical: input.options.critical,
      startedAt: input.startedAt,
      finishedAt,
      durationMs,
      ...(input.message ? { message: input.message } : {})
    })
    // 부팅 스텝 경계(0124 카탈로그) — 성공=info / critical 실패=error / 비-critical 실패=warn.
    // renderer 전달(BootReport) 동작은 불변 — 파일 기록만 추가한다(구 console.warn 대체).
    const log = getLogger().child('boot')
    const data = {
      step: input.id,
      durationMs,
      ...(input.message ? { message: input.message } : {})
    }
    if (input.status === 'ok') log.info('boot.step.completed', data)
    else if (input.status === 'failed') log.error('boot.step.failed', undefined, data)
    else
      reportError({
        event: 'boot.step.failed',
        scope: 'boot',
        title: 'bootStepDegraded',
        level: 'warn',
        detail: input.id + ': ' + input.message,
        data: { ...data, degraded: true }
      })
  }
}

export function createBootReportRecorder(): BootReportRecorder {
  return new BootReportRecorder()
}

const BootStatus = z.enum(['ok', 'warning', 'failed'])

// 다른 호스트가 보낸 부팅 보고의 모양 — 받는 쪽이 다시 본다 (0324 AC47).
export const BootReportSchema = z.object({
  startedAt: z.number(),
  finishedAt: z.number(),
  durationMs: z.number(),
  status: BootStatus,
  steps: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().optional(),
      status: BootStatus,
      critical: z.boolean(),
      startedAt: z.number(),
      finishedAt: z.number(),
      durationMs: z.number(),
      message: z.string().optional()
    })
  ),
  warnings: z.array(z.string())
})

const STATUS_RANK: Record<BootReportStatus, number> = { ok: 0, warning: 1, failed: 2 }

// 두 호스트의 부팅 보고를 한 벌로 (0324 AC47). 단계는 시작 시각 순서로 잇고, 상태는 더 나쁜 쪽이며,
// 구간은 가장 이른 시작부터 가장 늦은 끝까지다. 다른 호스트의 보고가 없으면 자기 보고 그대로다.
export function mergeBootReports(own: BootReport, other: BootReport | null): BootReport {
  if (!other) return own
  const startedAt = Math.min(own.startedAt, other.startedAt)
  const finishedAt = Math.max(own.finishedAt, other.finishedAt)
  return {
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    status: STATUS_RANK[other.status] > STATUS_RANK[own.status] ? other.status : own.status,
    steps: [...own.steps, ...other.steps].sort((a, b) => a.startedAt - b.startedAt),
    warnings: [...own.warnings, ...other.warnings]
  }
}

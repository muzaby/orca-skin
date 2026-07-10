import type { BootReport, BootReportStep, BootReportStatus } from '../../shared/ipc'
import { errorMessage } from '../infra/errors'

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
    console.warn(`[boot] ${id} 경고:`, error)
    return undefined as T
  }

  finish(): void {
    if (this.finishedAt === null) this.finishedAt = now()
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
    this.steps.push({
      id: input.id,
      ...(input.options.label ? { label: input.options.label } : {}),
      status: input.status,
      critical: input.options.critical,
      startedAt: input.startedAt,
      finishedAt,
      durationMs: finishedAt - input.startedAt,
      ...(input.message ? { message: input.message } : {})
    })
  }
}

export function createBootReportRecorder(): BootReportRecorder {
  return new BootReportRecorder()
}

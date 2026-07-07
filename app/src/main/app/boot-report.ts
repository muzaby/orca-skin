import type { BootReport, BootReportStep, BootReportStatus } from '../../shared/ipc'

type MaybePromise<T> = T | Promise<T>

interface StepOptions {
  critical: boolean
  label?: string
}

function now(): number {
  return Date.now()
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
      const message = formatError(error)
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
  }

  stepSync<T>(id: string, options: StepOptions, fn: () => T): T {
    const startedAt = now()
    try {
      const result = fn()
      this.pushStep({ id, options, startedAt, status: 'ok' })
      return result
    } catch (error) {
      const message = formatError(error)
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
  }

  warn(id: string, message: string, label?: string): void {
    const startedAt = now()
    this.warnings.push(`${id}: ${message}`)
    this.pushStep({
      id,
      options: { critical: false, label },
      startedAt,
      status: 'warning',
      message
    })
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

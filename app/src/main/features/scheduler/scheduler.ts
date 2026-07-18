import { Cron } from 'croner'
import type { Settings } from '../../../shared/protocol'
import { errorMessage } from '../../infra/errors'
import { getLogger } from '../../infra/log/registry'
import { assertValidCron } from './cron-validate'
import type { JobAction, JobKey, RunRecorder, ScheduleSpec } from './types'

interface ScheduledJob {
  cron: Cron
  spec: ScheduleSpec
}

export class Scheduler {
  private readonly actions = new Map<string, JobAction>()
  private readonly scheduled = new Map<string, ScheduledJob>()
  private readonly running = new Set<string>()
  private disposed = false

  constructor(
    private readonly recorder: RunRecorder,
    private readonly now: () => number = Date.now
  ) {}

  register(key: JobKey, action: JobAction): void {
    this.assertNotDisposed()
    this.actions.set(key, action)
  }

  schedule(key: JobKey, spec: ScheduleSpec): void {
    this.assertNotDisposed()
    const action = this.actions.get(key)
    if (!action) throw new Error(`Scheduler job is not registered: ${key}`)
    assertValidCron(spec.cron)
    this.unschedule(key)
    if (spec.enabled === false) return
    const cron = new Cron(spec.cron, { protect: true }, () => {
      void this.invoke(key, action)
    })
    this.scheduled.set(key, { cron, spec })
  }

  applySettings(settings: Settings['scheduler']): void {
    this.schedule('usage-recompute', {
      enabled: settings.usageRecompute.enabled,
      cron: settings.usageRecompute.cron
    })
  }

  unschedule(key: JobKey): void {
    const existing = this.scheduled.get(key)
    if (!existing) return
    existing.cron.stop()
    this.scheduled.delete(key)
  }

  async runNow(key: JobKey): Promise<void> {
    this.assertNotDisposed()
    const action = this.actions.get(key)
    if (!action) throw new Error(`Scheduler job is not registered: ${key}`)
    await this.invoke(key, action)
  }

  nextRun(key: JobKey): Date | null {
    return this.scheduled.get(key)?.cron.nextRun() ?? null
  }

  stopAll(): void {
    if (this.disposed) return
    this.disposed = true
    for (const job of this.scheduled.values()) job.cron.stop()
    this.scheduled.clear()
    this.actions.clear()
    this.running.clear()
  }

  private async invoke(key: string, action: JobAction): Promise<void> {
    if (this.disposed) return
    const startedAt = this.now()
    if (this.running.has(key)) {
      const skippedId = this.recorder.start(key, startedAt)
      this.recorder.finish(skippedId, this.now(), 'skipped', 'Previous run is still active')
      return
    }
    this.running.add(key)
    const runId = this.recorder.start(key, startedAt)
    try {
      await action()
      this.recorder.finish(runId, this.now(), 'success', null)
      // 주기 실행 경계(0124 카탈로그) — job id·소요만 기록.
      getLogger()
        .child('scheduler')
        .info('scheduler.job.fired', { job: key, durationMs: this.now() - startedAt })
    } catch (e) {
      this.recorder.finish(runId, this.now(), 'error', errorMessage(e))
      getLogger()
        .child('scheduler')
        .error('scheduler.job.failed', e, { job: key, durationMs: this.now() - startedAt })
    } finally {
      this.running.delete(key)
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) throw new Error('Scheduler is disposed')
  }
}

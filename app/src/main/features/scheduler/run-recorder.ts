import type { DbQueries } from '../../infra/db'
import type { JobRun, RunRecorder, ScheduleRunStatus } from './types'

export class DbRunRecorder implements RunRecorder {
  constructor(private readonly db: DbQueries) {}

  start(jobKey: string, startedAt: number): number {
    return this.db.insertScheduleRunStarted({ jobKey, startedAt })
  }

  finish(
    id: number,
    finishedAt: number,
    status: Exclude<ScheduleRunStatus, 'running'>,
    error?: string | null
  ): void {
    this.db.finishScheduleRun({ id, finishedAt, status, error: error ?? null })
  }

  list(jobKey: string, limit = 20): JobRun[] {
    return this.db.listScheduleRuns(jobKey, limit).map((r) => ({
      id: r.id,
      jobKey: r.job_key,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      status: r.status,
      error: r.error
    }))
  }
}

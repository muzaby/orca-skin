export type JobKey = 'usage-recompute' | (string & {})

export interface ScheduleSpec {
  cron: string
  enabled?: boolean
}

export type ScheduleRunStatus = 'running' | 'success' | 'error' | 'skipped'

export interface JobRun {
  id: number
  jobKey: string
  startedAt: number
  finishedAt: number | null
  status: ScheduleRunStatus
  error: string | null
}

export type JobAction = () => void | Promise<void>

export interface RunRecorder {
  start(jobKey: string, startedAt: number): number
  finish(
    id: number,
    finishedAt: number,
    status: Exclude<ScheduleRunStatus, 'running'>,
    error?: string | null
  ): void
}

export type JobKey = 'usage-recompute' | 'update-check' | (string & {})

// 잡은 두 방식 중 하나로 발화한다:
//   - cron       — 벽시계 정렬(예: 매시 정각). 정시성이 의미 있는 잡용.
//   - intervalMs — schedule() 호출 시각을 anchor 로 한 고정 간격. "앱 시작 후 N시간" 용(0156).
export type ScheduleSpec = { enabled?: boolean } & ({ cron: string } | { intervalMs: number })

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

// 예약 작업 공유 계약 — 순수 타입·상수·변환만 둔다(런타임 의존 0).
//
// 트리거는 cron 문자열이 아니라 UI 가 고른 형태 그대로 저장한다. cron 은 등록 시점에
// `triggerToCron` 한 곳에서만 만든다 — 화면 요약과 실제 발화가 같은 값에서 나오게 하기 위해서다.

import type { AgentKind } from './agent-kind'
import type { Backend, EffortLevel } from './ipc'
import type { NormalizedPermissionMode } from './permission-mode'

export const SCHEDULE_TITLE_MAX = 120
export const SCHEDULE_COMMAND_MAX = 8000

export interface TimeOfDay {
  hour: number
  minute: number
}

// cron 규약: 0 = 일요일.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6]

export type TriggerSpec =
  | { kind: 'hourly' }
  | { kind: 'daily'; at: TimeOfDay }
  | { kind: 'weekly'; day: Weekday; at: TimeOfDay }
  | { kind: 'custom'; days: Weekday[]; at: TimeOfDay }

export interface PromptExecution {
  backend: Backend
  agentKind: AgentKind
  providerKey: string
  modelFamily: string | null
  effort?: EffortLevel
  permissionMode: NormalizedPermissionMode
}

// shell 작업은 실행 설정을 가질 수 없다 — 불가능 조합을 union 이 막는다.
export type ScheduledTaskAction =
  { kind: 'prompt'; text: string; execution: PromptExecution } | { kind: 'shell'; command: string }

export type ScheduledRunStatus = 'running' | 'success' | 'error' | 'skipped'
export type ScheduledRunOrigin = 'schedule' | 'manual'

export interface ScheduledRun {
  id: number
  taskId: string
  origin: ScheduledRunOrigin
  startedAt: number
  finishedAt: number | null
  status: ScheduledRunStatus
  error: string | null
  sessionId: string | null
  exitCode: number | null
  output: string | null
  outputTruncated: boolean
}

export interface ScheduledTaskRecord {
  id: string
  title: string
  projectId: string | null
  trigger: TriggerSpec
  action: ScheduledTaskAction
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// 목록 응답 — `nextRunAt`·`running` 은 조회 시점에 main 이 합성한다. `lastRun` 은 출력을 싣지 않는다.
export interface ScheduledTask extends ScheduledTaskRecord {
  nextRunAt: number | null
  running: boolean
  lastRun: ScheduledRun | null
}

export interface ScheduledTaskInput {
  title: string
  projectId: string
  trigger: TriggerSpec
  action: ScheduledTaskAction
}

export type RunNowResult = { started: true } | { started: false; reason: 'running' | 'not_found' }

export interface ScheduledPromptStart {
  runId: number
  projectId: string
  text: string
  execution: PromptExecution
}

export type ScheduledPromptReport =
  { runId: number; ok: true; sessionId: string } | { runId: number; ok: false; error: string }

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

function validTime(at: TimeOfDay | undefined): at is TimeOfDay {
  return at != null && isInt(at.hour, 0, 23) && isInt(at.minute, 0, 59)
}

export function isValidTrigger(trigger: TriggerSpec): boolean {
  switch (trigger.kind) {
    case 'hourly':
      return true
    case 'daily':
      return validTime(trigger.at)
    case 'weekly':
      return validTime(trigger.at) && isInt(trigger.day, 0, 6)
    case 'custom':
      return (
        validTime(trigger.at) &&
        Array.isArray(trigger.days) &&
        trigger.days.length >= 1 &&
        trigger.days.every((day) => isInt(day, 0, 6)) &&
        new Set(trigger.days).size === trigger.days.length
      )
    default:
      return false
  }
}

export function triggerToCron(trigger: TriggerSpec): string {
  if (!isValidTrigger(trigger)) throw new Error('Invalid schedule trigger')
  switch (trigger.kind) {
    case 'hourly':
      return '0 * * * *'
    case 'daily':
      return `${trigger.at.minute} ${trigger.at.hour} * * *`
    case 'weekly':
      return `${trigger.at.minute} ${trigger.at.hour} * * ${trigger.day}`
    case 'custom':
      return `${trigger.at.minute} ${trigger.at.hour} * * ${[...trigger.days]
        .sort((a, b) => a - b)
        .join(',')}`
  }
}

// 실행 이력의 `error` 에 실리는 알려진 사유 코드. 화면이 문구로 옮기고, 그 밖의 값(프로세스·
// 하네스가 낸 메시지)은 원문 그대로 보인다.
export const SCHEDULE_RUN_ERROR = {
  projectMissing: 'project_missing',
  projectNoFolder: 'project_no_folder',
  timeout: 'timeout',
  nonZeroExit: 'non_zero_exit',
  appQuit: 'app_quit',
  cancelled: 'cancelled',
  noWindow: 'no_window',
  reportTimeout: 'report_timeout',
  previousRunning: 'previous_running'
} as const

import type { SessionSchedule } from '../../shared/session-schedules'
import { isRecord } from '../../shared/obj'

/**
 * Stop의 전체 예약 스냅샷. 필드 부재/잘못된 payload는 조회 불가이며 빈 목록과 다르다.
 * SDK 0.3.220은 next_run을 제공하지 않으므로 실행 시각을 만들어 넣지 않는다.
 */
export function readClaudeSessionSchedules(input: unknown): SessionSchedule[] | undefined {
  if (!isRecord(input) || !Array.isArray(input.session_crons)) return undefined
  const schedules: SessionSchedule[] = []
  const ids = new Set<string>()
  for (const entry of input.session_crons) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      entry.id.trim() === '' ||
      ids.has(entry.id) ||
      typeof entry.schedule !== 'string' ||
      entry.schedule.trim() === '' ||
      typeof entry.recurring !== 'boolean' ||
      typeof entry.prompt !== 'string'
    )
      return undefined
    ids.add(entry.id)
    schedules.push({
      id: entry.id,
      schedule: entry.schedule,
      recurring: entry.recurring,
      prompt: entry.prompt
    })
  }
  return schedules
}

export interface ClaudeScheduleCall {
  name: 'CronCreate' | 'CronDelete'
  input: unknown
}

/** 정확한 구조화 성공 영수증만 Stop 이전의 임시 예약 상태에 반영한다. */
export function applyClaudeScheduleReceipt(
  current: SessionSchedule[],
  call: ClaudeScheduleCall,
  output: unknown
): SessionSchedule[] | undefined {
  if (
    !isRecord(output) ||
    typeof output.id !== 'string' ||
    output.id.trim() === '' ||
    !isRecord(call.input)
  )
    return undefined
  if (call.name === 'CronDelete') {
    return call.input.id === output.id
      ? current.filter((entry) => entry.id !== output.id)
      : undefined
  }
  if (
    typeof call.input.cron !== 'string' ||
    call.input.cron.trim() === '' ||
    typeof call.input.prompt !== 'string' ||
    typeof output.recurring !== 'boolean'
  )
    return undefined
  return [
    ...current.filter((entry) => entry.id !== output.id),
    {
      id: output.id,
      schedule: call.input.cron,
      prompt: call.input.prompt,
      recurring: output.recurring
    }
  ]
}

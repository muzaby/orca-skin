// 예약 작업 IPC 핸들러. 판단은 `ScheduledTaskService` 가 하고 여기는 채널 ↔ 유스케이스 대응만
// 갖는다. 쓰기류는 'reject' 정책(무효 페이로드 = 프로그래머 오류 표면화).

import {
  CHANNELS,
  CreateScheduledTaskSchema,
  ScheduledPromptReportSchema,
  ScheduledTaskIdSchema,
  SetScheduledTaskEnabledSchema,
  UpdateScheduledTaskSchema
} from '../../../shared/protocol'
import type { RunNowResult, ScheduledRun, ScheduledTask } from '../../../shared/scheduled-tasks'
import type { PromptRelay, ScheduledTaskService } from '../../features/scheduled-tasks'
import { handle, handlePlain } from '../../infra/ipc/handle'

export function registerScheduledTaskHandlers(
  service: Pick<
    ScheduledTaskService,
    'list' | 'create' | 'update' | 'delete' | 'setEnabled' | 'runNow' | 'listRuns'
  >,
  relay: Pick<PromptRelay, 'report'>
): void {
  handlePlain(CHANNELS.scheduleList, (): ScheduledTask[] => service.list())

  handle(CHANNELS.scheduleCreate, CreateScheduledTaskSchema, 'reject', (req): ScheduledTask =>
    service.create(req)
  )

  handle(CHANNELS.scheduleUpdate, UpdateScheduledTaskSchema, 'reject', (req): ScheduledTask =>
    service.update(req)
  )

  handle(CHANNELS.scheduleDelete, ScheduledTaskIdSchema, 'reject', (req): void =>
    service.delete(req.id)
  )

  handle(CHANNELS.scheduleSetEnabled, SetScheduledTaskEnabledSchema, 'reject', (req): void =>
    service.setEnabled(req.id, req.enabled)
  )

  handle(CHANNELS.scheduleRunNow, ScheduledTaskIdSchema, 'reject', (req): RunNowResult =>
    service.runNow(req.id)
  )

  handle(
    CHANNELS.scheduleListRuns,
    ScheduledTaskIdSchema,
    { fallback: [] as ScheduledRun[] },
    (req): ScheduledRun[] => service.listRuns(req.id)
  )

  // renderer 가 예약 프롬프트의 새 대화 시작 결과를 돌려준다.
  handle(CHANNELS.schedulePromptReport, ScheduledPromptReportSchema, 'reject', (req): void =>
    relay.report(req)
  )
}

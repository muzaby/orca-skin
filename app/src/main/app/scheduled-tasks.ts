// 예약 작업 조립 — 실행기·프롬프트 릴레이·유스케이스를 한 벌로 묶는다. `electron` 을 import
// 하지 않으므로 수명주기 테스트가 production 과 같은 조립을 지난다. DB·shell 실행기·renderer
// push 는 `bootstrap.ts` 가 넘긴다.

import type { ScheduledPromptStart, ScheduledTaskRecord } from '../../shared/scheduled-tasks'
import {
  PromptRelay,
  ScheduledTaskRunner,
  ScheduledTaskService,
  type ProjectLookup,
  type ScheduledRunStore,
  type ScheduledTaskRunnerDeps,
  type ScheduledTaskStore
} from '../features/scheduled-tasks'
import { startCron, type CronJob } from '../infra/cron'

export interface ScheduledTasksDeps {
  store: ScheduledTaskStore & ScheduledRunStore
  projects: ProjectLookup
  runShell: ScheduledTaskRunnerDeps['runShell']
  // 보낼 창이 없으면 false.
  sendPromptStart: (payload: ScheduledPromptStart) => boolean
  onChanged: () => void
  onRestoreError?: (task: ScheduledTaskRecord, error: unknown) => void
  startCron?: (cron: string, fire: () => void) => CronJob
  now?: () => number
}

export interface ScheduledTasks {
  service: ScheduledTaskService
  relay: PromptRelay
  // 타이머 정지 → 실행 중단·이력 종결 → 대기 중 보고 종결. DB 가 열려 있는 동안 부른다.
  dispose(): void
}

export function createScheduledTasks(deps: ScheduledTasksDeps): ScheduledTasks {
  const relay = new PromptRelay(deps.sendPromptStart)
  const runner = new ScheduledTaskRunner({
    store: deps.store,
    projects: deps.projects,
    runShell: deps.runShell,
    startPrompt: (payload, signal) => relay.request(payload, signal),
    onChanged: deps.onChanged,
    now: deps.now
  })
  const service = new ScheduledTaskService({
    store: deps.store,
    runner,
    projects: deps.projects,
    startCron: deps.startCron ?? startCron,
    onChanged: deps.onChanged,
    onRestoreError: deps.onRestoreError,
    now: deps.now
  })
  return {
    service,
    relay,
    dispose: () => {
      service.dispose()
      runner.dispose()
      relay.dispose()
    }
  }
}

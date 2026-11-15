// 예약 작업 유스케이스 — IPC 핸들러가 부르는 한 벌과 작업당 cron 타이머.
//
// 저장된 작업 상태와 타이머는 `sync`/`stop` 두 함수로만 맞춘다. DB 를 먼저 쓰므로 "타이머는
// 도는데 저장 안 됨" 은 생기지 않고, 삭제는 타이머를 먼저 멈춰 "삭제된 작업이 발화" 가 없다.

import { randomUUID } from 'node:crypto'
import {
  triggerToCron,
  type RunNowResult,
  type ScheduledRun,
  type ScheduledTask,
  type ScheduledTaskInput,
  type ScheduledTaskRecord
} from '../../../shared/scheduled-tasks'
import type { CronJob } from '../../infra/cron'
import type { ScheduledTaskQueries } from '../../infra/db/scheduled-task-queries'
import { RUN_LIST_LIMIT } from './limits'
import type { ProjectLookup, ScheduledTaskRunner } from './runner'

export type ScheduledTaskStore = Pick<
  ScheduledTaskQueries,
  'listTasks' | 'getTask' | 'insertTask' | 'updateTask' | 'setEnabled' | 'deleteTask' | 'listRuns'
>

export interface ScheduledTaskServiceDeps {
  store: ScheduledTaskStore
  runner: Pick<ScheduledTaskRunner, 'fire' | 'isRunning' | 'cancel' | 'reconcileStaleRuns'>
  projects: ProjectLookup
  startCron: (cron: string, fire: () => void) => CronJob
  onChanged: () => void
  // 부팅 복원에서 한 작업의 타이머를 못 건 경우. 그 작업만 건너뛴다.
  onRestoreError?: (task: ScheduledTaskRecord, error: unknown) => void
  now?: () => number
  newId?: () => string
}

export class ScheduledTaskService {
  private readonly jobs = new Map<string, CronJob>()
  private readonly now: () => number
  private readonly newId: () => string

  constructor(private readonly deps: ScheduledTaskServiceDeps) {
    this.now = deps.now ?? Date.now
    this.newId = deps.newId ?? randomUUID
  }

  // 부팅 1회 — 이전 프로세스의 `running` 잔여를 정리하고 사용 중 작업의 타이머를 다시 건다.
  start(): void {
    this.deps.runner.reconcileStaleRuns()
    for (const task of this.deps.store.listTasks()) {
      try {
        this.sync(task)
      } catch (error) {
        this.deps.onRestoreError?.(task, error)
      }
    }
  }

  dispose(): void {
    for (const id of [...this.jobs.keys()]) this.stop(id)
  }

  list(): ScheduledTask[] {
    return this.deps.store.listTasks().map((task) => this.view(task))
  }

  create(input: ScheduledTaskInput): ScheduledTask {
    this.assertProject(input)
    const now = this.now()
    const task: ScheduledTaskRecord = {
      id: this.newId(),
      ...input,
      enabled: true,
      createdAt: now,
      updatedAt: now
    }
    this.deps.store.insertTask(task)
    return this.synced(task)
  }

  update(input: ScheduledTaskInput & { id: string }): ScheduledTask {
    const existing = this.existing(input.id)
    this.assertProject(input)
    const task: ScheduledTaskRecord = { ...existing, ...input, updatedAt: this.now() }
    this.deps.store.updateTask(task)
    return this.synced(task)
  }

  setEnabled(id: string, enabled: boolean): void {
    const task: ScheduledTaskRecord = { ...this.existing(id), enabled, updatedAt: this.now() }
    this.deps.store.setEnabled(id, enabled, task.updatedAt)
    this.synced(task)
  }

  delete(id: string): void {
    this.stop(id)
    this.deps.runner.cancel(id)
    this.deps.store.deleteTask(id)
    this.deps.onChanged()
  }

  runNow(id: string): RunNowResult {
    return this.deps.runner.fire(id, 'manual')
  }

  listRuns(id: string): ScheduledRun[] {
    return this.deps.store.listRuns(id, RUN_LIST_LIMIT)
  }

  private existing(id: string): ScheduledTaskRecord {
    const task = this.deps.store.getTask(id)
    if (!task) throw new Error('예약 작업을 찾을 수 없습니다.')
    return task
  }

  // 프로젝트는 필수이고 shell 은 폴더가 있어야 한다 — 폼과 같은 규칙을 main 이 다시 본다.
  private assertProject(input: ScheduledTaskInput): void {
    const project = this.deps.projects(input.projectId)
    if (!project) throw new Error('프로젝트를 찾을 수 없습니다.')
    if (input.action.kind === 'shell' && !project.cwd) {
      throw new Error('shell 명령은 폴더가 있는 프로젝트에서만 실행할 수 있습니다.')
    }
  }

  // 작업의 현재 상태로 타이머를 맞춘다 — 꺼졌으면 없고, 켜졌으면 그 트리거의 타이머 하나다.
  private sync(task: ScheduledTaskRecord): void {
    this.stop(task.id)
    if (!task.enabled) return
    const job = this.deps.startCron(triggerToCron(task.trigger), () => {
      this.deps.runner.fire(task.id, 'schedule')
    })
    this.jobs.set(task.id, job)
  }

  private stop(id: string): void {
    this.jobs.get(id)?.stop()
    this.jobs.delete(id)
  }

  // 저장 뒤 타이머를 맞추고 방송한다. 타이머가 던져도 방송은 한다 — 저장은 이미 됐다.
  private synced(task: ScheduledTaskRecord): ScheduledTask {
    try {
      this.sync(task)
    } finally {
      this.deps.onChanged()
    }
    return this.view(task)
  }

  // `lastRun` 은 출력을 싣지 않는다 — 목록 응답이 작업 수 × 출력 크기로 커지지 않게.
  private view(task: ScheduledTaskRecord): ScheduledTask {
    return {
      ...task,
      nextRunAt: this.jobs.get(task.id)?.nextRun()?.getTime() ?? null,
      running: this.deps.runner.isRunning(task.id),
      lastRun: this.deps.store.listRuns(task.id, 1, false)[0] ?? null
    }
  }
}

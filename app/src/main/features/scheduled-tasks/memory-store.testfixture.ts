// 예약 작업 저장소의 인메모리 구현 — DB(네이티브 모듈) 없이 slice 를 검증하기 위한 fixture.
// 보존 상한·`running` 가드는 `ScheduledTaskQueries` 와 같은 규칙을 따른다.

import type { ScheduledRun, ScheduledTaskRecord } from '../../../shared/scheduled-tasks'
import type { ScheduledRunStore } from './runner'
import type { ScheduledTaskStore } from './service'

type ScheduledTaskRepository = ScheduledTaskStore & ScheduledRunStore

export class MemoryScheduledTaskStore implements ScheduledTaskRepository {
  tasks = new Map<string, ScheduledTaskRecord>()
  runs: ScheduledRun[] = []
  private nextRunId = 1

  getTask(id: string): ScheduledTaskRecord | null {
    return this.tasks.get(id) ?? null
  }
  listTasks(): ScheduledTaskRecord[] {
    return [...this.tasks.values()]
  }
  insertTask(task: ScheduledTaskRecord): void {
    this.tasks.set(task.id, task)
  }
  updateTask(task: Parameters<ScheduledTaskRepository['updateTask']>[0]): void {
    const existing = this.tasks.get(task.id)
    if (existing) this.tasks.set(task.id, { ...existing, ...task })
  }
  setEnabled(id: string, enabled: boolean, updatedAt: number): void {
    const existing = this.tasks.get(id)
    if (existing) this.tasks.set(id, { ...existing, enabled, updatedAt })
  }
  deleteTask(id: string): void {
    this.tasks.delete(id)
    this.runs = this.runs.filter((run) => run.taskId !== id)
  }
  insertRun(row: Parameters<ScheduledTaskRepository['insertRun']>[0], keep: number): number {
    const id = this.nextRunId++
    this.runs.push({
      id,
      taskId: row.taskId,
      origin: row.origin,
      startedAt: row.startedAt,
      finishedAt: row.skipped ? row.startedAt : null,
      status: row.skipped ? 'skipped' : 'running',
      error: row.skipped?.error ?? null,
      sessionId: null,
      exitCode: null,
      output: null,
      outputTruncated: false
    })
    const kept = this.runsOf(row.taskId).slice(0, keep)
    this.runs = this.runs.filter((run) => run.taskId !== row.taskId || kept.includes(run))
    return id
  }
  finishRun(row: Parameters<ScheduledTaskRepository['finishRun']>[0]): void {
    const run = this.runs.find((item) => item.id === row.id)
    if (!run || run.status !== 'running') return
    Object.assign(run, {
      finishedAt: row.finishedAt,
      status: row.status,
      error: row.error ?? null,
      sessionId: row.sessionId ?? null,
      exitCode: row.exitCode ?? null,
      output: row.output ?? null,
      outputTruncated: row.outputTruncated ?? false
    })
  }
  failRunningRuns(finishedAt: number, error: string): number {
    const running = this.runs.filter((run) => run.status === 'running')
    for (const run of running) Object.assign(run, { finishedAt, status: 'error', error })
    return running.length
  }
  listRuns(taskId: string, limit: number, withOutput = true): ScheduledRun[] {
    return this.runsOf(taskId)
      .slice(0, limit)
      .map((run) => (withOutput ? { ...run } : { ...run, output: null }))
  }
  private runsOf(taskId: string): ScheduledRun[] {
    return this.runs
      .filter((run) => run.taskId === taskId)
      .sort((a, b) => b.startedAt - a.startedAt || b.id - a.id)
  }
}

export function promptTask(overrides: Partial<ScheduledTaskRecord> = {}): ScheduledTaskRecord {
  return {
    id: 'task-prompt',
    title: '아침 요약',
    projectId: 'project-a',
    trigger: { kind: 'hourly' },
    action: {
      kind: 'prompt',
      text: '새 버그를 요약해 줘',
      // 기본값과 구별되는 값으로 채운다 — 운반 중 하나가 기본값으로 바뀌면 단언이 깨지게.
      execution: {
        backend: 'claude',
        agentKind: 'work',
        providerKey: 'claude:team',
        modelFamily: 'claude-sonnet-5-5',
        effort: 'low',
        permissionMode: 'plan'
      }
    },
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

export function shellTask(overrides: Partial<ScheduledTaskRecord> = {}): ScheduledTaskRecord {
  return {
    id: 'task-shell',
    title: '야간 점검',
    projectId: 'project-a',
    trigger: { kind: 'daily', at: { hour: 9, minute: 0 } },
    action: { kind: 'shell', command: 'npm run nightly' },
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

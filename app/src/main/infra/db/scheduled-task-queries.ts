// 예약 작업 저장소. 정의와 실행 이력의 CRUD 만 갖는다 — 등록·실행 판단은
// `features/scheduled-tasks` 가 한다.

import type Database from 'better-sqlite3'
import {
  type ScheduledRun,
  type ScheduledRunOrigin,
  type ScheduledRunStatus,
  type ScheduledTaskAction,
  type ScheduledTaskRecord,
  type TriggerSpec
} from '../../../shared/scheduled-tasks'

interface TaskRow {
  id: string
  title: string
  project_id: string | null
  trigger_json: string
  action_json: string
  enabled: number
  created_at: number
  updated_at: number
}

interface RunRow {
  id: number
  task_id: string
  origin: ScheduledRunOrigin
  started_at: number
  finished_at: number | null
  status: ScheduledRunStatus
  error: string | null
  session_id: string | null
  exit_code: number | null
  output: string | null
  output_truncated: number
}

export interface ScheduledRunInsert {
  taskId: string
  origin: ScheduledRunOrigin
  startedAt: number
  // 건너뛴 실행은 시작과 동시에 종결된다.
  skipped?: { error: string }
}

export interface ScheduledRunFinish {
  id: number
  finishedAt: number
  status: Exclude<ScheduledRunStatus, 'running'>
  error?: string | null
  sessionId?: string | null
  exitCode?: number | null
  output?: string | null
  outputTruncated?: boolean
}

// 저장된 JSON 이 깨졌으면 그 행만 버린다 — 한 행 때문에 목록 전체가 죽지 않게.
function toTask(row: TaskRow): ScheduledTaskRecord | null {
  try {
    return {
      id: row.id,
      title: row.title,
      projectId: row.project_id,
      trigger: JSON.parse(row.trigger_json) as TriggerSpec,
      action: JSON.parse(row.action_json) as ScheduledTaskAction,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  } catch {
    return null
  }
}

function toRun(row: RunRow, withOutput: boolean): ScheduledRun {
  return {
    id: row.id,
    taskId: row.task_id,
    origin: row.origin,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    error: row.error,
    sessionId: row.session_id,
    exitCode: row.exit_code,
    output: withOutput ? row.output : null,
    outputTruncated: row.output_truncated === 1
  }
}

export class ScheduledTaskQueries {
  private readonly insertTaskStmt: Database.Statement
  private readonly updateTaskStmt: Database.Statement
  private readonly setEnabledStmt: Database.Statement
  private readonly deleteTaskStmt: Database.Statement
  private readonly getTaskStmt: Database.Statement
  private readonly listTasksStmt: Database.Statement
  private readonly insertRunStmt: Database.Statement
  private readonly pruneRunsStmt: Database.Statement
  private readonly finishRunStmt: Database.Statement
  private readonly listRunsStmt: Database.Statement
  private readonly failRunningStmt: Database.Statement
  private readonly startRun: Database.Transaction<(row: ScheduledRunInsert, keep: number) => number>

  constructor(db: Database.Database) {
    this.insertTaskStmt = db.prepare(`
      INSERT INTO scheduled_tasks
        (id, title, project_id, trigger_json, action_json, enabled, created_at, updated_at)
      VALUES (@id, @title, @projectId, @triggerJson, @actionJson, @enabled, @createdAt, @updatedAt)
    `)
    this.updateTaskStmt = db.prepare(`
      UPDATE scheduled_tasks
      SET title = @title, project_id = @projectId, trigger_json = @triggerJson,
          action_json = @actionJson, updated_at = @updatedAt
      WHERE id = @id
    `)
    this.setEnabledStmt = db.prepare(
      `UPDATE scheduled_tasks SET enabled = @enabled, updated_at = @updatedAt WHERE id = @id`
    )
    this.deleteTaskStmt = db.prepare(`DELETE FROM scheduled_tasks WHERE id = ?`)
    this.getTaskStmt = db.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`)
    this.listTasksStmt = db.prepare(`SELECT * FROM scheduled_tasks ORDER BY created_at DESC, id`)
    this.insertRunStmt = db.prepare(`
      INSERT INTO scheduled_task_runs (task_id, origin, started_at, finished_at, status, error)
      VALUES (@taskId, @origin, @startedAt, @finishedAt, @status, @error)
    `)
    // 보존 상한 — 방금 넣은 행을 포함해 최신 N건만 남긴다.
    this.pruneRunsStmt = db.prepare(`
      DELETE FROM scheduled_task_runs
      WHERE task_id = @taskId AND id NOT IN (
        SELECT id FROM scheduled_task_runs WHERE task_id = @taskId
        ORDER BY started_at DESC, id DESC LIMIT @keep
      )
    `)
    this.finishRunStmt = db.prepare(`
      UPDATE scheduled_task_runs
      SET finished_at = @finishedAt, status = @status, error = @error, session_id = @sessionId,
          exit_code = @exitCode, output = @output, output_truncated = @outputTruncated
      WHERE id = @id AND status = 'running'
    `)
    this.listRunsStmt = db.prepare(`
      SELECT * FROM scheduled_task_runs WHERE task_id = @taskId
      ORDER BY started_at DESC, id DESC LIMIT @limit
    `)
    this.failRunningStmt = db.prepare(`
      UPDATE scheduled_task_runs SET finished_at = @finishedAt, status = 'error', error = @error
      WHERE status = 'running'
    `)
    this.startRun = db.transaction((row: ScheduledRunInsert, keep: number) => {
      const info = this.insertRunStmt.run({
        taskId: row.taskId,
        origin: row.origin,
        startedAt: row.startedAt,
        finishedAt: row.skipped ? row.startedAt : null,
        status: row.skipped ? 'skipped' : 'running',
        error: row.skipped?.error ?? null
      })
      this.pruneRunsStmt.run({ taskId: row.taskId, keep })
      return Number(info.lastInsertRowid)
    })
  }

  insertTask(task: ScheduledTaskRecord): void {
    this.insertTaskStmt.run({
      id: task.id,
      title: task.title,
      projectId: task.projectId,
      triggerJson: JSON.stringify(task.trigger),
      actionJson: JSON.stringify(task.action),
      enabled: task.enabled ? 1 : 0,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    })
  }

  updateTask(
    task: Pick<
      ScheduledTaskRecord,
      'id' | 'title' | 'projectId' | 'trigger' | 'action' | 'updatedAt'
    >
  ): void {
    this.updateTaskStmt.run({
      id: task.id,
      title: task.title,
      projectId: task.projectId,
      triggerJson: JSON.stringify(task.trigger),
      actionJson: JSON.stringify(task.action),
      updatedAt: task.updatedAt
    })
  }

  setEnabled(id: string, enabled: boolean, updatedAt: number): void {
    this.setEnabledStmt.run({ id, enabled: enabled ? 1 : 0, updatedAt })
  }

  deleteTask(id: string): void {
    this.deleteTaskStmt.run(id)
  }

  getTask(id: string): ScheduledTaskRecord | null {
    const row = this.getTaskStmt.get(id) as TaskRow | undefined
    return row ? toTask(row) : null
  }

  listTasks(): ScheduledTaskRecord[] {
    return (this.listTasksStmt.all() as TaskRow[])
      .map(toTask)
      .filter((task): task is ScheduledTaskRecord => task != null)
  }

  // `keep` = 이 작업에 남길 최신 실행 수(방금 넣은 행 포함).
  insertRun(row: ScheduledRunInsert, keep: number): number {
    return this.startRun(row, keep)
  }

  finishRun(row: ScheduledRunFinish): void {
    this.finishRunStmt.run({
      id: row.id,
      finishedAt: row.finishedAt,
      status: row.status,
      error: row.error ?? null,
      sessionId: row.sessionId ?? null,
      exitCode: row.exitCode ?? null,
      output: row.output ?? null,
      outputTruncated: row.outputTruncated ? 1 : 0
    })
  }

  listRuns(taskId: string, limit: number, withOutput = true): ScheduledRun[] {
    return (this.listRunsStmt.all({ taskId, limit }) as RunRow[]).map((row) =>
      toRun(row, withOutput)
    )
  }

  // 부팅 시 이전 프로세스가 남긴 `running` 을 정리한다. 바뀐 행 수를 돌려준다.
  failRunningRuns(finishedAt: number, error: string): number {
    return this.failRunningStmt.run({ finishedAt, error }).changes
  }
}

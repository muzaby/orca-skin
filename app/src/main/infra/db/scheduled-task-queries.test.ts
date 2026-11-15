import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ScheduledTaskRecord } from '../../../shared/scheduled-tasks'
import { applyMigrations } from './migrate'
import { DbQueries } from './queries'

let sqlite: Database.Database
let q: DbQueries

// 보존 수는 호출자가 정한다.
const RUN_RETENTION = 5
const insertRun = (row: Parameters<DbQueries['scheduledTasks']['insertRun']>[0]): number =>
  q.scheduledTasks.insertRun(row, RUN_RETENTION)

const task = (overrides: Partial<ScheduledTaskRecord> = {}): ScheduledTaskRecord => ({
  id: 't1',
  title: '아침 요약',
  projectId: 'p1',
  trigger: { kind: 'custom', days: [1, 3], at: { hour: 9, minute: 30 } },
  action: {
    kind: 'prompt',
    text: '요약해 줘',
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
  createdAt: 10,
  updatedAt: 10,
  ...overrides
})

beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  applyMigrations(sqlite)
  q = new DbQueries(sqlite)
  q.insertProject({ id: 'p1', name: 'P1', instructions: '', createdAt: 1 })
})
afterEach(() => sqlite.close())

describe('ScheduledTaskQueries', () => {
  it('작업을 저장한 그대로 돌려준다', () => {
    q.scheduledTasks.insertTask(task())
    expect(q.scheduledTasks.getTask('t1')).toEqual(task())
    expect(q.scheduledTasks.listTasks()).toEqual([task()])
    expect(q.scheduledTasks.getTask('nope')).toBeNull()
  })

  it('수정·토글이 해당 필드만 바꾼다', () => {
    q.scheduledTasks.insertTask(task())
    q.scheduledTasks.updateTask({
      id: 't1',
      title: '야간 점검',
      projectId: 'p1',
      trigger: { kind: 'hourly' },
      action: { kind: 'shell', command: 'npm test' },
      updatedAt: 20
    })
    q.scheduledTasks.setEnabled('t1', false, 30)
    expect(q.scheduledTasks.getTask('t1')).toEqual({
      id: 't1',
      title: '야간 점검',
      projectId: 'p1',
      trigger: { kind: 'hourly' },
      action: { kind: 'shell', command: 'npm test' },
      enabled: false,
      createdAt: 10,
      updatedAt: 30
    })
  })

  it('프로젝트를 지우면 작업은 남고 project_id 만 빈다', () => {
    q.scheduledTasks.insertTask(task())
    q.deleteProject('p1')
    expect(q.scheduledTasks.getTask('t1')).toMatchObject({ id: 't1', projectId: null })
  })

  it('실행을 시작·종결하고 최신순으로 돌려준다', () => {
    q.scheduledTasks.insertTask(task())
    const first = insertRun({ taskId: 't1', origin: 'schedule', startedAt: 100 })
    const second = insertRun({ taskId: 't1', origin: 'manual', startedAt: 200 })
    q.scheduledTasks.finishRun({
      id: first,
      finishedAt: 150,
      status: 'error',
      error: 'timeout',
      exitCode: 1,
      output: 'log',
      outputTruncated: true
    })
    q.scheduledTasks.finishRun({ id: second, finishedAt: 250, status: 'success', sessionId: 's9' })
    expect(q.scheduledTasks.listRuns('t1', 10)).toEqual([
      {
        id: second,
        taskId: 't1',
        origin: 'manual',
        startedAt: 200,
        finishedAt: 250,
        status: 'success',
        error: null,
        sessionId: 's9',
        exitCode: null,
        output: null,
        outputTruncated: false
      },
      {
        id: first,
        taskId: 't1',
        origin: 'schedule',
        startedAt: 100,
        finishedAt: 150,
        status: 'error',
        error: 'timeout',
        sessionId: null,
        exitCode: 1,
        output: 'log',
        outputTruncated: true
      }
    ])
    // 출력 제외 조회 + limit.
    expect(q.scheduledTasks.listRuns('t1', 1, false)).toEqual([
      expect.objectContaining({ id: second })
    ])
    expect(q.scheduledTasks.listRuns('t1', 10, false)[1]).toMatchObject({ output: null })
  })

  it('이미 종결된 실행은 다시 종결되지 않는다', () => {
    q.scheduledTasks.insertTask(task())
    const id = insertRun({ taskId: 't1', origin: 'schedule', startedAt: 1 })
    q.scheduledTasks.finishRun({ id, finishedAt: 2, status: 'error', error: 'app_quit' })
    q.scheduledTasks.finishRun({ id, finishedAt: 3, status: 'success' })
    expect(q.scheduledTasks.listRuns('t1', 1)[0]).toMatchObject({
      status: 'error',
      error: 'app_quit',
      finishedAt: 2
    })
  })

  it('건너뛴 실행은 시작과 동시에 종결된 행이다', () => {
    q.scheduledTasks.insertTask(task())
    insertRun({
      taskId: 't1',
      origin: 'schedule',
      startedAt: 5,
      skipped: { error: 'previous_running' }
    })
    expect(q.scheduledTasks.listRuns('t1', 1)[0]).toMatchObject({
      status: 'skipped',
      error: 'previous_running',
      finishedAt: 5
    })
  })

  it('작업당 이력은 보존 상한까지만 남고 최신이 유지된다', () => {
    q.scheduledTasks.insertTask(task())
    q.scheduledTasks.insertTask(task({ id: 't2' }))
    insertRun({ taskId: 't2', origin: 'schedule', startedAt: 1 })
    for (let i = 1; i <= RUN_RETENTION + 1; i++) {
      insertRun({ taskId: 't1', origin: 'schedule', startedAt: i })
    }
    const runs = q.scheduledTasks.listRuns('t1', 1000)
    expect(runs).toHaveLength(RUN_RETENTION)
    expect(runs[0]!.startedAt).toBe(RUN_RETENTION + 1)
    expect(runs.at(-1)!.startedAt).toBe(2)
    // 다른 작업의 이력은 건드리지 않는다.
    expect(q.scheduledTasks.listRuns('t2', 10)).toHaveLength(1)
  })

  it('작업을 지우면 이력도 지워진다', () => {
    q.scheduledTasks.insertTask(task())
    insertRun({ taskId: 't1', origin: 'schedule', startedAt: 1 })
    q.scheduledTasks.deleteTask('t1')
    expect(q.scheduledTasks.listRuns('t1', 10)).toEqual([])
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM scheduled_task_runs').get()).toEqual({ n: 0 })
  })

  it('실행 중 잔여만 실패로 바꾼다', () => {
    q.scheduledTasks.insertTask(task())
    const done = insertRun({ taskId: 't1', origin: 'schedule', startedAt: 1 })
    q.scheduledTasks.finishRun({ id: done, finishedAt: 2, status: 'success' })
    insertRun({ taskId: 't1', origin: 'schedule', startedAt: 3 })
    expect(q.scheduledTasks.failRunningRuns(9, 'app_quit')).toBe(1)
    expect(q.scheduledTasks.listRuns('t1', 10).map((run) => [run.status, run.error])).toEqual([
      ['error', 'app_quit'],
      ['success', null]
    ])
  })

  it('깨진 JSON 행은 목록에서 빠진다', () => {
    q.scheduledTasks.insertTask(task())
    sqlite.prepare(`UPDATE scheduled_tasks SET trigger_json = '{' WHERE id = 't1'`).run()
    expect(q.scheduledTasks.listTasks()).toEqual([])
    expect(q.scheduledTasks.getTask('t1')).toBeNull()
  })
})

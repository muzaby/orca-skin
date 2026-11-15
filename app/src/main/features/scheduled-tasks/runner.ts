// 예약 작업 실행기. 겹침 가드·실행 분기·이력 종결을 한 곳이 갖는다.
// `running` 이력은 반드시 `finishRun` 으로 끝난다.

import {
  SCHEDULE_RUN_ERROR,
  type RunNowResult,
  type ScheduledPromptStart,
  type ScheduledRunOrigin,
  type ScheduledTaskRecord
} from '../../../shared/scheduled-tasks'
import type {
  ScheduledRunFinish,
  ScheduledTaskQueries
} from '../../infra/db/scheduled-task-queries'
import type { ShellRunInput, ShellRunResult } from '../../infra/shell/shell-runner'
import { OUTPUT_TAIL_BYTES, RUN_RETENTION, SHELL_TIMEOUT_MS } from './limits'

export type ScheduledRunStore = Pick<
  ScheduledTaskQueries,
  'getTask' | 'insertRun' | 'finishRun' | 'failRunningRuns'
>

// undefined = 프로젝트 없음, cwd null = 폴더 없는 프로젝트.
export type ProjectLookup = (projectId: string) => { cwd: string | null } | undefined

export type StartPrompt = (
  payload: ScheduledPromptStart,
  signal: AbortSignal
) => Promise<{ sessionId: string }>

export interface ScheduledTaskRunnerDeps {
  store: ScheduledRunStore
  projects: ProjectLookup
  runShell: (
    input: Pick<ShellRunInput, 'command' | 'cwd' | 'signal' | 'timeoutMs' | 'maxOutputBytes'>
  ) => Promise<ShellRunResult>
  startPrompt: StartPrompt
  onChanged: () => void
  now?: () => number
}

interface Inflight {
  runId: number
  controller: AbortController
}

type Finish = Omit<ScheduledRunFinish, 'id' | 'finishedAt'>

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export class ScheduledTaskRunner {
  private readonly inflight = new Map<string, Inflight>()
  private readonly now: () => number
  private disposed = false

  constructor(private readonly deps: ScheduledTaskRunnerDeps) {
    this.now = deps.now ?? Date.now
  }

  isRunning(taskId: string): boolean {
    return this.inflight.has(taskId)
  }

  fire(taskId: string, origin: ScheduledRunOrigin): RunNowResult {
    if (this.disposed) return { started: false, reason: 'not_found' }
    const task = this.deps.store.getTask(taskId)
    if (!task) return { started: false, reason: 'not_found' }
    if (this.inflight.has(taskId)) {
      // 예약 발화가 겹치면 건너뛴 사실을 이력에 남긴다. 수동 실행은 호출자가 응답으로 안다.
      if (origin === 'schedule') {
        this.deps.store.insertRun(
          {
            taskId,
            origin,
            startedAt: this.now(),
            skipped: { error: SCHEDULE_RUN_ERROR.previousRunning }
          },
          RUN_RETENTION
        )
        this.deps.onChanged()
      }
      return { started: false, reason: 'running' }
    }
    const runId = this.deps.store.insertRun(
      { taskId, origin, startedAt: this.now() },
      RUN_RETENTION
    )
    const controller = new AbortController()
    this.inflight.set(taskId, { runId, controller })
    this.deps.onChanged()
    void this.execute(task, runId, controller.signal).then(
      (finish) => this.finishRun(taskId, runId, finish),
      (e) => this.finishRun(taskId, runId, { status: 'error', error: message(e) })
    )
    return { started: true }
  }

  // 삭제되는 작업의 실행을 멈춘다. 이력 행은 작업과 함께 지워진다.
  cancel(taskId: string): void {
    this.abort(taskId, SCHEDULE_RUN_ERROR.cancelled)
  }

  // 이전 프로세스가 남긴 `running` 을 정리한다(부팅 1회).
  reconcileStaleRuns(): number {
    return this.deps.store.failRunningRuns(this.now(), SCHEDULE_RUN_ERROR.appQuit)
  }

  dispose(): void {
    if (this.disposed) return
    for (const taskId of [...this.inflight.keys()]) this.abort(taskId, SCHEDULE_RUN_ERROR.appQuit)
    this.disposed = true
  }

  private abort(taskId: string, error: string): void {
    const entry = this.inflight.get(taskId)
    if (!entry) return
    entry.controller.abort()
    this.finishRun(taskId, entry.runId, { status: 'error', error })
  }

  private async execute(
    task: ScheduledTaskRecord,
    runId: number,
    signal: AbortSignal
  ): Promise<Finish> {
    const project = task.projectId ? this.deps.projects(task.projectId) : undefined
    if (!task.projectId || !project) {
      return { status: 'error', error: SCHEDULE_RUN_ERROR.projectMissing }
    }
    if (task.action.kind === 'shell') {
      if (!project.cwd) return { status: 'error', error: SCHEDULE_RUN_ERROR.projectNoFolder }
      const result = await this.deps.runShell({
        command: task.action.command,
        cwd: project.cwd,
        signal,
        timeoutMs: SHELL_TIMEOUT_MS,
        maxOutputBytes: OUTPUT_TAIL_BYTES
      })
      const ok = result.exitCode === 0 && !result.timedOut
      return {
        status: ok ? 'success' : 'error',
        error: ok
          ? null
          : result.timedOut
            ? SCHEDULE_RUN_ERROR.timeout
            : (result.error ?? SCHEDULE_RUN_ERROR.nonZeroExit),
        exitCode: result.exitCode,
        output: result.output,
        outputTruncated: result.truncated
      }
    }
    const started = await this.deps.startPrompt(
      {
        runId,
        projectId: task.projectId,
        text: task.action.text,
        execution: task.action.execution
      },
      signal
    )
    return { status: 'success', sessionId: started.sessionId }
  }

  // `running` → 종결의 유일한 자리. 이미 끝난(취소·종료) 실행의 늦은 결과는 버린다.
  private finishRun(taskId: string, runId: number, finish: Finish): void {
    const entry = this.inflight.get(taskId)
    if (!entry || entry.runId !== runId) return
    this.inflight.delete(taskId)
    this.deps.store.finishRun({ id: runId, finishedAt: this.now(), ...finish })
    this.deps.onChanged()
  }
}

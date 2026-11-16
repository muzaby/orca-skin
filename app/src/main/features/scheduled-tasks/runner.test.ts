import { describe, expect, it, vi } from 'vitest'
import { SCHEDULE_RUN_ERROR, type ScheduledPromptStart } from '../../../shared/scheduled-tasks'
import { MemoryScheduledTaskStore, promptTask, shellTask } from './memory-store.testfixture'
import type { ShellRunResult } from '../../infra/shell/shell-runner'
import { OUTPUT_TAIL_BYTES, RUN_RETENTION, SHELL_TIMEOUT_MS } from './limits'
import { ScheduledTaskRunner, type ScheduledTaskRunnerDeps } from './runner'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: Error) => void
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const SHELL_OK: ShellRunResult = {
  exitCode: 0,
  output: 'done',
  truncated: false,
  timedOut: false,
  error: null
}

function setup(): {
  store: MemoryScheduledTaskStore
  runner: ScheduledTaskRunner
  shell: Deferred<ShellRunResult>
  prompt: Deferred<{ sessionId: string }>
  shellCalls: Parameters<ScheduledTaskRunnerDeps['runShell']>[0][]
  promptCalls: ScheduledPromptStart[]
  changed: ReturnType<typeof vi.fn>
  projects: Map<string, { cwd: string | null }>
} {
  const store = new MemoryScheduledTaskStore()
  store.insertTask(shellTask())
  store.insertTask(promptTask())
  const shell = deferred<ShellRunResult>()
  const prompt = deferred<{ sessionId: string }>()
  const shellCalls: Parameters<ScheduledTaskRunnerDeps['runShell']>[0][] = []
  const promptCalls: ScheduledPromptStart[] = []
  const changed = vi.fn()
  const projects = new Map<string, { cwd: string | null }>([
    ['project-a', { cwd: 'C:\\work\\a' }],
    ['project-flat', { cwd: null }]
  ])
  let clock = 1000
  const runner = new ScheduledTaskRunner({
    store,
    projects: (id) => projects.get(id),
    runShell: (input) => {
      shellCalls.push(input)
      return shell.promise
    },
    startPrompt: (payload) => {
      promptCalls.push(payload)
      return prompt.promise
    },
    onChanged: changed,
    now: () => clock++
  })
  return { store, runner, shell, prompt, shellCalls, promptCalls, changed, projects }
}

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('ScheduledTaskRunner — shell', () => {
  it('프로젝트 폴더에서 명령을 실행하고 exit 0 이면 성공으로 종결한다', async () => {
    const { store, runner, shell, shellCalls, changed } = setup()
    expect(runner.fire('task-shell', 'schedule')).toEqual({ started: true })
    expect(runner.isRunning('task-shell')).toBe(true)
    expect(store.runs[0]).toMatchObject({ status: 'running', origin: 'schedule' })
    expect(shellCalls).toHaveLength(1)
    expect(shellCalls[0]).toMatchObject({
      command: 'npm run nightly',
      cwd: 'C:\\work\\a',
      timeoutMs: SHELL_TIMEOUT_MS,
      maxOutputBytes: OUTPUT_TAIL_BYTES
    })
    shell.resolve({ ...SHELL_OK, output: 'all good', truncated: true })
    await settle()
    expect(store.runs[0]).toMatchObject({
      status: 'success',
      error: null,
      exitCode: 0,
      output: 'all good',
      outputTruncated: true
    })
    expect(store.runs[0]!.finishedAt).not.toBeNull()
    expect(runner.isRunning('task-shell')).toBe(false)
    // 시작과 종결 각각 방송한다(EP-7).
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it.each<[string, Partial<ShellRunResult>, string]>([
    ['0 이 아닌 종료', { exitCode: 2 }, SCHEDULE_RUN_ERROR.nonZeroExit],
    ['제한 시간 초과', { exitCode: null, timedOut: true }, SCHEDULE_RUN_ERROR.timeout],
    ['실행 불가', { exitCode: null, error: 'spawn ENOENT' }, 'spawn ENOENT']
  ])('%s 는 실패로 종결하고 사유를 남긴다', async (_name, result, error) => {
    const { store, runner, shell } = setup()
    runner.fire('task-shell', 'schedule')
    shell.resolve({ ...SHELL_OK, ...result })
    await settle()
    expect(store.runs[0]).toMatchObject({ status: 'error', error })
    expect(runner.isRunning('task-shell')).toBe(false)
  })

  it('runShell 이 던져도 실행 중으로 남지 않는다', async () => {
    const { store, runner, shell } = setup()
    runner.fire('task-shell', 'schedule')
    shell.reject(new Error('boom'))
    await settle()
    expect(store.runs[0]).toMatchObject({ status: 'error', error: 'boom' })
    expect(runner.isRunning('task-shell')).toBe(false)
  })
})

describe('ScheduledTaskRunner — 프롬프트', () => {
  it('작업의 실행 설정을 그대로 넘기고 세션 id 로 성공 종결한다', async () => {
    const { store, runner, prompt, promptCalls } = setup()
    runner.fire('task-prompt', 'manual')
    expect(promptCalls).toEqual([
      {
        runId: store.runs[0]!.id,
        projectId: 'project-a',
        text: '새 버그를 요약해 줘',
        execution: {
          backend: 'claude',
          agentKind: 'work',
          providerKey: 'claude:team',
          modelFamily: 'claude-sonnet-5-5',
          effort: 'low',
          permissionMode: 'plan'
        }
      }
    ])
    prompt.resolve({ sessionId: 'session-9' })
    await settle()
    expect(store.runs[0]).toMatchObject({
      status: 'success',
      sessionId: 'session-9',
      origin: 'manual'
    })
  })

  it('시작 실패는 사유와 함께 실패로 종결한다', async () => {
    const { store, runner, prompt } = setup()
    runner.fire('task-prompt', 'schedule')
    prompt.reject(new Error(SCHEDULE_RUN_ERROR.noWindow))
    await settle()
    expect(store.runs[0]).toMatchObject({
      status: 'error',
      error: SCHEDULE_RUN_ERROR.noWindow,
      sessionId: null
    })
  })
})

describe('ScheduledTaskRunner — 겹침 가드', () => {
  it('실행 중 예약 발화는 건너뜀 이력만 남기고 새 실행을 시작하지 않는다', async () => {
    const { store, runner, shellCalls, changed } = setup()
    runner.fire('task-shell', 'schedule')
    changed.mockClear()
    expect(runner.fire('task-shell', 'schedule')).toEqual({ started: false, reason: 'running' })
    expect(shellCalls).toHaveLength(1)
    expect(store.runs.map((run) => run.status)).toEqual(['running', 'skipped'])
    // 건너뛴 기록도 목록에 보이도록 알린다.
    expect(changed).toHaveBeenCalledTimes(1)
    expect(store.runs[1]).toMatchObject({ error: SCHEDULE_RUN_ERROR.previousRunning })
  })

  it('실행 중 수동 실행은 거부만 하고 이력을 남기지 않는다', () => {
    const { store, runner, shellCalls } = setup()
    runner.fire('task-shell', 'schedule')
    expect(runner.fire('task-shell', 'manual')).toEqual({ started: false, reason: 'running' })
    expect(shellCalls).toHaveLength(1)
    expect(store.runs).toHaveLength(1)
  })

  it('다른 작업은 동시에 실행된다', () => {
    const { runner, shellCalls, promptCalls } = setup()
    runner.fire('task-shell', 'schedule')
    expect(runner.fire('task-prompt', 'schedule')).toEqual({ started: true })
    expect(shellCalls).toHaveLength(1)
    expect(promptCalls).toHaveLength(1)
  })

  it('끝난 뒤에는 다시 실행할 수 있다', async () => {
    const { runner, shell } = setup()
    runner.fire('task-shell', 'schedule')
    shell.resolve(SHELL_OK)
    await settle()
    expect(runner.fire('task-shell', 'manual')).toEqual({ started: true })
  })

  it('없는 작업은 not_found 다', () => {
    const { store, runner } = setup()
    expect(runner.fire('nope', 'manual')).toEqual({ started: false, reason: 'not_found' })
    expect(store.runs).toHaveLength(0)
  })
})

describe('ScheduledTaskRunner — 프로젝트', () => {
  it('프로젝트가 지워진 작업은 실행하지 않고 실패로 종결한다', async () => {
    const { store, runner, shellCalls } = setup()
    store.insertTask(shellTask({ id: 'orphan', projectId: null }))
    runner.fire('orphan', 'schedule')
    await settle()
    expect(shellCalls).toHaveLength(0)
    expect(store.runs[0]).toMatchObject({
      status: 'error',
      error: SCHEDULE_RUN_ERROR.projectMissing
    })
  })

  it('DB 에 없는 프로젝트 id 도 프로젝트 없음이다', async () => {
    const { store, runner, promptCalls } = setup()
    store.insertTask(promptTask({ id: 'ghost', projectId: 'gone' }))
    runner.fire('ghost', 'schedule')
    await settle()
    expect(promptCalls).toHaveLength(0)
    expect(store.runs[0]).toMatchObject({ error: SCHEDULE_RUN_ERROR.projectMissing })
  })

  it('폴더 없는 프로젝트의 shell 은 실행하지 않는다', async () => {
    const { store, runner, shellCalls } = setup()
    store.insertTask(shellTask({ id: 'flat', projectId: 'project-flat' }))
    runner.fire('flat', 'schedule')
    await settle()
    expect(shellCalls).toHaveLength(0)
    expect(store.runs[0]).toMatchObject({ error: SCHEDULE_RUN_ERROR.projectNoFolder })
  })
})

describe('ScheduledTaskRunner — 종료·정리', () => {
  it('dispose 는 실행 중 작업을 중단시키고 앱 종료 사유로 종결한다', async () => {
    const { store, runner, shell, shellCalls } = setup()
    runner.fire('task-shell', 'schedule')
    runner.dispose()
    expect(shellCalls[0]!.signal!.aborted).toBe(true)
    expect(store.runs[0]).toMatchObject({ status: 'error', error: SCHEDULE_RUN_ERROR.appQuit })
    // 늦게 도착한 결과가 종결을 덮지 않는다.
    shell.resolve(SHELL_OK)
    await settle()
    expect(store.runs[0]).toMatchObject({ status: 'error', error: SCHEDULE_RUN_ERROR.appQuit })
    expect(runner.fire('task-shell', 'manual')).toEqual({ started: false, reason: 'not_found' })
  })

  it('reconcileStaleRuns 는 이전 프로세스의 실행 중 잔여를 실패로 바꾼다', () => {
    const { store, runner } = setup()
    store.insertRun({ taskId: 'task-shell', origin: 'schedule', startedAt: 1 }, RUN_RETENTION)
    store.insertRun({ taskId: 'task-prompt', origin: 'manual', startedAt: 2 }, RUN_RETENTION)
    expect(runner.reconcileStaleRuns()).toBe(2)
    expect(store.runs.map((run) => [run.status, run.error])).toEqual([
      ['error', SCHEDULE_RUN_ERROR.appQuit],
      ['error', SCHEDULE_RUN_ERROR.appQuit]
    ])
  })

  it('중단된 실행의 늦은 결과가 같은 작업의 다음 실행을 끝내지 않는다', async () => {
    const store = new MemoryScheduledTaskStore()
    store.insertTask(shellTask())
    const pending: ((result: ShellRunResult) => void)[] = []
    const runner = new ScheduledTaskRunner({
      store,
      projects: () => ({ cwd: 'C:\\work\\a' }),
      runShell: () => new Promise((resolve) => pending.push(resolve)),
      startPrompt: () => new Promise(() => undefined),
      onChanged: () => undefined
    })
    runner.fire('task-shell', 'schedule')
    runner.cancel('task-shell')
    runner.fire('task-shell', 'manual')
    // 취소된 첫 실행의 프로세스가 뒤늦게 끝난다.
    pending[0]!(SHELL_OK)
    await settle()
    expect(runner.isRunning('task-shell')).toBe(true)
    expect(store.runs.map((run) => run.status)).toEqual(['error', 'running'])
    pending[1]!(SHELL_OK)
    await settle()
    expect(store.runs.map((run) => run.status)).toEqual(['error', 'success'])
  })

  it('cancel 은 그 작업의 실행만 중단한다', () => {
    const { store, runner, shellCalls } = setup()
    runner.fire('task-shell', 'schedule')
    runner.fire('task-prompt', 'schedule')
    runner.cancel('task-shell')
    expect(shellCalls[0]!.signal!.aborted).toBe(true)
    expect(runner.isRunning('task-shell')).toBe(false)
    expect(runner.isRunning('task-prompt')).toBe(true)
    expect(store.runs.find((run) => run.taskId === 'task-shell')).toMatchObject({
      status: 'error',
      error: SCHEDULE_RUN_ERROR.cancelled
    })
  })
})

describe('ScheduledTaskRunner — r2 보강', () => {
  // 제한 시간을 넘긴 셸이 종료 신호를 잡고 0 으로 끝나도 성공이 아니다(AC15).
  it('제한 시간을 넘긴 실행은 종료 코드가 0 이어도 제한 시간 초과로 실패한다', async () => {
    const { store, runner, shell } = setup()
    runner.fire('task-shell', 'schedule')
    shell.resolve({ ...SHELL_OK, exitCode: 0, timedOut: true })
    await settle()
    expect(store.runs[0]).toMatchObject({
      status: 'error',
      error: SCHEDULE_RUN_ERROR.timeout,
      exitCode: 0
    })
  })

  // 본문 앞뒤 공백 정리는 renderer 의 새 대화 시작 한 곳이 한다 — 실행기는 저장값 그대로 넘긴다.
  it('프롬프트 본문을 저장된 그대로(앞뒤 공백 포함) 넘긴다', () => {
    const { store, runner, promptCalls } = setup()
    store.insertTask(
      promptTask({ id: 'task-padded', action: { ...promptAction(), text: '  점검 \n' } })
    )
    runner.fire('task-padded', 'manual')
    expect(promptCalls.map((call) => call.text)).toEqual(['  점검 \n'])
  })
})

function promptAction(): Extract<ReturnType<typeof promptTask>['action'], { kind: 'prompt' }> {
  const action = promptTask().action
  if (action.kind !== 'prompt') throw new Error('prompt fixture')
  return action
}

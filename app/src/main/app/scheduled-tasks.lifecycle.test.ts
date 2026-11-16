// 예약 작업 수명주기 — 저장 → 타이머 → cron 발화 → 실행 → 이력 → 재시작 복원을 production
// 조립(`createScheduledTasks`)과 실제 croner 로 지난다. 가짜인 것은 시계와 저장소(인메모리)·
// shell 프로세스·renderer push 뿐이다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MemoryScheduledTaskStore,
  shellTask
} from '../features/scheduled-tasks/memory-store.testfixture'
import { RUN_RETENTION } from '../features/scheduled-tasks/limits'
import type { ScheduledTaskInput, ScheduledTaskRecord } from '../../shared/scheduled-tasks'
import { createScheduledTasks, type ScheduledTasks } from './scheduled-tasks'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

interface App extends ScheduledTasks {
  commands: string[]
  changed: ReturnType<typeof vi.fn>
  restoreErrors: ScheduledTaskRecord[]
}

let booted: App[] = []

// 앱 한 번의 부팅 — 조립하고 `start()` 로 복원한다.
function boot(store: MemoryScheduledTaskStore): App {
  const commands: string[] = []
  const changed = vi.fn()
  const restoreErrors: ScheduledTaskRecord[] = []
  const app: App = {
    ...createScheduledTasks({
      store,
      projects: (id) =>
        id === 'project-a'
          ? { cwd: 'C:\\work\\a' }
          : id === 'project-flat'
            ? { cwd: null }
            : undefined,
      runShell: async ({ command }) => {
        commands.push(command)
        return {
          exitCode: 0,
          output: `ran ${command}`,
          truncated: false,
          timedOut: false,
          error: null
        }
      },
      sendPromptStart: () => false,
      onChanged: changed,
      onRestoreError: (task) => restoreErrors.push(task)
    }),
    commands,
    changed,
    restoreErrors
  }
  app.service.start()
  booted.push(app)
  return app
}

const hourly = (command: string): ScheduledTaskInput => ({
  title: command,
  projectId: 'project-a',
  trigger: { kind: 'hourly' },
  action: { kind: 'shell', command }
})

beforeEach(() => {
  vi.useFakeTimers()
  // 로컬 12:30 — 다음 정각까지 30분.
  vi.setSystemTime(new Date(2026, 0, 5, 12, 30, 0))
  booted = []
})
afterEach(() => {
  for (const app of booted) app.dispose()
  vi.useRealTimers()
})

describe('예약 작업 수명주기', () => {
  it('생성한 작업이 다음 정각에 발화해 이력을 남긴다', async () => {
    const { service, commands } = boot(new MemoryScheduledTaskStore())
    const created = service.create(hourly('echo one'))
    expect(created.enabled).toBe(true)
    expect(created.nextRunAt).toBe(new Date(2026, 0, 5, 13, 0, 0).getTime())
    expect(service.list().map((task) => task.id)).toEqual([created.id])

    await vi.advanceTimersByTimeAsync(29 * MINUTE)
    expect(commands).toEqual([])
    await vi.advanceTimersByTimeAsync(MINUTE)
    expect(commands).toEqual(['echo one'])
    expect(service.listRuns(created.id)).toEqual([
      expect.objectContaining({
        status: 'success',
        origin: 'schedule',
        exitCode: 0,
        output: 'ran echo one'
      })
    ])
    // 목록의 lastRun 은 출력을 싣지 않는다.
    expect(service.list()[0]!.lastRun).toMatchObject({ status: 'success', output: null })
  })

  it('끈 작업은 발화하지 않고 다시 켜면 발화한다', async () => {
    const { service, commands } = boot(new MemoryScheduledTaskStore())
    const { id } = service.create(hourly('echo toggle'))
    service.setEnabled(id, false)
    expect(service.list()[0]).toMatchObject({ enabled: false, nextRunAt: null })
    await vi.advanceTimersByTimeAsync(2 * HOUR)
    expect(commands).toEqual([])

    service.setEnabled(id, true)
    expect(service.list()[0]!.nextRunAt).not.toBeNull()
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(commands).toEqual(['echo toggle'])
  })

  it('편집으로 트리거를 바꾸면 새 시각에만 발화한다', async () => {
    const { service, commands } = boot(new MemoryScheduledTaskStore())
    const created = service.create(hourly('echo edit'))
    const updated = service.update({
      ...hourly('echo edited'),
      id: created.id,
      trigger: { kind: 'daily', at: { hour: 15, minute: 0 } }
    })
    expect(updated.nextRunAt).toBe(new Date(2026, 0, 5, 15, 0, 0).getTime())
    // 옛 타이머(13:00)가 남아 있으면 여기서 발화한다.
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(commands).toEqual([])
    await vi.advanceTimersByTimeAsync(2 * HOUR)
    expect(commands).toEqual(['echo edited'])
  })

  it('삭제한 작업은 발화하지 않고 이력도 사라진다', async () => {
    const { service, commands } = boot(new MemoryScheduledTaskStore())
    const { id } = service.create(hourly('echo gone'))
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(commands).toHaveLength(1)
    service.delete(id)
    // 지워진 작업의 타이머가 남아 헛발화하지 않는다.
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(3 * HOUR)
    expect(commands).toHaveLength(1)
    expect(service.list()).toEqual([])
    expect(service.listRuns(id)).toEqual([])
  })

  it('지금 실행은 즉시 1회 실행하고 예약을 바꾸지 않는다', async () => {
    const { service, commands } = boot(new MemoryScheduledTaskStore())
    const created = service.create(hourly('echo now'))
    expect(service.runNow(created.id)).toEqual({ started: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(commands).toEqual(['echo now'])
    expect(service.listRuns(created.id)[0]).toMatchObject({ origin: 'manual', status: 'success' })
    expect(service.list()[0]!.nextRunAt).toBe(created.nextRunAt)
  })

  it('재시작하면 남은 실행 중 이력을 정리하고 사용 중 작업만 다시 발화한다', async () => {
    const store = new MemoryScheduledTaskStore()
    const first = boot(store)
    const on = first.service.create(hourly('echo on'))
    const off = first.service.create(hourly('echo off'))
    first.service.setEnabled(off.id, false)
    first.dispose()
    // 이전 프로세스가 실행 중에 죽었다.
    store.insertRun({ taskId: on.id, origin: 'schedule', startedAt: 1 }, RUN_RETENTION)

    const second = boot(store)
    expect(store.runs[0]).toMatchObject({ status: 'error', error: 'app_quit' })
    const listed = second.service.list()
    expect(listed.find((task) => task.id === on.id)!.nextRunAt).not.toBeNull()
    expect(listed.find((task) => task.id === off.id)!.nextRunAt).toBeNull()
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(second.commands).toEqual(['echo on'])
    expect(first.commands).toEqual([])
  })

  it('복원에서 한 작업의 트리거가 깨져 있어도 나머지는 발화한다', async () => {
    const store = new MemoryScheduledTaskStore()
    store.insertTask(
      shellTask({ id: 'broken', trigger: { kind: 'custom', days: [], at: { hour: 9, minute: 0 } } })
    )
    store.insertTask(shellTask({ id: 'fine', trigger: { kind: 'hourly' } }))
    const { commands, restoreErrors } = boot(store)
    expect(restoreErrors.map((task) => task.id)).toEqual(['broken'])
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(commands).toEqual(['npm run nightly'])
  })

  it('종료하면 타이머가 남지 않는다', async () => {
    const app = boot(new MemoryScheduledTaskStore())
    app.service.create(hourly('echo a'))
    app.service.create(hourly('echo b'))
    app.dispose()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(2 * HOUR)
    expect(app.commands).toEqual([])
  })

  it('작업이 바뀔 때마다 변경을 알린다', () => {
    const { service, changed } = boot(new MemoryScheduledTaskStore())
    const { id } = service.create(hourly('echo a'))
    expect(changed).toHaveBeenCalledTimes(1)
    service.update({ ...hourly('echo b'), id })
    expect(changed).toHaveBeenCalledTimes(2)
    service.setEnabled(id, false)
    expect(changed).toHaveBeenCalledTimes(3)
    service.delete(id)
    expect(changed).toHaveBeenCalledTimes(4)
  })

  it('프로젝트 규칙을 main 이 다시 본다', () => {
    const store = new MemoryScheduledTaskStore()
    const { service } = boot(store)
    expect(() => service.create({ ...hourly('x'), projectId: 'nope' })).toThrow()
    expect(() => service.create({ ...hourly('x'), projectId: 'project-flat' })).toThrow()
    expect(store.listTasks()).toEqual([])
    expect(() => service.update({ ...hourly('x'), id: 'missing' })).toThrow()
  })
})

describe('예약 작업 수명주기 — 실행 중 삭제', () => {
  // 상태 전이 "실행 중인 작업을 삭제 → 실행 중단"(plan §5 · EP-5 ⑩)을 유스케이스 진입점에서 본다.
  it('실행 중인 작업을 지우면 그 실행의 shell 을 중단시키고 다시 실행 중으로 보지 않는다', async () => {
    const store = new MemoryScheduledTaskStore()
    const signals: AbortSignal[] = []
    const app = createScheduledTasks({
      store,
      projects: (id) => (id === 'project-a' ? { cwd: 'C:\\work\\a' } : undefined),
      // 끝나지 않는 shell — 중단 신호가 와야만 결과를 낸다.
      runShell: ({ signal }) =>
        new Promise((resolve) => {
          if (signal) signals.push(signal)
          signal?.addEventListener('abort', () =>
            resolve({ exitCode: null, output: '', truncated: false, timedOut: false, error: null })
          )
        }),
      sendPromptStart: () => false,
      onChanged: () => {}
    })
    booted.push({ ...app, commands: [], changed: vi.fn(), restoreErrors: [] })
    app.service.start()
    const { id } = app.service.create(hourly('echo slow'))
    expect(app.service.runNow(id)).toEqual({ started: true })
    expect(signals).toHaveLength(1)
    expect(signals[0]!.aborted).toBe(false)
    // 다른 작업은 같은 삭제에 영향받지 않는다.
    const other = app.service.create(hourly('echo other'))
    app.service.runNow(other.id)
    expect(signals).toHaveLength(2)

    app.service.delete(id)

    expect(signals[0]!.aborted).toBe(true)
    expect(signals[1]!.aborted).toBe(false)
    expect(app.service.list().map((task) => [task.id, task.running])).toEqual([[other.id, true]])
    expect(store.runs.filter((run) => run.taskId === id)).toEqual([])
  })
})

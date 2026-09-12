import { afterEach, expect, it, vi, type Mock } from 'vitest'
import { BackgroundController } from './background-controller'
import { BackgroundTaskTracker } from './background-tasks'
import {
  backgroundKey,
  type BackgroundEvent,
  type BackgroundEventSource
} from '../../../shared/background-task'

const request = { sessionId: 'session', generation: 'generation', toolUseId: 'shell-1' }
interface Fixture {
  controller: BackgroundController
  journal: BackgroundEvent[]
  source(): BackgroundEventSource
  runtime: {
    generation: string
    stopTask: Mock<() => Promise<void>>
    backgroundTask: Mock<(toolUseId: string) => Promise<boolean>>
  }
  replaceRuntime(): void
}
function fixture(toolName = 'Bash'): Fixture {
  const journal: BackgroundEvent[] = []
  let runtime = {
    generation: request.generation,
    stopTask: vi.fn(async () => {}),
    backgroundTask: vi.fn<(toolUseId: string) => Promise<boolean>>(async () => true)
  }
  const controller = new BackgroundController({
    tracker: new BackgroundTaskTracker(),
    persist: (event, done) => {
      if (event.type !== 'provider.message') journal.push(event)
      done()
    },
    load: () => [],
    publish: vi.fn(),
    runtime: () => runtime,
    roots: () => [],
    outputs: {} as never
  })
  let sequence = 0
  const source = (): BackgroundEventSource => ({
    generation: request.generation,
    sequence: ++sequence,
    receivedAt: sequence,
    replay: false
  })
  controller.observe({
    type: 'background.connection',
    sessionId: request.sessionId,
    source: source(),
    state: 'connected'
  })
  for (const toolUseId of ['shell-1', 'shell-2']) {
    controller.observe({
      type: 'background.call',
      sessionId: request.sessionId,
      source: source(),
      toolUseId,
      toolName,
      phase: 'started',
      input: { command: 'long command' }
    })
    controller.observe({
      type: 'background.task',
      sessionId: request.sessionId,
      source: source(),
      toolUseId,
      taskId: `task-${toolUseId}`,
      phase: 'started',
      patch: { taskType: 'local_bash', isBackgrounded: false, status: 'running' }
    })
  }
  journal.length = 0
  return {
    controller,
    journal,
    source,
    get runtime() {
      return runtime
    },
    replaceRuntime() {
      runtime = { ...runtime }
    }
  }
}
afterEach(() => vi.useRealTimers())

it.each(['Bash', 'PowerShell'])(
  'promotes only the selected registered %s execution and preserves its phase',
  async (toolName) => {
    const f = fixture(toolName)
    await f.controller.promote(request)
    expect(f.runtime.backgroundTask.mock.calls).toEqual([['shell-1']])
    expect(f.journal).toHaveLength(1)
    expect(f.journal[0]).toMatchObject({
      type: 'background.call',
      toolUseId: 'shell-1',
      phase: 'started',
      patch: { mode: 'background' }
    })
    const state = f.controller.state(request.sessionId)
    expect(Object.keys(state.tasks)).toHaveLength(2)
    expect(state.calls[backgroundKey(request.generation, 'shell-2')].mode).not.toBe('background')
    await expect(f.controller.promote(request)).rejects.toThrow()
    expect(f.runtime.backgroundTask).toHaveBeenCalledTimes(1)
  }
)

it.each(['', ' ', '\t', 'unknown'])(
  'rejects invalid or unknown tool IDs %j without calling SDK',
  async (toolUseId) => {
    const f = fixture()
    await expect(f.controller.promote({ ...request, toolUseId })).rejects.toThrow()
    expect(f.runtime.backgroundTask).not.toHaveBeenCalled()
  }
)

it.each(['stale', 'disconnected', 'terminal', 'unregistered', 'unsupported', 'disposed'])(
  'rejects %s targets before dispatch',
  async (kind) => {
    const f = fixture()
    let req = request
    if (kind === 'stale') req = { ...request, generation: 'old' }
    if (kind === 'disconnected')
      f.controller.observe({
        type: 'background.connection',
        sessionId: request.sessionId,
        source: f.source(),
        state: 'disconnected'
      })
    if (kind === 'terminal')
      f.controller.observe({
        type: 'background.task',
        sessionId: request.sessionId,
        source: f.source(),
        taskId: 'task-shell-1',
        phase: 'notification',
        patch: { status: 'completed' }
      })
    if (kind === 'unregistered') {
      req = { ...request, toolUseId: 'not-yet-registered' }
      f.controller.observe({
        type: 'background.call',
        sessionId: request.sessionId,
        source: f.source(),
        toolUseId: req.toolUseId,
        toolName: 'Bash',
        phase: 'started'
      })
    }
    if (kind === 'unsupported') Object.assign(f.runtime, { backgroundTask: undefined })
    if (kind === 'disposed') f.controller.dispose(request.sessionId)
    await expect(f.controller.promote(req)).rejects.toThrow()
    if (f.runtime.backgroundTask) expect(f.runtime.backgroundTask).not.toHaveBeenCalled()
  }
)

it.each(['false', 'exception'])(
  'rejects SDK %s and permits a fresh retry without fabricated state',
  async (kind) => {
    const f = fixture()
    if (kind === 'false') f.runtime.backgroundTask.mockResolvedValueOnce(false)
    else f.runtime.backgroundTask.mockRejectedValueOnce(new Error('SDK failed'))
    await expect(f.controller.promote(request)).rejects.toThrow()
    expect(f.journal).toHaveLength(0)
    await f.controller.promote(request)
    expect(f.runtime.backgroundTask).toHaveBeenCalledTimes(2)
  }
)

it('preserves a tool result received before ACK and allows another task to promote independently', async () => {
  const f = fixture()
  let finish!: (result: boolean) => void
  f.runtime.backgroundTask.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const pending = f.controller.promote(request)
  await f.controller.promote({ ...request, toolUseId: 'shell-2' })
  f.controller.observe({
    type: 'background.call',
    sessionId: request.sessionId,
    source: f.source(),
    toolUseId: request.toolUseId,
    phase: 'returned',
    result: 'original result',
    patch: { status: 'completed' }
  })
  finish(true)
  await pending
  const call = f.controller.state(request.sessionId).calls[
    backgroundKey(request.generation, request.toolUseId)
  ]
  expect(call).toMatchObject({
    phase: 'returned',
    result: 'original result',
    status: 'completed',
    mode: 'background'
  })
  expect(f.runtime.backgroundTask.mock.calls).toEqual([['shell-1'], ['shell-2']])
})

it('blocks duplicate dispatch, times out after 15 seconds and ignores late ACK', async () => {
  vi.useFakeTimers()
  const f = fixture()
  let finish!: (result: boolean) => void
  f.runtime.backgroundTask.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const pending = f.controller.promote(request)
  const rejected = expect(pending).rejects.toThrow()
  await expect(f.controller.promote(request)).rejects.toThrow()
  expect(f.runtime.backgroundTask).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(15_000)
  await rejected
  finish(true)
  await Promise.resolve()
  expect(f.journal).toHaveLength(0)
  await f.controller.promote(request)
  expect(f.runtime.backgroundTask).toHaveBeenCalledTimes(2)
})

it.each(['replacement', 'generation', 'disconnect', 'dispose'])(
  'ignores ACK after runtime %s',
  async (kind) => {
    const f = fixture()
    let finish!: (result: boolean) => void
    f.runtime.backgroundTask.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = f.controller.promote(request)
    if (kind === 'replacement') f.replaceRuntime()
    if (kind === 'generation') f.runtime.generation = 'next'
    if (kind === 'disconnect')
      f.controller.observe({
        type: 'background.connection',
        sessionId: request.sessionId,
        source: f.source(),
        state: 'disconnected'
      })
    if (kind === 'dispose') f.controller.dispose(request.sessionId)
    f.journal.length = 0
    finish(true)
    await expect(pending).rejects.toThrow()
    expect(f.journal).toHaveLength(0)
  }
)

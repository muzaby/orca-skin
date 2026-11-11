import { expect, it, vi } from 'vitest'
import { BackgroundController } from './background-controller'
import { BackgroundTaskTracker } from './background-tasks'
import { backgroundKey, type BackgroundEvent } from '../../../shared/background-task'

it('disposes delivery: a later event is neither persisted nor applied', () => {
  const source = { generation: 'g', sequence: 1, receivedAt: 1, replay: false }
  const events: BackgroundEvent[] = [
    {
      type: 'background.task',
      sessionId: 's',
      source,
      taskId: 't',
      phase: 'notification',
      patch: { status: 'completed' }
    }
  ]
  const persist = vi.fn()
  const controller = new BackgroundController({
    tracker: new BackgroundTaskTracker(),
    persist,
    load: () => events,
    publish: vi.fn(),
    runtime: () => undefined
  })
  const before = controller.state('s')
  controller.dispose('s')
  controller.observe({ ...events[0], source: { ...source, sequence: 3 } })
  expect(persist).not.toHaveBeenCalled()
  expect(controller.state('s')).toEqual(before)
})

it('records a finished task with a file output reference without copying or journaling its output', async () => {
  const persisted: string[] = []
  const published: string[] = []
  const controller = new BackgroundController({
    tracker: new BackgroundTaskTracker(),
    persist: (event, done) => {
      persisted.push(event.type)
      done()
    },
    load: () => [],
    publish: (event) => published.push(event.type),
    runtime: () => undefined
  })
  controller.observe({
    type: 'background.task',
    sessionId: 's',
    source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
    taskId: 't',
    phase: 'notification',
    patch: {
      status: 'completed',
      outputRefs: [{ id: 'out', field: 'output_file', value: 'C:/allowed/file', kind: 'file' }]
    }
  })
  await Promise.resolve()
  expect(persisted).toEqual(['background.task'])
  expect(published).toEqual(['background.task'])
  const task = Object.values(controller.state('s').tasks)[0]
  expect(task.status).toBe('completed')
  expect(task.outputRefs).toEqual([
    { id: 'out', field: 'output_file', value: 'C:/allowed/file', kind: 'file' }
  ])
})

it('bounds a stop request whose SDK never acknowledges it', async () => {
  vi.useFakeTimers()
  try {
    const controller = new BackgroundController({
      tracker: new BackgroundTaskTracker(),
      persist: (_event, done) => done(),
      load: () => [],
      publish: () => {},
      runtime: () => ({ generation: 'g', stopTask: () => new Promise<void>(() => {}) })
    })
    controller.observe({
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 't' }]
    })
    let rejected = false
    const request = controller.stop({ sessionId: 's', generation: 'g', taskId: 't' }).catch(() => {
      rejected = true
    })
    await vi.advanceTimersByTimeAsync(15_000)
    expect(rejected).toBe(true)
    await request
    expect(Object.values(controller.state('s').tasks)[0].stop?.state).toBe('unconfirmed')
  } finally {
    vi.useRealTimers()
  }
})

it('keeps stop ACK distinct from terminal, rejects unknown tasks and never relays raw', async () => {
  const tracker = new BackgroundTaskTracker()
  const journal: Array<unknown> = []
  const publish = vi.fn()
  const stopTask = vi.fn(async () => {})
  const controller = new BackgroundController({
    tracker,
    persist: (event, committed) => {
      journal.push(event)
      committed()
    },
    load: () => [],
    publish,
    runtime: () => ({ generation: 'g', stopTask })
  })
  const source = { generation: 'g', sequence: 1, receivedAt: 1, replay: false }
  controller.observe({
    type: 'background.snapshot',
    sessionId: 's',
    source,
    tasks: [{ taskId: 'unknown' }]
  })
  controller.observe({
    type: 'provider.message',
    sessionId: 's',
    source,
    raw: { password: 'secret' }
  })
  expect(journal).toHaveLength(2)
  expect(publish).toHaveBeenCalledTimes(1)
  await expect(
    controller.stop({ sessionId: 's', generation: 'g', taskId: 'missing' })
  ).rejects.toThrow('background-task: unknown task')
  await controller.stop({ sessionId: 's', generation: 'g', taskId: 'unknown' })
  const state = controller.state('s')
  const task = Object.values(state.tasks)[0]
  expect(task.stop?.state).toBe('acknowledged')
  expect(task.status).toBeUndefined()
  expect(state.liveTaskIds).toEqual(['unknown'])
  expect(stopTask).toHaveBeenCalledWith('unknown')
})

it.each([
  ['historical task with a current runtime', 'old', 'new', 'connected'],
  ['historical task with an equally stale runtime', 'old', 'old', 'connected'],
  ['runtime generation mismatch', 'new', 'old', 'connected'],
  ['disconnected current generation', 'new', 'new', 'disconnected'],
  ['resynchronizing current generation', 'new', 'new', 'resynchronizing'],
  ['terminated current generation', 'new', 'new', 'terminated']
] as const)(
  'rejects stop for a recorded task: %s',
  async (_name, generation, runtimeGeneration, connection) => {
    const stopTask = vi.fn(async () => {})
    const controller = new BackgroundController({
      tracker: new BackgroundTaskTracker(),
      persist: (_event, committed) => committed(),
      load: () => [],
      publish: () => {},
      runtime: () => ({ generation: runtimeGeneration, stopTask })
    })
    // Both generations actually own this ID: an unknown-task check cannot satisfy the oracle.
    for (const gen of ['old', 'new']) {
      controller.observe({
        type: 'background.snapshot',
        sessionId: 's',
        source: { generation: gen, sequence: 1, receivedAt: 1, replay: false },
        tasks: [{ taskId: 'same-id' }]
      })
    }
    controller.observe({
      type: 'background.connection',
      sessionId: 's',
      state: connection,
      source: { generation: 'new', sequence: 2, receivedAt: 2, replay: false }
    })
    const before = controller.state('s')
    expect(before.tasks[backgroundKey(generation, 'same-id')]).toBeDefined()
    await expect(
      controller.stop({ sessionId: 's', generation, taskId: 'same-id' })
    ).rejects.toThrow('background-task: current connection is unavailable')
    expect(stopTask).not.toHaveBeenCalled()
    expect(controller.state('s')).toEqual(before)
  }
)

it('stops the current recorded task even when history has the same task ID', async () => {
  const stopTask = vi.fn(async () => {})
  const controller = new BackgroundController({
    tracker: new BackgroundTaskTracker(),
    persist: (_event, committed) => committed(),
    load: () => [],
    publish: () => {},
    runtime: () => ({ generation: 'new', stopTask })
  })
  for (const generation of ['old', 'new']) {
    controller.observe({
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation, sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 'same-id' }]
    })
  }
  await controller.stop({ sessionId: 's', generation: 'new', taskId: 'same-id' })
  expect(stopTask).toHaveBeenCalledExactlyOnceWith('same-id')
  expect(controller.state('s').tasks[backgroundKey('new', 'same-id')].stop?.state).toBe(
    'acknowledged'
  )
  expect(controller.state('s').tasks[backgroundKey('old', 'same-id')].stop).toBeUndefined()
})
it('restores history without treating old live membership as current', () => {
  const source = { generation: 'old', sequence: 1, receivedAt: 1, replay: false }
  const events: BackgroundEvent[] = [
    { type: 'background.snapshot', sessionId: 's', source, tasks: [{ taskId: 't' }] }
  ]
  const controller = new BackgroundController({
    tracker: new BackgroundTaskTracker(),
    persist: () => {},
    load: () => events,
    publish: () => {},
    runtime: () => undefined
  })
  expect(controller.state('s')).toMatchObject({
    connection: 'disconnected',
    liveKnown: false,
    liveTaskIds: []
  })
  expect(Object.values(controller.state('s').tasks)[0].taskId).toBe('t')
})

it('turns an individual stop ACK without terminal evidence into an explicit unconfirmed state', async () => {
  vi.useFakeTimers()
  try {
    const tracker = new BackgroundTaskTracker()
    const controller = new BackgroundController({
      tracker,
      persist: (_event, committed) => committed(),
      load: () => [],
      publish: () => {},
      runtime: () => ({ generation: 'g', stopTask: async () => {} })
    })
    controller.observe({
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 't' }]
    })
    await controller.stop({ sessionId: 's', generation: 'g', taskId: 't' })
    await vi.advanceTimersByTimeAsync(15_000)
    expect(Object.values(controller.state('s').tasks)[0]).toMatchObject({
      stop: { state: 'unconfirmed' },
      terminalEvidence: []
    })
  } finally {
    vi.useRealTimers()
  }
})

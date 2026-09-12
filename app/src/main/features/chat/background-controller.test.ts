import { expect, it, vi } from 'vitest'
import { BackgroundController } from './background-controller'
import { BackgroundTaskTracker } from './background-tasks'
import type { BackgroundEvent } from '../../../shared/background-task'

it('bounds a stop request whose SDK never acknowledges it', async () => {
  vi.useFakeTimers()
  try {
    const controller = new BackgroundController({
      tracker: new BackgroundTaskTracker(),
      persist: (_event, done) => done(),
      load: () => [],
      publish: () => {},
      runtime: () => ({ generation: 'g', stopTask: () => new Promise<void>(() => {}) }),
      roots: () => [],
      outputs: {} as never
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

it('keeps stop ACK distinct from terminal, rejects stale generations and never relays raw', async () => {
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
    runtime: () => ({ generation: 'g', stopTask }),
    roots: () => [],
    outputs: {} as never
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
    controller.stop({ sessionId: 's', generation: 'old', taskId: 'unknown' })
  ).rejects.toThrow()
  await controller.stop({ sessionId: 's', generation: 'g', taskId: 'unknown' })
  const state = controller.state('s')
  const task = Object.values(state.tasks)[0]
  expect(task.stop?.state).toBe('acknowledged')
  expect(task.status).toBeUndefined()
  expect(state.liveTaskIds).toEqual(['unknown'])
  expect(stopTask).toHaveBeenCalledWith('unknown')
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
    runtime: () => undefined,
    roots: () => [],
    outputs: {} as never
  })
  expect(controller.state('s')).toMatchObject({
    connection: 'disconnected',
    liveKnown: false,
    liveTaskIds: []
  })
  expect(Object.values(controller.state('s').tasks)[0].taskId).toBe('t')
})

it('returns unresolved tasks after bounded stop-all and releases the input gate', async () => {
  vi.useFakeTimers()
  try {
    const tracker = new BackgroundTaskTracker()
    const stopTask = vi.fn(async () => {})
    const controller = new BackgroundController({
      tracker,
      persist: (_event, committed) => committed(),
      load: () => [],
      publish: () => {},
      runtime: () => ({ generation: 'g', stopTask }),
      roots: () => [],
      outputs: {} as never
    })
    controller.observe({
      type: 'background.snapshot',
      sessionId: 's',
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false },
      tasks: [{ taskId: 't' }]
    })
    const result = controller.stopAll({ sessionId: 's', generation: 'g' })
    expect(controller.isStoppingAll('s')).toBe(true)
    await vi.advanceTimersByTimeAsync(6000)
    expect(await result).toEqual({ residualTaskIds: ['t'], unknown: true })
    expect(stopTask).toHaveBeenCalledTimes(1)
    expect(Object.values(controller.state('s').tasks)[0]).toMatchObject({
      stop: { state: 'unconfirmed' }
    })
    expect(controller.isStoppingAll('s')).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})

it('does not report empty stop-all success while an async launch still has no task id', async () => {
  vi.useFakeTimers()
  try {
    const controller = new BackgroundController({
      tracker: new BackgroundTaskTracker(),
      persist: (_event, done) => done(),
      load: () => [],
      publish: () => {},
      runtime: () => ({ generation: 'g', stopTask: async () => {} }),
      roots: () => [],
      outputs: {} as never
    })
    const source = { generation: 'g', sequence: 1, receivedAt: 1, replay: false }
    controller.observe({ type: 'background.snapshot', sessionId: 's', source, tasks: [] })
    controller.observe({
      type: 'background.call',
      sessionId: 's',
      source: { ...source, sequence: 2 },
      toolUseId: 'c',
      phase: 'returned',
      patch: { status: 'async_launched', mode: 'background' }
    })
    const result = controller.stopAll({ sessionId: 's', generation: 'g' })
    await vi.advanceTimersByTimeAsync(6000)
    expect(await result).toEqual({ residualTaskIds: [], unknown: true })
  } finally {
    vi.useRealTimers()
  }
})

it('never lets historical output capture take ownership of the current generation', async () => {
  const capture = vi.fn(async () => ({
    id: 'snapshot',
    capturedAt: 1,
    size: 1,
    sha256: 'hash',
    partial: false
  }))
  const controller = new BackgroundController({
    tracker: new BackgroundTaskTracker(),
    persist: (_event, done) => done(),
    load: () => [
      {
        type: 'background.task',
        sessionId: 's',
        source: { generation: 'old', sequence: 1, receivedAt: 1, replay: false },
        taskId: 'past',
        phase: 'notification',
        patch: {
          status: 'completed',
          outputRefs: [{ id: 'out', field: 'output_file', value: 'C:/allowed/file', kind: 'file' }]
        }
      }
    ],
    publish: () => {},
    runtime: () => undefined,
    roots: () => [],
    outputs: { capture } as never
  })
  controller.observe({
    type: 'background.task',
    sessionId: 's',
    source: { generation: 'new', sequence: 1, receivedAt: 2, replay: false },
    taskId: 'current',
    phase: 'started',
    patch: { status: 'running' }
  })
  await Promise.resolve()
  expect(controller.state('s').generation).toBe('new')
  expect(capture).not.toHaveBeenCalled()
})

it('preserves a call output denial when a later task publishes another reference to the same file', async () => {
  const read = vi.fn()
  const capture = vi.fn()
  const controller = new BackgroundController({
    tracker: new BackgroundTaskTracker(),
    persist: (_event, done) => done(),
    load: () => [],
    publish: () => {},
    runtime: () => undefined,
    roots: () => [],
    outputs: { read, capture } as never
  })
  const source = { generation: 'g', sequence: 1, receivedAt: 1, replay: false }
  controller.observe({
    type: 'background.call',
    sessionId: 's',
    source,
    toolUseId: 'c',
    phase: 'returned',
    patch: {
      canReadOutputFile: false,
      outputRefs: [
        {
          id: 'call-output',
          field: 'outputFile',
          value: 'C:/allowed/file',
          kind: 'file',
          canRead: false
        }
      ]
    }
  })
  controller.observe({
    type: 'background.task',
    sessionId: 's',
    source: { ...source, sequence: 2 },
    taskId: 't',
    toolUseId: 'c',
    phase: 'notification',
    patch: {
      status: 'completed',
      outputRefs: [
        { id: 'task-output', field: 'output_file', value: 'C:/allowed/file', kind: 'file' }
      ]
    }
  })
  expect(
    await controller.read({
      sessionId: 's',
      generation: 'g',
      taskId: 't',
      outputId: 'task-output',
      offset: 0,
      maxBytes: 64
    })
  ).toMatchObject({ status: 'denied' })
  expect(read).not.toHaveBeenCalled()
  expect(capture).not.toHaveBeenCalled()
})

it('removes an orphan snapshot if its journal insert fails and keeps the task terminal', async () => {
  const removeSnapshot = vi.fn(async () => {})
  const controller = new BackgroundController({
    tracker: new BackgroundTaskTracker(),
    persist: (event, done) => {
      if (event.type === 'background.output') throw new Error('db write failed')
      done()
    },
    load: () => [],
    publish: () => {},
    runtime: () => undefined,
    roots: () => [],
    outputs: {
      capture: async () => ({
        id: 'snapshot',
        capturedAt: 1,
        size: 1,
        sha256: 'hash',
        partial: false
      }),
      removeSnapshot
    } as never
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
  await vi.waitFor(() => expect(removeSnapshot).toHaveBeenCalledWith('snapshot'))
  expect(Object.values(controller.state('s').tasks)[0].status).toBe('completed')
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
      runtime: () => ({ generation: 'g', stopTask: async () => {} }),
      roots: () => [],
      outputs: {} as never
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

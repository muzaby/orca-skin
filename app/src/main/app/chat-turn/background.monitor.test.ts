// Codex: SDK 0.3.267 sdk-tools.d.ts MonitorInput/Output and sdk.d.ts task envelopes.
// These are declaration-based fixtures, not captures from a Monitor-enabled deployment.
import { randomUUID } from 'node:crypto'
import { afterEach, expect, it, vi, type Mock } from 'vitest'
import type { MonitorInput, MonitorOutput } from '@anthropic-ai/claude-agent-sdk/sdk-tools'
import type {
  SDKTaskStartedMessage,
  SDKTaskProgressMessage,
  SDKTaskNotificationMessage,
  SDKToolProgressMessage,
  SDKBackgroundTasksChangedMessage,
  SDKWorkerShuttingDownMessage
} from '@anthropic-ai/claude-agent-sdk'
import { ClaudeBackgroundMapper } from '../../adapters/claude-background'
import { BackgroundController } from '../../features/chat/background-controller'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import {
  backgroundKey,
  isShellBackgroundTool,
  type BackgroundEvent,
  type BackgroundCallRecord,
  type BackgroundTaskRecord,
  type ReadBackgroundOutputResponse,
  type ProviderMessageEvent
} from '../../../shared/background-task'

const sessionId = 'monitor-session'
const toolUseId = 'monitor-call'
const taskId = 'monitor-task'
const outputFile = 'C:/monitor-fixture/events.output'
const command: MonitorInput = {
  description: 'Watch command stdout',
  command: 'bounded-fixture-command',
  timeout_ms: 5000,
  persistent: false
}
const websocket: MonitorInput = {
  description: 'Watch WebSocket text frames',
  ws: { url: 'wss://fixture.invalid/events', protocols: ['events-v1'] },
  timeout_ms: 9000,
  persistent: false
}

interface MonitorFixture {
  mapper: ClaudeBackgroundMapper
  tracker: BackgroundTaskTracker
  controller: BackgroundController
  journal: (BackgroundEvent | ProviderMessageEvent)[]
  published: BackgroundEvent[]
  stopTask: Mock<(id: string) => Promise<void>>
  read: Mock<() => Promise<ReadBackgroundOutputResponse>>
  envelope(): { session_id: string; uuid: ReturnType<typeof randomUUID> }
  receive(raw: unknown): void
  launch(input: MonitorInput, output: MonitorOutput): void
  start(): void
  snapshot(ids: string[]): void
  notify(status: SDKTaskNotificationMessage['status'], summary: string): void
  call(): BackgroundCallRecord
  task(): BackgroundTaskRecord
}
afterEach(() => vi.useRealTimers())

function fixture(): MonitorFixture {
  const mapper = new ClaudeBackgroundMapper({ sdkVersion: '0.3.267' })
  const tracker = new BackgroundTaskTracker()
  const journal: (BackgroundEvent | ProviderMessageEvent)[] = []
  const published: BackgroundEvent[] = []
  const stopTask = vi.fn<(id: string) => Promise<void>>(async () => {})
  const read = vi.fn<() => Promise<ReadBackgroundOutputResponse>>(async () => ({
    status: 'available' as const,
    offset: 0,
    nextOffset: 12,
    text: 'event output',
    view: 'current' as const
  }))
  const controller = new BackgroundController({
    tracker,
    persist: (event, done) => {
      journal.push(event)
      done()
    },
    load: () => [],
    publish: (event) => {
      published.push(event)
    },
    runtime: () => ({ generation: mapper.generation, stopTask }),
    roots: () => ['C:/monitor-fixture'],
    outputs: { read, capture: () => new Promise<never>(() => {}), readSnapshot: vi.fn() }
  })
  const envelope = (): ReturnType<MonitorFixture['envelope']> => ({
    session_id: sessionId,
    uuid: randomUUID()
  })
  const receive = (raw: unknown): void => {
    for (const event of mapper.map(raw, sessionId)?.events ?? []) controller.observe(event)
  }
  const launch = (input: MonitorInput, output: MonitorOutput): void => {
    receive({
      type: 'assistant',
      ...envelope(),
      message: { content: [{ type: 'tool_use', id: toolUseId, name: 'Monitor', input }] }
    })
    receive({
      type: 'user',
      ...envelope(),
      message: {
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: 'Monitor started' }]
      },
      tool_use_result: output
    })
  }
  const start = (): void =>
    receive({
      type: 'system',
      subtype: 'task_started',
      ...envelope(),
      task_id: taskId,
      tool_use_id: toolUseId,
      task_type: 'local_bash',
      description: 'Monitor task',
      is_backgrounded: true
    } satisfies SDKTaskStartedMessage)
  const snapshot = (ids: string[]): void =>
    receive({
      type: 'system',
      subtype: 'background_tasks_changed',
      ...envelope(),
      tasks: ids.map((id) => ({
        task_id: id,
        task_type: 'local_bash',
        description: 'Monitor task'
      }))
    } satisfies SDKBackgroundTasksChangedMessage)
  const notify = (status: SDKTaskNotificationMessage['status'], summary: string): void =>
    receive({
      type: 'system',
      subtype: 'task_notification',
      ...envelope(),
      task_id: taskId,
      tool_use_id: toolUseId,
      status,
      summary,
      output_file: outputFile
    } satisfies SDKTaskNotificationMessage)
  receive({ type: 'system', subtype: 'init', ...envelope(), claude_code_version: '2.1.267' })
  return {
    mapper,
    tracker,
    controller,
    journal,
    published,
    stopTask,
    read,
    envelope,
    receive,
    launch,
    start,
    snapshot,
    notify,
    call: () => controller.state(sessionId).calls[backgroundKey(mapper.generation, toolUseId)],
    task: () => controller.state(sessionId).tasks[backgroundKey(mapper.generation, taskId)]
  }
}

it.each([command, websocket])(
  'links Monitor receipt before task edges and preserves the original kind and metadata: $description',
  (input) => {
    const f = fixture()
    const output: MonitorOutput = { taskId, timeoutMs: input.timeout_ms, persistent: false }
    f.launch(input, output)
    // This assertion specifically observes Monitor's tool-specific branch (M-23).
    expect(f.call()).toMatchObject({
      toolName: 'Monitor',
      taskId,
      mode: 'background',
      input,
      structuredOutput: output
    })
    expect(f.task()).toMatchObject({ toolUseId, taskId, liveMembership: 'unknown' })
    expect(f.tracker.hasPending(sessionId)).toBe(true)
    f.start()
    f.snapshot([taskId])
    expect(f.task()).toMatchObject({ taskType: 'local_bash', status: 'running', toolUseId })
    expect(f.call().toolName).toBe('Monitor')
    expect(isShellBackgroundTool(f.call().toolName)).toBe(false)
    expect(f.tracker.isAsyncLaunched(sessionId, toolUseId)).toBe(true)
    expect(f.published.every((event) => !('raw' in event))).toBe(true)
  }
)

it.each([
  { input: command, text: 'stdout line: build ready' },
  { input: websocket, text: 'WebSocket text frame: build ready' }
])(
  'preserves declared progress and terminal output for $input.description',
  async ({ input, text }) => {
    const f = fixture()
    f.launch(input, { taskId, timeoutMs: input.timeout_ms })
    f.start()
    f.snapshot([taskId])
    f.receive({
      type: 'tool_progress',
      ...f.envelope(),
      tool_use_id: toolUseId,
      tool_name: 'Monitor',
      parent_tool_use_id: null,
      task_id: taskId,
      elapsed_time_seconds: 2
    } satisfies SDKToolProgressMessage)
    f.receive({
      type: 'system',
      subtype: 'task_progress',
      ...f.envelope(),
      task_id: taskId,
      tool_use_id: toolUseId,
      description: text,
      summary: 'watch received an event',
      usage: { total_tokens: 0, tool_uses: 0, duration_ms: 2000 }
    } satisfies SDKTaskProgressMessage)
    expect(f.task()).toMatchObject({
      description: text,
      summary: 'watch received an event',
      durationMs: 2000,
      totalTokens: 0,
      toolUses: 0
    })
    expect(f.call()).toMatchObject({ toolName: 'Monitor', elapsedTimeSeconds: 2 })
    f.notify('completed', 'Watch ended')
    f.snapshot([])
    expect(f.task()).toMatchObject({ status: 'completed', summary: 'Watch ended' })
    expect(f.tracker.hasPending(sessionId)).toBe(false)
    const ref = f.task().outputRefs![0]
    expect(ref).toMatchObject({ field: 'output_file', value: outputFile, kind: 'file' })
    expect(f.read).not.toHaveBeenCalled()
    await expect(
      f.controller.read({
        sessionId,
        generation: f.mapper.generation,
        taskId,
        outputId: ref.id,
        offset: 0,
        maxBytes: 100
      })
    ).resolves.toMatchObject({ text: 'event output' })
    expect(f.read).toHaveBeenCalledWith(
      ref,
      ['C:/monitor-fixture'],
      expect.objectContaining({ taskId })
    )
  }
)

it('retains the provider timeout outcome instead of completing merely because the requested deadline elapsed', async () => {
  vi.useFakeTimers()
  const f = fixture()
  f.launch(websocket, { taskId, timeoutMs: 9000, persistent: false })
  f.start()
  await vi.advanceTimersByTimeAsync(9001)
  expect(f.task().status).toBe('running')
  expect(f.call().structuredOutput).toMatchObject({ timeoutMs: 9000, persistent: false })
  f.notify('stopped', 'Monitor timeout reached')
  f.snapshot([])
  expect(f.task()).toMatchObject({ status: 'stopped', summary: 'Monitor timeout reached' })
  expect(f.tracker.hasPending(sessionId)).toBe(false)
})

it('keeps persistent zero timeout metadata but disables live control after CLI disconnect and termination', async () => {
  const f = fixture()
  const input: MonitorInput = { ...websocket, persistent: true }
  f.launch(input, { taskId, timeoutMs: 0, persistent: true })
  f.start()
  f.snapshot([taskId])
  f.receive({
    type: 'system',
    subtype: 'worker_shutting_down',
    ...f.envelope(),
    reason: 'host_exit'
  } satisfies SDKWorkerShuttingDownMessage)
  expect(f.controller.state(sessionId)).toMatchObject({
    connection: 'disconnected',
    liveKnown: false
  })
  expect(f.task().liveMembership).toBe('unknown')
  expect(f.call()).toMatchObject({ input, structuredOutput: { timeoutMs: 0, persistent: true } })
  await expect(
    f.controller.stop({ sessionId, generation: f.mapper.generation, taskId })
  ).rejects.toThrow()
  expect(f.stopTask).not.toHaveBeenCalled()
  // CLI close is a host lifecycle event, not an invented SDK Monitor message.
  f.controller.observe({
    type: 'background.connection',
    sessionId,
    source: {
      generation: f.mapper.generation,
      sequence: 100,
      receivedAt: Date.now(),
      replay: false
    },
    state: 'terminated'
  })
  expect(f.tracker.hasPending(sessionId)).toBe(false)
  expect(f.task().status).toBe('running') // retain last evidence, never assert service survival or fabricated completion
  expect(f.task().terminalEvidence).toEqual([])
})

it('stops the linked Monitor task by taskId and waits for terminal notification after ACK', async () => {
  const f = fixture()
  f.launch(command, { taskId, timeoutMs: 5000 })
  f.start()
  f.snapshot([taskId])
  try {
    await f.controller.stop({ sessionId, generation: f.mapper.generation, taskId })
    expect(f.stopTask.mock.calls).toEqual([[taskId]])
    expect(f.task()).toMatchObject({ status: 'running', stop: { state: 'acknowledged' } })
    f.notify('stopped', 'User stopped monitor')
    f.snapshot([])
    expect(f.task().status).toBe('stopped')
    expect(f.tracker.hasPending(sessionId)).toBe(false)
  } finally {
    f.controller.dispose(sessionId)
  }
})

it('retains a WebSocket connection error without fabricating a launched task', () => {
  const f = fixture()
  f.receive({
    type: 'assistant',
    ...f.envelope(),
    message: { content: [{ type: 'tool_use', id: toolUseId, name: 'Monitor', input: websocket }] }
  })
  const raw = {
    type: 'user',
    ...f.envelope(),
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUseId,
          is_error: true,
          content: 'WebSocket connection refused'
        }
      ]
    }
  }
  f.receive(raw)
  expect(f.call()).toMatchObject({
    toolName: 'Monitor',
    status: 'failed',
    result: 'WebSocket connection refused',
    input: websocket
  })
  expect(f.call().taskId).toBeUndefined()
  expect(Object.keys(f.controller.state(sessionId).tasks)).toEqual([])
  expect(f.tracker.hasPending(sessionId)).toBe(false)
  expect(f.journal).toContainEqual(expect.objectContaining({ type: 'provider.message', raw }))
})

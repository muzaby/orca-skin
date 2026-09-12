import { beforeEach, describe, expect, it, vi } from 'vitest'

const { messages, queryMock, closed } = vi.hoisted(() => {
  const messages: unknown[] = []
  const closed = vi.fn()
  return {
    messages,
    closed,
    queryMock: vi.fn(() => ({
      async *[Symbol.asyncIterator]() {
        for (const message of messages) yield message
      },
      close: closed,
      setPermissionMode: vi.fn(),
      setModel: vi.fn(),
      interrupt: vi.fn(),
      stopTask: vi.fn(),
      backgroundTasks: vi.fn()
    }))
  }
})
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: queryMock }))

import { ClaudeAdapter } from './claude'
import type { LiveTurn, ProviderMessageBatch } from './types'

async function collect(): Promise<{
  live: LiveTurn
  batches: ProviderMessageBatch[]
  provider: NonNullable<ProviderMessageBatch['providerEvents']>
}> {
  const live = new ClaudeAdapter().sendMessage({
    sessionId: 's1',
    text: 'hello',
    cwd: '/tmp',
    extensions: { skills: [], hooks: { normalized: {} } }
  })
  const batches: ProviderMessageBatch[] = []
  for await (const batch of live.eventBatches) batches.push(batch)
  return { live, batches, provider: batches.flatMap((batch) => batch.providerEvents ?? []) }
}

beforeEach(() => {
  messages.length = 0
  vi.clearAllMocks()
})

describe('0231 Claude provider lane', () => {
  it('records installed SDK and actual bundled CLI identity on initialization', async () => {
    messages.push({
      type: 'system',
      subtype: 'init',
      session_id: 's1',
      claude_code_version: '2.1.267',
      tools: ['Bash', 'PowerShell']
    })
    const { provider } = await collect()
    expect(provider).toContainEqual(
      expect.objectContaining({
        type: 'background.connection',
        state: 'connected',
        sdkVersion: '0.3.267',
        cliVersion: '2.1.267',
        cliPath: expect.any(String)
      })
    )
  })
  it('preserves unknown raw messages outside ordinary transcript events', async () => {
    const raw = {
      type: 'system',
      subtype: 'future',
      session_id: 's1',
      uuid: 'u1',
      future: { x: 1 }
    }
    messages.push(raw)
    const { batches, provider } = await collect()
    expect(batches.flatMap((b) => b.events)).toEqual([])
    expect(provider).toContainEqual(expect.objectContaining({ type: 'provider.message', raw }))
  })

  it('retains snapshot-only identities and all terminal patch values without requiring tool ids', async () => {
    messages.push(
      {
        type: 'system',
        subtype: 'background_tasks_changed',
        session_id: 's1',
        tasks: [{ task_id: 'task1', task_type: 'local_bash', description: 'shell' }]
      },
      {
        type: 'system',
        subtype: 'task_updated',
        session_id: 's1',
        task_id: 'task1',
        patch: { status: 'completed', is_backgrounded: false, total_paused_ms: 0, description: '' }
      }
    )
    const { batches, provider } = await collect()
    expect(provider).toContainEqual(
      expect.objectContaining({
        type: 'background.snapshot',
        tasks: [{ taskId: 'task1', taskType: 'local_bash', description: 'shell' }]
      })
    )
    expect(provider).toContainEqual(
      expect.objectContaining({
        type: 'background.task',
        taskId: 'task1',
        patch: expect.objectContaining({
          status: 'completed',
          isBackgrounded: false,
          totalPausedMs: 0,
          description: ''
        })
      })
    )
    expect(
      batches.flatMap((b) => b.events).some((event) => event.type === 'subagent.backgroundSet')
    ).toBe(false)
  })

  it('keeps model content and complete structured Agent/Bash results independently', async () => {
    const output = {
      stdout: 'running',
      stderr: 'warning',
      interrupted: false,
      backgroundTaskId: 'shell1',
      timedOutAfterMs: 1000,
      rawOutputPath: '/tmp/result'
    }
    messages.push(
      {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', id: 'call1', name: 'Bash', input: { command: 'run' } }]
        }
      },
      {
        type: 'user',
        tool_use_result: output,
        message: { content: [{ type: 'tool_result', tool_use_id: 'call1', content: 'model text' }] }
      }
    )
    const { batches, provider } = await collect()
    expect(batches.flatMap((b) => b.events)).toContainEqual(
      expect.objectContaining({
        type: 'tool.call.completed',
        result: 'model text',
        structuredOutput: output
      })
    )
    expect(provider).toContainEqual(
      expect.objectContaining({
        type: 'background.call',
        toolUseId: 'call1',
        phase: 'returned',
        structuredOutput: output,
        patch: expect.objectContaining({ taskId: 'shell1', mode: 'background' })
      })
    )
  })

  it('does not invent Agent taskId or accept Workflow launch errors', async () => {
    for (const [id, name, output] of [
      ['a1', 'Agent', { status: 'async_launched', agentId: 'agent-only', outputFile: '/tmp/a' }],
      ['w1', 'Workflow', { status: 'async_launched', taskId: 'workflow1', error: 'syntax' }]
    ] as const) {
      messages.push(
        { type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input: {} }] } },
        {
          type: 'user',
          tool_use_result: output,
          message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'returned' }] }
        }
      )
    }
    const { provider } = await collect()
    const calls = provider.filter(
      (event) => event.type === 'background.call' && event.phase === 'returned'
    )
    expect(calls).toContainEqual(
      expect.objectContaining({
        toolUseId: 'a1',
        patch: expect.objectContaining({ agentId: 'agent-only', mode: 'background' })
      })
    )
    expect(
      calls.find((event) => event.type === 'background.call' && event.toolUseId === 'a1')
    ).not.toHaveProperty('patch.taskId')
    expect(calls).toContainEqual(
      expect.objectContaining({
        toolUseId: 'w1',
        patch: expect.objectContaining({ status: 'failed' })
      })
    )
  })

  it('isolates malformed known payload and preserves retry plus heartbeat without false progress', async () => {
    messages.push(
      { type: 'assistant', message: { content: {} } },
      {
        type: 'tool_progress',
        tool_use_id: 'a1',
        tool_name: 'Agent',
        elapsed_time_seconds: 12,
        subagent_retry: { attempt: 1, retry_delay_ms: 2000 }
      },
      {
        type: 'tool_progress',
        tool_use_id: 'a1',
        tool_name: 'Agent',
        elapsed_time_seconds: 14,
        heartbeat: true
      }
    )
    const { provider } = await collect()
    expect(provider.filter((event) => event.type === 'provider.message')).toHaveLength(3)
    expect(provider).toContainEqual(
      expect.objectContaining({
        type: 'background.call',
        patch: expect.objectContaining({
          retry: { attempt: 1, retry_delay_ms: 2000 },
          elapsedTimeSeconds: 12
        })
      })
    )
    const heartbeat = provider.find(
      (event) => event.type === 'background.call' && event.patch?.heartbeat === true
    )
    expect(heartbeat).not.toHaveProperty('patch.retry')
  })

  it('deduplicates equal UUID payload but retains corrected payload and consumes beyond result', async () => {
    const first = {
      type: 'system',
      subtype: 'task_updated',
      uuid: 'same',
      task_id: 't1',
      patch: { status: 'running' }
    }
    messages.push(
      first,
      first,
      { type: 'result', subtype: 'success', is_error: false },
      { ...first, patch: { status: 'completed' } }
    )
    const { provider } = await collect()
    expect(provider.filter((event) => event.type === 'provider.message')).toHaveLength(3)
    expect(provider.filter((event) => event.type === 'background.task')).toHaveLength(2)
  })

  it('journals a malformed transcript block and continues with the next task update', async () => {
    messages.push(
      { type: 'assistant', message: { content: [null] } },
      { type: 'system', subtype: 'task_updated', task_id: 'ok', patch: { status: 'running' } }
    )
    const { provider } = await collect()
    expect(provider.filter((event) => event.type === 'provider.message')).toHaveLength(2)
    expect(provider).toContainEqual(
      expect.objectContaining({ type: 'background.task', taskId: 'ok' })
    )
    expect(provider).toContainEqual(
      expect.objectContaining({
        type: 'provider.message',
        interpretationErrors: expect.arrayContaining(['message.content[] must be an object'])
      })
    )
  })

  it('declares individual stop affordance and closes the SDK query once', async () => {
    const { live } = await collect()
    const options = (
      queryMock.mock.calls[0] as unknown as [{ options: Record<string, unknown> }]
    )[0].options
    expect(options).toMatchObject({ perTaskStopAffordance: true, agentProgressSummaries: true })
    expect(options.disallowedTools).toEqual(['WebSearch'])
    live.close()
    live.close()
    expect(closed).toHaveBeenCalledTimes(1)
  })
})

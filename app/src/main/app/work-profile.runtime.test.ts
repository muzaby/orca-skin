import { beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { HookInput, Options } from '@anthropic-ai/claude-agent-sdk'
import type { ArtifactRef } from '../../shared/artifacts'
import type { DbQueries } from '../infra/db'
import type { NormalizedEvent, Settings } from '../../shared/ipc'
import type { BackgroundEvent, ProviderMessageEvent } from '../../shared/background-task'
import type { TurnExtensions } from '../adapters/turn'

const mock = vi.hoisted(() => ({
  messages: [] as unknown[],
  query: vi.fn(),
  interrupt: vi.fn(async () => ({ still_queued: ['queued-1'] })),
  stopTask: vi.fn(async () => {}),
  close: vi.fn()
}))
vi.mock('@anthropic-ai/claude-agent-sdk', async (original) => ({
  ...(await original<typeof import('@anthropic-ai/claude-agent-sdk')>()),
  query: mock.query
}))
import { ClaudeAdapter } from '../adapters/claude'
import { ExtensionBuilder } from '../features/extensions/builder'
import { prepareAgentExtensionProfile } from './agent-extension-profile'

beforeEach(() => {
  vi.clearAllMocks()
  mock.messages.length = 0
  mock.query.mockImplementation(() => ({
    async *[Symbol.asyncIterator]() {
      yield* mock.messages
    },
    interrupt: mock.interrupt,
    stopTask: mock.stopTask,
    close: mock.close
  }))
})

async function workExtensions(): Promise<TurnExtensions> {
  const profile = await prepareAgentExtensionProfile(
    'work',
    resolve('resources/claude-plugins/work-profile')
  )
  return new ExtensionBuilder(
    {} as DbQueries,
    () => [],
    () => ({}) as Settings,
    'fixture'
  ).build(null, null, profile)
}

it('keeps Work questions, denied tools and cancellation on existing SDK control paths', async () => {
  const approve = vi.fn(async (action) =>
    action.kind === 'ask_question'
      ? { behavior: 'allow' as const, updatedInput: { answers: { Format: 'Markdown' } } }
      : { behavior: 'deny' as const, message: 'fixture denied' }
  )
  const live = new ClaudeAdapter().sendMessage({
    sessionId: null,
    cwd: resolve('.'),
    text: 'fixture',
    extensions: await workExtensions(),
    requestApproval: approve
  })
  try {
    const options: Options = mock.query.mock.calls[0][0].options
    expect(options.plugins).toEqual([
      { type: 'local', path: resolve('resources/claude-plugins/work-profile') }
    ])
    const context = {
      signal: new AbortController().signal,
      toolUseID: 'ask-1',
      requestId: 'request-1'
    }
    expect(
      await options.canUseTool!(
        'AskUserQuestion',
        {
          questions: [
            {
              question: 'Format',
              header: 'Format',
              options: [
                { label: 'Markdown', description: 'Editable text' },
                { label: 'PDF', description: 'Fixed pages' }
              ],
              multiSelect: false
            }
          ]
        },
        context
      )
    ).toMatchObject({ behavior: 'allow', updatedInput: { answers: { Format: 'Markdown' } } })
    expect(
      await options.canUseTool!(
        'PowerShell',
        { command: 'fixture' },
        {
          ...context,
          toolUseID: 'shell-1',
          requestId: 'request-2'
        }
      )
    ).toMatchObject({ behavior: 'deny' })
    expect(approve.mock.calls.map(([action]) => action.kind)).toEqual([
      'ask_question',
      'tool_approval'
    ])
    expect(await live.interrupt()).toEqual({ stillQueued: ['queued-1'] })
    expect(mock.interrupt).toHaveBeenCalledOnce()
    await live.stopTask!('task-1')
    expect(mock.stopTask).toHaveBeenCalledWith('task-1')
  } finally {
    live.close()
  }
})

it('captures checked Work output through the existing PostToolUse hook and output event', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orca-work-output-'))
  try {
    const output = join(root, 'result.txt')
    const text = 'verified output 한글\n'
    await writeFile(output, text)
    const artifact: ArtifactRef = {
      publicationId: 'file-1',
      artifactFileId: 'content-1',
      title: 'result',
      filename: 'result.txt',
      kind: 'text',
      category: 'file',
      sizeBytes: Buffer.byteLength(text),
      publishedAt: 1
    }
    const capture = vi.fn(async (path, _context, expectedContent) => {
      expect(path).toBe(output)
      expect(await readFile(path, 'utf8')).toBe(expectedContent)
      return artifact
    })
    const signal = new AbortController().signal
    const live = new ClaudeAdapter().sendMessage({
      sessionId: 'session-1',
      cwd: root,
      text: 'fixture',
      extensions: { ...(await workExtensions()), outputFiles: { directory: root, capture } },
      runtimeToolContext: {
        cwd: root,
        extraDirs: [],
        getSignal: () => signal,
        waitForSession: async () => 'session-1'
      }
    })
    try {
      const options: Options = mock.query.mock.calls[0][0].options
      const invoke = async (
        name: 'UserPromptSubmit' | 'PostToolUse',
        input: HookInput
      ): Promise<void> => {
        for (const matcher of options.hooks?.[name] ?? [])
          for (const hook of matcher.hooks) await hook(input, undefined, { signal })
      }
      const input = {
        session_id: 'session-1',
        cwd: root,
        transcript_path: join(root, 'transcript.jsonl')
      }
      await invoke('UserPromptSubmit', {
        ...input,
        hook_event_name: 'UserPromptSubmit',
        prompt: 'fixture'
      })
      await invoke('PostToolUse', {
        ...input,
        hook_event_name: 'PostToolUse',
        tool_use_id: 'write-1',
        tool_name: 'Write',
        tool_input: { file_path: output, content: text },
        tool_response: 'success'
      })
      mock.messages.push({
        type: 'result',
        subtype: 'success',
        session_id: 'session-1',
        result: 'done',
        usage: {}
      })
      const events: NormalizedEvent[] = []
      for await (const batch of live.eventBatches) events.push(...batch.events)
      expect(capture).toHaveBeenCalledOnce()
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'output.captured', artifact, toolRunId: 'write-1' })
      )
    } finally {
      live.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('preserves Work background notifications as provider events without asking for new approval', async () => {
  const approve = vi.fn()
  mock.messages.push(
    {
      type: 'system',
      subtype: 'background_tasks_changed',
      session_id: 's1',
      tasks: [{ task_id: 'task1', task_type: 'local_bash', description: 'fixture' }]
    },
    {
      type: 'system',
      subtype: 'task_updated',
      session_id: 's1',
      task_id: 'task1',
      patch: { status: 'completed', is_backgrounded: false }
    }
  )
  const live = new ClaudeAdapter().sendMessage({
    sessionId: 's1',
    cwd: resolve('.'),
    text: 'fixture',
    extensions: await workExtensions(),
    requestApproval: approve
  })
  try {
    const events: (BackgroundEvent | ProviderMessageEvent)[] = []
    for await (const batch of live.eventBatches) events.push(...(batch.providerEvents ?? []))
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'background.snapshot',
        tasks: [{ taskId: 'task1', taskType: 'local_bash', description: 'fixture' }]
      })
    )
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'background.task',
        taskId: 'task1',
        patch: expect.objectContaining({ status: 'completed' })
      })
    )
    expect(approve).not.toHaveBeenCalled()
  } finally {
    live.close()
  }
})

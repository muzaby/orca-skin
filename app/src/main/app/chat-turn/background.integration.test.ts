import { expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))
import { ClaudeBackgroundMapper } from '../../adapters/claude-background'
import { BackgroundController } from '../../features/chat/background-controller'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import { HistoryWriter } from '../../features/history/writer'
import { BackgroundOutputStore } from '../../infra/background-output'
import { DbQueries } from '../../infra/db/queries'
import { applyMigrations } from '../../infra/db/migrate'
import type { TurnContext } from '../../contracts/turn'
import type { BackgroundEvent } from '../../../shared/background-task'
import {
  applyBackgroundEvent,
  backgroundKey,
  backgroundPending,
  emptyBackgroundState
} from '../../../shared/background-task'
import type { SDKTaskStartedMessage } from '@anthropic-ai/claude-agent-sdk'

it('observes an actual status-less SDK start after a failed Workflow receipt until the next snapshot', () => {
  const mapper = new ClaudeBackgroundMapper()
  let state = emptyBackgroundState()
  const receive = (raw: unknown): void => {
    for (const event of mapper.map(raw, 's')?.events ?? []) {
      if (event.type !== 'provider.message') state = applyBackgroundEvent(state, event)
    }
  }
  receive({ type: 'system', subtype: 'init', session_id: 's' })
  receive({ type: 'system', subtype: 'background_tasks_changed', session_id: 's', tasks: [] })
  receive({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id: 'wf', name: 'Workflow', input: {} }] }
  })
  receive({
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: 'wf', content: 'startup failed' }] },
    tool_use_result: {
      status: 'async_launched',
      taskId: 'task',
      runId: 'run',
      error: 'syntax error'
    }
  })
  expect(Object.values(state.tasks)).toHaveLength(0)
  const started: SDKTaskStartedMessage = {
    type: 'system',
    subtype: 'task_started',
    task_id: 'task',
    tool_use_id: 'wf',
    task_type: 'local_workflow',
    description: 'actual start',
    session_id: 's',
    uuid: '00000000-0000-0000-0000-000000000001'
  }
  receive(started)
  const key = backgroundKey(mapper.generation, 'task')
  expect(state.tasks[key].status).toBe('running')
  expect(state.tasks[key].liveMembership).toBe('unknown')
  expect(state.liveTaskIds).toEqual([])
  expect(state.calls[backgroundKey(mapper.generation, 'wf')].launchFailure).toBeDefined()
  expect(backgroundPending(state)).toBe(true)
  receive({
    type: 'system',
    subtype: 'task_progress',
    session_id: 's',
    task_id: 'task',
    description: 'progress after start',
    usage: { total_tokens: 1, tool_uses: 1, duration_ms: 10 }
  })
  expect(state.tasks[key].liveMembership).toBe('unknown')
  expect(backgroundPending(state)).toBe(true)
  receive({ type: 'system', subtype: 'background_tasks_changed', session_id: 's', tasks: [] })
  expect(state.tasks[key].liveMembership).toBe('excluded')
  expect(backgroundPending(state)).toBe(false)
  receive({
    type: 'system',
    subtype: 'task_notification',
    session_id: 's',
    task_id: 'task',
    status: 'completed'
  })
  receive({ ...started, uuid: '00000000-0000-0000-0000-000000000002' })
  expect(state.tasks[key].status).toBe('completed')
  expect(backgroundPending(state)).toBe(false)
})

it('journals before relay, captures late terminal output, and reloads without raw/currentness leakage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orca-background-it-'))
  const connection = new Database(':memory:')
  try {
    applyMigrations(connection)
    const db = new DbQueries(connection)
    const writer = new HistoryWriter(db, () => false)
    const published: BackgroundEvent[] = []
    const deps = {
      tracker: new BackgroundTaskTracker(),
      persist: writer.persistProviderEvent.bind(writer),
      load: (sid: string) => db.background.list(sid),
      publish: (event: BackgroundEvent) => {
        expect(db.background.list(event.sessionId).length).toBeGreaterThan(0)
        published.push(event)
      },
      runtime: () => undefined,
      roots: () => [directory],
      outputs: new BackgroundOutputStore(join(directory, 'snapshots'))
    }
    const controller = new BackgroundController(deps)
    const mapper = new ClaudeBackgroundMapper({ sdkVersion: '0.3.267' })
    const receive = (raw: unknown): void => {
      for (const event of mapper.map(raw, 's')?.events ?? []) controller.observe(event)
    }
    receive({
      type: 'system',
      subtype: 'init',
      session_id: 's',
      uuid: 'init',
      private_field: 'RAW_ONLY'
    })
    expect(published).toHaveLength(0)
    writer.persist(
      {
        titleAdapter: { id: 'claude' },
        agentKind: 'code',
        providerKey: 'p',
        isNewSession: false
      } as TurnContext,
      { type: 'session.updated', sessionId: 's', patch: {} }
    )
    expect(controller.state('s').generation).toBe(mapper.generation)
    receive({
      type: 'system',
      subtype: 'background_tasks_changed',
      session_id: 's',
      uuid: 'snap',
      tasks: [{ task_id: 't', task_type: 'local_bash', description: 'test' }]
    })
    const path = join(directory, 'out.txt')
    await writeFile(path, '<script>unsafe()</script>\noutput')
    receive({
      type: 'system',
      subtype: 'task_notification',
      session_id: 's',
      uuid: 'done',
      task_id: 't',
      status: 'completed',
      output_file: path
    })
    await vi.waitFor(() =>
      expect(
        Object.values(Object.values(controller.state('s').tasks)[0].outputSnapshots)
      ).toHaveLength(1)
    )
    const task = Object.values(controller.state('s').tasks)[0]
    const ref = task.outputRefs![0]
    const result = await controller.read({
      sessionId: 's',
      generation: mapper.generation,
      taskId: 't',
      outputId: ref.id,
      offset: 0,
      maxBytes: 64,
      view: 'snapshot'
    })
    expect(result.text).toContain('<script>unsafe()</script>')
    expect(JSON.stringify(published)).not.toContain('RAW_ONLY')
    expect(JSON.stringify(db.background.list('s', true))).toContain('RAW_ONLY')
    expect(db.loadParts('s')).toEqual([])
    const reloaded = new BackgroundController({
      ...deps,
      tracker: new BackgroundTaskTracker()
    }).state('s')
    expect(reloaded.connection).toBe('disconnected')
    expect(reloaded.liveKnown).toBe(false)
    expect(Object.values(reloaded.tasks)[0].status).toBe('completed')
  } finally {
    connection.close()
    await rm(directory, { recursive: true, force: true })
  }
})

import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type {
  AgentOutput,
  WorkflowInput,
  WorkflowOutput
} from '@anthropic-ai/claude-agent-sdk/sdk-tools'
import type {
  SDKBackgroundTasksChangedMessage,
  SDKTaskNotificationMessage,
  SDKTaskStartedMessage
} from '@anthropic-ai/claude-agent-sdk'
import { ClaudeBackgroundMapper } from '../../adapters/claude-background'
import { BackgroundTaskTracker } from '../../features/chat/background-tasks'
import {
  backgroundKey,
  isBackgroundTerminal,
  type BackgroundCallRecord,
  type BackgroundEvent,
  type BackgroundTaskRecord,
  type ProviderMessageEvent
} from '../../../shared/background-task'

// SDK 0.3.267 sdk-tools.d.ts: AgentOutput 103+, WorkflowInput 2798+, WorkflowOutput 4094+.
// sdk.d.ts: task_started, task_notification and background_tasks_changed are SDK wire contracts.
// These fixtures prove declared host interpretation, not availability of a deployed remote worker.
class Harness {
  readonly mapper = new ClaudeBackgroundMapper()
  readonly tracker = new BackgroundTaskTracker()
  readonly journal: ProviderMessageEvent[] = []
  private sequence = 0
  emit(raw: unknown): void {
    for (const event of this.mapper.map(raw, 's')!.events) {
      if (event.type === 'provider.message') this.journal.push(event)
      else this.tracker.observe(event)
    }
  }
  invoke(id: string, name: string, input: unknown = {}, parent?: string): void {
    this.emit({
      type: 'assistant',
      parent_tool_use_id: parent,
      message: { content: [{ type: 'tool_use', id, name, input }] }
    })
  }
  result(id: string, output: unknown): void {
    this.emit({
      type: 'user',
      tool_use_result: output,
      message: {
        content: [{ type: 'tool_result', tool_use_id: id, content: 'model-visible result' }]
      }
    })
  }
  start(taskId: string, toolUseId: string, taskType: string): void {
    this.emit({
      type: 'system',
      subtype: 'task_started',
      task_id: taskId,
      tool_use_id: toolUseId,
      task_type: taskType,
      description: taskId,
      session_id: 's',
      uuid: randomUUID()
    } satisfies SDKTaskStartedMessage)
  }
  finish(taskId: string, status: SDKTaskNotificationMessage['status'] = 'completed'): void {
    this.emit({
      type: 'system',
      subtype: 'task_notification',
      task_id: taskId,
      status,
      output_file: `C:/outputs/${taskId}.txt`,
      summary: `${taskId} ${status}`,
      session_id: 's',
      uuid: randomUUID()
    } satisfies SDKTaskNotificationMessage)
  }
  snapshot(tasks: SDKBackgroundTasksChangedMessage['tasks']): void {
    this.emit({
      type: 'system',
      subtype: 'background_tasks_changed',
      tasks,
      session_id: 's',
      uuid: randomUUID()
    } satisfies SDKBackgroundTasksChangedMessage)
  }
  host(
    event:
      | Omit<Extract<BackgroundEvent, { type: 'background.control' }>, 'source' | 'sessionId'>
      | Omit<Extract<BackgroundEvent, { type: 'background.connection' }>, 'source' | 'sessionId'>
  ): void {
    this.tracker.observe({
      ...event,
      sessionId: 's',
      source: {
        generation: this.mapper.generation,
        sequence: 100000 + ++this.sequence,
        receivedAt: Date.now(),
        replay: false
      }
    })
  }
  call(id: string): BackgroundCallRecord {
    return this.tracker.getState('s').calls[backgroundKey(this.mapper.generation, id)]
  }
  task(id: string): BackgroundTaskRecord {
    return this.tracker.getState('s').tasks[backgroundKey(this.mapper.generation, id)]
  }
}

describe('0231 VP-R20/R22 declared Workflow and Agent remote lifecycles', () => {
  it.each(['async_launched', 'remote_launched'] as const)(
    'maps Workflow %s to its exact mode and task identity without conflating run IDs',
    (status) => {
      const h = new Harness()
      const output = {
        status,
        taskId: 'workflow-task',
        taskType: status === 'remote_launched' ? 'remote_agent' : 'local_workflow',
        ...(status === 'async_launched'
          ? { runId: 'local-run' }
          : { sessionUrl: 'https://example.test/session/remote' }),
        scriptPath: 'C:/workflow/script.ts'
      } satisfies WorkflowOutput
      h.invoke('workflow-call', 'Workflow', {
        scriptPath: 'C:/workflow/script.ts'
      } satisfies WorkflowInput)
      h.result('workflow-call', output)
      expect(h.call('workflow-call')).toMatchObject({
        taskId: 'workflow-task',
        mode: status === 'remote_launched' ? 'remote' : 'background',
        structuredOutput: output,
        backgroundObserved: true
      })
      expect(h.task('workflow-task')).toMatchObject({
        taskId: 'workflow-task',
        toolUseId: 'workflow-call'
      })
      expect(h.call('workflow-call').runId).toBe(
        status === 'async_launched' ? 'local-run' : undefined
      )
      expect(h.task('local-run')).toBeUndefined()
      expect(h.tracker.hasPending('s')).toBe(true)
    }
  )

  it.each(['Agent', 'Task'])(
    'maps %s async receipt to background but waits for an explicit task ID',
    (name) => {
      const h = new Harness()
      const output = {
        status: 'async_launched',
        agentId: 'inner-agent',
        description: 'child',
        prompt: 'inspect',
        outputFile: 'C:/outputs/child.txt',
        canReadOutputFile: false
      } satisfies AgentOutput
      h.invoke('agent-call', name)
      h.result('agent-call', output)
      expect(h.call('agent-call')).toMatchObject({
        mode: 'background',
        agentId: 'inner-agent',
        awaitingTask: true,
        structuredOutput: output,
        canReadOutputFile: false
      })
      expect(h.call('agent-call').taskId).toBeUndefined()
      expect(Object.keys(h.tracker.getState('s').tasks)).toEqual([])
      expect(h.tracker.hasPending('s')).toBe(true)
      h.start('actual-task', 'agent-call', 'local_agent')
      expect(h.call('agent-call')).toMatchObject({
        agentId: 'inner-agent',
        taskId: 'actual-task',
        awaitingTask: false
      })
      expect(h.task('actual-task')).toMatchObject({ agentId: 'inner-agent', status: 'running' })
      expect(h.task('inner-agent')).toBeUndefined()
    }
  )

  it.each(['Agent', 'Task'])(
    'maps %s remote receipt to remote and creates only its declared task ID',
    (name) => {
      const h = new Harness()
      const output = {
        status: 'remote_launched',
        taskId: 'remote-task',
        sessionUrl: 'https://example.test/cloud/session',
        description: 'remote child',
        prompt: 'inspect',
        outputFile: 'https://example.test/cloud/output'
      } satisfies AgentOutput
      h.invoke('remote-call', name)
      h.result('remote-call', output)
      expect(h.call('remote-call')).toMatchObject({
        mode: 'remote',
        taskId: 'remote-task',
        awaitingTask: false,
        structuredOutput: output,
        outputRefs: [expect.objectContaining({ kind: 'uri', value: output.outputFile })]
      })
      expect(h.call('remote-call').agentId).toBeUndefined()
      expect(h.call('remote-call').runId).toBeUndefined()
      expect(h.task('remote-task')).toMatchObject({
        toolUseId: 'remote-call',
        liveMembership: 'unknown'
      })
      expect(isBackgroundTerminal(h.task('remote-task').status)).toBe(false)
      expect(h.tracker.hasPending('s')).toBe(true)
    }
  )

  it('keeps a declared Workflow syntax failure out of task state even when its receipt contains taskId and runId', () => {
    const h = new Harness()
    const output = {
      status: 'async_launched',
      taskId: 'never-started',
      runId: 'failed-run',
      error: 'syntax check failed'
    } satisfies WorkflowOutput
    h.invoke('failed-call', 'Workflow')
    h.result('failed-call', output)
    expect(h.call('failed-call')).toMatchObject({
      status: 'failed',
      taskId: 'never-started',
      runId: 'failed-run',
      launchFailure: { receipt: output }
    })
    expect(h.call('failed-call').mode).toBeUndefined()
    expect(h.task('never-started')).toBeUndefined()
    expect(h.tracker.hasPending('s')).toBe(false)
    expect(h.journal.at(-1)?.raw).toMatchObject({ tool_use_result: output })
  })

  it('keeps child completion separate from Workflow completion and stop ACK separate from residual tasks', () => {
    const h = new Harness()
    h.invoke('workflow-call', 'Workflow')
    h.result('workflow-call', {
      status: 'async_launched',
      taskId: 'workflow-task',
      runId: 'run-id'
    } satisfies WorkflowOutput)
    h.start('workflow-task', 'workflow-call', 'local_workflow')
    h.invoke('child-call', 'Agent', {}, 'workflow-call')
    h.result('child-call', {
      status: 'async_launched',
      agentId: 'child-agent',
      description: 'child',
      prompt: 'p',
      outputFile: 'C:/child.txt'
    } satisfies AgentOutput)
    h.start('child-task', 'child-call', 'local_agent')
    expect(h.call('child-call')).toMatchObject({
      parentToolUseId: 'workflow-call',
      agentId: 'child-agent',
      taskId: 'child-task'
    })
    h.finish('child-task')
    expect(h.task('child-task').status).toBe('completed')
    expect(h.task('workflow-task').status).toBe('running')
    h.host({ type: 'background.control', taskId: 'workflow-task', state: 'acknowledged' })
    h.snapshot([
      { task_id: 'workflow-task', task_type: 'local_workflow', description: 'still running' }
    ])
    expect(h.task('workflow-task')).toMatchObject({
      status: 'running',
      stop: { state: 'acknowledged' },
      liveMembership: 'included'
    })
    expect(h.tracker.count('s')).toBe(1)
    expect(h.tracker.hasPending('s')).toBe(true)
    h.finish('workflow-task', 'stopped')
    h.snapshot([])
    expect(h.task('workflow-task').status).toBe('stopped')
    expect(h.tracker.hasPending('s')).toBe(false)
  })

  it('preserves Workflow resume input and distinct invocations even when a run ID is reused; unknown blocked details remain raw', () => {
    const h = new Harness()
    h.invoke('first', 'Workflow')
    h.result('first', {
      status: 'async_launched',
      taskId: 'first-task',
      runId: 'same-run'
    } satisfies WorkflowOutput)
    h.finish('first-task', 'stopped')
    const input = {
      scriptPath: 'C:/workflow/revised.ts',
      resumeFromRunId: 'same-run'
    } satisfies WorkflowInput
    h.invoke('resumed', 'Workflow', input)
    h.result('resumed', {
      status: 'async_launched',
      taskId: 'resumed-task',
      runId: 'same-run'
    } satisfies WorkflowOutput)
    // The public SDK status union has pending, not blocked. Do not invent a blocked control API.
    const blocked = {
      type: 'system',
      subtype: 'task_updated',
      task_id: 'resumed-task',
      patch: { status: 'pending', blocked: { agentId: 'waiting-agent', reason: 'dependency' } }
    }
    h.emit(blocked)
    expect(h.call('first')).toMatchObject({ taskId: 'first-task', runId: 'same-run' })
    expect(h.call('resumed')).toMatchObject({
      input,
      taskId: 'resumed-task',
      runId: 'same-run',
      mode: 'background'
    })
    expect(h.task('first-task').status).toBe('stopped')
    expect(h.task('resumed-task').status).toBe('pending')
    expect(h.task('same-run')).toBeUndefined()
    expect(h.journal.at(-1)?.raw).toEqual(blocked)
    expect(h.tracker.hasPending('s')).toBe(true)
  })

  it.each(['Workflow', 'Agent'])(
    'retains %s remote history and ambient records through local termination without confirming remote completion',
    (name) => {
      const h = new Harness()
      h.invoke('remote', name)
      const output =
        name === 'Workflow'
          ? ({
              status: 'remote_launched',
              taskId: 'remote-task',
              taskType: 'remote_agent',
              sessionUrl: 'https://example.test/remote'
            } satisfies WorkflowOutput)
          : ({
              status: 'remote_launched',
              taskId: 'remote-task',
              sessionUrl: 'https://example.test/remote',
              description: 'remote',
              prompt: 'p',
              outputFile: 'C:/remote.txt'
            } satisfies AgentOutput)
      h.result('remote', output)
      h.start('remote-task', 'remote', 'remote_agent')
      h.snapshot([
        { task_id: 'remote-task', task_type: 'remote_agent', description: 'remote' },
        { task_id: 'watcher', task_type: 'local_agent', description: 'housekeeping', ambient: true }
      ])
      expect(h.tracker.count('s')).toBe(1)
      expect(h.task('watcher').ambient).toBe(true)
      h.host({ type: 'background.connection', state: 'terminated', reason: 'local process closed' })
      expect(h.call('remote')).toMatchObject({ mode: 'remote', structuredOutput: output })
      expect(h.task('remote-task')).toMatchObject({
        status: 'running',
        liveMembership: 'unknown',
        terminalEvidence: []
      })
      expect(h.task('watcher').ambient).toBe(true)
      expect(h.tracker.count('s')).toBe(0)
      expect(h.tracker.hasPending('s')).toBe(false)
      // Local ownership ended. History still records the last observation, not remote success/stop.
      expect(isBackgroundTerminal(h.task('remote-task').status)).toBe(false)
    }
  )
})

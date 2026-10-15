import { describe, expect, it } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import { sessionPanelModel } from './model'
import {
  applyBackgroundEvent,
  emptyBackgroundState
} from '../../../../../../../shared/background-task'

describe('OpenCode panel projection', () => {
  const messages: Message[] = [
    {
      role: 'assistant',
      createdAt: 10,
      parts: [
        {
          type: 'tool_call',
          toolRunId: 'shell',
          toolName: 'Bash',
          args: { command: 'npm run dev' }
        },
        {
          type: 'tool_call',
          toolRunId: 'agent',
          toolName: 'Task',
          args: { description: 'Inspect', subagent_type: 'explore' }
        }
      ]
    }
  ]
  it('shows received progress, then lets terminal results replace it', () => {
    const state = applyBackgroundEvent(emptyBackgroundState(), {
      type: 'background.call',
      sessionId: 's',
      toolUseId: 'shell',
      phase: 'progress',
      result: 'live output',
      source: { generation: 'prompt', sequence: 1, receivedAt: 10, replay: false }
    })
    expect(sessionPanelModel(messages, state).processes[0]).toMatchObject({
      command: 'npm run dev',
      output: 'live output',
      status: 'running'
    })
    const finished: Message[] = [
      ...messages,
      {
        role: 'assistant',
        createdAt: 20,
        parts: [
          { type: 'tool_result', toolRunId: 'shell', result: '', isError: false },
          { type: 'tool_result', toolRunId: 'agent', result: 'done', isError: false }
        ]
      }
    ]
    expect(sessionPanelModel(finished, state).processes[0]).toMatchObject({
      output: '',
      status: 'completed'
    })
    expect(sessionPanelModel(finished, state).agents[0].status).toBe('completed')
    finished[1].parts[0] = { type: 'tool_result', toolRunId: 'shell', result: null, isError: false }
    expect(sessionPanelModel(finished, state).processes[0].output).toBe('')
    expect(sessionPanelModel([], state).processes).toEqual([])
  })
  it('includes child shell calls, bounds long output and preserves failures', () => {
    const nested: Message[] = [
      {
        role: 'assistant',
        createdAt: 1,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'c:shell',
            toolName: 'Bash',
            args: { command: 'inspect' },
            parentToolRunId: 'agent'
          },
          {
            type: 'tool_result',
            toolRunId: 'c:shell',
            result: 'e'.repeat(70000),
            isError: true,
            parentToolRunId: 'agent'
          }
        ]
      }
    ]
    const model = sessionPanelModel(nested)
    expect(model.processes[0]).toMatchObject({ status: 'failed', truncated: true })
    expect(model.processes[0].output).toHaveLength(65536)
  })
})

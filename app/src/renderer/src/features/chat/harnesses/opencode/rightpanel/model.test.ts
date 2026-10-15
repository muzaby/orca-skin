import { describe, expect, it } from 'vitest'
import type { Message } from '../../../reducer/chatReducer'
import { hasPanelSources, sessionPanelModel } from './model'
import { createTaskContextSourceSelector, taskContextDirectories } from '../../../lib/taskContext'
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
  it.each(['Task', 'Bash'] as const)(
    'projects only the populated %s group across empty, populated and empty input',
    (toolName) => {
      const populated: Message[] = [
        {
          role: 'assistant',
          createdAt: 1,
          parts: [
            {
              type: 'tool_call',
              toolRunId: 'single',
              toolName,
              args: toolName === 'Task' ? { description: 'Inspect' } : { command: 'npm run dev' }
            }
          ]
        }
      ]
      const counts = [[], populated, []].map((history) => {
        const model = sessionPanelModel(history)
        return [model.agents.length, model.processes.length]
      })
      expect(counts).toEqual([[0, 0], toolName === 'Task' ? [1, 0] : [0, 1], [0, 0]])
    }
  )
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

describe('OpenCode source group visibility', () => {
  const attachment: Message = {
    role: 'user',
    createdAt: 1,
    parts: [
      {
        type: 'attachment',
        attachments: [
          {
            id: 'attachment',
            name: 'reference.pdf',
            kind: 'file',
            mimeType: 'application/pdf',
            path: 'C:/attachments/reference.pdf'
          }
        ]
      }
    ]
  }
  const web: Message = {
    role: 'assistant',
    createdAt: 2,
    parts: [
      {
        type: 'tool_call',
        toolRunId: 'fetch',
        toolName: 'WebFetch',
        args: { url: 'https://docs.example/guide' }
      },
      { type: 'tool_result', toolRunId: 'fetch', result: 'Read guide', isError: false }
    ]
  }
  it('never counts the implicit working directory as an added source', () => {
    expect(
      [null, 'C:/workspace', null].map((cwd) =>
        hasPanelSources(taskContextDirectories(cwd, []), [])
      )
    ).toEqual([false, false, false])
    expect(hasPanelSources(taskContextDirectories('C:/workspace', ['c:/workspace']), [])).toBe(
      false
    )
  })
  it.each([
    { name: 'extra directory', extraDirs: ['C:/refs'], messages: [] },
    { name: 'attachment', extraDirs: [], messages: [attachment] },
    { name: 'URL', extraDirs: [], messages: [web] }
  ])('tracks $name independently through 0 → 1 → 0', ({ extraDirs, messages }) => {
    const selectSources = createTaskContextSourceSelector()
    const empty = { extraDirs: [], messages: [] }
    const visible = [empty, { extraDirs, messages }, empty].map((frame) =>
      hasPanelSources(
        taskContextDirectories('C:/workspace', frame.extraDirs),
        selectSources(frame.messages)
      )
    )
    expect(visible).toEqual([false, true, false])
  })
})

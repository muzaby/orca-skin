import { describe, expect, it } from 'vitest'
import { OpenCodeActivityMapper } from './activity'
import { assistantMessage, editTool, openCodeEvent as event, textPart } from './adapter.testfixture'

function fixture(): OpenCodeActivityMapper {
  const mapper = new OpenCodeActivityMapper('s1', 'prompt-1')
  mapper.map(event('message.updated', { sessionID: 's1', info: assistantMessage() }))
  const task = editTool({
    tool: 'task',
    callID: 'task-1',
    state: {
      status: 'running',
      input: { description: 'Inspect files', subagent_type: 'explore' },
      metadata: { sessionId: 'child', model: { modelID: 'small' } },
      time: { start: 1 }
    }
  })
  mapper.map(event('message.part.updated', { sessionID: 's1', part: task, time: 1 }))
  return mapper
}
describe('OpenCode owned activity', () => {
  it('keeps background launch pending until its owned synthetic completion', () => {
    const mapper = fixture()
    const launch = mapper.map(
      event('message.part.updated', {
        sessionID: 's1',
        time: 2,
        part: editTool({
          tool: 'task',
          callID: 'task-1',
          state: {
            status: 'completed',
            input: {},
            output: 'Launched',
            title: 'Task',
            metadata: { sessionId: 'child', jobId: 'job', background: true },
            time: { start: 1, end: 2 }
          }
        })
      })
    )
    expect(launch.providerEvents).toContainEqual(
      expect.objectContaining({
        type: 'background.task',
        taskId: 'opencode:["job","task-1"]',
        phase: 'started',
        patch: { status: 'running', isBackgrounded: true, agentId: 'child' }
      })
    )
    expect(launch.providerEvents).toContainEqual(
      expect.objectContaining({
        type: 'background.call',
        phase: 'returned',
        patch: expect.objectContaining({ mode: 'background', taskId: 'opencode:["job","task-1"]' })
      })
    )
    mapper.map(
      event('message.updated', {
        sessionID: 's1',
        info: {
          id: 'prompt-1',
          sessionID: 's1',
          role: 'user',
          time: { created: 1 },
          agent: 'build',
          model: { providerID: 'p', modelID: 'm' }
        }
      })
    )
    mapper.finish()
    expect(mapper.map(event('session.idle', { sessionID: 'child' })).providerEvents).toEqual([])
    mapper.map(
      event('message.updated', {
        sessionID: 's1',
        info: {
          id: 'feed',
          sessionID: 's1',
          role: 'user',
          time: { created: 3 },
          agent: 'build',
          model: { providerID: 'p', modelID: 'm' }
        }
      })
    )
    const completion = event('message.part.updated', {
      sessionID: 's1',
      time: 3,
      part: textPart('<task id="child" state="completed"><task_result>Done</task_result></task>', {
        id: 'feed-part',
        messageID: 'feed',
        synthetic: true
      })
    })
    const done = mapper.map(completion)
    expect(done.events).toMatchObject([
      { type: 'input.received', origin: { kind: 'automatic', format: 'tagged' } }
    ])
    expect(done.providerEvents).toMatchObject([
      {
        type: 'background.task',
        taskId: 'opencode:["job","task-1"]',
        toolUseId: 'task-1',
        phase: 'notification',
        patch: { status: 'completed' }
      }
    ])
    expect(mapper.map(completion)).toEqual({ events: [], providerEvents: [] })
  })

  it('separates concurrent children and reused sessions across root frames', () => {
    const mapper = fixture()
    for (const id of ['a', 'b'])
      mapper.map(
        event('message.part.updated', {
          sessionID: 's1',
          time: 2,
          part: editTool({
            tool: 'task',
            callID: `task-${id}`,
            state: {
              status: 'running',
              input: {},
              metadata: { sessionId: id, background: true },
              time: { start: 2 }
            }
          })
        })
      )
    mapper.map(
      event('message.updated', {
        sessionID: 'a',
        info: assistantMessage('a', 'child-input', 'child-answer')
      })
    )
    mapper.map(
      event('message.part.updated', {
        sessionID: 'a',
        time: 3,
        part: textPart('ongoing', { sessionID: 'a', messageID: 'child-answer' })
      })
    )
    const first = mapper.finish()
    expect(
      first.some((value) => 'parentToolRunId' in value && value.parentToolRunId === 'task-a')
    ).toBe(false)
    const childEnd = mapper.map(event('session.idle', { sessionID: 'a' }))
    expect(childEnd.events).toContainEqual({
      type: 'message.completed',
      sessionId: 's1',
      parentToolRunId: 'task-a',
      message: { text: 'ongoing' }
    })
    mapper.acceptPrompt('new-root')
    mapper.map(
      event('message.updated', {
        sessionID: 's1',
        info: assistantMessage('s1', 'new-root', 'new-answer')
      })
    )
    const next = mapper.map(
      event('message.part.updated', {
        sessionID: 's1',
        time: 4,
        part: editTool({
          messageID: 'new-answer',
          tool: 'task',
          callID: 'task-a2',
          state: {
            status: 'running',
            input: {},
            metadata: { sessionId: 'a', background: true },
            time: { start: 4 }
          }
        })
      })
    )
    expect(next.providerEvents).toContainEqual(
      expect.objectContaining({
        type: 'background.task',
        taskId: 'opencode:["a","task-a2"]',
        toolUseId: 'task-a2'
      })
    )
    expect(mapper.ownedSessions()).toEqual(expect.arrayContaining(['s1', 'a', 'b']))
  })

  it('flushes a child snapshot when the root ends before a child terminal event', () => {
    const mapper = fixture()
    mapper.map(event('message.updated', { sessionID: 'child', info: assistantMessage('child') }))
    mapper.map(
      event('message.part.updated', {
        sessionID: 'child',
        time: 1,
        part: textPart('Last child output', { sessionID: 'child' })
      })
    )
    const events = mapper.finish()
    expect(events).toContainEqual({
      type: 'message.completed',
      sessionId: 's1',
      parentToolRunId: 'task-1',
      message: { text: 'Last child output' }
    })
    expect(events.filter((value) => value.type === 'turn.ended')).toHaveLength(1)
    expect(mapper.finish()).toEqual([])
  })
  it('routes child text and namespaced tools to their parent, ignoring unrelated sessions', () => {
    const mapper = fixture()
    expect(mapper.ownsSession('unrelated')).toBe(false)
    expect(
      mapper.map(
        event('message.updated', { sessionID: 'unrelated', info: assistantMessage('unrelated') })
      ).events
    ).toEqual([])
    mapper.map(event('message.updated', { sessionID: 'child', info: assistantMessage('child') }))
    const message = event('message.part.updated', {
      sessionID: 'child',
      part: textPart('Child answer', {
        sessionID: 'child',
        time: { start: 1, end: 2 }
      }),
      time: 2
    })
    expect(mapper.map(message).events).toContainEqual({
      type: 'message.completed',
      sessionId: 's1',
      parentToolRunId: 'task-1',
      message: { text: 'Child answer' }
    })
    expect(mapper.map(message).events).toEqual([])
    const tool = mapper.map(
      event('message.part.updated', {
        sessionID: 'child',
        part: editTool({ sessionID: 'child' }),
        time: 3
      })
    )
    expect(tool.events).toContainEqual(
      expect.objectContaining({
        type: 'tool.call.completed',
        toolRunId: 'child:call-1',
        parentToolRunId: 'task-1',
        sessionId: 's1'
      })
    )
    expect(
      mapper
        .map(event('session.status', { sessionID: 'child', status: { type: 'idle' } }))
        .events.some((item) => item.type === 'turn.ended' || item.type === 'telemetry')
    ).toBe(false)
    expect(mapper.root.terminal).toBe(false)
  })
  it('does not admit task metadata from a previous prompt or child errors as root failure', () => {
    const mapper = fixture()
    mapper.map(
      event('message.updated', { sessionID: 's1', info: assistantMessage('s1', 'old', 'old-a') })
    )
    mapper.map(
      event('message.part.updated', {
        sessionID: 's1',
        part: editTool({
          messageID: 'old-a',
          tool: 'task',
          state: {
            status: 'running',
            input: {},
            metadata: { sessionId: 'bad' },
            time: { start: 1 }
          }
        }),
        time: 1
      })
    )
    expect(mapper.ownsSession('bad')).toBe(false)
    expect(
      mapper.map(
        event('session.error', {
          sessionID: 'child',
          error: { name: 'UnknownError', data: { message: 'Child failed' } }
        })
      ).events
    ).toEqual([])
    expect(mapper.root.terminal).toBe(false)
  })
  it('journals changed shell snapshots with bounded output and explicit status', () => {
    const mapper = fixture()
    const shell = editTool({
      tool: 'bash',
      callID: 'shell',
      state: {
        status: 'running',
        input: { command: 'npm run dev' },
        metadata: { output: 'x'.repeat(70000) },
        time: { start: 1 }
      }
    })
    const update = event('message.part.updated', { sessionID: 's1', part: shell, time: 1 })
    const result = mapper.map(update).providerEvents[0]
    expect(result).toMatchObject({
      type: 'background.call',
      phase: 'progress',
      toolName: 'Bash',
      patch: { status: 'running', mode: 'foreground' },
      meta: { truncated: true }
    })
    if (result.type === 'background.call') expect(String(result.result)).toHaveLength(65536)
    expect(mapper.map(update).providerEvents).toEqual([])
    expect(
      mapper.map(
        event('message.part.updated', {
          sessionID: 's1',
          time: 2,
          part: {
            ...shell,
            state: {
              status: 'error',
              input: { command: 'npm run dev' },
              error: 'Exit 1',
              time: { start: 1, end: 2 }
            }
          }
        })
      ).providerEvents[0]
    ).toMatchObject({ phase: 'returned', result: 'Exit 1', patch: { status: 'error' } })
  })
  it('reuses a child session under a new task without attributing its answer to the old task', () => {
    const mapper = fixture()
    mapper.map(event('message.updated', { sessionID: 'child', info: assistantMessage('child') }))
    mapper.map(event('session.idle', { sessionID: 'child' }))
    mapper.map(
      event('message.part.updated', {
        sessionID: 's1',
        time: 2,
        part: editTool({
          tool: 'task',
          callID: 'task-2',
          state: {
            status: 'running',
            input: {},
            metadata: { sessionId: 'child' },
            time: { start: 2 }
          }
        })
      })
    )
    mapper.map(
      event('message.updated', {
        sessionID: 'child',
        info: assistantMessage('child', 'next-prompt', 'next-answer')
      })
    )
    mapper.map(
      event('message.part.updated', {
        sessionID: 'child',
        time: 3,
        part: textPart('Resumed answer', { sessionID: 'child', messageID: 'next-answer' })
      })
    )
    const completed = mapper.map(
      event('message.part.updated', {
        sessionID: 's1',
        time: 4,
        part: editTool({
          tool: 'task',
          callID: 'task-2',
          state: {
            status: 'completed',
            input: {},
            output: 'Done',
            title: 'Task',
            metadata: { sessionId: 'child' },
            time: { start: 2, end: 4 }
          }
        })
      })
    )
    expect(completed.events).toContainEqual({
      type: 'message.completed',
      sessionId: 's1',
      parentToolRunId: 'task-2',
      message: { text: 'Resumed answer' }
    })
    expect(completed.events.some((value) => value.type === 'turn.ended')).toBe(false)
  })
})

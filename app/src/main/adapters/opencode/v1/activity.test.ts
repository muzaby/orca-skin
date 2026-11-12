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
      message: { text: 'ongoing' },
      nativeMessageId: 'child-answer'
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
      message: { text: 'Last child output' },
      nativeMessageId: 'a1'
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
      message: { text: 'Child answer' },
      nativeMessageId: 'a1'
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
      message: { text: 'Resumed answer' },
      nativeMessageId: 'next-answer'
    })
    expect(completed.events.some((value) => value.type === 'turn.ended')).toBe(false)
  })
})

// 0314 — "백그라운드 작업이 있으면 정본 이벤트가 있다"(plan §10 규칙 O). main 은 정본 없는
// 세션을 빈 상태로 읽으므로, child 등록·백그라운드 표시가 정본 push 와 한 호출에 있어야 한다.
describe('OpenCode background invariant (0314 O1~O6)', () => {
  type Mapped = ReturnType<OpenCodeActivityMapper['map']>
  function rooted(): OpenCodeActivityMapper {
    const mapper = new OpenCodeActivityMapper('s1', 'prompt-1')
    mapper.map(event('message.updated', { sessionID: 's1', info: assistantMessage() }))
    return mapper
  }
  function taskPart(
    callID: string,
    status: 'pending' | 'running' | 'error',
    metadata: Record<string, unknown>
  ): ReturnType<typeof editTool> {
    const state =
      status === 'pending'
        ? { status, input: {}, raw: '', metadata }
        : status === 'running'
          ? { status, input: {}, metadata, time: { start: 1 } }
          : { status, input: {}, error: 'boom', metadata, time: { start: 1, end: 2 } }
    return editTool({ tool: 'task', callID, state: state as never })
  }
  const update = (mapper: OpenCodeActivityMapper, part: ReturnType<typeof editTool>): Mapped =>
    mapper.map(event('message.part.updated', { sessionID: 's1', part, time: 1 }))
  // 공통 단언 — 등록된 child 마다 그 부모 toolUseId 의 `background.call` 이 이미 나왔다.
  function expectOwnedChildrenHaveCalls(
    mapper: OpenCodeActivityMapper,
    seen: Mapped['providerEvents'],
    parents: Record<string, string>
  ): void {
    const children = mapper.ownedSessions().filter((id) => id !== 's1')
    expect(children.sort()).toEqual(Object.keys(parents).sort())
    for (const child of children)
      expect(seen).toContainEqual(
        expect.objectContaining({ type: 'background.call', toolUseId: parents[child] })
      )
  }

  it('O1 — 첫 관측이 백그라운드 task 면 같은 호출이 task started 와 background call 을 낸다', () => {
    const mapper = rooted()
    const out = update(mapper, taskPart('t1', 'running', { sessionId: 'c1', background: true }))
    expect(out.providerEvents).toMatchObject([
      {
        type: 'background.task',
        toolUseId: 't1',
        phase: 'started',
        patch: { status: 'running', isBackgrounded: true, agentId: 'c1' }
      },
      { type: 'background.call', toolUseId: 't1', patch: { mode: 'background' } }
    ])
    expectOwnedChildrenHaveCalls(mapper, out.providerEvents, { c1: 't1' })
  })

  it('O2 — 포그라운드로 먼저 관측된 child 가 나중에 백그라운드가 되면 그 호출이 task started 를 낸다', () => {
    const mapper = rooted()
    const first = update(mapper, taskPart('t1', 'running', { sessionId: 'c1' }))
    expect(first.providerEvents).toMatchObject([
      { type: 'background.call', toolUseId: 't1', patch: { mode: 'foreground' } }
    ])
    expectOwnedChildrenHaveCalls(mapper, first.providerEvents, { c1: 't1' })
    const later = update(mapper, taskPart('t1', 'running', { sessionId: 'c1', background: true }))
    expect(later.providerEvents).toMatchObject([
      { type: 'background.task', toolUseId: 't1', phase: 'started' },
      { type: 'background.call', toolUseId: 't1', patch: { mode: 'background' } }
    ])
    expectOwnedChildrenHaveCalls(mapper, [...first.providerEvents, ...later.providerEvents], {
      c1: 't1'
    })
  })

  it('O3 — 백그라운드 task 가 error 로 오면 같은 호출이 error 통지를 낸다', () => {
    const mapper = rooted()
    const out = update(mapper, taskPart('t1', 'error', { sessionId: 'c1', background: true }))
    expect(out.providerEvents).toMatchObject([
      {
        type: 'background.task',
        toolUseId: 't1',
        phase: 'notification',
        patch: { status: 'error', isBackgrounded: true }
      },
      { type: 'background.call', toolUseId: 't1', phase: 'returned' }
    ])
    // error 로 정착한 child 는 소유 목록에서 빠진다 — 남은 child 가 없어도 단언은 성립한다.
    expectOwnedChildrenHaveCalls(mapper, out.providerEvents, {})
  })

  it('O4 — 백그라운드 bash 는 background call 을 낸다', () => {
    const mapper = rooted()
    const out = update(
      mapper,
      editTool({
        tool: 'bash',
        callID: 'sh1',
        state: {
          status: 'running',
          input: { command: 'npm run dev' },
          metadata: { background: true },
          time: { start: 1 }
        }
      })
    )
    expect(out.providerEvents).toMatchObject([
      { type: 'background.call', toolUseId: 'sh1', toolName: 'Bash', patch: { mode: 'background' } }
    ])
    expectOwnedChildrenHaveCalls(mapper, out.providerEvents, {})
  })

  it('O5 — pending task 는 child 를 등록하지 않고 정본 이벤트도 내지 않는다', () => {
    const mapper = rooted()
    const out = update(mapper, taskPart('t1', 'pending', { sessionId: 'c1', background: true }))
    expect(out.providerEvents).toEqual([])
    expect(mapper.ownedSessions()).toEqual(['s1'])
  })

  it('O6 — 백그라운드 child 의 완료 입력은 그 status 의 통지를 낸다', () => {
    const mapper = rooted()
    const launch = update(mapper, taskPart('t1', 'running', { sessionId: 'c1', background: true }))
    expectOwnedChildrenHaveCalls(mapper, launch.providerEvents, { c1: 't1' })
    // 완료 입력은 현재 프롬프트 뒤에 온 사용자 메시지의 synthetic 파트로만 받아들인다.
    for (const [id, created] of [
      ['prompt-1', 1],
      ['feed', 3]
    ] as const)
      mapper.map(
        event('message.updated', {
          sessionID: 's1',
          info: {
            id,
            sessionID: 's1',
            role: 'user',
            time: { created },
            agent: 'build',
            model: { providerID: 'p', modelID: 'm' }
          }
        })
      )
    const done = mapper.map(
      event('message.part.updated', {
        sessionID: 's1',
        time: 3,
        part: textPart('<task id="c1" state="error"><task_result>Nope</task_result></task>', {
          id: 'feed-part',
          messageID: 'feed',
          synthetic: true
        })
      })
    )
    expect(done.providerEvents).toMatchObject([
      {
        type: 'background.task',
        taskId: 'opencode:["c1","t1"]',
        toolUseId: 't1',
        phase: 'notification',
        patch: { status: 'error', isBackgrounded: true }
      }
    ])
  })
})

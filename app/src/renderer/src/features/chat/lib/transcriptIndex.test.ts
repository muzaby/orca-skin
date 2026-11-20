import { describe, expect, it } from 'vitest'
import { initialChatState, type ChatState, type Message } from '../reducer/chatReducer'
import { newTranscriptChanges, recordChange, type TranscriptChange } from './transcript/changeLog'
import { transcriptIndexFor } from './transcriptIndex'
import {
  childMessageForParentToolRunId,
  createTaskContextSourceSelector,
  persistedBackgroundModels,
  sessionPanelModel,
  subagentTaskDescription,
  subagentTasksFromMessages,
  taskBoardFromMessages,
  transcriptResultsByToolUseId
} from './transcriptIndex.legacy.testfixture'
import type { AppMessagePart } from '../../../../../shared/ipc'

function makeState(messages: Message[], prev?: ChatState, change?: TranscriptChange): ChatState {
  if (!prev) {
    return {
      ...initialChatState,
      messages,
      transcriptChanges: recordChange(newTranscriptChanges(), { kind: 'reset', complete: true })
    }
  }
  return {
    ...prev,
    messages,
    transcriptChanges: change
      ? recordChange(prev.transcriptChanges, change)
      : prev.transcriptChanges
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function assertAllDomainsEqual(state: ChatState, parentIds: string[]): void {
  const idx = transcriptIndexFor(state)
  const msgs = state.messages
  const legacySources = createTaskContextSourceSelector()(msgs)

  // x1: taskBoard
  expect(idx.taskBoard()).toEqual(taskBoardFromMessages(msgs))
  // x2: taskContextSources
  expect(idx.taskContextSources()).toEqual(legacySources)
  // x3: subagentTasks (top-level)
  expect(idx.subagentTasks(false)).toEqual(subagentTasksFromMessages(msgs, false))
  // x4: subagentTasks (nested)
  expect(idx.subagentTasks(true)).toEqual(subagentTasksFromMessages(msgs, true))
  // x5 & x6: subagentTaskDescription & childMessage
  for (const pid of parentIds) {
    expect(idx.taskDescription(pid)).toEqual(subagentTaskDescription(msgs, pid))
    expect(idx.childMessage(pid)).toEqual(childMessageForParentToolRunId(msgs, pid))
  }
  // x7: transcriptResults
  expect(idx.transcriptResults()).toEqual(transcriptResultsByToolUseId(msgs))
  // x8: persistedBackgroundModels
  expect(idx.backgroundModels()).toEqual(persistedBackgroundModels(msgs))
  // x9: sessionPanelModel
  expect(idx.openCodePanelModel()).toEqual(sessionPanelModel(msgs))
}

describe('transcriptIndex (EP-13 x1~x14)', () => {
  it('x1~x9: 500-step randomized sequence matches all 9 legacy functions at every step', () => {
    const rand = mulberry32(32613)
    let state = makeState([])
    let nextMsg = 1
    let nextRun = 1
    let nextTask = 1
    const parentIds: string[] = []
    const openRuns: { toolRunId: string; toolName: string; taskId?: string }[] = []

    const pushAssistant = (parts: AppMessagePart[]): void => {
      const id = `a:${nextMsg++}`
      const msg: Message = { id, role: 'assistant', createdAt: nextMsg * 10, parts }
      state = makeState([...state.messages, msg], state, { kind: 'append', ids: [id] })
    }

    const prependUser = (text: string): void => {
      const id = `u:pre-${nextMsg++}`
      const msg: Message = {
        id,
        role: 'user',
        createdAt: 1,
        parts: [{ type: 'text', text }]
      }
      state = makeState([msg, ...state.messages], state, { kind: 'prepend', ids: [id] })
    }

    for (let step = 0; step < 500; step++) {
      const r = rand()
      if (r < 0.12) {
        const id = `u:${nextMsg++}`
        const msg: Message = {
          id,
          role: 'user',
          createdAt: nextMsg * 10,
          parts: [
            { type: 'text', text: `prompt ${step}` },
            {
              type: 'attachment',
              attachments: [
                {
                  id: `att-${step}`,
                  name: `doc-${step}.md`,
                  kind: 'file',
                  mimeType: 'text/markdown',
                  path: `/work/doc-${step}.md`
                }
              ]
            }
          ]
        }
        state = makeState([...state.messages, msg], state, { kind: 'append', ids: [id] })
      } else if (r < 0.24) {
        const toolRunId = `run-${nextRun++}`
        const taskId = String(nextTask++)
        openRuns.push({ toolRunId, toolName: 'TaskCreate', taskId })
        pushAssistant([
          {
            type: 'tool_call',
            toolRunId,
            toolName: 'TaskCreate',
            args: { subject: `Task ${taskId}`, description: `Desc ${taskId}` }
          }
        ])
      } else if (r < 0.36) {
        const toolRunId = `run-${nextRun++}`
        parentIds.push(toolRunId)
        openRuns.push({ toolRunId, toolName: 'Agent' })
        pushAssistant([
          {
            type: 'tool_call',
            toolRunId,
            toolName: 'Agent',
            args: { description: `Subagent ${toolRunId}`, subagent_type: 'Explore' }
          }
        ])
      } else if (r < 0.48 && parentIds.length > 0) {
        const pid = parentIds[Math.floor(rand() * parentIds.length)]
        const childRun = `run-${nextRun++}`
        pushAssistant([
          {
            type: 'tool_call',
            toolRunId: childRun,
            toolName: 'Read',
            args: { file_path: `/work/child-${step}.ts` },
            parentToolRunId: pid
          },
          {
            type: 'text',
            text: `child note ${step}`,
            parentToolRunId: pid
          }
        ])
      } else if (r < 0.6) {
        const toolRunId = `run-${nextRun++}`
        const toolName = rand() < 0.5 ? 'Bash' : 'Read'
        openRuns.push({ toolRunId, toolName })
        pushAssistant([
          {
            type: 'tool_call',
            toolRunId,
            toolName,
            args:
              toolName === 'Bash'
                ? { command: `echo ${step}` }
                : { file_path: `/work/file-${step}.ts` }
          }
        ])
      } else if (r < 0.78 && openRuns.length > 0 && state.messages.length > 0) {
        const run = openRuns.shift()!
        const targetIdx = state.messages.length - 1
        const target = state.messages[targetIdx]
        const prevLen = target.parts.length
        const resultPart: AppMessagePart = {
          type: 'tool_result',
          isError: false,
          toolRunId: run.toolRunId,
          result: run.toolName === 'Bash' ? `out-${step}` : 'ok',
          structuredOutput:
            run.toolName === 'TaskCreate'
              ? { task: { id: run.taskId, subject: `Task ${run.taskId}` } }
              : undefined,
          subagentMeta: run.toolName === 'Agent' ? { model: 'claude-sonnet-4-6' } : undefined
        }
        const nextMessages = [...state.messages]
        nextMessages[targetIdx] = { ...target, parts: [...target.parts, resultPart] }
        state = makeState(nextMessages, state, {
          kind: 'replace',
          id: target.id!,
          partsFrom: prevLen
        })
      } else if (r < 0.88 && state.messages.length > 0) {
        // Pure text append on existing assistant message
        const targetIdx = state.messages.length - 1
        const target = state.messages[targetIdx]
        const prevLen = target.parts.length
        const nextMessages = [...state.messages]
        nextMessages[targetIdx] = {
          ...target,
          parts: [...target.parts, { type: 'text', text: `delta ${step}` }]
        }
        state = makeState(nextMessages, state, {
          kind: 'replace',
          id: target.id!,
          partsFrom: prevLen
        })
      } else if (r < 0.95) {
        prependUser(`older ${step}`)
      } else if (state.messages.length > 2) {
        // Remove an older user message
        const victim = state.messages[0]
        state = makeState(state.messages.slice(1), state, { kind: 'remove', ids: [victim.id!] })
      }

      assertAllDomainsEqual(state, parentIds.slice(0, 5))
    }
  })

  it('x10: appending text to a message with TaskCreate result leaves taskBoard revision & view identity unchanged', () => {
    let state = makeState([
      {
        id: 'a:1',
        role: 'assistant',
        createdAt: 10,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'tc-1',
            toolName: 'TaskCreate',
            args: { subject: 'Write tests' }
          },
          {
            type: 'tool_result',
            isError: false,
            toolRunId: 'tc-1',
            result: 'created',
            structuredOutput: { task: { id: '1', subject: 'Write tests' } }
          }
        ]
      }
    ])
    const idx = transcriptIndexFor(state)
    const revBefore = { ...idx.domainRevision }
    const boardBefore = idx.taskBoard()
    const sourcesBefore = idx.taskContextSources()
    const subagentsBefore = idx.subagentTasks()
    const resultsBefore = idx.transcriptResults()
    const modelsBefore = idx.backgroundModels()

    // Append plain text to the same message
    const updated: Message = {
      ...state.messages[0],
      parts: [...state.messages[0].parts, { type: 'text', text: 'Working on it...' }]
    }
    state = makeState([updated], state, { kind: 'replace', id: 'a:1', partsFrom: 2 })
    transcriptIndexFor(state)

    expect(idx.domainRevision).toEqual(revBefore)
    expect(idx.taskBoard()).toBe(boardBefore)
    expect(idx.taskContextSources()).toBe(sourcesBefore)
    expect(idx.subagentTasks()).toBe(subagentsBefore)
    expect(idx.transcriptResults()).toBe(resultsBefore)
    expect(idx.backgroundModels()).toBe(modelsBefore)

    // A reset recomputes every domain even when the reloaded board has equal values.
    state = makeState(structuredClone(state.messages), state, { kind: 'reset', complete: true })
    const reloaded = transcriptIndexFor(state)
    expect(reloaded.taskBoard()).toBe(boardBefore)
    expect(reloaded.domainRevision.taskBoard).toBe(revBefore.taskBoard)
  })

  it('x11: child event for parent B does not change parent A parentRevision or childMessage identity', () => {
    let state = makeState([
      {
        id: 'a:1',
        role: 'assistant',
        createdAt: 10,
        parts: [
          { type: 'tool_call', toolRunId: 'pA', toolName: 'Agent', args: { description: 'A' } },
          { type: 'tool_call', toolRunId: 'pB', toolName: 'Agent', args: { description: 'B' } },
          { type: 'text', text: 'hello from A', parentToolRunId: 'pA' }
        ]
      }
    ])
    const idx = transcriptIndexFor(state)
    const revA = idx.parentRevision.get('pA')
    const childA = idx.childMessage('pA')

    state = makeState(
      [
        ...state.messages,
        {
          id: 'a:2',
          role: 'assistant',
          createdAt: 20,
          parts: [{ type: 'text', text: 'hello from B', parentToolRunId: 'pB' }]
        }
      ],
      state,
      { kind: 'append', ids: ['a:2'] }
    )
    transcriptIndexFor(state)

    expect(idx.parentRevision.get('pA')).toBe(revA)
    expect(idx.childMessage('pA')).toBe(childA)
    expect(idx.parentRevision.get('pB')).toBeGreaterThan(0)
    expect(idx.childMessage('pB')?.parts).toHaveLength(1)
  })

  it('x12: previous views stay immutable after updates and two sessions do not mix', () => {
    let s1 = makeState([
      {
        id: 'a:1',
        role: 'assistant',
        createdAt: 1,
        parts: [
          { type: 'tool_call', toolRunId: 'r1', toolName: 'TaskCreate', args: { subject: 'S1' } },
          {
            type: 'tool_result',
            isError: false,
            toolRunId: 'r1',
            result: 'ok',
            structuredOutput: { task: { id: '1', subject: 'S1' } }
          }
        ]
      }
    ])
    const s2 = makeState([
      {
        id: 'a:1',
        role: 'assistant',
        createdAt: 1,
        parts: [
          { type: 'tool_call', toolRunId: 'r2', toolName: 'TaskCreate', args: { subject: 'S2' } },
          {
            type: 'tool_result',
            isError: false,
            toolRunId: 'r2',
            result: 'ok',
            structuredOutput: { task: { id: '2', subject: 'S2' } }
          }
        ]
      }
    ])

    const idx1 = transcriptIndexFor(s1)
    const idx2 = transcriptIndexFor(s2)
    const oldView1 = idx1.taskBoard()
    expect(oldView1.map((t) => t.subject)).toEqual(['S1'])
    expect(idx2.taskBoard().map((t) => t.subject)).toEqual(['S2'])

    s1 = makeState(
      [
        ...s1.messages,
        {
          id: 'a:2',
          role: 'assistant',
          createdAt: 2,
          parts: [
            {
              type: 'tool_call',
              toolRunId: 'r3',
              toolName: 'TaskCreate',
              args: { subject: 'S1b' }
            },
            {
              type: 'tool_result',
              isError: false,
              toolRunId: 'r3',
              result: 'ok',
              structuredOutput: { task: { id: '3', subject: 'S1b' } }
            }
          ]
        }
      ],
      s1,
      { kind: 'append', ids: ['a:2'] }
    )
    transcriptIndexFor(s1)

    // Old view retained its value & reference; s2 untouched
    expect(oldView1.map((t) => t.subject)).toEqual(['S1'])
    expect(idx1.taskBoard().map((t) => t.subject)).toEqual(['S1', 'S1b'])
    expect(idx2.taskBoard().map((t) => t.subject)).toEqual(['S2'])
  })

  it('x13: folding multiple missed changes retracts replaced/removed contributions cleanly', () => {
    let state = makeState([
      {
        id: 'a:1',
        role: 'assistant',
        createdAt: 1,
        parts: [
          { type: 'tool_call', toolRunId: 't1', toolName: 'Agent', args: { description: 'old' } },
          { type: 'text', text: 'ghost child', parentToolRunId: 't1' }
        ]
      }
    ])
    const idx = transcriptIndexFor(state)
    expect(idx.subagentTasks()).toHaveLength(1)
    expect(idx.childMessage('t1')?.parts).toHaveLength(1)

    // Two changes occur before transcriptIndexFor is called again:
    // 1) replace partsFrom: 1 (retracting child text)
    // 2) replace partsFrom: 0 (replacing tool_call with plain text)
    state = makeState(
      [
        {
          id: 'a:1',
          role: 'assistant',
          createdAt: 1,
          parts: [
            { type: 'tool_call', toolRunId: 't1', toolName: 'Agent', args: { description: 'old' } }
          ]
        }
      ],
      state,
      { kind: 'replace', id: 'a:1', partsFrom: 1 }
    )
    state = makeState(
      [
        {
          id: 'a:1',
          role: 'assistant',
          createdAt: 1,
          parts: [{ type: 'text', text: 'retracted everything' }]
        }
      ],
      state,
      { kind: 'replace', id: 'a:1', partsFrom: 0 }
    )

    transcriptIndexFor(state)
    expect(idx.subagentTasks()).toEqual([])
    expect(idx.childMessage('t1')).toBeNull()
    expect(idx.taskDescription('t1')).toBeUndefined()
  })

  it('x14: duplicate toolRunId calls (2 calls + 1 result) produce 1 panel item with the paired result', () => {
    const state = makeState([
      {
        id: 'a:1',
        role: 'assistant',
        createdAt: 1,
        parts: [
          {
            type: 'tool_call',
            toolRunId: 'dup-1',
            toolName: 'Agent',
            args: { description: 'First' }
          },
          {
            type: 'tool_call',
            toolRunId: 'dup-1',
            toolName: 'Agent',
            args: { description: 'Second' }
          },
          {
            type: 'tool_result',
            isError: false,
            toolRunId: 'dup-1',
            result: 'final-result'
          }
        ]
      }
    ])

    const idx = transcriptIndexFor(state)
    const tasks = idx.subagentTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].description).toBe('First')
    expect(tasks[0].call.result?.output).toBe('final-result')
  })
})

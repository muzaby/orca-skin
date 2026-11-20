import { deepStrictEqual } from 'node:assert'
import { describe, expect, it } from 'vitest'
import { duplicateToolResultEvents } from '../../../../../shared/duplicate-tool-result.testfixture'
import { createClaudeBlockModel } from '../harnesses/claude/transcript/claudeBlocks'
import { buildClaudeBlocksOracle, snapshotToArray } from './blockOracle.testfixture'
import { messageOrderFor } from './transcript/messageOrder'
import { chatReducer, initialChatState, type ChatState, type Message } from '../reducer/chatReducer'
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

function assertAllDomainsEqual(state: ChatState, parents: string[]): void {
  const idx = transcriptIndexFor(state)
  const messages = state.messages
  deepStrictEqual(
    {
      board: idx.taskBoard(),
      sources: idx.taskContextSources(),
      top: idx.subagentTasks(false),
      nested: idx.subagentTasks(true),
      descriptions: parents.map((id) => idx.taskDescription(id)),
      children: parents.map((id) => idx.childMessage(id)),
      results: idx.transcriptResults(),
      models: idx.backgroundModels(),
      panel: idx.openCodePanelModel()
    },
    {
      board: taskBoardFromMessages(messages),
      sources: createTaskContextSourceSelector()(messages),
      top: subagentTasksFromMessages(messages, false),
      nested: subagentTasksFromMessages(messages, true),
      descriptions: parents.map((id) => subagentTaskDescription(messages, id)),
      children: parents.map((id) => childMessageForParentToolRunId(messages, id)),
      results: transcriptResultsByToolUseId(messages),
      models: persistedBackgroundModels(messages),
      panel: sessionPanelModel(messages)
    }
  )
}

function* randomPanelStates(seed: number): Generator<{ state: ChatState; parents: string[] }> {
  const rand = mulberry32(seed)
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

  for (let step = 0; step < 40; step++) {
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
      const childTools = ['Agent', 'Bash', 'Read']
      const childTool = childTools[Math.floor(rand() * childTools.length)]
      pushAssistant([
        {
          type: 'tool_call',
          toolRunId: childRun,
          toolName: childTool,
          args: {
            file_path: `/work/child-${step}.ts`,
            description: `child ${step}`,
            command: `echo ${step}`
          },
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

    yield { state, parents: parentIds }
  }
}

describe('transcriptIndex (EP-13 x1~x14)', () => {
  it.each(Array.from({ length: 10 }, (_, batch) => batch))(
    'x1~x9 and x13: batch %i of 500 interleaved session histories, 40 changes each',
    (batch) => {
      const schedule = mulberry32(32613 + batch)
      for (let pair = batch * 25; pair < (batch + 1) * 25; pair++) {
        const sessions = [randomPanelStates(pair * 2 + 1), randomPanelStates(pair * 2 + 2)]
        const deferredLineages = [{}, {}]
        for (let step = 0; step < 40; step++) {
          for (const [session, sequence] of sessions.entries()) {
            const change = sequence.next()
            if (change.done) throw new Error('incomplete panel history')
            const { state, parents } = change.value
            assertAllDomainsEqual(state, parents)
            if (step === 0 || step === 39 || schedule() < 0.25) {
              // A panel that missed mutations consumes the same log from its own cursor.
              assertAllDomainsEqual(
                {
                  ...state,
                  transcriptChanges: {
                    ...state.transcriptChanges,
                    lineage: deferredLineages[session]
                  }
                },
                parents
              )
            }
          }
        }
      }
    }
  )

  it('AC30: only the process with a changed Bash call gets a new row', () => {
    const message: Message = {
      id: 'a',
      role: 'assistant',
      createdAt: 1,
      parts: ['one', 'two'].map((toolRunId) => ({
        type: 'tool_call',
        toolName: 'Bash',
        toolRunId,
        args: { command: 'echo ' + toolRunId }
      }))
    }
    const state = makeState([message])
    const before = transcriptIndexFor(state).openCodePanelModel().processes
    const edited: Message = {
      ...message,
      parts: [
        ...message.parts,
        {
          type: 'tool_result',
          toolRunId: 'two',
          result: 'second changed',
          isError: false
        }
      ]
    }
    const next = makeState([edited], state, { kind: 'replace', id: 'a', partsFrom: 2 })
    const after = transcriptIndexFor(next).openCodePanelModel().processes
    expect(after.map((p) => [p.id, p.output])).toEqual([
      ['one', ''],
      ['two', 'second changed']
    ])
    expect(after[0]).toBe(before[0])
    expect(after[1]).not.toBe(before[1])
    expect(before[1].output).toBe('')
  })

  it('x9: nested shell calls are projected as processes and keep their ownership in the transcript', () => {
    const message: Message = {
      id: 'nested-shell',
      role: 'assistant',
      createdAt: 1,
      parts: [
        {
          type: 'tool_call',
          toolName: 'Bash',
          toolRunId: 'cmd',
          parentToolRunId: 'parent-A',
          args: { command: 'echo ok' }
        },
        {
          type: 'tool_result',
          toolRunId: 'cmd',
          parentToolRunId: 'parent-A',
          result: 'ok',
          isError: false
        }
      ]
    }
    const state = makeState([message])
    const index = transcriptIndexFor(state)
    const view = index.openCodePanelModel()
    expect(view).toEqual(sessionPanelModel(state.messages))
    expect(index.transcriptResults().get('cmd')?.parentToolRunId).toBe('parent-A')
    const revision = index.domainRevision.openCodeProcesses
    const moved = {
      ...message,
      parts: message.parts.map((part) => ({ ...part, parentToolRunId: 'parent-B' }))
    }
    transcriptIndexFor(makeState([moved], state, { kind: 'replace', id: message.id, partsFrom: 0 }))
    expect(index.openCodePanelModel()).toBe(view)
    expect(index.domainRevision.openCodeProcesses).toBe(revision)
    expect(index.transcriptResults().get('cmd')?.parentToolRunId).toBe('parent-B')
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

  it('x10: compares nine panel views across text, child, result and attachment updates', () => {
    const base: Message = {
      id: 'a',
      role: 'assistant',
      createdAt: 1,
      parts: [
        {
          type: 'tool_call',
          toolRunId: 'agent',
          toolName: 'Agent',
          args: { description: 'worker' }
        },
        {
          type: 'tool_call',
          toolRunId: 'nested-agent',
          parentToolRunId: 'agent',
          toolName: 'Agent',
          args: { description: 'nested' }
        },
        {
          type: 'tool_call',
          toolRunId: 'task',
          toolName: 'TaskCreate',
          args: { subject: 'board' }
        },
        {
          type: 'tool_result',
          toolRunId: 'task',
          result: 'ok',
          isError: false,
          structuredOutput: { task: { id: '1', subject: 'board' } }
        }
      ]
    }
    const actions: Array<{
      role: Message['role']
      part: AppMessagePart
      changed: readonly string[]
    }> = [
      { role: 'assistant', part: { type: 'text', text: 'main' }, changed: [] },
      {
        role: 'assistant',
        part: { type: 'text', text: 'child', parentToolRunId: 'agent' },
        changed: ['child']
      },
      {
        role: 'assistant',
        part: {
          type: 'tool_result',
          toolRunId: 'agent',
          result: 'done',
          isError: false,
          subagentMeta: { model: 'm' }
        },
        changed: ['top', 'nested', 'results', 'models', 'panel']
      },
      {
        role: 'user',
        part: {
          type: 'attachment',
          attachments: [{ id: 'doc', name: 'doc', kind: 'file', mimeType: 'text/plain' }]
        },
        changed: ['sources']
      }
    ]
    const views = (idx: ReturnType<typeof transcriptIndexFor>): Record<string, unknown> => ({
      board: idx.taskBoard(),
      sources: idx.taskContextSources(),
      top: idx.subagentTasks(),
      nested: idx.subagentTasks(true),
      description: idx.taskDescription('agent'),
      child: idx.childMessage('agent'),
      results: idx.transcriptResults(),
      models: idx.backgroundModels(),
      panel: idx.openCodePanelModel()
    })
    for (const { role, part, changed } of actions) {
      const before = makeState([base])
      const index = transcriptIndexFor(before)
      const prior = views(index)
      const revisions = { ...index.domainRevision }
      const parentRevision = index.parentRevision.get('agent')!
      const message: Message = { id: 'next', createdAt: 2, role, parts: [part] }
      const after = makeState([base, message], before, { kind: 'append', ids: [message.id] })
      transcriptIndexFor(after)
      assertAllDomainsEqual(after, ['agent'])
      const next = views(index)
      for (const key of Object.keys(prior)) {
        expect(Object.is(prior[key], next[key]), key).toBe(!changed.includes(key))
      }
      expect(index.domainRevision).toEqual({
        taskBoard: revisions.taskBoard,
        taskContextSources: revisions.taskContextSources + Number(changed.includes('sources')),
        subagentTasks: revisions.subagentTasks + Number(changed.includes('top')),
        subagentTasksNested: revisions.subagentTasksNested + Number(changed.includes('nested')),
        transcriptResults: revisions.transcriptResults + Number(changed.includes('results')),
        persistedBackgroundModels:
          revisions.persistedBackgroundModels + Number(changed.includes('models')),
        openCodeProcesses: revisions.openCodeProcesses
      })
      expect(index.parentRevision.get('agent')).toBe(
        parentRevision + Number(changed.includes('child'))
      )
    }
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
    const agentA = idx.subagentTasks().find((agent) => agent.toolUseId === 'pA')
    expect(agentA).toBeDefined()
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
    const message = state.messages.at(-1)!
    const updated: Message = {
      ...message,
      parts: [
        ...message.parts,
        {
          type: 'tool_call',
          toolRunId: 'nested-b',
          toolName: 'Read',
          args: {},
          parentToolRunId: 'pB'
        }
      ]
    }
    state = makeState([state.messages[0], updated], state, {
      kind: 'replace',
      id: message.id,
      partsFrom: 1
    })
    transcriptIndexFor(state)
    expect(idx.subagentTasks().find((agent) => agent.toolUseId === 'pB')?.childToolCount).toBe(1)
    expect(idx.subagentTasks().find((agent) => agent.toolUseId === 'pA')).toBe(agentA)
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

  it('x13: order, block and panel consumers catch up from different revisions', () => {
    const prompt: Message = {
      id: 'u',
      role: 'user',
      createdAt: 0,
      parts: [{ type: 'text', text: 'prompt' }]
    }
    const assistant: Message = {
      id: 'a',
      role: 'assistant',
      createdAt: 1,
      parts: [
        {
          type: 'tool_call',
          toolRunId: 'old',
          toolName: 'Agent',
          args: { description: 'withdrawn' }
        }
      ]
    }
    const temporary: Message = {
      id: 'temp',
      role: 'assistant',
      createdAt: 2,
      parts: [{ type: 'text', text: 'temporary' }]
    }
    let state = makeState([prompt, assistant])
    const config = { mode: 'code' as const, sessionKey: 'multi' }
    const blocks = createClaudeBlockModel(config)
    const panel = transcriptIndexFor(state)
    expect(panel.taskDescription('old')).toBe('withdrawn')
    state = makeState([prompt, assistant, temporary], state, { kind: 'append', ids: ['temp'] })
    blocks.advance(state)
    const withChild: Message = {
      ...assistant,
      parts: [...assistant.parts, { type: 'text', text: 'withdrawn', parentToolRunId: 'old' }]
    }
    state = makeState([prompt, withChild, temporary], state, {
      kind: 'replace',
      id: 'a',
      partsFrom: 1
    })
    const order = messageOrderFor(state, true)
    expect(order.toolCallOwner('old')).toBe('a')
    state = makeState([prompt], state, { kind: 'remove', ids: ['a', 'temp'] })
    const restored: Message = {
      ...assistant,
      parts: [
        {
          type: 'tool_call',
          toolRunId: 'new',
          toolName: 'Agent',
          args: { description: 'restored' }
        },
        { type: 'text', text: 'restored', parentToolRunId: 'new' }
      ]
    }
    state = makeState([prompt, restored], state, { kind: 'append', ids: ['a'] })
    const finalOrder = messageOrderFor(state, true)
    expect(finalOrder.toolCallOwner('old')).toBeUndefined()
    expect(finalOrder.toolCallOwner('new')).toBe('a')
    expect(state.messages.map((m) => finalOrder.messagePosition(m.id))).toEqual([0, 1])
    expect(snapshotToArray(blocks.advance(state))).toEqual(
      buildClaudeBlocksOracle(state.messages, config)
    )
    assertAllDomainsEqual(state, ['old', 'new'])
    expect(panel.childMessage('old')).toBeNull()
  })

  it('x14: live blocks and the panel pair the same result as the persisted history', () => {
    let state: ChatState = { ...makeState([]), sessionId: 's1' }
    for (const event of duplicateToolResultEvents())
      state = chatReducer(state, { type: 'RECV_EVENT', event })
    const blocks = createClaudeBlockModel({ mode: 'code', sessionKey: 's1' }).advance(state)
    const calls = snapshotToArray(blocks).flatMap((block) =>
      block.kind === 'segment' && block.segment.kind === 'tools' ? block.segment.calls : []
    )
    expect(calls.map((call) => [call.toolUseId, call.result?.output])).toEqual([
      ['dup', 'paired output']
    ])
    expect(
      transcriptIndexFor(state)
        .subagentTasks()
        .map((task) => [task.toolUseId, task.call.result?.output])
    ).toEqual([['dup', 'paired output']])
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

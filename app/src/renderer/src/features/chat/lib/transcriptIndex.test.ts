import { deepStrictEqual } from 'node:assert'
import { describe, expect, it, vi } from 'vitest'
import {
  emptyBackgroundState,
  type BackgroundCallRecord
} from '../../../../../shared/background-task'
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

  it('x3–x8: top-level and nested agents retain distinct descriptions, children, results and models', () => {
    const parts: AppMessagePart[] = [
      { type: 'tool_call', toolName: 'Agent', toolRunId: 'A', args: { description: 'outer A' } },
      { type: 'tool_call', toolName: 'Agent', toolRunId: 'B', args: {} },
      {
        type: 'tool_call',
        toolName: 'Agent',
        toolRunId: 'N',
        parentToolRunId: 'A',
        args: { description: 'nested N' }
      },
      { type: 'tool_call', toolName: 'Read', toolRunId: 'leaf', parentToolRunId: 'B', args: {} },
      {
        type: 'tool_result',
        toolRunId: 'A',
        result: 'A answer',
        isError: false,
        subagentMeta: { model: 'model-A', toolUses: 7, durationMs: 11 }
      },
      {
        type: 'tool_result',
        toolRunId: 'N',
        parentToolRunId: 'A',
        result: 'N answer',
        isError: false,
        subagentMeta: { model: 'model-N' }
      }
    ]
    const before = makeState([{ id: 'both', role: 'assistant', createdAt: 1, parts }])
    const index = transcriptIndexFor(before)
    expect(
      index.subagentTasks().map((row) => [row.toolUseId, row.childToolCount, row.currentChildLabel])
    ).toEqual([
      ['A', 7, null],
      ['B', 1, 'Read']
    ])
    expect(index.subagentTasks(true).map((row) => row.toolUseId)).toEqual(['A', 'B', 'N'])
    expect(['A', 'B', 'N', 'missing'].map((k) => index.taskDescription(k))).toEqual([
      'outer A',
      'Agent',
      undefined,
      undefined
    ])
    expect(index.childMessage('B')?.parts).toEqual([
      { type: 'tool_call', toolName: 'Read', toolRunId: 'leaf', args: {} }
    ])
    const previousResults = index.transcriptResults()
    const previousModels = index.backgroundModels()
    expect([...previousResults].map(([key, result]) => [key, result.output])).toEqual([
      ['A', 'A answer'],
      ['N', 'N answer']
    ])
    expect([...previousModels]).toEqual([
      ['A', 'model-A'],
      ['N', 'model-N']
    ])
    const next = makeState([{ ...before.messages[0], parts: parts.slice(0, -1) }], before, {
      kind: 'replace',
      id: 'both',
      partsFrom: 5
    })
    transcriptIndexFor(next)
    expect([...index.transcriptResults().keys()]).toEqual(['A'])
    expect([...index.backgroundModels()]).toEqual([['A', 'model-A']])
    expect(previousResults.get('N')?.output).toBe('N answer')
    expect(previousModels.get('N')).toBe('model-N')
  })

  it('x1/x2: a task-list snapshot replaces absent siblings; only completed top-level sources contribute', () => {
    const parts: AppMessagePart[] = []
    function add(
      toolName: string,
      args: Record<string, unknown>,
      result?: unknown,
      parentToolRunId?: string
    ): void {
      const toolRunId = 'call-' + parts.length
      parts.push({ type: 'tool_call', toolName, toolRunId, args, parentToolRunId })
      if (result !== undefined)
        parts.push({
          type: 'tool_result',
          toolRunId,
          result,
          structuredOutput: result,
          isError: false,
          parentToolRunId
        })
    }
    add('TaskCreate', { subject: 'remove' }, { task: { id: '9', subject: 'remove' } })
    add('TaskCreate', { subject: 'keep' }, { task: { id: '2', subject: 'keep' } })
    add('WebFetch', { url: 'https://example.org/' }, 'home')
    add('WebFetch', { url: 'https://example.org/path' }, 'path')
    add('WebFetch', { url: 'https://example.org/child' }, 'child', 'nested')
    add('Read', { file_path: '/tmp/source.txt' }, 'source')
    add('Read', { file_path: '/tmp/pending.txt' })
    const message: Message = { id: 'a', createdAt: 1, role: 'assistant', parts: parts.slice() }
    const before = makeState([message])
    const original = transcriptIndexFor(before)
    const board = original.taskBoard()
    const sources = original.taskContextSources()
    expect(board.map((row) => row.id)).toEqual(['9', '2'])
    expect(sources).toEqual([
      { kind: 'web', url: 'https://example.org/', title: 'example.org' },
      { kind: 'web', url: 'https://example.org/path', title: 'example.org/path' },
      { kind: 'file', path: '/tmp/source.txt' }
    ])
    add(
      'TaskList',
      {},
      {
        tasks: [
          { id: '2', subject: 'replaced', status: 'completed', blockedBy: [] },
          { id: '3', subject: 'added', status: 'in_progress', blockedBy: ['2'] }
        ]
      }
    )
    const next = makeState([{ ...message, parts }], before, {
      kind: 'replace',
      id: 'a',
      partsFrom: message.parts.length
    })
    const updated = transcriptIndexFor(next)
    expect(
      updated.taskBoard().map((row) => [row.id, row.subject, row.status, row.blockedBy])
    ).toEqual([
      ['2', 'replaced', 'completed', []],
      ['3', 'added', 'in_progress', ['2']]
    ])
    expect(updated.taskContextSources()).toBe(sources)
    expect(board.map((row) => row.id)).toEqual(['9', '2'])
  })

  it('x9: each process uses its newest background observation until its transcript result arrives', () => {
    const message: Message = {
      id: 'a',
      role: 'assistant',
      createdAt: 0,
      parts: [
        { type: 'tool_call', toolName: 'Bash', toolRunId: 'first', args: { command: 'first' } },
        { type: 'tool_call', toolName: 'Bash', toolRunId: 'second', args: { command: 'second' } },
        { type: 'tool_result', toolRunId: 'second', result: '', isError: false },
        { type: 'tool_call', toolName: 'Bash', toolRunId: 'third', args: { command: 'third' } }
      ]
    }
    const record = (
      toolUseId: string,
      lastSeenAt: number,
      result: string
    ): BackgroundCallRecord => ({
      toolUseId,
      result,
      lastSeenAt,
      firstSeenAt: 0,
      generation: 'g',
      phase: 'returned',
      awaitingTask: false,
      meta: { truncated: true }
    })
    const bg = {
      ...emptyBackgroundState(),
      calls: {
        fresh: record('first', 20, 'latest'),
        stale: record('first', 3, 'old'),
        sibling: record('second', 30, 'overridden'),
        other: record('third', 5, 'independent')
      }
    }
    const index = transcriptIndexFor(makeState([message]))
    const panel = index.openCodePanelModel(bg)
    expect(panel.processes.map((p) => [p.id, p.output, p.truncated])).toEqual([
      ['first', 'latest', true],
      ['second', '', false],
      ['third', 'independent', true]
    ])
    expect(index.openCodePanelModel(bg)).toBe(panel)
    const refreshed = index.openCodePanelModel({
      ...bg,
      calls: { ...bg.calls, newest: record('first', 31, 'updated') }
    })
    expect(refreshed.processes[0].output).toBe('updated')
    expect(refreshed.processes[1]).toBe(panel.processes[1])
    expect(panel.processes[0].output).toBe('latest')
  })

  it('x1: sparse patches retain text and deduplicate reverse dependencies on existing siblings', () => {
    const parts: AppMessagePart[] = []
    function tool(toolName: string, args: unknown, structuredOutput: unknown): void {
      const toolRunId = String(parts.length)
      parts.push(
        { type: 'tool_call', toolName, toolRunId, args },
        { type: 'tool_result', toolRunId, result: '', structuredOutput, isError: false }
      )
    }
    for (const id of ['a', 'b']) tool('TaskCreate', { subject: id }, { task: { id, subject: id } })
    tool(
      'TaskUpdate',
      {
        subject: 'renamed',
        description: 'detail',
        activeForm: 'working',
        status: 'in_progress',
        addBlocks: ['a', 'b', 'missing'],
        addBlockedBy: ['early', 'before']
      },
      { success: true, taskId: 'a' }
    )
    tool(
      'TaskUpdate',
      { addBlocks: ['b'], addBlockedBy: ['before', 'second'] },
      { success: true, taskId: 'a' }
    )
    const message: Message = { id: 'm', role: 'assistant', createdAt: 1, parts: [...parts] }
    const before = makeState([message])
    const board = transcriptIndexFor(before).taskBoard()
    expect(
      board.map(({ id, title, subject, description, blockedBy }) => [
        id,
        title,
        subject,
        description,
        blockedBy
      ])
    ).toEqual([
      ['a', 'working', 'renamed', 'detail', ['early', 'before', 'second']],
      ['b', 'b', 'b', null, ['a']]
    ])
    tool('TaskUpdate', { status: 'completed' }, { success: true, taskId: 'a' })
    const after = makeState([{ ...message, parts }], before, {
      kind: 'replace',
      id: 'm',
      partsFrom: message.parts.length
    })
    const next = transcriptIndexFor(after).taskBoard()
    expect(next[0]).toMatchObject({
      title: 'renamed',
      description: 'detail',
      blockedBy: ['early', 'before', 'second']
    })
    expect(board[0].title).toBe('working')
    assertAllDomainsEqual(after, [])
  })

  it('x2: rejects invalid sources and merges fragment aliases without dropping distinct file inputs', () => {
    const parts: AppMessagePart[] = []
    function call(toolName: string, args: unknown): void {
      const toolRunId = String(parts.length)
      parts.push(
        { type: 'tool_call', toolName, toolRunId, args },
        { type: 'tool_result', toolRunId, result: 'ok', isError: false }
      )
    }
    for (const url of [
      99,
      'not a URL',
      'ftp://example.com/file',
      'https://user@example.com/p',
      'https://:pass@example.com/p',
      'http://example.com/root#a',
      'http://example.com/root#b',
      'https://example.com/root'
    ])
      call('WebFetch', { url })
    for (const args of [
      { file_path: '/', path: '/ignored' },
      { file_path: 'relative' },
      { file_path: '/first', path: '/second' },
      { path: '/second' },
      { path: 'C:/Users/Test/AppData/Local/Temp/orcinus-orca/else/../claude/internal' },
      { path: 'C:/Users/Test/AppData/Local/Temp/orcinus-orca/./claude/internal' }
    ])
      call('Read', args)
    const state = makeState([{ id: 'sources', role: 'assistant', createdAt: 1, parts }])
    expect(transcriptIndexFor(state).taskContextSources()).toEqual([
      { kind: 'web', url: 'http://example.com/root', title: 'example.com/root' },
      { kind: 'web', url: 'https://example.com/root', title: 'example.com/root' },
      { kind: 'file', path: '/first' },
      { kind: 'file', path: '/second' }
    ])
    assertAllDomainsEqual(state, [])
  })

  it('x2: prefers the first attachment over a read of the same path and keeps pathless identities separate', () => {
    const read: Message = {
      id: 'r',
      role: 'assistant',
      createdAt: 0,
      parts: [
        { type: 'tool_call', toolRunId: 'read', toolName: 'Read', args: { path: '/project/f' } },
        { type: 'tool_result', toolRunId: 'read', result: 'ok', isError: false }
      ]
    }
    const before = makeState([read])
    const files = transcriptIndexFor(before).taskContextSources()
    const user: Message = {
      id: 'u',
      role: 'user',
      createdAt: 1,
      parts: [
        {
          type: 'attachment',
          attachments: [
            { id: '1', path: '/project/f', name: 'first', kind: 'image', mimeType: 'image/png' },
            { id: '2', path: '/project/f', name: 'second', kind: 'file', mimeType: 'text/plain' },
            { id: '3', path: '/', name: 'same', kind: 'file', mimeType: 'text/plain' },
            { id: '4', name: 'same', kind: 'file', mimeType: 'text/plain' }
          ]
        }
      ]
    }
    const next = makeState([read, user], before, { kind: 'append', ids: ['u'] })
    expect(transcriptIndexFor(next).taskContextSources()).toEqual([
      { kind: 'attachment', attachmentId: '1', path: '/project/f', name: 'first', image: true },
      { kind: 'attachment', attachmentId: '3', name: 'same', image: false },
      { kind: 'attachment', attachmentId: '4', name: 'same', image: false }
    ])
    expect(files).toEqual([{ kind: 'file', path: '/project/f' }])
    assertAllDomainsEqual(next, [])
  })

  it('x9: isolates truncation metadata at the exact output limit and reuses only an unchanged process', () => {
    const parts: AppMessagePart[] = ['a', 'b'].map((toolRunId) => ({
      type: 'tool_call',
      toolName: 'Bash',
      toolRunId,
      args: { command: toolRunId }
    }))
    const state = makeState([{ id: 'processes', role: 'assistant', createdAt: 1, parts }])
    const index = transcriptIndexFor(state)
    const exact = 'x'.repeat(65535) + 'y'
    const record = (
      toolUseId: string,
      result: string,
      truncated = false
    ): BackgroundCallRecord => ({
      toolUseId,
      result,
      meta: { truncated },
      firstSeenAt: 0,
      lastSeenAt: 1,
      generation: 'g',
      phase: 'returned',
      awaitingTask: false
    })
    const bg = {
      ...emptyBackgroundState(),
      calls: { a: record('a', exact), b: record('b', 'second') }
    }
    const first = index.openCodePanelModel(bg)
    expect(first.processes.map((p) => p.truncated)).toEqual([false, false])
    const next = index.openCodePanelModel({
      ...bg,
      calls: { ...bg.calls, a: record('a', 'z' + exact) }
    })
    expect(next.processes[0]).toMatchObject({ output: exact, truncated: true })
    expect(next.processes[0]).not.toBe(first.processes[0])
    expect(next.processes[1]).toBe(first.processes[1])
    const same = index.openCodePanelModel({
      ...bg,
      calls: { ...bg.calls, a: record('a', exact, true) }
    })
    expect(same.processes[0]).toBe(next.processes[0])
    expect(first.processes[0].truncated).toBe(false)
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

  it('x10: a text-only change does not sort the contributions of unaffected messages', () => {
    const messages: Message[] = Array.from({ length: 20 }, (_, i) => ({
      id: 'm' + i,
      role: 'assistant',
      createdAt: i,
      parts: [{ type: 'text', text: 'old' }]
    }))
    const before = makeState(messages)
    transcriptIndexFor(before)
    const updated = [...messages]
    updated[10] = {
      ...messages[10],
      parts: [...messages[10].parts, { type: 'text', text: 'tail' }]
    }
    const next = makeState(updated, before, { kind: 'replace', id: 'm10', partsFrom: 1 })
    const positions = vi.spyOn(messageOrderFor(next), 'messagePosition')
    try {
      transcriptIndexFor(next)
      expect(positions.mock.calls.map(([key]) => key)).toEqual(['m10'])
    } finally {
      positions.mockRestore()
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
    expect(childA?.parts).toEqual([{ type: 'text', text: 'hello from A' }])

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
    expect(idx.childMessage('pB')?.parts).toEqual([{ type: 'text', text: 'hello from B' }])
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

  it.each(['replace', 'remove'] as const)(
    'x10/x13: %s retracts each panel contribution without invalidating sibling domains',
    (mode) => {
      const prefix: AppMessagePart = { type: 'text', text: 'untouched' }
      const cases: { name: string; part: AppMessagePart; domains: string[]; parent?: string }[] = [
        {
          name: 'child',
          part: { type: 'text', parentToolRunId: 'P', text: 'child' },
          domains: [],
          parent: 'P'
        },
        {
          name: 'attachment',
          part: {
            type: 'attachment',
            attachments: [{ id: 'file', name: 'f', mimeType: 'text/plain', kind: 'file' }]
          },
          domains: ['taskContextSources']
        },
        {
          name: 'result/model',
          part: {
            type: 'tool_result',
            toolRunId: 'shell',
            result: 'override',
            isError: false,
            subagentMeta: { model: 'M2' }
          },
          domains: ['transcriptResults', 'persistedBackgroundModels', 'openCodeProcesses']
        },
        {
          name: 'agent',
          part: {
            type: 'tool_call',
            toolRunId: 'new-parent',
            toolName: 'Agent',
            args: { description: 'new' }
          },
          domains: ['subagentTasks', 'subagentTasksNested'],
          parent: 'new-parent'
        },
        {
          name: 'shell',
          part: {
            type: 'tool_call',
            toolRunId: 'second',
            toolName: 'Bash',
            args: { command: 'other' }
          },
          domains: ['openCodeProcesses']
        }
      ]
      for (const { name, part, domains, parent } of cases) {
        const base: Message = {
          id: 'base',
          role: 'assistant',
          createdAt: 1,
          parts: [
            { type: 'tool_call', toolRunId: 'P', toolName: 'Agent', args: { description: 'keep' } },
            { type: 'tool_call', toolRunId: 'shell', toolName: 'Bash', args: { command: 'first' } },
            {
              type: 'tool_result',
              toolRunId: 'shell',
              result: 'base output',
              isError: false,
              subagentMeta: { model: 'M1' }
            }
          ]
        }
        const target: Message = {
          id: 'target',
          role: name === 'attachment' ? 'user' : 'assistant',
          createdAt: 2,
          parts: [prefix, part]
        }
        const initial = makeState([base, target])
        const index = transcriptIndexFor(initial)
        const revisions = { ...index.domainRevision }
        const beforeParent = parent ? index.parentRevision.get(parent) : undefined
        const oldView = index.openCodePanelModel()
        const oldResults = index.transcriptResults()
        const next =
          mode === 'remove'
            ? makeState([base], initial, { kind: 'remove', ids: ['target'] })
            : makeState([base, { ...target, parts: [prefix] }], initial, {
                kind: 'replace',
                id: 'target',
                partsFrom: 1
              })
        assertAllDomainsEqual(next, ['P', 'new-parent'])
        for (const domain of Object.keys(revisions) as (keyof typeof revisions)[]) {
          expect(index.domainRevision[domain], name + ' ' + domain).toBe(
            revisions[domain] + Number(domains.includes(domain))
          )
        }
        if (parent) expect(index.parentRevision.get(parent)).toBe((beforeParent ?? 0) + 1)
        expect(index.childMessage('P')).toBeNull()
        expect(index.taskDescription('new-parent')).toBeUndefined()
        expect(index.backgroundModels().get('shell')).toBe('M1')
        expect(oldResults.get('shell')?.output).toBe(
          name === 'result/model' ? 'override' : 'base output'
        )
        if (name === 'result/model') expect(oldView.processes[0].output).toBe('override')
      }
    }
  )

  it('x3/x4: withdrawing cancellation restores the running agent and preserves its sibling', () => {
    const calls: Message = {
      id: 'calls',
      createdAt: 1,
      role: 'assistant',
      parts: [
        { type: 'tool_call', toolName: 'Agent', toolRunId: 'p', args: {} },
        { type: 'tool_call', toolName: 'Agent', toolRunId: 'q', args: {} }
      ]
    }
    const first = makeState([calls])
    const index = transcriptIndexFor(first)
    const sibling = index.subagentTasks()[1]
    const cancelled: Message = {
      id: 'cancel',
      role: 'assistant',
      createdAt: 2,
      parts: [
        {
          type: 'tool_result',
          toolRunId: 'p',
          isError: true,
          result: { reason: 'cancelled', message: 'stopped' }
        }
      ]
    }
    const stopped = makeState([calls, cancelled], first, { kind: 'append', ids: ['cancel'] })
    transcriptIndexFor(stopped)
    const stoppedSummary = index.subagentTasks()[0]
    for (const nested of [false, true])
      expect(index.subagentTasks(nested).map((a) => a.status)).toEqual(['aborted', 'running'])
    const resumed = makeState([calls], stopped, { kind: 'remove', ids: ['cancel'] })
    transcriptIndexFor(resumed)
    for (const nested of [false, true])
      expect(index.subagentTasks(nested).map((a) => a.status)).toEqual(['running', 'running'])
    expect(stoppedSummary.status).toBe('aborted')
    expect(index.subagentTasks()[1]).toBe(sibling)
  })

  it('x2: withdrawing search results reveals the distinct surviving source', () => {
    const calls: Message = {
      id: 'calls',
      createdAt: 1,
      role: 'assistant',
      parts: [
        {
          type: 'tool_call',
          toolName: 'WebSearch',
          toolRunId: 'search',
          args: { query: 'https://query.invalid' }
        },
        {
          type: 'tool_call',
          toolName: 'WebFetch',
          toolRunId: 'fetch',
          args: { url: 'https://docs.example/guide' }
        }
      ]
    }
    const results: Message = {
      id: 'results',
      createdAt: 2,
      role: 'assistant',
      parts: [
        { type: 'tool_result', toolRunId: 'fetch', isError: false, result: 'data' },
        {
          type: 'tool_result',
          toolRunId: 'search',
          isError: false,
          result:
            'Links: [{"title":"Search title","url":"https://docs.example/guide"},{"title":"Search only","url":"https://other.example/"}]'
        }
      ]
    }
    const first = makeState([calls, results])
    const index = transcriptIndexFor(first)
    const previous = index.taskContextSources()
    expect(previous.map((source) => source.kind === 'web' && source.title)).toEqual([
      'Search title',
      'Search only'
    ])
    const next = makeState([calls, { ...results, parts: results.parts.slice(0, 1) }], first, {
      kind: 'replace',
      id: 'results',
      partsFrom: 1
    })
    transcriptIndexFor(next)
    expect(index.taskContextSources()).toEqual([
      { kind: 'web', url: 'https://docs.example/guide', title: 'docs.example/guide' }
    ])
    expect(previous).toHaveLength(2)
  })

  it('x1: withdrawing a task deletion restores only the deleted task', () => {
    const parts: AppMessagePart[] = []
    for (const id of ['one', 'two'])
      parts.push(
        { type: 'tool_call', toolRunId: id, toolName: 'TaskCreate', args: { subject: id } },
        {
          type: 'tool_result',
          toolRunId: id,
          result: 'created',
          structuredOutput: { task: { id, subject: id } },
          isError: false
        }
      )
    const first: Message = { id: 'tasks', createdAt: 1, role: 'assistant', parts }
    const initial = makeState([first])
    const index = transcriptIndexFor(initial)
    const old = index.taskBoard()
    const deletion: Message = {
      id: 'delete',
      createdAt: 2,
      role: 'assistant',
      parts: [
        {
          type: 'tool_call',
          toolRunId: 'delete',
          toolName: 'TaskUpdate',
          args: { taskId: 'one', status: 'deleted' }
        },
        {
          type: 'tool_result',
          toolRunId: 'delete',
          result: 'deleted',
          structuredOutput: { success: true, taskId: 'one', updatedFields: ['status'] },
          isError: false
        }
      ]
    }
    const deleted = makeState([first, deletion], initial, { kind: 'append', ids: ['delete'] })
    transcriptIndexFor(deleted)
    const during = index.taskBoard()
    expect(during.map((task) => task.id)).toEqual(['two'])
    const restored = makeState([first], deleted, { kind: 'remove', ids: ['delete'] })
    transcriptIndexFor(restored)
    expect(index.taskBoard()).toEqual(old)
    expect(during.map((task) => task.id)).toEqual(['two'])
  })

  it.each(['reset event', 'reloaded array at same revision'] as const)(
    'x12/x13: %s retires old parent and model caches',
    (mode) => {
      const old: Message = {
        id: 'previous',
        role: 'assistant',
        createdAt: 1,
        parts: [
          {
            type: 'tool_call',
            toolName: 'Agent',
            toolRunId: 'retired',
            args: { description: 'old parent' }
          },
          { type: 'text', parentToolRunId: 'retired', text: 'old child' },
          {
            type: 'tool_result',
            toolRunId: 'retired',
            isError: false,
            result: 'done',
            subagentMeta: { model: 'old-model' }
          }
        ]
      }
      const base = makeState([old])
      const index = transcriptIndexFor(base)
      const child = index.childMessage('retired')
      const models = index.backgroundModels()
      const revision = index.parentRevision.get('retired')!
      const message: Message = {
        id: 'fresh',
        role: 'assistant',
        createdAt: 2,
        parts: [{ type: 'text', text: 'independent' }]
      }
      const next = makeState(
        [message],
        base,
        mode === 'reset event' ? { kind: 'reset', complete: true } : undefined
      )
      assertAllDomainsEqual(next, ['retired'])
      expect(index.parentRevision.get('retired')).toBe(revision + 1)
      expect(index.childMessage('retired')).toBeNull()
      expect(index.taskDescription('retired')).toBeUndefined()
      expect(index.backgroundModels().size).toBe(0)
      expect(child?.parts).toEqual([{ type: 'text', text: 'old child' }])
      expect(models.get('retired')).toBe('old-model')
    }
  )

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

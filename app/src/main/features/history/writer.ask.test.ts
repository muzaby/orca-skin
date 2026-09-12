import { describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'

const sendChatEvent = vi.hoisted(() => vi.fn())
vi.mock('../../infra/ipc/send', () => ({ sendChatEvent }))

import type { TurnContext } from '../../contracts/turn'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { HistoryWriter } from './writer'
import { loadSession } from './reader'

describe('HistoryWriter AskUserQuestion answer identity', () => {
  it('matches reverse-order answers by toolUseId and keeps each parent tool id', () => {
    const upsertToolResultPart = vi.fn()
    const writer = new HistoryWriter({ upsertToolResultPart } as never, () => false)
    const turn = {
      dbSessionId: 's1',
      currentAssistantMessageId: 10,
      pendingAskAnswers: [
        { toolUseId: 'ask-2', answers: { Second: 'B' } },
        { toolUseId: 'ask-1', answers: { First: 'A' } }
      ],
      askPendingIds: ['ask-1', 'ask-2'],
      askResolved: new Map(),
      openToolRuns: new Map([
        ['ask-1', { parentToolRunId: 'parent-1' }],
        ['ask-2', { parentToolRunId: 'parent-2' }]
      ])
    } as unknown as TurnContext

    writer.flushAskAnswers(turn, {} as never)

    expect(sendChatEvent.mock.calls.map(([, event]) => event)).toEqual([
      expect.objectContaining({
        toolRunId: 'ask-2',
        parentToolRunId: 'parent-2',
        result: { answers: { Second: 'B' } }
      }),
      expect.objectContaining({
        toolRunId: 'ask-1',
        parentToolRunId: 'parent-1',
        result: { answers: { First: 'A' } }
      })
    ])
    expect(turn.askPendingIds).toEqual([])
    expect(turn.pendingAskAnswers).toEqual([])
  })

  it('round trips a child answer parent through SQLite reload', () => {
    const connection = new Database(':memory:')
    try {
      applyMigrations(connection)
      const queries = new DbQueries(connection)
      queries.insertSession({
        id: 's1',
        backend: 'claude',
        title: null,
        projectId: null,
        createdAt: 1,
        agentKind: 'code'
      })
      const messageId = queries.appendMessage({
        sessionId: 's1',
        role: 'assistant',
        content: '',
        createdAt: 2
      })
      const writer = new HistoryWriter(queries, () => false)
      const turn = {
        dbSessionId: 's1',
        currentAssistantMessageId: messageId,
        pendingAskAnswers: [{ toolUseId: 'ask-1', answers: { Question: 'Answer' } }],
        askPendingIds: ['ask-1'],
        askResolved: new Map(),
        openToolRuns: new Map([['ask-1', { parentToolRunId: 'parent-1' }]])
      } as unknown as TurnContext

      writer.flushAskAnswers(turn, {} as never)

      const loaded = loadSession(queries, 's1', () => '/workspace')
      expect(loaded?.messages[0].parts).toContainEqual({
        type: 'tool_result',
        toolRunId: 'ask-1',
        parentToolRunId: 'parent-1',
        result: { answers: { Question: 'Answer' } },
        isError: false
      })
    } finally {
      connection.close()
    }
  })
})

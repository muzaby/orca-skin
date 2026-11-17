import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'

import type { TurnContext } from '../../contracts/turn'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { HistoryWriter } from './writer'
import { loadSession } from './reader'

describe('HistoryWriter AskUserQuestion answer identity', () => {
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
        currentAssistantMessageId: messageId
      } as unknown as TurnContext

      // 실행 쪽이 답과 부모 도구를 짝지어 보낸 결과(0324 EP-15)를 그대로 쓴다.
      writer.recordAskAnswers(turn, [
        {
          toolUseId: 'ask-1',
          output: { answers: { Question: 'Answer' } },
          parentToolRunId: 'parent-1'
        }
      ])

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

it('writes nothing while no assistant message is open', () => {
  const upsertToolResultPart = (): never => {
    throw new Error('must not write')
  }
  const writer = new HistoryWriter({ upsertToolResultPart } as never, () => false)
  writer.recordAskAnswers({ currentAssistantMessageId: null } as unknown as TurnContext, [
    { toolUseId: 'ask-1', output: {} }
  ])
})

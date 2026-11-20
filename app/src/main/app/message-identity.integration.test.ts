/**
 * VP-02 · ST-01 · AC1 (main side) — End-to-end message identity across
 * real bus order (sender.onTurnEvent → sender.relay) → peer loopback → receiver → writer → reader.
 */
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../shared/ipc'
import {
  ST01_ARTIFACT_RECEIPT,
  ST01_EXPECTED_RELOAD_MESSAGES,
  ST01_SESSION_ID,
  ST01_USER_INITIAL_ID,
  ST01_USER_STEER_ID,
  ST01_WINDOW_EVENTS,
  summarizeMessage
} from '../../shared/message-identity.testfixture'
import type { ClientRef } from '../contracts/client'
import type { TurnContext } from '../contracts/turn'
import { applyMigrations } from '../infra/db/migrate'
import { DbQueries } from '../infra/db/queries'
import { loadSession } from '../features/history/reader'
import { createPersistenceStream } from './data-host/persistence-stream.testfixture'

describe('VP-02 ST-01 message-identity integration (main)', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()?.()
  })

  it('라이브 번호 열과 재로드 목록이 고정 입력의 기대와 같다', async () => {
    const sqlite = new Database(':memory:')
    cleanups.push(() => sqlite.close())
    applyMigrations(sqlite)
    const db = new DbQueries(sqlite)
    db.insertSession({
      id: ST01_SESSION_ID,
      backend: 'claude',
      title: 'st01',
      projectId: null,
      createdAt: 1,
      agentKind: 'code'
    })
    const owner: ClientRef = { id: 1, send: () => undefined } as unknown as ClientRef
    const turn: TurnContext<ClientRef> = {
      sessionKey: ST01_SESSION_ID,
      dbSessionId: ST01_SESSION_ID,
      owner,
      agentKind: 'code',
      titleAdapter: { id: 'claude' },
      currentAssistantMessageId: null,
      currentAssistantText: '',
      askResolved: new Map(),
      askPendingIds: [],
      pendingAskAnswers: [],
      openToolRuns: new Map()
    } as unknown as TurnContext<ClientRef>

    const windowEvents: NormalizedEvent[] = []
    const failures: string[] = []
    const stream = createPersistenceStream({
      db,
      send: (_owner, ev) => {
        windowEvents.push(structuredClone(ev))
      },
      failTurn: (_turn, message) => {
        failures.push(message)
      }
    })
    cleanups.push(() => stream.close())

    const emitBus = (ev: NormalizedEvent): void => {
      // Real bus subscription order: persistence sender stamps first, then relays to window.
      stream.sender.onTurnEvent(turn, ev)
      stream.sender.relay(turn, ev)
    }

    // 1. Initial user prompt commit + relayed committed notification
    const initialRowId = await stream.sender.commitUserMessage!(turn, {
      text: 'initial prompt',
      createdAt: 1,
      messageKey: ST01_USER_INITIAL_ID
    })
    stream.sender.relay(turn, {
      type: 'message.committed',
      sessionId: ST01_SESSION_ID,
      ids: ['req-1'],
      text: 'initial prompt',
      messageId: initialRowId ?? 1,
      createdAt: 1,
      messageKey: ST01_USER_INITIAL_ID
    })

    // 2. Assistant A: reasoning, text, tool X start, tool Y start + result
    emitBus({
      type: 'message.reasoning',
      sessionId: ST01_SESSION_ID,
      text: 'thinking A'
    })
    emitBus({
      type: 'message.completed',
      sessionId: ST01_SESSION_ID,
      message: { text: 'assistant A text' }
    })
    emitBus({
      type: 'tool.call.started',
      sessionId: ST01_SESSION_ID,
      toolRunId: 'tool-x',
      toolName: 'Bash',
      args: { command: 'echo x' }
    })
    emitBus({
      type: 'tool.call.started',
      sessionId: ST01_SESSION_ID,
      toolRunId: 'tool-y',
      toolName: 'Write',
      args: { file_path: 'out.txt' }
    })
    emitBus({
      type: 'tool.call.completed',
      sessionId: ST01_SESSION_ID,
      toolRunId: 'tool-y',
      result: ST01_ARTIFACT_RECEIPT,
      isError: false
    })

    // 3. Question tool Q start + Q answer via flushAskAnswers
    emitBus({
      type: 'tool.call.started',
      sessionId: ST01_SESSION_ID,
      toolRunId: 'tool-q',
      toolName: 'AskUserQuestion',
      args: { questions: [] }
    })
    turn.askPendingIds.push('tool-q')
    turn.pendingAskAnswers.push({
      toolUseId: 'tool-q',
      answers: { q1: 'yes' }
    })
    stream.sender.flushAskAnswers!(turn, turn.owner)

    expect(
      windowEvents.some((e) => e.type === 'tool.call.completed' && e.toolRunId === 'tool-q')
    ).toBe(false)

    // 4. Mid-turn steer commit + relayed message.committed (D-098)
    const steerRowId = await stream.sender.commitUserMessage!(turn, {
      text: 'mid steer prompt',
      createdAt: 2,
      messageKey: ST01_USER_STEER_ID
    })
    stream.sender.relay(turn, {
      type: 'message.committed',
      sessionId: ST01_SESSION_ID,
      ids: ['steer-1'],
      text: 'mid steer prompt',
      messageId: steerRowId ?? 3,
      createdAt: 2,
      messageKey: ST01_USER_STEER_ID
    })

    // 5. Assistant B text + late X result (origin-delayed -> must attach to A!)
    emitBus({
      type: 'message.completed',
      sessionId: ST01_SESSION_ID,
      message: { text: 'assistant B text' }
    })
    emitBus({
      type: 'tool.call.completed',
      sessionId: ST01_SESSION_ID,
      toolRunId: 'tool-x',
      result: 'late X result',
      isError: false
    })

    // 6. Telemetry clears current assistant key
    emitBus({
      type: 'telemetry',
      sessionId: ST01_SESSION_ID,
      usage: { inputTokens: 10, outputTokens: 5 }
    } as NormalizedEvent)

    // 7. Continuation C text + late subagent notice + steer recommit (D-097) + error (B7)
    emitBus({
      type: 'message.completed',
      sessionId: ST01_SESSION_ID,
      message: { text: 'continuation C text' }
    })
    emitBus({
      type: 'subagent.task',
      sessionId: ST01_SESSION_ID,
      toolUseId: 'sub-1',
      phase: 'settled',
      background: true,
      status: 'completed',
      summary: 'done'
    } as NormalizedEvent)
    const recommitRowId = await stream.sender.commitUserMessage!(turn, {
      text: 'mid steer prompt',
      createdAt: 2,
      messageKey: ST01_USER_STEER_ID
    })
    expect(recommitRowId).toBe(steerRowId)
    stream.sender.relay(turn, {
      type: 'message.committed',
      sessionId: ST01_SESSION_ID,
      ids: ['steer-1'],
      text: 'mid steer prompt',
      messageId: recommitRowId ?? 3,
      createdAt: 2,
      messageKey: ST01_USER_STEER_ID
    })
    emitBus({
      type: 'error',
      sessionId: ST01_SESSION_ID,
      error: {
        category: 'stream_error',
        message: 'turn error after recommit',
        retryable: false
      }
    })

    stream.sender.finalizeTurn!(turn)
    await stream.settle()
    await stream.settle()
    expect(failures).toEqual([])

    expect(windowEvents).toEqual(ST01_WINDOW_EVENTS)

    // Reload from SQLite DB via reader and compare against shared expected literal
    const loaded = loadSession(db, ST01_SESSION_ID, () => '/tmp')
    expect(loaded).not.toBeNull()
    const reloadedSummary = loaded!.messages.map((m) =>
      summarizeMessage({ id: m.id, role: m.role, parts: m.parts })
    )
    expect(reloadedSummary).toEqual(ST01_EXPECTED_RELOAD_MESSAGES)
  })
})

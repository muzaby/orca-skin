/**
 * VP-02 · ST-01 · AC1 (main side) — End-to-end message identity across
 * real bus order (sender.onTurnEvent → sender.relay) → peer loopback → receiver → writer → reader.
 */
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import type { NormalizedEvent } from '../../shared/ipc'
import {
  ST01_ARTIFACT_RECEIPT,
  ST01_CONFIRMED_FAILURE,
  ST01_EXPECTED_MESSAGES,
  ST01_SESSION_ID,
  ST01_USER_INITIAL_ID,
  ST01_USER_STEER_ID,
  ST01_WINDOW_EVENTS,
  summarizeMessage
} from '../../shared/message-identity.testfixture'
import type { OoBusEvents } from '../contracts/bus-events'
import { TypedBus } from '../infra/bus'
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

    const bus = new TypedBus<OoBusEvents<ClientRef>>()
    bus.on('turn.event', ({ turn, ev }) => stream.sender.onTurnEvent(turn, ev), { critical: true })
    bus.on('turn.event', ({ turn, ev }) => stream.sender.relay(turn, ev))
    const emitBus = (ev: NormalizedEvent): void => bus.emit('turn.event', { turn, ev })

    // 1. Initial user prompt commit + relayed committed notification
    const initialRowId = await stream.sender.commitUserMessage!(turn, {
      text: 'initial prompt',
      createdAt: 1,
      messageKey: ST01_USER_INITIAL_ID
    })
    expect(initialRowId).toBe(1)
    stream.sender.relay(turn, {
      type: 'message.committed',
      sessionId: ST01_SESSION_ID,
      ids: ['req-1'],
      text: 'initial prompt',
      messageId: initialRowId!,
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
    expect(steerRowId).toBe(3)
    stream.sender.relay(turn, {
      type: 'message.committed',
      sessionId: ST01_SESSION_ID,
      ids: ['steer-1'],
      text: 'mid steer prompt',
      messageId: steerRowId!,
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
    expect(recommitRowId).toBe(3)
    stream.sender.relay(turn, {
      type: 'message.committed',
      sessionId: ST01_SESSION_ID,
      ids: ['steer-1'],
      text: 'mid steer prompt',
      messageId: recommitRowId!,
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

    await stream.settle()
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM turn_failures').get()).toEqual({
      count: 0
    })

    // The committed steer owns C. Recommitting the same input must preserve both row identities.
    const acceptedError = {
      type: 'error',
      sessionId: ST01_SESSION_ID,
      error: {
        category: 'stream_error',
        message: 'confirmed continuation failure',
        retryable: true
      }
    } as const
    const receipt = await stream.sender.commitFailure!(turn, acceptedError, {
      failureId: 'st01-accepted-fault',
      ownerUserMessageKey: ST01_USER_STEER_ID,
      occurredAt: 7
    })
    expect(receipt).toEqual(ST01_CONFIRMED_FAILURE)
    if (!receipt) throw new Error('Missing committed failure receipt')
    emitBus({ ...acceptedError, messageKey: receipt.assistantMessageKey, failure: receipt })

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
    expect(reloadedSummary).toEqual(ST01_EXPECTED_MESSAGES)
    expect(loaded!.messages.at(-1)?.parts.at(-1)).toEqual({
      type: 'error',
      error: acceptedError.error,
      failure: ST01_CONFIRMED_FAILURE
    })
    const stored = sqlite
      .prepare(
        `
      SELECT f.owner_message_id AS ownerRow, p.message_id AS assistantRow, m.message_key AS assistantKey
      FROM turn_failures f JOIN message_parts p ON p.id = f.part_id JOIN messages m ON m.id = p.message_id
      WHERE f.session_id = ?
    `
      )
      .all(ST01_SESSION_ID)
    expect(stored).toEqual([{ ownerRow: 3, assistantRow: 5, assistantKey: 'a:3' }])
  })
})

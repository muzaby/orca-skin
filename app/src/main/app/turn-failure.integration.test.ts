import Database from 'better-sqlite3'
import { expect, it, vi } from 'vitest'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { NormalizedEvent } from '../../shared/ipc'
import { claudeToNormalized } from '../adapters/claude/map'
import { ClaudeInputReceipts } from '../adapters/claude/input-receipts'
import { assistantMessage, openCodeEvent } from '../adapters/opencode/v1/adapter.testfixture'
import { OpenCodeEventMapper } from '../adapters/opencode/v1/map'
import type { TurnRequest } from '../adapters/common/turn'
import type { OoBusEvents } from '../contracts/bus-events'
import type { ClientRef } from '../contracts/client'
import type { TurnContext } from '../contracts/turn'
import { BackgroundTaskTracker } from '../features/chat/background-tasks'
import { PendingMessageQueue } from '../features/chat/pending-message-queue'
import { TurnCoordinator, type CoordinatorRuntime } from '../features/chat/turn-coordinator'
import { TypedBus } from '../infra/bus'
import { applyMigrations } from '../infra/db/migrate'
import { DbQueries } from '../infra/db/queries'
import { createPersistenceStream } from './data-host/persistence-stream.testfixture'

type Source = 'work' | 'claude' | 'opencode' | 'throw' | 'unaccepted' | 'stale' | 'listen'

it.each<Source>(['work', 'claude', 'opencode', 'throw', 'unaccepted', 'stale', 'listen'])(
  'joins the %s failure to the committed response input across the host protocol',
  async (source) => {
    const raw = new Database(':memory:')
    applyMigrations(raw)
    const db = new DbQueries(raw)
    const events: NormalizedEvent[] = []
    const failTurn = vi.fn()
    const { sender, close, settle } = createPersistenceStream({
      db,
      send: (_owner, ev) => events.push(ev),
      failTurn
    })
    try {
      const queue = new PendingMessageQueue()
      const sessionId = 's1'
      const backend = source === 'opencode' ? 'opencode' : 'claude'
      db.insertSession({
        id: sessionId,
        backend,
        agentKind: source === 'work' ? 'work' : 'code',
        createdAt: 100,
        projectId: null,
        title: null
      })
      const bus = new TypedBus<OoBusEvents<ClientRef>>()
      bus.on('turn.event', ({ turn, ev }) => sender.onTurnEvent(turn, ev), { critical: true })
      bus.on('turn.event', ({ turn, ev }) => sender.relay(turn, ev))
      for (const attempt of [1, 2]) {
        const queueBatch = (
          requestId: string,
          ids: string[]
        ): ReturnType<typeof queue.reserveHeld> => {
          for (const id of ids) queue.enqueue(sessionId, { text: 'Question' }, 100, id)
          const batch = queue.reserveHeld(sessionId, requestId)!
          if (source !== 'unaccepted') queue.commitMany(sessionId, [batch])
          return batch
        }
        const prelude = queueBatch('pre-' + attempt, ['p' + attempt])!
        const prompt = queueBatch('submit-' + attempt, ['a' + attempt, 'b' + attempt])!
        const turn = {
          owner: { id: attempt },
          controller: new AbortController(),
          dbSessionId: sessionId,
          titleAdapter: { id: backend },
          agentKind: source === 'work' ? 'work' : 'code',
          openToolRuns: new Map(),
          askResolved: new Map(),
          stoppedSubagents: new Set(),
          subagentTaskIds: new Map()
        } as unknown as TurnContext<ClientRef>
        const native = 'provider-input-' + attempt
        const throwable = {
          category: 'stream_error',
          message: 'Failure',
          retryable: false
        } as const
        async function* stream(): AsyncIterable<NormalizedEvent> {
          if (source === 'unaccepted') {
            yield { type: 'error', error: throwable, sessionId, responseInputIds: [prompt.uuid] }
            return
          }
          if (source === 'listen') {
            yield {
              type: 'input.received',
              sessionId,
              text: 'Question',
              origin: { kind: 'automatic' },
              nativeMessageId: native
            }
            yield { type: 'error', error: throwable, sessionId, responseInputIds: [native] }
            return
          }
          if (source === 'claude' || source === 'work') {
            const receipt = new ClaudeInputReceipts()
            for (const batch of [prelude, prompt]) receipt.submitted(batch.text, batch.uuid)
            const result = {
              type: 'result',
              is_error: true,
              result: 'Failure',
              uuid: 'result-' + attempt,
              user_message_uuids: [prelude.uuid, prompt.uuid]
            }
            yield* receipt.response(result, sessionId)
            if (source === 'work')
              yield { type: 'message.completed', sessionId, message: { text: 'partial answer' } }
            const mapped = claudeToNormalized(result as SDKMessage, { sessionId, cwd: '/repo' })
            yield* mapped // telemetry closes the old assistant before the error.
            yield* mapped.filter((event) => event.type === 'error')
            return
          }
          for (const batch of [prelude, prompt]) {
            yield {
              type: 'input.echo',
              sessionId,
              text: batch.text,
              uuid: batch.uuid,
              nativeMessageId: native
            }
          }
          if (source === 'throw') throw Error('Failure')
          if (source === 'stale') {
            yield { type: 'error', error: throwable, sessionId, responseInputIds: ['previous-run'] }
            return
          }
          const mapper = new OpenCodeEventMapper(sessionId, native)
          yield* mapper.map(
            openCodeEvent('message.updated', {
              sessionID: sessionId,
              info: {
                ...assistantMessage(sessionId, native, 'provider-assistant-' + attempt),
                error: { name: 'ContextOverflowError', data: { message: 'overflow' } }
              }
            })
          )
          yield* mapper.map(
            openCodeEvent('session.error', {
              sessionID: sessionId,
              error: { name: 'ContextOverflowError', data: { message: 'overflow' } }
            })
          )
        }
        const coordinator = new TurnCoordinator({
          runtime: { send: stream, listen: stream } as unknown as CoordinatorRuntime,
          bus,
          persist: sender,
          forward: { relay: sender.relay, forward: (_owner, ev) => events.push(ev) },
          activeTurns: { begin: vi.fn(), end: vi.fn(), confirm: vi.fn() },
          registry: { promote: vi.fn() },
          classifyError: () => throwable,
          backgroundTasks: new BackgroundTaskTracker(),
          pendingMessages: queue,
          persistResponseBoundaries: () => source === 'work',
          clock: () => 1234,
          newId: () => 'failure-' + attempt
        })
        await coordinator.run(
          turn,
          {
            sessionId,
            text: prompt.text,
            promptUuid: prompt.uuid,
            preludes: [prelude]
          } as TurnRequest,
          { sharedPathProjectId: null, kind: source === 'listen' ? 'listen' : 'user' }
        )
        sender.finalizeTurn?.(turn)
        await settle()
      }
      expect(failTurn).not.toHaveBeenCalled()
      const errors = events.filter((event) => event.type === 'error')
      expect(errors).toHaveLength(2)
      const rows = raw
        .prepare(
          `
        SELECT u.message_key owner, a.message_key assistant, p.payload_json payload
        FROM turn_failures f JOIN messages u ON u.id=f.owner_message_id
        JOIN message_parts p ON p.id=f.part_id JOIN messages a ON a.id=p.message_id
        ORDER BY p.id
      `
        )
        .all() as Array<{ owner: string; assistant: string; payload: string }>
      if (source === 'unaccepted' || source === 'stale') {
        expect(rows).toEqual([])
        expect(errors.map((ev) => ev.failure)).toEqual([undefined, undefined])
        return
      }
      expect(rows).toHaveLength(2)
      for (const [index, ev] of errors.entries()) {
        const i = index + 1
        const expectedOwner = source === 'listen' ? 'i:n:provider-input-' + i : 'u:a' + i + ',b' + i
        const boundary = events
          .filter((ev) => ev.type === 'response.boundary' && ev.boundary.phase === 'begin')
          .at(index)
        const expected = {
          failureId: 'failure-' + i,
          ownerUserMessageKey: expectedOwner,
          assistantMessageKey: 'a:' + i,
          occurredAt: 1234,
          ...(boundary?.type === 'response.boundary'
            ? { responseBoundaryId: boundary.boundary.id }
            : {})
        }
        if (source === 'work') {
          expect(boundary).toMatchObject({ messageKey: expected.assistantMessageKey })
          expect(events).toContainEqual(
            expect.objectContaining({
              type: 'response.boundary',
              messageKey: expected.assistantMessageKey,
              boundary: { phase: 'end', id: expected.responseBoundaryId, outcome: 'failed' }
            })
          )
        }
        expect(ev).toMatchObject({
          sessionId,
          messageKey: expected.assistantMessageKey,
          failure: expected
        })
        expect(rows[index]).toMatchObject({
          owner: expectedOwner,
          assistant: expected.assistantMessageKey
        })
        expect(JSON.parse(rows[index].payload)).toEqual({ error: ev.error, failure: expected })
        expect(ev.error.message).toBe(
          source === 'opencode'
            ? 'OpenCode 모델의 컨텍스트 한도를 초과했습니다. 새 대화에서 다시 시도해 주세요.'
            : 'Failure'
        )
        expect(ev.error.category).toBe('stream_error')
      }
    } finally {
      close()
      await settle()
      raw.close()
    }
  }
)

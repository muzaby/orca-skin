import { describe, it, expect, vi } from 'vitest'
import Database from 'better-sqlite3'
vi.mock('electron', () => ({ webContents: { getAllWebContents: (): unknown[] => [] } }))
import { HistoryWriter } from '../features/history/writer'
import { loadSession } from '../features/history/reader'
import { TurnCoordinator, type CoordinatorRuntime } from '../features/chat/turn-coordinator'
import { PendingMessageQueue } from '../features/chat/pending-message-queue'
import { BackgroundTaskTracker } from '../features/chat/background-tasks'
import { DbQueries } from '../infra/db/queries'
import { applyMigrations } from '../infra/db/migrate'
import { TypedBus } from '../infra/bus'
import type { OrcaBusEvents } from '../contracts/bus-events'
import type { TurnContext } from '../contracts/turn'
import type { TurnRequest } from '../adapters/turn'
import type { NormalizedEvent } from '../../shared/ipc'
import { resolveAgentProfile } from '../features/agents/profiles'

const turnFor = (): TurnContext =>
  ({
    agentKind: 'work',
    dbSessionId: 's1',
    currentAssistantMessageId: null,
    assistantText: '',
    providerKey: null,
    askResolved: new Map()
  }) as unknown as TurnContext
const text: NormalizedEvent = {
  type: 'message.completed',
  sessionId: 's1',
  message: { text: 'searchable answer' }
}

describe('Work response boundary composition', () => {
  it('persists the actual coordinator stream around initial and steer user commits in live order', async () => {
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
        agentKind: 'work'
      })
      const writer = new HistoryWriter(
        queries,
        (kind) => resolveAgentProfile(kind).persistResponseBoundaries
      )
      const turn = Object.assign(turnFor(), {
        controller: new AbortController(),
        openToolRuns: new Map(),
        stoppedSubagents: new Set(),
        askPendingIds: [],
        pendingAskAnswers: [],
        subagentTaskIds: new Map(),
        subagentTypes: new Map(),
        blockedSubagents: new Set()
      })
      const queue = new PendingMessageQueue()
      queue.enqueue('s1', { text: 'initial' }, 1, 'first')
      const first = queue.reserveHeld('s1', 'turn-open')!
      queue.commit('s1', first.attemptId!, first.chainId)
      queue.enqueue('s1', { text: 'steer' }, 2, 'second')
      const second = queue.reserveHeld('s1', 'steer')!
      queue.commit('s1', second.attemptId!, second.chainId)
      const runtime = {
        send: async function* () {
          yield text
          yield {
            type: 'input.echo',
            sessionId: 's1',
            text: second.text,
            uuid: second.uuid
          } as const
          yield text
          yield { type: 'telemetry', sessionId: 's1' } as const
        }
      } as unknown as CoordinatorRuntime
      const bus = new TypedBus<OrcaBusEvents>()
      const live: NormalizedEvent[] = []
      bus.on('turn.event', ({ turn, ev }) => writer.persist(turn, ev), { critical: true })
      bus.on('turn.event', ({ ev }) => live.push(ev))
      const coordinator = new TurnCoordinator({
        runtime,
        bus,
        persist: {
          persist: writer.persist.bind(writer),
          flushAskAnswers: () => {},
          commitUserMessage: writer.commitUserMessage.bind(writer)
        },
        forward: {
          forward: (_owner, event) => {
            live.push(event)
          }
        },
        registry: { promote: () => {} },
        classifyError: () => ({ category: 'stream_error', message: 'failed', retryable: false }),
        activeTurns: { increment: () => {}, decrement: () => {} },
        backgroundTasks: new BackgroundTaskTracker(),
        pendingMessages: queue,
        persistResponseBoundaries: (kind) => resolveAgentProfile(kind).persistResponseBoundaries
      })
      await coordinator.run(
        turn,
        { sessionId: 's1', text: first.text, promptUuid: first.uuid } as TurnRequest,
        { boundProjectId: null }
      )
      const restored = loadSession(queries, 's1', () => '/fallback')!
      expect(restored.messages.map((message) => message.role)).toEqual([
        'user',
        'assistant',
        'user',
        'assistant'
      ])
      const boundaries = live
        .filter((event) => event.type === 'response.boundary')
        .map((event) => event.boundary)
      expect(boundaries.map((boundary) => boundary.phase)).toEqual(['begin', 'end', 'begin', 'end'])
      expect(boundaries[1]).toMatchObject({ outcome: 'unknown' })
      expect(boundaries[3]).toMatchObject({ outcome: 'ended' })
      expect(
        restored.messages
          .flatMap((message) => message.parts)
          .filter((part) => part.type === 'response_boundary')
          .map((part) => part.boundary)
      ).toEqual(boundaries)
      expect(
        restored.messages
          .filter((message) => message.role === 'assistant')
          .every((message) => !message.incomplete)
      ).toBe(true)
      expect(live[0]).toMatchObject({ type: 'message.committed', text: 'initial' })
    } finally {
      connection.close()
    }
  })
})

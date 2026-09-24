import { describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { WebContents } from 'electron'
import { claudeToNormalized, type MapContext } from '../../../../../main/adapters/claude-map'
import {
  TurnCoordinator,
  type CoordinatorRuntime
} from '../../../../../main/features/chat/turn-coordinator'
import { BackgroundTaskTracker } from '../../../../../main/features/chat/background-tasks'
import { HistoryWriter } from '../../../../../main/features/history/writer'
import { loadSession } from '../../../../../main/features/history/reader'
import { DbQueries } from '../../../../../main/infra/db/queries'
import { applyMigrations } from '../../../../../main/infra/db/migrate'
import { TypedBus } from '../../../../../main/infra/bus'
import { makeClassifiedError } from '../../../../../main/infra/errors'
import type { OrcaBusEvents } from '../../../../../main/contracts/bus-events'
import type { TurnContext } from '../../../../../main/contracts/turn'
import type { TurnRequest } from '../../../../../main/adapters/turn'
import type { NormalizedEvent } from '../../../../../shared/ipc'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { AssistantMessage } from '../components/transcript/AssistantMessage'
import { agentUiPolicy } from './agentPresentation'
import { partsToolCalls, toolRunOutcome } from './parts'

vi.mock('electron', () => ({ webContents: { getAllWebContents: (): unknown[] => [] } }))

// Only the SDK transport and Electron delivery are replaced. The mapper, coordinator,
// bus, SQLite writer/reader, reducer, pairing and rendered consumer are production code.
describe('0239 SDK to persisted and rendered settlement', () => {
  it.each(['no_result', 'retracted', 'user-rejected', 'cancelled', 'late-result'] as const)(
    'keeps live and loaded %s outcomes equal through the full result path',
    async (scenario) => {
      const db = new Database(':memory:')
      try {
        applyMigrations(db)
        const queries = new DbQueries(db)
        queries.insertSession({
          id: 's1',
          backend: 'claude',
          title: null,
          projectId: null,
          createdAt: 1
        })
        const writer = new HistoryWriter(queries, () => false)
        const context: MapContext = { sessionId: 's1', cwd: '/w' }
        const sdkMessages: unknown[] = [
          {
            type: 'assistant',
            uuid: 'a1',
            message: { content: [{ type: 'tool_use', id: 't', name: 'Read', input: {} }] }
          }
        ]
        if (scenario === 'retracted' || scenario === 'late-result')
          sdkMessages.push({
            type: 'system',
            subtype: 'model_refusal_fallback',
            retracted_message_uuids: ['a1']
          })
        if (scenario === 'user-rejected' || scenario === 'cancelled' || scenario === 'late-result')
          sdkMessages.push({
            type: 'user',
            message: {
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 't',
                  content: 'receipt',
                  is_error: scenario !== 'late-result'
                }
              ]
            },
            ...(scenario !== 'late-result'
              ? { tool_result_meta: [{ id: 't', non_execution_kind: scenario }] }
              : {})
          })
        sdkMessages.push({ type: 'result', subtype: 'success', usage: {} })
        const events = sdkMessages.flatMap((raw) => claudeToNormalized(raw as SDKMessage, context))
        const owner = {} as WebContents
        const turn = {
          agentKind: 'code',
          controller: new AbortController(),
          owner,
          live: null,
          dbSessionId: 's1',
          currentAssistantMessageId: null,
          assistantText: '',
          providerKey: null,
          openToolRuns: new Map(),
          askPendingIds: [],
          pendingAskAnswers: [],
          askResolved: new Map(),
          subagentTaskIds: new Map(),
          subagentTypes: new Map(),
          blockedSubagents: new Set(),
          stoppedSubagents: new Set()
        } as unknown as TurnContext<WebContents>
        const runtime = {
          send: async function* () {
            yield* events
          },
          cancelled: false,
          timedOut: false
        } as unknown as CoordinatorRuntime
        let live = chatReducer(initialChatState, { type: 'BEGIN_TURN' })
        const delivered: NormalizedEvent[] = []
        const forward = (_owner: WebContents, event: NormalizedEvent): void => {
          delivered.push(event)
          live = chatReducer(live, { type: 'RECV_EVENT', event })
        }
        const bus = new TypedBus<OrcaBusEvents<WebContents>>()
        bus.on('turn.event', ({ turn, ev }) => writer.persist(turn, ev), { critical: true })
        bus.on('turn.event', ({ ev }) => forward(owner, ev))
        await new TurnCoordinator<WebContents>({
          runtime,
          bus,
          persist: writer,
          forward: { forward },
          registry: { promote: () => {} },
          activeTurns: { increment: () => {}, decrement: () => {} },
          backgroundTasks: new BackgroundTaskTracker(),
          persistResponseBoundaries: () => false,
          classifyError: (error) => makeClassifiedError('stream_error', String(error))
        }).run(turn, { sessionId: 's1', text: 'test' } as TurnRequest, { boundProjectId: null })
        const session = loadSession(queries, 's1', () => '/w')!
        const loaded = chatReducer(initialChatState, { type: 'LOAD_SESSION', session })
        const liveCall = partsToolCalls(live.messages.flatMap((message) => message.parts))[0]
        const loadedCall = partsToolCalls(loaded.messages.flatMap((message) => message.parts))[0]
        const expected =
          scenario === 'late-result'
            ? 'completed'
            : scenario === 'user-rejected'
              ? 'rejected'
              : scenario === 'cancelled'
                ? 'cancelled'
                : 'not_executed'
        expect(toolRunOutcome(liveCall.result)).toBe(expected)
        expect(loadedCall.result).toEqual(liveCall.result)
        expect(delivered.some((event) => event.type === 'tool.call.retracted')).toBe(false)
        expect(delivered.at(-1)?.type).toBe('telemetry')
        expect(delivered.findIndex((event) => event.type === 'tool.call.completed')).toBeLessThan(
          delivered.length - 1
        )
        for (const state of [live, loaded]) {
          const message = state.messages.find((message) => message.role === 'assistant')!
          const html = renderToStaticMarkup(
            createElement(AssistantMessage, {
              message,
              transcriptPolicy: agentUiPolicy('code').transcript
            })
          )
          const label =
            expected === 'rejected'
              ? '거부됨'
              : expected === 'cancelled'
                ? '취소됨'
                : expected === 'not_executed'
                  ? '실행되지 않음'
                  : '읽음'
          expect(html).toContain(label)
          expect(html).not.toContain('sr-only')
          expect(html).not.toContain('text-bad')
        }
        if (scenario === 'late-result') {
          expect(liveCall.result?.nonExecution).toBeUndefined()
          expect(
            queries.loadParts('s1').filter((part) => part.type === 'tool_result')
          ).toHaveLength(1)
        }
      } finally {
        db.close()
      }
    }
  )
})

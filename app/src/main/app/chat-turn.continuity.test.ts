// 0064 r2 — fork/handoff 도착 파이프라인 통합 테스트. 실 in-memory DB + 실 HistoryWriter 를
// turn.event 버스 구독자로 TurnCoordinator 에 물려, 어댑터가 init(새 id)→telemetry 를 흘릴 때
// sessions 행 + lineage 영속(fork 는 display 복사까지)이 보장됨을 잠근다 — 실기에서 "세션은
// 생기는데 렌더러에 아무것도 안 보이는" 회귀 방지. (r4: 자동 메시지 에코는 coordinator 의
// session.updated 시점이 아니라 send 수리 직후로 이동 — 에코 순서 잠금은 렌더러 chatStore.test
// 가 담당.) 도착 물질화는 bootstrap 과 동형으로 HistoryWriter 에 orchestration 구현을 주입한다.
import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import migration0001 from '../infra/db/migrations/0001_initial.sql?raw'
import migration0002 from '../infra/db/migrations/0002_projects.sql?raw'
import migration0003 from '../infra/db/migrations/0003_messages_fts.sql?raw'
import migration0004 from '../infra/db/migrations/0004_message_parts.sql?raw'
import migration0005 from '../infra/db/migrations/0005_usage_events.sql?raw'
import migration0006 from '../infra/db/migrations/0006_turn_usage.sql?raw'
import migration0007 from '../infra/db/migrations/0007_title_source.sql?raw'
import migration0008 from '../infra/db/migrations/0008_provider_key.sql?raw'
import migration0009 from '../infra/db/migrations/0009_message_complete.sql?raw'
import migration0010 from '../infra/db/migrations/0010_session_cwd.sql?raw'
import migration0011 from '../infra/db/migrations/0011_session_lineage.sql?raw'
import migration0012 from '../infra/db/migrations/0012_provider_limits.sql?raw'
import { DbQueries } from '../infra/db/queries'
import type { LineageRelation } from '../infra/db/types'
import type { NormalizedEvent } from '../../shared/ipc'
import { TypedBus } from '../infra/bus'
import type { OrcaBusEvents } from '../contracts/bus-events'
import type { TurnContext } from '../contracts/turn'
import { TurnCoordinator, type CoordinatorRuntime } from '../features/chat/turn-coordinator'
import { PendingMessageQueue } from '../features/chat/pending-message-queue'
import { HistoryWriter } from '../features/history/writer'
import { buildHandoffMessage } from '../features/orchestration/handoff'
import { materializeContinuityArrival } from '../features/orchestration/fork'

function makeDb(): DbQueries {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const sql of [
    migration0001,
    migration0002,
    migration0003,
    migration0004,
    migration0005,
    migration0006,
    migration0007,
    migration0008,
    migration0009,
    migration0010,
    migration0011,
    migration0012
  ]) {
    db.exec(sql)
  }
  return new DbQueries(db)
}

function seedSource(q: DbQueries, id = 'src-session'): void {
  q.insertSession({ id, backend: 'claude', title: '원본 대화', projectId: null, createdAt: 1 })
  const u = q.appendMessage({ sessionId: id, role: 'user', content: '질문', createdAt: 1 })
  q.appendPart({ messageId: u, type: 'text', toolRunId: null, payloadJson: '{"text":"질문"}' })
  const a = q.appendMessage({ sessionId: id, role: 'assistant', content: '답', createdAt: 2 })
  q.appendPart({ messageId: a, type: 'text', toolRunId: null, payloadJson: '{"text":"답"}' })
}

// 어댑터 대역 — init(새 id) → 프롬프트 echo(0067 커밋 신호) → telemetry 를 흘리는 최소 런타임.
function fakeRuntime(
  newSessionId: string,
  echo: { text: string; uuid: string }
): CoordinatorRuntime {
  return {
    send: () =>
      (async function* (): AsyncIterable<NormalizedEvent> {
        yield {
          type: 'session.updated',
          sessionId: newSessionId,
          patch: { cwd: '/w' }
        }
        yield { type: 'input.echo', sessionId: newSessionId, text: echo.text, uuid: echo.uuid }
        yield { type: 'telemetry', sessionId: newSessionId }
      })(),
    close: () => undefined
  } as unknown as CoordinatorRuntime
}

function continuityTurn(
  text: string,
  lineage: { parentSessionId: string; relation: LineageRelation },
  initialTitle?: string
): TurnContext {
  return {
    ...(initialTitle !== undefined ? { initialTitle } : {}),
    controller: new AbortController(),
    owner: {},
    live: null,
    titleAdapter: { id: 'claude' },
    providerKey: null,
    pendingUserText: text,
    firstUserText: text,
    pendingAttachmentViews: [],
    dbSessionId: null,
    pendingProjectId: null,
    isNewSession: true,
    cwd: '/w',
    titleGenerationStarted: true,
    currentAssistantMessageId: null,
    assistantText: '',
    pendingAskAnswers: [],
    askPendingIds: [],
    askResolved: new Map(),
    subagentTaskIds: new Map(),
    openToolRuns: new Map(),
    subagentTypes: new Map(),
    blockedSubagents: new Set(),
    stoppedSubagents: new Set(),
    lineage,
    // 0067 AC9 — 새 세션 큐 키(clientKey). session.updated 에서 실 id 로 rekey 된다.
    queueKey: 'draft-key'
  } as unknown as TurnContext
}

async function runTurn(
  db: DbQueries,
  turn: TurnContext,
  newSessionId: string
): Promise<NormalizedEvent[]> {
  const forwarded: NormalizedEvent[] = []
  // bootstrap 배선과 동형 — history(critical) → relay 등록순, 도착 물질화 주입.
  const persistence = new HistoryWriter(db, (arrival) => materializeContinuityArrival(db, arrival))
  const bus = new TypedBus<OrcaBusEvents<unknown>>()
  bus.on('turn.event', ({ turn: t, ev }) => persistence.persist(t, ev), { critical: true })
  bus.on('turn.event', ({ ev }) => forwarded.push(ev))
  // 0067: 프롬프트도 큐 경유 — enqueue→flushItem 후 echo(uuid=item id) 관측으로 커밋된다.
  const pendingMessages = new PendingMessageQueue()
  pendingMessages.enqueue('draft-key', { text: turn.firstUserText }, 1, 'prompt-item')
  pendingMessages.flushItem('draft-key', 'prompt-item')
  const coordinator = new TurnCoordinator({
    runtime: fakeRuntime(newSessionId, { text: turn.firstUserText, uuid: 'prompt-item' }),
    bus,
    persist: persistence,
    forward: { forward: (_owner, ev) => forwarded.push(ev) },
    registry: { promote: vi.fn() },
    classifyError: (err) => {
      throw err
    },
    activeTurns: { increment: vi.fn(), decrement: vi.fn() },
    backgroundSubagents: false,
    pendingMessages
  })
  await coordinator.run(turn, { sessionId: null, text: '', cwd: '/w' } as never, {
    boundProjectId: null
  })
  return forwarded
}

describe('continuity 도착 파이프라인 (0064 r2)', () => {
  it('handoff — sessions 행 + lineage(handoff, 복사 없음) 영속, 에코는 coordinator 미발행(r4 — send 시점 조기 에코)', async () => {
    const db = makeDb()
    seedSource(db)
    const auto = buildHandoffMessage('원본 대화', 'src-session')
    const turn = continuityTurn(
      auto,
      { parentSessionId: 'src-session', relation: 'handoff' },
      '[핸드오프] 원본 대화'
    )

    const forwarded = await runTurn(db, turn, 'new-session')

    // DB — 세션행(마커 초기 제목) + 계보 + 자동 메시지(user)만(display 복사 없음).
    expect(db.getSessionById('new-session')).toBeDefined()
    expect(db.getSessionById('new-session')?.title).toBe('[핸드오프] 원본 대화')
    expect(db.getLineage('new-session')).toMatchObject({
      parent_session_id: 'src-session',
      relation: 'handoff'
    })
    const parts = db.loadParts('new-session')
    expect(parts.map((p) => [p.role, p.type])).toEqual([['user', 'text']])
    expect(JSON.parse(parts[0].payload_json).text).toBe(auto)

    // forward — user 커밋은 echo 관측 단일 경로(0067 AC6): telemetry persist 후 message.committed.
    expect(forwarded.map((e) => e.type)).toEqual([
      'session.updated',
      'telemetry',
      'message.committed'
    ])
  })

  it('fork — display 복사 + lineage(fork), 새 발화는 복사 이력 뒤 idx, 에코 없음', async () => {
    const db = makeDb()
    seedSource(db)
    const turn = continuityTurn('다른 방향으로 가자', {
      parentSessionId: 'src-session',
      relation: 'fork'
    })

    const forwarded = await runTurn(db, turn, 'fork-session')

    expect(db.getLineage('fork-session')).toMatchObject({ relation: 'fork' })
    const parts = db.loadParts('fork-session')
    // 복사된 [user, assistant] 이력 + '분기된 지점' 마커(r5) + 새 user 발화가 그 뒤에.
    expect(parts.map((p) => [p.role, p.type])).toEqual([
      ['user', 'text'],
      ['assistant', 'text'],
      ['assistant', 'fork_boundary'],
      ['user', 'text']
    ])
    expect(parts[3].message_idx).toBeGreaterThan(parts[2].message_idx)
    // 원본 무변경.
    expect(db.loadParts('src-session')).toHaveLength(2)

    expect(forwarded.map((e) => e.type)).toEqual([
      'session.updated',
      'telemetry',
      'message.committed'
    ])
  })
})

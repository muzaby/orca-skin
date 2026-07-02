// 0062 r2 — fork/handoff 도착 파이프라인 통합 테스트. 실 in-memory DB + 실 TurnPersistence 를
// TurnCoordinator 에 물려, 어댑터가 init(새 id)→telemetry 를 흘릴 때 ① sessions 행 + lineage
// 영속(fork 는 display 복사까지) ② forward 순서 [session.updated → message.user(에코) → …] 가
// 보장됨을 잠근다 — 실기에서 "세션은 생기는데 렌더러에 아무것도 안 보이는" 회귀 방지.
import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import migration0001 from '../../db/migrations/0001_initial.sql?raw'
import migration0002 from '../../db/migrations/0002_projects.sql?raw'
import migration0003 from '../../db/migrations/0003_messages_fts.sql?raw'
import migration0004 from '../../db/migrations/0004_message_parts.sql?raw'
import migration0005 from '../../db/migrations/0005_usage_events.sql?raw'
import migration0006 from '../../db/migrations/0006_turn_usage.sql?raw'
import migration0007 from '../../db/migrations/0007_title_source.sql?raw'
import migration0008 from '../../db/migrations/0008_provider_key.sql?raw'
import migration0009 from '../../db/migrations/0009_message_complete.sql?raw'
import migration0010 from '../../db/migrations/0010_session_cwd.sql?raw'
import migration0011 from '../../db/migrations/0011_session_lineage.sql?raw'
import { DbQueries } from '../../db/queries'
import type { CostTracker } from '../../cost/tracker'
import { TurnCoordinator, type CoordinatorRuntime } from '../../lifecycle/turn-coordinator'
import type { LineageRelation } from '../../db/types'
import type { NormalizedEvent } from '../../../shared/ipc'
import { buildHandoffMessage } from '../../orchestration/handoff'
import { TurnPersistence } from './persist'
import type { InflightTurn } from './turn-registry'

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
    migration0011
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

// 어댑터 대역 — init(새 id) → telemetry 를 흘리는 최소 런타임.
function fakeRuntime(newSessionId: string): CoordinatorRuntime {
  return {
    send: () =>
      (async function* (): AsyncIterable<NormalizedEvent> {
        yield {
          type: 'session.updated',
          sessionId: newSessionId,
          patch: { cwd: '/w' }
        }
        yield { type: 'telemetry', sessionId: newSessionId }
      })(),
    close: () => undefined
  } as unknown as CoordinatorRuntime
}

function continuityTurn(
  text: string,
  lineage: { parentSessionId: string; relation: LineageRelation },
  echoUserText?: string
): InflightTurn {
  return {
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
    ...(echoUserText !== undefined ? { echoUserText } : {})
  } as unknown as InflightTurn
}

async function runTurn(
  db: DbQueries,
  turn: InflightTurn,
  newSessionId: string
): Promise<NormalizedEvent[]> {
  const forwarded: NormalizedEvent[] = []
  const persistence = new TurnPersistence(db, {} as CostTracker, () => undefined)
  const coordinator = new TurnCoordinator({
    runtime: fakeRuntime(newSessionId),
    persist: persistence,
    forward: { forward: (_owner, ev) => forwarded.push(ev) },
    titles: { maybeStart: vi.fn() },
    registry: { promote: vi.fn() },
    classifyError: (err) => {
      throw err
    },
    activeTurns: { increment: vi.fn(), decrement: vi.fn() },
    backgroundSubagents: false
  })
  await coordinator.run(turn, { sessionId: null, text: '', cwd: '/w' } as never, {
    boundProjectId: null
  })
  return forwarded
}

describe('continuity 도착 파이프라인 (0062 r2)', () => {
  it('handoff — sessions 행 + lineage(handoff, 복사 없음) 영속, forward 는 [session.updated → message.user 에코 → telemetry]', async () => {
    const db = makeDb()
    seedSource(db)
    const auto = buildHandoffMessage('원본 대화', 'src-session')
    const turn = continuityTurn(auto, { parentSessionId: 'src-session', relation: 'handoff' }, auto)

    const forwarded = await runTurn(db, turn, 'new-session')

    // DB — 세션행 + 계보 + 자동 메시지(user)만(display 복사 없음).
    expect(db.getSessionById('new-session')).toBeDefined()
    expect(db.getLineage('new-session')).toMatchObject({
      parent_session_id: 'src-session',
      relation: 'handoff'
    })
    const parts = db.loadParts('new-session')
    expect(parts.map((p) => [p.role, p.type])).toEqual([['user', 'text']])
    expect(JSON.parse(parts[0].payload_json).text).toBe(auto)

    // forward 순서 — 렌더러 승격 → 자동 메시지 에코 → 턴 종료.
    expect(forwarded.map((e) => e.type)).toEqual(['session.updated', 'message.user', 'telemetry'])
    const echo = forwarded[1] as Extract<NormalizedEvent, { type: 'message.user' }>
    expect(echo.sessionId).toBe('new-session')
    expect(echo.text).toBe(auto)
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
    // 복사된 [user, assistant] 이력 + 새 user 발화가 그 뒤에.
    expect(parts.map((p) => [p.role, p.type])).toEqual([
      ['user', 'text'],
      ['assistant', 'text'],
      ['user', 'text']
    ])
    expect(parts[2].message_idx).toBeGreaterThan(parts[1].message_idx)
    // 원본 무변경.
    expect(db.loadParts('src-session')).toHaveLength(2)

    expect(forwarded.map((e) => e.type)).toEqual(['session.updated', 'telemetry'])
  })
})

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import migration0001 from './migrations/0001_initial.sql?raw'
import migration0002 from './migrations/0002_projects.sql?raw'
import migration0003 from './migrations/0003_messages_fts.sql?raw'
import migration0004 from './migrations/0004_message_parts.sql?raw'
import migration0005 from './migrations/0005_usage_events.sql?raw'
import migration0006 from './migrations/0006_turn_usage.sql?raw'
import migration0007 from './migrations/0007_title_source.sql?raw'
import migration0008 from './migrations/0008_provider_key.sql?raw'
import migration0009 from './migrations/0009_message_complete.sql?raw'
import migration0010 from './migrations/0010_session_cwd.sql?raw'
import migration0011 from './migrations/0011_session_lineage.sql?raw'
import migration0012 from './migrations/0012_provider_limits.sql?raw'
import migration0013 from './migrations/0013_schedules.sql?raw'
import migration0014 from './migrations/0014_provider_usage_report_cache.sql?raw'
import { DbQueries } from './queries'

function dbWithMigrations(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(migration0001)
  db.exec(migration0002)
  db.exec(migration0003)
  db.exec(migration0004)
  db.exec(migration0005)
  db.exec(migration0006)
  db.exec(migration0007)
  db.exec(migration0008)
  db.exec(migration0009)
  db.exec(migration0010)
  db.exec(migration0011)
  db.exec(migration0012)
  db.exec(migration0013)
  db.exec(migration0014)
  return db
}

function dbBefore0006(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(migration0001)
  db.exec(migration0002)
  db.exec(migration0003)
  db.exec(migration0004)
  db.exec(migration0005)
  return db
}

function insertSession(db: Database.Database, id = 's1'): void {
  db.prepare(
    `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview, provider_key)
     VALUES (?, 'claude', NULL, NULL, 1, 1, NULL, NULL)`
  ).run(id)
}

describe('0006_turn_usage migration', () => {
  it('usage_events 데이터를 id 보존 turn_usage/turn_model_usage 로 이관하고 기존 테이블을 제거한다', () => {
    const db = dbBefore0006()
    db.prepare(
      `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview)
       VALUES ('s1', 'claude', NULL, NULL, 1, 1, NULL)`
    ).run()
    db.prepare(
      `INSERT INTO usage_events
       (id, session_id, model, created_at, input_tokens, output_tokens, cache_read_tokens,
        cache_creation_tokens, cost_usd)
       VALUES (42, 's1', 'claude-opus-4-5', 1000, 10, 20, 30, 40, 0.5)`
    ).run()

    db.exec(migration0006)

    expect(
      db.prepare(`SELECT name FROM sqlite_master WHERE name = 'usage_events'`).get()
    ).toBeUndefined()
    expect(db.prepare('SELECT * FROM turn_usage').get()).toMatchObject({
      id: 42,
      session_id: 's1',
      message_id: null,
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 40,
      total_cost_usd: 0.5,
      created_at: 1000
    })
    expect(db.prepare('SELECT * FROM turn_model_usage').get()).toMatchObject({
      turn_usage_id: 42,
      model: 'claude-opus-4-5',
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 30,
      cache_creation_input_tokens: 40,
      cost_usd: 0.5
    })
  })
})

describe('0009_message_complete migration', () => {
  it('기존 messages 행을 complete=1 로 backfill 한다', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(migration0001)
    db.exec(migration0002)
    db.exec(migration0003)
    db.exec(migration0004)
    db.exec(migration0005)
    db.exec(migration0006)
    db.exec(migration0007)
    db.exec(migration0008)
    insertSession(db)
    db.prepare(
      `INSERT INTO messages (session_id, role, content, created_at, idx)
       VALUES ('s1', 'assistant', 'old', 1, 0)`
    ).run()

    db.exec(migration0009)

    expect(db.prepare('SELECT complete FROM messages').get()).toEqual({ complete: 1 })
  })
})

describe('DbQueries turn usage', () => {
  it('insertTurnUsage id 반환과 insertTurnModelUsage 연결을 제공한다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)

    const id = q.insertTurnUsage({
      sessionId: 's1',
      messageId: null,
      createdAt: 10,
      inputTokens: 1,
      outputTokens: 2,
      cacheCreationInputTokens: 3,
      cacheReadInputTokens: 4,
      totalCostUsd: 0.1
    })
    q.insertTurnModelUsage({
      turnUsageId: id,
      model: 'claude-opus-4-5',
      inputTokens: 1,
      outputTokens: 2,
      cacheCreationInputTokens: 3,
      cacheReadInputTokens: 4,
      costUsd: 0.1
    })

    expect(id).toBeGreaterThan(0)
    expect(db.prepare('SELECT turn_usage_id FROM turn_model_usage').get()).toEqual({
      turn_usage_id: id
    })
  })

  it('getLatestTurnUsage 는 최신 부모 행과 input_tokens 내림차순 자식 행을 반환한다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)
    q.insertTurnUsage({
      sessionId: 's1',
      messageId: null,
      createdAt: 1,
      inputTokens: 1,
      outputTokens: null,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      totalCostUsd: null
    })
    const latest = q.insertTurnUsage({
      sessionId: 's1',
      messageId: null,
      createdAt: 2,
      inputTokens: 30,
      outputTokens: 4,
      cacheCreationInputTokens: 5,
      cacheReadInputTokens: 6,
      totalCostUsd: 0.2
    })
    q.insertTurnModelUsage({
      turnUsageId: latest,
      model: 'claude-haiku-4',
      inputTokens: 10,
      outputTokens: null,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      costUsd: null
    })
    q.insertTurnModelUsage({
      turnUsageId: latest,
      model: 'claude-opus-4-5',
      inputTokens: 50,
      outputTokens: null,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      costUsd: null
    })

    const row = q.getLatestTurnUsage('s1')
    expect(row?.turn.id).toBe(latest)
    expect(row?.modelUsage.map((m) => m.model)).toEqual(['claude-opus-4-5', 'claude-haiku-4'])
  })

  it('sumUsageByBoundaries 는 한 스캔으로 day/week/month 를 집계하고 null 을 0 으로 본다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)
    q.insertTurnUsage({
      sessionId: 's1',
      messageId: null,
      createdAt: 10,
      inputTokens: null,
      outputTokens: 2,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: 4,
      totalCostUsd: null
    })
    q.insertTurnUsage({
      sessionId: 's1',
      messageId: null,
      createdAt: 20,
      inputTokens: 3,
      outputTokens: null,
      cacheCreationInputTokens: 5,
      cacheReadInputTokens: null,
      totalCostUsd: 0.7
    })

    // dayStart=15 → ts=20 행만, weekStart=5/monthStart=0 → 두 행 모두.
    const sums = q.sumUsageByBoundaries({ dayStart: 15, weekStart: 5, monthStart: 0 })
    expect(sums.day).toEqual({
      input_tokens: 3,
      output_tokens: 0,
      cache_creation_input_tokens: 5,
      cache_read_input_tokens: 0,
      total_cost_usd: 0.7
    })
    expect(sums.week).toEqual({
      input_tokens: 3,
      output_tokens: 2,
      cache_creation_input_tokens: 5,
      cache_read_input_tokens: 4,
      total_cost_usd: 0.7
    })
    expect(sums.month).toEqual(sums.week)

    // 모든 경계가 데이터 이후면 전 구간 0.
    const empty = q.sumUsageByBoundaries({ dayStart: 999, weekStart: 999, monthStart: 999 })
    const zero = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      total_cost_usd: 0
    }
    expect(empty).toEqual({ day: zero, week: zero, month: zero })
  })
})

describe('DbQueries usage stats (0112)', () => {
  function insertUsage(
    q: DbQueries,
    createdAt: number,
    tokens: Partial<{
      inputTokens: number | null
      outputTokens: number | null
      cacheCreationInputTokens: number | null
      cacheReadInputTokens: number | null
      totalCostUsd: number | null
    }> = {}
  ): number {
    return q.insertTurnUsage({
      sessionId: 's1',
      messageId: null,
      createdAt,
      inputTokens: tokens.inputTokens ?? null,
      outputTokens: tokens.outputTokens ?? null,
      cacheCreationInputTokens: tokens.cacheCreationInputTokens ?? null,
      cacheReadInputTokens: tokens.cacheReadInputTokens ?? null,
      totalCostUsd: tokens.totalCostUsd ?? null
    })
  }

  it('sumUsageByDaySince 는 OS 로컬 일자로 버킷팅한다 (자정 경계 분리, null→0, 오름차순)', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)
    // 로컬 자정을 사이에 둔 두 행 — Date 생성자도 SQL 'localtime' 도 OS 타임존이라 tz-포터블.
    const lateNight = new Date(2026, 0, 15, 23, 30).getTime()
    const earlyMorning = new Date(2026, 0, 16, 0, 30).getTime()
    insertUsage(q, lateNight, { inputTokens: 1, cacheReadInputTokens: 4, totalCostUsd: 0.1 })
    insertUsage(q, earlyMorning, { outputTokens: 2, cacheCreationInputTokens: 3 })
    insertUsage(q, earlyMorning + 60_000, { outputTokens: 5 })

    const rows = q.sumUsageByDaySince(0)
    expect(rows).toEqual([
      {
        day: '2026-01-15',
        input_tokens: 1,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 4,
        total_cost_usd: 0.1
      },
      {
        day: '2026-01-16',
        input_tokens: 0,
        output_tokens: 7,
        cache_creation_input_tokens: 3,
        cache_read_input_tokens: 0,
        total_cost_usd: 0
      }
    ])
  })

  it('sumUsageByDaySince 는 since 이전 행을 제외한다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)
    const old = new Date(2026, 0, 10, 12).getTime()
    const recent = new Date(2026, 0, 16, 12).getTime()
    insertUsage(q, old, { inputTokens: 100 })
    insertUsage(q, recent, { inputTokens: 1 })

    const rows = q.sumUsageByDaySince(new Date(2026, 0, 15).getTime())
    expect(rows.map((r) => r.day)).toEqual(['2026-01-16'])
  })

  it('sumUsageByModelSince 는 턴 횡단 모델별 합산 + 총 토큰 내림차순 + since 필터를 제공한다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)
    const old = new Date(2026, 0, 10, 12).getTime()
    const t1 = new Date(2026, 0, 15, 12).getTime()
    const t2 = new Date(2026, 0, 16, 12).getTime()

    const oldTurn = insertUsage(q, old)
    q.insertTurnModelUsage({
      turnUsageId: oldTurn,
      model: 'claude-opus-4-5',
      inputTokens: 999,
      outputTokens: null,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      costUsd: null
    })
    const turn1 = insertUsage(q, t1)
    q.insertTurnModelUsage({
      turnUsageId: turn1,
      model: 'claude-opus-4-5',
      inputTokens: 10,
      outputTokens: 5,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      costUsd: 0.3
    })
    q.insertTurnModelUsage({
      turnUsageId: turn1,
      model: 'claude-haiku-4',
      inputTokens: 1,
      outputTokens: null,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: 100,
      costUsd: null
    })
    const turn2 = insertUsage(q, t2)
    q.insertTurnModelUsage({
      turnUsageId: turn2,
      model: 'claude-opus-4-5',
      inputTokens: 20,
      outputTokens: null,
      cacheCreationInputTokens: 2,
      cacheReadInputTokens: null,
      costUsd: 0.4
    })

    const rows = q.sumUsageByModelSince(new Date(2026, 0, 15).getTime())
    expect(rows).toEqual([
      {
        model: 'claude-haiku-4',
        input_tokens: 1,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 100,
        cost_usd: 0
      },
      {
        model: 'claude-opus-4-5',
        input_tokens: 30,
        output_tokens: 5,
        cache_creation_input_tokens: 2,
        cache_read_input_tokens: 0,
        cost_usd: 0.7
      }
    ])

    // since=0 이면 이전 턴까지 포함.
    const all = q.sumUsageByModelSince(0)
    expect(all[0].model).toBe('claude-opus-4-5')
    expect(all[0].input_tokens).toBe(1029)
  })
})

describe('DbQueries session title source', () => {
  it('getTitleSource 는 기본 auto 값을 읽는다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)

    expect(q.getTitleSource('s1')).toBe('auto')
    expect(q.getTitleSource('missing')).toBeNull()
  })

  it('updateSessionTitleAuto 는 auto 행만 갱신하고 user 행은 보호한다', () => {
    const db = dbWithMigrations()
    insertSession(db, 'auto-session')
    insertSession(db, 'user-session')
    const q = new DbQueries(db)

    q.renameSession('user-session', '사용자 제목', 10)

    expect(q.updateSessionTitleAuto('auto-session', '자동 제목', 20)).toBe(true)
    expect(q.updateSessionTitleAuto('user-session', '덮어쓰기 시도', 20)).toBe(false)

    expect(
      db
        .prepare('SELECT title, title_source, updated_at FROM sessions WHERE id = ?')
        .get('auto-session')
    ).toEqual({
      title: '자동 제목',
      title_source: 'auto',
      updated_at: 20
    })
    expect(
      db
        .prepare('SELECT title, title_source, updated_at FROM sessions WHERE id = ?')
        .get('user-session')
    ).toEqual({
      title: '사용자 제목',
      title_source: 'user',
      updated_at: 10
    })
  })

  it('renameSession 은 title_source 를 user 로 표기한다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)

    q.renameSession('s1', '수동 제목', 30)

    expect(q.getTitleSource('s1')).toBe('user')
    expect(db.prepare('SELECT title, updated_at FROM sessions WHERE id = ?').get('s1')).toEqual({
      title: '수동 제목',
      updated_at: 30
    })
  })
})

describe('DbQueries provider_key', () => {
  it('insertSession 과 updateSessionProviderKey 로 마지막 provider 를 기록한다', () => {
    const db = dbWithMigrations()
    const q = new DbQueries(db)

    q.insertSession({
      id: 's-provider',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 10,
      providerKey: 'claude-bedrock'
    })
    expect(db.prepare('SELECT provider_key FROM sessions WHERE id = ?').get('s-provider')).toEqual({
      provider_key: 'claude-bedrock'
    })

    q.updateSessionProviderKey('s-provider', 'claude', 20)
    expect(
      db.prepare('SELECT provider_key, updated_at FROM sessions WHERE id = ?').get('s-provider')
    ).toEqual({
      provider_key: 'claude',
      updated_at: 20
    })
  })

  it('레거시 NULL provider_key row 를 조회할 수 있다', () => {
    const db = dbWithMigrations()
    insertSession(db, 'legacy')
    const q = new DbQueries(db)

    expect(q.listSessions()[0].provider_key).toBeNull()
  })
})

describe('DbQueries session cwd', () => {
  it('insertSession 으로 cwd 를 영속하고 hasSessionWithCwd 로 화이트리스트한다', () => {
    const db = dbWithMigrations()
    const q = new DbQueries(db)

    q.insertSession({
      id: 's-cwd',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 10,
      cwd: '/repo/orca'
    })

    expect(q.getSessionById('s-cwd')?.cwd).toBe('/repo/orca')
    expect(q.hasSessionWithCwd('/repo/orca')).toBe(true)
    expect(q.hasSessionWithCwd('/etc')).toBe(false)
  })

  it('cwd 미지정(레거시) 세션은 NULL 로 저장돼 화이트리스트에 걸리지 않는다', () => {
    const db = dbWithMigrations()
    insertSession(db, 'legacy-cwd')
    const q = new DbQueries(db)

    expect(q.getSessionById('legacy-cwd')?.cwd).toBeNull()
    // NULL cwd 는 어떤 경로 조회로도 매치되지 않아야 한다.
    expect(q.hasSessionWithCwd('')).toBe(false)
  })
})

describe('DbQueries message complete', () => {
  it('assistant 메시지를 미완료로 만들고 완료 처리할 수 있다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)
    const id = q.appendMessage({
      sessionId: 's1',
      role: 'assistant',
      content: '',
      createdAt: 1,
      complete: 0
    })
    q.appendPart({
      messageId: id,
      type: 'text',
      toolRunId: null,
      payloadJson: JSON.stringify({ text: 'partial' })
    })

    expect(q.loadParts('s1')[0].complete).toBe(0)
    q.markMessageComplete(id)
    expect(q.loadParts('s1')[0].complete).toBe(1)
  })
})

describe('DbQueries attachment 파트 영속 왕복', () => {
  it('user 메시지의 attachment 파트가 loadParts→partFromRow 로 복원된다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)
    const id = q.appendMessage({ sessionId: 's1', role: 'user', content: '이거 봐', createdAt: 1 })
    q.appendPart({
      messageId: id,
      type: 'text',
      toolRunId: null,
      payloadJson: JSON.stringify({ text: '이거 봐' })
    })
    const attachments = [
      { id: 'a1', name: 'pic.png', mimeType: 'image/png', kind: 'image', previewDataUrl: 'data:x' },
      { id: 'a2', name: 'spec.md', mimeType: 'text/markdown', kind: 'file' }
    ]
    q.appendPart({
      messageId: id,
      type: 'attachment',
      toolRunId: null,
      payloadJson: JSON.stringify({ attachments })
    })

    const rows = q.loadParts('s1')
    expect(rows.map((r) => r.type)).toEqual(['text', 'attachment'])
    // 영속 왕복 — attachment 파트가 payload_json 으로 보존된다(파트 복원은 dto.test 가 검증).
    expect(JSON.parse(rows[1].payload_json)).toEqual({ attachments })
  })
})

describe('DbQueries provider usage + limits (0080)', () => {
  function insertSessionWithProvider(
    db: Database.Database,
    id: string,
    providerKey: string | null
  ): void {
    db.prepare(
      `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview, provider_key)
       VALUES (?, 'claude', NULL, NULL, 1, 1, NULL, ?)`
    ).run(id, providerKey)
  }

  it('sumUsageByBoundariesForProvider 는 provider_key 로 turn_usage 를 귀속·집계한다', () => {
    const db = dbWithMigrations()
    insertSessionWithProvider(db, 'sa', 'claude')
    insertSessionWithProvider(db, 'sb', 'claude-bedrock')
    const q = new DbQueries(db)
    q.insertTurnUsage({
      sessionId: 'sa',
      messageId: null,
      createdAt: 20,
      inputTokens: 3,
      outputTokens: 1,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      totalCostUsd: 0.5
    })
    q.insertTurnUsage({
      sessionId: 'sb',
      messageId: null,
      createdAt: 20,
      inputTokens: 10,
      outputTokens: 4,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      totalCostUsd: 2.0
    })

    const claude = q.sumUsageByBoundariesForProvider('claude', {
      dayStart: 0,
      weekStart: 0,
      monthStart: 0
    })
    expect(claude.month.total_cost_usd).toBe(0.5)
    expect(claude.month.input_tokens).toBe(3)

    const bedrock = q.sumUsageByBoundariesForProvider('claude-bedrock', {
      dayStart: 0,
      weekStart: 0,
      monthStart: 0
    })
    expect(bedrock.month.total_cost_usd).toBe(2.0)

    // 알려지지 않은 provider 는 전 구간 0.
    const none = q.sumUsageByBoundariesForProvider('claude-missing', {
      dayStart: 0,
      weekStart: 0,
      monthStart: 0
    })
    expect(none.month.total_cost_usd).toBe(0)
    expect(none.month.input_tokens).toBe(0)
  })

  it('provider_key NULL 세션의 사용량은 어떤 provider 에도 귀속되지 않는다', () => {
    const db = dbWithMigrations()
    insertSessionWithProvider(db, 'snull', null)
    const q = new DbQueries(db)
    q.insertTurnUsage({
      sessionId: 'snull',
      messageId: null,
      createdAt: 20,
      inputTokens: 5,
      outputTokens: 5,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      totalCostUsd: 1.0
    })
    const sums = q.sumUsageByBoundariesForProvider('claude', {
      dayStart: 0,
      weekStart: 0,
      monthStart: 0
    })
    expect(sums.month.total_cost_usd).toBe(0)
  })

  it('getProviderLimit/setProviderLimit 는 upsert 로 마지막 한도를 보존한다', () => {
    const db = dbWithMigrations()
    const q = new DbQueries(db)
    // 미설정이면 null.
    expect(q.getProviderLimit('claude')).toBeNull()

    q.setProviderLimit('claude', 90, 100)
    expect(q.getProviderLimit('claude')).toBe(90)

    // 재설정(upsert) — 덮어쓴다.
    q.setProviderLimit('claude', 120, 200)
    expect(q.getProviderLimit('claude')).toBe(120)

    // 무제한(null) 명시 저장 — 행은 있으나 limit_usd 는 NULL → getter null.
    q.setProviderLimit('claude', null, 300)
    expect(q.getProviderLimit('claude')).toBeNull()
  })

  it('provider_usage_report_cache 는 실제 마이그레이션+쿼리로 upsert/read 를 왕복한다', () => {
    const db = dbWithMigrations()
    const q = new DbQueries(db)

    expect(q.getProviderUsageReport('claude-bedrock')).toBeNull()

    q.upsertProviderUsageReport({
      providerKey: 'claude-bedrock',
      reportJson: JSON.stringify({
        providerKey: 'claude-bedrock',
        fetchedAt: 100,
        source: 'external',
        quota: { usedUsd: 70, limitUsd: 100, remainingUsd: 30 }
      }),
      fetchedAt: 100,
      asOf: 90,
      quotaLimitUsd: 100,
      quotaUsedUsd: 70,
      quotaRemainingUsd: 30,
      updatedAt: 101
    })

    expect(q.getProviderUsageReport('claude-bedrock')).toMatchObject({
      provider_key: 'claude-bedrock',
      fetched_at: 100,
      as_of: 90,
      quota_limit_usd: 100,
      quota_used_usd: 70,
      quota_remaining_usd: 30,
      updated_at: 101
    })

    q.upsertProviderUsageReport({
      providerKey: 'claude-bedrock',
      reportJson: JSON.stringify({
        providerKey: 'claude-bedrock',
        fetchedAt: 200,
        source: 'external',
        quota: { usedUsd: 80, limitUsd: 120, remainingUsd: 40 }
      }),
      fetchedAt: 200,
      asOf: null,
      quotaLimitUsd: 120,
      quotaUsedUsd: 80,
      quotaRemainingUsd: 40,
      updatedAt: 201
    })

    const updated = q.getProviderUsageReport('claude-bedrock')
    expect(updated).toMatchObject({
      provider_key: 'claude-bedrock',
      fetched_at: 200,
      as_of: null,
      quota_limit_usd: 120,
      quota_used_usd: 80,
      quota_remaining_usd: 40,
      updated_at: 201
    })
    expect(JSON.parse(updated?.report_json ?? '{}')).toMatchObject({
      providerKey: 'claude-bedrock',
      quota: { usedUsd: 80, limitUsd: 120, remainingUsd: 40 }
    })
  })
})

describe('schedule_runs', () => {
  it('records scheduler run lifecycle in one row', () => {
    const db = dbWithMigrations()
    const q = new DbQueries(db)

    const id = q.insertScheduleRunStarted({ jobKey: 'usage-recompute', startedAt: 100 })
    q.finishScheduleRun({ id, finishedAt: 120, status: 'success', error: null })

    expect(q.listScheduleRuns('usage-recompute', 10)).toEqual([
      {
        id,
        job_key: 'usage-recompute',
        started_at: 100,
        finished_at: 120,
        status: 'success',
        error: null
      }
    ])
  })
})

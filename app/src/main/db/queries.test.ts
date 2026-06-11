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
     VALUES (?, 'claude-code', NULL, NULL, 1, 1, NULL, NULL)`
  ).run(id)
}

describe('0006_turn_usage migration', () => {
  it('usage_events 데이터를 id 보존 turn_usage/turn_model_usage 로 이관하고 기존 테이블을 제거한다', () => {
    const db = dbBefore0006()
    insertSession(db)
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

  it('sumUsageSince 는 null 비용/토큰을 0으로 집계한다', () => {
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

    expect(q.sumUsageSince(15)).toEqual({
      input_tokens: 3,
      output_tokens: 0,
      cache_creation_input_tokens: 5,
      cache_read_input_tokens: 0,
      total_cost_usd: 0.7
    })
    expect(q.sumUsageSince(999)).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      total_cost_usd: 0
    })
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
      backend: 'claude-code',
      title: null,
      projectId: null,
      createdAt: 10,
      providerKey: 'claude-code-bedrock'
    })
    expect(db.prepare('SELECT provider_key FROM sessions WHERE id = ?').get('s-provider')).toEqual({
      provider_key: 'claude-code-bedrock'
    })

    q.updateSessionProviderKey('s-provider', 'claude-code', 20)
    expect(
      db.prepare('SELECT provider_key, updated_at FROM sessions WHERE id = ?').get('s-provider')
    ).toEqual({
      provider_key: 'claude-code',
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

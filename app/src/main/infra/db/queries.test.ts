import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { applyMigrations } from './migrate'
import { DbQueries } from './queries'

// **현재 스키마 DB 는 정본을 통해서만 만든다.** 목록을 여기 베껴 두면 마이그레이션이 하나
// 늘 때마다 이 픽스처가 조용히 뒤처진다 — 0017 이 그렇게 터졌고(생성자 statement 준비 실패)
// 0013 은 아무도 안 죽인 채 스키마만 갈라져 있었다.
function dbWithMigrations(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  return db
}

function insertSession(db: Database.Database, id = 's1'): void {
  db.prepare(
    `INSERT INTO sessions (id, backend, title, project_id, created_at, updated_at, last_message_preview, provider_key)
     VALUES (?, 'claude', NULL, NULL, 1, 1, NULL, NULL)`
  ).run(id)
}

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
      contextWindow: null,
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
      contextWindow: null,
      costUsd: null
    })
    q.insertTurnModelUsage({
      turnUsageId: latest,
      model: 'claude-opus-4-5',
      inputTokens: 50,
      outputTokens: null,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      contextWindow: null,
      costUsd: null
    })

    const row = q.getLatestTurnUsage('s1')
    expect(row?.turn.id).toBe(latest)
    expect(row?.modelUsage.map((m) => m.model)).toEqual(['claude-opus-4-5', 'claude-haiku-4'])
  })

  it('sumSessionCostUsd 는 세션 한정 비용 총합을 반환하고 null 비용/무행을 0 으로 본다', () => {
    const db = dbWithMigrations()
    insertSession(db)
    const q = new DbQueries(db)
    const base = {
      messageId: null,
      inputTokens: null,
      outputTokens: null,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null
    }
    q.insertTurnUsage({ ...base, sessionId: 's1', createdAt: 1, totalCostUsd: 0.1 })
    q.insertTurnUsage({ ...base, sessionId: 's1', createdAt: 2, totalCostUsd: 0.25 })
    q.insertTurnUsage({ ...base, sessionId: 's1', createdAt: 3, totalCostUsd: null })

    expect(q.sumSessionCostUsd('s1')).toBeCloseTo(0.35, 10)
    expect(q.sumSessionCostUsd('없는-세션')).toBe(0)
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
      contextWindow: null,
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
      contextWindow: null,
      costUsd: 0.3
    })
    q.insertTurnModelUsage({
      turnUsageId: turn1,
      model: 'claude-haiku-4',
      inputTokens: 1,
      outputTokens: null,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: 100,
      contextWindow: null,
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
      contextWindow: null,
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

describe('DbQueries pinned (0129)', () => {
  it('세션 고정 토글이 pinned_at 을 시각/null 로 왕복한다', () => {
    const db = dbWithMigrations()
    insertSession(db, 's-pin')
    const q = new DbQueries(db)

    // 기본은 미고정(NULL).
    expect(q.listSessions()[0].pinned_at).toBeNull()

    q.setSessionPinned('s-pin', 1234)
    expect(q.listSessions()[0].pinned_at).toBe(1234)

    q.setSessionPinned('s-pin', null)
    expect(q.listSessions()[0].pinned_at).toBeNull()
  })

  it('프로젝트 고정 토글이 pinned_at 을 시각/null 로 왕복한다', () => {
    const db = dbWithMigrations()
    const q = new DbQueries(db)
    q.insertProject({ id: 'p-pin', name: 'P', instructions: '', createdAt: 1 })

    expect(q.getProject('p-pin')?.pinned_at).toBeNull()

    q.setProjectPinned('p-pin', 5678)
    expect(q.getProject('p-pin')?.pinned_at).toBe(5678)
    expect(q.listProjects()[0].pinned_at).toBe(5678)

    q.setProjectPinned('p-pin', null)
    expect(q.getProject('p-pin')?.pinned_at).toBeNull()
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

  // 0186 — asOf 는 WHERE 하한이 아니라 조건부 SUM 의 경계다. 하한을 올려 재사용하면 같은
  // 스캔에서 나오는 week 가 asOf 이전 사용분을 잃는다(주간은 언제나 로컬 전량).
  it('as_of 가 이번 주 안이어도 week 가 온전하다', () => {
    const db = dbWithMigrations()
    insertSessionWithProvider(db, 'sw', 'claude')
    const q = new DbQueries(db)
    const usd = (createdAt: number, totalCostUsd: number): void => {
      q.insertTurnUsage({
        sessionId: 'sw',
        messageId: null,
        createdAt,
        inputTokens: 1,
        outputTokens: 1,
        cacheCreationInputTokens: null,
        cacheReadInputTokens: null,
        totalCostUsd
      })
    }
    // 주 시작(100) 이후 3건. asOf=300 이 이번 주 한가운데 있다.
    usd(150, 1)
    usd(250, 2)
    usd(400, 4)

    const sums = q.sumUsageByBoundariesForProvider(
      'claude',
      { dayStart: 100, weekStart: 100, monthStart: 100 },
      300
    )

    // week 는 asOf 와 무관하게 전량(1+2+4).
    expect(sums.week.total_cost_usd).toBe(7)
    expect(sums.month.total_cost_usd).toBe(7)
    // delta 는 asOf 이후만(4).
    expect(sums.monthDeltaCostUsd).toBe(4)
  })

  it('asOf 를 생략하면 delta 가 월 전체와 같다', () => {
    const db = dbWithMigrations()
    insertSessionWithProvider(db, 'sd', 'claude')
    const q = new DbQueries(db)
    q.insertTurnUsage({
      sessionId: 'sd',
      messageId: null,
      createdAt: 150,
      inputTokens: 1,
      outputTokens: 1,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      totalCostUsd: 3
    })

    const sums = q.sumUsageByBoundariesForProvider('claude', {
      dayStart: 100,
      weekStart: 100,
      monthStart: 100
    })
    expect(sums.monthDeltaCostUsd).toBe(3)
    expect(sums.month.total_cost_usd).toBe(3)
  })
})

// 0186 — 0183 r2 가 접근자를 지워 고아가 됐던 테이블(마이그레이션 0014)에 세입자를 되돌린다.
describe('provider usage report cache (0014)', () => {
  it('provider usage report 왕복', () => {
    const db = dbWithMigrations()
    const q = new DbQueries(db)

    expect(q.getProviderUsageReport('claude-gateway')).toBeUndefined()

    q.upsertProviderUsageReport({
      providerKey: 'claude-gateway',
      reportJson: JSON.stringify({ baselineUsable: true, raw: { anything: 1 } }),
      fetchedAt: 1000,
      asOf: 900,
      quotaLimitUsd: 500,
      quotaUsedUsd: 312,
      quotaRemainingUsd: 188,
      updatedAt: 1000
    })

    const row = q.getProviderUsageReport('claude-gateway')
    expect(row).toMatchObject({
      provider_key: 'claude-gateway',
      fetched_at: 1000,
      as_of: 900,
      quota_limit_usd: 500,
      quota_used_usd: 312,
      quota_remaining_usd: 188
    })
    expect(JSON.parse(row!.report_json)).toEqual({ baselineUsable: true, raw: { anything: 1 } })
  })

  it('같은 provider 재수집은 upsert 로 최신 1행만 남긴다', () => {
    const db = dbWithMigrations()
    const q = new DbQueries(db)
    const put = (asOf: number, used: number): void =>
      q.upsertProviderUsageReport({
        providerKey: 'claude-gateway',
        reportJson: '{}',
        fetchedAt: asOf + 10,
        asOf,
        quotaLimitUsd: 500,
        quotaUsedUsd: used,
        quotaRemainingUsd: null,
        updatedAt: asOf + 10
      })

    put(900, 312)
    put(1900, 280) // 원격 correction 으로 내려갈 수 있다 — 그대로 덮는다.

    const row = q.getProviderUsageReport('claude-gateway')
    expect(row?.as_of).toBe(1900)
    expect(row?.quota_used_usd).toBe(280)
    expect(
      (db.prepare('SELECT COUNT(*) AS n FROM provider_usage_report_cache').get() as { n: number }).n
    ).toBe(1)
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

// 0017 `sessions.extra_dirs` 왕복 (AC13) — 컴포저 참조 경로가 세션 출생 시 고정되는 자리다.
// 빈 배열과 미지정은 **같은 NULL** 로 접는다: 읽는 쪽이 두 표현을 구분할 이유가 없다.
describe('DbQueries — sessions.extra_dirs 왕복', () => {
  const insert = (db: Database.Database, id: string, extraDirs?: string[] | null): void => {
    new DbQueries(db).insertSession({
      id,
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 1,
      cwd: '/repo',
      ...(extraDirs === undefined ? {} : { extraDirs })
    })
  }

  it('배열을 JSON 문자열로 저장하고 그대로 돌려준다', () => {
    const db = dbWithMigrations()
    insert(db, 's1', ['/refs/a', '/refs/b'])

    const row = new DbQueries(db).getSessionById('s1')

    expect(row?.extra_dirs).toBe('["/refs/a","/refs/b"]')
    expect(JSON.parse(row?.extra_dirs ?? 'null')).toEqual(['/refs/a', '/refs/b'])
  })

  it('빈 배열·null·미지정은 전부 NULL 이다', () => {
    const db = dbWithMigrations()
    insert(db, 'empty', [])
    insert(db, 'null', null)
    insert(db, 'absent', undefined)

    const q = new DbQueries(db)
    expect(q.getSessionById('empty')?.extra_dirs).toBeNull()
    expect(q.getSessionById('null')?.extra_dirs).toBeNull()
    expect(q.getSessionById('absent')?.extra_dirs).toBeNull()
  })

  it('원소가 하나여도 배열 형태를 유지한다', () => {
    const db = dbWithMigrations()
    insert(db, 's1', ['/refs/only'])

    expect(JSON.parse(new DbQueries(db).getSessionById('s1')?.extra_dirs ?? 'null')).toEqual([
      '/refs/only'
    ])
  })

  it('listSessions 행도 같은 값을 싣는다 — 목록/단건이 갈라지지 않는다', () => {
    const db = dbWithMigrations()
    insert(db, 's1', ['/refs/a'])

    const listed = new DbQueries(db).listSessions().find((row) => row.id === 's1')

    expect(listed?.extra_dirs).toBe('["/refs/a"]')
  })
})

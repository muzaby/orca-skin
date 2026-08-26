import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import migration0001 from '../../infra/db/migrations/0001_initial.sql?raw'
import migration0002 from '../../infra/db/migrations/0002_projects.sql?raw'
import migration0003 from '../../infra/db/migrations/0003_messages_fts.sql?raw'
import migration0004 from '../../infra/db/migrations/0004_message_parts.sql?raw'
import migration0005 from '../../infra/db/migrations/0005_usage_events.sql?raw'
import migration0006 from '../../infra/db/migrations/0006_turn_usage.sql?raw'
import migration0007 from '../../infra/db/migrations/0007_title_source.sql?raw'
import migration0008 from '../../infra/db/migrations/0008_provider_key.sql?raw'
import migration0009 from '../../infra/db/migrations/0009_message_complete.sql?raw'
import migration0010 from '../../infra/db/migrations/0010_session_cwd.sql?raw'
import migration0011 from '../../infra/db/migrations/0011_session_lineage.sql?raw'
import migration0014 from '../../infra/db/migrations/0014_provider_usage_report_cache.sql?raw'
import migration0015 from '../../infra/db/migrations/0015_pinned.sql?raw'
import migration0016 from '../../infra/db/migrations/0016_turn_model_context_window.sql?raw'
import migration0017 from '../../infra/db/migrations/0017_session_extra_dirs.sql?raw'
import migration0012 from '../../infra/db/migrations/0012_provider_limits.sql?raw'
import { DbQueries } from '../../infra/db/queries'
import { materializeContinuityArrival } from './fork'

function makeDb(): { db: Database.Database; q: DbQueries } {
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
    migration0012,
    migration0014,
    migration0015,
    migration0016,
    migration0017
  ]) {
    db.exec(sql)
  }
  return { db, q: new DbQueries(db) }
}

function seedParent(q: DbQueries): void {
  q.insertSession({ id: 'parent', backend: 'claude', title: '원본', projectId: null, createdAt: 1 })
  const u = q.appendMessage({ sessionId: 'parent', role: 'user', content: '질문', createdAt: 1 })
  q.appendPart({ messageId: u, type: 'text', toolRunId: null, payloadJson: '{"text":"질문"}' })
  const a = q.appendMessage({ sessionId: 'parent', role: 'assistant', content: '답', createdAt: 2 })
  q.appendPart({ messageId: a, type: 'text', toolRunId: null, payloadJson: '{"text":"답"}' })
  q.appendPart({
    messageId: a,
    type: 'tool_call',
    toolRunId: 'tr1',
    payloadJson: '{"toolName":"Read","args":{}}'
  })
}

describe('materializeContinuityArrival', () => {
  it('fork — 원본 messages+parts 를 idx/순서 보존 복사하고 lineage(fork) 를 남긴다', () => {
    const { q } = makeDb()
    seedParent(q)
    q.insertSession({ id: 'child', backend: 'claude', title: null, projectId: null, createdAt: 3 })

    materializeContinuityArrival(q, {
      childSessionId: 'child',
      parentSessionId: 'parent',
      relation: 'fork',
      createdAt: 3
    })

    const parts = q.loadParts('child')
    // 복사 이력 + '분기된 지점' 마커(r5) — 마커는 복사분 바로 뒤(새 발화보다 앞).
    expect(parts.map((p) => [p.role, p.type])).toEqual([
      ['user', 'text'],
      ['assistant', 'text'],
      ['assistant', 'tool_call'],
      ['assistant', 'fork_boundary']
    ])
    expect(parts[2].tool_run_id).toBe('tr1')
    // 원본 idx 보존 → 이후 새 발화(appendMessage MAX+1)는 복사 이력·마커 뒤에 온다.
    const next = q.appendMessage({ sessionId: 'child', role: 'user', content: '새', createdAt: 4 })
    q.appendPart({ messageId: next, type: 'text', toolRunId: null, payloadJson: '{"text":"새"}' })
    const after = q.loadParts('child')
    expect(after[after.length - 1].message_idx).toBe(3)

    expect(q.getLineage('child')).toMatchObject({
      child_session_id: 'child',
      parent_session_id: 'parent',
      relation: 'fork',
      fork_point_message_idx: null
    })
    // 원본 무변경.
    expect(q.loadParts('parent')).toHaveLength(3)
  })

  it('handoff — display 복사 없이 lineage(handoff) 만 남긴다', () => {
    const { q } = makeDb()
    seedParent(q)
    q.insertSession({ id: 'child', backend: 'claude', title: null, projectId: null, createdAt: 3 })

    materializeContinuityArrival(q, {
      childSessionId: 'child',
      parentSessionId: 'parent',
      relation: 'handoff',
      createdAt: 3
    })

    expect(q.loadParts('child')).toHaveLength(0)
    expect(q.getLineage('child')).toMatchObject({ relation: 'handoff' })
  })

  it('insertLineage 는 멱등(같은 child 재시도에 안전)', () => {
    const { q } = makeDb()
    seedParent(q)
    q.insertSession({ id: 'child', backend: 'claude', title: null, projectId: null, createdAt: 3 })
    q.insertLineage({
      childSessionId: 'child',
      parentSessionId: 'parent',
      relation: 'handoff',
      forkPointMessageIdx: null,
      createdAt: 3
    })
    q.insertLineage({
      childSessionId: 'child',
      parentSessionId: 'parent',
      relation: 'handoff',
      forkPointMessageIdx: null,
      createdAt: 4
    })
    expect(q.getLineage('child')?.created_at).toBe(3)
  })

  it('세션 삭제 시 lineage 가 CASCADE 로 정리된다', () => {
    const { q } = makeDb()
    seedParent(q)
    q.insertSession({ id: 'child', backend: 'claude', title: null, projectId: null, createdAt: 3 })
    materializeContinuityArrival(q, {
      childSessionId: 'child',
      parentSessionId: 'parent',
      relation: 'fork',
      createdAt: 3
    })
    q.deleteSession('parent')
    expect(q.getLineage('child')).toBeUndefined()
    // 자식 복사분(+분기 마커)은 독립 세션이라 살아남는다.
    expect(q.loadParts('child')).toHaveLength(4)
  })
})

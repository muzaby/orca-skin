// 0330 W-043 — Windows 실측용 저장 세션 시드(측정 전용, 제품 코드 아님).
//
// 세 하네스마다 S-E1(같은 최신 턴 + 과거 N턴) · S-E5(100턴 중 63턴에만 검색어) · S-E4(큰 최신 턴)
// 세션을 하네스 원본 없이 DB 사본(`native_history_snapshots`·`native_history_messages`)으로 쓴다.
// 스키마는 가장 오래된 측정 빌드에 맞춰 `--until` 이하 마이그레이션만 적용한다 — 뒤 빌드는 부팅 때
// 앞으로 마이그레이션한다(0329 구 DB 경로). 대상 ID 규칙은 `src/shared/message-id.ts`
// `nativeOnlyMessageId`와 같다(로컬 행이 없는 원본 메시지).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const HARNESSES = {
  'claude-code': { backend: 'claude', agentKind: 'code' },
  'claude-work': { backend: 'claude', agentKind: 'work' },
  opencode: { backend: 'opencode', agentKind: 'code' }
}
export const SEARCH_TEXT = '센서 A 측정값 63턴'
export const LATEST_TEXT = '최신 답변 본문'
const SEARCH_TURN = 63
const SEARCH_TURNS = 100

export const displayId = (nativeId) => 'n:' + encodeURIComponent(nativeId)

/** `--until` 이하의 `NNNN_*.sql`만 이름순으로 고른다. */
export function migrationList(names, until = '0035') {
  return names.filter((name) => /^\d{4}_.*\.sql$/.test(name) && name.slice(0, 4) <= until).sort()
}

function turnMessages(sessionId, turn, user, assistants, at) {
  const base = `seed:${sessionId}:${turn}`
  const messages = [
    { id: base + ':u', role: 'user', createdAt: at, parts: [{ type: 'text', text: user }] }
  ]
  assistants.forEach((parts, k) =>
    messages.push({ id: `${base}:a${k}`, role: 'assistant', createdAt: at + 1 + k, parts })
  )
  return messages
}
const text = (value) => [{ type: 'text', text: value }]
// 20만 원소를 `push(...)`로 펼치면 호출 스택을 넘는다(0325 T01과 같은 원인) — 하나씩 붙인다.
const append = (all, items) => {
  for (const item of items) all.push(item)
}

/** 세션 정의와 H1 대상을 만든다. `sizes`는 IT가 줄여 쓴다. */
export function seedSpec({ turns = [1, 100, 10000], large = true, cwd = 'seed-work' } = {}) {
  const sessions = []
  const targets = {}
  let clock = 1_700_000_000_000
  for (const [harness, kind] of Object.entries(HARNESSES)) {
    const add = (variant, build) => {
      const id = `seed-${harness}-${variant}`
      const messages = build(id)
      sessions.push({
        id,
        harness,
        ...kind,
        title: `시드 ${harness} ${variant}`,
        cwd,
        messages,
        updatedAt: (clock += 1000)
      })
      return { id, messages }
    }
    const history = (id, past, latest) => {
      const all = []
      for (let t = 1; t <= past; t++)
        append(all, turnMessages(id, t, `질문 ${t}`, [text(`답변 ${t}`)], t * 10))
      append(all, turnMessages(id, past + 1, '최신 질문', latest, (past + 1) * 10))
      return all
    }
    for (const n of turns) {
      const { id, messages } = add(`turns-${n}`, (sid) =>
        history(sid, n, [text(`${LATEST_TEXT} — ${harness}`)])
      )
      targets[`S-E1/${harness}/turns-${n}`] = {
        kind: 'first-body',
        sessionId: id,
        messageId: displayId(messages.at(-1).id),
        expectText: LATEST_TEXT
      }
    }
    const search = add('search-100', (sid) => {
      const all = []
      for (let t = 1; t <= SEARCH_TURNS; t++)
        append(
          all,
          turnMessages(
            sid,
            t,
            `질문 ${t}`,
            [text(t === SEARCH_TURN ? `${SEARCH_TEXT} 보고` : `답변 ${t}`)],
            t * 10
          )
        )
      return all
    })
    const hit = search.messages.find((m) => m.id === `seed:${search.id}:${SEARCH_TURN}:a0`)
    for (const input of ['click', 'enter'])
      targets[`S-E5/${harness}/${input}`] = {
        kind: 'search-target',
        sessionId: search.id,
        messageId: displayId(hit.id),
        expectText: SEARCH_TEXT
      }
    if (large) {
      add('large-4mib', (sid) => history(sid, 1, [text('x'.repeat(4 * 1024 * 1024))]))
      add('msg-600', (sid) =>
        history(
          sid,
          1,
          Array.from({ length: 599 }, (_, k) => text(`조각 ${k}`))
        )
      )
      add('empty-200k', (sid) =>
        history(
          sid,
          1,
          Array.from({ length: 199_999 }, () => [])
        )
      )
    }
  }
  return { sessions, targets }
}

/** 마이그레이션 ≤ until 을 적용하고 세션을 쓴다. `db`는 better-sqlite3 형(exec·prepare·transaction). */
export function writeSeed(db, spec, { migrationsDir, until = '0035', now = Date.now } = {}) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
  )
  const record = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
  const applied = migrationList(readdirSync(migrationsDir), until)
  for (const name of applied)
    db.transaction(() => {
      db.exec(readFileSync(join(migrationsDir, name), 'utf8'))
      record.run(name.slice(0, -4), now())
    })()
  const session = db.prepare(
    'INSERT INTO sessions (id, backend, agent_kind, title, cwd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const snapshot = db.prepare(
    'INSERT INTO native_history_snapshots (session_id, payload_json, local_frontier, synced_at) VALUES (?, ?, 0, ?)'
  )
  const search = db.prepare(
    'INSERT INTO native_history_messages (session_id, native_id, role, created_at, content) VALUES (?, ?, ?, ?, ?)'
  )
  db.transaction(() => {
    for (const s of spec.sessions) {
      session.run(s.id, s.backend, s.agentKind, s.title, s.cwd, s.updatedAt, s.updatedAt)
      snapshot.run(
        s.id,
        JSON.stringify({
          sessionId: s.id,
          cwd: s.cwd,
          sourceKey: 'root',
          revision: 'seed-1',
          messages: s.messages
        }),
        s.updatedAt
      )
      for (const m of s.messages) {
        const body = m.parts.map((p) => p.text ?? '').join('')
        if (body) search.run(s.id, m.id, m.role, m.createdAt, body)
      }
    }
  })()
  return applied
}

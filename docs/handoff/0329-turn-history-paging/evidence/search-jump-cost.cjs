// 저장소 루트에서 실행한다 (Windows, macOS, Linux).
// node docs/handoff/0329-turn-history-paging/evidence/search-jump-cost.cjs
// app 의존성과 Electron ABI에 맞는 better-sqlite3가 필요하다.
// 결과는 JSONL로 출력한다. 임시 디렉터리와 메모리 DB에는 합성 데이터만 쓴다.
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const os = require('node:os')
const path = require('node:path')
const { performance } = require('node:perf_hooks')

const app = path.resolve(__dirname, '../../../../app')
const fromApp = createRequire(path.join(app, 'package.json'))
const session = 'session-a'
const generation = 1

// 현재 트리의 검색·조립·턴 경계를 사용한다. 네이티브 모듈은 앱의 Electron에서 직접 로드한다.
const productionExports = [
  "export { DbQueries } from './src/main/infra/db/queries'",
  "export { loadSession } from './src/main/features/history/reader'",
  "export { localMessages } from './src/main/features/history/native-projection'",
  "export { isTurnStart } from './src/renderer/src/features/chat/lib/transcript/turnStart'"
]

function runInElectron() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-search-cost-'))
  try {
    fromApp('esbuild').buildSync({
      absWorkingDir: app,
      stdin: { contents: productionExports.join('\n'), resolveDir: app, loader: 'ts' },
      outfile: path.join(temporaryRoot, 'reader.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      define: { 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' },
      external: ['electron', 'better-sqlite3']
    })
    const run = spawnSync(fromApp('electron'), [__filename, '--worker', temporaryRoot], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit'
    })
    if (run.error) throw run.error
    if (run.status !== 0) throw new Error('Electron measurement failed: ' + (run.signal ?? run.status))
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

function createFixtureDatabase(Database, file) {
  const db = new Database(file)
  const migrations = path.join(app, 'src/main/infra/db/migrations')
  const files = fs.readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()
  for (const name of files) db.exec(fs.readFileSync(path.join(migrations, name), 'utf8'))
  db.prepare(`INSERT INTO sessions (id, backend, created_at, updated_at, title)
    VALUES (?, 'claude', 1, 1, 'Fixture')`).run(session)
  return db
}

function measure(operation, samples) {
  operation() // 같은 연결에서 1회 예열
  const durations = []
  for (let i = 0; i < samples; i++) {
    const start = performance.now()
    operation()
    durations.push(performance.now() - start)
  }
  durations.sort((a, b) => a - b)
  function percentile(p) {
    return Number(durations[Math.ceil(samples * p) - 1].toFixed(3))
  }
  return { samples, medianMs: percentile(0.5), p95Ms: percentile(0.95) }
}

function databaseUsedBytes(db) {
  const pages = db.pragma('page_count', { simple: true }) - db.pragma('freelist_count', { simple: true })
  return pages * db.pragma('page_size', { simple: true })
}

function seedLocalConversation(db, count) {
  const message = db.prepare(`INSERT INTO messages
    (session_id, role, content, created_at, idx, message_key) VALUES (?, ?, ?, ?, ?, ?)`)
  const part = db.prepare(`INSERT INTO message_parts
    (message_id, idx, type, payload_json) VALUES (?, 0, 'text', ?)`)
  db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const prefix = i === Math.floor(count / 2) ? 'uniquehit ' : 'ordinary '
      const text = prefix + 'payload '.repeat(10) + i
      const role = i % 2 === 0 ? 'user' : 'assistant'
      const key = i % 3 === 0 ? null : 'stable:' + i
      const result = message.run(session, role, text, i, i, key)
      part.run(result.lastInsertRowid, JSON.stringify({ text }))
    }
  })()
}

function buildLocalLocator(db, isTurnStart) {
  // 원본 로컬 메시지 헤더로 구성한 실험용 투영. 본문·FTS 사본은 만들지 않는다.
  // native/복구 정규화나 전체 E 투영 마이그레이션은 이 구축 측정에서 제외된다.
  db.transaction(() => {
    db.exec(`CREATE TABLE click_locator (
      sid TEXT NOT NULL, gen INTEGER NOT NULL, ref INTEGER NOT NULL,
      display TEXT NOT NULL, turn INTEGER NOT NULL, ord INTEGER NOT NULL,
      PRIMARY KEY(sid, gen, ref)
    ) WITHOUT ROWID;
    CREATE INDEX click_locator_turn ON click_locator(sid, gen, turn, ord);`)
    const record = db.prepare('INSERT INTO click_locator VALUES (?, ?, ?, ?, ?, ?)')
    const headers = db.prepare('SELECT id, idx, role, message_key FROM messages WHERE session_id=? ORDER BY idx').all(session)
    let previous
    let turn = -1
    for (const header of headers) {
      if (isTurnStart(previous, header)) turn++
      record.run(session, generation, header.id, header.message_key ?? 'm:' + header.id, turn, header.idx)
      previous = header
    }
  })()
}

function prototypeReader(db, localMessages) {
  const locate = db.prepare('SELECT turn, display FROM click_locator WHERE sid=? AND gen=? AND ref=?')
  const turnSql = `SELECT m.id AS message_id, m.message_key, m.role, m.created_at, m.complete,
      m.idx AS message_idx, p.idx AS part_idx, p.type, p.tool_run_id, p.payload_json
    FROM click_locator l
    JOIN messages m ON m.id = l.ref AND m.session_id = l.sid
    JOIN message_parts p ON p.message_id = m.id
    WHERE l.sid=? AND l.gen=? AND l.turn=? ORDER BY l.ord, p.idx`
  const readTurn = db.prepare(turnSql)
  const queryPlan = db.prepare('EXPLAIN QUERY PLAN ' + turnSql).all(session, generation, 1)
  return {
    queryPlan: queryPlan.map((row) => row.detail),
    read(hit, expectedGeneration) {
      const target = locate.get(hit.session_id, expectedGeneration, hit.message_id)
      if (!target) return null
      return {
        key: target.display,
        messages: localMessages(readTurn.all(hit.session_id, expectedGeneration, target.turn))
      }
    }
  }
}

function timeLocalSearchAndClick(db, production, count) {
  seedLocalConversation(db, count)
  const queries = new production.DbQueries(db)
  const full = () => production.loadSession(queries, session, () => '/fixture').messages
  const transcript = full()
  const [hit] = queries.searchMessages('uniquehit')
  const targetIndex = Math.floor(count / 2)
  assert.equal(hit.message_id, targetIndex + 1)
  const baseBytes = databaseUsedBytes(db)
  const buildStart = performance.now()
  buildLocalLocator(db, production.isTurnStart)
  const buildMs = Number((performance.now() - buildStart).toFixed(1))
  const addedBytes = databaseUsedBytes(db) - baseBytes
  const reader = prototypeReader(db, production.localMessages)
  const indexedClick = () => reader.read(hit, generation)
  const target = indexedClick()
  const turnStart = Math.floor(targetIndex / 2) * 2
  assert.equal(transcript[targetIndex].id, target.key)
  assert.deepEqual(target.messages, transcript.slice(turnStart, turnStart + 2))
  assert.equal(reader.read({ ...hit, session_id: 'other' }, generation), null)
  assert.equal(reader.read(hit, generation + 1), null)
  // 전량 조립 대안의 대상 키는 이미 아는 것으로 두어 키 변환 비용을 부과하지 않는다.
  const fullClick = () => assert(full().find((message) => message.id === target.key))
  // 바이트는 messages JSON의 UTF-8 길이. 페이지 메타·IPC·DOM·화면 paint는 포함하지 않는다.
  return {
    count, addedBytes, buildMs,
    fullRows: transcript.length, turnRows: target.messages.length,
    fullPayloadBytes: Buffer.byteLength(JSON.stringify(transcript)),
    turnPayloadBytes: Buffer.byteLength(JSON.stringify(target.messages)),
    searchUnique: measure(() => queries.searchMessages('uniquehit'), 101),
    searchBroad: measure(() => queries.searchMessages('ordinary'), 9),
    indexedClick: measure(indexedClick, 501),
    fullClick: measure(fullClick, 11),
    queryPlan: reader.queryPlan
  }
}

function checkResultIdentities(db, { DbQueries, loadSession }) {
  // 실제 FTS 결과와 실제 full reader가 정한 표시 키를 독립적으로 대조하는 소형 fixture.
  // 이 확인은 native/복구의 직접 이동이나 기준 세대 재검증을 구현한 것으로 세지 않는다.
  const queries = new DbQueries(db)
  const native = queries.nativeHistory
  function local(role, text, messageKey) {
    const id = queries.appendMessage({ sessionId: session, role, content: text, createdAt: 1, messageKey })
    queries.appendPart({ messageId: id, type: 'text', toolRunId: null, payloadJson: JSON.stringify({ text }) })
    return id
  }
  function fixtureMessage(id, role, text) {
    return { ...(id ? { id } : {}), role, createdAt: 1, parts: [{ type: 'text', text }] }
  }
  function searchable(message, index) {
    return { id: message.id ?? String(index), role: message.role, createdAt: message.createdAt, content: message.parts[0].text }
  }
  function expectKey(term, expected, expectedSign) {
    const hits = queries.searchMessages(term)
    assert.equal(hits.length, 1)
    const visible = loadSession(queries, session, () => '/fixture').messages
    const matches = visible.filter((message) => message.parts.some((part) => part.text === term))
    assert.equal(matches.length, 1)
    assert.equal(matches[0].id, expected)
    assert.equal(Math.sign(hits[0].message_id), expectedSign)
    return { term, searchRow: hits[0].message_id, displayKey: matches[0].id }
  }
  const owner = local('user', 'boundphrase', 'u:request-a')
  const legacy = local('assistant', 'legacyphrase')
  native.bind(owner, 'source:user/a')
  const snapshot = [
    { ...fixtureMessage('canonical/a', 'user', 'boundphrase'), sourceIds: ['source:user/a'] },
    fixtureMessage('orig:b/2', 'assistant', 'purephrase')
  ]
  assert(native.replace({
    sessionId: session, expectedVersion: native.observe(session).version, frontier: owner,
    payloadJson: JSON.stringify({ messages: snapshot }), messages: snapshot.map(searchable), now: 10
  }))
  const observed = [
    expectKey('legacyphrase', 'm:' + legacy, 1),
    expectKey('boundphrase', 'u:request-a', -1),
    expectKey('purephrase', 'n:orig%3Ab%2F2', -1)
  ]
  const archive = [
    fixtureMessage('u:orig', 'user', 'savedphrase'),
    fixtureMessage(undefined, 'assistant', 'archivephrase')
  ]
  native.prepareRecovery({
    sessionId: session, nativeId: 'native-2', freshStart: false, archiveJson: JSON.stringify(archive),
    frontier: legacy, expectedVersion: native.observe(session).version, messages: archive.map(searchable)
  })
  observed.push(expectKey('savedphrase', 'u:orig', -1), expectKey('archivephrase', 'x:1', -1))
  return observed
}

function runWorker(temp) {
  const production = require(path.join(temp, 'reader.cjs'))
  const Database = fromApp('better-sqlite3')
  const identityDb = createFixtureDatabase(Database, ':memory:')
  try {
    console.log(JSON.stringify({
      platform: process.platform, arch: process.arch, cpu: os.cpus()[0].model,
      node: process.versions.node, sqlite: identityDb.prepare('SELECT sqlite_version() AS v').get().v
    }))
    console.log(JSON.stringify({ identities: checkResultIdentities(identityDb, production) }))
  } finally {
    identityDb.close()
  }
  for (const count of [1_000, 10_000, 100_000]) {
    const db = createFixtureDatabase(Database, path.join(temp, count + '.sqlite'))
    try {
      console.log(JSON.stringify(timeLocalSearchAndClick(db, production, count)))
    } finally {
      db.close()
    }
  }
}

if (process.argv[2] === '--worker') runWorker(process.argv[3])
else runInElectron()

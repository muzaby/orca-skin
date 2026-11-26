import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HARNESSES,
  LATEST_TEXT,
  SEARCH_TEXT,
  displayId,
  migrationList,
  seedSpec,
  writeSeed
} from './history-seed.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
const migrations = join(here, '../src/main/infra/db/migrations')
const full = seedSpec()
const session = (harness, variant) =>
  full.sessions.find((s) => s.id === `seed-${harness}-${variant}`)
const bodyOf = (m) => m.parts.map((p) => p.text ?? '').join('')

test('S1 harness rows carry distinct backend and agent kind', () => {
  const pairs = Object.keys(HARNESSES).map((h) => {
    const s = session(h, 'turns-1')
    return [h, s.backend, s.agentKind]
  })
  assert.deepEqual(pairs, [
    ['claude-code', 'claude', 'code'],
    ['claude-work', 'claude', 'work'],
    ['opencode', 'opencode', 'code']
  ])
})

test('S2 session sizes per variant', () => {
  for (const h of Object.keys(HARNESSES)) {
    assert.deepEqual(
      [1, 100, 10000].map((n) => session(h, `turns-${n}`).messages.length),
      [4, 202, 20002]
    )
    const search = session(h, 'search-100')
    const hits = search.messages.filter((m) => bodyOf(m).includes('센서 A'))
    assert.equal(hits.length, 1)
    assert.match(hits[0].id, /:63:a0$/)
    const large = session(h, 'large-4mib').messages.at(-1)
    assert.equal(Buffer.byteLength(bodyOf(large)), 4 * 1024 * 1024)
    const latestTurn = (s) => s.messages.filter((m) => m.id.startsWith(`seed:${s.id}:2:`))
    assert.equal(latestTurn(session(h, 'msg-600')).length, 600)
    const empty = latestTurn(session(h, 'empty-200k'))
    assert.equal(empty.length, 200_000)
    assert.equal(empty.filter((m) => m.parts.length === 0).length, 199_999)
  }
})

test('S3 target ids follow the native-only display id rule', () => {
  const t = full.targets['S-E1/claude-code/turns-1']
  const nativeId = 'seed:seed-claude-code-turns-1:2:a0'
  assert.equal(t.messageId, 'n:' + encodeURIComponent(nativeId))
  assert.notEqual(t.messageId, 'n:' + nativeId)
  assert.equal(displayId(nativeId), t.messageId)
})

test('S4 targets point at the latest assistant and the turn-63 hit', () => {
  for (const h of Object.keys(HARNESSES)) {
    for (const n of [1, 100, 10000]) {
      const s = session(h, `turns-${n}`)
      const t = full.targets[`S-E1/${h}/turns-${n}`]
      assert.deepEqual([t.kind, t.sessionId, t.expectText], ['first-body', s.id, LATEST_TEXT])
      assert.equal(t.messageId, displayId(s.messages.at(-1).id))
      assert.notEqual(t.messageId, displayId(s.messages.at(-2).id))
      assert.ok(bodyOf(s.messages.at(-1)).includes(t.expectText))
    }
    const s = session(h, 'search-100')
    const click = full.targets[`S-E5/${h}/click`]
    assert.deepEqual(full.targets[`S-E5/${h}/enter`], click)
    assert.deepEqual(
      [click.kind, click.sessionId, click.expectText],
      ['search-target', s.id, SEARCH_TEXT]
    )
    const id = (turn) => displayId(`seed:${s.id}:${turn}:a0`)
    assert.equal(click.messageId, id(63))
    assert.notEqual(click.messageId, id(62))
    assert.notEqual(click.messageId, id(64))
  }
})

test('S5 migration list honours the inclusive cutoff', () => {
  const names = [
    '0039_c.sql',
    'README.sql',
    '0035_a.sql',
    '0036_b.sql',
    '0001_x.sql',
    'notes.txt',
    '0002_draft.txt',
    '0003-bad.sql'
  ]
  assert.deepEqual(migrationList(names), ['0001_x.sql', '0035_a.sql'])
  assert.deepEqual(migrationList(names, '0036'), ['0001_x.sql', '0035_a.sql', '0036_b.sql'])
  assert.deepEqual(migrationList(names, '0039'), [
    '0001_x.sql',
    '0035_a.sql',
    '0036_b.sql',
    '0039_c.sql'
  ])
})

test('S6 target keys are scenario/harness/load-or-input', () => {
  const expected = Object.keys(HARNESSES).flatMap((h) => [
    ...['turns-1', 'turns-100', 'turns-10000'].map((l) => `S-E1/${h}/${l}`),
    `S-E5/${h}/click`,
    `S-E5/${h}/enter`
  ])
  assert.deepEqual(Object.keys(full.targets).sort(), expected.sort())
  assert.equal(expected.length, 15)
})

test('writeSeed applies the cutoff and writes every session table row', () => {
  const runs = { exec: [], sessions: 0, snapshots: 0, search: 0, migrations: 0 }
  const db = {
    exec: (sql) => runs.exec.push(sql.slice(0, 20)),
    prepare: (sql) => ({
      run: () => {
        if (sql.includes('_migrations')) runs.migrations++
        else if (sql.includes('INTO sessions')) runs.sessions++
        else if (sql.includes('native_history_snapshots')) runs.snapshots++
        else runs.search++
      }
    }),
    transaction: (fn) => fn
  }
  const spec = seedSpec({ turns: [1], large: false })
  const applied = writeSeed(db, spec, { migrationsDir: migrations })
  assert.ok(applied.length > 0 && applied.every((n) => n.slice(0, 4) <= '0035'))
  assert.equal(runs.migrations, applied.length)
  assert.equal(runs.sessions, spec.sessions.length)
  assert.equal(runs.snapshots, spec.sessions.length)
  assert.equal(
    runs.search,
    spec.sessions.reduce((n, s) => n + s.messages.filter((m) => bodyOf(m)).length, 0)
  )
})

const cli = (args) =>
  spawnSync(process.execPath, [join(here, 'seed-history-fixture.mjs'), ...args], {
    encoding: 'utf8'
  })

test('S7 cli refuses a profile folder that already has a database', () => {
  const root = mkdtempSync(join(tmpdir(), 'oo-seed-'))
  try {
    writeFileSync(join(root, 'orcinus-orca.db'), 'keep')
    const r = cli(['--user-data', root, '--migrations', migrations, '--out', join(root, 't.json')])
    assert.equal(r.status, 2)
    assert.equal(readFileSync(join(root, 'orcinus-orca.db'), 'utf8'), 'keep')
    assert.equal(existsSync(join(root, 't.json')), false)
    assert.equal(cli([]).status, 2)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('cli writes db and targets (exit 3 when better-sqlite3 cannot load here)', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'oo-seed-'))
  try {
    const profile = join(root, 'profile')
    mkdirSync(profile)
    const out = join(root, 'targets.json')
    const r = cli(['--user-data', profile, '--migrations', migrations, '--out', out])
    if (r.status === 3) {
      assert.match(r.stderr, /환경 없음/)
      t.diagnostic('환경 없음 — better-sqlite3 ABI 가 이 Node 와 다르다')
      return
    }
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(JSON.parse(readFileSync(out, 'utf8')), full.targets)
    assert.ok(existsSync(join(profile, 'orcinus-orca.db')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

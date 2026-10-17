import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { openFileDatabase } from '../../../infra/db/file-database'
import { nativeSchemaSql } from './legacy-schema.testfixture'
import { LegacyStorageMigration } from './legacy-storage-migration'

const root = mkdtempSync(join(tmpdir(), 'orca-native-migration-'))
const parent = 'ses_000000000000parent'
const child = 'ses_000000000000child'
const userId = 'msg_000000000000user'
const answerId = 'msg_000000000001answer'
const checks: string[] = []
const opened: DB[] = []
type DB = ReturnType<typeof openFileDatabase>
function create(path: string): DB {
  mkdirSync(join(path, '..'), { recursive: true })
  const db = openFileDatabase(path)
  opened.push(db)
  for (const sql of nativeSchemaSql) db.exec(sql)
  return db
}
function state(db: DB): string {
  return JSON.stringify(
    [
      'project',
      'project_directory',
      'session',
      'message',
      'part',
      'todo',
      'event_sequence',
      'event'
    ].map((table) => db.prepare('SELECT * FROM "' + table + '" ORDER BY 1').all())
  )
}
function fixture(name: string): {
  legacyRoot: string
  source: DB
  sourcePath: string
  target: DB
  request: { sessionId: string; cwd: string; targetDatabase: string; nativeData: string }
  close: () => void
} {
  const base = join(root, name)
  const legacyRoot = join(base, 'legacy')
  const cwd = join(base, 'workspace')
  const nativeData = join(base, 'native')
  mkdirSync(cwd, { recursive: true })
  const sourcePath = join(legacyRoot, 'data', 'opencode', 'opencode.db')
  const targetDatabase = join(nativeData, 'opencode.db')
  const source = create(sourcePath)
  const target = create(targetDatabase)
  source
    .prepare(
      'INSERT INTO project(id,worktree,time_created,time_updated,sandboxes) VALUES(?,?,?,?,?)'
    )
    .run('global', cwd, 1, 1, '[]')
  for (const [id, parentId] of [
    [parent, null],
    [child, parent]
  ]) {
    source
      .prepare(
        'INSERT INTO session(id,project_id,parent_id,slug,directory,title,version,time_created,time_updated) VALUES(?,?,?,?,?,?,?,?,?)'
      )
      .run(id, 'global', parentId, 'fixture', cwd, 'Migration fixture', '1.19.0', 1, 1)
    source.prepare('INSERT INTO event_sequence(aggregate_id,seq) VALUES(?,?)').run(id, 0)
    source
      .prepare('INSERT INTO event(id,aggregate_id,seq,type,data) VALUES(?,?,?,?,?)')
      .run('evt_' + id, id, 0, 'session.created.1', JSON.stringify({ sessionID: id }))
  }
  const user = {
    role: 'user',
    time: { created: 1 },
    agent: 'build',
    model: { providerID: 'fixture', modelID: 'fixture' }
  }
  const assistant = {
    role: 'assistant',
    parentID: userId,
    time: { created: 2, completed: 3 },
    finish: 'stop',
    modelID: 'fixture',
    providerID: 'fixture',
    agent: 'build',
    mode: 'build',
    path: { cwd, root: cwd },
    cost: 0,
    tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }
  }
  for (const [id, data] of [
    [userId, user],
    [answerId, assistant]
  ]) {
    source
      .prepare(
        'INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)'
      )
      .run(id, parent, 1, 1, JSON.stringify(data))
    source
      .prepare(
        'INSERT INTO part(id,message_id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?,?)'
      )
      .run(
        'prt_' + id,
        id,
        parent,
        1,
        1,
        JSON.stringify({
          type: 'text',
          text: id === userId ? 'Fixture input' : 'Fixture answer',
          time: { start: 1, end: 3 }
        })
      )
  }
  source
    .prepare(
      'INSERT INTO todo(session_id,content,status,priority,position,time_created,time_updated) VALUES(?,?,?,?,?,?,?)'
    )
    .run(parent, 'Native todo', 'completed', 'medium', 0, 1, 1)
  const request = { sessionId: parent, cwd, targetDatabase, nativeData }
  const close = (): void => {
    source.close()
    target.close()
  }
  return { legacyRoot, source, sourcePath, target, request, close }
}
async function run(): Promise<void> {
  {
    const f = fixture('plain')
    const before = state(f.source)
    const targetBefore = state(f.target)
    const failed = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase,
      phase: (phase) => {
        if (phase === 'messages') throw new Error('injected')
      }
    })
    assert.equal((await failed.migrate(f.request)).status, 'migration-required')
    assert.equal(state(f.target), targetBefore)
    assert.equal(state(f.source), before)
    const migration = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase
    })
    assert.deepEqual(await migration.migrate(f.request), { status: 'migrated' })
    assert.equal(state(f.target), before)
    assert.equal(state(f.source), before)
    // The source remains an archive. A later native deletion must not resurrect it.
    f.target.prepare('DELETE FROM session WHERE id IN (?,?)').run(parent, child)
    assert.equal((await migration.migrate(f.request)).status, 'missing')
    assert.equal((await migration.migrate({ ...f.request, sessionId: child })).status, 'missing')
    assert.equal(f.target.prepare('SELECT count(*) FROM session').pluck().get(), 0)
    f.close()
    checks.push(
      'plain tree/todo/journal preserved; injected rollback; source unchanged; native deletion preserved'
    )
  }
  {
    for (const kind of ['schema', 'workdir', 'multiple', 'lock', 'identity'] as const) {
      const f = fixture('failure-' + kind)
      let expected = ''
      if (kind === 'schema') {
        f.target.exec('ALTER TABLE part ADD COLUMN unsupported TEXT')
        expected = 'unsupported-schema:part'
      }
      if (kind === 'workdir') {
        f.request.cwd = join(f.request.cwd, 'another')
        expected = 'workdir-mismatch'
      }
      if (kind === 'multiple') {
        await f.source.backup(join(f.legacyRoot, 'data', 'opencode', 'opencode-preview.db'))
        expected = 'ambiguous-legacy-database'
      }
      if (kind === 'lock') f.target.exec('BEGIN IMMEDIATE')
      if (kind === 'identity') {
        f.target
          .prepare(
            'INSERT INTO project(id,worktree,time_created,time_updated,sandboxes) VALUES(?,?,?,?,?)'
          )
          .run('global', f.request.cwd, 1, 1, '[]')
        f.target
          .prepare(
            'INSERT INTO session(id,project_id,slug,directory,title,version,time_created,time_updated) VALUES(?,?,?,?,?,?,?,?)'
          )
          .run('ses_existing', 'global', 'existing', f.request.cwd, 'Existing', '1.19.0', 1, 1)
        f.target
          .prepare(
            'INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)'
          )
          .run(userId, 'ses_existing', 1, 1, JSON.stringify({ role: 'user', time: { created: 1 } }))
        expected = 'identity-conflict:message'
      }
      const sourceBefore = state(f.source)
      const targetBefore = state(f.target)
      const migration = new LegacyStorageMigration({
        legacyRoot: f.legacyRoot,
        openDatabase: openFileDatabase
      })
      const result = await migration.migrate(f.request)
      assert.equal(
        result.status,
        kind === 'lock' ? 'busy' : 'migration-required',
        JSON.stringify(result)
      )
      if (expected)
        assert.ok('message' in result && result.message.includes(expected), JSON.stringify(result))
      assert.equal(state(f.source), sourceBefore)
      assert.equal(state(f.target), targetBefore)
      if (f.target.inTransaction) f.target.exec('ROLLBACK')
      f.close()
    }
    checks.push(
      'schema/workdir/ambiguous source/active lock/identity conflicts preserve both databases'
    )
  }
  {
    const f = fixture('partial-marker')
    const before = state(f.source)
    let markers = 0
    const interrupted = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase,
      phase: (phase) => {
        if (phase === 'pending-marker' && ++markers === 1) throw new Error('partial-marker-write')
      }
    })
    assert.equal((await interrupted.migrate(f.request)).status, 'migration-required')
    assert.equal(f.target.prepare('SELECT count(*) FROM session').pluck().get(), 0)
    assert.equal(state(f.source), before)
    const retry = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase
    })
    assert.deepEqual(await retry.migrate(f.request), { status: 'migrated' })
    assert.equal(state(f.target), before)
    f.close()
    checks.push('partial marker write observes rollback and permits safe retry')
  }
  {
    const f = fixture('cross-session-part')
    const foreignSession = 'ses_foreign'
    const foreignMessage = 'msg_foreign'
    for (const db of [f.source, f.target]) {
      if (db === f.target)
        db.prepare(
          'INSERT INTO project(id,worktree,time_created,time_updated,sandboxes) VALUES(?,?,?,?,?)'
        ).run('global', f.request.cwd, 1, 1, '[]')
      db.prepare(
        'INSERT INTO session(id,project_id,slug,directory,title,version,time_created,time_updated) VALUES(?,?,?,?,?,?,?,?)'
      ).run(foreignSession, 'global', 'foreign', f.request.cwd, 'Foreign', '1.19.0', 1, 1)
      db.prepare(
        'INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)'
      ).run(
        foreignMessage,
        foreignSession,
        1,
        1,
        JSON.stringify({ role: 'user', time: { created: 1 } })
      )
    }
    f.source
      .prepare('UPDATE part SET message_id=? WHERE message_id=?')
      .run(foreignMessage, answerId)
    const targetBefore = state(f.target)
    const before = state(f.source)
    const migration = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase
    })
    const result = await migration.migrate(f.request)
    assert.ok(
      'message' in result && result.message.includes('part-message-relation'),
      JSON.stringify(result)
    )
    assert.equal(state(f.target), targetBefore)
    assert.equal(state(f.source), before)
    f.close()
    checks.push('foreign-message part relation cannot contaminate an existing native session')
  }
  {
    const f = fixture('historical-event')
    f.source
      .prepare('INSERT INTO event(id,aggregate_id,seq,type,data) VALUES(?,?,?,?,?)')
      .run(
        'evt_deleted',
        parent,
        1,
        'message.updated.1',
        JSON.stringify({ sessionID: parent, info: { id: 'msg_deleted', sessionID: parent } })
      )
    f.source.prepare('UPDATE event_sequence SET seq=1 WHERE aggregate_id=?').run(parent)
    const before = state(f.source)
    const migration = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase
    })
    assert.deepEqual(await migration.migrate(f.request), { status: 'migrated' })
    assert.equal(state(f.target), before)
    f.close()
    checks.push('historical journal events survive after their projection rows were removed')
  }
  {
    const f = fixture('pending')
    const migration = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase,
      phase: (phase) => {
        if (phase === 'committed') throw new Error('crash-after-commit')
      }
    })
    assert.equal((await migration.migrate(f.request)).status, 'migration-required')
    assert.equal(f.target.prepare('SELECT count(*) FROM session').pluck().get(), 2)
    f.target.prepare('DELETE FROM session').run()
    const result = await migration.migrate(f.request)
    assert.equal(result.status, 'migration-required')
    assert.ok('message' in result && result.message.includes('commit-state-unknown'))
    f.close()
    checks.push('ambiguous committed marker never revives a deleted native session')
  }
  {
    const f = fixture('busy')
    const data = JSON.parse(
      String(
        (f.source.prepare('SELECT data FROM message WHERE id=?').get(answerId) as { data: string })
          .data
      )
    )
    delete data.finish
    delete data.time.completed
    f.source.prepare('UPDATE message SET data=? WHERE id=?').run(JSON.stringify(data), answerId)
    const before = state(f.source)
    const migration = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase
    })
    assert.equal((await migration.migrate(f.request)).status, 'busy')
    assert.equal(state(f.source), before)
    assert.equal(f.target.prepare('SELECT count(*) FROM session').pluck().get(), 0)
    f.close()
    checks.push('unfinished source is busy without target writes')
  }
  {
    const f = fixture('resource')
    f.source.prepare('UPDATE part SET data=? WHERE message_id=?').run(
      JSON.stringify({
        type: 'text',
        text:
          'Full output saved to: ' +
          join(f.legacyRoot, 'data', 'opencode', 'tool-output', 'tool_fixture')
      }),
      answerId
    )
    const before = state(f.source)
    const migration = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase
    })
    const result = await migration.migrate(f.request)
    assert.equal(result.status, 'migration-required')
    assert.ok('message' in result && result.message.includes('tool-output-reference'))
    assert.equal(state(f.source), before)
    assert.equal(f.target.prepare('SELECT count(*) FROM session').pluck().get(), 0)
    f.close()
    checks.push('embedded legacy tool-output reference remains explicitly incomplete')
  }
  {
    const f = fixture('snapshot')
    const suffix = join(
      'snapshot',
      'global',
      createHash('sha1').update(f.request.cwd).digest('hex')
    )
    const sourceSnapshot = join(f.legacyRoot, 'data', 'opencode', suffix)
    mkdirSync(sourceSnapshot, { recursive: true })
    execFileSync('git', ['init', '--bare', sourceSnapshot], { windowsHide: true, stdio: 'ignore' })
    const hash = execFileSync('git', ['--git-dir=' + sourceSnapshot, 'mktree'], {
      windowsHide: true,
      input: '',
      encoding: 'utf8'
    }).trim()
    f.source
      .prepare(
        'INSERT INTO part(id,message_id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?,?)'
      )
      .run(
        'prt_snapshot',
        answerId,
        parent,
        1,
        1,
        JSON.stringify({
          type: 'step-finish',
          snapshot: hash,
          reason: 'stop',
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
        })
      )
    const targetSnapshot = join(f.request.nativeData, suffix)
    const originalAnswer = String(
      (f.source.prepare('SELECT data FROM message WHERE id=?').get(answerId) as { data: string })
        .data
    )
    const alternateAnswer = JSON.parse(originalAnswer)
    alternateAnswer.path.root = join(f.request.cwd, 'other-worktree')
    f.source
      .prepare('UPDATE message SET data=? WHERE id=?')
      .run(JSON.stringify(alternateAnswer), answerId)
    const migration = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase
    })
    const worktree = await migration.migrate(f.request)
    assert.ok(
      'message' in worktree && worktree.message.includes('snapshot-worktree'),
      JSON.stringify(worktree)
    )
    assert.equal(f.target.prepare('SELECT count(*) FROM session').pluck().get(), 0)
    f.source.prepare('UPDATE message SET data=? WHERE id=?').run(originalAnswer, answerId)
    mkdirSync(targetSnapshot, { recursive: true })
    writeFileSync(join(targetSnapshot, 'existing'), 'native-owned')
    const conflict = await migration.migrate(f.request)
    assert.ok(
      'message' in conflict && conflict.message.includes('snapshot-conflict'),
      JSON.stringify(conflict)
    )
    assert.equal(readFileSync(join(targetSnapshot, 'existing'), 'utf8'), 'native-owned')
    // Only our fixture-created conflicting directory is removed for the positive case.
    rmSync(targetSnapshot, { recursive: true })
    const interrupted = new LegacyStorageMigration({
      legacyRoot: f.legacyRoot,
      openDatabase: openFileDatabase,
      phase: (phase) => {
        if (phase === 'resources') throw new Error('after-resource-publish')
      }
    })
    assert.equal((await interrupted.migrate(f.request)).status, 'migration-required')
    assert.equal(f.target.prepare('SELECT count(*) FROM session').pluck().get(), 0)
    assert.equal(
      execFileSync('git', ['--git-dir=' + targetSnapshot, 'cat-file', '-t', hash], {
        encoding: 'utf8',
        windowsHide: true
      }).trim(),
      'tree'
    )
    assert.deepEqual(await migration.migrate(f.request), { status: 'migrated' })
    assert.equal(
      execFileSync('git', ['--git-dir=' + targetSnapshot, 'cat-file', '-t', hash], {
        encoding: 'utf8',
        windowsHide: true
      }).trim(),
      'tree'
    )
    f.close()
    checks.push(
      'snapshot worktree mismatch is incomplete; conflict preserves native resource; verified Git object copied to native root'
    )
  }
}
run()
  .then(() => {
    process.stdout.write(JSON.stringify({ checks }) + '\n')
  })
  .catch((error) => {
    process.stderr.write(String(error?.stack ?? error) + '\n')
    process.exitCode = 1
  })
  .finally(() => {
    for (const db of opened) if (db.open) db.close()
    rmSync(root, { recursive: true, force: true })
  })

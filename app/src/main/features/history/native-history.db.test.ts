import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppMessagePart, LoadedSession } from '../../../shared/ipc'
import type {
  NativeHistoryMessage,
  NativeHistoryResult,
  NativeHistorySnapshot
} from '../../adapters/common/native-history'
import { refreshNativeHistory } from './native-sync'
import { loadSession } from './reader'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'

let db: Database.Database
let queries: DbQueries

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  queries = new DbQueries(db)
  queries.insertProject({ id: 'project', name: 'Project', instructions: '', createdAt: 1 })
  queries.insertSession({
    id: 'session',
    backend: 'opencode',
    title: 'Native history',
    projectId: 'project',
    cwd: 'C:/fixture/worktree',
    createdAt: 1
  })
})

afterEach(() => db.close())

function local(text: string, role: 'user' | 'assistant' = 'assistant'): number {
  const id = queries.appendMessage({ sessionId: 'session', role, content: text, createdAt: 2 })
  queries.appendPart({
    messageId: id,
    type: 'text',
    toolRunId: null,
    payloadJson: JSON.stringify({ text })
  })
  return id
}

function native(
  id: string,
  text: string,
  role: 'user' | 'assistant' = 'assistant'
): NativeHistoryMessage {
  return { id, role, createdAt: 2, parts: [{ type: 'text', text }] }
}

function snapshot(
  messages: NativeHistoryMessage[],
  revision = 'revision-1'
): NativeHistorySnapshot {
  return {
    sessionId: 'session',
    cwd: 'C:/fixture/worktree',
    sourceKey: 'fixture-native-store',
    revision,
    messages,
    raw: { storageOnly: true }
  }
}

async function sync(value: NativeHistorySnapshot): Promise<LoadedSession['nativeSync']> {
  return refreshNativeHistory('session', {
    db: queries,
    isBusy: () => false,
    read: async () => ({ status: 'ready', snapshot: value })
  })
}

function loaded(): LoadedSession | null {
  return loadSession(queries, 'session', () => 'C:/fallback')
}

function transcriptText(): string[] {
  return (
    loaded()?.messages.flatMap((message) =>
      message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : []))
    ) ?? []
  )
}

describe('native history with the migrated SQLite archive', () => {
  it('atomically stores the snapshot, local frontier and searchable native text without replacing local rows', async () => {
    const frontier = local('archivedobsolete')
    const original = queries.loadParts('session')
    const value = snapshot([
      native('native-user', 'terminalquestion', 'user'),
      native('native-answer', 'terminalanswer')
    ])

    expect(await sync(value)).toEqual({ status: 'ready' })
    expect(queries.nativeHistory.get('session')).toEqual({
      payload_json: JSON.stringify(value),
      local_frontier: frontier,
      synced_at: expect.any(Number)
    })
    expect(transcriptText()).toEqual(['terminalquestion', 'terminalanswer'])
    expect(queries.loadParts('session')).toEqual(original)
    expect(queries.searchMessages('archivedobsolete')).toEqual([])
    expect(queries.searchMessages('terminalanswer')).toEqual([
      expect.objectContaining({
        session_id: 'session',
        role: 'assistant',
        message_id: expect.any(Number)
      })
    ])
    expect(queries.searchMessages('terminalanswer')[0].message_id).toBeLessThan(0)
    expect(loaded()).not.toHaveProperty('raw')
    expect(loaded()).not.toHaveProperty('sourceKey')
    expect(loaded()?.messages[0]).not.toHaveProperty('id')

    // Re-running the production migration runner must not replace the archived snapshot.
    applyMigrations(db)
    expect(queries.nativeHistory.get('session')?.payload_json).toBe(JSON.stringify(value))
    expect(db.pragma('foreign_key_check')).toEqual([])
  })

  it('replaces repeated native IDs and their old FTS content without accumulating duplicate messages', async () => {
    local('legacy')
    await sync(snapshot([native('same-id', 'previouskeyword')]))
    const updated = snapshot([native('same-id', 'replacementkeyword')], 'revision-2')
    expect(await sync(updated)).toEqual({ status: 'ready' })
    expect(await sync(updated)).toEqual({ status: 'ready' })

    expect(db.prepare('SELECT native_id, content FROM native_history_messages').all()).toEqual([
      { native_id: 'same-id', content: 'replacementkeyword' }
    ])
    expect(transcriptText()).toEqual(['replacementkeyword'])
    expect(queries.searchMessages('previouskeyword')).toEqual([])
    expect(queries.searchMessages('replacementkeyword')).toHaveLength(1)
    expect(db.prepare('SELECT COUNT(*) AS count FROM native_history_snapshots').get()).toEqual({
      count: 1
    })
  })

  it('preserves live rows after the frontier and absorbs them once in the next complete native snapshot', async () => {
    const before = local('before')
    const first = native('first-id', 'before')
    await sync(snapshot([first]))
    const tail = local('livetext')
    expect(tail).toBeGreaterThan(before)
    expect(transcriptText()).toEqual(['before', 'livetext'])
    expect(queries.searchMessages('livetext')).toEqual([
      expect.objectContaining({ message_id: tail })
    ])

    expect(await sync(snapshot([first, native('tail-id', 'livetext')], 'revision-2'))).toEqual({
      status: 'ready'
    })
    expect(queries.nativeHistory.get('session')?.local_frontier).toBe(tail)
    expect(transcriptText()).toEqual(['before', 'livetext'])
    const hits = queries.searchMessages('livetext')
    expect(hits).toHaveLength(1)
    expect(hits[0].message_id).toBeLessThan(0)
    expect(queries.loadParts('session')).toHaveLength(2)
  })

  it('rolls back snapshot, frontier, native rows and FTS when a write fails after partial insertion', async () => {
    local('firstlocal')
    await sync(snapshot([native('first-id', 'originalkeyword')]))
    const previous = queries.nativeHistory.get('session')
    const nativeRows = db.prepare('SELECT * FROM native_history_messages').all()
    local('unabsorbedtail')
    db.exec(`CREATE TRIGGER fixture_native_insert_failure BEFORE INSERT ON native_history_messages
      WHEN NEW.native_id = 'reject' BEGIN SELECT RAISE(ABORT, 'fixture write failure'); END;`)

    expect(
      await sync(
        snapshot(
          [native('accepted-first', 'partialkeyword'), native('reject', 'rejectedkeyword')],
          'revision-2'
        )
      )
    ).toEqual({ status: 'unavailable', message: expect.any(String) })

    expect(queries.nativeHistory.get('session')).toEqual(previous)
    expect(db.prepare('SELECT * FROM native_history_messages').all()).toEqual(nativeRows)
    expect(transcriptText()).toEqual(['originalkeyword', 'unabsorbedtail'])
    expect(queries.searchMessages('originalkeyword')).toHaveLength(1)
    expect(queries.searchMessages('unabsorbedtail')).toHaveLength(1)
    expect(queries.searchMessages('partialkeyword')).toEqual([])
    expect(queries.searchMessages('rejectedkeyword')).toEqual([])
  })

  it('rejects a stale transaction version and a late read after a local write', async () => {
    local('before')
    await sync(snapshot([native('first', 'before')]))
    const previous = queries.nativeHistory.get('session')
    const observed = queries.nativeHistory.observe('session')
    const read = vi.fn<() => Promise<NativeHistoryResult>>()
    let resolve!: (value: NativeHistoryResult) => void
    read.mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    const pending = refreshNativeHistory('session', { db: queries, isBusy: () => false, read })
    local('duringread')
    const next = snapshot([native('different', 'stalesnapshot')], 'revision-2')
    expect(
      queries.nativeHistory.replace({
        sessionId: 'session',
        payloadJson: JSON.stringify(next),
        frontier: observed.frontier,
        expectedVersion: observed.version,
        messages: [],
        now: 100
      })
    ).toBe(false)
    resolve({ status: 'ready', snapshot: next })

    expect(await pending).toEqual({ status: 'busy' })
    expect(read).toHaveBeenCalledOnce()
    expect(queries.nativeHistory.get('session')).toEqual(previous)
    expect(transcriptText()).toEqual(['before', 'duringread'])
    expect(queries.searchMessages('stalesnapshot')).toEqual([])
  })

  it.each(['missing', 'unavailable', 'migration-required'] as const)(
    'keeps the prior snapshot and local tail when native read reports %s',
    async (status) => {
      local('oldlocal')
      await sync(snapshot([native('stable', 'archivednative')]))
      const previous = queries.nativeHistory.get('session')
      local('newlocaltail')
      expect(
        await refreshNativeHistory('session', {
          db: queries,
          isBusy: () => false,
          read: async () => ({ status, message: 'fixture native problem' })
        })
      ).toEqual({ status, message: 'fixture native problem' })
      expect(queries.nativeHistory.get('session')).toEqual(previous)
      expect(transcriptText()).toEqual(['archivednative', 'newlocaltail'])
      expect(queries.searchMessages('archivednative')).toHaveLength(1)
      expect(queries.searchMessages('newlocaltail')).toHaveLength(1)
    }
  )

  it('joins a user attachment only by its native ID and retains unmapped metadata without duplicate body text', async () => {
    const mapped = local('samebody', 'user')
    const orphan = local('samebody', 'user')
    const attachment: AppMessagePart = {
      type: 'attachment',
      attachments: [
        {
          id: 'attachment',
          name: 'sample.png',
          kind: 'image',
          mimeType: 'image/png',
          previewDataUrl: 'data:image/png;base64,fixture',
          path: 'C:/fixture/sample.png'
        }
      ]
    }
    const orphanAttachment: AppMessagePart = {
      type: 'attachment',
      attachments: [{ id: 'orphan', name: 'legacy.txt', kind: 'file', mimeType: 'text/plain' }]
    }
    for (const [messageId, part] of [
      [mapped, attachment],
      [orphan, orphanAttachment]
    ] as const) {
      const { type, ...payload } = part
      queries.appendPart({ messageId, type, toolRunId: null, payloadJson: JSON.stringify(payload) })
    }
    queries.nativeHistory.bind(mapped, 'native-user')
    queries.nativeHistory.bind(mapped, 'native-user')
    const original = queries.loadParts('session')

    expect(await sync(snapshot([native('native-user', 'samebody', 'user')]))).toEqual({
      status: 'ready'
    })
    const view = loaded()
    expect(view?.messages).toEqual([
      { role: 'user', createdAt: 2, parts: [{ type: 'text', text: 'samebody' }, attachment] },
      { role: 'user', createdAt: 2, parts: [orphanAttachment] }
    ])
    expect(view?.nativeSync).toEqual({ status: 'ready', message: expect.any(String) })
    expect(queries.nativeHistory.bindings('session')).toEqual([
      { message_id: mapped, native_message_id: 'native-user' }
    ])
    expect(queries.loadParts('session')).toEqual(original)
  })

  it('hides every discovery path while retaining snapshot, source rows, usage, artifacts, journal and worktree', async () => {
    queries.insertManagedWorktree({
      id: 'worktree',
      repoRoot: 'C:/fixture/repo',
      sourceCwd: 'C:/fixture/repo',
      worktreeRoot: 'C:/fixture/worktree',
      branch: 'work/native',
      baseOid: 'a'.repeat(40),
      createdAt: 1
    })
    queries.bindManagedWorktreeForCwd('session', 'C:/fixture/worktree')
    const id = local('localkeyword')
    queries.nativeHistory.bind(id, 'native-answer')
    queries.usage.insertTurnUsage({
      sessionId: 'session',
      messageId: id,
      createdAt: 2,
      inputTokens: 10,
      outputTokens: 4,
      cacheCreationInputTokens: null,
      cacheReadInputTokens: null,
      totalCostUsd: 0.25
    })
    db.prepare(
      `INSERT INTO artifact_files
      (id, relative_path, filename, kind, size_bytes, hash, created_at)
      VALUES ('file', 'fixture/output.md', 'output.md', 'markdown', 10, 'fixturehash', 2)`
    ).run()
    db.prepare(
      `INSERT INTO session_artifacts
      (id, session_id, artifact_file_id, message_id, tool_run_id, title, input_source, published_at)
      VALUES ('artifact', 'session', 'file', ?, 'tool', 'Output', 'fixture', 2)`
    ).run(id)
    db.prepare(
      `INSERT INTO background_task_events
      (session_id, generation, sequence, received_at, event_type, event_key, payload_json)
      VALUES ('session', 'generation', 1, 2, 'task.completed', 'event', '{}')`
    ).run()
    await sync(snapshot([native('native-answer', 'nativekeyword')]))
    local('tailkeyword')

    const tables = [
      'messages',
      'message_parts',
      'turn_usage',
      'artifact_files',
      'session_artifacts',
      'background_task_events',
      'managed_worktrees',
      'native_history_snapshots',
      'native_history_messages',
      'native_message_bindings'
    ]
    const preserved = tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all())
    expect(queries.listSessions()).toHaveLength(1)
    expect(queries.listSessionsByProject('project')).toHaveLength(1)
    expect(queries.searchMessages('nativekeyword')).toHaveLength(1)
    expect(queries.searchMessages('tailkeyword')).toHaveLength(1)
    expect(loaded()?.costUsd).toBe(0.25)

    queries.hideSession('session', 100)
    queries.hideSession('session', 200)
    queries.insertSession({
      id: 'session',
      backend: 'opencode',
      title: 'late init',
      projectId: 'project',
      createdAt: 3
    })
    expect(queries.listSessions()).toEqual([])
    expect(queries.listSessionsByProject('project')).toEqual([])
    expect(queries.getSessionById('session')).toBeUndefined()
    expect(queries.searchMessages('nativekeyword')).toEqual([])
    expect(queries.searchMessages('tailkeyword')).toEqual([])
    expect(queries.searchMessages('localkeyword')).toEqual([])
    expect(loaded()).toBeNull()
    expect(db.prepare('SELECT hidden_at FROM sessions WHERE id = ?').get('session')).toEqual({
      hidden_at: 100
    })
    expect(tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all())).toEqual(preserved)
    expect(db.pragma('foreign_key_check')).toEqual([])

    const read = vi.fn()
    expect(
      await refreshNativeHistory('session', { db: queries, isBusy: () => false, read })
    ).toEqual({
      status: 'missing',
      message: expect.any(String)
    })
    expect(read).not.toHaveBeenCalled()
    const observed = queries.nativeHistory.observe('session')
    expect(
      queries.nativeHistory.replace({
        sessionId: 'session',
        payloadJson: '{}',
        frontier: observed.frontier,
        expectedVersion: observed.version,
        messages: [],
        now: 300
      })
    ).toBe(false)
    expect(tables.map((table) => db.prepare(`SELECT * FROM ${table}`).all())).toEqual(preserved)
  })
})

import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest'
import type { HistoryQuery, HistoryEdge, HistoryPageReply } from '../../../shared/history-page'
import { HISTORY_BODY_BYTES, HISTORY_PAGE_BYTES } from '../../../shared/history-page'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { readHistoryPage } from './history-page'
import { HistoryIndex } from './turn-index'
import { readHistorySource } from './reader'

describe('turn pages from the published SQLite generation', () => {
  let sqlite: Database.Database, db: DbQueries, index: HistoryIndex
  let root: string
  const sessionId = 'session',
    openGeneration = 57
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'orca-turn-index-'))
    sqlite = new Database(join(root, 'history.db'))
    sqlite.pragma('foreign_keys = ON')
    applyMigrations(sqlite)
    db = new DbQueries(sqlite)
    db.insertSession({
      id: sessionId,
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 0
    })
    index = new HistoryIndex(db)
  })
  afterEach(() => {
    index.stop()
    sqlite.close()
    rmSync(root, { recursive: true, force: true })
  })
  function local(role: 'user' | 'assistant', text?: string): number {
    const id = db.appendMessage({ sessionId, role, createdAt: 7, content: text ?? '' })
    if (text !== undefined)
      db.appendPart({
        messageId: id,
        type: 'text',
        toolRunId: null,
        payloadJson: JSON.stringify({ text })
      })
    return id
  }
  async function query(req: HistoryQuery): Promise<HistoryPageReply> {
    const job = await index.prepare(sessionId)
    if (!job) throw Error('Fixture session missing')
    return readHistoryPage(
      { db, getCwd: () => '.' },
      { ...req, requestId: 12 },
      job.generation,
      job.prepared
    )
  }
  const latest = (): Promise<HistoryPageReply> =>
    query({ kind: 'latest', sessionId, openGeneration })
  const readEdge = (edge: HistoryEdge, direction: 'before' | 'after'): Promise<HistoryPageReply> =>
    query(
      edge.kind === 'withinTurn'
        ? { sessionId, openGeneration, kind: edge.kind, cursor: edge.cursor, direction }
        : { sessionId, openGeneration, kind: edge.kind, cursor: edge.cursor }
    )

  it('keeps partless messages and same-time turns, preserves earlier cursors across local tail append', async () => {
    local('assistant', 'leading')
    local('user')
    local('user', 'second input')
    local('assistant', 'answer')
    const tail = await latest()
    if (tail.status !== 'ok') throw Error(tail.status)
    expect(tail.session.messages.map((m) => [m.id, m.parts.length])).toEqual([
      ['m:2', 0],
      ['m:3', 1],
      ['m:4', 1]
    ])
    expect(tail.session.history.before?.kind).toBe('earlierTurn')
    local('user', 'new turn')
    const added = await latest()
    if (added.status !== 'ok') throw Error(added.status)
    expect(added.session.history.generation).toBe(tail.session.history.generation)
    expect(added.session.messages.map((m) => m.id)).toEqual(['m:5'])
    const head = await readEdge(tail.session.history.before!, 'before')
    if (head.status !== 'ok') throw Error(head.status)
    expect(head.session.messages.map((m) => m.id)).toEqual(['m:1'])
    expect(head.session.history.before).toBeUndefined()
    const forward = await readEdge(head.session.history.after!, 'after')
    if (forward.status !== 'ok') throw Error(forward.status)
    expect(forward.session.messages).toEqual(tail.session.messages)
    expect(
      await query({
        kind: 'laterTurn',
        sessionId,
        openGeneration,
        cursor: tail.session.history.before!.cursor
      })
    ).toMatchObject({ status: 'invalid' })
  })

  it('pages a single turn by keyset, and reads only the bodies it returns', async () => {
    sqlite.transaction(() => {
      for (let i = 0; i < 300; i++) local('assistant', String(i))
    })()
    const read = vi.spyOn(db.historyIndex, 'parts')
    let page = await latest()
    const lengths: number[] = []
    const keys: string[] = []
    while (page.status === 'ok') {
      lengths.push(page.session.messages.length)
      keys.unshift(...page.session.messages.map((m) => m.id))
      expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(HISTORY_PAGE_BYTES)
      const before = page.session.history.before
      if (!before) break
      expect(before.kind).toBe('withinTurn')
      page = await readEdge(before, 'before')
    }
    expect(lengths).toEqual([128, 128, 44])
    expect(keys).toEqual(Array.from({ length: 300 }, (_, i) => 'm:' + (i + 1)))
    expect(read).toHaveBeenCalledTimes(300)
  })

  it('reads a deferred UTF-8 body across chunk boundaries and rejects stale or foreign references', async () => {
    const text = 'a'.repeat(HISTORY_BODY_BYTES - 26) + '🦦漢'.repeat(610000)
    local('user', text)
    const read = vi.spyOn(db.historyIndex, 'parts')
    const page = await latest()
    if (page.status !== 'ok') throw Error(page.status)
    const ref = page.session.messages[0].deferredBody!
    expect(ref.message).toBe('m:1')
    expect(read).not.toHaveBeenCalled()
    const base = { kind: 'body' as const, sessionId, openGeneration, ref }
    const chunks: Buffer[] = []
    let offset = 0
    while (offset < ref.bytes) {
      const result = await query({ ...base, offset })
      if (result.status !== 'body') throw Error(result.status)
      const buffer = Buffer.from(result.base64, 'base64')
      expect(buffer.length).toBeLessThanOrEqual(HISTORY_BODY_BYTES)
      expect(result.nextOffset).toBe(offset + buffer.length)
      chunks.push(buffer)
      offset = result.nextOffset
    }
    expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual([{ type: 'text', text }])
    expect(await query({ ...base, ref: { ...ref, session: 'other' }, offset: 0 })).toMatchObject({
      status: 'invalid'
    })
    sqlite
      .prepare('UPDATE message_parts SET payload_json=? WHERE message_id=1')
      .run(JSON.stringify({ text: 'edited' }))
    expect(await query({ ...base, offset: 0 })).toMatchObject({ status: 'stale' })
  })

  it('leaves the published archive intact if two source owners have the same projected key', async () => {
    const old = {
      id: 'n:source',
      role: 'user' as const,
      createdAt: 1,
      parts: [{ type: 'text', text: 'archiveterm' }]
    }
    db.nativeHistory.prepareRecovery({
      sessionId,
      nativeId: sessionId,
      freshStart: true,
      archiveJson: JSON.stringify([old]),
      frontier: 0,
      expectedVersion: db.nativeHistory.observe(sessionId).version,
      messages: [{ id: old.id, role: old.role, createdAt: 1, content: 'archiveterm' }]
    })
    const archive = await latest()
    if (archive.status !== 'ok') throw Error(archive.status)
    const original = archive.session.history.generation
    db.nativeHistory.replace({
      sessionId,
      expectedVersion: db.nativeHistory.observe(sessionId).version,
      frontier: 0,
      now: 2,
      payloadJson: JSON.stringify({
        messages: [{ ...old, id: 'source', parts: [{ type: 'text', text: 'currentterm' }] }]
      }),
      messages: [{ id: 'source', role: 'user', createdAt: 1, content: 'currentterm' }]
    })
    const hits = ['archiveterm', 'currentterm'].map((q) => db.searchMessages(q)[0])
    expect(hits.map((h) => h.locator?.source)).toEqual(['archive', 'native'])
    expect(readHistorySource(db, sessionId).messages.map((m) => m.id)).toEqual([
      'n:source',
      'n:source'
    ])
    await expect(index.prepare(sessionId)).rejects.toMatchObject({
      code: 'SQLITE_CONSTRAINT_UNIQUE'
    })
    expect(db.historyIndex.state(sessionId)?.published).toBe(original)
    expect(
      db.historyIndex.parts(sessionId, original, db.historyIndex.header(sessionId, original, 0)!)
    ).toEqual(old.parts)
  })

  it('keeps the previous publication intact when a resumed build has not finished', async () => {
    local('assistant', 'first')
    const original = await latest()
    if (original.status !== 'ok') throw Error(original.status)
    local('user', 'second')
    local('assistant', 'third')
    sqlite
      .prepare('UPDATE message_parts SET payload_json=? WHERE message_id=1')
      .run(JSON.stringify({ text: 'replacement' }))
    const state = db.historyIndex.begin(sessionId)!
    const source = readHistorySource(db, sessionId, undefined, db.historyIndex.headers(sessionId))
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => (now += 21))
    try {
      expect(db.historyIndex.writeSlice(sessionId, state.building!, state.revision, source)).toBe(
        'pending'
      )
    } finally {
      clock.mockRestore()
    }
    expect(db.historyIndex.state(sessionId)).toMatchObject({
      next_ordinal: 1,
      published: original.session.history.generation,
      building: state.building
    })
    index.stop()
    sqlite.close()
    sqlite = new Database(join(root, 'history.db'))
    sqlite.pragma('foreign_keys = ON')
    db = new DbQueries(sqlite)
    index = new HistoryIndex(db)
    const ready = await latest()
    if (ready.status !== 'ok') throw Error(ready.status)
    expect(ready.session.history.generation).toBe(state.building)
    expect(ready.session.messages.map((m) => m.parts[0])).toEqual([
      { type: 'text', text: 'second' },
      { type: 'text', text: 'third' }
    ])
  })
})

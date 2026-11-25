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
    root = mkdtempSync(join(tmpdir(), 'turn-history-index-'))
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

  it.each(['spread', 'clustered'] as const)(
    'greedy maximal pages for uniform and skewed turns (%s)',
    async (distribution) => {
      const partCounts = Array.from({ length: 600 }, (_, i) =>
        (distribution === 'spread' ? i % 4 === 0 : i >= 450) ? 3 : 1
      )
      sqlite.transaction(() => {
        for (let i = 0; i < partCounts.length; i++) {
          const messageId = local(i === 0 ? 'user' : 'assistant', String(i))
          if (partCounts[i] === 3)
            for (const text of ['one', 'two'])
              db.appendPart({
                messageId,
                type: 'text',
                toolRunId: null,
                payloadJson: JSON.stringify({ text })
              })
        }
      })()
      const pages: { headers: number; parts: number; bytes: number }[] = []
      let reply = await latest()
      let collected: string[] = []
      for (;;) {
        if (reply.status !== 'ok') throw Error(reply.status)
        const { messages, history } = reply.session
        const counts = {
          headers: messages.length,
          parts: messages.reduce((n, m) => n + m.parts.length, 0),
          bytes: Buffer.byteLength(JSON.stringify(reply))
        }
        expect(counts.headers).toBeLessThanOrEqual(128)
        expect(counts.parts).toBeLessThanOrEqual(256)
        expect(counts.bytes).toBeLessThanOrEqual(HISTORY_PAGE_BYTES)
        expect(messages.every((m) => !m.deferredBody)).toBe(true)
        pages.push(counts)
        collected = [...messages.map((m) => m.id), ...collected]
        if (!history.before) break
        const nextParts = partCounts[partCounts.length - collected.length - 1]
        expect(counts.headers === 128 || counts.parts + nextParts > 256).toBe(true)
        expect(history.before.kind).toBe('withinTurn')
        reply = await readEdge(history.before, 'before')
      }
      expect(collected).toEqual(Array.from({ length: 600 }, (_, i) => 'm:' + (i + 1)))
      expect(pages.reduce((n, p) => n + p.parts, 0)).toBe(900)
      const minimum = [0]
      for (let end = 1; end <= partCounts.length; end++) {
        let best = Infinity
        let parts = 0
        for (let begin = end - 1; begin >= Math.max(0, end - 128); begin--) {
          parts += partCounts[begin]
          if (parts > 256) break
          best = Math.min(best, minimum[begin] + 1)
        }
        minimum.push(best)
      }
      expect(pages).toHaveLength(minimum[partCounts.length])
      expect(pages.map((p) => [p.headers, p.parts])).toEqual(
        distribution === 'spread'
          ? [
              [128, 192],
              [128, 192],
              [128, 192],
              [128, 192],
              [88, 132]
            ]
          : [
              [85, 255],
              [126, 256],
              [128, 128],
              [128, 128],
              [128, 128],
              [5, 5]
            ]
      )
    }
  )

  it('restores 200,000 partless messages in one turn using 1,563 bounded pages', async () => {
    const count = 200000
    sqlite
      .prepare(
        `WITH RECURSIVE sequence(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM sequence WHERE i<?)
      INSERT INTO messages(session_id,role,content,created_at,idx,complete) SELECT ?, 'assistant','',1,i,1 FROM sequence`
      )
      .run(count, sessionId)
    const job = (await index.prepare(sessionId))!
    let request: HistoryQuery = { kind: 'latest', sessionId, openGeneration }
    let end = count
    let pages = 0
    do {
      const reply: HistoryPageReply = readHistoryPage(
        { db, getCwd: () => '.' },
        { ...request, requestId: pages },
        job.generation
      )
      if (reply.status !== 'ok') throw Error(reply.status)
      const { messages, history } = reply.session
      expect(messages.length).toBe(Math.min(end, 128))
      expect(Buffer.byteLength(JSON.stringify(reply))).toBeLessThanOrEqual(HISTORY_PAGE_BYTES)
      const first = end - messages.length + 1
      expect(
        messages.every(
          (m, i) =>
            m.id === 'm:' + (first + i) &&
            m.role === 'assistant' &&
            !m.deferredBody &&
            !m.parts.length
        )
      ).toBe(true)
      pages++
      end = first - 1
      if (!history.before) break
      if (history.before.kind !== 'withinTurn') throw Error('Unexpected turn boundary')
      request = {
        kind: 'withinTurn',
        direction: 'before',
        cursor: history.before.cursor,
        sessionId,
        openGeneration
      }
    } while (end > 0)
    expect([pages, end]).toEqual([1563, 0])
  })

  it.each([1, 100, 10000])(
    'reads the same latest turn after %i older turns without opening their bodies',
    async (count) => {
      sqlite.transaction(() => {
        for (let i = 0; i < count; i++) {
          local('user')
          local('assistant')
        }
        local('user', 'final question')
        local('assistant', 'final answer')
      })()
      const job = (await index.prepare(sessionId))!
      const parts = vi.spyOn(db.historyIndex, 'parts')
      const full = vi.spyOn(db, 'loadParts')
      const reply = readHistoryPage(
        { db, getCwd: () => '.' },
        { kind: 'latest', sessionId, openGeneration, requestId: 1 },
        job.generation
      )
      if (reply.status !== 'ok') throw Error(reply.status)
      expect(reply.session.messages.map((m) => m.parts)).toEqual([
        [{ type: 'text', text: 'final question' }],
        [{ type: 'text', text: 'final answer' }]
      ])
      expect(reply.session.userMessageCount).toBe(count + 1)
      expect(parts.mock.calls.map(([, , header]) => header.ordinal)).toEqual([
        count * 2 + 1,
        count * 2
      ])
      expect(full).not.toHaveBeenCalled()
      expect(Buffer.byteLength(JSON.stringify(reply))).toBeLessThan(2048)
    }
  )

  it('defers oversized control metadata while returning the latest text on the first page', async () => {
    local('user', 'visible')
    const title = '表題'.repeat(90000)
    sqlite.prepare('UPDATE sessions SET title=? WHERE id=?').run(title, sessionId)
    const page = await latest()
    if (page.status !== 'ok') throw Error(page.status)
    expect(page.session.messages[0].parts).toEqual([{ type: 'text', text: 'visible' }])
    expect(page.session.title?.endsWith('…')).toBe(true)
    expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(HISTORY_PAGE_BYTES)
    const ref = page.session.metadataRef!
    const chunks: Buffer[] = []
    let offset = 0
    while (offset < ref.bytes) {
      const reply = await query({ kind: 'metadata', ref, offset, sessionId, openGeneration })
      if (reply.status !== 'metadata') throw Error(reply.status)
      const bytes = Buffer.from(reply.base64, 'base64')
      expect(bytes.length).toBeLessThanOrEqual(HISTORY_BODY_BYTES)
      chunks.push(bytes)
      offset = reply.nextOffset
    }
    expect(JSON.parse(Buffer.concat(chunks).toString()).title).toBe(title)
    expect(
      await query({
        kind: 'metadata',
        ref: { ...ref, session: 'other' },
        offset: 0,
        sessionId,
        openGeneration
      })
    ).toMatchObject({ status: 'invalid' })
  })

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
    const cursor = tail.session.history.before!.cursor
    const foreign = JSON.parse(Buffer.from(cursor, 'base64url').toString())
    foreign[1] = 'foreign-session'
    expect(
      await query({
        kind: 'earlierTurn',
        sessionId,
        openGeneration,
        cursor: Buffer.from(JSON.stringify(foreign)).toString('base64url')
      })
    ).toMatchObject({ status: 'invalid' })
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

  it('rejects a cursor reused for another kind or direction before reading any message body', async () => {
    sqlite.transaction(() => {
      for (let i = 0; i < 140; i++) local(i === 0 ? 'user' : 'assistant', String(i))
    })()
    const tail = await latest()
    if (tail.status !== 'ok') throw Error(tail.status)
    const edge = tail.session.history.before!
    expect(edge.kind).toBe('withinTurn')
    const bodies = vi.spyOn(db.historyIndex, 'parts')
    const request = { sessionId, openGeneration, cursor: edge.cursor }
    expect(await query({ ...request, kind: 'earlierTurn' })).toMatchObject({ status: 'invalid' })
    expect(await query({ ...request, kind: 'withinTurn', direction: 'after' })).toMatchObject({
      status: 'invalid'
    })
    expect(bodies).not.toHaveBeenCalled()
    const head = await readEdge(edge, 'before')
    expect(head.status === 'ok' && head.session.messages.map((m) => m.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => 'm:' + (i + 1))
    )
  })

  it('returns stale if a source write commits between prepare and the bounded read', async () => {
    local('user', 'before')
    const published = (await index.prepare(sessionId))!.generation
    local('assistant', 'after')
    const state = db.historyIndex.state(sessionId)!
    expect(state.published).toBe(published)
    expect(state.published_revision).not.toBe(state.revision)
    const bodies = vi.spyOn(db.historyIndex, 'parts')
    expect(
      readHistoryPage(
        { db, getCwd: () => '.' },
        { kind: 'latest', sessionId, openGeneration, requestId: 15 },
        published
      )
    ).toEqual({ status: 'stale', sessionId, openGeneration, requestId: 15 })
    expect(bodies).not.toHaveBeenCalled()
    const next = await latest()
    expect(next.status === 'ok' && next.session.messages.map((m) => m.parts)).toEqual([
      [{ type: 'text', text: 'before' }],
      [{ type: 'text', text: 'after' }]
    ])
  })

  it('rebuilds for a dirty local row inside the native frontier or a tail over 128 rows', async () => {
    const id = local('user', 'shadowed')
    const observed = db.nativeHistory.observe(sessionId)
    const native = {
      id: 'native',
      role: 'user' as const,
      createdAt: 2,
      parts: [{ type: 'text' as const, text: 'owner' }]
    }
    db.nativeHistory.replace({
      sessionId,
      frontier: observed.frontier,
      expectedVersion: observed.version,
      now: 2,
      payloadJson: JSON.stringify({ messages: [native] }),
      messages: [{ ...native, content: 'owner' }]
    })
    const published = (await index.prepare(sessionId))!.generation
    db.appendPart({
      messageId: id,
      type: 'text',
      toolRunId: null,
      payloadJson: JSON.stringify({ text: 'updated' })
    })
    expect(db.historyIndex.localTail(sessionId, db.historyIndex.state(sessionId)!)).toBeUndefined()
    const next = await index.prepare(sessionId)
    expect(next?.generation).not.toBe(published)
    for (let n = 0; n < 129; n++) local('assistant', 'tail ' + n)
    expect(db.historyIndex.localTail(sessionId, db.historyIndex.state(sessionId)!)).toBeUndefined()
    expect((await index.prepare(sessionId))?.generation).not.toBe(next?.generation)
  })

  it('rechecks the archive epoch when ordinal zero is reused and confirms only the resolved cache key', async () => {
    const replaceArchive = (word: string): void => {
      const message = {
        id: 'archive-' + word,
        role: 'user' as const,
        createdAt: 1,
        parts: [{ type: 'text', text: word }]
      }
      db.nativeHistory.prepareRecovery({
        sessionId,
        nativeId: sessionId,
        freshStart: true,
        frontier: 0,
        expectedVersion: db.nativeHistory.observe(sessionId).version,
        archiveJson: JSON.stringify([message]),
        messages: [{ id: message.id, role: message.role, createdAt: 1, content: word }]
      })
    }
    replaceArchive('firstterm')
    await index.prepare(sessionId)
    const old = db.searchMessages('firstterm')[0].locator!
    replaceArchive('secondterm')
    local('assistant', 'neighbor')
    const generation = (await index.prepare(sessionId))!.generation
    const current = db.searchMessages('secondterm')[0].locator!
    expect(old).toMatchObject({
      source: 'archive',
      identity: '0',
      projectedKey: 'archive-firstterm'
    })
    expect(current).toMatchObject({
      source: 'archive',
      identity: '0',
      projectedKey: 'archive-secondterm'
    })
    expect(old.epoch).not.toBe(current.epoch)
    const target = { kind: 'target' as const, sessionId, openGeneration }
    const cached = { generation, messageKey: 'archive-secondterm' }
    const bodies = vi.spyOn(db.historyIndex, 'parts')
    expect(await query({ ...target, locator: old, cached })).toMatchObject({ status: 'stale' })
    expect(await query({ ...target, locator: current, cached })).toMatchObject({
      status: 'useCached',
      messageKey: 'archive-secondterm'
    })
    expect(bodies).not.toHaveBeenCalled()
    const neighbor = db.searchMessages('neighbor')[0].locator!.projectedKey!
    for (const [resumeGeneration, expected] of [
      [generation, neighbor],
      ['old-generation', 'archive-secondterm']
    ]) {
      expect(
        await query({
          ...target,
          locator: current,
          resume: { generation: resumeGeneration, messageKey: neighbor }
        })
      ).toMatchObject({ status: 'ok', targetMessage: expected })
    }
    const page = await query({
      ...target,
      locator: current,
      cached: { generation, messageKey: neighbor }
    })
    expect(page.status === 'ok' && page.targetMessage).toBe('archive-secondterm')
    expect(page.status === 'ok' && page.session.messages[0].parts).toEqual([
      { type: 'text', text: 'secondterm' }
    ])
  })

  it('returns the ordinary reading position only for its published generation and confirms cached keys', async () => {
    local('user', 'original position')
    local('assistant', 'reply')
    const previous = await latest()
    if (previous.status !== 'ok') throw Error(previous.status)
    const generation = previous.session.history.generation
    const messageKey = previous.session.messages[0].id
    local('user', 'next turn')
    const visit = { kind: 'visit' as const, sessionId, openGeneration, generation, messageKey }
    expect(await query(visit)).toMatchObject({
      status: 'ok',
      targetMessage: messageKey,
      session: { messages: [{ id: messageKey }, { role: 'assistant' }] }
    })
    expect(await query({ ...visit, cached: { generation, messageKey } })).toMatchObject({
      status: 'useCached',
      messageKey
    })
    expect(await query({ ...visit, messageKey: 'missing' })).toMatchObject({ status: 'missing' })
    expect(
      await query({ ...visit, generation: 'expired', cached: { generation, messageKey } })
    ).toMatchObject({ status: 'stale' })
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

  it('keeps exactly 256 KiB inline and defers the same message one byte over', async () => {
    const id = local('user', 'a')
    const read = async (): Promise<Extract<HistoryPageReply, { status: 'ok' }>> => {
      const gen = (await index.prepare(sessionId))!.generation
      const reply = readHistoryPage(
        { db, getCwd: () => '.' },
        { kind: 'latest', sessionId, openGeneration, requestId: 1 },
        gen
      )
      if (reply.status !== 'ok') throw Error(reply.status)
      return reply
    }
    const start = await read()
    const length = HISTORY_PAGE_BYTES - Buffer.byteLength(JSON.stringify(start)) + 1
    const update = sqlite.prepare('UPDATE message_parts SET payload_json=? WHERE message_id=?')
    update.run(JSON.stringify({ text: 'a'.repeat(length) }), id)
    const exact = await read()
    expect(exact.session.messages[0].deferredBody).toBeUndefined()
    expect(Buffer.byteLength(JSON.stringify(exact))).toBe(HISTORY_PAGE_BYTES)
    update.run(JSON.stringify({ text: 'a'.repeat(length + 1) }), id)
    expect((await read()).session.messages[0].deferredBody?.message).toBe('m:1')
  })

  it('retains the identity of a 2,000-part message and only defers an intrinsically oversized body', async () => {
    const ids = [local('assistant'), local('assistant'), local('assistant')]
    sqlite.transaction(() => {
      for (const [i, count] of [256, 2000, 256].entries())
        for (let j = 0; j < count; j++)
          db.appendPart({
            messageId: ids[i],
            type: 'text',
            toolRunId: null,
            payloadJson: JSON.stringify({ text: String(j) })
          })
    })()
    const reply = await latest()
    if (reply.status !== 'ok') throw Error(reply.status)
    expect(reply.session.messages.map((m) => [m.id, m.parts.length, !!m.deferredBody])).toEqual([
      ['m:2', 0, true],
      ['m:3', 256, false]
    ])
    const ref = reply.session.messages[0].deferredBody!
    const result = await query({ kind: 'body', sessionId, openGeneration, ref, offset: 0 })
    if (result.status !== 'body') throw Error(result.status)
    expect(result.done).toBe(true)
    expect(JSON.parse(Buffer.from(result.base64, 'base64').toString())).toEqual(
      Array.from({ length: 2000 }, (_, n) => ({ type: 'text', text: String(n) }))
    )
    const head = await readEdge(reply.session.history.before!, 'before')
    if (head.status !== 'ok') throw Error(head.status)
    expect(head.session.messages[0].parts).toHaveLength(256)
  })

  it('packs inherently oversized messages with adjacent headers in both directions', async () => {
    local('user', 'first')
    const huge = local('assistant', '界'.repeat(HISTORY_PAGE_BYTES))
    local('assistant', 'last')
    const read = vi.spyOn(db.historyIndex, 'parts')
    const page = await latest()
    if (page.status !== 'ok') throw Error(page.status)
    const locator = db.searchMessages('first')[0].locator!
    const forward = await query({ kind: 'target', sessionId, openGeneration, locator })
    if (forward.status !== 'ok') throw Error(forward.status)
    expect(forward.session.messages).toEqual(page.session.messages)
    expect(page.session.messages.map((m) => m.id)).toEqual(['m:1', 'm:2', 'm:3'])
    expect(page.session.messages[1].deferredBody?.message).toBe('m:' + huge)
    expect(read).toHaveBeenCalledTimes(4)
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
    const chunkRead = vi.spyOn(db.historyIndex, 'chunk')
    for (const bytes of [ref.bytes - 1, ref.bytes + 1]) {
      expect(await query({ ...base, ref: { ...ref, bytes }, offset: 0 })).toMatchObject({
        status: 'invalid'
      })
    }
    expect(chunkRead).not.toHaveBeenCalled()
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

import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { LoadedMessage, NormalizedEvent } from '../../../shared/ipc'
import { createPeerLink, type PeerLink } from '../../infra/ipc/peer-link'
import { createPeerLoopback } from '../../infra/ipc/peer-loopback.testfixture'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { copyForkDisplay } from '../../features/history/fork-display'
import { readHistoryPage } from '../../features/history/history-page'
import { readHistorySource } from '../../features/history/reader'
import { HistoryIndex } from '../../features/history/turn-index'
import { createPersistenceReceiver } from './persistence-receiver'

type Failure = Extract<NormalizedEvent, { type: 'error' }>
let root: string, sqlite: Database.Database, db: DbQueries, sender: PeerLink<'agent'>
const failed = vi.fn()

function open(): void {
  sqlite = new Database(join(root, 'chat.db'))
  sqlite.pragma('foreign_keys=ON')
  applyMigrations(sqlite)
  db = new DbQueries(sqlite)
  const ports = createPeerLoopback()
  const receiver = createPersistenceReceiver({ db, usage: () => undefined, notifyAgent: failed })
  const data = createPeerLink({
    side: 'data',
    onRequest: receiver.request,
    onNotify: receiver.notify
  })
  sender = createPeerLink({ side: 'agent', onRequest: () => undefined, onNotify: () => undefined })
  data.attach(ports.data)
  sender.attach(ports.agent)
}

function begin(sessionId: string): void {
  sender.notify('turn.begin', {
    turnKey: sessionId,
    backend: 'claude',
    fields: { dbSessionId: sessionId, agentKind: 'code', providerKey: null }
  })
}

function commit(
  sessionId: string,
  key: string,
  text = 'same question',
  nativeMessageId?: string
): Promise<unknown> {
  return sender.request('turn.commitUser', {
    turnKey: sessionId,
    batch: { text, createdAt: 100, messageKey: key, nativeMessageId }
  })
}

function fault(sessionId: string, owner: string, id: string, nativeMessageId?: string): Failure {
  const messageKey = 'a:' + id
  return {
    type: 'error',
    sessionId,
    messageKey,
    nativeMessageId,
    failure: {
      failureId: id,
      ownerUserMessageKey: owner,
      assistantMessageKey: messageKey,
      occurredAt: 200
    },
    error: {
      category: 'stream_error',
      message: 'same failure',
      retryable: true,
      provider: 'claude'
    }
  }
}
const persist = (ev: Failure): Promise<unknown> =>
  sender.request('turn.failureEvent', { turnKey: ev.sessionId, ev })
const messages = (id: string): LoadedMessage[] =>
  readHistorySource(db, id, undefined, db.historyIndex.headers(id)).messages
const count = (table: string): number =>
  sqlite
    .prepare('SELECT COUNT(*) FROM ' + table)
    .pluck()
    .get() as number
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'turn-failure-'))
  failed.mockClear()
  open()
  for (const id of ['one', 'two']) {
    db.insertSession({ id, backend: 'claude', title: null, projectId: null, createdAt: 1 })
    begin(id)
  }
})
afterEach(() => {
  sqlite.close()
  rmSync(root, { recursive: true, force: true })
})

it('stores one atomic receipt per session, even on concurrent replay or a lost reply after reopening SQLite', async () => {
  for (const s of ['one', 'two']) {
    await commit(s, 'u:first')
    await commit(s, 'u:steer')
    const first = fault(s, 'u:first', 'fault')
    const second = fault(s, 'u:steer', 'next')
    expect(await Promise.all([persist(first), persist(first), persist(second)])).toEqual([
      first.failure,
      first.failure,
      second.failure
    ])
    expect(messages(s).map((m) => m.id)).toEqual(['u:first', 'a:fault', 'u:steer', 'a:next'])
    expect(messages(s).map((m) => m.parts.at(-1))).toEqual([
      { type: 'text', text: 'same question' },
      { type: 'error', failure: first.failure, error: first.error },
      { type: 'text', text: 'same question' },
      { type: 'error', failure: second.failure, error: second.error }
    ])
  }
  expect(count('turn_failures')).toBe(4)
  // A second materialization path (such as fork copying) cannot bypass the invariant.
  const dupe = fault('one', 'u:first', 'fault')
  expect(() =>
    db.appendPart({
      messageId: db.findMessageByKey('one', 'a:fault')!.id,
      type: 'error',
      toolRunId: null,
      payloadJson: JSON.stringify({ error: dupe.error, failure: dupe.failure })
    })
  ).toThrow('UNIQUE')
  sqlite.close()
  open() // Agent turn registry is empty. The first acknowledgement was lost.
  const original = fault('one', 'u:first', 'fault')
  expect(await persist(original)).toEqual(original.failure)
  expect(await persist(fault('one', 'u:first', 'unknown'))).toBeNull()
  for (const wrong of [
    { failure: { ...original.failure!, ownerUserMessageKey: 'u:steer' } },
    { failure: { ...original.failure!, occurredAt: 201 } },
    { error: { ...original.error, retryable: false } }
  ])
    expect(await persist({ ...original, ...wrong })).toBeNull()
  expect(count('turn_failures')).toBe(4)
  expect(count('message_parts')).toBe(8)
})

it('rejects a role/owner mismatch and rolls back new assistant, shifted indices, part and receipt together', async () => {
  await commit('one', 'u:one')
  await commit('one', 'u:two')
  expect(await persist(fault('one', 'u:two', 'second'))).toBeTruthy()
  const ev = fault('one', 'u:one', 'first')
  const mismatch = {
    ...ev,
    messageKey: 'a:second',
    failure: { ...ev.failure!, assistantMessageKey: 'a:second' }
  }
  expect(await persist(mismatch)).toBeNull()
  begin('one')
  const rows = (): unknown[] =>
    sqlite.prepare('SELECT id,idx,message_key FROM messages ORDER BY idx').all()
  const original = rows()
  sqlite.exec(
    "CREATE TRIGGER abort_receipt AFTER INSERT ON turn_failures BEGIN SELECT RAISE(ABORT,'disk fault'); END"
  )
  expect(await persist(ev)).toBeNull()
  expect(failed).toHaveBeenCalledTimes(2)
  expect(rows()).toEqual(original)
  expect(count('message_parts')).toBe(3)
  expect(count('turn_failures')).toBe(1)
  sqlite.exec('DROP TRIGGER abort_receipt')
  begin('one')
  expect(await persist(ev)).toEqual(ev.failure)
  const bare = {
    type: 'error',
    sessionId: 'one',
    messageKey: 'a:unowned',
    error: ev.error
  } as const
  sender.notify('turn.event', { turnKey: 'one', ev: bare })
  await expect(
    sender.request('turn.failureEvent', { turnKey: 'one', ev: bare })
  ).resolves.toBeNull()
  expect(db.findMessageByKey('one', 'a:unowned')).toBeUndefined()
  expect(messages('one').map((m) => m.id)).toEqual(['u:one', 'a:first', 'u:two', 'a:second'])
})

it('restores a confirmed fault across native refresh, search target, fork and recovery archive', async () => {
  const id = 'one'
  await commit(id, 'u:first', 'oldsearch', 'native-user')
  const first = fault(id, 'u:first', 'first', 'native-assistant')
  await persist(first)
  // A second question is absent from native history; its committed error still needs the local FTS locator.
  await commit(id, 'u:second', 'hiddenneedle')
  const second = fault(id, 'u:second', 'second')
  await persist(second)
  const native = [
    {
      id: 'native-user',
      role: 'user' as const,
      createdAt: 11,
      parts: [{ type: 'text' as const, text: 'oldsearch' }]
    },
    {
      id: 'native-assistant',
      role: 'assistant' as const,
      createdAt: 12,
      parts: [
        { type: 'text' as const, text: 'native detail' },
        { type: 'error' as const, error: 'native raw' }
      ]
    },
    {
      id: 'native-only-user',
      role: 'user' as const,
      createdAt: 13,
      parts: [{ type: 'text' as const, text: 'unrelated' }]
    }
  ]
  const observed = db.nativeHistory.observe(id)
  db.nativeHistory.replace({
    sessionId: id,
    frontier: observed.frontier,
    expectedVersion: observed.version,
    now: 20,
    payloadJson: JSON.stringify({ messages: native }),
    messages: native.map((m) => ({
      ...m,
      content: m.parts.flatMap((p) => ('text' in p ? [p.text] : [])).join('')
    }))
  })
  for (let i = 0; i < 7; i++) await commit(id, 'u:later' + i, 'new' + i)
  const current = messages(id)
  const errors = current.flatMap((m) => m.parts.filter((p) => p.type === 'error'))
  expect(errors).toEqual(
    [first, second].map((e) => ({ type: 'error', error: e.error, failure: e.failure }))
  )
  expect(current.find((m) => m.id === 'a:first')?.parts[0]).toEqual({
    type: 'text',
    text: 'native detail'
  })
  expect(current.find((m) => m.id === 'n:native-only-user')?.parts[0]).toEqual({
    type: 'text',
    text: 'unrelated'
  })
  expect(current[current.findIndex((m) => m.id === 'a:second') - 1].id).toBe('u:second')
  const index = new HistoryIndex(db)
  try {
    const check = async (word: string, source: string, expected: Failure): Promise<void> => {
      const job = (await index.prepare(id))!
      const hits = db.searchMessages(word)
      const locator = hits.find((hit) => hit.locator?.source === source)?.locator
      expect(locator?.projectedKey).toBe(expected.failure!.ownerUserMessageKey)
      const page = readHistoryPage(
        { db, getCwd: () => '.' },
        { kind: 'target', sessionId: id, requestId: 1, openGeneration: 1, locator: locator! },
        job.generation,
        job.prepared
      )
      expect(page.status).toBe('ok')
      if (page.status !== 'ok') throw new Error(page.status)
      expect(page.session.messages.find((m) => m.id === expected.messageKey)?.parts).toContainEqual(
        { type: 'error', failure: expected.failure, error: expected.error }
      )
    }
    await check('oldsearch', 'native', first)
    await check('hiddenneedle', 'local', second)
    sqlite.transaction(() => copyForkDisplay(db, id, 'two'))()
    expect(messages('two').map((m) => [m.id, m.parts])).toEqual(current.map((m) => [m.id, m.parts]))
    expect(count('turn_failures')).toBe(4)
    const state = db.nativeHistory.observe(id)
    db.nativeHistory.prepareRecovery({
      sessionId: id,
      nativeId: 'replacement',
      freshStart: true,
      archiveJson: JSON.stringify(current),
      expectedVersion: state.version,
      frontier: state.frontier,
      messages: current.map((m) => ({
        ...m,
        content: m.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('')
      }))
    })
    await check('oldsearch', 'archive', first)
  } finally {
    index.stop()
  }
})

it('accepts a committed received input and rejects cross-session, malformed and uncommitted identities', async () => {
  await commit('one', 'i:receipt')
  await commit('two', 'u:foreign')
  const valid = fault('one', 'i:receipt', 'valid')
  expect(await persist(valid)).toEqual(valid.failure)
  for (const change of [
    { ownerUserMessageKey: 'u:foreign' },
    { ownerUserMessageKey: 'u:not-committed' },
    { ownerUserMessageKey: 'a:valid' },
    { assistantMessageKey: 'u:not-assistant' },
    { occurredAt: -1 }
  ]) {
    begin('one')
    const ev = fault('one', 'i:receipt', 'invalid')
    Object.assign(ev.failure!, change)
    ev.messageKey = ev.failure!.assistantMessageKey
    expect(await persist(ev)).toBeNull()
  }
  begin('one')
  expect(
    await sender.request('turn.failureEvent', {
      turnKey: 'one',
      ev: fault('two', 'u:foreign', 'bad-session')
    })
  ).toBeNull()
  expect(count('turn_failures')).toBe(1)
  expect(messages('two').map((m) => m.id)).toEqual(['u:foreign'])
})

it('restores a deferred error part from bounded SQLite body chunks after its prompt search', async () => {
  const sessionId = 'one'
  await commit(sessionId, 'u:large', 'deferredquestion')
  const ev = fault(sessionId, 'u:large', 'large')
  const text = '본문 🦦'.repeat(48000)
  sender.notify('turn.event', {
    turnKey: sessionId,
    ev: { type: 'message.completed', messageKey: ev.messageKey, sessionId, message: { text } }
  })
  expect(await persist(ev)).toEqual(ev.failure)
  for (let i = 0; i < 8; i++) await commit(sessionId, 'u:later' + i, 'later' + i)
  const index = new HistoryIndex(db)
  try {
    const generation = (await index.prepare(sessionId))!.generation
    const locator = db.searchMessages('deferredquestion')[0].locator!
    const common = { sessionId, requestId: 1, openGeneration: 1 }
    const reply = readHistoryPage(
      { db, getCwd: () => '.' },
      { ...common, kind: 'target', locator },
      generation
    )
    if (reply.status !== 'ok') throw Error(reply.status)
    const ref = reply.session.messages.find((m) => m.id === ev.messageKey)?.deferredBody
    expect(ref?.message).toBe(ev.messageKey)
    const chunks: Buffer[] = []
    for (let offset = 0; offset < ref!.bytes;) {
      const result = readHistoryPage(
        { db, getCwd: () => '.' },
        { ...common, kind: 'body', ref: ref!, offset },
        generation
      )
      if (result.status !== 'body') throw Error(result.status)
      chunks.push(Buffer.from(result.base64, 'base64'))
      offset = result.nextOffset
    }
    expect(chunks.length).toBeGreaterThan(1)
    expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual([
      { type: 'text', text },
      { type: 'error', error: ev.error, failure: ev.failure }
    ])
  } finally {
    index.stop()
  }
})

it('locates a failed prompt when several committed users share one native prompt alias', async () => {
  await commit('one', 'u:prelude', 'first', 'merged')
  await commit('one', 'u:prompt', 'searchneedle', 'merged')
  const ev = fault('one', 'u:prompt', 'failed', 'native-answer')
  await persist(ev)
  const native = [
    {
      id: 'merged',
      role: 'user' as const,
      createdAt: 1,
      parts: [{ type: 'text', text: 'searchneedle' }]
    },
    {
      id: 'native-answer',
      role: 'assistant' as const,
      createdAt: 2,
      parts: [{ type: 'error', error: ev.error }]
    }
  ]
  const observed = db.nativeHistory.observe('one')
  db.nativeHistory.replace({
    sessionId: 'one',
    frontier: observed.frontier,
    expectedVersion: observed.version,
    now: 5,
    payloadJson: JSON.stringify({ messages: native }),
    messages: native.map((m) => ({ ...m, content: m.role === 'user' ? 'searchneedle' : '' }))
  })
  const index = new HistoryIndex(db)
  try {
    const prepared = (await index.prepare('one'))!
    const hits = db.searchMessages('searchneedle')
    expect(hits.map((hit) => hit.locator?.projectedKey)).toEqual(['u:prompt'])
    const target = readHistoryPage(
      { db, getCwd: () => '.' },
      {
        sessionId: 'one',
        requestId: 1,
        openGeneration: 1,
        kind: 'target',
        locator: hits[0].locator!
      },
      prepared.generation
    )
    if (target.status !== 'ok') throw Error(target.status)
    expect(target.session.messages.map((m) => m.id)).toEqual(['u:prompt', 'a:failed'])
  } finally {
    index.stop()
  }
})

it('stores a late Work terminal inside the exact response boundary and rejects a different boundary on replay', async () => {
  const sessionId = 'one'
  sender.notify('turn.begin', {
    turnKey: sessionId,
    backend: 'claude',
    fields: { agentKind: 'work', dbSessionId: sessionId, providerKey: null }
  })
  await commit(sessionId, 'u:prompt')
  const ev = fault(sessionId, 'u:prompt', 'work')
  for (const id of ['earlier', 'failed-boundary']) {
    for (const phase of ['begin', 'end'] as const) {
      sender.notify('turn.event', {
        turnKey: sessionId,
        ev: {
          type: 'response.boundary',
          sessionId,
          messageKey: ev.messageKey,
          boundary: phase === 'begin' ? { id, phase } : { id, phase, outcome: 'failed' }
        }
      })
    }
  }
  ev.failure!.responseBoundaryId = 'failed-boundary'
  expect(await persist(ev)).toEqual(ev.failure)
  const parts = messages(sessionId)[1].parts
  expect(
    parts.map((p) =>
      p.type === 'response_boundary' ? p.boundary.id + ' ' + p.boundary.phase : p.type
    )
  ).toEqual([
    'earlier begin',
    'earlier end',
    'failed-boundary begin',
    'error',
    'failed-boundary end'
  ])
  expect(
    await persist({ ...ev, failure: { ...ev.failure!, responseBoundaryId: 'earlier' } })
  ).toBeNull()
  begin(sessionId)
  expect(
    await persist({
      ...ev,
      failure: { ...ev.failure!, failureId: 'new', responseBoundaryId: 'unknown' }
    })
  ).toBeNull()
  expect(count('turn_failures')).toBe(1)
})

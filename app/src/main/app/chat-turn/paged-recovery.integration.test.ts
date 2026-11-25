import Database from 'better-sqlite3'
import { forkNativeSuffix } from '../../features/history/fork-native'
import { expect, it } from 'vitest'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { copyForkDisplay } from '../../features/history/fork-display'
import { materializeContinuityArrival } from '../../features/orchestration/fork'
import { loadSession, readHistorySource } from '../../features/history/reader'
import { HistoryIndex } from '../../features/history/turn-index'
import { readHistoryPage } from '../../features/history/history-page'

it('full archive and fork retain the first, middle and last identities when only the fifth turn is open', async () => {
  const sql = new Database(':memory:')
  sql.pragma('foreign_keys=ON')
  applyMigrations(sql)
  const db = new DbQueries(sql)
  const index = new HistoryIndex(db)
  try {
    for (const id of ['parent', 'child'])
      db.insertSession({ id, backend: 'claude', createdAt: 1, projectId: null, title: null })
    const turns = Array.from({ length: 10 }, (_, i) => ({
      id: 'key-' + i,
      role: i % 2 ? ('assistant' as const) : ('user' as const),
      createdAt: i,
      parts: [{ type: 'text' as const, text: 'marker-' + i }]
    }))
    const replace = (id: string, messages: typeof turns): boolean =>
      db.nativeHistory.replace({
        sessionId: id,
        payloadJson: JSON.stringify({ messages }),
        frontier: db.nativeHistory.observe(id).frontier,
        expectedVersion: db.nativeHistory.observe(id).version,
        now: 22,
        messages: messages.map((m) => ({ ...m, content: m.parts[0].text }))
      })
    db.nativeHistory.prepareRecovery({
      sessionId: 'parent',
      nativeId: 'recovered',
      freshStart: true,
      archiveJson: JSON.stringify(turns.slice(0, 4)),
      frontier: 0,
      expectedVersion: db.nativeHistory.observe('parent').version,
      messages: turns.slice(0, 4).map((m) => ({ ...m, content: m.parts[0].text }))
    })
    replace('parent', turns.slice(4))
    const visible = readHistorySource(
      db,
      'parent',
      undefined,
      db.historyIndex.headers('parent')
    ).messages
    const generation = (await index.prepare('parent'))!.generation
    const page = readHistoryPage(
      { db, getCwd: () => '.' },
      { kind: 'latest', sessionId: 'parent', requestId: 1, openGeneration: 1 },
      generation
    )
    expect(page.status === 'ok' && page.session.messages.map((m) => m.id)).toEqual(
      visible.slice(-2).map((m) => m.id)
    )
    const arrival = {
      childSessionId: 'child',
      parentSessionId: 'parent',
      relation: 'fork' as const,
      createdAt: 20
    }
    for (let i = 0; i < 2; i++) materializeContinuityArrival(db, arrival, copyForkDisplay)
    const own = db.appendMessage({
      sessionId: 'child',
      role: 'user',
      content: 'child',
      messageKey: 'own',
      createdAt: 21
    })
    db.appendPart({
      messageId: own,
      type: 'text',
      toolRunId: null,
      payloadJson: JSON.stringify({ text: 'child' })
    })
    db.nativeHistory.bind(own, 'child-input')
    const before = loadSession(db, 'child', () => '.')!.messages
    expect(before.slice(0, 10)).toEqual(visible)
    expect(before[10].parts).toEqual([{ type: 'fork_boundary' }])
    // A forked provider can assign new keys to every inherited row, including its recovery prompt.
    const inherited = turns.map((m, i) => ({ ...m, id: 'rewritten-' + i }))
    const provider = [
      ...inherited,
      { ...turns[0], id: 'child-input', parts: [{ type: 'text' as const, text: 'child' }] },
      {
        ...turns[1],
        id: 'child-output',
        parts: [{ type: 'text' as const, text: 'provider reply' }]
      }
    ]
    expect(
      forkNativeSuffix(provider, db.nativeHistory.bindings('child'), db.forkPrefix('child')!).map(
        (m) => m.id
      )
    ).toEqual(['child-input', 'child-output'])
    replace('child', provider)
    const after = loadSession(db, 'child', () => '.')!.messages
    expect(after.slice(0, 11)).toEqual(before.slice(0, 11))
    expect(after.map((m) => m.id)).toEqual([...before.map((m) => m.id), 'n:child-output'])
    for (const i of [0, 4, 9])
      expect(
        db
          .searchMessages('marker-' + i)
          .some((h) => h.session_id === 'child' && h.locator?.source === 'local')
      ).toBe(true)
  } finally {
    index.stop()
    sql.close()
  }
})

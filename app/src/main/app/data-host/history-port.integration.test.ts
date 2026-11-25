import { EventEmitter } from 'node:events'
import Database from 'better-sqlite3'
import { expect, it, vi } from 'vitest'
import { createSessionLoadClient } from '../../../renderer/src/shared/api/transport/session-load'
import { readDeferredParts } from '../../../renderer/src/features/chat/lib/transcript/deferredBody'
import { HISTORY_PAGE_BYTES, type HistoryEdge } from '../../../shared/history-page'
import { CHANNELS } from '../../../shared/ipc'
import { HistoryIndex } from '../../features/history/turn-index'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { fakeClient } from '../../infra/ipc/client.testfixture'
import { invokeChannel, sendChannel } from '../../infra/ipc/test-transport.testfixture'
import { registerSessionLoadHandlers } from './session-load'

it('opens and refreshes the latest turn, then reads both sides of a large search target and its body over the history port', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys=ON')
  applyMigrations(sqlite)
  const db = new DbQueries(sqlite)
  const index = new HistoryIndex(db)
  const sessionId = 'session'
  const openGeneration = 9
  const wire: { channel: string; bytes: number }[] = []
  const sender = fakeClient()
  const notifications = new EventEmitter()
  const record = sender.send
  sender.send = (channel, payload) => {
    record(channel, payload)
    notifications.emit(channel, payload)
  }
  const client = createSessionLoadClient({
    channels: {
      load: CHANNELS.sessionLoad,
      refresh: CHANNELS.sessionRefresh,
      cancel: CHANNELS.sessionLoadCancel,
      chunk: CHANNELS.sessionLoadChunk,
      page: CHANNELS.sessionHistoryPage
    },
    async invoke(channel, payload) {
      const response = await invokeChannel(channel, payload, sender)
      wire.push({ channel, bytes: Buffer.byteLength(JSON.stringify(response)) })
      return response
    },
    send: (channel, payload) => sendChannel(channel, payload, sender),
    subscribe(channel, listener) {
      notifications.on(channel, listener)
      return () => {
        notifications.off(channel, listener)
      }
    }
  })
  const turnKeys: string[][] = []
  const text = 'needle ' + '🦦界'.repeat(600000)
  const page = client.page
  try {
    db.insertSession({
      id: sessionId,
      backend: 'claude',
      title: 'history',
      projectId: null,
      createdAt: 0
    })
    sqlite.transaction(() => {
      for (let turn = 1; turn <= 100; turn++) {
        const keys: string[] = []
        for (let i = 0; i < (turn === 63 ? 600 : 2); i++) {
          const label = turn === 63 && i === 300 ? 'needle' : 'turn ' + turn + ' message ' + i
          const id = db.appendMessage({
            sessionId,
            role: i === 0 ? 'user' : 'assistant',
            content: label,
            createdAt: turn
          })
          db.appendPart({
            messageId: id,
            type: 'text',
            toolRunId: null,
            payloadJson: JSON.stringify({ text: label === 'needle' ? text : label })
          })
          keys.push('m:' + id)
        }
        turnKeys.push(keys)
      }
    })()
    registerSessionLoadHandlers(
      { db, getCwd: () => '.' },
      { historyIndex: index, refreshHistory: async () => ({ status: 'ready' }) }
    )
    const all = vi.spyOn(db, 'loadParts')
    await index.prepare(sessionId)
    all.mockClear()
    const loaded = await client.loadLatest(sessionId)
    expect(loaded?.messages.map((m) => m.id)).toEqual(turnKeys[99])
    const refreshed = await client.refresh(sessionId)
    expect(refreshed.status === 'updated' && refreshed.session.messages.length).toBe(
      turnKeys[99].length
    )
    expect(refreshed.status === 'updated' && refreshed.session.messages.map((m) => m.id)).toEqual(
      turnKeys[99]
    )
    expect(wire.map((f) => f.channel)).toEqual([
      CHANNELS.sessionHistoryPage,
      CHANNELS.sessionRefresh
    ])
    const locator = db.searchMessages('needle')[0].locator!
    const query = { kind: 'target' as const, locator, sessionId, openGeneration }
    const target = await page(query)
    if (target.status !== 'ok') throw Error(target.status)
    const start = turnKeys[62][300]
    expect(target.targetMessage).toBe(start)
    expect(target.session.messages[0].id).toBe(start)
    const { generation } = target.session.history
    expect(await page({ ...query, cached: { generation, messageKey: start } })).toMatchObject({
      status: 'useCached',
      messageKey: start
    })
    expect(
      await page({ ...query, cached: { generation, messageKey: turnKeys[99][0] } })
    ).toMatchObject({ status: 'ok', targetMessage: start })
    const ref = target.session.messages[0].deferredBody!
    expect(ref.message).toBe(start)
    let current = true
    await expect(
      readDeferredParts(
        ref,
        openGeneration,
        async (q) => {
          const chunk = await page(q)
          current = false
          return chunk
        },
        () => current
      )
    ).rejects.toThrow('Stale history body')
    expect(await readDeferredParts(ref, openGeneration, page, () => true)).toEqual([
      { type: 'text', text }
    ])
    const collected = target.session.messages.map((m) => m.id)
    for (const direction of ['before', 'after'] as const) {
      let edge: HistoryEdge | undefined = target.session.history[direction]
      expect(edge?.kind).toBe('withinTurn')
      const seen = new Set<string>()
      while (edge?.kind === 'withinTurn') {
        expect(seen.has(edge.cursor)).toBe(false)
        seen.add(edge.cursor)
        const next = await page({
          kind: 'withinTurn',
          sessionId,
          openGeneration,
          direction,
          cursor: edge.cursor
        })
        if (next.status !== 'ok') throw Error(next.status)
        const ids = next.session.messages.map((m) => m.id)
        if (direction === 'before') collected.unshift(...ids)
        else collected.push(...ids)
        edge = next.session.history[direction]
      }
      const kind = direction === 'before' ? 'earlierTurn' : 'laterTurn'
      expect(edge?.kind).toBe(kind)
      const adjacent = await page({ kind, sessionId, openGeneration, cursor: edge!.cursor })
      expect(adjacent.status === 'ok' && adjacent.session.messages.map((m) => m.id)).toEqual(
        turnKeys[direction === 'before' ? 61 : 63]
      )
    }
    expect(collected).toEqual(turnKeys[62])
    expect(all).not.toHaveBeenCalled()
    expect(sender.sent).toHaveLength(0)
    expect(Math.max(...wire.map((f) => f.bytes))).toBeLessThanOrEqual(HISTORY_PAGE_BYTES)
  } finally {
    index.stop()
    sqlite.close()
  }
})

import {
  chatActions,
  useChatStore,
  type SessionEntry
} from '../../../renderer/src/features/chat/store/chatStore'
import { installChatStoreHarness } from '../../../renderer/src/features/chat/store/chatStore.testHarness'
import { sessionApi } from '../../../renderer/src/shared/api/ipc'
import { installHistoryWorker } from '../../../renderer/src/shared/compute/historyWorker.testfixture'
import { EventEmitter } from 'node:events'
import Database from 'better-sqlite3'
import { expect, it, vi } from 'vitest'
import { createSessionLoadClient } from '../../../renderer/src/shared/api/transport/session-load'
import { readDeferredParts } from '../../../renderer/src/features/chat/lib/transcript/deferredBody'
import * as errors from '../../../renderer/src/shared/errors'
import {
  HISTORY_BODY_BYTES,
  HISTORY_PAGE_BYTES,
  type HistoryPageReply,
  type HistoryEdge
} from '../../../shared/history-page'
import { CHANNELS } from '../../../shared/ipc'
import { HistoryIndex } from '../../features/history/turn-index'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { fakeClient } from '../../infra/ipc/client.testfixture'
import { invokeChannel, sendChannel } from '../../infra/ipc/test-transport.testfixture'
import { registerSessionLoadHandlers } from './session-load'

installHistoryWorker()

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
    const readParts = db.historyIndex.parts.bind(db.historyIndex)
    vi.spyOn(db.historyIndex, 'parts').mockImplementationOnce((...args) => {
      const value = readParts(...args)
      sendChannel(CHANNELS.sessionLoadCancel, { requestId: 9123 }, sender)
      return value
    })
    expect(
      await invokeChannel(
        CHANNELS.sessionHistoryPage,
        {
          kind: 'latest',
          sessionId,
          openGeneration,
          requestId: 9123
        },
        sender
      )
    ).toMatchObject({ status: 'cancelled', requestId: 9123 })
    const loaded = await client.loadLatest(sessionId)
    expect(loaded?.messages.map((m) => m.id)).toEqual(turnKeys.slice(-5).flat())
    const refreshed = await client.refresh(sessionId)
    expect(refreshed.status === 'updated' && refreshed.session.messages.length).toBe(
      turnKeys.slice(-5).flat().length
    )
    expect(refreshed.status === 'updated' && refreshed.session.messages.map((m) => m.id)).toEqual(
      turnKeys.slice(-5).flat()
    )
    expect(wire.map((f) => f.channel)).toEqual([
      CHANNELS.sessionHistoryPage,
      CHANNELS.sessionRefresh
    ])
    expect(await page({ kind: 'latest', sessionId: 'absent', openGeneration })).toMatchObject({
      status: 'missing',
      sessionId: 'absent',
      openGeneration
    })
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
        direction === 'before' ? turnKeys.slice(57, 62).flat() : turnKeys[63]
      )
    }
    // Start one unit before turn 68. Its fifth turn is oversized and leaves
    // a withinUnit cursor that the real transport must round-trip.
    const hit = db.searchMessages('turn 68 message 0')[0].locator!
    const found = await page({ kind: 'target', locator: hit, sessionId, openGeneration })
    if (found.status !== 'ok') throw Error(found.status)
    const batch = await page({
      kind: 'earlierTurn',
      cursor: found.session.history.before!.cursor,
      sessionId,
      openGeneration
    })
    if (batch.status !== 'ok') throw Error(batch.status)
    const unit = batch.session.history.before!
    expect(unit.kind).toBe('withinUnit')
    const token = JSON.parse(Buffer.from(unit.cursor, 'base64url').toString())
    const forged = Buffer.from(JSON.stringify([...token.slice(0, 7), token[5] + 1])).toString(
      'base64url'
    )
    expect(
      await page({ kind: 'withinUnit', sessionId, openGeneration, cursor: forged })
    ).toMatchObject({ status: 'invalid' })
    const more = await page({ kind: 'withinUnit', sessionId, openGeneration, cursor: unit.cursor })
    expect(more.status === 'ok' && more.session.messages.at(-1)?.id).toBe(
      turnKeys[62][turnKeys[62].indexOf(batch.session.messages[0].id) - 1]
    )
    // AC3: a real target page commits the reference, then the store reads body chunks
    // through the same transport and replaces the message without a UI gesture.
    installChatStoreHarness()
    const requests = vi.spyOn(sessionApi, 'page').mockImplementation(client.page)
    vi.spyOn(sessionApi, 'cancelLoad').mockImplementation(client.cancelLoad)
    expect(await chatActions.openSearchHit(locator, false)).toBe(true)
    await vi.waitFor(() => {
      expect(
        useChatStore
          .getState()
          .sessions[sessionId].search?.view?.messages.find((message) => message.id === start)
          ?.parts[0]
      ).toMatchObject({ type: 'text', text })
    })
    expect(requests.mock.calls.filter(([q]) => q.kind === 'body').length).toBeGreaterThan(1)
    expect(collected).toEqual(turnKeys[62])
    expect(all).not.toHaveBeenCalled()
    expect(sender.sent).toHaveLength(0)
    expect(Math.max(...wire.map((f) => f.bytes))).toBeLessThanOrEqual(HISTORY_PAGE_BYTES)
  } finally {
    index.stop()
    sqlite.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

it('AC3″ resolves a republished body through the real port and AC19 prepends the five current turns', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys=ON')
  applyMigrations(sqlite)
  const db = new DbQueries(sqlite)
  const index = new HistoryIndex(db)
  const sessionId = 'republished'
  const sender = fakeClient()
  const initial = 'old '.repeat(90_000)
  const updated = 'current '.repeat(60_000)
  const observed: { offset: number; generation: string; bytes: number }[] = []
  try {
    db.insertSession({
      id: sessionId,
      backend: 'claude',
      title: 'current history',
      projectId: null,
      createdAt: 0
    })
    const turns: string[][] = []
    let target = 0
    for (let i = 0; i < 12; i++) {
      const keys: string[] = []
      for (const role of ['user', 'assistant'] as const) {
        const text = i === 11 && role === 'assistant' ? initial : role + ' ' + i
        const id = db.appendMessage({ sessionId, role, content: text, createdAt: i })
        db.appendPart({
          messageId: id,
          type: 'text',
          toolRunId: null,
          payloadJson: JSON.stringify({ text })
        })
        keys.push('m:' + id)
        target = id
      }
      turns.push(keys)
    }
    registerSessionLoadHandlers({ db, getCwd: () => '.' }, { historyIndex: index })
    const client = createSessionLoadClient({
      channels: {
        load: CHANNELS.sessionLoad,
        refresh: CHANNELS.sessionRefresh,
        cancel: CHANNELS.sessionLoadCancel,
        chunk: CHANNELS.sessionLoadChunk,
        page: CHANNELS.sessionHistoryPage
      },
      async invoke(channel, payload) {
        const response = (await invokeChannel(channel, payload, sender)) as HistoryPageReply
        if (response.status === 'body') {
          observed.push({
            offset: response.offset,
            generation: response.generation,
            bytes: response.bytes
          })
          if (observed.length === 1)
            sqlite
              .prepare('UPDATE message_parts SET payload_json=? WHERE message_id=?')
              .run(JSON.stringify({ text: updated }), target)
        }
        return response
      },
      send: (channel, payload) => sendChannel(channel, payload, sender),
      subscribe: () => () => {}
    })
    installChatStoreHarness()
    vi.stubGlobal('requestAnimationFrame', () => 1)
    vi.spyOn(sessionApi, 'load').mockImplementation(client.loadLatest)
    vi.spyOn(sessionApi, 'page').mockImplementation(client.page)
    const report = vi.spyOn(errors, 'reportError').mockImplementation(() => {})
    await chatActions.loadSession(sessionId)
    expect(report).not.toHaveBeenCalled()
    const entry = (): SessionEntry => useChatStore.getState().sessions[sessionId]
    await vi.waitFor(() =>
      expect(entry().session.messages.at(-1)?.parts).toEqual([{ type: 'text', text: updated }])
    )
    expect(observed.slice(0, 3).map((r) => r.offset)).toEqual([0, HISTORY_BODY_BYTES, 0])
    expect(observed[0].generation).not.toBe(observed[1].generation)
    expect(observed[1].bytes).toBe(
      Buffer.byteLength(JSON.stringify([{ type: 'text', text: updated }]))
    )
    expect(new Set(observed.slice(1).map((r) => r.generation))).toEqual(
      new Set([observed[1].generation])
    )
    expect(entry().history?.generation).toBe(observed[0].generation)
    expect(chatActions.readPrevious(sessionId)).toBe(true)
    await vi.waitFor(() => expect(entry().history?.generation).toBe(observed[1].generation))
    expect(entry().session.messages.map((m) => m.id)).toEqual(turns.slice(2).flat())
    expect(entry().history?.beforeState).toBeUndefined()
    expect(report).not.toHaveBeenCalled()
  } finally {
    index.stop()
    sqlite.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  }
})

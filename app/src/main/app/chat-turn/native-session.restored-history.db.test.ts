import Database from 'better-sqlite3'
import { rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { ClaudeAdapter } from '../../adapters/claude/adapter'
import {
  HISTORY_SESSION_ID as id,
  historyEntry,
  nativeHistoryFixture
} from '../../adapters/claude/native-history.testfixture'
import { HistoryIndex } from '../../features/history/turn-index'
import { readHistoryPage } from '../../features/history/history-page'
import type { AgentContext } from '../context'
import { createNativeHistoryReader } from '../native-history'
import { loadSession } from '../../features/history/reader'
import { refreshNativeHistory } from '../../features/history/native-sync'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { directDataPort } from '../data-host/data-port.testfixture'
import { prepareNativeSession } from './native-session'

const settings = vi.hoisted(() => ({ env: {} as Record<string, string> }))
vi.mock('./resolve-turn', () => ({ resolveTurnProvider: async () => ({ prepared: settings }) }))

it('keeps the archive searchable and follows only the replacement Claude file after the old UUID returns', async () => {
  const fixture = await nativeHistoryFixture()
  const sqlite = new Database(':memory:')
  try {
    sqlite.pragma('foreign_keys = ON')
    applyMigrations(sqlite)
    const db = new DbQueries(sqlite)
    db.insertSession({
      id,
      backend: 'claude',
      createdAt: 1,
      title: null,
      projectId: null,
      cwd: fixture.cwd
    })
    const adapter = new ClaudeAdapter()
    const request = { sessionId: id, cwd: fixture.cwd, env: { CLAUDE_CONFIG_DIR: fixture.config } }
    settings.env = request.env
    const data = directDataPort(db, { getCwd: () => fixture.cwd })
    const read = createNativeHistoryReader({
      data,
      registry: { get: () => adapter }
    } as unknown as AgentContext)
    const sync = (): ReturnType<typeof refreshNativeHistory> =>
      refreshNativeHistory(id, {
        db,
        isBusy: () => false,
        read: () => read(id)
      })
    const uuid = '8ab5ea0b-7ad2-424a-875c-e218a9e4d419'
    const before = historyEntry(uuid, null, 'user', 'archiveterm')
    const answer = historyEntry('e914fc58-b3be-4c9c-96e6-7cf5ebd0cb70', uuid, 'assistant', [
      { type: 'text', text: 'answer' }
    ])
    await fixture.write([before, answer])
    expect((await sync()).status).toBe('ready')
    await rename(fixture.file, fixture.file + '.saved')
    expect((await adapter.readHistory(request)).status).toBe('missing')
    const recovered = await prepareNativeSession(adapter, request, data)
    if (!recovered.ok || !recovered.value.nativeSessionId) throw Error('Expected a replacement')
    const nativeId = recovered.value.nativeSessionId
    expect(nativeId).not.toBe(id)
    expect(recovered.value).toMatchObject({
      recoveryFreshStart: true,
      recoveryHistory: expect.stringContaining('archiveterm')
    })
    expect((await data.query.nativeRecovery(id))?.native_id).toBe(nativeId)
    const prompt = 'bd546287-d5d4-48db-91f8-060b33318907'
    const reply = '7d659565-4a42-4f87-ab67-f15981c928dd'
    await data.write.nativeRecoveryPrompt(id, prompt, 'currentterm')
    const entries = [
      historyEntry(prompt, null, 'user', 'archiveterm + currentterm'),
      historyEntry(reply, prompt, 'assistant', [{ type: 'text', text: 'replacement answer' }])
    ]
    await writeFile(
      join(dirname(fixture.file), nativeId + '.jsonl'),
      entries
        .map((entry) => JSON.stringify({ ...entry, sessionId: nativeId, cwd: fixture.cwd }))
        .join('\n') + '\n'
    )
    await rename(fixture.file + '.saved', fixture.file)
    await fixture.write([historyEntry(uuid, null, 'user', 'returnedterm'), answer])
    expect((await sync()).status).toBe('ready')
    expect(await prepareNativeSession(adapter, request, data)).toEqual({
      ok: true,
      value: { nativeSessionId: nativeId }
    })
    const full = loadSession(db, id, () => fixture.cwd)!
    expect(full.id).toBe(id)
    expect(full.messages.map((m) => m.id)).toEqual(
      [uuid, answer.uuid, prompt, reply].map((key) => 'n:' + key)
    )
    expect(db.searchMessages('returnedterm')).toEqual([])
    const index = new HistoryIndex(db)
    const published = await index.prepare(id)
    expect(published?.generation).toBeTruthy()
    for (const [term, source, key] of [
      ['archiveterm', 'archive', uuid],
      ['currentterm', 'native', prompt]
    ]) {
      const hits = db.searchMessages(term)
      expect(hits).toHaveLength(1)
      expect(hits[0].locator).toMatchObject({ source, session: id })
      const page = readHistoryPage(
        { db, getCwd: () => fixture.cwd },
        {
          sessionId: id,
          requestId: 1,
          openGeneration: 2,
          kind: 'target',
          locator: hits[0].locator!
        },
        published!.generation
      )
      expect(page).toMatchObject({
        status: 'ok',
        targetMessage: 'n:' + key,
        session: {
          id,
          messages: expect.arrayContaining([
            {
              ...full.messages.find((m) => m.id === 'n:' + key),
              parts: [{ type: 'text', text: term }]
            }
          ])
        }
      })
    }
    index.stop()
  } finally {
    sqlite.close()
    await rm(fixture.root, { recursive: true, force: true })
  }
})

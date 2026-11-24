import Database from 'better-sqlite3'
import { rename, rm } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { ClaudeAdapter } from '../../adapters/claude/adapter'
import {
  HISTORY_SESSION_ID as id,
  historyEntry,
  nativeHistoryFixture
} from '../../adapters/claude/native-history.testfixture'
import { loadSession } from '../../features/history/reader'
import { refreshNativeHistory } from '../../features/history/native-sync'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { directDataPort } from '../data-host/data-port.testfixture'
import { prepareNativeSession } from './native-session'

it('observes archive and native hit identities when the missing Claude file returns', async () => {
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
    const sync = (): ReturnType<typeof refreshNativeHistory> =>
      refreshNativeHistory(id, {
        db,
        isBusy: () => false,
        read: (previous) => adapter.readHistory({ ...request, previous })
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
    const recovered = await prepareNativeSession(
      adapter,
      request,
      directDataPort(db, { getCwd: () => fixture.cwd })
    )
    expect(recovered).toMatchObject({
      ok: true,
      value: { nativeSessionId: id, recoveryFreshStart: true }
    })
    await rename(fixture.file + '.saved', fixture.file)
    await fixture.write([historyEntry(uuid, null, 'user', 'currentterm'), answer])
    expect((await sync()).status).toBe('ready')
    const messages = loadSession(db, id, () => fixture.cwd)!.messages
    const hits = ['archiveterm', 'currentterm'].map((q) => db.searchMessages(q))
    expect(hits.map((rows) => rows.length)).toEqual([1, 1])
    expect(hits[0][0].message_id).not.toEqual(hits[1][0].message_id)
    expect(messages.filter((m) => m.role === 'user').map((m) => [m.id, m.parts])).toEqual([
      ['n:' + uuid, [{ type: 'text', text: 'archiveterm' }]],
      ['n:' + uuid, [{ type: 'text', text: 'currentterm' }]]
    ])
  } finally {
    sqlite.close()
    await rm(fixture.root, { recursive: true, force: true })
  }
})

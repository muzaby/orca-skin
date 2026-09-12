import Database from 'better-sqlite3'
import { expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))
import { HistoryWriter } from './writer'
import { DbQueries } from '../../infra/db/queries'
import { applyMigrations } from '../../infra/db/migrate'
import type { TurnContext } from '../../contracts/turn'
import type { BackgroundEvent } from '../../../shared/background-task'

it('commits early provider events after session creation and relays canonical facts once', () => {
  const connection = new Database(':memory:')
  try {
    applyMigrations(connection)
    const db = new DbQueries(connection)
    const writer = new HistoryWriter(db, () => false)
    const event: BackgroundEvent = {
      type: 'background.snapshot',
      sessionId: 's',
      tasks: [{ taskId: 'orphan' }],
      source: { generation: 'g', sequence: 1, receivedAt: 1, replay: false, uuid: 'u' }
    }
    const committed = vi.fn(() => expect(db.background.list('s')).toHaveLength(1))
    writer.persistProviderEvent(event, committed)
    expect(committed).not.toHaveBeenCalled()
    const turn = {
      titleAdapter: { id: 'claude' },
      agentKind: 'code',
      providerKey: 'p',
      isNewSession: false
    } as TurnContext
    writer.persist(turn, { type: 'session.updated', sessionId: 's', patch: {} })
    expect(committed).toHaveBeenCalledOnce()
    writer.persistProviderEvent(event, committed)
    expect(committed).toHaveBeenCalledOnce()
    expect(db.loadParts('s')).toEqual([])
  } finally {
    connection.close()
  }
})

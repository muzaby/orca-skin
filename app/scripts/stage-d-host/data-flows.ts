import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { DbQueries } from '../../src/main/infra/db/queries'
import type { PortTransport } from '../../src/main/app/host-port-server'
import { UsageTracker } from '../../src/main/features/usage/tracker'
import { registerCostHandlers } from '../../src/main/app/handlers/cost'
import { applyMigrations } from '../../src/main/infra/db/migrate'
import { HistoryWriter } from '../../src/main/features/history/writer'
import { loadSession } from '../../src/main/features/history/reader'
import { CHANNELS, type AttachmentView } from '../../src/shared/ipc'

export function registerDataFlows(
  transport: PortTransport,
  db: DbQueries,
  database: Database.Database,
  cwd: string
): void {
  const now = new Date(2026, 5, 30, 12)
  const tracker = new UsageTracker(db.usage)
  for (const id of ['duplicate-a', 'duplicate-b'])
    db.insertSession({
      id,
      projectId: null,
      title: 'Same title',
      backend: 'claude',
      createdAt: 20000
    })
  const timings = new Map<string, number>()
  transport.handle('stage-d:usage-duration', (_event, range) => timings.get(String(range)))
  transport.handle('stage-d:reopen-attachments', (_event, payload) => {
    const { source, views } = payload as { source: string; views: AttachmentView[] }
    if (!['dialog', 'drag_drop', 'clipboard'].includes(source)) throw Error('unknown source')
    const path = join(cwd, source + '.sqlite')
    const connection = new Database(path)
    try {
      applyMigrations(connection)
      const history = new DbQueries(connection)
      history.insertSession({
        id: 'draft',
        title: 'Draft',
        projectId: null,
        backend: 'claude',
        createdAt: 1
      })
      new HistoryWriter(history, () => false).persistUserMessage('draft', 'sent draft', 2, views)
    } finally {
      connection.close()
    }
    const reopened = new Database(path, { fileMustExist: true })
    try {
      return loadSession(new DbQueries(reopened), 'draft', () => cwd)?.messages[0]
    } finally {
      reopened.close()
    }
  })
  registerCostHandlers({
    cost: {
      usageStats: (range) => {
        const start = performance.now()
        const value = tracker.usageStats(range, now.getTime())
        timings.set(range, performance.now() - start)
        return value
      }
    }
  } as Parameters<typeof registerCostHandlers>[0])
  db.appendMessage({
    sessionId: 'session-1',
    role: 'user',
    content: 'orchard sole-specific search body for first message',
    createdAt: 1
  })
  db.appendMessage({
    sessionId: 'session-2',
    role: 'user',
    content: 'tide distinct second message snippet',
    createdAt: 2
  })
  transport.handle('stage-d:period', (_event, period) => {
    if (![90, 91, 800].includes(Number(period))) throw Error('unknown period')
    database.prepare('DELETE FROM turn_model_usage').run()
    database.prepare('DELETE FROM turn_usage').run()
    for (const [back, inputTokens] of [
      [Number(period) - 1, 13],
      [0, 10]
    ]) {
      const day = new Date(now)
      day.setDate(day.getDate() - back)
      const common = {
        inputTokens,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0
      }
      const id = db.usage.insertTurnUsage({
        ...common,
        sessionId: 'session-1',
        messageId: null,
        createdAt: day.getTime(),
        totalCostUsd: 0
      })
      if (back === 0)
        db.usage.insertTurnModelUsage({
          ...common,
          turnUsageId: id,
          model: 'stage-model',
          inputTokens: 21,
          costUsd: 0,
          contextWindow: null
        })
    }
  })
  const watched = join(cwd, 'watch')
  transport.handle('stage-d:directory', async (_event, operation) => {
    if (operation === 'open') await mkdir(watched)
    else if (operation === 'create') await writeFile(join(watched, 'entry-one'), '')
    else if (operation === 'rename')
      await rename(join(watched, 'entry-one'), join(watched, 'entry-two'))
    else if (operation === 'delete') await rm(join(watched, 'entry-two'))
    else if (operation === 'replace') {
      await rename(watched, join(cwd, 'moved'))
      await mkdir(watched)
      await writeFile(join(watched, 'entry-three'), '')
    } else throw Error('unknown directory operation')
  })
}
export const extraChannels = [
  CHANNELS.searchMessages,
  CHANNELS.costUsageStats,
  CHANNELS.sessionSetPinned,
  CHANNELS.sessionDelete
]

import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ webContents: { getAllWebContents: () => [] } }))
import { openFileDatabase } from '../../infra/db/file-database'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import type { TurnContext } from '../../contracts/turn'
import { HistoryWriter } from './writer'
import { loadSession } from './reader'

it('restores each session model after closing and reopening its database, without using title models or unconsumed input', () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-last-model-'))
  const file = join(root, 'history.db')
  let db = openFileDatabase(file)
  try {
    applyMigrations(db)
    let queries = new DbQueries(db)
    const writer = new HistoryWriter(queries, () => false)
    for (const [id, backend, provider, model] of [
      ['A', 'claude', 'claude-team', 'claude-sonnet-4-6[1m]'],
      ['B', 'opencode', 'opencode-local', 'openai/gpt-5']
    ] as const) {
      queries.insertSession({
        id,
        backend,
        providerKey: provider,
        title: id,
        projectId: null,
        cwd: '/repo',
        createdAt: 1,
        agentKind: 'code'
      })
      const turn = {
        dbSessionId: id,
        providerKey: provider,
        modelFamily: model,
        titleModel: 'title-only',
        currentAssistantMessageId: null,
        assistantText: ''
      } as TurnContext
      writer.commitUserMessage(turn, { text: `message ${id}`, createdAt: 2 })
      expect(loadSession(queries, id, () => '/fallback')).toMatchObject({
        providerKey: provider,
        modelFamily: model
      })
      writer.persist(
        {
          ...turn,
          titleAdapter: { id: backend, complete: vi.fn() },
          agentKind: 'code',
          isNewSession: false,
          pendingUserText: 'not consumed',
          extraDirs: [],
          cwd: '/repo',
          providerKey: `${provider}-attempt`,
          modelFamily: 'not-consumed'
        } as TurnContext,
        { type: 'session.updated', sessionId: id, patch: {} }
      )
      expect(loadSession(queries, id, () => '/fallback')).toMatchObject({
        providerKey: provider,
        modelFamily: model
      })
    }
    // The last consumed turn replaces both provider and model in one statement.
    writer.commitUserMessage(
      {
        dbSessionId: 'A',
        providerKey: 'claude-other',
        modelFamily: 'claude-opus-4-6',
        currentAssistantMessageId: null,
        assistantText: ''
      } as TurnContext,
      { text: 'later', createdAt: 3 }
    )
    const usageId = queries.usage.insertTurnUsage({
      sessionId: 'A',
      messageId: null,
      createdAt: 4,
      inputTokens: 10,
      outputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalCostUsd: 0
    })
    queries.usage.insertTurnModelUsage({
      turnUsageId: usageId,
      model: 'title-telemetry-only',
      inputTokens: 10,
      outputTokens: 1,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      costUsd: 0,
      contextWindow: 1000
    })
    db.close()
    db = openFileDatabase(file)
    applyMigrations(db)
    queries = new DbQueries(db)
    expect(loadSession(queries, 'A', () => '/fallback')).toMatchObject({
      providerKey: 'claude-other',
      modelFamily: 'claude-opus-4-6',
      lastTelemetry: { model: 'title-telemetry-only' }
    })
    expect(loadSession(queries, 'B', () => '/fallback')).toMatchObject({
      providerKey: 'opencode-local',
      modelFamily: 'openai/gpt-5'
    })
    queries.insertSession({
      id: 'legacy',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 1
    })
    expect(loadSession(queries, 'legacy', () => '/fallback')?.modelFamily).toBeNull()
  } finally {
    db.close()
    rmSync(root, { recursive: true, force: true })
  }
})

it('upgrades an existing database without losing conversation rows or messages', () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-model-upgrade-'))
  const db = openFileDatabase(join(root, 'history.db'))
  try {
    applyMigrations(db)
    db.exec('ALTER TABLE sessions DROP COLUMN last_model')
    db.prepare('DELETE FROM _migrations WHERE name = ?').run('0033_session_last_model')
    db.prepare(
      'INSERT INTO sessions (id, backend, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run('legacy', 'claude', 'kept', 1, 1)
    db.prepare(
      'INSERT INTO messages (session_id, role, content, created_at, idx, complete) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('legacy', 'user', 'kept message', 1, 0, 1)
    applyMigrations(db)
    expect(db.prepare('SELECT title, last_model FROM sessions WHERE id = ?').get('legacy')).toEqual(
      { title: 'kept', last_model: null }
    )
    expect(db.prepare('SELECT content FROM messages WHERE session_id = ?').get('legacy')).toEqual({
      content: 'kept message'
    })
  } finally {
    db.close()
    rmSync(root, { recursive: true, force: true })
  }
})

import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OpenCodeEventMapper } from '../../adapters/opencode/v1/map'
import { openCodeContextWindow } from '../../adapters/opencode/v1/context-usage'
import { assistantMessage, openCodeEvent } from '../../adapters/opencode/v1/adapter.testfixture'
import { applyMigrations } from '../../infra/db/migrate'
import { openFileDatabase } from '../../infra/db/file-database'
import { DbQueries } from '../../infra/db/queries'
import { UsageTracker } from '../../features/usage/tracker'
import { loadSession } from '../../features/history/reader'
import type { TurnContext } from '../../contracts/turn'

describe('OpenCode last-step context through persistence', () => {
  it('keeps the latest step despite late prior updates, preserves billing totals and restores the donut after reopening', () => {
    const mapper = new OpenCodeEventMapper('s1', 'user', {
      provider: { 'provider-1': { models: { 'model-1': { limit: { context: 123456 } } } } }
    })
    const first = { ...assistantMessage('s1', 'user', 'a1'), time: { created: 1 } }
    const last = {
      ...assistantMessage('s1', 'user', 'a2'),
      time: { created: 2 },
      tokens: { input: 70, output: 100, reasoning: 0, cache: { read: 20, write: 10 } }
    }
    for (const info of [first, last, first])
      mapper.map(openCodeEvent('message.updated', { sessionID: 's1', info }))
    const telemetry = mapper.finish().find((event) => event.type === 'telemetry')!
    expect(telemetry.usage).toMatchObject({
      inputTokens: 80,
      outputTokens: 120,
      cacheReadTokens: 24,
      cacheCreationTokens: 15,
      contextTokens: 100,
      contextWindow: 123456,
      costUsd: 0.5
    })
    const root = mkdtempSync(join(tmpdir(), 'orca-context-'))
    const file = join(root, 'test.db')
    let db = openFileDatabase(file, { initialize: applyMigrations })
    try {
      let queries = new DbQueries(db)
      queries.insertSession({
        id: 's1',
        backend: 'opencode',
        title: 'Usage',
        projectId: null,
        cwd: 'C:/work',
        createdAt: 1
      })
      new UsageTracker(queries.usage).recordTurnUsage(
        { dbSessionId: 's1', currentAssistantMessageId: null } as TurnContext,
        telemetry
      )
      db.close()
      db = openFileDatabase(file, { initialize: applyMigrations })
      queries = new DbQueries(db)
      expect(loadSession(queries, 's1', () => 'C:/work')?.lastTelemetry).toMatchObject({
        contextTokens: 100,
        contextWindow: 123456,
        inputTokens: 80,
        outputTokens: 120
      })
      expect(queries.usage.sumSessionCostUsd('s1')).toBe(0.5)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
  it('uses 200k for an absent/invalid selected model limit, without borrowing another provider', () => {
    expect(openCodeContextWindow({}, 'a/b')).toBe(200000)
    for (const context of [0, -1, '128000', Infinity])
      expect(
        openCodeContextWindow({ provider: { a: { models: { b: { limit: { context } } } } } }, 'a/b')
      ).toBe(200000)
    expect(
      openCodeContextWindow(
        { provider: { other: { models: { b: { limit: { context: 1000 } } } } } },
        'a/b'
      )
    ).toBe(200000)
  })
  it('persists an explicitly empty latest step instead of resurrecting the previous nonzero context', () => {
    const db = new Database(':memory:')
    try {
      applyMigrations(db)
      const queries = new DbQueries(db)
      queries.insertSession({
        id: 's1',
        backend: 'opencode',
        title: 'Usage',
        projectId: null,
        cwd: 'C:/work',
        createdAt: 1
      })
      const tracker = new UsageTracker(queries.usage)
      const turn = { dbSessionId: 's1', currentAssistantMessageId: null } as TurnContext
      tracker.recordTurnUsage(turn, {
        type: 'telemetry',
        sessionId: 's1',
        usage: { inputTokens: 500, contextTokens: 500 }
      })
      const mapper = new OpenCodeEventMapper('s1', 'user', {})
      mapper.map(
        openCodeEvent('message.updated', {
          sessionID: 's1',
          info: {
            ...assistantMessage('s1', 'user', 'last'),
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
          }
        })
      )
      tracker.recordTurnUsage(
        turn,
        mapper.finish().find((event) => event.type === 'telemetry')!
      )
      expect(loadSession(queries, 's1', () => 'C:/work')?.lastTelemetry).toMatchObject({
        contextTokens: 0,
        contextWindow: 200000
      })
    } finally {
      db.close()
    }
  })
})

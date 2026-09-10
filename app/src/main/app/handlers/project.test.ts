import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '../../../shared/ipc'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'

const registered = vi.hoisted(() => new Map<string, (request?: unknown) => unknown>())
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    schema: { parse: (input: unknown) => unknown },
    _policy: string,
    handler: (input: unknown) => unknown
  ) => registered.set(channel, (input) => handler(schema.parse(input))),
  handlePlain: (channel: string, handler: () => unknown) => registered.set(channel, handler)
}))
import { registerProjectHandlers } from './project'
let sqlite: Database.Database
beforeEach(() => {
  sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  applyMigrations(sqlite)
  registered.clear()
  registerProjectHandlers({ db: new DbQueries(sqlite) })
})
afterEach(() => sqlite.close())
const call = (channel: string, input?: unknown): unknown => registered.get(channel)!(input)

describe('registered project IPC with real SQLite', () => {
  it('persists instruction edits and exposes them on list without replacing name or cwd', () => {
    const created = call(CHANNELS.projectCreate, {
      name: 'ignored',
      cwd: 'C:\\Engineering\\Demo',
      instructions: 'Initial'
    }) as { id: string }
    call(CHANNELS.projectUpdate, { id: created.id, instructions: 'Saved instructions' })
    expect(call(CHANNELS.projectList)).toEqual([
      expect.objectContaining({
        id: created.id,
        name: 'Demo',
        cwd: 'C:\\Engineering\\Demo',
        instructions: 'Saved instructions'
      })
    ])
    const reused = call(CHANNELS.projectCreate, {
      name: 'New name',
      cwd: 'c:/engineering/demo/',
      instructions: 'Do not replace'
    }) as { id: string }
    expect(reused.id).toBe(created.id)
    expect(call(CHANNELS.projectList)).toEqual([
      expect.objectContaining({ instructions: 'Saved instructions' })
    ])
  })
  it('keeps manual legacy creation and name editing, and rejects invalid path and oversized instructions', () => {
    const created = call(CHANNELS.projectCreate, { name: 'Legacy', instructions: '' }) as {
      id: string
    }
    call(CHANNELS.projectUpdate, { id: created.id, name: 'Renamed' })
    expect(call(CHANNELS.projectList)).toEqual([
      expect.objectContaining({ name: 'Renamed', cwd: null })
    ])
    expect(() => call(CHANNELS.projectCreate, { name: 'Bad', cwd: 'relative' })).toThrow()
    expect(() =>
      call(CHANNELS.projectUpdate, { id: created.id, instructions: 'a'.repeat(8001) })
    ).toThrow()
  })
})

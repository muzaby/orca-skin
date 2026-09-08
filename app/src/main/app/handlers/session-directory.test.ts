import Database from 'better-sqlite3'
import { mkdtempSync, mkdirSync, rmSync, realpathSync, writeFileSync, symlinkSync } from 'node:fs'
import { join, dirname, resolve, parse } from 'node:path'
import { tmpdir } from 'node:os'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHANNELS,
  type AddSessionDirectoryRequest,
  type AddSessionDirectoryResult
} from '../../../shared/ipc'
import { MAX_SESSION_EXTRA_DIRECTORIES } from '../../../shared/extra-directories'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { RuntimeSupervisor } from '../../features/sessions/supervisor'
import { sessionLeaseKey } from '../../features/sessions/session-chain-lease'
import { addSessionDirectory } from './session-directory'
import { loadSession } from '../../features/history/reader'
import { resolveTurnExtraDirs } from '../chat-turn/turn-context'

const registrations = vi.hoisted(
  () =>
    new Map<
      string,
      {
        schema: { safeParse: (value: unknown) => { success: boolean } }
        fallback: unknown
        callback: (request: AddSessionDirectoryRequest) => Promise<AddSessionDirectoryResult>
      }
    >()
)
vi.mock('../../infra/ipc/handle', () => ({
  handle: (channel: string, schema: unknown, mode: { fallback: unknown }, callback: unknown) =>
    registrations.set(channel, { schema, fallback: mode.fallback, callback } as never),
  handlePlain: vi.fn()
}))
import { registerSessionHandlers } from './session'

let root: string
let directory: string
let db: Database.Database
let queries: DbQueries
let busy: boolean
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-session-directory-'))
  directory = join(root, 'reference')
  mkdirSync(directory)
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  queries = new DbQueries(db)
  busy = false
  registrations.clear()
  queries.insertSession({
    id: 'work',
    backend: 'claude',
    title: 'Work',
    projectId: null,
    createdAt: 1,
    cwd: root,
    agentKind: 'work'
  })
  const messageId = queries.appendMessage({
    sessionId: 'work',
    role: 'user',
    content: 'synthetic',
    createdAt: 1
  })
  queries.appendPart({
    messageId,
    type: 'text',
    toolRunId: null,
    payloadJson: '{"text":"synthetic"}'
  })
  registerSessionHandlers(
    { db: queries, getCwd: () => root, settings: { getAll: vi.fn(), patch: vi.fn() } },
    {
      isSessionBusy: () => busy
    }
  )
})
afterEach(() => {
  db.close()
  if (dirname(root) !== resolve(tmpdir()) || !root.includes('orca-session-directory-'))
    throw new Error('unsafe cleanup')
  rmSync(root, { recursive: true, force: true })
})
const request = (): AddSessionDirectoryRequest => ({ sessionId: 'work', directory })
async function invoke(value: AddSessionDirectoryRequest): Promise<AddSessionDirectoryResult> {
  const registered = registrations.get(CHANNELS.sessionAddDirectory)
  expect(registered).toBeDefined()
  if (!registered!.schema.safeParse(value).success)
    return registered!.fallback as AddSessionDirectoryResult
  return registered!.callback(value)
}
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let complete!: (value: T) => void
  return {
    promise: new Promise<T>((resolve) => {
      complete = resolve
    }),
    resolve: (value) => complete(value)
  }
}

describe('Work session:addDirectory — production registration, filesystem and SQLite', () => {
  it('persists canonical directories, restores them and uses DB scope on resume', async () => {
    expect(await invoke(request())).toEqual({ ok: true, extraDirs: [realpathSync(directory)] })
    const meta = queries.getSessionById('work')!
    expect(meta.cwd).toBe(root)
    expect(loadSession(queries, 'work', () => root)?.extraDirs).toEqual([realpathSync(directory)])
    expect(resolveTurnExtraDirs({ sessionId: 'work', extraDirs: ['C:/forged'] }, meta)).toEqual([
      realpathSync(directory)
    ])
  })
  it('keeps duplicate and cwd selections idempotent without a DB write', async () => {
    await invoke(request())
    const update = vi.spyOn(queries, 'updateSessionExtraDirs')
    expect(await invoke(request())).toEqual({ ok: true, extraDirs: [realpathSync(directory)] })
    expect(await invoke({ ...request(), directory: root })).toEqual({
      ok: true,
      extraDirs: [realpathSync(directory)]
    })
    expect(update).not.toHaveBeenCalled()
  })
  it('rejects raw root, relative, missing directory and a file', async () => {
    writeFileSync(join(root, 'file.md'), 'fixture')
    for (const invalid of [
      parse(root).root,
      'relative',
      join(root, 'missing'),
      join(root, 'file.md')
    ]) {
      expect(await invoke({ ...request(), directory: invalid })).toEqual({
        ok: false,
        reason: 'invalid-directory'
      })
    }
    expect(queries.getSessionById('work')!.extra_dirs).toBeNull()
  })
  it('rejects a junction or symlink that resolves to the filesystem root', async () => {
    const filesystemRoot = parse(root).root
    const alias = join(root, 'root-alias')
    symlinkSync(filesystemRoot, alias, process.platform === 'win32' ? 'junction' : 'dir')
    expect(await invoke({ ...request(), directory: alias })).toEqual({
      ok: false,
      reason: 'invalid-directory'
    })
  })
  it('rejects Coding and missing sessions without granting directories', async () => {
    queries.insertSession({
      id: 'coding',
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 1
    })
    expect(await invoke({ sessionId: 'coding', directory })).toEqual({
      ok: false,
      reason: 'not-work'
    })
    expect(await invoke({ sessionId: 'missing', directory })).toEqual({
      ok: false,
      reason: 'not-found'
    })
  })
  it('rejects busy sessions before filesystem lookup', async () => {
    busy = true
    const resolver = vi.fn()
    expect(
      await addSessionDirectory(
        { db: queries, isSessionBusy: () => busy, resolveDirectory: resolver },
        request()
      )
    ).toEqual({ ok: false, reason: 'busy' })
    expect(resolver).not.toHaveBeenCalled()
  })
  it('treats preparing leases as busy before an active child exists', async () => {
    const supervisor = new RuntimeSupervisor()
    supervisor.acquireChain({
      logicalKey: sessionLeaseKey('work'),
      owner: {},
      sessionId: 'work',
      requestedProviderKey: null,
      agentKind: 'work'
    })
    expect(
      await addSessionDirectory(
        { db: queries, isSessionBusy: (id) => supervisor.hasSession(id) },
        request()
      )
    ).toEqual({ ok: false, reason: 'busy' })
  })
  it('rechecks busy after filesystem awaits and preserves the database', async () => {
    const gate = deferred<string>()
    const result = addSessionDirectory(
      {
        db: queries,
        isSessionBusy: () => busy,
        resolveDirectory: (path) => (path === directory ? gate.promise : Promise.resolve(path))
      },
      request()
    )
    busy = true
    gate.resolve(directory)
    expect(await result).toEqual({ ok: false, reason: 'busy' })
    expect(queries.getSessionById('work')!.extra_dirs).toBeNull()
  })
  it('does not recreate a session deleted during folder validation', async () => {
    const gate = deferred<string>()
    const result = addSessionDirectory(
      {
        db: queries,
        isSessionBusy: () => false,
        resolveDirectory: (path) => (path === directory ? gate.promise : Promise.resolve(path))
      },
      request()
    )
    queries.deleteSession('work')
    gate.resolve(directory)
    expect(await result).toEqual({ ok: false, reason: 'not-found' })
    expect(queries.getSessionById('work')).toBeUndefined()
  })
  it('merges concurrent additions from the latest DB row', async () => {
    const second = join(root, 'second')
    mkdirSync(second)
    const results = await Promise.all([
      invoke(request()),
      invoke({ ...request(), directory: second })
    ])
    expect(results.every((result) => result.ok)).toBe(true)
    expect(JSON.parse(queries.getSessionById('work')!.extra_dirs!)).toEqual(
      expect.arrayContaining([realpathSync(directory), realpathSync(second)])
    )
  })
  it('refuses new additions at the limit while preserving prior entries', async () => {
    const existing = Array.from({ length: MAX_SESSION_EXTRA_DIRECTORIES }, (_, i) =>
      join(root, `old-${i}`)
    )
    queries.updateSessionExtraDirs('work', existing)
    expect(await invoke(request())).toEqual({ ok: false, reason: 'limit' })
    expect(JSON.parse(queries.getSessionById('work')!.extra_dirs!)).toEqual(existing)
  })
  it('returns failed when persistence fails and never claims success', async () => {
    vi.spyOn(queries, 'updateSessionExtraDirs').mockImplementation(() => {
      throw new Error('disk full')
    })
    expect(await invoke(request())).toEqual({ ok: false, reason: 'failed' })
    expect(queries.getSessionById('work')!.extra_dirs).toBeNull()
  })
})

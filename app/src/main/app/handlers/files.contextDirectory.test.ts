import Database from 'better-sqlite3'
import {
  mkdtempSync,
  mkdirSync,
  realpathSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  promises as fs
} from 'node:fs'
import { dirname, join, parse, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS, type OpenPathRequest } from '../../../shared/ipc'
import { DbQueries } from '../../infra/db/queries'
import { applyMigrations } from '../../infra/db/migrate'

const host = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, raw: unknown) => unknown>(),
  openPath: vi.fn<(path: string) => Promise<string>>().mockResolvedValue(''),
  reveal: vi.fn()
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, raw: unknown) => unknown) =>
      host.handlers.set(channel, listener)
  },
  BrowserWindow: { fromWebContents: vi.fn() },
  Notification: { isSupported: () => false },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: host.openPath, showItemInFolder: host.reveal }
}))
const { registerFilesHandlers } = await import('./files')

let root: string
let cwd: string
let directory: string
let db: Database.Database
let queries: DbQueries
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orca-context-open-'))
  cwd = join(root, 'Workspace')
  directory = join(root, 'References')
  mkdirSync(cwd)
  mkdirSync(directory)
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  queries = new DbQueries(db)
  for (const id of ['work', 'other', 'code'])
    queries.insertSession({
      id,
      backend: 'claude',
      title: null,
      projectId: null,
      createdAt: 1,
      cwd,
      agentKind: id === 'code' ? 'code' : 'work'
    })
  queries.updateSessionExtraDirs('work', [realpathSync(directory)])
  queries.updateSessionExtraDirs('code', [realpathSync(directory)])
  host.handlers.clear()
  host.openPath.mockReset().mockResolvedValue('')
  host.reveal.mockClear()
  registerFilesHandlers({ getCwd: () => cwd, db: queries })
})
afterEach(() => {
  vi.restoreAllMocks()
  db.close()
  if (dirname(root) !== resolve(tmpdir()) || !root.includes('orca-context-open-'))
    throw new Error('unsafe cleanup')
  rmSync(root, { recursive: true, force: true })
})
const request = (): OpenPathRequest => ({ path: directory, mode: 'directory', sessionId: 'work' })
const invoke = (payload: unknown): Promise<unknown> =>
  Promise.resolve(host.handlers.get(CHANNELS.filesOpenPath)!({}, payload))

describe('Context directory open — actual registration, SQLite and filesystem', () => {
  it('opens the stored Work extra directory without changing cwd or allowed scope', async () => {
    const before = queries.getSessionById('work')!
    await invoke(request())
    expect(host.openPath).toHaveBeenCalledExactlyOnceWith(await fs.realpath(directory))
    expect(host.reveal).not.toHaveBeenCalled()
    expect(queries.getSessionById('work')).toEqual(before)
  })
  it('opens the actual session cwd without requiring a duplicate extra folder', async () => {
    await invoke({ ...request(), path: cwd })
    expect(host.openPath).toHaveBeenCalledExactlyOnceWith(await fs.realpath(cwd))
    await expect(invoke({ ...request(), path: root })).rejects.toThrow('허용되지 않은')
  })
  it.each(['other', 'code', 'missing'])(
    'rejects a folder outside the requested %s Work scope',
    async (sessionId) => {
      await expect(invoke({ ...request(), sessionId })).rejects.toThrow('허용되지 않은')
      expect(host.openPath).not.toHaveBeenCalled()
    }
  )
  it('rejects an invalid persisted kind instead of treating it as Code', async () => {
    db.pragma('ignore_check_constraints = ON')
    db.prepare("UPDATE sessions SET agent_kind = 'corrupt' WHERE id = 'work'").run()
    db.pragma('ignore_check_constraints = OFF')
    await expect(invoke(request())).rejects.toThrow('Invalid agent kind')
    expect(host.openPath).not.toHaveBeenCalled()
  })
  it('does not allow descendants or unrelated directories by prefix matching', async () => {
    const child = join(directory, 'child')
    mkdirSync(child)
    await expect(invoke({ ...request(), path: child })).rejects.toThrow('허용되지 않은')
    await expect(invoke({ ...request(), path: root })).rejects.toThrow('허용되지 않은')
    expect(host.openPath).not.toHaveBeenCalled()
  })
  it('rejects missing folders and paths whose current target is a file', async () => {
    rmSync(directory, { recursive: true })
    await expect(invoke(request())).rejects.toThrow()
    writeFileSync(directory, 'now a file')
    await expect(invoke(request())).rejects.toThrow('디렉토리만')
    expect(host.openPath).not.toHaveBeenCalled()
  })
  it('rejects a saved alias whose actual target is the filesystem root', async () => {
    const alias = join(root, 'root-alias')
    symlinkSync(parse(root).root, alias, process.platform === 'win32' ? 'junction' : 'dir')
    queries.updateSessionExtraDirs('work', [alias])
    await expect(invoke({ ...request(), path: alias })).rejects.toThrow()
    expect(host.openPath).not.toHaveBeenCalled()
  })
  it('supports an explicitly stored directory alias while keeping exact recorded membership', async () => {
    const alias = join(root, 'reference-alias')
    symlinkSync(directory, alias, process.platform === 'win32' ? 'junction' : 'dir')
    queries.updateSessionExtraDirs('work', [alias])
    await invoke({ ...request(), path: alias })
    expect(host.openPath).toHaveBeenCalledExactlyOnceWith(await fs.realpath(directory))
    await expect(invoke(request())).rejects.toThrow('허용되지 않은')
  })
  it('rechecks the stored session after asynchronous path resolution', async () => {
    const realpath = fs.realpath
    let continueResolve!: (value: string) => void
    const gate = new Promise<string>((done) => {
      continueResolve = done
    })
    vi.spyOn(fs, 'realpath').mockImplementation((path) =>
      path === directory ? gate : realpath(path)
    )
    const opening = invoke(request())
    queries.deleteSession('work')
    continueResolve(realpathSync(directory))
    await expect(opening).rejects.toThrow('허용되지 않은')
    expect(host.openPath).not.toHaveBeenCalled()
  })
  it('propagates native failure so the chip can show an error and retry', async () => {
    host.openPath.mockResolvedValueOnce('native open failed')
    await expect(invoke(request())).rejects.toThrow('native open failed')
    await invoke(request())
    expect(host.openPath).toHaveBeenCalledTimes(2)
    expect(JSON.parse(queries.getSessionById('work')!.extra_dirs!)).toEqual([
      realpathSync(directory)
    ])
  })
  it('keeps unscoped extra directory closed while legacy cwd opening works', async () => {
    await expect(invoke({ path: directory, mode: 'directory' })).rejects.toThrow('허용되지 않은')
    expect(host.reveal).not.toHaveBeenCalled()
    await invoke({ path: cwd, mode: 'directory' })
    expect(host.openPath).toHaveBeenCalledExactlyOnceWith(cwd)
  })
})

describe('Context file reveal — session scope and actual filesystem paths', () => {
  it('reveals only the exact attachment file registered in this session outside its folders', async () => {
    const file = join(root, 'stored-input.md')
    const other = join(root, 'other-input.md')
    writeFileSync(file, 'reference')
    writeFileSync(other, 'unrelated')
    const messageId = queries.appendMessage({
      sessionId: 'work',
      role: 'user',
      content: 'input',
      createdAt: 1
    })
    queries.appendPart({
      messageId,
      type: 'attachment',
      toolRunId: null,
      payloadJson: JSON.stringify({
        attachments: [{ path: realpathSync(file), sha256: 'a'.repeat(64) }]
      })
    })
    await invoke({ path: file, mode: 'reveal', sessionId: 'work' })
    expect(host.reveal).toHaveBeenCalledExactlyOnceWith(realpathSync(file))
    await expect(invoke({ path: other, mode: 'reveal', sessionId: 'work' })).rejects.toThrow(
      '허용되지 않은'
    )
    await expect(invoke({ path: file, mode: 'reveal', sessionId: 'other' })).rejects.toThrow(
      '허용되지 않은'
    )
    await expect(invoke({ path: root, mode: 'directory', sessionId: 'work' })).rejects.toThrow(
      '허용되지 않은'
    )
  })

  it('does not follow a registered attachment that is later redirected', async () => {
    const originalDirectory = join(root, 'Stored')
    const replacementDirectory = join(root, 'Replacement')
    mkdirSync(originalDirectory)
    mkdirSync(replacementDirectory)
    const file = join(originalDirectory, 'input.md')
    writeFileSync(file, 'original')
    writeFileSync(join(replacementDirectory, 'input.md'), 'unrelated')
    const messageId = queries.appendMessage({
      sessionId: 'work',
      role: 'user',
      content: 'input',
      createdAt: 1
    })
    queries.appendPart({
      messageId,
      type: 'attachment',
      toolRunId: null,
      payloadJson: JSON.stringify({
        attachments: [{ path: realpathSync(file), sha256: 'a'.repeat(64) }]
      })
    })
    rmSync(file)
    rmSync(originalDirectory, { recursive: true })
    symlinkSync(
      replacementDirectory,
      originalDirectory,
      process.platform === 'win32' ? 'junction' : 'dir'
    )
    await expect(invoke({ path: file, mode: 'reveal', sessionId: 'work' })).rejects.toThrow(
      '허용되지 않은'
    )
    expect(host.reveal).not.toHaveBeenCalled()
  })

  it('uses recorded extra folders when the session has no cwd', async () => {
    db.prepare('UPDATE sessions SET cwd = NULL WHERE id = ?').run('work')
    const file = join(directory, 'report.md')
    writeFileSync(file, 'fixture')
    await invoke({ path: file, mode: 'reveal', sessionId: 'work' })
    expect(host.reveal).toHaveBeenCalledExactlyOnceWith(realpathSync(file))
  })

  it.each(['cwd', 'extra'])(
    'reveals files inside the session %s, including descendants',
    async (scope) => {
      const child = join(scope === 'cwd' ? cwd : directory, 'child')
      mkdirSync(child)
      const file = join(child, 'report.md')
      writeFileSync(file, 'fixture')
      await invoke({ path: file, mode: 'reveal', sessionId: 'work' })
      expect(host.reveal).toHaveBeenCalledExactlyOnceWith(realpathSync(file))
      expect(host.openPath).not.toHaveBeenCalled()
    }
  )

  it.each(['other', 'code', 'missing'])(
    'rejects files outside the requested %s Work scope',
    async (sessionId) => {
      const file = join(directory, 'report.md')
      writeFileSync(file, 'fixture')
      await expect(invoke({ path: file, mode: 'reveal', sessionId })).rejects.toThrow(
        '허용되지 않은'
      )
      expect(host.reveal).not.toHaveBeenCalled()
    }
  )

  it('does not fall back to other sessions or allow lexical traversal outside the requested scope', async () => {
    const unrelated = join(root, 'Elsewhere')
    mkdirSync(unrelated)
    db.prepare('UPDATE sessions SET cwd = ? WHERE id = ?').run(unrelated, 'other')
    const file = join(unrelated, 'report.md')
    writeFileSync(file, 'fixture')
    for (const path of [file, `${cwd}/../Elsewhere/report.md`, 'report.md']) {
      await expect(invoke({ path, mode: 'reveal', sessionId: 'work' })).rejects.toThrow(
        '허용되지 않은'
      )
    }
    expect(host.reveal).not.toHaveBeenCalled()
  })

  it('rejects an in-scope junction escaping to an unrecorded actual directory', async () => {
    const unrelated = join(root, 'Elsewhere')
    mkdirSync(unrelated)
    writeFileSync(join(unrelated, 'report.md'), 'fixture')
    const alias = join(cwd, 'escape')
    symlinkSync(unrelated, alias, process.platform === 'win32' ? 'junction' : 'dir')
    await expect(
      invoke({ path: join(alias, 'report.md'), mode: 'reveal', sessionId: 'work' })
    ).rejects.toThrow('허용되지 않은')
    expect(host.reveal).not.toHaveBeenCalled()
  })

  it('requires lexical membership even when an outside alias resolves to a recorded directory', async () => {
    const alias = join(root, 'outside-alias')
    symlinkSync(directory, alias, process.platform === 'win32' ? 'junction' : 'dir')
    writeFileSync(join(directory, 'report.md'), 'fixture')
    await expect(
      invoke({ path: join(alias, 'report.md'), mode: 'reveal', sessionId: 'work' })
    ).rejects.toThrow('허용되지 않은')
    expect(host.reveal).not.toHaveBeenCalled()
  })

  it('supports an explicitly recorded root alias and reveals the resolved file', async () => {
    const alias = join(root, 'reference-alias')
    symlinkSync(directory, alias, process.platform === 'win32' ? 'junction' : 'dir')
    queries.updateSessionExtraDirs('work', [alias])
    const file = join(directory, 'report.md')
    writeFileSync(file, 'fixture')
    await invoke({ path: join(alias, 'report.md'), mode: 'reveal', sessionId: 'work' })
    expect(host.reveal).toHaveBeenCalledExactlyOnceWith(realpathSync(file))
  })

  it.each(['delete', 'remove-extra', 'change-cwd'])(
    'rechecks session scope after path resolution: %s',
    async (change) => {
      const file = join(change === 'change-cwd' ? cwd : directory, 'report.md')
      writeFileSync(file, 'fixture')
      const realpath = fs.realpath
      let continueResolve!: (value: string) => void
      const gate = new Promise<string>((done) => {
        continueResolve = done
      })
      vi.spyOn(fs, 'realpath').mockImplementation((path) => (path === file ? gate : realpath(path)))
      const opening = invoke({ path: file, mode: 'reveal', sessionId: 'work' })
      if (change === 'delete') queries.deleteSession('work')
      else if (change === 'remove-extra') queries.updateSessionExtraDirs('work', [])
      else db.prepare('UPDATE sessions SET cwd = ? WHERE id = ?').run(root, 'work')
      continueResolve(realpathSync(file))
      await expect(opening).rejects.toThrow('허용되지 않은')
      expect(host.reveal).not.toHaveBeenCalled()
    }
  )

  it('rejects directories and missing files', async () => {
    await expect(invoke({ path: directory, mode: 'reveal', sessionId: 'work' })).rejects.toThrow(
      '파일만'
    )
    await expect(
      invoke({ path: join(directory, 'missing.md'), mode: 'reveal', sessionId: 'work' })
    ).rejects.toThrow()
    expect(host.reveal).not.toHaveBeenCalled()
  })
})

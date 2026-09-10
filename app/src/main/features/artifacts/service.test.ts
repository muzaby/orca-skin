import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { unlinkSync, writeFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyMigrations } from '../../infra/db/migrate'
import { DbQueries } from '../../infra/db/queries'
import { ArtifactService, type ArtifactPublishContext } from './service'
import { ArtifactFiles } from './files'
import { orcaConfigDir } from '../../infra/config/paths'
import { partFromRow } from '../../infra/ipc/dto'

const configFixture = vi.hoisted(() => ({ root: '' }))
vi.mock('../../infra/config/paths', async (original) => ({
  ...(await original<typeof import('../../infra/config/paths')>()),
  orcaConfigDir: () => configFixture.root
}))
vi.mock('../../infra/config/temp-path', () => ({
  getTemporaryFilesPath: () => join(configFixture.root, 'tmp')
}))

const roots: string[] = []
const databases: Database.Database[] = []
async function setup(fileDb = false): Promise<{
  root: string
  cwd: string
  rootDir: string
  db: Database.Database
  q: DbQueries
  service: ArtifactService
  context: ArtifactPublishContext
  controller: AbortController
  trashItem: ReturnType<typeof vi.fn<(path: string) => Promise<void>>>
  isInputFile: ReturnType<typeof vi.fn<(sessionId: string, path: string, hash: string) => boolean>>
}> {
  const root = await mkdtemp(join(tmpdir(), 'orca-artifact-'))
  roots.push(root)
  configFixture.root = root
  const cwd = join(root, 'workspace')
  const rootDir = join(orcaConfigDir(), 'artifacts')
  await mkdir(cwd)
  const db = new Database(fileDb ? join(root, 'orcinus-orca.db') : ':memory:')
  databases.push(db)
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  const q = new DbQueries(db)
  q.insertSession({ id: 'a', backend: 'claude', title: null, projectId: null, createdAt: 1 })
  q.insertSession({ id: 'b', backend: 'claude', title: null, projectId: null, createdAt: 1 })
  const trashItem = vi.fn(async (path: string) => {
    await rm(path)
  })
  const isInputFile = vi.fn<(sessionId: string, path: string, hash: string) => boolean>(() => false)
  const service = new ArtifactService({ queries: q.artifacts, rootDir, trashItem, isInputFile })
  const controller = new AbortController()
  const context = {
    sessionId: 'a',
    cwd,
    extraDirs: [] as string[],
    signal: controller.signal,
    isCurrent: () => true
  }
  await writeFile(join(cwd, 'report.md'), '# Original')
  return { root, cwd, rootDir, db, q, service, context, controller, trashItem, isInputFile }
}
afterEach(async () => {
  vi.restoreAllMocks()
  for (const db of databases.splice(0)) db.close()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('artifact real filesystem and SQLite publication', () => {
  it('keeps unchanged attachments in context and collects only a changed or newly generated file as output', async () => {
    const f = await setup()
    const directory = join(f.root, 'tmp')
    await mkdir(directory)
    const path = join(directory, 'attachment.md')
    await writeFile(path, 'User source')
    f.isInputFile.mockReturnValueOnce(true)
    expect(await f.service.captureOutput(path, directory, f.context)).toBeUndefined()
    expect(f.service.listLatest('a')).toEqual([])
    expect(f.isInputFile).toHaveBeenCalledWith(
      'a',
      expect.any(String),
      expect.stringMatching(/^[a-f0-9]{64}$/)
    )
    await writeFile(path, 'Model revision')
    expect(await f.service.captureOutput(path, directory, f.context)).toMatchObject({
      category: 'file'
    })
    await f.service.close()
  })
  it('reads the Temp original without a managed copy and orders changed versions with a frozen clock', async () => {
    const f = await setup()
    const directory = join(f.root, 'tmp')
    await mkdir(directory)
    const path = join(directory, 'final.txt')
    vi.spyOn(Date, 'now').mockReturnValue(100)
    await writeFile(path, 'Final')
    const first = (await f.service.captureOutput(path, directory, f.context))!
    expect(await f.service.revealPath('a', first.publicationId)).toBe(await realpath(path))
    expect(await readdir(f.rootDir).catch(() => [])).toEqual([])
    await writeFile(path, 'Changed externally')
    expect((await f.service.readForExport('a', first.publicationId)).bytes.toString()).toBe(
      'Changed externally'
    )
    const second = (await f.service.captureOutput(path, directory, f.context))!
    expect(second.publicationId).not.toBe(first.publicationId)
    expect(second.publishedAt).toBeGreaterThan(first.publishedAt)
    await writeFile(path, 'Final revision')
    const third = (await f.service.captureOutput(path, directory, f.context))!
    expect(third.publicationId).not.toBe(second.publicationId)
    expect(third.publishedAt).toBeGreaterThan(second.publishedAt)
    expect(f.service.listLatest('a')[0].publicationId).toBe(third.publicationId)
    expect((await f.service.readForExport('a', third.publicationId)).bytes.toString()).toBe(
      'Final revision'
    )
    await rm(path)
    expect((await f.service.status('a', [third.publicationId]))[0].availability.state).toBe(
      'missing'
    )
    expect(await f.service.preview('a', third.publicationId)).toMatchObject({
      state: 'unavailable'
    })
    await f.service.close()
  })
  it('does not collect bytes overwritten after the triggering Write', async () => {
    const f = await setup()
    const directory = join(f.root, 'tmp')
    await mkdir(directory)
    const path = join(directory, 'same-name.md')
    await writeFile(path, 'Another task')
    await expect(
      f.service.captureOutput(path, directory, f.context, 'Expected task')
    ).rejects.toThrow('file-changed')
    expect(f.service.listLatest('a')).toEqual([])
    await f.service.close()
  })
  it('collects ordinary final files separately from artifacts and preserves Office bytes above the preview limit', async () => {
    const f = await setup()
    const directory = join(f.root, 'tmp')
    await mkdir(directory)
    const md = join(directory, 'summary.md')
    await writeFile(md, '# Completed')
    const file = await f.service.captureOutput(md, directory, f.context)
    expect(file).toMatchObject({ category: 'file', kind: 'markdown', filename: 'summary.md' })
    const again = await f.service.captureOutput(md, directory, f.context)
    expect(again?.publicationId).toBe(file?.publicationId)
    expect(await f.service.preview('a', file!.publicationId)).toMatchObject({
      state: 'ready',
      content: '# Completed'
    })
    await writeFile(md, '# Revised')
    const revised = await f.service.captureOutput(md, directory, f.context)
    expect(revised?.publicationId).not.toBe(file?.publicationId)
    expect(f.service.listLatest('a')).toHaveLength(1)
    const artifact = await f.service.publish({ path: md }, { ...f.context, extraDirs: [directory] })
    expect(f.service.getRef('a', artifact.publicationId).category).toBe('artifact')
    expect(f.service.listLatest('a')).toHaveLength(2)
    expect(f.q.artifacts.listCatalog().map((item) => item.publicationId)).toEqual([
      artifact.publicationId
    ])
    const ppt = join(directory, 'slides.pptx')
    const bytes = Buffer.alloc(6 * 1024 * 1024, 0x50)
    await writeFile(ppt, bytes)
    const slides = await f.service.captureOutput(ppt, directory, f.context)
    expect(slides).toMatchObject({ category: 'file', kind: 'file', filename: 'slides.pptx' })
    expect((await f.service.readForExport('a', slides!.publicationId)).bytes.equals(bytes)).toBe(
      true
    )
    expect(await f.service.preview('a', slides!.publicationId)).toMatchObject({
      state: 'unavailable'
    })
    await rm(ppt)
    await expect(f.service.readForExport('a', slides!.publicationId)).rejects.toThrow()
    await f.service.close()
  })
  it('ignores intermediate and unrelated paths, rejects redirected output files, and respects cancellation', async () => {
    const f = await setup()
    const directory = join(f.root, 'tmp')
    await mkdir(join(directory, 'work'), { recursive: true })
    const intermediate = join(directory, 'work', 'draft.md')
    await writeFile(intermediate, 'draft')
    expect(await f.service.captureOutput(intermediate, directory, f.context)).toBeUndefined()
    expect(
      await f.service.captureOutput(join(f.cwd, 'report.md'), directory, f.context)
    ).toBeUndefined()
    const redirected = join(directory, 'redirect.md')
    try {
      await symlink(join(f.cwd, 'report.md'), redirected, 'file')
      await expect(f.service.captureOutput(redirected, directory, f.context)).rejects.toThrow(
        'unsafe-path'
      )
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EPERM'))
        throw error
    }
    f.controller.abort()
    await expect(
      f.service.captureOutput(join(directory, 'cancelled.md'), directory, f.context)
    ).rejects.toThrow('cancelled')
    expect(f.service.listLatest('a')).toEqual([])
    await f.service.close()
  })
  it('removes an already missing artifact from the catalog without deleting its original source', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    await rm(await f.service.revealPath('a', publicationId))
    expect(await f.service.trash('a', publicationId)).toEqual({ outcome: 'already-missing' })
    expect(f.q.artifacts.listCatalog()).toEqual([])
    expect(await readFile(join(f.cwd, 'report.md'), 'utf8')).toBe('# Original')
    await f.service.close()
  })
  it('publishes, previews and downloads code, HTML, Markdown and image bytes through the persisted IDs', async () => {
    const f = await setup()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
      'base64'
    )
    const cases = [
      { filename: 'code.ts', bytes: Buffer.from('const value = "한글"\r\n'), format: 'text' },
      {
        filename: 'page.html',
        bytes: Buffer.from(
          '<html lang="ko"><body class="report" style="margin:24px"><h1>Result</h1><script>alert(1)</script></body></html>'
        ),
        format: 'html'
      },
      { filename: 'report.markdown', bytes: Buffer.from('# Result'), format: 'markdown' },
      { filename: 'picture.png', bytes: png, format: 'image' },
      {
        filename: 'drawing.svg',
        bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        format: 'image'
      }
    ]
    for (const item of cases) {
      await writeFile(join(f.cwd, item.filename), item.bytes)
      const receipt = await f.service.publish({ path: item.filename }, f.context)
      await rm(join(f.cwd, item.filename))
      expect(f.service.getRef('a', receipt.publicationId).kind).toBe(item.format)
      const preview = await f.service.preview('a', receipt.publicationId)
      expect(preview).toMatchObject({ state: 'ready', format: item.format })
      if (preview.state !== 'ready') throw new Error('preview unavailable')
      if (item.format === 'html') {
        expect(preview.previewContent).toContain('class="report" style="margin:24px"')
        expect(preview.previewContent).toContain('Content-Security-Policy')
        expect(preview.previewContent).not.toContain('<script>')
        expect(preview.content).toContain('<script>alert(1)</script>')
      } else expect(preview.previewContent).toBeUndefined()
      expect(
        item.format === 'image'
          ? Buffer.from(preview.content.split(',')[1]!, 'base64')
          : Buffer.from(preview.content)
      ).toEqual(item.bytes)
      expect(await f.service.readForExport('a', receipt.publicationId)).toEqual({
        filename: item.filename,
        bytes: item.bytes
      })
      expect(await f.service.preview('b', receipt.publicationId)).toEqual({
        state: 'unavailable',
        reason: 'forbidden'
      })
    }
    expect(f.q.artifacts.listLatest('a')).toHaveLength(cases.length)
  })
  it('rejects forged image publication and validates changed preview bytes without changing downloads', async () => {
    const f = await setup()
    await writeFile(join(f.cwd, 'fake.png'), '<html>not a PNG</html>')
    await expect(f.service.publish({ path: 'fake.png' }, f.context)).rejects.toThrow(
      'invalid-image'
    )
    expect(f.service.listLatest('a')).toEqual([])
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    const file = f.q.artifacts.getOwnedFile('a', publicationId)!
    const path = join(f.rootDir, file.relativePath)
    await writeFile(path, Buffer.from([0xc3, 0x28]))
    expect(await f.service.preview('a', publicationId)).toEqual({
      state: 'unavailable',
      reason: 'invalid-utf8'
    })
    expect((await f.service.readForExport('a', publicationId)).bytes).toEqual(
      Buffer.from([0xc3, 0x28])
    )
    await writeFile(path, Buffer.alloc(5 * 1024 * 1024 + 1, 65))
    expect(await f.service.preview('a', publicationId)).toEqual({
      state: 'unavailable',
      reason: 'too-large'
    })
    await rm(path)
    expect(await f.service.preview('a', publicationId)).toEqual({
      state: 'unavailable',
      reason: 'missing'
    })
    await writeFile(path, '# Restored')
    expect(await f.service.preview('a', publicationId)).toMatchObject({
      state: 'ready',
      content: '# Restored'
    })
  })
  it('does not read unowned paths and rechecks ownership after the last file inspection', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    const original = ArtifactFiles.prototype.inspect
    const inspect = vi.spyOn(ArtifactFiles.prototype, 'inspect')
    expect(await f.service.preview('b', publicationId)).toEqual({
      state: 'unavailable',
      reason: 'forbidden'
    })
    expect(inspect).not.toHaveBeenCalled()
    inspect.mockRejectedValueOnce(Object.assign(new Error('private-path'), { code: 'EACCES' }))
    expect(await f.service.preview('a', publicationId)).toEqual({
      state: 'unavailable',
      reason: 'access-denied'
    })
    let reads = 0
    inspect.mockImplementation(async function (this: ArtifactFiles, file) {
      const result = await original.call(this, file)
      if (++reads === 2) f.q.deleteSession('a')
      return result
    })
    expect(await f.service.preview('a', publicationId)).toEqual({
      state: 'unavailable',
      reason: 'forbidden'
    })
    expect(reads).toBe(2)
  })
  it('reopens the SQLite file and restores the same reference, bytes and card without its workspace input', async () => {
    const f = await setup(true)
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    const messageId = f.q.appendMessage({
      sessionId: 'a',
      role: 'assistant',
      content: '',
      createdAt: 1
    })
    f.q.appendPart({
      messageId,
      type: 'tool_call',
      toolRunId: 'publisher',
      payloadJson: JSON.stringify({
        toolName: 'mcp__orca_artifacts__publish_artifact',
        args: { path: 'report.md' }
      })
    })
    const reference = f.q.artifacts.linkPublication('a', 'publisher', publicationId)
    expect(reference).not.toBeNull()
    await f.service.close()
    f.db.close()
    databases.splice(databases.indexOf(f.db), 1)
    await rm(join(f.cwd, 'report.md'))

    const reopened = new Database(join(f.root, 'orcinus-orca.db'))
    databases.push(reopened)
    reopened.pragma('foreign_keys = ON')
    applyMigrations(reopened)
    const queries = new DbQueries(reopened)
    const service = new ArtifactService({
      queries: queries.artifacts,
      rootDir: f.rootDir,
      trashItem: f.trashItem
    })
    try {
      expect(service.listLatest('a')).toEqual([reference])
      expect((await service.status('a', [publicationId]))[0]).toMatchObject({
        publicationId,
        artifactFileId: reference!.artifactFileId,
        availability: { state: 'present', sizeBytes: Buffer.byteLength('# Original') }
      })
      expect(await service.readForExport('a', publicationId)).toEqual({
        filename: 'report.md',
        bytes: Buffer.from('# Original')
      })
      expect(
        queries
          .loadParts('a')
          .map(partFromRow)
          .find((part) => part.type === 'artifact')
      ).toEqual({ type: 'artifact', artifact: reference, toolRunId: 'publisher' })
      expect(await readdir(f.cwd)).toEqual([])
    } finally {
      await service.close()
    }
  })
  it('preserves the published file after parent and last fork session deletion and DB reinitialization', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    const file = f.q.artifacts.getOwnedFile('a', publicationId)!
    const savedPath = join(f.rootDir, file.relativePath)
    const messageId = f.q.appendMessage({
      sessionId: 'a',
      role: 'assistant',
      content: '',
      createdAt: 1
    })
    f.q.appendPart({
      messageId,
      type: 'tool_call',
      toolRunId: 'publisher',
      payloadJson: JSON.stringify({
        toolName: 'mcp__orca_artifacts__publish_artifact',
        args: { path: 'report.md' }
      })
    })
    f.q.artifacts.linkPublication('a', 'publisher', publicationId)
    f.q.copyMessagesToSession('a', 'b')
    const child = f.q.artifacts.listLatest('b')[0]
    expect(child.artifactFileId).toBe(file.artifactFileId)
    expect(child.publicationId).not.toBe(publicationId)
    f.q.deleteSession('a')
    expect(f.q.artifacts.getOwnedFile('b', child.publicationId)?.artifactFileId).toBe(
      file.artifactFileId
    )
    expect(await readFile(savedPath, 'utf8')).toBe('# Original')
    f.q.deleteSession('b')
    expect(await readFile(savedPath, 'utf8')).toBe('# Original')
    expect(f.db.prepare('SELECT COUNT(*) AS count FROM session_artifacts').get()).toEqual({
      count: 0
    })
    expect(f.db.prepare('SELECT COUNT(*) AS count FROM artifact_files').get()).toEqual({ count: 1 })
    applyMigrations(f.db)
    const restarted = new DbQueries(f.db)
    expect(restarted.artifacts.listLatest('a')).toEqual([])
    expect(restarted.artifacts.listLatest('b')).toEqual([])
    expect(await readFile(savedPath, 'utf8')).toBe('# Original')
    expect(await readFile(join(f.cwd, 'report.md'), 'utf8')).toBe('# Original')
  })
  it('limits overlapping status requests to four inspections across the service', async () => {
    const f = await setup()
    const ids: string[] = []
    for (let i = 0; i < 6; i++)
      ids.push((await f.service.publish({ path: 'report.md' }, f.context)).publicationId)
    const inspect = ArtifactFiles.prototype.inspect
    let active = 0
    let peak = 0
    const observed = vi
      .spyOn(ArtifactFiles.prototype, 'inspect')
      .mockImplementation(async function (this: ArtifactFiles, file) {
        active++
        peak = Math.max(peak, active)
        try {
          await new Promise<void>((resolve) => setImmediate(resolve))
          return await inspect.call(this, file)
        } finally {
          active--
        }
      })
    await Promise.all([f.service.status('a', ids.slice(0, 4)), f.service.status('a', ids.slice(2))])
    expect(peak).toBe(4)
    expect(observed).toHaveBeenCalledTimes(6)
  })
  it('coalesces the same registered file status and preserves access-denied failures', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    const inspect = vi
      .spyOn(ArtifactFiles.prototype, 'inspect')
      .mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'EACCES' }))
    const result = await f.service.status('a', [publicationId, publicationId])
    expect(inspect).toHaveBeenCalledTimes(1)
    expect(result.map((item) => item.availability)).toEqual([
      { state: 'unavailable', reason: 'access-denied' },
      { state: 'unavailable', reason: 'access-denied' }
    ])
  })
  it('copies input, returns only opaque receipt, and every invocation creates new files', async () => {
    const f = await setup()
    const first = await f.service.publish({ path: 'report.md' }, f.context)
    const second = await f.service.publish({ path: 'report.md' }, f.context)
    expect(first).toEqual({
      type: 'orca.artifact.published',
      version: 1,
      publicationId: expect.any(String)
    })
    expect(second.publicationId).not.toBe(first.publicationId)
    expect(await readFile(join(f.cwd, 'report.md'), 'utf8')).toBe('# Original')
    const saved = f.q.artifacts.getOwnedFile('a', first.publicationId)!
    expect(await readFile(join(f.rootDir, saved.relativePath), 'utf8')).toBe('# Original')
    expect(f.service.listLatest('a')).toHaveLength(1)
    expect(await readdir(f.rootDir)).toHaveLength(2)
  })
  it('supports explicit extra roots and rejects siblings, junction escapes, folders and invalid bytes', async () => {
    const f = await setup()
    const extra = join(f.root, 'extra')
    await mkdir(extra)
    await writeFile(join(extra, 'ok.html'), '<h1>Result</h1>')
    await expect(f.service.publish({ path: join(extra, 'ok.html') }, f.context)).rejects.toThrow(
      'unsafe-path'
    )
    await expect(
      f.service.publish({ path: join(extra, 'ok.html') }, { ...f.context, extraDirs: [extra] })
    ).resolves.toMatchObject({ type: 'orca.artifact.published' })
    await symlink(extra, join(f.cwd, 'escape'), 'junction')
    await expect(f.service.publish({ path: 'escape/ok.html' }, f.context)).rejects.toThrow(
      'unsafe-path'
    )
    await mkdir(join(f.cwd, 'folder.md'))
    await expect(f.service.publish({ path: 'folder.md' }, f.context)).rejects.toThrow('unsafe-path')
    await writeFile(join(f.cwd, 'bad.md'), Buffer.from([0xc3, 0x28]))
    await expect(f.service.publish({ path: 'bad.md' }, f.context)).rejects.toThrow('invalid-utf8')
  })
  it('enforces 5MiB inclusively and never commits oversized input', async () => {
    const f = await setup()
    await writeFile(join(f.cwd, 'large.md'), Buffer.alloc(5 * 1024 * 1024, 65))
    await expect(f.service.publish({ path: 'large.md' }, f.context)).resolves.toBeDefined()
    await writeFile(join(f.cwd, 'large.md'), Buffer.alloc(5 * 1024 * 1024 + 1, 65))
    await expect(f.service.publish({ path: 'large.md' }, f.context)).rejects.toThrow('too-large')
    expect(await readdir(f.rootDir)).toHaveLength(1)
  })
  it('removes only this uncommitted prepared file on DB failure and preserves prior files/input', async () => {
    const f = await setup()
    await f.service.publish({ path: 'report.md' }, f.context)
    f.db.exec(
      "CREATE TRIGGER reject_publication BEFORE INSERT ON session_artifacts BEGIN SELECT RAISE(ABORT, 'injected'); END"
    )
    await expect(f.service.publish({ path: 'report.md' }, f.context)).rejects.toThrow(
      'storage-failed'
    )
    expect(await readdir(f.rootDir)).toHaveLength(1)
    expect(await readFile(join(f.cwd, 'report.md'), 'utf8')).toBe('# Original')
  })
  it('does not remove an externally replaced prepared file during rollback', async () => {
    const f = await setup()
    let replacement = ''
    vi.spyOn(f.q.artifacts, 'createPublication').mockImplementation((input) => {
      replacement = join(f.rootDir, input.relativePath)
      unlinkSync(replacement)
      writeFileSync(replacement, 'External replacement')
      throw new Error('DB failure')
    })
    await expect(f.service.publish({ path: 'report.md' }, f.context)).rejects.toThrow(
      'storage-failed'
    )
    expect(await readFile(replacement, 'utf8')).toBe('External replacement')
  })
  it('rejects cancellation, expired generation and deleted session before committing', async () => {
    const f = await setup()
    f.controller.abort()
    await expect(f.service.publish({ path: 'report.md' }, f.context)).rejects.toThrow('cancelled')
    let checks = 0
    await expect(
      f.service.publish(
        { path: 'report.md' },
        { ...f.context, signal: new AbortController().signal, isCurrent: () => ++checks === 1 }
      )
    ).rejects.toThrow('cancelled')
    f.q.deleteSession('a')
    await expect(
      f.service.publish(
        { path: 'report.md' },
        { ...f.context, signal: new AbortController().signal }
      )
    ).rejects.toThrow('storage-failed')
    expect(f.service.listLatest('a')).toEqual([])
  })
  it('derives missing/restored state from the saved file, keeps history and exports current bytes', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    const file = f.q.artifacts.getOwnedFile('a', publicationId)!
    const path = join(f.rootDir, file.relativePath)
    expect((await f.service.status('a', [publicationId]))[0].availability.state).toBe('present')
    await writeFile(path, 'User changed')
    expect((await f.service.readForExport('a', publicationId)).bytes.toString()).toBe(
      'User changed'
    )
    expect(await f.service.revealPath('a', publicationId)).toBe(await realpath(path))
    await expect(f.service.readForExport('b', publicationId)).rejects.toThrow('forbidden')
    expect(await f.service.trash('a', publicationId)).toEqual({
      outcome: 'trashed',
      deletionRecorded: true
    })
    const gone = (await f.service.status('a', [publicationId]))[0]
    expect(gone.availability).toEqual({ state: 'missing' })
    expect(gone.lastTrashedAt).toEqual(expect.any(Number))
    expect(await f.service.trash('a', publicationId)).toEqual({ outcome: 'already-missing' })
    expect(f.trashItem).toHaveBeenCalledTimes(1)
    await writeFile(path, 'Restored')
    expect((await f.service.status('a', [publicationId]))[0].availability.state).toBe('present')
    expect(f.service.listLatest('a')).toHaveLength(1)
  })
  it('reports trash success separately when DB history fails', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    f.db.exec(
      "CREATE TRIGGER reject_history BEFORE UPDATE ON artifact_files BEGIN SELECT RAISE(ABORT, 'injected'); END"
    )
    expect(await f.service.trash('a', publicationId)).toEqual({
      outcome: 'trashed',
      deletionRecorded: false
    })
    expect((await f.service.status('a', [publicationId]))[0].availability.state).toBe('missing')
    expect(f.trashItem).toHaveBeenCalledTimes(1)
  })
  it('keeps files on trash failure and rejects directory/junction/profile escapes', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    f.trashItem.mockRejectedValueOnce(new Error('failure'))
    expect(await f.service.trash('a', publicationId)).toEqual({
      outcome: 'failed',
      reason: 'trash-failed'
    })
    expect((await f.service.status('a', [publicationId]))[0].availability.state).toBe('present')
    f.db.prepare('UPDATE artifact_files SET relative_path = ?').run('../workspace/report.md')
    expect((await f.service.status('a', [publicationId]))[0].availability).toEqual({
      state: 'unavailable',
      reason: 'unsafe-path'
    })
    expect(await f.service.trash('a', publicationId)).toEqual({
      outcome: 'failed',
      reason: 'unsafe-path'
    })
    expect(f.trashItem).toHaveBeenCalledTimes(1)
  })
  it('bounds requests and serializes concurrent trash for shared file identity', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    await expect(f.service.status('a', Array(101).fill(publicationId))).rejects.toThrow(
      'invalid-input'
    )
    const outcomes = await Promise.all([
      f.service.trash('a', publicationId),
      f.service.trash('a', publicationId)
    ])
    expect(outcomes.map((o) => o.outcome)).toEqual(['trashed', 'already-missing'])
    expect(f.trashItem).toHaveBeenCalledTimes(1)
  })
  it('bounds simultaneous preparation at two and does not join separate publications', async () => {
    const f = await setup()
    const first = f.service.publish({ path: 'report.md' }, f.context)
    const second = f.service.publish({ path: 'report.md' }, f.context)
    await expect(f.service.publish({ path: 'report.md' }, f.context)).rejects.toThrow('busy')
    const receipts = await Promise.all([first, second])
    expect(new Set(receipts.map((r) => r.publicationId)).size).toBe(2)
  })
  it('blocks late DB access after synchronous close and reports already successful trash honestly', async () => {
    const f = await setup()
    const { publicationId } = await f.service.publish({ path: 'report.md' }, f.context)
    let finish!: () => void
    let started!: () => void
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve
    })
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    f.trashItem.mockImplementationOnce(async (path) => {
      started()
      await gate
      await rm(path)
    })
    const lateWrite = vi.spyOn(f.q.artifacts, 'markTrashed')
    const pending = f.service.trash('a', publicationId)
    await startedPromise
    const closed = f.service.close()
    databases.splice(databases.indexOf(f.db), 1)
    f.db.close()
    finish()
    expect(await pending).toEqual({ outcome: 'trashed', deletionRecorded: false })
    await closed
    expect(lateWrite).not.toHaveBeenCalled()
    await expect(f.service.status('a', [publicationId])).rejects.toThrow('closed')
    await expect(f.service.revealPath('a', publicationId)).rejects.toThrow('closed')
    await expect(f.service.readForExport('a', publicationId)).rejects.toThrow('closed')
  })
  it('rejects a development root redirected into production before writing any file', async () => {
    const f = await setup()
    await mkdir(f.rootDir)
    const redirected = join(f.root, 'redirected')
    await symlink(f.rootDir, redirected, 'junction')
    const service = new ArtifactService({
      queries: f.q.artifacts,
      rootDir: join(redirected, '.dev'),
      trashItem: f.trashItem
    })
    await expect(service.publish({ path: 'report.md' }, f.context)).rejects.toThrow('unsafe-path')
    expect(await readdir(f.rootDir)).toEqual([])
  })
  it('close settles in-flight work and rejects new publication without removing committed files', async () => {
    const f = await setup()
    await f.service.publish({ path: 'report.md' }, f.context)
    const pending = f.service.publish({ path: 'report.md' }, f.context)
    const rejected = expect(pending).rejects.toThrow('cancelled')
    await f.service.close()
    await rejected
    await expect(f.service.publish({ path: 'report.md' }, f.context)).rejects.toThrow('closed')
    expect(f.q.artifacts.listLatest('a')).toHaveLength(1)
    expect(await readdir(f.rootDir)).toHaveLength(1)
  })
})

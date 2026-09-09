import * as fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArtifactFiles, readStableFile } from './files'

vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>())
}))

const roots: string[] = []
async function tempRoot(): Promise<string> {
  const root = await fs.mkdtemp(join(tmpdir(), 'orca-artifact-path-'))
  roots.push(root)
  return fs.realpath(root)
}
afterEach(async () => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true })
})

describe('artifact storage root validation', () => {
  it.runIf(process.platform === 'win32')(
    'publishes and cleans up through a physical Windows short path',
    async (context) => {
      const root = await tempRoot()
      // cmd's Unicode output keeps non-ASCII user profile names intact. Only queries cwd.
      const shortRoot = execFileSync(
        'cmd.exe',
        ['/d', '/u', '/c', 'for %I in (.) do @echo %~fsI'],
        { cwd: root, encoding: 'utf16le', windowsHide: true }
      ).trim()
      if (shortRoot.toLowerCase() === root.toLowerCase()) {
        context.skip('This filesystem does not create 8.3 directory names')
      }
      expect(await fs.realpath(shortRoot)).toBe(root)
      const files = new ArtifactFiles(join(shortRoot, 'artifacts'))
      const artifactFileId = '11111111-1111-4111-8111-111111111111'
      const prepared = await files.prepare(
        artifactFileId,
        'report.md',
        Buffer.from('# Report'),
        new AbortController().signal
      )
      const saved = await files.inspect({
        artifactFileId,
        relativePath: prepared.relativePath,
        filename: 'report.md'
      })
      expect(saved.path).toBe(join(root, 'artifacts', artifactFileId, 'report.md'))
      expect(await fs.readFile(saved.path, 'utf8')).toBe('# Report')
      await prepared.cleanup()
      expect(await fs.readdir(join(root, 'artifacts'))).toEqual([])
    }
  )

  it.each(['root', 'ancestor'] as const)(
    'rejects a redirected %s before creating artifact directories',
    async (position) => {
      const root = await tempRoot()
      const target = join(root, 'target')
      await fs.mkdir(join(target, 'existing'), { recursive: true })
      const alias = join(root, 'redirected')
      await fs.symlink(target, alias, 'junction')
      const path = position === 'root' ? alias : join(alias, 'existing', 'artifacts')
      await expect(new ArtifactFiles(path).folder(true)).rejects.toThrow('unsafe-path')
      expect(await fs.readdir(join(target, 'existing'))).toEqual([])
    }
  )

  it('rejects a root replaced by a junction during canonicalization', async () => {
    const root = await tempRoot()
    const storage = join(root, 'artifacts')
    const target = join(root, 'target')
    await fs.mkdir(storage)
    await fs.mkdir(target)
    const realpath = fs.realpath
    vi.spyOn(fs, 'realpath').mockImplementationOnce(async (path) => {
      await fs.rename(storage, join(root, 'original'))
      await fs.symlink(target, storage, 'junction')
      return realpath(path)
    })
    await expect(new ArtifactFiles(storage).folder()).rejects.toThrow('unsafe-path')
    expect(await fs.readdir(target)).toEqual([])
  })

  it('rejects a canonical root outside local paths', async () => {
    const root = await tempRoot()
    vi.spyOn(fs, 'realpath').mockResolvedValue('\\\\server\\share\\artifacts')
    await expect(new ArtifactFiles(root).folder()).rejects.toThrow('unsafe-path')
  })
})

describe('bounded file-handle publication reads', () => {
  it('rejects a real file modified after opening instead of publishing mixed bytes', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'orca-artifact-read-'))
    roots.push(root)
    const path = join(root, 'report.md')
    await fs.writeFile(path, 'Original')
    const open = fs.open
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args)
      const read = handle.read
      vi.spyOn(handle, 'read').mockImplementationOnce((...readArgs) => {
        writeFileSync(path, 'Changed after opening')
        return Reflect.apply(read, handle, readArgs) as ReturnType<typeof read>
      })
      return handle
    })
    await expect(readStableFile(path)).rejects.toThrow('file-changed')
    expect(await fs.readFile(path, 'utf8')).toBe('Changed after opening')
  })

  it('closes its handle when reading fails and reports no partial successful buffer', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'orca-artifact-read-'))
    roots.push(root)
    const path = join(root, 'report.md')
    await fs.writeFile(path, 'Original')
    const open = fs.open
    const closed = vi.fn()
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args)
      const close = handle.close.bind(handle)
      vi.spyOn(handle, 'read').mockRejectedValueOnce(
        Object.assign(new Error('injected'), { code: 'EIO' })
      )
      vi.spyOn(handle, 'close').mockImplementation(async () => {
        await close()
        closed()
      })
      return handle
    })
    await expect(readStableFile(path)).rejects.toThrow('injected')
    expect(closed).toHaveBeenCalledOnce()
  })
})

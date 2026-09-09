import { createHash } from 'node:crypto'
import { lstat, mkdir, open, realpath, rename, rmdir, stat, unlink } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type { ArtifactFileRecord } from '../../infra/db/artifact-queries'
import { validateArtifactBytes } from './formats'
import {
  assertArtifactFilename,
  assertLocalPath,
  containsPath,
  MAX_ARTIFACT_BYTES
} from './validation'

function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
}

async function unredirectedDirectory(path: string): Promise<string> {
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('unsafe-path')
  const actual = await realpath(path)
  assertLocalPath(actual)
  const resolved = resolve(path)
  if (samePath(actual, resolved)) return actual

  // Windows 8.3 names resolve to a different spelling without redirecting the directory.
  // Check ancestors only on a spelling mismatch; a junction must still be rejected.
  let ancestor = dirname(resolved)
  while (true) {
    const parentInfo = await lstat(ancestor)
    if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) throw new Error('unsafe-path')
    const parent = dirname(ancestor)
    if (parent === ancestor) break
    ancestor = parent
  }
  const current = await lstat(path)
  if (
    !current.isDirectory() ||
    current.isSymbolicLink() ||
    current.dev !== info.dev ||
    current.ino !== info.ino
  )
    throw new Error('unsafe-path')
  if (!samePath(await realpath(path), actual)) throw new Error('unsafe-path')
  return actual
}

function sameFile(a: Stats, b: Stats): boolean {
  return (
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.size === b.size &&
    a.mtimeMs === b.mtimeMs &&
    a.ctimeMs === b.ctimeMs
  )
}
function cancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('cancelled')
}

// Bounded handle reads detect ordinary replacement/change races. This is not an OS sandbox.
export async function readStableFile(path: string, signal?: AbortSignal): Promise<Buffer> {
  cancelled(signal)
  const actual = await realpath(path)
  const handle = await open(actual, 'r')
  try {
    const before = await handle.stat()
    if (!before.isFile()) throw new Error('unsafe-path')
    if (before.size > MAX_ARTIFACT_BYTES) throw new Error('too-large')
    const bytes = Buffer.allocUnsafe(Math.min(MAX_ARTIFACT_BYTES + 1, before.size + 1))
    let length = 0
    while (length < bytes.length) {
      cancelled(signal)
      const result = await handle.read(
        bytes,
        length,
        Math.min(64 * 1024, bytes.length - length),
        length
      )
      if (!result.bytesRead) break
      length += result.bytesRead
    }
    if (length > MAX_ARTIFACT_BYTES) throw new Error('too-large')
    const after = await handle.stat()
    if (after.size > MAX_ARTIFACT_BYTES) throw new Error('too-large')
    const finalPath = await realpath(path)
    const finalStat = await stat(finalPath)
    cancelled(signal)
    if (
      !samePath(actual, finalPath) ||
      !sameFile(before, after) ||
      !sameFile(after, finalStat) ||
      length !== after.size
    )
      throw new Error('file-changed')
    return bytes.subarray(0, length)
  } finally {
    await handle.close()
  }
}

export async function readArtifactInput(
  path: string,
  cwd: string,
  extraDirs: readonly string[],
  signal: AbortSignal
): Promise<{ bytes: Buffer; inputSource: string; hash: string }> {
  assertLocalPath(cwd)
  if (!isAbsolute(cwd)) throw new Error('unsafe-path')
  const candidate = resolve(cwd, path)
  assertLocalPath(candidate)
  const roots = await Promise.all(
    [cwd, ...extraDirs].map(async (root) => {
      assertLocalPath(root)
      if (!isAbsolute(root)) throw new Error('unsafe-path')
      const actual = await realpath(root)
      if (!(await stat(actual)).isDirectory()) throw new Error('unsafe-path')
      return actual
    })
  )
  const inputSource = await realpath(candidate)
  assertLocalPath(inputSource)
  if (!roots.some((root) => containsPath(inputSource, root))) throw new Error('unsafe-path')
  const bytes = await readStableFile(inputSource, signal)
  if (!samePath(await realpath(candidate), inputSource)) throw new Error('file-changed')
  const finalRoots = await Promise.all([cwd, ...extraDirs].map((root) => realpath(root)))
  if (!finalRoots.every((root, index) => samePath(root, roots[index])))
    throw new Error('file-changed')
  validateArtifactBytes(candidate, bytes)
  return {
    bytes,
    inputSource: process.platform === 'win32' ? inputSource.toLowerCase() : inputSource,
    hash: createHash('sha256').update(bytes).digest('hex')
  }
}

export interface PreparedArtifactFile {
  relativePath: string
  cleanup(): Promise<void>
}

export class ArtifactFiles {
  constructor(private readonly rootDir: string) {}

  async folder(create = false): Promise<string> {
    assertLocalPath(this.rootDir)
    if (!isAbsolute(this.rootDir)) throw new Error('unsafe-path')
    if (create) {
      // Validate the nearest existing ancestor before recursive mkdir can follow a junction.
      let ancestor = this.rootDir
      while (true) {
        try {
          await unredirectedDirectory(ancestor)
          break
        } catch (error) {
          if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
            throw error
          const parent = dirname(ancestor)
          if (parent === ancestor) throw new Error('unsafe-path')
          ancestor = parent
        }
      }
      await mkdir(this.rootDir, { recursive: true })
    }
    return unredirectedDirectory(this.rootDir)
  }

  private async parent(fileId: string): Promise<string> {
    if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/iu.test(fileId)) throw new Error('unsafe-path')
    const root = await this.folder()
    const path = join(root, fileId)
    const info = await lstat(path)
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(await realpath(path), path))
      throw new Error('unsafe-path')
    return path
  }

  async inspect(
    file: Pick<ArtifactFileRecord, 'artifactFileId' | 'relativePath' | 'filename'>
  ): Promise<{ path: string; info: Stats }> {
    // The profile-relative path has exactly one UUID directory and one safe basename.
    assertArtifactFilename(file.filename)
    if (file.relativePath.replaceAll('\\', '/') !== `${file.artifactFileId}/${file.filename}`)
      throw new Error('unsafe-path')
    const path = join(await this.parent(file.artifactFileId), file.filename)
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || !samePath(await realpath(path), path))
      throw new Error('unsafe-path')
    return { path, info }
  }

  async prepare(
    fileId: string,
    filename: string,
    bytes: Buffer,
    signal: AbortSignal
  ): Promise<PreparedArtifactFile> {
    assertArtifactFilename(filename)
    if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/iu.test(fileId)) throw new Error('unsafe-path')
    const root = await this.folder(true)
    const directory = join(root, fileId)
    await mkdir(directory)
    const owner = await lstat(directory)
    const pending = join(directory, '.pending')
    const final = join(directory, filename)
    let ownedFile: Stats | undefined
    const cleanup = async (): Promise<void> => {
      // Never recursively remove a directory or follow a replaced parent during rollback.
      const current = await lstat(await this.parent(fileId))
      if (owner.dev !== current.dev || owner.ino !== current.ino) throw new Error('unsafe-path')
      for (const path of [pending, final]) {
        try {
          const currentFile = await lstat(path)
          if (!ownedFile || !sameFile(currentFile, ownedFile)) throw new Error('unsafe-path')
          await unlink(path)
        } catch (error) {
          if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
            throw error
        }
      }
      await rmdir(directory)
    }
    try {
      cancelled(signal)
      await this.parent(fileId)
      const handle = await open(pending, 'wx')
      try {
        await handle.writeFile(bytes, { signal })
        await handle.sync()
      } finally {
        try {
          ownedFile = await handle.stat()
        } finally {
          await handle.close()
        }
      }
      cancelled(signal)
      await this.parent(fileId)
      await rename(pending, final)
      const saved = await this.inspect({
        artifactFileId: fileId,
        relativePath: `${fileId}/${filename}`,
        filename
      })
      ownedFile = saved.info
      if (saved.info.size !== bytes.length || dirname(saved.path) !== directory)
        throw new Error('file-changed')
      return { relativePath: `${fileId}/${filename}`, cleanup }
    } catch (error) {
      await cleanup().catch(() => undefined)
      throw error
    }
  }
}

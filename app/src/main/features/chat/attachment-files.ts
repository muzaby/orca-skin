import { createHash, randomUUID } from 'node:crypto'
import { promises as fs, type Stats } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { getTemporaryFilesPath } from '../../infra/config/temp-path'

export const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024
export const nativeAttachmentDirectory = getTemporaryFilesPath

const samePath = (a: string, b: string): boolean =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b
const sameFile = (a: Stats, b: Stats): boolean =>
  a.dev === b.dev &&
  a.ino === b.ino &&
  a.size === b.size &&
  a.mtimeMs === b.mtimeMs &&
  a.ctimeMs === b.ctimeMs

async function plainDirectory(directory: string): Promise<string> {
  let current = resolve(directory)
  for (;;) {
    const info = await fs.lstat(current)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('unsafe attachment directory')
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return fs.realpath(directory)
}

async function prepareDirectory(directory: string): Promise<string> {
  let ancestor = resolve(directory)
  for (;;) {
    try {
      await plainDirectory(ancestor)
      break
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
        throw error
      const parent = dirname(ancestor)
      if (parent === ancestor) throw error
      ancestor = parent
    }
  }
  await fs.mkdir(directory, { recursive: true })
  return plainDirectory(directory)
}

export async function readAttachmentBytes(
  path: string,
  validatePath: (path: string) => unknown
): Promise<Buffer> {
  const actual = await fs.realpath(path)
  validatePath(actual)
  const file = await fs.open(actual, 'r')
  try {
    const before = await file.stat()
    if (!before.isFile()) throw new Error('attachment must be a file')
    if (before.size > MAX_ATTACHMENT_BYTES) throw new Error('attachment exceeds 32 MiB')
    const bytes = Buffer.allocUnsafe(before.size + 1)
    let size = 0
    while (size < bytes.length) {
      const result = await file.read(bytes, size, Math.min(64 * 1024, bytes.length - size), size)
      if (!result.bytesRead) break
      size += result.bytesRead
    }
    const after = await file.stat()
    const finalPath = await fs.realpath(path)
    validatePath(finalPath)
    if (
      !samePath(actual, finalPath) ||
      !sameFile(before, after) ||
      !sameFile(after, await fs.stat(finalPath)) ||
      size !== after.size
    )
      throw new Error('attachment changed while reading')
    return bytes.subarray(0, size)
  } finally {
    await file.close()
  }
}

export async function storeAttachmentBytes(
  bytes: Buffer,
  name: string,
  directory: string
): Promise<{
  path: string
  sha256: string
  cleanup(): Promise<void>
}> {
  if (bytes.length > MAX_ATTACHMENT_BYTES) throw new Error('attachment exceeds 32 MiB')
  const root = await prepareDirectory(directory)
  const safeName =
    Array.from(basename(name.replaceAll('\\', '/')), (char) =>
      char.charCodeAt(0) < 32 ? '-' : char
    )
      .join('')
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/[. ]+$/g, '')
      .slice(-140) || 'attachment'
  const path = join(root, `${randomUUID()}-${safeName}`)
  let owned: Stats | undefined
  const cleanup = async (): Promise<void> => {
    if (!samePath(await plainDirectory(directory), root))
      throw new Error('unsafe attachment directory')
    const current = await fs.lstat(path).catch(() => null)
    if (!current) return
    if (!owned || !sameFile(current, owned) || current.isSymbolicLink())
      throw new Error('attachment changed while storing')
    await fs.unlink(path)
  }
  try {
    const handle = await fs.open(path, 'wx', 0o600)
    try {
      await handle.writeFile(bytes)
      await handle.sync()
    } finally {
      try {
        owned = await handle.stat()
      } finally {
        await handle.close()
      }
    }
    if (
      !samePath(await plainDirectory(directory), root) ||
      !samePath(await fs.realpath(path), path)
    )
      throw new Error('unsafe attachment directory')
    return { path, sha256: createHash('sha256').update(bytes).digest('hex'), cleanup }
  } catch (error) {
    await cleanup().catch(() => undefined)
    throw error
  }
}

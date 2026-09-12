import { createHash, randomUUID } from 'node:crypto'
import type { Stats } from 'node:fs'
import { lstat, mkdir, open, realpath, rename, unlink, type FileHandle } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import type {
  BackgroundOutputCursor,
  BackgroundOutputRef,
  BackgroundOutputSnapshot,
  ReadBackgroundOutputResponse
} from '../../shared/background-task'

type ReadOptions = { offset: number; maxBytes: number; cursor?: BackgroundOutputCursor }
const SNAPSHOT_LIMIT = 16 * 1024 * 1024
function within(root: string, path: string): boolean {
  const rel = relative(resolve(root), resolve(path))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}
function errorStatus(error: unknown): 'missing' | 'denied' {
  return (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'denied'
}
function cursorOf(stat: Stats): BackgroundOutputCursor {
  return {
    identity: `${stat.dev}:${stat.ino}:${stat.birthtimeMs}`,
    size: stat.size,
    mtimeMs: stat.mtimeMs
  }
}

/** Main-owned file references only. No URLs, directory listing, or renderer-supplied paths. */
export class BackgroundOutputStore {
  constructor(private readonly directory: string) {}

  private async checkedOpen(
    ref: BackgroundOutputRef,
    roots: readonly string[]
  ): Promise<FileHandle> {
    if (ref.canRead === false || ref.kind !== 'file' || !isAbsolute(ref.value))
      throw new Error('output denied')
    const lexical = resolve(ref.value)
    const candidates = roots.filter((root) => within(root, lexical))
    if (!candidates.length) throw new Error('output outside allowed roots')
    const target = await realpath(lexical)
    const canonicalRoots = await Promise.all(candidates.map((root) => realpath(root)))
    if (!canonicalRoots.some((root) => within(root, target)))
      throw new Error('output resolved outside allowed roots')
    const before = await lstat(target)
    if (!before.isFile() || before.isSymbolicLink()) throw new Error('output is not a regular file')
    const file = await open(target, 'r')
    const after = await file.stat()
    if (
      !after.isFile() ||
      before.ino !== after.ino ||
      before.dev !== after.dev ||
      (await realpath(lexical)) !== target
    ) {
      await file.close()
      throw new Error('output changed during open')
    }
    return file
  }

  private async readHandle(
    file: FileHandle,
    opts: ReadOptions,
    view: 'current' | 'snapshot'
  ): Promise<ReadBackgroundOutputResponse> {
    const stat = await file.stat()
    const cursor = cursorOf(stat)
    const base = { offset: opts.offset, nextOffset: opts.offset, size: stat.size, cursor, view }
    if (opts.cursor && opts.cursor.identity !== cursor.identity)
      return { ...base, status: 'changed' }
    if ((opts.cursor && stat.size < opts.cursor.size) || opts.offset > stat.size)
      return { ...base, status: 'truncated' }
    if (opts.cursor && stat.size === opts.cursor.size && stat.mtimeMs !== opts.cursor.mtimeMs)
      return { ...base, status: 'changed' }
    const bytes = Buffer.alloc(Math.min(65_536, Math.max(1, opts.maxBytes)))
    const { bytesRead } = await file.read(bytes, 0, bytes.length, opts.offset)
    const after = await file.stat()
    if (after.size < stat.size) return { ...base, status: 'truncated' }
    if (after.size === stat.size && after.mtimeMs !== stat.mtimeMs)
      return { ...base, status: 'changed' }
    let completeBytes = bytesRead
    if (bytesRead) {
      let start = bytesRead - 1
      while (start > 0 && (bytes[start] & 0xc0) === 0x80) start--
      const lead = bytes[start]
      const expected =
        (lead & 0xf8) === 0xf0 ? 4 : (lead & 0xf0) === 0xe0 ? 3 : (lead & 0xe0) === 0xc0 ? 2 : 1
      if (bytesRead - start < expected) completeBytes = start
    }
    const nextOffset = opts.offset + completeBytes
    return {
      ...base,
      status: nextOffset < after.size ? 'partial' : 'available',
      text: bytes.subarray(0, completeBytes).toString('utf8'),
      nextOffset,
      eof: nextOffset >= after.size,
      ...(bytesRead > 0 && completeBytes === 0 && opts.maxBytes < 4
        ? { error: '문자 경계를 읽으려면 maxBytes를 4 이상으로 늘려 주세요.' }
        : {})
    }
  }

  async read(
    ref: BackgroundOutputRef,
    roots: readonly string[],
    opts: ReadOptions
  ): Promise<ReadBackgroundOutputResponse> {
    const base = { offset: opts.offset, nextOffset: opts.offset, view: 'current' as const }
    if (ref.canRead === false) return { ...base, status: 'denied' }
    if (ref.kind === 'uri') return { ...base, status: 'remote' }
    let file: FileHandle | undefined
    try {
      file = await this.checkedOpen(ref, roots)
      return await this.readHandle(file, opts, 'current')
    } catch (error) {
      return { ...base, status: errorStatus(error) }
    } finally {
      await file?.close()
    }
  }

  async capture(
    ref: BackgroundOutputRef,
    roots: readonly string[]
  ): Promise<BackgroundOutputSnapshot> {
    const input = await this.checkedOpen(ref, roots)
    const id = randomUUID()
    const path = join(this.directory, id)
    const pending = `${path}.pending`
    let output: FileHandle | undefined
    try {
      await mkdir(this.directory, { recursive: true })
      output = await open(pending, 'wx', 0o600)
      const initial = await input.stat()
      const hash = createHash('sha256')
      let size = 0
      const bytes = Buffer.alloc(65_536)
      while (size < Math.min(initial.size, SNAPSHOT_LIMIT)) {
        const { bytesRead } = await input.read(
          bytes,
          0,
          Math.min(bytes.length, SNAPSHOT_LIMIT - size, initial.size - size),
          size
        )
        if (bytesRead === 0) break
        const chunk = bytes.subarray(0, bytesRead)
        hash.update(chunk)
        await output.writeFile(chunk)
        size += bytesRead
      }
      const final = await input.stat()
      await output.sync()
      await output.close()
      output = undefined
      await rename(pending, path)
      return {
        id,
        capturedAt: Date.now(),
        size,
        sha256: hash.digest('hex'),
        partial:
          size < initial.size || final.size !== initial.size || final.mtimeMs !== initial.mtimeMs
      }
    } catch (error) {
      await output?.close()
      await unlink(pending).catch(() => {})
      throw error
    } finally {
      await input.close()
    }
  }

  async readSnapshot(
    snapshot: BackgroundOutputSnapshot,
    opts: ReadOptions
  ): Promise<ReadBackgroundOutputResponse> {
    if (!/^[0-9a-f-]{36}$/.test(snapshot.id))
      return { status: 'denied', offset: opts.offset, nextOffset: opts.offset, view: 'snapshot' }
    const result = await this.read(
      {
        id: snapshot.id,
        field: 'snapshot',
        value: join(this.directory, snapshot.id),
        kind: 'file'
      },
      [this.directory],
      opts
    )
    return {
      ...result,
      view: 'snapshot',
      ...(snapshot.partial && result.status === 'available' ? { status: 'partial' as const } : {})
    }
  }

  async removeSnapshot(id: string): Promise<void> {
    if (/^[0-9a-f-]{36}$/.test(id)) await unlink(join(this.directory, id)).catch(() => {})
  }
}

import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'

const code = (error: unknown): string | undefined => (error as NodeJS.ErrnoException)?.code
const delay = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))
export interface FileMutationOptions {
  root?: string
}

/** Ordered file identity admission; separate files perform I/O independently. */
export class FileMutationCoordinator {
  private admission: Promise<void> = Promise.resolve()
  private readonly queues = new Map<string, Promise<void>>()
  private readonly pending = new Set<Promise<void>>()
  private closed = false
  constructor(
    private readonly io: {
      rename?: typeof rename
      beforeCommit?: (file: string, attempt: number) => Promise<void>
      retryMs?: number
    } = {}
  ) {}

  mutate(
    file: string,
    patch: (latest: string | undefined) => string,
    options: FileMutationOptions = {}
  ): Promise<void> {
    if (this.closed) return Promise.reject(new Error('설정 저장이 종료 중입니다.'))
    const registration = this.admission.then(async () => {
      const target = await this.identity(file, options)
      const key = process.platform === 'win32' ? target.toLowerCase() : target
      const previous = this.queues.get(key) ?? Promise.resolve()
      const task = previous.catch(() => undefined).then(() => this.commit(target, patch, options))
      this.queues.set(key, task)
      const release = (): void => {
        if (this.queues.get(key) === task) this.queues.delete(key)
      }
      void task.then(release, release)
      return { task }
    })
    this.admission = registration.then(
      () => undefined,
      () => undefined
    )
    const result = registration.then(({ task }) => task)
    this.pending.add(result)
    const settled = (): void => {
      this.pending.delete(result)
    }
    void result.then(settled, settled)
    return result
  }

  async close(): Promise<void> {
    this.closed = true
    await Promise.allSettled([...this.pending])
  }

  private async identity(file: string, options: FileMutationOptions): Promise<string> {
    const target = resolve(file)
    let parent = dirname(target)
    const missing: string[] = []
    for (;;) {
      let actual: string
      try {
        actual = await realpath(parent)
      } catch (error) {
        if (code(error) !== 'ENOENT' || parent === dirname(parent)) throw error
        missing.push(basename(parent))
        parent = dirname(parent)
        continue
      }
      const result = resolve(actual, ...missing.reverse(), basename(target))
      if (options.root) {
        const root = await realpath(options.root)
        const child = relative(root, dirname(result))
        if (child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child))
          throw new Error('설정 파일이 작업 경로 밖에 있습니다.')
      }
      const info = await lstat(result).catch((error: unknown) => {
        if (code(error) === 'ENOENT') return undefined
        throw error
      })
      if (info && (!info.isFile() || info.isSymbolicLink()))
        throw new Error('설정 파일 경로를 확인해 주세요.')
      return result
    }
  }

  private async read(file: string): Promise<string | undefined> {
    try {
      return await readFile(file, 'utf8')
    } catch (error) {
      if (code(error) === 'ENOENT') return undefined
      throw error
    }
  }

  private async commit(
    file: string,
    patch: (latest: string | undefined) => string,
    options: FileMutationOptions
  ): Promise<void> {
    const started = Date.now()
    let attempt = 0
    for (;;) {
      let temporary: string | undefined
      try {
        if ((await this.identity(file, options)) !== file)
          throw new Error('설정 파일 경로가 변경되었습니다.')
        const before = await this.read(file)
        const after = patch(before)
        if (after === before) return
        const mode = await lstat(file)
          .then((info) => info.mode & 0o777)
          .catch((error: unknown) => {
            if (code(error) === 'ENOENT') return 0o600
            throw error
          })
        await mkdir(dirname(file), { recursive: true, mode: 0o700 })
        temporary = resolve(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`)
        const handle = await open(temporary, 'wx', mode)
        try {
          await handle.writeFile(after, 'utf8')
          await handle.sync()
        } finally {
          await handle.close()
        }
        await this.io.beforeCommit?.(file, attempt)
        if ((await this.identity(file, options)) !== file)
          throw new Error('설정 파일 경로가 변경되었습니다.')
        if ((await this.read(file)) !== before) {
          if (Date.now() - started >= (this.io.retryMs ?? 5000))
            throw new Error('외부 설정 변경이 계속되고 있습니다. 다시 시도해 주세요.')
          attempt++
          await delay(Math.min(50 * 2 ** Math.min(attempt, 4), 800))
          continue
        }
        await (this.io.rename ?? rename)(temporary, file)
        temporary = undefined
        return
      } catch (error) {
        if (
          !['EBUSY', 'EPERM', 'EACCES'].includes(code(error) ?? '') ||
          Date.now() - started >= (this.io.retryMs ?? 5000)
        )
          throw error
        await delay(Math.min(50 * 2 ** Math.min(attempt++, 4), 800))
      } finally {
        if (temporary) await unlink(temporary).catch(() => undefined)
      }
    }
  }
}

export const nativeFileMutations = new FileMutationCoordinator()

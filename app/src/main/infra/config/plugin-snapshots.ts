import { cp, mkdir, mkdtemp, rm, stat, chmod } from 'node:fs/promises'
import { join, relative, resolve, isAbsolute, sep } from 'node:path'

interface Generation {
  directory: string
  roots: Map<string, string | undefined>
  references: number
}
const key = (path: string): string =>
  process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path)

/** Immutable deployment publications. A directory lease pins its original publication. */
export class PluginSnapshots {
  private current?: Generation
  private readonly retired = new Set<Generation>()
  private readonly cleanup = new Set<Promise<void>>()
  private closed = false
  constructor(private readonly baseDirectory: string) {}

  async publish(roots: readonly string[]): Promise<void> {
    if (this.closed) throw new Error('플러그인 배포가 종료 중입니다.')
    await mkdir(this.baseDirectory, { recursive: true, mode: 0o700 })
    const directory = await mkdtemp(join(this.baseDirectory, 'generation-'))
    const next: Generation = { directory, roots: new Map(), references: 0 }
    try {
      for (const [index, root] of roots.entries()) {
        next.roots.set(key(root), undefined)
        const sourceInfo = await stat(root).catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
          throw error
        })
        if (sourceInfo && !sourceInfo.isDirectory()) throw new Error('잘못된 플러그인 배포입니다.')
        const manifest = await stat(join(root, '.claude-plugin', 'plugin.json')).catch(
          (error: unknown) => {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
            throw error
          }
        )
        if (!manifest) continue
        const destination = join(directory, String(index))
        await cp(root, destination, { recursive: true, dereference: false, verbatimSymlinks: true })
        await chmod(destination, 0o700)
        await chmod(join(destination, '.mcp.json'), 0o600).catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        })
        next.roots.set(key(root), destination)
      }
      if (this.closed) throw new Error('플러그인 배포가 종료 중입니다.')
      const previous = this.current
      this.current = next
      if (previous) {
        this.retired.add(previous)
        this.collect(previous)
      }
    } catch {
      await this.remove(directory).catch(() => {
        this.retired.add(next)
      })
      throw new Error('플러그인 실행 사본을 준비할 수 없습니다.')
    }
  }

  capture(roots: readonly string[]): { roots: string[]; release(): void } {
    if (this.closed || !this.current) throw new Error('플러그인 배포가 준비되지 않았습니다.')
    const generation = this.current
    generation.references++
    let released = false
    return {
      roots: roots.flatMap((root) => {
        if (!generation.roots.has(key(root))) return [root]
        const snapshot = generation.roots.get(key(root))
        return snapshot ? [snapshot] : []
      }),
      release: () => {
        if (released) return
        released = true
        generation.references--
        this.collect(generation)
      }
    }
  }

  private collect(generation: Generation): void {
    if (generation.references || !this.retired.delete(generation)) return
    const task = this.remove(generation.directory)
    this.cleanup.add(task)
    // A failed cleanup is retried at close, without exposing configuration paths or contents.
    void task.then(
      () => this.cleanup.delete(task),
      () => {
        this.cleanup.delete(task)
        this.retired.add(generation)
      }
    )
  }
  private async remove(directory: string): Promise<void> {
    const child = relative(resolve(this.baseDirectory), resolve(directory))
    if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child))
      throw new Error('잘못된 플러그인 사본 경로입니다.')
    await rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 })
  }
  async close(): Promise<void> {
    this.closed = true
    if (this.current) {
      this.retired.add(this.current)
      this.current = undefined
    }
    await Promise.allSettled([...this.cleanup])
    // Runtime owners must be shut down before this drain.
    await Promise.all([...this.retired].map((generation) => this.remove(generation.directory)))
    this.retired.clear()
  }
}

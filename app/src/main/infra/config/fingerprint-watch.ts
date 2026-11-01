import { unwatchFile, watchFile } from 'node:fs'
import { lstat, stat } from 'node:fs/promises'

type Watch = (file: string, changed: () => void, interval: number) => () => void
const watch: Watch = (file, changed, interval) => {
  watchFile(file, { interval, persistent: false }, changed)
  return () => unwatchFile(file, changed)
}

/** Stat identity catches replacement, missing files and symlink retargets without reading content. */
export async function fileFingerprints(files: readonly string[]): Promise<string> {
  return JSON.stringify(
    await Promise.all(
      files.map(async (file) =>
        Promise.all(
          [lstat, stat].map(async (read) => {
            try {
              const value = await read(file)
              return [value.dev, value.ino, value.size, value.mtimeMs, value.ctimeMs, value.mode]
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
              throw error
            }
          })
        )
      )
    )
  )
}

/** Serializes fingerprint reads and suppresses unchanged or closed notifications. */
export class FingerprintWatch {
  readonly ready: Promise<void>
  private tail: Promise<unknown>
  private fingerprint?: string
  private revision = 0
  private closed = false
  private scheduled?: ReturnType<typeof setTimeout>
  private readonly stops: Array<() => void>
  constructor(
    private readonly deps: {
      files: string[]
      interval?: number
      watch?: Watch
      fingerprint?(): Promise<string>
      initialFingerprint?: string
      dirty?(): void
      changed(revision: number): void
      failed(error: unknown): void
    }
  ) {
    this.fingerprint = deps.initialFingerprint
    this.ready = this.tail = (
      deps.initialFingerprint === undefined ? this.read() : Promise.resolve(deps.initialFingerprint)
    )
      .then((value) => {
        this.fingerprint = value
      })
      .catch(deps.failed)
    const schedule = (): void => {
      if (this.closed) return
      if (this.scheduled) clearTimeout(this.scheduled)
      this.scheduled = setTimeout(() => void this.check(), 100)
      this.scheduled.unref?.()
    }
    this.stops = deps.files.map((file) =>
      (deps.watch ?? watch)(file, schedule, deps.interval ?? 1000)
    )
    // A consumer-supplied baseline predates observation; reconcile that gap once.
    if (deps.initialFingerprint !== undefined) schedule()
  }
  private read(): Promise<string> {
    return this.deps.fingerprint?.() ?? fileFingerprints(this.deps.files)
  }
  check(): Promise<void> {
    if (this.scheduled) clearTimeout(this.scheduled)
    this.scheduled = undefined
    if (this.closed) return Promise.resolve()
    this.deps.dirty?.()
    const task = this.tail
      .catch(() => undefined)
      .then(async () => {
        if (this.closed) return
        const next = await this.read()
        if (this.closed || next === this.fingerprint) return
        this.fingerprint = next
        this.deps.changed(++this.revision)
      })
      .catch((error) => {
        if (!this.closed) this.deps.failed(error)
      })
    this.tail = task
    return task
  }
  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.scheduled) clearTimeout(this.scheduled)
    for (const stop of this.stops) stop()
  }
}

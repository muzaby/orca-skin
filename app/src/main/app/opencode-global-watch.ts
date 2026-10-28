import { watchFile, unwatchFile } from 'node:fs'

/** Serializes polling so each observed external plugin change has one fan-out. */
export class OpenCodeGlobalWatch {
  private tail: Promise<unknown>
  private fingerprint?: string
  private revision = 0
  private closed = false
  private readonly callback = (): void => {
    void this.check()
  }

  constructor(
    private readonly deps: {
      files: string[]
      fingerprint(): Promise<string>
      dirty?(): void
      changed(revision: number): void
      failed(error: unknown): void
    }
  ) {
    this.tail = deps
      .fingerprint()
      .then((value) => {
        this.fingerprint = value
      })
      .catch(deps.failed)
    for (const file of deps.files)
      watchFile(file, { interval: 1000, persistent: false }, this.callback)
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const task = this.tail
      .catch(() => undefined)
      .then(async () => {
        await action()
      })
    this.tail = task
    return task
  }

  private async notifyOpenCodePluginsChanged(): Promise<void> {
    if (this.closed) return
    const next = await this.deps.fingerprint()
    if (this.closed || next === this.fingerprint) return
    this.fingerprint = next
    this.deps.changed(++this.revision)
  }

  check(): Promise<void> {
    if (this.closed) return Promise.resolve()
    this.deps.dirty?.()
    return this.enqueue(() => this.notifyOpenCodePluginsChanged()).catch(this.deps.failed)
  }

  close(): void {
    this.closed = true
    for (const file of this.deps.files) unwatchFile(file, this.callback)
  }
}

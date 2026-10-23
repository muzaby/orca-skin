import { watchFile, unwatchFile } from 'node:fs'

/** Serializes our own commits and polling, so one file change has one fan-out. */
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
      reconcilePlugins(): Promise<unknown>
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
    await this.deps.reconcilePlugins()
    const next = await this.deps.fingerprint()
    if (this.closed || next === this.fingerprint) return
    this.fingerprint = next
    this.deps.changed(++this.revision)
  }

  check(): Promise<void> {
    if (this.closed) return Promise.resolve()
    return this.enqueue(() => this.notifyOpenCodePluginsChanged()).catch(this.deps.failed)
  }

  change(action: () => Promise<void>): Promise<void> {
    if (this.closed) return Promise.reject(new Error('설정 저장이 종료 중입니다.'))
    return this.enqueue(async () => {
      await action()
      await this.notifyOpenCodePluginsChanged()
    })
  }

  close(): void {
    this.closed = true
    for (const file of this.deps.files) unwatchFile(file, this.callback)
  }

  async drain(): Promise<void> {
    this.close()
    await this.tail.catch(() => undefined)
  }
}

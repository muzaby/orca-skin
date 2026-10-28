import { normalize } from 'node:path'
import type { SessionAdapter } from '../adapters/common/types'
import type { ChatActivitySnapshot } from '../../shared/ipc'
import { projectResourcesIdle } from './project-resource-sync'
import type { GovernedLiveTurn } from '../contracts/ports'

/** The adapter observes executing channels; the app supplies queue/background activity. */
export class OpenCodeMcpReconcile {
  private readonly timer: ReturnType<typeof setInterval>
  private flight?: Promise<void>
  private dirty = false
  private closed = false
  private revision = 0
  constructor(
    private readonly deps: {
      adapter: SessionAdapter
      peers(): { cwd: string; runtime: GovernedLiveTurn; activity: ChatActivitySnapshot }[]
      changed(): Promise<void>
    }
  ) {
    const key = (cwd: string): string =>
      process.platform === 'win32' ? normalize(cwd).toLowerCase() : normalize(cwd)
    deps.adapter.configureResourceActivity?.((cwd, beforeSubmit) =>
      deps
        .peers()
        .filter((peer) => key(peer.cwd) === key(cwd))
        .every(({ runtime, activity }) =>
          beforeSubmit
            ? activity.backgroundTaskCount === 0 && activity.residualCount === 0
            : projectResourcesIdle(activity, runtime)
        )
    )
    this.timer = setInterval(() => {
      if (this.dirty) void this.apply()
    }, 500)
    this.timer.unref?.()
  }
  changed(): void {
    this.revision++
    this.dirty = true
    void this.apply()
  }
  private apply(): Promise<void> {
    if (this.closed) return Promise.resolve()
    if (this.flight) return this.flight
    const revision = this.revision
    const task = (async () => {
      try {
        await this.deps.adapter.reconcileConnections?.()
        if (!this.closed) await this.deps.changed()
        // Busy peers are retried after their activity settles.
        this.dirty =
          revision !== this.revision ||
          this.deps
            .peers()
            .some(({ runtime, activity }) => !projectResourcesIdle(activity, runtime))
      } catch {
        this.dirty = revision !== this.revision // explicit save/read/submit retries; no failing connection loop
        if (!this.closed) await this.deps.changed()
      }
    })().finally(() => {
      if (this.flight === task) this.flight = undefined
    })
    this.flight = task
    return task
  }
  close(): void {
    this.closed = true
    clearInterval(this.timer)
  }
}

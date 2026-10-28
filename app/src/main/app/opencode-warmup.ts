import { randomUUID } from 'node:crypto'
import type { ComposerPreparationService } from './composer-preparation-service'
import { resolveLandingCwd } from './handlers/session-cwd'
import { getLogger } from '../infra/log/registry'

/** A normal preparation owner. Boot never waits on native connections. */
export class OpenCodeWarmup {
  private readonly owner = `warmup:${randomUUID()}`
  private attempted = false
  private closed = false
  private controller?: AbortController
  constructor(
    private readonly deps: {
      service: ComposerPreparationService
      allowed(): boolean
      settings(): { lastBackend: string | null; lastCwd: string | null }
      cwd(): string
      installed(): Promise<{ installed: boolean }>
    }
  ) {}
  update(): void {
    if (this.closed) return
    if (!this.deps.allowed()) {
      this.controller?.abort()
      void this.deps.service.owners('warmup').release(-1, this.owner)
      return
    }
    if (this.attempted || this.deps.settings().lastBackend !== 'opencode') return
    this.attempted = true
    const controller = (this.controller = new AbortController())
    void this.prepare(controller.signal).catch(() => {
      getLogger()
        .child('composer')
        .debug('composer.warmup.failed', {
          reason: controller.signal.aborted ? 'cancelled' : 'unavailable'
        })
    })
  }
  private async prepare(signal: AbortSignal): Promise<void> {
    const owners = this.deps.service.owners('warmup')
    try {
      if (!(await this.deps.installed()).installed) return
      signal.throwIfAborted()
      const cwd = await resolveLandingCwd(this.deps.settings().lastCwd, this.deps.cwd())
      signal.throwIfAborted()
      if (!this.deps.allowed()) return
      const scope = {
        backend: 'opencode' as const,
        sessionId: null,
        cwd,
        projectId: null,
        providerKey: null,
        agentKind: 'code' as const
      }
      await Promise.allSettled(
        (['agents', 'models', 'mcp'] as const).map((part) =>
          owners.read(-1, { owner: this.owner, scope, part }, () => undefined)
        )
      )
    } finally {
      await owners.release(-1, this.owner)
    }
  }
  close(): void {
    this.closed = true
    this.controller?.abort()
    void this.deps.service.owners('warmup').release(-1, this.owner)
  }
}

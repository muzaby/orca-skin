import type {
  ComposerCatalogInvalidated,
  ComposerCatalogLease,
  ComposerCatalogRequest,
  ComposerCatalogResult,
  ComposerCatalogScope
} from '../../shared/composer-catalog'
import { ComposerCatalogError } from './composer-catalog-error'
import { getLogger } from '../infra/log/registry'

export class ComposerCatalogCancelled extends Error {
  constructor(readonly reason: 'owner-left' | 'superseded' | 'shutdown' = 'owner-left') {
    super('Composer observation cancelled')
  }
}

export function composerScopeKey(scope: ComposerCatalogScope): string {
  return JSON.stringify([
    scope.backend,
    scope.sessionId,
    scope.cwd,
    scope.projectId,
    scope.providerKey,
    scope.agentKind
  ])
}

/** Cancellation settles the observer even when the native acquisition ignores its signal. */
async function observe<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort!: () => void
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      })
    ])
  } finally {
    signal.removeEventListener('abort', abort)
  }
}

interface Owner {
  scope: string
  invalidated: (event: ComposerCatalogInvalidated) => void
  controller: AbortController
  task: Promise<ComposerCatalogLease>
  lease?: ComposerCatalogLease
  detach?: () => void
  revalidating?: boolean
}

/** The renderer owns a preparation lease, not a native session. */
export class ComposerCatalogOwners {
  private readonly entries = new Map<number, Map<string, Owner>>()
  private closed = false
  constructor(
    private readonly prepare: (
      scope: ComposerCatalogScope,
      signal: AbortSignal
    ) => Promise<ComposerCatalogLease>,
    private readonly role: 'catalog' | 'resources' | 'warmup' = 'catalog'
  ) {}

  async read(
    sender: number,
    request: ComposerCatalogRequest,
    invalidated: (event: ComposerCatalogInvalidated) => void
  ): Promise<ComposerCatalogResult> {
    if (this.closed) throw new Error('Composer preparation closed')
    let owners = this.entries.get(sender)
    if (!owners) this.entries.set(sender, (owners = new Map()))
    let entry = owners.get(request.owner)
    const scope = composerScopeKey(request.scope)
    if (entry && entry.scope !== scope) throw new Error('Composer owner scope mismatch')
    if (entry?.lease?.signal.aborted) {
      void this.release(sender, request.owner).catch(() => undefined)
      owners = this.entries.get(sender)
      if (!owners) this.entries.set(sender, (owners = new Map()))
      entry = undefined
    }
    if (!entry) {
      const controller = new AbortController()
      const owned: Owner = {
        scope,
        invalidated,
        controller,
        task: Promise.resolve().then(() => {
          controller.signal.throwIfAborted()
          return this.prepare(request.scope, controller.signal)
        })
      }
      entry = owned
      owners.set(request.owner, owned)
      owned.task = owned.task.then((lease) => this.adopt(owned, lease, request.owner, invalidated))
      void owned.task.catch(() => {
        if (this.entries.get(sender)?.get(request.owner) === owned) {
          this.entries.get(sender)!.delete(request.owner)
          if (!this.entries.get(sender)!.size) this.entries.delete(sender)
        }
      })
    } else if (request.refresh && entry.lease && !entry.revalidating) {
      const owned = entry
      const previous = owned.task
      owned.revalidating = true
      owned.task = Promise.resolve()
        .then(() => this.prepare(request.scope, owned.controller.signal))
        .then((lease) => this.adopt(owned, lease, request.owner, invalidated))
        .catch((error: unknown) => {
          // A failed revalidation keeps the previous usable profile/lease.
          owned.task = previous
          throw error
        })
        .finally(() => {
          owned.revalidating = false
        })
    }
    try {
      const lease = await observe(entry.task, entry.controller.signal)
      entry.controller.signal.throwIfAborted()
      const signal = entry.controller.signal
      if (request.part === 'mcp' && this.role !== 'resources') lease.activate?.()
      const result = {
        part: request.part,
        value: await observe(lease.read(request.part, signal, request.refresh), signal).catch(
          (error: unknown) => {
            throw new ComposerCatalogError(request.part, error)
          }
        ),
        generation: lease.generation
      } as ComposerCatalogResult
      signal.throwIfAborted()
      lease.signal.throwIfAborted()
      return result
    } catch (error) {
      if (entry.controller.signal.aborted) throw entry.controller.signal.reason
      throw error
    }
  }

  private async adopt(
    entry: Owner,
    lease: ComposerCatalogLease,
    owner: string,
    invalidated: (event: ComposerCatalogInvalidated) => void
  ): Promise<ComposerCatalogLease> {
    if (entry.controller.signal.aborted || lease.signal.aborted) {
      await lease.release()
      entry.controller.signal.throwIfAborted()
      lease.signal.throwIfAborted()
    }
    const previous = entry.lease
    entry.detach?.()
    entry.lease = lease
    const onAbort = (): void => {
      if (!entry.controller.signal.aborted) invalidated({ owner, generation: lease.generation })
    }
    lease.signal.addEventListener('abort', onAbort, { once: true })
    entry.detach = () => lease.signal.removeEventListener('abort', onAbort)
    // Acquire before release: compatible profiles retain their native instance. A different
    // profile's asynchronous disposal must not delay the newly prepared directory's result.
    if (previous) void previous.release().catch(() => undefined)
    return lease
  }

  async release(
    sender: number,
    owner: string,
    reason: ComposerCatalogCancelled['reason'] = 'owner-left'
  ): Promise<void> {
    const owners = this.entries.get(sender)
    const entry = owners?.get(owner)
    if (!entry) return
    getLogger().child('composer').debug('composer.observation.cancelled', { reason })
    owners!.delete(owner)
    if (!owners!.size) this.entries.delete(sender)
    entry.detach?.()
    entry.controller.abort(new ComposerCatalogCancelled(reason))
    // A pending acquisition's completion owns its release; settled leases are ours.
    if (entry.lease) await entry.lease.release()
  }

  releaseSender(sender: number): void {
    for (const owner of this.entries.get(sender)?.keys() ?? [])
      void this.release(sender, owner).catch(() => undefined)
  }

  invalidate(): void {
    for (const [sender, entries] of this.entries) {
      for (const [owner, entry] of entries) {
        if (entry.lease) entry.invalidated({ owner, generation: entry.lease.generation })
      }
      for (const owner of entries.keys())
        void this.release(sender, owner, 'superseded').catch(() => undefined)
    }
  }

  close(): void {
    this.closed = true
    for (const [sender, entries] of this.entries)
      for (const owner of entries.keys())
        void this.release(sender, owner, 'shutdown').catch(() => undefined)
  }
}

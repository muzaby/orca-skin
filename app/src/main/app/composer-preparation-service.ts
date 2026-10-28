import { randomUUID } from 'node:crypto'
import type { ComposerCatalogLease, ComposerCatalogScope } from '../../shared/composer-catalog'
import {
  ComposerCatalogCancelled,
  ComposerCatalogOwners,
  composerScopeKey
} from './composer-catalog-owner'
import { getLogger } from '../infra/log/registry'

export interface ComposerPreparationTarget {
  key: string
  acquire(): Promise<ComposerCatalogLease>
}
interface Entry {
  id: string
  references: number
  task: Promise<ComposerCatalogLease>
}

/** One shared target flight, with separate sender/role/owner attachments. */
export class ComposerPreparationService {
  private readonly targets = new Map<string, Entry>()
  private readonly resolving = new Map<string, Promise<ComposerPreparationTarget>>()
  private readonly roles = new Map<string, ComposerCatalogOwners>()
  private controller = new AbortController()
  private closed = false
  constructor(
    private readonly resolve: (
      scope: ComposerCatalogScope,
      signal: AbortSignal
    ) => Promise<ComposerPreparationTarget>
  ) {}

  owners(role: 'catalog' | 'resources' | 'warmup'): ComposerCatalogOwners {
    let owners = this.roles.get(role)
    if (!owners) {
      owners = new ComposerCatalogOwners((scope, signal) => this.acquire(scope, signal), role)
      this.roles.set(role, owners)
    }
    return owners
  }

  async acquire(scope: ComposerCatalogScope, signal: AbortSignal): Promise<ComposerCatalogLease> {
    if (this.closed) throw new ComposerCatalogCancelled('shutdown')
    signal.throwIfAborted()
    const epoch = this.controller
    const tuple = composerScopeKey(scope)
    let resolution = this.resolving.get(tuple)
    if (!resolution) {
      resolution = this.resolve(scope, epoch.signal)
      this.resolving.set(tuple, resolution)
      const finish = (): void => {
        if (this.resolving.get(tuple) === resolution) this.resolving.delete(tuple)
      }
      void resolution.then(finish, finish)
    }
    const target = await resolution
    signal.throwIfAborted()
    epoch.signal.throwIfAborted()
    let entry = this.targets.get(target.key)
    if (!entry) {
      entry = { id: randomUUID(), references: 0, task: target.acquire() }
      this.targets.set(target.key, entry)
    }
    const owned = entry
    owned.references++
    getLogger()
      .child('composer')
      .debug('composer.owner.attach', { id: owned.id, count: owned.references })
    let released = false
    const release = async (): Promise<void> => {
      if (released) return
      released = true
      getLogger()
        .child('composer')
        .debug('composer.owner.detach', { id: owned.id, count: owned.references - 1 })
      if (--owned.references !== 0) return
      if (this.targets.get(target.key) === owned) this.targets.delete(target.key)
      // If acquisition is still pending, its late completion owns physical release.
      void owned.task.then((lease) => lease.release()).catch(() => undefined)
    }
    try {
      const lease = await owned.task
      signal.throwIfAborted()
      epoch.signal.throwIfAborted()
      return { ...lease, release }
    } catch (error) {
      await release()
      throw error
    }
  }

  invalidate(): void {
    getLogger().child('composer').debug('composer.owner.invalidate', { reason: 'definitions' })
    this.controller.abort(new ComposerCatalogCancelled('superseded'))
    this.controller = new AbortController()
    this.resolving.clear()
    this.targets.clear()
    for (const owners of this.roles.values()) owners.invalidate()
  }
  close(): void {
    if (this.closed) return
    this.closed = true
    getLogger().child('composer').debug('composer.owner.invalidate', { reason: 'shutdown' })
    this.controller.abort(new ComposerCatalogCancelled('shutdown'))
    for (const owners of this.roles.values()) owners.close()
    this.targets.clear()
    this.resolving.clear()
  }
}

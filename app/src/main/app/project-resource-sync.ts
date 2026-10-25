import { watchFile, unwatchFile } from 'node:fs'
import type { Backend, ChatActivitySnapshot } from '../../shared/ipc'
import type { DraftNativeResourcesRequest, NativeResources } from '../../shared/native-resources'
import type { GovernedLiveTurn } from '../contracts/ports'
import type {
  ProjectResourceConfiguration,
  ProjectResourcePolicy
} from '../adapters/common/project-resources'

export type ResourceRequest = { sessionId: string } | DraftNativeResourcesRequest
export interface ProjectResourceTarget {
  backend: Backend
  cwd: string
  key: string
  request: ResourceRequest
  runtime?: GovernedLiveTurn
}
type Owner = { request: ResourceRequest; emit(value: NativeResources): void }
type Entry = {
  key: string
  target: ProjectResourceTarget
  policy: ProjectResourcePolicy
  stop: Array<() => void>
  version: number
  reading?: Promise<void>
  configuration?: ProjectResourceConfiguration
  applied: WeakMap<GovernedLiveTurn, string>
  restart: WeakMap<GovernedLiveTurn, string>
  applying: boolean
  failed: boolean
  last: Map<string, NativeResources>
}

export function projectResourcesIdle(
  activity: ChatActivitySnapshot,
  runtime: GovernedLiveTurn
): boolean {
  return (
    !runtime.responding &&
    activity.foreground === 'idle' &&
    activity.queuedCount === 0 &&
    activity.deliveryPendingCount === 0 &&
    activity.residualCount === 0 &&
    activity.backgroundTaskCount === 0 &&
    !activity.pendingSessionWakeup
  )
}

/** Owns only observation and idle reconciliation. Never starts or discards a runtime. */
export class ProjectResourceSync {
  private readonly owners = new Map<string, Owner>()
  private readonly entries = new Map<string, Entry>()
  private readonly timer: ReturnType<typeof setInterval>
  private closed = false
  constructor(
    private readonly deps: {
      resolve(request: ResourceRequest): ProjectResourceTarget | undefined
      targets(): ProjectResourceTarget[]
      policy(backend: Backend): ProjectResourcePolicy | undefined
      idle(target: ProjectResourceTarget): boolean
      read(request: ResourceRequest): Promise<NativeResources>
      emit(sessionId: string, value: NativeResources): void
      run<T>(key: string, action: () => Promise<T>): Promise<T>
      watch?: (file: string, changed: () => void) => () => void
    }
  ) {
    this.timer = setInterval(() => this.tick(), 500)
    this.timer.unref?.()
  }
  observe(owner: string, request: ResourceRequest, emit: Owner['emit']): void {
    this.owners.set(owner, { request, emit })
    this.tick()
  }
  release(owner: string): void {
    this.owners.delete(owner)
    this.tick()
  }
  retry(request: ResourceRequest): void {
    const target = this.deps.resolve(request)
    const entry = target && this.entries.get(this.entryKey(target))
    if (entry?.failed) {
      entry.version++
      void this.refresh(entry)
    }
  }
  settingsChanged(backend: Backend): void {
    for (const entry of this.entries.values())
      if (entry.target.backend === backend) {
        entry.version++
        void this.refresh(entry)
      }
  }
  releasePrefix(prefix: string): void {
    for (const owner of this.owners.keys()) if (owner.startsWith(prefix)) this.owners.delete(owner)
    this.tick()
  }
  decorate(request: ResourceRequest, value: NativeResources): NativeResources {
    const target = this.deps.resolve(request)
    const entry = target && this.entries.get(this.entryKey(target))
    const configuration = entry?.configuration
    if (!entry || !configuration || !target?.runtime) return value
    if (this.appliedTo(entry, target.runtime, configuration.revision) && !entry.failed) return value
    return {
      ...value,
      configurationPending: true,
      ...(entry.failed ? { partial: true } : {}),
      items: value.items.map((item) => ({ ...item, canToggle: false }))
    }
  }
  tick(): void {
    if (this.closed) return
    const targets = [
      ...this.deps.targets(),
      ...[...this.owners.values()].flatMap(({ request }) => this.deps.resolve(request) ?? [])
    ]
    const keys = new Set<string>()
    for (const target of targets) {
      const policy = this.policy(target)
      if (!policy) continue
      const key = this.entryKey(target)
      keys.add(key)
      let entry = this.entries.get(key)
      if (!entry) {
        entry = {
          key,
          target,
          policy,
          stop: [],
          version: 0,
          applied: new WeakMap(),
          restart: new WeakMap(),
          applying: false,
          failed: false,
          last: new Map()
        }
        this.entries.set(key, entry)
        const current = entry
        const changed = (): void => {
          current.version++
          void this.refresh(current)
        }
        for (const file of policy.files(target.cwd)) {
          if (this.deps.watch) current.stop.push(this.deps.watch(file, changed))
          else {
            watchFile(file, { interval: 250, persistent: false }, changed)
            current.stop.push(() => unwatchFile(file, changed))
          }
        }
        void this.refresh(current)
      }
      void this.apply(entry)
    }
    for (const [key, entry] of this.entries)
      if (!keys.has(key)) {
        this.entries.delete(key)
        entry.version++
        for (const stop of entry.stop) stop()
      }
  }
  private policy(target: ProjectResourceTarget): ProjectResourcePolicy | undefined {
    return target.runtime?.projectResourcePolicy?.() ?? this.deps.policy(target.backend)
  }
  private entryKey(target: ProjectResourceTarget): string {
    return JSON.stringify([target.key, this.policy(target)?.files(target.cwd)])
  }
  private valid(entry: Entry): boolean {
    return !this.closed && this.entries.get(entry.key) === entry
  }
  private async refresh(entry: Entry): Promise<void> {
    if (entry.reading) return entry.reading
    const task = (async () => {
      let version: number
      do {
        version = entry.version
        try {
          const next = await entry.policy.read(entry.target.cwd)
          if (!this.valid(entry)) return
          if (version !== entry.version) continue
          const recovered = entry.failed
          entry.failed = false
          if (next.revision !== entry.configuration?.revision || recovered) {
            entry.configuration = next
            await this.emit(entry)
          }
        } catch {
          if (!this.valid(entry)) return
          entry.failed = true
          await this.emit(entry)
        }
      } while (this.valid(entry) && version !== entry.version)
    })()
    entry.reading = task
    try {
      await task
    } finally {
      entry.reading = undefined
    }
    void this.apply(entry)
  }
  private peers(entry: Entry, allConfigurations = false): ProjectResourceTarget[] {
    return this.deps
      .targets()
      .filter(
        (target) =>
          target.key === entry.target.key &&
          target.runtime &&
          (allConfigurations || this.entryKey(target) === entry.key)
      )
  }
  private async apply(entry: Entry): Promise<void> {
    const configuration = entry.configuration
    if (!this.valid(entry) || !configuration || entry.failed || entry.applying || entry.reading)
      return
    const peers = this.peers(entry)
    const pending = peers.filter(
      ({ runtime }) =>
        !this.appliedTo(entry, runtime!, configuration.revision) &&
        entry.restart.get(runtime!) !== configuration.revision
    )
    if (!pending.length || !this.peers(entry, true).every((peer) => this.deps.idle(peer))) return
    entry.applying = true
    try {
      await this.deps.run(entry.target.key, async () => {
        const guard = (): boolean =>
          this.valid(entry) &&
          !entry.failed &&
          entry.configuration === configuration &&
          this.peers(entry, true).every((peer) => this.deps.idle(peer))
        for (const peer of pending) {
          if (!guard()) return
          const runtime = peer.runtime!
          if (this.deps.resolve(peer.request)?.runtime !== runtime) continue
          const outcome =
            (await runtime.reconcileNativeResources?.(configuration.revision, guard)) ??
            'restart-required'
          if (!guard() || this.deps.resolve(peer.request)?.runtime !== runtime) continue
          if (outcome === 'applied') entry.applied.set(runtime, configuration.revision)
          else if (outcome === 'restart-required')
            entry.restart.set(runtime, configuration.revision)
        }
      })
      await this.emit(entry)
    } catch {
      entry.failed = true
      await this.emit(entry)
    } finally {
      entry.applying = false
    }
  }
  /** Reconciled here, or already applied by the runtime itself (its own persisted toggle). */
  // The runtime only vouches for the files' current revision. Record it the moment it is observed:
  // after the runtime's next own save the watcher still holds this revision until its poll catches up.
  private appliedTo(entry: Entry, runtime: GovernedLiveTurn, revision: string): boolean {
    if (entry.applied.get(runtime) === revision) return true
    if (runtime.nativeResourcesApplied?.(revision) !== true) return false
    entry.applied.set(runtime, revision)
    return true
  }
  // Broadcasts wait behind an in-flight project mutation so its intermediate state is never shown.
  // Never call this from inside `deps.run`: the queue would wait on itself.
  private emit(entry: Entry): Promise<void> {
    return this.deps.run(entry.target.key, () => this.broadcast(entry))
  }
  private async broadcast(entry: Entry): Promise<void> {
    const version = entry.version
    const targets = new Map<
      string,
      { request: ResourceRequest; emit(value: NativeResources): void }
    >()
    for (const peer of this.peers(entry))
      if ('sessionId' in peer.request) {
        const id = peer.request.sessionId
        targets.set(`session:${id}`, {
          request: peer.request,
          emit: (value) => this.deps.emit(id, value)
        })
      }
    for (const [owner, value] of this.owners) {
      const target = this.deps.resolve(value.request)
      if (target && this.entryKey(target) === entry.key) targets.set(owner, value)
    }
    const reads = new Map<string, Promise<NativeResources>>()
    await Promise.all(
      [...targets.values()].map(async ({ request, emit }) => {
        const key = JSON.stringify(request)
        const valid = (): boolean => {
          const target = this.deps.resolve(request)
          return (
            this.valid(entry) &&
            entry.version === version &&
            !!target &&
            this.entryKey(target) === entry.key
          )
        }
        try {
          if (!reads.has(key)) reads.set(key, this.deps.read(request))
          const value = await reads.get(key)!
          if (valid()) {
            entry.last.set(key, value)
            emit(this.decorate(request, value))
          }
        } catch {
          const previous = entry.last.get(key)
          if (valid() && previous)
            emit({
              ...previous,
              partial: true,
              items: previous.items.map((item) => ({ ...item, canToggle: false }))
            })
        }
      })
    )
  }
  close(): void {
    this.closed = true
    clearInterval(this.timer)
    for (const entry of this.entries.values()) for (const stop of entry.stop) stop()
    this.entries.clear()
    this.owners.clear()
  }
}

import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import type { Stats } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileFingerprints, FingerprintWatch } from '../../../infra/config/fingerprint-watch'
import { openCodeRetention } from './retention-policy'

type Probe = { value?: unknown; error?: unknown; signature: string; fingerprint: string }
type Dependency = {
  key: string
  path: string
  probe(force?: boolean): Promise<Probe>
  signature: string
  fingerprint: string
}
type Entry = {
  value?: unknown
  ready: boolean
  dependencies: Map<string, Dependency>
  flight?: Promise<unknown>
  epoch: number
  checked: number
}
const context = new AsyncLocalStorage<Map<string, Dependency>>()
const hash = (value: string): string => createHash('sha256').update(value).digest('hex')
const probes = new Map<string, { at: number; flight: Promise<Probe> }>()

async function dependency<T>(
  kind: string,
  path: string,
  load: () => Promise<T>,
  describe: (value: T) => string
): Promise<T> {
  const key = `${kind}:${resolve(path)}`
  const probe = async (force = false): Promise<Probe> => {
    const previous = probes.get(key)
    if (!force && previous && Date.now() - previous.at < openCodeRetention.discoveryCheckMs)
      return previous.flight
    const fingerprint = await fileFingerprints([path])
    if (force && previous) {
      const cached = await previous.flight
      if (
        cached.fingerprint === fingerprint &&
        Date.now() - previous.at < openCodeRetention.discoveryCheckMs
      )
        return cached
    }
    // Another consumer may have started the same dependency while stat was pending.
    const concurrent = probes.get(key)
    if (concurrent && concurrent !== previous) return concurrent.flight
    const flight = load().then(
      (value) => ({ value, signature: hash(describe(value)), fingerprint }),
      (error: unknown) => ({
        error,
        signature: `error:${(error as NodeJS.ErrnoException).code ?? 'unknown'}`,
        fingerprint
      })
    )
    probes.set(key, { at: Date.now(), flight })
    while (probes.size > 4096) probes.delete(probes.keys().next().value!)
    return flight
  }
  const result = await probe()
  context.getStore()?.set(key, {
    key,
    path: resolve(path),
    probe,
    signature: result.signature,
    fingerprint: result.fingerprint
  })
  if (result.error) throw result.error
  return result.value as T
}
export const discoveryReadFile = (path: string, _encoding: 'utf8' = 'utf8'): Promise<string> => {
  void _encoding
  return dependency(
    'file',
    path,
    () => readFile(path, 'utf8'),
    (value) => value
  )
}
export const discoveryRealpath = (path: string): Promise<string> =>
  dependency(
    'realpath',
    path,
    () => realpath(path),
    (value) => value
  )
export const discoveryStat = (path: string): Promise<Stats> =>
  dependency(
    'stat',
    path,
    () => stat(path),
    (value) =>
      JSON.stringify([
        value.isDirectory(),
        value.isFile(),
        value.dev,
        value.ino,
        value.mtimeMs,
        value.ctimeMs,
        value.size
      ])
  )

/** Content manifests include failed/missing reads and symlink resolution, not just mtimes. */
export class OpenCodeDiscoveryCache {
  private readonly entries = new Map<string, Entry>()
  private readonly observers = new Map<
    string,
    {
      refs: number
      changed: Set<() => void>
      dependencies: Map<string, Dependency>
      watcher?: FingerprintWatch
    }
  >()
  private polling?: Promise<void>
  private pollRequested = false
  key(kind: string, cwd: string, env: NodeJS.ProcessEnv = process.env, extra = ''): string {
    const directory = resolve(cwd)
    return JSON.stringify([
      kind,
      process.platform === 'win32' ? directory.toLowerCase() : directory,
      Object.entries(env)
        .filter(([name]) => /^(OPENCODE_|XDG_|HOME$|USERPROFILE$|ProgramData$)/i.test(name))
        .sort(([a], [b]) => a.localeCompare(b)),
      extra
    ])
  }
  async run<T>(key: string, load: () => Promise<T>): Promise<T> {
    let entry = this.entries.get(key)
    if (!entry) {
      entry = { ready: false, dependencies: new Map(), epoch: 0, checked: -Infinity }
      this.entries.set(key, entry)
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    const parent = context.getStore()
    const owned = entry
    if (!owned.flight) {
      const flight = (async () => {
        for (;;) {
          const epoch = owned.epoch
          if (owned.ready && Date.now() - owned.checked >= openCodeRetention.discoveryCheckMs) {
            const valid = await this.valid(owned.dependencies)
            if (owned.epoch !== epoch) continue
            owned.ready = valid
            owned.checked = Date.now()
          }
          if (owned.ready) return owned.value as T
          const manifest = new Map<string, Dependency>()
          const value = await context.run(manifest, load)
          if (owned.epoch !== epoch) continue
          owned.value = structuredClone(value)
          owned.dependencies = manifest
          owned.checked = Date.now()
          owned.ready = true
          const observer = this.observers.get(key)
          if (observer) {
            observer.dependencies = new Map(manifest)
            this.watch(key)
          }
          return value
        }
      })().finally(() => {
        if (owned.flight === flight) owned.flight = undefined
      })
      owned.flight = flight
    }
    try {
      const value = (await owned.flight) as T
      if (parent) for (const [id, dependency] of owned.dependencies) parent.set(id, dependency)
      return structuredClone(value)
    } finally {
      this.prune(key.startsWith('["installation"') ? 'installation' : 'scope')
    }
  }
  private async valid(dependencies: Map<string, Dependency>): Promise<boolean> {
    const checks = await Promise.all(
      [...dependencies.values()].map(
        async (dependency) => (await dependency.probe()).signature === dependency.signature
      )
    )
    return checks.every(Boolean)
  }
  invalidate(): void {
    probes.clear()
    for (const entry of this.entries.values()) {
      entry.epoch++
      entry.ready = false
      entry.checked = -Infinity
    }
  }
  hold(key: string, changed: () => void): () => void {
    let observer = this.observers.get(key)
    if (!observer)
      this.observers.set(
        key,
        (observer = {
          refs: 0,
          changed: new Set(),
          dependencies: new Map(this.entries.get(key)?.dependencies)
        })
      )
    observer.refs++
    observer.changed.add(changed)
    this.watch(key)
    let released = false
    return () => {
      if (released) return
      released = true
      observer!.changed.delete(changed)
      if (--observer!.refs === 0) {
        observer!.watcher?.close()
        this.observers.delete(key)
      }
    }
  }
  private watch(key: string): void {
    const observer = this.observers.get(key)
    if (!observer) return
    observer.watcher?.close()
    const dependencies = [...observer.dependencies.values()]
    observer.watcher = new FingerprintWatch({
      files: [...new Set(dependencies.map((dependency) => dependency.path))],
      initialFingerprint: JSON.stringify(dependencies.map((dependency) => dependency.fingerprint)),
      fingerprint: async () =>
        JSON.stringify(
          await Promise.all(dependencies.map((dependency) => fileFingerprints([dependency.path])))
        ),
      interval: openCodeRetention.discoveryCheckMs,
      changed: () => {
        void this.poll().catch(() => undefined)
      },
      failed: () => {
        void this.poll().catch(() => undefined)
      }
    })
  }
  poll(): Promise<void> {
    this.pollRequested = true
    if (this.polling) return this.polling
    const task = (async () => {
      do {
        this.pollRequested = false
        await Promise.all(
          [...this.observers].map(async ([key, observer]) => {
            const dependencies = observer.dependencies
            let changed = false
            const next = new Map<string, Dependency>()
            await Promise.all(
              [...dependencies.values()].map(async (dependency) => {
                const { signature, fingerprint } = await dependency.probe(true)
                changed ||= signature !== dependency.signature
                next.set(dependency.key, { ...dependency, signature, fingerprint })
              })
            )
            if (this.observers.get(key) !== observer) return
            if (observer.dependencies !== dependencies) {
              this.pollRequested = true
              return
            }
            if (!changed) return
            observer.dependencies = next
            const entry = this.entries.get(key)
            if (entry) {
              entry.epoch++
              entry.ready = false
            }
            for (const notify of observer.changed) notify()
          })
        )
      } while (this.pollRequested)
    })().finally(() => {
      if (this.polling === task) this.polling = undefined
    })
    this.polling = task
    return task
  }
  private prune(group: 'scope' | 'installation'): void {
    const selected = [...this.entries.keys()].filter(
      (key) => key.startsWith('["installation"') === (group === 'installation')
    )
    const cap =
      group === 'installation'
        ? openCodeRetention.maxInstallationEntries
        : openCodeRetention.maxDiscoveryScopes
    let excess = selected.length - cap
    for (const key of selected) {
      if (excess <= 0) break
      if (!this.entries.get(key)?.flight) {
        this.entries.delete(key)
        excess--
      }
    }
  }
}
export const openCodeDiscovery = new OpenCodeDiscoveryCache()

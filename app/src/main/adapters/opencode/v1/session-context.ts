import { createOpencodeClient, type Event, type OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type {
  NativeCommand,
  NativeComposerCatalog,
  NativeResource
} from '../../../../shared/native-resources'
import { harnessEnvFingerprint } from '../../common/harness-config'
import { OpenCodeComposerCache } from './composer-cache'
import { OpenCodeMcpControl } from './mcp-control'
import type { ExtensionControl } from '../../common/extension-control'
import { openCodePreparationError } from './errors'
import { openCodeNativeCommands } from './native-resources'
import { sameNativePath } from './native-storage'
import {
  OpenCodeIdleBudget,
  OpenCodeInstances,
  waitForOpenCode,
  type OpenCodeInstance
} from './instance-lifecycle'
import { openCodeDiscovery } from './discovery-cache'

interface ServerIdentity {
  url: string
  headers: Record<string, string>
  retire?: () => void
}
export interface ManagedConnectionChoices {
  choices(): Record<string, boolean>
  defaults?: Record<string, boolean>
}

interface DirectoryState {
  client: OpencodeClient
  callerClient(signal: AbortSignal): OpencodeClient
  controller: AbortController
  ready?: Promise<void>
  commands?: NativeCommand[]
  commandFlight?: Promise<NativeCommand[]>
  commandRevision: number
  composer: OpenCodeComposerCache
  mcpControl?: OpenCodeMcpControl
  discoveryHeld?: boolean
}

interface Subscriber {
  directory: string
  queue: Event[]
  wake?: () => void
  error?: Error
}

export interface OpenCodeClientLease {
  activate?(): void
  managedMcpMentions?: Record<string, string>
  managedMcpReferences?: Record<string, string>
  mapMcpResources?(items: NativeResource[]): NativeResource[]
  mcpControl?: OpenCodeMcpControl
  readonly signal: AbortSignal
  readonly generation: string
  client: OpencodeClient
  release(): Promise<void>
  events(signal: AbortSignal): AsyncGenerator<Event>
  prepare(signal: AbortSignal): Promise<void>
  commands(signal: AbortSignal): Promise<NativeCommand[]>
  composer(signal: AbortSignal, refresh?: boolean): Promise<NativeComposerCatalog>
  agents(signal: AbortSignal, refresh?: boolean): Promise<NativeComposerCatalog['agents']>
  models(signal: AbortSignal, refresh?: boolean): Promise<NativeComposerCatalog['models']>
  mcp(signal: AbortSignal, refresh?: boolean): Promise<NativeResource[]>
  plugins(
    signal: AbortSignal,
    refresh?: boolean,
    env?: NodeJS.ProcessEnv
  ): Promise<NativeResource[]>
  rememberCommands(commands: NativeCommand[]): void
}

class ServerContext {
  readonly client: OpencodeClient
  readonly instances: OpenCodeInstances
  references = 0
  private readonly controller = new AbortController()
  private readonly directories = new WeakMap<OpenCodeInstance, DirectoryState>()
  private readonly subscribers = new Set<Subscriber>()
  private eventController?: AbortController
  private eventEpoch = 0
  private connected?: Event
  private readonly connectionWaiters = new Set<() => void>()

  constructor(
    private readonly server: ServerIdentity,
    private readonly fetchImpl: typeof fetch,
    private readonly retire: () => void,
    private readonly queueLimit: number,
    private readonly extensionControl: ExtensionControl | undefined,
    idleBudget: OpenCodeIdleBudget,
    settled: () => void,
    private readonly releaseDependencies: () => void,
    idleRetentionMs?: number,
    cleanupFailed?: () => void,
    private readonly managed?: ManagedConnectionChoices,
    private readonly idle: (cwd: string, beforeSubmit: boolean) => boolean = () => true
  ) {
    this.client = createOpencodeClient({
      baseUrl: server.url,
      headers: server.headers,
      fetch: fetchImpl,
      throwOnError: true
    })
    this.instances = new OpenCodeInstances({
      connect: (signal) => this.connectEvents(signal),
      dispose: async (directory, signal) => {
        await this.client.instance.dispose({ directory }, { signal, throwOnError: true })
      },
      retire: () => {
        server.retire?.()
        this.retire()
        this.instances.retire()
      },
      idleBudget,
      settled,
      idleRetentionMs,
      cleanupFailed
    })
  }

  directory(scope: OpenCodeInstance): DirectoryState {
    let state = this.directories.get(scope)
    if (!state) {
      const fetchScoped: typeof fetch = async (input, init) => {
        const request = new Request(input, init)
        const url = new URL(request.url)
        // An owned turn must still stop generation after its event stream fails.
        const cleanupAbort =
          request.method === 'POST' &&
          /^\/session\/[^/]+\/abort$/.test(url.pathname) &&
          scope.references > 0 &&
          !scope.disposed
        const signal = cleanupAbort
          ? request.signal
          : AbortSignal.any([request.signal, scope.controller.signal, this.controller.signal])
        signal.throwIfAborted()
        if (!url.pathname.startsWith('/global/')) {
          const header = request.headers.get('x-opencode-directory')
          const directory =
            url.searchParams.get('directory') ?? (header ? decodeURIComponent(header) : null)
          if (!directory || !sameNativePath(directory, scope.directory))
            throw new Error('OpenCode 프로젝트 요청 경로가 일치하지 않습니다.')
          scope.touched = true
        }
        const response = await this.fetchImpl(new Request(request, { signal }))
        if (signal.aborted) {
          await response.body?.cancel().catch(() => undefined)
          signal.throwIfAborted()
        }
        return response
      }
      const client = createOpencodeClient({
        baseUrl: this.server.url,
        headers: this.server.headers,
        directory: scope.directory,
        fetch: fetchScoped,
        throwOnError: true
      })
      const composer = new OpenCodeComposerCache(
        client,
        scope.directory,
        AbortSignal.any([this.controller.signal, scope.controller.signal]),
        scope.id
      )
      state = {
        client,
        callerClient: (signal) =>
          createOpencodeClient({
            baseUrl: this.server.url,
            headers: this.server.headers,
            directory: scope.directory,
            throwOnError: true,
            fetch: async (input, init) => {
              const request = new Request(input, init)
              const combined = AbortSignal.any([signal, request.signal])
              combined.throwIfAborted()
              const response = await fetchScoped(new Request(request, { signal: combined }))
              if (combined.aborted) {
                await response.body?.cancel().catch(() => undefined)
                combined.throwIfAborted()
              }
              return response
            }
          }),
        mcpControl: new OpenCodeMcpControl(
          client,
          scope.directory,
          this.extensionControl ?? { global: () => ({}) },
          scope.controller.signal,
          composer,
          this.managed,
          (beforeSubmit) => this.idle(scope.directory, beforeSubmit),
          this.managed?.defaults
        ),
        controller: scope.controller,
        composer,
        commandRevision: 0
      }
      this.directories.set(scope, state)
    }
    return state
  }

  private signal(state: DirectoryState, timeoutMs: number): AbortSignal {
    return AbortSignal.any([
      this.controller.signal,
      state.controller.signal,
      AbortSignal.timeout(timeoutMs)
    ])
  }

  private wait<T>(task: Promise<T>, state: DirectoryState, signal: AbortSignal): Promise<T> {
    return waitForOpenCode(
      task,
      AbortSignal.any([signal, this.controller.signal, state.controller.signal])
    )
  }

  private ready(directory: string, state: DirectoryState): Promise<void> {
    this.controller.signal.throwIfAborted()
    state.controller.signal.throwIfAborted()
    state.ready ??= state.client.config
      .get({ directory }, { signal: this.signal(state, 30_000), throwOnError: true })
      .then(() => {
        this.controller.signal.throwIfAborted()
        state.controller.signal.throwIfAborted()
      })
      .catch((error: unknown) => {
        state.ready = undefined
        this.controller.signal.throwIfAborted()
        state.controller.signal.throwIfAborted()
        throw openCodePreparationError('project', error)
      })
    return state.ready
  }

  prepare(directory: string, state: DirectoryState, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted()
    return this.wait(
      this.ready(directory, state).then(() => state.mcpControl?.activate()),
      state,
      signal
    )
  }

  commands(
    directory: string,
    state: DirectoryState,
    signal: AbortSignal
  ): Promise<NativeCommand[]> {
    signal.throwIfAborted()
    this.controller.signal.throwIfAborted()
    state.controller.signal.throwIfAborted()
    if (state.commands) return this.wait(Promise.resolve(state.commands), state, signal)
    if (!state.commandFlight) {
      const revision = state.commandRevision
      const flight = this.ready(directory, state)
        .then(() =>
          openCodeNativeCommands(state.client, directory, false, undefined, {
            signal: AbortSignal.any([this.controller.signal, state.controller.signal]),
            timeoutMs: 30_000
          })
        )
        .then((commands) => {
          this.controller.signal.throwIfAborted()
          state.controller.signal.throwIfAborted()
          if (state.commandRevision === revision) state.commands = commands
          return state.commands ?? commands
        })
        .finally(() => {
          if (state.commandFlight === flight) state.commandFlight = undefined
        })
      state.commandFlight = flight
    }
    return this.wait(state.commandFlight, state, signal)
  }

  async composer(
    state: DirectoryState,
    signal: AbortSignal,
    refresh = false
  ): Promise<NativeComposerCatalog> {
    const [agents, models] = await Promise.all([
      state.composer.agents(signal, refresh),
      state.composer.models(signal, refresh)
    ])
    return { agents, models }
  }

  rememberCommands(
    scope: OpenCodeInstance,
    state: DirectoryState,
    commands: NativeCommand[]
  ): void {
    if (
      this.controller.signal.aborted ||
      state.controller.signal.aborted ||
      !this.instances.active(scope)
    )
      return
    state.commandRevision++
    state.commands = commands
  }

  private offer(subscriber: Subscriber, event: Event): void {
    if (subscriber.error) return
    if (subscriber.queue.length >= this.queueLimit) {
      subscriber.queue.length = 0
      subscriber.error = new Error(
        'OpenCode 이벤트 수신이 지연되어 연결을 종료했습니다. 다시 연결해 주세요.'
      )
    } else subscriber.queue.push(event)
    subscriber.wake?.()
    subscriber.wake = undefined
  }

  async *events(directory: string, signal: AbortSignal): AsyncGenerator<Event> {
    signal.throwIfAborted()
    this.controller.signal.throwIfAborted()
    const subscriber: Subscriber = { directory, queue: [] }
    this.subscribers.add(subscriber)
    const wake = (): void => {
      subscriber.wake?.()
      subscriber.wake = undefined
    }
    signal.addEventListener('abort', wake)
    if (this.connected) this.offer(subscriber, this.connected)
    else if (!this.eventController) this.startEvents()
    try {
      for (;;) {
        signal.throwIfAborted()
        if (subscriber.error) throw subscriber.error
        this.controller.signal.throwIfAborted()
        if (subscriber.queue.length) yield subscriber.queue.shift()!
        else
          await new Promise<void>((resolve) => {
            subscriber.wake = resolve
          })
      }
    } finally {
      signal.removeEventListener('abort', wake)
      this.subscribers.delete(subscriber)
    }
  }

  private async connectEvents(signal: AbortSignal): Promise<void> {
    this.controller.signal.throwIfAborted()
    if (this.connected) return
    let resolve!: () => void
    const ready = new Promise<void>((done) => {
      resolve = done
    })
    this.connectionWaiters.add(resolve)
    if (!this.eventController) this.startEvents()
    try {
      await waitForOpenCode(ready, AbortSignal.any([signal, this.controller.signal]))
    } finally {
      this.connectionWaiters.delete(resolve)
    }
  }

  private startEvents(): void {
    const epoch = ++this.eventEpoch
    const controller = new AbortController()
    this.eventController = controller
    const signal = AbortSignal.any([controller.signal, this.controller.signal])
    void (async () => {
      let failure: unknown
      let iterator: AsyncGenerator<unknown> | undefined
      try {
        const result = await this.client.global.event({
          signal,
          sseMaxRetryAttempts: 0,
          onSseError: (error) => {
            failure = error
          }
        })
        iterator = result.stream
        for await (const envelope of result.stream) {
          if (signal.aborted || this.eventEpoch !== epoch) return
          // Global sync envelopes have a different schema; the legacy channel consumes Event only.
          if (!('properties' in envelope.payload)) continue
          const event: Event = envelope.payload
          if (!this.connected && event.type !== 'server.connected')
            throw openCodePreparationError('events', new Error('Missing server handshake'))
          if (event.type === 'server.connected') {
            this.connected = event
            for (const resolve of this.connectionWaiters) resolve()
            this.connectionWaiters.clear()
          }
          const global = event.type === 'server.connected'
          if (event.type === 'server.instance.disposed' && envelope.directory) {
            this.instances.disposed(envelope.directory)
          }
          for (const subscriber of this.subscribers) {
            if (
              !global &&
              (!envelope.directory || !sameNativePath(subscriber.directory, envelope.directory))
            )
              continue
            if (event.type === 'server.instance.disposed') {
              subscriber.error = new Error(
                'OpenCode 프로젝트 연결이 종료되었습니다. 다시 연결해 주세요.'
              )
              subscriber.wake?.()
              subscriber.wake = undefined
            } else this.offer(subscriber, event)
          }
        }
        if (!signal.aborted && this.eventEpoch === epoch)
          this.fail(openCodePreparationError('events', failure))
      } catch (error) {
        if (!signal.aborted && this.eventEpoch === epoch)
          this.fail(openCodePreparationError('events', error))
      } finally {
        await iterator?.return(undefined).catch(() => undefined)
      }
    })()
  }

  private fail(error: Error): void {
    this.server.retire?.()
    this.retire()
    this.close(error)
  }

  async reconcileConnections(): Promise<void> {
    await Promise.all(
      this.instances.values().map(async (scope) => {
        const state = this.directories.get(scope)
        if (!state || scope.controller.signal.aborted) return
        await state.mcpControl?.reconcileChoices()
      })
    )
  }

  close(reason: Error = new Error('OpenCode 연결이 종료되었습니다.')): void {
    if (this.controller.signal.aborted) return
    this.controller.abort(reason)
    this.eventController?.abort()
    this.instances.close(reason)
    this.connectionWaiters.clear()
    for (const subscriber of this.subscribers) {
      subscriber.error = reason
      subscriber.wake?.()
      subscriber.wake = undefined
    }
    this.releaseDependencies()
  }
}

/** Scope is an owned server's URL and secret fingerprint, never a user-wide singleton. */
export class OpenCodeSessionContexts {
  private readonly entries = new Map<string, ServerContext>()
  private readonly owned = new Set<ServerContext>()
  private readonly idleBudget = new OpenCodeIdleBudget()
  private closed = false
  private idle: (cwd: string, beforeSubmit: boolean) => boolean = () => true
  configureResourceActivity(idle: typeof this.idle): void {
    this.idle = idle
  }
  async reconcileConnections(): Promise<void> {
    await Promise.all([...this.owned].map((context) => context.reconcileConnections()))
  }

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly queueLimit = 4096,
    private readonly extensionControl?: ExtensionControl,
    private readonly idleRetentionMs?: number,
    private readonly cleanupFailed?: () => void
  ) {}

  async acquire(
    server: ServerIdentity,
    directory: string,
    releaseDependencies: () => void = () => undefined,
    managed?: ManagedConnectionChoices,
    discoveryKey?: string
  ): Promise<OpenCodeClientLease> {
    if (this.closed) throw new Error('OpenCode 연결 관리자가 종료되었습니다.')
    const key = `${server.url}:${harnessEnvFingerprint(server.headers)}`
    let state = this.entries.get(key)
    if (!state) {
      const created = new ServerContext(
        server,
        this.fetchImpl,
        () => {
          if (this.entries.get(key) === created) this.entries.delete(key)
        },
        this.queueLimit,
        this.extensionControl,
        this.idleBudget,
        () => this.finish(key, created),
        () => {
          this.owned.delete(created)
          releaseDependencies()
        },
        this.idleRetentionMs,
        this.cleanupFailed,
        managed,
        (cwd, beforeSubmit) => this.idle(cwd, beforeSubmit)
      )
      this.entries.set(key, created)
      this.owned.add(created)
      state = created
    } else releaseDependencies()
    const owned = state
    owned.references++
    const finish = (): void => {
      owned.references--
      this.finish(key, owned)
    }
    let scope: OpenCodeInstance
    try {
      scope = await owned.instances.acquire(directory)
      scope.controller.signal.throwIfAborted()
    } catch (error) {
      finish()
      throw error
    }
    const metadata = owned.directory(scope)
    if (discoveryKey && !metadata.discoveryHeld) {
      metadata.discoveryHeld = true
      const releaseDiscovery = openCodeDiscovery.hold(discoveryKey, () => {
        server.retire?.()
        if (this.entries.get(key) === owned) this.entries.delete(key)
        owned.instances.retire()
      })
      scope.controller.signal.addEventListener('abort', releaseDiscovery, { once: true })
    }
    const caller = new AbortController()
    const combined = (signal: AbortSignal): AbortSignal => AbortSignal.any([signal, caller.signal])
    let releasing: Promise<void> | undefined
    return {
      activate: () => metadata.mcpControl?.activate(),
      mcpControl: metadata.mcpControl,
      signal: combined(metadata.composer.signal),
      generation: metadata.composer.generation,
      client: metadata.callerClient(caller.signal),
      prepare: (signal) => owned.prepare(scope.directory, metadata, combined(signal)),
      commands: (signal) => owned.commands(scope.directory, metadata, combined(signal)),
      composer: (signal, refresh) => owned.composer(metadata, combined(signal), refresh),
      agents: (signal, refresh) => metadata.composer.agents(combined(signal), refresh),
      models: (signal, refresh) => metadata.composer.models(combined(signal), refresh),
      mcp: (signal, refresh) =>
        metadata.mcpControl
          ? metadata.mcpControl.read(combined(signal), refresh)
          : metadata.composer.mcp(combined(signal), refresh),
      plugins: (signal, refresh, env) => metadata.composer.plugins(combined(signal), refresh, env),
      rememberCommands: (commands) => owned.rememberCommands(scope, metadata, commands),
      events: (signal) =>
        owned.events(scope.directory, combined(AbortSignal.any([signal, scope.controller.signal]))),
      release: () => {
        caller.abort(new Error('OpenCode 연결이 종료되었습니다.'))
        releasing ??= owned.instances.release(scope).finally(finish)
        return releasing
      }
    }
  }

  private finish(key: string, owned: ServerContext): void {
    if (owned.references !== 0 || owned.instances.size !== 0) return
    if (this.entries.get(key) === owned) this.entries.delete(key)
    owned.close()
  }

  retireAll(): void {
    this.entries.clear()
    for (const state of this.owned) state.instances.retire()
  }

  close(): void {
    this.closed = true
    for (const state of this.owned) state.close()
    this.entries.clear()
  }
}

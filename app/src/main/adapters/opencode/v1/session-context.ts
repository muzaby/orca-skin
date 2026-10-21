import { createOpencodeClient, type Event, type OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeCommand, NativeComposerCatalog } from '../../../../shared/native-resources'
import { harnessEnvFingerprint } from '../../common/harness-config'
import { openCodeComposerCatalog } from './composer-catalog'
import { openCodePreparationError } from './errors'
import { openCodeNativeCommands } from './native-resources'
import { sameNativePath } from './native-storage'
import { OpenCodeInstances, waitForOpenCode, type OpenCodeInstance } from './instance-lifecycle'

interface ServerIdentity {
  url: string
  headers: Record<string, string>
  retire?: () => void
}

interface DirectoryState {
  client: OpencodeClient
  controller: AbortController
  ready?: Promise<void>
  commands?: NativeCommand[]
  commandFlight?: Promise<NativeCommand[]>
  commandRevision: number
  composer?: NativeComposerCatalog
  composerFlight?: Promise<NativeComposerCatalog>
}

interface Subscriber {
  directory: string
  queue: Event[]
  wake?: () => void
  error?: Error
}

export interface OpenCodeClientLease {
  client: OpencodeClient
  release(): Promise<void>
  events(signal: AbortSignal): AsyncGenerator<Event>
  prepare(signal: AbortSignal): Promise<void>
  commands(signal: AbortSignal): Promise<NativeCommand[]>
  composer(signal: AbortSignal, refresh?: boolean): Promise<NativeComposerCatalog>
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
    private readonly queueLimit: number
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
      retire: () => server.retire?.()
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
      state = {
        client: createOpencodeClient({
          baseUrl: this.server.url,
          headers: this.server.headers,
          directory: scope.directory,
          fetch: fetchScoped,
          throwOnError: true
        }),
        controller: scope.controller,
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
    return this.wait(this.ready(directory, state), state, signal)
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

  composer(
    directory: string,
    state: DirectoryState,
    signal: AbortSignal,
    refresh = false
  ): Promise<NativeComposerCatalog> {
    signal.throwIfAborted()
    this.controller.signal.throwIfAborted()
    state.controller.signal.throwIfAborted()
    if (!refresh && state.composer) return this.wait(Promise.resolve(state.composer), state, signal)
    if (!state.composerFlight) {
      const flight = this.ready(directory, state)
        .then(() =>
          openCodeComposerCatalog(
            state.client,
            directory,
            AbortSignal.any([this.controller.signal, state.controller.signal])
          )
        )
        .then((catalog) => {
          this.controller.signal.throwIfAborted()
          state.controller.signal.throwIfAborted()
          state.composer = catalog
          return catalog
        })
        .finally(() => {
          if (state.composerFlight === flight) state.composerFlight = undefined
        })
      state.composerFlight = flight
    }
    return this.wait(state.composerFlight, state, signal)
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
  }
}

/** Scope is an owned server's URL and secret fingerprint, never a user-wide singleton. */
export class OpenCodeSessionContexts {
  private readonly entries = new Map<string, ServerContext>()
  private closed = false

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly queueLimit = 4096
  ) {}

  async acquire(server: ServerIdentity, directory: string): Promise<OpenCodeClientLease> {
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
        this.queueLimit
      )
      this.entries.set(key, created)
      state = created
    }
    const owned = state
    owned.references++
    const finish = (): void => {
      if (--owned.references !== 0) return
      if (this.entries.get(key) === owned) this.entries.delete(key)
      owned.close()
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
    let releasing: Promise<void> | undefined
    return {
      client: metadata.client,
      prepare: (signal) => owned.prepare(scope.directory, metadata, signal),
      commands: (signal) => owned.commands(scope.directory, metadata, signal),
      composer: (signal, refresh) => owned.composer(scope.directory, metadata, signal, refresh),
      rememberCommands: (commands) => owned.rememberCommands(scope, metadata, commands),
      events: (signal) =>
        owned.events(scope.directory, AbortSignal.any([signal, scope.controller.signal])),
      release: () => {
        releasing ??= owned.instances.release(scope).finally(finish)
        return releasing
      }
    }
  }

  close(): void {
    this.closed = true
    for (const state of this.entries.values()) state.close()
    this.entries.clear()
  }
}

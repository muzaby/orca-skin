import { createOpencodeClient, type Event, type OpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { NativeCommand, NativeComposerCatalog } from '../../../../shared/native-resources'
import { harnessEnvFingerprint } from '../../common/harness-config'
import { openCodeComposerCatalog } from './composer-catalog'
import { openCodePreparationError } from './errors'
import { openCodeNativeCommands } from './native-resources'
import { nativeWorkingDirectory, sameNativePath } from './native-storage'

interface ServerIdentity {
  url: string
  headers: Record<string, string>
}

interface DirectoryState {
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
  release(): void
  events(signal: AbortSignal): AsyncGenerator<Event>
  prepare(signal: AbortSignal): Promise<void>
  commands(signal: AbortSignal): Promise<NativeCommand[]>
  composer(signal: AbortSignal, refresh?: boolean): Promise<NativeComposerCatalog>
  rememberCommands(commands: NativeCommand[]): void
}

/** A caller can leave shared work without cancelling the other owners. */
async function waitFor<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) void task.catch(() => undefined)
  signal.throwIfAborted()
  let onAbort = (): void => undefined
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason)
        signal.addEventListener('abort', onAbort, { once: true })
      })
    ])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

class ServerContext {
  readonly client: OpencodeClient
  references = 0
  private readonly controller = new AbortController()
  private readonly directories = new Map<string, DirectoryState>()
  private readonly subscribers = new Set<Subscriber>()
  private eventController?: AbortController
  private eventEpoch = 0
  private connected?: Event

  constructor(
    server: ServerIdentity,
    fetchImpl: typeof fetch,
    private readonly retire: () => void,
    private readonly queueLimit: number
  ) {
    this.client = createOpencodeClient({
      baseUrl: server.url,
      headers: server.headers,
      fetch: fetchImpl,
      throwOnError: true
    })
  }

  directory(path: string): DirectoryState {
    const key = nativeWorkingDirectory(path)
    let state = this.directories.get(key)
    if (!state) {
      state = { controller: new AbortController(), commandRevision: 0 }
      this.directories.set(key, state)
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
    return waitFor(task, AbortSignal.any([signal, this.controller.signal, state.controller.signal]))
  }

  private ready(directory: string, state: DirectoryState): Promise<void> {
    this.controller.signal.throwIfAborted()
    state.controller.signal.throwIfAborted()
    state.ready ??= this.client.config
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
          openCodeNativeCommands(this.client, directory, false, undefined, {
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
            this.client,
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

  rememberCommands(directory: string, state: DirectoryState, commands: NativeCommand[]): void {
    if (
      this.controller.signal.aborted ||
      state.controller.signal.aborted ||
      this.directories.get(nativeWorkingDirectory(directory)) !== state
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
      if (!this.subscribers.size) {
        this.eventEpoch++
        this.eventController?.abort()
        this.eventController = undefined
        this.connected = undefined
      }
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
          if (event.type === 'server.connected') this.connected = event
          const global = event.type === 'server.connected'
          if (event.type === 'server.instance.disposed' && envelope.directory) {
            for (const [key, state] of this.directories) {
              if (!sameNativePath(key, envelope.directory)) continue
              state.controller.abort(
                new Error('OpenCode 프로젝트 연결이 종료되었습니다. 다시 연결해 주세요.')
              )
              this.directories.delete(key)
            }
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
    this.retire()
    this.close(error)
  }

  close(reason: Error = new Error('OpenCode 연결이 종료되었습니다.')): void {
    if (this.controller.signal.aborted) return
    this.controller.abort(reason)
    this.eventController?.abort()
    this.directories.clear()
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

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly queueLimit = 4096
  ) {}

  acquire(server: ServerIdentity, directory: string): OpenCodeClientLease {
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
    const scope = owned.directory(directory)
    owned.references++
    let released = false
    return {
      client: owned.client,
      prepare: (signal) => owned.prepare(directory, scope, signal),
      commands: (signal) => owned.commands(directory, scope, signal),
      composer: (signal, refresh) => owned.composer(directory, scope, signal, refresh),
      rememberCommands: (commands) => owned.rememberCommands(directory, scope, commands),
      events: (signal) => owned.events(directory, signal),
      release: () => {
        if (released) return
        released = true
        if (--owned.references !== 0) return
        if (this.entries.get(key) === owned) this.entries.delete(key)
        owned.close()
      }
    }
  }

  close(): void {
    for (const state of this.entries.values()) state.close()
    this.entries.clear()
  }
}

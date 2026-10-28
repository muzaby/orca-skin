import { nativeWorkingDirectory } from './native-storage'
import { randomUUID } from 'node:crypto'
import { openCodeRetention } from './retention-policy'
import { retentionTrace } from './retention-trace'

export interface OpenCodeInstance {
  id: string
  lifecycle:
    | { state: 'active' }
    | { state: 'idle'; deadline: number; timer: ReturnType<typeof setTimeout> }
    | { state: 'disposing' }
    | { state: 'disposed' }
  directory: string
  controller: AbortController
  references: number
  touched: boolean
  disposed: boolean
  closing?: Promise<void>
  complete?: () => void
}

/** Shared across every server profile in one adapter; active and closing scopes never enter. */
export class OpenCodeIdleBudget {
  private readonly entries = new Map<OpenCodeInstance, () => void>()
  constructor(private readonly maximum = openCodeRetention.maxIdleInstances) {}
  remove(scope: OpenCodeInstance): void {
    this.entries.delete(scope)
  }
  add(scope: OpenCodeInstance, evict: () => void): void {
    this.entries.delete(scope)
    this.entries.set(scope, evict)
    while (this.entries.size > this.maximum) {
      const [oldest, dispose] = this.entries.entries().next().value!
      this.entries.delete(oldest)
      dispose()
    }
  }
}

/** Leaving shared work cancels this waiter, not the other owners. */
export async function waitForOpenCode<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
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

function key(directory: string): string {
  const value = nativeWorkingDirectory(directory)
  return process.platform === 'win32' ? value.toLowerCase() : value
}

export class OpenCodeInstances {
  private readonly entries = new Map<string, OpenCodeInstance>()
  private readonly shutdown = new AbortController()
  private retired = false

  constructor(
    private readonly deps: {
      connect(signal: AbortSignal): Promise<void>
      dispose(directory: string, signal: AbortSignal): Promise<void>
      retire(): void
      timeoutMs?: number
      idleRetentionMs?: number
      idleBudget?: OpenCodeIdleBudget
      settled?(): void
      cleanupFailed?(): void
    }
  ) {
    this.idleBudget = deps.idleBudget ?? new OpenCodeIdleBudget()
  }

  get size(): number {
    return this.entries.size
  }
  values(): OpenCodeInstance[] {
    return [...this.entries.values()]
  }
  private readonly idleBudget: OpenCodeIdleBudget

  async acquire(directory: string): Promise<OpenCodeInstance> {
    const id = key(directory)
    // Re-check after every await: concurrent waiters may already own the replacement.
    for (;;) {
      this.shutdown.signal.throwIfAborted()
      if (this.retired) throw new Error('OpenCode 서버 연결을 다시 시작해 주세요.')
      const current = this.entries.get(id)
      if (current?.closing) {
        await current.closing
        continue
      }
      const state = current ?? {
        id: randomUUID(),
        lifecycle: { state: 'active' as const },
        directory: nativeWorkingDirectory(directory),
        controller: new AbortController(),
        references: 0,
        touched: false,
        disposed: false
      }
      this.cancelIdle(state)
      state.lifecycle = { state: 'active' }
      state.references++
      this.entries.set(id, state)
      retentionTrace('instance.attach', { instance: state.id, count: state.references })
      return state
    }
  }

  active(state: OpenCodeInstance): boolean {
    return this.entries.get(key(state.directory)) === state && !state.controller.signal.aborted
  }

  release(state: OpenCodeInstance): Promise<void> {
    if (--state.references > 0) return Promise.resolve()
    if (state.disposed || this.shutdown.signal.aborted) {
      this.remove(state)
      return Promise.resolve()
    }
    const delay = this.deps.idleRetentionMs ?? openCodeRetention.idleRetentionMs
    if (delay === 0) return this.dispose(state)
    if (this.retired) {
      this.disposeLater(state)
      return Promise.resolve()
    }
    const timer = setTimeout(() => this.disposeLater(state), delay)
    timer.unref?.()
    state.lifecycle = { state: 'idle', deadline: Date.now() + delay, timer }
    retentionTrace('instance.idle', { instance: state.id })
    this.idleBudget.add(state, () => this.disposeLater(state))
    return Promise.resolve()
  }

  private cancelIdle(state: OpenCodeInstance): void {
    this.idleBudget.remove(state)
    if (state.lifecycle.state === 'idle') clearTimeout(state.lifecycle.timer)
  }

  private disposeLater(state: OpenCodeInstance): void {
    void this.dispose(state).catch(() => this.deps.cleanupFailed?.())
  }

  retire(): void {
    this.retired = true
    for (const state of this.entries.values())
      if (state.lifecycle.state === 'idle') this.disposeLater(state)
  }

  private dispose(state: OpenCodeInstance): Promise<void> {
    if (state.closing) return state.closing
    this.cancelIdle(state)
    state.lifecycle = { state: 'disposing' }
    retentionTrace('instance.dispose', { instance: state.id })
    state.controller.abort(new Error('OpenCode 프로젝트 연결이 종료되었습니다.'))
    if (state.disposed || !state.touched || this.shutdown.signal.aborted) {
      this.remove(state)
      return Promise.resolve()
    }
    const completion = new Promise<void>((resolve) => {
      state.complete = resolve
    })
    const deadline = new AbortController()
    const timer = setTimeout(
      () => deadline.abort(new Error('OpenCode 프로젝트 정리 시간 초과')),
      this.deps.timeoutMs ?? 30_000
    )
    timer.unref()
    const signal = AbortSignal.any([this.shutdown.signal, deadline.signal])
    state.closing = (async () => {
      try {
        await waitForOpenCode(this.deps.connect(signal), signal)
        // HTTP acknowledgement precedes plugin/MCP finalizers. Keep the server until the event.
        await waitForOpenCode(this.deps.dispose(state.directory, signal), signal)
        retentionTrace('instance.ack', { instance: state.id })
        await waitForOpenCode(completion, signal)
      } catch {
        if (!this.shutdown.signal.aborted && !this.retired) {
          this.retired = true
          this.deps.retire()
        }
        throw new Error(
          'OpenCode 프로젝트 정리를 완료하지 못했습니다. 새 연결로 다시 시작해 주세요.'
        )
      } finally {
        clearTimeout(timer)
        state.complete = undefined
        this.remove(state)
      }
    })()
    return state.closing
  }

  disposed(directory: string): void {
    const state = this.entries.get(key(directory))
    if (!state) return
    state.disposed = true
    retentionTrace('instance.event', { instance: state.id })
    state.controller.abort(
      new Error('OpenCode 프로젝트 연결이 종료되었습니다. 다시 연결해 주세요.')
    )
    state.complete?.()
    if (!state.closing) this.remove(state)
  }

  private remove(state: OpenCodeInstance): void {
    this.cancelIdle(state)
    state.lifecycle = { state: 'disposed' }
    const id = key(state.directory)
    if (this.entries.get(id) === state) this.entries.delete(id)
    this.deps.settled?.()
  }

  close(reason: Error): void {
    this.shutdown.abort(reason)
    for (const state of this.entries.values()) {
      this.cancelIdle(state)
      state.controller.abort(reason)
      state.lifecycle = { state: 'disposed' }
    }
    this.entries.clear()
  }
}

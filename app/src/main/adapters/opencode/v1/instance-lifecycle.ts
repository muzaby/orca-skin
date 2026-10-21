import { nativeWorkingDirectory } from './native-storage'

export interface OpenCodeInstance {
  directory: string
  controller: AbortController
  references: number
  touched: boolean
  disposed: boolean
  closing?: Promise<void>
  complete?: () => void
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
    }
  ) {}

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
        directory: nativeWorkingDirectory(directory),
        controller: new AbortController(),
        references: 0,
        touched: false,
        disposed: false
      }
      state.references++
      this.entries.set(id, state)
      return state
    }
  }

  active(state: OpenCodeInstance): boolean {
    return this.entries.get(key(state.directory)) === state && !state.controller.signal.aborted
  }

  release(state: OpenCodeInstance): Promise<void> {
    if (--state.references > 0) return Promise.resolve()
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
    state.controller.abort(
      new Error('OpenCode 프로젝트 연결이 종료되었습니다. 다시 연결해 주세요.')
    )
    state.complete?.()
    if (!state.closing) this.remove(state)
  }

  private remove(state: OpenCodeInstance): void {
    const id = key(state.directory)
    if (this.entries.get(id) === state) this.entries.delete(id)
  }

  close(reason: Error): void {
    this.shutdown.abort(reason)
    for (const state of this.entries.values()) state.controller.abort(reason)
    this.entries.clear()
  }
}

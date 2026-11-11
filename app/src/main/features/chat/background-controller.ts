import { randomUUID } from 'node:crypto'
import {
  applyBackgroundEvent,
  backgroundKey,
  canPromoteBackgroundCall,
  emptyBackgroundState,
  isBackgroundTerminal,
  sanitizedBackgroundState,
  type BackgroundEvent,
  type ProviderMessageEvent,
  type BackgroundTaskRequest,
  type PromoteBackgroundTaskRequest,
  type BackgroundSessionState,
  type BackgroundEventSource
} from '../../../shared/background-task'
import type { BackgroundTaskTracker } from './background-tasks'

const RUNTIME_RESPONSE_TIMEOUT_MS = 15_000

class BackgroundTimeoutError extends Error {}

async function withTimeout<T>(pending: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new BackgroundTimeoutError(message)),
          RUNTIME_RESPONSE_TIMEOUT_MS
        )
        timer.unref?.()
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

interface BackgroundRuntime {
  identity?: object
  generation?: string
  stopTask(taskId: string): Promise<void>
  backgroundTask?(toolUseId: string): Promise<boolean>
}
interface Dependencies {
  tracker: BackgroundTaskTracker
  persist(event: BackgroundEvent | ProviderMessageEvent, committed: () => void): void
  load(sessionId: string): BackgroundEvent[]
  publish(event: BackgroundEvent): void
  runtime(sessionId: string): BackgroundRuntime | undefined
}

export class BackgroundController {
  private sequence = 0
  private readonly disposed = new Set<string>()
  private readonly promoting = new Set<string>()
  private readonly stopTimers = new Map<string, ReturnType<typeof setTimeout>>()
  constructor(private readonly deps: Dependencies) {}

  state(sessionId: string): BackgroundSessionState {
    if (!this.deps.tracker.hasCanonical(sessionId)) {
      const events = this.deps.load(sessionId)
      if (events.length) {
        let state = emptyBackgroundState()
        for (const event of events)
          state = applyBackgroundEvent(state, {
            ...event,
            source: { ...event.source, replay: true }
          })
        this.deps.tracker.restore(sessionId, state)
      }
    }
    return sanitizedBackgroundState(this.deps.tracker.getState(sessionId))
  }

  observe(event: BackgroundEvent | ProviderMessageEvent): void {
    if (this.disposed.has(event.sessionId)) return
    this.state(event.sessionId)
    this.deps.persist(event, () => {
      if (event.type === 'provider.message') return
      this.deps.tracker.observe(event)
      try {
        this.deps.publish(event)
      } catch {
        /* a closed renderer cannot invalidate a committed event */
      }
    })
  }

  private source(generation: string): BackgroundEventSource {
    return {
      generation,
      sequence: ++this.sequence,
      receivedAt: Date.now(),
      replay: false,
      uuid: `host:${randomUUID()}`
    }
  }

  private runtimeFor(req: BackgroundTaskRequest): BackgroundRuntime {
    const state = this.state(req.sessionId)
    const runtime = this.deps.runtime(req.sessionId)
    if (
      state.generation !== req.generation ||
      state.connection !== 'connected' ||
      !runtime ||
      runtime.generation !== req.generation
    )
      throw new Error('background-task: current connection is unavailable')
    if (!state.tasks[backgroundKey(req.generation, req.taskId)])
      throw new Error('background-task: unknown task')
    return runtime
  }

  async stop(req: BackgroundTaskRequest): Promise<void> {
    const runtime = this.runtimeFor(req)
    const emit = (
      state: 'requested' | 'acknowledged' | 'failed' | 'unconfirmed',
      error?: string
    ): void =>
      this.observe({
        type: 'background.control',
        ...req,
        source: this.source(req.generation),
        state,
        ...(error ? { error } : {})
      })
    emit('requested')
    try {
      await withTimeout(runtime.stopTask(req.taskId), '중단 요청의 응답을 확인하지 못했습니다.')
      emit('acknowledged')
      const key = JSON.stringify([req.sessionId, req.generation, req.taskId])
      clearTimeout(this.stopTimers.get(key))
      const timer = setTimeout(() => {
        this.stopTimers.delete(key)
        const task = this.state(req.sessionId).tasks[backgroundKey(req.generation, req.taskId)]
        if (
          !this.disposed.has(req.sessionId) &&
          task &&
          !isBackgroundTerminal(task.status) &&
          task.stop?.state === 'acknowledged'
        )
          emit('unconfirmed')
      }, 15_000)
      timer.unref?.()
      this.stopTimers.set(key, timer)
    } catch (error) {
      const timedOut = error instanceof BackgroundTimeoutError
      emit(
        timedOut ? 'unconfirmed' : 'failed',
        timedOut ? error.message : '중단 요청에 실패했습니다.'
      )
      throw error
    }
  }

  async promote(req: PromoteBackgroundTaskRequest): Promise<void> {
    if (!req.toolUseId?.trim()) throw new Error('전환할 실행을 확인하지 못했습니다.')
    const key = JSON.stringify([req.sessionId, req.generation, req.toolUseId])
    if (this.promoting.has(key)) throw new Error('이미 백그라운드 전환을 요청했습니다.')
    const state = this.state(req.sessionId)
    const call = state.calls[backgroundKey(req.generation, req.toolUseId)]
    const runtime = this.deps.runtime(req.sessionId)
    if (
      this.disposed.has(req.sessionId) ||
      state.generation !== req.generation ||
      state.connection !== 'connected' ||
      !runtime?.backgroundTask ||
      runtime.generation !== req.generation ||
      !call ||
      !canPromoteBackgroundCall(state, call)
    )
      throw new Error('현재 실행을 백그라운드로 전환할 수 없습니다.')

    this.promoting.add(key)
    try {
      const backgrounded = await withTimeout(
        runtime.backgroundTask(req.toolUseId),
        '백그라운드 전환 응답을 확인하지 못했습니다. 다시 시도해 주세요.'
      )
      const currentRuntime = this.deps.runtime(req.sessionId)
      const current = this.state(req.sessionId)
      if (
        this.disposed.has(req.sessionId) ||
        !currentRuntime ||
        (currentRuntime.identity ?? currentRuntime) !== (runtime.identity ?? runtime) ||
        currentRuntime.generation !== req.generation ||
        current.generation !== req.generation ||
        current.connection !== 'connected'
      )
        throw new Error('실행 연결이 변경되어 전환 결과를 적용하지 않았습니다.')
      if (!backgrounded)
        throw new Error('실행을 전환하지 못했습니다. 상태를 확인하고 다시 시도해 주세요.')
      const currentCall = current.calls[backgroundKey(req.generation, req.toolUseId)]
      if (!currentCall) throw new Error('전환한 실행을 확인하지 못했습니다.')
      this.observe({
        type: 'background.call',
        sessionId: req.sessionId,
        source: this.source(req.generation),
        toolUseId: req.toolUseId,
        phase: currentCall.phase,
        patch: { mode: 'background' }
      })
    } finally {
      this.promoting.delete(key)
    }
  }

  dispose(sessionId: string): void {
    this.disposed.add(sessionId)
    for (const [key, timer] of this.stopTimers)
      if (JSON.parse(key)[0] === sessionId) {
        clearTimeout(timer)
        this.stopTimers.delete(key)
      }
  }
}

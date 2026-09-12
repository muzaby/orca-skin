import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
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
  type ReadBackgroundOutputRequest,
  type ReadBackgroundOutputResponse,
  type StopAllBackgroundTasksResult,
  type BackgroundTaskRecord,
  type BackgroundOutputRef,
  type BackgroundEventSource
} from '../../../shared/background-task'
import type { BackgroundOutputStore } from '../../infra/background-output'
import type { BackgroundTaskTracker } from './background-tasks'

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
  roots(sessionId: string): string[]
  outputs: Pick<BackgroundOutputStore, 'read' | 'capture' | 'readSnapshot'> &
    Partial<Pick<BackgroundOutputStore, 'removeSnapshot'>>
}

export class BackgroundController {
  private sequence = 0
  private readonly stoppingAll = new Set<string>()
  private readonly captures = new Set<string>()
  private readonly disposed = new Set<string>()
  private readonly promoting = new Set<string>()
  private readonly stopTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly snapshotVersions = new Map<string, number>()
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
      if (event.type === 'background.snapshot' && !event.source.replay) {
        const key = JSON.stringify([event.sessionId, event.source.generation])
        this.snapshotVersions.set(key, (this.snapshotVersions.get(key) ?? 0) + 1)
      }
      this.deps.tracker.observe(event)
      try {
        this.deps.publish(event)
      } catch {
        /* a closed renderer cannot invalidate a committed event */
      }
      if (event.type === 'background.task' || event.type === 'background.call')
        this.captureCompleted(event.sessionId)
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

  private snapshotVersion(sessionId: string, generation: string): number {
    return this.snapshotVersions.get(JSON.stringify([sessionId, generation])) ?? 0
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
    let requestTimer: ReturnType<typeof setTimeout> | undefined
    let requestTimedOut = false
    try {
      await Promise.race([
        runtime.stopTask(req.taskId),
        new Promise<never>((_resolve, reject) => {
          requestTimer = setTimeout(() => {
            requestTimedOut = true
            reject(new Error('중단 요청의 응답을 확인하지 못했습니다.'))
          }, 15_000)
          requestTimer.unref?.()
        })
      ])
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
          this.observe({
            type: 'background.control',
            ...req,
            source: this.source(req.generation),
            state: 'unconfirmed'
          })
      }, 15_000)
      timer.unref?.()
      this.stopTimers.set(key, timer)
    } catch (error) {
      emit(
        requestTimedOut ? 'unconfirmed' : 'failed',
        requestTimedOut ? '중단 요청의 응답을 확인하지 못했습니다.' : '중단 요청에 실패했습니다.'
      )
      throw error
    } finally {
      clearTimeout(requestTimer)
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
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const backgrounded = await Promise.race([
        runtime.backgroundTask(req.toolUseId),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error('백그라운드 전환 응답을 확인하지 못했습니다. 다시 시도해 주세요.')),
            15_000
          )
          timer.unref?.()
        })
      ])
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
      clearTimeout(timer)
      this.promoting.delete(key)
    }
  }

  isStoppingAll(sessionId: string): boolean {
    return this.stoppingAll.has(sessionId)
  }

  dispose(sessionId: string): void {
    const state = this.state(sessionId)
    this.disposed.add(sessionId)
    for (const [key, timer] of this.stopTimers)
      if (JSON.parse(key)[0] === sessionId) {
        clearTimeout(timer)
        this.stopTimers.delete(key)
      }
    for (const task of Object.values(state.tasks)) {
      for (const snapshot of Object.values(task.outputSnapshots))
        void this.deps.outputs.removeSnapshot?.(snapshot.id)
    }
  }

  async stopAll(req: {
    sessionId: string
    generation: string
  }): Promise<StopAllBackgroundTasksResult> {
    if (this.stoppingAll.has(req.sessionId))
      throw new Error('background-task: stop all already in progress')
    this.stoppingAll.add(req.sessionId)
    try {
      const requested = new Set<string>()
      const initialSnapshot = this.snapshotVersion(req.sessionId, req.generation)
      const pendingLaunch = (state: BackgroundSessionState): boolean =>
        Object.values(state.calls).some(
          (call) => call.generation === req.generation && call.awaitingTask
        )
      for (let attempt = 0; attempt < 3; attempt++) {
        const state = this.state(req.sessionId)
        if (
          state.generation !== req.generation ||
          !state.liveKnown ||
          state.connection !== 'connected'
        )
          return { residualTaskIds: state.liveTaskIds, unknown: true }
        const ids = state.liveTaskIds.filter(
          (id) => !isBackgroundTerminal(state.tasks[backgroundKey(req.generation, id)]?.status)
        )
        if (
          !ids.length &&
          !pendingLaunch(state) &&
          this.snapshotVersion(req.sessionId, req.generation) > initialSnapshot
        )
          return { residualTaskIds: [], unknown: false }
        await Promise.all(
          ids
            .filter((id) => !requested.has(id))
            .map(async (taskId) => {
              requested.add(taskId)
              try {
                await this.stop({ ...req, taskId })
              } catch {
                /* each task records its own failure */
              }
            })
        )
        const before = this.snapshotVersion(req.sessionId, req.generation)
        await new Promise<void>((resolve) => {
          const finish = (): void => {
            clearTimeout(timer)
            unsubscribe()
            resolve()
          }
          const unsubscribe = this.deps.tracker.subscribe((sid) => {
            if (sid === req.sessionId && this.snapshotVersion(sid, req.generation) > before)
              finish()
          })
          const timer = setTimeout(finish, 2000)
        })
      }
      const state = this.state(req.sessionId)
      const residualTaskIds = state.liveTaskIds.filter(
        (id) => !isBackgroundTerminal(state.tasks[backgroundKey(req.generation, id)]?.status)
      )
      for (const taskId of residualTaskIds)
        this.observe({
          type: 'background.control',
          ...req,
          taskId,
          source: this.source(req.generation),
          state: 'unconfirmed'
        })
      return {
        residualTaskIds,
        unknown:
          !state.liveKnown ||
          state.connection !== 'connected' ||
          state.generation !== req.generation ||
          pendingLaunch(state) ||
          this.snapshotVersion(req.sessionId, req.generation) === initialSnapshot
      }
    } finally {
      this.stoppingAll.delete(req.sessionId)
    }
  }

  async read(req: ReadBackgroundOutputRequest): Promise<ReadBackgroundOutputResponse> {
    const state = this.state(req.sessionId)
    const task = state.tasks[backgroundKey(req.generation, req.taskId)]
    const ref = task?.outputRefs?.find((item) => item.id === req.outputId)
    const denied = {
      status: 'denied' as const,
      offset: req.offset,
      nextOffset: req.offset,
      view: req.view ?? ('current' as const)
    }
    if (!task || !ref || this.outputDenied(state, task, ref)) return denied
    if (req.view === 'snapshot') {
      const snapshot = task.outputSnapshots[req.outputId]
      if (!snapshot) return { ...denied, status: 'missing' }
      return this.deps.outputs.readSnapshot(snapshot, req)
    }
    return this.deps.outputs.read(ref, this.deps.roots(req.sessionId), req)
  }

  private captureCompleted(sessionId: string): void {
    const state = this.state(sessionId)
    for (const task of Object.values(state.tasks)) {
      if (task.generation !== state.generation || !isBackgroundTerminal(task.status)) continue
      for (const ref of task.outputRefs ?? []) {
        if (
          ref.kind !== 'file' ||
          this.outputDenied(state, task, ref) ||
          task.outputSnapshots[ref.id]
        )
          continue
        const key = JSON.stringify([sessionId, task.generation, task.taskId, ref.id])
        if (this.captures.has(key)) continue
        this.captures.add(key)
        const base = {
          type: 'background.output' as const,
          sessionId,
          taskId: task.taskId,
          outputId: ref.id
        }
        void this.deps.outputs
          .capture(ref, this.deps.roots(sessionId))
          .then(
            (snapshot) => {
              if (this.disposed.has(sessionId)) {
                void this.deps.outputs.removeSnapshot?.(snapshot.id)
                return
              }
              try {
                this.observe({ ...base, source: this.source(task.generation), snapshot })
              } catch {
                void this.deps.outputs.removeSnapshot?.(snapshot.id)
                const error: BackgroundEvent = {
                  ...base,
                  source: this.source(task.generation),
                  error: '출력 보존 기록을 저장하지 못했습니다.'
                }
                this.deps.tracker.observe(error)
                try {
                  this.deps.publish(error)
                } catch {
                  /* best-effort operational failure */
                }
              }
            },
            () => {
              this.observe({
                ...base,
                source: this.source(task.generation),
                error: '출력을 보존하지 못했습니다.'
              })
            }
          )
          .catch(() => {})
          .finally(() => this.captures.delete(key))
      }
    }
  }

  private outputDenied(
    state: BackgroundSessionState,
    task: BackgroundTaskRecord,
    ref: BackgroundOutputRef
  ): boolean {
    if (ref.canRead === false) return true
    const call = task.toolUseId
      ? state.calls[backgroundKey(task.generation, task.toolUseId)]
      : undefined
    if (call?.canReadOutputFile === false) return true
    const normalized = (value: string): string =>
      process.platform === 'win32' ? resolve(value).toLowerCase() : resolve(value)
    const path = normalized(ref.value)
    return [...Object.values(state.calls), ...Object.values(state.tasks)].some(
      (owner) =>
        owner.generation === task.generation &&
        owner.outputRefs?.some(
          (candidate) =>
            candidate.kind === 'file' &&
            candidate.canRead === false &&
            normalized(candidate.value) === path
        )
    )
  }
}

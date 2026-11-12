// 세션별 백그라운드 상태 보관소. 원천은 어댑터가 낸 정본 이벤트(`BackgroundEvent`) 하나이고
// (`observe` — BackgroundController 가 넘긴다), 여기서는 순수 reducer 로 접은 상태를 세션별로
// 들고 선택자와 변경 구독만 제공한다. 이벤트를 해석하거나 종료를 지어내지 않는다.
//
// 정본 이벤트를 한 번도 못 본 세션은 빈 상태다 — 대기 아님 · 개수 0 · isAsyncLaunched false ·
// waitForTask 즉시 `settled`. 계약 정본은 docs/arch/backend/background-tasks.md.

import {
  applyBackgroundEvent,
  backgroundKey,
  backgroundPending,
  countedBackgroundTaskIds,
  emptyBackgroundState,
  isBackgroundTerminal,
  type BackgroundEvent,
  type BackgroundSessionState
} from '../../../shared/background-task'

// coordinator 가 트래커에게 요구하는 표면 — 읽기뿐이다.
export interface BackgroundTaskPort {
  getState(sessionId: string): BackgroundSessionState
  isAsyncLaunched(sessionId: string, toolUseId: string): boolean
}

export class BackgroundTaskTracker implements BackgroundTaskPort {
  private readonly canonical = new Map<string, BackgroundSessionState>()
  private readonly listeners = new Set<(sessionId: string) => void>()

  observe(event: BackgroundEvent): void {
    const previous = this.getState(event.sessionId)
    const next = applyBackgroundEvent(previous, event)
    if (next === previous) return
    this.canonical.set(event.sessionId, next)
    this.changed(event.sessionId)
  }

  restore(sessionId: string, state: BackgroundSessionState): void {
    if (this.canonical.has(sessionId)) return
    this.canonical.set(sessionId, state)
    this.changed(sessionId)
  }

  getState(sessionId: string): BackgroundSessionState {
    return this.canonical.get(sessionId) ?? emptyBackgroundState()
  }

  // 복원 가드 전용(BackgroundController) — 선택자는 정본 유무로 경로를 가르지 않는다.
  hasCanonical(sessionId: string): boolean {
    return this.canonical.has(sessionId)
  }

  subscribe(listener: (sessionId: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // 턴-후 루프의 listen 판정. 표시용 개수(`count`)와 다를 수 있다 — 영수증만 온 호출·중단
  // 확정 대기는 live 집합 밖에서도 대기다.
  hasPending(sessionId: string): boolean {
    return backgroundPending(this.getState(sessionId))
  }

  // 표시용 live 작업 수 — snapshot(레벨 신호)이 세운 현재 집합에서 ambient 를 뺀 것.
  count(sessionId: string): number {
    return countedBackgroundTaskIds(this.getState(sessionId)).length
  }

  // 실제 백그라운드 실행인가 — 현재 세대의 호출 모드, 연결된 작업의 `isBackgrounded`·live 포함
  // 중 하나로 답한다. 중단 분기(backgroundTask 선행 생략)와 완료 통지 표식이 읽는다.
  isAsyncLaunched(sessionId: string, toolUseId: string): boolean {
    const state = this.getState(sessionId)
    if (!state.generation) return false
    const call = state.calls[backgroundKey(state.generation, toolUseId)]
    const task = call?.taskId
      ? state.tasks[backgroundKey(state.generation, call.taskId)]
      : undefined
    return (
      call?.mode === 'background' ||
      task?.isBackgrounded === true ||
      task?.liveMembership === 'included'
    )
  }

  // 특정 작업의 **종료 통지를 기다린다**(0204 D-011). 종료는 정본 `background.task` 의 terminal
  // status 로만 안다 — 주기적 polling 을 쓰지 않는다. 채널이 죽어도 종료를 지어내지 않으므로
  // 그때는 `timeout` 이고, 상한은 호출부가 소유한다(반드시 준다).
  //
  // 정본이 없는 세션은 기다릴 대상이 없어 즉시 `settled` 다.
  waitForTask(
    sessionId: string,
    toolUseId: string,
    opts: { timeoutMs: number }
  ): Promise<'settled' | 'timeout'> {
    const completed = (): boolean => {
      const state = this.canonical.get(sessionId)
      if (!state) return true
      const record = Object.values(state.tasks).find(
        (task) => task.generation === state.generation && task.toolUseId === toolUseId
      )
      return record !== undefined && isBackgroundTerminal(record.status)
    }
    if (completed()) return Promise.resolve('settled')
    return new Promise((resolve) => {
      let done = false
      const finish = (outcome: 'settled' | 'timeout'): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        unsubscribe()
        resolve(outcome)
      }
      const unsubscribe = this.subscribe((changed) => {
        if (changed !== sessionId) return
        if (completed()) finish('settled')
      })
      const timer = setTimeout(() => finish('timeout'), opts.timeoutMs)
      // 타이머가 Electron main 종료를 붙잡지 않게 한다(Node 전용 API — 테스트 환경도 동일).
      timer.unref?.()
    })
  }

  dispose(sessionId: string): void {
    this.canonical.delete(sessionId)
    this.changed(sessionId)
  }

  private changed(sessionId: string): void {
    for (const listener of this.listeners) listener(sessionId)
  }
}

// 세션별 미정착 백그라운드 서브에이전트 추적(0136, 0143 기본화) — CLI 2.1.198+ 는 서브에이전트가
// 기본 백그라운드로 돌아(런치 영수증 즉시 반환 + 진짜 종료는 task_notification), 메인 턴 result
// 이후에도 "아직 끝나지 않은 작업" 이 세션에 남는다. chat-turn 의 턴-후 루프가 이 추적을 조회해
// listen 턴(입력 push 없는 프레임 소비)을 열지 판정한다.
//
// 등록/해제는 TurnCoordinator 가 이벤트 루프에서 수행한다: subagent.task started → started,
// subagent.task settled → settled, 부모 Task 의 권위 tool_result(비-런치 영수증) → settled(벨트).
// 에지 신호 유실 대비 정리는 호출자(chat-turn) 소관 — 콜드 spawn 전 clear(스폰 = in-process
// 태스크 소멸), listen 턴이 채널 사망으로 끝나면 합성 정착 후 clear.
//
// asyncLaunched(0143): foreground 태스크도 task_started/settled 를 왕복하므로 membership 은
// background 판별 신호가 아니다 — **런치 영수증 관측**(부모 tool_result)만이 "실제 백그라운드"
// 의 정확한 신호다. stopLiveSubagent 분기·settled background enrich 가 읽는다.
//
// 0230: 영수증은 이제 두 형태다 — 에이전트의 `{status:'async_launched'}` 와 셸의
// `backgroundTaskId`. 판정 SSOT 는 `shared/task-kind.ts` 의 `readLaunchReceipt` 이고 여기는
// 그 결과를 기록만 한다. 셸 영수증을 놓치면 백그라운드 명령이 추적에서 빠져 턴-후 루프가
// 종료를 기다리지 않는다.

import type { TaskKind } from '../../../shared/task-kind'

export interface BackgroundTaskPort {
  started(sessionId: string, toolUseId: string, kind?: TaskKind): void
  settled(sessionId: string, toolUseId: string): void
  markAsyncLaunched(sessionId: string, toolUseId: string): void
  isAsyncLaunched(sessionId: string, toolUseId: string): boolean
  // 0231 — 배지 전용 세기. `count()` 와 의미가 다르다(§10 EP-203).
  launchedCount(sessionId: string): number
  kindOf(sessionId: string, toolUseId: string): TaskKind | undefined
  // 레벨 신호 적용 → 정착시켜야 할 id(0212). 판정만 하고 방출은 호출부가 한다.
  applyLiveSet(sessionId: string, liveIds: readonly string[]): string[]
}

const EMPTY: ReadonlySet<string> = new Set()

interface TaskState {
  // 0230: 이름은 `asyncLaunched` 로 남지만 의미는 **"런치 영수증이 관측됐다"** 로 넓어졌다
  // (D-007). 에이전트의 `async_launched` 와 셸의 `backgroundTaskId` 둘 다 여기로 모인다 —
  // 두 경우 모두 "도구는 반환했고 실행은 아직 돈다" 라는 같은 사실이다.
  asyncLaunched: boolean
  // 표시·정착 분기용. 판정은 이 값에 걸지 않는다 — 추적 규칙은 종류와 무관하다.
  kind?: TaskKind
}

export class BackgroundTaskTracker implements BackgroundTaskPort {
  private readonly bySession = new Map<string, Map<string, TaskState>>()
  private readonly listeners = new Set<(sessionId: string) => void>()
  // 레벨 신호(background_tasks_changed)의 기준선이 세워진 세션(0212 SD-02). 프로세스 단위
  // 레벨이라 **시작 시점에는 아무것도 오지 않는다** — 첫 payload 를 받기 전에는 이 신호로
  // 무엇도 정착시킬 수 없고, 첫 payload 조차 기준선일 뿐이다.
  private readonly levelEstablished = new Set<string>()

  subscribe(listener: (sessionId: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  started(sessionId: string, toolUseId: string, kind?: TaskKind): void {
    let map = this.bySession.get(sessionId)
    if (!map) {
      map = new Map()
      this.bySession.set(sessionId, map)
    }
    // 재started(진행 갱신 경합)에도 기존 asyncLaunched 관측을 보존한다.
    const existing = map.get(toolUseId)
    if (!existing) {
      map.set(toolUseId, { asyncLaunched: false, ...(kind !== undefined ? { kind } : {}) })
      this.changed(sessionId)
      return
    }
    // 종류는 뒤늦게 알 수도 있다(영수증이 시작 이벤트보다 먼저 오는 순서 역전). **덮어쓰지
    // 않고 채우기만 한다** — 이미 아는 종류를 미지정으로 되돌리지 않는다.
    if (kind !== undefined && existing.kind === undefined) existing.kind = kind
  }

  /** 표시·정착 분기가 읽는 종류. 미관측이면 `undefined` — `'unknown'` 으로 채우지 않는다. */
  kindOf(sessionId: string, toolUseId: string): TaskKind | undefined {
    return this.bySession.get(sessionId)?.get(toolUseId)?.kind
  }

  settled(sessionId: string, toolUseId: string): void {
    const map = this.bySession.get(sessionId)
    if (!map) return
    if (!map.delete(toolUseId)) return
    if (map.size === 0) this.bySession.delete(sessionId)
    this.changed(sessionId)
  }

  // 부모 Task tool_result 가 async_launched 런치 영수증으로 도착 — 실제 백그라운드 실행 확정.
  // 미등록 상태(영수증이 task_started 보다 먼저 관찰되는 순서 역전)에도 등록해 기록한다.
  markAsyncLaunched(sessionId: string, toolUseId: string): void {
    let map = this.bySession.get(sessionId)
    if (!map) {
      map = new Map()
      this.bySession.set(sessionId, map)
    }
    const state = map.get(toolUseId)
    if (state) {
      if (state.asyncLaunched) return
      state.asyncLaunched = true
    } else map.set(toolUseId, { asyncLaunched: true })
    this.changed(sessionId)
  }

  isAsyncLaunched(sessionId: string, toolUseId: string): boolean {
    return this.bySession.get(sessionId)?.get(toolUseId)?.asyncLaunched === true
  }

  /**
   * background_tasks_changed 레벨 신호를 적용하고 **정착시켜야 할 toolUseId 를 돌려준다**
   * (0212 §10 EP-07). 정착 방출은 `settle.ts` 가 소유하므로 여기서는 판정만 한다 —
   * 트래커는 electron·버스 비의존을 유지한다.
   *
   * 첫 payload 는 **기준선일 뿐 아무것도 정착시키지 않는다.** 프로세스 단위 레벨이라 이 세션의
   * CLI 가 (재)기동한 직후 살아 있는 태스크가 payload 에 안 실릴 수 있고, 그것을 정착으로 읽으면
   * 시작 직후 멀쩡히 도는 태스크가 죽는다.
   *
   * REPLACE 다 — edge 와 짝지어 읽지 않는다. 반환값은 `추적 중 − payload` 차집합이다.
   */
  applyLiveSet(sessionId: string, liveIds: readonly string[]): string[] {
    const first = !this.levelEstablished.has(sessionId)
    this.levelEstablished.add(sessionId)
    if (first) return []
    const live = new Set(liveIds)
    const map = this.bySession.get(sessionId)
    if (!map) return []
    return [...map.keys()].filter((id) => !live.has(id))
  }

  // CLI 프로세스 (재)기동 경계 — 레벨을 미확립으로 되돌린다(0212 D-012). 그러지 않으면 구
  // 프로세스의 집합이 새 프로세스의 태스크를 죽인다. `clear` 가 이 경계를 이미 지나므로
  // (콜드 spawn 전 정리 · 채널 사망 정착) 거기서도 함께 부른다.
  resetLevel(sessionId: string): void {
    this.levelEstablished.delete(sessionId)
  }

  ids(sessionId: string): ReadonlySet<string> {
    const map = this.bySession.get(sessionId)
    if (!map || map.size === 0) return EMPTY
    return new Set(map.keys())
  }

  // 존재 여부만 필요한 곳(턴-후 루프의 매 반복)이 Set 을 새로 만들지 않게 한다.
  hasAny(sessionId: string): boolean {
    const map = this.bySession.get(sessionId)
    return map !== undefined && map.size > 0
  }

  count(sessionId: string): number {
    return this.bySession.get(sessionId)?.size ?? 0
  }

  /**
   * 배지용 세기(0231 D-104 · §10 EP-203) — **런치 영수증이 관측된 것만** 센다.
   *
   * `count()` 와 **다른 질문에 답한다.** `count()` 는 "세션이 계속 기다려야 하는가" 이고 그 답은
   * foreground 태스크를 포함해야 한다(턴-후 루프가 유일한 소비자다 · `post-turn.ts`). 이것은
   * "사용자에게 백그라운드 N건이라고 말할 수 있는가" 이고 그 답은 영수증을 본 것뿐이다 —
   * 동기 서브에이전트를 백그라운드로 세면 배지가 실행 줄·목록과 갈린다.
   *
   * **`count()` 를 이 의미로 좁히지 않는다.** 좁히면 foreground 태스크가 도는 중에 턴-후 루프가
   * `haveTasks:false` 로 대기를 끊는다(0136 회귀).
   */
  launchedCount(sessionId: string): number {
    const map = this.bySession.get(sessionId)
    if (!map) return 0
    let n = 0
    for (const state of map.values()) if (state.asyncLaunched) n += 1
    return n
  }

  // 특정 태스크가 **정착할 때까지** 기다린다(0204 D-011). 종료 신호는 SDK stream 이 이미 나르는
  // task_notification(completed/failed/stopped)이고, 그 셋은 전부 `settled` 로 수렴한다 —
  // 채널 사망/앱 종료의 합성 정착(`clear`)도 같은 자리를 지난다. 주기적 TaskOutput polling 을
  // 쓰지 않는 이유가 이것이다(명세 §2).
  //
  // 이미 추적에 없으면 즉시 `settled` — 정착이 먼저 관측된 경합에서 영원히 걸리지 않는다.
  // `timeoutMs` 는 밀리초이며 호출부가 상한을 소유한다(미지정 = 무기한 대기 없음: 반드시 준다).
  waitForTask(
    sessionId: string,
    toolUseId: string,
    opts: { timeoutMs: number }
  ): Promise<'settled' | 'timeout'> {
    if (!this.bySession.get(sessionId)?.has(toolUseId)) return Promise.resolve('settled')
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
        if (!this.bySession.get(sessionId)?.has(toolUseId)) finish('settled')
      })
      const timer = setTimeout(() => finish('timeout'), opts.timeoutMs)
      // 타이머가 Electron main 종료를 붙잡지 않게 한다(Node 전용 API — 테스트 환경도 동일).
      timer.unref?.()
    })
  }

  clear(sessionId: string): void {
    this.resetLevel(sessionId)
    if (this.bySession.delete(sessionId)) this.changed(sessionId)
  }

  private changed(sessionId: string): void {
    for (const listener of this.listeners) listener(sessionId)
  }
}

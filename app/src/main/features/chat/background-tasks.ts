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
// background 판별 신호가 아니다 — **async_launched 런치 영수증 관측**(부모 tool_result)만이
// "실제 백그라운드" 의 정확한 신호다. stopLiveSubagent 분기·settled background enrich 가 읽는다.

export interface BackgroundTaskPort {
  started(sessionId: string, toolUseId: string): void
  settled(sessionId: string, toolUseId: string): void
  markAsyncLaunched(sessionId: string, toolUseId: string): void
  isAsyncLaunched(sessionId: string, toolUseId: string): boolean
}

const EMPTY: ReadonlySet<string> = new Set()

interface TaskState {
  asyncLaunched: boolean
}

export class BackgroundTaskTracker implements BackgroundTaskPort {
  private readonly bySession = new Map<string, Map<string, TaskState>>()

  started(sessionId: string, toolUseId: string): void {
    let map = this.bySession.get(sessionId)
    if (!map) {
      map = new Map()
      this.bySession.set(sessionId, map)
    }
    // 재started(진행 갱신 경합)에도 기존 asyncLaunched 관측을 보존한다.
    if (!map.has(toolUseId)) map.set(toolUseId, { asyncLaunched: false })
  }

  settled(sessionId: string, toolUseId: string): void {
    const map = this.bySession.get(sessionId)
    if (!map) return
    map.delete(toolUseId)
    if (map.size === 0) this.bySession.delete(sessionId)
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
    if (state) state.asyncLaunched = true
    else map.set(toolUseId, { asyncLaunched: true })
  }

  isAsyncLaunched(sessionId: string, toolUseId: string): boolean {
    return this.bySession.get(sessionId)?.get(toolUseId)?.asyncLaunched === true
  }

  ids(sessionId: string): ReadonlySet<string> {
    const map = this.bySession.get(sessionId)
    if (!map || map.size === 0) return EMPTY
    return new Set(map.keys())
  }

  clear(sessionId: string): void {
    this.bySession.delete(sessionId)
  }
}

// 값이 백그라운드 런치 영수증({status:'async_launched', …})인지 — claude-map(0136)이 구조화
// tool_use_result 를 result 로 실은 경우를 코디네이터가 판별한다(권위 결과와 구분해 추적 해제를
// 미룸). renderer 의 isAsyncLaunchedResult(parts.ts)와 동형 — 레이어가 달라 각자 소유한다.
export function isAsyncLaunchResult(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { status?: unknown }).status === 'async_launched'
  )
}

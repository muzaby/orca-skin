// 세션별 미정착 백그라운드 서브에이전트 추적(0136) — CLI 2.1.198+ 는 서브에이전트가 백그라운드로
// 돌 수 있어(런치 영수증 즉시 반환 + 진짜 종료는 task_notification), 메인 턴 result 이후에도
// "아직 끝나지 않은 작업" 이 세션에 남는다. chat-turn 의 턴-후 루프가 이 추적을 조회해 listen 턴
// (입력 push 없는 프레임 소비)을 열지 판정한다.
//
// 등록/해제는 TurnCoordinator 가 이벤트 루프에서 수행한다: subagent.task started → started,
// subagent.task settled → settled, 부모 Task 의 권위 tool_result(비-런치 영수증) → settled(벨트).
// 에지 신호 유실 대비 정리는 호출자(chat-turn) 소관 — 콜드 spawn 전 clear(스폰 = in-process
// 태스크 소멸), listen 턴이 채널 사망으로 끝나면 합성 정착 후 clear.

export interface BackgroundTaskPort {
  started(sessionId: string, toolUseId: string): void
  settled(sessionId: string, toolUseId: string): void
}

const EMPTY: ReadonlySet<string> = new Set()

export class BackgroundTaskTracker implements BackgroundTaskPort {
  private readonly bySession = new Map<string, Set<string>>()

  started(sessionId: string, toolUseId: string): void {
    let set = this.bySession.get(sessionId)
    if (!set) {
      set = new Set()
      this.bySession.set(sessionId, set)
    }
    set.add(toolUseId)
  }

  settled(sessionId: string, toolUseId: string): void {
    const set = this.bySession.get(sessionId)
    if (!set) return
    set.delete(toolUseId)
    if (set.size === 0) this.bySession.delete(sessionId)
  }

  ids(sessionId: string): ReadonlySet<string> {
    return this.bySession.get(sessionId) ?? EMPTY
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

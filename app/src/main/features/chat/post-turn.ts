// 턴-후 연속 루프의 다음 스텝 판정(0143, 순수) — chat-turn 의 while 루프가 매 반복 호출한다.
// 핵심 불변식: **pushTurn(held flush)은 "CLI 메인 루프 유휴 + unframed 백로그 없음" 채널에서만**.
// CLI 가 자동(알림) 턴을 진행 중이거나 프레임 밖 적체가 남아 있으면 listen 드레인을 먼저 돌려
// 그 턴의 terminal/이벤트가 다음(steer) 프레임에 오귀속되는 것(steer 세션 사망 — 0143 버그 a)을
// 구조적으로 차단한다.
export type PostTurnStep = 'listen' | 'flush' | 'break'

export interface PostTurnState {
  // held pending(steer 예약) 잔여 존재
  havePending: boolean
  // 미정착 백그라운드 서브에이전트 존재(BackgroundTaskTracker)
  haveTasks: boolean
  // 장수명 채널 생존(SessionRuntime.channelAlive)
  channelAlive: boolean
  // CLI 메인 루프 mid-turn(SessionRuntime.channelBusy — 백그라운드 스코프 이벤트 제외)
  channelBusy: boolean
  // 프레임 밖 적체 존재(SessionRuntime.hasUnframedBacklog)
  hasBacklog: boolean
}

// 이 스텝이 세션을 계속 붙들고 있는가(0153) — renderer 의 busy(listening) 신호를 구동한다.
//
// **왜 필요한가**: 구 구조는 `listen` 스텝에서만 `chat.listen started` 를 보냈다. 그런데 `flush`
// 스텝(held 를 연속 턴으로 잇는 경로)도 main 은 명백히 busy 인데 renderer 에는 아무 신호가 없어,
// `telemetry` 로 inflight 를 내린 renderer 가 **idle 로 오판**했다. 그 창에서 들어온 send 는
// 낙관 커밋 경로를 타 정식 버블이 즉시 서고, main 은 같은 메시지를 held 로 받아 **잔여 배치 뒤**에
// 커밋한다 → 라이브 순서와 DB(`idx`) 순서가 갈린다(재시작 시 버블 위치 재조정의 정체).
//
// `break` 만이 세션을 놓는 유일한 스텝이다.
export function postTurnHoldsSession(step: PostTurnStep): boolean {
  return step !== 'break'
}

export function decidePostTurnStep(s: PostTurnState): PostTurnStep {
  // 채널 사망 — 들을 것이 없다. held 는 respawn 콜드 패스(flush 분기의 takeForRespawn)로 이월.
  if (!s.channelAlive) return s.havePending ? 'flush' : 'break'
  if (s.havePending) {
    // held 가 있어도 CLI 진행 중/백로그 잔존이면 listen 드레인 선행 — 그 턴 종료 후 재평가.
    if (s.channelBusy || s.hasBacklog) return 'listen'
    return 'flush'
  }
  return s.haveTasks ? 'listen' : 'break'
}

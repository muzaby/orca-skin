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

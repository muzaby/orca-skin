// send admission 판정(0153) — 이 send 를 **예약(pendingSteer)** 으로 받을 것인가, **낙관 커밋**
// (정식 user 버블 즉시 append + BEGIN_TURN, 0068)으로 받을 것인가.
//
// 낙관 커밋은 "main 도 이 메시지를 **즉시** 턴 프롬프트로 쓴다" 가 참일 때만 정당하다. 그 전제가
// 깨지면 라이브 버블 순서가 main 의 커밋 순서(= DB `idx`)와 갈리고, 재시작하면 위치가 재조정된
// 것처럼 보인다(0153 원 증상).
//
// 전제가 깨지는 두 경우:
//   1. main 이 진행 중이다 — `inflight`(내 턴) 또는 `listening`(턴-후 체인, chat.listen).
//   2. **main 에 아직 확정 안 된 예약이 남아 있다** — 그러면 지금 보내는 메시지는 무슨 일이 있어도
//      그 잔여 **뒤에** 커밋된다(main 은 적재 순서대로 병합·예약한다). 낙관 커밋은 항상 틀린다.
//
// 2번이 필요한 이유: 1번 신호는 IPC 로 오므로 `telemetry` 직후~`chat.listen started` 도착 전의
// 짧은 창이 남는다. 그 창에서도 잔여 예약이 보이면 순서는 이미 확정적으로 결정돼 있다.
export function shouldQueueAsPending(args: {
  // 내 턴 진행 중(chatReducer BEGIN_TURN ~ TURN_END_RESET)
  inflight: boolean
  // main 의 턴-후 체인 진행 중(chat.listen started/ended, 0143·0153)
  listening: boolean
  // 아직 커밋되지 않은 예약 버블 수(pendingSteer)
  pendingCount: number
}): boolean {
  return args.inflight || args.listening || args.pendingCount > 0
}

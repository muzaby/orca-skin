// send admission 판정(0153) — 이 send 를 **예약(pendingSteer)** 으로 받을 것인가, **낙관 커밋**
// (정식 user 버블 즉시 append + BEGIN_TURN, 0068)으로 받을 것인가.
//
// 낙관 커밋은 "main 도 이 메시지를 **즉시** 턴 프롬프트로 쓴다" 가 참일 때만 정당하다. 그 전제가
// 깨지면 라이브 버블 순서가 main 의 커밋 순서(= DB `idx`)와 갈리고, 재시작하면 위치가 재조정된
// 것처럼 보인다(0153 원 증상).
//
// 전제가 깨지는 두 경우:
//   1. main 이 진행 중이다 — `inflight`(내 턴) 또는 `listening`(권위 activity snapshot).
//   2. **main 에 아직 확정 안 된 예약이 남아 있다** — 그러면 지금 보내는 메시지는 무슨 일이 있어도
//      그 잔여 **뒤에** 커밋된다(main 은 적재 순서대로 병합·예약한다). 낙관 커밋은 항상 틀린다.
//
// 2번이 필요한 이유: 1번 신호는 IPC 로 오므로 `telemetry` 직후~activity snapshot 도착 전의
// 짧은 창이 남는다. 그 창에서도 잔여 예약이 보이면 순서는 이미 확정적으로 결정돼 있다.
//
// 0231 — `listening` 을 그대로 쓰면 **백그라운드만 기다리는 구간까지 예약**이 된다. 그 구간의
// 답변 표면은 이미 유휴로 그려지므로(`sessionResponding` 이 `ready` 를 제외한다) 화면은 "끝났다"
// 인데 전송은 "끼어들기" 가 됐다. `transportReady` 가 그 구간의 이름이다.
//
// **`ready` 는 안전하다**: main 은 held 예약을 미는 `flush` 스텝에서 listen phase 를 `receiving
// =false` 로 열므로(`app/chat-turn/post-turn.ts` `beginListenPhase(sessionId, step === 'listen')`)
// `ready` 는 절대 서지 않는다. 즉 `ready` ⇒ main 에 held 없음이다. 그래도 `pendingCount` 항은
// 그대로 남긴다 — 그 항이 덮는 것은 main 의 held 가 아니라 **IPC 지연 창의 renderer 측 잔여**라
// 두 신호는 서로를 대신하지 않는다.
export function shouldQueueAsPending(args: {
  // 내 턴 진행 중(chatReducer BEGIN_TURN ~ TURN_END_RESET)
  inflight: boolean
  // main 의 턴-후 체인 진행 중(chat.activity transport/busy, 0143·0153)
  listening: boolean
  // 아직 커밋되지 않은 예약 버블 수(pendingSteer)
  pendingCount: number
  // `chat.activity.transport === 'ready'` — CLI 유휴 + 백로그 없음 + held 없음(0231)
  transportReady: boolean
}): boolean {
  return args.inflight || args.pendingCount > 0 || (args.listening && !args.transportReady)
}

// 0119: busy 세션 steer 차단 판정 — 선택된 provider 가 진행 중 턴의 provider(스냅샷,
// chatReducer BEGIN_TURN)와 다르면(경계) steer 를 막는다. 진행 턴은 낡은 provider env 로
// 도는 채널이라 경계 너머 메시지를 실을 수 없다(0118 respawn 은 유휴 send 에서만 동작).
// 스냅샷/선택이 null 이면 보수적 허용(기존 동작 유지).
export function steerBlockedByProviderBoundary(args: {
  inflight: boolean
  turnProviderKey: string | null
  selectedProviderKey: string | null | undefined
}): boolean {
  return (
    args.inflight &&
    args.turnProviderKey != null &&
    args.selectedProviderKey != null &&
    args.selectedProviderKey !== args.turnProviderKey
  )
}

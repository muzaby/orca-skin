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

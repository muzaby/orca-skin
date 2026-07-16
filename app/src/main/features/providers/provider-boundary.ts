// 0118: provider 경계 판정 — providerKey(`${adapter}-${provider}`) 전체 비교. env/
// providerSettings 는 spawn-바운드(TurnContinuation 미전달)라 키가 다르면 살아있는 채널의
// env 가 낡는다 → 호출자(chat-turn)가 채널 respawn 을 선언해야 한다. 이전 키 null(레거시
// 세션)·해석 실패(null)·새 세션은 경계 아님(보수적 no-op).
export function crossesProviderBoundary(
  previousKey: string | null | undefined,
  resolvedKey: string | null
): boolean {
  return previousKey != null && resolvedKey != null && previousKey !== resolvedKey
}

// 0118: provider 경계 판정 — providerKey(`${adapter}-${provider}`) 전체 비교. env/
// providerSettings 는 spawn-바운드(TurnContinuation 미전달)라 키가 다르면 살아있는 채널의
// env 가 낡는다 → 호출자(chat-turn)가 채널 respawn 을 선언해야 한다. 이전 키 null(레거시
// 세션)·해석 실패(null)·새 세션은 경계 아님(보수적 no-op).
import type { ResolvedHarnessSettings } from '../../adapters/harness-config'

export function crossesProviderBoundary(
  previousKey: string | null | undefined,
  resolvedKey: string | null
): boolean {
  return previousKey != null && resolvedKey != null && previousKey !== resolvedKey
}

// 0125: 동일 provider settings 제자리 수정 판정 — providerKey 가 같아도(0118 경계 아님) 같은
// provider 의 settings.json 내용(auth token·base URL 등)이 spawn 이후 바뀌었으면 채널 env 가
// 낡는다 → 호출자가 respawn 을 선언해야 한다. spawn 기록(SessionRuntime 보관)·이번 턴 해석
// 어느 한쪽 부재는 보수적 no-op(0118 null 의미론). resolve 캐시가 미변경 파일에 동일 객체
// 참조를 돌려주므로 상시 경로는 참조 비교 1회 — stringify 는 blob 이 실제 갈린 턴에만 발생.
export function providerSettingsChangedSinceSpawn(
  spawned: ResolvedHarnessSettings | undefined,
  resolved: ResolvedHarnessSettings | undefined
): boolean {
  if (spawned == null || resolved == null) return false
  if (spawned.settings === resolved.settings) return false
  return JSON.stringify(spawned.settings) !== JSON.stringify(resolved.settings)
}

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

// 0188 r10: env 축의 같은 판정 — spawn 당시 최종 `options.env` 와 이번 턴의 그것이 다른가.
//
// **양쪽 다 0125 의 보수적 null 의미론을 따른다.** 어느 한쪽이 `undefined` 면 판정하지 않는다:
//   · spawn 기록 없음 = 콜드 스타트, 비교 대상이 없다.
//   · 이번 턴 `undefined` = **해석 실패**(entry 를 못 골랐다). "env 가 비었다" 가 아니다 —
//     그것을 변화로 읽으면 sources 디렉터리가 잠깐 안 보이는 턴마다 살아 있는 채널이 내려간다.
//     `providerSettingsChangedSinceSpawn` 이 settings 축에서 막은 것과 같은 회귀다.
//
// **두 호출부(`runtime-entry.ts`·`chat-turn-continuation.ts`)가 같은 함수를 쓴다** — 판정이
// 리터럴로 흩어져 있으면 한쪽만 고쳐지는 회귀가 난다(0149·0166 D7 과 같은 종류).
export function runtimeEnvChangedSinceSpawn(
  spawned: string | undefined,
  resolved: string | undefined
): boolean {
  if (spawned == null || resolved == null) return false
  return spawned !== resolved
}

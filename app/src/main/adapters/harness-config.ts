// Provider settings 계약 타입 — 어댑터 포트. 해석 서비스(HarnessSettingsService)·열거·env 유틸은
// features/harnesses 소관이지만, 어댑터가 소비하는 *타입 계약*(해석된 blob·로더 시그니처)은 여기 둔다.
// 이 파일은 아무것도 import 하지 않는다(turn/types 와의 순환 회피).

// 어댑터-네이티브 provider settings — Claude 의 경우 `~/.claude/settings.json` 과 동일 스키마다.
// env(auth key 등)를 포함할 수 있으며, 그대로 options.settings flag 레이어로 주입된다(handoff 0028).
export type HarnessNativeSettings = Record<string, unknown>

// 해석 완료된 provider settings — TurnRequest/CompleteRequest 로 어댑터에 전달되는 불투명 blob.
// 어댑터-네이티브 스키마(env 포함)를 그대로 담는다; 어댑터는 자기 query 옵션에 꽂기만 한다(0014).
export interface ResolvedHarnessSettings {
  providerKey: string
  provider: string
  settings: HarnessNativeSettings
}

// 어댑터 종속 해석기 — 컴포지션 루트가 어댑터별로 주입한다. sources 파일을 읽어 어댑터-네이티브
// settings 를 verbatim 으로 돌려준다(claude=~/.claude/settings.json 동일 취급).
export type HarnessSettingsLoader = (args: {
  // sources/settings/<adapter>/<provider>/settings.json
  sourcesSettingsFile: string
}) => Promise<{ settings: HarnessNativeSettings }>

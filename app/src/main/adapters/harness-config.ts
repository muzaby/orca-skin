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
  // 해석 원천(파일 경로 + mtime)에서 만든 **opaque revision** (0188). settings feature 가 cache
  // 정합성을 위해 감싼 메타데이터이며 **Harness native settings JSON 의 일부가 아니다** —
  // adapter 에는 `settings` 값만 전달하고 이 필드를 `options.settings` 에 섞지 않는다.
  //
  // 외부 에디터로 settings.json 을 고치면 다음 resolve 에서 이 값이 달라져 runtime config
  // cache 가 miss 된다(0188 AC12).
  sourceRevision: string
}

// 어댑터 종속 해석기 — 컴포지션 루트가 어댑터별로 주입한다. sources 파일을 읽어 어댑터-네이티브
// settings 를 verbatim 으로 돌려준다(claude=~/.claude/settings.json 동일 취급).
export type HarnessSettingsLoader = (args: {
  // sources/settings/<adapter>/<provider>/settings.json
  sourcesSettingsFile: string
}) => Promise<{ settings: HarnessNativeSettings }>

// ── spawn 입력 fingerprint (0188) ────────────────────────────────────────────
//
// `providerSettingsChangedSinceSpawn` 만으로는 `options.env` 의 credential 교체를 판정하지
// 못한다 — settings 는 그대로인데 토큰만 바뀌는 경우가 폐쇄망의 정상 흐름이다. 그래서 adapter
// 에 **실제로 전달하는 두 입력**을 key 정렬 canonical form 으로 접어 비교값을 만든다.
//
// **여기(adapters)에 두는 이유**: 조립부(`features/harnesses`)와 spawn 기록부
// (`features/sessions`)가 같은 함수를 써야 하는데 feature 끼리는 교차 import 가 금지된다.
// 값 자체가 "adapter 입력의 형상" 이므로 adapter 포트가 제 자리다.
//
// **원문·secret·이 값을 로그나 DB 에 남기지 않는다** (0188 D-021). 해시를 쓰지 않는 이유는
// 해시도 진단으로 새면 같은 위험이고, 비교에는 문자열 동등성으로 충분하기 때문이다.
export function harnessConfigFingerprint(
  settings: HarnessNativeSettings | undefined,
  env: Readonly<Record<string, string>> | undefined
): string {
  return JSON.stringify({ settings: canonicalize(settings), env: canonicalize(env) })
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value
  const record = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) out[key] = canonicalize(record[key])
  return out
}

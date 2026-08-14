// Provider settings 계약 타입 — 어댑터 포트. 해석 서비스(HarnessSettingsService)·열거·env 유틸은
// features/harnesses 소관이지만, 어댑터가 소비하는 *타입 계약*(해석된 blob·로더 시그니처)은 여기 둔다.
// 런타임 import 는 node 내장 crypto 하나뿐이다 — feature/adapter 모듈은 물지 않는다
// (turn/types 와의 순환 회피).

import { createHmac, randomBytes } from 'node:crypto'

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

// ── spawn env fingerprint (0188 · r2 축소) ───────────────────────────────────
//
// `providerSettingsChangedSinceSpawn` 만으로는 `options.env` 의 credential 교체를 판정하지
// 못한다 — settings 는 그대로인데 토큰만 바뀌는 경우가 폐쇄망의 정상 흐름이다. 그 빈자리를
// 메우는 값이다.
//
// ── 왜 settings 를 함께 접지 않는가 (r2 정정) ────────────────────────────────
// r1 은 `{settings, env}` 를 함께 접어 하나의 비교값을 만들었다. 두 가지가 잘못됐다:
//
//   ① **판정이 겹쳤다.** settings 가 바뀌면 `providerSettingsChanged` 와 이 값이 **둘 다**
//      true 가 된다 — 같은 사실을 두 입력이 말하는 구조는 나중에 한쪽만 고쳐지기 쉽다.
//   ② **0125 의 보수적 null 의미론을 조용히 뒤집었다.** `providerSettingsChangedSinceSpawn`
//      은 어느 한쪽 settings 가 없으면 **no-op** 이다(해석 실패는 경계가 아니다). 반면 합친
//      fingerprint 는 `settings: {...}` → `settings: undefined` 를 변화로 읽어, **loader 가
//      일시적으로 실패한 턴에 채널을 내리고 settings 없이 respawn** 했다.
//
// 그래서 이 값은 **최종 env 만** 접는다. settings 차원은 기존 함수가 계속 소유한다 — 두 입력이
// 서로 겹치지 않는 축을 하나씩 본다.
//
// **여기(adapters)에 두는 이유**: 조립부(`features/harnesses`)와 spawn 기록부
// (`features/sessions`)가 같은 함수를 써야 하는데 feature 끼리는 교차 import 가 금지된다.
// 값 자체가 "adapter 입력의 형상" 이므로 adapter 포트가 제 자리다.
//
// ── 왜 원문이 아니라 digest 인가 (r3) ────────────────────────────────────────
// r2 는 canonical JSON **원문**을 돌려줬다. 그 문자열에는 동적 토큰과 `process.env` 전체가 들어
// 있고, `SessionRuntime` 이 채널 수명 내내 보관한다 — 로그·DB 에 남기지 않더라도 **secret 을
// 별도 문자열로 복제해 오래 들고 있는 것 자체가 표면**이다.
//
// 그래서 비가역 digest 로 접는다. 키는 **프로세스 수명 한정 난수**다:
//   · 단순 해시라면 낮은 엔트로피 값(짧은 API key 등)이 사전 대입으로 역산될 수 있다.
//   · 키가 프로세스마다 새로 생기므로 값이 밖으로 새더라도 다른 실행·다른 기기에서 의미가 없다.
// 비교는 같은 프로세스 안에서만 일어나므로 이 제약이 기능을 깎지 않는다.
const FINGERPRINT_KEY = randomBytes(32)

export function harnessEnvFingerprint(env: Readonly<Record<string, string>> | undefined): string {
  return createHmac('sha256', FINGERPRINT_KEY)
    .update(JSON.stringify(canonicalize(env) ?? null))
    .digest('base64')
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object' || value === null) return value
  const record = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(record).sort()) out[key] = canonicalize(record[key])
  return out
}

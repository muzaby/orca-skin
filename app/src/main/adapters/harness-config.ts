// Provider settings 계약 타입 — 어댑터 포트. 해석 서비스(HarnessSettingsService)·열거·env 유틸은
// features/harnesses 소관이지만, 어댑터가 소비하는 *타입 계약*(해석된 blob·로더 시그니처)은 여기 둔다.
// 런타임 import 는 node 내장 crypto 하나뿐이다 — feature/adapter 모듈은 물지 않는다
// (turn/types 와의 순환 회피).

import { createHmac, randomBytes } from 'node:crypto'
import { ifPresent, isRecord } from '../../shared/obj'

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

// ── Harness 실행 구성 계약 (0190 — 0188 의 `features/harnesses/runtime-config.ts` 에서 하강) ──
//
// **왜 여기 있는가**: 이 두 타입은 *해석 서비스의 산출물*이 아니라 **adapter 입력의 형상**이다.
// 0188 은 생산자(`HarnessRuntimeConfigService`) 옆에 두었고, 그 배치가 아래 `prepareHarnessConfig`
// 를 feature 레이어에 붙잡았다 — 조립부가 feature 타입을 소비하면 `adapters → features` 라는
// 금지 간선이 필요해지기 때문이다. 타입을 계약 자리로 내리면 조립부가 계약대로 adapter-local 이
// 된다. `HarnessRuntimeConfigService`(단일 비행·세대·cache·augmenter)는 그대로 features 에 남는다.

// `${HarnessId}-${ModelProviderId}` 합성 키. 문자열 join 은 `infra/config/provider-key.ts` 의
// `providerKeyOf` 하나가 갖는다 — 여기서 다시 잇지 않는다.
export type HarnessModelProviderKey = string

// 해석된 Harness 실행 구성 한 장.
export interface HarnessRuntimeConfig {
  key: HarnessModelProviderKey
  harnessId: string
  modelProviderId: string
  // Harness native 설정. Claude 에서는 `options.settings` 로 전달한다.
  settings?: ResolvedHarnessSettings
  // 동적 subprocess overlay. credential 뿐 아니라 URL·모델 변수·flag 를 포함한다.
  // app/process/settings env 와의 최종 병합은 아래 spawn preparation 이 수행한다.
  runtimeEnv: Readonly<Record<string, string>>
  availableModels?: readonly string[]
  // 동적 token/config 의 사용 기한. 없으면 명시 무효화 전까지 cache 할 수 있다.
  validUntil?: number
}

// ── spawn 입력 조립 (0188 → 0190 이설) ───────────────────────────────────────
//
// Harness 에는 **두 주입 채널**이 있다 — `options.settings`(Harness native settings JSON)와
// `options.env`(subprocess 환경변수). 0028 결정에 따라 secret 은 후자에만 실린다. 동적
// runtime config 가 생기면서 "같은 키가 두 채널에 모두 있을 때 무엇이 이기는가" 가 실제
// 실행 결과를 가르게 됐다.
//
// 적용 우선순위는 다음으로 **고정**한다:
//
// ```text
// 배포 spawn env injector (app/deployment/spawn-env.ts)
//   > runtime config augmenter env
//   > 선택된 Harness + ModelProvider settings 의 env
//   > app env
//   > 상속된 process env
// ```
//
// injector 가 최상위인 것은 사용자 결정이다(0207 D-003) — 폐쇄망 배포가 사내 프록시·인증서를
// **하네스에 전달되기 직전에** 얹는 자리라서 config API 응답까지 덮는다. 대상 좁히기는 조립부가
// 아니라 injector 안에서 식별자로 한다(D-002).
//
// settings env 가 app env 를 이기는 것이 계약의 핵심이다 — `orca.json` 의 app env 는 **전역
// 폴백**이고 ModelProvider settings 는 **그 ModelProvider 전용 설정**이다. 폴백이 전용을 이기면
// 게이트웨이를 바꿔도 URL·모델 변수가 따라오지 않는다.
//
// SDK 는 `options.settings` 를 JSON 문자열로, `options.env` 를 subprocess env 로 받는다. 두
// 채널의 env 충돌 시 어느 쪽이 이기는지는 SDK/CLI 내부 구현에 달렸고 버전에 따라 바뀔 수 있다.
// 그래서 **어느 쪽이 이기든 같은 결과가 나오도록** 조립한다(제안서 결정표 2행, fail-safe):
// `options.env` 를 만드는 턴에는 settings 의 **env 블록을 통째로** in-memory 사본에서 제거하고
// 그 값들을 위 순서로 `options.env` 에 hoist 한다. 두 채널에 같은 키가 동시에 남지 않으므로
// SDK 우선순위와 무관하게 결과가 하나다. 이 결정표는 `harness-config.test.ts` 가 고정한다.
//
// `options.env` 를 만들지 않는 턴(정적 배포 + app env 없음)에는 settings 채널을 **건드리지
// 않는다** — 그 경로의 동작은 0188 이전과 글자까지 같다.
//
// **디스크 `settings.json` 은 수정하지 않는다** — 제거는 이 함수가 만든 사본에서만 일어난다.
// **원문·secret·fingerprint 를 로그나 DB 에 남기지 않는다.**
export interface PreparedHarnessConfig {
  // 기존 `TurnRequest.providerSettings` 로 그대로 간다.
  providerSettings?: ResolvedHarnessSettings
  // 기존 `TurnRequest.env` 로 그대로 간다.
  env?: Readonly<Record<string, string>>
  // **최종 env 만** 정규화해 만든 메모리 전용 비교값이다 (settings 차원은
  // `providerSettingsChangedSinceSpawn` 이 0125 의 보수적 null 의미론과 함께 계속 소유한다).
  //
  // `undefined` = **판정 불가**. "env 가 비었다" 와 다르다 — 이번 턴이 실행 구성을 해석하지
  // 못했다는 뜻이고, 그 상태를 값으로 접으면 0125 가 settings 축에서 막은 것과 같은 회귀가 env
  // 축에서 난다: 해석에 실패한 턴마다 fingerprint 가 달라져 **살아 있는 채널을 내리고
  // respawn** 한다. 판정 불가는 no-op 이어야 한다.
  runtimeEnvFingerprint: string | undefined

  // **spawn 기록용 — 항상 정의된다.** 위 필드와 값은 같지만 축이 다르다: 저것은 *이번 턴이
  // 판정할 수 있는가*, 이것은 *이 env 가 무엇인가* 다. `SessionRuntime` 은 spawn 당시의 env 를
  // 기록해야 하므로 해석 실패 턴에서도 실제 값이 필요하다 — 여기에 `undefined` 를 넣으면 그
  // 턴에 뜬 채널이 이후 **어떤 env 변화에도 respawn 하지 않는다**(비교가 no-op 이 된다).
  //
  // 두 필드가 한 계산을 공유하는 것이 이 필드의 존재 이유다(0190). 0188 은 조립부와 spawn
  // 기록부가 **각각** `harnessEnvFingerprint` 를 불러 spawn 당 2회 계산했다 — `TurnRequest` 에
  // 값을 나를 자리가 없었기 때문이다.
  envFingerprint: string
}

// settings blob 에서 `env` 블록을 통째로 걷어낸 **사본**을 만든다.
//
// **왜 충돌 키만이 아니라 전부인가**: 충돌 키만 지우면 settings 에도 app env 에도 있는 키가
// **두 채널에 동시에** 남아 최종 값이 SDK 내부 우선순위에 달린다 — "어느 채널이 우선해도 같은
// 결과" 라는 이 모듈의 계약이 깨진다.
//
// **같은 입력에 같은 참조를 돌려준다 (0190).** `providerSettingsChangedSinceSpawn` 의 빠른
// 경로는 `spawned.settings === resolved.settings` 참조 비교다. 여기서 매 턴 새 객체를 만들면
// env 블록이 있는 배포(폐쇄망 표준 형상)에서 그 경로가 **항상** 빗나가 턴마다 `JSON.stringify`
// 2회로 간다 — 0125 가 못 박은 "상시 경로는 참조 비교 1회" 가 사라진다. 원본 blob 을 키로 한
// `WeakMap` 이라 원본이 GC 되면 항목도 사라지고, 별도 무효화 로직이 필요 없다(입력 참조가 곧 키).
//
// **반환값을 변형하지 않는다** — 캐시된 사본이라 변형은 다음 턴으로 샌다. 현재 소비자는 읽기만 한다.
const strippedEnvBlockCache = new WeakMap<HarnessNativeSettings, HarnessNativeSettings>()

function withoutEnvBlock(settings: HarnessNativeSettings): HarnessNativeSettings {
  // env 블록이 없으면 원본 참조를 그대로 돌려준다 — 캐시에 담을 것도 없다.
  if (!isRecord(settings['env'])) return settings
  const cached = strippedEnvBlockCache.get(settings)
  if (cached) return cached
  const next = { ...settings }
  delete next['env']
  strippedEnvBlockCache.set(settings, next)
  return next
}

// 같은 이유로 조립된 `ResolvedHarnessSettings` 외피도 원본당 한 번만 만든다.
const adjustedSettingsCache = new WeakMap<ResolvedHarnessSettings, ResolvedHarnessSettings>()

function withEnvBlockHoisted(settings: ResolvedHarnessSettings): ResolvedHarnessSettings {
  const stripped = withoutEnvBlock(settings.settings)
  if (stripped === settings.settings) return settings
  const cached = adjustedSettingsCache.get(settings)
  if (cached) return cached
  const next: ResolvedHarnessSettings = { ...settings, settings: stripped }
  adjustedSettingsCache.set(settings, next)
  return next
}

// settings blob 의 env 블록에서 **문자열 값만** 뽑는다. Harness native settings 는 임의
// JSON 이라 숫자·객체가 들어올 수 있는데, subprocess env 는 문자열만 받는다.
function stringEnvOf(settings: HarnessNativeSettings | undefined): Record<string, string> {
  const env = settings?.['env']
  if (!isRecord(env)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

const HOST_MANAGED_PROVIDER_ENV = 'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST'

// injector 미등록 턴이 매 턴 빈 리터럴을 만들지 않도록 공유한다. 읽기 전용으로만 쓴다.
const EMPTY_ENV: Readonly<Record<string, string>> = Object.freeze({})

// ── 배포 spawn env 주입점 (0207) ─────────────────────────────────────────────
//
// **왜 augmenter 로는 안 되는가**: `RuntimeConfigAugmenter` 등록은 key 정확 매칭
// (`Partial<Record<HarnessModelProviderKey, …>>`)이라 운영자가 런타임에 만든
// `sources/settings/<harness>/<modelProvider>/` 에는 붙지 않는다. 폐쇄망 적응값은 **모든**
// Harness+ModelProvider 에 걸려야 한다(D-002).
//
// **왜 조립부가 부르는가**: `adapters` 는 `app` 을 import 할 수 없다(eslint boundaries). 그래서
// 배포 모듈을 물지 않고 함수를 **인자로 받는다** — 컴포지션 루트(`app/chat-turn/turn-setup.ts`)가
// 배포 상수를 넘긴다.

// injector 가 대상을 좁히는 데 쓰는 식별자. `resolved` 로 갈린 **discriminated union** 인 이유는
// entry 를 못 고른 턴에 빈 문자열 key 를 넘기면 배포가 그것을 실제 key 로 오인하기 때문이다
// (D-007) — 그 조합은 타입에 존재하지 않는다.
export type SpawnEnvTarget =
  | {
      resolved: true
      key: HarnessModelProviderKey
      harnessId: string
      modelProviderId: string
      // settings.json 원문 blob — env 블록을 걷어내기 **전** 값이다. 해석하지 못한 턴에는 없다.
      settings?: HarnessNativeSettings
    }
  | { resolved: false }

// 배포가 채우는 커스텀 env 계산 함수. **동기·순수다** — `AbortSignal`·`Promise`·`AuthBinder`·
// `AuthSecretReader` 를 받지 않는다(D-006). 원격 호출과 credential 은 `RuntimeConfigAugmenter`
// 의 책임이고 그 경계는 0188 r5 가 타입으로 갈라 놓았다.
//
// 반환값에 런타임 문자열 필터를 두지 않는다: `settings.json` 은 디스크의 임의 JSON 이라
// `stringEnvOf` 가 걸러야 하지만, injector 는 in-repo TypeScript 라 컴파일러가 형상을 강제한다.
//
// **값이 없으면 그 키를 빼고 빈 객체를 돌려준다 — 던지지 마라.** 던지면 그 턴 전체가 실패한다.
export type SpawnEnvInjector = (input: {
  target: SpawnEnvTarget
  // `process.env` 스냅샷 한 장 (D-004). 판정·조립과 **같은** 스냅샷이다.
  hostEnv: Readonly<Record<string, string>>
}) => Record<string, string>

function spawnEnvTarget(config: HarnessRuntimeConfig, configResolved?: boolean): SpawnEnvTarget {
  if (configResolved === false) return { resolved: false }
  return {
    resolved: true,
    key: config.key,
    harnessId: config.harnessId,
    modelProviderId: config.modelProviderId,
    ...ifPresent('settings', config.settings?.settings)
  }
}

export interface PrepareHarnessConfigInput {
  config: HarnessRuntimeConfig
  // orca.json 앱 전역 env(`${VAR}` 확장 완료). 없으면 앱 env 레이어가 비었다는 뜻.
  appEnv?: Record<string, string>
  // 완전한 baseline 을 만드는 함수(기본은 `process.env` 스냅샷). SDK `options.env` 는
  // subprocess env 를 **대체**하므로 overlay 만 넘기면 상속이 끊긴다.
  baseEnv: () => Record<string, string>
  // 이번 턴이 Harness+ModelProvider entry 를 실제로 골랐는가 (기본 `true`).
  //
  // `false` 면 env 는 조립하되 **fingerprint 를 내지 않는다** — respawn 판정에 "모른다" 를
  // 넘겨 보수적 no-op 이 되게 한다(0125 null 의미론과 같은 축). 값을 내면 해석 실패 턴마다
  // 채널이 내려간다.
  configResolved?: boolean
  // 배포 spawn env 주입점(0207). 미지정 = 주입 없음 — 기본 배포의 동작·성능은 지금과 같다.
  customEnv?: SpawnEnvInjector
}

export function prepareHarnessConfig(input: PrepareHarnessConfigInput): PreparedHarnessConfig {
  const { config } = input
  const runtimeEnv = config.runtimeEnv
  const hasRuntimeEnv = Object.keys(runtimeEnv).length > 0
  const appEnv = input.appEnv ?? {}
  const hasAppEnv = Object.keys(appEnv).length > 0

  const settings = config.settings
  const settingsEnv = stringEnvOf(settings?.settings)

  // `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` 는 settings 가 병합되는 시점보다 앞서 Claude Code
  // 프로세스 시작 환경에서 판정된다. 따라서 모든 레이어를 접은 **최종값**이 `1`이면 settings env
  // 도 실제 spawn env 로 올려야 한다. 판정 우선순위는 최종 env 조립과 같은
  // custom > runtime > settings > app > process 다. 상위 레이어의 명시적 `0`을 `??`로 보존해야
  // 하위 `1`이 모드를 되살리지 않는다.
  //
  // process 레이어를 봐야 하는 settings-only 경로에서는 base snapshot 을 한 번만 만들고 아래
  // 조립에서 재사용한다. 서로 다른 process.env 순간을 판정과 실행에 쓰면 같은 턴 안에서도
  // host-managed 여부와 실제 spawn env 가 갈릴 수 있다.
  let baseEnvSnapshot: Record<string, string> | undefined
  const baseEnv = (): Record<string, string> => (baseEnvSnapshot ??= input.baseEnv())

  // injector 는 판정보다 **먼저** 부른다 — 그 값이 flag 판정과 `buildsEnv` 양쪽에 들어가기
  // 때문이다. 등록된 배포에서는 이 줄 때문에 `baseEnv()` 가 항상 한 번 불린다(injector 입력).
  // 미등록 배포는 lazy 조건이 그대로다.
  const customEnv = input.customEnv
    ? input.customEnv({
        target: spawnEnvTarget(config, input.configResolved),
        hostEnv: baseEnv()
      })
    : EMPTY_ENV
  const hasCustomEnv = Object.keys(customEnv).length > 0

  const explicitHostManaged =
    customEnv[HOST_MANAGED_PROVIDER_ENV] ??
    runtimeEnv[HOST_MANAGED_PROVIDER_ENV] ??
    settingsEnv[HOST_MANAGED_PROVIDER_ENV] ??
    appEnv[HOST_MANAGED_PROVIDER_ENV]
  const inheritedHostManaged =
    explicitHostManaged === undefined && Object.keys(settingsEnv).length > 0
      ? baseEnv()[HOST_MANAGED_PROVIDER_ENV]
      : undefined
  const hostManaged = (explicitHostManaged ?? inheritedHostManaged) === '1'

  // 동적 값이 없고 앱 env 도 없으면 **옵션 자체를 생략**한다 — SDK 기본 env(process.env 상속)
  // 동작과 settings 채널을 그대로 둔다. 단 host-managed 모드는 settings env 가 너무 늦게
  // 적용되므로 정적 배포여도 완전한 subprocess env 를 만든다(0200).
  const buildsEnv = hasRuntimeEnv || hasAppEnv || hasCustomEnv || hostManaged
  const adjusted = settings && buildsEnv ? withEnvBlockHoisted(settings) : settings

  // 나중 spread 가 이기므로 순서가 곧 우선순위다.
  const env: Record<string, string> | undefined = buildsEnv
    ? {
        ...baseEnv(),
        ...appEnv,
        ...settingsEnv,
        ...runtimeEnv,
        ...customEnv
      }
    : undefined

  // **한 번만 계산한다.** 아래 두 필드가 이 값을 나눠 쓴다.
  const envFingerprint = harnessEnvFingerprint(env)

  return {
    ...ifPresent('providerSettings', adjusted),
    ...ifPresent('env', env),
    runtimeEnvFingerprint: input.configResolved === false ? undefined : envFingerprint,
    envFingerprint
  }
}

// Harness+ModelProvider entry 를 **못 고른** 턴의 spawn 입력.
//
// 조립 규칙을 호출부(`app/chat-turn/turn-setup.ts`)에 인라인으로 두지 않는 이유: 그 파일은
// electron 을 물어 vitest 가 import 하지 못한다. 규칙이 거기 있으면 이 경로는 **테스트가 닿지
// 않는 자리**가 되고, 실제로 0188 r9 가 그렇게 두 가지를 놓쳤다 —
//
//   ① app env 유실. 0188 이전에는 `buildTurnEnv()` 가 entry 선택과 무관하게 불려 orca.json 의
//      `env` 가 항상 실렸다. 여기서 빠뜨리면 settings 트리가 없는 어댑터(DEV mock)나 sources
//      디렉터리가 잠깐 안 보이는 턴에서 subprocess 환경이 조용히 달라진다.
//   ② fingerprint 를 값으로 냄. `harnessEnvFingerprint(undefined)` 도 정의된 문자열이고
//      `SessionRuntime` 은 spawn 마다 그것을 기록하므로, 해석 실패 턴이 곧 "env 가 바뀌었다" 로
//      읽혀 **살아 있는 채널을 내리고 respawn** 했다. 0125 가 settings 축에서 "해석 실패는
//      경계가 아니다" 로 못 박은 것과 같은 자리다.
//
// 호출부에 남는 것은 인자 두 개를 넘기는 한 줄뿐이고, 그 형상은 타입이 잡는다.
export function prepareUnresolvedHarnessConfig(input: {
  appEnv?: Record<string, string>
  baseEnv: () => Record<string, string>
  // **injector 는 이 경로에서도 불린다** (0207 D-007). 사내 프록시·인증서가 빠진 채 spawn 하면
  // 증상이 원인에서 멀어진다 — entry 를 못 골랐다는 사실은 `resolved:false` 로 알린다.
  customEnv?: SpawnEnvInjector
}): PreparedHarnessConfig {
  return prepareHarnessConfig({
    config: { key: '', harnessId: '', modelProviderId: '', runtimeEnv: {} },
    ...ifPresent('appEnv', input.appEnv),
    baseEnv: input.baseEnv,
    ...ifPresent('customEnv', input.customEnv),
    configResolved: false
  })
}

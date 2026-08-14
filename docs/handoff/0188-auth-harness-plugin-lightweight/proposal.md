# 인증·Harness·Plugin 경량화 리팩터링 제안

> 상태: **구현 지침 / 아직 main에 반영되지 않은 TO-BE 제안**
>
> 통합 상태: Gate 분리, 기존 settings SSOT 유지, 별도 Harness ModelProvider catalog 금지,
> Auth change 분류, gate-first resume, cache generation fence, continuation, GUI compatibility와
> trusted-main secret 포트까지 모든 검토 결과를 병합한 **유일한 구현 제안서**
>
> 독자: Orca-skin `main` 브랜치의 코드·레이어 규칙을 이미 아는 구현 에이전트
>
> 기준 시점: 이 문서를 작성할 때의 `main`
>
> 목표: 인증 외 기능을 각 소비 feature가 직접 구현하도록 재배치하면서 현재 성능, UI/UX,
> 보안 경계와 DB를 유지한다.

이 문서는 현재 아키텍처 설명서가 아니다. 구현 전에는 코드가 진실이며, 구현이 완료되기 전까지
`docs/arch/backend/providers.md`와 `app/src/main/contracts/provider.ts`가 AS-IS 계약이다. 이 제안이
채택되어 구현되면 현재 아키텍처 문서, 용어집과 폐쇄망 확장 가이드를 같은 변경에서 갱신한다.

별도 피드백·보완 문서는 이 문서의 입력 증거일 뿐 구현 정본이 아니다. 구현 에이전트는 이 문서와
현재 `main` 코드만 사용하며, 서로 다른 초안의 예시를 조합하지 않는다.

---

## 결론

현재 `features/providers`는 서로 다른 책임을 한 디렉터리와 `Provider` 계약에 모은다.

- 앱/서비스/모델 접근을 위한 **인증**
- Claude/OpenCode가 실행될 때 필요한 **Harness 설정과 ModelProvider 설정**
- Confluence 같은 **Plugin 기능과 도구**
- 다른 feature가 인증된 API를 호출하기 위한 **범용 소비 표면**

TO-BE에서는 인증만 공통화한다. 인증 이후의 endpoint 선택, 요청 파라미터, 응답 변환, 캐시,
주기 실행, 도구 구성과 Harness 환경변수 조립은 해당 기능이 직접 소유한다.

```text
AuthRuntime
  ├─ 로그인·재인증·해제
  ├─ Grant·vault·cookie jar
  ├─ 인증된 요청
  └─ secret 없는 인증 설명·상태

trusted main 전용 AuthSecretReader
  └─ MCP binding 또는 Harness 직접 주입에 한해 raw credential 조회

Gate
  └─ 필수 Auth의 valid + verified 상태만 소비하는 앱 접근 정책

소비 feature
  ├─ Harness 설정: URL·모델 환경변수·실행용 토큰 조립
  ├─ Usage: endpoint 호출·응답 → UsageSnapshot 변환
  └─ Plugin: Confluence REST·Markdown 변환·Runtime Tool 구성

Bootstrap
  └─ 위 객체를 생성하고 좁은 포트로 연결만 함
```

`ProviderPlatform`을 더 범용적인 플랫폼으로 확장하지 않는다. `ProviderPlatformV2`, contribution
registry, operation catalog, 응답 매핑 DSL, 환경변수 DSL도 만들지 않는다.

---

## 확정 용어

아래 표는 새 코드, 새 문서와 수정하는 주석에 적용한다.

| 용어 | 의미 | 예 | 사용하지 않을 표현 |
|---|---|---|---|
| **Harness** | 모델을 실행하고 도구·세션·이벤트를 중개하는 실행기 | Claude, OpenCode | Engine |
| **Model** | 실제 추론 모델 또는 사용자가 고르는 모델 family/alias | Opus, Sonnet, Haiku | Harness, ModelProvider와 혼용 |
| **ModelProvider** | Harness가 모델에 접근할 때 선택하는 공급 경로 | Anthropic, OpenAI, Bedrock, Vertex | 별도의 공급 분류, 모델 자체 |
| **Auth** | 토큰·세션·쿠키 등을 획득하고 유효성을 관리하는 기능 | API key, PAT, OAuth, browser session | 서비스 기능 전체를 포괄하는 Provider |
| **Plugin** | GUI 카탈로그에 표시되는 제품 기능 단위 | Confluence | 인증 방식 자체, Harness package |
| **HarnessPlugin** | Harness가 직접 로드하는 plugin package | Claude가 직접 로드하는 plugin package | Claude native package |
| **ClaudeHarnessPlugin** | Claude 전용 HarnessPlugin을 구체적으로 지칭할 때 | Claude plugin package | Dedicated/Exclusive를 의미 없이 사용 |

`DedicatedHarnessPlugin`은 실제로 “특정 Harness에서만 사용 가능”이라는 제품 정책을 표현해야 할
때만 쓴다. 일반 명칭은 `HarnessPlugin`, Claude 구현체는 `ClaudeHarnessPlugin`으로 통일한다.
`ExclusivePlugin`은 소유권·배포 독점으로 오해할 수 있으므로 쓰지 않는다.

새 타입과 모듈에는 제품명 prefix를 붙이지 않는다. 기존 `orca.json`, `orca:*` IPC namespace와
설치된 package id는 호환성 식별자이므로 이번 구조 리팩터링에서 무조건 개명하지 않는다.

### 식별자

```ts
type HarnessId = 'claude' | 'opencode'
type ModelProviderId = 'anthropic' | 'openai' | 'bedrock' | 'vertex' | (string & {})
type HarnessModelProviderKey = `${HarnessId}-${string}`
type ModelId = string
type AuthId = string
```

`claude-bedrock`은 “Claude Harness + Bedrock ModelProvider”를 뜻한다. Sonnet은 그 조합에서 선택하는
Model이다. 기존 renderer DTO `AgentEnvironment`는 이번 UI/IPC 호환 경계에 그대로 둔다. 이를 새
domain identity로 재사용하거나 Environment 어휘의 새 key 타입을 만들지 않는다. 내부 settings
entry와 key는 각각 `HarnessModelProviderEntry`, `HarnessModelProviderKey`를 사용한다.

기존 DB/IPC의 `backend`, `engine`, `adapter`, `provider_key`는 호환성 필드일 수 있다. 구조
리팩터링 중 의미까지 한꺼번에 바꾸지 말고 경계에서 `HarnessId`와
`HarnessModelProviderKey`로 변환한다. 신규 도메인 코드에서는 해당 레거시 어휘를 확산하지 않는다.
`SessionAdapter`는 Harness를 외부 SDK/CLI에 연결하는 기술 포트이므로 유지할 수 있지만,
Claude/OpenCode 자체를 Adapter라고 정의하지는 않는다.

---

## AS-IS 확인

### `features/providers`에 두 시스템이 공존한다

현재 `app/src/main/features/providers/`에는 다음이 함께 있다.

| 현재 영역 | 실제 책임 |
|---|---|
| `provider-registry.ts`, `provider-settings.ts`, `claude-model-parser.ts`, `model-resolve.ts`, `env-merge.ts`, `provider-boundary.ts`, `engine-write.ts` | Harness + ModelProvider 설정 열거, 모델 해석, settings 캐시, runtime 경계 판정 |
| `auth/`, `gate/`, `platform.ts` | 인증 선언, Grant, 로그인, request, gate, renderer 상태 |
| `declarations/llm.ts`, `llm/` | 인증 선언과 선택된 Harness + ModelProvider 키의 조인 |
| `declarations/service.ts`, `service/confluence/` | Plugin 인증 선언과 Confluence 구체 기능 |

같은 `provider`라는 이름이 ModelProvider 설정과 인증 대상을 동시에 가리킨다. 이 때문에
`features/providers`를 읽는 구현자는 ModelProvider, 인증 entry, Plugin을 계속 구분해야 한다.

### 현재 `llm.ts` 계약은 실제 요구보다 좁다

현재 `Provider.llm`은 아래 좌표만 표현한다.

```ts
llm?: {
  adapter: string
  provider: string
  envKey: string
}
```

`ProviderApi.materialize()`는 vault에서 읽은 credential 하나를 `envKey`에 넣는다. 반면 URL,
ModelProvider 선택 flag, Opus/Sonnet/Haiku 모델 식별자는 대체로
`sources/settings/<adapter>/<provider>/settings.json`의 `env`에 있고, 별도의
`providerSettings` 경로로 Claude에 전달된다.

따라서 현재 main의 실행 구성은 실제로 두 경로다.

```text
settings.json
  └─ URL·ModelProvider flag·모델 변수·Harness 고유 설정
      └─ options.settings

Provider.llm.envKey + Grant
  └─ credential 한 값
      └─ options.env
```

폐쇄망 구현에서는 인증으로 받은 OAuth token이 실제 LLM token이 아닐 수 있다. OAuth token으로
별도 API를 호출한 뒤 응답의 LLM token, URL, 모델 식별자를 Harness 환경변수로 바꿔야 한다.
그러므로 `llm.ts`를 단순한 `authId + envKey` 선언으로 축소하면 요구를 만족하지 못한다.

### UsageFetcher는 목표 구조의 선례다

`app/src/main/features/usage/fetcher.ts`는 `UsageFetcher` 계약만 소유한다. 실제 폐쇄망 endpoint,
인증된 요청과 JSON → `UsageSnapshot` 변환은 배포 코드가 소유하도록 열려 있다.
`Provider.usage` 슬롯이나 사용량 operation registry는 없다.

`app/src/main/app/bootstrap.ts`의 예시는 다음 경계를 보여준다.

```text
Usage feature       : UsageSnapshot의 의미와 합성
폐쇄망 구현          : endpoint 호출과 응답 매핑
Auth                : 인증된 request
Bootstrap           : concrete 구현 주입
```

이 패턴을 Usage에만 두지 않고 Harness 설정과 Plugin에도 적용한다.

### UI는 인증 동작만 요구한다

카탈로그의 연결/재인증/해제 버튼과 gate 화면은 인증 lifecycle을 실행한다. renderer는 초기 상태를
한 번 읽고 main의 상태 push를 구독하며 polling하지 않는다. Plugin API 호출, Usage fetch,
Harness 환경변수 생성은 이 버튼의 책임이 아니다.

TO-BE에서도 인증 성공 직후 모든 소비 feature를 강제로 실행하지 않는다. Auth는 상태 변경을
알리고, 각 feature가 자기 실행 시점이나 자기 refresh 정책에서 인증된 능력을 사용한다.

---

## 문제 진단

현재 구조의 핵심 문제는 공통 인증 코드가 존재한다는 사실이 아니다. 인증 대상을 중심으로
서로 다른 기능까지 contribution으로 모으는 방향이다.

| 집적 지점 | 왜 과한가 | TO-BE |
|---|---|---|
| `Provider.kind`가 gate/LLM/service를 분류 | 인증 코어가 소비자의 제품 분류를 알아야 한다 | Auth 정의에는 소비 kind를 두지 않는다 |
| `Provider.llm` | Auth 계약이 Harness runtime env 형상을 안다 | Harness 모듈이 Auth를 소비해 전체 실행 구성을 만든다 |
| `Provider.tools` | Auth 계약이 Plugin tool contribution을 안다 | Plugin 모듈이 자기 도구를 만들고 Bootstrap이 등록한다 |
| `ProviderApi.materialize` | Auth 코어가 env/header 결과물을 만든다 | 일반 소비는 bound request를 사용하고 raw credential은 trusted-main 포트로 격리한다 |
| `ProviderPlatform` | 인증, gate, 카탈로그, Harness/Plugin 소비 표면이 한 facade에 모인다 | `AuthRuntime`만 남기고 소비 조립은 Bootstrap으로 이동한다 |
| `declarations/` 단일 진입점 | 한 파일 묶음이 모든 제품 기능의 확장 host처럼 보인다 | 배포 구성도 Auth/Harness/Plugin/Usage별 작은 모듈로 분리한다 |

공통화할 것은 실제로 여러 기능이 똑같이 필요로 하는 인증 lifecycle과 안전한 전송뿐이다.
endpoint별 요청·응답은 공통화하지 않는다.

---

## TO-BE 책임 경계

### AuthRuntime

AuthRuntime은 다음만 소유한다.

- Auth 정의 등록과 안정된 `AuthId`
- API key/PAT/password/OAuth/browser-session 로그인
- PKCE/state, Grant, vault, expiry, 재인증, 해제
- session group과 cookie jar lifecycle
- origin/redirect/예약 header/응답 크기 정책을 적용한 인증된 요청
- 401/403 관측 시 Auth 상태 강등
- renderer에 secret이 없는 상태 DTO push

Auth 정의에는 `kind: 'gate' | 'llm' | 'service'`, `tools`, `llm`, `usage`를 두지 않는다.
Auth 코어는 자신이 Gate에 사용되는지 알지 않는다. 부팅 resume 순서는 app composition이 소유하며,
필수 gate Auth를 먼저 확인하고 gate가 통과한 뒤 나머지 복원 가능한 Auth probe를 현재처럼 병렬
실행한다. Auth별 probe가 끝날 때마다 전체 상태를 다시 계산·broadcast하는 경로를 되살리지 않는다.

```ts
interface AuthDefinition {
  id: AuthId
  label: string
  origin: string
  methods: readonly AuthMethod[]
  probe?: AuthProbe
}

interface AuthSnapshot {
  authId: AuthId
  status: AuthStatus
  // Grant가 존재하는 것과 실제 probe를 통과한 것을 구분한다. gate는 둘 다 요구한다.
  verified: boolean
  // 실행 credential 또는 그 사용 가능성이 실제로 바뀔 때만 증가하는 메모리 단조 값이다.
  // 입력 form, OAuth code 대기, resuming, 실패 message 같은 UI step에서는 증가하지 않는다.
  credentialRevision: number
  activeMethod?: AuthMethodKind
  principalId?: string
  expiresAt?: number
}

type AuthSnapshotChangeCause =
  | 'credential-committed'
  | 'revoked'
  | 'expired'
  | 'unauthorized'
  | 'verified'

type AuthChange =
  | {
      kind: 'snapshot'
      authId: AuthId
      cause: AuthSnapshotChangeCause
      snapshot: AuthSnapshot
      // Harness runtime config는 이것이 true인 change만 무효화한다.
      credentialChanged: boolean
    }
  | { kind: 'step'; authId: AuthId; step: AuthStep | null }

// renderer와 app view mapper가 읽는 secret-free 설명이다.
interface AuthDescriptor {
  authId: AuthId
  label: string
  origin: string
  methods: readonly AuthMethodDescriptor[]
}

interface BoundAuth {
  readonly authId: AuthId
  snapshot(): AuthSnapshot

  request(
    request: AuthenticatedRequest,
    signal?: AbortSignal
  ): Promise<AuthenticatedResponse>
}

interface AuthRuntime {
  bind(authId: AuthId): BoundAuth
  tryBind(authId: AuthId): BoundAuth | null
  describe(authId: AuthId): AuthDescriptor
  currentStep(): AuthStep | null
  subscribe(listener: (change: AuthChange) => void): () => void

  // Auth 하나의 복원된 Grant를 probe한다. 순서·병렬성·step 노출 여부는 app composition이 정한다.
  // emitVerifiedChange:false는 부팅 batch의 성공 알림만 지연한다. expiry/401/403은 항상 즉시 emit한다.
  resume(
    authId: AuthId,
    options?: { exposeStep?: boolean; emitVerifiedChange?: boolean }
  ): Promise<void>
  login(authId: AuthId, method?: AuthMethodKind, input?: Record<string, string>): Promise<AuthStep>
  continue(authId: AuthId, input: Record<string, string>): Promise<AuthStep>
  reauth(authId: AuthId, method?: AuthMethodKind): Promise<AuthStep>
  revoke(authId: AuthId): void
}

// createAuthRuntime의 app composition 결과에만 둔다. RouterContext, renderer IPC와 일반
// feature dependency에는 전달하지 않는다. MCP resolver가 동기이므로 read도 동기 계약이다.
interface AuthSecretReader {
  read(authId: AuthId): string | null
}
```

`AuthChange`는 renderer 갱신 이벤트와 실행 credential invalidation을 한 boolean으로 뭉개지 않는다.
소비 규칙은 다음으로 고정한다.

| Auth 변화 | GUI snapshot/step push | Gate 재평가 | Plugin tool sync | Harness config invalidate |
|---|---:|---:|---:|---:|
| 입력 form, OAuth code 대기, `resuming`, 오류 message | O | O | X | X |
| 기존 Grant의 probe 성공으로 `verified`만 변경 | O | O | X | X |
| credential commit, revoke, expiry, 401/403 강등 | O | O | O | 영향 key만 O |

재인증은 기존 Grant와 vault 값을 새 인증의 probe 성공 전까지 보존한다. 새 인증이 실패하면 기존
credential과 `credentialRevision`은 그대로다. 성공한 credential commit, revoke, expiry와 401/403
강등만 실행 구성에 영향을 주는 change다. 같은 상태를 다시 읽었다고 revision을 반복 증가시키거나
change를 재발행하지 않는다. 시간 기반 만료는 기존 snapshot/request/resume 판정 지점에서 처음
관측될 때 한 번 전이하며, 이 리팩터링을 이유로 polling을 추가하지 않는다.

`AuthenticatedRequest`와 `AuthenticatedResponse`는 현재 `ProviderRequest`/`ProviderResponse`의 이름을
Auth 책임에 맞게 바꾸되 표면을 축소하지 않는다.

```ts
interface AuthenticatedRequest {
  path: string
  method?: string
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: string
  responseType?: 'text' | 'binary'
  maxBytes?: number
}

interface AuthenticatedResponse {
  ok: boolean
  status: number
  finalUrl: string
  headers: Record<string, string>
  body: string
  bodyBytes?: Uint8Array
}
```

Confluence 첨부 다운로드가 쓰는 binary body와 크기 상한, probe가 쓰는 `finalUrl`, redirect hop마다의
origin 재검사와 Grant 변경 fence를 모두 유지한다. `AbortSignal`도 redirect와 browser-session 전송
끝까지 전달한다.

`materialize()`는 제거한다. 환경변수 이름, ModelProvider URL, 모델 변수와 서비스별 header 조립은
Auth의 지식이 아니다. HTTP credential presentation은 `BoundAuth.request()` 내부에 유지한다.
Confluence와 Usage 같은 일반 기능은 raw secret을 받지 않는다.

MCP `${BINDING:<id>}`와 Harness subprocess에 API key/token을 직접 넣어야 하는 경우만
`AuthSecretReader`를 사용한다. Bootstrap은 MCP에 `(id) => secretReader.read(id)`라는 좁은 closure만
전달한다. Harness 배포 factory에도 전체 reader 대신 특정 AuthId를 닫은 `() => string | null`만
전달한다. 이것은 기존 설정 호환을 위한 raw 값 조회이지 env/header materializer가 아니다.

raw cookie 목록을 일반 포트로 내보내지 않는다. session 기반 호출은 `BoundAuth.request()`가 같은
Electron partition을 사용하면 충분하다. 특정 기능이 정말 cookie 원문을 요구할 때만 별도 보안
검토를 거쳐 좁은 포트를 추가한다.

OAuth code exchange, browser-session의 인증용 token exchange와 `whoami`는 Auth lifecycle이므로
유지한다. “범용 response mapping DSL 금지”는 Harness runtime config, Usage, Plugin 응답을 하나의
DSL로 만들지 말라는 뜻이며, 현재 Auth 방식이 인증 결과를 Grant로 만드는 좁은 교환 계약까지
삭제하라는 뜻이 아니다. OAuth access token 또는 session exchange token과 이후 config API가 반환한
LLM 실행 token은 서로 다른 값으로 취급한다.

### Gate

Gate는 Auth의 내부 lifecycle이 아니라 특정 Auth 상태를 앱 접근 조건으로 소비하는 별도 정책
feature다. 따라서 `features/gate/`에 두며 Auth는 자신이 Gate에 사용되는지 알지 않는다.

Gate는 `snapshot().status === 'valid'`만 보지 않고 `verified === true`까지 요구한다. gate로 쓰는
정의는 배포 모듈에서 `AuthDefinition & { probe: AuthProbe }`로 compile-time 제한하고, 부팅
composition에서도 probe 없는 gate를 fail-closed한다. Grant 복원만으로 gate가 영구 통과했던 과거
회귀를 되살리지 않는다.

### Auth 등록 위치

구체 Auth 대상, 사내 origin과 인증 방식은 `app/src/main/app/deployment/auth-definitions.ts`에서
build-time 상수로 등록한다. Auth 코어에 Confluence, Usage, Claude, OpenCode나 GUI category를 넣지
않는다.

아래 `CORP_*` 이름과 endpoint는 배선 형상을 설명하는 placeholder다. 구현 시 현재 배포의
`GATE_PROVIDERS`, `LLM_PROVIDERS`, `SERVICE_PROVIDERS`와 실제 Usage Auth만 같은 id·순서로 옮긴다.
기본 `main`의 빈 선언에 예시 Auth를 새로 추가하거나 가짜 사내 URL을 production 값으로 넣지 않는다.
리팩터링 전 GUI에 없던 Usage 전용 row도 만들지 않는다.

```ts
export const CORP_SSO_AUTH = {
  // label, origin, methods, probe는 실제 배포 값을 사용한다.
  ...corpSsoDefinition,
  id: 'corp-sso'
} satisfies AuthDefinition & { probe: AuthProbe }

export const CONFLUENCE_AUTH = {
  ...confluencePatDefinition,
  id: 'confluence'
} satisfies AuthDefinition

export const CORP_LLM_AUTH = {
  ...corpLlmOAuthDefinition,
  id: 'corp-llm'
} satisfies AuthDefinition

export const CORP_USAGE_AUTH = {
  ...corpUsageOAuthDefinition,
  id: 'corp-usage'
} satisfies AuthDefinition

export const AUTH_DEFINITIONS = [
  CORP_SSO_AUTH,
  CONFLUENCE_AUTH,
  CORP_LLM_AUTH,
  CORP_USAGE_AUTH
] as const
```

위 상수의 `.id`를 Bootstrap, view composition과 secret closure에서 재사용한다. 같은 문자열을 각
feature에 다시 적거나 `authId` 기반 generic feature join을 만들지 않는다. 실제 배포에서 하나의
Auth가 여러 기능에 쓰이면 같은 `BoundAuth` 객체를 각 concrete factory에 전달하며 AuthDefinition을
복제하지 않는다. 필수 gate membership만 `app/deployment/gate-auth.ts`가 별도 객체 참조 목록으로
소유한다.

### Harness + ModelProvider

Harness 영역은 선택, settings, Model 목록, runtime config와 respawn 경계를 소유한다. 다만 별도의
`HarnessModelProviderDefinition[]`이나 definition registry를 만들지 않는다.

`sources/settings/<harness>/<modelProvider>/` 디렉터리는 선택 가능한 ModelProvider 설정 entry와
Model 목록의 SSOT다. 실행 가능한 Harness 자체의 SSOT는 기존 `AdapterRegistry`/`SessionAdapter`다.
settings 디렉터리가 있다는 이유만으로 해당 Harness를 실행 가능하다고 판정하지 않는다.

기존 settings entry 위에 필요한 동적 실행 환경만 선택적으로 보강한다.

```ts
interface HarnessModelProviderEntry {
  key: HarnessModelProviderKey
  harnessId: HarnessId
  modelProviderId: ModelProviderId
}

interface ResolvedHarnessSettings {
  key: HarnessModelProviderKey
  settings: HarnessNativeSettings

  // 기존 source path + mtime 판정에서 만든 opaque revision.
  // 외부 파일 편집도 다음 resolve에서 달라져야 한다.
  sourceRevision: string
}

interface HarnessRuntimeConfig {
  key: HarnessModelProviderKey
  harnessId: HarnessId
  modelProviderId: ModelProviderId

  // Harness native 설정. Claude에서는 options.settings로 전달한다.
  settings?: ResolvedHarnessSettings

  // 동적 subprocess overlay. credential뿐 아니라 URL·모델 변수·flag를 포함한다.
  // app/process/settings env와의 최종 병합은 Harness별 spawn preparation이 수행한다.
  runtimeEnv: Readonly<Record<string, string>>

  // 동적 token/config의 사용 기한. 없으면 명시 무효화 전까지 cache할 수 있다.
  validUntil?: number
}

// 기존 TurnRequest.providerSettings / TurnRequest.env로 분해해 전달할 최종 spawn 입력이다.
interface PreparedHarnessConfig {
  providerSettings?: ResolvedHarnessSettings
  env?: Readonly<Record<string, string>>
  // 위 두 실제 adapter 입력만 정규화해 만든 메모리 전용 비교값이다.
  runtimeConfigFingerprint: string
}

interface RuntimeConfigAugmenter {
  resolve(
    input: {
      key: HarnessModelProviderKey
      settings?: ResolvedHarnessSettings
    },
    signal?: AbortSignal
  ): Promise<{
    runtimeEnv: Readonly<Record<string, string>>
    validUntil?: number
  }>
}

type RuntimeConfigAugmenters = Readonly<
  Partial<Record<HarnessModelProviderKey, RuntimeConfigAugmenter>>
>

interface HarnessRuntimeConfigService {
  resolve(
    entry: HarnessModelProviderEntry,
    signal?: AbortSignal
  ): Promise<HarnessRuntimeConfig>

  invalidate(key?: HarnessModelProviderKey, reason?: string): void
}
```

`RuntimeConfigAugmenters`는 catalog가 아니다. entry를 열거하거나 선택하지 않고, 기존 settings SSOT가
선택한 key에 동적 보강 코드가 있는지만 조회한다. 매핑에 key가 없으면 기존 settings와 app env만으로
동작한다. `HarnessRuntimeConfigService`는 settings resolve, 선택적 augmenter, cache, single-flight와
expiry 정합성만 소유한다. Harness별 spawn preparation은 native settings와 env 우선순위를 실제
adapter 입력으로 조립하고 `runtimeConfigFingerprint`를 계산한다. endpoint·JSON path·모델 매핑을
DSL로 만들지 않는다.

#### `llm.ts`의 수정된 의미

현재 `declarations/llm.ts`에 대응하는 TO-BE 모듈은 새로운 ModelProvider 정의 목록이 아니다.
권장 위치 `app/src/main/app/deployment/harness-runtime.ts`에서, 기존 key에 필요한 augmenter만
build-time으로 연결한다. AuthId와 Harness key는 문자열을 반복하지 않고 각 배포 상수를 재사용한다.

OAuth token과 LLM token이 다른 폐쇄망의 예시는 다음과 같다.

```ts
export const CLAUDE_CORP_KEY = harnessModelProviderKey('claude', 'corp')

export function createRuntimeConfigAugmenters(deps: {
  corpAuth: BoundAuth
}): RuntimeConfigAugmenters {
  return {
    [CLAUDE_CORP_KEY]: {
      async resolve(_input, signal) {
        if (deps.corpAuth.snapshot().status !== 'valid') {
          throw new Error('corp model provider authentication required')
        }

        // 여기 실리는 OAuth/session은 config API 접근 권한이다.
        const response = await deps.corpAuth.request({ path: '/api/llm/config' }, signal)
        if (!response.ok) throw new Error(`llm config request failed: ${response.status}`)

        // parse와 매핑은 이 배포 모듈이 소유한다. AuthRuntime은 body 형상을 모른다.
        const config = parseCorpLlmConfig(response.body)
        return {
          runtimeEnv: {
            ANTHROPIC_AUTH_TOKEN: config.llmToken,
            ANTHROPIC_BASE_URL: config.url,
            ANTHROPIC_DEFAULT_OPUS_MODEL: config.models.opus,
            ANTHROPIC_DEFAULT_SONNET_MODEL: config.models.sonnet,
            ANTHROPIC_DEFAULT_HAIKU_MODEL: config.models.haiku
          },
          validUntil: config.expiresAt
        }
      }
    }
  }
}
```

정적 환경은 augmenter 없이 기존 settings만 사용한다. 사용자가 입력한 API key를 Harness에 직접
전달해야 하는 배포는 `AuthSecretReader` 전체를 넘기지 않고
`() => secretReader.read(CORP_LLM_AUTH.id)`를 닫아 만든 **별도 direct-credential augmenter**를
사용한다. config API 방식의 augmenter에는 `AuthSecretReader`를 전달하지 않는다.

```text
config API 방식
BoundAuth.request → OAuth/session으로 API 접근 → 응답의 실제 LLM token·URL·Model 변수

direct credential 방식
닫힌 readSecret() → 사용자가 입력한 API key/token을 runtimeEnv에 직접 배치
```

두 방식을 한 factory가 동시에 받게 하지 않는다. OAuth access token을 config 응답의 LLM token으로
오인할 여지를 타입과 배선에서 제거한다. API key 하나든 config API 응답이든 augmenter의 결과는
Harness 실행에 필요한 **전체 환경변수 overlay**를 표현할 수 있다. Auth snapshot에 만료가 있으면
direct credential augmenter의 `validUntil`에도 반영한다.

#### Cache와 stale commit 차단

공개 `inputRevision()` 같은 범용 dependency 계약은 만들지 않는다. 그렇다고 revision 개념까지
없애면 안 된다. `HarnessRuntimeConfigService`는 key별로 다음 **현재 세대 하나**의 메모리 상태를
소유한다. 세대를 cache key로 계속 쌓는 Map은 이전 secret을 메모리에 남기므로 만들지 않는다.

```text
generation + sourceRevision + cached value + in-flight operation
```

- `credentialChanged:true`인 Auth change, 명시 refresh와 app의 settings CRUD/deploy invalidation만
  영향받는 key의 `generation`을 올린다. 입력 form·OAuth 단계·실패 message와 `verified`-only change는
  generation을 바꾸지 않는다.
- invalidation은 cached value와 이전 in-flight 참조를 즉시 제거하고 service-owned
  `AbortController`를 best-effort로 abort한다. abort 성공 여부와 무관하게 completion fence를 검사한다.
- settings 수정은 `ResolvedHarnessSettings.sourceRevision` 변화로 cache miss가 된다. 앱의
  CRUD/deploy는 즉시 invalidate하며, 외부 파일 편집은 현재와 같이 다음 settings resolve의 mtime
  검사에서 발견한다. 외부 편집을 진행 중 요청 한가운데서 감지한다고 약속하지 않는다.
- 실행 중 resolve는 시작 시 `generation`과 `sourceRevision`을 캡처한다. 성공 후 generation이
  바뀌었으면 결과를 cache하거나 현재 caller에 반환하지 않고 최신 세대로 제한된 재시도를 한다.
  caller signal이 취소됐거나 최신 Auth가 invalid이면 재시도하지 않고 해당 오류를 전파한다.
- 같은 key, generation, sourceRevision만 single-flight를 공유한다. 공유 작업은 service-owned signal을
  사용한다. 개별 caller의 AbortSignal은 그 caller의 대기만 취소하며 다른 caller의 요청을 취소하지
  않는다. invalidation만 공유 작업을 abort한다.
- `validUntil`은 clock skew를 고려한 작은 안전 여유를 두고 판정한다. 만료된 결과는 cache hit가
  아니며, 실패 결과는 성공 cache처럼 장기 보관하지 않는다.

이 규칙이 없으면 재인증 중 시작된 옛 config 요청이 무효화 뒤 완료되어 낡은 token을 다시 cache에
넣을 수 있다. 그 경우 fingerprint도 옛 값과 같아 persistent runtime이 잘못 재사용되므로 반드시
generation fence를 구현한다.

stale 결과 재시도 중 다시 generation이 바뀌는 경우 무한 루프를 만들지 않는다. bounded retry를
소진하면 명시적인 stale-config 오류를 반환하며, 401/403으로 Auth가 강등된 요청은 자동 재시도하지
않는다.

`parseCorpLlmConfig`는 token, URL과 배포가 요구하는 Opus/Sonnet/Haiku 식별자를 모두 검증한다. 필수
값이 없거나 빈 문자열이면 부분 env를 cache하거나 기존 값과 섞지 말고 resolve를 실패시킨다.

#### settings와 env 전달

현재 `settings.json`과 `options.env`의 두 주입 채널은 유지한다. 하나로 평탄화하면 Claude settings
우선순위가 바뀔 수 있다. TO-BE의 변화는 두 채널의 최종 조립을 Harness runtime config가 담당하는
것이지, 전달 방식을 임의로 바꾸는 것이 아니다.

적용 우선순위의 의미는 다음으로 고정한다.

```text
runtime config augmenter env
  > 선택된 Harness + ModelProvider settings의 env
  > app env
  > 상속된 process env
```

같은 키가 있을 때 이 결과가 되도록 Claude adapter의 spawn preparation이 두 채널을 조립한다. 구현
전에 `options.settings.env`와 `options.env`의 실제 충돌 동작을 characterization test로 고정한 뒤 아래
결정표를 그대로 적용한다.

| 실측 결과 | adapter-local 조립 |
|---|---|
| `options.settings.env`가 우선 | settings의 env 중 `runtimeEnv`와 충돌하는 key만 in-memory copy에서 제거한다. app env는 `options.env`, 동적 값은 같은 `options.env`의 최종 overlay로 둔다. |
| `options.env`가 우선 | inherited → app → settings env → `runtimeEnv` 순으로 최종 `options.env`를 만들고, in-memory settings copy에서는 env를 제거해 이중 적용을 막는다. |

어느 결과든 디스크 `settings.json`은 수정하지 않는다. Auth에서 얻은 secret과 config API의 LLM token은
`options.settings`나 argv에 복제하지 않고 `options.env`에만 둔다. 기존 settings의 비-env 항목은
`options.settings` 채널을 그대로 사용한다. 동적 값과 충돌하지 않는 기존 settings env의 최종
subprocess 값도 변경 전과 같아야 한다.

최초 사용자 turn은 `HarnessRuntimeConfig`를 한 번 resolve하고 `PreparedHarnessConfig`를 한 번 만든다.
그 turn의 chat Harness와 title generation은 같은 prepared snapshot을 사용한다. 자동 continuation은
현재 `prepareAutomaticContinuation()`의 settings freshness 의미를 유지해 continuation마다 전체 runtime
config를 한 번 다시 resolve한다. 같은 continuation의 listen/flush는 그 결과 하나를 공유한다. warm
cache에서는 원격 재조회하지 않으며, 새 fingerprint가 spawn 당시 값과 다르면 continuation 전에
channel을 teardown한다. settings만 새로 보고 dynamic env는 최초 값으로 유지하는 비대칭을 만들지
않는다.

`PreparedAutomaticContinuation`은 fresh `PreparedHarnessConfig`를 포함해야 한다. `buildListenRequest()`와
`buildFlushRequest()` 모두 그 객체의 `providerSettings`와 `env`를 같은 값으로 전달한다. env는
spawn-bound이므로 살아 있는 channel의 push에는 재주입되지 않지만, fingerprint 변경·도구 변경·모델
변경 또는 예기치 않은 channel 종료로 어느 분기에서든 새 spawn이 필요할 때 fresh env가 빠지지 않아야
한다. 특히 현재 listen request가 env를 생략하는 형상을 그대로 두지 않는다.

`runtimeConfigFingerprint`는 spawn preparation이 adapter에 실제 전달하는 native settings와 최종 env를
key 정렬된 canonical form으로 계산한다. 원문·secret·fingerprint를 로그나 DB에 남기지 않는다.
`SessionRuntime`은 spawn 당시 값을 보관하고 다음 사용자 turn 또는 자동 continuation의 값이 다르면
기존 channel을 teardown한 뒤 respawn한다. ModelProvider key가 같아도 token, URL,
Opus/Sonnet/Haiku 변수나 flag가 달라지면 stale subprocess를 재사용하지 않는다.

이 fingerprint는 env와 settings만의 비교값이다. 기존의 Harness + ModelProvider boundary, 선택 Model,
Runtime Tool revision 판정은 별도로 유지한다. 이 값들을 “전체 spawn fingerprint”라는 이름 아래
중복하거나 기존 판정을 제거하지 않는다.

Model 선택 UI는 현재처럼 `sources/settings/<harness>/<modelProvider>/settings.json`에서 파생한다.
runtime API가 돌려주는 모델 환경변수는 우선 실행 구성에만 반영한다. 동적 응답을 카탈로그 Model
목록까지 반영하려면 별도 제품 결정이 필요하며, 이 리팩터링에서 UI 동작을 바꾸지 않는다.

### Plugin과 Usage

Confluence는 Auth의 service contribution이 아니라 독립 Plugin이다.

```text
features/plugins/confluence/
  ├─ rest.ts
  ├─ connector.ts
  ├─ tools.ts
  ├─ storage-to-markdown.ts
  ├─ search-render.ts
  └─ download-store.ts
```

Confluence 모듈은 `BoundAuth.request`와 자기 옵션만 받는다. Plugin 카탈로그 메타데이터는 정적
DTO이고, 임의 코드 로딩 host가 아니다. Runtime Tool은 Plugin 모듈이 **한 번만** 만들고 Bootstrap이
기존 `RuntimeToolRegistry`에 인증 상태에 따라 등록하거나 회수한다.

```ts
const confluenceAuth = auth.bind(CONFLUENCE_AUTH.id)
const confluencePlugin = createConfluencePlugin({
  request: confluenceAuth.request.bind(confluenceAuth),
  apiBasePath: '/confluence'
})
const confluenceToolServer = confluencePlugin.createToolServer()

function syncConfluenceTools(): void {
  if (confluenceAuth.snapshot().status === 'valid') {
    runtimeTools.add(confluenceToolServer)
  } else {
    runtimeTools.remove(confluenceToolServer.descriptor.id)
  }
}

syncConfluenceTools()
auth.subscribe((change) => {
  if (
    change.kind === 'snapshot' &&
    change.authId === CONFLUENCE_AUTH.id &&
    change.credentialChanged
  ) {
    syncConfluenceTools()
  }
})
```

도구 서버와 handler closure를 매 sync마다 다시 만들면 `RuntimeToolRegistry`의 identity 비교가 달라져
revision이 불필요하게 증가하고 persistent runtime이 매번 respawn할 수 있다. 따라서 같은
`confluenceToolServer` 인스턴스를 재사용한다. credential commit·재인증 성공·해제·만료·401/403
강등은 위 sync를 호출하지만 Confluence 검색 API를 eager 실행하지 않는다. `verified`-only snapshot과
UI step은 sync하지 않는다. `syncConfluenceTools` 같은 작은 helper만
허용하며 PluginHost, connector contribution registry, transaction store를 다시 만들지 않는다.

GUI의 `ProviderInfo.tools`는 “현재 RuntimeToolRegistry에 등록된 서버만의 목록”이 아니다. 현재 화면은
연결이 끊겨도 같은 cached server descriptor에서 완전 도구 이름을 보여 주고 `status`로 비활성 안내를
표시한다. TO-BE도 descriptor의 이름 목록은 유지하고, 실제 Harness 노출 여부만 registry add/remove로
제어한다. 따라서 invalid Auth에서 GUI `tools`를 빈 배열로 바꾸지 않는다.

#### Plugin과 HarnessPlugin은 합치지 않는다

`features/plugins/confluence/`의 Plugin은 GUI 카탈로그에서 사용자가 인증하고 기능을 쓰는 제품
단위다. 반면 현재 `features/extensions/claude-plugin-package.ts`가 만드는 산출물은 Claude가 직접
로드하는 **ClaudeHarnessPlugin**이다. 둘은 이름에 plugin이 들어갈 뿐 lifecycle과 소비자가 다르다.

```text
Plugin
  └─ Orca GUI가 표시·인증·관리하고 Runtime Tool 등을 제공

HarnessPlugin
  └─ Harness 규약에 맞춰 렌더한 package를 Harness가 직접 로드
```

따라서 Confluence Plugin을 `features/extensions`에 넣거나 ClaudeHarnessPlugin packaging을
`features/plugins`에 넣지 않는다. 기존 packaging symbol을 정리할 때는
`renderClaudeHarnessPlugin`, `builtInHarnessPluginRoot`처럼 책임을 드러내고 제품명 prefix를 새로
붙이지 않는다. manifest의 기존 package id처럼 외부 호환성에 걸린 문자열은 migration 없이
바꾸지 않는다.

Usage는 현재 `features/usage/UsageFetcher` 경계를 유지한다. 폐쇄망 구현은 별도 배포 모듈에 둔다.

```ts
import { CLAUDE_CORP_KEY } from './harness-runtime'

export function createCorpUsageFetcher(auth: BoundAuth): UsageFetcher {
  return {
    supports: (key) => key === CLAUDE_CORP_KEY,
    async fetchUsage(key, signal) {
      const response = await auth.request({ path: '/api/usage' }, signal)
      if (!response.ok) throw new Error(`usage request failed: ${response.status}`)
      return mapCorpUsageSnapshot(key, response.body)
    }
  }
}
```

Auth는 `/api/usage`와 `UsageSnapshot`을 모른다. Harness 모듈도 Usage endpoint를 모른다. Scheduler는
기존처럼 `UsageFetcher`를 호출할 뿐이다.

`supports(key)`는 이 배포가 해당 key의 원격 사용량을 지원하는지를 말하며 현재 Auth 상태를 말하지
않는다. 미인증·만료 상태에서 `supports:false`로 숨기지 말고 `fetchUsage()`가 Auth 오류를 정상적으로
전파하게 한다. 재인증·해제는 저장된 마지막 `UsageSnapshot`을 임의 삭제하지 않는다. Main 정본,
renderer mirror, cron/manual refresh와 DB cache의 기존 의미를 유지한다.

`mapCorpUsageSnapshot`은 `asOf`가 billing aggregation watermark임을 배포가 확인한 경우에만
`baselineUsable:true`를 설정한다. 단순 응답 생성 시각이면 false로 두어 원격 값과 로컬 turn을
중복 합산하지 않는다.

---

## 디렉터리 구조

### AS-IS

```text
app/src/main/
├─ contracts/
│  └─ provider.ts
├─ features/
│  ├─ providers/
│  │  ├─ auth/
│  │  ├─ gate/
│  │  ├─ llm/
│  │  ├─ service/confluence/
│  │  ├─ declarations/
│  │  ├─ platform.ts
│  │  ├─ provider-registry.ts
│  │  ├─ provider-settings.ts
│  │  ├─ claude-model-parser.ts
│  │  ├─ model-resolve.ts
│  │  ├─ env-merge.ts
│  │  ├─ provider-boundary.ts
│  │  └─ engine-write.ts
│  └─ usage/
└─ app/
   └─ bootstrap.ts
```

### TO-BE

```text
app/src/main/
├─ contracts/
│  └─ auth.ts
├─ adapters/
│  └─ harness-config.ts
├─ features/
│  ├─ auth/
│  │  ├─ registry.ts
│  │  ├─ store.ts
│  │  ├─ store-file.ts
│  │  ├─ login.ts
│  │  ├─ oauth.ts
│  │  ├─ oauth-runner.ts
│  │  ├─ policy.ts
│  │  ├─ present.ts
│  │  ├─ authenticated-request.ts
│  │  ├─ secret-access.ts
│  │  ├─ session-policies.ts
│  │  ├─ specs/
│  │  │  ├─ credential.ts
│  │  │  └─ browser-session.ts
│  │  ├─ browser-session/
│  │  │  └─ runner.ts
│  │  └─ runtime.ts
│  ├─ gate/
│  │  └─ index.ts
│  ├─ harnesses/
│  │  ├─ settings-entries.ts
│  │  ├─ settings.ts
│  │  ├─ models.ts
│  │  ├─ env.ts
│  │  ├─ runtime-config.ts
│  │  ├─ runtime-boundary.ts
│  │  ├─ settings-write.ts
│  │  └─ claude/
│  │     └─ model-parser.ts
│  ├─ plugins/
│  │  └─ confluence/
│  ├─ extensions/
│  │  └─ harness-plugins/
│  │     └─ claude.ts
│  └─ usage/
└─ app/
   ├─ deployment/
   │  ├─ auth-definitions.ts
   │  ├─ gate-auth.ts
   │  ├─ harness-runtime.ts
   │  ├─ plugins.ts
   │  └─ usage-fetcher.ts
   ├─ connection-views.ts
   └─ bootstrap.ts
```

`app/deployment/`는 런타임 동적 plugin 디렉터리가 아니다. 배포별 TypeScript가 compile time에
조립되는 컴포지션 루트의 일부다. `src/main`의 허용 레이어 밖에 새 최상위 디렉터리를 만들지 않는다.

`features/auth/browser-session/runner.ts`는 로그인 흐름을 소유한다. Electron partition과 cookie jar
전송을 구현하는 기존 `infra/browser-session/`은 infra에 그대로 둔다. 디렉터리 이동을 이유로 Electron
구현을 feature 안으로 끌어올리지 않는다.

Harness 설정 loader와 native settings 타입을 `contracts/harness.ts`에 두지 않는다. 이 값은
`SessionAdapter`가 직접 소비하는 입력이므로 현재 `adapters/provider-config.ts`와 같은 adapter port
위치가 맞다. `HarnessRuntimeConfig`와 service는 `features/harnesses/runtime-config.ts`가 소유하고,
턴 조립 시 기존 `TurnRequest.env`와 `TurnRequest.providerSettings` 호환 필드로 분해한다.
`features/harnesses`는 adapter port를 import할 수 있지만 adapter가 contracts를 역으로 import하도록
만들면 main 레이어 DAG를 위반한다.

`ResolvedHarnessSettings.sourceRevision`은 settings feature가 cache 정합성을 위해 감싼 메타데이터이며
Harness native settings JSON의 일부가 아니다. adapter에는 `settings` 값만 전달하고 `sourceRevision`을
`options.settings`에 섞지 않는다.

### 파일 이동표

| AS-IS | TO-BE | 처리 |
|---|---|---|
| `contracts/provider.ts`의 AuthSpec/Grant/request | `contracts/auth.ts` | 이름과 책임을 Auth로 좁힘 |
| `contracts/provider.ts`의 `Provider.llm/tools` | 없음 | 소비 feature로 이동 후 삭제 |
| `adapters/provider-config.ts` | `adapters/harness-config.ts` | adapter가 소비하는 native settings loader 계약 유지 |
| `features/providers/auth/**` | `features/auth/**` | 동작 유지 이동 |
| `features/providers/auth/registry.ts` | `features/auth/registry.ts` | AuthDefinition 등록만 담당 |
| `features/providers/auth/store.ts` | `features/auth/store.ts` | AuthId → Grant와 verified 상태 유지 |
| `features/providers/auth/api.ts` | `features/auth/authenticated-request.ts`, `secret-access.ts` | 일반 bound request와 trusted-main raw secret 포트를 분리 |
| `features/providers/gate/**` | `features/gate/**` | Auth를 소비하는 앱 접근 정책으로 독립 |
| `features/providers/platform.ts` | `features/auth/runtime.ts`, `app/connection-views.ts` | 인증 lifecycle과 GUI view 조립을 분리하고 `declarations/materialize/toolsOf` 제거 |
| `features/providers/provider-registry.ts` | `features/harnesses/settings-entries.ts` | settings 디렉터리의 ModelProvider entry 열거 책임만 반영; 실행 가능 Harness 판정은 adapter registry 유지 |
| `features/providers/provider-settings.ts` | `features/harnesses/settings.ts` | 기존 캐시와 native settings 전달 유지 |
| `features/providers/claude-model-parser.ts` | `features/harnesses/claude/model-parser.ts` | Claude 전용 파서임을 위치로 표현 |
| `features/providers/model-resolve.ts` | `features/harnesses/models.ts` | Model 선택 책임 유지 |
| `features/providers/env-merge.ts` | `features/harnesses/env.ts` | subprocess env 조립 책임 유지 |
| `features/providers/provider-boundary.ts` | `features/harnesses/runtime-boundary.ts` | runtime respawn 판정으로 명확화 |
| `features/providers/engine-write.ts` | `features/harnesses/settings-write.ts` | Engine 어휘 제거 |
| `features/providers/declarations/sso.ts` | `app/deployment/auth-definitions.ts`, `gate-auth.ts` | Auth 정의와 필수 gate membership 분리 |
| `features/providers/declarations/llm.ts` | `app/deployment/harness-runtime.ts` | 기존 settings key에 필요한 optional augmenter만 배선; 새 정의 catalog 금지 |
| `features/providers/llm/**` | `features/harnesses/runtime-config.ts` | settings SSOT 위에서 동적 실행 구성·cache·expiry 해석 |
| `features/providers/declarations/service.ts` | `app/deployment/plugins.ts` | Plugin별 직접 조립 |
| `features/providers/service/confluence/**` | `features/plugins/confluence/**` | 구체 Plugin 소유권으로 이동 |
| `features/providers/service/index.ts` | Plugin별 작은 tool visibility helper | 동일 tool server identity를 재사용하며 인증 상태에 따라 add/remove; 범용 registrar 금지 |
| `features/extensions/claude-plugin-package.ts` | `features/extensions/harness-plugins/claude.ts` | ClaudeHarnessPlugin packaging으로 명확화; 제품 Plugin과 합치지 않음 |
| `features/providers/` | 없음 | 모든 이동과 import 전환 뒤 디렉터리 제거 |

---

## Bootstrap 비교

### AS-IS

```text
Bootstrap.start
  ├─ createProviderPlatform
  │  ├─ declaredProviders() 한 배열 등록
  │  ├─ ProviderStore / vault / browser sessions
  │  ├─ ProviderApi(request/materialize/token)
  │  ├─ ServiceToolRegistrar
  │  └─ ProviderPlatform
  ├─ provider IPC 등록 + resume
  ├─ MCP token source에 ProviderApi.token 연결
  ├─ UsageFetcher optional concrete 구성
  ├─ ProviderSettingsService 생성
  └─ RouterContext에 providers + providerSettings 주입

chat turn
  ├─ providerSettings.resolve(providerKey)
  ├─ llmEnvFor(ProviderApi.materialize)
  └─ settings와 env를 별도 경로로 Harness에 전달
```

### TO-BE

```text
Bootstrap.start
  ├─ [DB 이전] RuntimeToolRegistry + createAuthRuntime(authDefinitions)
  │  ├─ Grant / vault / browser sessions
  │  ├─ AuthenticatedRequest
  │  └─ trusted-main AuthSecretReader
  ├─ [DB 이전] Gate + Plugin concrete + ConnectionView 조립
  │  ├─ cached Plugin tool server 1회 생성 + 초기 visibility sync
  │  ├─ Auth change listener
  │  ├─ connection IPC 조기 등록
  │  └─ gate-first / remaining-parallel async Auth resume
  ├─ [DB 이후] HarnessSettingsService + HarnessRuntimeConfigService 생성
  │  └─ 기존 settings key → optional RuntimeConfigAugmenter 연결
  ├─ 기존 settings scaffold/deploy 수행
  │  └─ 두 settings/runtime cache를 함께 invalidate
  ├─ UsageFetcher concrete 생성
  │  └─ bound Auth request를 UsageTracker에 주입
  └─ RouterContext에 auth + harnessRuntime 주입

chat turn
  ├─ 기존 settings SSOT에서 Harness + ModelProvider + Model 선택
  ├─ HarnessRuntimeConfig 1회 resolve
  │  ├─ native settings
  │  └─ token·URL·모델 변수를 포함한 runtimeEnv
  ├─ Harness별 PreparedHarnessConfig 조립 + fingerprint 비교
  ├─ title generation과 chat에 같은 snapshot 전달
  └─ 기존 settings/env 두 채널로 Harness spawn

automatic continuation
  ├─ 전체 runtime config 1회 재resolve(warm cache 허용)
  ├─ settings + env를 같은 snapshot으로 준비
  └─ fingerprint 변경이면 continuation 전 respawn
```

Bootstrap은 endpoint path, response body, Confluence CQL, UsageSnapshot mapping, Claude 환경변수 이름을
알면 안 된다. 해당 concrete factory를 호출하고 결과 포트를 주입하는 것까지만 한다.

권장 배선 형태는 다음과 같다.

```ts
const { runtime: auth, secretReader } = createAuthRuntime({
  definitions: AUTH_DEFINITIONS,
  ...authDeps
})
this.mcp.attachTokenSource((id) => secretReader.read(id))

const gateAuth = auth.bind(CORP_SSO_AUTH.id)
const corpLlmAuth = auth.bind(CORP_LLM_AUTH.id)
const confluenceAuth = auth.bind(CONFLUENCE_AUTH.id)
const usageAuth = auth.bind(CORP_USAGE_AUTH.id)
const gate = createGate([gateAuth])

const confluence = createConfluencePlugin({
  request: confluenceAuth.request.bind(confluenceAuth),
  apiBasePath: '/confluence'
})
const confluenceToolServer = confluence.createToolServer()
const syncConfluenceTools = (): void => {
  if (confluenceAuth.snapshot().status === 'valid') runtimeTools.add(confluenceToolServer)
  else runtimeTools.remove(confluenceToolServer.descriptor.id)
}
syncConfluenceTools()

auth.subscribe((change) => {
  if (
    change.kind === 'snapshot' &&
    change.authId === CONFLUENCE_AUTH.id &&
    change.credentialChanged
  ) {
    syncConfluenceTools()
  }
})

const connections = [
  // 예시 나열이 아니라, AS-IS GUI row와 같은 순서·개수로 수동 조립한다.
  gateConnection(gateAuth),
  harnessConnection(corpLlmAuth, CLAUDE_CORP_KEY),
  pluginConnection(confluenceAuth, () => toolNames(confluenceToolServer)),
  usageConnection(usageAuth)
]
const { pushConnectionState } = registerConnectionHandlers({ auth, gate, connections })

// gate membership과 resume 순서는 AuthRuntime이 아니라 app composition이 소유한다.
// helper는 Promise를 기억해 gate 재통지에도 remaining resume를 중복 실행하지 않는다.
const resumeRemainingAuthOnce = onceAsync(async () => {
  const candidates = REMAINING_AUTH_DEFINITIONS.filter((definition) => {
    const snapshot = auth.bind(definition.id).snapshot()
    return definition.probe && snapshot.status === 'valid' && !snapshot.verified
  })
  if (candidates.length === 0) return

  await Promise.all(
    candidates.map((definition) =>
      auth.resume(definition.id, { exposeStep: false, emitVerifiedChange: false })
    )
  )
  // 성공한 verified-only 변화는 한 번에 보낸다. 실패 강등은 위 Promise 진행 중에도 즉시 push된다.
  pushConnectionState()
})
const resumeAuthInCurrentOrder = async (): Promise<void> => {
  for (const definition of GATE_AUTH_DEFINITIONS) {
    await auth.resume(definition.id, { exposeStep: true, emitVerifiedChange: true })
  }
  if (gate.state().passed) await resumeRemainingAuthOnce()
}
auth.subscribe((change) => {
  if (change.kind === 'snapshot' && isGateAuthId(change.authId) && gate.state().passed) {
    void resumeRemainingAuthOnce()
  }
})
// 현재 main과 같이 renderer의 첫 state invoke가 DB 초기화를 기다리지 않게 한다.
void resumeAuthInCurrentOrder()

// 이하 구성은 현재처럼 DB 초기화 뒤, settings scaffold/deploy보다 먼저 만든다.
const harnessSettings = new HarnessSettingsService({
  claude: loadClaudeHarnessSettings
})
const harnessRuntime = createHarnessRuntimeConfigService({
  settings: harnessSettings,
  augmenters: createRuntimeConfigAugmenters({ corpAuth: corpLlmAuth })
})
auth.subscribe((change) => {
  if (
    change.kind === 'snapshot' &&
    change.authId === CORP_LLM_AUTH.id &&
    change.credentialChanged
  ) {
    harnessRuntime.invalidate(CLAUDE_CORP_KEY, 'auth-change')
  }
})

// 기존 scaffold → extension deploy 순서를 그대로 실행한 뒤:
harnessSettings.invalidateAll()
harnessRuntime.invalidate(undefined, 'settings-deploy')

const usageFetcher = createCorpUsageFetcher(usageAuth)
const usage = new UsageTracker(db, broadcastUsage, {
  spendingLimitUsd,
  fetcher: usageFetcher
})

const ctx = {
  ...baseContext,
  auth,
  gate,
  harnessRuntime,
  usage
}
```

Auth/Gate/Plugin tool server/Connection handler를 DB 뒤로 미루지 않는다. 현재 main은 renderer가 부팅
완료 전에 연결 상태를 invoke하며, 복원된 service Auth의 도구 이름과 초기 visibility도 첫 snapshot에
필요하다. listener와 초기 tool sync를 resume보다 먼저 완료한다. 이 순서를 바꾸면 로그인 화면이 빈
상태로 멈추거나 첫 turn의 도구 snapshot이 달라질 수 있다. 반면 UsageTracker와 Harness
settings/runtime config는 기존처럼 DB 초기화 뒤에 만든다. settings service 생성 → scaffold → deploy →
`invalidateAll()`의 현재 순서를 보존하고, 마지막 무효화에 runtime config cache도 함께 연결한다.

gate Auth 성공 후 remaining Auth를 probe하는 것은 기존 Auth restore lifecycle의 보존이다. 이 경로는
Usage fetch, Confluence 검색이나 Harness config API를 호출하지 않는다. feature 데이터 조회는 각 feature의
기존 lazy/manual/scheduler 시점에만 수행한다.

remaining batch의 성공한 `verified` 변화는 마지막에 full state를 한 번만 push한다. probe 중
expiry/401/403으로 강등된 Auth는 Plugin tool 회수가 지연되지 않도록 즉시 change를 emit한다. 따라서
현재 sweep의 전체 상태 방송 상한인 `1 + K`(`K` = 즉시 강등 수)를 `N + K`로 악화시키지 않는다.
`emitVerifiedChange:false`가 credential-effective change까지 숨기게 구현하면 안 된다.

`RouterContext.providers`와 `RouterContext.providerSettings`는 각각 `auth`와 `harnessRuntime`으로
교체한다. `secretReader`는 RouterContext에 넣지 않는다. MCP와 특정 Harness augmenter에 닫힌
closure로만 전달한다.
테스트 harness 때문에 optional이 필요한 경우 “미주입 = 미인증/미구성”으로 fail-closed하는 현재
정책을 유지한다.

### 카탈로그 view 조립

현재 renderer는 한 DTO에서 gate/LLM/service 분류, 인증 상태와 노출 도구를 함께 받는다. 내부
책임을 분리하더라도 wire와 화면을 동시에 바꾸지 않는다. app 레이어에서 정적인 view source를
조립해 현재 DTO로 매핑한다.

```ts
type ConnectionViewSource =
  | { category: 'gate'; auth: BoundAuth }
  | {
      category: 'harness'
      auth: BoundAuth
      harnessModelProviderKey: HarnessModelProviderKey
    }
  | {
      category: 'plugin'
      auth: BoundAuth
      toolNames(): readonly string[]
    }
  | { category: 'usage'; auth: BoundAuth }
```

이 타입은 renderer view 조립용이며 `AuthDefinition`에 들어가지 않는다. behavior contribution
registry도 아니다. Bootstrap이 만든 객체 참조를 배열로 묶기 때문에 별도 cross-reference
validator가 필요하지 않다. label, origin과 인증 방식 입력 필드는 `auth.describe(auth.authId)`에서,
상태는 `auth.snapshot()`에서 읽어 중복 선언하지 않는다.

view source는 현재 `ProviderInfo` row의 순서와 개수를 보존하고 `authId`가 중복되지 않아야 한다. 하나의
Auth를 Harness와 Usage 등 여러 feature가 함께 쓰더라도 `BoundAuth`만 각 factory에 재사용하고 GUI row를
feature 수만큼 복제하지 않는다. compatibility category는 기존 row의 표시 의미를 하나만 유지하며,
이 배열을 AuthId 기반 feature join registry로 사용하지 않는다.

기존 `ProviderInfo.kind`가 필요한 동안 app handler에서만 다음처럼 호환한다.

```text
gate     → gate
harness  → llm
plugin   → service
usage    → service
```

mapper는 현재 `ProviderInfo`의 `id`, `label`, `kind`, `origin`, `auth`, `status`, `activeAuthKind`,
`principal`, `expiresAt`, `tools`를 모두 채우고, `ProviderPlatformState.step`에는
`auth.currentStep()`을 넣는다. 이 필드 중 하나를 생략하거나 renderer에 `connection` 같은 새 kind를
추가하지 않는다. `ConnectionViewSource` 객체 자체는 main 전용이며 IPC를 통과하지 않는다.

Plugin row의 `tools`는 동일한 cached RuntimeToolServer descriptor에서 완전 이름을 만들며, Auth가
invalid여도 목록을 유지한다. 실제 registry에서는 server를 회수하고 기존 renderer가 `status`를 보고
“비활성” 안내를 표시한다. active registry 목록으로 DTO `tools`를 만들면 현재 UX가 깨진다.

연결 버튼은 row가 가진 `BoundAuth.authId`로 AuthRuntime의 login/reauth/revoke만 호출한다. Plugin
fetch, Usage refresh와 Harness config resolve를 호출하지 않는다. Auth 상태가 바뀌면 같은 mapper로
현재 `ProviderPlatformState` 형상의 snapshot을 다시 push한다. 신규 도메인 코드 안쪽에서는
`ProviderKind`를 사용하지 않는다. 다만 `shared/ipc.ts`의 `ProviderKind`, `ProviderInfo`,
`ProviderPlatformState`와 protocol schema/channel은 별도 UI migration 전까지 compatibility 계약으로
유지한다.

---

## Harness runtime config의 성능 계약

동적 URL·Model·LLM token을 API에서 가져온다고 해서 매 turn마다 원격 호출하면 안 된다.

| 대상 | 유지할 정책 |
|---|---|
| settings 디렉터리 열거 | 현재 `ProviderSettingsService.listCache`와 같은 메모리 캐시 유지 |
| settings 파일 해석 | 현재처럼 resolve마다 source file mtime을 stat하고, 같은 mtime이면 해석 cache 재사용 |
| 동적 runtime config | `HarnessModelProviderKey + generation + sourceRevision` 기준 현재 세대 cache |
| 동시 첫 조회 | 같은 key·generation·sourceRevision의 요청만 single-flight로 합침 |
| 무효화 | credential-effective Auth change·명시 refresh·app settings 변경·응답 expiry 시 영향 key만 처리 |
| 비동기 완료 | 시작 generation이 달라졌으면 cache와 현재 caller 모두에 반환하지 않음 |
| caller 취소 | 한 caller의 취소는 자신의 대기만 끝내고 공유 operation은 유지; invalidation은 공유 operation abort |
| turn hot path | 기존 settings mtime stat 외에 동적 layer가 network·vault·추가 file 접근을 만들지 않음 |

Auth change 구독은 `credentialChanged:true`일 때만 영향받는 Harness key를 invalidate한다. Plugin은
자기 Auth의 `credentialChanged:true` snapshot에서만 tool visibility를 동기화한다. 모든 Plugin과 모든
ModelProvider를 다시 스캔하지 않는다. settings 변경은 앱 내부 `invalidateAll()`과 외부 파일 편집의
다음 mtime 검사가 각각 새 `sourceRevision`으로 수렴한다.

하나의 Auth가 여러 Harness key를 보강하면 Bootstrap의 해당 구독에서 그 고정 key들만 명시적으로
invalidate한다. 이를 자동 발견하려고 AuthId → feature contribution registry를 만들지 않는다.

`runtimeConfigFingerprint`는 adapter-local spawn preparation이 이미 메모리에 조립한 실제 settings와
최종 env로 계산한다. 원문과 hash를 로그에 남기지 않는다. 같은 Harness + ModelProvider라도 token,
URL, Model 환경변수 또는 settings가 바뀌면 다음 실행 frame 전에 channel을 respawn한다. 정상적인
steady state에서는 기존과 같은 persistent runtime 재사용이 유지된다.

fingerprint 계산을 위해 settings 파일을 다시 읽거나 vault/network를 다시 조회하지 않는다. 같은
prepared 입력을 재사용할 수 있을 때는 계산된 값을 함께 재사용하며, 입력이 다시 조립된 경우에는
key 정렬 canonicalization 결과를 계산한다. secret 원문이나 hash를 진단 데이터로 노출하지 않는다.

현재 `providerSettingsChangedSinceSpawn`만으로는 `options.env`의 credential 교체를 판정하지 못할 수
있다. TO-BE fingerprint는 최종 `options.env` 입력을 포함해야 한다. 이 변경은 불필요한 상시 respawn이 아니라 실제
실행 구성이 바뀐 경우에만 발생한다.

---

## UI/UX 불변식

이 리팩터링은 화면 재설계가 아니다. 다음 동작과 DOM/스타일은 그대로 유지한다.

- gate의 초기 상태, resume 표시, 인증 방식 선택, 입력 form, 우회 debug 동작
- 카탈로그의 목록/상세 전환, 연결·재인증·해제 버튼, 상태·principal·만료·노출 도구 표시
- 기존 wire의 `gate | llm | service` 그룹과 `ProviderPlatformState.step`; 새 `connection` kind 추가 금지
- Auth 상태의 초기 snapshot + push 구독 방식; polling 추가 금지
- Harness + ModelProvider + Model 선택 UI와 기존 fallback 순서
- UsagePanel과 설정 Usage 화면의 Main 정본 + renderer mirror 구조
- 인증 성공/실패 중간 상태와 오류 표시 타이밍

구현 중 renderer component를 이동하거나 hook/type 이름을 바꿀 수는 있지만 markup, CSS class,
i18n 표시 문구, 사용자 클릭 횟수와 IPC 왕복 패턴을 바꾸지 않는다. UI 회귀를 피하려면 첫
구조 변경에서는 기존 wire DTO를 compatibility mapper로 유지한 뒤 내부 import가 안정된 후 이름을
정리한다.

신규 domain 타입·파일·주석에는 `Engine`을 쓰지 않고 `Harness`를 사용한다. 다만 기존 renderer 표시
문구, IPC/DB/config key처럼 이번 UI/호환 범위에 묶인 `engine` 문자열은 별도 migration 없이 바꾸지
않는다. 이를 새 domain 어휘로 복제하지 말고 compatibility boundary에만 남긴다.

Auth button은 끝까지 인증 행위만 수행한다. 인증 성공 callback 안에서 Usage fetch, Confluence
검색, Harness config API를 일괄 실행하지 않는다. 필요한 feature는 Auth change를 무효화 신호로만
사용하고 자기 시점에 lazy resolve한다.

---

## 보안 불변식

경량화가 아래 경계를 약화시키면 안 된다.

- secret은 safeStorage/vault에 두고 renderer, SQLite, settings 파일, 로그에 기록하지 않는다.
- main 원격 요청은 Chromium network stack을 사용한다. Node 전역 `fetch`를 새로 쓰지 않는다.
- 시작 origin, redirect hop, 예약 header, response size와 AbortSignal 정책을 유지한다.
- browser session은 같은 `sessionGroup`의 Electron partition을 공유한다. partition 사이 cookie 복사를
  도입하지 않는다.
- 401/403은 Auth 상태를 만료로 강등하고 Plugin tool visibility와 UI 상태를 갱신한다.
- 미인증 credential은 빈 문자열이 아니라 `null`/미주입으로 처리한다.
- `AuthSecretReader`는 renderer IPC, RouterContext와 일반 feature 포트에 넣지 않는다. MCP와 특정
  Harness augmenter에는 필요한 AuthId를 닫은 closure만 전달한다.
- 런타임 동적 TypeScript/JavaScript loading은 추가하지 않는다. 배포 모듈은 build-time code다.

기존 `Provider.id` 값은 TO-BE의 `AuthId`로 그대로 승계한다. 이 값은 vault namespace와 MCP
`${BINDING:<id>}`에 이미 저장될 수 있으므로 구조 변경을 이유로 개명하지 않는다. 물리 vault key의
기존 prefix도 storage adapter 내부에서 유지한다. 이를 바꾸려면 별도 secret migration과 rollback
계획이 필요하며 이번 범위가 아니다.

환경변수 주입에는 기존과 같은 한계가 있다. Harness subprocess에 `ANTHROPIC_AUTH_TOKEN` 같은 값을
넣으면 Harness와 Bash 도구는 그 값을 읽을 수 있다. 모델로부터 secret을 숨기는 요구까지 만족하려면
LLM 요청 broker가 필요하며, 단순 디렉터리 리팩터링으로 해결되지 않는다. 이번 범위는 기존 env
주입의 노출 성질을 악화시키지 않는 것이며, broker 도입은 별도 설계다.

---

## 구현 순서

### Phase A — 책임을 분리하고 동작을 그대로 옮긴다

- Auth 계약과 구현을 `contracts/auth.ts`, `features/auth/`로 이동한다.
- Gate를 `features/gate/`로 이동하고 Auth snapshot만 소비하게 한다.
- Harness 설정/모델 파일을 `features/harnesses/`로 이동하고 import만 전환한다.
- Confluence를 `features/plugins/confluence/`로 이동한다.
- Claude가 직접 로드하는 package 코드를 `features/extensions/harness-plugins/claude.ts`로 옮기고
  `ClaudeHarnessPlugin` 어휘로 정리한다. 호환 package id 문자열은 유지한다.
- 기존 IPC/DB/wire field는 compatibility boundary에서 유지한다.
- 이동 단계에서 실행 로직을 재작성하지 않는다. 테스트 파일도 대상 모듈과 함께 이동한다.

### Phase B — 소비 방향을 뒤집는다

- `BoundAuth`, `AuthRuntime`과 별도 `AuthSecretReader`를 만들고 `ProviderApi.materialize()`를 제거한다.
- `harness-runtime.ts`는 기존 settings key에 optional augmenter만 연결한다. 새 ModelProvider 정의
  배열이나 catalog를 만들지 않는다.
- UsageFetcher와 Confluence가 bound request를 직접 받도록 Bootstrap을 바꾼다.
- Harness runtime config cache, generation commit fence, source revision, single-flight와 selective
  invalidation을 연결하고, Harness별 spawn preparation에서 최종 settings/env fingerprint를 만든다.
- Confluence tool server를 한 번 만들고 Auth 상태에 따라 동일 인스턴스를 등록·회수한다.
- 카탈로그 DTO는 Auth descriptor/snapshot과 Plugin/Harness/Usage 표시 정보를 composition 시점에
  조합하고 기존 wire 필드 전부를 보존한다.

### Phase C — 호환 layer와 과잉 표면을 제거한다

- domain의 `Provider`, `Provider.llm`, `Provider.tools`, `ProviderPlatform` 소비를 제거한다. 기존 renderer
  wire가 쓰는 shared `ProviderKind`와 DTO/protocol schema는 compatibility boundary에 유지한다.
- `features/providers/`가 비었는지 확인한 뒤 디렉터리를 삭제한다.
- 신규 코드에서 확정 용어와 어긋나는 레거시 어휘 및 제품명 prefix를 제거한다.
- 현재 architecture, glossary, closed-network guide, IPC 문서를 실제 코드에 맞게 갱신한다.
- DB schema를 바꾸지 않고 기존 `provider_key` 값을 새 도메인 key로 읽는 boundary를 유지한다.

각 phase는 lint/typecheck/test가 통과하는 독립 커밋이어야 한다. Phase A와 Phase B 사이에서
`features/providers`와 새 디렉터리를 동시에 장기간 운영하지 않는다. 임시 re-export는 다음
phase에서 삭제할 대상과 소비자를 주석으로 명시한다.

---

## 구현자가 만들면 안 되는 것

| 금지 | 이유 |
|---|---|
| `ProviderPlatformV2` 또는 이름만 바꾼 통합 facade | 같은 집적을 재생산함 |
| `Provider.usage`, `AuthDefinition.tools`, `AuthDefinition.llm` | Auth 계약이 소비 feature를 다시 알게 됨 |
| `HarnessModelProviderDefinition[]` 또는 별도 definition catalog | 기존 settings entry SSOT를 중복하고 두 번째 ModelProvider 플랫폼이 됨 |
| operation/endpoint registry | 직접 request로 충분하며 문자열 조인과 검증이 다시 생김 |
| JSON path 기반 범용 response mapper | 배포별 TypeScript 함수보다 복잡하고 타입 안전성이 낮음 |
| 환경변수별 schema/registry | `RuntimeConfigAugmenter`의 `Record<string,string>`이면 충분함 |
| PluginHost/ConnectorRegistry/ContributionRegistry | build-time concrete 조립에 필요하지 않음 |
| 일반 feature에 `AuthSecretReader` 또는 raw cookie 전달 | bound request로 충분한 소비자까지 secret 표면을 넓힘 |
| config API augmenter에 `AuthSecretReader` 전달 | API 접근용 OAuth/session과 응답의 LLM token 경계를 흐림 |
| generation fence 없는 수동 cache invalidation | 무효화 전 in-flight 결과가 낡은 token을 cache에 되살릴 수 있음 |
| UI step·`verified`-only change마다 Harness cache 또는 Plugin tool을 sync | credential과 무관한 화면 변화가 network·runtime revision을 유발함 |
| caller의 AbortSignal을 공유 single-flight request에 직접 연결 | 한 caller 취소가 다른 caller의 정상 resolve까지 취소함 |
| runtime config service의 직접 fs/path/mtime 판정 | settings lifecycle과 `sourceRevision` 책임을 중복함 |
| Plugin tool server를 sync마다 재생성 | handler identity가 달라져 registry revision과 respawn이 불필요하게 증가함 |
| GUI `tools`를 active Runtime Tool Registry에서만 생성 | 미인증 상태에서도 도구명을 보여 주는 현재 카탈로그 UX를 깨뜨림 |
| renderer에 신규 `connection` kind 추가 | UI/UX 불변 범위를 넘어 기존 그룹·wire 계약을 바꿈 |
| Auth 성공 시 모든 feature eager refresh | 부팅·로그인 지연과 불필요한 네트워크를 만듦 |
| turn마다 config API 호출 | persistent runtime 성능 계약을 깨뜨림 |
| raw cookie export 범용 API | 보안 표면만 넓히고 bound request로 대체 가능함 |
| 새 DB migration | 이번 변경은 소프트웨어 책임 재배치이며 데이터 의미를 바꾸지 않음 |

추상화는 같은 중복이 실제로 반복되고 호출자 요구가 동일할 때만 추출한다. 현재 한 Plugin만 쓰는
매핑을 미래 Plugin을 위해 일반화하지 않는다.

---

## 수용 기준

### 구조

- `app/src/main/features/providers/`가 존재하지 않는다.
- Auth 계약에 `kind`, `llm`, `tools`, `usage`, `envKey`가 없다.
- Gate는 `features/auth/` 밖에 있고 Auth feature는 Gate를 import하지 않는다.
- Auth 구현은 Harness/Plugin/Usage feature를 import하지 않는다.
- `BoundAuth`에는 raw credential 조회가 없고 `AuthSecretReader`는 trusted-main composition에만 있다.
- Auth event는 UI `step`과 `snapshot`을 구분하고, snapshot은 `credentialChanged`와
  `credentialRevision`으로 실행 credential 변화를 명시한다.
- Harness/Plugin/Usage feature끼리 직접 import하지 않고, 구조적 포트와 Bootstrap 주입을 사용한다.
- ModelProvider 선택 목록은 기존 settings entry에서만 나오며 별도 definition 배열이 없다.
- `llm.ts` 대체 모듈이 API key뿐 아니라 URL·Model 변수·ModelProvider flag·실행용 token을 포함한
  전체 `runtimeEnv` overlay를 반환할 수 있다.
- Usage response mapping과 Confluence response mapping이 각 feature/deployment 모듈에 남아 있다.
- shared `ProviderKind`, `ProviderInfo`, `ProviderPlatformState`, `AgentEnvironment`와 현재 IPC
  schema/channel은 별도 UI migration 전까지 compatibility boundary에만 남아 있다.

### 동작·성능

- gate와 카탈로그의 인증 UI flow, 상태 push와 표시 결과가 변경 전과 같다.
- connection handler, Auth listener, cached Plugin tool server의 초기 sync가 비동기 resume 전에
  준비되고, gate Auth는 순차적으로 먼저 resume한 뒤 나머지 Auth만 한 번 병렬 resume한다.
- remaining resume의 성공 snapshot은 마지막 full-state push 한 번으로 합치고, 즉시 강등 `K`건을
  포함한 전체 방송 횟수는 현재와 같은 최대 `1 + K`를 유지한다.
- Harness 선택, ModelProvider 선택, Model 선택과 settings 주입 결과가 변경 전과 같다.
- 정적 구성에서 추가 network 호출이 없다.
- 동적 runtime config의 warm cache는 기존 settings mtime stat 외에 network·vault·추가 file 접근을
  만들지 않는다.
- settings 외부 편집의 mtime 변화가 runtime config cache miss로 이어진다.
- UI step과 `verified`-only change는 Harness generation과 Plugin tool registry revision을 바꾸지 않는다.
- Auth/settings 변경 중 완료된 옛 in-flight resolve가 cache에 commit되거나 현재 caller에 반환되지
  않고, 제한된 최신 세대 재시도 또는 명시 오류로 끝난다.
- 한 caller의 취소는 같은 single-flight를 기다리는 다른 caller를 취소하지 않으며, invalidation만
  공유 operation을 best-effort abort한다.
- Auth나 settings가 바뀌지 않으면 persistent runtime을 재사용한다.
- token·URL·모델 환경변수가 바뀌면 다음 turn에 stale subprocess를 재사용하지 않는다.
- 같은 turn의 title generation과 chat Harness는 같은 runtime config snapshot을 사용한다.
- 자동 continuation은 continuation마다 settings와 동적 env 전체를 한 번 다시 resolve하고 같은
  continuation 안에서 공유하며, fingerprint가 바뀌면 listen/flush 전에 respawn한다.
- Plugin 도구는 valid 상태에서만 등록되고 해제·만료·401/403에서 회수되며 반복 sync가 runtime tool
  revision을 불필요하게 올리지 않는다.
- 카탈로그는 Auth가 invalid여도 cached descriptor의 기존 도구명을 계속 표시하고 상태로 비활성을
  나타내며, 실제 Harness 노출만 Runtime Tool Registry에서 회수한다.
- Usage의 Main 정본, renderer mirror, cron, 수동 refresh와 DB cache 의미가 유지된다.

### 보안·호환성

- secret/cookie/LLM token이 renderer, DB, settings와 로그에 새로 노출되지 않는다.
- config API augmenter에는 `BoundAuth`만 전달하고, direct-credential augmenter에만 AuthId를 닫은
  `readSecret()` closure를 전달한다.
- OAuth/session access token과 config API 응답의 실제 LLM token을 별도 값으로 검증·취급한다.
- 기존 `ProviderInfo` 전 필드와 `ProviderPlatformState.step`이 compatibility mapper 결과에서 유지된다.
- `AuthenticatedRequest`/`AuthenticatedResponse`는 binary body, `maxBytes`, `finalUrl`, headers와
  redirect 중 Grant 변경 감지를 포함한 기존 전송 표면을 보존하고 401/403 강등을 유지한다.
- Chromium network stack, session partition과 request policy 테스트가 그대로 통과한다.
- DB migration 변경이 없고 기존 session의 `provider_key`를 계속 해석한다.
- 신규 production dependency가 없다.

---

## 검증 지침

기존 테스트를 단순 삭제해 green으로 만들지 않는다. 이동한 책임에 맞춰 경로와 이름을 바꾸고 같은
행동을 계속 검증한다.

| 검증 축 | 필수 확인 |
|---|---|
| Auth | credential 방식, OAuth PKCE/state, browser session, restore/probe, gate-first·remaining-parallel resume와 full-state broadcast `1 + K` 상한, step/snapshot change 분류, `credentialRevision`, 실패한 reauth의 기존 Grant·revision 보존, revoke, binary·`maxBytes`·`finalUrl`·redirect/Grant fence, 401/403 강등, secret reader 비노출 |
| Harness | settings cache와 외부 mtime 변경, Model 파싱/fallback, 전체 `runtimeEnv` 매핑, 실제 SDK 우선순위 양쪽 characterization과 adapter-local 조립, title/chat 동일 prepared snapshot, continuation별 전체 config 재resolve, 동적 secret의 env-only 전달, config API/direct credential 분리, 미인증 fail-closed, 같은 세대 single-flight, caller cancel 격리, invalidation 중 stale 결과의 cache·caller 반환 차단, 실제 settings/env 입력 fingerprint와 respawn |
| Plugin | Confluence REST/Markdown/첨부 변환, credential-effective 상태별 tool 등록·회수, `verified`-only/step 무반응, 동일 tool server/handler identity 재사용, 반복 sync의 runtime tool revision 안정성, invalid Auth에서도 GUI descriptor toolNames 유지 |
| Usage | `UsageFetcher.supports`와 Auth 상태 분리, 실패 전파, cron 격리, `baselineUsable` fail-closed, remote baseline 합성, 수동 refresh, DB 왕복 |
| UI | gate와 카탈로그 auth flow, 목록/상세, 버튼, 기존 row 순서·개수와 AuthId 유일성, descriptor의 인증 방식/필드, status/activeAuthKind/principal/expiry/tools/step wire 동등성, invalid tool 비활성 표시, shared `ProviderKind` compatibility, polling 부재 |
| 경계 | feature 교차 import 금지, Node global fetch 금지, secret 로그 금지, DB migration append-only |

최종 게이트는 저장소의 현재 명령을 따른다.

```bash
cd app
npm run lint
npm run typecheck
npm test
node scripts/check-doc-inventory.mjs --check
node scripts/check-migrations-appendonly.mjs
```

Electron ABI나 설치 환경 때문에 일부 suite를 실행하지 못하면 실패를 숨기지 말고 baseline과 변경
영향을 분리해 보고한다. UI/UX와 폐쇄망 실서버 흐름은 사람 실기로 gate 로그인, Plugin 인증,
Harness turn, Usage refresh를 확인한다.

---

## 비범위

- LLM request broker 도입과 subprocess env secret 비노출
- runtime 동적 Plugin 설치·서드파티 코드 sandbox
- UI 디자인, 카탈로그 정보구조, 버튼/문구 변경
- Usage 계산식, DB schema 또는 원격 Usage endpoint 명세 변경
- 동적 API가 반환한 Model 목록을 카탈로그에 실시간 반영하는 기능
- 전체 저장소의 레거시 IPC/DB 식별자를 한 번에 개명하는 작업

단, 이 비범위가 신규 코드에서 잘못된 용어를 계속 사용해도 된다는 뜻은 아니다. 신규 도메인
계약은 처음부터 Harness, Model, ModelProvider, Auth, Plugin 용어를 사용하고, 기존 wire 식별자는
호환 boundary 안에만 남긴다.

---

## 최종 판정

경량화는 가능하다. 현재 인증 lifecycle, 안전한 request broker, Usage 정본, settings cache와
Runtime Tool Registry는 유지 가치가 있다. 줄여야 하는 것은 그 위에 Auth 대상을 중심으로 Harness,
Plugin, Usage를 contribution으로 모으는 결합이다.

Harness에서는 기존 settings entry를 선택 SSOT로 유지하고, 필요한 key에만 작은
`RuntimeConfigAugmenter`를 붙인다. 이를 다시 definition catalog로 만들지 않되 cache·single-flight·
generation fence·expiry는 `HarnessRuntimeConfigService` 한곳에서 책임진다. Harness별 spawn
preparation은 실제 adapter 입력 조립과 fingerprint만 책임진다. 이것이 플랫폼화 회피와 실행
정합성을 동시에 만족하는 경계다.

목표 구조의 핵심은 다음 세 문장으로 고정한다.

- **Auth는 인증하고 인증된 능력만 제공한다.**
- **Harness·Plugin·Usage는 자기 API와 반환값을 직접 해석한다.**
- **Bootstrap은 구체 구현을 연결하되 제품 기능을 대신 구현하지 않는다.**

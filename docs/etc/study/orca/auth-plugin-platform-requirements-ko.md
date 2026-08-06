# Orca 인증 플러그인 플랫폼 요구명세

> **⚠️ 폐기 (2026-08-06, 핸드오프 0178).** 이 문서가 규정한 플랫폼 요구 중 아래는 근거를 잃었다 —
> **AUTH-PLAT-002**(5메서드 required + `not_supported` 규약: `refresh` 는 provider 3/3 이
> `not_supported` 만 돌려주던 표면이라 제거) · **AUTH-PLAT-004**(5메커니즘 지원: `oauth_browser`·
> `oauth_device_code`·`external_secret` 은 생산자가 0이었다) · **AUTH-PLAT-012·013**(선언형 manifest·
> capability 선언: 타입 시스템이 컴파일 타임에 하는 일을 런타임에 재확인하던 것) ·
> **AUTH-PLAT-014**(ABI versioning: v2 가 존재한 적 없다). 사용자 결정으로 플랫폼화를 걷어내고
> 진입점만 남긴다 — 현행 정본은 `docs/guides/closed-network-extensions.md` 와
> `app/src/main/features/auth-platform/registry.ts` 헤더. **이 문서는 이력으로만 보존한다.**

> 작성일: 2026-07-31  
> 개정일: 2026-07-31 (핸드오프 `0157` 착수 전 비판적 검토 반영)  
> 상태: 구현 기준선 (검토 반영본)  
> 선행 연구: OpenCode `da59457`, goose `6789d4a`, Hermes Agent `ce6dd1a`  
> 관련 문서: [Orca 도입 검토 보고서](auth-broker-adoption-report-ko.md)

## 개정 요지 (2026-07-31 검토 반영)

초판을 Orca 실제 코드(`app/src/main`)와 대조한 결과 3건을 수정했다. 초판을 인용하는 문서·계획이
있다면 아래를 우선한다.

| # | 초판 | 개정 | 근거 |
|---|---|---|---|
| 1 | AUTH-PLAT-008 을 **전역** 불변식으로 선언 | **"Orca 가 소유·중개하는 경로" 로 스코프 축소** + argv/파일 예외를 명시 표로 고정 | Orca 는 LLM 백엔드·MCP 요청의 주체가 아니다. claude CLI 서브프로세스가 요청하므로 credential 이 argv/파일로 나가는 것은 제거 대상이 아니라 **아키텍처적 사실**이다 (§소비자 경계) |
| 2 | AUTH-PLAT-011 격리 plugin-host **필수** | **폐기.** 런타임 확장은 MCP 가 담당하고 인증 provider·내장 도구는 빌드 타임 | 초판은 `contracts/sso.ts` 의 "런타임 동적 로딩 금지" 와 `guides/closed-network-extensions.md` 의 컴파일 타임 정책을 인용도 반박도 없이 뒤집었다. 제품 의도 확인 결과 두 경로는 이미 분리돼 있었다 (§확장 모델) |
| 3 | ADFS/WIA 공유 partition 을 "현행 구현" 으로 서술 | **사용자 확인(2026-07-31)된 전제**로 표기. 단 Electron per-session WIA allowlist 성립 여부는 실기 확인 항목 | Orca 에는 ADFS 코드가 없고 `SSO_MODULE_REGISTRATION` 은 `null` 이다. 사용자의 별도 사내 앱에 대한 진술이었다 |

추가로 초판에 빠져 있던 4건(transaction 내구성·동시성 / migration / safeStorage 읽기 정책 /
공수 비대칭)을 §미비 보완 에 채웠다.

## 요약

Orca가 제공해야 하는 것은 단일 자격증명 저장소나 특정 ADFS 구현이 아니라, **여러 인증
플러그인을 등록하여 앱 로그인과 서비스 연결에 함께 사용할 수 있는 Authentication Plugin
Platform**이다.

모든 인증 제공자는 인증 방식과 대상에 관계없이 하나의 `AuthProviderV1` 수명주기 계약을
구현한다. 앱 로그인과 서비스 연결은 서로 다른 API가 아니라 `AuthTarget`만 다르게 전달한다.
API key, Auth token, Personal Access Token(PAT), OAuth, ADFS/WIA 브라우저 세션은 모두 같은
계약 아래의 1급 메커니즘이다.

인증 제공자와 기능 커넥터는 역할이 다르다. 인증 제공자는 신원·자격증명·브라우저 세션을
binding으로 만들고, 커넥터는 Confluence·Jira 등의 기능을 제공한다. 하나의 플러그인 패키지가
두 contribution을 함께 포함할 수 있지만, 커넥터가 비밀값을 직접 읽어서는 안 된다.

## 용어와 경계

| 용어 | 정의 |
|---|---|
| Authentication Platform | 플러그인 검색·검증·등록, 인증 transaction, binding, vault, browser session, 정책을 포괄하는 Orca 기능 |
| Auth provider | WIA/ADFS, OAuth, API key, Auth token, PAT 등 인증 절차를 구현하는 플러그인 contribution |
| Connector | 인증된 요청을 사용해 외부·사내 서비스 기능을 제공하는 contribution |
| Auth target | 인증 결과의 사용 대상. Orca 앱 자체 또는 특정 connector |
| Auth binding | 대상과 인증 결과를 연결하는 불투명한 레코드. 실제 secret이나 Electron `Session`을 포함하지 않음 |
| Session group | 여러 binding이 같은 Electron cookie jar를 사용하도록 지정하는 논리 이름 |
| Credential presentation | secret을 HTTP 요청의 header·cookie·query 중 어디에 어떤 형식으로 넣는지에 대한 선언 |

`인증 플러그인`과 `커넥터 플러그인`을 같은 것으로 취급하지 않는다. 인증을 재사용하려면 둘을
분리해야 한다. 다만 배포 단위인 plugin package는 `authProviders[]`, `connectors[]`,
`secretSources[]`를 함께 제공할 수 있다.

## 필수 요구사항

| ID | 요구사항 | 인수 기준 |
|---|---|---|
| AUTH-PLAT-001 | 인증 플러그인을 복수 등록할 수 있어야 한다. | **서로 다른 mechanism 의 provider 2개 이상이 동시 등록되고, 각각 application·connector 양쪽 target 에 binding 을 만든다.** (초판 기준 "provider별 `switch` 수정이 없다" 는 현행 코드도 자동 통과해 측정력이 없어 교체했다 — `SSO_MODULE` 은 불투명 모듈 1개라 애초에 switch 가 없다.) |
| AUTH-PLAT-002 | 모든 인증 provider는 같은 `AuthProviderV1` 메서드를 구현해야 한다. | `begin`, `continue`, `status`, `refresh`, `logout` 계약 테스트를 모든 provider fixture에 재사용한다. |
| AUTH-PLAT-003 | 앱 로그인과 connector 연결을 같은 계약으로 처리해야 한다. | `AuthTarget.kind`만 `application` 또는 `connector`로 달라지고 별도 인증 인터페이스가 생기지 않는다. |
| AUTH-PLAT-004 | ADFS/WIA browser session, OAuth, API key, Auth token, PAT를 지원해야 한다. | 각 메커니즘으로 binding 생성·상태 확인·로그아웃이 가능하다. |
| AUTH-PLAT-005 | 하나의 provider를 여러 connector가 재사용할 수 있어야 한다. | ADFS provider 하나로 Orca, Confluence, Jira binding을 만들 수 있다. |
| AUTH-PLAT-006 | 같은 ADFS session group을 선택한 대상은 동일 Electron partition을 사용해야 한다. | 최초 WIA 로그인 후 다른 서비스 로그인에서 ADFS 재입력 없이 기존 SSO cookie가 사용된다. |
| AUTH-PLAT-007 | API key·Auth token·PAT의 저장과 HTTP presentation을 분리해야 한다. | 같은 PAT kind를 Bearer, Basic password, 전용 header 방식으로 서비스별 구성할 수 있다. |
| AUTH-PLAT-008 | 실제 credential과 cookie jar는 Orca가 소유해야 한다. | **Orca 가 소유·중개하는 경로**(Renderer 조회 응답 · auth 이벤트 · connector 결과 · 로그)에 raw secret 이 없다. **argv·배포 파일은 §소비자 경계 의 예외 표를 따른다** — claude CLI 로 넘어가는 경로는 현행 아키텍처에서 제거 불가하므로 인수 기준이 아니라 문서화된 잔여 노출로 관리한다. |
| AUTH-PLAT-009 | connector는 `bindingId`를 사용해 인증 요청을 위임해야 한다. | connector가 `authenticatedFetch`를 호출하고 Vault API나 cookie API를 직접 호출하지 않는다. |
| AUTH-PLAT-010 | 앱 로그인 binding과 서비스 binding의 의존관계를 관리해야 한다. | 앱 로그아웃 시 종속 binding을 정책대로 종료하며 connector 하나의 연결 해제는 공유 ADFS 세션 전체를 임의 삭제하지 않는다. |
| ~~AUTH-PLAT-011~~ | ~~설치형 코드 플러그인은 Electron Main과 격리해야 한다.~~ | **폐기(2026-07-31).** 런타임 확장 경로는 MCP 이고 인증 provider·내장 도구는 빌드 타임이다 — Main 이 임의 경로를 `import()` 하는 상황 자체가 없으므로 격리 host 가 방어할 대상이 없다. 대신 **"런타임 임의 코드 로딩 금지"** 를 정책으로 승계한다 (§확장 모델). |
| AUTH-PLAT-012 | 선언형 provider를 우선 지원해야 한다. | static credential 및 표준 browser-session/OAuth 흐름은 **빌드에 포함된** manifest만으로 등록할 수 있다(코드 작성 불필요). 보안 경계가 아니라 **작성 비용 절감** 목적으로 격하. |
| AUTH-PLAT-013 | capability와 대상 origin을 manifest에 선언해야 한다. | 미선언 origin 요청, redirect, credential kind, browser session 작업은 거부된다. **목적 변경**: 악의적 플러그인 방어가 아니라 **provider 오설정 조기 발견**(컴파일 타임 코드라 신뢰 경계는 빌드가 담당). |
| AUTH-PLAT-014 | 플러그인 ABI를 versioning해야 한다. | `apiVersion` 불일치는 등록 단계에서 거부되고 v1 파괴 변경은 v2 계약과 병행된다. |
| AUTH-PLAT-015 | 상태·오류·감사 이벤트를 정규화해야 한다. | provider 고유 예외가 표준 status/error로 변환되고 audit에는 handle·target·결과만 남는다. |

## 확장 모델 (2026-07-31 개정 — 초판의 "선언형 / code plugin" 2형태 표를 대체)

초판은 확장의 축을 **"선언형이냐 코드냐"** 로 잡고 code plugin 을 격리 host 에서 실행한다고 했다.
실제 제품 의도의 축은 **"빌드 타임 내장이냐 런타임 MCP 냐"** 다.

| 확장 대상 | 추가 방식 | 런타임 설치 | 요청 주체 | AUTH-PLAT-008 |
|---|---|---|---|---|
| 인증 provider (`corp-adfs-wia` · `static-credential` · …) | **빌드 타임 플러그인** (컴파일 타임 등록) | ✗ | — | — |
| 인증이 필요한 **내장 도구 / connector** (Confluence · Jira · …) | **빌드 타임 플러그인** | ✗ | **Orca** (`authenticatedFetch`) | **완전 달성** |
| 그 외 모든 서비스 연동 | **MCP 서버** | ✓ (기존 `mcp` 4채널 CRUD) | claude CLI 서브프로세스 | 미달성 → 예외 경계 |

"재빌드 없이 추가"라는 요구는 **MCP 가 이미 충족한다.** 임의 코드 auth plugin 을 런타임에 로드할
필요가 없으므로 별도 plugin-host 프로세스·RPC capability 표면은 만들지 않는다.

**승계되는 금지 정책** — `contracts/sso.ts` 가 삭제돼도 근거는 유효하므로 새
`contracts/auth-plugin.ts` 헤더에 다시 적는다:

> 런타임 동적 로딩(임의 경로 `require()`/`import()`)은 금지한다. Electron main 에서 임의 코드
> 실행은 filesystem·cookie·Vault 전권을 주는 것과 같고, 타입 검증도 성립하지 않는다.

### 플러그인 패키지 모델

플러그인 패키지는 **빌드 포함과 활성화**의 단위다. 한 패키지는 인증 provider만, connector만,
또는 둘을 함께 제공할 수 있다. manifest 는 설치 게이트가 아니라 **등록 위생**(중복·ABI·capability
선언)을 위한 빌드 타임 계약이다.

```json
{
  "schemaVersion": 1,
  "id": "corp-services",
  "version": "1.0.0",
  "contributes": {
    "authProviders": [
      {
        "id": "corp-adfs-wia",
        "apiVersion": 1,
        "targets": ["application", "connector"],
        "mechanisms": ["adfs_browser_session"],
        "capabilities": ["browser_session", "status", "logout"]
      }
    ],
    "connectors": [
      {
        "id": "corp-confluence",
        "apiVersion": 1,
        "acceptedAuthProviders": ["corp-adfs-wia", "static-pat"]
      }
    ]
  }
}
```

등록은 다음 규칙을 따른다.

- **모든 package 는 동일한 manifest·contract validation 을 통과한다.** built-in 전용 우회
  등록로를 만들지 않는다 — provider 를 늘려도 registry 한 곳만 본다.
- 단순 static credential과 표준 protocol은 선언형 adapter로 처리한다(코드 작성 불필요).
- 서비스 고유 코드가 필요하면 **빌드 타임 플러그인**으로 작성한다. 별도 plugin-host 는 두지
  않는다(AUTH-PLAT-011 폐기). 다만 provider context 에 **Vault 전체·cookie API·`process.env`
  전체는 노출하지 않는다** — 이는 격리가 아니라 §보안 불변식 이 요구하는 최소 권한이다.
- `apiVersion` 불일치는 등록 단계에서 거부한다. v1 파괴 변경은 `auth-plugin-v2.ts` 병행으로만.
- 같은 `(pluginId, contributionId, apiVersion)`의 중복 등록은 거부한다. 로드 순서에 따른
  last-writer-wins override를 허용하지 않는다(OpenCode `auth-override.test.ts` 동작의 의도적 거부).

## 공통 인증 계약

모든 인증 provider는 optional method 없이 아래 메서드를 구현한다. 지원하지 않는 동작은 메서드
부재가 아니라 `not_supported` 표준 결과로 반환한다.

```ts
type AuthTarget =
  | { kind: 'application'; applicationId: 'orca' }
  | { kind: 'connector'; connectorId: string; connectionId: string }

type AuthMechanism =
  | 'adfs_browser_session'
  | 'oauth_browser'
  | 'oauth_device_code'
  | 'api_key'
  | 'auth_token'
  | 'personal_access_token'
  | 'basic'
  | 'external_secret'

interface AuthProviderV1 {
  readonly descriptor: AuthProviderDescriptor

  begin(ctx: AuthPluginContext, request: AuthRequest): Promise<AuthStep>
  continue(
    ctx: AuthPluginContext,
    transactionId: string,
    input: AuthInput,
  ): Promise<AuthStep>
  status(ctx: AuthPluginContext, bindingId: string): Promise<AuthStatus>
  refresh(ctx: AuthPluginContext, bindingId: string): Promise<AuthRefreshResult>
  logout(ctx: AuthPluginContext, bindingId: string): Promise<AuthLogoutResult>
}
```

`begin`은 credential 입력, browser navigation, device code 표시 등 다음 UI step을 반환한다.
secret 입력은 플러그인이 만든 임의 UI가 아니라 Orca의 신뢰된 secret prompt가 수집하여 Main으로
직접 전달한다. Renderer는 입력 중 값을 일시적으로 취급할 수 있으나, 저장 후 조회 응답으로 다시
받거나 로컬 상태에 영속해서는 안 된다.

`continue`는 transaction을 진행한다. 최종 성공 결과에는 raw token·PAT·cookie가 아니라
`AuthBinding`만 포함한다.

```ts
interface AuthBinding {
  id: string
  pluginId: string
  providerId: string
  target: AuthTarget
  mechanism: AuthMechanism
  principal?: { id: string; displayName?: string }
  artifact:
    | { kind: 'browser_session'; handleId: string; sessionGroup: string }
    | { kind: 'vault_credential'; handleId: string }
    | { kind: 'delegated'; handleId: string }
  parentBindingId?: string
  status: 'valid' | 'expired' | 'revoked' | 'unknown'
  expiresAt?: string
}
```

## Static credential와 HTTP presentation

API key, Auth token, PAT는 모두 opaque secret이지만 의미와 관리 정책을 보존하기 위해 서로 다른
credential kind로 저장한다. 요청에 넣는 방식은 kind에서 추론하지 않고 connector manifest의
presentation으로 선언한다.

```ts
type CredentialPresentation =
  | { location: 'header'; name: string; scheme?: 'Bearer' | 'Basic' | 'Token' | 'Raw' }
  | { location: 'cookie'; name: string }
  | { location: 'query'; name: string; restricted: true }
```

| 종류 | 대표 presentation | 정책 |
|---|---|---|
| API key | `X-API-Key: <value>` 또는 서비스 지정 header | query 사용은 명시 opt-in, 로그·redirect 보호 필수 |
| Auth token | `Authorization: Bearer <value>` 또는 전용 header | OAuth access token과 달리 사용자가 직접 입력한 opaque token으로 분류 |
| PAT | Bearer, Basic password, `PRIVATE-TOKEN` 등 | scope·만료·대상 service metadata를 별도 보관 |

static credential provider의 `refresh`는 `not_supported`를 반환할 수 있다. 만료 또는 probe 실패 시
`reauth_required` 상태로 전환하고 `begin`부터 다시 수행한다.

## ADFS/WIA 공유 브라우저 세션

> **전제 표기(2026-07-31 개정)**: 아래 "현재 방식" 은 **Orca 에 대한 서술이 아니다.** Orca 에는
> ADFS 코드가 없고 `SSO_MODULE_REGISTRATION` 은 `null` 이다. 사용자의 **별도 기존 사내 앱**이
> 이렇게 동작한다는 **사용자 확인(2026-07-31)** 을 받은 전제다. 설계는 이 전제 위에 선다.

폐쇄망의 현재 방식은 첫 로그인에서 WIA로 ADFS 세션을 만든 뒤, 후속 서비스 로그인에 동일한
Electron `partition`을 사용해 ADFS 쿠키를 재사용하는 구조다. 이는 중앙 OAuth OBO나 KCD가 아니라
`adfs_browser_session` provider로 모델링한다.

> **실기 확인 항목**: 아래 `BrowserSessionPolicy.allowIntegratedAuthDomains` 는 **session group
> 별** WIA allowlist 를 가정한다. Electron 에서 통합 인증 허용 도메인은 per-session
> `ses.allowNTLMCredentialsForDomains()` 와 **프로세스 전역** `--auth-server-allowlist` 스위치가
> 서로 다른 층위에 있다. 두 session group 이 서로 다른 WIA allowlist 를 갖는 설계가 Electron 39
> 에서 실제로 성립하는지는 **구현 중 실기로 확인**한다. 분리가 불가능하면 이 필드는 전역 합집합
> 의미로 강등하고 그 사실을 `arch/backend/security.md` 에 적는다.

동일 partition을 쓰는 Orca와 서비스들은 **같은 cookie jar를 직접 공유**한다. ADFS 도메인의
SSO cookie는 여러 서비스의 ADFS redirect에서 재사용되고, 각 서비스의 session cookie는 같은
jar에 함께 저장되더라도 domain 규칙에 따라 해당 서비스 요청에만 전송된다. 다른 partition으로
cookie를 복사하는 방식은 공유가 아니라 수동 복제이며 사용하지 않는다.

```ts
interface BrowserSessionPolicy {
  sessionGroup: 'corp-adfs'
  partition: 'persist:auth.corp-adfs'
  allowedOrigins: string[]
  loginUrl: string
  authenticationProbeUrl: string
  allowIntegratedAuthDomains: string[]
  logoutCascade: 'dependents' | 'none'
}
```

| 동작 | 처리 |
|---|---|
| Orca 앱 로그인 | `target.kind='application'`으로 `begin`하고 ADFS/WIA 완료 후 root binding 생성 |
| 사내 서비스 연결 | 같은 provider·session group으로 `target.kind='connector'` binding 생성 |
| 인증 요청 | Main이 소유한 동일 `Session`의 `ses.fetch(..., credentials:'include')` 또는 통제된 WebContents 사용 |
| connector 연결 해제 | 해당 binding과 서비스 origin cookie만 정책에 따라 정리; 공유 partition 전체 삭제 금지 |
| Orca 로그아웃 | root binding과 종속 service binding 종료 후 ADFS/session group 정리 정책 수행 |

WIA credential 허용 도메인은 ADFS 호스트 allowlist로 제한한다. 외부 origin, 임의 popup,
download, 새 창, allowlist 밖 redirect는 차단한다. Renderer와 provider 에는 partition 문자열이나
cookie API를 노출하지 않고 session handle만 제공한다.

## 소비자 경계 — Orca 가 요청 주체인 곳과 아닌 곳 (2026-07-31 신설)

AUTH-PLAT-008 을 스코프 축소한 근거다. **Orca 는 모든 요청의 클라이언트가 아니다.**

| 소비자 | 실제 요청 주체 | credential 전달 경로 | AUTH-PLAT-008 |
|---|---|---|---|
| 내장 도구 / connector | **Orca main** | `authenticatedFetch(bindingId, …)` — broker 가 header·cookie 주입 | **달성** |
| ADFS browser session | **Orca main** | Orca 소유 `Session` 의 `ses.fetch(…, credentials:'include')` | **달성** |
| MCP 서버 | claude CLI 가 spawn | `dist/plugins/orca/.mcp.json` (0058) 또는 `--mcp-config` argv | **미달성** |
| LLM 백엔드 | claude CLI 서브프로세스 | `options.settings` → `--settings` argv 인라인 JSON | **미달성** |

### 잔여 노출 (제거 대상이 아니라 문서화 대상)

| 노출 | 사유 | 완화 |
|---|---|---|
| MCP 비밀이 `dist/plugins/orca/.mcp.json` 에 평문 | claude CLI 가 이 파일을 읽어 서버를 spawn 한다 | `.bak` 2차 사본 제거 · `${BINDING:}` 로 **소유권을 broker 로 일원화** · 최종 제거는 Orca 호스팅 MCP proxy (후속) |
| LLM auth key 가 `--settings` argv 에 평문 | handoff 0028 이 **명시적으로 채택한 트레이드오프** (same-user process list 노출 수용) | 사용자가 직접 적은 값만 남기고 **broker 가 쓰는 경로는 제거**(구 `SsoContext.setProviderEnv` 폐지) |

이 둘을 제거하려면 Orca 가 각각 MCP proxy 와 Anthropic API proxy 가 돼야 한다. 현재 범위 밖이며,
없앤 척하지 않고 `arch/backend/security.md` 에 경계로 고정한다.

## Connector 계약과 인증 소비

connector는 인증 provider를 직접 구현하거나 raw credential을 읽지 않는다. 연결 설정은
`acceptedAuthProviders` 중 하나로 binding을 만들고, 실행 시 아래 capability만 사용한다.

```ts
interface ConnectorRuntimeV1 {
  start(ctx: ConnectorContext, connectionId: string): Promise<ConnectorStatus>
  invoke(ctx: ConnectorContext, request: ConnectorRequest): Promise<ConnectorResult>
  stop(ctx: ConnectorContext, connectionId: string): Promise<void>
}

interface AuthenticatedFetchRequest {
  bindingId: string
  connectorId: string
  method: string
  path: string
  headers?: Record<string, string>
  bodyHandle?: string
}
```

Broker는 binding·connector·origin·path policy를 확인한 후 header 또는 cookie를 주입한다.
connector가 `Authorization`, API-key header, `Cookie`를 직접 덮어쓰는 요청은 기본 거부한다.
Skill과 Agent에는 connector tool schema만 노출하고 binding·secret·session handle은 노출하지 않는다.

## 런타임 모듈 구조

```text
app/src/main/
├── contracts/
│   ├── auth-plugin.ts
│   └── connector-plugin.ts
├── features/auth-platform/
│   ├── broker.ts
│   ├── registry.ts
│   ├── transactions.ts
│   ├── bindings.ts
│   └── policy.ts
├── features/connectors/
│   ├── registry.ts
│   └── runtime.ts
│   ├── manifest.ts
│   ├── conformance.ts
│   └── providers/
│       ├── static-credential.ts
│       └── corp-adfs-wia.ts
├── features/connectors/
│   ├── registry.ts
│   └── runtime.ts
├── infra/auth/
│   ├── credential-vault.ts
│   ├── browser-session-store.ts
│   ├── authenticated-fetch.ts
│   └── plugin-exec.ts
└── app/
    ├── bootstrap.ts
    └── handlers/auth.ts
```

> `infra/auth/plugin-host.ts` 는 **삭제**했다(AUTH-PLAT-011 폐기). 별도 프로세스가 없으므로
> provider 는 빌드에 포함된 코드로 main 안에서 직접 실행된다. `plugin-exec.ts` 는 구
> `features/sso/exec.ts`(shell 미경유 `execFile` 래퍼)를 옮긴 것으로, 격리 장치가 아니라
> provider 가 CLI 체인을 부를 때 쓰는 최소 capability 다.

Main layer DAG에서 `contracts`는 안정된 ABI, `features`는 수명주기와 정책, `infra`는 Electron
safeStorage·Session·process adapter, `app/bootstrap.ts`는 조립만 담당한다. **`features/connectors`
는 `features/auth-platform` 을 직접 import 할 수 없다**(feature 교차 금지, `eslint-plugin-boundaries`
강제) — `contracts/connector-plugin.ts` 의 `AuthenticatedFetch` 구조적 포트를 컴포지션 루트가
주입한다.

## 비교 프로젝트에서 채택할 구조

| 출처 | 채택 | 보완 또는 비채택 |
|---|---|---|
| OpenCode | 공통 auth hook, method별 prompt/result 정규화, 획득과 runtime 소비 분리 | raw credential plugin 접근과 last-writer-wins override 금지 |
| goose | registry, 풍부한 secret metadata, cleanup, 선언형 provider | 컴파일 타임에 한정된 확장과 keyring 실패 시 평문 fallback 금지 |
| Hermes Agent | versioned secret source, provenance, 다중 credential 상태 모델 | 전역 env 주입과 중앙 거대 OAuth 구현 금지 |

세 프로젝트 모두 Orca의 `application`과 `connector`를 동일 auth lifecycle로 다루거나 Electron
ADFS cookie jar를 공유하는 요구를 그대로 제공하지 않는다. 따라서 이 부분은 Orca 고유의
`AuthTarget`·binding dependency·browser session capability로 추가한다.

## 보안 불변식과 검증

| 불변식 | 필수 검증 |
|---|---|
| 저장값은 safeStorage 또는 명시 external source에만 존재 | encryption unavailable fail-closed, 파일 전체 fixture scan |
| raw secret은 **Orca 소유·중개 경로**(Renderer 조회·auth 이벤트·connector 결과·로그)에 없음 | IPC schema, DTO 직렬화 스냅샷, redaction 회귀 |
| **argv·dist 잔여 노출은 §소비자 경계 예외 표에만 존재** | 예외 표 밖의 신규 노출 금지 — source/dist/backup scan 으로 회귀 차단 |
| provider 는 Vault 전체·cookie API·`process.env` 전체에 접근 불가 | namespaced vault 이탈 차단 테스트 |
| credential은 허용된 connector와 origin에만 presentation | redirect·host·header spoofing test |
| 동일 session group만 cookie jar 공유 | partition identity와 cross-group isolation test |
| logout dependency가 예측 가능 | service-only disconnect와 app cascade E2E test |
| 모든 provider가 동일 lifecycle을 지킴 | provider conformance suite |

## 미비 보완 (2026-07-31 신설 — 초판 누락 4건)

### 1. transaction 내구성·동시성

초판은 OpenCode 의 "pending 이 프로세스 메모리, provider 당 1건" 을 **비채택**으로 적어놓고
`transactions.ts` 에 대체 명세를 두지 않았다. 다음을 고정한다.

| 항목 | 결정 |
|---|---|
| 저장 위치 | **프로세스 메모리**. transaction 은 진행 중 UI step 의 상태일 뿐이고, 성공 결과인 binding 만 영속된다 |
| 앱 재시작 | 진행 중 transaction 은 **소멸**한다. 재시작 후에는 `begin` 부터 다시 한다 |
| 동시성 | `(providerId, target)` 당 **1건**. 같은 키로 `begin` 이 다시 오면 기존 transaction 을 **취소하고 교체**한다(초판이 비판한 "마지막 것만 남는" 동작을 명시적 취소로 바꾼 것) |
| 다중 창 | transaction 은 main 소유이므로 창과 무관. 상태는 `auth:stateEvent` 로 **전 창 브로드캐스트** |
| 타임아웃 | provider 선언값(기본 300s). 만료 시 `AbortSignal` + 표준 실패 결과로 수렴 |

OpenCode 대비 개선점은 durable 저장이 아니라 **경합 시 조용한 덮어쓰기를 없앤 것**이다.
durable transaction 은 대화형 로그인이 앱 재시작을 넘겨야 할 때만 필요한데, 그런 요구가 없다.

### 2. migration

기존 `SecretStore` 키를 새 vault 네임스페이스로 옮긴다. 마이그레이션은 **멱등**이고 실패 시
기존 키를 남긴다(rollback = 코드 되돌리면 기존 키가 그대로 읽힘).

| 기존 | 이후 | 처리 |
|---|---|---|
| `sso:<moduleKey>:*` | — | SSO 모듈 0개이므로 **대상 없음**. 존재하면 삭제 |
| `provider:<providerKey>:*` | 동일 유지 | usage provider 핸드셰이크 규약은 보존 |
| MCP env-var 이름 (`ORCA_MCP_*_AUTH` 등) | 동일 유지 + `${BINDING:}` 신규 경로 병행 | 기존 `${VAR}` 하위호환 |
| `Settings.ssoBypass` | `Settings.authBypass` | settings 마이그레이션 1건 |

### 3. safeStorage 실패 정책 (현행 비대칭 확인)

현행 `infra/config/crypto.ts` 는 **쓰기와 읽기가 비대칭**이다.

| 동작 | 현행 | 결정 |
|---|---|---|
| `encrypt` (쓰기) | `isEncryptionAvailable()` false 면 **throw** | **유지** — fail-closed 가 맞다 |
| `safeDecrypt` (읽기) | 복호화 실패 시 `null` (= 비밀 부재로 강등) | **유지**. 단 auth 경로에서는 "비밀 없음" 과 "복호화 실패" 를 **구분해 로깅**하고, binding status 를 `unknown` 으로 두어 조용한 미인증 진행을 막는다 |

읽기까지 throw 로 바꾸면 키체인 잠김 하나로 앱 전체가 죽는다. 강등은 유지하되 **관측 가능**하게
만드는 것이 이번 변경분이다.

### 4. 공수 비대칭

A/B/C 는 대등한 3단계가 아니다. 초판 표는 이를 감춘다.

| 단계 | 상대 규모 | 비고 |
|---|---|---|
| A. 계약과 경계 | 중 | 신규 파일 위주라 기존 코드 회귀 위험이 낮다 |
| B. 기준 provider + IPC/renderer + MCP 통합 | **대** | SSO 제거·채널 교체·renderer 재배선·MCP resolver 교체가 겹친다 |
| C. 잔여 | 소~중 | AUTH-PLAT-011 폐기로 최대 항목이 사라졌다 |

## 구현 단계

| 단계 | 범위 | 완료 조건 |
|---|---|---|
| A. 계약과 경계 | manifest, registries, `AuthProviderV1`, target, transaction, binding, Vault/Session ports | built-in provider도 같은 conformance suite를 통과하고 raw store 직접 접근 신규 금지 |
| B. 기준 provider | static credential(API key/Auth token/PAT)와 `corp-adfs-wia`, authenticated fetch, 앱 로그인·connector 연결, **MCP `${BINDING:}` 통합 + `process.env` fallback 제거** | 동일 메서드로 application/connector E2E와 shared partition 검증 |
| C. 잔여 | connector 의 Agent/Skill tool surface 노출, MCP secret-free proxy descriptor, OAuth/external secret provider | 신규 provider 추가가 core 수정 없이 동작하고 §소비자 경계 예외 표가 줄어듦 |

> 초판의 "C. 설치형 확장(선언형 package loader, 격리 plugin-host)" 은 **폐기**했다 —
> 런타임 확장은 MCP 가 담당한다(§확장 모델).

OAuth browser/device-code와 external secret source는 계약에는 처음부터 포함하되, 기준 provider의
보안·수명주기가 안정된 뒤 같은 ABI로 추가할 수 있다. 구현 PR에서는 `security.md`,
`provider-runtime.md`, `standardization.md`, `IPC_CONTRACT.md`, `GLOSSARY.md`를 함께 정합화한다.


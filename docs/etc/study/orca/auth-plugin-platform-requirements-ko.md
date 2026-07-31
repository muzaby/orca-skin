# Orca 인증 플러그인 플랫폼 요구명세

> 작성일: 2026-07-31  
> 상태: 구현 전 요구사항 기준선  
> 선행 연구: OpenCode `da59457`, goose `6789d4a`, Hermes Agent `ce6dd1a`  
> 관련 문서: [Orca 도입 검토 보고서](auth-broker-adoption-report-ko.md)

## 요약

Orca가 제공해야 하는 것은 단일 자격증명 저장소나 특정 ADFS 구현이 아니라, **여러 인증
플러그인을 설치·등록하여 앱 로그인과 서비스 연결에 함께 사용할 수 있는 Authentication Plugin
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
| AUTH-PLAT-001 | 인증 플러그인을 복수 설치·등록할 수 있어야 한다. | 신규 provider 추가 시 broker/core의 provider별 `switch` 수정이 없다. |
| AUTH-PLAT-002 | 모든 인증 provider는 같은 `AuthProviderV1` 메서드를 구현해야 한다. | `begin`, `continue`, `status`, `refresh`, `logout` 계약 테스트를 모든 provider fixture에 재사용한다. |
| AUTH-PLAT-003 | 앱 로그인과 connector 연결을 같은 계약으로 처리해야 한다. | `AuthTarget.kind`만 `application` 또는 `connector`로 달라지고 별도 인증 인터페이스가 생기지 않는다. |
| AUTH-PLAT-004 | ADFS/WIA browser session, OAuth, API key, Auth token, PAT를 지원해야 한다. | 각 메커니즘으로 binding 생성·상태 확인·로그아웃이 가능하다. |
| AUTH-PLAT-005 | 하나의 provider를 여러 connector가 재사용할 수 있어야 한다. | ADFS provider 하나로 Orca, Confluence, Jira binding을 만들 수 있다. |
| AUTH-PLAT-006 | 같은 ADFS session group을 선택한 대상은 동일 Electron partition을 사용해야 한다. | 최초 WIA 로그인 후 다른 서비스 로그인에서 ADFS 재입력 없이 기존 SSO cookie가 사용된다. |
| AUTH-PLAT-007 | API key·Auth token·PAT의 저장과 HTTP presentation을 분리해야 한다. | 같은 PAT kind를 Bearer, Basic password, 전용 header 방식으로 서비스별 구성할 수 있다. |
| AUTH-PLAT-008 | 실제 credential과 cookie jar는 Orca가 소유해야 한다. | Renderer 조회 응답, Agent, Skill, connector 결과, argv, 배포 파일에 raw secret이 없다. |
| AUTH-PLAT-009 | connector는 `bindingId`를 사용해 인증 요청을 위임해야 한다. | connector가 `authenticatedFetch`를 호출하고 Vault API나 cookie API를 직접 호출하지 않는다. |
| AUTH-PLAT-010 | 앱 로그인 binding과 서비스 binding의 의존관계를 관리해야 한다. | 앱 로그아웃 시 종속 binding을 정책대로 종료하며 connector 하나의 연결 해제는 공유 ADFS 세션 전체를 임의 삭제하지 않는다. |
| AUTH-PLAT-011 | 설치형 코드 플러그인은 Electron Main과 격리해야 한다. | Main이 임의 플러그인 경로를 직접 `import()`하지 않고 제한된 plugin-host RPC만 제공한다. |
| AUTH-PLAT-012 | 선언형 플러그인을 우선 지원해야 한다. | static credential 및 표준 browser-session/OAuth 흐름은 manifest만으로 등록할 수 있다. |
| AUTH-PLAT-013 | capability와 대상 origin을 manifest에 선언해야 한다. | 미선언 origin 요청, redirect, credential kind, browser session 작업은 거부된다. |
| AUTH-PLAT-014 | 플러그인 ABI를 versioning해야 한다. | `apiVersion` 불일치는 설치 단계에서 거부되고 v1 파괴 변경은 v2 계약과 병행된다. |
| AUTH-PLAT-015 | 상태·오류·감사 이벤트를 정규화해야 한다. | provider 고유 예외가 표준 status/error로 변환되고 audit에는 handle·target·결과만 남는다. |

## 플러그인 패키지 모델

플러그인 패키지는 설치와 활성화의 단위다. 한 패키지는 인증 provider만, connector만, 또는 둘을
함께 제공할 수 있다.

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

- built-in package와 설치형 package는 동일한 manifest·contract validation을 통과한다.
- 단순 static credential과 표준 protocol은 선언형 adapter로 처리한다.
- 서비스 고유 코드가 필요하면 별도 plugin-host에서 실행한다. Main·Vault·Electron `Session`에
  대한 직접 객체 참조는 제공하지 않는다.
- 같은 `(pluginId, contributionId, apiVersion)`의 중복 등록은 거부한다. 로드 순서에 따른
  last-writer-wins override를 허용하지 않는다.

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

폐쇄망의 현재 방식은 첫 로그인에서 WIA로 ADFS 세션을 만든 뒤, 후속 서비스 로그인에 동일한
Electron `partition`을 사용해 ADFS 쿠키를 재사용하는 구조다. 이는 중앙 OAuth OBO나 KCD가 아니라
`adfs_browser_session` provider로 모델링한다.

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
download, 새 창, allowlist 밖 redirect는 차단한다. Renderer와 plugin-host에는 partition 문자열이나
cookie API를 노출하지 않고 session handle만 제공한다.

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
├── infra/auth/
│   ├── credential-vault.ts
│   ├── browser-session-store.ts
│   ├── authenticated-fetch.ts
│   └── plugin-host.ts
└── app/bootstrap.ts

plugins/<plugin-id>/
├── plugin.json
├── auth-providers/
└── connectors/
```

Main layer DAG에서 `contracts`는 안정된 ABI, `features`는 수명주기와 정책, `infra`는 Electron
safeStorage·Session·process adapter, `app/bootstrap.ts`는 조립만 담당한다. connector feature가
auth feature concrete를 import하지 않고 contract capability를 주입받도록 한다.

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
| raw secret은 Renderer 조회·Agent·Skill·connector·argv·dist에 없음 | IPC schema, child env/argv capture, source/dist/backup scan |
| plugin-host는 Main·Vault·Session에 직접 접근 불가 | capability-denial integration test |
| credential은 허용된 connector와 origin에만 presentation | redirect·host·header spoofing test |
| 동일 session group만 cookie jar 공유 | partition identity와 cross-group isolation test |
| logout dependency가 예측 가능 | service-only disconnect와 app cascade E2E test |
| 모든 provider가 동일 lifecycle을 지킴 | provider conformance suite |

## 구현 단계

| 단계 | 범위 | 완료 조건 |
|---|---|---|
| A. 계약과 경계 | manifest, registries, `AuthProviderV1`, target, transaction, binding, Vault/Session ports | built-in provider도 같은 conformance suite를 통과하고 raw store 직접 접근 신규 금지 |
| B. 기준 provider | static credential(API key/Auth token/PAT)와 `corp-adfs-wia`, authenticated fetch, 앱 로그인·connector 연결 | 동일 메서드로 application/connector E2E와 shared partition 검증 |
| C. 설치형 확장 | 선언형 package loader, 격리 plugin-host, connector package, migration·audit | 새 package 추가가 core switch 없이 동작하고 비밀 비노출 검증 통과 |

OAuth browser/device-code와 external secret source는 계약에는 처음부터 포함하되, 기준 provider의
보안·수명주기가 안정된 뒤 같은 ABI로 추가할 수 있다. 구현 PR에서는 `security.md`,
`provider-runtime.md`, `standardization.md`, `IPC_CONTRACT.md`, `GLOSSARY.md`를 함께 정합화한다.


# Plan — 0176-generic-usage-connector

## 메타

| 항목 | 값 |
|---|---|
| slug | `0176-generic-usage-connector` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | PHASES "현재 작업 중" — 보드 링크 |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "auth-platform 변경에 따라 usage provider 의 호출 또한 달라져야 한다. **범용 usage connector** 를 만들고 connector `.invoke()` 가 usage provider 의 **구독**으로 이어질 수 있도록 범용적인 설계가 필요하다." | 라이브 세션 요청 (2026-08-05) |
| 명시 요구 | "orca 특성상 여러 llm provider(공급자) 설정이 가능한 만큼 **여러개의 usage connector 를 구성 가능**해야 하며, usage provider 가 **입맛에 맞는 invoke 결과를 구독**할 수 있어야 한다." | 〃 |
| 명시 요구 | "**connector 자체를 연결하기보다 범용적 결과 값을 접근**하도록 하는 편이 좋겠다. 왜냐하면 **llm provider 반환 포맷이 다를 수 있다**." | 〃 |
| 명시 요구 | "**bootstrap 의 연결 코드와 usage provider 의 재구성**이 필요하다." | 〃 |
| 추론 의도 | "구독" = usage provider 가 connector 객체·connection id 를 잡고 있는 것이 아니라, **invoke 결과(범용 표본)를 받아 자기 포맷으로 매핑**하는 관계. 근거: 같은 문장이 "connector 자체를 연결하기보다 범용적 결과 값" 이라고 수단을 배제했고, 포맷 차이를 이유로 들었다 — 즉 **해석 책임은 provider 쪽**이다. (추론) |
| 추론 의도 | 하나의 usage connector 호출 결과를 **여러 usage provider 가 함께** 볼 수 있어야 한다 — "여러 connector × 여러 provider" 를 1:1 배선이 아니라 선택자(selector)로 잇는다는 뜻으로 읽었다. (추론) |

## Context (왜)

`ExternalUsageService`(`app/src/main/features/usage/external-usage-service.ts`)는 사내 quota API 를
호출해 사용량 도넛·설정 탭의 **외부 권위값**을 채운다. 그 호출 경로는 0099 에서 정해졌고 지금도
그대로다 — 모듈이 `ctx.fetch`(전역 fetch 주입)로 **직접** 요청하고, 인증값은 `ctx.secret`
(`provider:<providerKey>:` 네임스페이스)에서 읽는다(`contracts/usage-report.ts:3-17`).

그 네임스페이스는 **0130 의 핸드셰이크 규약**이었다 — "SSO 모듈이 기록한 토큰을 usage hook /
`${SECRET:}` 이 읽는다"(`infra/config/secret-facade.ts:1-4`). 0157 이 SSO 모듈을 인증 플랫폼으로
갈아끼우면서 **쓰는 쪽이 사라졌다**: 자격증명은 이제 `auth:binding:<id>:` vault 에만 앉고
(`broker.ts:176`·`credential-vault.ts`), connector 는 raw credential 을 **보지 못하며** 요청은
broker 의 `authenticatedFetch` 만 통과한다(`contracts/connector-plugin.ts:1-14`).

즉 usage provider 는 **인증 플랫폼이 관리하는 자격증명으로는 요청을 만들 수 없는 상태**다.
ADFS/WIA 세션·PAT·ID/비밀번호 중 어느 것으로도 사내 사용량 API 를 부를 수 없다. 사용자의 요구는
이 끊긴 자리를 **connector 경로로 잇되**, LLM provider 마다 다른 응답 포맷 때문에 connector 를
provider 에 직접 묶지 않고 **범용 결과 표본(sample)** 을 사이에 두자는 것이다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당 — 원인까지 겨냥한다** | 증상("호출이 달라져야 한다")의 원인은 *네임스페이스 핸드셰이크의 쓰는 쪽 소멸*이다. `provider:` prefix 로 secret 을 **쓰는** 코드는 저장소 전체에 **0곳**이다(`rg 'providerSecretPrefix|createNamespacedSecretFacade'` → 정의 `infra/config/secret-facade.ts:19,27` + 읽는 쪽 `features/usage/external-usage.ts:50` + 배선 `app/bootstrap.ts:512` **뿐**). 반면 자격증명은 `broker.ts:672` 가 `authBindingPrefix` 로만 봉인한다. 요구대로 connector 경로로 옮기면 원인이 닫힌다. |
| 이미 있는 것 아닌가 (기존 코드로 충족되나) | **아니다 — 부분만 있다** | connector 실행 배관(`ConnectorHost.invoke`·`PluginHost`)은 있으나 **소비자가 runtime tool 하나뿐**이다(`plugin-host.ts:223` 의 `ctx.invoke` — `adapters/runtime-tools.ts:77` 계약). connectorId 로 invoke 하는 표면은 **없고**, usage 쪽에는 구독 개념 자체가 없다(`features/usage/` 12파일 중 subscribe 라는 이름은 `subscriber.ts` = 턴 telemetry 집계로 무관). |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **있으나 부족하다 — 근거를 남긴다** | 최소 해법은 "broker 가 `provider:<key>:` 로도 secret 을 복사해 주기". 배제한다: ⓐ AUTH-PLAT-009("connector 는 raw credential 미접근", `connectors/runtime.ts:1-6`)를 usage 경로에 구멍으로 뚫는다 ⓑ browser session(ADFS/WIA) 은 **복사할 값이 없다** — cookie jar 는 Orca Session 안에 있고 값이 아니라 전송 주체다(`broker.ts:376` 주석). 즉 작은 해법은 인증 방식 8종 중 세션 계열을 원리적으로 못 다룬다. |
| 인용 자료가 요구를 부풀리지 않았나 | **부풀림 없음 — 다만 범위를 좁혔다** | 요구가 인용한 선행물은 auth-platform(0157~0174) 자체다. 대조 결과 요구의 전제("호출이 달라져야 한다")는 코드와 일치한다. 다만 **"여러 usage connector 구성"** 은 현재 기본값이 0개인 세계에서의 *계약* 요구다 — `STATIC_USAGE_PROVIDER_MODULES = []`(`features/providers/static/modules/index.ts:15`), `CONFLUENCE_SERVERS = []`(`confluence/servers.ts`). 즉 이번 작업의 산출물은 **폐쇄망 배포가 쓸 계약과 배관**이지 기본 설치의 동작 변화가 아니다. 이 사실을 §범위에 명시한다. |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다 — 하나를 *대체 경로 추가*로 처리** | 상세는 §기존 결정·규칙과의 관계. 0130 의 `provider:<key>:` 핸드셰이크는 **삭제하지 않고 유지**하되(제거는 별도 결정), 인증 플랫폼 자격증명이 필요한 호출의 정본 경로를 subscription 으로 둔다. |

- **사용자에게 올릴 것**(단독 결정 불가):
  1. **레거시 경로(`usage.config` 의 `${SECRET:}` · `usage.provider` 의 `ctx.fetch`)를 언제 걷을 것인가.** 이번엔 무회귀로 남긴다(기본 설치 영향 0). 걷는 시점은 제품 결정이라 Open Question 으로 올린다. → §리스크.
  2. **usage connector 를 UI 템플릿(사용자 추가)으로도 열 것인가.** 이번 범위는 빌드타임 `servers.ts` 만이다(0164 "서버 목록의 정본은 빌드타임" 과 정렬). → §범위 유예 표에 일방향 여부 답변 포함.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| usage provider 계약은 `fetch`·`secret`·`env`·`settings`·`store`·`logger`·`clock` 을 주는 `ExternalUsageContext` 하나이고, 구현은 선언형 `usage.config` 와 훅 `usage.provider` 2종이다 | `app/src/main/contracts/usage-report.ts:3-24` |
| 서비스는 `providerKey` 단위로 in-flight 병합·타임아웃(기본 5000ms)·실패 시 마지막 성공 baseline 폴백(stale 표시)·SQLite 영속을 이미 소유한다 | `features/usage/external-usage-service.ts:25-171` |
| **`provider:<key>:` 네임스페이스에 쓰는 코드는 저장소에 0곳** (읽기 1 + 정의 2 + 배선 1). 전수 `rg` 결과 4 hit 전부 비-writer | `infra/config/secret-facade.ts:19,27` · `features/usage/external-usage.ts:50` · `app/bootstrap.ts:512` |
| 인증 자격증명은 `auth:binding:<id>:` vault 에만 봉인되고 요청 주입은 broker 가 한다. connector 는 `authenticatedFetch` 만 본다 | `features/auth-platform/broker.ts:349-376,672` · `contracts/connector-plugin.ts:49-54` |
| broker 는 요청마다 origin allowlist(`[connector.descriptor.baseUrl]`)·binding 유효성·헤더 탈취를 검사한다. **절대 URL 경로는 거부** | `broker.ts:353-367` · `features/auth-platform/policy.ts` |
| binding ↔ connector 적합성(`acceptedAuthProviders`·target 종류·status)은 **연결 시** `PluginHost` 가 강제한다 | `plugin-host.ts:200-215` |
| connector 를 부르는 유일한 소비자는 runtime tool 이며, `PluginHost.makeServer` 가 활성 연결의 connectionId·abort signal 을 클로저로 물려 준다. **connectorId 로 부르는 공개 표면은 없다** | `plugin-host.ts:217-249` · `adapters/runtime-tools.ts:75-85` |
| connector 는 **하나가 하나의 고정 origin** 이고 활성 연결은 최대 1개다(0158 r4 결정) | `features/connectors/registry.ts:1-27` |
| 패키지는 manifest 를 반드시 통과하고 registry 가 선언↔구현 전 필드를 대조한다. connector 가 **다른 패키지의 provider 를 참조하는 것은 허용**된다 | `features/auth-platform/manifest.ts:76-87,167-168` |
| `AuthenticatedFetchRequest` 는 baseUrl 기준 **상대 경로**만 받고, 컨텍스트 경로는 connector 가 붙인다. 응답은 `text`(기본) / `binary` | `contracts/connector-plugin.ts:20-47` |
| 현재 활성 자산 수: static usage provider **0개**, confluence 서버 **0개**, auth 패키지 **1개**(confluence, provider 2 + connector 0) | `features/providers/static/modules/index.ts:15` · `confluence/servers.ts` · `features/auth-platform/modules/index.ts:33-35` |
| 스케줄러가 5분마다 `refreshAll(providerKeys)` 를 부르고, providerKey 는 `sources/settings/<adapter>/<provider>` 트리에서 열거된다 | `app/bootstrap.ts:517-523` |
| main 레이어 DAG 상 `features/usage` 는 `features/auth-platform` 을 **import 할 수 없다**. 해소책은 ⓐ contracts 승격 ⓑ 구조적 포트 ⓒ 컴포지션 루트 주입 | `app/src/main/AGENTS.md` §feature 수직 슬라이스 · `app/eslint.config.mjs` |
| main 의 원격 요청은 `netFetch`(Chromium) 로만. 소비자는 `typeof fetch` 포트로 주입받고 **기본값을 두지 않는다** | `app/src/main/AGENTS.md` §원격 요청은 Chromium 스택으로만 · `app/bootstrap.ts:515` |
| 도구/connector 결과를 그대로 흘리면 조용한 빈 성공이 된다(0158 verify r1 D5) — 형상 변환은 소비자 책임 | `features/auth-platform/modules/AGENTS.md` §규칙 |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `UsageFeed.publish(sample)` 는 selector 가 일치하는 구독자 **전부**에게 표본을 전달하고 전달 수를 반환한다 (sourceId 일치 · operation 일치 · 둘 다 생략=전건) | `features/usage/usage-feed.test.ts::"selector 가 일치하는 구독자 전부에 전달한다"` | `ExternalUsageService.refresh` → `UsageFeed.publish` |
| 2 | 구독자 하나가 throw 해도 **나머지 구독자가 같은 표본을 받고** publish 는 전달 수를 정상 반환한다 | `usage-feed.test.ts::"구독자 예외가 다른 구독자 전달을 막지 않는다"` | 〃 |
| 3 | `unsubscribe()` 후 그 구독자는 이후 표본을 받지 않는다 | `usage-feed.test.ts::"해지한 구독자는 이후 표본을 받지 않는다"` | `ExternalUsageService` 재구성 시 해지 |
| 4 | 같은 `(sourceId, operation, params)` 를 구독한 provider 가 2개일 때 `refreshAll` 1회에서 `sources.invoke` 는 **정확히 1회** 호출되고 **두 provider 모두** 리포트를 영속한다 | `external-usage-service.test.ts::"같은 source 를 구독한 두 provider 가 invoke 1회를 공유한다"` | `scheduler('provider-usage-report-refresh')` → `refreshAll` |
| 5 | subscription 모듈의 `refresh(providerKey)` 는 map 이 만든 리포트를 영속하고 `entry()` 가 `effectiveLimit.source==='external'` · `stale` 이 `true` 가 아닌 값을 돌려준다 | `external-usage-service.test.ts::"구독 결과를 리포트로 영속하고 fresh 로 표시한다"` | `handlers/misc.ts:277` (`costRefreshProviderUsageReport`) → `refresh` → `entry` |
| 6 | `sources.invoke` 가 실패(`ok:false`)하면 마지막 영속 baseline 을 돌려주고 `entry().effectiveLimit.stale === true` 가 된다 | `external-usage-service.test.ts::"invoke 실패 시 baseline 을 stale 로 돌려준다"` | 〃 |
| 7 | **모든** 표본에 대해 `map` 이 `null` 을 반환하면 새 리포트를 영속하지 않고 baseline + `stale === true` 를 돌려준다 (형식 불일치·미해당 source) | `external-usage-service.test.ts::"map 이 전부 null 이면 baseline 을 유지한다"` | 〃 |
| 8 | `sourceId` 를 **생략한** 구독은 연결된 source 전부의 표본을 받고, 그중 하나라도 map 이 리포트를 만들면 fresh 로 영속된다 (미지정 케이스) | `external-usage-service.test.ts::"sourceId 미지정 구독은 연결된 source 전부를 받는다"` | 〃 |
| 9 | `usage.subscription` 과 `usage.config` 를 **함께** 선언한 모듈은 subscription 경로로 동작한다(우선순위) | `external-usage-service.test.ts::"subscription 이 config 보다 우선한다"` | 〃 |
| 10 | 레거시 `usage.config` / `usage.provider` 모듈은 `sources` 주입 여부와 무관하게 종전대로 리포트를 만든다 | `external-usage-service.test.ts::"레거시 config 경로가 그대로 동작한다"` (기존 케이스 유지) | 〃 |
| 11 | `createUsageConnector(cfg).invoke` 는 operation 선언대로 method·path(`apiBasePath` prefix 포함)·query 를 갖춘 `AuthenticatedFetchRequest` 를 만들고, JSON 응답을 파싱해 `{ok:true,data:{status,contentType,payload}}` 로 돌려준다 | `modules/usage/connector.test.ts::"선언한 operation 을 요청으로 만들고 JSON 을 payload 로 돌려준다"` | `ConnectorHost.invoke` → `usageConnector.invoke` |
| 12 | 선언되지 않은 operation 호출은 `{ok:false, message}` 로 거부된다 (`not_supported` 표준 결과) | `modules/usage/connector.test.ts::"미선언 operation 은 거부한다"` | 〃 |
| 13 | `{name}` 자리표시자는 **선언된 이름만** 치환되고 값은 URL 인코딩되어, `/` · `?` 가 든 파라미터가 선언된 경로 밖으로 나가지 못한다 | `modules/usage/request.test.ts::"선언된 자리표시자만 인코딩해 치환한다"` | 〃 |
| 14 | JSON 이 아닌 응답 본문은 `payload` 에 **원문 문자열**로 실려 오고 예외를 던지지 않는다 | `modules/usage/payload.test.ts::"JSON 이 아니면 원문 문자열을 payload 로 싣는다"` | 〃 |
| 15 | `start()` 는 probe operation 이 2xx 면 `ready`, 401·403 이면 `unauthenticated`, 5xx·네트워크 예외면 `unreachable`, 그 외 4xx 면 `error` 를 돌려준다 (`ConnectorHealth` 4멤버 전수) | `modules/usage/connector.test.ts::"probe 상태코드를 health 4종으로 매핑한다"` | `PluginHost.connect` → `ConnectorHost.start` |
| 16 | **probe 를 선언하지 않은** 설정의 `start()` 는 요청을 0건 보내고 `ready` 를 돌려준다 (미지정 케이스) | `modules/usage/connector.test.ts::"probe 미선언이면 요청 없이 ready"` | 〃 |
| 17 | `createUsageConnectorPackage([cfgA,cfgB])` 의 manifest 는 `parsePluginManifest` 를 통과하고 `AuthRegistry.register` 가 오류 0건으로 connector 2개를 등록한다 | `modules/usage/usage-package.test.ts::"서버 2개 설정이 오류 없이 등록된다"` | `bootstrap.createAuthPlatform` → `AUTH_PLUGIN_PACKAGES` 루프 |
| 18 | 기본값 `USAGE_CONNECTORS = []` 로 만든 패키지는 auth provider 만 등록하고 connector 0개이며, 등록된 provider 는 `targets:['connector']` 라 앱 로그인 게이트를 켜지 않는다 | `modules/usage/usage-package.test.ts::"기본 설정은 connector 0개이고 로그인 게이트를 켜지 않는다"` | 〃 |
| 19 | `PluginHost.invokeConnector(connectorId, req)` 는 활성 연결로 invoke 를 위임하고, 연결이 없거나 준비되지 않았으면 `not_connected` 를 돌려준다 | `plugin-host.test.ts::"connectorId 로 invoke 를 위임하고 미연결은 not_connected"` | `app/usage-source.ts` → `PluginHost.invokeConnector` |
| 20 | `createUsageSourcePort(host)` 는 연결된 connector 를 `list()` 로 노출하고, `invoke` 결과를 `sourceId`·`operation`·`fetchedAt`·`payload` 를 갖춘 `UsageSample` 로 정규화한다 | `app/usage-source.test.ts::"connector 결과를 UsageSample 로 정규화한다"` | `bootstrap.start` → `createUsageSourcePort(auth.pluginHost)` → `ExternalUsageService.sources` |
| 21 | `createUsageSourcePort` 는 connector 가 `{ok:false}` 를 돌려주거나 payload 형상이 계약과 어긋나면 `{ok:false, reason}` 으로 강등한다 (throw 하지 않는다) | `app/usage-source.test.ts::"실패·형상 불일치를 ok:false 로 강등한다"` | 〃 |
| 22 | usage 모듈의 map 컨텍스트에는 `fetch` 도 `secret` 도 없다 — `UsageMapContext` 필드 집합이 `providerKey·settings·store·logger·clock` 으로 고정된다 | `features/usage/usage-feed.test.ts::"map 컨텍스트는 fetch·secret 을 노출하지 않는다"` (키 집합 단언) | `ExternalUsageService` 가 map 호출 시 조립 |
| 23 | 사내 사용량 API 를 `USAGE_CONNECTORS` 에 등록하고 PAT 로 연결하면 설정 → 사용량 탭의 해당 provider 카드가 외부 quota 를 표시한다 | **사람 실기** — `cd app && npm run dev` → 플러그인 탭에서 usage connector 연결(PAT 입력) → 설정 모달 → 사용량 탭 → provider 카드의 한도/사용액 확인 | `handlers/misc.ts:258` (`costProviderSummaries`) → `externalUsage.entry` → `ProviderUsageTab` |

> AC23 의 실행 경로는 비범위에 막혀 있지 않다 — 플러그인 탭 연결 UI(0161·0164)와 사용량 탭
> (0079~0082)은 **이미 프로덕션에 있고**, 이번 작업은 그 사이의 main 배관만 채운다.

## 범위 / 비범위

- **범위**:
  1. 범용 계약 `contracts/usage-source.ts` (`UsageSample`·`UsageSampleRequest`·`UsageSourcePort`).
  2. 구독 허브 `features/usage/usage-feed.ts` (`UsageFeed`) — 순수.
  3. `contracts/usage-report.ts` 에 `usage.subscription` 추가(레거시 2종 유지) + `UsageMapContext`.
  4. `ExternalUsageService` 재구성 — source 종류 해소(subscription > provider > config), 표본
     dedupe·publish·매핑 결과 영속.
  5. 범용 usage connector 패키지 `features/auth-platform/modules/usage/` (설정형 `ConnectorRuntimeV1`
     + 빌드타임 목록 `servers.ts` + 패키지 조립) — **N개 구성 가능**.
  6. `PluginHost.invokeConnector` (connectorId 로 부르는 표면).
  7. 컴포지션 루트: `app/usage-source.ts`(포트 어댑터, 순수 seam) + `bootstrap.ts` 배선.
  8. 문서: `modules/usage/AGENTS.md`(+`CLAUDE.md` stub) · `features/providers/static/modules/AGENTS.md`
     갱신 · `_example` 에 구독형 변형 추가.
- **비범위**: usage connector 의 UI 템플릿(사용자 추가) · 레거시 `${SECRET:}` 경로 제거 ·
  IPC 채널 추가/변경 · renderer 변경 · 새 마이그레이션.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| usage connector UI 템플릿(사용자 추가) | **아니오 — 추가 방향이다.** 템플릿은 `ConnectorTemplateRegistry` 에 배열 한 줄로 붙고(`templates.ts:24-28`), 그때 생기는 `connectorId` 는 **새 ID** 라 기존 빌드타임 ID 를 건드리지 않는다. 다만 템플릿 UI 는 label·baseUrl·apiBasePath 3필드만 받으므로(`contracts/connector-template.ts:22-28`) operation 선언을 UI 로 받을 방법이 없다 — 그 확장은 계약 변경을 수반하므로 지금 서두를 이유가 없다. |
| 레거시 `usage.config`/`usage.provider` 의 `ctx.fetch`·`ctx.secret` 제거 | **아니오 — 제거는 언제 해도 같은 비용이다.** 소비자가 0개(활성 모듈 0)라 지금 지워도 나중에 지워도 diff 크기가 같다. 다만 *유지하는 동안* 인증이 필요한 배포가 잘못된 경로를 고를 수 있으므로 문서에서 명시적으로 갈라 준다. → Open Question. |
| **표본 식별자 이름**(`sourceId` = connectorId, operation 문자열) | **일방향에 가깝다 → 지금 정한다.** 모듈이 `subscription.sourceId` 로 적는 값이 곧 배포의 `USAGE_CONNECTORS[].id` 이고, 그것이 binding·승인 키와 함께 남는다(0161 "인스턴스 주소는 생성 후 불변"). 그래서 **`sourceId` = connectorId 로 못 박고**(별도 별칭 체계를 두지 않는다) 이 결정을 계약 헤더에 적는다. |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `ConnectorHost.invoke`(`features/connectors/runtime.ts:111`) · `PluginHost`
  활성 연결 맵(`plugin-host.ts:79`) · `AuthBroker.authenticatedFetch`(`broker.ts:349`) ·
  `AuthRegistry.register`/`parsePluginManifest` · `createStaticCredentialProvider` ·
  `createBasicCredentialProvider` · `ExternalUsageService` 의 in-flight/타임아웃/baseline 기계.
- 전제:
  - usage connector 는 **연결돼 있어야** 호출된다. 미연결은 실패가 아니라 `not_connected` 강등 →
    baseline stale (부팅 직후·사내망 밖 정상 상태).
  - 사용량 API 응답은 JSON 이 일반적이나 **강제하지 않는다**(AC14).
  - 자격증명은 전부 broker 소유. usage 모듈은 값에 접근하지 않는다.
- **신규 의존성**: **없음.** (zod·기존 모듈만 사용 — 사용자 승인 불요.)

## 설계

### 흐름

```
USAGE_CONNECTORS[]  ──(빌드타임 N개)──►  usage connector (ConnectorRuntimeV1)
        │                                        │ authenticatedFetch (broker 가 credential 주입)
        │                                        ▼
        │                              { status, contentType, payload }
        ▼                                        │
bootstrap: createUsageSourcePort(pluginHost) ────┴──►  UsageSample { sourceId, operation, fetchedAt, payload }
                                                                    │  publish
                                                       ┌────────────┴────────────┐
                                                 UsageFeed (selector 매칭, 예외 격리)
                                                       │                         │
                                          provider A.map(sample)      provider B.map(sample)
                                                       │                         │
                                              ExternalUsageReport        ExternalUsageReport
                                                       └─────► persist + entry() (기존 기계)
```

핵심은 **connector 를 provider 에 매달지 않는다**는 점이다. provider 가 아는 것은
`sourceId`(누구의 결과인지) + `payload`(무엇이 왔는지)뿐이고, connection·binding·credential 은
경계 너머에 남는다. 포맷 해석은 전적으로 `map` 이 한다 — LLM provider 마다 다른 응답을
프레임워크가 알 필요가 없다는 요구가 여기서 성립한다.

### 재사용할 기존 함수·파일

`features/usage/external-usage-service.ts`(in-flight·타임아웃·`staleBaseline`·`persist` 그대로) ·
`features/usage/external-usage.ts`(`effectiveLimitFromReport`) · `features/connectors/runtime.ts`
(`composeAbortSignals` 패턴) · `modules/confluence/index.ts` 의 선언 파생 helper 형태
(`providerDeclaration`·`connectorDeclaration`) — usage 패키지도 **manifest 를 구현에서 파생**한다.

### 레이어 배치

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `contracts/usage-source.ts` | `UsageSample`·`UsageSampleRequest`·`UsageSampleOutcome`·`UsageSourceInfo`·`UsageSourcePort` | contracts | 타입 전용(런타임 0) — 소비 측 테스트가 형상을 고정 |
| `features/usage/usage-feed.ts` | selector 기반 구독·팬아웃·예외 격리 | features/usage | 순수 단위 (`usage-feed.test.ts`) |
| `features/usage/external-usage-service.ts` (개정) | source 종류 해소 + 표본 dedupe + 매핑 결과 영속 | features/usage | 기존 스텁 DB 로 단위 (`external-usage-service.test.ts`) |
| `features/auth-platform/modules/usage/request.ts` | operation 선언 → `AuthenticatedFetchRequest` (자리표시자 치환·인코딩·`apiBasePath` prefix) | features/auth-platform | **순수** (`request.test.ts`) |
| `.../modules/usage/payload.ts` | 응답 → `{status,contentType,payload}` (JSON 파싱 시도) | 〃 | **순수** (`payload.test.ts`) |
| `.../modules/usage/connector.ts` | `ConnectorRuntimeV1` — 위 둘을 순서대로 부르는 오케스트레이션 | 〃 | 스텁 `authenticatedFetch` 단위 (`connector.test.ts`) |
| `.../modules/usage/servers.ts` | 빌드타임 설정 목록(기본 `[]`) | 〃 | 데이터 |
| `.../modules/usage/index.ts` | 패키지 조립(manifest 파생) + provider 2종 | 〃 | `usage-package.test.ts`(registry 실물 등록) |
| `app/usage-source.ts` | `PluginHost` → `UsageSourcePort` 어댑터 | app | **스텁 host 로 단위** (`usage-source.test.ts`) — electron 비의존 |

`features/usage` 는 `features/auth-platform` 을 import 하지 않는다 — `UsageSourcePort` 는
`contracts/` 에 있고 구현은 컴포지션 루트가 주입한다(해소책 1+3). 어댑터를 `app/` 에 두는 이유는
그 자리만이 두 슬라이스를 동시에 알아도 되는 레이어이기 때문이고, **스텁 주입으로 테스트 가능한
seam** 이 되도록 `PluginHost` 대신 구조적 포트(`{ list(); invokeConnector() }`)를 받는다.

### 계약 형상 (요지)

```ts
// contracts/usage-source.ts
export interface UsageSampleRequest { operation: string; params?: Record<string, unknown> }
export interface UsageSample {
  sourceId: string           // = connectorId (일방향 결정, §범위 유예 표)
  operation: string
  fetchedAt: number
  status?: number
  contentType?: string
  payload: unknown           // 해석은 구독자 몫 — 프레임워크는 형식을 모른다
}
export type UsageSampleOutcome =
  | { ok: true; sample: UsageSample }
  | { ok: false; sourceId: string; operation: string
      reason: 'unknown_source' | 'not_connected' | 'invoke_failed' | 'bad_shape'; message?: string }
export interface UsageSourcePort {
  list(): readonly UsageSourceInfo[]                      // { sourceId, label, connected }
  invoke(sourceId: string, req: UsageSampleRequest, signal?: AbortSignal): Promise<UsageSampleOutcome>
}

// contracts/usage-report.ts (추가)
export interface UsageMapContext {          // fetch·secret 없음 — 그것이 이 계약의 보안 속성이다
  providerKey: string
  settings: Record<string, unknown>
  store: { get(key: string): unknown; set(key: string, value: unknown): void }
  logger: (message: string, meta?: Record<string, unknown>) => void
  clock: () => number
}
export interface UsageSubscription {
  sourceId?: string                          // 미지정 = 연결된 source 전부 (map 이 판정)
  request: UsageSampleRequest
  map(sample: UsageSample, ctx: UsageMapContext): ExternalUsageReport | null
}
```

`StaticUsageProviderModule.usage` = `{ config?, provider?, subscription? }`, 해소 우선순위는
**subscription > provider > config**(AC9). 헤더 주석에 못 박는다.

### 서비스 재구성

1. 생성 시 `usage.subscription` 을 가진 모듈마다 `feed.subscribe({sourceId, operation}, listener)`.
   listener 는 `map` → 성공하면 `persist` + fresh 표시, `null` 이면 아무것도 하지 않는다.
2. `refresh(providerKey)`:
   - subscription 모듈이면 대상 sourceId 집합을 정한다 — 명시값 1개, 없으면 `sources.list()` 의
     **connected 인 것 전부**.
   - 표본 키 `sourceId|operation|stableJson(params)` 로 **in-flight 병합** — 두 provider 가 같은
     호출을 요구하면 invoke 는 1회(AC4).
   - 결과가 `ok:true` 면 `feed.publish(sample)`. 매핑이 하나라도 성공했으면 그 리포트를 반환,
     전부 실패/`null` 이면 `staleBaseline`(AC7).
   - `ok:false` 면 `staleBaseline`(AC6).
3. 레거시 두 경로는 코드 이동 없이 그대로 남는다(AC10).
4. `sources` 미주입(구 배선·테스트)이면 subscription 모듈은 항상 `staleBaseline` — 조용한 성공을
   만들지 않는다.

### 범용 usage connector

```ts
export interface UsageOperationSpec {
  method: 'GET' | 'POST'
  path: string                                   // baseUrl 기준 상대 경로, `{name}` 치환
  query?: Record<string, string>                 // 값에도 `{name}` 치환
  headers?: Record<string, string>
  body?: string
}
export interface UsageConnectorConfig {
  id: string; label: string; baseUrl: string; apiBasePath?: string
  acceptedAuthProviders?: readonly string[]      // 기본 = 이 패키지의 PAT·Basic provider 2종
  presentation?: CredentialPresentation          // 기본 = header Bearer
  presentations?: Partial<Record<AuthMechanism, CredentialPresentation>>
  probe?: { operation: string }                  // 미지정이면 요청 없이 ready (AC16)
  operations: Record<string, UsageOperationSpec> // 미선언 operation 은 거부 (AC12)
}
```

- **제약 필드의 강제 지점**(관문 3 P15): `operations` 키 = invoke 허용 목록(강제자 = `connector.invoke`,
  시점 = 호출 시) · `{name}` 자리표시자 = 파라미터 허용 목록(강제자 = `buildRequest`, 시점 = 요청
  조립, 값은 `encodeURIComponent`) · `baseUrl` origin = 요청 대상 허용 목록(강제자 = broker
  `checkOutboundRequest`, 시점 = 매 요청) · `acceptedAuthProviders` = binding 허용 목록(강제자 =
  `PluginHost.assertBinding`, 시점 = 연결) · `apiBasePath` = 경로 prefix(강제자 = `buildRequest`).
- `ConnectorHealth` 4멤버(`ready`·`unauthenticated`·`unreachable`·`error`)를 probe 상태코드에서
  전수 매핑한다(AC15) — 미선언 probe 는 요청 0건 ready(AC16).
- 패키지 provider 2종은 `targets:['connector']` 로 좁힌다 — 기본값을 쓰면 **앱 로그인 게이트가
  켜진다**(0164 verify D1, `modules/AGENTS.md` 경고). AC18 이 이 사실을 단언으로 잠근다.
- 배포는 `servers.ts` **한 파일만** 고쳐 N개를 켠다(0164 의 confluence 규약과 동일).

### bootstrap 배선

```ts
// createAuthPlatform 내부: 패키지 목록에 usage 패키지가 이미 포함(AUTH_PLUGIN_PACKAGES)
// start() 후반, ExternalUsageService 생성부:
const usageSources = createUsageSourcePort({
  list: () => auth.pluginHost.list(),
  invokeConnector: (id, req, signal) => auth.pluginHost.invokeConnector(id, req, signal)
})
const externalUsage = new ExternalUsageService({ db, secretFor, providers, fetchImpl: netFetch,
                                                 sources: usageSources })
```

스케줄러 job(`provider-usage-report-refresh`, 5분)은 그대로 `refreshAll` 을 부른다 — 구독 경로가
그 안에서 돈다. 순서상 `createAuthPlatform` 은 `start()` 최상단(`bootstrap.ts:364`)이고
`ExternalUsageService` 는 후반(`:509`)이라 pluginHost 는 이미 존재한다.

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| "connector 는 raw credential 을 절대 보지 않는다 — `authenticatedFetch` 만" (AUTH-PLAT-009) | `features/connectors/runtime.ts:1-6` · `contracts/connector-plugin.ts:1-14` | §설계 "provider 가 아는 것은 sourceId + payload 뿐" · `UsageMapContext` 에 fetch·secret 없음 | **유지 — 강화한다.** usage 경로가 credential 을 보던 마지막 자리를 없앤다(AC22). |
| `provider:<key>:` 네임스페이스는 usage provider ↔ SSO 모듈의 토큰 핸드셰이크 규약(0130) | `infra/config/secret-facade.ts:1-4` (계약 헤더 주석) | §Context "쓰는 쪽이 사라졌다" · §범위 "레거시 제거는 비범위" | **유지(무회귀), 정본 지위만 강등.** 주석에 "0157 이후 쓰는 쪽 없음, 인증 필요한 호출은 0176 구독 경로" 를 덧붙인다. 제거는 Open Question. |
| static usage provider 는 opt-in 이고 코어는 provider 이름 분기를 갖지 않는다(0099) | `features/providers/static/index.ts:8-24` | §설계 "프레임워크가 형식을 모른다" · 서비스 재구성 4단계 | **유지.** 새 경로도 분기 없이 모듈 선언만으로 켜진다. |
| connector 하나 = 고정 origin = 활성 연결 1개 (0158 r4) | `features/connectors/registry.ts:1-27` (계약 헤더 주석) | §설계 "usage connector … N개", `sourceId` = connectorId | **유지.** 여러 개는 **connector 를 여러 개 두어** 얻는다 — 한 connector 에 연결 여러 개가 아니다. |
| 서버 목록의 정본은 빌드타임, UI 추가는 디버그 토글 뒤 (0164) | `modules/confluence/AGENTS.md` §두 가지 사용 경로 | §범위 비범위 "UI 템플릿" · `servers.ts` 한 파일 | **유지.** usage connector 도 빌드타임 목록만 연다. |
| manifest 를 반드시 통과하고 선언은 구현에서 파생한다 | `features/auth-platform/manifest.ts:1-8` · `modules/confluence/index.ts:102-137` | §설계 "manifest 를 구현에서 파생한다" | **유지.** 같은 helper 형태를 usage 패키지에 둔다. |
| `targets:['connector']` 로 좁히지 않으면 앱 로그인 게이트가 켜진다 (0164 verify D1) | `modules/AGENTS.md` §규칙 경고 · `providers/static-credential.ts:47-53` | §설계 "패키지 provider 2종은 `targets:['connector']`" · AC18 | **유지 — 테스트로 잠근다.** |
| main 의 원격 요청은 `netFetch` 만, 소비자는 포트 주입·기본값 금지 (0173) | `app/src/main/AGENTS.md` §원격 요청 | §설계 bootstrap 배선(기존 `fetchImpl: netFetch` 유지) | **유지.** 신규 경로는 broker → `createSender(fetchImpl)` 로 이미 그 스택을 탄다 — 새 전송 구현을 만들지 않는다. |
| feature 슬라이스 교차 import 금지 (`eslint-plugin-boundaries`) | `app/eslint.config.mjs` · `src/main/AGENTS.md` | §레이어 배치 표 전체 | **유지.** contracts 승격 + app 주입으로 해소. |
| 도구/connector 결과를 그대로 흘리면 조용한 빈 성공 (0158 verify r1 D5) | `modules/AGENTS.md` §규칙 | §설계 "매핑이 하나라도 성공했으면 …, 전부 null 이면 staleBaseline" | **유지.** `null` 을 성공으로 접지 않는다(AC7). |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **미연결 상태가 정상이다.** 부팅 직후·사내망 밖·로그아웃 후에는 usage connector 가 연결되지
  않는다 → `not_connected` → baseline stale. 사용량 카드는 마지막 값 + stale 표시를 유지한다
  (기존 0111 동작 재사용).
- **연결 해제 중 refresh.** binding 종료(`stopByBinding`) 와 5분 job 이 겹칠 수 있다.
  `PluginHost.invokeConnector` 는 활성 연결 스냅샷을 보고 없으면 즉시 `not_connected` 를
  돌려주며, 진행 중 호출은 연결의 abort signal 로 끊긴다(예외는 `invoke_failed` 로 강등).
- **부분 실패 팬아웃.** source A 는 성공, B 는 실패일 때 A 를 구독한 provider 는 fresh, B 만
  구독한 provider 는 stale 이 된다 — 한 source 의 실패가 다른 provider 를 오염시키지 않는다.
- **map 이 throw.** 구독자 예외는 feed 가 격리해 다른 구독자 전달을 막지 않고, 해당 provider 는
  리포트를 못 만든 것으로 취급(=stale)한다(AC2).
- **타임아웃.** 기존 5초(`DEFAULT_TIMEOUT_MS`)는 HTTP 1회 기준이다. connector invoke 는
  `ConnectorHost` 의 기본 60초와 겹치므로, 구독 경로는 **usage 쪽 타임아웃을 signal 로 전달**해
  짧은 쪽이 이기게 한다(사용량 갱신이 1분씩 매달리지 않도록).
- **앱 종료.** 종료 시 스케줄러가 먼저 멈추고(`Scheduler.stopAll()` → `closeDb`) 진행 중 invoke 는
  abort 된다 — 새 영속 경로를 만들지 않으므로 기존 종료 순서를 바꾸지 않는다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 경로가 3종(config·hook·subscription)이 되어 "어느 것을 쓰나" 가 흐려진다 | 우선순위를 계약 헤더 + `modules/AGENTS.md` 에 한 문장으로 못 박고(AC9 가 잠근다), 문서에 **"인증이 필요하면 subscription, 공개 endpoint 면 config"** 결정표를 둔다. |
| `payload: unknown` 은 타입 안전을 map 에 떠넘긴다 | 의도된 트레이드오프다 — 포맷을 프레임워크가 모르는 것이 요구다. 대신 `map` 이 `null` 을 돌려주는 것이 **정상 경로**이며 프레임워크가 baseline 으로 접는다(AC7). |
| 표본 dedupe 키에 `params` 를 넣으면 순서 차이로 같은 호출이 갈릴 수 있다 | 키 생성은 정렬된 안정 직렬화(`stableJson`)로 한다 — 단위 테스트로 고정(AC4 가 같은 키를 요구). |
| usage connector 설정이 잘못되면 패키지 등록이 **all-or-nothing** 으로 통째 거부된다 | 기존 진단 경로를 그대로 탄다 — `diagnostics` → `orca:plugin:diagnostics` 배너(0164 r2). 새 침묵 경로를 만들지 않는다. |
| 기본 설치 동작이 바뀌지 않아 회귀를 실사용으로 못 본다 | AC17·18 이 **설정 2개 / 기본값 0개** 두 상태를 테스트로 고정하고, 실사용 확인은 AC23(사람 실기)로 분리했다. |

- 되돌리기 어려운 결정: **`sourceId` = connectorId** (모듈 선언·배포 설정에 문자열로 박힌다) ·
  `usage.subscription` 이라는 계약 필드명.
- **단독 결정 금지 항목(Open Question)** → 사용자에게:
  1. 레거시 `${SECRET:}`·`ctx.fetch` 경로를 언제 제거할 것인가(이번엔 유지).
  2. usage connector 를 UI 템플릿으로 열 것인가(이번엔 빌드타임만).

## 영향 받는 파일

- 신규: `app/src/main/contracts/usage-source.ts` · `app/src/main/features/usage/usage-feed.ts`(+test) ·
  `app/src/main/features/auth-platform/modules/usage/{connector,request,payload,servers,index}.ts`(+tests) ·
  `app/src/main/features/auth-platform/modules/usage/{AGENTS.md,CLAUDE.md}` ·
  `app/src/main/app/usage-source.ts`(+test)
- 개정: `app/src/main/contracts/usage-report.ts` · `app/src/main/features/usage/external-usage-service.ts`(+test) ·
  `app/src/main/features/auth-platform/plugin-host.ts`(+test) · `app/src/main/features/auth-platform/modules/index.ts` ·
  `app/src/main/app/bootstrap.ts` · `app/src/main/infra/config/secret-facade.ts`(주석) ·
  `app/src/main/features/providers/static/modules/{AGENTS.md,_example/*}`
- 문서: `docs/handoff/INDEX.md` · `docs/PHASES.md`(보드 링크)

## 참고 문서

- `docs/arch/backend/security.md` §1.4-b (raw secret 노출 경계표 — 이번 변경은 표를 늘리지 않는다)
- `app/src/main/AGENTS.md` §feature 수직 슬라이스 · §원격 요청은 Chromium 스택으로만
- `app/src/main/features/auth-platform/modules/AGENTS.md` (패키지 규칙)
- `app/src/main/features/providers/static/modules/AGENTS.md` (usage 모듈 계약 — 이번에 갱신)
- IPC 변경: **없음** — `docs/IPC_CONTRACT.md` 갱신 불요.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run`
  (better-sqlite3 ABI egress 차단 환경이면 DB 로드 스위트 실패는 베이스라인으로 분리 보고 —
  `app/AGENTS.md` §제약 환경 게이트 가이드).
- 신규 테스트 요구: `usage-feed.test.ts` · `external-usage-service.test.ts`(구독 케이스 추가) ·
  `modules/usage/{connector,request,payload,usage-package}.test.ts` · `app/usage-source.test.ts` ·
  `plugin-host.test.ts`(invokeConnector 케이스 추가).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건을 라이브 세션 요청에서 인용했고, 추론 2건을 추론으로 표기했다.
- [x] 자료조사 — 14개 발견 전부에 `파일:라인` 레퍼런스를 붙였다.
- [x] 의존 기술 — 신규 의존성 0을 명시했다.
- [x] 파생 UX — 미연결·연결해제 경합·부분 실패·map throw·타임아웃·종료를 이 작업 기준으로 펼쳤다.
- [x] 리스크 — 트레이드오프 5건 + 되돌리기 어려운 결정 2건 + Open Question 2건을 분리했다.

**기계적으로 확인 가능한 것**

- [x] 요구 비판적 검토 5질문에 답했고 범위를 줄이지 않았다(요구한 4가지 산출물 전부 §범위에 있다).
- [x] 인수 기준 23개 전부 `검증 수단` 이 채워져 있고, AC23 만 "사람 실기 + 실행 경로" 로 명시했다.
- [x] 부정형/"불변" 기준 0개 — AC10 도 "종전대로 리포트를 만든다" 는 양성 단언이다.
- [x] AC 끼리 모순 없음 — 짝 검토: AC7(전부 null=미영속) ↔ AC8(하나라도 성공=fresh) 은 상보적,
      AC9(우선순위) ↔ AC10(레거시 유지) 은 서로 다른 모듈을 다룬다, AC15(probe 매핑) ↔ AC16(probe
      미선언) 은 선언 유무로 갈린다.
- [x] 인용 수치를 이번 세션에서 직접 측정했다 — `provider:` writer **0곳**, static usage 모듈
      **0개**, confluence 서버 **0개**, auth 패키지 **1개**, usage feature 파일 **12개**(전부 `rg`/`ls`).
- [x] 신규 모듈 9개 전부 테스트 방법이 있고, electron 의존 지점(`PluginHost`)은 `app/usage-source.ts`
      의 구조적 포트로 순수부 seam 을 뽑았다.
- [x] 전수 조사 대상에 N 수치가 있다(위 항목).
- [x] 각 AC 에 프로덕션 도달 경로가 있다 — 유일한 호출자가 테스트인 AC 0개(AC1~3 도
      `refresh`→`publish` 로 닿는다).
- [x] 사람 실기 AC(23)의 실행 경로가 적혀 있고, 그 경로(플러그인 탭·사용량 탭)는 비범위에 막혀
      있지 않다.
- [x] 선택적 필드 판정마다 미지정 AC 가 있다 — `sourceId` 미지정(AC8) · `probe` 미선언(AC16) ·
      `sources` 미주입(§설계 4단계).
- [x] 소비 계약의 제약 필드마다 강제 지점(누가·언제)을 §설계에 표로 적었다(5개 필드).
- [x] 참조 구현(confluence connector)을 입력으로 썼고, 계약 union 전수 대비 커버리지를 표시했다 —
      `ConnectorHealth` 4멤버(AC15) · `ConnectorResult` 2멤버(AC11·12) · `UsageSampleOutcome`
      reason 4멤버(AC19·21).
- [x] 미룬 항목 3건 전부 일방향 여부에 답했고, 일방향인 `sourceId` 명명은 **지금** 확정했다.
- [x] 관문 4 를 본문 완성 후 돌렸다 — 기존 결정 표 10행을 본문 문장 기준으로 채웠고, 인용 경로를
      `Read`/`rg` 로 전부 열어 확인했으며, `[구현자 기입]`·`[검증자 기입]` 블록이 아래 남아 있다.
- [x] "결정" 으로 서술한 것마다 출처를 확인했다 — 0158 r4 연결 1개(`connectors/registry.ts:1-27`),
      0164 빌드타임 정본(`modules/confluence/AGENTS.md` §두 가지 사용 경로), 0130 핸드셰이크
      (`infra/config/secret-facade.ts:1-4`), 0164 verify D1(`modules/AGENTS.md` §규칙). 모두 실재 확인.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

> 구현자 = **Claude**(이 저장소 환경에 Codex 부재 — 0165~0167 이후 관례). 설계도 같은 세션이
> 썼으므로 자기 설계를 비판적으로 다시 읽었다.

- **동의 / 그대로 진행**
  - §설계 "connector 를 provider 에 매달지 않는다" 는 구현에서도 값을 했다. `features/usage` 가
    auth-platform 을 전혀 모르는 채로 끝났고(신규 import 0), 배선은 `app/usage-source.ts` 한
    파일에 모였다. lint 의 boundaries 규칙이 한 번도 발동하지 않은 것이 그 증거다.
  - §설계 "표본 dedupe" 는 실제로 필요했다 — provider 2개가 같은 사내 API 를 가리키는 것이
    폐쇄망 배포의 기본 형태(어댑터-provider 조합 여럿 ↔ 사용량 API 하나)다.
  - §레이어 배치의 "순수부 seam"(`request.ts`·`payload.ts`)은 connector 테스트의 90% 를
    HTTP 스텁 없이 쓰게 해 줬다.
- **이견 / 우려**
  - §설계가 `UsageMapContext.store` 를 준 것은 과했을 수 있다. 구독 모듈은 커서·토큰을 들고
    있을 이유가 거의 없다(연속 호출은 connector 쪽 관심사다). 다만 훅 경로와 컨텍스트 형상을
    맞추는 값이 있고 제거는 언제든 가능하므로 **그대로 뒀다**. AC22 가 키 집합을 잠그고 있어
    나중에 줄이면 그 테스트가 알려 준다.
  - AC15(probe health 매핑)의 `error` 분기(4xx 중 401/403 이 아닌 것)는 실제로는 대개
    "경로 오타" 다. 상태만으로는 그 사실을 사용자에게 말해 줄 수 없다 — 메시지에 HTTP 코드를
    싣는 선에서 멈췄다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 설계는 **오류 응답(4xx·5xx)을 어느 쪽으로 접을지 말하지 않았다.** 그대로 표본으로 올리면 오류 본문(JSON 오류 객체)을 quota 로 읽는 map 이 나올 수 있고, 그 순간 **잘못된 값이 권위값으로 영속**된다. | ✅ 구현함 — `connector.invoke` 가 `status >= 400` 을 `{ok:false, health}` 로 접는다. 표본이 만들어지지 않으므로 서비스는 baseline stale 로 간다. 회귀: `connector.test.ts::"4xx·5xx 응답은 표본이 아니라 실패로 돌려준다"` | 0158 verify r1 D5("결과를 그대로 흘리면 조용한 빈 성공")의 usage 판 |
| 2 | 설계의 "usage 쪽 타임아웃을 signal 로 전달" 은 **두 취소원(연결 종료 + 호출자 타임아웃)이 겹친다**는 사실을 다루지 않았다. `ConnectorHost.invoke` 는 signal 을 하나만 받는다. | ✅ 구현함 — `PluginHost.invokeConnector` 가 둘을 하나로 접고 **끝나면 리스너를 되돌린다**(장수 연결에 리스너가 쌓이지 않도록). 회귀 2건: `plugin-host.test.ts::"binding 종료가 진행 중인 connectorId 호출을 끊는다"`·`"호출자 취소도 그 호출만 끊는다"` | `features/connectors/runtime.ts` 의 `composeAbortSignals` 선례 |
| 3 | 설계는 map 이 만든 리포트의 `providerKey` 를 **누가 정하는지** 말하지 않았다. 모듈이 남의 키를 적으면 다른 provider 의 캐시 행을 덮어쓴다. | ✅ 구현함 — 서비스가 `{ ...mapped, providerKey }` 로 **구독자의 키를 강제**한다(`external-usage-service.ts` 의 `subscribe`). | 이름 오염은 조용히 퍼지는 부류 |
| 4 | `_example` 세 변형 중 어느 것을 골라야 하는지 문서가 갈라 주지 않으면, 인증이 필요한 배포가 `${SECRET:}` 경로를 골라 **빈 토큰으로 401 을 맞는다**(원인이 안 보이는 실패). | ✅ 구현함 — `modules/AGENTS.md` 에 "endpoint 가 인증을 요구하면 subscription" 결정표 + "0157 이후 `ctx.secret` 에 값을 넣어 주는 코드가 없다" 경고를 넣고, `_example/provider-subscription.ts` 를 추가했다. | 관문 0 의 "레거시 유지" 결정이 낳는 실사용 함정 |
| 5 | `USAGE_CONNECTORS` 가 비었을 때도 패키지가 등록되면 **provider 2종이 항상 올라간다.** `targets` 를 잘못 적으면 신규 설치 전부에 앱 로그인 게이트가 켜진다. | ✅ 구현함(예방) — `targets:['connector']` 로 좁히고 `usage-package.test.ts::"기본 설정은 connector 0개이고 로그인 게이트를 켜지 않는다"` 가 `providersForTarget('application') === []` 를 잠근다. | 0164 verify D1 재발 방지 |
| 6 | 레거시 경로 제거 시점 · UI 템플릿 개방 여부 | ⚠️ 보고만 — **사용자 결정 필요**(§리스크 Open Question 2건). 이번 구현은 둘 다 현행 유지. | 제품 결정 |

## [구현자 기입] 구현 체크리스트

- [x] `contracts/usage-source.ts` — 표본·포트 계약(구조적 포트, features 무의존)
- [x] `contracts/usage-report.ts` — `usage.subscription` + `UsageMapContext`(fetch·secret 없음)
- [x] `features/usage/usage-feed.ts` — selector 팬아웃 + 구독자 예외 격리 (+3 테스트)
- [x] `features/usage/external-usage-service.ts` — 우선순위 해소·표본 dedupe·매핑 영속 (+8 테스트)
- [x] `features/auth-platform/modules/usage/` — `spec`·`request`·`payload`·`connector`·`servers`·`index` (+23 테스트)
- [x] `features/auth-platform/plugin-host.ts` — `invokeConnector` (+3 테스트)
- [x] `app/usage-source.ts` — PluginHost → 포트 어댑터 (+5 테스트)
- [x] `app/bootstrap.ts` — `sources` 배선 · `modules/index.ts` 패키지 등록
- [x] 문서 — `modules/usage/{AGENTS,CLAUDE}.md` · `modules/AGENTS.md` · `providers/static/modules/AGENTS.md` · `_example/provider-subscription.ts` · `secret-facade.ts` 헤더 · `src/main/AGENTS.md`

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 12(계약 1 · usage-feed 1+테스트 1 · modules/usage 6+테스트 4 · app/usage-source 1+테스트 1 · 문서 2 · `_example` 1), 개정 8(`usage-report`·`external-usage-service`(+테스트)·`plugin-host`(+테스트)·`modules/index`·`bootstrap`·`secret-facade`·AGENTS 3종) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` |
| 게이트 결과 | lint **0 error**(warning 1 = 0102 베이스라인) · typecheck **3/3** · vitest **2043/2043 통과**(215 파일 중 214 로드) · scripts **28/28** |
| 환경 제약 | `src/main/app/chat-turn.continuity.test.ts` **1파일이 로드 실패** — `Electron failed to install correctly`(egress 차단으로 electron 바이너리 미설치). 코드 무관·변경 전과 동일한 베이스라인이며, DB 스위트는 `npm rebuild better-sqlite3`(Node ABI) 후 전부 green. `app/AGENTS.md` §제약 환경 게이트 가이드의 분리 보고 규칙을 따른다. |
| 블로커 / 역질문 | 없음. 사용자 결정 대기 2건(레거시 `${SECRET:}` 제거 시점 · usage connector UI 템플릿 개방) — 둘 다 현행 유지로 진행. |
| 대상 커밋 | (아래 구현 커밋) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

> verify r1 = **PASS**. 아래 3건은 통과를 막지 않는 **후속** 항목이다 — 라운드를 넘겨 추적한다.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 구독 모듈의 `UsageMapContext.settings` 는 **모듈 선언 기본값**(`module.defaultSettings`)이지 디스크의 `sources/settings/<adapter>/<provider>/settings.json` 이 아니다. 훅 경로(`ExternalUsageContext.settings`)와 **같은 기존 동작**이라 회귀는 아니지만, 배포가 settings.json 을 고쳐도 map 이 못 본다 — 이름이 같아서 오해하기 쉽다. | verify r1 §비판적 검토(코드 대조) | ⓐ 문서에 "선언 기본값" 임을 명시하거나 ⓑ `ProviderSettingsService` 해석값을 주입한다(두 경로 공통). ⓑ 는 feature 교차라 컴포지션 루트 주입이 필요하다. | open |
| D2 | 구독 경로의 타임아웃이 `DEFAULT_TIMEOUT_MS`(5s) 고정이다. `usage.config` 는 `timeoutMs` 를 선언할 수 있는데 구독 계약에는 없다 — 느린 사내 집계 API 를 가진 배포가 조절할 수단이 없다. | verify r1 §비판적 검토("설계보다 좁게 구현") | `UsageSubscription.timeoutMs?` 를 더하고 `fetchViaSubscription` 이 읽게 한다(가산적 계약 변경). | open |
| D3 | probe 실패의 `error`(401/403·5xx 가 아닌 4xx)는 실무상 대개 **경로 오타**인데, 사용자에게는 "예상치 못한 응답 (HTTP 404)" 로만 보인다. | 구현자 §설계 리뷰 이견 + verify r1 확인 | 실패 진단 로그에 **operation 이름과 조립된 상대 경로**를 싣는다(값·쿼리는 제외 — 0174 의 진단 상한 규약). | open |

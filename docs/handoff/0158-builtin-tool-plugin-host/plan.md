# Plan — 0158-builtin-tool-plugin-host

## 메타

| 항목 | 값 |
|---|---|
| slug | `0158-builtin-tool-plugin-host` |
| 작성자 | Claude Code (r1~r3) · Codex (r4 사용자 결정 반영) |
| 일자 | 2026-08-02 · r4 2026-08-03 |
| 매핑 | PHASES 신규 행 (Phase 3++) / PR 미생성 |
| 상태 | IMPL_DONE (**r7**, `7f606cf` pre-aborted connector work 보완까지 구현 완료) |

### 설계 개정 이력

| 라운드 | 계기 | 개정 |
|---|---|---|
| r1 | 최초 작성 | 런타임 도구 배관과 내장 플러그인 호스트 초안 |
| r2 | 설계 리뷰 7건 + 문서 결함 2건 | 승인 fail-closed, 기존 다단계 auth 재사용, provider allowlist 강제, logout 실제 경로 정리, 정적 descriptor 도입 |
| r3 | “Jira 서버가 여러 개라 연결을 두 개 한다”는 사용자 설명 | 같은 connector의 런타임 인스턴스를 alias로 구분하는 안 채택 |
| **r4** | 사용자 결정: **“서버마다 별도 정적 connector”**, 하위 도메인·소속 부서별 connector 제공. 추가 확인으로 **정적 connector당 활성 연결 1개** 확정 | r3 alias 모델 폐기. 고정 origin을 가진 connector를 서버마다 등록하고 도구 ID도 정적으로 고정한다. binding target을 connection ID의 SSOT로 삼고, runtime tool→connector 매핑·승인 메타데이터 SSOT·provider logout 실패 시 로컬 정리까지 함께 닫는다 |
| **r5** | 구현 리뷰에서 automatic continuation의 실제 handler 배선과 one-shot spawn metadata 정리 누락을 발견 | listen·flush 모두 원래 선택 model family를 재해석하고, stale 판정과 요청에 같은 fresh runtime-tool snapshot을 쓴다. one-shot 종료도 provider settings·model·runtime-tool revision metadata를 함께 비운다. |
| **r6** | whole-review에서 PluginHost 소유 취소 신호가 ConnectorHost start/invoke 경계에서 끊기고 IPC 문서·AC 증빙이 실제 코드와 어긋남을 발견 | `3400908`에서 host signal을 connector start와 invoke timeout 합성 신호까지 전달하고, disconnect·provider logout 실패·cascade cleanup의 in-flight abort 회귀를 고정했다. IPC plugin 응답/스키마명을 실제 계약으로 정정하고 문서 82채널 count를 실행형 테스트로 고정했다. |
| **r7** | 이미 abort된 caller signal이 connection record를 만들고 connector start/invoke plugin 코드를 호출할 수 있으며, cleanup 뒤 cached tool handler도 이를 우회할 수 있음을 재검토에서 발견 | `7f606cf`에서 `ConnectorHost.connect/start/invoke`의 plugin 호출 전 preflight를 추가해 zero-call을 보장하고, cached handler를 PluginHost에서도 단락했다. pending-start는 실제 abort listener로 settle하도록 강화했다. |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “플러그인 모듈을 만들어야 한다. 내장 플러그인 추가가 정해진 모듈 규칙대로 쉽게 확장되어야 하며, 메인 코드 수정이 없어야 한다. 철저히 확장을 통해 추가되어야 함” | 라이브 세션 요청 (2026-08-02) |
| 명시 요구 | 참고 자료와 테스트 클론을 먼저 비판적으로 검토 | 라이브 세션 요청 (2026-08-02) |
| 명시 결정 | 기준선은 **픽스처 플러그인으로 호스트만**, 실제 Confluence 플러그인과 renderer 화면은 제외 | 라이브 세션 질의 응답 (2026-08-02) |
| 명시 결정 | 등록 방식은 `features/auth-platform/modules/index.ts`의 **opt-in 배열 유지** | 라이브 세션 질의 응답 (2026-08-02) |
| 명시 결정 | 인증은 0157의 기존 auth platform을 재사용 | 라이브 세션 질의 응답 (2026-08-02) |
| 명시 결정 | **서버마다 별도 정적 connector**를 둔다. 추후 UI는 여러 Confluence/Jira connector를 하위 도메인과 소속 부서에 따라 안내한다 | 라이브 세션 요청 (2026-08-03) |
| 명시 결정 | **정적 connector 하나당 활성 연결은 1개**다. 같은 서비스 서버가 더 필요하면 별도 connector ID로 등록한다 | 라이브 세션 승인 (2026-08-03) |
| 추론 의도 | “메인 코드 무수정”은 호스트 도입 후 N번째 사내 모듈을 추가할 때 core 분기·핸들러·승인 목록을 고치지 않는다는 뜻이다. 이번 핸드오프는 그 확장점을 한 번 도입하므로 core 배선 변경이 필요하다 | `modules/AGENTS.md:6-12` + 사용자 opt-in 배열 결정 |

## Context (왜)

0157은 정적 auth provider·connector manifest, binding, credential broker, connector runtime을 만들었지만 플러그인이 **LLM 런타임 도구**를 기여하는 계약과 SDK 배관은 없다. 현재 `app/src`에서 `createSdkMcpServer`와 `pluginList` 계열 IPC는 각각 **0회**이고, `claude.ts`는 `mcpServers`를 전달하지 않는다.

사내 Jira·Confluence는 제품명이 같아도 부서별 하위 도메인과 접근 권한이 다르다. 이를 “하나의 connector + 사용자 입력 URL + alias”로 표현하면 endpoint 선택이 런타임 입력으로 이동하고, 도구 이름과 승인 키도 연결별로 달라진다. 사용자는 이 모델을 거부하고 **서버/하위 도메인마다 고정 descriptor를 가진 connector를 등록**하는 방향을 확정했다.

따라서 이번 목표는 다음 한 문장이다.

> 고정 origin을 가진 정적 connector와 그 connector 전용 런타임 도구를 빌드 타임 모듈로 등록하면, core에 서비스 문자열이나 분기를 추가하지 않고 인증→연결→도구 노출→승인→정리까지 동작한다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 (`파일:라인` · 실측) |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당.** 현행 확장 계약은 provider와 connector까지만 표현하고 런타임 도구 기여는 표현하지 못한다 | `features/auth-platform/manifest.ts:68-91` · 현재 `runtime-tool|plugin-host` 파일 **0개** |
| 이미 있는 것 아닌가 | **절반 있다.** manifest 등록 위생, binding, broker, `ConnectorHost`, opt-in 배열은 재사용한다. 없는 것은 runtime tool 계약·SDK 변환·연결 lifecycle 오케스트레이터다 | `auth-platform/registry.ts:35-156` · `connectors/runtime.ts` · `modules/index.ts:26` |
| 더 작은 해법이 있는가 | **채택안이 더 작다.** 기존 `ConnectorDescriptor.baseUrl`은 이미 고정 origin이므로 서버별 descriptor를 여러 개 만드는 것만으로 부서별 서버를 표현할 수 있다. 동적 URL·alias·별도 endpoint 저장소가 필요 없다 | `contracts/connector-plugin.ts:41-57` · `manifest.ts:20-28,73-81` |
| 인용 자료가 요구를 부풀리지 않았나 | **그렇다.** 참고 구현의 Confluence 전용 핸들러·동적 endpoint·제품 telemetry는 범용 호스트의 필수 조건이 아니다. 범용 도구 배관과 lifecycle만 이식한다 | 사용자 확정 “픽스처로 호스트만” · 현재 저장소 Confluence 구현 없음 |
| 기존 채택 결정을 뒤집는가 | **한 건 뒤집는다.** 0157의 `ConnectionRegistry` 헤더는 같은 connector를 여러 사내 인스턴스에 연결한다고 적었으나, 사용자가 서버마다 connector를 분리하고 connector당 1연결로 확정했다 | `features/connectors/registry.ts:1-13` · r4 사용자 승인 |

- **사용자에게 올릴 것**: 없음. endpoint 모델과 연결 cardinality 모두 사용자 확정.

## 자료조사 (Research)

> 아래 수치와 현행 계약은 r4 세션에서 다시 측정했다. 과거 sibling clone의 줄 수는 설계 근거에서 제외했다.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `app/src`의 `createSdkMcpServer` **0 hits**, `claude.ts`의 `mcpServers` 토큰 **0**, plugin IPC 토큰 **0** | r4 PowerShell 전수 검색 |
| `runtime-tool` 또는 `plugin-host` 이름의 main 파일 **0개** | r4 `Get-ChildItem app/src/main -Recurse` 실측 |
| IPC 채널은 **79개**이고 `CHANNELS` 범위는 `shared/ipc.ts:10-108` | r4 `CHANNELS` 블록의 `'orca:` 전수 계수 |
| `app/handlers/*.test.ts`는 **0개**다. Electron 핸들러는 얇게 두고 순수 호스트·스키마를 테스트해야 한다 | r4 파일 전수 계수 |
| `AUTH_PLUGIN_PACKAGES`는 현재 빈 배열이고 패키지 활성화 지점은 한 곳이다 | `modules/index.ts:26` |
| connector descriptor는 이미 `id`, `pluginId`, `label`, `acceptedAuthProviders`, **고정 `baseUrl`**, credential `presentation`을 가진다 | `contracts/connector-plugin.ts:41-59` |
| manifest `OriginSchema`는 http/https **origin만** 허용하고 path/query를 거부한다 | `auth-platform/manifest.ts:20-28` |
| 현행 `ConnectionRegistry`는 자동 connection ID를 만들고 connector당 N개를 허용한다 | `connectors/registry.ts:15-58` |
| `AuthTarget.kind='connector'`는 이미 `connectorId`와 `connectionId`를 함께 가진다 | `shared/ipc.ts:153-156` |
| `AuthBindingInfo`는 target·providerId·status를 보유하므로 연결 전에 connector·connection·provider 소속과 유효 상태를 모두 검사할 수 있다 | `shared/ipc.ts:196-213` |
| `AuthStep`은 `collect`·`browser`·`device_code`·`done`·`failed`·`not_supported` **6분기**이고 `continue`는 반복될 수 있다. PluginHost가 이를 재구현하면 계약 누락이 생긴다 | `contracts/auth-plugin.ts:135-151` |
| registry의 cross-reference 검사는 `acceptedAuthProviders`가 **존재하는지**만 확인하고, 특정 binding의 provider 소속은 연결 시점에 검사하지 않는다 | `auth-platform/registry.ts:141-156` |
| `broker.logout`은 provider 실패 여부와 무관하게 vault와 binding을 제거하지만, 실패 결과에는 `endedBindingIds`가 없고 외부 정리 callback도 없다 | `auth-platform/broker.ts:211-239` |
| main DAG는 feature 교차 import를 금지한다. auth-platform의 PluginHost는 connector·extension 구현을 직접 import하지 않고 구조적 포트를 받아야 한다 | `app/eslint.config.mjs:107-128` · `app/src/main/AGENTS.md` |
| SDK 도구 이름은 기존 조사에서 `mcp__<serverName>__<toolName>`으로 확정됐고, MCP `readOnlyHint` 미지정은 읽기 전용이 아닌 안전한 기본값으로 처리해야 한다 | `@anthropic-ai/claude-agent-sdk@0.3.220` 타입 조사(r2) · MCP 타입 조사(r2) |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 (`파일::케이스`) | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `adapters/runtime-tools.ts`는 backend·서비스 중립 계약이며 서비스 식별자와 Electron/DB import가 없다 | 수동: `adapters/runtime-tools.ts` import 표면 검토(backend/service·Electron/DB runtime import 0) · `npm run lint` · `npm run typecheck` — 이 타입 전용 계약에는 자기충족 source-scan보다 실제 import 검토가 정직한 검증이다 | `modules/*` → `AuthRegistry`/`PluginHost` → `RuntimeToolSink` |
| 2 | `adaptRuntimeTools`는 서버 ID를 `mcpServers` key와 `createSdkMcpServer({name})`에 동일하게 사용한다 | `adapters/claude-runtime-tools.test.ts::"서버 식별자를 하나로 사용한다"` | `ExtensionBuilder.snapshot` → `adapters/turn.ts` → `ClaudeAdapter` |
| 3 | runtime tool snapshot이 없거나 비면 Claude options에 `mcpServers` key가 생기지 않는다 | `adapters/claude-runtime-tools.test.ts::"빈 스냅샷은 빈 옵션을 반환한다"` | `ExtensionBuilder` → `ClaudeAdapter.buildOptions` |
| 4 | manifest의 runtime tool 선언과 구현 descriptor는 manifest ID↔descriptor.pluginId, id·connectorId·apiVersion·서버 옵션·도구 이름/설명/annotations까지 정규화 후 동등해야 하며, 선언/구현 한쪽만 있어도 패키지 전체를 거부한다 | `auth-platform/registry.test.ts::"runtime tool 선언과 descriptor 전체를 대조한다"` · `::"선언과 구현의 1대1 불일치를 거부한다"` | `Bootstrap.createAuthPlatform` → `AuthRegistry.register` |
| 5 | connector 구현 descriptor도 manifest ID·label·acceptedAuthProviders·baseUrl·presentation과 전부 일치해야 한다. runtime tool의 `connectorId`는 같은 package의 connector를 가리키고, server ID와 tool name 중복은 등록 단계에서 거부된다 | `auth-platform/registry.test.ts::"connector 선언과 descriptor 전체를 대조한다"` · `::"runtime tool connector 교차 참조와 중복을 검증한다"` | `AuthRegistry.register`/`validateCrossReferences` |
| 6 | connector origin은 manifest의 고정 `baseUrl`에서만 오며 connect IPC 요청에는 URL·alias 필드가 없다 | `shared/protocol.plugins.test.ts::"연결 요청은 connectorId와 bindingId만 받는다"` · `auth-platform/registry.test.ts::"connector 선언과 구현 descriptor 전체를 대조한다"` | `window.api.plugins.connect` → `handlers/plugins.ts` → `PluginHost.connect` |
| 7 | PluginHost는 binding이 존재하고 `status='valid'`, target이 connector, target.connectorId가 요청과 같고 providerId가 `acceptedAuthProviders`에 있을 때만 연결한다 | `auth-platform/plugin-host.test.ts::"binding target 상태와 provider 소속을 전부 검증한다"` | `pluginConnectionConnect` → `PluginHost.connect` |
| 8 | connection ID는 `binding.target.connectionId` 하나만 사용하며 connect 요청이나 ConnectorHost가 새 ID로 교체하지 않는다 | `auth-platform/plugin-host.test.ts::"binding target connectionId를 연결 ID로 사용한다"` · `connectors/runtime.test.ts::"명시 ID를 보존한다"` | `authBegin(target)` → binding → `PluginHost.connect` → `ConnectorHost.connect` |
| 9 | 같은 정적 connector의 두 번째 pending/ready 연결은 명시적으로 거부되고 기존 연결·도구는 보존된다. 서로 다른 connector는 동시에 연결된다 | `auth-platform/plugin-host.test.ts::"connector당 활성 연결 하나를 강제한다"` · `::"서로 다른 정적 connector는 공존한다"` | `PluginHost.connect` → `ConnectionRegistry.create` |
| 10 | connector가 ready가 되면 그 connector를 가리키는 모든 runtime tool contribution이 정적 server ID로 등록되고, factory 구현 이름 집합이 descriptor와 다르면 연결을 거부한다 | `auth-platform/plugin-host.test.ts::"ready connector의 정적 도구 서버를 등록한다"` · `::"factory 구현 이름 드리프트를 거부한다"` | `PluginHost.connect` → contribution `create` → `RuntimeToolRegistry.add` |
| 11 | connector start·tool factory·registry add 중 하나가 실패하면 추가된 server와 connection record를 모두 되돌리고 binding은 재시도할 수 있게 유지한다 | `auth-platform/plugin-host.test.ts::"부분 연결 실패를 롤백한다"` | `PluginHost.connect` catch/finally |
| 12 | 도구 factory가 받는 context key는 `{connectionId, invoke, logger, signal}`뿐이고 `invoke`는 자기 connection ID로 고정된다 | `auth-platform/plugin-host.test.ts::"도구 context를 네 capability로 제한한다"` · `::"invoke를 자기 연결에 고정한다"` | `PluginHost.connect` → contribution `create(ctx)` → tool handler |
| 13 | 명시 disconnect는 connector의 모든 runtime server를 제거하고 connection을 중단하며 revision을 증가시킨다 | `auth-platform/plugin-host.test.ts::"disconnect가 connector와 도구를 함께 제거한다"` | `pluginConnectionDisconnect` → `PluginHost.disconnect` → `broker.logout` callback |
| 14 | 정상 `broker.logout`은 `PluginHost.disconnect`를 직접 호출하지 않아도 폐기된 binding의 connector와 runtime server를 제거한다 | `auth-platform/plugin-host.test.ts::"정상 logout이 연결과 도구를 회수한다"` | `authLogout` → `AuthBroker.logout` → `onBindingsEnded` → `PluginHost.onBindingsEnded` |
| 15 | provider logout이 실패해도 broker가 로컬에서 제거한 binding ID에 대해 connector와 runtime server를 회수하고, callback을 await한 뒤 실패를 반환한다 | `auth-platform/broker.test.ts::"provider logout 실패에도 ended callback을 await한다"` · `plugin-host.test.ts::"실패 logout도 도구를 회수한다"` | `authLogout` → `AuthBroker.logout` failure branch → `onBindingsEnded` |
| 16 | cascade logout은 제거된 모든 binding에 대해 연결·runtime server를 한 번씩 정리한다 | `auth-platform/plugin-host.test.ts::"cascade logout이 모든 파생 연결을 정리한다"` | `AuthBroker.logout(cascade:true)` → `onBindingsEnded(ids)` |
| 17 | 도구 설명과 annotations의 SSOT는 정적 descriptor이며 factory는 `{name,inputSchema,handler}`만 반환한다. factory가 승인 메타데이터를 덮어쓸 타입 표면이 없다 | `auth-platform/registry.test.ts::"runtime tool 선언과 descriptor 전체를 이름 정규화 후 대조한다"` · `auth-platform/plugin-host.test.ts::"limits factory context to four capabilities and fixes invocation to its own connection"` · `npm run typecheck` | manifest/descriptor → `PluginHost`가 실행형 server 조립 |
| 18 | `readOnlyHint:true` 도구는 자동 허용되고 `false` 도구는 승인 요청으로 간다 | `adapters/claude.canusetool.test.ts::"runtime tool readOnlyHint로 승인 여부를 판정한다"` | runtime snapshot → `runtime-tool-policy.ts` → `makeCanUseTool` |
| 19 | `readOnlyHint` 또는 annotations가 없으면 쓰기 도구로 분류해 승인 요청으로 보낸다 | `adapters/runtime-tool-policy.test.ts::"미선언 readOnlyHint를 fail-closed 처리한다"` | runtime snapshot → approval policy |
| 20 | runtime server add/remove 때 revision이 증가하고, spawn revision과 다르면 다음 턴 전에 runtime respawn을 지시한다. listen·flush는 같은 fresh snapshot을 판정과 요청에 공유하고, flush는 최초 선택 model family를 보존한다 | `extensions/runtime-tool-registry.test.ts::"실질 변경 때 revision이 증가한다"` · `sessions/respawn-policy.test.ts::"revision 차이가 respawn을 지시한다"` · `app/chat-turn.runtime-tools.test.ts::"stale persistent channel"`/`"non-default selected model"` | `PluginHost` → registry revision → `registerChatHandlers` → `SessionRuntime` |
| 21 | opt-in 배열에 package 한 줄을 추가하면 provider·복수 connector·runtime tools가 같은 등록 경로로 들어가며, fixture 서비스 문자열은 fixture 디렉터리 밖 core에 나타나지 않는다 | `modules/__fixtures__/isolation.test.ts::"fixture 문자열이 core에 새지 않는다"` · `plugin-host.test.ts::"package 배열 등록만으로 확장된다"` | `AUTH_PLUGIN_PACKAGES` → `Bootstrap.createAuthPlatform` |
| 22 | fixture가 `jira-platform`, `jira-security`, `confluence-rnd`처럼 고정 origin이 다른 connector를 제공하고, list 결과가 connectorId·label·origin·pluginId·acceptedAuthProviders·connected 상태로 구분한다 | `auth-platform/plugin-host.test.ts::"부서별 정적 connector 목록과 상태를 기술한다"` | `pluginList` → `PluginHost.list` → 미래 connector 목록 UI |
| 23 | 불량 package 한 개가 정상 package의 등록·연결·도구 노출을 막지 않는다 | `auth-platform/plugin-host.test.ts::"불량 package를 격리한다"` | `Bootstrap` package loop → `AuthRegistry.register` |
| 24 | 신규 IPC 3채널 `pluginList`·`pluginConnectionConnect`·`pluginConnectionDisconnect`가 무효 payload를 거부하고, list DTO에는 secret·credential presentation·raw binding이 없다 | `shared/protocol.plugins.test.ts::"plugin IPC payload와 DTO allowlist를 검증한다"` | preload `window.api.plugins.*` → `handlers/plugins.ts` |
| 25 | `docs/IPC_CONTRACT.md` 헤더 총계·도메인별 합·`CHANNELS` 실측이 모두 **82**로 일치한다 | `shared/ipc-documentation.test.ts::"keeps the header, domain summary, and CHANNELS count at 82"` | shared IPC 계약 → preload/main handler |
| 26 | lint 0 error, typecheck 3분할 0, 수집된 vitest 전체가 pass이며 신규 의존성과 DB migration은 0개다. `chat-turn.continuity.test.ts`는 intentionally unavailable Electron binary 때문에 collection 전 실패할 수 있는 허용 baseline이다 | `npm run lint` · `npm run typecheck` · `npm test` · `node --test scripts/*.test.mjs` · lockfile/migration diff | 저장소 전체 |

## 범위 / 비범위

- **범위**:
  - 정적 runtime tool descriptor·factory 계약과 manifest schema
  - registry의 runtime tool 등록 위생, full descriptor 동등성, connector cross-reference
  - connector당 활성 연결 1개와 binding target connection ID 보존
  - 인증 완료 binding→connector→runtime tool 등록/해제 `PluginHost`
  - provider logout 성공·실패·cascade 전 경로의 로컬 연결/도구 정리
  - Claude SDK runtime MCP 변환, 승인 정책, revision 기반 respawn
  - `pluginList`·connect·disconnect IPC와 preload bridge
  - 부서별 Jira/Confluence 사용 예를 보여주는 dev/test fixture
  - IPC 문서와 modules 작성 가이드 갱신
- **비범위**:
  - renderer connector 관리 화면
  - connection SQLite 영속화와 부팅 복원
  - 실제 Jira/Confluence REST 기능·pagination·telemetry
  - 사용자 입력 endpoint, connector 복제 UI, alias
  - runtime 동적 module loading 또는 생성 catalog

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| renderer UI | **아니오.** 이번 DTO가 label·origin·plugin·provider·connected를 제공하므로 목록/필터/카드 표현은 소비자 추가다 |
| 고급 UI grouping metadata | **아니오.** 우선 pluginId+label+origin으로 정확히 구분한다. 필요 시 optional `group` metadata를 additive하게 추가할 수 있다 |
| connection 영속화 | 일부 비용은 늘지만 이번 정적 connector ID와 tool server ID를 그대로 key로 쓸 수 있어 공개 이름 변경은 없다. 별도 migration/복원 핸드오프로 분리 |
| 실제 Jira/Confluence connector | **아니오.** 이번 fixture와 같은 package 단위 구현이며 core 계약 변경 없이 추가하는 것이 이번 작업의 성공 조건이다 |
| 동적 endpoint | 유예가 아니라 **비채택 결정**이다. 향후 제품 요구가 바뀌면 SSRF·redirect·DNS/TLS·endpoint 저장을 포함한 별도 설계가 필요하다 |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- `@anthropic-ai/claude-agent-sdk@0.3.220`의 `createSdkMcpServer`·`tool`·`Options['mcpServers']`를 사용하며 버전을 바꾸지 않는다.
- zod와 기존 auth/connector 계약만 사용한다.
- connector ID, runtime server ID, tool name은 manifest `IdSchema`와 같은 케밥 소문자 규칙을 사용한다.
- connector 인증 UI는 후속이지만 기존 `authBegin/authContinue`가 connector target을 이미 받을 수 있다. 미래 renderer는 `connectionId`를 UUID로 생성해 auth target에 넣고, connect IPC는 완료 binding만 받는다.
- **신규 의존성: 없음.** 사용자 승인 필요 항목 없음.

## 설계

### 접근 방법과 데이터 흐름

```text
빌드 타임 package
  manifest.connectors[]       ─ 고정 connectorId · label · baseUrl · providers
  manifest.runtimeTools[]     ─ 고정 serverId · connectorId · tool metadata
  implementations             ─ connector runtime + tool factory
             │
             ▼ AuthRegistry.register(package) — 전체 descriptor/교차 참조 검증

기존 authBegin/authContinue(target={connectorId, connectionId})
             └─ done binding(bindingId, providerId, target, status)
                         │
pluginConnectionConnect({connectorId, bindingId})
             │
             ▼ PluginHost
  1. binding target/status/provider allowlist 검증
  2. 같은 connector의 pending/ready 연결 존재 여부 검증
  3. ConnectorHost.connect({id: target.connectionId, connectorId, bindingId})
  4. connectorId를 가리키는 tool factory 실행
  5. 정적 descriptor와 구현 이름을 합쳐 RuntimeToolRegistry.add
                         │
                         ▼ ExtensionBuilder snapshot → Claude mcpServers + approval policy

disconnect 또는 broker.logout(success/failure/cascade)
             └─ onBindingsEnded(ids) → connector stop + runtime server remove
```

### 정적 connector 모델

서버/하위 도메인마다 descriptor가 하나다. 같은 구현 코드는 factory로 재사용하되 identity와 origin은 정적이다.

```ts
createJiraConnector({
  id: 'jira-platform',
  label: 'Jira — 플랫폼 부서',
  baseUrl: 'https://jira.platform.example.invalid'
})

createJiraConnector({
  id: 'jira-security',
  label: 'Jira — 보안 부서',
  baseUrl: 'https://jira.security.example.invalid'
})
```

- connect IPC에는 endpoint나 alias가 없다.
- `ConnectionRegistry`는 connector당 pending/ready record 한 개만 허용한다.
- 연결을 끊고 다시 인증해도 runtime server ID는 descriptor에서 오므로 도구 이름이 같다.
- 미래 UI는 `connectorId`, `pluginId`, `label`, `origin`, `acceptedAuthProviders`, `connected`를 카드에 표시한다. label이나 ID를 파싱해 제품/부서를 추론하지 않는다.

### runtime tool 계약 — 정책 SSOT와 connector 매핑

```ts
export interface RuntimeToolDeclaration {
  name: string
  description: string
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
    openWorldHint?: boolean
  }
}

export interface RuntimeToolDescriptor {
  id: string
  pluginId: string
  connectorId: string
  apiVersion: 1
  alwaysLoad?: boolean
  instructions?: string
  tools: readonly RuntimeToolDeclaration[]
}

export interface RuntimeToolImplementation {
  name: string
  inputSchema: z.ZodRawShape
  handler(input: Record<string, unknown>): Promise<unknown>
}

export interface RuntimeToolContribution {
  readonly descriptor: RuntimeToolDescriptor
  create(ctx: PluginToolContext): readonly RuntimeToolImplementation[]
}
```

정적 descriptor가 설명·annotations의 유일한 진실원이다. factory는 실행 스키마와 handler만 제공하므로 `readOnlyHint`를 런타임에 뒤집는 표면이 없다. manifest contribution에는 package wrapper가 이미 소유하는 `pluginId`를 중복 기재하지 않고, registry가 `manifest.id === descriptor.pluginId`와 나머지 선언 필드 전부를 검사한다. tool 배열은 name으로 정규화해 순서 차이와 값 차이를 구분한다. PluginHost는 factory 결과의 이름 집합만 descriptor와 대조한 뒤 두 부분을 합쳐 실행형 `RuntimeToolServer`를 만든다.

`connectorId`는 필수이고 같은 package의 connector를 가리킨다. 이렇게 해야 connector가 여러 개인 package에서도 어느 연결 context로 도구를 만들지 결정적이다. runtime server ID와 descriptor 내부 tool name은 중복을 거부한다. 고정 endpoint 보장을 위해 connector 구현 descriptor도 manifest의 label·acceptedAuthProviders·baseUrl·presentation과 전부 대조한다.

### 인증과 connection identity

PluginHost는 auth state machine을 재구현하지 않는다. `collect`·`browser`·`device_code`·반복 `continue`는 기존 auth IPC와 broker가 끝내고, PluginHost는 `done` binding만 소비한다.

`PluginHost.connect({connectorId,bindingId})`는 다음을 순서대로 검사한다.

1. binding 존재와 `status === 'valid'`
2. `binding.target.kind === 'connector'`
3. `binding.target.connectorId === connectorId`
4. `binding.providerId ∈ connector.acceptedAuthProviders`
5. 같은 connector의 pending/ready 연결 부재
6. target의 `connectionId`가 registry와 ConnectorContext에 그대로 전달됨

connector start 이후 tool 조립이 실패하면 등록한 server와 connection만 롤백한다. 유효 binding은 유지해 사용자가 같은 인증으로 재시도할 수 있게 한다.

### 연결·로그아웃 정리

`AuthBroker` deps에 다음 구조적 callback을 추가한다.

```ts
onBindingsEnded?: (bindingIds: readonly string[]) => Promise<void>
```

broker는 provider logout 성공 여부와 상관없이 vault와 binding을 제거한 뒤, 실제로 제거된 ID를 callback에 넘겨 **await**한다. 그 다음 provider 실패가 있었다면 `failed`, 없었다면 기존 `logged_out` 결과를 반환한다. callback 실패도 `failed`로 보고하되 제거된 binding을 되살리지 않는다.

컴포지션 루트는 늦게 할당되는 `pluginHost`를 closure로 캡처해 순환 생성을 피한다. `PluginHost.onBindingsEnded`는 각 binding의 connection을 stop하고, stop 실패가 있어도 `finally`에서 모든 정적 runtime server를 제거한다. 정리 메서드는 반복 호출에 안전하다.

명시 disconnect도 별도 정리 구현을 만들지 않고 해당 connection의 binding에 `broker.logout(bindingId,false)`를 호출해 같은 callback 경로로 수렴한다.

### runtime SDK·승인·respawn

- `RuntimeToolRegistry`는 정적 server ID→server Map과 monotonic `revision`을 소유한다. add/remove의 실질 변경에만 revision을 올린다.
- `adaptRuntimeTools`는 같은 ID를 map key와 SDK server name에 쓴다.
- `runtime-tool-policy.ts`는 `readOnlyHint !== true`인 완전한 도구 이름을 승인 대상 집합에 넣는다.
- 이미 실행 중인 turn의 snapshot은 변경하지 않는다. 다음 turn 진입 시 spawned revision과 현재 revision이 다르면 runtime을 respawn한다.
- disconnect signal이 이미 실행 중인 tool/connector 호출을 취소할 수 있다. “진행 중 턴이 반드시 성공 완료한다”는 보장은 두지 않는다.

### 레이어 배치와 신규 모듈

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `adapters/runtime-tools.ts` | backend 중립 runtime tool 계약·source/sink 포트 | adapters | 타입·import 위생 단위 테스트 |
| `adapters/claude-runtime-tools.ts` | snapshot→Claude SDK MCP 변환 | adapters | 순수 변환 테스트 |
| `adapters/runtime-tool-policy.ts` | descriptor→승인 대상 이름 집합 | adapters | 순수 Map/Set 테스트 |
| `features/extensions/runtime-tool-registry.ts` | 정적 server map + revision | extensions | 순수 registry 테스트 |
| `features/auth-platform/plugin-host.ts` | binding 검증, connector/tool lifecycle 조정 | auth-platform | broker·connector port·sink fake 단위 테스트 |
| `features/sessions/respawn-policy.ts` | revision 기반 respawn 판정 | sessions | 순수 함수 테스트 |
| `app/handlers/plugins.ts` | plugin IPC 인자 전달 | app | 로직은 protocol+PluginHost에서 테스트, handler는 typecheck |
| `features/auth-platform/modules/__fixtures__/` | 부서별 static connector 3개와 read/write tool 예시 | module extension | 통합·격리 테스트 |

`plugin-host.ts`는 다른 feature 구현을 import하지 않는다. 같은 파일에 `ConnectorPort`, `RuntimeToolSink`, `BindingLookup`, `LogoutPort`의 최소 구조적 interface를 선언하고 `bootstrap.ts`가 실제 객체를 주입한다. runtime tool 계약을 adapters에 두는 이유는 Claude adapter가 main DAG상 feature/contracts를 import할 수 없기 때문이다.

### TDD 구현 순서

1. manifest·runtime tool 계약과 registry 검증
2. runtime registry·Claude 변환·승인 정책
3. explicit connection ID와 connector당 1연결 invariant
4. PluginHost binding 검증·등록·rollback·disconnect
5. broker ended-binding callback과 성공/실패/cascade 정리
6. IPC/preload/list DTO와 부서별 fixture
7. ExtensionBuilder·turn respawn 배선과 문서/전체 게이트

각 단계는 아래 `[구현자 기입] 구현 체크리스트`의 RED→GREEN 순서를 따른다.

## 기존 결정·규칙과의 관계

> 아래 표는 r4 본문·범위·파생 UX를 완성한 뒤 다시 대조했다.

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| runtime 동적 로딩 금지 | `contracts/auth-plugin.ts:7-12` | §정적 connector 모델 “서버마다 descriptor가 하나” | **유지.** 모든 package는 빌드 타임 import |
| opt-in 배열 등록 | `modules/AGENTS.md:6-12` | §자료조사 “활성화 지점은 한 곳” | **유지.** N번째 package는 배열 한 줄만 변경 |
| ABI additive-optional-only | `contracts/auth-plugin.ts:14-18` | §runtime tool 계약 | **유지.** manifest `runtimeTools`와 package `runtimeTools?`는 optional 추가 |
| package 단위 all-or-nothing·중복 거부 | `auth-platform/registry.ts:35-129` | §runtime tool 계약 “모든 필드 비교” | **유지·확장.** runtime tool과 connector descriptor 모두 manifest 전체 선언과 대조 |
| 같은 connector를 여러 사내 인스턴스에 N번 연결 | `connectors/registry.ts:1-13` | §정적 connector 모델 “connector당 … 한 개” | **뒤집음.** 사용자가 서버마다 별도 connector와 connector당 활성 연결 1개를 확정. 코드 헤더도 새 모델로 갱신 |
| connector origin은 manifest 고정 | `manifest.ts:20-28` · `connector-plugin.ts:50-52` | §범위 “사용자 입력 endpoint 비범위” | **유지·강화.** connect IPC에 URL 표면 없음 |
| feature 교차 import 금지·main 하향 DAG | `eslint.config.mjs:107-128` · `main/AGENTS.md` | §레이어 배치 “구조적 interface 주입” | **유지.** auth-platform→connectors/extensions 직접 import 0 |
| 안정적 도구 ID | 선행 설계 r2/r3 · SDK 도구 이름 계약 | §정적 connector 모델 “재인증해도 이름이 같다” | **준수.** alias/connection ID가 아니라 정적 server descriptor ID 사용 |
| IPC 변경 시 문서 동시 갱신 | `docs/AGENTS.md` · `docs/IPC_CONTRACT.md §6` | §범위 “IPC 문서 갱신” | **유지.** 79+3=82 검증 |
| 서비스 리터럴은 module에 격리 | `main/AGENTS.md` 작업 규칙 | §fixture “부서별 static connector 3개” | **유지.** Jira/Confluence 식별자는 fixture와 테스트에만 존재 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **복수 부서**: `jira-platform`과 `jira-security`는 서로 다른 connector라 동시에 연결되고 별도 카드·도구 서버로 보인다.
- **동일 connector 재연결**: pending/ready 연결이 있으면 두 번째 요청은 `already_connected`로 거부한다. 사용자가 명시 disconnect 후 다시 연결하면 정적 도구 이름은 이전과 같다.
- **잘못된 binding**: 다른 connector target, expired/revoked status, 허용되지 않은 provider는 connector start 전에 거부한다.
- **연결 부분 실패**: connection/tool state를 롤백하지만 valid binding은 유지해 재시도를 허용한다.
- **logout 실패**: 원격 provider logout 오류는 사용자에게 실패로 보이지만 로컬 connector와 도구는 즉시 사라진다.
- **진행 중 turn**: 새 snapshot에는 제거가 반영되고 다음 turn 전에 respawn한다. 이미 실행 중인 호출은 connection signal 취소를 관찰해 cancelled/error로 끝날 수 있다.
- **앱 재시작**: connection과 runtime server는 메모리 전용이라 사라진다. 정적 connector 목록은 package에서 다시 나타난다.
- **등록 실패 격리**: 불량 package는 목록에 나타나지 않고 정상 package와 채팅은 계속 동작한다.
- **빈 배포**: package가 0개면 connector 목록과 runtime snapshot이 비고 현행 채팅 options가 유지된다.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `features/connectors/registry.ts`의 기존 N:1 설명을 뒤집는다 | 사용자에게 cardinality를 별도 확인해 1개로 확정했고, registry 테스트와 헤더를 함께 변경한다 |
| UI가 서비스/부서를 구조화해 group하지 못한다 | 이번 요구는 label·origin·pluginId로 정확히 구분 가능하다. 고급 group은 optional metadata로 후속 추가 가능 |
| manifest와 code descriptor가 중복된다 | full descriptor 동등성 검증으로 drift를 등록 단계에서 거부한다. 정적 선언 없이는 승인 정책을 factory 실행 전에 읽을 수 없다 |
| provider logout 실패와 local cleanup 실패가 동시에 날 수 있다 | binding은 되살리지 않고 두 오류를 합쳐 반환/로그한다. connector stop 실패와 무관하게 runtime server remove를 `finally`에서 수행한다 |
| `mcp__<server>__<tool>` 이름 규약에 승인 판정이 의존한다 | server ID를 하나로 통일하고 adapter·policy 테스트가 완전 이름을 함께 검증한다 |
| runtime server가 늘면 prompt 비용이 선형 증가할 수 있다 | `alwaysLoad`는 plugin opt-in으로 유지하고 기본 강제하지 않는다 |
| IPC 3채널은 renderer UI가 없어 직접 소비 화면이 없다 | protocol/PluginHost/fixture 통합 테스트로 배선을 검증하고, preload API를 미래 UI의 단일 진입점으로 둔다 |

- **되돌리기 어려운 결정**: connector ID·runtime server ID·tool name은 공개 후 대화 기록과 승인 키에 남는다. 이번 r4에서 정적 ID로 확정하고 connection ID·label·origin 변경으로부터 분리했다.
- **단독 결정 금지 항목(Open Question)**: 없음.

## 영향 받는 파일

**신규**

- `app/src/main/adapters/runtime-tools.ts` + 테스트
- `app/src/main/adapters/claude-runtime-tools.ts` + 테스트
- `app/src/main/adapters/runtime-tool-policy.ts` + 테스트
- `app/src/main/features/extensions/runtime-tool-registry.ts` + 테스트
- `app/src/main/features/auth-platform/plugin-host.ts` + 테스트
- `app/src/main/features/sessions/respawn-policy.ts` + 테스트
- `app/src/main/features/connectors/runtime.test.ts`
- `app/src/main/features/auth-platform/modules/__fixtures__/` + 격리 테스트
- `app/src/main/app/handlers/plugins.ts`
- `app/src/shared/protocol.plugins.test.ts`

**수정**

- `app/src/main/features/auth-platform/manifest.ts`
- `app/src/main/features/auth-platform/registry.ts` + 테스트
- `app/src/main/features/auth-platform/broker.ts` + 테스트
- `app/src/main/features/auth-platform/modules/index.ts` · `modules/AGENTS.md`
- `app/src/main/features/connectors/registry.ts` · `runtime.ts`
- `app/src/main/features/extensions/builder.ts`
- `app/src/main/features/sessions/session-runtime.ts`
- `app/src/main/adapters/claude.ts` · `turn.ts`
- `app/src/main/app/bootstrap.ts` · `context.ts` · `chat-turn.ts`
- `app/src/shared/ipc.ts` · `protocol.ts`
- `app/src/preload/index.ts`
- `docs/IPC_CONTRACT.md`
- `docs/handoff/INDEX.md`

## 참고 문서

- `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` — 빌드 타임/런타임 확장 경계
- `docs/IPC_CONTRACT.md §6` — IPC 변경 절차
- `docs/arch/backend/provider-runtime.md §3` — 위험 도구 승인 게이트
- `app/src/main/AGENTS.md` — main DAG·feature 교차 금지
- `app/src/main/features/auth-platform/modules/AGENTS.md` — module opt-in 규칙
- `@anthropic-ai/claude-agent-sdk@0.3.220` 타입 정의 — `createSdkMcpServer`, tool name 규약

## 게이트

- 단계별 표적 테스트: `cd app && npx vitest run <changed-test-files>`
- 전체: `cd app && npm run lint && npm run typecheck && npm test`
- 문서/위생: IPC 총계 82, fixture 리터럴 core 0, 신규 의존성 0, migration diff 0
- better-sqlite3 ABI 환경 실패는 코드 실패와 분리해 명령·오류를 그대로 보고한다.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 서버별 정적 connector와 connector당 활성 연결 1개를 라이브 승인으로 기록했다.
- [x] 자료조사 — r4 현행 코드·계약과 전수 수치를 다시 측정했다.
- [x] 의존 기술 — 기채택 SDK/zod만 사용하고 신규 의존성 0이다.
- [x] 파생 UX — 복수 부서·중복 연결·잘못된 binding·부분 실패·logout 실패·진행 turn·재시작을 펼쳤다.
- [x] 리스크 — N:1 결정 반전, metadata 중복, logout 이중 실패, UI grouping 유예를 적었다.

**기계적으로 확인 가능한 것**

- [x] 요구 비판적 검토 5질문에 답했고 사용자 범위를 줄이지 않았다.
- [x] 인수 기준 **26개** 모두 검증 수단과 프로덕션 도달 경로가 있다.
- [x] 부정형/“불변” 기준 0개다. 거부 기준도 기존 상태 보존이라는 양성 결과를 포함한다.
- [x] AC 간 모순을 pairwise 점검했다: connector당 1개(AC9)와 복수 connector 공존(AC9·22)은 식별자가 다른 경우라 양립하고, 정상/실패/cascade logout(AC14~16)은 같은 callback의 배타적 결과다.
- [x] 현재 수치 0/79/26 등은 r4에서 직접 측정했고 과거 sibling 줄 수를 승계하지 않았다.
- [x] 신규 모듈 8종마다 테스트 방법이 있고 Electron handler의 순수 seam은 protocol+PluginHost다.
- [x] 전수 조사 수치가 있다: runtime tool 파일 0, plugin IPC 0, handler 테스트 0, CHANNELS 79, package 0.
- [x] 사람 실기 전용 AC가 없다. 모든 AC는 자동 테스트·정적 검사·게이트로 측정한다.
- [x] optional `readOnlyHint`의 미지정 케이스가 AC19에 있다.
- [x] 제약 필드 강제 지점이 있다: accepted provider/target/status는 PluginHost, baseUrl은 manifest+broker, connectorId cross-reference는 AuthRegistry, annotations는 policy adapter가 검사한다.
- [x] `AuthStep` 6분기를 전수 확인했고 PluginHost가 재구현하지 않는다고 명시했다.
- [x] 미룬 항목마다 일방향 여부를 §범위 표에 적었다.
- [x] 관문 4를 본문 완성 후 수행했다. 기존 N:1 코드 주석의 반전을 표에 기록했고 인용 경로와 아래 구현자/검증자 블록을 확인했다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 정적 connector당 고정 origin·고정 tool server ID·활성 연결 1개는 사용자의 부서별 Jira/Confluence 모델과 맞고, 동적 URL/alias/endpoint 저장을 제거해 가장 작은 구현이 된다.
- r3에서 발견한 이견 / r4 반영:
  1. `PluginHost.connect`에 connectionId가 없는데 binding target에는 connectionId가 있었다 → binding target을 SSOT로 확정.
  2. runtime tool descriptor에 connectorId가 없어 다중 connector package에서 context를 고를 수 없었다 → required cross-reference 추가.
  3. `${descriptor.id}-${alias}` 조합은 비단사이고 이름 충돌 가능성이 있었다 → alias 전체 폐기, 정적 server ID 사용.
  4. manifest/descriptor/factory에 승인 metadata가 중복될 수 있었다 → factory에서 policy 필드를 제거하고 full descriptor 검증.
  5. provider logout 실패 결과에는 ended IDs가 없어 실제 정리 경로가 끊겼다 → broker 내부 awaited callback으로 변경.
  6. 미래 UI가 복수 connector를 구분할 안전 DTO가 없었다 → label·origin·pluginId·provider·connected만 노출.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | r3 alias 모델이 사용자의 서버별 정적 connector 결정과 충돌 | ✅ r4 설계 반영, alias AC·IPC·derived issue 제거 | 사용자 승인 2026-08-03 |
| 2 | provider logout 실패 시 broker는 binding을 지우지만 cleanup 호출자는 removed IDs를 받지 못함 | ✅ `onBindingsEnded`를 broker 내부 seam으로 설계 | `broker.ts:211-239` |
| 3 | static connector라도 같은 connector connect가 동시에 들어오면 pending race 가능 | ✅ pending record 포함 connector당 1개 invariant를 `ConnectionRegistry.create`에서 원자적으로 강제하도록 설계 | AC9 |
| 4 | connector stop 실패가 runtime server 제거를 막을 수 있음 | ✅ cleanup을 `finally`로 분리하고 idempotent remove로 설계 | AC13~16 |
| 5 | UI grouping metadata를 지금 required로 만들면 모든 connector ABI를 불필요하게 넓힘 | ✅ label·origin·pluginId로 현재 요구 충족, group은 optional 후속 | §범위 유예 표 |

## [구현자 기입] 구현 체크리스트

### Task 1 — runtime tool 계약·manifest·registry

**Files:** `adapters/runtime-tools.ts`, `auth-platform/manifest.ts`, `auth-platform/registry.ts`, `modules/index.ts`와 각 테스트.

**Interfaces:** `RuntimeToolDescriptor`, `RuntimeToolContribution`, `RuntimeToolImplementation`, `RegisterPackageInput.runtimeTools?`, `AuthPluginPackage.runtimeTools?`.

- [ ] RED: manifest full descriptor 동등성·connector cross-reference·중복/1:1 거부 테스트를 작성한다.
- [ ] `app/node_modules`가 없으면 lockfile 그대로 `npm ci`를 먼저 실행하고 package/lockfile diff 0을 확인한다.
- [ ] `cd app && npx vitest run src/main/features/auth-platform/registry.test.ts`를 실행해 새 테스트가 계약 부재로 실패하는지 확인한다.
- [ ] 최소 계약·zod schema·registry validation을 구현한다. descriptor 비교는 tool name으로 정렬한 전체 필드 비교다.
- [ ] 같은 표적 테스트와 `npm run typecheck:node`를 실행해 GREEN을 확인한다.

### Task 2 — runtime registry·Claude adapter·승인 정책

**Files:** `adapters/{runtime-tools,claude-runtime-tools,runtime-tool-policy}.ts`, `features/extensions/runtime-tool-registry.ts`, `adapters/claude.ts`, `adapters/turn.ts`와 테스트.

**Interfaces:** `RuntimeToolSource.snapshot()`, `RuntimeToolSink.add/remove`, `adaptRuntimeTools`, `runtimeApprovalToolNames`.

- [ ] RED: ID 단일화, 빈 snapshot, revision, `readOnlyHint` true/false/undefined 테스트를 작성한다.
- [ ] 관련 vitest 파일만 실행해 실패 이유가 구현 부재인지 확인한다.
- [ ] Map registry, SDK 변환, fail-closed policy, `makeCanUseTool` option을 최소 구현한다.
- [ ] 표적 테스트와 main typecheck를 GREEN으로 만든다.

### Task 3 — connection identity와 1:1 invariant

**Files:** `features/connectors/registry.ts`, `runtime.ts`, `runtime.test.ts`.

**Interfaces:** `ConnectionRegistry.create({id,connectorId,bindingId,label?})`, `ConnectorHost.connect` explicit ID, connector당 pending/ready 1개.

- [ ] RED: 명시 ID 보존, 같은 connector 두 번째 create 거부, 서로 다른 connector 공존, non-ready rollback 테스트를 작성한다.
- [ ] `cd app && npx vitest run src/main/features/connectors/runtime.test.ts`로 RED를 확인한다.
- [ ] registry/header/runtime을 새 정적 connector 모델로 최소 수정한다.
- [ ] 표적 테스트와 main typecheck를 GREEN으로 만든다.

### Task 4 — PluginHost 연결·도구 lifecycle

**Files:** `features/auth-platform/plugin-host.ts` + 테스트, `registry.ts` 조회 API.

**Interfaces:** `PluginHost.list/connect/disconnect/onBindingsEnded`, `ConnectorPort`, `BindingLookup`, `LogoutPort`, `RuntimeToolSink`.

- [ ] RED: AC7~13의 binding 검증·정적 connector 공존·context 제한·factory drift·rollback·disconnect 테스트를 fake port로 작성한다.
- [ ] plugin-host 표적 테스트가 class 부재/행동 불일치로 실패하는지 확인한다.
- [ ] PluginHost를 구조적 port만 사용해 구현하고 feature 교차 import를 만들지 않는다.
- [ ] 표적 테스트와 lint boundary를 GREEN으로 만든다.

### Task 5 — broker logout callback

**Files:** `auth-platform/broker.ts`, `broker.test.ts`, `plugin-host.test.ts`, `app/bootstrap.ts`.

**Interfaces:** `BrokerDeps.onBindingsEnded?: (ids) => Promise<void>`; callback은 local binding removal 뒤 publish/return 전에 await.

- [ ] RED: 정상·provider 실패·cascade·callback 실패 4경로 테스트를 작성한다.
- [ ] broker와 plugin-host 표적 테스트를 실행해 callback 부재로 RED인지 확인한다.
- [ ] broker callback과 bootstrap closure 배선을 구현하고 cleanup을 idempotent/finally로 만든다.
- [ ] 두 표적 테스트와 main typecheck를 GREEN으로 만든다.

### Task 6 — IPC·preload·목록 DTO·fixture

**Files:** `shared/{ipc,protocol}.ts`, `protocol.plugins.test.ts`, `preload/index.ts`, `app/handlers/plugins.ts`, `modules/__fixtures__/**`, `modules/AGENTS.md`.

**Interfaces:** `pluginList`, `pluginConnectionConnect({connectorId,bindingId})`, `pluginConnectionDisconnect({connectorId})`, safe `PluginConnectorInfo`.

- [ ] RED: payload strictness, DTO allowlist, 부서별 connector 목록/상태, fixture isolation과 package 한 줄 등록 테스트를 작성한다.
- [ ] 관련 protocol/plugin-host/isolation 테스트로 RED를 확인한다.
- [ ] 3채널·preload bridge·fixture와 작성 가이드를 최소 구현한다.
- [ ] 표적 테스트와 shared/main/preload typecheck를 GREEN으로 만든다.

### Task 7 — turn 배선·문서·전체 게이트

**Files:** `features/extensions/builder.ts`, `features/sessions/{respawn-policy,session-runtime}.ts`, `app/{bootstrap,context,chat-turn}.ts`, `docs/IPC_CONTRACT.md`, 본 plan과 INDEX.

**Interfaces:** `RuntimeToolSnapshot.revision`, `spawnedRuntimeToolsRevision`, `decideRespawn`.

- [x] RED: builder snapshot 전달과 revision mismatch respawn 테스트를 작성하고 실패를 확인한다.
- [x] composition/turn 배선과 IPC 문서 총계 82를 구현한다.
- [x] 표적 테스트 후 `npm run lint`, `npm run typecheck`, `npm test`를 실행한다.
- [x] plan 구현 보고와 INDEX를 `impl/IMPL_DONE`, 다음 주체 Claude로 갱신하고 구현 커밋을 만든다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | Task 1~7 범위 구현 완료. `7229c41`은 실제 `registerChatHandlers` IPC 경로의 listen stale revision respawn·flush non-default model 보존과 one-shot 종료 metadata 정리를 고정했다. `3400908`은 PluginHost lifecycle signal을 connector start/invoke까지 전파하고 IPC 문서 응답/82채널 문서 count 검사를 추가했다. `7f606cf`은 pre-aborted connect/start/invoke zero-call과 cleanup 뒤 cached handler 단락을 추가했다. `47a0f88`은 Task 1~2 신규 runtime-tool 코드의 lint 자동 포맷을 반영해 재실행 시 작업 트리가 clean하도록 고정했다. |
| 실행 명령 | `npx vitest run src/main/features/auth-platform/plugin-host.test.ts src/main/features/connectors/runtime.test.ts` (2 files, 38 tests), `npm run lint`, `npm run typecheck`, `npm test`, `node --test scripts/*.test.mjs` |
| 게이트 결과 | focused 38/38 pass, typecheck node/web/test pass. lint 0 error, 기존 `useTranscriptVirtualizer` TanStack/React Compiler warning 1개. `npm test`는 수집된 169 files·1480 tests pass, `chat-turn.continuity.test.ts`만 intentionally unavailable Electron binary로 collection 전 실패(`Electron failed to install correctly`); 별도 scripts 28/28 pass. lint `--fix`의 Task 1~2 신규 코드 포맷 7파일은 `47a0f88`에 반영했으며 fresh lint 재실행 뒤 작업 트리 clean을 확인했다. |
| 블로커 / 역질문 | 없음 — 사용자 결정 완료 |
| 대상 커밋 | `07e0634` (`feat(runtime-tools): refresh stale tool snapshots`), `1f2c1f1` (`fix(runtime-tools): checkpoint continuation respawn`), `7229c41` (`test(runtime-tools): cover continuation handler wiring`), `3400908` (`fix(plugin): propagate lifecycle cancellation`), `7f606cf` (`fix(plugin): reject pre-aborted connector work`), `47a0f88` (`chore(lint): format runtime tool additions`) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 같은 서비스 서버 여러 개의 표현 방식 | r2/r3 OQ1 · 사용자 | 서버마다 별도 정적 connector, connector당 활성 연결 1개 | **해결(r4)** |
| D2 | alias 변경/기본값/조합 충돌 | r3 | alias 표면 전체를 제거하고 정적 server ID 사용 | **해결(r4)** |
| D3 | 미래 UI에서 부서별 connector 구분 | 사용자 r4 | safe list DTO의 pluginId·label·origin·provider·connected 사용 | **설계 완료, UI 후속** |

### verify r1 (FAIL) 이관 — 라운드 2 액션 아이템

> 인수 기준은 26/26 충족이나, verify §0·역방향 탐색이 **기준 밖에서** 결함을 찾았다.
> 초판은 D4·D5 를 '계약 드리프트' 로 봤으나, **보완 검증(실제 MCP 경계 왕복)이 D5 를 false success 결함으로
> 재분류**했고 D7 을 가설에서 실측 확정으로 올렸다.
> 근거·재현 명령은 [`verify.md`](verify.md) 참조.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| **D4** | **ID 규칙이 두 곳에서 다른데 주석은 "같다"고 적혀 있다.** manifest `IdSchema`(`manifest.ts:17`) = `^[a-z0-9]+(?:-[a-z0-9]+)*$` vs shared `PluginConnectorIdSchema`(`protocol.ts:257`) = `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`. 숫자 선두 ID(`3rd-jira`·`2024-archive`)는 **등록에 성공한 뒤** `pluginList` 목록 전체를 throw 시키고(`PluginConnectorInfoSchema.array().parse` all-or-nothing) `connectionConnect` 가 영구 거부된다. plan §의존 기술의 "manifest `IdSchema` 와 같은 케밥 소문자 규칙" 위반 | verify r1 §역방향 탐색 (임시 vitest 로 실증) | 한 상수를 SSOT 로 공유(main→shared DAG상 `shared/` 에 두고 manifest 가 import). 숫자 선두 ID 가 manifest·IPC 양쪽에서 같은 판정을 받는 회귀 테스트. `parsePluginListResponse` 의 all-or-nothing 이 의도인지 재확인 | **해결(r2)** |
| **D5** | **★ false success — runtime tool 결과가 MCP 경계에서 `isError` 없는 빈 성공이 된다.** verify r1 보완 검증이 실제 `McpServer` 인스턴스 + `InMemoryTransport` + 실제 MCP `Client` 로 종단 실측: 정상 호출 `{"content":[],"ok":true,"data":{…}}` (데이터가 모델에 도달하지 않아 조용히 무력) · **로그아웃 후 호출 `{"content":[],"ok":false,"message":"…cancelled"}` 이면서 `isError` 부재**(연결이 끊겼는데 모델은 "성공, 결과 없음" 으로 읽는다). 뿌리는 계약/소비자 불일치 — 계약 `Promise<unknown>`(`runtime-tools.ts:29`) ↔ SDK `Promise<CallToolResult>`(`sdk.d.ts:3991`) ↔ `as never` 캐스트(`claude-runtime-tools.ts:23`) ↔ fixture 가 `ConnectorResult` 반환(`department-fixture-package.ts:67-68`). 어떤 AC 도 handler 반환 *타입* 을 다루지 않았다(AC17 은 반환 *필드* 만) | verify r1 §0 + §보완 검증 A (실측) | ⓐ 성공 경로: `adaptServer` 가 `CallToolResult` 로 변환하거나 handler 반환형을 그 형상으로 좁혀 `as never` 제거 ⓑ **실패 경로: 취소·오류가 `isError: true` 로 모델에 보이게 한다**(`plugin-host.ts:195-200` · `runtime.ts:177-179`) ⓒ fixture 를 계약대로 수정 ⓓ 회귀 테스트: `InMemoryTransport`+MCP `Client` 왕복으로 "정상은 content 가 실리고 취소는 `isError` 가 선다" 단언 | **해결(r2)** — `adaptHandler` 형상 가드 + `ctx.invoke` 취소 throw + fixture 변환 + MCP 경계 회귀 4건 |
| **D3-b** | `docs/AGENTS.md:15` 인벤토리가 "총 79 채널 · 22 도메인" 으로 stale (실측 82 · 23). 신규 `ipc-documentation.test.ts` 는 `IPC_CONTRACT.md` 만 지킨다 | verify r1 §3 재측정 | 82 · 23 + `plugin` 3 으로 갱신. 검산 테스트 범위를 이 파일까지 넓힐지 검토 | **해결(r2)** |
| **D6** | `AuthRegistry.getRuntimeTool`(`registry.ts:237`) 참조 0 — 죽은 코드 | verify r1 §역방향 탐색 | 제거 또는 사용처 배선 | **해결(r2)** — 제거 |
| **D7** | `PluginHost.cleanup` 이 실패 promise 를 캐시해(`plugin-host.ts:233-237`) 정리가 영구 불가. **가설 → 실측 확정**: throw 하는 sink 를 주입하고 `onBindingsEnded` 2회 호출 → `stop` 은 1회만 불리고, sink 가 회복돼도 runtime server 가 끝내 제거되지 않으며(`removed=[]`), `connected:true` 로 남아 재연결도 `already connected` 로 거부된다. AC13~16 의 정면 실패 모드 | verify r1 §보완 검증 C (실측) | 실패 시 `active.cleanup` 을 비우거나 `cleanupOnce` 를 never-throw 로. `stopByBinding` 은 이미 `try/catch` 인데 `remove` 만 무방비인 비대칭이 신호 | **해결(r2)** — `remove` 를 개별 try/catch 로 감싸 정리가 끝까지 진행. 회귀 테스트로 재연결까지 확인 |
| **D8** | plan 문서 stale 2건 — ① 인수 기준 "검증 수단" 열의 테스트 케이스명 다수가 실존하지 않음(AC7 등, 실제는 영어 `it.each` 명) ② 구현 보고 "대상 커밋 6개" 는 실제 15커밋(`6d67f52..`)의 후반부만 | verify r1 §구현자 코멘트 확인 | 실존 케이스명·전체 커밋 범위로 정정 | **해결(r2)** |
| **D9** | `features/connectors/registry.ts:10` 헤더가 구 N:1 모델("하나의 connector 를 서로 다른 사내 인스턴스에 여러 번 연결할 수 있어야 하므로 분리가 필요하다")을 그대로 두고, 바로 아래 15-17줄에 반대되는 정적 모델 주석이 추가돼 한 파일에 모순된 두 설명이 공존한다. plan §기존 결정 표는 "코드 헤더도 새 모델로 갱신" 을 약속했다 | verify r1 §0 | 구 문장을 새 모델로 교체 | **해결(r2)** |

---

## [구현자 기입] 라운드 2 구현 보고 (Claude 직접 — 버그수정)

> verify r1 FAIL 의 D3-b·D4·D5·D6·D7·D8·D9 를 모두 해소했다. 사용자 지시로 Codex 대신
> Claude 가 직접 구현했다(핸드오프 규약 §구현 주체 분담 — 비기능/버그수정).

### 무엇을 고쳤나

| # | 변경 | 파일 |
|---|---|---|
| D5-a | `RuntimeToolImplementation.handler` 반환형을 `Promise<unknown>` → **`Promise<RuntimeToolResult>`**(MCP 형상: `{content:[{type:'text',text}], isError?}`). MCP 는 이 저장소가 "엔진이 아니라 표준을 1차 추상화" 로 정한 대상이므로 backend 중립과 충돌하지 않는다 | `adapters/runtime-tools.ts` |
| D5-b | `as never` 캐스트 제거. SDK 는 반환 **형상을 검증하지 않으므로**(`content` 없으면 그대로 `{content:[]}`) 경계에서 직접 검사하고 어긋나면 throw → SDK 가 `isError:true` 로 변환 | `adapters/claude-runtime-tools.ts` |
| D5-c | 연결 정리 후의 `ctx.invoke` 를 **해소 → throw** 로 변경. 해소된 오류 객체는 플러그인이 그대로 도구 결과로 반환할 수 있어 취소가 빈 성공이 됐다 | `features/auth-platform/plugin-host.ts` |
| D5-d | fixture 가 `ConnectorResult` → `RuntimeToolResult` 변환을 **보여준다**(`toToolResult`). 저자용 참조 구현이므로 여기가 계약의 실질 문서다 | `modules/__fixtures__/department-fixture-package.ts` |
| D4 | ID 규칙 **SSOT 를 shared 로** — `PLUGIN_ID_PATTERN`/`PLUGIN_ID_MAX_LENGTH` 를 `shared/protocol.ts` 가 소유하고 main manifest 가 import. 두 벌 복붙 제거 | `shared/protocol.ts` · `features/auth-platform/manifest.ts` |
| D7 | `cleanupOnce` 의 `remove` 를 개별 `try/catch` 로 감싸 정리가 끝까지 진행되게 함(`stopByBinding` 과 대칭) | `features/auth-platform/plugin-host.ts` |
| D6 | 죽은 `AuthRegistry.getRuntimeTool` 제거 | `features/auth-platform/registry.ts` |
| D9 | `connectors/registry.ts` 헤더의 구 N:1 문장을 정적 connector 모델로 교체 | `features/connectors/registry.ts` |
| D3-b | `docs/AGENTS.md` 인벤토리 79/22 → **82/23 + `plugin` 3** | `docs/AGENTS.md` |
| 문서 | 저자 가이드에 반환 계약 2줄 추가 | `modules/AGENTS.md` |

### 신규 테스트 (+18, 1480 → 1498)

| 파일 | 케이스 | 잡는 것 |
|---|---|---|
| `adapters/claude-runtime-tools.boundary.test.ts` (신규) | 4 | **실제 SDK 서버 + `InMemoryTransport` + 실제 MCP `Client` 왕복.** 형제 파일이 `createSdkMcpServer` 를 mock 해 옵션 조립만 보던 것이 D5 가 두 라운드를 통과한 이유다 |
| `features/auth-platform/plugin-id-ssot.test.ts` (신규) | 13 | manifest 와 IPC 가 같은 ID 판정을 내리는지 12개 입력으로 대조 |
| `features/auth-platform/plugin-host.test.ts` | +1, 수정 4 | 정리 후 handler 는 **reject**(구 테스트는 resolve 를 단언해 결함을 고정하고 있었다) · sink throw 에도 정리 완주 + 재연결 |

**RED 확인** (수정 코드를 되돌려 신규 테스트가 실제로 실패하는지):

```
$ (adaptHandler → as never 로 되돌림) vitest run claude-runtime-tools.boundary.test.ts
  × MCP 형상이 아닌 반환값은 조용한 빈 성공이 아니라 도구 실패가 된다     → 1 failed | 3 passed

$ (취소 throw·D7 가드 되돌림) vitest run plugin-host.test.ts
  × rejects a cached runtime tool handler after explicit cleanup …
  × completes cleanup and allows reconnect even when the sink throws …
  × aborts an in-flight tool invocation (3건)                            → 5 failed | 17 passed
```

### 종단 실증 (r1 이 결함을 잡은 것과 **같은 하네스**)

```
                수정 전                                    수정 후
정상 호출   {"content":[],"ok":true,"data":{…}}      {"content":[{"type":"text","text":"{…}"}]}
로그아웃후  {"content":[],"ok":false,…} isError 없음  {"content":[…closed…],"isError":true}
```

### 게이트

| 게이트 | 결과 |
|---|---|
| `npm run lint` | 0 error (warning 1 = 0102 TanStack 베이스라인) |
| `npm run typecheck` | 3분할 전부 0 |
| `vitest run` | **1498/1498 tests pass** · 171/172 files. 잔존 1파일 = `chat-turn.continuity`(electron 바이너리 미설치 베이스라인, 유일 에러 서명) |
| `node --test scripts/*.test.mjs` | 28/28 |
| 신규 의존성 / DB 마이그레이션 | 0 / 0 |

### 구현 중 발견 (선조치)

- **내 테스트가 저장소 가드에 걸렸다.** `plugin-id-ssot.test.ts` 초안이 `jira-platform`·`confluence-rnd` 를 후보 ID 로 써서 `isolation.test.ts`(서비스 리터럴 core 유출 금지)를 깨뜨렸다 → 중립 ID(`alpha-service` 등)로 교체. 0158 이 세운 가드가 곧바로 제 역할을 했다.
- **내 테스트가 레이어 경계에 걸렸다.** D4 동등성 테스트를 `src/shared/` 에 두었더니 `boundaries/dependencies` error(shared → features 금지) → `features/auth-platform/plugin-id-ssot.test.ts` 로 이동. main → shared 방향이 맞다.
- `RuntimeToolResult` 에 `[key: string]: unknown` 을 넣었다 — MCP `CallToolResult` 가 passthrough 라 인덱스 시그니처 없이는 SDK 타입에 대입되지 않는다. 강제하는 것은 `content` 존재이며 그것이 조용한 빈 성공을 막는 지점이다.

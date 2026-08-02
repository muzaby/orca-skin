# Plan — 0158-builtin-tool-plugin-host

## 메타

| 항목 | 값 |
|---|---|
| slug | `0158-builtin-tool-plugin-host` |
| 작성자 | Claude Code |
| 일자 | 2026-08-02 |
| 매핑 | PHASES 신규 행 (Phase 3++) / PR 미생성 |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "플러그인 모듈을 만들어야 한다. 내장 플러그인 추가 정해진 모듈의 규칙대로 쉽게 확장되어야 하며, **메인 코드의 수정이 없어야 한다. 철저히 확장을 통해 추가되어야 함**" | 라이브 세션 요청 (2026-08-02) |
| 명시 요구 | 참고 자료 = `@docs/etc/confluence-data-center-plugin-implementation-plan.md` — "**검토를 우선 진행하라**" | 동 세션 |
| 명시 결정 | 기준선 = **"픽스처 플러그인으로 호스트만"** (실험 코드는 다른 클론에 둔 채 진행) | 동 세션 질의 응답 1 |
| 명시 결정 | 등록 방식 = **"opt-in 배열 유지"** (생성 카탈로그 비채택) | 동 세션 질의 응답 2 |
| 명시 결정 | 인증 = **"필요하다 — 기존 인증을 재사용"** | 동 세션 질의 응답 2 |
| 명시 결정 | "`C:\Users\rlaeo\github\orca-skin` 플러그인 테스트를 위해 구현한 테스트버전이다 참고하고 어떻게 구현했는지 우선 검토하라" | 동 세션 질의 응답 3 |
| 명시 결정 | 범위 = **"권장대로 — 화면 제외"** (배관 이식 + 플러그인 주도 등록 + 도구 권한 축소 + 신고서 기반 승인 + 연결 IPC 범용화. renderer UI 는 후속) | 동 세션 질의 응답 4 |
| 명시 요구 | "앱 로그인도 auth platform 을 사용하려한다. 이부분을 검토하라" | 동 세션 질의 응답 3 |
| 추론 의도 | "메인 코드"의 경계 = `src/main/{app,adapters,contracts,infra}` · `src/shared` · `src/preload` · `src/renderer`. **`features/auth-platform/modules/` 는 확장을 위해 지정된 등록처이므로 "메인 코드" 가 아니다** — 추론이나 `modules/AGENTS.md:11` 이 "그 외 코어 코드(broker·registry·IPC·게이트)는 수정하지 않는다" 로 이 경계를 이미 문서화했고, 사용자가 opt-in 배열 유지를 선택해 확인됨 | 추론 (근거 = `modules/AGENTS.md:6-12`) |

## Context (왜)

Orca 는 지금 **인프로세스 도구를 LLM 에 전달하는 경로가 아예 없다**. 사내 위키·이슈트래커처럼 인증이 필요한 사내 시스템을 채팅에서 다루려면 그 경로를 열어야 한다.

0157 이 인증 플랫폼(provider registry · manifest · broker · connector 계약)을 세웠고 앱 로그인까지 같은 lifecycle 로 묶었다. 그러나 플러그인이 **기여할 수 있는 것이 인증 provider 와 connector 둘뿐**이라, "도구를 제공하는 플러그인" 은 표현할 수단이 없다.

다른 클론(`C:\Users\rlaeo\github\orca-skin`)의 미커밋 실험이 이 경로를 실제로 뚫어 동작을 확인했다. 본 핸드오프는 **그 실험에서 범용 배관만 이식하고, 실험이 컴포지션 루트에 남긴 서비스 고유 접착제는 플러그인 기여로 바꾼다.** 목표는 Confluence 기능이 아니라 **N번째 내장 도구 플러그인을 core diff 0 으로 추가할 수 있는 상태**다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 | **타당** — 증상("플러그인 모듈이 없다")과 원인이 일치한다. 인프로세스 도구 경로가 실재하지 않는다: `grep -rn "createSdkMcpServer" app/src` → **0 hits**. `claude.ts` 는 `mcpServers` 를 한 번도 넘기지 않고(`grep -n "mcpServers" src/main/adapters/claude.ts` → 0), MCP 는 plugin `.mcp.json` 파일 경로로만 소비된다 | `app/src/main/adapters/turn.ts:85-86` · 실측 grep |
| 이미 있는 것 아닌가 | **절반 있다.** 0157 이 등록 위생(중복·ABI·선언↔구현 1:1·패키지 단위 all-or-nothing 거부)과 opt-in 등록처를 이미 만들었다 → **재사용하고 새로 만들지 않는다.** 없는 것은 ⓐ 도구 기여 계약 ⓑ 도구→SDK 배관 ⓒ 연결 성사 시 도구를 등록하는 lifecycle. 또한 `ConnectorHost` 는 `bootstrap.ts:228` 에서 생성되지만 **슬라이스 밖 소비자가 0개**라 현재 도달 불가 표면이다 | `auth-platform/registry.ts:58-129` · `modules/index.ts:26` · 실측 grep(소비자 0) |
| 더 작은 해법이 있는가 | **있고, 채택한다.** 실험의 범용 배관은 **신규 106줄**(`runtime-tools.ts` 43 + `claude-runtime-tools.ts` 34 + `runtime-tool-registry.ts` 29) + 본체 수정 **`claude.ts` 2줄 · `turn.ts` 4줄**뿐이다. 새 호스트 슬라이스를 짓는 대신 이 배관을 이식하고 0157 registry 를 확장하는 것이 최소 해법이다. 가이드 §5.2 의 `features/plugins/` 신설은 **더 큰 해법이며 이득이 없다**(아래 인용 자료 행) | 실측 `wc -l` · `git diff --stat`(sibling clone) |
| 인용 자료가 요구를 부풀리지 않았나 | **부풀렸다 — 3건 정정.** ⓐ 가이드 §4 "현재 구현 기준선" 전체가 **이 저장소에 실재하지 않는다**: `grep -ril confluence app/src` → **1 hit**(주석). §4.2 가 열거한 결합(`bootstrap.ts` 의 `registerConfluenceHandlers`, `risky-tools.ts` 의 suffix 판정, Confluence 전용 IPC/preload/renderer)은 **모두 sibling clone 의 미커밋 작업**이다(양 클론 모두 `6e969b5`, 미커밋 46경로). 따라서 §12 단계 0·4·7 은 이 저장소에 대상이 없다. ⓑ §5.3 "수동 배열은 제거한다" 는 **3커밋 전에 채택된 결정을 인용도 반박도 없이 뒤집는다**(아래 §기존 결정 표) — 사용자가 배열 유지로 확정. ⓒ §8~§10(동적 base URL·SSRF·telemetry·live DC matrix)은 **Confluence 제품화 요구**이지 플러그인 호스트 요구가 아니다. 특히 SSRF 는 §8.1 이 도입하는 *사용자 입력 base URL* 에서만 발생하며, 현행 manifest 는 origin 을 고정한다(`manifest.ts:20` `OriginSchema`) | 실측 `git status`(46) · `git log`(양 클론 `6e969b5`) · `modules/AGENTS.md:6-12` |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다** — 아래 §기존 결정·규칙과의 관계 표에서 5건 전부 "유지". 유일한 확장은 manifest `contributes` 에 키 1개 추가이며, 0157 의 ABI 정책(`contracts/auth-plugin.ts:14-18`)이 명시한 **additive-optional-only** 안에 든다 | `contracts/auth-plugin.ts:14-18` |

- **사용자에게 올릴 것**: 없음. 기준선·범위·등록 방식·인증 재사용 4건 모두 본 세션에서 사용자 확정.

### 검토 결과 — 실험 구현에서 이식할 것 / 걷어낼 것

실험(sibling clone 미커밋)을 전수 읽은 결과다. 이것이 본 설계의 1차 근거다.

**이식(범용 — 서비스 어휘 0):**

| 파일 | 줄 | 판정 |
|---|---|---|
| `adapters/runtime-tools.ts` | 43 | 그대로. import 가 `zod` 타입 하나뿐 |
| `adapters/claude-runtime-tools.ts` | 34 | 그대로. `createSdkMcpServer`+`tool` 변환만 |
| `features/extensions/runtime-tool-registry.ts` | 29 | 그대로. id→server Map + revision 카운터 |
| `claude.ts` +2 · `turn.ts` +4 · `builder.ts` +4 | 10 | 그대로 |
| `session-runtime.ts` +8 · `chat-turn.ts` +12 | 20 | **로직은 채택, 배치는 변경**(아래 §설계 — 순수 seam) |
| `connectors/runtime.ts` `connect`/`disconnect` +13 · `registry.ts` `id?` +1 | 14 | 그대로 |

> **revision→respawn 은 놓치기 쉬운 정답이다.** Claude 서브프로세스는 spawn 시점의 도구 목록으로 고정되므로, 연결 후 등록된 도구는 이미 떠 있는 채널에 도달하지 못한다. 실험은 `spawnedRuntimeToolsRevision` 을 비교해 채널을 teardown 한다. 계승한다.

**걷어낼 것(서비스 고유 접착제가 컴포지션 루트에 있음 — 총 252줄):**

| 파일 | 줄 | 문제 | 본 설계의 대체 |
|---|---|---|---|
| `app/handlers/confluence.ts` | 137 | 본체에 서비스 전용 IPC 3채널 + "인증→연결→도구등록" 손조립. 두 번째 플러그인은 같은 파일을 또 만들고 `bootstrap.ts` 에 등록 줄을 또 넣어야 한다 | 범용 `PluginHost` + 범용 채널 3종 |
| `app/confluence-sdk-tools.ts` | 115 | 도구 정의가 **`RouterContext` 통째로** 받는다 → 플러그인 도구가 db·sessions·mcp·auth 전권 | 좁은 `PluginToolContext` 4키 |
| `adapters/risky-tools.ts` | +8/−4 | `'__confluence_createContent'` 문자열 하드코딩. 쓰기 도구를 가진 플러그인마다 여기 추가 | 스냅샷의 `readOnlyHint` 판독 |

**실험이 남긴 결함 2건(본 설계에서 해소):**

1. **승인 사실이 두 곳에 중복 기재.** `confluence-sdk-tools.ts:104` 가 `updateContent` 에 `destructiveHint: true` 를 이미 선언해 두고, `risky-tools.ts` 에 같은 사실을 문자열로 또 적었다. 신고서 값을 읽으면 문자열 목록이 통째로 사라진다.
2. **서버 식별자가 두 개다.** `mcpServers[server.id]`(`atlassian-confluence-dc`)와 `createSdkMcpServer({name})`(`orca-confluence`)가 **다른 값**이다(`modules/confluence.ts:23` vs `confluence-sdk-tools.ts:40`). SDK 가 노출하는 도구 이름은 `mcp__${serverName}__${toolName}`(`sdk.d.ts:3509`)이므로 어느 쪽이 prefix 가 되는지에 승인 판정이 걸린다. 실험은 suffix 매칭으로 이 모호성을 우회했다. **본 설계는 식별자를 하나로 합쳐 모호성을 제거한다.**

## 자료조사 (Research)

> 수치는 전부 **본 세션에서 직접 측정**했다(승계 0건).

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 이 저장소에 인프로세스 도구 경로가 없다 — `createSdkMcpServer` **0 hits**, `claude.ts` 의 `mcpServers` **0 hits** | 실측 `grep -rn` (`app/src`) |
| Confluence 결합 **1 hit**(주석 2줄)뿐. 실험 23파일은 sibling clone 미커밋(**46경로**), 양 클론 HEAD 동일 `6e969b5` | 실측 `grep -ril`·`git status --porcelain`·`git log` |
| `createSdkMcpServer(_options)` 시그니처: `{name, version?, instructions?, tools?, alwaysLoad?}` → `McpSdkServerConfigWithInstance` | **1차 출처** `@anthropic-ai/claude-agent-sdk@0.3.220` `sdk.d.ts:482-503` |
| SDK 노출 도구 이름 = `mcp__${serverName}__${toolName}`, **서버명은 정규화됨**(non-`[a-zA-Z0-9_-]` → `_`) | **1차 출처** `sdk.d.ts:3509` |
| 우리 manifest id 는 케밥 소문자(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)라 위 정규화 대상 문자를 포함하지 않는다 → **id 가 그대로 serverName 이 된다** | `auth-platform/manifest.ts:12-17` + 위 정규화 규칙 |
| `alwaysLoad: true` 는 도구를 tool-search 뒤로 미루지 않고 항상 프롬프트에 싣는다 | **1차 출처** `sdk.d.ts:495-502` |
| 0157 registry 가 이미 강제하는 것: 패키지 단위 all-or-nothing 거부 · pluginId/contribution id 중복 거부 · apiVersion 불일치 거부 · **manifest 선언 ↔ 구현 1:1** · 등록 후 cross-reference 검증 | `auth-platform/registry.ts:35-156` |
| `AUTH_PLUGIN_PACKAGES` 현재 **0개**. 신규 설치 기본값이 빈 배열이며 그 경우 로그인 게이트가 자동 통과 | `modules/index.ts:26` · `broker.ts:101` |
| **앱 로그인은 이미 auth platform 을 쓴다** — `AuthTarget.kind='application'` 한 값으로 갈린다. 게이트 필요 여부는 등록된 application provider 수로 결정되고, 로그인 화면은 provider 가 선언한 필드를 **제네릭 렌더링**한다 | `broker.ts:101` · `bindings.ts:78` · `AuthView.tsx:55` · 설계 의도는 `contracts/auth-plugin.ts:4-5` |
| `ConnectorHost`/`ConnectionRegistry` 는 `bootstrap.ts:227-231` 에서 조립되어 `RouterContext` 에 담기나 **슬라이스 밖 소비자 0개** — IPC·renderer 어디서도 부르지 않는다 | 실측 `grep -rn "connectors"` (핸들러·chat-turn·features 제외 결과 0) |
| 연결은 **메모리 전용**. `ConnectionRegistry` 는 `Map` 이고 DB 테이블이 없다(마지막 마이그레이션 `0016`) | `connectors/registry.ts:31` · `ls infra/db/migrations` |
| main DAG: `adapters` 는 `adapters·adapter-impl·infra·shared` 만 의존 가능 — **`contracts` 를 import 할 수 없다** | `app/eslint.config.mjs:118-128` + `src/main/AGENTS.md` DAG 표 |
| feature 교차 import 금지(capture 규칙). 해소책 3종 = 타입을 contracts 로 승격 / 구조적 포트 / 컴포지션 루트 주입 | `app/eslint.config.mjs:124` · `src/main/AGENTS.md` §feature 수직 슬라이스 |
| `makeCanUseTool(requestApproval, opts)` 는 이미 옵션 백을 받는 **순수 매핑 함수** — 판정 주입 지점이 존재한다 | `adapters/claude.ts:97-100`, 호출부 `:397` |
| `ExtensionBuilder` 는 생성자 주입 구조 — `runtimeTools?: RuntimeToolSource` 를 **구조적 포트로** 받으면 교차 import 가 생기지 않는다 | 실험 `builder.ts` diff · 현행 `features/extensions/builder.ts:16-25` |
| IPC 채널 현재 **79개**(auth 8). `docs/IPC_CONTRACT.md` 헤더 수치와 일치 | 실측 `grep -c "'orca:"` (CHANNELS 블록 내) |
| `app/handlers/` 에 테스트 **0파일** — 핸들러는 `ipcMain` 의존이라 얇게 두고 로직은 테스트 가능한 모듈에 두는 것이 저장소 관례 | 실측 `ls src/main/app/handlers/*.test.ts` |
| conformance 는 "표에 한 줄 추가하면 같은 suite 가 재적용" 패턴 — 신규 기여자에게 그대로 재사용 | `auth-platform/conformance.test.ts:1-4` |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 |
|---|---|---|
| 1 | `adapters/runtime-tools.ts` 의 도구 계약 모듈은 백엔드·서비스 중립이다 — 이 파일의 import 문 집합이 정확히 `{zod}` 다 | `app/src/main/adapters/runtime-tools.test.ts::"계약 모듈의 import 는 zod 뿐이다"` |
| 2 | `adaptRuntimeTools(snapshot)` 이 서버 2개·도구 3개 스냅샷을 `mcpServers` 로 변환하고, **`mcpServers` 키와 `createSdkMcpServer({name})` 가 같은 식별자**를 쓴다 | `app/src/main/adapters/claude-runtime-tools.test.ts::"서버·도구를 mcpServers 로 변환하고 식별자가 일치한다"` |
| 3 | 빈 스냅샷(서버 0개) 또는 `undefined` 를 주면 `adaptRuntimeTools` 가 `{}` 를 반환해 옵션에 `mcpServers` 키가 생기지 않는다 | `app/src/main/adapters/claude-runtime-tools.test.ts::"빈 스냅샷은 옵션을 만들지 않는다"` |
| 4 | manifest 에 도구 서버를 선언하고 구현을 주지 않으면 **패키지 전체가 거부**되고, 반대로 선언 없이 구현만 주어도 거부된다 (0157 의 provider·connector 와 같은 1:1 규칙) | `app/src/main/features/auth-platform/registry.test.ts::"선언만 있고 구현 없는 도구 서버는 패키지를 거부한다"` · `::"선언되지 않은 도구 서버 구현은 패키지를 거부한다"` |
| 5 | 연결이 `ready` 로 성사되면 그 플러그인이 선언한 도구가 `RuntimeToolRegistry.snapshot()` 에 나타난다 | `app/src/main/features/auth-platform/plugin-host.test.ts::"연결 성사 시 선언된 도구가 스냅샷에 등록된다"` |
| 6 | 연결을 해제하면 그 플러그인 도구가 스냅샷에서 사라지고 `revision` 이 등록 전보다 **증가한다** | `app/src/main/features/auth-platform/plugin-host.test.ts::"연결 해제 시 도구가 제거되고 revision 이 증가한다"` |
| 7 | 도구 핸들러가 받는 컨텍스트의 키 집합이 정확히 `{connectionId, invoke, logger, signal}` 이다 (`RouterContext`·db·vault·auth 접근 없음) | `app/src/main/features/auth-platform/plugin-host.test.ts::"도구 컨텍스트는 좁은 capability 4키만 노출한다"` |
| 8 | 도구 핸들러가 `invoke(operation, params)` 를 부르면 **자기 연결 ID 로 고정된** connector 호출이 일어난다 (다른 연결 ID 를 인자로 넣을 표면이 없다) | `app/src/main/features/auth-platform/plugin-host.test.ts::"invoke 는 자기 connectionId 로 고정된다"` |
| 9 | 쓰기 도구(`readOnlyHint:false`) 이름으로 `canUseTool` 이 불리면 승인 요청이 발생하고, 읽기 도구(`readOnlyHint:true`)는 승인 없이 allow 된다. 도구 이름은 `mcp__<serverId>__<tool>` 형식이다 | `app/src/main/adapters/claude.canusetool.test.ts::"런타임 쓰기 도구는 승인 요청을 만든다"` · `::"런타임 읽기 도구는 승인 없이 통과한다"` |
| 10 | 승인 판정이 **신고서 메타데이터에서만** 나온다 — 같은 도구 이름에서 `readOnlyHint` 값을 뒤집으면 판정도 뒤집힌다 | `app/src/main/adapters/claude.canusetool.test.ts::"readOnlyHint 를 뒤집으면 승인 판정이 뒤집힌다"` |
| 11 | `spawnedRuntimeToolsRevision` 과 현재 `revision` 이 다르면 respawn 을 지시하고, 같으면 지시하지 않는다 (electron 비의존 **순수 함수**) | `app/src/main/features/sessions/respawn-policy.test.ts::"runtime tool revision 이 다르면 respawn 을 지시한다"` · `::"revision 이 같으면 respawn 을 지시하지 않는다"` |
| 12 | 픽스처 플러그인의 식별자 문자열이 **플러그인 디렉토리와 그 테스트 안에만** 존재한다 — `src/main/{app,adapters,contracts,infra}`·`src/shared`·`src/preload`·`src/renderer` 전체 재귀 스캔 결과 등장 0회 | `app/src/main/features/auth-platform/modules/__fixtures__/isolation.test.ts::"픽스처 식별자는 플러그인 디렉토리 밖에 없다"` (fs 재귀) |
| 13 | 패키지 배열에 픽스처를 **한 줄 넣는 것만으로** 호스트 조립 결과에 그 도구가 실린다 — bootstrap 이 쓰는 것과 **같은 조립 함수**를 테스트가 호출해 확인한다 | `app/src/main/features/auth-platform/plugin-host.test.ts::"패키지 배열에 넣는 것만으로 도구가 조립 결과에 실린다"` |
| 14 | 한 플러그인의 등록 실패가 다른 플러그인의 등록과 도구 노출을 막지 않는다 (정상 패키지 1 + 불량 패키지 1 을 함께 주면 정상 쪽 도구가 스냅샷에 있다) | `app/src/main/features/auth-platform/plugin-host.test.ts::"불량 패키지가 정상 패키지의 도구 등록을 막지 않는다"` |
| 15 | `ConnectorHost.connect` 가 `ready` 가 아닌 상태를 받으면 연결 레코드를 남기지 않고, `disconnect` 는 레코드를 제거한다 | `app/src/main/features/connectors/runtime.test.ts::"start 가 ready 가 아니면 연결 레코드를 남기지 않는다"` · `::"disconnect 는 연결 레코드를 제거한다"` |
| 16 | binding 이 폐기되면 그 binding 을 쓰던 연결이 정리되고 해당 플러그인 도구가 스냅샷에서 사라진다 | `app/src/main/features/auth-platform/plugin-host.test.ts::"binding 폐기 시 연결과 도구가 함께 정리된다"` |
| 17 | 신규 IPC 3채널(`pluginList`·`pluginConnectionConnect`·`pluginConnectionDisconnect`)의 요청 스키마가 무효 페이로드를 거부하고, 응답 DTO 의 키 집합이 허용 목록과 정확히 일치한다(비밀 필드 없음) | `app/src/shared/protocol.plugins.test.ts::"연결 요청 스키마가 무효 페이로드를 거부한다"` · `::"연결 응답 DTO 키 집합이 허용 목록과 일치한다"` |
| 18 | `docs/IPC_CONTRACT.md` 의 채널 총계가 실측과 일치한다 — 헤더 수치 = 도메인별 내역 합 = `CHANNELS` 실측(79 + 3 = **82**) | `app/src/shared/ipc.test.ts::"채널 총계가 내역 합과 일치한다"` + 문서 수치 대조(검증 턴 실측) |
| 19 | 게이트 통과: `npm run lint` 0 error · `npm run typecheck` 3분할 0 · vitest 전체 pass (better-sqlite3 ABI 베이스라인 예외는 분리 보고) | 검증 턴 실행 로그 |
| 20 | 실제 Claude 세션에서 픽스처가 아닌 실 플러그인 연결 → 도구 호출 → 쓰기 승인 카드 노출이 동작한다 | **런타임 실기로만 확인 가능 — 사람** (SDK 서브프로세스·승인 UI 필요) |

## 범위 / 비범위

- **범위**:
  - 도구 기여 계약 (`adapters/runtime-tools.ts`) + Claude 어댑터 변환 (`adapters/claude-runtime-tools.ts`) + 도구 레지스트리 (`features/extensions/runtime-tool-registry.ts`)
  - `manifest.contributes.runtimeTools` 추가 + registry 의 선언↔구현 1:1 검증 확장
  - `PluginHost` — 인증 transaction → connector 연결 → 도구 등록/해제를 **플러그인 이름 없이** 수행
  - 좁은 `PluginToolContext` (4키)
  - 신고서 메타데이터 기반 승인 판정 (`makeCanUseTool` 옵션 확장)
  - revision 기반 respawn **순수 판정 함수** 추출 + 배선
  - `ConnectorHost.connect`/`disconnect` + `ConnectionRegistry` 의 명시 id 지원
  - 범용 IPC 3채널 + zod 스키마 + preload 브리지 (main 측까지)
  - 픽스처 플러그인 (`modules/__fixtures__/`) — 번들 미포함, 테스트 전용
  - `docs/IPC_CONTRACT.md` 갱신
- **비범위**:
  - **renderer UI** (연결 목록·연결 폼·상태 표시) — 사용자 확정 "화면 제외". 후속 핸드오프.
  - **연결 영속화(SQLite)** — 연결은 메모리 유지, 앱 재시작 시 소실. 후속 핸드오프(마이그레이션 + 부팅 복원 probe).
  - **Confluence 플러그인 자체** — 사용자 확정 "픽스처로 호스트만".
  - **사용자 입력 base URL·SSRF·redirect/DNS/TLS 정책** — 현행 manifest 가 origin 을 고정하므로(`manifest.ts:20`) 이번 범위에서 해당 표면이 생기지 않는다. 동적 URL 도입 시 필수(가이드 §9.2).
  - **telemetry·capability probe·pagination·optimistic concurrency** — 서비스 제품화 소관(가이드 §8·§10).
  - **생성 카탈로그** — 사용자 확정 "opt-in 배열 유지". 플러그인이 2개 이상 실릴 때 재검토(rule of three).
  - **`features/plugins/` 슬라이스 신설** — 아래 §설계 참조.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 SDK: `@anthropic-ai/claude-agent-sdk@0.3.220` 의 `createSdkMcpServer` · `tool` · `Options['mcpServers']` · `SdkMcpToolDefinition` (`sdk.d.ts:482-503`). **정확 핀 유지**, 버전 변경 없음.
- 기댈 기존 모듈: `AuthRegistry`(등록 위생) · `AuthBroker`(begin/continue/logout/authenticatedFetch) · `ConnectorHost`/`ConnectionRegistry` · `ExtensionBuilder`(생성자 주입) · `makeCanUseTool`(옵션 백) · `PluginManifestSchema`.
- 전제: manifest id 가 케밥 소문자라 SDK 서버명 정규화 대상이 아니다(`manifest.ts:12-17` + `sdk.d.ts:3509`). **id 에 `_` 나 대문자를 허용하도록 스키마를 바꾸면 이 전제가 깨진다.**
- **신규 의존성: 없음.** zod·SDK 모두 기채택.

## 설계

### 접근 방법

실험의 범용 배관을 이식하되, 실험이 **컴포지션 루트에 손으로 쓴 조립(252줄)** 을 `features/auth-platform/plugin-host.ts` 의 **플러그인 무지(plugin-agnostic) 오케스트레이터**로 바꾼다. 흐름은 동일하고, 다른 점은 "무엇을 연결할지"가 코드가 아니라 **manifest 선언에서 온다**는 것이다.

```
manifest.contributes.runtimeTools[]  (선언: 서버 id · 도구 이름 · 정책)
        +  package.createRuntimeTools(ctx)  (구현: zod 스키마 · 핸들러)
                    │  registry 가 1:1 검증 (0157 규칙 재사용)
                    ▼
        PluginHost.connect(pluginId, connectorId, providerId, input)
            broker.begin/continue → binding
            connectorHost.connect({ connectorId, bindingId })  → ready?
            runtimeTools.upsert(server)          ← revision++
                    ▼
        ExtensionBuilder.snapshot() → TurnExtensions.runtimeTools
                    ▼
        adaptRuntimeTools() → options.mcpServers → createSdkMcpServer
```

### 레이어 배치 — DAG 가 배치를 강제한다

**도구 계약은 `adapters/` 에 둔다(`contracts/` 아님).** 가이드 §5.2 는 `contracts/runtime-tools.ts` 를 제안하지만, main DAG 상 **`adapters` 는 `contracts` 를 import 할 수 없다**(`eslint.config.mjs:118-128`). `claude-runtime-tools.ts`(adapters)가 계약을 import 해야 하므로 계약은 `adapters/` 에 있어야 한다. `features` → `adapters` 는 허용되므로 플러그인 호스트도 문제없이 읽는다. **실험의 배치가 우연이 아니라 DAG 의 귀결이다.**

**`features/plugins/` 를 신설하지 않는다.** 신설하면 그 슬라이스가 `features/auth-platform` 을 import 해야 하는데 feature 교차는 lint error(`eslint.config.mjs:124`)다. 회피하려면 auth-platform 을 통째로 옮겨야 하고, 그러면 **앱 로그인 게이트까지 함께 이사한다** — 앱 로그인은 이미 이 플랫폼의 `AuthTarget.kind='application'` 경로이기 때문이다(`broker.ts:101`·`bindings.ts:78`·`AuthView.tsx:55`). 기능 이득 없이 diff 대부분이 이동 노이즈가 되므로 **auth-platform 을 제자리에서 확장**한다. 슬라이스 이름이 도구 기여까지 담기엔 좁다는 점은 인정하며, 필요하면 별도 트리비얼 커밋으로 리네임한다.

**도구 레지스트리는 `features/extensions/` 에 둔다.** `ExtensionBuilder` 와 같은 슬라이스여서 스냅샷 판독에 주입이 필요 없다. 반대편(auth-platform 의 호스트)은 `RuntimeToolSink { upsert, remove }` **구조적 포트**를 컴포지션 루트에서 주입받는다 — `ConnectorHost` 가 이미 `lookup`·`authenticatedFetch` 를 같은 방식으로 받는 선례를 따른다(`connectors/runtime.ts:21-26`).

### 신규 모듈

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `adapters/runtime-tools.ts` | 백엔드 중립 도구 계약(정의·서버·스냅샷·source/sink 포트) | adapters | 순수 — 타입 + import 집합 단언 (AC1) |
| `adapters/claude-runtime-tools.ts` | 스냅샷 → `createSdkMcpServer` 변환 | adapters | 순수 — SDK 호출 결과 객체 형상 단언. SDK 는 실제 함수를 쓰되 반환 config 만 검사 (AC2·3) |
| `adapters/runtime-tool-policy.ts` | 스냅샷 → `mcp__<id>__<tool>` 위험 도구 이름 집합 | adapters | **순수** — Map 생성만 (AC10) |
| `features/extensions/runtime-tool-registry.ts` | id→서버 Map + revision 카운터 | features/extensions | 순수 — upsert/remove/snapshot (AC6) |
| `features/auth-platform/plugin-host.ts` | 인증→연결→도구등록/해제 오케스트레이션. **플러그인 이름을 모른다** | features/auth-platform | **순수** — broker·connectorHost·sink 전부 생성자 주입이라 electron·DB 미의존. 테스트는 페이크 3종 주입 (AC5·6·7·8·13·14·16) |
| `features/sessions/respawn-policy.ts` | `decideRespawn({spawnedRevision, currentRevision, …})` 판정 | features/sessions | **순수** — 0143 `decidePostTurnStep` 선례 (AC11) |
| `features/auth-platform/modules/__fixtures__/` | 시험용 플러그인 패키지(인증 provider 1 + connector 1 + 도구 서버 1: 읽기 1·쓰기 1). **번들 미포함** | features/auth-platform | 그 자체가 검증 수단 (AC12·13) |
| `app/handlers/plugins.ts` | 범용 IPC 3채널 — `PluginHost` 메서드로 **인자 전달만** | app | 핸들러는 `ipcMain` 의존이라 직접 테스트하지 않는다(저장소 관례 — `handlers/*.test.ts` 0파일). **떼어낸 순수부 = `PluginHost`(AC5~8) + 스키마(AC17)**. 핸들러 자체의 실동작은 AC20(사람 실기) |

### 좁은 도구 컨텍스트 (실험 대비 핵심 변경)

실험은 `RouterContext` 를 통째로 넘겼으나, 읽어보면 **실제로 쓰는 것은 `ctx.connectors.invoke` 하나뿐**이다(`confluence-sdk-tools.ts:14-22` 의 `invoke()` 전체). 따라서 좁히는 비용이 사실상 0이다.

```ts
interface PluginToolContext {
  readonly connectionId: string
  // 자기 연결에 고정된 connector 호출. 다른 연결 ID 를 넣을 표면이 없다.
  invoke(operation: string, params: Record<string, unknown>): Promise<ConnectorResult>
  readonly logger: (message: string, meta?: Record<string, unknown>) => void
  readonly signal: AbortSignal
}
```

### 승인 판정 — 문자열 목록 제거

`makeCanUseTool` 의 옵션 백에 `runtimeToolPolicy?: ReadonlySet<string>`(쓰기 도구의 완전 이름 집합)을 추가한다. 집합은 `runtime-tool-policy.ts` 가 스냅샷에서 만든다:

```
readOnlyHint === false  →  `mcp__${server.id}__${tool.name}` 을 집합에 넣는다
```

`isRiskyTool(name)` 은 그대로 두고(내장 도구 화이트리스트 담당), 게이트가 `isRiskyTool(name) || policy.has(name)` 로 판정한다. **서비스 고유 문자열이 어댑터에 들어가지 않는다.**

### 식별자 단일화

`RuntimeToolServer.id` 하나만 둔다. `mcpServers` 의 키와 `createSdkMcpServer({name})` 에 **같은 값**을 넘긴다(AC2). 실험의 `id`/`name` 이원화가 만든 prefix 모호성이 사라지고, AC10 의 이름 계산이 결정적이 된다.

### 재사용할 기존 함수·파일

`auth-platform/registry.ts`(등록 위생 — 확장만) · `auth-platform/manifest.ts`(스키마 — 키 추가) · `auth-platform/broker.ts`(begin/continue/logout) · `connectors/runtime.ts`·`registry.ts`(연결 수명) · `features/extensions/builder.ts`(생성자 주입) · `adapters/claude.ts:97` `makeCanUseTool` · `infra/ipc/handle.ts` · `auth-platform/conformance.test.ts`(표 한 줄 패턴).

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 이번 변경 |
|---|---|---|
| **런타임 동적 로딩 금지** — 임의 경로 `require()`/`import()` 는 filesystem·cookie·Vault 전권과 같다. "재빌드 없이 추가"는 MCP 담당 | `contracts/auth-plugin.ts:7-12` · `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md §확장 모델` | **유지.** 픽스처 포함 모든 플러그인이 빌드 타임 정적 import |
| **opt-in 배열 등록** — `modules/index.ts` 한 줄 추가로 활성화, 그 외 코어 무수정 | `modules/AGENTS.md:6-12` · `modules/index.ts:26` | **유지** (사용자 확정). 가이드 §5.3 의 생성 카탈로그 비채택 |
| **ABI additive-optional-only** — optional 추가만 허용, 기존 멤버 제거·required 화 금지 | `contracts/auth-plugin.ts:14-18` | **유지.** `contributes.runtimeTools` 는 optional 신규 키, `apiVersion` 1 유지 |
| **등록 위생의 단일 지점** — built-in 도 우회 등록로 없음, 중복은 last-writer-wins 아니라 **거부** | `auth-platform/registry.ts:1-8` | **유지·확장.** 도구 서버에 같은 1:1·중복 규칙 적용 |
| **feature 교차 import 금지 + main DAG 하향 의존** | `app/eslint.config.mjs:107-128` · `src/main/AGENTS.md` | **유지.** 계약을 `adapters/` 에 두고 sink 를 구조적 포트로 주입해 위반 0 |
| **위험 도구는 adapters 경계에서 판정, 새 위험 도구는 `risky-tools.ts` 에만 추가** | `adapters/risky-tools.ts:1-4`(현행 주석) | **유지하되 확장.** 내장 도구 화이트리스트는 그대로, 플러그인 도구는 신고서 유래 집합으로 판정 — 파일에 서비스 문자열을 넣지 않는다 |
| **IPC 채널 변경 시 `IPC_CONTRACT.md` 동시 갱신**(§6 절차) | `docs/AGENTS.md` 원칙 5 | **준수.** 79 → 82, 도메인 `plugin` 신설 |
| **구체 provider/engine 리터럴은 adapters·extensions·modules·컴포지션 루트에만** | `src/main/AGENTS.md` §작업 규칙 | **준수.** 픽스처 식별자는 `modules/__fixtures__/` 안에만(AC12 로 기계 강제) |

## 파생 UX / 엣지케이스

- **턴 진행 중 연결/해제**: revision 이 바뀌어도 진행 중인 턴은 **옛 도구 구성으로 완주**한다. 다음 턴 시작 시 `decideRespawn` 이 채널 teardown 을 지시한다. 진행 중 턴을 죽이지 않는다.
- **연결 도중 앱 종료·취소**: `PluginHost.connect` 는 broker transaction 과 connector start 를 `AbortSignal` 로 잇는다. 중단 시 **binding 과 연결 레코드를 둘 다 정리**한다(부분 성공 금지 — 실험 `handlers/confluence.ts:106-112` 의 catch 정리 로직을 계승).
- **연결 교체**: 같은 connector 에 다시 연결하면 기존 binding/연결을 먼저 정리한 뒤 새로 만든다(orphan binding·orphan 도구 서버 방지).
- **binding 폐기(logout·revoke)**: `stopByBinding` 경로로 연결이 정리될 때 **도구 서버도 함께 제거**되어야 한다(AC16). 제거하지 않으면 인증 없는 도구가 모델에 계속 노출된다.
- **플러그인 등록 실패 격리**: 한 패키지가 manifest 검증에 걸려도 다른 패키지와 채팅 기능은 정상이어야 한다(AC14). 0157 registry 가 패키지 단위 all-or-nothing 이므로 반쯤 등록된 상태는 생기지 않는다.
- **앱 재시작**: 연결이 메모리 전용이라 **소실되고 도구도 사라진다.** 이번 범위의 알려진 한계로 명시하며, 부팅 복원은 후속 핸드오프.
- **도구 0개 상태**: 등록된 플러그인이 없으면 스냅샷이 비고 `mcpServers` 키 자체가 생기지 않아 현행 동작이 그대로 보존된다(AC3).

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **IPC 3채널이 이번 라운드에 소비자가 없다.** 0157 verify r1 이 바로 이런 미사용 표면에서 결함(probe redirect 오판)을 찾았다 | 오케스트레이션을 electron 비의존 `PluginHost` 로 빼서 **로직 전체를 테스트가 소비**하게 한다(AC5~8·13·14·16). 핸들러는 인자 전달만 남긴다. 잔여 미검증분(핸들러 배선)은 AC20 사람 실기로 **명시 분리** |
| `mcp__<server>__<tool>` 이름 규약에 승인 판정이 걸린다 | 1차 출처로 확정했고(`sdk.d.ts:3509`) id 케밥 제약상 정규화가 일어나지 않음을 확인. 식별자를 하나로 합쳐 모호성 제거(AC2). 규약이 바뀌면 AC9 가 깨져 조기 발견된다 |
| `alwaysLoad: true` 는 플러그인이 늘수록 프롬프트 컨텍스트 비용이 커진다(가이드 §8.5 지적) | 이번엔 **플러그인이 스스로 선언**하게 두고 기본값을 강제하지 않는다. 플러그인이 2개 이상 실릴 때 lazy exposure 재검토 |
| `features/auth-platform` 이름이 도구 기여까지 담아 실제 책임보다 좁다 | 이동 비용(앱 로그인 게이트 동반 이사) 대비 이득이 없어 수용. 필요 시 별도 트리비얼 커밋 리네임 |
| 연결 메모리 전용이라 재시작 시 소실 — 사용자가 결함으로 오인할 수 있다 | 비범위로 명시하고 후속 핸드오프로 분리. 이번엔 UI 가 없어 사용자 노출 자체가 없다 |
| manifest 가 도구 이름을 선언하고 코드가 스키마·핸들러를 주므로 **이름이 두 곳에 적힌다**(드리프트 위험) | 0157 이 provider·connector 에 쓰는 것과 **같은 1:1 검증**을 도구에도 적용해 드리프트를 등록 단계에서 거부(AC4). 선언을 없애면 승인 정책을 코드 실행 없이 읽을 수 없다 — 의도적 트레이드오프 |

- **되돌리기 어려운 결정**: 도구 계약을 `adapters/` 에 둔 것(DAG 가 강제). `RuntimeToolServer.id` 단일화(이후 이름 변경은 세션 히스토리·승인 정책에 남은 도구 이름을 무효화한다 — 가이드 §8.5 의 "안정적 ID" 경고).
- **단독 결정 금지 항목(Open Question)**: 없음 — 본 세션에서 4건 전부 사용자 확정.

## 영향 받는 파일

**신규**: `app/src/main/adapters/runtime-tools.ts`(+`.test.ts`) · `adapters/claude-runtime-tools.ts`(+`.test.ts`) · `adapters/runtime-tool-policy.ts` · `features/extensions/runtime-tool-registry.ts` · `features/auth-platform/plugin-host.ts`(+`.test.ts`) · `features/sessions/respawn-policy.ts`(+`.test.ts`) · `features/connectors/runtime.test.ts` · `features/auth-platform/modules/__fixtures__/`(+`isolation.test.ts`) · `app/handlers/plugins.ts` · `src/shared/protocol.plugins.test.ts` · `src/shared/ipc.test.ts`

**수정**: `adapters/claude.ts`(+2 옵션 주입, +판정 옵션) · `adapters/turn.ts`(+`runtimeTools?`) · `features/extensions/builder.ts`(+생성자 주입) · `features/auth-platform/{manifest,registry}.ts`(+`runtimeTools` 기여) · `features/connectors/{runtime,registry}.ts`(+connect/disconnect/id) · `features/sessions/session-runtime.ts`(+spawned revision) · `app/{bootstrap,context,chat-turn}.ts`(배선) · `src/shared/{ipc,protocol}.ts`(+3채널) · `src/preload/index.ts` · `docs/IPC_CONTRACT.md` · `features/auth-platform/modules/AGENTS.md`(도구 기여 절차 추가)

## 참고 문서

- `docs/etc/confluence-data-center-plugin-implementation-plan.md` — 참고 자료(§4 기준선은 이 저장소에 미해당, 위 §요구 비판적 검토 참조)
- `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` §확장 모델 — 빌드 타임/런타임 확장 경계의 정본
- `docs/IPC_CONTRACT.md` §6 — 채널 변경 절차 (**동시 갱신 필수**)
- `docs/arch/backend/provider-runtime.md` §3 — 위험 도구 게이트
- `app/src/main/AGENTS.md` — main DAG · feature 교차 금지 해소책 3종
- 1차 출처: `@anthropic-ai/claude-agent-sdk@0.3.220` `sdk.d.ts:482-503`(createSdkMcpServer) · `:3509`(도구 이름 규약)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 어댑터 변환(`claude-runtime-tools`) · 정책 파생(`runtime-tool-policy`) · 오케스트레이션(`plugin-host`) · 순수 판정(`respawn-policy`) · 레지스트리 확장(`registry`) · IPC 스키마(`protocol.plugins`) · 위생(`__fixtures__/isolation`).
- 레이어 경계 위반 0 (`boundaries/dependencies` error 0) · 신규 의존성 0 · DB 마이그레이션 0.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구·결정 8건을 라이브 세션 출처로 인용했고, 추론 1건은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인` 또는 1차 출처를 붙였다.
- [x] 의존 기술 — 신규 의존성 0 을 확인했다(zod·SDK 기채택).
- [x] 파생 UX — 턴 중 연결 변경·취소·binding 폐기·재시작 소실·도구 0개를 이 작업에 해당하는 것만 펼쳤다.
- [x] 리스크 — 미사용 IPC 표면·이름 규약 의존·선언/구현 드리프트를 적었다. Open Question 0(전부 사용자 확정).

**기계적으로 확인 가능한 것:**

- [x] 요구 비판적 검토 5질문에 전부 답했고, **요구 범위를 줄이지 않았다** — 사용자가 "화면 제외"를 직접 선택했고 비범위 항목마다 사유·후속 소관을 명시했다.
- [x] 인수 기준 20개의 **`검증 수단` 칸이 비어 있지 않다** — AC20 은 "런타임 실기로만 확인 가능 — 사람"으로 명시.
- [x] 부정형/"불변" 기준 **0개** — AC12 는 "픽스처 디렉토리 안에만 존재한다"는 위치 단언, AC3 은 "`{}` 를 반환한다"는 값 단언으로 썼다.
- [x] **AC 끼리 모순 없음** — AC1(계약 import = zod 뿐) ↔ AC2(SDK 변환)는 서로 다른 파일 소관이라 충돌하지 않는다. AC12(픽스처 격리) ↔ AC13(배열 한 줄 등록)은 픽스처를 `modules/index.ts` 가 아니라 **테스트가 조립 함수에 주입**하는 방식으로 양립시켰다. AC10(정책은 메타데이터 유래) ↔ 기존 `isRiskyTool` 유지는 OR 결합이라 양립.
- [x] 인용 수치를 **이번 세션에서 직접 측정**했다 — 실험 파일 106/252줄(`wc -l`·`git diff --stat`), Confluence hit 1, 미커밋 46경로, 채널 79(+3=82), `AUTH_PLUGIN_PACKAGES` 0개, 마이그레이션 마지막 0016, handlers 테스트 0파일. **승계한 숫자 0개.**
- [x] 신규 모듈 9개 전부 테스트 방법이 있고, electron 의존 모듈(`handlers/plugins.ts`)은 **떼어낼 순수부(`PluginHost` + 스키마)를 명시**했다.
- [x] 전수 조사 대상에 N 수치가 있다 — Confluence 결합 1 / 실험 23파일·46경로 / `ConnectorHost` 슬라이스 밖 소비자 0 / 채널 79 / handlers 테스트 0.

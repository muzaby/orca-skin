# Plan — 0178-auth-entry-collapse

## 메타

| 항목 | 값 |
|---|---|
| slug | `0178-auth-entry-collapse` |
| 작성자 | Claude Code |
| 일자 | 2026-08-06 |
| 매핑 | PHASES 신규 행 (0178) |
| 상태 | DRAFT → READY |
| 구현 주체 | **Claude** (리팩토링 = 비기능. 환경에 Codex 부재) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "플랫폼화로 어중간한 재사용성으로 인해 복잡도가 너무 올라가있다. 로그인 게이트(sso login), 인증에 따른 서비스 제공(rest api) 이렇게 2개 분야에서 제공하고 있다. 복잡도를 낮추고 간결한 사용이 추구돼야 한다. **제약이 많은 재사용은 쓰레기다.** 현재 플랫폼화를 제거하고 간결한 버전의 기능 제공으로 바뀌어야 한다. **내부 api로 시야를 바꿔보자**" | 라이브 세션 요청 (2026-08-06) |
| 명시 요구 (결정) | 폐쇄망 "코어 무수정" 확장 요건 → **포기**. 절단 깊이 → **전면 붕괴**. UI 커넥터 추가 경로 → **제거**. | 라이브 세션 AskUserQuestion 응답 |
| 명시 요구 (보정) | "다만 main수정 없음/최소화를 위해 **진입점 까지만 남겨둘 것**. 리눅스 dd를 예시로 들면 open, read, write, ioctl interface만 남겨두는것" | 라이브 세션 (ExitPlanMode 반려 1) |
| 명시 요구 (보정) | "linux dd같은 예시는 **예시이다**. 그런 방식의 **타입스크립트 모듈화 형태**로 따라야한다" | 라이브 세션 (ExitPlanMode 반려 2) |
| 명시 요구 (실사용) | "로그인 진입점만 남길 것. 다만 해당 로그인 기반 **인증된 상태로 api 호출** 할 수 있다. 인증을 기반한 동작들이 가능하도록 api 를 제공해야 한다. **현재 사용 기능** — sso login 인증 rest api / id·passwd, pat 인증 mcp / id·passwd, pat 인증 rest api" | 라이브 세션 |
| 명시 요구 (실사용 추가) | "**SSO 로그인 → MCP 도 있다.** 이것 또한 일반적인 플러그인 기능이다" | 라이브 세션 (ExitPlanMode 반려 3) |
| 명시 요구 (방식) | SSO→MCP 해소 = **사내 API 로 토큰 교환** (쿠키 평문 반출·로컬 프록시 대신) | 라이브 세션 AskUserQuestion 응답 |
| ~~추론 의도(오독)~~ | ~~"내부 api로 시야를 바꾼다" = 확장 가능한 *플러그인 플랫폼*이 아니라 **인증된 사내 API 클라이언트**로 재프레이밍한다는 뜻~~ — **사용자 정정으로 폐기**(아래 행). | 위 "간결한 사용" + "내부 api" 결합 |
| 명시 요구 (인벤토리) | **인증 4종** = sso(adfs) · id/passwd · pat · auth token. **사용처 3종** = 비용추적(sso→code→token, rest api) · 컨플루언스 검색(id/passwd, pat) · llm 모델 token 발급(sso→세션쿠키, rest api). | 라이브 세션 (2026-08-06) |
| 명시 요구 (정정) | "**모듈간 api로 사용 가능하도록, 인프라 기능같이 지원하라.** (인프라로 옮기라는 말이 아님 — 검토가 필요함.)" 즉 "내부" 는 *사내(회사)* 가 아니라 **이 앱 내부**다. 부르는 대상이 사내 서버라는 것은 부수적이고, 요구의 핵심은 **다른 슬라이스가 인증 구현을 몰라도 인증된 호출을 할 수 있게 하는 것**이다. | 라이브 세션 정정 (2026-08-06) |

## Context (왜)

인증 코드가 두 분야(앱 로그인 게이트 · 인증된 REST/MCP)를 덮는데, 그 사이에 **플러그인 플랫폼 한 겹**이 끼어 있다. 이 겹은 `docs/guides/closed-network-extensions.md` 의 "회사 포크가 main 을 수정하지 않고 인증 provider·connector 를 붙인다" 요건에서 왔고, 거기서 계약 동결(additive-optional-only) · `apiVersion` ABI · manifest 선언↔구현 전 필드 대조 · `declare.ts` 파생 헬퍼 · registry all-or-nothing · conformance 하네스가 전부 파생됐다.

문제는 **그 겹이 값을 못 내고 있다**는 것이다(§자료조사 R4~R8). 사용자가 지목한 실사용 4종 중 **3종이 동작하지 않는다**. 목표는 이음매를 버리는 것이 아니라 **이음매를 최소 크기로 줄이는 것** — 확장점 1,603줄 → 약 80줄.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당 — 원인을 실측으로 확정** | 증상="복잡도가 높다". 원인은 *양*이 아니라 **확장 요건이 파생시킨 검증 기계**다: `manifest.ts`(187) + `registry.ts`(448) + `conformance.ts`(238) + `plugin-host.ts`(348) + 계약 3종(382) = **1,603줄**(§R1 재측정). 이것들이 하는 일(형태 검증·선언↔구현 대조)은 **TypeScript 타입 시스템이 이미 컴파일 타임에 하는 일**이다. |
| 이미 있는 것 아닌가 (기존 코드로 충족되나) | **부분적으로 "있다" 가 함정 — 정정 필요** | ADFS/WIA provider 구현체는 **존재한다**(`providers/corp-adfs-wia.ts` 191줄 + test 148). 그러나 **어떤 등록 패키지에도 없다** — 유일한 참조가 미등록 예제 `modules/_example/index.ts:9,49` 다(§R5). 즉 "SSO 로그인" 은 코드가 있으나 **배선이 없다**. 이 작업은 삭제만이 아니라 **배선 완성**을 포함해야 요구가 성립한다. |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **따져봤고, 불충분** | 1단계(죽은 표면 제거)만 해도 약 1,000줄이 준다. 그러나 `manifest`·`registry`·`conformance` 가 남으면 새 사내 서비스를 붙일 때마다 여전히 **선언 2벌 작성 → 전 필드 대조 통과 → ABI 확인 → conformance 한 줄 추가**를 해야 한다. 사용자가 지목한 증상("제약이 많은 재사용")이 그대로 남는다. 전면 붕괴가 맞다. |
| 인용 자료가 요구를 부풀리지 않았나 | **부풀렸음 — 실측으로 확인** | `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` 는 이미 자기 개정에서 초판의 3건(달성 불가 불변식·실재하지 않는 요구·미검증 전제)을 정정한 이력이 있다. 이번에 추가로 확인: **AUTH-PLAT-004**(5메커니즘 지원)는 생산자 0인 메커니즘 3종을 포함하고(§R6), **AUTH-PLAT-014**(ABI versioning)는 v2 가 존재한 적 없으며, **AUTH-PLAT-002**(5메서드 전부 required)는 `refresh` 가 3/3 `not_supported` 라 규약만 남았다(§R4). |
| 기존 채택 결정을 뒤집는가 | **예 — 사용자 결정으로 뒤집음** | `closed-network-extensions.md` 의 계약 동결·ABI·touch-only 4곳 정책. 폐기가 아니라 **축소 개정**(진입점은 유지). 상세는 §기존 결정·규칙과의 관계. |

- **사용자에게 올릴 것**(단독 결정 불가): **사내 토큰 교환 endpoint 의 경로·인증 방식·응답 형태를 모른다.** 설계는 `targets.ts` 선언으로 파라미터화하고 응답 파싱 경로를 설정 가능하게 두되, **실제 값은 사람 실기에서 확정**한다(§AC15·§리스크 K3).

## 자료조사 (Research)

> **모든 수치는 이번 세션에서 직접 측정했다** (승계 0건). 측정 명령은 `find … | xargs wc -l` · `rg`.

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| R1 | **확장점 총량 1,603줄** — `manifest.ts` 187 + `registry.ts` 448 + `conformance.ts` 238 + `plugin-host.ts` 348 + `contracts/auth-plugin.ts` 210 + `connector-plugin.ts` 106 + `connector-template.ts` 66. (검산: 187+448+238+348+382 = 1,603 ✓) | 각 파일 `wc -l` |
| R2 | **영역별 규모** — `features/auth-platform/` prod 5,649 / test 7,051 · `features/connectors/` prod 686 / test 1,078 · `infra/auth/` prod 1,139 / test 835 · renderer 커넥터·플러그인 UI 2,086(테스트 포함) · renderer `features/auth/` 458 | `find … ! -name '*.test.ts' \| xargs cat \| wc -l` |
| R3 | **등록 실태** — `AUTH_PLUGIN_PACKAGES = [confluence, usage]`. 두 패키지의 서버 목록이 **둘 다 빈 배열** → 등록되는 connector **0개**, provider 4개(static-credential ×2 + basic-credential ×2), 전부 `targets:['connector']` | `modules/index.ts:41-44` · `confluence/servers.ts:44` · `usage/servers.ts:26` · `usage/index.ts:40-56` |
| R4 | **`refresh` 는 구현이 0개** — provider 3/3 이 `{ kind:'not_supported' }` 반환 | `providers/basic-credential.ts:130-132` · `corp-adfs-wia.ts:152-154` · `static-credential.ts:143-145` |
| R5 | **ADFS/WIA(SSO) provider 는 배선돼 있지 않다** — 비-test 참조가 미등록 예제뿐. `modules/index.ts` 의 `_example` 언급은 **주석 안**(21-22행)이다 | `rg "corp-adfs-wia\|createAdfsWiaProvider" --type ts` → `_example/index.ts:9,26,49,50` + 정의 파일 자신뿐 |
| R6 | **미구현 메커니즘 4종** — `oauth_browser`·`oauth_device_code`·`external_secret`·capability `device_code`. 비-test 참조가 전부 플랫폼 파일 자신(manifest zod enum · conformance 검사 · broker relay · 계약 union) | `manifest.ts:30,31,36,44,158-162` · `conformance.ts:96,232-233` · `broker.ts:522` · `contracts/auth-plugin.ts:142` |
| R7 | **`AuthExec`/`ctx.exec` 는 호출자 0** — 계약·구현·배선이 모두 있으나 부르는 코드가 없다 | `contracts/auth-plugin.ts:87-99,116` · `infra/auth/plugin-exec.ts:51` · `app/bootstrap.ts:102,294` · `broker.ts:22,72`. `rg "\.exec\(" features/auth-platform` → 0건 |
| R8 | **SSO → MCP 는 코드로 차단돼 있다** — `${BINDING:<id>}` 가 browser session binding 을 가리키면 `null` → resolver 가 그 MCP 서버를 드롭 | `broker.ts:454-458` (주석: "browser session 은 값이 아니라 cookie jar 라 MCP 로 전달할 수 없다") · `features/extensions/mcp/resolver.ts:40-42` · `store.ts:50` |
| R9 | **설정 키 제거에 마이그레이션이 불필요하다** — `recoverKnownSettings` 가 `SETTINGS_KEYS`(현재 스키마 키) 화이트리스트로만 복원하므로 스키마에서 뺀 키는 자동 드롭된다 | `infra/settings-migration.ts:10,17-25` |
| R10 | **UI 커넥터 추가 경로는 기본 비활성** — `pluginAddEnabled` 기본 `false`, 디버그 패널 토글로만 노출 | `shared/ipc.ts:1217-1219` |
| R11 | **`.mcp.json` 최신성은 boot·CRUD·턴 진입 전 `ensureDeployed()` 로 보장되나 멱등 판정** — 소스 변경이 없으면 재렌더하지 않는다. 토큰 만료는 소스 변경이 아니다 | `app/context.ts:36` · `app/bootstrap.ts:353-358` (`deployNow`/`ensureDeployed`) |
| R12 | **원격 전송은 Chromium 스택 단일화(0173/0174)** — 전역 `fetch(` 허용 파일은 `net-fetch.ts` 하나, Chromium 을 직접 무는 파일은 3개. 가드가 테스트로 강제 | `app/src/main/AGENTS.md §원격 요청` · `infra/auth/no-node-fetch.test.ts` |
| R13 | **레이어 규칙** — feature 수직 슬라이스 교차 import 금지, `eslint-plugin-boundaries` + `import/no-cycle` 강제. 해소책 3가지(타입을 contracts 로 승격 / 구조적 포트 / 컴포지션 루트 주입) | `app/src/main/AGENTS.md §feature 수직 슬라이스` · `app/eslint.config.mjs` |
| R14 | **게이트 베이스라인(이번 세션 실측)** — lint 0 error / 1 warning(0102 known) · typecheck 3/3 · vitest **215 파일(210 pass / 5 fail) · 2045 테스트(2006 / 39)**. red 5파일은 전부 `better_sqlite3.node` 바인딩(`chat-turn.continuity`·`extensions/builder`·`orchestration/fork`·`db/migrate`·`db/queries`) = egress 차단 ABI 베이스라인 | `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run` (2026-08-06) |
| R15 | **`app/AGENTS.md` 의 "DB 로드 스위트 현재 6파일" 은 실측 5파일** — 목록도 일부 다르다(`features/history/writer`·`features/chat/recovery` 는 green, `extensions/builder` 가 red) | `app/AGENTS.md §제약 환경` vs R14 실측. **이번 범위 아님** — verify 에 실측값으로 기록만 한다 |

### 실사용 4종의 현재 상태 (R3·R5·R8 종합)

| 인증 | REST | MCP |
|---|---|---|
| SSO (ADFS/WIA) | **미배선** — 구현체는 있으나 등록 패키지 없음 (R5) | **미지원 (사용자 결정 2026-08-06)** — 아래 §결정 참조 |
| id/pw · PAT | 배선됨, 단 서버 0개라 실질 미동작 (R3) | 배선됨, 단 binding 0개 (R3) |

### 결정 — SSO → MCP 는 지원하지 않는다 (2026-08-06, AC15~17 대체)

설계는 이 구멍을 **사내 API 토큰 교환**으로 메우기로 했으나, 구현 중 확인된 제약(§놓친 문제 D1)을
도메인 상황으로 되짚은 결과 사용자가 **미지원**으로 결정했다.

상황: MCP 도구는 **별도 프로세스**로 뜨고 설정 파일에 값이 박힌다. 브라우저 세션은 넘길 수 없으니
토큰으로 바꿔야 하는데, 그 토큰은 **프로세스가 뜨는 순간 고정되는 사진 한 장**이라 대화 도중
낡으면 그 도구만 거절당한다. 만료를 쫓는 장치(사전 발급·캐시·재렌더 트리거)를 들이는 비용보다
**미지원이 낫다**는 판단이다. MCP 에 붙이려면 PAT·ID/비밀번호를 쓴다.

**따라서 AC15·AC16·AC17 은 폐기**하고 아래로 대체한다. `issueToken`·`tokenExchange` 설정·배포
freshness 변경도 함께 범위에서 빠지며, 진입점은 **3함수**(`authenticate`·`status`·`revoke`)로 돌아간다.

| # | 인수 기준 (대체) | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 15' | SSO(browser session) 인증으로 만든 레코드를 MCP 가 참조하면 **값이 반출되지 않고**, 그 서버는 **사유와 함께** 배포에서 빠진다 | `features/auth/api.test.ts::"SSO 인증은 MCP 로 반출되지 않는다"` + `mcp/convert.test.ts::"미해결 참조는 사유와 함께 dropped 된다"` | `extensions/mcp/resolver.ts` → `resolveBindingCredential` → `convert.ts` `dropped` |
| 16' | credential(PAT·ID/비밀번호) 인증은 **그대로 MCP 로 반출된다** (현행 동작 보존) | `features/auth/api.test.ts::"credential 인증은 MCP 로 반출된다"` | 동일 |
| 17' | SSO 대상은 REST 경로에서 **정상 동작한다** — MCP 미지원이 REST 를 막지 않는다 | `features/auth/api.test.ts::"SSO 인증은 REST 요청에 세션 쿠키로 나간다"` | `modules/*` → `InternalApi.request` |

**1,603줄 확장점을 두고도 실사용 4종 중 3종이 동작하지 않는다.** 이 작업의 필요를 그 자체로 보여주는 지점이며, 따라서 이 작업은 *삭제*와 *SSO 경로 배선 완성*을 함께 한다.

## 인수 기준 (Acceptance Criteria)

> 삭제형 AC 의 `프로덕션 도달 경로` 는 "저장소 전역 grep" 이다 — 특정 호출자가 아니라 **코드베이스 전체**를 훑으므로 "유일한 호출자가 테스트" 문제가 성립하지 않는다.

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `refresh` 표면이 저장소에서 사라진다 — `AuthRefreshResult`·`AuthRefreshOutcome`·`CHANNELS.authRefresh`·provider 메서드·renderer 호출부 전부 | `features/auth/surface.test.ts::"refresh 표면이 남아 있지 않다"` (repo grep 단언) | 저장소 전역 `rg "authRefresh|AuthRefresh"` → 0건 |
| 2 | `AuthExec`·`ctx.exec`·`infra/auth/plugin-exec.ts` 가 사라진다 | `features/auth/surface.test.ts::"exec 표면이 남아 있지 않다"` | 저장소 전역 `rg "AuthExec|pluginExec"` → 0건 |
| 3 | 미구현 메커니즘 4종(`oauth_browser`·`oauth_device_code`·`external_secret`·capability `device_code`)이 계약·스키마·relay 에서 사라진다 | `features/auth/surface.test.ts::"미구현 메커니즘이 남아 있지 않다"` | 저장소 전역 `rg` → 0건 |
| 4 | 플랫폼 파일 7종이 삭제된다 — `manifest.ts`·`registry.ts`·`conformance.ts`·`plugin-host.ts`·`contracts/auth-plugin.ts`·`contracts/connector-plugin.ts`·`contracts/connector-template.ts` | `features/auth/surface.test.ts::"플랫폼 파일이 존재하지 않는다"` (fs.existsSync 단언) | 파일 시스템 |
| 5 | 진입점 2파일 합계가 **100줄 이하**다 (`contracts/auth-method.ts` + `contracts/internal-api.ts`) | `features/auth/surface.test.ts::"진입점 총량이 100줄 이하다"` | 파일 시스템 |
| 6 | 인증 방식 등록이 **`satisfies` 배럴 한 줄**이고, 런타임 검증은 **id 중복 거부 1건뿐**이다 | `features/auth/methods/registry.test.ts::"중복 id 를 거부한다"` + `surface.test.ts::"배럴이 satisfies 로 형태를 강제한다"` | `app/bootstrap.ts` → `createAuth` → `AUTH_METHODS` |
| 7 | UI 커넥터 추가 경로가 사라진다 — IPC 3채널(`pluginTemplateList`·`pluginInstanceCreate`·`pluginInstanceDelete`) · 설정 2키(`connectorInstances`·`pluginAddEnabled`) · renderer 5모듈 · 컴포넌트 2종 | `features/auth/surface.test.ts::"커넥터 인스턴스 경로가 남아 있지 않다"` | 저장소 전역 grep + `shared/ipc.ts` `CHANNELS` |
| 8 | 구 설정 키(`connectorInstances`·`pluginAddEnabled`)가 든 설정 파일로 부팅하면 **두 키는 드롭되고 나머지 키 값은 보존**된다 | `infra/settings-migration.test.ts::"제거된 키는 드롭되고 나머지는 보존된다"` | `Bootstrap.start` → `SettingsStore` → `recoverKnownSettings` |
| 9 | **SSO(browser-session) 인증 방식이 내장 배럴에 등록**되어, `targets.ts` 에 선언만 하면 동작한다 (구 `_example` 전용 상태 해소, R5) | `features/auth/methods/browser-session.test.ts::"배럴에 등록되어 있다"` | `app/bootstrap.ts` → `createAuth` → `AUTH_METHODS` |
| 10 | `targets.ts` 가 **빈 상태**면 `login.status().required === false` 다 (신규 설치 게이트 통과 — 현행 동작 보존) | `features/auth/login.test.ts::"대상이 없으면 게이트가 꺼진다"` | `handlers/auth.ts` (`CHANNELS.authStatus`) → `Login.status` → renderer `RootGate` |
| 11 | `targets.ts` 에 **로그인 대상이 선언되면** `login.status().required === true` 이고, 인증 완료 후 `authenticated === true` 가 된다 | `features/auth/login.test.ts::"로그인 대상이 있으면 게이트가 켜지고 인증 후 통과한다"` | 동일 |
| 12 | credential 인증(id/pw · PAT)으로 만든 인증 레코드로 `api.request` 를 부르면 **선언된 presentation 대로 헤더가 주입**되어 나간다 | `features/auth/api.test.ts::"credential 인증은 presentation 대로 헤더를 주입한다"` | `features/auth/modules/*` → `InternalApi.request` |
| 13 | SSO 인증으로 만든 인증 레코드로 `api.request` 를 부르면 **해당 session group 의 cookie jar 로** 나간다 | `features/auth/api.test.ts::"SSO 인증은 세션 쿠키로 나간다"` | 동일 |
| 14 | credential 인증에서 `api.token(target)` 이 **보관한 secret 을 반환**한다 (현행 `resolveBindingCredential` 동작 승계) | `features/auth/api.test.ts::"credential 인증은 secret 을 토큰으로 반환한다"` | `extensions/mcp/resolver.ts` → `InternalApi.token` → `.mcp.json` |
| 15 | SSO 인증 + `targets.ts` 에 `tokenExchange` **선언 시**, `api.token(target)` 이 사내 endpoint 와 교환한 토큰을 반환한다 (**R8 구멍 해소**) | `features/auth/api.test.ts::"SSO + tokenExchange 선언 시 교환 토큰을 반환한다"` (fetch 포트 주입 스텁) | 동일 |
| 16 | SSO 인증 + `tokenExchange` **미선언 시**, `api.token(target)` 은 `null` 을 반환하고 **`api.request` 는 정상 동작**한다 (미지정 케이스) | `features/auth/api.test.ts::"tokenExchange 미선언이면 token 은 null 이고 request 는 동작한다"` | 동일 |
| 17 | 발급 토큰이 **만료되면** 턴 진입의 `ensureDeployed()` 가 재배포를 유발해 `.mcp.json` 이 갱신된다 | `features/extensions/deployment-freshness.test.ts::"만료된 발급 토큰은 재배포를 유발한다"` | `app/context.ts` 턴 시작 게이트 → `ExtensionDeploymentService.ensureDeployed` |
| 18 | `targets.ts` 에 선언되지 않은 origin 으로 나가는 요청은 **거부**된다 (redirect 포함) | `features/auth/policy.test.ts::"미선언 origin 요청·redirect 를 거부한다"` | `InternalApi.request` → policy |
| 19 | 요청이 예약 헤더(`authorization`·`cookie`·`proxy-authorization`)를 직접 지정하면 **거부**된다 | `features/auth/policy.test.ts::"예약 헤더 덮어쓰기를 거부한다"` | 동일 |
| 20 | `responseType` **미지정 요청은 `'text'` 로** 처리된다 (기존 동작 보존, 미지정 케이스) | `features/auth/api.test.ts::"responseType 미지정은 text 다"` | 동일 |
| 21 | Confluence 도구 동작이 보존된다 — `rest`·`storage-to-markdown`·`download-store`·`limit`·`search-render`·`tools` 의 **기존 테스트가 로직 수정 없이 green** | 기존 `modules/confluence/*.test.ts` 전량 green | `adapters/runtime-tools` → 도구 handler → `InternalApi.request` |
| 22 | usage 경로가 보존된다 — 사용량 provider 가 `UsageSourcePort` 를 통해 값을 받는다 | 기존 `modules/usage/*.test.ts` green + `app/usage-source.test.ts` | `features/usage` → `UsageSourcePort` |
| 23 | 인증 레코드가 **재시작 후 복원**된다 (0170 동작 보존) | `features/auth/store.test.ts::"영속된 인증 레코드를 재시작 후 복원한다"` | `app/auth-restore.ts` → `Login`/`Api` |
| 24 | 로그아웃이 **vault secret 과 cookie jar 를 함께 정리**한다 | `features/auth/login.test.ts::"로그아웃이 secret 과 세션을 정리한다"` | `handlers/auth.ts` (`CHANNELS.authLogout`) → `Login.logout` |
| 25 | Node 전역 `fetch` 가 복귀하지 않는다 (0173/0174 가드 유지) | 기존 `infra/auth/no-node-fetch.test.ts` green | 저장소 전역 |
| 26 | 레이어 경계 위반이 0건이다 — 특히 `features/auth` ↔ 소비 feature 간 직접 import 없음 | `npm run lint` `boundaries/dependencies` 0 error | 빌드 게이트 |

## 범위 / 비범위

- **범위**: 위 AC 26건. `features/auth-platform` → `features/auth` 재구성, `features/connectors` 흡수, 진입점 2계약 신설, 플랫폼 7파일 삭제, UI 인스턴스 경로 제거, SSO 배선 완성 + SSO→MCP 토큰 교환, 동봉 모듈(confluence·usage)에서 플러그인 껍데기 제거, 관련 문서 동기화.
- **비범위**:
  - `infra/auth/` 네트워크 스택 3파일(`net-fetch`·`net-request`·`browser-session-store`)의 동작 변경 — 0173/0174 결정 유지.
  - `.mcp.json` 평문 렌더 **자체** — 아키텍처적 사실(`security.md §1.4-b`). 이번엔 경계표에 항목만 추가.
  - Confluence 도구의 **기능** 변경(검색·첨부·마크다운 변환) — 무변경 이동.
  - `app/AGENTS.md` 의 DB 로드 스위트 파일 수 드리프트(R15) — 별건.
  - 동봉 모듈의 디렉토리 이동 — `modules/` 아래 유지(사용자 결정: main diff 최소).

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| `.mcp.json` 평문 렌더 제거 | 아니오 — 되돌릴 수 있다. 소비자(claude CLI spawn)가 바뀌어야 가능하고, 이번 변경이 그 문을 좁히지 않는다 |
| 동봉 모듈 디렉토리 이동 | 아니오 — 순수 이동. 다만 **`targets.ts` 의 대상 `id` 는 일방향**이다(도구 이름 `mcp__<id>__<tool>`·승인 키·다운로드 경로가 파생). 그래서 **id 규칙을 이번에 고정**하고 문서에 못 박는다 — 미루지 않는다 |
| `${BINDING:}` → `${AUTH:}` 문법 개명 | **일방향이지만 지금이 유일하게 싼 시점** — 설정된 서버가 0개(R3)라 실사용 중인 참조가 없다. 그래서 **문법은 유지하고 해석 키만** 무작위 id → 대상 이름으로 바꾼다(개명 없이 사용성만 확보) |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `infra/auth/{credential-vault,browser-session-store,authenticated-fetch,session-policy,binding-store-file,net-fetch,net-request,net-response}` · `infra/vars.ts`(`BINDING_RE`·`BINDING_PREFIX`) · `features/extensions/mcp/{resolver,store}` · `adapters/runtime-tools` · `infra/settings-migration.ts`.
- 전제:
  - 사내 SSO 는 ADFS/WIA 이고 서비스들이 **같은 Electron partition 의 cookie jar 를 공유**한다 (사용자 확인 2026-07-31, `providers/corp-adfs-wia.ts:3-12`).
  - 사내에 **SSO 세션으로 호출 가능한 토큰 발급 endpoint 가 존재**한다 (사용자 결정 2026-08-06). **경로·응답 형태는 미상** → §리스크 K3.
- **신규 의존성**: **없음.** 기존 스택만 쓴다.

## 설계

### 접근

두 진입점만 남기고 나머지 플랫폼 기계를 걷어낸다. 형태 강제는 **런타임 검증(zod manifest + 전 필드 대조)에서 컴파일 타임(`satisfies`)으로** 옮긴다 — 이것이 1,603줄이 80줄로 줄어드는 실제 기전이다.

**인증 방식이 채우는 인터페이스** (`contracts/auth-method.ts`)

```ts
export interface AuthMethod {
  readonly id: string
  /** 재진입한다. 입력이 더 필요하면 알리고, 호출자가 채워 다시 부르면 완료된다. (구 begin/continue 흡수) */
  authenticate(ctx: AuthContext): Promise<AuthOutcome>
  status(ctx: AuthContext): Promise<AuthStatus>
  revoke(ctx: AuthContext): Promise<void>
  /** 외부 프로세스(MCP)에 넘길 값. 미지원·미설정이면 null. */
  issueToken(ctx: AuthContext): Promise<IssuedToken | null>
}

export type AuthOutcome =
  | { kind: 'input-required'; fields: readonly AuthField[]; message?: string }
  | { kind: 'browser-required'; url: string; isComplete: (url: string) => boolean }
  | { kind: 'authenticated' }
  | { kind: 'failed'; reason: AuthFailure; message?: string }

export type AuthStatus = 'valid' | 'expired' | 'unknown'
export interface IssuedToken { value: string; expiresAt?: number }
```

판별 유니온이 결과를 표현하므로 구 `not_supported` 반환 규약(AUTH-PLAT-002)이 사라진다 — 지원하지 않는 동작은 유니온에 없으면 그만이다.

**앱이 쓰는 소비 표면** (`contracts/internal-api.ts`)

```ts
export interface InternalApi {
  request(req: InternalApiRequest, signal?: AbortSignal): Promise<InternalApiResponse>
  token(target: string): Promise<IssuedToken | null>
}
```

**등록** — `export const AUTH_METHODS = [browserSession, credential] satisfies readonly AuthMethod[]`

### 재사용할 기존 함수·유틸

| 재사용 | 경로 | 용도 |
|---|---|---|
| `createCredentialVault` / `authBindingPrefix` | `infra/auth/credential-vault.ts` | secret 봉인·네임스페이스 |
| `BrowserSessionStore` | `infra/auth/browser-session-store.ts` | cookie jar · 로그인 창 · probe |
| `applyPresentation` / `createSender` | `infra/auth/authenticated-fetch.ts` | 헤더 주입 · 전송 |
| `isAllowedOrigin` | `infra/auth/session-policy.ts` | origin 판정 **단일 구현**(policy 와 세션 경로가 같은 것을 쓴다 — 0157 verify r1) |
| `locationOf` / `redirectLocationOf` | `infra/auth/net-response.ts` | redirect 판정(순수) |
| `createBindingPersistence` | `infra/auth/binding-store-file.ts` | 재시작 복원(0170) |
| `normalizeBasePath` | `features/auth-platform/modules/base-path.ts` | 컨텍스트 경로 정규화 |
| `makeResolver` | `features/extensions/mcp/resolver.ts` | `${BINDING:}` 치환 — 소스만 교체 |
| `recoverKnownSettings` | `infra/settings-migration.ts` | 제거된 설정 키 자동 드롭(R9) |

### 레이어 배치

`features/auth` 는 수직 슬라이스다. 소비자(`modules/confluence`·`modules/usage` 는 같은 슬라이스 내부이므로 교차 아님)와 **다른 슬라이스**(`features/extensions` MCP resolver · `features/usage`)는 직접 import 하지 않는다 — `contracts/internal-api.ts` 의 **구조적 포트**를 컴포지션 루트(`app/bootstrap.ts`)가 주입한다(R13 해소책 1+3, 현행 `AuthenticatedFetch` 와 같은 방식이되 계약이 382줄 → ~30줄).

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `contracts/auth-method.ts` | 인증 방식 진입점 (타입만) | contracts | 타입 — `typecheck` |
| `contracts/internal-api.ts` | 소비 표면 진입점 (타입만) | contracts | 타입 — `typecheck` |
| `features/auth/targets.ts` | 대상 설정 (순수 데이터 + 검증) | features | 순수 단위 |
| `features/auth/methods/credential.ts` | id/pw · PAT (vault 의존) | features | vault 를 **인메모리 fake 로 주입**(현행 `conformance.ts:38` 의 `createFakeVault` 패턴 승계 후 하네스는 폐기) |
| `features/auth/methods/browser-session.ts` | SSO/ADFS (electron 의존) | features | **순수부 seam**: 로그인 완료 판정·쿠키 문자열 조립·토큰 교환 요청 조립을 순수 함수로 분리(`browser-session-pure.ts`)하고, electron 접촉부(`BrowserSessionStore`)는 구조적 포트로 주입 |
| `features/auth/store.ts` | 인증 레코드 + 영속 | features | 영속 포트를 인메모리로 주입 |
| `features/auth/login.ts` | 게이트 상태 · 재진입 · 로그아웃 | features | 순수 단위(방식·스토어 주입) |
| `features/auth/api.ts` | `InternalApi` 구현 | features | `fetchImpl` 포트 주입(**기본값 없음** — R12) |
| `features/auth/surface.test.ts` | 삭제 완료 회귀 (repo grep) | features(test) | fs + grep 단언 |

> electron 을 직접 무는 파일은 **`browser-session-store.ts` 하나로 유지**한다(R12) — 새로 늘리지 않는다. 테스트가 electron 을 import 하면 즉시 죽으므로(P29) 판정·조립은 전부 순수부로 뗀다.

### 토큰 교환과 만료

`targets.ts` 선언:

```ts
{ id: 'corp-sso', kind: 'browser-session', loginUrl: '…', origins: ['https://…'],
  tokenExchange: { method: 'POST', path: '/api/auth/token', valuePath: 'access_token', expiresAtPath: 'expires_at' } }
```

`valuePath`/`expiresAtPath` 로 응답 파싱을 파라미터화한다 — 사내 응답 형태가 미상이기 때문이다(§리스크 K3). 미선언이면 `issueToken` → `null`(AC16).

만료는 `ExtensionDeploymentService` 의 freshness 판정에 반영한다(R11) — 발급 토큰 중 만료된 것이 있으면 `ensureDeployed()` 가 재배포를 유발해 `.mcp.json` 이 갱신된다(AC17).

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| 폐쇄망 확장: 계약 동결(additive-optional-only)·`apiVersion` ABI·touch-only 4곳 | `docs/guides/closed-network-extensions.md §1·§2` | §설계 "형태 강제를 런타임 검증에서 컴파일 타임으로 옮긴다" | **뒤집음** (사용자 결정). 진입점은 유지하되 계약 동결·ABI·manifest 절 폐기 → 축소 개정 |
| 동결 확장점 4종(`auth-plugin`·`connector-plugin`·`connector-template`·`usage-report`) | `app/src/main/AGENTS.md` contracts 행 · `app/AGENTS.md` | §범위 "플랫폼 7파일 삭제" | 앞 3종 **삭제**, `usage-report` 는 **유지**(usage 경로 보존, AC22) |
| last-writer-wins override 금지 (중복 provider id 거부) | **코드 주석** `features/auth-platform/registry.ts:6-8` | §설계 "런타임 검증은 id 중복 거부 1건뿐" | **유지** — registry 는 사라져도 이 판정은 배럴 검증으로 승계(AC6) |
| 런타임 동적 로딩 금지 (임의 경로 require/import) | **계약 헤더** `contracts/auth-plugin.ts:8-12` | §설계 "`satisfies` 배럴" (빌드 타임 배열) | **유지** — 배럴은 컴파일 타임 코드다 |
| raw secret 이 Orca 소유·중개 경로에 없다 (AUTH-PLAT-008) | `contracts/auth-plugin.ts:24-25` · `security.md §1.4-b` | §설계 "`issueToken`" · AC15 | **유지 + 경계표 1행 추가** — 단기 교환 토큰을 PAT 와 동등 등급으로 기재 |
| 원격 요청은 Chromium 스택만, `fetchImpl` 기본값 금지 | `app/src/main/AGENTS.md §원격 요청` · `no-node-fetch.test.ts` | §설계 표 "`fetchImpl` 포트 주입(기본값 없음)" | **유지** (AC25) |
| feature 교차 import 금지 | `eslint.config.mjs` · `src/main/AGENTS.md` | §레이어 배치 "구조적 포트를 컴포지션 루트가 주입" | **유지** (AC26) |
| origin 판정은 policy 와 세션 경로가 같은 구현 | **코드 주석** `features/auth-platform/policy.ts:7-10` | §재사용 표 `isAllowedOrigin` 행 | **유지** |
| 인증 레코드 영속 = 선택 주입 (0170) | `features/auth-platform/bindings.ts:13-19` | AC23 | **유지** |
| 마이그레이션 append-only 가드 | `scripts/check-migrations-appendonly.mjs` | — | **무관** — SQL 마이그레이션 없음(설정 키 제거는 R9 로 자동) |

## 파생 UX / 엣지케이스

- **로그인 창 취소·타임아웃**: `browser-required` 진행 중 사용자가 창을 닫으면 `failed` 로 수렴하고 보류 자원(vault 임시 secret · 세션 핸들)을 정리한다. 현행 transaction 타임아웃(기본 300s)을 승계한다.
- **재진입 경합**: 같은 대상에 대해 `authenticate` 가 중복 진입하면 기존 진행을 **명시 취소**하고 교체한다(현행 `transactions.ts:12` 결정 승계 — 조용한 덮어쓰기 금지).
- **부분 실패 정리**: 로그인 체인을 없애므로 staged binding 이 사라진다. 대신 단일 방식이 실패하면 그 방식이 만든 자원만 정리한다.
- **토큰 만료 중 턴 진입**: 만료 토큰으로 MCP 가 이미 spawn 된 상태 — 재배포는 다음 턴 진입에 걸린다(AC17). 진행 중 턴은 실패할 수 있고, 이는 현행 PAT 만료와 같은 등급의 동작이다.
- **`targets.ts` 빈 상태**: 신규 설치 기본값. 게이트 통과(AC10), 플러그인 탭에 대상 0개, MCP `${BINDING:}` 참조는 해석 실패 → 서버 드롭(현행 동작 승계).
- **DEV bypass**: `authBypass` 설정과 `RootGate` 의 prod fail-closed 재시도(`renderer/src/features/auth/store.ts:78`)는 그대로 둔다.

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| K1 — 삭제 규모가 크다(약 7,500줄). 한 번에 하면 회귀 원인 추적이 어렵다 | **6단계로 쪼개고 각 단계마다 lint+typecheck+vitest 를 통과시킨다.** 단계별 커밋. |
| K2 — 동봉 모듈(confluence 1,830줄)의 껍데기를 벗기다 로직을 건드릴 위험 | `rest`·`storage-to-markdown`·`download-store`·`limit`·`search-render` 는 **파일 무변경**을 목표로 하고, 변경은 `connector.ts`·`index.ts` 로 국한. 기존 테스트 green 이 AC21. |
| K3 — **사내 토큰 교환 endpoint 의 경로·응답 형태가 미상** | `targets.ts` 의 `tokenExchange`(`path`·`method`·`valuePath`·`expiresAtPath`)로 파라미터화. 미선언이면 SSO→MCP 만 비활성이고 REST 는 정상(AC16). **실제 값은 사람 실기에서 확정** — 이것이 이 작업에서 유일하게 열려 있는 항목이다. |
| K4 — SSO 배선이 지금까지 없었으므로(R5) 실기에서 처음 밝혀지는 문제가 있을 수 있다 (Electron per-session WIA allowlist 등, 0157 부터 미검증 이월) | 순수부 seam 으로 판정 로직은 단위 검증하고, electron 실동작은 **사람 실기 항목**으로 명시. |
| K5 — 확장 요건 포기로 사내 포크가 upstream 을 추적할 때 충돌이 늘 수 있다 | 진입점(`AuthMethod` 4함수 + 배럴 + `targets.ts`)은 남으므로 **일반적인 확장은 여전히 3파일 편집**이다. 새 *서비스 종류* 추가만 코어 편집이 된다 — 사용자 결정. |

- **되돌리기 어려운 결정**: `targets.ts` 의 대상 `id`(도구 이름·승인 키·다운로드 경로가 파생). 규칙을 이번에 고정하고 문서에 명시한다.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: 사내 토큰 교환 endpoint 실값(K3).

## 영향 받는 파일

- 신설: `app/src/main/contracts/{auth-method,internal-api}.ts` · `app/src/main/features/auth/{targets,login,api,store,surface.test}.ts` · `features/auth/methods/{index,credential,browser-session,browser-session-pure}.ts`
- 삭제: `features/auth-platform/{manifest,registry,conformance,plugin-host}.ts`(+tests) · `contracts/{auth-plugin,connector-plugin,connector-template}.ts` · `infra/auth/plugin-exec.ts` · `features/connectors/{templates,instance-store,instance-lifecycle,instance-id}.ts`(+tests) · `features/auth-platform/modules/{_example,__fixtures__,declare.ts}` · `plugin-id-ssot.test.ts` · renderer `features/skills/lib/{connectorAddMenu,connectorCreate,connectorInstance,pluginAddGate}.ts`(+tests) · `components/customize/{ConnectorAddMenu,ConnectorInstanceModal}.tsx`
- 재구성: `features/auth-platform/{broker,bindings,transactions,policy}.ts` · `providers/*` · `features/connectors/{runtime,registry}.ts` · `app/{bootstrap,context,usage-source,auth-restore}.ts` · `app/handlers/{auth,plugins}.ts` · `shared/ipc.ts` · `features/extensions/mcp/resolver.ts` · `features/extensions/extension-deployment-service.ts`
- 문서: `docs/guides/closed-network-extensions.md` · `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` · `app/AGENTS.md` · `app/src/main/AGENTS.md` · `features/auth-platform/modules/AGENTS.md` · `docs/arch/backend/security.md` · `docs/IPC_CONTRACT.md` · `docs/PHASES.md` · `docs/handoff/INDEX.md`

## 참고 문서

- `docs/guides/closed-network-extensions.md` — 축소 개정 대상
- `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md` — 폐기 표기 대상
- `docs/arch/backend/security.md §1.4-b`(경계표) · `§1.8`·`§1.9`(네트워크 스택)
- `docs/IPC_CONTRACT.md` — **IPC 채널 제거가 있으므로 동시 갱신 필수**
- `app/src/main/AGENTS.md` — 레이어 DAG · 원격 요청 규칙

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + `./node_modules/.bin/vitest run`.
- **베이스라인(R14)**: lint 0 error / 1 warning · typecheck 3/3 · vitest 215 파일(210/5) · 2045 테스트(2006/39). red 5 = `better_sqlite3.node` ABI, 변경 무관 — 이 수를 **늘리지 않는 것**이 게이트다.
- 신규 테스트 요구: `features/auth/surface.test.ts`(삭제 회귀) · `features/auth/{login,api,store,policy}.test.ts` · `features/auth/methods/*.test.ts` · `infra/settings-migration.test.ts` 보강 · `features/extensions/deployment-freshness.test.ts`.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 인용으로 적었고(반려 3회 포함), 추론은 추론으로 표기했다.
- [x] 자료조사 — R1~R15 전부 `파일:라인` 또는 실행 명령을 붙였다.
- [x] 의존 기술 — 신규 의존성 없음을 확인했다.
- [x] 파생 UX — 창 취소·재진입 경합·부분 실패·토큰 만료·빈 설정·DEV bypass 를 펼쳤다.
- [x] 리스크 — K1~K5 + 되돌리기 어려운 결정(대상 id) + Open Question(K3) 분리.
- [x] **요구 비판적 검토** 5질문에 답했고, 이견(2번 질문: "이미 있다"가 함정)을 적었으나 **요구 범위를 줄이지 않았다** — 오히려 SSO 배선 완성을 범위에 넣었다.
- [x] 인수 기준 26건의 **`검증 수단` 칸이 하나도 비어 있지 않다**.
- [x] 부정형/"불변" 기준 **0개** — 삭제형도 "사라진다 / grep 0건" 이라는 **양성 단언**으로 썼다. AC21·22·23·25 는 "보존된다"를 *기존 테스트 green* 이라는 측정 가능한 형태로 썼다.
- [x] **AC 끼리 모순 없음** — 짝지어 훑었다. 특히 AC4(플랫폼 파일 삭제) ↔ AC21·22(모듈 기능 보존)가 충돌하지 않는지 확인: 삭제 대상 7파일에 `modules/**` 가 없다. AC15(토큰 반환) ↔ AC16(null 반환)은 `tokenExchange` 선언 유무로 배타적이다.
- [x] 인용 수치를 **이번 세션에서 직접 측정**했다 — R1 검산(187+448+238+348+382 = 1,603) 포함, 승계 0건. R15 는 기존 문서와의 차이를 *발견으로* 기록했다.
- [x] 신규 모듈 9개마다 테스트 방법이 있고, electron 의존(`browser-session`)은 **순수부 seam**(`browser-session-pure.ts`)을 설계에 넣었다.
- [x] 전수 조사에 **N 수치**가 있다 — 확장점 1,603줄/7파일 · 미구현 메커니즘 4종 · 실사용 4종 중 3종 미동작 · IPC 3채널 · 설정 2키 · red 5파일.
- [x] 각 AC 에 **프로덕션 도달 경로**가 있다. 삭제형 AC(1·2·3·4·7)는 저장소 전역 grep 이라 "호출자가 테스트뿐" 이 성립하지 않음을 표 머리말에 명시했다.
- [x] "사람 실기" AC — **AC 표에는 넣지 않았다.** 실기 항목(사내 주소·토큰 교환 실값·WIA allowlist)은 §리스크 K3·K4 로 분리했다. AC 26건은 전부 기계 검증 가능하다.
- [x] 선택적 필드 판정마다 **미지정 케이스 AC** 가 있다 — AC16(`tokenExchange` 미선언) · AC20(`responseType` 미지정).
- [x] 소비 계약의 제약 필드마다 **강제 지점**이 있다 — origin allowlist → AC18(`InternalApi.request` 진입), 예약 헤더 → AC19, id 중복 → AC6(배럴 검증).
- [x] 참조 구현 커버리지 — 구 `AuthStep` 6분기(`collect`·`browser`·`device_code`·`done`·`failed`·`not_supported`)를 전수 나열하고 새 `AuthOutcome` 4분기로의 대응을 명시: `collect`→`input-required`, `browser`→`browser-required`, `done`→`authenticated`, `failed`→`failed`, `device_code`→**삭제**(R6 생산자 0), `not_supported`→**삭제**(유니온 부재로 표현).
- [x] 미룬 항목마다 **일방향 여부**에 답했다(§범위 유예 표) — 대상 `id` 가 일방향이라 **미루지 않고 이번에 고정**한다.
- [x] **관문 4 를 본문 완성 후 돌렸다** — §기존 결정 표를 본문 훑으며 채웠고(코드 주석 3건 포함: `registry.ts:6-8`·`policy.ts:7-10`·`auth-plugin.ts:8-12`), 인용 경로를 전부 열어 확인했으며, `[구현자 기입]`·`[검증자 기입]` 블록을 남겼다.
- [x] "확정돼 있다" 류 서술마다 앵커를 확인했다 — `security.md §1.4-b`·`§1.8`·`§1.9`, `closed-network-extensions.md §1`·`§2`, `src/main/AGENTS.md §원격 요청`·`§feature 수직 슬라이스` 를 grep 으로 존재 확인.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: §목표 구조의 "형태 강제를 런타임에서 컴파일 타임으로 옮긴다" 는 구현에서 그대로 성립했다. `manifest.ts`(170) + registry 검증(238) + `declare.ts`(48) + `registry.test.ts`(651) 이 **한 덩어리로** 사라졌다 — `satisfies` 하나가 그 전부를 대신한다. 단계 분할(각 단계 lint+typecheck+vitest green)도 유효했다: 3단계에서 슬라이스 인덱스 역전으로 `protocol.ts` 내용이 복제되는 사고가 났는데, 단계별 게이트와 `grep -c` 중복 검사로 **커밋 전에** 잡았다.
- **이견 / 우려 1 — §작업 단계의 단계 크기가 균일하지 않다.** 1·2단계는 각각 한 세션에 닫히지만 3단계(진입점 신설 + 플랫폼 붕괴)는 broker 822줄 재구성 + `AuthProviderV1`→`AuthMethod` 재형성 + `plugin-host` 흡수를 한 단계에 묶어 놓았다. 실제로는 **3a(등록 검증 붕괴)** 와 **3b(계약 재형성)** 의 성격이 다르다 — 3a 는 삭제라 위험이 낮고 3b 는 재작성이라 높다. 설계가 이를 한 단계로 본 것이 이번 세션에서 3b 가 미완으로 남은 직접 원인이다.
- **이견 / 우려 2 — AC 26건이 전부 기계 검증이라고 적었으나 AC15·17 은 사실상 그렇지 않다.** AC15(SSO+tokenExchange 교환 토큰)·AC17(만료→재렌더)은 아래 D1 의 제약 때문에 **구현 형태가 정해져야** 검증 수단이 확정된다. 설계 시점에 "fetch 포트 주입 스텁" 이라고 적은 것은 구현을 가정한 것이지 측정 가능성을 확인한 것이 아니었다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| D1 | **`${BINDING:}` resolver 가 동기(sync)라 토큰 교환을 그 자리에서 할 수 없다.** 설계는 `InternalApi.token(target)` 을 `Promise` 로 두고 resolver 를 거기에 잇는다고 했으나, `Resolver = (name: string) => string \| undefined` 는 동기 계약이고 `.mcp.json` 렌더 경로 전체가 그 위에 있다. 즉 SSO 토큰 교환(HTTP 왕복)은 **렌더 시점에 수행할 수 없고**, 배포 경로에서 미리 발급해 캐시한 값을 resolver 가 동기로 읽어야 한다. | ✅ **해소** — 사용자가 도메인 상황을 보고 **SSO→MCP 미지원**으로 결정(2026-08-06). 토큰 교환이 범위에서 빠져 이 제약 자체가 사라졌다. 코드는 차단을 *의도*로 명시(`broker.ts` `resolveBindingCredential`) | `infra/vars.ts:6` · `features/extensions/mcp/resolver.ts:42` · `features/extensions/mcp/store.ts:50` |
| D2 | **`refresh` 를 지우면 `'expired'` 로 가는 전이가 코드에 하나도 남지 않는다.** 조사해 보니 제거 전에도 실질적으로 그랬다 — `refreshBinding` 은 provider 의 `refresh` 를 부르는데 3/3 이 `not_supported` 를 돌려주므로 `setStatus('expired')` 에 도달하는 실행 경로가 없었다. 즉 **만료는 처음부터 동작한 적이 없다.** 더불어 `corp-adfs-wia.status()` 가 계산하는 `expired` 판정을 broker 가 binding 에 **반영하지 않는다**(`setStatus` 호출 부재). | ✅ 죽은 코드·죽은 테스트 제거. **`status()` → binding 반영 배선은 미구현** (3b 범위) | `broker.ts` 전역 `setStatus` 호출 2곳뿐(하나는 `'unknown'`) · `providers/corp-adfs-wia.ts:146` |
| D3 | **`PluginConnectorInfo.source` 와 `PluginDiagnostic.kind:'instance'` 가 인스턴스 경로와 함께 죽는다.** 설계 §2단계는 인스턴스 모듈 삭제만 적었는데, DTO 필드 `source` 는 `isUserInstance()` 가 유일한 생산자라 항상 `'static'` 이 되고, 진단 종류 `'instance'` 는 발생원이 0이 된다. 남겨두면 "값이 하나뿐인 union" 이 UI 분기를 유지시킨다. | ✅ 둘 다 제거 + `'instance'` 가 이제 **거부**되는지 양성 단언 추가 | `plugin-host.ts:102` · `shared/ipc.ts` `PluginDiagnostic` |
| D4 | **`ipc-documentation.test.ts` 가 채널 수를 하드코딩**해 채널을 지울 때마다 실패한다. 설계 §게이트는 이 위생 테스트를 언급하지 않았다. | ✅ 채널 제거마다 `docs/IPC_CONTRACT.md` 와 함께 갱신(86→85→82) | `src/shared/ipc-documentation.test.ts:9-22` |
| D5 | **`app/AGENTS.md` 의 "DB 로드 스위트 현재 6파일" 이 실측 5파일**이고 목록도 다르다(`features/history/writer`·`features/chat/recovery` 는 green, `extensions/builder` 가 red). | ⚠️ 보고만 — 이번 범위 밖(plan §R15 에 기록) | `app/AGENTS.md §제약 환경` vs 실측 |

## [구현자 기입] 구현 체크리스트

- [x] 1단계 — 죽은 표면 제거 (AC1·2·3)
- [x] 2단계 — UI 커넥터 추가 경로 제거 (AC7·8 일부)
- [x] 3a — 등록 검증 붕괴: manifest·ABI·선언↔구현 대조·conformance 제거, `satisfies` 배럴 (AC6)
- [x] 3b — 진입점 신설(`contracts/auth-method.ts`·`internal-api.ts`) + broker→api/login/broker 재구성 (AC4·5) + **만료 판정 반영 배선**(D2 잔여)
- [x] 4단계 — SSO 배선 (AC9·15'·16'·17'). **토큰 교환은 범위에서 빠졌다** — SSO→MCP 미지원 결정
- [x] 5단계 — 동봉 모듈 껍데기 제거 (AC21·22)
- [x] 6단계 — 문서 동기화

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 1~3a: 코드 60여 개(삭제 25) + 문서 6 · 3b~5: 코드 40여 개(삭제 7, 신설 8) + 문서 7 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `./node_modules/.bin/vitest run` |
| 게이트 결과 | lint **0 error / 1 warning**(0102 베이스라인) · typecheck **3/3** · vitest **202 파일(197 pass / 5 fail) · 1874 테스트(1835 / 39)** — red 5 = `better_sqlite3.node` ABI, **베이스라인과 동일**(변경 무관) |
| 삭감 실측 | 1~3a: prod **-2,548** · test **-2,248**. 3b~5 는 **재구성**이라 순삭감이 목적이 아니다 — 확장점 총량은 1,603줄 → `auth-method`(164) + `internal-api`(48) + `connector`(62) + `registry`(206) = **480줄** |
| 블로커 / 역질문 | **없음** — D1 은 SSO→MCP 미지원 결정으로 해소됐다 |
| 대상 커밋 | `3ea8f45`(1단계) · `33742c2`(2단계) · `64b43a6`(3a) · 3b~5 는 본 커밋 |

### 3b~5 에서 실제로 한 것

| 단계 | 내용 |
|---|---|
| 3b | `contracts/auth-method.ts`(3함수 — `authenticate`·`status`·`revoke`) + `contracts/internal-api.ts`(`request`·`token`) 신설, `auth-plugin.ts`·`connector-plugin.ts` 삭제. broker 785줄 → `login.ts`(lifecycle 505) + `api.ts`(호출 표면 215) + `broker.ts`(조립·복원 204). `begin`/`continue` 두 IPC 가 **같은 `authenticate` 한 함수**로 들어간다(`ctx.input` 유무로 갈린다). 호출 표면은 `bindingId`·`connectorId` 대신 **대상 이름 하나**(`target`)를 받는다 — `${BINDING:<대상>}` MCP 참조도 같은 키로 바뀌었다(무작위 id 는 사람이 적을 수 없는 참조였다). |
| 3b (만료) | **D2 잔여를 닫았다.** `AuthLogin.revalidate/revalidateAll` 이 방식의 `status()` 를 묻고 **레코드에 반영**한 뒤 브로드캐스트한다. 부팅 복원은 재연결 **전에** `revalidateAll()` 을 돈다. 요청 경로의 **401 도 만료로 반영**한다(403 은 아니다 — 권한 문제를 만료로 접으면 멀쩡한 연결이 끊긴다). 판정 자체가 던지면 `unknown`(사내망 밖을 만료로 단정하지 않는다). |
| 3b (SSO REST) | `BrowserSessionCapability.send` 신설. 그 전에는 브라우저 세션 대상의 요청이 **probe 판정만** 돌려주고 본문이 빈 문자열이었다 — 사용자가 지목한 실사용 "sso login 인증 rest api" 가 성립하지 않던 지점이다. |
| 4 | `methods/sso.ts`(배포가 채우는 한 파일) + `methods/index.ts` 내장 목록. 설정이 있을 때만 등록한다 — 미설정 상태로 등록하면 채워지지 않은 주소로 로그인 창이 열리고 게이트가 켜진다. |
| 5 | 위키·사용량 모듈이 **자기 인증 provider 를 만들지 않는다.** 둘이 글자까지 같은 PAT/ID·비밀번호 구현을 한 벌씩 들고 있었고, 이제 `acceptedMethods` 로 내장 방식을 **고를 뿐**이다. `pluginId`(패키지 개념)·`capabilities`(분기 0)·`AuthStepInfo.browser`(생산자 0)·`AuthLogoutOutcome.not_supported`(생산자 0)·`ctx.fetch`/`ctx.store`/`ctx.env`(소비자 0)를 함께 걷어냈다. |

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (verify 시 신설) | — | — | — |

## [구현자 기입] 사용자 정정 — "내부 api" 오독 (2026-08-06)

**무엇을 잘못 읽었나**: §의도 표의 추론 행이 "내부 api" 를 **사내(회사) API 클라이언트**로 읽었다.
그래서 "회사 서버를 부르는 길" 만 신경 쓰고, **다른 모듈이 인증을 어떻게 받아 쓰는가**는 소비자
각자에게 두었다.

**증상(코드에 남은 흔적)**: 인증 소비 표면이 **세 벌**이었다 — `Pick<InternalApi,'request'>`
(connectors) · `AuthTokenSource`(mcp resolver 가 `InternalApi.token` 과 **똑같은 모양을 손으로 다시
선언**) · `PluginHost.invokeConnector`(usage). 인프라 기능의 성질은 위치가 아니라 **형상이 하나**
라는 것인데, 소비자마다 자기 포트를 다시 선언하면 그 순간 인프라가 아니라 그냥 남의 클래스다.

**조치**

| # | 내용 |
|---|---|
| C1 | 계약·구현·문서의 "**사내 API**" 프레이밍을 "**앱 안의 다른 모듈이 인증을 쓰는 표면**" 으로 정정. `contracts/internal-api.ts` 헤더가 "내부 = 사내가 아니라 이 앱 내부" 를 첫 문장에 못 박는다 |
| C2 | `AuthTokenSource` 손 선언 제거 → `Pick<InternalApi,'token'>`. 소비자는 계약에서 **좁혀 쓴다** |
| C3 | 위생 가드 신설(`contracts/internal-api.test.ts`) — 인증 표면 지문(`token(x: string): string \| null`)을 가진 파일은 **코드에서** `InternalApi` 를 참조해야 한다. **주석·문자열은 먼저 지운다**: 첫 시도에서 resolver 헤더의 `InternalApi` 한 마디가 검사를 통과시켜 실제 위반을 놓쳤고, 실패를 재현해 고쳤다(측정력 0인 위생 테스트를 남기지 않는다) |
| C4 | `target` 키잉은 **유지하되 근거를 교체**. "회사 API 클라이언트라서" 가 아니라 "**다른 모듈은 인증 레코드 id 를 알 방법이 없어서**" 다 — 매 인증마다 새로 뽑히는 내부 값이므로, 모듈간 API 의 인자는 선언에 적힌 안정된 이름이어야 한다. 올바른 요구에서 오히려 더 강한 근거다 |

**"인프라로 옮겨야 하나" 검토 결과 (사용자 지시 항목)**: **옮기지 않는다.**

- 인프라로 떼어낼 수 있는 조각은 **이미 `infra/auth/` 에 있다** — vault · browser session store ·
  authenticated fetch · session policy · `net-fetch`/`net-request`/`net-response` · binding
  records/store **9모듈**.
- `AuthApi` 에 남은 것은 **도메인 상태**다 — 레코드 스토어(`BindingStore`)·등록(`AuthRegistry`)·
  대상 descriptor(`contracts/connector`). 레이어 DAG 는 `infra → infra·shared` 만 허용하므로 infra 는
  이것들을 알 수 없고, 억지로 내리면 **infra 가 도메인 상태를 소유**하게 되어 규칙이 무너진다.
- 따라서 "인프라처럼 **쓰인다**" 는 위치가 아니라 배선으로 만든다 — **포트는 `contracts/`,
  구현은 `features/auth-platform`, 주입은 컴포지션 루트**. 이것이 `src/main/AGENTS.md` §해소책 1+3 의
  기존 규칙과 정확히 같다.

## [구현자 기입] 확장 범위 결정 (2026-08-06)

사용자 결정: 비용추적(`sso→code→token`)과 llm 토큰 발급(`sso→세션쿠키`)은 **실제 폐쇄망 환경에서
구현자가 확장**한다. 코어는 **기본 함수와 진입점만** 제공한다 — 사내 주소·응답 형태를 모르는 채
동작을 가정하지 않는다(§리스크 K3 의 열린 항목을 그대로 닫지 않고 확장자에게 넘긴다).

**그래서 이 세션이 확인해야 했던 것은 "그 진입점으로 정말 붙는가" 하나다.**

| # | 발견 / 조치 |
|---|---|
| D10 | **`ctx.fetch` 제거가 바로 그 진입점을 막고 있었다.** 3b 에서 "소비자 0" 을 근거로 걷어냈는데, 이 표면의 소비자는 애초에 **폐쇄망 포크**다 — 확장점의 사용처를 저장소 내부에서만 세면 확장점은 늘 죽은 코드로 보인다. `sso→code→token` 은 `authenticate` 안에서 HTTP 왕복이 필요하므로 이것 없이는 성립하지 않는다. ✅ **복원**(origin allowlist 강제 + 주입 전송자 유지, 0173 무손상) |
| D11 | 진입점이 있다는 주장을 **증명 없이 두지 않는다.** `extension-points.test.ts` 가 **코어를 한 줄도 고치지 않고** 두 흐름을 실제로 조립해 돌린다 — 교환 왕복·헤더 주입·만료 반영·교환 실패 수렴·미선언 origin 차단·세션 쿠키 본문 수신·MCP 반출 성질(쿠키 null / 교환 토큰 값). 이 파일이 도는 한 진입점은 살아 있다 |

`api_key`·`oauth` 는 `AuthMechanism`/`CredentialKind` 에 남아 있으나 실사용 4종에 없다 — 내장
방식도 생산자도 없다. 제거 여부는 사용자 결정 대기(이번 범위 아님).

## [구현자 기입] 3b~5 에서 놓친 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| D6 | **SSO 대상의 REST 요청이 본문을 돌려주지 않았다.** `BrowserSessionCapability` 에 `probe`(판정만)뿐이라 broker 가 `{status, headers:{}, body:''}` 를 만들어 돌려줬다. 즉 실사용 4종 중 "SSO 인증 REST" 는 배선이 아니라 **구현 자체가 없었다** — plan §R3~R8 은 이것을 놓쳤다. | ✅ `BrowserSessionStore.send` 신설(`sendOnce` + `credentials:'include'`), api 의 redirect 추종 루프를 두 전송자에 공용화 | 구 `broker.ts:338-341` |
| D7 | **`ctx.fetch`·`ctx.store`·`ctx.env` 는 소비자가 0이었다.** `probeUrl` 을 주는 패키지가 없어 인증 방식이 HTTP 를 부르는 경로가 실재하지 않았다. `AuthContext` 가 넓은 만큼 새 방식이 무엇을 해도 되는지가 흐려진다. | ✅ 셋 다 제거. `fetchImpl` 은 `createSender` 경로에 그대로 남아 0173 가드는 유지 | `rg "ctx\.(fetch|store|env)" features/auth-platform` → 0건 |
| D8 | **`AuthProviderInfo.capabilities`·`pluginId` 는 renderer 소비자가 0이었다.** 값이 DTO 를 건너가고 zod 스키마를 지나는데 아무도 읽지 않았다. | ✅ 둘 다 제거 + `protocol.plugins.test.ts` 에 `pluginId` **거부** 단언 추가(되살아나면 잡힌다) | `rg "capabilities\|pluginId" renderer/src` → 비-test 0건 |
| D9 | **`${BINDING:<id>}` 의 키가 무작위 binding id 였다.** 매 인증마다 새로 뽑히고 화면 어디에도 나오지 않아 **사람이 적을 수 없는 참조**였다 — 문법은 살아 있는데 쓸 수가 없었다. | ✅ 해석 키를 **대상 이름**으로 교체(`InternalApi.token(target)`). 문법·정규식은 그대로라 마이그레이션이 없다 | `infra/vars.ts:BINDING_RE` · `mcp/resolver.ts` |

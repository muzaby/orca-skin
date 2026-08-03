# Plan — 0160-confluence-connector-plugin

## 메타

| 항목 | 값 |
|---|---|
| slug | `0160-confluence-connector-plugin` |
| 작성자 | Claude Code |
| 일자 | 2026-08-03 (r2) |
| 매핑 | PHASES 신규 행 (Phase 3++) / PR #307 |
| 상태 | DRAFT → READY |

### 설계 개정 이력

| 라운드 | 계기 | 개정 |
|---|---|---|
| r1 | 최초 작성 | "base url 을 UI 에서 받는다" 를 **사용자 공급 origin** 으로 읽고, 0158 의 "동적 endpoint 비채택" 결정을 부분 반전하는 설계(`originMode:'user'`·connect IPC `origin`·binding-origin 핀·SSRF 완화)를 실었다 |
| **r2** | 사용자 정정: **"base url 은 코드레벨에서 입력된다. pat, id/passwd 는 앱 ui 에서 입력한다"** | **반전을 철회한다.** connector 의 `baseUrl` 은 0158 그대로 manifest 고정이고, 서버 추가는 코드 레벨 factory 호출 한 줄이다. UI 는 **자격증명만** 받는다. 이에 따라 `originMode`·connect IPC `origin`·`ConnectorOriginPort`·binding-origin 핀·origin 형태 검증·DTO origin 필드·SSRF 리스크 항목을 전부 삭제하고, **IPC 스키마 변경이 0건**이 되었다. 남는 계약 확장은 실제 다운로드 동작에 필요한 4건(바이너리 응답·크기 상한·redirect 추종·mechanism 별 presentation)뿐이다 |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "컨플루언스 플러그인(**내장 mcp**, claude-agent-sdk 로 만들어야 함)을 만들려고 한다" | 라이브 세션 요청 (2026-08-03) |
| 명시 요구 | "ui 상에서 커넥터 요청 시, base url 및 pat 혹은 id/passwd 를 받을 수 있어야 한다. (두 가지 방법 모두 연결 가능)" | 라이브 세션 요청 (2026-08-03) |
| **명시 정정** | **"base url 은 코드레벨에서 입력된다. pat, id/passwd 는 앱 ui 에서 입력한다"** — 위 요구의 확정 해석 | 라이브 세션 정정 (2026-08-03, r2 계기) |
| 명시 요구 | 패키지 선택(`@atlassian-dc-mcp/confluence`·cheerio·turndown·turndown-plugin-gfm)이 "적정한지 검토필요함" | 라이브 세션 요청 (2026-08-03) |
| 명시 요구 | 흐름 1~10 (MCP 서버 정의 → CQL 페이지 식별 → 첨부 목록 → 링크 정규화+인증 → 바이너리 다운로드 → 로컬 저장+manifest → storage 파싱 → 이미지/매크로 정규화 → Markdown 변환 → 검증·출력) | 라이브 세션 요청 (2026-08-03) 의 "Confluence 다운로드 워크플로우" |
| 명시 결정 | 신규 의존성 = **cheerio + turndown + turndown-plugin-gfm + @types/turndown 승인**, p-limit 제외(자체 세마포어) | 라이브 세션 질의 응답 (2026-08-03) |
| 명시 결정 | 변환 위치 = **"모두 mcp 내부 동작이다. atlassian-dc-confluence 가 기능이 부족하여 api 호출후 추가적인 변환과정을 처리하여 반환하는 것이 목적이다"** | 라이브 세션 질의 응답 (2026-08-03) |
| 명시 결정 | 대상 배포 = **Data Center / Server (사내)** | 라이브 세션 질의 응답 (2026-08-03) |
| 추론 의도 | "코드레벨에서 입력된다" = 0158 의 정적 connector 모델 **그대로** — manifest `baseUrl` 고정, 서버가 늘면 같은 factory 를 다른 `id`·`baseUrl` 로 한 번 더 호출한다(0158 의 `createJiraConnector` 선례) | `0158/plan.md:180-194` 의 정적 connector 예시 · 사용자 정정 |
| 추론 의도 | 흐름 7~10 의 "MCP 외부" 는 프로세스 분리가 아니라 **모듈 분리** | 사용자 확인 "모두 mcp 내부 동작이다" 로 정정됨 |

## Context (왜)

0157 이 인증 플랫폼(provider·connector·binding·broker)을, 0158 이 그 위의 런타임 도구 기여(`RuntimeToolContribution` → `createSdkMcpServer`)를 만들었고 0159 가 플러그인 카탈로그 화면을 붙였다. 그러나 **실제로 동작하는 사내 서비스 플러그인은 아직 0개**이고(`src/main` 의 confluence 리터럴은 `__fixtures__` 와 그것을 참조하는 테스트/주석 5파일뿐 — 전수), **연결을 시작할 renderer 진입점도 없다**(`pluginApi` 는 `list` 하나만 노출 — `renderer/src/shared/api/ipc.ts:219-221`. preload 는 `connect`·`disconnect` 를 이미 내보내고 있으나 renderer 가 부르지 않는다).

이번 작업은 그 기반 위에 **첫 실물 플러그인(Confluence DC)** 과 **자격증명 입력 UI** 를 올리고, 그 과정에서 다운로드가 실제로 성립하지 않는 원인 4개(바이너리 수신 경로 부재 · redirect 미추종 · mechanism 별 표현 불가 · Basic 형식 불일치)를 additive 하게 닫는다.

목표 한 문장:

> 코드에 등록된 정적 Confluence connector 를 사용자가 UI 에서 PAT 또는 ID/비밀번호로 연결하면, 그 연결 전용 read 도구들이 모델에게 노출되어 CQL 검색·페이지 Markdown 변환·첨부 다운로드가 core 코드 수정 없이 동작한다.

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 (`파일:라인` · 실측) |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **타당.** 요구에 딸려온 "다운로드가 어느 단계에서 막히는지" 진단 축은 **패키지 선택 문제가 아니라 현행 전송부의 구멍**이다. 이번 조사에서 두 개를 실측했다 — ① `createSender` 는 `redirect:'manual'` 인데 `checkRedirect` 의 **프로덕션 호출자가 0개**라 302 가 오면 본문이 빈 채로 반환된다(사용자가 말한 "빈 파일" 축) ② Confluence DC 첨부 다운로드 엔드포인트는 XSRF 보호 대상이라 `X-Atlassian-Token: nocheck` 없이는 거부된다(사용자가 말한 "401·403" 축) | `infra/auth/authenticated-fetch.ts:91-99` · `rg checkRedirect src/main` → 정의 1 + 테스트 2, **호출 0** · `@atlassian-dc-mcp/common@0.29.0` `build/attachment-download.js:54-59` |
| 이미 있는 것 아닌가 (기존 코드로 충족되나) | **절반 있다.** manifest·registry·binding·broker·`ConnectorHost`·`PluginHost`·`RuntimeToolRegistry`·Claude MCP 변환·승인 정책·opt-in 배열·connect/disconnect IPC·preload bridge 는 **그대로 재사용**한다. 없는 것은 ⓐ 바이너리 응답 ⓑ redirect 추종 ⓒ mechanism 별 presentation ⓓ id/pw 2필드 provider ⓔ Confluence 구현 ⓕ 자격증명 입력 UI | `auth-platform/{manifest,registry,broker,plugin-host}.ts` · `adapters/{runtime-tools,claude-runtime-tools,runtime-tool-policy}.ts` · `preload/index.ts:282-288` |
| 더 작은 해법이 있는가 (구조 변경 없이 되나) | **있다 — 그러나 요구를 만족하지 못한다.** `@atlassian-dc-mcp/confluence` 를 **외부 MCP 서버**로 `sources/mcp/mcp.json` 에 등록하면 코드 0줄로 검색·조회·첨부 다운로드가 붙는다(Orca 는 이미 `${BINDING:<id>}` 로 binding credential 을 MCP 에 넘긴다). 하지만 ① 사용자가 요구한 **내장(in-process) MCP** 가 아니고 ② 그 경로는 raw secret 이 broker 밖 자식 프로세스로 나가는 **문서화된 예외**이며 ③ Markdown 변환이 없다(사용자 결정: "기능이 부족하여 … 추가적인 변환과정을 처리하는 것이 목적"). 자체 구현을 택하되 이 대안을 §리스크에 남긴다 | `broker.ts:296-305` `resolveBindingCredential` · `docs/arch/backend/security.md §1.4-b` 예외 2곳 · 사용자 결정 (2026-08-03) |
| 더 작은 해법이 있는가 (2) | **r2 에서 하나 더 줄였다.** r1 은 사용자 공급 origin 을 위해 계약 5곳(descriptor·connect IPC·connection record·broker origin 포트·list DTO)을 넓혔다. 사용자 정정으로 **그 5곳이 전부 불필요**해졌고 IPC 스키마 변경이 0건이 됐다. 남긴 계약 확장 4건은 "이것 없이는 첨부 다운로드가 동작하지 않는다" 는 실측 근거가 각각 있다 | 아래 §자료조사 4행 · r2 개정 이력 |
| 인용 자료가 요구를 부풀리지 않았나 | **한 건 틀렸다 — 정정한다.** 요구서는 "`@atlassian-dc-mcp/confluence` 엔 첨부 다운로드 도구가 없고, MCP 툴은 바이너리 반환 전제가 아님" 을 제외 근거로 들었으나, **0.29.0 에는 `confluence_downloadAttachment` 가 있다**(inline base64 또는 설정된 디렉터리 저장). 제외 결론은 유지하되 **근거를 실측된 것으로 교체**한다 — ⓐ stdio 별도 프로세스(`bin/run.js` + `connectServer`)라 `RuntimeToolContribution`(in-process factory) 계약에 맞지 않고 ⓑ 인증이 `CONFLUENCE_API_TOKEN` **env 하나**뿐이라 id/pw 요구를 만족하지 못하며 ⓒ Markdown 변환이 없고 ⓓ 쓰기 도구 2개를 기본 포함한다 | `npm pack @atlassian-dc-mcp/confluence@0.29.0` → `build/index.js:25-121`, `build/config.js:2-12`, `package.json` `"bin"`·`"type":"module"` |
| 인용 자료가 요구를 부풀리지 않았나 (2) | **한 건 더 정정한다.** 요구서는 흐름 2·3·5 를 "fetch (REST 직접)" 로 적었다. Orca 에서 connector 는 **raw credential 을 볼 수 없고 전역 fetch 를 직접 쓰지 않는다** — `authenticatedFetch(bindingId,…)` 만 호출한다(AUTH-PLAT-009). "패키지 대신 REST 를 직접 부른다" 는 목적은 유지하되 경로는 broker 경유가 된다 | `contracts/connector-plugin.ts:3-7,84-90` · `features/connectors/runtime.ts:3-6` |
| 기존 채택 결정을 뒤집는가 | **뒤집지 않는다.** 사용자 정정으로 0158 의 "서버마다 별도 정적 connector · origin 은 manifest 고정 · 동적 endpoint 비채택" 이 **전부 유지**된다. `modules/AGENTS.md` 의 "동적 URL, alias, endpoint 입력을 만들지 않는다" 와 `connectors/registry.ts:7` 의 "origin 고정" 주석도 그대로 둔다 | `0158/plan.md:138,315-318` · `modules/AGENTS.md` · `connectors/registry.ts:7` · 사용자 정정 (2026-08-03) |

- **사용자에게 올릴 것**(단독 결정 불가): **없음.** baseUrl 모델·신규 의존성·변환 위치·배포 형태 4건 모두 결정을 받았다.
- **이견(진행함, 범위 축소 없음)** 2건:
  1. 요구서는 도구를 "Read Only" 라 했으나 `readOnlyHint` 의 MCP 정의는 **"도구가 환경을 변경하지 않는다"** 다. 페이지/첨부를 로컬에 쓰는 도구는 원격이 읽기 전용이어도 로컬 환경을 바꾼다. 0158 의 fail-closed 원칙(`runtime-tool-policy.ts:12-14`)에 맞춰 **검색만 `readOnlyHint:true`, 파일을 쓰는 두 도구는 `false`(승인 카드 경유)** 로 선언한다. 요구의 의도(원격 변경 없음)는 도구 집합에 write 계열을 두지 않는 것으로 지킨다.
  2. `baseUrl` 이 코드 레벨이면 **신규 설치에서 이 플러그인은 보이지 않는다** — `AUTH_PLUGIN_PACKAGES` 기본값이 빈 배열이고(`modules/index.ts:28`), 사내 origin 을 모르는 상태로 placeholder connector 를 기본 등록하면 모든 사용자에게 깨진 카드가 보인다. 그래서 **기본 미등록 + 활성화 한 줄** 의 기존 규약(`modules/AGENTS.md` §활성화 절차)을 따르고, 사람 실기 AC 에 그 한 줄을 **전제 단계로 명시**한다.

## 자료조사 (Research)

> 아래 수치·계약은 전부 이번 세션(2026-08-03)에 직접 측정했다. 선행 핸드오프의 숫자를 승계하지 않았다.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `AuthenticatedFetchResponse.body` 는 **`string` 단일**이고 `createSender` 는 `res.text()` 하나뿐 — **바이너리 수신 경로가 존재하지 않는다** | `contracts/connector-plugin.ts:31-35` · `infra/auth/authenticated-fetch.ts:98` |
| `createSender` 는 `redirect:'manual'` 인데 **`checkRedirect` 프로덕션 호출자 0개**(정의 1 + 테스트 2) — 302 는 빈 본문 응답으로 그대로 반환된다 | `infra/auth/authenticated-fetch.ts:92` · `rg checkRedirect src/main` |
| `ConnectorDescriptor.presentation` 은 **connector 당 1개**다. 같은 connector 가 PAT(Bearer)와 Basic 을 함께 받으면 표현할 수 없다 | `contracts/connector-plugin.ts:56-58` · `broker.ts:292` |
| `formatScheme('Basic')` 은 `base64(":" + secret)` — **사용자명이 빈 값**인 PAT-as-password 형식이다. `user:pass` 를 넣으면 `":user:pass"` 가 되어 틀린다 | `infra/auth/authenticated-fetch.ts:58-61` |
| `CHANNELS` 실측 **82개**, 문서 헤더·도메인 합도 82. `plugin` 도메인 3채널(`list`·`connectionConnect`·`connectionDisconnect`)이 이미 있다 | `node -e` 로 `src/shared/ipc.ts` 의 `CHANNELS` 블록 `'orca:` 계수 = 82 · `docs/IPC_CONTRACT.md:5,26,28,401` |
| `PluginConnectorInfo` 는 이미 `connectorId`·`label`·`origin`·`pluginId`·`acceptedAuthProviders`·`connected` 를 준다 — 연결 UI 가 필요한 정보가 **전부 있다** | `shared/ipc.ts:286-293` · `plugin-host.ts:79-86` |
| `PluginConnectionConnectRequest` 는 `{connectorId, bindingId}` 로 충분하다 — origin 입력이 없으므로 스키마 변경이 필요 없다 | `shared/ipc.ts:295-298` · `shared/protocol.ts:270` |
| `app/src` 의 confluence 리터럴 보유 파일 **5개** — 전부 `__fixtures__` 와 그것을 참조하는 테스트/주석. 실제 Confluence 구현 **0개** | `rg -li confluence src` → `connectors/registry.ts`(주석) · `connectors/runtime.test.ts` · `__fixtures__/{fixture-package.test,isolation.test,department-fixture-package}.ts` |
| `turndown`·`cheerio` 토큰 보유 파일 **0개** | `rg -li 'turndown\|cheerio' src` → 0 |
| `AUTH_PLUGIN_PACKAGES` 는 여전히 **빈 배열**이고 활성화 지점은 한 곳 | `features/auth-platform/modules/index.ts:28` |
| `providers/` 의 provider 구현 **2개**(`static-credential`·`corp-adfs-wia`). id/pw 2필드 provider **0개** — `createStaticCredentialProvider.begin()` 은 단일 `credential` 필드만 낸다 | `ls features/auth-platform/providers` = 2 · `static-credential.ts:64,71-83` |
| `static-credential` 의 `probeUrl` 은 `ctx.fetch`(provider `allowedOrigins` 강제)로 나간다. connector 자격증명 검증을 여기 두면 provider 마다 origin 을 또 선언해야 하므로, **검증은 connector `start()`(`authenticatedFetch`)로 옮기는 편이 배관이 적다** | `static-credential.ts:93-102,148-157` · `contracts/auth-plugin.ts:101-102` |
| `PluginHost.connect` 는 실패를 **throw** 로 알린다(`unknown connector`·`already connected`·`binding is not valid`·`connector is not ready: <message>`) — 모달은 reject 메시지를 사유로 보여줄 수 있다 | `plugin-host.ts:89-149,167-186` |
| `ConnectorHost.start` 는 connector 예외를 `{health:'error'}` 로 정규화하고 원문은 로그로만 보낸다 — connector 가 `ConnectorStatus.message` 에 담은 문자열만 사용자에게 도달한다 | `features/connectors/runtime.ts:90-109` |
| registry 는 manifest 선언과 구현 descriptor 를 **전 필드 동등 비교**한다(`acceptedAuthProviders`·`baseUrl`·`presentation` 포함) — 필드를 늘리면 여기도 함께 넓혀야 한다 | `auth-platform/registry.ts:279-281` |
| `ConnectorContributionSchema.baseUrl = OriginSchema` — 경로·쿼리 없는 http(s) **origin 만** 통과한다. 컨텍스트 경로(`/confluence`)는 origin 에 넣을 수 없다 | `auth-platform/manifest.ts:22-29,82` |
| `checkRequestPath` 는 절대 URL·`//` 만 거부한다 — `/confluence/rest/api/...` 처럼 prefix 가 붙은 상대 경로는 통과한다. 즉 **컨텍스트 경로는 connector 구현이 path 에 붙이면 되고 계약 변경이 필요 없다** | `auth-platform/policy.ts:39-44` · `broker.ts:523-527` `joinUrl` |
| `PluginToolContext` 는 `{connectionId, invoke, logger, signal}` **4개뿐** — 세션 cwd 를 모른다. 도구가 파일을 쓸 위치를 스스로 정해야 한다 | `adapters/runtime-tools.ts:75-80` |
| 워크스페이스 가드는 `orcaConfigDir()` 하위를 **read 예외 루트**로 허용한다 — 여기에 저장하면 모델이 `Read`/`Grep` 으로 읽을 수 있다 | `adapters/workspace-guard.ts:35-45` · `infra/config/paths.ts:29-31` |
| `downloadsDir` 토큰 **0개** — 다운로드 루트 헬퍼가 아직 없다 | `rg downloadsDir src` → 0 |
| `runtimeApprovalToolNames` 는 `readOnlyHint !== true` 를 전부 승인 대상에 넣는다(미지정 포함, fail-closed) | `adapters/runtime-tool-policy.ts:12-14` |
| `isolation.test.ts` 는 `src/main` 전수에서 `jira-platform`·`jira-security`·`confluence-rnd` **3개 리터럴**만 금지한다. 신규 `confluence-dc` 계열 ID 는 이 목록에 없어 충돌하지 않는다 | `__fixtures__/isolation.test.ts:8,29-34` |
| `pluginApi`(renderer) 는 `list` **1개**만 노출. preload 는 `list`·`connect`·`disconnect` **3개**를 이미 노출한다 | `renderer/src/shared/api/ipc.ts:219-221` · `preload/index.ts:282-288` |
| `AuthView` 가 `AuthStepInfo.fields` 를 제네릭 렌더링하는 선례가 있다 — 연결 모달이 같은 패턴을 쓴다 | `renderer/src/features/auth/components/AuthView.tsx:55-72` |
| i18n 리소스는 ko/en **2파일 + 위생 테스트**. 새 키는 양쪽 다 채워야 한다 | `renderer/src/shared/i18n/resources/{ko,en}.ts` · `resources.test.ts` |
| `@atlassian-dc-mcp/confluence@0.29.0` 노출 도구 **6개 전수**: `confluence_getContent`·`searchContent`·`createContent`·`updateContent`·`downloadAttachment`(항상)·`searchSpace` + opt-in `uploadAttachment`. 쓰기 2개 기본 포함, 인증은 env token 1개 | `build/index.js:25-121` · `build/config.js:2-12` |
| Confluence DC 첨부 REST 경로: 목록 `GET /rest/api/content/{id}/child/attachment`, 바이트 `GET /rest/api/content/{id}/child/attachment/{attachmentId}/data` | `@atlassian-dc-mcp/confluence@0.29.0` `build/confluence-client/services/AttachmentsService.js` (자동생성 OpenAPI 클라이언트) |
| 첨부 다운로드는 XSRF 보호 대상 — 참조 구현이 `X-Atlassian-Token: nocheck` 를 붙이고, 크기 상한 검사(`content-length` + 스트림 누적)와 `flag:'wx'`(덮어쓰기 금지)를 함께 쓴다 | `@atlassian-dc-mcp/common@0.29.0` `build/attachment-download.js:20-41,54-59,64-71,80-82` |
| 신규 후보 패키지 실측 버전·라이선스: cheerio **1.2.0** MIT · turndown **7.2.4** MIT · turndown-plugin-gfm **1.0.2** MIT · @types/turndown **5.0.6** MIT · p-limit 7.3.1 MIT(**미채택**) | `npm view <pkg> version license` (2026-08-03) |

## 인수 기준 (Acceptance Criteria)

| # | 인수 기준 | 검증 수단 (`파일::케이스` 또는 "사람 실기 — 실행 경로") | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | `AuthenticatedFetchRequest.responseType:'binary'` 요청은 `bodyBytes`(`Uint8Array`)를 채워 반환하고, `'text'` 또는 **미지정** 요청은 기존대로 `body` 문자열만 채운다 | `infra/auth/authenticated-fetch.test.ts::"binary 요청은 bodyBytes 를 채운다"` · `::"미지정 responseType 은 text 로 동작한다"` | connector `invoke` → `AuthBroker.authenticatedFetch` → `createSender().send` |
| 2 | `maxBytes` 를 넘는 응답은 본문을 버리고 오류로 끝난다 — `content-length` 선언값과 실제 누적 바이트 **둘 다** 검사한다 | `infra/auth/authenticated-fetch.test.ts::"선언 길이 초과를 거부한다"` · `::"선언 없이 초과 누적되면 중단한다"` | `ConfluenceConnector.invoke` → `authenticatedFetch({maxBytes})` |
| 3 | 3xx 응답의 `Location` 이 connector 의 `baseUrl` origin 안이면 최대 5홉까지 추종해 최종 본문을 반환한다 | `auth-platform/broker.test.ts::"허용 origin 내 redirect 를 추종한다"` | `AuthBroker.authenticatedFetch` → `checkRedirect` (이번 변경으로 프로덕션 호출자 0 → 1) |
| 4 | `Location` 이 허용 origin 밖이거나 홉 상한을 넘으면 요청이 오류로 끝나고, credential 이 그 origin 으로 전송되지 않는다(전송자 호출 횟수로 확인) | `auth-platform/broker.test.ts::"허용 밖 redirect 를 거부한다"` · `::"홉 상한 초과를 오류로 끝낸다"` | `AuthBroker.authenticatedFetch` redirect 루프 |
| 5 | connector 가 `presentations` 를 선언하면 broker 는 **binding 의 mechanism** 으로 표현을 고르고, 선언에 없는 mechanism 은 기존 `presentation` 으로 되돌아간다 | `auth-platform/broker.test.ts::"mechanism 별 presentation 을 선택한다"` · `::"미선언 mechanism 은 기본 presentation 을 쓴다"` | `AuthBroker.authenticatedFetch` → `applyPresentation` |
| 6 | `scheme:'BasicPair'` 는 저장된 secret 을 그대로 base64 하고(`user:pass` → `Basic dXNlcjpwYXNz`), 기존 `'Basic'` 은 빈 사용자명 형식(`base64(":"+secret)`)을 유지한다 | `infra/auth/authenticated-fetch.test.ts::"BasicPair 는 secret 전체를 base64 한다"` · `::"Basic 은 빈 사용자명 형식을 유지한다"` | connector `presentations` 선언 → `applyPresentation` |
| 7 | registry 는 manifest 의 `presentations` 선언과 구현 descriptor 를 대조하고, 한쪽만 있거나 값이 다르면 패키지 전체를 거부한다 | `auth-platform/registry.test.ts::"presentations 를 선언·구현 대조한다"` · `::"presentations 불일치 패키지를 거부한다"` | `Bootstrap.createAuthPlatform` → `AuthRegistry.register` |
| 8 | `presentations` 를 선언하지 않은 기존 패키지(`__fixtures__`)는 **무변경으로** 등록·연결·도구 노출을 통과한다 | `__fixtures__/fixture-package.test.ts`(기존 케이스 전부 통과) · `auth-platform/registry.test.ts::"presentations 미선언 패키지를 그대로 받는다"` | `AUTH_PLUGIN_PACKAGES` → `AuthRegistry.register` |
| 9 | id/pw provider 는 `username`·`password` **2필드**를 요구하고, 두 값을 `user:pass` 로 합쳐 `kind:'basic'` 으로 vault 에 봉인하며 반환 step 에는 원문 값이 없다 | `auth-platform/providers/basic-credential.test.ts::"두 필드를 받아 basic credential 을 봉인한다"` · `::"빈 사용자명·빈 비밀번호를 거부한다"` · `::"done step 에 원문 값이 없다"` | `authBegin(providerId)` → provider `begin/continue` → `BindingStore.create` |
| 10 | 사용자명에 `:` 가 들어와도 첫 `:` 만 구분자가 되도록 저장·검증되어 서버가 받는 사용자명이 입력값과 같다 | `auth-platform/providers/basic-credential.test.ts::"사용자명의 콜론을 거부한다"` | provider `continue` 입력 검증 |
| 11 | Confluence 패키지의 **두 인증 provider(PAT·Basic)가 하나의 connector** 의 `acceptedAuthProviders` 에 함께 들어가고, 어느 쪽 binding 으로도 연결이 성립한다 | `modules/confluence/confluence-package.test.ts::"PAT binding 으로 연결한다"` · `::"basic binding 으로 연결한다"` | `AUTH_PLUGIN_PACKAGES` → `AuthRegistry.register` → `PluginHost.connect` |
| 12 | 같은 factory 를 서로 다른 `id`·`baseUrl` 로 두 번 호출하면 서로 다른 정적 connector 두 개가 만들어지고, 각자의 도구 서버 ID 가 구분되며 core 파일 변경 없이 등록된다 | `modules/confluence/confluence-package.test.ts::"factory 로 서버 두 개를 등록한다"` · `__fixtures__/isolation.test.ts`(기존 케이스 유지) | `modules/confluence/servers.ts` → `modules/index.ts` 배열 한 줄 |
| 13 | Confluence connector 의 `start()` 는 `GET <apiBasePath>/rest/api/user/current` 로 자격증명을 실검증해 200 이면 `ready`, 401/403 이면 `unauthenticated`, 그 외/네트워크 오류는 `unreachable` 을 반환하고 사용자에게 보일 `message` 를 담는다 | `modules/confluence/connector.test.ts::"start 가 상태 코드별 health 와 message 를 낸다"` | `PluginHost.connect` → `ConnectorHost.start` → `ConfluenceConnector.start` |
| 14 | 컨텍스트 경로가 설정된 connector 의 모든 요청 경로가 그 prefix 로 시작하고, prefix 가 빈 문자열이면 `/rest/api/...` 로 시작한다 | `modules/confluence/rest.test.ts::"컨텍스트 경로 prefix 를 모든 경로에 붙인다"` · `::"prefix 가 없으면 rest 경로로 시작한다"` | `ConfluenceConnector.invoke` → `rest.ts` 요청 빌더 |
| 15 | CQL 검색 operation 은 사용자 입력을 CQL 문자열에 그대로 잇지 않고 인용부호·역슬래시를 이스케이프한 뒤 `GET /rest/api/content/search` 의 query 로 보낸다 | `modules/confluence/rest.test.ts::"CQL 리터럴을 이스케이프한다"` · `::"검색 요청 경로와 쿼리를 만든다"` | 도구 `confluence_search` → `ctx.invoke('search')` → `ConfluenceConnector.invoke` |
| 16 | `storage` XHTML → Markdown 변환은 cheerio `xmlMode:true` 로 파싱하고, `ac:image`/`ri:attachment` 를 상대 경로 `<img>` 로, code 매크로를 언어 코드펜스로 바꾼 뒤 turndown+gfm 으로 변환해 **표를 GFM 표로** 낸다 | `modules/confluence/storage-to-markdown.test.ts::"ac:image 를 assets 상대 경로 img 로 바꾼다"` · `::"code 매크로를 언어 코드펜스로 변환한다"` · `::"표를 GFM 표로 변환한다"` | 도구 `confluence_get_page` → `ConfluenceConnector.invoke('page')` → `storageToMarkdown` |
| 17 | 미지원 매크로는 매크로 이름이 보이는 블록으로 남고 그 이름이 `unhandledMacros` 에 집계된다 | `modules/confluence/storage-to-markdown.test.ts::"미지원 매크로를 이름이 보이는 블록으로 남긴다"` · `::"미지원 매크로 이름을 집계한다"` | `confluence_get_page` → `manifest.json` |
| 18 | 변환기는 본문이 참조하는 첨부 파일 이름 집합을 함께 반환하고, 그 집합만 다운로드 대상이 된다 | `modules/confluence/storage-to-markdown.test.ts::"참조된 첨부 이름을 수집한다"` · `modules/confluence/connector.test.ts::"참조된 첨부만 내려받는다"` | `confluence_get_page` → `ConfluenceConnector.invoke('page')` |
| 19 | 첨부 다운로드 요청에는 `X-Atlassian-Token: nocheck` 헤더가 실리고, 예약 헤더(`Authorization`·`Cookie`)는 실리지 않는다 | `modules/confluence/rest.test.ts::"첨부 다운로드 요청에 XSRF 우회 헤더를 넣는다"` · `::"예약 헤더를 직접 설정하지 않는다"` | `confluence_get_page`/`confluence_download_attachments` → `authenticatedFetch` |
| 20 | 저장 파일명은 경로 구분자·`..`·제어문자를 제거한 뒤 다운로드 루트 하위로만 해석되고, 루트를 벗어나는 이름은 거부되며 중복 이름에는 접미사가 붙는다 | `modules/confluence/download-store.test.ts::"경로 이탈 파일명을 거부한다"` · `::"제어문자·구분자를 치환한다"` · `::"중복 이름에 접미사를 붙인다"` | `ConfluenceConnector.invoke('page')` → `saveAsset` |
| 21 | 동시 다운로드 수가 선언한 상한을 넘지 않는다 — 상한 4로 10건을 요청하면 관측된 최대 동시 실행이 4이고, 하나가 실패해도 나머지가 완료된다 | `modules/confluence/limit.test.ts::"동시 실행이 상한을 넘지 않는다"` · `::"하나가 실패해도 나머지가 진행된다"` | `ConfluenceConnector.invoke('page')` → `limit(4)` |
| 22 | 페이지 도구는 `page.md`·`assets/<파일>`·`manifest.json` 을 `~/.config/orca/downloads/confluence/<connectorId>/<pageId>/` 아래 쓰고, 도구 결과에 저장 경로·자산 목록·잘림 여부와 **상한 이내로 잘린 Markdown 미리보기**를 담는다 | `modules/confluence/tools.test.ts::"저장 경로와 잘린 미리보기를 반환한다"` · `infra/config/paths.test.ts::"downloadsDir 는 orcaConfigDir 하위다"` | `confluence_get_page` handler → `RuntimeToolResult` → Claude SDK |
| 23 | 모든 Confluence 도구 handler 는 `RuntimeToolResult`(`content` 필수)를 반환하고, connector 실패·연결 취소는 `isError:true` 로 실린다 | `modules/confluence/tools.test.ts::"connector 실패를 isError 로 옮긴다"` · `::"모든 handler 가 content 를 채운다"` | 도구 handler → `createSdkMcpServer` 경계 |
| 24 | `confluence_search` 는 `readOnlyHint:true` 로 자동 허용되고, 로컬에 파일을 쓰는 `confluence_get_page`·`confluence_download_attachments` 는 `readOnlyHint:false` 로 완전 이름(`mcp__<serverId>__<tool>`)이 승인 대상 집합에 들어간다 | `adapters/runtime-tool-policy.test.ts::"confluence 도구의 승인 대상 분류"` · `modules/confluence/confluence-package.test.ts::"쓰기 도구를 readOnlyHint:false 로 선언한다"` | runtime snapshot → `runtimeApprovalToolNames` → `makeCanUseTool` |
| 25 | renderer 가 `pluginApi.connect`·`pluginApi.disconnect` 를 통해 preload bridge 를 호출한다 — 카탈로그의 연결/연결 해제 버튼이 이 두 함수를 부른다 | `renderer/features/skills/lib/connectorConnect.test.ts::"연결 액션이 pluginApi 를 호출한다"`(주입된 api 더블로 확인) | `PluginDetail` 버튼 → `useConnectorConnect` → `pluginApi.connect` → `CHANNELS.pluginConnectionConnect` |
| 26 | 연결 모달의 순수 로직은 `acceptedAuthProviders` 와 등록 provider 를 교차해 선택 가능한 인증 방식 목록(PAT·ID/비밀번호)을 만들고, 교집합이 비면 연결 불가 사유를 낸다 | `renderer/features/skills/lib/connectorConnect.test.ts::"수용 provider 교집합으로 방식 목록을 만든다"` · `::"교집합이 비면 연결 불가를 낸다"` | `ConnectorConnectModal` → `buildConnectOptions` |
| 27 | 모달은 connector 의 서버 주소를 **읽기 전용으로 표시**하고 주소 입력 필드를 두지 않으며, 자격증명 필드는 `AuthStepInfo.fields` 선언에서 렌더링된다 | `renderer/features/skills/lib/connectorConnect.test.ts::"주소는 표시값이고 입력 필드가 아니다"`(모달 props 계약) · **사람 실기**(AC29) | `PluginConnectorInfo.origin` → 모달 표시 |
| 28 | 연결 실패 시 모달이 실패 사유를 보여준다 — 자격증명 거부(`unauthenticated`)·서버 도달 불가(`unreachable`)·이미 연결됨을 구분한다 | `renderer/features/skills/lib/connectorConnect.test.ts::"connect reject 메시지를 사유로 분류한다"` | `PluginHost.connect` throw → IPC reject → `useConnectorConnect` |
| 29 | 사용자가 플러그인 카탈로그에서 Confluence connector 를 골라 PAT(또는 ID/비밀번호)를 넣으면 연결 상태가 "연결됨" 으로 바뀌고, 새 대화에서 `confluence_search` 가 노출된다 | **사람 실기** — 전제: `modules/confluence/servers.ts` 에 사내 origin 을 적고 `modules/index.ts` 배열에 한 줄 추가. 이후 `cd app && npm run dev` → 사이드바 플러그인 → Confluence 카드 → 연결 → PAT 입력 → 카탈로그 상태 확인 → 새 세션에서 검색 도구 호출 | `ExtensionsCatalogView` → `ConnectorConnectModal` → `plugins.connect` → 다음 턴 respawn → SDK `mcpServers` |
| 30 | 두 인증 방식 각각으로 실제 사내 서버에 연결해 페이지 1건의 `page.md` + 첨부가 저장된다 | **사람 실기** — AC29 의 연결 후 대화에서 `confluence_get_page` 실행 → 승인 → `~/.config/orca/downloads/confluence/<connectorId>/<pageId>/` 확인. PAT 1회 + ID/비밀번호 1회 | `confluence_get_page` → `ConfluenceConnector.invoke` → `downloadsDir()` |
| 31 | lint 0 error, typecheck 3분할 0, 수집된 vitest 전체 pass, DB migration diff 0, IPC 채널 수 82 유지. 신규 의존성은 `cheerio`·`turndown`·`turndown-plugin-gfm`·`@types/turndown` **4개뿐**이고 `p-limit` 은 포함되지 않는다 | `npm run lint` · `npm run typecheck` · `npm test` · `shared/ipc-documentation.test.ts`(기존) · `git diff package.json package-lock.json` 검토 | 저장소 전체 |

> better-sqlite3 ABI 관련 DB 로드 스위트 실패는 `app/AGENTS.md` 의 알려진 egress 베이스라인이며 코드 회귀와 분리해 보고한다.

## 범위 / 비범위

- **범위**:
  - `authenticatedFetch` 의 바이너리 응답(`responseType`/`bodyBytes`)·크기 상한(`maxBytes`)·허용 origin 내 redirect 추종
  - `ConnectorDescriptor.presentations`(mechanism 별 표현) + manifest 스키마 + registry 대조
  - `BasicPair` header scheme
  - id/pw 2필드 auth provider
  - Confluence DC 플러그인 패키지 — 서버 목록 factory(코드 레벨 `baseUrl`·컨텍스트 경로), connector(검증·검색·페이지·첨부 목록·바이너리 다운로드), storage→Markdown 변환(cheerio+turndown+gfm), 다운로드 저장소, 동시성 상한, 도구 3종
  - 다운로드 루트 `downloadsDir()` 헬퍼
  - renderer 연결 모달(인증 방식 선택 + 자격증명 입력, 주소는 읽기 전용 표시) + 카탈로그 연결/연결 해제 + `pluginApi.connect/disconnect` + i18n(ko/en)
  - 문서 갱신: `modules/AGENTS.md`(Confluence 모듈 활성화 절차) · 신규 `modules/confluence/AGENTS.md`
- **비범위**:
  - Confluence **쓰기**(페이지 생성/수정·첨부 업로드) 도구
  - Confluence Cloud(`/wiki/rest/api`, email+API token)
  - connection·binding 의 SQLite 영속화와 부팅 복원
  - 공간(space) 트리 전체 크롤·재귀 다운로드·증분 동기화
  - Jira 등 다른 Atlassian 제품 connector
  - 첨부 OCR·PDF 텍스트 추출 등 2차 가공
  - 사용자 UI 에서 서버 주소·connector 를 만들거나 바꾸는 기능(**사용자 정정으로 확정된 비범위**)
  - IPC 채널·스키마 변경(이번 설계에서 필요 없어짐)

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| 연결/binding 영속화 | **아니오.** binding 이 이미 비영속이라(`bindings.ts:12-13`) 재시작 후 재인증은 **현행 동작**이다. 영속화 시 키는 정적 `connectorId` 를 그대로 쓰므로 공개 이름 변경이 없다 |
| Confluence Cloud | **아니오.** 별도 connector ID(`confluence-cloud-*`)와 별도 provider 로 추가하는 additive 작업이다. 도구 이름 충돌 없음 |
| 쓰기 도구 | **아니오.** 같은 패키지에 contribution 을 추가하는 additive 작업이고, 승인 정책은 이미 `readOnlyHint:false` 를 승인 대상으로 처리한다 |
| 공간 전체 크롤 | **아니오.** 이번 페이지 단위 도구를 반복 호출하는 상위 오케스트레이션이라 계약 변경이 없다 |
| 다중 서버 등록 | **아니오.** factory 가 이번에 들어가므로(AC12) 서버 추가는 `servers.ts` 한 항목이다 |
| **도구 이름·connector ID·다운로드 디렉터리 레이아웃·`BasicPair` scheme 이름** | **예 — 일방향이다.** 도구 이름은 대화 기록·승인 키에, 다운로드 경로는 사용자 파일 시스템에, scheme 이름은 모듈 저자용 공개 manifest 계약에 남는다. 그래서 **미루지 않고 이번에 확정**한다 — connector `confluence-dc`(+서버별 suffix), 도구 `confluence_search`·`confluence_get_page`·`confluence_download_attachments`, 저장 루트 `~/.config/orca/downloads/confluence/<connectorId>/<pageId>/` |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 채택분 재사용: `@anthropic-ai/claude-agent-sdk@0.3.220`(`createSdkMcpServer`·`tool`·`Options.mcpServers`, 0158 배관 그대로) · `zod`(도구 입력 스키마) · `node:fs/promises`·`node:path`(내장) · 전역 `fetch`(내장, `createSender` 안에서만).
- **신규 의존성 4개 — 사용자 승인 완료(2026-08-03)**: `cheerio@^1.2.0` · `turndown@^7.2.4` · `turndown-plugin-gfm@^1.0.2` · `@types/turndown@^5.0.6`(dev). 전부 MIT. `p-limit` 은 **미채택** — 20줄 세마포어로 대체한다(사용자 결정).
- 전제:
  - 대상은 **Confluence Data Center / Server**. REST 는 `/rest/api/*`, PAT 는 `Authorization: Bearer`, ID/비밀번호는 `Authorization: Basic base64(user:pass)`.
  - 서버 주소는 **코드 레벨**에서 온다(사용자 정정). 컨텍스트 경로가 붙은 배포(`https://host/confluence`)는 manifest `baseUrl` 이 `https://host`, 컨텍스트 경로는 factory 설정으로 받아 connector 가 요청 path 에 붙인다 — `checkRequestPath` 가 상대 경로 prefix 를 허용하므로 **계약 변경이 필요 없다**(`policy.ts:39-44`).
  - 신규 설치의 `AUTH_PLUGIN_PACKAGES` 는 **빈 배열을 유지**한다. 사내 배포는 `servers.ts` 에 origin 을 적고 배열에 한 줄을 추가해 활성화한다(`modules/AGENTS.md` §활성화 절차).
  - `turndown` 은 cheerio 로 정규화한 **HTML 문자열**을 입력으로 받는다(별도 DOM 구현 미도입).
  - 에이전트 실행 환경에서 실제 사내 서버 검증은 불가하다(AC29·30 이 사람 실기인 이유).

## 설계

### 데이터 흐름

```text
빌드 타임 package (modules/confluence/)
  servers.ts               ─ 코드 레벨 서버 목록 [{id, label, baseUrl, apiBasePath}]
  createConfluencePackage() ─ 서버마다 connector + runtime tool contribution 생성
  manifest                  ─ authProviders: confluence-pat · confluence-basic
                              connectors:   confluence-dc-<서버>  (baseUrl 고정)
                              runtimeTools: confluence-dc-<서버>-tools
             │
             ▼ AuthRegistry.register — 선언/구현 전 필드 대조 (presentations 포함)

renderer  ConnectorConnectModal
  1. 서버 주소 = 읽기 전용 표시(PluginConnectorInfo.origin)
  2. 인증 방식 선택 — PAT / ID·비밀번호  (acceptedAuthProviders ∩ 등록 provider)
  3. 자격증명 입력 — AuthStepInfo.fields 제네릭 렌더링
             │
             ▼ auth.begin(providerId, {kind:'connector', connectorId, connectionId: uuid})
               auth.continueAuth(txId, fields)  →  done binding
             │
             ▼ plugins.connect({connectorId, bindingId})        ← 기존 IPC 그대로
                         │
                         ▼ PluginHost.connect  (0158 로직 무변경)
   ① binding 존재·valid·target 일치·provider 수용
   ② connector 당 활성 연결 1개
   ③ ConnectorHost.connect → ConfluenceConnector.start
        → GET <apiBasePath>/rest/api/user/current → ready | unauthenticated | unreachable
   ④ tool factory 실행 → RuntimeToolRegistry.add (정적 server ID)
                         │
                         ▼ ExtensionBuilder snapshot → Claude mcpServers + 승인 정책

도구 호출 → ctx.invoke(op, params) → ConnectorHost.invoke → ConfluenceConnector.invoke
        → authenticatedFetch({connectorId, bindingId, path, responseType, maxBytes})
        → AuthBroker: policy → presentations[binding.mechanism] → sender
        → 3xx 면 checkRedirect 로 재검사 후 최대 5홉 추종
```

### 계약 확장 — 4건, 전부 additive-optional (ABI 정책 준수)

`contracts/connector-plugin.ts`:

```ts
export interface ConnectorDescriptor {
  // …기존 필드 전부 유지 (baseUrl 은 manifest 고정 그대로)…
  presentation: CredentialPresentation                       // 기본 표현(호환 유지)
  presentations?: Partial<Record<AuthMechanism, CredentialPresentation>>
}

export interface AuthenticatedFetchRequest {
  // …기존 필드 유지…
  responseType?: 'text' | 'binary'      // 미지정 = 'text' (현행 동작)
  maxBytes?: number                     // 미지정 = 상한 없음(현행 동작)
}

export interface AuthenticatedFetchResponse {
  status: number
  headers: Record<string, string>
  body: string                          // binary 응답에서는 ''
  bodyBytes?: Uint8Array                // responseType='binary' 일 때만
}
```

`shared/ipc.ts` + `auth-platform/manifest.ts` — header scheme 에 `'BasicPair'` 추가:

```ts
scheme?: 'Bearer' | 'Basic' | 'BasicPair' | 'Token' | 'Raw'
```

**IPC 스키마 변경은 0건이다.** `PluginConnectionConnectRequest`(`{connectorId, bindingId}`)와 `PluginConnectorInfo`(`origin` 포함 6필드)가 이미 이번 UI 가 필요한 것을 전부 담고 있다(`shared/ipc.ts:286-298`). 채널 수 82 도 그대로다.

**미지정 3상태 처리(P6)**: `responseType` 미지정 → `'text'`, `maxBytes` 미지정 → 상한 없음, `presentations` 미선언 mechanism → 기존 `presentation`. 셋 다 **현행 동작 보존** 방향이라 `__fixtures__` 패키지가 무변경으로 통과한다(AC8 이 이를 고정한다).

### redirect 추종 — 지금까지 죽어 있던 검사를 켠다

`checkRedirect`(`policy.ts:101-105`)는 구현·테스트만 있고 호출자가 없다. broker 의 `authenticatedFetch` 에 추종 루프를 넣어 프로덕션 경로로 만든다.

- 상한 5홉. 초과는 **오류**(성공으로 접지 않는다).
- 매 홉의 `Location` 을 `checkRedirect(location, [connector.descriptor.baseUrl])` 로 재검사한다. 허용 밖이면 오류이며 **그 origin 으로는 요청 자체를 보내지 않는다**(AC4 가 전송자 호출 횟수로 확인).
- presentation 은 같은 origin 안에서만 재적용한다(허용 밖은 애초에 진행하지 않으므로 credential 이 다른 host 로 새지 않는다).

### 제약 필드의 강제 지점 (누가·언제)

| 제약 | 강제 지점 | 시점 |
|---|---|---|
| binding 이 이 connector 것이며 유효한가 | `PluginHost.requireValidBinding` (기존) | connector 코드 호출 **전** |
| provider 가 `acceptedAuthProviders` 에 있는가 | `PluginHost.requireValidBinding` (기존) | connector 코드 호출 **전** |
| 요청 path 가 상대 경로인가 · 예약 헤더가 없는가 | `checkOutboundRequest` (기존) | 매 요청 |
| 요청 URL 이 `baseUrl` origin 안인가 | `checkOutboundRequest` (기존) | 매 요청 |
| redirect Location 이 origin 안인가 | `checkRedirect` (**이번에 배선**) | 매 홉 |
| 응답 크기 | `createSender` (`content-length` + 누적, **이번에 추가**) | 수신 중 |
| 표현이 binding mechanism 과 맞는가 | `AuthBroker.authenticatedFetch` (**이번에 추가**) | 매 요청 |
| manifest 선언과 구현 descriptor 일치 | `AuthRegistry.validate` (기존 + `presentations` 확장) | 등록 시 |
| 저장 경로가 다운로드 루트 안인가 | `download-store.ts` `resolveAssetPath` (**신규**) | 파일 쓰기 전 |

### Confluence 패키지 모듈 구성

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `features/auth-platform/providers/basic-credential.ts` | id/pw 2필드 수집 → `user:pass` 봉인 | features (auth-platform) | 순수 단위 — `AuthPluginContext` fake(vault/clock) 주입 |
| `features/auth-platform/modules/confluence/servers.ts` | **코드 레벨 서버 목록**(id·label·baseUrl·apiBasePath). 사내 배포가 편집하는 유일한 파일 | features (module) | 형태 단위 테스트(중복 id 없음·origin 형태) |
| `features/auth-platform/modules/confluence/rest.ts` | 요청 서술자 빌더 — 컨텍스트 경로 prefix·CQL 이스케이프·XSRF 헤더·첨부 경로 | features (module) | **순수 단위** — 입력→`AuthenticatedFetchRequest` 비교, 네트워크 0 |
| `features/auth-platform/modules/confluence/storage-to-markdown.ts` | cheerio(xmlMode) 정규화 + turndown+gfm 변환 + 참조 첨부·미지원 매크로 수집 | features (module) | **순수 단위** — 문자열 in/out, fs·network 0 |
| `features/auth-platform/modules/confluence/limit.ts` | 동시성 세마포어(p-limit 대체) | features (module) | **순수 단위** — 최대 동시 실행 관측 |
| `features/auth-platform/modules/confluence/download-store.ts` | 파일명 위생·경로 이탈 차단(순수) + `mkdir`/`writeFile`(I/O) | features (module) | 순수부 `sanitizeAssetName`·`resolveAssetPath` 단위 + I/O 부는 tmpdir 통합 |
| `features/auth-platform/modules/confluence/connector.ts` | `ConnectorRuntimeV1` — start/invoke(`verify`·`search`·`page`·`attachments`)/stop | features (module) | `AuthenticatedFetch` fake 주입 단위 테스트(네트워크 0) |
| `features/auth-platform/modules/confluence/tools.ts` | `RuntimeToolContribution` — 3도구 descriptor + handler(`RuntimeToolResult` 변환) | features (module) | `PluginToolContext` fake 단위 테스트 |
| `features/auth-platform/modules/confluence/index.ts` | `createConfluencePackage(servers)` — manifest + `AuthPluginPackage` | features (module) | 등록 위생 통합 테스트(`AuthRegistry.register`) |
| `features/auth-platform/modules/confluence/AGENTS.md` + `CLAUDE.md` | 서버 추가 절차·규칙 문서 | 문서 | — |
| `renderer/features/skills/lib/connectorConnect.ts` | 인증 방식 목록 계산·연결 액션 오케스트레이션(주입 api)·실패 사유 분류 | renderer features | **순수 단위** — React 비의존, api 더블 주입 |
| `renderer/features/skills/hooks/useConnectorConnect.ts` | 진행 상태(idle/collecting/inflight/error) | renderer features | 로직은 위 lib 에서 테스트, 훅은 typecheck |
| `renderer/features/skills/components/customize/ConnectorConnectModal.tsx` | 모달 UI | renderer features | 시각 = 사람 실기(AC29) |

`infra/config/paths.ts` 에 `downloadsDir()`(= `~/.config/orca/downloads`) 를 추가한다. 이 루트는 `workspace-guard.ts:35-45` 의 `readOnlyExceptionRoots()` 가 이미 포함하는 `orcaConfigDir()` 하위이므로 **모델이 `Read`/`Grep` 으로 결과물을 읽을 수 있다** — 도구가 경로만 반환해도 이어지는 작업이 성립한다.

`PluginToolContext` 는 세션 cwd 를 모르지만(4 capability), 파일은 **connector 가** 위 고정 루트에 쓰므로 컨텍스트 확장이 필요 없다.

### 서버 등록 — 코드 레벨 (사용자 정정 반영)

```ts
// modules/confluence/servers.ts  — 사내 배포가 편집하는 유일한 파일
export const CONFLUENCE_SERVERS = [
  { id: 'confluence-dc', label: 'Confluence', baseUrl: 'https://confluence.corp', apiBasePath: '' }
] as const

// modules/index.ts — 활성화 한 줄
export const AUTH_PLUGIN_PACKAGES = [createConfluencePackage(CONFLUENCE_SERVERS)]
```

서버가 늘면 `servers.ts` 에 항목 하나를 더한다. connector ID·도구 서버 ID·도구 이름은 항목의 `id` 에서 파생되므로 core 파일은 손대지 않는다(AC12). 저장소 기본값은 `AUTH_PLUGIN_PACKAGES = []` 를 유지한다 — placeholder origin 을 기본 등록하면 모든 사용자에게 깨진 카드가 보이기 때문이다(§요구 비판적 검토 이견 2).

### 두 인증 provider와 표현

```ts
// connector descriptor
acceptedAuthProviders: ['confluence-pat', 'confluence-basic'],
presentation:  { location: 'header', name: 'Authorization', scheme: 'Bearer' },   // 기본 = PAT
presentations: {
  personal_access_token: { location: 'header', name: 'Authorization', scheme: 'Bearer' },
  basic:                 { location: 'header', name: 'Authorization', scheme: 'BasicPair' }
}
```

- `confluence-pat` = `createStaticCredentialProvider({mechanism:'personal_access_token'})`, **`probeUrl` 없음**. 자격증명 검증은 connector `start()` 가 `authenticatedFetch` 로 한다 — provider `allowedOrigins` 를 서버마다 또 선언하지 않아도 되고, 검증이 실제 요청 경로와 같아진다(`static-credential.ts:148-157` 의 provider 직접 fetch 경로를 쓰지 않는다).
- `confluence-basic` = 신규 `createBasicCredentialProvider(...)`. 사용자명에 `:` 가 있으면 첫 `:` 가 구분자가 되어 서버가 다른 사용자명을 받으므로 **입력 단계에서 거부**한다(AC10).

### 도구 3종 (정적 descriptor = 정책 SSOT)

| 도구 | `readOnlyHint` | 입력 | 결과 |
|---|---|---|---|
| `confluence_search` | `true` | `{ cql?, text?, spaceKey?, limit? }` | 페이지 요약 목록(id·title·spaceKey·url) |
| `confluence_get_page` | `false` | `{ pageId, includeAttachments? }` | 저장 디렉터리·`page.md` 경로·자산 목록·잘림 여부 + 상한 이내 Markdown 미리보기 |
| `confluence_download_attachments` | `false` | `{ pageId, filenames? }` | 저장 디렉터리·자산 목록(파일명·크기·미디어타입) |

`readOnlyHint:false` 두 도구는 `runtimeApprovalToolNames` 가 `mcp__confluence-dc-tools__confluence_get_page` 형태의 완전 이름으로 승인 대상에 넣는다(`runtime-tool-policy.ts:12-14` 로직 그대로, 코드 변경 없음).

### 변환 규칙 (storage-to-markdown)

1. cheerio `load(html, { xmlMode: true })` — storage 는 XHTML 이라 HTML 파서로 읽으면 `ac:`/`ri:` 네임스페이스 태그가 깨진다.
2. **turndown 전 매크로 전처리**:
   - `ac:image` + `ri:attachment[ri:filename]` → `<img src="assets/<sanitized>" alt="…">`, 파일명을 참조 집합에 추가
   - `ac:image` + `ri:url[ri:value]` → 외부 URL `<img>` (다운로드하지 않음)
   - `ac:link` + `ri:page[ri:content-title]` → 제목 텍스트 링크
   - `ac:structured-macro[ac:name="code"]` → `<pre><code class="language-<ac:parameter[language]>">` (CDATA 본문)
   - `ac:structured-macro[ac:name="info|note|warning|tip"]` → `<blockquote>` + 라벨
   - 그 외 매크로 → 매크로 이름이 보이는 `<blockquote>` 폴백 + `unhandledMacros` 집계(조용히 사라지지 않게)
   - `ac:plain-text-body`/`ac:rich-text-body` 는 내용으로 펼침
3. turndown + `gfm` 플러그인(표·취소선·작업목록·자동링크).
4. 반환: `{ markdown, referencedAttachments: string[], unhandledMacros: string[] }`.

### TDD 구현 순서

1. **Task A — 계약(4건)**: 바이너리/`maxBytes` → redirect 추종 → `presentations` + registry 대조 → `BasicPair` → `basic-credential` provider (AC1~10)
2. **Task B — 플러그인**: `servers` → `rest` → `storage-to-markdown` → `limit` → `download-store` → `connector` → `tools` → `index` (AC11~24)
3. **Task C — UI/문서**: `connectorConnect` lib → 훅 → 모달 → 카탈로그 배선 → `pluginApi` 확장 → i18n → `modules/AGENTS.md`·`modules/confluence/AGENTS.md` (AC25~28)

각 단계는 RED(테스트 먼저) → GREEN 이며, 단계마다 `npm run lint && npm run typecheck` + 표적 vitest 를 돌린다.

## 기존 결정·규칙과의 관계

> 본문(§설계·§파생 UX·§범위)을 모두 쓴 뒤 본문을 훑으며 채웠다. r2 에서 본문이 크게 바뀌었으므로 표 전체를 다시 대조했다.

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **동적 endpoint 는 유예가 아니라 비채택 결정** | `0158/plan.md:138` | §범위 비범위 "사용자 UI 에서 서버 주소·connector 를 만들거나 바꾸는 기능" · §서버 등록 "코드 레벨" | **유지.** r1 의 반전을 r2 에서 철회했다(사용자 정정) |
| connector origin 은 manifest 고정, connect IPC 에 URL 표면 없음 | `0158/plan.md:316` · `connectors/registry.ts:7` 주석 · `modules/AGENTS.md` | §계약 확장 "IPC 스키마 변경은 0건이다" · §데이터 흐름 "서버 주소 = 읽기 전용 표시" | **유지.** 주석·문서 수정 없음 |
| 서버마다 별도 정적 connector · connector 당 활성 연결 1개 | `0158/plan.md:34-35` · `connectors/registry.ts:18-20` | §서버 등록 "서버가 늘면 `servers.ts` 에 항목 하나" · §데이터 흐름 ② | **유지.** factory 는 0158 의 `createJiraConnector` 선례와 같은 형태 |
| 안정적 도구 ID — 재인증해도 이름이 같다 | `0158/plan.md:318` | §도구 3종 정적 이름 · §범위 유예표 "이번에 확정" | **유지.** 도구 이름은 정적 descriptor 에서 온다 |
| runtime 동적 로딩 금지 — 빌드 타임 플러그인 | `contracts/auth-plugin.ts:7-12` | §Confluence 패키지 모듈 구성(전부 `modules/` 하위 빌드 타임 코드) | **유지** |
| ABI additive-optional-only | `contracts/auth-plugin.ts:14-18` | §계약 확장 "4건, 전부 additive-optional" | **유지.** 기존 멤버 제거·개명·required 화 0건. `body: string` 도 유지하고 `bodyBytes` 를 추가. `scheme` enum 은 멤버 **추가**만 |
| opt-in 배열 등록 — 활성화 지점 한 곳, 기본 빈 배열 | `modules/AGENTS.md` §활성화 절차 · `modules/index.ts:28` | §서버 등록 "저장소 기본값은 `AUTH_PLUGIN_PACKAGES = []` 를 유지한다" | **유지.** 활성화는 한 줄 |
| package 단위 all-or-nothing · 선언/구현 전 필드 대조 | `auth-platform/registry.ts:279-281` | AC7 "`presentations` 불일치는 등록 단계에서 거부" | **유지·확장.** 새 필드도 대조 대상에 넣는다 |
| connector 는 raw credential 을 보지 않는다 (AUTH-PLAT-009) | `contracts/connector-plugin.ts:3-7` · `features/connectors/runtime.ts:3-6` | §요구 비판적 검토 "REST 직접 호출 → broker 통과" · §데이터 흐름 "authenticatedFetch" | **유지·강화.** 바이너리도 broker 를 통과한다 |
| presentation 은 connector manifest 가 선언한다 (AUTH-PLAT-007) — kind 에서 추론하지 않는다 | `contracts/connector-plugin.ts:56-58` · `shared/ipc.ts:192` | §두 인증 provider와 표현 "`presentations`" | **유지·확장.** 여전히 connector 가 선언하며, 선택 축만 mechanism 으로 넓힌다. provider 가 형식을 정하지 않는다 |
| 예약 헤더(`authorization`·`cookie`) 직접 설정 금지 | `auth-platform/policy.ts:15,47-55` | AC19 "예약 헤더를 직접 설정하지 않는다" | **유지.** `X-Atlassian-Token` 만 넣는다 |
| 절대 URL path 금지 — baseUrl 우회 방지 | `auth-platform/policy.ts:39-44` | §전제 "컨텍스트 경로는 … 요청 path 에 붙인다" | **유지.** prefix 는 상대 경로라 통과하며 origin 우회가 아니다 |
| raw secret 반출 예외는 2곳뿐 (MCP `.mcp.json` · LLM `--settings`) | `docs/arch/backend/security.md §1.4-b` | §요구 비판적 검토 "그 경로는 … 문서화된 예외" | **유지.** 이번 내장 MCP 는 broker 안에 머무르므로 예외 표를 넓히지 않는다 |
| secret 은 vault 에만, 결과·로그·renderer 응답에 싣지 않는다 | `modules/AGENTS.md` · AUTH-PLAT-008 | AC9 "done step 에 원문 값이 없다" | **유지** |
| 도구 handler 는 `RuntimeToolResult` 를 반환한다 (0158 verify r1 D5) | `modules/AGENTS.md` · `adapters/runtime-tools.ts:26-45` | AC23 · §도구 3종 | **유지.** `toToolResult` 패턴을 fixture 에서 가져온다 |
| `readOnlyHint` 미지정/`false` 는 승인 대상 (fail-closed) | `adapters/runtime-tool-policy.ts:12-14` | AC24 · §요구 비판적 검토 이견 1 | **유지.** 정책 코드는 손대지 않고 선언만 정직하게 한다 |
| main DAG — feature 교차 import 금지 | `app/eslint.config.mjs` · `src/main/AGENTS.md` | §Confluence 패키지 모듈 구성(전부 `features/auth-platform` 내부 + `infra` 하향) | **유지.** 신규 구조적 포트가 필요 없어졌다(r1 의 `ConnectorOriginPort` 삭제) |
| 서비스 리터럴은 module 에 격리 | `src/main/AGENTS.md` 작업 규칙 · `__fixtures__/isolation.test.ts:8` | §Confluence 패키지 모듈 구성(전부 `modules/confluence/`) | **유지.** core 에 confluence 리터럴을 추가하지 않는다. 금지 리터럴 3개와 새 ID 는 충돌하지 않는다 |
| 새 의존성은 사용자 승인 필수 | `app/AGENTS.md` §의존성 정책 | §의존 기술 "신규 의존성 4개 — 사용자 승인 완료" | **유지** |
| IPC 변경 시 문서 동시 갱신 | `docs/AGENTS.md` · `docs/IPC_CONTRACT.md §6` | §계약 확장 "IPC 스키마 변경은 0건이다" | **해당 없음.** 채널·payload·DTO 모두 무변경이라 `IPC_CONTRACT.md` 수정이 필요 없다. AC31 이 82 유지를 고정한다 |
| i18n 위생 — ko/en 양쪽 채움 | `renderer/src/shared/i18n/resources/resources.test.ts` | §범위 "i18n(ko/en)" | **유지** |
| 모달 닫기는 Esc·백드롭 (X 아이콘 미배치) | 0121 사용자 결정 · `Modal.tsx:37` 주석 | §파생 UX "기존 `Modal` 토큰 재사용" | **유지** |
| `Plugin` 어휘 3레지스터 구분 | `docs/GLOSSARY.md:31` (2026-08-03 `rg` 로 표제어 존재 확인) | §Context "첫 실물 플러그인" = 레지스터 (C) 빌드 타임 패키지 | **유지.** 문맥을 (C)로 고정해 서술 |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **자격증명 거부**: `start()` 가 `unauthenticated` 를 반환해 연결이 롤백된다. binding 은 남지만 사용자에게는 "자격증명이 거부되었습니다" 로 보이고, 다시 입력하면 새 binding 이 이전 것을 대체한다(`BindingStore.create` 가 같은 target 의 기존 binding 을 교체 — `bindings.ts:56-59`).
- **서버 도달 불가**: `unreachable`. 주소는 코드 레벨이라 사용자가 고칠 수 없으므로, 모달 문구는 "관리자에게 문의" 방향으로 적고 표시 중인 origin 을 함께 보여준다.
- **이미 연결된 connector**: `PluginHost.connect` 가 `already connected` 로 throw 한다. 카탈로그는 연결됨 상태에서 연결 버튼 대신 연결 해제 버튼을 보여 애초에 도달하지 않게 하고, 경합으로 도달하면 사유를 그대로 표시한다.
- **인증 방식 전환**: PAT 로 연결한 뒤 ID/비밀번호로 다시 연결하려면 먼저 연결을 해제한다(connector 당 활성 연결 1개). 새 binding 의 mechanism 이 달라지면 `presentations` 가 자동으로 다른 표현을 고른다.
- **모달 중도 취소**: 진행 중이던 auth transaction 이 남아 `(providerId, target)` 당 1건 제한에 걸릴 수 있으므로, 모달은 열릴 때마다 새 `connectionId`(uuid)를 만든다.
- **첨부가 큰 경우**: `maxBytes` 를 넘으면 그 파일만 실패로 표시하고 나머지는 저장한다. `manifest.json` 에 실패 목록과 사유를 남긴다.
- **같은 페이지 재다운로드**: 같은 디렉터리에 다시 쓴다. `page.md` 는 덮어쓰고 자산은 이름 충돌 시 접미사를 붙여 원본을 보존한다.
- **매크로가 많은 페이지**: 미지원 매크로는 이름이 보이는 인용블록으로 남고 `unhandledMacros` 에 집계된다 — 조용한 내용 소실을 만들지 않는다.
- **연결 해제**: 0158 의 `disconnect` → `broker.logout` → `onBindingsEnded` 경로 그대로. 도구 서버가 사라지고 다음 턴에 respawn 된다. **이미 내려받은 파일은 지우지 않는다**(사용자 자료).
- **진행 중 턴에서 연결 해제**: `ctx.invoke` 가 던지고 SDK 가 `isError` 로 변환한다(0158 계약). 도구가 이를 성공으로 뒤집지 않는다.
- **앱 재시작**: binding·connection 이 사라져 재연결이 필요하다(현행 인증 동작 승계). 카탈로그는 "연결되지 않음" 으로 표시된다.
- **패키지 미등록(기본 설치)**: 카탈로그에 Confluence 카드가 없다. 이는 결함이 아니라 opt-in 규약의 결과이며 `modules/confluence/AGENTS.md` 가 활성화 절차를 안내한다.
- **테마/접근성**: 모달은 기존 `Modal`/`MODAL_INPUT`/`MODAL_LABEL` 토큰을 재사용하고, 비밀번호 필드는 `autoComplete="current-password"`, 사용자명은 `username` 으로 둔다(`AuthView.tsx:63` 선례).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 계약을 4곳(`descriptor.presentations`·fetch req/res·`scheme` enum) 동시에 넓힌다 | 전부 optional 추가이고 미지정 기본값이 **기존 동작과 동일**하다. `__fixtures__` 패키지가 무변경으로 통과하는 것을 AC8 로 고정한다 |
| redirect 추종을 새로 켠다 — 무한 루프·credential 재전송 위험 | 홉 상한 5, 매 홉 `checkRedirect` 재검사, 허용 밖이면 전송 자체를 하지 않음(AC4 가 전송자 호출 횟수로 확인). 상한 초과는 오류(성공으로 접지 않음) |
| 바이너리를 메모리에 통째로 든다 | `maxBytes` 상한을 두고 스트림 누적 중 초과 시 즉시 중단. 대용량 스트리밍 저장은 비범위로 남기고 상한 초과를 **정직한 실패**로 보고 |
| storage XHTML 변환은 매크로 종류만큼 불완전하다 | 폴백을 조용한 삭제가 아니라 **가시 블록 + `unhandledMacros` 집계**로 둔다. 완전성이 아니라 "무엇이 빠졌는지 알 수 있음" 이 목표다 |
| 서버 주소가 코드 레벨이라 배포마다 소스 편집이 필요하다 | 편집 지점을 `servers.ts` **한 파일**로 좁히고 `modules/AGENTS.md` 규약(활성화 한 줄)을 따른다. 사용자가 확정한 모델이며, 나중에 설정화하더라도 connector ID·도구 이름은 그대로 유지된다 |
| 기본 설치에서 기능이 보이지 않는다 | opt-in 배열 규약의 의도된 결과다. `modules/confluence/AGENTS.md` 와 사람 실기 AC 전제 단계에 활성화 절차를 명시한다 |
| cheerio + turndown 이 main 번들 크기를 늘린다 | 두 패키지 모두 main 프로세스 전용이고 renderer 번들에 들어가지 않는다 |
| `@atlassian-dc-mcp/confluence` 를 안 쓰기로 한 판단이 틀릴 수 있다 | 그 경로는 **여전히 열려 있다** — `sources/mcp/mcp.json` 에 등록하면 코드 0줄로 병행 사용 가능하다. 이번 구현은 그 경로를 막지 않는다 |
| AC29·30 은 사내 서버가 있어야 판정된다 | verify 는 기계 검증분(AC1~28·31)으로 판정하고, 두 항목은 **사람 실기 대기**로 분리 표기한다(0019·0102 선례) |

- **되돌리기 어려운 결정**: ① connector ID 규칙(`confluence-dc` + 서버별 suffix) ② 도구 이름 3종 ③ 다운로드 루트 레이아웃 ④ `BasicPair` scheme 이름. 모두 이번에 확정하고 §범위 유예표에 근거를 남겼다.
- **단독 결정 금지 항목(Open Question)** → 사용자에게: **없음**.

## 영향 받는 파일

**신규**

- `app/src/main/features/auth-platform/providers/basic-credential.ts` + `.test.ts`
- `app/src/main/features/auth-platform/modules/confluence/{index,servers,rest,storage-to-markdown,limit,download-store,connector,tools}.ts` + 각 `.test.ts` + `confluence-package.test.ts`
- `app/src/main/features/auth-platform/modules/confluence/{AGENTS.md,CLAUDE.md}`
- `app/src/renderer/src/features/skills/lib/connectorConnect.ts` + `.test.ts`
- `app/src/renderer/src/features/skills/hooks/useConnectorConnect.ts`
- `app/src/renderer/src/features/skills/components/customize/ConnectorConnectModal.tsx`

**수정**

- `app/src/main/contracts/connector-plugin.ts` (`presentations`·`responseType`·`maxBytes`·`bodyBytes`)
- `app/src/main/infra/auth/authenticated-fetch.ts` + `.test.ts` (바이너리·크기 상한·`BasicPair`)
- `app/src/main/infra/config/paths.ts` + `paths.test.ts` (`downloadsDir`)
- `app/src/main/features/auth-platform/{manifest,registry,broker}.ts` + 각 `.test.ts` (`presentations`·redirect 추종)
- `app/src/main/features/auth-platform/modules/{index.ts,AGENTS.md}`
- `app/src/shared/ipc.ts` (`scheme` enum 에 `BasicPair` 추가 — 채널·DTO 무변경)
- `app/src/renderer/src/shared/api/ipc.ts` (`pluginApi.connect`·`disconnect`)
- `app/src/renderer/src/features/skills/components/customize/{PluginDetail,ExtensionsCatalogView}.tsx`
- `app/src/renderer/src/shared/i18n/resources/{ko,en}.ts`
- `app/package.json` · `app/package-lock.json` (신규 의존성 4)
- `docs/handoff/INDEX.md` · `docs/PHASES.md`

> `docs/IPC_CONTRACT.md` 는 **수정하지 않는다** — 채널·payload·DTO 가 모두 그대로다.

## 참고 문서

- `docs/handoff/0157-auth-plugin-platform/plan.md` — 인증 플랫폼 계약
- `docs/handoff/0158-builtin-tool-plugin-host/plan.md` — 런타임 도구 계약·정적 connector 결정(이번에 **유지**)
- `docs/handoff/0159-plugins-page-catalog/plan.md` — 카탈로그 화면(연결 UI 를 여기 얹는다)
- `docs/etc/study/orca/auth-plugin-platform-requirements-ko.md §확장 모델` — 빌드 타임/런타임 확장 경계
- `docs/arch/backend/security.md §1.4-b` — raw secret 반출 예외 2곳(이번 작업은 이 표를 넓히지 않는다)
- `docs/arch/backend/provider-runtime.md §3` — 위험 도구 승인 게이트
- `app/src/main/AGENTS.md` · `app/src/main/features/auth-platform/modules/AGENTS.md`
- `@atlassian-dc-mcp/confluence@0.29.0` · `@atlassian-dc-mcp/common@0.29.0` (npm 실물 — REST 경로·XSRF 헤더·크기 상한 참조 구현)

## 게이트

- 단계별 표적 테스트: `cd app && ./node_modules/.bin/vitest run <changed-test-files>`
- 전체: `cd app && npm run lint && npm run typecheck && npm test`
- 위생: IPC 채널 총계 82 유지 · `__fixtures__` 스위트 무변경 통과 · core 의 confluence 리터럴은 `modules/confluence/` 와 `__fixtures__` 밖 0 · migration diff 0 · 신규 의존성 정확히 4개(p-limit 미포함)
- better-sqlite3 ABI 로 인한 DB 로드 스위트 실패는 명령·오류를 그대로 인용해 코드 실패와 분리 보고한다.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 4건 + 명시 정정 1건 + 결정 3건을 출처와 함께 인용했고, 추론은 추론으로 표기했다. r1 의 오독과 r2 정정을 §개정 이력에 남겼다.
- [x] 자료조사 — 26개 발견 전부에 `파일:라인` 또는 실행한 명령을 붙였다. 외부 패키지 주장은 `npm pack` 으로 실물을 받아 확인했다.
- [x] 의존 기술 — 신규 4개를 실측 버전·라이선스와 함께 적고 사용자 승인 기록을 남겼다. p-limit 배제도 결정으로 기록했다.
- [x] 파생 UX — 자격증명 거부·도달 불가·중복 연결·방식 전환·모달 취소·대용량 첨부·재다운로드·미지원 매크로·연결 해제·진행 중 턴·재시작·기본 미등록을 이 작업에 실제로 해당하는 것만 펼쳤다.
- [x] 리스크 — 계약 4곳 확장·redirect·메모리·변환 불완전성·코드 레벨 주소·기본 미노출·번들·판단 오류·사람 실기 의존을 적고 Open Question 0건을 확인했다.

**기계적으로 확인 가능한 것**

- [x] 요구 비판적 검토 표 7행(5질문 + 더 작은 해법 2행/인용 정정 2행)에 답했고, 요구 범위를 줄이지 않았다 — 두 인증 방식·내장 MCP·변환·다운로드·연결 UI 를 전부 범위에 넣었다.
- [x] 인수 기준 **31개** 모두 `검증 수단` 칸이 채워져 있다. 기계 검증 불가 2건(AC29·30)은 "**사람 실기**" 로 명시하고 전제 단계까지 적었다.
- [x] 부정형/"불변" 기준 0개 — 거부 기준(AC2·4·7·10·20)도 "오류로 끝난다"·"전송자 호출 횟수 0"·"패키지 전체를 거부한다" 같은 **양성 단언**으로 썼다. AC8 은 "무변경으로 통과한다" 는 **양성 통과 단언**이며 기존 스위트가 증인이다.
- [x] AC 간 모순을 pairwise 점검했다: AC5(mechanism 별 선택) ↔ AC8(미선언 패키지 통과)은 fallback 규칙으로 양립하고, AC1(binary) ↔ AC1 의 미지정 절은 같은 케이스의 두 분기이며, AC24(readOnly 분류) ↔ 요구서 "Read Only" 는 §요구 비판적 검토 이견 1에서 정정을 기록했다. AC29·30 의 전제(패키지 활성화)는 §요구 비판적 검토 이견 2·§서버 등록과 일치하며 자기 비범위에 막히지 않는다. AC31 의 의존성 목록이 §의존 기술과 일치한다.
- [x] 인용 수치를 이번 세션에서 직접 측정했다 — CHANNELS 82(`node -e` 계수), confluence 파일 5, turndown/cheerio 0, providers 2, `checkRedirect` 프로덕션 호출 0, `downloadsDir` 0, atlassian 도구 6, 금지 리터럴 3, npm 버전 5종. 0158 의 숫자를 승계하지 않았다.
- [x] 신규 모듈 13종 전부에 테스트 방법이 있고, I/O 의존 모듈은 순수부 seam 을 명시했다(`download-store` 의 `sanitizeAssetName`/`resolveAssetPath`, connector 의 `AuthenticatedFetch` fake 주입, 모달의 `connectorConnect` lib 분리 + api 더블 주입).
- [x] 전수 조사 수치가 있다: confluence 보유 파일 5 · turndown/cheerio 0 · provider 2 · `checkRedirect` 프로덕션 호출 0 · `downloadsDir` 0 · CHANNELS 82 · atlassian 패키지 도구 6 · 금지 리터럴 3 · 계약 확장 4.
- [x] 각 AC 에 프로덕션 도달 경로가 있다. 유일한 호출자가 테스트인 AC 0개 — AC3·4 의 `checkRedirect` 는 프로덕션 호출자를 0→1 로 만드는 것이 AC 자체의 요구이고, AC25 는 renderer 가 preload bridge 를 **실제로 부르게** 되는 것을 별도 AC 로 세웠다(0158 AC16 의 우회 실패 패턴 대응).
- [x] 사람 실기 AC 2건에 실행 경로와 **전제 단계**(`servers.ts` 편집 + 배열 한 줄)가 적혀 있고, 그 경로가 자기 비범위에 막혀 있지 않다 — 모듈·연결 IPC·모달·도구가 모두 범위 안이고 외부 자원(사내 서버)만 필요하다.
- [x] 선택적 필드로 판정하는 곳마다 미지정 케이스 AC 가 있다: `responseType` 미지정 → AC1 후반, `maxBytes` 미지정 → AC2 대비(상한 없음 = 현행), `presentations` 미선언 mechanism → AC5 후반, 패키지 전체 미선언 → AC8. 전부 현행 동작 보존/fail-closed 방향이다.
- [x] 소비하는 계약의 제약 필드마다 강제 지점(누가·언제)이 §제약 필드의 강제 지점 표에 9행으로 있다.
- [x] 참조 구현(`@atlassian-dc-mcp`)을 입력으로 썼고, 그 도구 **6개를 전수 나열**한 뒤 이번 범위(read 3종)와의 차이를 적었다. 계약 enum 전수도 확인했다 — `AuthMechanism` 8분기 중 이번 패키지가 쓰는 것은 `personal_access_token`·`basic` 2개이고 나머지는 `presentations` 미선언 fallback 으로 덮인다(AC5). `AuthStep` 6분기는 PluginHost 가 재구현하지 않고 기존 auth IPC 가 처리한다(0158 유지).
- [x] 미룬 항목 6건마다 일방향 여부에 답했고, 일방향인 이름·경로 4종은 **미루지 않고 이번에 확정**했다.
- [x] 관문 4 를 본문 완성 후 돌렸다 — §기존 결정 표 22행을 본문 문장과 짝지어 다시 채웠고(r2 에서 본문이 크게 바뀌어 전체 재대조), 코드 주석(`connectors/registry.ts:7`)·계약 헤더(`contracts/connector-plugin.ts:3-7`)·위생 테스트(`isolation.test.ts`·`resources.test.ts`)를 출처에 포함했으며, 인용 경로를 `Read`/`rg` 로 열어 확인했다. `[구현자 기입]`·`[검증자 기입]` 블록을 템플릿에서 그대로 유지했다.
- [x] "확정돼 있다"·"채택 결정이다" 로 쓴 것마다 앵커를 확인했다 — `docs/GLOSSARY.md` 의 `Plugin` 표제어는 31행에 존재(0159 등록), `docs/arch/backend/security.md §1.4-b` 는 44행, `docs/IPC_CONTRACT.md §6` 는 482행, `auth-plugin-platform-requirements-ko.md §확장 모델` 은 74행, `docs/arch/backend/provider-runtime.md §3` 은 91행에 각각 존재함을 `rg` 로 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (Codex=기능 / Claude=비기능). 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

### Task A — 계약 확장 4건

- [ ] `app/node_modules` 가 없으면 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 후 진행하고 lockfile diff 를 확인한다.
- [ ] RED: 바이너리 응답·`maxBytes`·redirect 추종/거부·`presentations` 선택 및 fallback·registry 대조·`BasicPair`·2필드 provider 테스트를 먼저 작성한다.
- [ ] 계약·스키마·`createSender`·broker·provider 를 최소 구현하고 표적 vitest + `npm run typecheck` 를 통과시킨다.
- [ ] `__fixtures__` 스위트가 **무변경으로** 통과하는지 확인한다(AC8).

### Task B — Confluence 패키지

- [ ] 신규 의존성 4개를 설치하고 `package.json` diff 가 dependencies 3 + devDependencies 1 인지 확인한다.
- [ ] RED→GREEN 순서로 `servers` → `rest` → `storage-to-markdown` → `limit` → `download-store` → `connector` → `tools` → `index` 를 구현한다.
- [ ] `isolation.test.ts` 가 여전히 통과하는지 확인한다(신규 ID 가 금지 리터럴 3개와 겹치지 않는다).
- [ ] `AUTH_PLUGIN_PACKAGES` 기본값은 **빈 배열로 유지**하고, 활성화 절차를 `modules/confluence/AGENTS.md` 에 적는다.

### Task C — UI · 문서

- [ ] `connectorConnect` lib 테스트(방식 목록·연결 액션·실패 분류·주소 읽기 전용 계약)를 먼저 작성한다.
- [ ] `pluginApi.connect`·`disconnect` 를 추가하고 모달·훅·카탈로그 버튼을 배선한다.
- [ ] ko/en i18n 키를 양쪽에 추가하고 `resources.test.ts` 를 통과시킨다.
- [ ] `modules/AGENTS.md` 를 갱신한다. `docs/IPC_CONTRACT.md` 는 **수정하지 않는다**(무변경 확인).
- [ ] 전체 게이트를 돌리고 사람 실기 2건(AC29·30)은 대기로 보고한다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint … / typecheck … / test … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | | | |

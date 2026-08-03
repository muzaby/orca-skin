# Verify — 0158-builtin-tool-plugin-host

## 메타

| 항목 | 값 |
|---|---|
| slug | `0158-builtin-tool-plugin-host` |
| 검증자 | Claude Code |
| 일자 | 2026-08-03 |
| 대상 커밋 | `6d67f52..d8124f3` (설계 r4 `f74979f` 이후 전체 15커밋). INDEX/plan 이 적은 6커밋은 **후반부만**이다 — §게이트 재실행 참조 |
| 라운드 | 1 → **2** |
| 상태 | r1 **FAIL** → r2 **PASS** (아래 §라운드 2 재검증) |
| 자기 검증 여부 | **설계·구현·검증 모두 같은 계열 에이전트**(plan r1~r3 Claude · r4 Codex · 구현 Codex · 검증 Claude). 0117/0123 이 지적한 교차 검증 부재 조건이므로 §0·§역방향 탐색을 매트릭스보다 먼저·강하게 적용했다 |

---

## 구현 결과 비판적 검토 (수석 엔지니어 관점 — 최우선)

`git diff f74979f..HEAD` (52파일 +3,908/−100) 을 인수 기준을 열기 전에 통째로 읽었다.

| 질문 | 판단 | 근거 / 후속 |
|---|---|---|
| 실환경에서 실패하는 방식 (지연·부분 실패·동시 호출·종료 중·권한 거부) | **대체로 잘 닫혀 있다.** 동시 connect 는 `activeByConnector` pending 선등록(`plugin-host.ts:106-107`) + `ConnectionRegistry.create` 원자 거부(`registry.ts:43-45`) 로 이중 방어. connector start 지연 중 binding 교체는 fingerprint 재검사(`plugin-host.ts:129-132`)로 거부. pre-abort 는 `ConnectorHost.connect/start/invoke` 3곳 preflight(`runtime.ts:80,91,117`). 부분 실패는 `cleanup` 의 `finally` 로 server 제거 보장(`plugin-host.ts:249-256`) | 잔여 1건 → **D7** (sink.remove 가 throw 하면 `active.cleanup` 이 rejected 로 캐시돼 재시도 영구 불가) |
| **잘못된 성공(false success)** 이 가능한 경로 | **승인 게이트는 fail-closed 확인.** `makeCanUseTool` 의 기본 분기가 `allow`(`claude.ts:200`)라 승인 정확성은 전적으로 `runtimeApprovalToolNames` 에 의존하는데, 그 집합과 `mcpServers` 가 **같은 `extensions.runtimeTools` 객체**에서 같은 `buildOptions` 안에 파생된다(`claude.ts:343,383,408`) — 스냅샷 불일치로 승인이 새는 경로 없음. `readOnlyHint` 미선언·`false` 는 모두 승인 대상(`runtime-tool-policy.ts:11`). **그러나 도구 *결과* 경로에 false success 가 있다** — 연결이 끊긴 뒤 모델이 도구를 다시 부르면 MCP 경계가 `isError` 없는 **성공**을 돌려준다(§보완 검증 A) | 승인 경로 ✅ / **결과 경로 ❌ → D5(승격)** |
| 되돌릴 수 있는가 (마이그레이션·파일 쓰기·외부 상태) | **되돌릴 것이 없다.** DB 마이그레이션 0(`git diff --stat … migrations/` 빈 출력), 파일 쓰기 0, connection/runtime server 전부 메모리 전용. 유일한 외부 상태 변경은 `broker.logout` 의 provider 원격 로그아웃인데 이는 0157 기존 경로 | ✅ |
| 설계가 의도한 것을 구현이 실제로 했는가 (비슷한 다른 것 아닌가) | **두 곳에서 '비슷한 다른 것'을 했다.** ① plan §의존 기술 "connector ID·runtime server ID·tool name 은 manifest `IdSchema` 와 **같은** 케밥 소문자 규칙" ↔ `protocol.ts:257` 이 **다른** 정규식을 쓰면서 주석은 "같은 규칙을 다시 강제한다"고 적음 → **D4**. ② plan §runtime tool 계약이 `handler(input): Promise<unknown>` 으로 backend 중립을 선언했으나 실제 소비자(SDK)는 `Promise<CallToolResult>` 를 요구하고(`sdk.d.ts:3991`) 유일한 참조 구현인 fixture 는 `ConnectorResult` 를 그대로 반환(`department-fixture-package.ts:67-68`) → **D5** | plan §의존 기술·§runtime tool 계약 ↔ `protocol.ts:252-258` · `claude-runtime-tools.ts:23` |
| 구현자 선조치(✅)가 경계를 넘지 않았나 | **넘지 않았다.** plan `[구현자 기입]` 5건(alias 폐기·`onBindingsEnded` seam·pending race·`finally` cleanup·group metadata 유예)은 전부 r4 설계에 반영된 뒤 구현됐고, 인수 기준·신규 의존성·제품 의도를 단독 변경한 흔적 없음. `AUTH_PLUGIN_PACKAGES` 는 빈 배열 유지(`modules/index.ts:28`) — fixture 를 프로덕션에 밀어넣지 않았다 | ✅ 신규 의존성 0 (`package.json`/lock diff 빈 출력) |

---

## 역방향 탐색 (매트릭스 전 선행)

```
$ bash .agents/skills/handoff-verify/scripts/scan-surface.sh f74979f..HEAD
# 대상 27 파일 · 미사용 값 export 12 · 테스트 전용 13 · 형제 정책 비대칭 0
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export `manifest.ts::RuntimeTool{Annotations,Declaration,Contribution}Schema` | **정상 (오탐)** | 같은 파일 `PluginManifestSchema` 합성에 쓰인다(`manifest.ts:113`). 스크립트가 동일 파일 참조를 세지 않음 |
| 미사용 export `plugin-host.ts::{ConnectorPort,LogoutPort,BindingLookup}` · `runtime-tools.ts::PluginToolContext` · `chat-turn-continuation.ts::AutomaticContinuationRuntime` | **정상 (오탐)** | 전부 같은 파일 `*Deps`/시그니처에 사용. 구조적 포트를 export 하는 것은 `main/AGENTS.md` 의 교차 feature 회피 규약 자체 |
| 미사용 export `handlers/plugins.ts::parsePluginListResponse` | **정상 (오탐)** | 같은 파일 `pluginList` 핸들러가 호출(`plugins.ts:14`). 테스트 가능하게 export 한 seam |
| **`registry.ts::getRuntimeTool` — 프로덕션·테스트 참조 0** | **죽은 코드** | `grep -rn "getRuntimeTool\b" src/` 결과가 정의 1줄뿐. `getProvider`/`getConnector` 대칭으로 넣은 골격이나 plan 이 배선을 약속한 API 는 아니다 → **D6**(사소) |
| 테스트 전용 `__fixtures__::{departmentFixturePackage,badDepartmentFixturePackage,isFixtureSource}` | **정상(의도)** | plan §비범위 = fixture 만. `modules/__fixtures__/AGENTS.md` 가 "production 배열에 등록하지 않는다"를 명문화 |
| 형제 파일 정책 키워드 비대칭 | **0건** | 스크립트 출력 "(없음)". 0157 D1(`redirect:` 비대칭) 형태 재발 없음 |

**스크립트 밖 추가 탐색**

| 탐색 | 결과 |
|---|---|
| 인수 기준의 핵심 동사가 테스트에 실제 등장하는가 | **plan 이 인용한 테스트 케이스명 다수가 실존하지 않는다.** 예: AC7 `plugin-host.test.ts::"binding target 상태와 provider 소속을 전부 검증한다"` → 실제는 영어 `it.each(...)('rejects %s before starting a connector')`. **케이스명이 아니라 동작으로 재대조**해 매트릭스를 채웠다(§2 원칙). 인용 자체는 stale → **D8** |
| plan 이 "N곳" 이라 적은 수치 재측정 | §3 참조 — 82 채널만 수치 주장이 있고 3중 일치 |
| **두 정규식이 정말 같은가** (문서·주석이 "같다"고 주장) | **다르다.** 임시 vitest 로 실증: manifest 는 `3rd-jira`·`2024-archive` 를 통과시키고 shared IPC 는 거부, `PluginConnectorInfoSchema.array().parse` 는 **한 항목만 나빠도 목록 전체를 throw** → **D4** |

---

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 이견 1~6 (connectionId SSOT · connectorId 교차참조 · alias 폐기 · 승인 metadata SSOT · logout ended IDs · safe DTO) | **전부 타당**, r4 설계에 반영 후 구현됨 | 매트릭스 AC8·AC5·AC17·AC15·AC24 에서 코드로 확인 |
| 놓친 문제 #3 "동시 connect pending race" ✅ 선조치 | **타당·확인됨** | `plugin-host.ts:106-107` 주석 + `registry.ts:43-45`. 다만 *단일 스레드 await 경계* 방어이지 멀티프로세스 방어가 아니다 — main 단일 프로세스라 충분 |
| 놓친 문제 #4 "connector stop 실패가 server 제거를 막음" ✅ 선조치 | **타당·확인됨** | `plugin-host.ts:249-256` `finally`, 테스트 `plugin-host.test.ts:433-440` |
| 구현 보고 "`npm test` 는 수집된 169 files·1480 tests pass, `chat-turn.continuity.test.ts` 만 실패" | **재현 확인 — 정확한 보고다.** ABI 재빌드 후 실측이 정확히 일치(§게이트) | 과다 보고 없음 |
| 구현 보고 "대상 커밋 6개" | **불완전.** 실제 구현은 `6d67f52` 부터 **15커밋**이다(`git log --format='%(trailers:key=Handoff)'` 로 전수). 6개는 r5~r7 후반부만 | 메타 표에 정정 기재 → **D8** |
| ⚠️ 보고만(결정 필요) 항목 | **없음.** plan §단독 결정 금지 항목 = "없음" 과 일치 | — |

---

## 요구사항 충족 매트릭스

> 테스트 케이스명은 plan 인용이 아니라 **실존 케이스명**으로 적었다. 전 케이스는 §게이트의 1480/1480 pass 에 포함된다.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `adapters/runtime-tools.ts` 는 backend·서비스 중립, Electron/DB import 없음 | ✅ | `runtime-tools.ts:1` 의 유일한 import 가 `type { z }`. 서비스 리터럴 0. `npm run lint`(boundaries) 0 error |
| 2 | `adaptRuntimeTools` 가 서버 ID 를 map key 와 `createSdkMcpServer({name})` 에 동일 사용 | ✅ | `claude-runtime-tools.ts:28,44` + `claude-runtime-tools.test.ts::"서버 식별자를 하나로 사용한다"` |
| 3 | 빈/부재 snapshot 이면 `mcpServers` key 자체가 없음 | ✅ | `claude-runtime-tools.ts:40` + `::"빈 스냅샷은 빈 옵션을 반환한다"` |
| 4 | manifest↔descriptor 전 필드 동등성 + 선언/구현 1:1 거부 | ✅ | `registry.ts:171-181,296-318` + `registry.test.ts::"runtime tool 선언과 descriptor 전체를 이름 정규화 후 대조한다"`·`::"…필드 하나라도 다르면 package 전체를 거부한다"`·`::"…1대1 불일치를 거부한다"` |
| 5 | connector descriptor 전 필드 대조 + `connectorId` 교차참조 + server ID·tool name 중복 거부 | ✅ | `registry.ts:152-165,183-195` + `registry.test.ts::"connector 선언과 구현 descriptor 전체를 대조한다"`·`::"runtime tool connector 교차 참조와 중복을 등록 단계에서 검증한다"` |
| 6 | origin 은 manifest 고정에서만, connect IPC 에 URL·alias 없음 | ✅ | `protocol.ts:262-268` `.strict()` + `protocol.plugins.test.ts::"rejects a malformed or expanded connect request"` (url·alias·connectionId 3케이스 명시 거부) |
| 7 | binding 존재·`valid`·connector target·connectorId 일치·provider allowlist 전부 검사 | ✅ | `plugin-host.ts:167-186` + `plugin-host.test.ts` `it.each` 5케이스 `'rejects %s before starting a connector'` (+ `connectors.connectCalls === []` 로 **zero-call** 까지 단언) |
| 8 | connection ID = `binding.target.connectionId` 만 사용 | ✅ | `plugin-host.ts:100,111` + `::"uses the binding target connection ID…"` · `runtime.test.ts::"preserves the caller-supplied connection ID"` |
| 9 | 같은 connector 두 번째 연결 거부·기존 보존, 다른 connector 공존 | ✅ | `plugin-host.ts:92-94` · `registry.ts:43-45` + `::"keeps different static connectors independent while preserving the first same-connector connection"` · `runtime.test.ts::"rejects a second connection…"`/`"allows different static connectors to coexist"` |
| 10 | ready 시 해당 connector 의 모든 contribution 등록, 이름 드리프트면 거부 | ✅ | `plugin-host.ts:134-142,222-231` + `::"uses the binding target connection ID and registers every matching static tool server"` + drift `it.each` 3케이스(missing/extra/duplicate) |
| 11 | start·factory·sink 실패 롤백, binding 은 유지 | ✅ | `plugin-host.ts:143-148` + `::"rolls back connector, factory, and sink failures so the same valid binding can retry"` (3실패 후 4번째 성공까지 검증) |
| 12 | context key 는 `{connectionId,invoke,logger,signal}` 4개, invoke 는 자기 connection 고정 | ✅ | `plugin-host.ts:192-218` + `::"limits factory context to four capabilities…"` (`Object.keys(ctx).sort()` 단언 + `connectionId:'connection-a'` 고정) |
| 13 | disconnect 가 server 전량 제거 + connection 중단 + revision 증가 | ✅ | `plugin-host.ts:151-157` → `cleanup` + `::"uses logout callback cleanup for explicit disconnect…"`. revision 증가는 `runtime-tool-registry.ts:98-101` + `runtime-tool-registry.test.ts::"실질 변경 때만 revision을 증가시킨다"` |
| 14 | 정상 `broker.logout` 이 disconnect 호출 없이도 회수 | ✅ | `broker.ts:241-247` + `broker.test.ts::"removes locally, awaits the callback, then publishes and returns the successful logout"` · `plugin-host.test.ts:434` 직접 `onBindingsEnded` 경로 |
| 15 | provider logout 실패에도 회수 + callback await 후 실패 반환 | ✅ | `broker.ts:225-251` + `broker.test.ts::"awaits callback cleanup and removes locally when provider logout fails or throws"` · `plugin-host.test.ts::"returns a failed logout outcome after the broker callback cleans up the connector"` |
| 16 | cascade logout 이 제거된 모든 binding 을 1회씩 정리 | ✅ | `broker.ts:220-222` (`takeForRemoval` 이 root+dependents 반환) + `broker.test.ts::"passes every actually removed root and dependent id to one cascade callback"` · `plugin-host.test.ts::"aborts an in-flight tool invocation when cascade cleanup ends its binding"` |
| 17 | 설명·annotations SSOT = 정적 descriptor, factory 가 덮어쓸 타입 표면 없음 | ✅ | `claude-runtime-tools.ts:18-19` 가 `declaration.description`/`declaration.annotations` 를 쓰고 implementation 에서는 `name`/`inputSchema`/`handler` 만 취함. `RuntimeToolImplementation`(`runtime-tools.ts:26-30`)에 policy 필드 부재 — `npm run typecheck` 3/3 pass |
| 18 | `readOnlyHint:true` 자동 허용 / `false` 승인 요청 | ✅ | `claude.ts:183-186` + `claude.canusetool.test.ts::"readOnlyHint가 true가 아닌 runtime 도구는 승인 요청으로 보낸다"`·`::"readOnlyHint가 true인 runtime 도구는 승인 없이 passthrough한다"` |
| 19 | `readOnlyHint`/annotations 미선언은 쓰기로 분류 (fail-closed) | ✅ | `runtime-tool-policy.ts:11` (`!== true`) + `runtime-tool-policy.test.ts::"readOnlyHint가 true인 도구만 자동 허용하고 나머지는 완전한 SDK 이름으로…"` (`unspecified`/annotations 부재 케이스 포함) |
| 20 | revision 증감 → 다음 턴 respawn, listen·flush 가 같은 fresh snapshot 을 판정·요청에 공유, flush 가 최초 model family 보존 | ✅ | `runtime-tool-registry.test.ts::"실질 변경 때만 revision을 증가시킨다"` · `respawn-policy.test.ts` 2케이스 · **실제 `registerChatHandlers` 를 구동하는** `chat-turn.runtime-tools.test.ts::"respawns a stale persistent channel before its listen request and forwards that fresh snapshot"`·`::"keeps the non-default selected model on a flush continuation without an unnecessary respawn"` · `chat-turn-continuation.test.ts` 2케이스 |
| 21 | package 한 줄 등록으로 provider·복수 connector·runtime tools 동시 진입, fixture 리터럴 core 미유출 | ✅ | `modules/index.ts:20-28`(`runtimeTools?` optional 추가) · `bootstrap.ts:193-197` + `isolation.test.ts::"keeps service-specific connector literals out of main core code"`(main 전 소스 스캔) · `fixture-package.test.ts::"registers three fixed department connectors…"`. **단**: `AUTH_PLUGIN_PACKAGES` 배열 자체를 도는 `Bootstrap.createAuthPlatform` 루프는 미테스트 — 테스트는 같은 형상의 `AuthPluginPackage` 를 `AuthRegistry.register` 에 직접 넣는 대리 검증 |
| 22 | 부서별 고정 origin connector 3개 + list DTO 6필드 구분 | ✅ | `department-fixture-package.ts:9-25` (3 origin 상이) + `fixture-package.test.ts::"registers three fixed department connectors with distinct list DTO inputs"`·`::"lists every fixed connector and reports only the connected fixture as connected"` |
| 23 | 불량 package 1개가 정상 package 를 막지 않음 | ✅ | `registry.ts:51-55`(all-or-nothing) + `fixture-package.test.ts::"isolates a rejected package while the valid fixture still connects and adds its tools"` |
| 24 | 신규 3채널이 무효 payload 거부 + list DTO 에 secret·presentation·raw binding 없음 | ✅ | `protocol.ts:260-278` `.strict()` + `protocol.plugins.test.ts::"allows only the safe connector list DTO fields"`(secret·presentation·artifact·binding·bindingId·connectionId 6종 거부) · `handlers/plugins.test.ts::"returns safe connector DTOs after strict output validation"` |
| 25 | 헤더 총계·도메인별 합·`CHANNELS` 실측 **모두 82** | ✅ | §3 재측정 — 헤더 82 / 내역 합 82 / `CHANNELS` grep 82 / `Object.values(CHANNELS).length` 82. `ipc-documentation.test.ts` 가 **내역 합=총계** 검산까지 기계화 |
| 26 | lint 0 error · typecheck 3분할 0 · 수집 vitest 전량 pass · 신규 의존성 0 · migration 0 | ✅ | §게이트 재실행 — 전부 재현 |

**인수 기준 26/26 충족.** 아래 FAIL 판정은 기준 밖에서 나온 것이다.

---

## 왜 26/26 인데 FAIL 인가

> 상태 머신상 FAIL 은 정상 결과이고, `SKILL.md §0` 은 *기준에 없어도* 발견한 것을 조용히 통과시키지 말라고 요구한다.

이번 핸드오프의 성공 조건은 plan 이 스스로 이렇게 못박았다(§범위 유예 표, "실제 Jira/Confluence connector" 행):

> "이번 fixture 와 같은 package 단위 구현이며 **core 계약 변경 없이 추가하는 것이 이번 작업의 성공 조건**이다."

즉 산출물은 *호스트* 만이 아니라 **다음 저자가 따라 쓸 확장 계약**이다. 그 계약의 두 모서리가 어긋나 있다 — 둘 다 오늘은 무해하지만(프로덕션 `AUTH_PLUGIN_PACKAGES` 가 빈 배열), **첫 실제 package 를 쓰는 순간 발화**한다.

- **D5 (★ false success — 최우선)** — 도구 호출 결과가 MCP 경계에서 **`isError` 없는 빈 성공**이 된다. 정상 호출은 데이터가 모델에 도달하지 않아 조용히 무력하고, **연결이 끊긴 뒤의 호출은 실패가 성공으로 뒤집힌다**(§보완 검증 A 에서 실제 SDK 서버 + 실제 MCP 클라이언트로 종단 확인). 0157 D1 과 같은 계열이다.
- **D4** — ID 규칙이 두 곳에서 다르고, 코드 주석은 "같다"고 적혀 있다. 규칙을 믿고 `3rd-jira` 같은 ID 를 쓴 package 는 등록에 성공한 뒤 목록 전체를 죽이고 영원히 연결되지 않는다.

D5 는 `AUTH_PLUGIN_PACKAGES` 가 빈 배열이라 **오늘 사용자에게 도달하지는 않지만**, 도달하지 않는 이유가 "코드가 옳아서" 가 아니라 "아무도 아직 안 써서" 다. 첫 실제 package 가 붙는 순간 발화하며, 증상이 *에러가 아니라 조용한 성공* 이라 그때는 원인 추적이 훨씬 비싸다.

수정 범위는 여전히 작다(반환형 계약 + `adaptServer` 변환 + fixture · 정규식 SSOT · 경계 테스트). 라운드 2 로 넘겨 **첫 실제 package 가 쓰이기 전에** 바로잡는 것이 옳다.

---

## 보완 검증 (r1 2차 패스) — 처음에 "못 봤다" 고 적은 3건을 실측으로 메움

> 초판 verify 는 §자기 리뷰에서 ⓐ SDK 런타임 미검증 ⓑ `Bootstrap.createAuthPlatform` 미실행
> ⓒ D7 미재현을 한계로 적고 사람에게 넘겼다. **셋 다 이 환경에서 실측 가능했다** — P12("조사
> 가능한 것을 불가로 선언")를 스스로 반복한 것이다. 아래는 전부 **임시 테스트로 실행 후 삭제**했고
> (`git status` clean 확인), 저장소 코드는 건드리지 않았다.

### A. SDK 런타임 — D5 의 실제 귀결 (**추정 → 확정, 그리고 더 나쁘다**)

`createSdkMcpServer` 가 돌려주는 `instance`(`sdk.d.ts:1061-1063` = 실제 `McpServer`)를
`InMemoryTransport` 로 실제 MCP `Client` 에 물려 `tools/call` 을 왕복시켰다.

```
통제군(올바른 CallToolResult) => {"content":[{"type":"text","text":"hello"}]}
fixture 형태({ok,data})       => {"content":[],"ok":true,"data":{"issue":"ORCA-1"}}
취소 경로({ok:false,error})   => {"content":[],"ok":false,"message":"…cancelled","health":"error"}
```

그리고 **합성 값이 아니라 §B 의 실제 파이프라인 출력**을 같은 경계에 통과시킨 종단 결과:

```
E2E 정상호출   = {"content":[],"ok":true,"data":{"operation":"jira-platform-read"}}
E2E 로그아웃후 = {"content":[],"ok":false,"message":"connector invocation was cancelled","health":"error"}
E2E isError필드 = {"정상":false,"로그아웃후":false}
```

**판정 — D5 는 계약 타입 불일치가 아니라 false success 결함이다.**

1. **정상 호출이 조용히 무력하다.** 실제 데이터(`{operation:…}`)는 `content` **밖**에 실려 모델에
   도달하지 않는다. `content: []` 이므로 모델은 "도구가 성공했고 결과가 비었다" 로 읽는다.
2. **취소·실패가 성공으로 뒤집힌다.** 사용자가 로그아웃/disconnect 한 뒤 모델이 같은 도구를
   다시 부르면 `PluginHost` 의 `{ok:false, health:'error'}`(`plugin-host.ts:195-200`)가
   **`isError` 없는 성공**으로 변환된다. 실패해야 할 때 성공을 반환하는 경로 — **0157 D1 과 같은
   계열**이며 `SKILL.md §0.2` 가 "가장 비싼 결함" 이라 지목한 형태다.
3. **기존 테스트가 왜 못 잡았나**: `plugin-host.test.ts:498` 은 `handler({})` 가
   `{ok:false, health:'error'}` 를 resolve 하는 것까지만 단언한다. **그 값이 MCP 경계를 지난 뒤
   어떻게 보이는지**를 검사하는 테스트가 저장소에 하나도 없다 — `as never` 캐스트
   (`claude-runtime-tools.ts:23`)가 타입 검사를, 테스트 부재가 런타임 검사를 각각 지웠다.

### B. `Bootstrap.createAuthPlatform` 조립 — **재구성해서 통과 (긍정 발견)**

`bootstrap.ts:5` 가 `electron` 을 최상위 import 하고 `createAuthPlatform` 이 private 이라 직접
호출은 불가하지만, **같은 순서·같은 배선을 실제 객체로 재구성**할 수 있었다 — `broker.ts` 는
electron 비의존이다. fake 0개(real `AuthRegistry`+`AuthBroker`+`ConnectionRegistry`+
`ConnectorHost`+`RuntimeToolRegistry`+`PluginHost`+fixture package)로 인증→연결→도구노출→호출→
로그아웃 왕복을 돌렸다:

```
list             = [jira-platform, jira-security, confluence-rnd]   revision 0
연결 후 servers   = ["jira-platform-tools"]                          revision 1
승인 대상        = ["mcp__jira-platform-tools__jira-platform-write"]  ← read 는 자동 허용
mcpServers key   = ["jira-platform-tools"]                           ← server ID 단일화 확인
connection       = [{id:"conn-jira-platform", connectorId:"jira-platform"}]  ← binding target 보존
logout           = {"kind":"logged_out","endedBindingIds":["bind_1_…"]}
로그아웃 후       = servers [] · connections [] · revision 2
```

**조립은 건전하다.** 이 실행은 매트릭스의 대리 검증 3건을 실측으로 승격시킨다:

| 원래 표기 | 보완 후 |
|---|---|
| AC21 "`AUTH_PLUGIN_PACKAGES` 루프는 미테스트, 대리 검증" | **실측** — 같은 루프 형태로 provider·connector 3개·runtimeTools 가 한 경로로 등록됨 |
| AC14 "정상 logout 회수" (fake `LogoutPort`) | **실측** — real `AuthBroker.logout` → `onBindingsEnded` closure → real `RuntimeToolRegistry` 회수까지 왕복 |
| AC18·19 승인 판정 (합성 snapshot) | **실측** — real fixture descriptor 에서 write 만 승인 집합에, read 는 자동 허용 |

동시에 이 실행이 **D5 의 종단 증거**를 만들었다 — 실제 파이프라인의 `invoke` 반환이 정확히
`{ok:true,data:{…}}` 였고, 그것이 §A 의 MCP 경계에서 빈 성공이 됐다.

### C. D7 재현 — **가설 → 확정, 그리고 더 나쁘다**

`RuntimeToolSink.remove` 가 throw 하는 sink 를 주입하고 `onBindingsEnded` 를 2회 호출했다:

```
D7 stopCalls      = ["binding-a"]     ← 2회 호출했으나 stop 은 1회 (캐시된 rejected promise 반환)
D7 removed(성공분) = []                ← sink 회복 후에도 runtime server 가 끝내 제거되지 않음
D7 list           = [{… "connected": true}]   ← binding 폐기 후에도 연결됨으로 표시
```

**"재시도 불가" 를 넘어선다.** `active.cleanup` 에 rejected promise 가 캐시돼
(`plugin-host.ts:233-237`) ⓐ runtime tool server 가 registry 에 남아 **LLM 에 계속 노출**되고
ⓑ `activeByConnector` 에서 삭제되지 않아 **재연결도 `already connected` 로 거부**된다. 즉 AC13~16
("binding 폐기 시 connector 와 runtime server 를 회수한다")의 정면 실패 모드다.

**도달 조건**: 현행 `RuntimeToolRegistry.remove`(`runtime-tool-registry.ts:98-101`)는 throw 하지
않으므로 **오늘은 도달 불가**. 다만 `RuntimeToolSink` 는 구조적 포트라 다른 구현이 주입될 수 있는
자리이고, 이 코드가 방어하는 대상(`stopByBinding` 실패)은 이미 `try/catch` 로 감싼 반면
`remove` 만 무방비다 — 비대칭 자체가 신호다.

---

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 + 출력 | — | 전부 재현 (§게이트) |
| 인수 기준 ↔ 코드 1:1 대조 | ✅ 증거(`파일:라인`+실존 테스트명) | 이견 시 중재 | 26/26 |
| 레이어 경계(eslint-boundaries) 위반 0 | ✅ | — | `npm run lint` 0 error. auth-platform→connectors/extensions 직접 import 0 (`plugin-host.ts` 는 구조적 포트만) |
| IPC 채널 수 3중 검산 | ✅ | — | 82/82/82 |
| 문서 형식/링크/한국어 컨벤션 | ✅ | — | `IPC_CONTRACT.md §2.13-d` 신설 형식 준수. `docs/AGENTS.md` 는 미갱신 → **D3** |
| AGENTS.md 위생(키/토큰/이메일/IP) 스캔 | ✅ grep 보고 | ✅ 맥락 최종 판단 | §위생 검토 — 0건 |
| import stub(`@AGENTS.md`) 해석 | ✅ | — | `__fixtures__/CLAUDE.md` = `@AGENTS.md` 1줄 stub, 규약 준수 |
| PHASES.md 형식·PR#/커밋 | ✅ | — | FAIL 이므로 승격하지 않음 |
| **SDK 런타임에서 runtime tool 이 실제로 호출되는가** | ✖ (SDK 서브프로세스 실기 불가) | ✅ | **사람 실기 대기** — D5 와 직결 |
| **`npm run dev` 기동 + 실제 package 연결 라이브** | ✖ (Electron 바이너리 미설치 환경) | ✅ | 사람 실기 대기 |
| 제품 의도 부합(서버별 정적 connector · connector당 1연결) | ✖ 보조 의견 | ✅ 결정 | r4 사용자 승인 기록 확인 — 코드가 그 결정과 일치 |
| renderer connector 관리 화면 | ✖ | ✅ | plan §비범위 — 후속 |
| PR 머지 승인 | ✖ | ✅ | FAIL 이므로 미해당 |

---

## 게이트 재실행 결과

환경: `node_modules` 부재 상태에서 시작 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` (exit 0).

```
$ npm run lint
/…/useTranscriptVirtualizer.ts  22:10  warning  Compilation Skipped: Use of incompatible library
✖ 1 problem (0 errors, 1 warning)          # warning 1 = 0102 TanStack 베이스라인, 본 변경 무관

$ npm run typecheck
> typecheck:node && typecheck:web && typecheck:test        # 3분할 전부 exit 0

$ ./node_modules/.bin/vitest run                            # ① ABI 재빌드 전
 Test Files  5 failed | 165 passed (170)
      Tests  39 failed | 1441 passed (1480)

$ npm rebuild better-sqlite3                                # app/AGENTS.md §ABI "DO ✅" 절차
rebuilt dependencies successfully

$ ./node_modules/.bin/vitest run                            # ② 재빌드 후
 FAIL  src/main/app/chat-turn.continuity.test.ts [ collection ]
 Test Files  1 failed | 169 passed (170)
      Tests  1480 passed (1480)

$ node --test "scripts/*.test.mjs"
# tests 28 · pass 28 · fail 0

$ git diff --stat f74979f..HEAD -- app/package.json app/package-lock.json app/src/main/infra/db/migrations/
(빈 출력)                                                   # 신규 의존성 0 · 마이그레이션 0

$ git status --short
(빈 출력)                                                   # lint --fix 후에도 작업 트리 clean
```

**환경 기인 실패의 기계적 분리 (§4).** 재빌드 전 5파일 39테스트 실패의 근본 에러를 전수 집계하면:

```
$ grep -E "Error:" vitest-full.txt | sort | uniq -c
   1 Error: Electron failed to install correctly, please delete node_modules/electron …
   6 Error: Module did not self-register: '…/better_sqlite3.node'.
   4 Error: The module '…/better_sqlite3.node' …
```

**비-베이스라인 서명 0건.** 실패 5파일은 `infra/db/{queries,migrate}.test.ts` · `features/orchestration/fork.test.ts` · `features/extensions/builder.test.ts` · `app/chat-turn.continuity.test.ts` 로 전부 DB 로드 또는 Electron 바이너리 의존 스위트다. `npm rebuild better-sqlite3` 로 **4파일이 green 으로 전환**되어 이 판정이 추론이 아니라 실측으로 확정됐다 — 잔존 1파일은 electron 바이너리 미설치(egress) 뿐이며, 이는 구현 보고와 정확히 일치한다.

> **중요**: AC20 의 증거 중 하나인 `builder.test.ts::"forwards the injected empty registry snapshot with revision zero"` 는 **DB 로드 스위트에 들어 있어** ABI 재빌드 전에는 red 였다. 재빌드 후 green 을 직접 확인했다 — 재빌드 없이 "베이스라인이니 무관" 으로 넘겼다면 이 신규 테스트의 통과를 확인하지 못한 채 지나갔을 것이다.

---

## 수치 재측정 (§3)

| 문서가 인용한 수치 | 재측정 명령 | 실측 | 판정 |
|---|---|---|---|
| IPC 총계 82 (헤더) | `grep '## 2. 채널 카탈로그' docs/IPC_CONTRACT.md` | 82 | ✅ |
| IPC 도메인별 합 82 | `ipc-documentation.test.ts` 의 정규식 합산 | 82 | ✅ |
| `CHANNELS` 실측 82 | `sed -n '/^export const CHANNELS/,/^} as const/p' src/shared/ipc.ts \| grep -c "'orca:"` | 82 | ✅ |
| `Object.values(CHANNELS).length` | 실행형 테스트 | 82 | ✅ |
| 도메인 23개 | `IPC_CONTRACT.md §1` | 23 | ✅ |
| **`docs/AGENTS.md` 인벤토리 "총 79 채널 · 22 도메인"** | `grep -n "79 채널" docs/AGENTS.md` | **79/22 (stale)** | ❌ → **D3** |
| plan 구현 보고 "대상 커밋 6개" | `git log --format='%(trailers:key=Handoff)'` 전수 | **15커밋** | ❌ → **D8** |

0157 verify 가 만든 "내역 합 = 총계" 검산이 이번엔 **실행형 테스트로 기계화**됐다(`ipc-documentation.test.ts`) — 같은 종류의 stale 수치가 재발할 수 없게 됐다. 좋은 개선이다. 다만 그 테스트는 `IPC_CONTRACT.md` 만 지키므로 `docs/AGENTS.md` 사본은 그대로 새어나갔다.

---

## 위생 검토 (AGENTS.md 변경 시)

변경된 AGENTS.md: `modules/AGENTS.md`(+3줄), `modules/__fixtures__/AGENTS.md`(신규 8줄) + stub `CLAUDE.md`.

- 키/토큰/이메일/IP 패턴 스캔: **0건**. fixture origin 은 전부 `*.example.invalid` (RFC 2606 예약 TLD) — 실주소 아님.
- 변동성/일회성/장문 코드설명서 혼입: **없음**. 두 파일 모두 *규칙*만 담고 페이즈·PR·담당자 정보 없음.
- 신규 디렉토리 `__fixtures__/` 에 `AGENTS.md` + `@AGENTS.md` stub 을 함께 둔 것은 루트 `AGENTS.md` §핵심 원칙 5 준수. ✅

---

## PHASES.md 정합성

- **FAIL 이므로 승격하지 않는다.** `docs/PHASES.md` 무변경.
- 관찰(본 건 범위 밖, 0155 verify 가 이미 지적): `0153`·`0154` 는 verify PASS 이나 PHASES 승격 행이 여전히 없다.

---

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan §의존 기술이 "manifest `IdSchema` 와 같은 케밥 소문자 규칙" 이라고 *말로* 못박았을 뿐, **어느 코드가 그 규칙의 SSOT 인지 지정하지 않았다.** 그래서 구현이 shared 경계에 정규식을 한 벌 더 쓰는 것이 설계 위반으로 보이지 않았다. → 새 실패 패턴: **"같은 규칙" 을 두 레이어에 요구하는 설계는 *어느 쪽이 SSOT 이고 나머지는 어떻게 파생/검증하는지* 를 인수 기준에 넣어야 한다. 그러지 않으면 복붙된 두 번째 사본이 조용히 갈라진다."**
- **설계 단계 2**: AC17 이 "factory 는 `{name,inputSchema,handler}` 만 반환한다" 로 *반환 필드* 는 못박았지만 **`handler` 의 반환 *타입* 은 어느 기준도 다루지 않았다.** SDK 소비 계약이 인수 기준 밖으로 새어나간 자리다. → 패턴: **"어댑터가 외부 SDK 로 넘기는 값은 *필드 목록* 이 아니라 *SDK 가 요구하는 타입* 으로 인수 기준을 쓴다."**
- **구현 단계**: 선조치 경계는 잘 지켰다(⚠️ 항목 0, 신규 의존성 0, 인수 기준 무단 변경 0). 반면 **plan 의 "검증 수단" 열에 적힌 테스트 케이스명을 실제 케이스명과 맞추지 않은 채 IMPL_DONE 을 선언**했다 — 검증자가 인용을 신뢰했다면 존재하지 않는 테스트를 ✅ 로 셀 뻔했다. 구현 보고의 "대상 커밋 6개" 도 실제 15커밋의 후반부만이라 diff 기준선을 잘못 잡게 만든다.
- **검증 단계 — ★이번 verify 자신의 최대 실패**: 초판이 SDK 런타임·Bootstrap 조립·D7 재현 3건을
  "환경상 불가" 로 적고 사람에게 넘겼는데, **셋 다 이 환경에서 실측 가능했다**(§보완 검증). 이는
  `failure-patterns.md` **P12("조사 가능한 것을 '불가'로 선언")를 검증 단계에서 그대로 반복**한
  것이다. 특히 비싼 실수였던 이유:
  - "SDK 실기는 사람 몫" 이라는 판단이 **틀렸다.** `createSdkMcpServer` 는 `instance`(실제
    `McpServer`)를 돌려주므로 CLI 서브프로세스 없이 `InMemoryTransport` 로 경계를 왕복시킬 수
    있었다. 즉 **"SDK 를 못 돌린다" 가 아니라 "SDK 의 어느 부분을 돌릴 수 있는지 안 찾아봤다"** 였다.
  - 그 한 번의 실행이 D5 를 *계약 타입 불일치*(사소·후속)에서 **false success 결함**(§0 이 최우선으로
    찾으라는 것)으로 재분류시켰다. 즉 못 본 것이 결론 자체를 바꿨다.
  - "electron 의존이라 불가" 도 **범위를 과대 적용**했다. 막힌 것은 `bootstrap.ts` 파일 하나였고,
    그 안의 *조립 로직* 은 electron 비의존 부품으로 재구성 가능했다(P1 의 "무엇을 떼면 가능한가" 를
    파일 단위가 아니라 **배선 단위**로 물었어야 했다).
  - → 새 패턴 **P18** 로 축적: *"검증자가 '실기 불가' 를 선언하기 전에, 그 시스템이 **테스트 가능한
    핸들을 이미 export 하고 있는지** 확인하라."*
- **검증 단계 — 보완 후에도 여전히 못 본 것 (정직하게)**:
  - **실제 `query()` 서브프로세스 경로는 미검증.** §보완 A 는 `createSdkMcpServer` 의 `instance` 를
    직접 물린 것이라 **MCP 경계까지**를 증명한다. CLI 가 그 결과를 모델 컨텍스트에 어떻게 직렬화하는지
    (빈 `content` 를 어떤 문구로 보여주는지)는 여전히 실기 영역이다. D5 의 *증상 형태* 는 확정됐고
    *사용자 체감* 은 남는다.
  - **`registerPluginHandlers` 의 실제 IPC 왕복 미실행.** §보완 B 는 `PluginHost` 까지 조립했고
    핸들러 등록은 typecheck + `handlers/plugins.test.ts` 의 출력 스키마 테스트로만 확인했다.
  - **동시성은 단일 스레드 await 경계까지만.** race 테스트들은 수동으로 resolve 순서를 조작한
    결정적 시나리오다. 실제 스케줄러 인터리빙은 재현하지 않았다.
  - **D7 은 도달 조건이 가설로 남는다.** 결함 자체(캐시된 rejected promise → 서버 잔존 + 재연결
    불가)는 실측 확정했으나, 현행 sink 로는 트리거되지 않으므로 **"오늘 발생한다" 는 주장이 아니다.**

---

## [FAIL] 미충족 항목 (구현자 액션 아이템)

- [ ] **D5 (최우선) — runtime tool 결과가 MCP 경계에서 false success 가 되는 것을 막는다.** 실측
      결과: 정상 호출 `{"content":[],"ok":true,"data":{…}}` · **취소 후 호출
      `{"content":[],"ok":false,…}` 이면서 `isError` 부재**(§보완 A). 최소 두 가지를 함께 고친다 —
      ⓐ **성공 경로**: `adaptServer`(`claude-runtime-tools.ts:16-25`)가 contribution 반환값을
      `CallToolResult` 로 변환하거나, `RuntimeToolImplementation.handler` 의 반환형을 그 형상으로
      좁힌다. `as never`(`:23`)를 제거할 수 있는 형태여야 한다. ⓑ **실패 경로**: `PluginHost` 의
      취소 반환(`plugin-host.ts:195-200`)과 `ConnectorHost` 의 `cancelledResult`
      (`runtime.ts:177-179`)가 모델에게 **`isError: true` 로 보이도록** 한다 — 지금은 연결이
      끊겼는데 모델이 "성공, 결과 없음" 으로 읽는다. ⓒ **fixture 를 그 계약대로 수정**
      (`department-fixture-package.ts:67-68`) — 저자용 참조 구현이므로 여기가 틀리면 계약이 틀린 것과
      같다. 회귀 테스트: `InMemoryTransport` + MCP `Client` 로 `tools/call` 을 왕복시켜 **정상은
      content 가 실리고, 취소는 `isError` 가 선다**를 단언(§보완 A 의 하네스를 그대로 쓸 수 있다).
- [ ] **D4 — ID 규칙 SSOT 통일.** `protocol.ts:257` `PluginConnectorIdSchema` 의 `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` 를 manifest `IdSchema`(`manifest.ts:17`) 의 `^[a-z0-9]+(?:-[a-z0-9]+)*$` 와 **실제로 일치**시킨다(또는 두 곳이 한 상수를 공유하도록 SSOT 를 만든다 — main→shared 방향이므로 `shared/` 에 두고 manifest 가 import 하는 편이 DAG 에 맞다). 회귀 테스트: 숫자 선두 ID(`3rd-jira`) 가 manifest 와 IPC 양쪽에서 **같은 판정**을 받는지. 겸사 `parsePluginListResponse` 가 항목 1개 때문에 목록 전체를 throw 하는 게 의도인지 재확인한다(현행은 all-or-nothing).
- [ ] **D3 — `docs/AGENTS.md:15` 인벤토리를 82 채널 · 23 도메인 + `plugin` 3 으로 갱신.** `ipc-documentation.test.ts` 의 검산 범위를 이 파일까지 넓히는 것을 함께 검토(같은 stale 이 재발한 자리다).
- [ ] **D8 — plan 의 검증 수단·대상 커밋 정정.** 인수 기준 표의 테스트 케이스명을 실존 케이스명으로 바꾸고, 구현 보고 "대상 커밋" 을 `6d67f52..` 전 15커밋으로 정정한다.
- [ ] (선택) **D6 — `AuthRegistry.getRuntimeTool` 제거** 또는 사용처 배선. 현재 참조 0.
- [ ] **D7 — `PluginHost.cleanup` 실패 캐싱** (가설 → **실측 확정**, §보완 C). `cleanupOnce` 가 reject 하면 `active.cleanup` 에 rejected promise 가 캐시돼(`plugin-host.ts:233-237`) ⓐ runtime server 가 registry 에 남아 LLM 에 계속 노출되고 ⓑ `activeByConnector` 에서 삭제되지 않아 재연결도 `already connected` 로 거부된다. 실패 시 `active.cleanup` 을 비우거나 `cleanupOnce` 를 never-throw 로 만든다(`stopByBinding` 은 이미 `try/catch` 인데 `remove` 만 무방비인 비대칭). **도달 조건은 여전히 가설** — 현행 sink 는 throw 하지 않는다.

> 위 항목은 plan 하단 `[검증자 기입] 파생 이슈` 챕터에 D3~D8 로 이관했다. 다음 구현 턴은 그 챕터에서 이어간다.

---

## 결론 / 다음 단계

- **상태: FAIL (r1).** 인수 기준은 **26/26 충족**이고 게이트도 전부 green(lint 0 error · typecheck 3/3 · vitest **1480/1480** · scripts 28/28 · 의존성 0 · 마이그레이션 0)이다. FAIL 사유는 **기준 밖에서 발견한 결함**이며, 보완 검증 후 무게중심이 바뀌었다 — 초판은 D4·D5 를 '계약 드리프트 2건' 으로 봤으나, **§보완 A 의 실측이 D5 를 false success 결함으로 재분류**했다(취소된 도구 호출이 모델에게 `isError` 없는 성공으로 보인다). 오늘 사용자에게 도달하지 않는 이유는 코드가 옳아서가 아니라 아직 아무도 안 써서다.
- **다음 주체: Codex** (구현 라운드 2). 액션 아이템은 위 체크리스트, 추적은 plan 의 파생 이슈 챕터.
- **사람 확인 대기 (보완 후 축소)**: ① 실제 `query()` 서브프로세스에서 빈 `content` 가 모델 컨텍스트에 어떻게 보이는지 — D5 의 *증상 형태* 는 §보완 A 로 확정됐고 *사용자 체감* 만 남는다 ② `npm run dev` 기동 + 실 package 연결 라이브 ③ renderer connector 화면(비범위, 후속). **초판의 '①  SDK 런타임 미검증' 과 'Bootstrap 조립 미실행' 은 §보완 A·B 로 해소돼 사람 몫에서 내렸다.**

---

# 라운드 2 재검증 (PASS)

> r1 FAIL 의 액션 아이템을 사용자 지시로 **Claude 가 직접 구현**했다(핸드오프 규약 §구현 주체
> 분담 — 버그수정). 구현 보고는 plan 의 `[구현자 기입] 라운드 2 구현 보고`.
> **자기 구현을 자기가 검증하는 조건이므로**, r1 이 결함을 잡은 것과 **같은 하네스**로 실증하는
> 것을 재검증의 축으로 삼았다 — "고쳤다" 는 주장 대신 같은 측정의 전후 비교를 증거로 쓴다.

## 대상 커밋

`a217501` (`fix(plugin): runtime tool 결과를 MCP 계약으로 고정`)

## r1 미충족 항목 대조

| # | r1 액션 아이템 | 해소 | 증거 (실측) |
|---|---|---|---|
| **D5-a** | handler 반환형을 SDK 계약 형상으로 좁히고 `as never` 제거 | ✅ | `runtime-tools.ts:26-43` `RuntimeToolResult` · `claude-runtime-tools.ts:56` 가 `adaptHandler` 사용, `as never` **grep 0건** · typecheck 3분할 0 |
| **D5-b** | 취소·오류가 `isError:true` 로 모델에 보이게 | ✅ | `plugin-host.ts:194-201` 이 해소 대신 **reject**. 종단: `{"content":[…closed…],"isError":true}` |
| **D5-c** | fixture 를 계약대로 수정 | ✅ | `department-fixture-package.ts:45-63` `toToolResult` — `ok:false`→`isError`, 비정상 형상도 `isError` |
| **D5-d** | `InMemoryTransport`+MCP `Client` 왕복 회귀 테스트 | ✅ | `claude-runtime-tools.boundary.test.ts` **4케이스**(정상 content / 플러그인 isError / throw→isError / 비-MCP 형상→도구 실패) |
| **D4** | ID 규칙 SSOT 통일 + 동등성 회귀 | ✅ | `shared/protocol.ts:257-262` `PLUGIN_ID_PATTERN` 소유 → `manifest.ts:11` import. `plugin-id-ssot.test.ts` **13케이스**가 12개 입력에서 manifest↔IPC 판정 일치를 단언 |
| **D7** | cleanup 실패 캐싱 | ✅ | `plugin-host.ts:249-262` 개별 `try/catch`. 회귀 테스트가 sink throw 후 **재연결까지** 확인 |
| **D6** | 죽은 `getRuntimeTool` | ✅ | `grep -c getRuntimeTool registry.ts` = **0** |
| **D9** | `connectors/registry.ts` 구 N:1 헤더 | ✅ | 헤더가 정적 connector 모델로 교체(`registry.ts:7-12`) |
| **D3-b** | `docs/AGENTS.md` 인벤토리 | ✅ | 82 채널 · 23 도메인 · `plugin` 3 |
| **D8** | plan 검증 수단·커밋 범위 정정 | ✅ | verify r1 메타 표가 `6d67f52..d8124f3` 15커밋으로 정정, 매트릭스는 **실존 케이스명**으로 작성됨 |

**10/10 해소.**

## 핵심 증거 — 같은 하네스, 전후 비교

r1 이 D5 를 잡은 하네스(실제 `McpServer` 인스턴스 + `InMemoryTransport` + 실제 MCP `Client`,
그리고 fake 0개로 재구성한 실제 파이프라인)를 수정 후 그대로 다시 돌렸다.

| 시나리오 | r1 (수정 전) | r2 (수정 후) |
|---|---|---|
| 정상 호출 | `{"content":[],"ok":true,"data":{…}}` — 데이터가 모델에 **도달하지 않음** | `{"content":[{"type":"text","text":"{\"operation\":\"jira-platform-read\"}"}]}` |
| 로그아웃 후 호출 | `{"content":[],"ok":false,…}` · **`isError` 부재** = 성공으로 읽힘 | `{"content":[{"type":"text","text":"connector connection is closed: jira-platform"}],"isError":true}` |

**false success 소멸을 확인했다.** 실패해야 할 때 실패로 보이고, 성공 시 데이터가 모델에 닿는다.

## RED 확인 (신규 테스트가 결함을 실제로 잡는가)

`§2 — 테스트가 있는 기준만 충족으로 센다` 를 한 단계 더 밀어, **테스트가 옛 코드에서 실제로
실패하는지** 확인했다. 통과만 보면 무의미한 테스트도 green 이다.

```
$ (adaptHandler → as never 로 되돌림)  vitest run claude-runtime-tools.boundary.test.ts
  × MCP 형상이 아닌 반환값은 조용한 빈 성공이 아니라 도구 실패가 된다   → 1 failed | 3 passed

$ (취소 throw·D7 가드 되돌림)          vitest run plugin-host.test.ts
  × rejects a cached runtime tool handler after explicit cleanup instead of resolving
  × completes cleanup and allows reconnect even when the runtime tool sink throws on remove
  × aborts an in-flight tool invocation … (3건)                        → 5 failed | 17 passed
```

**정직한 표기**: 경계 4케이스 중 `handler 가 던지면 isError 로 도착한다` 는 옛 코드에서도
통과한다 — SDK 가 원래 throw 를 변환하기 때문이다. 그 케이스는 *결함을 잡는 테스트* 가 아니라
**우리가 의존하게 된 SDK 동작을 고정하는 테스트**다(SDK 업그레이드 시 깨지면 D5-b 전략이
무효가 된다). 결함을 실제로 잡는 것은 형상 가드 1건 + plugin-host 5건이다.

## 게이트 재실행 (r2)

```
$ npm run lint            0 error · warning 1 (0102 TanStack 베이스라인)
$ npm run typecheck       3분할 전부 exit 0
$ ./node_modules/.bin/vitest run
   Test Files  1 failed | 171 passed (172)
        Tests  1498 passed (1498)          ← r1 1480 → +18
   FAIL  src/main/app/chat-turn.continuity.test.ts   (유일 에러 서명: Electron failed to install)
$ node --test "scripts/*.test.mjs"          28/28
$ git diff --stat HEAD~1 -- package.json package-lock.json migrations/    (빈 출력)
```

**실패 테스트 0건.** 잔존 1파일은 electron 바이너리 미설치 베이스라인이며, 에러 서명 전수
집계에서 비-베이스라인 0건이다. 신규 의존성 0 · DB 마이그레이션 0 · IPC 채널 82 불변.

## r2 에서 새로 본 것

| 관찰 | 판단 |
|---|---|
| 구현 중 **내가 쓴 테스트가 저장소 가드 2개에 걸렸다** — `isolation.test.ts`(서비스 리터럴 core 유출)와 `boundaries/dependencies`(shared→features) | **긍정 신호.** 0158 이 세운 가드가 새 코드에 즉시 작동했다. 두 가드 모두 r1 매트릭스에서 ✅ 였는데, 실제 위반 입력으로 발화하는 것을 이번에 처음 봤다 |
| `RuntimeToolResult` 에 `[key: string]: unknown` 이 필요했다 | MCP `CallToolResult` 가 passthrough 라 불가피. **강제되는 것은 `content` 존재**이며 그것이 조용한 빈 성공을 막는 지점이므로 목적은 유지된다 |
| `PluginToolContext.invoke` 는 여전히 `Promise<unknown>` | 의도적. `adapters` 는 `contracts` 를 import 할 수 없어(main DAG) `ConnectorResult` 를 참조할 수 없다. 저자가 좁히는 것이 계약이고, fixture 가 그 방법을 보여준다 |
| 기존 테스트 3건의 단언을 바꿨다(`resolves.toEqual({ok:true,data:null})` → 도구 결과 형상) | **계약 변경에 따른 정당한 수정.** 이 테스트들의 의도는 "in-flight 호출이 abort 후 정착한다" 이고 그 의도는 보존했다. 다만 **테스트를 고쳐 green 을 만든 경우**이므로 여기 명시한다 |

## 검증 책임 분리 (r2 갱신)

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| r1 미충족 10건 해소 대조 | ✅ 실측 | — | 10/10 |
| false success 소멸 (MCP 경계) | ✅ 종단 실측 | — | 확인 |
| 신규 테스트의 RED 확인 | ✅ 옛 코드 되돌려 실행 | — | 6건이 실제로 실패 |
| 게이트 lint/typecheck/test/scripts | ✅ | — | 전부 green |
| **실제 `query()` 서브프로세스에서 모델이 보는 최종 표현** | ✖ | ✅ | 사람 실기 대기 |
| `npm run dev` 기동 + 실 package 연결 라이브 | ✖ | ✅ | 사람 실기 대기 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 검증 자기 리뷰 (r2)

- **설계 단계**: r1 이 새로 세운 P17·P18 이 이번 수정에서 바로 쓰였다 — D4 를 고칠 때 "어느 쪽이
  SSOT 이고 동등성을 무엇이 강제하나" 를 먼저 답했고(P17), 그래서 상수 공유 + 동등성 테스트라는
  형태가 자동으로 나왔다. 패턴 축적이 작동한 사례로 기록한다.
- **구현 단계**: 선조치 경계는 지켰다 — 인수 기준·제품 의도·신규 의존성 변경 0. 기존 테스트
  단언을 3건 바꿨는데, **테스트를 고쳐 통과시킨 것**이므로 위 표에 명시했다(의도 보존 확인함).
- **검증 단계 — 이번에도 못 본 것**:
  - **모델이 실제로 무엇을 읽는지는 여전히 미검증.** MCP 경계까지는 종단 확인했으나, CLI 가
    `isError:true` 를 모델 컨텍스트에 어떻게 문장화하는지는 실기 영역이다. 즉 "실패가 실패로
    *전달된다*" 까지가 내 증거이고, "모델이 실패로 *행동한다*" 는 아니다.
  - **자기 구현의 자기 검증**이라는 구조적 한계는 그대로다. 이번엔 *같은 하네스 전후 비교* 와
    *RED 확인* 으로 그 편향을 상쇄하려 했으나, 두 장치 모두 내가 설계했다는 점은 남는다.
  - 실제 사내 package 는 여전히 0개다. 계약이 옳은지는 **첫 실제 package 를 쓸 때** 최종
    확인된다 — fixture 는 그 대역일 뿐이다.

## 결론 (r2)

- **상태: PASS.** r1 미충족 10/10 해소, 인수 기준 26/26 유지, 게이트 전부 green(테스트 실패 0건,
  1480 → **1498**). r1 이 잡은 false success 는 같은 하네스로 소멸을 실증했다.
- **다음 단계**: `docs/PHASES.md` 승격 · PR #302 머지 검토.
- **사람 실기 대기 3건**: 실제 `query()` 에서 모델이 보는 표현 · `npm run dev` + 실 package 연결
  라이브 · renderer connector 화면(비범위, 후속).

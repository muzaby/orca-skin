# Plan — 0290-simplify-0254-0289

## 메타

| 항목 | 값 |
|---|---|
| slug | `0290-simplify-0254-0289` |
| 작성자 | Claude Code |
| 일자 | 2026-10-30 |
| 매핑 | 사용자 `/handoff-plan` + `/simplify` — 0254~0289 리팩토링, **Plan까지만** · 10-31 보완: 0291 착지분 포함(D-014) |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 기준 커밋 | 범위 기준 `0b3fdeae^` → 설계 시점 HEAD `5ecaefd4` → 좌표 재측정 HEAD `e0318497`(같은 브랜치에 0291 착지, `git cat-file -t` = commit) · 0291 범위 `5ecaefd4` → `e0318497`(app 비테스트 변경은 구현 `88cb0421` 1개, r2 `69fa34f4` 는 테스트만 — 둘 다 `git cat-file -t` = commit) |

## 0. 작성 경로

- **판정: /simplify 4관점(Reuse·Simplification·Efficiency·Altitude)을 따랐고 리뷰 에이전트 대신 설계자가 직접 수행했다.** 4관점 × main/renderer 에이전트 8개가 계정 5시간 사용 한도(HTTP 429)로 두 번 중단돼(01:00·06:00 UTC 리셋) 결과 0건이었다.
- 직접 수행은 기계 스캔 + 표적 읽기다: 미사용 export 스캐너(`scan/dead-exports.cjs`, 기준선 `0b3fdeae^` 트리 대조), jscpd 복제 탐지(min-tokens 35·60), 하네스 리터럴 분기·동기 fs·타이머·i18n 키(`scan/i18n-unreferenced.cjs`)·CSS 토큰 스윕.
- 2차(10-31): 에이전트 재개 3회 중 Efficiency·main 1개만 최종 보고(발견 20 + plan 이견 2)를 냈다. 사용자 지시(D-013)에 따라 그 보고를 HEAD `e0318497` 코드로 하나씩 검증해 채택 16(A1·A5·A14 3건은 일부만)·후속 4·이견 2 반영으로 갈랐고(§10 EP-15~EP-16·§17), 남은 renderer 영역은 설계자가 직접 읽었다(EP-17).
- 3차(10-31, 사용자 턴 4): 0291 착지분(app 비테스트 47파일)의 diff 전체를 같은 4관점 + 최적화로 설계자가 직접 읽었다(D-013·D-014). 0291 이 "0290 영역"으로 넘긴 canonical JSON 3사본을 포함해 19자리를 채택했고(§10 EP-18), 3건은 Skip 했다(§17).
- 표적 읽기 범위와 못 본 범위는 §8 `리뷰 커버리지` 표가 갖는다. 이 plan 은 구현 지시서이고 구현 커밋은 아직 없다(사용자 "Plan까지만 구현할 것").

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0254~0289(커밋 352개, app 비테스트 658파일 +30,616/−4,362)가 쓰이지 않는 코드·하네스별 복붙·고아 IPC·구 조립·주기 폴링·공통 셸의 하네스 분기를 남겼다. 먼저 착지한 0291(app 비테스트 47파일 +1,024/−112)은 기존 규칙의 사본(canonical JSON·variant 필터·CLI 실행)과 조립 뒤 재정렬을 더했다.
- 완료 후 달라지는 것: 규칙마다 SSOT 하나, 하네스 전용 코드는 하네스 디렉터리, 호출자 없는 경로는 사라지고, 플러그인 탭은 폴링 대신 변경 알림으로 갱신된다.
- 성공 한 문장: **사용자가 보는 화면·문구·대화·설정은 그대로이고(D-003), 코드는 줄고, 플러그인 탭은 외부 변경을 기다리지 않고 반영한다(D-007).**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "254~289 핸드오프에 대해 리팩토링을 진행하려한다. 모듈화, 담백, 간결, 깔끔한 코드. 사용하지 않는 코드, 불필요한 구현은 제거해야 한다. /simplify 스킬로 진행하라. Plan까지만 구현할 것" | 라이브 세션 턴 1 |
| 명시 요구 | "1. 최적화도 포함할 것. 2. 과감한 선택할 것" | 턴 1 진행 중 추가 |
| 명시 결정 | 격리 저장소 이관 코드: "레거시 storage가 뭔가" → 설명 후 "삭제 (Recommended)" | AskUserQuestion 2회 |
| 명시 결정 | 고아 IPC 2채널과 main 구현: "제거 (Recommended)" | AskUserQuestion |
| 명시 결정 | 플러그인 탭 5초 폴링: "push로 전환 (Recommended)" | AskUserQuestion |
| 명시 요구 | "에이전트 계속 이어가라" | 라이브 세션 턴 2 |
| 명시 요구 | "이어서 진행하라. 단 서브에이전트로 조사하지 말 것. 사용량이 받쳐주지 못한다. … 이전 서브에이전트의 결과가 있는 경우 활용할 것." | 라이브 세션 턴 3 |
| 명시 요구 | "핸드오프가 먼저 완성되었다. 291까지 고려하여 290 핸드오프 plan을 보완하라" | 라이브 세션 턴 4 (`/handoff-plan`) |
| 추론 의도 | "291까지 고려" = 범위에 0291 구현분을 더하고, 0291 이 비범위로 "0290 영역" 에 넘긴 canonical JSON 3사본을 포함한다. 0291 의 결정·이름·관측 동작은 그대로 — 추론(D-014) | 0291 plan §6 비범위·미룬 항목 표 |
| 추론 의도 | 범위 = Handoff trailer 0254~0289 커밋이 건드린 app 비테스트 소스 + 그 파일 안의 기존 미사용 선언 — 추론(D-011 경계) | `/simplify` 인자 해석 |
| 추론 의도 | "과감한 선택" = 크기(L)·다파일을 이유로 정리를 미루지 않는다. 동작·계약을 바꾸는 항목은 사용자 결정분(D-005~D-007)만 — 추론 | 턴 1 추가 지시 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 이번 턴은 plan READY 까지다. 구현은 다음 handoff-impl 턴, 구현 주체는 Claude | "Plan까지만 구현할 것" · 리팩토링은 Claude 직접 구현(root `AGENTS.md` 협업 분담) | 사용자 턴 1 | ACTIVE | — |
| D-002 | 정리 방법 = /simplify 4관점 + 기계 스캔. 발견마다 HEAD 코드로 재확인하고 동작을 바꾸는 발견은 D-005~D-007 밖이면 뺀다 | "/simplify 스킬로 진행하라" · 스킬 "Skip any finding whose fix would change intended behavior" | 사용자 턴 1 · simplify | ACTIVE | — |
| D-003 | 사용자 관측 동작 보존 — 화면·문구·대화 흐름·남는 IPC 채널의 요청/응답·DB 스키마·영속 키·설정 키 불변 | 리팩토링 정의 · 데이터 무결성 | 설계자 | ACTIVE | 예외 = D-005·D-006·D-007 |
| D-004 | 최적화를 포함하고, 크기·다파일·구조 변경을 이유로 발견을 빼지 않는다 | "최적화도 포함할 것." "과감한 선택할 것" | 사용자 턴 1 추가 | ACTIVE | — |
| D-005 | `orca:session:open-native-plugin`·`orca:session:set-native-resource` 와 그 main 구현 사슬(handler·공유 직렬화·runtime·adapter·harness slot)을 삭제한다. `orca:session:native-resources` 와 변경 알림은 유지 | renderer 호출자 0(§8) · 0286 D-003 "main 정리는 후속 handoff 후보" 의 실행 | 사용자 "제거 (Recommended)" | ACTIVE | 0286 D-003 의 유지 범위 중 위 2채널만 대체 |
| D-006 | OpenCode 격리 저장소 이관(`legacy-storage-migration`·`legacy-resources`·`legacy-schema`)을 삭제한다. native 에 없는 세션은 `missing` 으로 끝난다. 옛 폴더의 파일은 지우지 않는다 | 대상 데이터는 2c12bdfb(2026-10-14) ~ 8c94b449(10-16) dev 빌드에만 존재, 마지막 릴리스 v0.3.1 = 07-16 | 사용자 "삭제 (Recommended)" | ACTIVE | 0262 D-031 SUPERSEDED |
| D-007 | nav → 플러그인 탭의 5초 주기 재조회를 없애고 main 파일 감시의 변경 알림(push)으로 갱신한다. 창 focus 때 1회 재조회는 남긴다 | 감시 메커니즘이 이미 main 에 2벌 있다(§8) · 외부 변경 반영이 더 빨라진다 | 사용자 "push로 전환 (Recommended)" | ACTIVE | 0282 AC28′ "열린 동안은 기존 5초 재조회" 문구 대체 |
| D-008 | 배포 확장점은 production 호출자가 없어도 유지 — `plugins/{confluence,jira,mail}/tools.ts`·`deployment/plugins.ts createPluginBinding`·`deployment/connections.ts harnessRows/usageRows` | `deployment/plugins.ts:80-88` 주석이 배포 예시로 문서화 | 코드 | ACTIVE | — |
| D-009 | 하네스 격리 구조(0264·0278, eslint `harness/ownership`·`version-boundary`·`sdk-version`)를 유지한다. 공통화는 `common/` 으로 올리는 방향만 쓰고 하네스 형제 import 를 만들지 않는다 | `app/scripts/harness-boundary.mjs` | 저장소 규칙 | ACTIVE | — |
| D-010 | 기존 ACTIVE 결정이 잠근 구조는 유지 — 0257 D-005(TooltipHost 1개) · 0259 D-011(CascadeMenu shared/ui + attachMenuModel 순수) · 0262 D-016/D-017(OpenCode 1.x `v1/` 계층) · 0282 D-030/D-031(OpenCode 플러그인 제어 없음·jsonc-parser 없음) | 각 handoff Decision Ledger | 기존 결정 | ACTIVE | — |
| D-011 | 범위 경계 — 범위 커밋이 건드린 파일 안의 기존 미사용 선언은 포함하되, 문서(IPC_CONTRACT 등)가 계약 서술로 인용하는 기존 `shared/ipc.ts` 요청 interface·type 15개와 이름 충돌로 판정이 불확실한 `infra/db/types.ts SessionRow` 는 제외 | 과감한 선택(D-004)과 계약 문서 보존(D-003) 사이 경계 | 설계자 | ACTIVE | — |
| D-012 | spawn 경계의 동기 Claude 플러그인 카탈로그(`readClaudePluginCatalog`)는 동기로 유지하고, spawn 이 아닌 호출자만 비동기 판으로 옮긴다 | 주석 `plugin-catalog.ts:127` "synchronous SDK spawn boundary" | 코드 | ACTIVE | — |
| D-013 | 이후 조사는 서브에이전트 없이 설계자가 직접 한다. 완료된 서브에이전트 보고(Efficiency·main)는 HEAD 코드로 검증한 뒤 채택·후속·제외로 가르고, 저장 포맷·관측 동작을 바꾸는 부분은 D-003 으로 뺀다 | "서브에이전트로 조사하지 말 것" · "이전 서브에이전트의 결과가 있는 경우 활용할 것" | 사용자 턴 3 | ACTIVE | — |
| D-014 | 범위에 0291 착지분을 더한다 — `88cb0421` 이 바꾼 app 비테스트 47파일과 0291 이 0290 으로 넘긴 기존 canonical JSON 3사본. 0291 ACTIVE 결정 D-001~D-021·이름(0291 D-020)·관측 동작은 유지한다(D-003) | "핸드오프가 먼저 완성되었다. 291까지 고려하여 290 핸드오프 plan을 보완하라" · 0291 plan §6 "기존 canonical JSON 사본 3곳 통합(0290 영역)" | 사용자 턴 4 | ACTIVE | — |
| D-015 | 0291 배포 확장점도 D-008 과 같이 유지 — 가이드 §4 레시피가 쓰는 `runtime-listing.ts`(`listedModelsOf`·`runtimeModelsFromListing`)·`createConfigApiAugmenters`·`HostHarnessPort`·`LoginFreeConnect(Context)`·`AuthRuntime.connectionValue` 는 production 호출자가 없어도 지우거나 합치지 않는다 | `docs/guides/closed-network-extensions.md:936-947` 레시피 · 0291 D-001(mainline 은 인프라만) | 코드·문서 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-012(최초 작성) · D-013(2차, 사용자 턴 3) · D-014·D-015(3차, 사용자 턴 4). OPEN 0.
- 3차 대조: D-014 ↔ AC23 — AC23 은 0291 이름(wire `ProviderInfo.connection`·채널 `orca:provider:connect`·`AuthRuntime` 메서드)과 화면을 바꾸지 않고, 영속되는 background journal key 바이트를 고정한다(EP-18 #2). D-015 ↔ AC2·AC23 — 배포 확장점을 지우거나 합치라는 AC 없음. 0291 D-017(Orca 그룹 맨 위) ↔ AC23 — 순서 결과는 같고 만드는 방법만 바뀐다(EP-18 #18-19).
- SUPERSEDED 로 표시할 외부 결정: 0262 D-031(D-006) · 0282 AC28′ 의 "5초 재조회" 문구(D-007) · 0286 D-003 의 2채널 유지분(D-005). 각 원본 plan 은 고치지 않는다(과거 증거).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — AC1 이 D-003 을, AC4·AC5 가 D-005 를, AC6 이 D-006 을, AC11·AC12 가 D-007 을 관측한다. D-008 대상 파일·D-011 제외 선언을 삭제하라는 AC 없음(AC2 목록 대조). D-012 ↔ AC10·AC21: 두 AC 모두 spawn 경로(`adapter.ts:448`·`:619`)를 비동기로 바꾸라고 요구하지 않는다(AC21 의 기본값 읽기도 동기 유지). D-003 ↔ AC20: AC20 은 `native_history_snapshots.payload_json` 포맷을 바꾸지 않는다(에이전트 제안 (c) 제외). D-013 ↔ AC20~AC22: 채택분만 AC 로 올렸고 후속 4건은 §17.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 원인을 겨냥하는가 | 타당 | 같은 규칙이 2~5곳에 복제(§8 전수 조사) · 호출자 0 경로 실측 |
| 이미 충족됐는가 | 부분 — 하네스 capability 표·표면 registry 가 이미 있다 | `src/shared/harness.ts:6` `HARNESS_CAPABILITIES` · `features/chat/harnesses/catalog.ts` `harnessCatalog` |
| 더 작은 해법 / 제거 자체가 맞는가 | 제거 대상은 "능력이 없어도 되는가" 로 판정 — 고아 IPC 는 화면이 이미 없다(0286), 이관은 데이터가 릴리스된 적 없다 | D-005 · D-006 근거 |
| 선행 자료 대조 | 0286 D-003 이 남긴 main 표면을 코드로 재확인 — renderer `sessionApi.openNativePlugin`·`setNativeResource` 호출 0 | §8 |
| 기존 결정 충돌 | D-005~D-007 이 기존 결정 3개를 대체 — 사용자 승인 | §3 |
| 0291 착지 후에도 맞는가 | 맞다 — 0291 신규 export 중 미사용 0, 대신 기존 규칙의 사본·사후 재정렬이 생겼다 | §8 전수 조사 · §10 EP-18 |

- 사용자에게 올릴 결정: 없음(3건 질의 완료).
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

```text
[대화·컴포저·nav·설정·플러그인 탭 조작]
  → [정리된 SSOT 헬퍼 · 하네스 registry 슬롯 경유]
  → [변경 전과 같은 화면·IPC 응답·DB 쓰기]
  ↘ 달라지는 3곳: 플러그인 탭 갱신 시점(D-007) · 격리 세션 재열기(D-006) · 고아 IPC 부재(D-005, 사용자 관측 0)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 플러그인 탭이 열린 동안 터미널에서 플러그인 추가·삭제 | main 감시가 지문 변화를 보고 `orca:extensions:changed` 1회 방송 → 탭이 해당 하네스 1회 재조회 | 목록이 다음 감시 주기 안에 바뀐다(기존: 최대 5초 주기) |
| 플러그인 탭이 열린 동안 변화 없음 | 주기 재조회 없음 | 화면 그대로, IPC 0 |
| 창 focus 복귀 | 두 하네스 1회 재조회 | 놓친 변경 복구(안전망) |
| 플러그인 토글 처리 중 push 도착 | 0284 D-007 잠금 동안 그 하네스 재조회 보류(기존 `refresh` 의 locks 검사 유지) | 플리커 없음(0284 D-003 유지) |
| native 에 없는 OpenCode 세션 재열기 | 이관 시도 없이 `missing` | 기존 "OpenCode 원본 세션을 찾을 수 없습니다." 상태 |
| 그 밖의 모든 조작 | 정리 전과 같은 경로 | 변화 없음(D-003) |

### 파생 UX / 엣지케이스

- error: 플러그인 탭 재조회 실패 표시(`failed`)·토스트 규칙 불변. 감시 실패는 기존 `failed(error)` 경로(로그)로만 간다.
- cancel/retry/close: 탭 unmount 시 구독 해제. focus 재조회는 unmount 후 무시(기존 `mounted` 가드).
- concurrency: push 와 토글이 겹치면 토글 잠금이 우선(0284 D-007·D-009 유지).
- theme/a11y: 로고·하네스 표시명·CwdPanel 클래스는 같은 SVG·같은 클래스 문자열이다(AC14·AC16).

## 6. 범위 / 비범위

- **범위**: §11 의 작업 묶음 WP-1~WP-14(WP-14 = 0291 착지분, D-014).
- **비범위**: §17 Skip 표(동작 변경·별도 설계 필요·기존 결정 잠금).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| chatReducer 의 OpenCode 전용 UI 상태(`openCodeTodoCollapsed`·`selectedProcessToolId`)를 OpenCode store 로 이동 | 아니오 | NEXT_HANDOFF 후보(§17) |
| `shared/ipc.ts` 기존 요청 interface·type 15개 | 아니오 — 문서 인용 정리와 함께 | D-011, 후속 docs 정리 후보 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 정리 후 기존 동작이 같다 | `vitest run --reporter=json` 실패 ID − `baseline/vitest-failed-ids.txt` = ∅ · `npm run typecheck` 오류 0 · `eslint ./src ./scripts` error 0, warning ⊆ 기준선 2건 · Windows CI(`.github/workflows/ci.yml`) green | 전 모듈 기존 호출부 |
| MD-01 | UT-01 / AC2 | §10 VP-08 목록의 미사용 심볼·파일이 남지 않고, 정리가 새 미사용 export 를 만들지 않는다 | VP-08 자리 검색 각 0건 · `scan/dead-exports.cjs` 결과의 dead·test-only `(name, kind)` 집합 ⊆ `baseline/dead-exports.tsv` 의 같은 범주 − 삭제 목록(파일 경로는 EP-06 이동을 적용해 비교) | 정적 |
| MD-01 | UT-01 / AC3 | 미참조 i18n 키 14개와 CSS 토큰 3개가 ko·en·두 테마에서 사라지고 새 미참조 키가 생기지 않는다 | `scan/i18n-unreferenced.cjs --absent baseline/i18n-remove-keys.txt` exit 0(설계 시점 present 14·exit 1) · 전체 스캔 출력 ⊆ `baseline/i18n-unreferenced.txt`(64) − 제거 8 · VP-08 토큰 검색 0 · typecheck(en `typeof ko` 패리티) | `tr()` · Tailwind 토큰 |
| AR-01 | IT-01 / AC4 | 고아 IPC 2채널과 사슬이 없고 `orca:session:native-resources` 응답은 같다 | VP-04 자리 검색 0 · `session-resources*.test.ts` 4파일 green · `check-doc-inventory --check` green | Composer → `sessionApi.nativeResources` → handler → runtime |
| AR-01 | IT-01 / AC5 | 프로젝트 리소스 감시·재적용의 키별 직렬화가 `NativeResourceSharing` 없이 유지된다 | `project-resource-sync.test.ts` green + 신규 직렬화 케이스(§10 VP-04) | `ProjectResourceSync.run` |
| R-03 | AT-03 / AC6 | native 에 없는 OpenCode 세션은 이관 없이 `missing` | 신규 `native-history.test.ts` 케이스: 404 → `{status:'missing'}` · VP-03 자리 검색 0 | `readHistory` → `readOpenCodeHistory` |
| MD-02 | UT-02 / AC7 | 규칙 SSOT(main·하네스 공통): JSON 객체 읽기 4자리 · git 루트 탐색 3자리 · 플러그인 활성 플래그 4자리 · 플러그인 spec 3자리 · re-export shim 0 | VP-09 자리 검색(구 사본 0 · 헬퍼 사용 N) · 헬퍼 단위 테스트 · 자리별 소비 테스트 | 부팅·spawn·메뉴 |
| MD-03 | UT-03 / AC8 | OpenCode 연결 계층 SSOT: abortable fetch 1 · managed source 술어 1 · dispose 실패 보고 1 · 프로젝트 범위 키 1 · 세션 binding 가드 1 · 위치 인자 12·11개 생성자/등록 함수 → options 객체 | VP-10 자리 검색 · 기존 `session-context.test.ts`·`adapter*.test.ts` green + 신규 단위 테스트 | 연결 lease · bootstrap 조립 |
| AR-02 | IT-02 / AC9 | composer catalog production 조립이 하나다 | `registerComposerCatalog`·`prepareComposerCatalog` 0건 · `composer-catalog.test.ts` 케이스가 `createComposerPreparation` 으로 실행 | `orca:composer:catalog` |
| MD-04 | UT-04 / AC10 | OpenCode `nativeResources` 1회 요청당 `config.get` 1회 · 명령 재고(inventory) 읽기의 skills·config 병렬 · spawn 밖 Claude 카탈로그 읽기 비동기 | 신규 fake client 호출 수 단언 · deferred 동시성 단언 · VP-11 동기 fs 검색 | channel `nativeResources` · `skill-catalog` · `configuredClaudeCommands` |
| R-02 | AT-02 / AC11 | 플러그인 탭이 주기 재조회 없이 push·focus 로 갱신된다 | 신규 `useNativeMcpCatalog.test.ts` 케이스 3(주기 0 · push 1회 · focus 1회) | 감시 → broadcast → preload → 훅 |
| AR-04 | IT-04 / AC12 | main 파일 감시가 한 메커니즘이고 변경마다 방송 1회 | `watchFile(` 자리 1 · 신규 감시 단위 테스트(지문 동일 → 0 · 변화 → 1) · `opencode-global-watch`·`project-resource-sync` 테스트 green | `FingerprintWatch` |
| AR-03 | IT-03 / AC13 | 하네스 전용 app 모듈 5개가 `app/harnesses/{claude,opencode}/` 아래 있고 공통 모듈이 그것을 import 하지 않는다 | VP-06 자리 검색 · `npm run lint`(harness/ownership) green + 경계 위반 변이 red | bootstrap 조립 |
| MD-05 | UT-05 / AC14 | 하네스 브랜드 마크가 한 컴포넌트에서 나오고 shim·중복 파일 5개가 없다 | VP-12 자리 검색 · 신규 렌더 테스트(하네스별 SVG viewBox·클래스) | nav·엔진·플러그인·컴포저 |
| MD-05 | UT-05 / AC15 | 하네스 짧은 표시명(`Claude`·`OpenCode`)이 `HARNESS_CAPABILITIES[backend].shortLabel` 한 곳에서 나오고 문자열은 그대로다 | VP-12 리터럴 삼항 0 · 신규 `harness.test.ts` shortLabel 값 · 기존 `ChatTitleBar`·엔진 테스트 green | 대화 복사 · 엔진 화면 |
| MD-06 | UT-06 / AC16 | `CwdPanel` 과 Composer 랜딩 배치가 하네스 이름 분기 없이 registry 슬롯을 읽고 결과 클래스가 같다 | VP-13 자리 검색 0 · `CwdPanel.*.test.ts` 3파일 green + 신규 클래스 동일성 테스트 | 랜딩 · 대화 Composer |
| MD-06 | UT-06 / AC17 | chatStore·chatReducer 의 하네스 능력 판정이 capability 표 조회다(작업 종류·연속성·하위 작업 타일·권한 모드) | VP-13 자리 검색 · 신규 capability 표 단위 테스트 · chatStore 27파일 green | 랜딩 · 분기/핸드오프 · 하위 작업 열기 |
| MD-07 | UT-07 / AC18 | ProviderForm 모델·헤더 행 편집이 한 컴포넌트, ScrollController 앵커 측정이 프레임당 1회 | VP-14 자리 검색 · `ProviderForm.interaction.test.ts`·`ScrollController.interaction.test.ts` green + 신규 rAF 케이스 | 엔진 추가 · OpenCode transcript |
| MD-08 | UT-08 / AC20 | native 이력 재열기·갱신의 낭비가 없다: 원본이 그대로면 OpenCode 서버 연결·HTTP 0회 · refresh 경로 payload 파싱 1회 · 콜드 전송은 보관 previous 로 unchanged 경로 · 메시지 갱신은 바뀐 행만 쓰기 · 이력 쿼리 statement 1회 준비 | §10 VP-15 자리별 신규 케이스 · 기존 `native-history.test.ts`·`native-history.db.test.ts`(DB 스위트는 Windows CI 판정) | 세션 열기 → refresh → readHistory · 콜드 전송 |
| MD-09 | UT-09 / AC21 | main 효율 2차: tick 당 대상 계산 1회 · `skills:list` 동시 호출 1스캔 · Claude 전송 기본값 읽기 settings 1개 · `~/.claude.json` 파싱 공유 · Claude 이력 탐색 병렬·해시 1패스 · 스킬 카탈로그 realpath 1회 · OpenCode 이벤트 id 집합 상한 · OpenCode 스킬 루트 1회 계산 · 서버 프로필 identity 1회 · SSE 경로 정규화 1회 · managed MCP 읽기 비복제 | §10 VP-16 자리별 신규 케이스 | 부팅·메뉴·전송·스트림 |
| MD-10 | UT-10 / AC22 | renderer 2차: OpenCode 우측 패널 모델 계산이 같은 입력에 1회(구성요소 수와 무관) · 선택 하위 작업 파생 1곳 · composer catalog 만료·실패 판정 1곳 · 감속 모션 판정 shared 훅 1곳 | §10 VP-17 | OpenCode 우측 패널 · 컴포저 |
| MD-11 | UT-11 / AC23 | 0291 착지분 정리: canonical JSON 1벌(3자리) · OpenCode 활성 variant 규칙 1벌(3자리) · 지역 `isRecord` 사본 0 · OpenCode CLI 실행 1벌(3자리) · `OpenCodeServer` 선택 멤버·가드 0 · 연결 상태 wire 변환 1벌(2자리) · 로그인 프리 snapshot 분기 1곳 · `+` 메뉴 Orca 그룹을 사후 재정렬 없이 맨 앞에 조립. 영속 journal key 바이트·화면 순서·wire 형상 불변 | §10 VP-18 자리별 좌표 + 0291 종단 `opencode-connection-deployment.test.ts` 3케이스(R-01 차집합에 포함) | 해시·fingerprint 계산 · 연결 확인 → 플러그인 탭 · Composer `+` 메뉴 · OpenCode 서버 CLI |
| — | — / AC19 | 삭제·이동·신설한 컴포넌트와 채널이 정본 문서와 맞다 | VP-08·VP-04 문서 자리 검색 · `node scripts/check-doc-inventory.mjs --check` | `docs/arch/**` · `docs/IPC_CONTRACT.md` |

### AC 검증 주의사항

- 기존 테스트 재사용: 파일 존재는 §8 표에서 확인했다. 케이스명 좌표는 §7-A 각 pair 와 §10 에 적고, 구현자가 새로 만드는 케이스는 파일·진입점·구별 입력·관측 대상을 §10 에 적었다.
- 사람 실기: 없음 — 시각은 클래스 문자열 동일성 테스트로 내렸다(AC14·AC16). Windows 전용 동작은 CI 가 판정한다(AC1).
- 0건/전수 기준: 삭제 자리는 "없다" 가 불변식이다. SSOT 자리는 구 사본 0(음성) + 헬퍼 사용 N(양성) + 헬퍼 고장 변이 red(방향)로 묶는다(§5 방향 규칙).
- 기준선: `baseline/vitest-failed-ids.txt` 338 ID(케이스 309 + 파일 단위 29, HEAD `e0318497` · 876파일 8,121케이스)는 Linux · `ELECTRON_SKIP_BINARY_DOWNLOAD=1` · better-sqlite3 Electron ABI 환경의 실측이다. 다른 환경이면 구현 전에 같은 명령으로 기준선을 다시 뜬다.
- 흔들리는 기준선 1건: `infra/loopback-callback.test.ts` `경로가 다른 요청(favicon 등)…` 은 `5ecaefd4` 측정에서 실패·`e0318497` 측정에서 통과했다(프록시 환경의 loopback fetch). 차집합에 나타나면 같은 명령 재실행 1회로 판정한다.
- AC23 의 golden 값(EP-18 #2)은 **구현 전 HEAD 코드로 계산해** 테스트에 박는다 — 바꾼 코드로 계산하면 영속 key 호환을 증명하지 못한다. `app/composer-catalog.test.ts` 기존 케이스는 Linux 기준선 red(`C:\\draft-project` 전제)라 EP-18 #3 신규 케이스는 플랫폼 절대 경로(`tmpdir()`)로 만든다. EP-18 의 기존 oracle 파일 13개는 Linux 기준선 실패 0 이다(`baseline/vitest-failed-ids.txt` 대조). EP-09 #11 의 `project-reconciliation.test.ts` 는 `shows external selection…` 1케이스가 기준선 red 라, 신규 케이스는 그 케이스의 fixture 에 기대지 않게 만든다.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 V 없음.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair 이관: 해당 없음(외부 handoff 결정 대체는 §3).
- 변경이 시작되는 수준: R(플러그인 탭 갱신 시점·격리 세션) · AR(IPC 표면·조립·감시·모듈 위치) · MD(SSOT·능력 표·효율).

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 |
|---|---|---|---|---|
| R-01 / AT-01 | R/AT | 관측 동작 보존(D-003) §7 AC1 | NEW | — |
| R-02 / AT-02 | R/AT | 플러그인 탭 push 갱신(D-007) §5 · AC11 | NEW | 0282 AC28′ 문구 대체 |
| R-03 / AT-03 | R/AT | 격리 세션 `missing`(D-006) · AC6 | NEW | 0262 D-031 대체 |
| AR-01 / IT-01 | AR/IT | IPC 표면 − 2채널, 직렬화 유지(D-005) · AC4·AC5 | NEW | 0286 D-003 |
| AR-02 / IT-02 | AR/IT | composer catalog 단일 조립 · AC9 | NEW | — |
| AR-03 / IT-03 | AR/IT | 하네스 전용 app 모듈 위치 · AC13 | NEW | — |
| AR-04 / IT-04 | AR/IT | 공용 파일 감시 + 변경 방송 · AC12 | NEW | — |
| MD-01 / UT-01 | MD/UT | 미사용 코드·키·토큰 삭제 · AC2·AC3·AC19 | NEW | — |
| MD-02 / UT-02 | MD/UT | main 규칙 SSOT · AC7 | NEW | — |
| MD-03 / UT-03 | MD/UT | OpenCode 연결·조립 SSOT · AC8 | NEW | — |
| MD-04 / UT-04 | MD/UT | main 효율 · AC10 | NEW | — |
| MD-05 / UT-05 | MD/UT | 하네스 브랜드·표시명 SSOT · AC14·AC15 | NEW | — |
| MD-06 / UT-06 | MD/UT | 공통 셸의 하네스 분기 → 슬롯·capability · AC16·AC17 | NEW | — |
| MD-07 / UT-07 | MD/UT | renderer 단순화·효율 · AC18 | NEW | — |
| MD-08 / UT-08 | MD/UT | native 이력 갱신 효율 · AC20 | NEW | — |
| MD-09 / UT-09 | MD/UT | main 효율 2차 · AC21 | NEW | — |
| MD-10 / UT-10 | MD/UT | renderer 2차 · AC22 | NEW | — |
| MD-11 / UT-11 | MD/UT | 0291 착지분 SSOT·조립 순서 · AC23 | NEW | 0291 plan §6 비범위(canonical 3사본) · 0291 D-017 결과 유지 |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 전 진입점 → 기존 호출부 | `gate:vitest 실패 ID 차집합`·`gate:npm run typecheck`·`gate:eslint` | not selected — 집계 pair | 0 — 집계 |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 외부 파일 변경 → FingerprintWatch → `orca:extensions:changed` → preload → `useNativeMcpCatalog` → `globalExtensions` | §10 VP-02 3자리 | required — `setInterval` 복원 변이·방송 구독 제거 변이 | EP-02 (3) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `OpenCodeAdapter.readHistory` → `readOpenCodeHistory` 404 | §10 VP-03 | not selected — 직접 결과 단언 | EP-03 (2) |
| VP-04 | AR-01 ↔ IT-01 | REQUIRED | renderer `sessionApi` → preload → `CHANNELS` → `registerSessionResourceHandlers` → runtime → adapter | §10 VP-04 | required — 0건 스윕 민감도: 삭제 대상 1개 복원 시 gate red | EP-04 (자리 표) |
| VP-05 | AR-02 ↔ IT-02 | REQUIRED | `bootstrap` → `createComposerPreparation` → `registerComposerCatalogHandlers` | §10 VP-05 | not selected — 기존 케이스가 production 조립으로 이동 | EP-05 (3) |
| VP-06 | AR-03 ↔ IT-03 | REQUIRED | `bootstrap` → `app/harnesses/*` 모듈 | `gate:npm run lint` | required — 공통 모듈에서 이동 모듈 import 변이 → lint red | EP-06 (5) |
| VP-07 | AR-04 ↔ IT-04 | REQUIRED | `watchFile` → 지문 → `changed(revision)` | §10 VP-07 | required — 지문 비교 제거 변이(중복 방송) | EP-07 (자리 표) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | 정적 | `gate:` 자리 검색 0 · `gate:scan/dead-exports` · `gate:scan/i18n-unreferenced` | required — 0건 스윕 민감도: 삭제 심볼 1개 복원 시 각 gate red | EP-08 (자리 표) |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | 부팅·spawn·메뉴 → 헬퍼 | §10 VP-09 | required — 헬퍼 고장 변이(BOM 미제거·ENOENT 전파·git 탐색 1단계 고정) → 자리별 테스트 red | EP-09 (자리 표) |
| VP-10 | MD-03 ↔ UT-03 | REQUIRED | lease 획득·요청 fetch·MCP 선택·bootstrap 조립 | §10 VP-10 | required — 술어 반전 변이 | EP-10 (자리 표) |
| VP-11 | MD-04 ↔ UT-04 | REQUIRED | channel `nativeResources` · `openCodeNativeCommands` · `skill-catalog` | §10 VP-11 | required — config 2회 읽기 복원 변이 · 순차 await 복원 변이 | EP-11 (자리 표) |
| VP-12 | MD-05 ↔ UT-05 | REQUIRED | 화면 → `HarnessLogo` / `HARNESS_CAPABILITIES.label` | §10 VP-12 | required — 하네스 맞바꿈 변이(claude↔opencode 마크·색) | EP-12 (자리 표) |
| VP-13 | MD-06 ↔ UT-06 | REQUIRED | Composer·CwdPanel·chatStore·chatReducer → registry 슬롯·capability | §10 VP-13 | required — 슬롯 값 맞바꿈 변이 | EP-13 (자리 표) |
| VP-14 | MD-07 ↔ UT-07 | REQUIRED | 엔진 추가 폼 · OpenCode transcript 스크롤 | §10 VP-14 | not selected — 직접 상호작용 단언 | EP-14 (자리 표) |
| VP-15 | MD-08 ↔ UT-08 | REQUIRED | `handlers/session.ts` load/refresh → `refreshNativeHistory` → adapter `readHistory` · 콜드 `ensureNativeSession` → `readHistory` · `NativeHistoryQueries.replace` | §10 VP-15 | required — probe 순서 뒤집기(client 먼저) 변이 · 전체 DELETE 복원 변이 | EP-15 (자리 표) |
| VP-16 | MD-09 ↔ UT-09 | REQUIRED | tick · `skills:list` · Claude `sendMessage` · 감시 콜백 · 이력 읽기 · SSE 루프 · MCP 술어 | §10 VP-16 | required — 자리별 "반복 복원" 변이(호출 수 단언이 red) | EP-16 (자리 표) |
| VP-17 | MD-10 ↔ UT-10 | REQUIRED | OpenCode 우측 패널 4구성요소 → 모델 계산 · composer catalog 응답 처리 · 감속 모션 판정 | §10 VP-17 | required — 공유 memo 제거 변이(계산 횟수 단언 red) | EP-17 (자리 표) |
| VP-18 | MD-11 ↔ UT-11 | REQUIRED | fingerprint·journal key·preparation key 계산 · 설정/CLI/SDK 모델 파싱 · `OpenCodeServerPool` CLI · `AuthRuntime.snapshot`·`bindLoginFreePlugin`·`connect` → `connection-views`·handler · `buildAttachMenu` | §10 EP-18 자리별 좌표 | required — 자리별 되돌리기 변이(`JSON.stringify` 복원 · 필터 제거 · CLI args 바꿈 · 헬퍼 두 분기 맞바꿈 · `?? null`→`?? ''` · 그룹 정렬 제거 · `push`→`unshift`) | EP-18 (19) |

### 현재 변경의 운영 gate

| Gate | 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| typecheck | app 소스 변경 | `cd app && npm run typecheck` | 오류 1건 이상 = blocking |
| lint | boundaries·harness 경계 | `cd app && ./node_modules/.bin/eslint ./src ./scripts`(트리 변경 없음) | error 1건 이상 · warning 이 기준선 2건 밖 |
| vitest | 동작 보존 | `cd app && ./node_modules/.bin/vitest run --reporter=json --outputFile=<r>` → `node docs/handoff/0290-simplify-0254-0289/scan/vitest-failed-ids.mjs <r>` − 기준선 | 차집합 1건 이상 |
| scripts | 감시·경계 스크립트 | `cd app && node --test scripts/*.test.mjs` | 신규 실패 |
| doc-inventory | IPC 채널·문서 링크 | `cd app && node scripts/check-doc-inventory.mjs`(재생성) 후 `--check` | 불일치 |
| CI | Windows 전용 경로 | PR 의 `ci.yml` windows-latest | red |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| renderer 가 `openNativePlugin`·`setNativeResource` 를 부르지 않는다 | `rg "\.setNativeResource\(|\.openNativePlugin\(" app/src/renderer` = `shared/api/ipc.ts:251-254` 정의만 |
| OpenCode `setNativeResource` 는 항상 throw 한다 | `opencode/v1/mcp-control.ts:211-215` `set()` |
| `NativeResourceSharing.run` 은 `ProjectResourceSync` 도 쓴다 — 나머지(scope·peers·changed·shareNativeResource)는 set 경로 전용 | `app/bootstrap.ts:1147` · `native-resource-sharing.ts:53` |
| Claude `resources.set` 은 프로젝트 재조정도 쓴다 — 삭제 대상 아님 | `claude/adapter.ts:848-854` `ClaudeProjectReconciliation` |
| 격리 이관은 `readOpenCodeHistory` 의 404 분기에서만 호출된다. `migrate` 가 없으면 이미 `missing` 을 돌려준다 | `opencode/v1/native-history.ts:189-196` |
| `migration-required` 상태는 이관 밖에서도 생산된다 — 유지 | `native-history.ts:204`·`:237` · `features/history/native-sync.ts:103` · `shared/ipc.ts:1615` |
| composer catalog 구 조립은 테스트만 쓴다 — production 은 `createComposerPreparation` | `app/composer-preparation.ts:8-17` · `app/composer-catalog.ts:92` |
| 플러그인 탭 5초 폴링은 기존 문서화 동작 | `features/skills/hooks/useNativeMcpCatalog.ts:72` · 0282 plan:797 |
| main 파일 감시 2벌 | `app/opencode-global-watch.ts:29`(1s) · `app/project-resource-sync.ts:151-154`(250ms) |
| 하네스 capability 표가 이미 있다 | `src/shared/harness.ts:6-16` (`label`·`agentKinds`·`nativeAgents`) |
| 하네스 표면 registry 가 boolean 인자를 받는다 | `features/chat/harnesses/presentation.ts:3` `harnessSurfaces(openCode: boolean)` |
| 하네스 로고 shim 은 shared/ui 로고의 1줄 re-export | `harnesses/claude/Logo.tsx:1` · `harnesses/opencode/Logo.tsx:1` |
| PlanTile 2벌은 i18n 키 2개만 다르고 그 키는 catalog 가 이미 보유 | `harnesses/{claude,opencode}/rightpanel/PlanTile.tsx` · `harnesses/catalog.ts` `planEmptyDescription`·`planSelectHint` |
| `--color-oc-background`·`--color-oc-bubble(-ink)` 는 "쓰지 않음" 을 단언하는 테스트만 참조 | `ChatTile.harness.test.ts:78,81` · `TranscriptView.harness.test.ts:93-94` (0262 D-011·D-020) |
| 배포 확장점은 test-only 가 정상 | `app/deployment/plugins.ts:80-88` (D-008) |
| 0291 이 canonical JSON 3사본 통합을 0290 으로 넘기고 `canonicalJson` 1벌을 새로 만들었다 | 0291 plan §6 비범위·미룬 항목 표 · `shared/obj.ts:14`(소비 `features/auth/login-free-connection.ts:139` 1곳) |
| background journal key 는 DB 에 저장되는 sha256 이다 — 정규화 바이트가 같아야 한다 | `infra/db/background-task-queries.ts:19-25` → `:51` `eventKey` → `background_task_events.event_key`(migration 0027 UNIQUE 의 한 축) · 세 사본과 `canonicalJson` 은 모두 `Object.keys().sort()`(UTF-16 순)·배열 순서 유지라 JSON 입력의 출력이 같다 |
| env fingerprint·composer preparation key 는 프로세스 안에서만 쓰인다 | `adapters/common/harness-config.ts:68` `randomBytes(32)` HMAC 키 · `app/composer-catalog.ts:72-80`(현재 `localeCompare` 정렬 — 값만 바뀌고 같은 입력 = 같은 키는 유지) |
| `OpenCodeServer` 의 선택 멤버 2개는 production 구현이 항상 제공한다 — 가드는 fake 전용 | `opencode/v1/server.ts:243` `retireAll` · `:425` `listModels` · typed fake 3곳(`native-history.test.ts:540`·`opencode-continuation.test.ts:175`·`managed-mcp-lifecycle.test.ts:40`) |
| OpenCode 버전 probe·db path 오류는 메시지만 소비된다 — `OpenCodeCliError` 로 감싸도 관측이 같다 | `rg -n "\.code\b|ENOENT|ExecFileException" app/src/main/adapters/opencode/v1/server.ts` = 0 |
| `+` 메뉴의 Orca 최상단(0291 D-017)은 같은 함수가 앞서 만든 순서를 뒤에서 되돌린다 | `features/chat/lib/attachMenuModel.ts:189` native 묶음 `unshift` → `:202` `orcaGroupFirst` · 스킬 그룹은 입력 순서 → `:199` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 범위 커밋 | `git log --format='%(trailers:key=Handoff,valueonly)'` 0254~0289 매칭 | 352 | 기준 `0b3fdeae^` 이후 376커밋 중 비범위 24(0232·0003·handoff 메타) |
| 범위 app 비테스트 diff | `git diff -M50% --numstat 0b3fdeae^ HEAD -- <scope>` | 658 | A308·M173·R165·D12, +30,616/−4,362 |
| 미사용 export (HEAD `e0318497`, app/src 전체) | `scan/dead-exports.cjs` | 44 / 52 | dead / test-only — `baseline/dead-exports.tsv` |
| 그중 범위 생산·사망 | 기준선 트리 대조 | ADDED dead 3 · ADDED test-only 4 · MADE-DEAD 5 | §10 VP-08 |
| 범위 추가 i18n 키 | ko.ts 평가 대조(`0b3fdeae^` vs HEAD) | 148 | 미참조 14(§10) |
| 범위 추가 CSS 토큰 | tokens.css diff | 44 | 미사용 3(나머지 9 중 6은 Tailwind `--text-*--*` 짝 변수) |
| 정확 복제(jscpd ≥35 토큰) | `jscpd --min-tokens 35 --min-lines 4` | 66 | 범위 파일이 한쪽 이상, 채택분 §11 |
| 공통 renderer 하네스 리터럴 분기 | `rg "=== 'opencode'|openCode \?" …` | CwdPanel 11 · chatStore/Reducer 10 · openCodeLanding 11 | §10 VP-13 |
| main 공통 하네스 리터럴 | 같은 검색(app/bootstrap 제외) | 10 | 대부분 하네스 전용 모듈 — 위치 이동(AR-03) |
| 동기 fs (main 범위 추가) | diff 추가 줄 `readFileSync|statSync|…` | 30 | spawn 밖 메뉴 경로만 비동기화(D-012) |
| 주기 타이머 (renderer 범위 추가) | `setInterval(` | 1 | `useNativeMcpCatalog.ts:72` (D-007) |
| 0291 app 비테스트 diff | `git diff -M50% --numstat 5ecaefd4 e0318497 -- app ':!*.test.*' ':!*testfixture*'` | 47 | +1,024/−112, 전부 `88cb0421` |
| 0291 신규 export 의 미사용 | `baseline/dead-exports.tsv`(HEAD `e0318497`) ∩ 0291 파일 | 0 | dead·test-only 추가 0 — 신규 export 는 local-only·test+local 뿐 |
| 0291 추가 i18n 키 | `baseline/i18n-unreferenced.txt` 대조 | 3 | 미참조 0(`status.checking`·`status.failed`·`reconnect`) |
| 0291 규칙 사본·사후 재정렬 | §10 EP-18 규칙 8종의 자리 검색 | 19 | 채택 19 · Skip 3(§17) |

### 리뷰 커버리지

| 영역 | 상태 |
|---|---|
| main `adapters/opencode/v1` session-context·adapter·channel·composer-cache·native-resources·mcp-control·native-history(분기) | 표적 읽기 완료 |
| main `adapters/claude` plugin-catalog·configured-resources·project-path·native-resources(set) | 표적 읽기 완료 |
| main `app` bootstrap(리소스 조립)·handlers/session-resources·extension-catalog·composer-catalog 계열·native-resource-sharing | 표적 읽기 완료 |
| renderer 브랜드·CwdPanel·chatStore/Reducer 분기·ProviderForm·useNativeMcpCatalog·ScrollController·PlanTile | 표적 읽기 완료 |
| main `adapters/opencode/v1` server·server-profile·instance-lifecycle·discovery-cache·map·activity·skill-sources · `features/extensions/common/mcp/{bridge,managed-source}.ts` · `app/{project-resource-sync,opencode-mcp-reconcile,skill-catalog}.ts` · `features/history/native-sync.ts` · `infra/db/native-history-queries.ts` · `adapters/claude/{native-history,project-settings}.ts` | 2차 — Efficiency·main 에이전트 보고를 설계자가 HEAD 코드로 검증(D-013) |
| renderer OpenCode composer dock(QuestionDock·TodoDock·Controls·composerCatalogState) · rightpanel tiles · `shared/ui/CascadeMenu`·`cascadeMenuState`·`tooltipController` | 2차 — 설계자 직접 읽기. CascadeMenu·툴팁 컨트롤러는 순수 상태/주입 env 구조로 깨끗(D-010 잠금) |
| 0291 착지분 app 비테스트 47파일(main 25 · renderer 17 · shared 4 · preload 1) | 3차 — 설계자가 diff 전체(2,261줄)를 4관점 + 최적화로 직접 읽었다(D-013·D-014) |
| 그 밖의 영역의 Reuse·Altitude 재검토 | 수행 안 함(D-013) — 1차 설계자 직접 수행분으로 갈음. 구현 턴이 추가 발견하면 `[구현자 기입]` 에 적는다 |

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: AR-01~AR-04, MD-01~MD-07.
- 세션별 네이티브 제어: `sessionApi.setNativeResource` → preload → handler(`session-resources.ts:273-317`) → `shareNativeResource` → `SessionRuntime.setNativeResource` → adapter. renderer 진입점이 0286 에서 사라져 사슬 전체가 호출되지 않는다.
- composer catalog: production 은 `createComposerPreparation`, 테스트는 `registerComposerCatalog`(공유 service 없는 구 조립)를 지난다.
- 플러그인 탭: 5초 `setInterval` 로 두 하네스 `globalExtensions` 재조회. main 에는 OpenCode 전역 감시(1s)·프로젝트 감시(250ms)가 따로 있다.
- 규칙 복제: JSON 객체 읽기·git 루트 탐색·플러그인 플래그·spec 추출·abortable fetch·managed source 술어·프로젝트 범위 키·세션 binding 가드가 2~4벌.
- 공통 셸: CwdPanel·Composer·chatStore·chatReducer 가 `'opencode'` 리터럴·`openCode` boolean 으로 표면과 능력을 고른다.
- 0291 착지분: canonical JSON 4벌(신규 `canonicalJson` + 기존 3) · OpenCode 활성 variant 필터 3벌 · OpenCode CLI 실행 promise 3벌 · 로그인 프리 snapshot 분기 2곳 + 기본값 1 · 연결 상태 wire 변환 2벌 · `+` 메뉴는 조립 뒤 Orca 그룹을 다시 앞으로 옮긴다.

```text
renderer(공통 셸 분기) ─ sessionApi ─ preload ─ CHANNELS ─ handlers(구 조립·고아 채널)
     │                                                     └ bootstrap(감시 2벌·키/가드 사본)
     └ setInterval 5s ─ globalExtensions ─ extension-catalog ─ harnessModule.globalResources(파일 읽기)
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같음.
- 세션 리소스 handler 는 `orca:session:native-resources` 와 변경 알림만 등록한다. 키별 직렬화는 `ProjectResourceSync` 가 직접 소유한다(`NativeResourceSharing` 삭제).
- composer catalog 조립은 `createComposerPreparation` 하나이고 테스트도 그것을 지난다.
- 파일 감시는 `infra/config/fingerprint-watch.ts` 하나다. OpenCode 전역·Claude 전역·프로젝트 설정 감시가 그것을 쓰고, 전역 확장 변화는 `orca:extensions:changed {backend}` 로 방송된다. 플러그인 탭은 그 방송과 창 focus 로만 재조회한다.
- 규칙마다 헬퍼 하나: `infra/config/json-file.ts`(JSON 객체) · `adapters/common/git-root.ts` · `adapters/claude/plugin-flags.ts`(또는 plugin-catalog 내부 1함수) · `opencode/v1/openCodePluginConfig.ts pluginSpec` · `opencode/v1/abortable-fetch.ts` · adapter 내부 `managedSourceActive`.
- 공통 셸은 `harnessCatalog(backend)` 슬롯과 `HARNESS_CAPABILITIES[backend]` 만 읽는다.
- 0291 착지분: 정규화 JSON 은 `shared/obj.ts canonicalJson` 1벌, variant 필터는 `opencode/v1/model-listing.ts enabledVariantNames` 1벌, CLI 실행은 `runOpenCodeCli` 1벌이다. 로그인 프리 snapshot 은 `runtime.ts` 지역 `loginFreeSnapshot` 1곳이 정하고, wire 변환은 `connection-views.ts providerConnectionInfo` 1곳이 한다. `+` 메뉴는 처음부터 Orca 그룹을 맨 앞에 둔다.

```text
renderer(registry 슬롯·capability) ─ sessionApi ─ preload ─ CHANNELS ─ handlers(단일 조립)
     │                                                       └ bootstrap(키·가드 헬퍼)
     └ onExtensionsChanged ─ FingerprintWatch(1벌) ─ changed{backend}
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 규칙 사본 2~4벌 · 하네스 전용 모듈이 `app/` 최상위 | 헬퍼 1벌 · `app/harnesses/<name>/` | 한 곳만 고치면 되게 | MD-02·MD-03·AR-03 / VP-09·VP-10·VP-06 |
| data/control flow | 5초 폴링 · 구 조립 테스트 경로 | 감시 push + focus · production 조립 단일 | 낭비 제거 · 테스트가 production 을 지남 | R-02·AR-02·AR-04 / VP-02·VP-05·VP-07 |
| state/contract | IPC 2채널 + 공유 직렬화 객체 · `openCodeLanding` boolean · `harnessSurfaces(boolean)` | 2채널 삭제 · 중립 슬롯 · `harnessSurfaces(backend)` | 호출자 0 · 하네스 이름이 계약에 새지 않게 | AR-01·MD-06 / VP-04·VP-13 |
| error/lifecycle | 격리 이관 분기 | 404 → `missing` | 데이터 0(D-006) | R-03 / VP-03 |
| test seam/관측점 | 테스트 전용 조립·래퍼(`openCodeComposerCatalog`·`openCodeNativeResources`·`claudePlansDirectory`) | production 함수 직접 시험 | 테스트가 production 을 지남 | MD-01·AR-02 / VP-08·VP-05 |
| 0291 착지분 | 규칙 사본(정규화 JSON·variant·CLI·snapshot 분기·wire 변환) · fake 전용 선택 멤버 · 사후 재정렬 | 규칙 1벌 · 필수 멤버 · 조립 순서 | 0291 이 넘긴 3사본 + 같은 파일 안 새 사본 | MD-11 / VP-18 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `infra/config/fingerprint-watch.ts` (신규, infra) | 파일 목록 감시 + 지문 비교 + 변경 시 1회 콜백, 직렬화 | `{files, interval, fingerprint(), changed(rev), failed(err)}` | app(OpenCode 전역·Claude 전역·ProjectResourceSync) |
| `infra/config/json-file.ts` (확장, infra) | BOM 제거 JSON 객체 읽기(sync/async/text), ENOENT → `{}`, 실패 → 호출자 Error | `(path, onError)` → `Record<string, unknown>` | adapters/claude 4자리 |
| `adapters/common/git-root.ts` (신규, adapter-common) | cwd 에서 위로 `.git` 탐색, 루트 또는 lineage 반환 | `(cwd)` → root / lineage | claude 2 · opencode 1 |
| `src/shared/harness.ts` (확장, shared) | capability: `shortLabel`·`continuity`·`subagentTile`·`permissionModes` 추가(값 = 현재 리터럴 분기 결과: claude `'Claude'`·true·`'subagent'`·true / opencode `'OpenCode'`·false·`'task'`·false) | `Backend` → 값 | chatStore·chatReducer·ChatTitleBar·엔진·extension-sources |
| `shared/ui/HarnessLogo.tsx` (신규, renderer shared) | 하네스 마크 + 기본 brand tone | `{backend, className, tone?}` | chat·engine·skills·settings·app |
| `src/shared/obj.ts canonicalJson` (기존, shared) | 키 정렬 JSON 문자열 — 직렬화 불가면 throw | `unknown` → `string` | harness-config · background-task-queries · composer-catalog · login-free-connection |
| `opencode/v1/model-listing.ts enabledVariantNames` (신규 export, adapter-impl 순수) | `disabled: true` 아닌 variant 이름 — 객체가 아니면 `[]` | `unknown` → `string[]` | settings · model-listing · composer-catalog(v1) |

## 10. 계약 / 타입 / 강제 지점

자리 검색 명령은 repo root 에서 실행한다. `G` = `--glob '!*.test.*' --glob '!*.testfixture.*'`. 표 칸의 `\|` 는 정규식의 문자 `|` 다. N 은 설계 시점 HEAD `5ecaefd4` 실측이고, 10-31 에 0291 착지 후 HEAD(app 트리 = `e0318497`)에서 이 절의 명령 31개를 다시 돌려 30개는 같은 값을 얻었고, 플러그인 활성 플래그 1개는 해법 표기(`isRecord`)에 묶인 술어를 규칙으로 넓혀 3 → 4 로 고쳤다(EP-09 #11). EP-18 은 같은 HEAD 실측이다. `목표` 는 구현 후 값이다.

| pair | 계약 | SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 → 설계 시점 N / 목표 | 직접 oracle 좌표 | 실패 의미 |
|---|---|---|---|---|---|---|
| VP-02 | 플러그인 탭은 주기 재조회 없이 push·focus 로만 재조회 | `useNativeMcpCatalog` | ① `useNativeMcpCatalog.ts:72` 의 `setInterval` 제거 ② 같은 훅의 `sessionApi.onExtensionsChanged` 구독(신규) ③ 같은 훅의 `window` `focus` 구독(신규) | `rg -n 'setInterval\(' app/src/renderer/src/features/skills` → 1 / 0 · `rg -n 'onExtensionsChanged' app/src/renderer app/src/preload` → 0 / ≥3 | ①②③ 신규 `useNativeMcpCatalog.test.ts`: fake timers 30s 진행 → `globalExtensions` 추가 호출 0 / fake 방송 `{backend:'opencode'}` → opencode 1회·claude 0회 / `focus` → 두 하네스 1회씩 | 탭이 외부 변경을 못 보거나 폴링이 남음 |
| VP-03 | native 404 → `missing`, 이관 시도 없음 | `readOpenCodeHistory` | ① `native-history.ts:172-175` `migrate?` 의존 삭제 ② `:189-196` 404 분기 단순화 | `rg -ln 'LegacyStorageMigration|legacy-storage-migration|legacy-resources|legacy-schema|LEGACY_SCHEMA|inspectLegacyResources' app/src` → 9 / 0 | ①② 신규 `native-history.test.ts` 케이스: `session.get` 404 fake → `{status:'missing', message:'OpenCode 원본 세션을 찾을 수 없습니다.'}` 이고 두 번째 `session.get` 호출 0 | 없는 세션에 이관 경로가 남음 |
| VP-04 | 2채널 사슬 부재, native-resources 응답 불변 | `registerSessionResourceHandlers` | 아래 EP-04 자리 표 19 | `rg -n 'setNativeResource|nativePluginDirectory|SetNativeResource\b|OpenNativePlugin\b|SetNativeResourceSchema|OpenNativePluginSchema|sessionSetNativeResource|sessionOpenNativePlugin|shareNativeResource|openNativePlugin|open-native-plugin|set-native-resource|configuredPluginDirectory|configuredMcpFile|draftPluginDirectory|configuredClaudePluginDirectory|configuredClaudeMcpFile|configuredOpenCodeMcpFile' app/src $G` → 74 / 0 · 문서 `rg -n 'open-native-plugin|set-native-resource' docs/IPC_CONTRACT.md docs/generated/inventory.md` → 3 / 0 | 사슬: `gate:` 위 검색 0(현재 red) · 응답: `session-resources.test.ts`·`.sync.test.ts`·`.cancellation.test.ts`·`.claude-assembly.test.ts` 전 케이스 · 직렬화: 신규 `project-resource-sync.test.ts` 케이스 — 같은 key 두 `run` 중 첫째 deferred 미해결 동안 둘째 action 미시작 | 죽은 IPC·구현이 남거나 Composer 리소스 응답이 바뀜 |
| VP-05 | production 조립 1벌 | `createComposerPreparation` | ① `app/composer-catalog.ts:24` `prepareComposerCatalog` 삭제 ② `:92` `registerComposerCatalog` 삭제 ③ `handlers/composer-catalog.ts:17` `owners` 기본값 제거(필수 인자) | `rg -n 'registerComposerCatalog\b|prepareComposerCatalog\b' app/src` → 12 / 0 | ①② `composer-catalog.test.ts` 기존 케이스 6(`wires the public handler through the production resolver and returns its shutdown cleanup` · `preserves the configuration failure stage through the registered catalog handler` · `preserves the acquire failure stage through the registered catalog handler` 외 3)이 `createComposerPreparation(ctx)` 로 조립 — 6개 모두 Linux 기준선 red(Windows 경로 전제)라 **판정은 Windows CI** · ③ `gate:npm run typecheck`(기본값 의존 호출 0) | 테스트가 production 이 아닌 조립을 시험 |
| VP-06 | 하네스 전용 app 모듈 위치 | `app/harnesses/<name>/` | `opencode-warmup.ts` · `opencode-mcp-reconcile.ts` · `opencode-global-watch.ts` · `prepared-mcp-resources.ts` → `app/harnesses/opencode/` · `claude-processes.ts` → `app/harnesses/claude/` (5) | `ls app/src/main/app/{opencode-warmup,opencode-mcp-reconcile,opencode-global-watch,prepared-mcp-resources,claude-processes}.ts` → 5 / 0 | `gate:npm run lint` · 변이: `app/harnesses/common/` 파일에서 이동 모듈 import → `harness/ownership` error | 공통이 하네스 구현을 직접 끌어옴 |
| VP-07 | 감시 1벌, 지문 변화마다 콜백 1회 | `infra/config/fingerprint-watch.ts` | ① `opencode-global-watch.ts:29` ② `project-resource-sync.ts:151-154` ③ 신규 Claude 전역 확장 감시(bootstrap 조립) ④ `opencode/v1/discovery-cache.ts:176` hold 동안 1s 내용 probe 폴링(의존 파일 stat 변화로 probe 구동 — 에이전트 이견 1) | `rg -n '\bwatchFile\(' app/src/main $G` → 2 / 1 · `rg -n 'setInterval\(' app/src/main/adapters/opencode/v1/discovery-cache.ts` → 1 / 0 | 신규 `fingerprint-watch.test.ts`: 주입 `watch` fake 로 콜백 2회 + 지문 동일 → `changed` 0 · 지문 변화 → 1 · `close` 후 0. 기존 `opencode-global-watch.test.ts`·`project-resource-sync.test.ts` 전 케이스 | 중복 방송·누락 |
| VP-08 | 미사용 코드 부재 | — | 아래 EP-08 자리 표 29 | 자리별 검색(표) · `node docs/handoff/0290-simplify-0254-0289/scan/dead-exports.cjs --out <t>` → dead 44·test-only 52 / ⊆ 기준선 − 삭제 목록 · `scan/i18n-unreferenced.cjs --absent baseline/i18n-remove-keys.txt` → present 14 / 0 · 전체 미참조 64 / ⊆ 기준선 − 8 | `gate:` 각 검색·스캔(설계 시점 red 관측) | 쓰이지 않는 코드가 남거나 새로 생김 |
| VP-09 | main 규칙 SSOT | 헬퍼 4 | 아래 EP-09 자리 표 14 | 표 | 헬퍼: 신규 `json-file.test.ts`(BOM·ENOENT·비객체·파싱 실패 → 주입 Error) · 신규 `git-root.test.ts`(중첩 3단 · 루트 없음 → cwd) · 소비: `plugin-catalog.test.ts`·`configured-resources.test.ts`·`project-settings.test.ts`·`plugin-state.test.ts`·`native-resources.test.ts`·`plugin-installation.test.ts` 전 케이스 · 신규 `project-reconciliation.test.ts` 케이스(EP-09 #11): 외부 선택 값 `[]`·`{}`·`true` → enabled, `false` → disabled | 같은 규칙이 자리마다 달라짐 |
| VP-10 | OpenCode 연결·조립 SSOT | 헬퍼 5 + options | 아래 EP-10 자리 표 11 | 표 | 신규 `abortable-fetch.test.ts`(abort 후 body cancel + throw) · `session-context.test.ts`·`adapter*.test.ts`(4)·`channel.warm-fence.test.ts` 전 케이스 · 신규 `adapter.test.ts` 케이스 — revision 다르면 `managedMcpMentions` 빈 객체 | 연결·MCP 노출 판정이 자리마다 달라짐 |
| VP-11 | 효율 | — | 아래 EP-11 자리 표 4 | 표 | 신규 `channel.native-resources.test.ts`: fake client `config.get` 호출 1 · 신규 `native-resources.test.ts` 케이스: `app.skills`·`config.get` 두 deferred 가 동시에 pending · `skill-catalog.test.ts`·`plugin-catalog.test.ts` 전 케이스 | 같은 읽기 반복·이벤트 루프 블로킹 |
| VP-12 | 브랜드·표시명 SSOT | `HarnessLogo` · `HARNESS_CAPABILITIES.shortLabel` | 아래 EP-12 자리 표 15 | 표 | 신규 `HarnessLogo.render.test.ts`: claude → viewBox `0 0 248 248` + `text-spinner`, opencode → `0 0 16 20` + `text-oc-ink`, `tone` 지정 시 그 클래스 · `EngineCard.render.test.ts` 기존 케이스 | 하네스 마크·이름이 화면마다 달라짐 |
| VP-13 | 공통 셸 분기 → 슬롯·capability | `harnessCatalog`·`HARNESS_CAPABILITIES` | 아래 EP-13 자리 표 29 | 표 | 신규 `CwdPanel.surface.test.ts`: 두 하네스 렌더 클래스 문자열이 기준(구현 전 스냅샷)과 같음 · 신규 `harness.test.ts`: capability 값 · chatStore 27파일·`CwdPanel.*.test.ts` 3파일 전 케이스 | 하네스 추가 때 공통 셸 수정 필요·오동작 |
| VP-14 | renderer 단순화·효율 | `RowListEditor` · rAF capture | 아래 EP-14 자리 표 3 | 표 | `ProviderForm.interaction.test.ts` 전 케이스 · 신규 `ScrollController.interaction.test.ts` 케이스: 한 프레임 안 scroll 3회 → `querySelectorAll` 1회 | 행 편집 회귀·스크롤 측정 낭비 |
| VP-15 | native 이력 갱신 낭비 0 | `readOpenCodeHistory` · `refreshNativeHistory` · `ensureNativeSession` · `NativeHistoryQueries` | 아래 EP-15 자리 표 6 | 표 | 신규 `native-history.test.ts` 케이스: probe 값 = previous checkpoint 이고 cursor 재사용 가능 → `deps.client` 호출 0 · 404 는 여전히 `missing` / 신규 `native-sync.test.ts` 케이스: ready 1회에 `JSON.parse` spy 의 payload 파싱 1회 / 신규 `native-session.test.ts` 케이스: 미수락 복구 없음 → `readHistory` 에 previous 전달 / 기존 `native-history.db.test.ts` + 신규 케이스: 메시지 1개만 바뀐 갱신에서 나머지 행의 rowid 유지(Windows CI) | 같은 원본을 다시 읽고·쓰고·서버를 띄움 |
| VP-16 | main 효율 2차 | 자리별 | 아래 EP-16 자리 표 11 | 표 | EP-16 각 행의 신규 케이스(호출 수·동시성 단언) | 같은 계산·읽기 반복 |
| VP-17 | renderer 2차 | 공유 memo · hook 1벌 | 아래 EP-17 자리 표 4 | 표 | EP-17 각 행의 신규 케이스 | 프레임마다 같은 모델 재계산 |
| VP-18 | 0291 착지분 SSOT·조립 순서 | `canonicalJson` · `enabledVariantNames` · `runOpenCodeCli` · `loginFreeSnapshot` · `providerConnectionInfo` | 아래 EP-18 자리 표 19 | 표 | EP-18 각 행의 `oracle` 열 | 영속 key 가 바뀌거나 같은 규칙이 자리마다 달라짐 · Orca 그룹 순서 회귀 |

### EP-04 — 고아 IPC 사슬 자리 (19)

| # | 자리 | 처리 |
|---|---|---|
| 1 | `app/src/renderer/src/shared/api/ipc.ts:251-254` `openNativePlugin`·`setNativeResource` | 삭제 |
| 2 | `app/src/preload/index.ts:13-14` 타입 import · `:294-295` · `:304-305` | 삭제 |
| 3 | `app/src/shared/ipc.ts:103-104` `sessionOpenNativePlugin`·`sessionSetNativeResource` | 삭제 |
| 4 | `app/src/shared/protocol.ts:439` `SetNativeResourceSchema` · `:445` `OpenNativePluginSchema` | 삭제 |
| 5 | `app/src/shared/native-resources.ts:53` `SetNativeResource` · `:87` `OpenNativePlugin` | 삭제 |
| 6 | `app/src/main/app/handlers/session-resources.ts:232-317` 두 handler · `:50-72` `mutate` · deps `configuredPluginDirectory`·`draftPluginDirectory`·`configuredMcpFile`·`sharing` | 삭제, 남는 deps 는 options 객체(EP-10 #10) |
| 7 | `app/src/main/app/native-resource-sharing.ts` 파일 | 삭제(`run` 은 #8 로 이동) |
| 8 | `app/src/main/app/project-resource-sync.ts` 생성자 `run` 의존 | 키별 직렬화를 내부 소유 |
| 9 | `app/src/main/app/bootstrap.ts:1107-1113` `createNativeResourceSharing` · `:1147` `run` 주입 · `registerSessionResourceHandlers` 의 삭제 deps 인자(`:1169-1182` 등) · `:1224`·`:1235` 파일 경로 콜백 | 삭제/정리 |
| 10 | `app/src/main/adapters/common/types.ts:35-36` `nativePluginDirectory?`·`setNativeResource?` | 삭제 |
| 11 | `app/src/main/adapters/claude/adapter.ts:999` `nativePluginDirectory` · `:1013-1017` `setNativeResource` | 삭제 |
| 12 | `app/src/main/adapters/claude/native-resources.ts:22` `directory()` · `:145-147` 구현 | 삭제(다른 소비 0 확인 후) |
| 13 | `app/src/main/adapters/opencode/v1/channel.ts:484-498` `setNativeResource`·`nativePluginDirectory` · `opencode/v1/native-resources.ts:147-163` `openCodeNativePluginDirectory`(유일 소비 = `channel.ts:497`) | 삭제 |
| 14 | `app/src/main/adapters/opencode/v1/mcp-control.ts:211-215` `set()` | 삭제 |
| 15 | `app/src/main/features/sessions/session-runtime.ts:959-970` `setNativeResource`·`nativePluginDirectory` | 삭제 |
| 16 | `app/src/main/contracts/ports.ts:35` `GovernedLiveTurn extends Omit<RuntimeLiveTurn,'interrupt'>` — 두 멤버를 `LiveTurn` 에서 상속 | 별도 편집 없음, #10 삭제로 소멸(typecheck 로 소비자 0 확인) |
| 17 | `app/src/main/app/harnesses/common/contracts.ts:39-40` `configuredPluginDirectory?`·`configuredMcpFile?` · `claude/module.ts:46-47` · `opencode/module.ts:38` · `adapters/opencode/implementation.ts:61` · `opencode/index.ts:9` · `opencode/v1/index.ts:47` | 삭제 |
| 18 | `app/src/main/adapters/claude/configured-resources.ts:217`·`:225` · `opencode/v1/configured-resources.ts:144` 파일 경로 함수 | 삭제(다른 소비 0 확인 후) |
| 19 | 문서 `docs/IPC_CONTRACT.md:265-266` · `docs/generated/inventory.md`(재생성) | 삭제·재생성 |

- 자리 수가 검색 출력과 갈리면(예: `ports.ts` 멤버 부재) 구현자는 실측 목록을 `[구현자 기입]` 에 적는다 — 목록은 이 표 + VP-04 검색 출력의 합집합이다.

### EP-08 — 미사용 코드 자리 (29)

| # | 자리 | 근거(스캐너 범주) | 처리 |
|---|---|---|---|
| 1 | `adapters/claude/mcp-config.ts:5` `ClaudeMcp` | ADDED dead | 삭제 |
| 2 | `renderer/src/features/chat/harnesses/SubmitButton.tsx` | ADDED dead(파일) | 삭제 |
| 3 | `renderer/src/features/chat/components/transcript/ToolGroup.tsx` | MADE-DEAD test-only(파일) — 소비는 `components/transcript/nonExecution.render.test.ts:8,108` 1곳 | 삭제, 그 테스트는 production 경로의 `harnesses/claude/transcript/ToolGroup` `ClaudeToolGroup` 을 직접 렌더 |
| 4 | `components/transcript/AssistantMessage.tsx:19` `AssistantSegment` | MADE-DEAD test-only | 삭제 |
| 5 | `adapters/claude/plan-file.ts:26` `claudePlansDirectory`(= `claudeNativePaths(lookup, home).plans` 1줄 래퍼) | MADE-DEAD test-only | 삭제, `plan-file.test.ts:8,34,36`·`native-paths.test.ts:7,32` 는 `claudeNativePaths(...).plans` |
| 6 | `src/shared/agent-session-policy.ts:10` `agentSessionPolicy` | MADE-DEAD local-only | `export` 제거 |
| 7 | `adapters/opencode/v1/composer-catalog.ts:48` `openCodeComposerCatalog` | ADDED test-only | 삭제, 테스트는 agents·models 개별 |
| 8 | `adapters/opencode/v1/native-resources.ts:74` `openCodeNativeResources` | ADDED test-only | 삭제, 테스트는 mcp·plugins 개별 |
| 9 | `renderer/.../store/bubbleExpansionStore.ts:22` `isBubbleExpanded` | ADDED test-only | 삭제, 테스트는 store state 직접 |
| 10 | `adapters/opencode/v1/mcp-control.ts:65` `prepare()` | production 호출 0 | 삭제 |
| 11 | `renderer/.../backend/harnesses/claude/components/BackendStatus.tsx` + `backend/index.ts:9` re-export + `app/Sidebar.tsx:29` 주석 | PRE-EXISTING dead, 0264 이동 | 삭제 |
| 12 | `renderer/src/shared/ui/Status.tsx:3` `StatusProps` · `:23` `Status` | PRE-EXISTING dead | 삭제(`Dot`·`StatusTone` 유지) |
| 13 | `features/chat/lib/parts.ts:492` `partsStructured` | PRE-EXISTING dead | 삭제 |
| 14 | `features/chat/lib/rightPanelLayout.ts:98` `columnIndexOfTile` | PRE-EXISTING dead | 삭제 |
| 15 | `features/chat/lib/rightPanelTiles.ts:50` `isRightPanelTileId` | PRE-EXISTING dead | 삭제 |
| 16 | `renderer/src/app/Sidebar.tsx:21` `SIDEBAR_DEFAULT_WIDTH` | PRE-EXISTING dead | 삭제 |
| 17 | `src/shared/protocol.ts:298` `UpdateCheckResultSchema` · `:751` `DEFAULT_SCHEDULER_SETTINGS` | PRE-EXISTING dead | 삭제 |
| 18 | i18n `engine.form.harness` · `harness.defaultAgent` | 참조 0 | ko·en 삭제 |
| 19 | i18n `chat.opencode.panel.{title,menu,back,expand,collapse}` · `chat.opencode.todosEmpty` | 참조 0 | ko·en 삭제 |
| 20 | i18n `chat.nativeResources.{openError,stale,controlError,empty,disconnected,unsupported}` | 리터럴 0 · `NativeResource.status` union(`shared/native-resources.ts:9-17`) 밖이라 동적 `chat.nativeResources.${status}`(`CustomizeList.tsx:112`·`AttachMenu.tsx:54`)로도 도달 불가 — 스캐너는 동적 부모 때문에 참조로 센다 | ko·en 삭제. #18~#20 목록 = `baseline/i18n-remove-keys.txt`(14) |
| 21 | `styles/tokens.css` `--color-oc-background`·`--color-oc-bubble`·`--color-oc-bubble-ink`(white·dark 6줄) | 부정 단언 테스트만 참조 | 삭제(부정 단언 테스트는 유지 — 여전히 참) |
| 22 | `harnesses/claude/Logo.tsx` · `harnesses/opencode/Logo.tsx` · `harnesses/registries/brand.tsx` | 1줄 shim · chat 전용 사본 | 삭제(EP-12) |
| 23 | `harnesses/{claude,opencode}/rightpanel/PlanTile.tsx` | 키 2개만 다른 2벌 | 삭제(EP-12) |
| 24 | `adapters/opencode/v1/legacy-storage-migration.ts` · `legacy-resources.ts` · `legacy-schema.ts` + `.testfixture.ts`·`.integration.test.ts`·`legacy-resources.test.ts`·`legacy-schema.testfixture.ts` | D-006 | 삭제 |
| 25 | `opencode/v1/adapter.ts:23,53` `migration` · `readHistory` 의 `migrate` 블록 · `opencode/v1/index.ts:7,33-38` | D-006 | 삭제 |
| 26 | `docs/arch/backend/adapters.md:47` 구격리 저장소 문장 | D-006 | 삭제 |
| 27 | `docs/arch/frontend/design-components.md` 의 `BackendStatus`·`Status`·`HarnessSubmitButton`·`components/transcript/ToolGroup`·`PlanTile`·로고 shim 행 | 카탈로그 동기(renderer AGENTS 6) | 삭제·`HarnessLogo` 행 신설 |
| 28 | `docs/arch/backend/provider-runtime.md:251,489` "`BackendStatus` 지표" | 소비자 서술 정정 | 정정 |
| 29 | §8 표 `컴포넌트·문서` 이동분(EP-06 이동 모듈 경로를 인용하는 `docs/arch/**`) | 경로 동기 | `rg -n 'opencode-warmup|opencode-mcp-reconcile|opencode-global-watch|prepared-mcp-resources|claude-processes' docs/arch docs/INDEX.md` 출력 전부 정정 |

- 자리 검색(전부 목표 0): `rg -n '\b(ClaudeMcp|HarnessSubmitButton|AssistantSegment|claudePlansDirectory|openCodeComposerCatalog|openCodeNativeResources|isBubbleExpanded|partsStructured|columnIndexOfTile|isRightPanelTileId|SIDEBAR_DEFAULT_WIDTH|UpdateCheckResultSchema|DEFAULT_SCHEDULER_SETTINGS|BackendStatus)\b' app/src app/scripts` → 44 / 0 · `rg -n 'oc-bubble|oc-background' app/src/renderer/src/styles/tokens.css` → 6 / 0 · `rg -n 'export const agentSessionPolicy|async prepare\(\): Promise<void>' app/src/shared/agent-session-policy.ts app/src/main/adapters/opencode/v1/mcp-control.ts` → 2 / 0.
- `AssistantSegment` 은 하네스별 `AssistantSegment.tsx` 컴포넌트 이름과 겹친다 — 목표 0 은 `components/transcript/AssistantMessage.tsx` 안의 export 기준이며 하네스 파일의 같은 이름은 검색에서 `--glob '!**/harnesses/**'` 로 뺀다.

### EP-09 — main 규칙 SSOT 자리 (14)

| # | 규칙 | 자리 | 검색 → N / 목표 |
|---|---|---|---|
| 1-4 | BOM 제거 JSON 객체 읽기 → `json-file.ts` | `claude/configured-resources.ts:20-30` · `plugin-catalog.ts:13-22` · `project-settings.ts:18` · `plugin-state.ts:18` | `rg -n 'uFEFF' app/src/main/adapters/claude $G \| grep -c 'JSON.parse'` → 4 / 0 |
| 5-7 | `.git` 상향 탐색 → `adapters/common/git-root.ts` | `claude/project-path.ts:8-23` · `claude/configured-resources.ts:32-48` · `opencode/v1/configured-resources.ts:29-41` | `rg -n "join\(current, '.git'\)" app/src/main/adapters $G` → 3 / 0(헬퍼 파일 제외) |
| 8-11 | 플러그인 활성 플래그 `v===true‖Array‖객체` → 1함수 | `claude/configured-resources.ts:153` · `plugin-catalog.ts:85` · `:210` · `project-reconciliation.ts:44`(같은 규칙을 `typeof flag === 'object' && flag !== null` 로 적은 사본 — 10-31 재검색으로 추가) | `rg -n '=== true \|\| Array\.isArray\(' app/src/main $G` → 4 / 1(정의) |
| 12-14 | OpenCode 플러그인 spec 추출 → `pluginSpec` | `opencode/v1/native-resources.ts:28` · `:131` · `:155`(이 자리는 WP-2 의 `openCodeNativePluginDirectory` 삭제로 먼저 소멸) | `rg -n "typeof (entry|source) === 'string' \? (entry|source) : (entry|source)\[0\]" app/src/main/adapters` → 4 / 1(정의) |

- 함께: `plugin-catalog.ts:9` re-export 삭제(소비 3곳은 `project-path` 직접 import) · `configured-resources.ts:13` `const pathKey = pluginPathKey` 별칭 삭제 — `rg -n "export \{ pluginPathKey|const pathKey = pluginPathKey" app/src/main/adapters/claude` → 2 / 0.
- git-root 의 오류 의미: 헬퍼는 ENOENT 외 오류를 그대로 던진다. Claude 두 자리는 기존 문구 `Claude 프로젝트 설정을 읽을 수 없습니다.` 로 감싸고 OpenCode 자리는 그대로 던진다(현재 동작 유지).

### EP-10 — OpenCode 연결·조립 SSOT 자리 (11)

| # | 규칙 | 자리 | 검색 → N / 목표 |
|---|---|---|---|
| 1-2 | abortable fetch | `opencode/v1/session-context.ts:129-156` `fetchScoped` · `:178-188` `callerClient` | `rg -n 'response.body\?\.cancel\(\)' app/src/main/adapters/opencode/v1/session-context.ts` → 2 / 0 |
| 3-4 | managed source 활성 술어 | `opencode/v1/adapter.ts:167-182` `choices` · `:198-217` `mapMcpResources` | `rg -n 'plugin.identity.sourceId ===' app/src/main/adapters/opencode/v1/adapter.ts` → 2 / 1 |
| 5-6 | dispose 실패 보고 | `adapter.ts:60-69` · `:236-244` | `rg -n "opencode.instance.dispose.failed" app/src/main $G` → 2 / 1 |
| 7-8 | 프로젝트 범위 키 `[backend,'directory',scope]` | `bootstrap.ts:1126-1130` · `native-resource-sharing.ts:28-34`(EP-04 #7 삭제 후 1) | `rg -n "'directory'," app/src/main/app/bootstrap.ts app/src/main/app/native-resource-sharing.ts` → 2 / 1 |
| 9 | 세션 binding(backend·cwd·project_id) 가드 | `bootstrap.ts:1163`·`:1180`·`:1197`·`:1242`(일부는 EP-04 #9 삭제로 소멸) · `app/composer-catalog.ts:68` | `rg -n 'current.project_id !== session.project_id' app/src/main/app $G` → 5 / 0(헬퍼 `sameSessionBinding` 1) |
| 10 | 위치 인자 → options | `handlers/session-resources.ts:23-49` (11개) | `gate:npm run typecheck` |
| 11 | 위치 인자 → options | `opencode/v1/session-context.ts:89-102` `ServerContext`(12개) | `gate:npm run typecheck` |

- 같은 파일의 소소한 정리(같은 커밋): `native-resources.ts` `openCodeNativeMcp` 의 반환 `status` 재사용 · `channel.ts` `{...process.env,...req.env}` 지역 상수 1·`turn.aborted` 생성 헬퍼 1 · `session-context.ts` `ServerContext.composer`(agents+models 결합)는 `channel.ts:49` 소비 1곳뿐이라 그 자리에서 결합.

### EP-11 — main 효율 자리 (4)

| # | 낭비 | 자리 | 변경 | 관측 |
|---|---|---|---|---|
| 1 | 요청당 `config.get` 2회 | `opencode/v1/channel.ts:499-511` | config 1회 읽고 plugins·commands 투영에 전달 | VP-11 신규 케이스 — 호출 1 |
| 2 | skills·config 순차 await | `opencode/v1/native-resources.ts:22-24` | `Promise.all` | VP-11 신규 케이스 — 두 deferred 동시 pending |
| 3 | 메뉴 경로 동기 카탈로그 | `claude/plugin-catalog.ts:221-228` `configuredClaudeCommands` | `fs/promises` 판 사용 | `rg -n 'readFileSync|readdirSync|statSync' app/src/main/adapters/claude/plugin-catalog.ts` → 6 / spawn 판만 |
| 4 | 같은 동기 카탈로그 | `app/skill-catalog.ts:19` | 비동기 판 | `skill-catalog.test.ts` 전 케이스 |

- 동기 판(spawn 경계 `adapter.ts:448`·`:619`)과 비동기 판은 같은 순수 투영 함수를 공유한다 — 파일 읽기만 다르다(D-012).

### EP-12 — 브랜드·표시명 SSOT 자리 (15)

| # | 자리 | 변경 |
|---|---|---|
| 1-6 | `<ClaudeLogo`·`<OpenCodeLogo` 직접 렌더 6: `engine/common/components/EngineCard.tsx:30`·`:32` · `AgentEnvironmentView.tsx:103`·`:105` · `skills/components/customize/SourceHeading.tsx:21`·`:23` | `HarnessLogo` (SourceHeading 의 `source.includes(...)` 판정은 유지하고 마크만 위임) |
| 7-10 | chat 내부 `HarnessLogo`(registries/brand) 소비 4: `chat/components/AgentModeToggle.tsx:57` · `composer/ModelMenu.tsx:46` · `harnesses/registries/composer.ts:19` · `app/SidebarUserButton.tsx:136` | `shared/ui/HarnessLogo` import |
| 11-13 | 표시명 삼항 3: `ChatTitleBar.tsx:114` · `AgentEnvironmentView.tsx:107` · `src/shared/extension-sources.ts:5` | `HARNESS_CAPABILITIES[backend]` 의 신규 `shortLabel`(`'Claude'`·`'OpenCode'`) — 기존 문자열 유지 |
| 14-15 | `harnesses/{claude,opencode}/rightpanel/PlanTile.tsx` | 삭제(EP-08 #23), 두 `tileRegistry.ts` 는 common `PlanTileContent` 에 `harnessCatalog(b).planEmptyDescription`·`planSelectHint` 를 넘긴다 |

- 검색: `rg -n '<ClaudeLogo|<OpenCodeLogo' app/src/renderer/src $G` → 6 / 2(`HarnessLogo` 내부) · `rg -n "=== 'opencode' \? 'OpenCode' : 'Claude'|=== 'claude' \? 'Claude' :" app/src $G` → 3 / 0 · `ls app/src/renderer/src/features/chat/harnesses/{claude,opencode}/Logo.tsx app/src/renderer/src/features/chat/harnesses/registries/brand.tsx app/src/renderer/src/features/chat/harnesses/{claude,opencode}/rightpanel/PlanTile.tsx` → 5 / 0.
- tone 기본값은 현재 자리들의 값 그대로: `claude → text-spinner` · `opencode → text-oc-ink`. 기본과 다른 자리는 `tone` 을 지정한다(구현 전 자리별 클래스를 VP-12 렌더 테스트 기대값으로 고정).

### EP-13 — 공통 셸 분기 자리 (29)

| # | 자리 | 변경 |
|---|---|---|
| 1-11 | `features/chat/components/CwdPanel.tsx` `openCode` 분기 11 | `HarnessSurfaces.cwd` 슬롯(variant·chipVariant·showChevron·trailingDivider·contextRow·chipGroup) — `harnessSurfaces(backend)` |
| 12-22 | `openCodeLanding` 11자리(`Composer.tsx:71,120,234,255,407` · `harnesses/contracts.ts:85` · 두 landing presentation · 호출부) | 중립 이름 `contextLayout: 'below' \| 'inline'` |
| 23 | `chatStore.ts:199` OpenCode = code 강제 | `supportsAgentKind` / `HARNESS_CAPABILITIES[b].agentKinds[0]` |
| 24 | `chatStore.ts:252` 같은 강제 | 같음 |
| 25 | `chatStore.ts:1505` 분기 금지 | `HARNESS_CAPABILITIES[b].continuity` |
| 26 | `chatStore.ts:1554` 핸드오프 금지 | 같음 |
| 27 | `chatStore.ts:2091` 하위 작업 열기 | `HARNESS_CAPABILITIES[b].subagentTile` |
| 28 | `chatReducer.ts:1994` 하위 작업 타일 활성화 | 같음 |
| 29 | `chatReducer.ts:1653` Claude 권한 모드 기본값 | `HARNESS_CAPABILITIES[b].permissionModes` |

- 검색: `rg -n 'openCode \?|openCode &&|!openCode|harnessSurfaces\(openCode\)' app/src/renderer/src/features/chat/components/CwdPanel.tsx` → 11 / 0 · `rg -n 'openCodeLanding' app/src/renderer/src $G` → 11 / 0 · `rg -n "backend === 'opencode'|landingBackend === 'opencode'|backend === 'claude'" app/src/renderer/src/features/chat/store/chatStore.ts app/src/renderer/src/features/chat/reducer/chatReducer.ts` → 10 / 3(`chatReducer.ts:1503`·`:1600`·`:2168` OpenCode 전용 UI 상태 — §17 NEXT_HANDOFF).

### EP-14 — renderer 단순화·효율 자리 (3)

| # | 자리 | 변경 |
|---|---|---|
| 1 | `engine/harnesses/opencode/ProviderForm.tsx:265-312` 모델 행 | `RowListEditor` (같은 파일 또는 `engine/common/components/`) |
| 2 | 같은 파일 `:313-370` 헤더 행 | 같은 컴포넌트 |
| 3 | `chat/harnesses/opencode/transcript/ScrollController.tsx:73-91` `onScroll` → `capture()` | rAF 1프레임 1회, unmount 시 cancel |

- 검색: `rg -n 'capture\(\)' app/src/renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx` → 3 / 3(호출 자리 유지, onScroll 쪽만 프레임 래핑) — 관측은 VP-14 신규 케이스.

### EP-15 — native 이력 갱신 효율 자리 (6) — 에이전트 A4·A5·A6·A7·이견 2 검증분

| # | 낭비 | 자리 | 변경 | 관측 |
|---|---|---|---|---|
| 1 | 원본이 그대로여도 `client()`(서버 획득·필요 시 spawn) + `session.get` 을 probe 보다 먼저 | `opencode/v1/native-history.ts:186-188` → probe `:208-220` | sourceKey·probe 를 먼저 보고 previous 와 같으면 client 없이 `unchanged`. 404 판정이 필요한 나머지는 현행 경로 | VP-15 첫 케이스 — `deps.client` 0회 |
| 2 | 가드가 같은 행을 보장하는데 previous 를 다시 읽고 다시 파싱 | `features/history/native-sync.ts:98-100`(가드 `:76-79`) | `:57` 의 파싱 결과 `snapshot.sourceKey` 재사용 | VP-15 둘째 케이스 — 파싱 1회 |
| 3 | `ready` 뒤 handler 가 방금 쓴 payload 를 `loadSession` 으로 다시 파싱 | `app/handlers/session.ts:91` | refresh 결과에 파싱된 snapshot 을 실어 `loadSession(…, snapshot)` 로 재사용 | 같은 케이스 — handler 경로 파싱 1회 |
| 4 | 콜드 전송이 previous 없이 원본 전체를 읽어 상태만 씀 | `app/chat-turn/native-session.ts:44` | 미수락 복구 행이 없으면 보관 snapshot·cursor 를 previous 로 넘김(`native-sync.ts:56-66` 과 같은 조립을 헬퍼 1곳으로) | VP-15 셋째 케이스 |
| 5 | `ready` 마다 native 메시지 전부 DELETE + 전부 INSERT(FTS 트리거 2N) | `infra/db/native-history-queries.ts:179-188` · `0029` `UNIQUE(session_id,native_id)`·트리거 `ai/ad/au` | `INSERT … ON CONFLICT(session_id,native_id) DO UPDATE … WHERE` 내용이 다를 때만 + 빠진 id 만 DELETE(`orca-recovery:%` 보존 유지) | VP-15 넷째 케이스(Windows CI) |
| 6 | 이력 쿼리가 호출마다 `prepare` 17 — `HistoryWriter.persist` 동기 경로의 `bind()` 포함 | `infra/db/native-history-queries.ts` 전 메서드 | 생성자 1회 prepare(`queries.ts` 생성자 prepare 51 관례) | `rg -c '\.prepare\(' app/src/main/infra/db/native-history-queries.ts` → 17 / 생성자 블록 안만 |

- 저장 포맷(`native_history_snapshots.payload_json` 의 `raw` 포함)은 바꾸지 않는다(D-003·D-013 — 에이전트 제안 (c) 제외).
- #1 의 부수 변화: 서버 기동이 실패하는 상황에서 원본이 그대로면 `unavailable` 대신 `unchanged` 가 된다 — 화면은 보관 대화를 그대로 보이므로 사용자 결과는 같다.

### EP-16 — main 효율 2차 자리 (11) — 에이전트 A1·A2·A8·A11·A12·A13·A14·A17·A18·A19·A20 검증분

| # | 낭비 | 자리 | 변경 | 관측(신규 케이스) |
|---|---|---|---|---|
| 1 | tick 1회에 `deps.targets()` 1+E회 | `app/project-resource-sync.ts:117-121` · `peers()` `:211-218` | tick 스냅샷을 `apply`·`peers` 에 전달(refresh 뒤 `apply` 는 새로 계산) | `project-resource-sync.test.ts`: entry 3개 tick 1회 → `targets` 1회 |
| 2 | `skills:list` 동시 호출마다 전체 재스캔 | `app/handlers/skills.ts:38` · `bootstrap.ts` `refreshSkills` | list 는 진행 중 스캔에 합류, CRUD(`:43`·`:49`·`:68`·`:89`)는 쓰기 뒤 새 스캔 | 동시 list 3회 → `readSkillCatalog` 1회 · author 뒤 list → 새 스캔 |
| 3 | 전송마다 `.defaults` 하나에 includeDisabled 카탈로그 전체 동기 재귀 | `adapters/claude/adapter.ts:448-460` | `claudePluginDefaults(nativeRoot, overrides)` — settings.json 1개 + overrides(동기 유지, D-012) | defaults 값이 기존과 같고 플러그인 트리 읽기 0 |
| 4 | `~/.claude.json` 변경마다 K entry × 동기 parse, `entry()` 안 `pluginPathKey(path)` 반복 | `adapters/claude/project-settings.ts:16-25`·`:37`·`:75-77` | stat 키(`mtimeMs,size,ino,ctimeMs`) parse 캐시 + pathKey 루프 밖 1회 | 같은 stat 두 번 읽기 → parse 1회 · stat 변화 → 재파싱 |
| 5 | `projects/*` 순차 lstat · 해시 2회 | `adapters/claude/native-history.ts:144-153` · `:87`·`:188` | 동시성 상한 둔 `Promise.all` · 접두 해시를 `hash.copy()` 로 1패스 | 결과 동일 + 해시 update 바이트 수 = 파일 크기 |
| 6 | 스킬마다 realpath 2회(`:65`·`:73`)·플러그인 스킬 2회 읽기 | `app/skill-catalog.ts:58-73` · `plugin-catalog.ts:185` | realpath 1회 Promise.all 공유 · 카탈로그 text/meta 재사용(EP-11 #4 와 같은 커밋) | `realpath` spy 스킬당 1회 |
| 7 | 채널 수명 동안 `seenEvents` 무한 증가(root mapper 채널당 1개 `activity.ts:65`) | `adapters/opencode/v1/map.ts:52`·`:93-94` | 최근 4096 id 상한(삽입 순 삭제) | 4097번째 이벤트 뒤 크기 4096 · 최근 중복은 여전히 무시 |
| 8 | 스킬 명령마다 cwd→파일시스템 루트 전부 realpath | `adapters/opencode/v1/skill-sources.ts:24-38` ← `native-resources.ts:51` | `openCodeNativeCommands` 호출당 정규화 루트 1회(지연) + 동기 `withinSkillRoot` | 스킬 명령 3개 → realpath 루트 수 1벌 |
| 9 | acquire 마다 `openCodeExecutableIdentity` 2회 · components 즉시 계산 | `adapters/opencode/v1/server-profile.ts:40`·`:48` | identity 1회 · components 는 캐시 미스 trace 에서 지연 | identity 계산 1회 |
| 10 | SSE 이벤트 × 구독자 `sameNativePath`(resolve 2회) | `adapters/opencode/v1/session-context.ts:400-405` | 구독 시 정규화 저장 · 이벤트당 `envelope.directory` 1회 정규화 | 결과 동일(구독자 2·이벤트 1 → 정규화 3회) |
| 11 | 읽기 전용 멤버십 확인이 `snapshot()` 깊은 복제(structuredClone 3) · getter 3회 평가 | `features/extensions/common/mcp/managed-source.ts:77-83` ← `opencode/v1/adapter.ts:168`·`:201` · `mcp/bridge.ts:85` · `opencode/v1/channel.ts:193-194` | 복제 없는 `peek()` 읽기 + `managedMcpMentions` 지역 변수 1회(EP-10 #3-4 술어 헬퍼와 같은 커밋) | `structuredClone` spy 0 · 결과 동일 |

### EP-17 — renderer 2차 자리 (4) — 설계자 직접 읽기

| # | 낭비/중복 | 자리 | 변경 | 관측(신규 케이스) |
|---|---|---|---|---|
| 1 | OpenCode 우측 패널 4구성요소가 각자 `useMemo(sessionPanelModel)` — 스트리밍 프레임마다 같은 입력으로 최대 4회 계산, `latest()` 는 에이전트마다 filter+sort | `chat/harnesses/opencode/rightpanel/tiles.tsx:14-25`(소비 `:31`·`:96`·`:125`·`:163`) · `rightpanel/model.ts:29-31` | `(messages, background)` 참조 키 WeakMap 공유 memo 1개 + `latest` 를 toolUseId Map 1회 구성 | 같은 입력으로 4구성요소 렌더 → `sessionPanelModel` 1회 |
| 2 | 선택 하위 작업 파생 6줄 2벌 | `tiles.tsx:97-101` · `:126-130` | `useSelectedOpenCodeAgent()` 1개 | 기존 tiles·AgentViews 테스트 green |
| 3 | 만료 owner/epoch 가드 2벌 · 실패 slot 삼항 3벌 | `chat/harnesses/opencode/composer/composerCatalogState.ts:139-143`·`:177-181` · `:148-154`·`:183-189`·`:111` | `stale(epoch, owner)` · `failedSlot(part)` | 기존 composerCatalogState 테스트 green |
| 4 | 감속 모션 판정 2벌 | `opencode/composer/TodoDock.tsx:23-37` `useReducedMotion` · `features/chat/hooks/useColumnSlideOnReflow.ts:44` | `shared/hooks/useReducedMotion.ts`(도메인 무관) 1개 | 신규 훅 테스트(matchMedia change → 값 갱신) |

### EP-18 — 0291 착지분 정리 자리 (19) — 설계자 직접 읽기(D-014)

경로 접두: main 은 `app/src/main/`, renderer 는 `app/src/renderer/src/`. `app/composer-catalog.test.ts` 와 `opencode/v1/composer-catalog.test.ts` 는 다른 파일이다.

| # | 규칙 | 자리 | 변경 | 검색 → N / 목표 | oracle |
|---|---|---|---|---|---|
| 1-3 | 정규화 JSON → `shared/obj.ts canonicalJson` | `adapters/common/harness-config.ts:76` `canonicalize` · `infra/db/background-task-queries.ts:7` `canonical` · `app/composer-catalog.ts:13` `canonical` | 세 사본 삭제. fingerprint = `canonicalJson(env)`, journal key = `canonicalJson({...payload, identity, replay})`, preparation identity = `canonicalJson([backend, cwd, agentKind, prepared])` | `rg -n "function canonical(ize)?\(" app/src/main` → 3 / 0 · `rg -n "function canonicalJson" app/src` → 1 / 1 | ① `harness-config.test.ts` `같은 입력은 같은 값 — 키 순서가 달라도 같다` ② 신규 `infra/db/background-journal-key.test.ts`: 중첩 키를 역순 삽입·배열·`undefined` 필드를 가진 고정 이벤트 → 구현 전 코드로 계산한 hex 와 같음 + 삽입 순서만 다른 이벤트 → 같은 key ③ 신규 `app/composer-catalog.test.ts` 케이스(`tmpdir()` 경로): `prepared` 키 순서만 다른 두 해석 → 같은 `key`, 값이 다르면 다른 `key` |
| 4-6 | OpenCode 활성 variant(`disabled: true` 제외) → `enabledVariantNames(value): string[]` 1벌 | `adapters/opencode/v1/settings.ts:42` · `model-listing.ts:33` · `composer-catalog.ts:42` | 세 자리가 같은 함수를 부른다. model-listing 은 빈 목록이면 `undefined`(현행 유지) | `rg -n "disabled (===|!==) true" app/src/main/adapters/opencode $G` → 3 / 1(정의) | ④ `settings.test.ts` `uses native provider/model IDs and filters disabled variants` ⑤ `model-listing.test.ts` `reads header lines with their pretty JSON blocks` ⑥ `opencode/v1/composer-catalog.test.ts` `reads plugin-resolved primary agents and variants from the live SDK without leaking options` |
| 7 | 지역 `isRecord` 사본 → `shared/obj` | `adapters/opencode/v1/model-listing.ts:26` | import 로 교체(`shared/obj` 는 런타임 의존 0 이라 순수 모듈 유지) | `rg -n "function isRecord" app/src $G` → 2 / 1 | ⑦ `gate:` 왼쪽 검색 + `model-listing.test.ts` 전 케이스 |
| 8-10 | OpenCode CLI 실행 promise → `runOpenCodeCli` 1벌 | `adapters/opencode/v1/server.ts:59`(정의) · `:166` `probeVersion` 기본 경로 · `:435` `readDatabasePath` | 두 자리가 모듈 함수 `runOpenCodeCli` 를 직접 부른다(주입 seam `readVersion`·`runCli` 의 적용 범위는 현행). 호출부 값 유지 — 버전·db path: timeout 15s·maxBuffer 기본 · models: 60s·16MB·signal. `OpenCodeCliOptions` 의 `cwd`·`env`·`maxBuffer`·`signal` 은 선택 | `rg -U --count-matches "execFile\(\s*executable" app/src/main/adapters/opencode/v1/server.ts` → 3 / 1 | ⑧ `server.list-models.test.ts` 전 케이스 ⑨ 신규 `server.cli.test.ts`(execFile 모듈 mock — `server.database-path.test.ts:11-33` 방식): `readVersion` 미주입 `installed()` → args `['--version']`·`windowsHide: true`·`timeout: 15000`, version = 출력 trim ⑩ `server.database-path.test.ts` 전 케이스(args `['db','path']`·cwd·env) |
| 11-12 | `OpenCodeServer` fake 전용 선택 멤버 → 필수 | `adapters/opencode/implementation.ts:32` `retireAll?` · `:34` `listModels?` (가드 `opencode/v1/adapter.ts:84-86` · `:98` `?.`) | 필수로 바꾸고 가드 2개와 가드 전용 케이스(`adapter.list-models.test.ts` `rejects when the server port cannot list models`) 삭제, typed fake 3곳(§8)에 stub | `rg -n "if \(!this\.servers\.listModels\)|servers\.retireAll\?\.\(" app/src/main/adapters/opencode/v1/adapter.ts` → 2 / 0 | ⑪ `adapter.list-models.test.ts` `listProviderModels delegates to the server pool` ⑫ `bootstrap.native-history.test.ts` `broadcasts each OpenCode plugin revision after retiring servers without an owner`(`retireAll` spy) |
| 13-14 | 연결 상태 → wire `ProviderConnectionInfo` 변환 1벌 | `app/connection-views.ts:82-89` · `app/handlers/providers.ts:76-84` | `connection-views.ts` 에 `providerConnectionInfo(status)` 1개, handler 가 그것을 부른다 | `rg -n "\.message \?\? null" app/src/main/app $G` → 2 / 1(헬퍼) | ⑬ `connection-views.test.ts` `carries connection only for connect-declared login-free rows` ⑭ `handlers/providers.test.ts` `connect는 최종 연결 상태를 돌려준다` |
| 15-17 | 로그인 프리 snapshot(연결 선언 → 연결 상태, 무선언 → 상수)을 한 곳에서 | `features/auth/runtime.ts:266` `bindLoginFreePlugin` · `:314-318` `runtime.snapshot` · `:322-324` `connect` 가드(`login-free-connection.ts:68` `entryOf` 가 같은 문구로 이미 던진다) · `login-free.ts:35` 기본값 | runtime 지역 `loginFreeSnapshot(authId)` 1개를 두 소비가 부르고 `createLoginFreePluginAuth` 는 `snapshot` 을 필수로 받는다(기본값 삭제). `connect` 는 `connections.connect` 위임만 | `rg -n "connections\.has\(authId\)" app/src/main/features/auth/runtime.ts` → 3 / 1 · `rg -n "deps\.connection \?\?" app/src/main/features/auth/login-free.ts` → 1 / 0 | ⑮ `login-free.test.ts` `connect 선언 포트는 연결 상태를, 무선언 포트는 상수를 돌려준다` ⑯ `login-free.test.ts` `snapshot은 두 체계와 미등록 id를 같은 형상으로 읽는다` ⑰ 신규 `login-free.test.ts` 케이스: 연결 선언 없는 로그인 프리 id·자격증명 id 의 `connect` → reject `login-free connect is not declared: <id>` |
| 18-19 | `+` 메뉴 Orca 그룹 맨 앞(0291 D-017)을 조립 순서로 | `features/chat/lib/attachMenuModel.ts:199-201` 스킬 사후 재정렬 · `:202-204` 플러그인 사후 재정렬(정의 `:49` `orcaGroupFirst`) | 스킬: 출처 그룹을 만들 때 `orca` 그룹을 맨 앞에(나머지 상대 순서 유지) · 플러그인: native 묶음을 `:189` `unshift` 대신 Orca 묶음 뒤에 `push` · `orcaGroupFirst` 와 그 단위 describe 삭제 | `rg -n "orcaGroupFirst" app/src/renderer/src $G` → 3 / 0 | ⑱ `attachMenuModel.test.ts` `merges groups that share a title into one heading without losing item identities`(입력 claude → orca, 기대 orca 먼저) ⑲ `Composer.native-menu.test.ts` `reflects session-enabled plugin commands in real autocomplete and decoration without changing the draft`(플러그인 패널 native 묶음 + Orca, 기대 Orca 먼저) |

- 등록 변이(VP-18): 자리마다 되돌리기 — ①~③ `canonicalJson(x)` → `JSON.stringify(x)` · ④~⑥ 필터 제거(`Object.keys`) · ⑨ `['--version']` → `['-v']`·⑩ `['db','path']` 바꿈 · ⑮⑯ `loginFreeSnapshot` 두 분기 맞바꿈 · ⑬⑭ `?? null` → `?? ''` · ⑱ 스킬 그룹 정렬 제거 · ⑲ `push` → `unshift` 복원. 각 변이는 같은 행 oracle 이 red 여야 한다.
- 지우지 않는 것(D-015): `runtime-listing.ts` 두 함수 · `createRuntimeModelSnapshotReader`(§17) · 0291 D-020 이름 전부.

- 같은/동일 규칙의 SSOT 와 공유 방법: 위 표의 `SSOT` 열. 복붙 정규식은 남기지 않는다.
- `실패 의미` 에 "다른 게이트가 막는다" 를 적은 행: 없음.
- 선택적 필드 의미: `harnessCatalog(backend).surfaces.cwd` 는 필수(두 하네스 모두 값). `HARNESS_CAPABILITIES` 신규 필드 3개도 필수 — `satisfies Record<Backend, …>` 가 누락을 막는다.
- 외부 SDK 경계: `OpencodeClient.config.get` 결과 타입을 그대로 투영 함수에 넘긴다(`as` 캐스트 금지).

## 11. 구현 설계

작업 묶음(WP)은 커밋 단위다. 순서는 의존 순: WP-1 → WP-2 → WP-3 → WP-5 → WP-4 → WP-14 → WP-6 → WP-11 → WP-12 → WP-7 → WP-8 → WP-9 → WP-10 → WP-13. WP-12 #11 은 WP-4(EP-10 #3-4) 와, WP-12 #6 은 WP-6(EP-11 #4) 와 같은 커밋으로 묶는다. WP-14 는 같은 파일(`opencode/v1/adapter.ts`·`app/composer-catalog.ts`)을 먼저 바꾸는 WP-4·WP-5 뒤에 둔다. EP-18 #2 golden 값은 WP-1 착수 전 HEAD 에서 계산해 둔다(AC23 주의사항).

| WP | 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|---|
| WP-1 미사용 삭제 | EP-08 #1~#21 | — | 삭제·`export` 제거·테스트 재지정 | 정적 gate + 재지정 테스트 |
| WP-2 고아 IPC | EP-04 #1~#19 | 세션 리소스 handler·직렬화 | 사슬 삭제, `ProjectResourceSync` 가 키별 큐 소유, handler 인자 options 화 | session-resources 4파일 · project-resource-sync |
| WP-3 격리 이관 | EP-08 #24~#26 · `native-history.ts:172-196` | OpenCode 이력 읽기 | 이관 삭제, 404 → `missing` | native-history 신규 케이스 |
| WP-4 main SSOT | `infra/config/json-file.ts` · 신규 `adapters/common/git-root.ts` · `claude/{plugin-catalog,configured-resources,project-path,project-settings,plugin-state,project-reconciliation}.ts` · `opencode/v1/{native-resources,configured-resources,openCodePluginConfig,session-context,adapter,channel}.ts` · 신규 `opencode/v1/abortable-fetch.ts` · `app/bootstrap.ts` · `app/composer-catalog.ts` | 규칙 1벌 | EP-09·EP-10 | 헬퍼 단위 + 소비 테스트 |
| WP-5 단일 조립 | `app/composer-catalog.ts` · `handlers/composer-catalog.ts` · `composer-catalog.test.ts` | catalog 조립 | 구 조립 삭제, 테스트 이동 | composer-catalog · composer-preparation-service |
| WP-6 main 효율 | `opencode/v1/{channel,native-resources}.ts` · `claude/plugin-catalog.ts` · `app/skill-catalog.ts` | 읽기 횟수·블로킹 | EP-11 | fake client 호출 수 |
| WP-7 감시 push | 신규 `infra/config/fingerprint-watch.ts` · `app/opencode-global-watch.ts`(이동 후 `app/harnesses/opencode/global-watch.ts`) · `app/project-resource-sync.ts` · `app/bootstrap.ts`(Claude 전역 감시 조립 + 방송) · `shared/ipc.ts`(`extensionsChanged` 채널) · `preload/index.ts` · `renderer shared/api/ipc.ts` · `skills/hooks/useNativeMcpCatalog.ts` · `docs/IPC_CONTRACT.md` | 변경 감지·방송 | 감시 1벌 + `orca:extensions:changed {backend}` + 훅 구독·focus | fingerprint-watch 단위 · 훅 3케이스 |
| WP-8 모듈 위치 | EP-06 5파일 → `app/harnesses/{opencode,claude}/` · import 경로 · 이동 테스트 파일 | 하네스 전용 조립 | `git mv` + import 정정 | lint ownership |
| WP-9 하네스 표면 | 신규 `renderer/src/shared/ui/HarnessLogo.tsx` · EP-12 · EP-13 · `src/shared/harness.ts` · `harnesses/{contracts,presentation,catalog}.ts` · `{claude,opencode}/surfaces.ts` · 두 landing presentation | 브랜드·표시명·슬롯·capability | EP-12·EP-13 | HarnessLogo·CwdPanel·harness 신규 테스트 |
| WP-10 renderer 정리 | `ProviderForm.tsx` · `ScrollController.tsx` | 행 편집·스크롤 측정 | EP-14 | interaction 테스트 |
| WP-11 native 이력 효율 | `opencode/v1/native-history.ts` · `features/history/native-sync.ts` · `app/handlers/session.ts` · `features/history/reader.ts`(snapshot 인자) · `app/chat-turn/native-session.ts` · `infra/db/native-history-queries.ts` | 재열기·갱신·콜드 전송 | EP-15 | 순수 fake deps + DB 스위트(Windows CI) |
| WP-12 main 효율 2차 | EP-16 자리 파일 11곳 | 반복 계산·읽기·복제 | EP-16 | 자리별 호출 수 단언 |
| WP-13 renderer 2차 | `opencode/rightpanel/{tiles,model}.ts(x)` · `opencode/composer/composerCatalogState.ts` · `TodoDock.tsx` · `hooks/useColumnSlideOnReflow.ts` · 신규 `shared/hooks/useReducedMotion.ts` | 패널 모델 공유·가드·훅 | EP-17 | 계산 횟수 단언 · 훅 단위 |
| WP-14 0291 착지분 | `adapters/common/harness-config.ts` · `infra/db/background-task-queries.ts` · `app/composer-catalog.ts` · `opencode/v1/{settings,model-listing,composer-catalog,server,adapter}.ts` · `opencode/implementation.ts` · `app/connection-views.ts` · `app/handlers/providers.ts` · `features/auth/{runtime,login-free}.ts` · renderer `features/chat/lib/attachMenuModel.ts` · typed fake 3 · 신규 테스트 파일 2(`background-journal-key`·`server.cli`) · 신규 케이스 2(`app/composer-catalog`·`login-free`) | 규칙 1벌·조립 순서 | EP-18 | 자리별 oracle(EP-18) |

### 테스트 가능성

- electron 의존부와 분리할 순수 파일: `fingerprint-watch.ts`(watch 함수 주입 — `watchFile`·`unwatchFile` 기본값은 bootstrap 이 넣는다), `git-root.ts`(fs 주입 없이 임시 디렉터리), `json-file.ts`(임시 파일).
- 재사용 메커니즘의 형상: `OpenCodeGlobalWatch` 의 직렬화 큐·지문 비교를 `FingerprintWatch` 로 올리고 `ProjectResourceSync` 의 250ms 감시는 같은 객체를 interval 인자로 쓴다 — 두 주기 값은 유지한다.
- 순서 관측: VP-04 직렬화 케이스는 deferred 2개로 시작 순서를 본다. VP-11 병렬 케이스는 두 fake 요청의 pending 동시성을 본다.

## 12. End-to-end 영향

### producer → consumer

```text
외부 설정 변경 → FingerprintWatch → bootstrap changed(backend) → webContents.send(extensionsChanged)
  → preload onExtensionsChanged → useNativeMcpCatalog.refreshOne(backend) → globalExtensions
```

- producer 기준: 지문이 바뀔 때만 방송(지문 = 기존 `globalPluginFingerprint` 와 Claude 전역 파일 mtime+size).
- consumer 파생 규칙: 훅은 방송 payload 의 backend 만 재조회하고, 토글 잠금(locks) 중이면 건너뛴다(기존 `refresh` 규칙).
- 파생 합성값 우회 없음: 목록 정본은 여전히 `globalExtensions` 응답이다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 영향 | 회귀 AC |
|---|---|---|
| `orca:extensions:opencode-plugins-changed` 구독자(에이전트 캐시, 0282 D-022) | 불변 — 같은 감시가 기존 방송도 낸다 | AC1 · AC12 |
| `ProjectResourceSync` 재적용 | 감시 객체만 교체, 250ms 주기 유지 | AC5 · AC12 |
| bootstrap 셧다운 | 신규 Claude 전역 감시 `close()` 를 기존 `shutdown` 정리 목록에 추가 | AC12 |
| 부팅 `auth.connectAll()`(0291 D-009) · 플러그인 탭 연결 행 · `orca:provider:connect` | 불변 — snapshot 분기·wire 변환이 한 곳으로 모일 뿐 값·순서·채널은 같다 | AC1 · AC23 |
| background journal `background_task_events.event_key`(migration 0027 `UNIQUE(session_id, generation, event_key)` 가 재전달 중복을 거른다) | 불변 — 같은 이벤트는 같은 hex(EP-18 #2 golden). 바뀌면 재시작 뒤 같은 이벤트가 두 번 쌓인다 | AC23 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: Claude 전역 감시는 OpenCode 전역 감시와 같은 시점(bootstrap 의 extension 조립 직후)에 만든다.
- 취소/중단: 훅 unmount 시 방송 구독·focus 리스너 해제.
- 종료/quit: 모든 `FingerprintWatch.close()` 가 `unwatchFile` 을 부른다(테스트: close 후 콜백 0).
- retry/timeout: 지문 계산 실패는 `failed(error)` 로그만 — 다음 변경에서 다시 계산.
- cleanup/rollback: 해당 없음.
- **다중 저장소 쓰기**: 코드 변경은 없음. 산출 문서의 상태 사본은 `plan.md` + `docs/handoff/INDEX.md` 2곳 — 같은 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

- 플러그인 탭: 열린 1분당 IPC 24회(2 × 12) + 같은 수의 main 설정 파일 읽기 → 변경 시 1회 + focus 1회.
- OpenCode `nativeResources`: 요청당 `config.get` 2 → 1, 명령 재고 HTTP 2개 순차 → 병렬.
- 메뉴 경로 Claude 카탈로그: main 이벤트 루프 동기 파일 I/O(플러그인 트리 재귀 + 스킬 .md 전부) → 비동기.
- OpenCode 스크롤: scroll 이벤트당 `querySelectorAll` + 행별 `getBoundingClientRect` → 프레임당 1회.
- 잃는 부수 효과: 플러그인 탭이 감시가 못 보는 경로(감시 파일 목록 밖)의 변경을 5초 안에 보던 성질 — focus 재조회가 대신한다(§5).
- native 이력 재열기: 원본이 그대로인 OpenCode 세션은 서버 획득(유휴 보존 90s 가 지났으면 spawn + health) + HTTP 1회 → 0회. 갱신 `ready` 1회의 payload 파싱 2(원본 그대로)·4(원본 변경) → 1. 메시지 N개 중 1개 변경 시 쓰기 2N(+FTS 2N) → 변경 행만.
- main 2차: 500ms tick 당 대상 계산 (1+E) → 1 · 동시 `skills:list` k회 → 스캔 1회 · Claude 전송당 플러그인 트리 동기 재귀 2회 → 1회(spawn 경계 1회만) · OpenCode 채널 `seenEvents` 무한 → 4096 상한.
- renderer 2차: 스트리밍 프레임마다 OpenCode 패널 모델 계산 (보이는 구성요소 수, 최대 4) → 1.
- 잃는 부수 효과(2차): 없음 — 원본 불변 판정이 probe 하나에 기대는 것(EP-15 #1)은 기존 unchanged 판정과 같은 근거다.
- 0291 착지분: 효율 채택 0 — 부팅 연결 확인의 CLI spawn 은 0291 D-009 설계값이고, agent 목록 push 재조회 합류는 이득이 작아 Skip(§17). EP-18 은 정리만이며 잃는 부수 효과는 composer preparation key 의 값(프로세스 안 캐시 키) 변화뿐이다.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port 변경: 없음 — 배포 확장점 유지(D-008) · 0291 연결 레시피 API 유지(D-015). `createLoginFreePluginAuth` 의 `snapshot` 필수화(EP-18 #15-17)는 `features/auth` 내부 함수라 배포 소스가 부르지 않는다(`rg -n "createLoginFreePluginAuth\(" app/src` = 정의·`runtime.ts` 1곳).
- IPC 계약 문서: `docs/IPC_CONTRACT.md` 2행 삭제(D-005) + `orca:extensions:changed` 1행 신설(D-007). `docs/generated/inventory.md` 재생성.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0286 D-003 main·preload IPC 표면 유지 | 0286 plan §3 | D-005 · EP-04 | **변경** — 2채널만, 사용자 승인 |
| 0262 D-031 격리 세션 보존 | 0262 plan §3 | D-006 · EP-08 #24~#26 | **변경(SUPERSEDED)** — 사용자 승인 |
| 0282 AC28′ "열린 동안은 기존 5초 재조회" | 0282 plan:821 | D-007 · VP-02 | **변경** — 사용자 승인 |
| 0284 D-007~D-010 하네스 토글 잠금 | 0284 plan §3 | §5 상태표 · §12 | 유지 |
| 0282 D-022 에이전트 캐시가 revision 신호 구독 | 0282 plan §3 | §12 | 유지 — 기존 채널 존속 |
| 0257 D-005 · 0259 D-011 · 0262 D-016/D-017 · 0282 D-030/D-031 | 각 plan | D-010 | 유지 |
| 0291 D-001~D-021(로그인 프리 연결·Composer agent placeholder·`+` 메뉴 Orca 최상단·엔진 카드 순서·agent store 구독) | 0291 plan §3 | D-014 · EP-18 | 유지 — 결과는 같고 EP-18 #18-19 는 만드는 방법만 바꾼다 |
| 0291 D-020 이름(배포 소스·wire one-way door) | 0291 plan §3 | EP-18 #11-17 · D-015 | 유지 — 이름·형상 변경 0 |
| 0291 §6 비범위 "기존 canonical JSON 사본 3곳 통합(0290 영역)" | 0291 plan §6 | EP-18 #1-3 | 실행 — 0291 이 넘긴 항목 |
| 하네스 형제 import 금지 | `app/scripts/harness-boundary.mjs` | D-009 · WP-4 공통 헬퍼 위치 | 유지 |
| feature 교차 import 금지(renderer) | `app/src/renderer/AGENTS.md` | `HarnessLogo` 를 `shared/ui` 에 둔다 | 유지 |
| main 전역 `fetch` 금지 | `app/src/main/AGENTS.md` | `abortable-fetch.ts` 는 주입받은 `fetch` 만 감싼다 | 유지 |
| 머지된 마이그레이션 수정 금지 | `app/AGENTS.md` | 해당 없음(SQL 미변경) | 유지 |
| 컴포넌트 카탈로그 동기 | `app/src/renderer/AGENTS.md` 6 | EP-08 #27 | 유지 |
| 문서에 코드 수치 금지 | root `AGENTS.md` 원칙 4 | EP-08 #28·#29 정정은 경로·이름만 | 유지 |

## 17. 리스크 / 트레이드오프 · Skip 목록

| 리스크 | 완화/결정 |
|---|---|
| 감시 파일 목록 밖 변경을 놓침 | focus 재조회(§5) · 감시 목록은 기존 `globalPluginFiles` + Claude `settings.json`·`plugins/installed_plugins.json` |
| capability 표로 옮기며 분기 의미가 바뀜 | 표 값은 현재 리터럴 결과와 같게(VP-13 신규 단위 테스트가 하네스별 값 고정) |
| 대량 이동으로 리뷰가 어려움 | WP 단위 커밋, 이동(WP-8)은 내용 변경 없는 `git mv` 커밋을 먼저 |
| 격리 세션 사용자 | D-006 — 릴리스 사용자 0, 파일 미삭제 |

| Skip(후속 후보) | 이유 |
|---|---|
| chatReducer OpenCode 전용 UI 상태 이동(`:1503`·`:1600`·`:2168`) | 세션 전환 보존 동작 판단 필요 — NEXT_HANDOFF |
| OpenCode `client()` lease 마다 설정 파일 2종 읽기 캐시 | 외부 변경 신선도(0282 D-020) — 감시 지문과 묶는 별도 설계 |
| (정정) `infra/db/native-history-queries.ts` 호출마다 prepare | 1차 Skip 근거가 틀렸다 — `queries.ts` 는 생성자 prepare 51 이 관례다. 채택(EP-15 #6) |
| project-resource-sync 500ms tick → lease·activity 이벤트 구동(에이전트 A1 후반) | `supervisor.subscribeLeases` 는 있으나 activity idle 전이 구독이 없다 — 트리거 누락 시 재적용 지연. NEXT_HANDOFF |
| `opencode-mcp-reconcile.ts:33-35` dirty 동안 500ms 재적용+방송(A3) | 그 방송이 MCP 연결 완료 상태 갱신을 부수적으로 대신한다 — connect 완료 이벤트를 먼저 만들어야 한다. NEXT_HANDOFF |
| 부팅 critical `adapter-registry` 가 `opencode --version` spawn(상한 15s) 대기(A9, `bootstrap.ts:752-756`) | install state push 계약과 부팅 단계 순서(0244) 판단 필요. NEXT_HANDOFF |
| `mcp-control.ts:165-167` 제출 admission 20ms idle 폴링(A15) | activity 변경 구독 배관 필요. NEXT_HANDOFF |
| Claude 설정 파일 요청당 2회 읽기 — configured-resources + plugin-catalog(A16) | WP-4 JSON 헬퍼 뒤 두 스캔을 하나로 합치는 별도 설계. NEXT_HANDOFF |
| native 보관 payload 의 `raw` 분리(A5 (c)) | 저장 포맷 변경 — D-003 |
| OpenCode activity `snapshots` 지문화(A14 후반) | 길이가 같은 출력 변화를 놓칠 수 있다 — 동작 변경 위험 |
| Claude/OpenCode `AssistantSegment` 공통 case(compact·fork·subagent_notice) 추출 | 20줄 · 하네스별 switch 가독성 — 이득 작음 |
| Claude/OpenCode `SubmitButton` | 시각이 다르다(0262 D-004) |
| `GeneralTab` 설정 행 반복 | 선언형 JSX 반복 — 정상 |
| `McpDetail`·`SkillDetail` 복제(jscpd 18~21줄 ×5) | 범위 밖 기존 파일 위주 — 후속 |
| `extension-catalog.ts:54` Claude 플러그인 특수 분기 | app 조립 루트의 허용 리터럴 |
| `shared/ipc.ts` 기존 요청 interface·type 15 · `infra/db/types.ts SessionRow` | D-011 |
| 배포 확장점 | D-008 · D-015 |
| `createRuntimeModelSnapshotReader`(`runtime-model-startup.ts:64`) 인라인 — 0291 뒤 몸체가 `auth.snapshot` 위임 1줄 | `runtime-model-startup.test.ts` `reads login-free and credential snapshots through auth.snapshot on every call` 이 `bind` 회귀(0291: 로그인 프리 카드 영구 부재)를 잠근다. 인라인하면 잠금이 단위 테스트 없는 bootstrap 으로 옮겨 사라진다 |
| agent 목록 push 재조회 합류(`shared/stores/agentStore.ts` refresh) | push 빈도 = Auth 변화 수(연결 1회 = 2) · 늦은 응답은 seq 로 이미 버린다 — 이득 작음 |
| `runtime-listing.ts` 두 함수 합치기 · `runtimeModelsFromListing` 의 `in` 검사(0291 verify N3) | 가이드 §4 레시피가 두 이름을 쓴다(D-015) · N3 는 `provider/model` id 로 도달 불가(0291 기록) |

- 되돌리기 어려운 결정: 고아 IPC·격리 이관 삭제 — git 이력으로 복원 가능, 사용자 승인.
- 신규 의존성: 없음(jscpd 는 설계 조사용, 저장소에 추가하지 않음).

## 18. 영향 받는 파일 / 문서

- 코드: §10 EP-04·EP-08~EP-18 자리 + §11 표.
- 문서: 이 plan · `docs/handoff/INDEX.md` · `docs/IPC_CONTRACT.md` · `docs/generated/inventory.md` · `docs/arch/backend/{adapters,provider-runtime}.md` · `docs/arch/frontend/design-components.md` · EP-08 #29 검색 출력.
- 도구·기준선: `scan/dead-exports.cjs` · `scan/i18n-unreferenced.cjs` · `scan/vitest-failed-ids.mjs` · `baseline/vitest-failed-ids.txt`(338) · `baseline/dead-exports.tsv`(used 외 645행) · `baseline/i18n-unreferenced.txt`(64) · `baseline/i18n-remove-keys.txt`(14).

## 19. 게이트

- 적용 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 환경: 설계 기준선은 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(postinstall Electron rebuild 성공) 트리. DB·electron 로드 스위트 71파일은 기준선 실패에 포함돼 있다.
- 기본 정적 게이트: `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts`(`npm run lint` 는 `--fix` 라 검증 턴에는 쓰지 않는다).
- 관련 테스트: 전체 `vitest run` JSON → 실패 ID 차집합(§7-A). 스크립트 `node --test scripts/*.test.mjs`.
- 사람 실기: 없음.

## READY self-review

- Decision Ledger D-001~D-015 ACTIVE, OPEN 0, 외부 대체 3건 근거 기록(§3 갱신 메모).
- Part I 만으로 완료 상태(관측 동작 보존 + 3개 변화)가 읽힌다(§1·§5). 0291 착지분은 관측 변화 0 이다(AC23).
- 사용자 원문·결정은 인용으로 보존(§2). "과감한 선택"·"291까지 고려" 의 해석은 추론으로 표시.
- 모든 NEW 노드에 같은 레벨 REQUIRED pair(VP-01~VP-18). 비영향 INHERITED 없음(Baseline). AC 23개(≤25).
- 3차 재검산: §10 자리 검색 31개를 0291 착지 후 HEAD 에서 다시 돌려 30개 동일, 1개(EP-09 #8-11)는 술어가 해법 표기에 묶여 사본 1개를 놓친 것을 고쳤다.
- 각 pair 의 §10 자리 표·검색 명령·설계 시점 N·좌표가 있다. 0건 스윕(VP-04·VP-08)·SSOT(VP-09·VP-10)·맞바꿈(VP-12·VP-13)은 적대 증거를 선택했다.
- 사람 실기로 미룬 순수 로직 없음 — 시각은 클래스 동일성 테스트로 내림.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0(§3 갱신 메모).
- 산출물 문장 규칙: 판정 먼저, 표 위주. 같은 사실을 Part I/II 에 중복하지 않도록 수치는 §8 에만 둔다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | … | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 없음(최초 라운드)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- 분모 검산: …
- 덮개 회귀: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- …

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| 관측한 게이트 산출 | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| AC 자기보고 | … |
| 합계 검산 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 설계 턴의 리뷰 에이전트 8개가 계정 사용량 한도로 두 번 중단 — 설계자가 직접 4관점 수행(§0).
- 현재 라운드·impl 턴: …

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

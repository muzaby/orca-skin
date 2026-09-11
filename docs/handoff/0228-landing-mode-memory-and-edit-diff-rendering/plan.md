# Plan — 0228-landing-mode-memory-and-edit-diff-rendering

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0228-landing-mode-memory-and-edit-diff-rendering` |
| 작성자 | Claude Code |
| 일자 | 2026-09-11 |
| 매핑 | 없음 |
| 상태 | DRAFT → READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제 (셋): ① 컴포저 랜딩이 매번 `code`로 시작해 사용자가 고른 종류를 잊는다. ② Code 대화록의 `Write`/`Edit`/`MultiEdit` 카드에 문법 강조가 없다(`Read`는 있다). ③ `Edit` 카드가 조각 문자열과 1부터 센 줄번호를 보여 실제 파일 위치와 다르다.
- 완료 후 달라지는 것: 랜딩이 지난번 선택으로 열리고(첫 실행은 `work`), 편집 도구 카드가 우측 변경사항 패널과 같은 실제 줄번호·언어별 색으로 그려진다.
- 성공을 사용자 관점에서: **도구 카드만 보고도 그 편집이 파일 몇 번째 줄의 어떤 코드였는지 알 수 있다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "마지막으로 활성화된 work/code 상태를 기억해야 한다. composer 랜딩에서는 마지막으로 선택된 work, code 버튼으로 활성화 되도록 하라. 첫 실행는 work로 고정하라." | 라이브 세션 |
| 명시 요구 | "Code 작업에서 write, edit, multiedit 도구가 언어 문법에 맞는 렌더링 지원이 안되고 있음 (read는 지원함)." | 라이브 세션 |
| 명시 요구 | "Edit 도구는 line 넘버 및 본문도 렌더링이 이상하게 되고있음 (정확하지 않은 텍스트 타겟 및 라인넘버)." | 라이브 세션 |
| 명시 요구 | "Code의 우측 git 패널에서 diff 뷰어가 정상적으로 작동하고 있으니 참고할 것. 또한 read 도구도 언어별로 렌더링을 지원하고 있으니 참고하여 구현할 것" | 라이브 세션 |
| 명시 요구 (기대 출력) | 현재 `1 -  animate` / `1 + animate2`, 기대 `46 - async function animate(): Promise<void> {` / `47 + async function animate2(): Promise<void> {` | 라이브 세션 `<현재 문제점>`·`<diff view 결과 참고용>` |
| 추론 의도 | "마지막으로 선택된 … 버튼"은 **토글 클릭**의 마지막 값이다 — 불러온 세션의 종류가 아니다. 두 번째 문장이 버튼을 주어로 쓴다. | 사용자 문장 |
| 추론 의도 | 기대 출력이 변경된 2줄만 보이므로 카드는 **변경 줄 + 패치가 준 문맥**까지만 그린다. 파일 전체를 열지 않는다. | 사용자 `<diff view 결과 참고용>` |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 랜딩 종류의 기억 단위는 **토글 선택(`SET_AGENT_KIND`)** 이다 | "마지막으로 선택된 work, code 버튼" | 사용자 | ACTIVE | — |
| D-002 | 저장값이 없으면 `work` — 첫 실행 고정값 | "첫 실행는 work로 고정하라" | 사용자 | ACTIVE | — |
| D-003 | 저장 위치는 `Settings.lastAgentKind` (`lastBackend`·`lastSessionId` 와 같은 자리) | 같은 "마지막 상태" 축이고 이미 부트가 읽는다 | 설계 | ACTIVE | — |
| D-004 | 랜딩은 **부트 완료 전** 시드된다 — 부트 후 비동기로 덮어쓰지 않는다 | 히어로 토글이 화면 중앙이라 한 프레임의 잘못된 값도 보인다 | 설계 | ACTIVE | — |
| D-005 | `DEFAULT_AGENT_KIND`(`'code'`)는 바꾸지 않는다. 랜딩 기본값은 별도 상수 | 그 상수는 main 의 DB 행·세션 리스 폴백이라 과거 데이터 해석을 바꾼다 | `app/src/main/infra/db/queries.ts:394`·`session-chain-lease.ts:65` | ACTIVE | — |
| D-006 | `Edit` 카드의 줄번호·본문 정본은 SDK `tool_use_result.structuredPatch` 다 — 결과 텍스트를 파싱하지 않는다 | SDK 문서가 "render from it instead of parsing the tool_result text" 라고 지시한다 | `@anthropic-ai/claude-agent-sdk/sdk.d.ts:4588` | ACTIVE | — |
| D-007 | main 은 편집 도구 결과에서 **`structuredPatch` 만 투영**해 싣는다 — `originalFile`·`gitDiff` 는 싣지 않는다 | `originalFile` 은 편집 전 파일 전체라 영속 비용이 파일 크기에 비례한다 | `sdk-tools.d.ts:3025` `FileEditOutput` | ACTIVE | — |
| D-008 | 구조화 출력을 싣는 도구를 `Edit` 까지 넓힌다 — 기존 "TaskXXX 에만" 계약을 대체한다 | 그 계약의 근거는 "큰 출력 영속"이고 D-007 의 투영이 그 근거를 없앤다 | `app/src/shared/ipc.ts:602-605` | ACTIVE | D-009 를 대체하지 않음 |
| D-009 | `Write` 에는 싣지 않는다 | 입력 `content` 가 이미 파일 전체이고 1번 줄부터 세는 현재 렌더가 정확하다 — 실으면 같은 본문을 두 번 영속한다 | 설계 | ACTIVE | — |
| D-010 | 패치가 없으면(구버전·`MultiEdit`·오류) 기존 `old_string`/`new_string` 쌍 렌더로 폴백한다 | `MultiEdit` 는 현재 SDK 스키마에 없다(`ToolInputSchemas` 전수에 `MultiEditInput` 없음) — 과거 세션만 갖는다 | `sdk-tools.d.ts:11-53` | ACTIVE | — |
| D-011 | 문법 강조는 우측 패널과 같은 경로(`useDiffSyntax` + shiki 토큰)를 쓴다. 새 하이라이터를 만들지 않는다 | "우측 git 패널 … 참고할 것" | 사용자 | ACTIVE | — |
| D-012 | 도구 카드의 3열(줄번호·`+`/`-` 거터·본문) 계약은 유지한다 | `DiffTable` 헤더가 잠근 기존 계약이고 사용자 기대 출력도 같은 형태다 | `app/src/renderer/src/features/chat/components/DiffTable.tsx:6-9` | ACTIVE | — |
| D-013 | Work 모드 도구 본문(`WorkToolBody`)은 건드리지 않는다 | 요구가 "Code 작업"으로 한정되고 Work 본문은 원문 보존이 설계 의도다 | 사용자 문장 · `WorkToolBody.tsx:34` | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001 ~ D-013 (본 handoff 가 최초 턴이다).
- 변경된 결정: 없음.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: 0204 의 "구조화 출력은 tool_result 블록이 정확히 1개일 때만 귀속"(`claude-map.ts:564`) — D-008 이 대상 도구만 넓히고 이 귀속 규칙은 그대로 쓴다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002("첫 실행 work") ↔ AC2("저장값 부재 시 `work`") → 일치. D-005("`DEFAULT_AGENT_KIND` 불변") ↔ AC1·AC2 는 새 상수만 참조 → 일치. D-007("투영만") ↔ AC11("`originalFile`·`gitDiff` 미포함") → 일치. D-009("Write 제외") ↔ AC10(폴백 대상에 `Write` 포함) → 일치. D-012("3열 유지") ↔ AC6·AC7 이 열 구성을 바꾸지 않음 → 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | `DiffBody` 가 `old_string`/`new_string` 만 `buildDiffLines` 에 넣는다 — 파일 위치가 입력에 없어서 1부터 센다(`DiffBody.tsx:18-21`·`diffLines.ts:57`) |
| 이미 기존 코드가 충족하는가 | 아니오 | `DiffTable` 은 `filePath` 를 받지 않고 `useDiffSyntax` 를 부르지 않는다 — 토큰 경로가 `FileDiffSection` 에만 있다(`useDiffSyntax` 호출 1건) |
| 더 작은 해법이 있는가 | 있으나 채택하지 않음 | 결과 텍스트의 `cat -n` 스니펫을 파싱하면 renderer 만 고치면 되지만 SDK 가 명시적으로 금지한다(D-006) |
| 선행 자료의 주장을 코드와 대조했는가 | 예 — 1건 정정 필요 | `ipc.ts:604` 의 "`isTaskToolName` 이 유일한 게이트다" 는 D-008 이후 거짓이 된다. 같은 턴에 문장을 고친다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 1건 충돌 → 대체 | 0204 의 "구조화 출력은 TaskXXX 도구에만"(`ipc.ts:602`) ↔ D-008. 근거(영속 비용)를 D-007 이 제거한다 |
| 랜딩 기본값을 `DEFAULT_AGENT_KIND` 변경으로 풀 수 있는가 | 아니오 | 그 상수는 main 3곳에서 과거 데이터 폴백이다(D-005 근거) |

- 사용자에게 올릴 결정: 없음.
- 코드 조사로 닫은 사실: `structuredOutput` 은 이미 `claude-map → NormalizedEvent → HistoryWriter → tool_result 파트 → resultMap` 로 영속·복원된다(`writer.ts:396`·`parts.ts:241`) — 새 영속 경로를 만들지 않는다.

## 5. 동작 / 사용자 흐름

```text
[앱 시작]
  → [부트 landing-target 스텝이 lastAgentKind 를 읽어 랜딩 초안에 시드]
  → [/new 랜딩의 토글이 그 값으로 활성화 — 첫 실행이면 work]
  ↘ [설정 읽기 실패 = 기존 mandatory 스텝 규칙대로 부트 실패 화면]

[Code 대화 중 Edit 도구 실행]
  → [tool_result 에 structuredPatch 동행]
  → [카드 펼침 = 실제 파일 줄번호 + 언어별 색으로 변경 줄과 문맥 표시]
  ↘ [패치 없음/형상 불일치 = old_string↔new_string 쌍 렌더(줄번호 1부터), 색은 그대로]
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 저장값 없음 + 앱 시작 | 스키마 기본값 `work` 로 시드 | 랜딩 토글이 `work` |
| 토글로 `code` 선택 | `SET_AGENT_KIND` 수용 후 `settingsApi.set({lastAgentKind:'code'})` | 다음 실행 랜딩이 `code` |
| 종류가 잠긴 엔트리(`agentKindLocked`·`sessionId` 보유) | 시드가 건너뛴다 | 진행 중 대화의 종류가 바뀌지 않는다 |
| `Edit` 결과에 `structuredPatch` 있음 | hunk 의 `oldStart`/`newStart` 로 두 축 전진 | 카드가 `46 -` / `46 +` 처럼 실제 줄번호 |
| hunk 줄 수 ≠ `oldLines`/`newLines` | 패치 전체 거부 | 폴백 렌더 — 잘못된 줄번호를 그리지 않는다 |
| 확장자가 미지원(`extToLang` undefined) | 토큰 맵이 비어 있음 | 색 없는 원문, 줄 구조 동일 |

### 파생 UX / 엣지케이스

- loading / empty / error: 결과 도착 전 카드는 지금처럼 입력 JSON 을 보인다(`DiffBody` 폴백 분기). 오류 결과에는 패치가 없어 폴백한다.
- cancel / retry / close / restart: 재시작 후에도 `structuredPatch` 는 tool_result 파트에서 복원된다(AC13).
- concurrency / multi-session: 시드는 `sessionId == null && !agentKindLocked` 엔트리에만 적용한다 — 다른 탭의 진행 중 대화를 건드리지 않는다.
- keyboard / a11y / theme: 토큰 색은 `themeStore` 구독이라 테마 전환에 따라온다(`useDiffSyntax` 가 이미 구독).
- 외부환경/오프라인/폐쇄망: shiki 는 번들 동봉이라 네트워크 의존이 없다(`syntax.ts` `createJavaScriptRegexEngine`).

## 6. 범위 / 비범위

- **범위**: 랜딩 종류 기억·첫 실행 고정값 · Code 대화록 편집 도구 카드의 실제 줄번호·문법 강조 · `Edit` 결과 구조화 패치 투영/영속.
- **비범위**: Work 모드 도구 본문(D-013) · `Write` 의 덮어쓰기 diff(D-009) · `NotebookEdit`(현재 `diff` kind 미등록) · 우측 변경사항 패널 동작 · 단어 단위 강조(`highlightWords`)의 도구 카드 도입.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| `Write` 덮어쓰기의 실제 diff | 아니오 — 같은 리더로 도구만 추가하면 된다 | 후속 |
| 도구 카드의 단어 단위 강조 | 아니오 — `changedWordSpan` 이 이미 있다 | 후속 |
| `Settings.lastAgentKind` 키 이름 | **예 — 저장 형식** | 지금 확정(D-003) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-02 | AT-01 / AC1 | 토글로 고른 종류가 다음 실행의 랜딩에 그대로 활성화된다 | `applyLandingAgentKind` 가 `'code'` 를 시드하면 `NEW_CHAT_KEY` 엔트리의 `agentKind === 'code'` | `runBootSteps` → `seedLandingAgentKind` → `freshEntry`/기존 초안 → `AgentModeToggle` |
| R-02 | AT-02 / AC2 | 저장값이 없으면 `work` 로 활성화된다 | `SettingsSchema.parse({}).lastAgentKind === 'work'` 이고 시드 전 `freshEntry().session.agentKind === 'work'` | `SettingsStore.getAll` → 부트 → 랜딩 |
| R-01 | AT-03 / AC3 | 토글 선택이 설정에 기록된다 | `chatActions.setAgentKind('code')` 후 `settingsApi.set` 가 `{lastAgentKind:'code'}` 로 1회 호출 | `AgentModeToggle.onClick` → `chatActions.setAgentKind` → `settingsApi.set` |
| R-01 | AT-04 / AC4 | 잠긴 종류는 기록·시드 어느 쪽으로도 바뀌지 않는다 | 잠긴 엔트리에 `seedLandingAgentKind('code')` 를 적용해도 `agentKind` 불변, 잠긴 상태의 `setAgentKind` 는 `settingsApi.set` 미호출 | 같은 경로 |
| R-01 | AT-05 / AC5 | 손상된 저장값이 부팅을 막지 않는다 | `SettingsSchema.parse({lastAgentKind:'bogus'}).lastAgentKind === 'work'` | `SettingsStore.load` |
| R-03 | AT-06 / AC6 | `Edit` 카드가 패치의 실제 파일 줄번호를 그린다 | `structuredPatch` `{oldStart:46,newStart:46}` 를 준 `Edit` 카드 렌더 결과의 거터 텍스트가 `46` 을 담고 `1` 이 아니다 | `claude-map` → `tool.call.completed.structuredOutput` → `resultMap` → `DiffBody` → `DiffTable` |
| R-03 | AT-07 / AC7 | 카드 본문이 조각이 아니라 패치가 준 줄 전체를 그린다 | 같은 렌더에서 `-` 행 본문이 `async function animate(): Promise<void> {` 전체와 같다 | 같은 경로 |
| R-04 | AT-08 / AC8 | 지원 언어면 편집 도구 카드 본문에 토큰 색이 붙는다 | `useDiffSyntax` 가 토큰을 준 상태의 `DiffTable` 렌더에 `style="color:…"` span 이 존재하고 텍스트 원문이 보존된다 | `DiffBody` → `DiffTable` → `useDiffSyntax` → shiki |
| R-04 | AT-09 / AC9 | 토큰이 없어도 원문·줄 구조가 동일하다 | 빈 토큰 맵에서 같은 행 개수·같은 본문 텍스트, `span[style]` 0개 | 같은 경로 |
| R-03 | AT-10 / AC10 | 패치가 없으면 기존 쌍 렌더로 폴백한다 | `structuredOutput` 없는 `Edit`·`Write`·`MultiEdit` 카드가 지금과 같은 행 수/본문을 낸다 | `DiffBody` 폴백 분기 |
| R-03 | AT-11 / AC11 | main 은 패치만 싣는다 | `Edit` tool_result 매핑 결과 `structuredOutput` 의 키가 `['structuredPatch']` 이고 `originalFile`·`gitDiff` 가 없다 | `claude-map.mapClaudeMessage` |
| R-03 | AT-12 / AC12 | 형상이 어긋난 패치는 거부된다 | `oldLines`/`newLines` 와 실제 줄 수가 다른 hunk 를 준 리더가 `null` 을 반환한다 | `readFileEditStructuredPatch` |
| R-03 | AT-13 / AC13 | 세션 재로드 후에도 같은 줄번호가 복원된다 | 영속 파트 → `resultMap` 을 거친 `ToolCall.result.structuredOutput` 이 같은 hunk 를 갖는다 | `writer.ts` → DB → `parts.resultMap` → `DiffBody` |

### AC 검증 주의사항

- 기존 테스트 재사용: `registry.test.ts` `'Write/Edit/MultiEdit → diff'` 케이스 존재 확인함(파일 19-24행) — `FILE_EDIT_TOOLS` SSOT 이동의 회귀 oracle 로 쓴다. `toolMeta.test.ts:74-80` 의 `FILE_TOOLS / FILE_EDIT_TOOLS` describe 도 존재 확인함.
- 사람 실기 항목: 없음 — 색 **값**의 시각 품질은 우측 패널과 같은 토큰 소스라 새 판단이 없고, 색 **부착 여부**는 `span[style]` 로 단언한다.
- N회/총량 기준: AC3 의 "1회 호출" 은 `settingsApi.set` 을 부르는 프로덕션 호출부 전수에서 유도한다 — `rg "settingsApi\.set" app/src/renderer/src --glob '!*.test.*'` 로 확인하고, 관측은 이번에 추가하는 `setAgentKind` 경로 한 항만 단언한다.
- 총량/0건 기준: AC11 의 "키가 `['structuredPatch']`" 는 0건 스윕이 아니라 **키 집합 동등**이다 — 필드가 늘면 실패한다.

## 7-A. V / Trace Matrix

- V mode 판정: `Baseline V` — 상속할 명시적 V 가 없다(0204·0211 은 V 이전 형식의 handoff 다).
- 기준 V 상속 근거: 없음.
- 변경이 시작되는 수준: R.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 랜딩 종류 기억(선택 기록) | NEW | — |
| R-02 | R | §7 랜딩 종류 복원 + 첫 실행 `work` | NEW | — |
| R-03 | R | §7 `Edit` 카드 실제 줄번호·전체 줄 | NEW | — |
| R-04 | R | §7 편집 도구 카드 문법 강조 | NEW | — |
| AT-01…AT-13 | AT | §7 표 | NEW | — |
| SD-01 | SD | §5·§9 부트 완료 전 시드 순서 | NEW | — |
| SD-02 | SD | §5·§12 구조화 패치 end-to-end(생성→영속→재로드→렌더) | NEW | — |
| AR-01 | AR | §10 `Settings.lastAgentKind` 계약(스키마·패치·타입) | NEW | — |
| AR-02 | AR | §10 구조화 출력 대상 도구 게이트 확장 + 투영 | NEW | — |
| AR-03 | AR | §10 `DiffTable` 렌더 계약 + `syntaxText` SSOT | NEW | — |
| MD-01 | MD | §10·§11 `shared/file-edit-tool.ts` 패치 리더·변환 불변식 | NEW | — |
| MD-02 | MD | §11 `seedLandingAgentKind`/`freshEntry` 시드 불변식 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-03·AT-04 | REQUIRED | `AgentModeToggle.onClick → chatActions.setAgentKind → settingsApi.set` | `chatStore.agentKind` 스위트에서 `settingsApi.set` 인자 단언 | not selected — 직접 호출 인자 관측 | EP-01 (1) |
| VP-02 | R-02 ↔ AT-01·AT-02·AT-05 | REQUIRED | `runBootSteps → applyLandingAgentKind → seedLandingAgentKind → freshEntry → AgentModeToggle` | 시드 후 스토어 엔트리의 `agentKind` 직접 관측 + 스키마 파싱값 | not selected — 상태값 직접 관측 | EP-02·EP-03 (2) |
| VP-03 | R-03 ↔ AT-06·AT-07·AT-10·AT-13 | REQUIRED | `claude-map.tool.call.completed → writer/parts → resultMap → DiffBody → DiffTable` | 렌더 HTML 의 거터 숫자·본문 문자열 직접 단언 | not selected — 화면 산출 직접 관측 | EP-04·EP-05 (2) |
| VP-04 | R-04 ↔ AT-08·AT-09 | REQUIRED | `DiffBody → DiffTable → useDiffSyntax → syntaxText` | 토큰 주입/미주입 두 렌더의 `span[style]` 유무와 텍스트 동일성 | required — `syntaxText` 를 원문 `slice` 로 되돌리는 변이(토큰을 무시해도 텍스트는 같아 텍스트 단언만으로는 침묵한다) | EP-06 (1) |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | `RootGate.runBoot → createBootSteps(landing-target, mandatory) → AppLayout` | `landing-target` 스텝이 `applyLandingAgentKind` 를 부르고 그 스텝이 `mandatory` 임을 단언 | not selected — 스텝 정의 직접 관측 | EP-02 (1) |
| VP-06 | SD-02 ↔ ST-02 | REQUIRED | `claude-map → HistoryWriter JSON → tool_result 파트 → parts.resultMap → DiffBody` | 매핑 산출을 파트 JSON 으로 왕복시킨 뒤 같은 hunk 가 나오는지 단언 | not selected — 왕복 산출 직접 비교 | EP-05 (1) |
| VP-07 | AR-01 ↔ IT-01 | REQUIRED | `settingsApi.set → CHANNELS.settingsSet → SettingsPatchSchema → SettingsStore.patch` | 패치 스키마가 `lastAgentKind` 를 통과시키고 잘못된 값은 거부함을 단언 | not selected — 스키마 파싱 직접 관측 | EP-03 (1) |
| VP-08 | AR-02 ↔ IT-02 | REQUIRED | `tool_use(Edit) → ctx 집합 → tool_result → structuredOutput 투영` | 매핑 산출의 `structuredOutput` 키 집합 동등 단언(AC11) | required — 투영을 제거하고 SDK 원본을 그대로 싣는 변이(`originalFile` 이 통과하면 실패해야 한다) | EP-04 (1) |
| VP-09 | AR-03 ↔ IT-03 | REQUIRED | `FileDiffSection`·`DiffTable` 두 소비자 → `components/diffSyntaxText` | 두 소비자가 같은 모듈을 import 하고, `FileDiffSection` 의 기존 토큰 케이스가 그대로 통과 | not selected — 기존 `diffSyntax.render.test.ts` 두 케이스가 직접 산출을 본다 | EP-06 (1) |
| VP-10 | MD-01 ↔ UT-01 | REQUIRED | `readFileEditStructuredPatch` / `fileEditPatchLines` | 정상·거부(AC12)·빈 hunk 입력의 반환값 직접 단언 | not selected — 순수 함수 반환값 관측 | EP-05 (1) |
| VP-11 | MD-02 ↔ UT-02 | REQUIRED | `seedLandingAgentKind` → 스토어 엔트리 | 잠긴/안 잠긴 엔트리 두 경우의 `agentKind` 직접 단언(AC4) | not selected — 상태값 직접 관측 | EP-02 (1) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| subtree `app/**` 정적 게이트 | `app/src` 의 main·shared·renderer 를 모두 고친다 | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| subtree `app/**` 순수 테스트 | reducer·순수 변환기·렌더 스냅샷을 추가한다 | `cd app && ./node_modules/.bin/vitest run <suite>` | better-sqlite3 ABI 로 red 인 DB 스위트는 환경 기인 분리 |
| repository — 문서 인벤토리 | `docs/` 에 새 문서를 추가한다 | `cd app && node scripts/check-doc-inventory.mjs --check` | 링크·수치 위반만 blocking |
| message-bus — 커밋 trailer | 설계·구현 커밋을 분리해 남긴다 | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `DiffBody` 는 도구 입력만 쌍으로 접는다 — 파일 위치 입력이 없다 | `app/src/renderer/src/features/chat/components/transcript/tool-bodies/DiffBody.tsx:11-33` |
| `buildDiffLines` 는 두 축을 1부터 전진시킨다 | `app/src/renderer/src/features/chat/lib/diffLines.ts:57-60` |
| `DiffTable` 은 `DiffPair` 만 받고 토큰 경로가 없다 | `app/src/renderer/src/features/chat/components/DiffTable.tsx:9-12` |
| 우측 패널은 `useDiffSyntax` + `syntaxText` 로 토큰을 그린다 | `app/src/renderer/src/features/chat/components/rightpanel/FileDiffSection.tsx:461·488-505` |
| `highlightDiffLines` 는 `DiffLine` **객체 동일성**으로 토큰을 키잉한다 — 소비자는 같은 배열을 넘겨야 한다 | `app/src/renderer/src/features/chat/lib/diffSyntax.ts:11-13·30-34` |
| `patchLinesToDiffLines` 가 패치 줄 → `DiffLine` 변환의 단일 자리다 | `app/src/renderer/src/features/chat/lib/diffPatchLines.ts:4-9` |
| SDK `FileEditOutput` 은 `structuredPatch: {oldStart,oldLines,newStart,newLines,lines:string[]}[]` 를 준다 | `node_modules/@anthropic-ai/claude-agent-sdk/sdk-tools.d.ts:3025-3053` |
| SDK 가 `tool_use_result` 를 "render from it instead of parsing the tool_result text" 로 규정한다 | `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:4588` |
| `structuredOutput` 은 tool_result 블록이 정확히 1개일 때만 귀속된다 | `app/src/main/adapters/claude-map.ts:563-569` |
| `Settings` 는 `lastBackend`·`lastSessionId` 라는 같은 축의 "마지막 상태" 키를 이미 갖는다 | `app/src/shared/protocol.ts:652-653` |
| 부트 `landing-target` 스텝이 이미 `settingsApi.get()` 을 읽고 mandatory 다 | `app/src/renderer/src/app/boot/steps.ts:56-60·92-99` |
| `freshEntry` 가 새 대화 엔트리의 유일한 생성자이고 `cwdCache` 동형 캐시 선례가 있다 | `app/src/renderer/src/features/chat/store/chatStore.ts:146-155` |
| `DEFAULT_AGENT_KIND` 는 main 3곳의 과거 데이터 폴백이다 | `app/src/main/features/agents/profiles.ts:44`·`session-chain-lease.ts:65`·`infra/db/queries.ts:394` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `DiffTable` 소비자 | `rg "DiffTable" app/src` (정의 파일 제외) | 1 | `DiffBody` 하나라 props 계약을 바꿔도 파급이 없다 |
| `syntaxText` 정의 | `rg "function syntaxText" app/src` | 1 | 사본이 아직 없다 — SSOT 로 올리면 소비자 2 |
| `useDiffSyntax` 호출 | `rg "useDiffSyntax\(" app/src --glob '!*.test.*'` | 1 | 도구 카드가 두 번째 호출자가 된다 |
| `FILE_EDIT_TOOLS` 참조 | `rg "FILE_EDIT_TOOLS" app/src` | 정의 1 · 소비 3 · 테스트 4 | SSOT 이동 시 갱신 지점이 닫혀 있다 |
| `structuredOutput` 생산 지점(main) | `rg "structuredOutput" app/src/main --glob '!*.test.*'` | 4 (`claude-map` 3 · `writer` 1) | 게이트를 넓히는 자리는 `claude-map:565` 하나다 |
| `structuredOutput` 소비 지점(renderer) | `rg "structuredOutput" app/src/renderer --glob '!*.test.*' --glob '!**/i18n/**'` | 8 | Task 전용 소비자는 모두 도구 이름을 다시 확인한다 |
| `DEFAULT_AGENT_KIND` 참조 | `rg "DEFAULT_AGENT_KIND" app/src` | 8 (main 4 · renderer 3 · 정의 1) | 값을 바꾸면 main 폴백 3곳이 함께 변한다 → D-005 |
| `settingsApi.set` 프로덕션 호출부 | `rg "settingsApi\.set" app/src/renderer/src --glob '!*.test.*'` | 3 | AC3 의 "1회" 는 이번에 추가하는 항만 관측한다 |

### 수치 / 전칭 표현 검산

- 재측정 수치: 위 표 전건을 이번 세션에서 다시 셌다. `FILE_EDIT_TOOLS` 8건 = 정의 1 + 소비 3 + 테스트 4 (내역 합 = 총계).
- “유일한/항상/절대” 반례 검색: `ipc.ts:604` 의 "`isTaskToolName` 이 유일한 게이트다" 는 현재 참이다(`rg "structuredOutput" claude-map.ts` → 게이트 조건 1곳). D-008 이 이 문장을 거짓으로 만들므로 같은 턴에 고친다.
- 문서 앵커 / 기존 테스트 케이스 존재 확인: `registry.test.ts:19` `'Write/Edit/MultiEdit → diff'`, `toolMeta.test.ts:74` `'FILE_TOOLS / FILE_EDIT_TOOLS'`, `diffSyntax.render.test.ts:61·71` 두 케이스, `steps.test.ts:52` `'lastSessionId 로 기존 채팅 랜딩 타겟을 만든다'` 모두 실재한다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `SD-02`, `AR-01`~`AR-03`
- 현재 책임 소유자: 랜딩 종류 = `initialChatState`(정적 상수) · 도구 diff = `DiffBody` + `DiffTable` · 토큰 = `FileDiffSection` 내부 `syntaxText`
- 현재 entry → flow → state → consumer: 부트는 `lastSessionId` 만 읽고 랜딩 종류는 읽지 않는다. `claude-map` 은 TaskXXX 결과에만 `structuredOutput` 을 실어 편집 결과의 패치가 버려진다. `DiffBody` 는 남은 입력(`old_string`/`new_string`)만으로 diff 를 만든다.
- 현재 오류/취소/정리 경로: 결과 미도착·오류면 `DiffBody` 가 입력 JSON 을 그대로 보인다.
- 문제의 직접 원인: 파일 위치와 언어를 아는 값이 렌더까지 오지 않는다 — 카드가 볼 수 있는 것은 조각뿐이다.

```text
[SDK tool_result]
  → [claude-map: TaskXXX 만 structuredOutput]
  → [ToolCall.result.output(텍스트)]
  → [DiffBody: input 쌍만 → buildDiffLines(1부터)] → [DiffTable: 색 없음]
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 동일
- 변경 후 책임 소유자: 랜딩 종류 = `Settings.lastAgentKind` + `chatStore` 시드 캐시 · 편집 패치 해석 = `shared/file-edit-tool.ts` · 토큰 렌더 = `components/diffSyntaxText.tsx`(두 소비자 공용)
- 변경 후 entry → flow → state → consumer: 부트가 `lastAgentKind` 를 시드하고, `claude-map` 이 `Edit` 결과에서 `structuredPatch` 만 투영해 기존 `structuredOutput` 경로로 흘리며, `DiffBody` 가 그 패치를 `GitDiffPatchLine[]` 로 바꿔 기존 `patchLinesToDiffLines` 로 `DiffLine[]` 를 만들고 `DiffTable` 이 `filePath` 로 토큰을 얹는다.
- 변경 후 오류/취소/정리 경로: 패치 부재·형상 불일치·언어 미지원은 모두 **기존 렌더로 폴백**한다 — 빈 화면이 생기는 분기가 없다.
- 유지하는 기존 메커니즘: `structuredOutput` 영속/복원 경로 · `patchLinesToDiffLines` · `useDiffSyntax` · 3열 계약. 대체하는 것: "구조화 출력은 TaskXXX 에만" 문장(D-008).

```text
[SDK tool_result + tool_use_result]
  → [claude-map: Task ∪ Edit → structuredOutput = {structuredPatch}]
  → [HistoryWriter/parts → ToolCall.result.structuredOutput]
  → [DiffBody: readFileEditStructuredPatch → fileEditPatchLines → patchLinesToDiffLines]
  → [DiffTable(lines, filePath): useDiffSyntax → syntaxText]
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 랜딩 종류가 정적 상수 | `Settings` 가 소유하고 부트가 시드 | D-001·D-003 | AR-01 / VP-02·VP-07 · `chatStore.ts`·`protocol.ts` |
| data/control flow | 편집 패치가 adapter 에서 버려진다 | `Edit` 결과에 투영해 동행 | D-006·D-007 | SD-02 / VP-06·VP-08 · `claude-map.ts` |
| state/contract | `DiffTable(oldValue,newValue)` | `DiffTable(lines, filePath?)` | 패치 기반 줄과 쌍 기반 줄을 같은 렌더가 받아야 한다 | AR-03 / VP-03·VP-04 · `DiffTable.tsx` |
| error/lifecycle | 폴백 분기 1개(결과 없음) | 폴백 분기 3개(결과 없음·패치 없음·형상 불일치) | 잘못된 줄번호를 그리지 않는다 | SD-02 / VP-10 · `file-edit-tool.ts` |
| test seam/관측점 | 토큰 렌더가 `FileDiffSection` 내부 함수 | `components/diffSyntaxText.tsx` 공용 모듈 | 두 소비자가 같은 규칙을 쓴다 | AR-03 / VP-09 · `diffSyntax.render.test.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/src/shared/file-edit-tool.ts` | 편집 도구 이름 SSOT · 구조화 패치 검증/변환 | `unknown` → `FileEditPatchHunk[] \| null`, hunk → `GitDiffPatchLine[]` | `claude-map`(main) · `toolMeta`·`DiffBody`(renderer) |
| `app/src/main/adapters/claude-map.ts` | `Edit` tool_use id 기억 + tool_result 에 패치 투영 | SDK 메시지 → `NormalizedEvent` | `adapters/claude.ts` |
| `.../components/diffSyntaxText.tsx` | 토큰 → React 노드(부분 범위 포함) | `DiffLine`+토큰 → `ReactNode` | `FileDiffSection` · `DiffTable` |
| `.../components/DiffTable.tsx` | 3열 표 렌더 + 토큰 부착 | `DiffLine[]`·`filePath?` → JSX | `DiffBody` |
| `.../tool-bodies/DiffBody.tsx` | 도구 결과/입력 중 어느 것으로 줄을 만들지 판정 | `ToolCall` → `DiffLine[]` 묶음 | `registry` |
| `.../store/chatStore.ts` | 랜딩 종류 캐시 + 시드 + 선택 영속 | `AgentKind` → 스토어/설정 | `app/boot/steps.ts` · `AgentModeToggle` |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| EP-01 · AR-01 / VP-01 | 토글 선택은 수용된 경우에만 영속한다 | `chatStore.setAgentKind` | renderer | 토글 클릭 시 | 잠긴 대화의 종류가 다음 실행 랜딩을 오염시킨다 |
| EP-02 · MD-02 / VP-02·VP-05·VP-11 | 시드는 `sessionId == null && !agentKindLocked` 엔트리에만 적용 | `chatStore.seedLandingAgentKind` | renderer | 부트 `landing-target` 스텝 | 진행 중 대화의 종류가 바뀐다 |
| EP-03 · AR-01 / VP-02·VP-07 | `lastAgentKind` 는 `AGENT_KINDS` 열거이고 기본·복구값은 `work` | `shared/protocol.ts` `SettingsSchema`·`SettingsPatchSchema` | main | 설정 읽기(`load`)·쓰기(`patch`) 시 | 손상 값이 부팅을 막거나 랜딩이 빈 상태가 된다 |
| EP-04 · AR-02 / VP-08 | 편집 결과 `structuredOutput` 은 `{structuredPatch}` 투영만 담는다 | `claude-map.ts` tool_result 분기 | main | 매 tool_result 매핑 | `originalFile`(파일 전체)이 DB 에 영속된다 |
| EP-05 · MD-01 / VP-03·VP-06·VP-10 | hunk 줄 수가 `oldLines`/`newLines` 와 같을 때만 패치를 채택한다 | `shared/file-edit-tool.ts` `readFileEditStructuredPatch` | main·renderer 공용 | 투영 시점 + 렌더 시점 | 카드가 실제와 다른 줄번호를 사실처럼 보인다 |
| EP-06 · AR-03 / VP-04·VP-09 | 토큰 → 노드 변환 규칙은 한 모듈이 갖는다 | `components/diffSyntaxText.tsx` | renderer | 두 소비자 렌더 시 | 같은 diff 가 화면마다 다른 색/이스케이프를 낸다 |

- 같은/동일 규칙이 여러 레이어에 있다면 SSOT 와 공유 방법: 편집 도구 이름과 패치 해석은 `app/src/shared/file-edit-tool.ts` 하나가 갖고 main·renderer 가 모두 import 한다(`shared/task-tool.ts` 선례와 동형).
- EP-05 가 두 지점(투영·렌더)인 이유: main 이 투영한 값도, 과거 세션이 영속한 값도 렌더 입력이 된다 — 렌더만 검사하면 투영이 쓰레기를 통과시켜도 DB 에 남고, 투영만 검사하면 과거 데이터가 걸러지지 않는다.
- `실패 의미`에 “다른 게이트가 막는다”를 적은 행: 없음.
- 선택적 필드의 `true/false/undefined` 의미: `structuredOutput === undefined` = 패치 없음(폴백). `null` 은 만들지 않는다.
- 외부 SDK 경계의 실제 요구 타입/의미: `tool_use_result` 는 `unknown` 이라 `readFileEditStructuredPatch` 가 런타임 형상 검사를 전담한다 — `as` 단언을 쓰지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/agent-kind.ts` | 종류 상수 | `DEFAULT_LANDING_AGENT_KIND = 'work'` 추가(기존 `DEFAULT_AGENT_KIND` 불변) | 순수 |
| `app/src/shared/protocol.ts` | 설정 스키마 | `SettingsSchema.lastAgentKind`(catch·default = 랜딩 기본) + `SettingsPatchSchema.lastAgentKind` | 순수 |
| `app/src/shared/ipc.ts` | 설정/이벤트 타입 | `Settings.lastAgentKind` 추가 · `structuredOutput` 주석 2곳을 D-008 로 정정 | 타입 |
| `app/src/shared/file-edit-tool.ts` **(신규)** | 편집 도구 SSOT | 이름 집합 · `FileEditPatchHunk` · `readFileEditStructuredPatch` · `fileEditPatchLines` | 순수 단위 |
| `app/src/main/adapters/claude-map.ts` | SDK→이벤트 | `fileEditToolRunIds` 집합 + tool_result 에서 패치 투영 | 순수(메시지 입력) |
| `app/src/main/features/history/writer.ts` | 영속 | 주석만 정정(대상 도구 확장) | 해당 없음 |
| `app/src/renderer/src/features/chat/lib/toolMeta.ts` | 도구 메타 | `FILE_EDIT_TOOLS` 를 shared SSOT 에서 파생 | 순수 |
| `app/src/renderer/src/features/chat/components/diffSyntaxText.tsx` **(신규)** | 토큰 렌더 | `FileDiffSection` 의 `syntaxText` 를 이설 | 렌더 |
| `.../components/rightpanel/FileDiffSection.tsx` | 패널 diff | 지역 `syntaxText` 삭제 후 공용 모듈 import | 기존 렌더 테스트 |
| `.../components/DiffTable.tsx` | 도구 카드 표 | props → `{lines, filePath?}`, `useDiffSyntax` + `syntaxText` 적용 | 렌더 |
| `.../components/transcript/tool-bodies/DiffBody.tsx` | 도구 본문 | 패치 우선 → 쌍 폴백, `filePath` 전달 | 렌더 |
| `.../reducer/chatReducer.ts` | 리듀서 | `markCompletedAgentTask` 주석 정정(게이트가 더 이상 Task 전용 아님) | 기존 테스트 |
| `.../store/chatStore.ts` | 스토어 | `landingAgentKind` 캐시 · `seedLandingAgentKind` · `setAgentKind` 영속 | 스토어 하네스 |
| `.../features/chat/index.ts` | 배럴 | `seedLandingAgentKind` 공개 | 해당 없음 |
| `.../app/boot/steps.ts` | 부트 | `applyLandingAgentKind` 의존 + `landing-target` 에서 await | 의존 스텁 |

세부:

1. **`readFileEditStructuredPatch(value)`** — `value` 가 객체이고 `structuredPatch` 가 배열이며 각 원소의 `oldStart`/`oldLines`/`newStart`/`newLines` 가 유한 정수, `lines` 가 문자열 배열일 때만 통과. `fileEditPatchLines` 가 hunk 를 훑어 `+`→added(new 축만 전진) · `-`→removed(old 축만) · `\`→건너뜀 · 그 외→unchanged(두 축) 로 바꾸고, 훑은 뒤 added+unchanged 수가 `newLines` 와, removed+unchanged 수가 `oldLines` 와 다르면 `null` 을 돌려준다(EP-05).
2. **`claude-map`** — `tool_use` 분기에서 `isFileEditStructuredTool(toolName)`(현재 `Edit` 만)이면 `ctx.fileEditToolRunIds` 에 담고, tool_result 분기에서 기존 `singleToolResult` 가드를 그대로 통과한 경우에만 `readFileEditStructuredPatch(msg.tool_use_result)` 결과를 `{ structuredPatch }` 로 싣는다. Task 경로와 배타 분기라 한 결과에 두 의미가 섞이지 않는다.
3. **`DiffBody`** — ① `readFileEditStructuredPatch(call.result?.structuredOutput)` 성공 → `patchLinesToDiffLines(fileEditPatchLines(...))` 로 묶음 1개. ② 실패 → 기존 `buildPairs` → 쌍마다 `buildDiffLines`. ③ 둘 다 비면 지금처럼 입력 JSON. `filePath` 는 `call.input.file_path` 에서 읽는다.
4. **`DiffTable`** — `lines` 를 그대로 렌더하고 `useDiffSyntax(lines, filePath ?? '')` 를 **무조건** 호출한다(`extToLang('')` 가 `undefined` 라 빈 맵이 돌아온다 — 훅 순서가 분기하지 않는다). 본문 셀은 `syntaxText(line, tokens[axis])`, `axis` 는 `removed ? 'old' : 'new'`.
5. **`chatStore`** — `let landingAgentKind: AgentKind = DEFAULT_LANDING_AGENT_KIND`. `freshEntry` 는 `chatReducer(initialChatState, {type:'SET_AGENT_KIND', kind: landingAgentKind})` 를 기반으로 만든다(권한 모드 강등 규칙을 복사하지 않고 재사용). `seedLandingAgentKind(kind)` 는 캐시를 갱신하고 조건에 맞는 엔트리에 같은 리듀서를 적용한다. `setAgentKind` 는 dispatch 후 실제 수용됐을 때만 캐시 갱신 + `settingsApi.set`.
6. **`steps.ts`** — `BootDependencies.applyLandingAgentKind: () => Promise<void>`; 기본 구현은 `settingsApi.get()` → `seedLandingAgentKind(settings.lastAgentKind)`. `landing-target` 스텝이 `getLastSessionId` 와 함께 await 한다(둘 다 mandatory 스텝 안이라 부트 완료 전에 끝난다).

### 테스트 가능성

- electron/DB/native 의존부와 분리할 **별도 순수 파일**: `shared/file-edit-tool.ts` 는 import 그래프가 `shared/ipc` 타입뿐이라 네이티브를 로드하지 않는다. `claude-map` 은 이미 순수 메시지 입력 테스트를 갖는다.
- 기존 메커니즘 재사용 시 형상/시점 적합성: `structuredOutput` 은 `unknown` 이라 새 shape 를 실어도 스키마 변경이 없고, `parts.resultMap` 이 필드를 조건부로 복사해 과거 파트와 전방 호환이다.
- 순서를 관측할 훅/로그/주입 경계: 부트 순서는 `createBootSteps(deps)` 의 스텝 배열과 `mandatory` 플래그로 관측한다.

## 12. End-to-end 영향

### producer → consumer

```text
claude-map(Edit tool_result) → NormalizedEvent.structuredOutput({structuredPatch})
  → HistoryWriter(JSON 영속) / 라이브 이벤트
  → parts.resultMap → ToolCall.result.structuredOutput
  → DiffBody(패치 판정) → DiffTable(줄+토큰)
```

- producer 기준: hunk 좌표는 SDK 가 준 `oldStart`/`newStart` 를 그대로 쓴다 — renderer 가 재계산하지 않는다.
- consumer 파생 규칙: `lineNo` 는 기존 단일 거터 계약(removed=old 축, 그 외 new 축)을 `patchLinesToDiffLines` 가 이미 소유한다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: `DiffBody` 는 패치가 있으면 `buildDiffLines` 를 부르지 않는다 — 두 줄 생성기가 한 카드에 동시에 쓰이지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `markCompletedAgentTask`(`chatReducer.ts:1876`) | `structuredOutput` 유무 게이트가 편집 결과에도 열린다 — 바로 뒤 `toolName !== 'TaskUpdate'` 에서 걸러져 동작은 불변, 비용은 역탐색 1회 | AC6 렌더 경로 + 기존 Task 스위트 |
| `WorkToolBody`(`:44`) | `taskTool &&` 선행 조건이 있어 영향 없음 | 기존 `WorkToolBody.render` 스위트 |
| `taskBoard.ts:173` | `isTaskToolName` 재확인 후 소비 — 영향 없음 | 기존 taskBoard 스위트 |
| `HistoryWriter`(`:396`) | 편집 결과 파트가 필드를 하나 더 갖는다 | AC13 |
| `SettingsStore.getAll` 소비자 전체 | 키 1개 증가 — 기존 소비자는 자기 키만 읽는다 | AC5 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 랜딩 시드는 부트 1회. 편집 패치는 tool_result 마다.
- 취소/중단: 중단된 도구는 결과가 없어 패치도 없다 → 폴백.
- 종료/quit/crash/renderer-gone: 설정 쓰기는 fire-and-forget(`void settingsApi.set`) — 실패해도 현재 화면 상태는 유지되고 다음 선택이 다시 쓴다.
- retry/timeout/partial failure: shiki 로드 실패는 `useDiffSyntax` 의 `.catch` 가 흡수해 색 없는 원문으로 남는다(기존 동작).
- cleanup/rollback: 새 구독·타이머 없음.
- **다중 저장소 쓰기**: 이번 제품 경로에는 없다 — 설정(`electron-store`)과 대화 DB 는 같은 동작이 함께 쓰지 않는다. **문서 산출은 해당한다**: 이 handoff 의 판정·상태 사본이 `plan.md` 와 `docs/handoff/INDEX.md` 두 곳에 산다 — 설계 커밋에서 둘을 함께 갱신하고, verify 턴이 INDEX 와 실제 상태의 일치를 확인한다.

## 14. 성능 / 상한 / 최적화

- 새 출력의 `원천 상한 × 배치 상한`: 편집 1건의 패치 = (변경 줄 + hunk 문맥) 줄. `Edit` 의 `old_string`+`new_string` 은 이미 입력으로 영속되므로 증가분은 문맥 줄뿐이다. 한 턴의 편집 수 × hunk 수로 선형이며 `originalFile`(파일 전체)은 D-007 로 제외한다.
- 새 요청 수: 0 — 새 IPC 채널이나 원격 호출이 없다.
- 구조적 목표: 없음.
- 캐시/호출 축소로 잃는 부수 효과: `DiffTable` 이 `useDiffSyntax` 를 부르므로 카드를 처음 펼칠 때 shiki 로드가 1회 일어난다. `ToolCard` 는 한 번도 펼치지 않은 카드의 본문을 마운트하지 않으므로(`ToolCard.tsx` `wasOpened`) 대화록 스크롤 비용은 늘지 않는다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 외부/배포 구현자가 채우는 포트를 만들지 않는다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 구조화 출력은 TaskXXX 도구에만 싣는다(0204) | `app/src/shared/ipc.ts:602-605` | D-008 · §10 EP-04 | **변경** — 투영으로 영속 비용 근거를 없애고 `Edit` 추가 |
| 구조화 출력 귀속은 tool_result 1개일 때만(0204) | `claude-map.ts:563-569` | §11 구현 설계 2 | 유지 |
| diff 줄 파생은 `lib/diffLines` 가, 렌더는 `DiffTable` 이 갖는다(0206 D-019) | `diffLines.ts:4-7` | §11 구현 설계 3·4 | 유지 — `buildDiffLines` 호출부만 `DiffBody` 로 올라간다 |
| 패치 줄 → `DiffLine` 변환은 한 자리(0211 ΔV4) | `diffPatchLines.ts:4-9` | §11 구현 설계 3 | 유지 — 도구 카드가 같은 변환기를 쓴다 |
| `DiffTable` 3열 계약 | `DiffTable.tsx:6-9` | D-012 | 유지 |
| 도구 이름 배열의 소유자는 shared 한 곳(0212 §10 EP-11) | `registry.ts:88-90` | §11 `file-edit-tool.ts` | 유지 — 같은 원칙을 편집 도구에 적용 |
| `DEFAULT_AGENT_KIND` 는 과거 데이터 폴백(0224) | `agent-kind.ts:5` | D-005 | 유지 — 값을 바꾸지 않는다 |
| Work 본문은 원문 보존(0224) | `WorkToolBody.tsx:34` | D-013 | 유지 |
| 새 의존성은 사용자 승인 필요 | `app/AGENTS.md §의존성 정책` | §17 | 유지 — 신규 의존성 0 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| SDK 가 `structuredPatch` 형상을 바꾼다 | 런타임 형상 검사 후 `null` → 폴백. 화면이 깨지지 않는다(EP-05) |
| `MultiEdit` 는 SDK 스키마에 없어 패치가 오지 않는다 | D-010 폴백. 과거 세션도 지금과 같은 렌더를 유지한다 |
| 편집 결과 파트가 커진다 | D-007 투영 + §14 상한 계산 |
| `DiffTable` props 변경이 다른 소비자를 깬다 | 전수 1건(§8) — `DiffBody` 하나만 고친다 |
| 부트 스텝 추가가 시작을 늦춘다 | `settingsApi.get` 은 main 의 메모리 캐시 읽기다(`SettingsStore.load` 가 1회만 디스크 접근) |

- 되돌리기 어려운 결정: `Settings.lastAgentKind` 키 이름(저장 형식) — D-003 에서 기존 `last*` 관례에 맞춰 확정했다.
- 신규 의존성: 없음 → 사용자 승인 불필요.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/{agent-kind,protocol,ipc,file-edit-tool}.ts`
- `app/src/main/adapters/claude-map.ts` · `app/src/main/features/history/writer.ts`
- `app/src/renderer/src/app/boot/steps.ts`
- `app/src/renderer/src/features/chat/{index.ts,store/chatStore.ts,reducer/chatReducer.ts,lib/toolMeta.ts}`
- `app/src/renderer/src/features/chat/components/{DiffTable.tsx,diffSyntaxText.tsx,rightpanel/FileDiffSection.tsx,transcript/tool-bodies/DiffBody.tsx}`
- `docs/handoff/0228-landing-mode-memory-and-edit-diff-rendering/plan.md` · `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md §테스트`
- ABI/네트워크 등 환경 제약: electron 바이너리 다운로드가 막히는 환경이면 DB 로드 스위트 5파일이 red 로 남는다 — 이번 변경과 무관하므로 분리 보고한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`
- 관련 테스트: `./node_modules/.bin/vitest run src/shared/file-edit-tool.test.ts src/main/adapters src/renderer/src/features/chat/components src/renderer/src/features/chat/store src/renderer/src/app/boot`
- 문서 게이트: `cd app && node scripts/check-doc-inventory.mjs --check`
- 사람 실기: 없음.

## READY self-review

- [x] Decision Ledger 의 ACTIVE/SUPERSEDED/OPEN 이 이번 턴의 결정을 보존한다 — 최초 턴이라 SUPERSEDED 0, OPEN 0.
- [x] Part I 만 읽어도 완료 상태가 이해된다.
- [x] 조건절·이유절을 재해석하지 않았다 — "첫 실행는 work로 고정"·"참고하여 구현"을 §2 에 원문으로 인용했다.
- [x] Product/UX 의 각 핵심 동작이 AC 와 Technical Design 에 연결된다.
- [x] AS-IS·TO-BE 가 같은 축(책임/flow/state/error/seam)으로 있다.
- [x] Delta 5행이 모두 §11 파일 또는 AC 로 추적된다.
- [x] AS-IS 에서 사라진 책임 명시: `FileDiffSection` 의 지역 `syntaxText` 는 **이동**(삭제 아님).
- [x] 수치·전칭·외부 규약·앵커·기존 테스트 인용을 §8 에서 실측했다.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 경로를 가진다.
- [x] Baseline V 이고 유효 V = V1 로 재구성 가능하다.
- [x] 모든 NEW node 에 같은 레벨 REQUIRED pair 가 있다(R 4 · SD 2 · AR 3 · MD 2 = pair 11).
- [x] INHERITED/NOT_REQUIRED 행 없음 — Baseline V 라 해당 없음.
- [x] 각 pair 가 경로·§10 전수 분모·직접 oracle 을 갖고, 적대 증거는 VP-04·VP-08 둘만 이유와 함께 선택했다.
- [x] 현재 변경 산출물의 운영 gate 4종을 열거했고 DB ABI 기존 실패를 blocking 으로 삼지 않았다.
- [x] 사람 실기로 미룬 순수 로직이 없다.
- [x] semantic 목표가 structural proxy 만으로 검증되지 않는다 — AC6·AC7 은 화면 문자열을 본다.
- [x] 신규 계약(`file-edit-tool`·`diffSyntaxText`)의 SSOT·강제 지점·테스트 seam 이 있다.
- [x] 부팅/등록 변경의 기존 소비처 5행을 §12 에 전수로 적었다.
- [x] producer/consumer 양쪽 의미를 §12 에서 확인했다.
- [x] 상한·one-way door 를 §14·§17 에서 계산했다.
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침(lint+typecheck 기본, vitest 직접 호출)과 충돌하지 않는다.
- [x] 본문 완성 후 교차검증했고 결과를 §3 갱신 메모에 적었다.
- [x] 산출물 문장 규칙을 지켰다.

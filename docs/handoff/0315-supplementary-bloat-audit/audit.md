# 0315 보완 감사 — 0305가 X8·L6으로 판정하지 않은 6구간

> 기준 커밋 `c1af29f`. 계약 정본은 [plan.md](plan.md)다. 표는 [`data/audit.json`](data/audit.json)을 [`scan/check.mjs`](scan/check.mjs)가 렌더한 생성 블록이고 손으로 고치지 않는다.

## 진행표

| 단계 | 내용 | 상태 |
|---|---|---|
| P1 | 검사기 · UT · 단위 뼈대(136) | 완료 |
| P2 | A1·A2·A3 판정 (renderer) | 완료 |
| P3 | A4·A5·A6 판정 (main) | 완료 |
| P4 | 전제·조건 근거 · 문서 완성 | 완료 |

## 요약

- 6구간 3,135줄을 전부 읽었다. 후보 10건 중 통과 7건이고, 통과 후보의 감량 합은 prod 59줄이다(최대 20줄 — 30줄 이상 없음).
- 통과 7건 중 4건(B-01·B-05·B-06·B-10)이 핫패스의 L6(같은 파일 안 중복)이다. 그래서 중단 규칙 입력값은 **구현 1건 · 넓은 감사 연다**다(§1). 판정은 verify가 통과 후보의 근거를 재현한 뒤 내린다.
- 걸린 3건: B-02는 0309 D-012가 유지하기로 한 방어다(채택 결정). B-03·B-04는 바꿀 분기를 지나는 테스트가 없어 UI 회귀를 판정할 그물이 없다 — 잠금 테스트를 먼저 더하면 통과로 바뀐다.
- A4(`session-context.ts`)와 A5(`auth/store.ts`)는 후보가 0건이다. A5는 0188·0190이 이미 한 벌로 접었고, A4의 반복은 `await` 뒤 재확인이거나 감량이 0~1줄이다.
- `remove` 유형 2건(B-02·B-07)은 승인 목록에 있다. B-07(`taskToolRunIds` — 쓰기만 있고 읽는 곳 0)만 통과다.

## 1. 중단 규칙에 넣을 값

verify가 통과 후보의 근거를 재현한 뒤 이 블록으로 판정한다(plan §10 EP-06 · D-015).

<!-- gen:ruling -->
| 축 | 값 | 근거 |
|---|---|---|
| 구현 건수 | 1건 | 통과 후보 P = B-01(4줄) · B-05(5줄) · B-06(8줄) · B-07(10줄) · B-08(6줄) · B-09(20줄) · B-10(6줄) |
| 넓은 감사 | 연다 | W1 — 핫패스 L6 통과 후보 H = B-01(4줄) · B-05(5줄) · B-06(8줄) · B-10(6줄) |
| 구현 묶음 | 전체: B-01 B-05 B-06 B-07 B-08 B-09 B-10 | 후보 10건 중 통과 7건 |

승인 목록(`remove` 유형 — 사용자 승인 뒤에만 제거한다):

| 후보 | 무엇을 지우는가 | 통과 여부 |
|---|---|---|
| B-02 | renderer 의 session.schedules no-op 두 자리 — main 이 relay 전에 거르므로(turn-coordinator.ts:349) production 에서 닿지 않고, 지워도 reducer 의 switch 밖 `return state`(1327)가 같은 결과를 낸다 | 걸림 |
| B-07 | MapContext.taskToolRunIds 는 쓰기만 있고 읽는 곳이 없다 — tool_result 의 구조화 출력은 이 집합과 무관하게 실린다(688-695) | 통과 |
<!-- /gen:ruling -->

## 2. 구간 판정

<!-- gen:areas -->
| 구간 | 범위 | X1 | X2 | X3 | X4 | X5 | X6 | X7 | X8 | L1 | L5 | L6 | 판정 근거 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `chatReducer.ts` 961-1329 (369줄) | — | — | — | — | — | — | — | — | B-02 | — | B-01 | 961-1329 전부 읽음. X1~X7: 이벤트 필드는 전부 상태·파트에 실린다(읽는 곳 없는 필드 0). X8: 한 case 가 한 이벤트의 상태 반영만 한다 — 369줄은 이벤트 19종의 합. L5: 하네스 분기 없음(이벤트는 정규화 뒤). 파트 조립이 main writer 와 두 벌인 것은 감량 0 이하라 후보가 아니다(관찰 O-1) |
| A2 | `chatReducer.ts` 1454-1596 (143줄) | — | — | — | — | — | — | — | — | — | — | B-03 | 1454-1596 전부 읽음. X3: preserveLocalState 분기와 전체 교체 분기는 남기는 상태가 달라 중복 상태 아님. X8: 캐시 재열기·전체 hydrate 두 일을 한 case 가 하지만 가르면 줄이 늘어난다. L1·L5: 해당 형태 없음. X6: rightPanelPolicy 2회 호출(1519·1522)은 같은 식의 조건·인자라 감량 0 |
| A3 | `chatStore.ts` 349-380 · 470-644 · 698-1010 (520줄) | — | — | — | — | — | — | — | — | — | — | B-04 B-05 B-06 | 349-380 · 470-644 · 698-1010 전부 읽음. X4: store 의 사전 판정(subagent.task 785 · session.schedules 859)은 reducer 와 겹치지만 한 줄 가드다(관찰 O-3 · B-02). X8: receive 한 함수 287줄이 라우팅 키 결정과 이벤트 16종 분배를 함께 한다 — 책임을 가르면 줄이 늘어 후보 아님. X7: rAF 코얼레서 1단 — 중첩 대기 없음. L1: session.schedules no-op 은 B-02(A1 소속)가 함께 가진다. L5: 하네스 분기 없음 |
| A4 | `session-context.ts` 1-567 (567줄) | — | — | — | — | — | — | — | — | — | — | — | 1-567 전부 읽음. 후보 0. X4: abort 재확인 쌍 5회는 await 뒤 재확인이다(중복 가드 아님). X5: OpenCodeClientLease 위임 8줄은 scope·signal 결합이 있어 전달만 하는 층이 아님. X8: ServerContext 가 client·디렉토리 상태·명령 캐시·이벤트 팬아웃·수명주기를 함께 갖지만 controller·instances 를 공유해 가르면 줄이 는다. L6: retire 조립 3벌·wake 비우기 4벌은 감량 0~1줄(관찰 O-5). L5: Claude 쪽 같은 역할은 adapter.ts(구간 밖) — A6(map.ts)과는 역할이 다름. main↔renderer 짝 없음 |
| A5 | `store.ts` 1-517 (517줄) | — | — | — | — | — | — | — | — | — | — | — | 1-517 전부 읽음(주석 포함). 후보 0. 0188·0190 이 네 자료구조를 AuthEntry 하나로, 만료 꼬리를 settleExpired 하나로 이미 접었다. X3: verified·revision·expirySettled 는 서로 파생 불가(주석 104-131). X4: 만료 비교식 5회는 자리마다 정책이 다름. X5: flush 는 호출 2곳인 한 줄 위임. L6 main↔renderer: renderer 의 expiresAt 사용은 표시 3줄(ProviderDetail.tsx:132-135)뿐이고 판정은 없다. L1: createMemoryGrantPersistence 는 소비자가 테스트뿐이라고 주석(58)이 밝힘 — production AuthStore 를 세우는 테스트 seam 이고 테스트는 대상 밖(D-006) |
| A6 | `map.ts` 1-1019 (1019줄) | B-07 | — | B-08 | — | — | — | — | — | — | — | B-09 B-10 | 1-1019 전부 읽음. X2: 한 SDK 메시지 → 이벤트 1회 변환, 재변환 층 없음. X6: `ctx.toolNames?.get` 4회·asStringList 2회는 B-08 과 관찰로 처리. X8: mapClaudeMessage 506줄이 SDK 메시지 5종을 처리 — 종류별 분기는 독립이고 함수로 가르면 줄이 는다(0305 가 같은 이유로 후보를 올리지 않음). L5: opencode/v1/map.ts(277줄, 구간 밖 — 본문 미독)와 헬퍼 이름 공유 0(`git grep -E "assignNums\|usageSnapshot\|num\("` → 0)이라 이름 수준에서는 중복 없음. L1: 모든 단위에 호출부 있음 |
<!-- /gen:areas -->

## 3. 후보

<!-- gen:candidates -->
| 후보 | 구간 | 렌즈 | 유형 | 되풀이되는 것 | 자리 | 보존 동작 | 남기는 구조 | 감량(prod) | 핫패스 | 통과 |
|---|---|---|---|---|---|---|---|---|---|---|
| B-01 | A1 | L6 | merge | tool.call.completed 가 pausedTaskIds·backgroundingTaskIds 에서 id 를 빼는 식(includes ? filter : 원본)을 두 번 풀어 쓴다 — 같은 case 의 1118 과 파일 머리 168 의 withoutId 가 이미 그 판정이다 | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:1121` · `app/src/renderer/src/features/chat/reducer/chatReducer.ts:1124` · `app/src/renderer/src/features/chat/reducer/chatReducer.ts:1118` · `app/src/renderer/src/features/chat/reducer/chatReducer.ts:168` | 정착한 태스크가 일시정지·전환 중 표식에서 빠지고, 없던 id 면 배열 참조가 그대로다(타일 memo 보존) | withoutId 헬퍼와 case 구조 그대로 — 두 식만 헬퍼 호출로 바꾼다 | 4줄 — 1121-1126 여섯 줄 → withoutId 호출 두 줄 | receive | 통과 |
| B-02 | A1 | L1 | remove | renderer 의 session.schedules no-op 두 자리 — main 이 relay 전에 거르므로(turn-coordinator.ts:349) production 에서 닿지 않고, 지워도 reducer 의 switch 밖 `return state`(1327)가 같은 결과를 낸다 | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:964` · `app/src/renderer/src/features/chat/store/chatStore.ts:859` | session.schedules 원시 이벤트가 화면 상태를 바꾸지 않는다(예약 표시는 chat.activity 만 갱신) | receive·RECV_EVENT 의 나머지 case 그대로 | 8줄 — chatReducer.ts 964-967 네 줄 + chatStore.ts 859-862 네 줄 | — | 걸림 |
| B-03 | A2 | L6 | merge | LOAD_SESSION 의 두 반환 분기가 lastTelemetry·lastTelemetryProviderKey 복원 spread 와 sessionCostUsd 시드 spread 를 각각 적는다 | `app/src/renderer/src/features/chat/reducer/chatReducer.ts:1494` · `app/src/renderer/src/features/chat/reducer/chatReducer.ts:1572` · `app/src/renderer/src/features/chat/reducer/chatReducer.ts:1500` · `app/src/renderer/src/features/chat/reducer/chatReducer.ts:1579` | 세션을 열면 컨텍스트 도넛과 세션 비용이 저장값으로 복원된다(캐시 재열기·전체 hydrate 모두) | 두 반환 분기 그대로 — 공통 spread 만 분기 앞 상수로 올린다 | 2줄 — 코드 12줄(1494-1500 · 1572-1577 · 1579) → 상수 7줄 + spread 2줄 + 선언 1줄 | — | 걸림 |
| B-04 | A3 | L6 | merge | message.queued 가 pending 항목(text·createdAt·requirements)을 갱신 분기와 추가 분기에서 따로 조립한다 | `app/src/renderer/src/features/chat/store/chatStore.ts:813` · `app/src/renderer/src/features/chat/store/chatStore.ts:825` | 예약 메시지가 pending 버블로 서고, 같은 id 가 다시 오면 그 버블의 내용만 갱신된다(submitted 표식 유지) | receive 의 case 와 patchPendingSteer 호출 그대로 — 항목을 한 번 만들어 두 분기가 쓴다 | 10줄 — 809-834 26줄 → 항목 조립 8줄 + 분기 3줄 + 감싸는 5줄 | receive | 걸림 |
| B-05 | A3 | L6 | merge | receive 의 turn.aborted 와 error case 본문 세 문장(RECV_EVENT dispatch · resetLive · 새-채팅 게이트 해제)이 같다 | `app/src/renderer/src/features/chat/store/chatStore.ts:945` · `app/src/renderer/src/features/chat/store/chatStore.ts:951` | 중단·오류로 끝난 턴의 라이브 프리뷰가 버려지고 대기 중인 새 채팅 전송이 풀린다 | receive switch 그대로 — 두 case 라벨을 한 본문에 붙인다(reducer 쪽 두 case 는 그대로) | 5줄 — 945-957 13줄 → 라벨 2줄 + 주석 2줄 + 본문 4줄 | receive | 통과 |
| B-06 | A3 | L6 | merge | receive 의 turn.retrying 과 chat.activity case 가 default 와 같은 문장(RECV_EVENT dispatch) 하나만 실행한다 | `app/src/renderer/src/features/chat/store/chatStore.ts:776` · `app/src/renderer/src/features/chat/store/chatStore.ts:855` · `app/src/renderer/src/features/chat/store/chatStore.ts:981` | 재시도 배너와 활동 스냅샷이 reducer 로 전달된다 | receive switch 와 default 그대로 — 전달만 하는 두 case 를 default 에 맡긴다 | 8줄 — 776-779 네 줄 + 855-858 네 줄 | receive | 통과 |
| B-07 | A6 | L4 (X1) | remove | MapContext.taskToolRunIds 는 쓰기만 있고 읽는 곳이 없다 — tool_result 의 구조화 출력은 이 집합과 무관하게 실린다(688-695) | `app/src/main/adapters/claude/map.ts:117` · `app/src/main/adapters/claude/map.ts:613` | TaskXXX 도구 결과에 구조화 출력이 실린다(현재도 이 집합을 보지 않고 실린다) | MapContext 와 assistant 분기 그대로 — 필드 선언과 쓰기 블록만 뺀다 | 10줄 — 선언·주석 114-117 네 줄 + 쓰기 블록 610-615 여섯 줄 | claudeToNormalized | 통과 |
| B-08 | A6 | L4 (X3) | restructure | MapContext.fileEditToolRunIds 는 toolNames(609 에서 모든 tool_use 의 이름을 기억)에서 파생된다 — `has(id)` 는 `carriesFileEditPatch(toolNames.get(id))` 와 같다 | `app/src/main/adapters/claude/map.ts:120` · `app/src/main/adapters/claude/map.ts:618` · `app/src/main/adapters/claude/map.ts:679` · `app/src/main/adapters/claude/map.ts:691` · `app/src/main/adapters/claude/map.ts:609` | Edit 결과에는 structuredPatch 만 실리고 Write·MultiEdit 결과에는 구조화 출력이 실리지 않는다 | MapContext.toolNames 와 user 분기 그대로 — 파생 집합 하나를 없애고 이름 조회를 한 번으로 모은다 | 6줄 — 선언·주석 118-120 세 줄 + 쓰기 블록 616-620 다섯 줄 − 이름 조회 상수 2줄 | claudeToNormalized | 통과 |
| B-09 | A6 | L6 | merge | result 메시지의 wire 타입 리터럴이 호출부 캐스트(779-809)와 normalizeResultTelemetry 인자(913-934)에 두 번 적혀 있다 — usage·modelUsage 구간이 같다 | `app/src/main/adapters/claude/map.ts:779` · `app/src/main/adapters/claude/map.ts:913` | result → telemetry 변환 결과(런타임 코드는 바뀌지 않는다) | mapClaudeMessage 와 normalizeResultTelemetry 두 함수 그대로 — 타입 이름 하나를 둘이 쓴다 | 20줄 — 인자 타입 리터럴 913-934 22줄 → 타입 이름 참조 2줄(캐스트 쪽 31줄은 이름 붙은 선언으로 그대로) | — | 통과 |
| B-10 | A6 | L6 | merge | stream_event 의 text_delta 와 thinking_delta 분기가 이벤트 type 과 읽는 필드만 다른 같은 객체를 따로 조립한다 | `app/src/main/adapters/claude/map.ts:504` · `app/src/main/adapters/claude/map.ts:514` | 텍스트 델타는 message.delta, 사고 델타는 message.reasoning.delta 로 나가고 child 델타는 parentToolRunId 를 싣는다 | stream_event 분기와 message_delta 처리 그대로 — 두 return 을 하나로 접는다 | 6줄 — 504-523 20줄 → 델타 종류 판별 6줄 + 조립 8줄 | claudeToNormalized | 통과 |
<!-- /gen:candidates -->

## 4. 전제 확인 · 조건

<!-- gen:premises -->
| 후보 | 경쟁 가드 | 형태 잠금 | AGENTS 채택 규칙 | UI | 성능 |
|---|---|---|---|---|---|
| B-01 | **clear** — `git show c1af29f:app/src/renderer/src/features/chat/reducer/chatReducer.ts \| awk 'NR>=961&&NR<=1329' \| grep -c await` → 0 — 세 식은 한 case 본문의 연속 동기 문장 | **clear** — `grep -rnE "withoutId" app/src app/scripts app/eslint.config.mjs --include=*.test.ts --include=*.mjs` → 0. 표식 배열을 보는 테스트 3파일은 결과 값·참조만 단언(chatReducer.task.test.ts:341-342) | **clear** — `grep -rnE "withoutId" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 0 | **safe** — withoutId 정의(168-169)가 바꿀 식과 글자 단위로 같은 판정. 회귀 그물: chatReducer.task.test.ts:328-342(정착 시 두 배열이 비워짐) | **equal_or_better** — receive → dispatchTo → chatReducer(tool.call.completed). 바꾼 뒤에도 배열당 includes 1회 + filter 최대 1회로 같다 |
| B-02 | **clear** — `git show c1af29f:app/src/renderer/src/features/chat/reducer/chatReducer.ts \| awk 'NR>=961&&NR<=1329' \| grep -c await` → 0 · `git show c1af29f:app/src/renderer/src/features/chat/store/chatStore.ts \| awk 'NR>=349&&NR<=1010' \| grep -c await` → 0 | **clear** — chatStore.schedules.test.ts:202-216 은 동작(무시됨 · reducer 가 같은 참조 반환)을 단언한다 — case 를 지워도 default 경로로 같은 결과라 형태 잠금은 아님 | **blocks** — `grep -rnE "session\.schedules" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 1(provider-runtime.md:100, main 쪽 전달 서술). 그러나 0309 D-012(ACTIVE)가 이 두 no-op 을 "chatStore.schedules.test.ts:202 가 잠근 방어"로 유지 결정했다 — 바꾸려면 그 결정을 바꿔야 한다 | **safe** — main relay 가 거른다: turn-coordinator.ts:349 `if (ev.type === "session.schedules") continue`. 회귀 그물: chatStore.schedules.test.ts:202-216 | **equal_or_better** — production 에서 실행되지 않는 분기 — 호출 수 변화 0 |
| B-03 | **clear** — reducer 는 동기 순수 함수이고 두 자리는 서로 배타인 반환 분기다(1469 if / 1503) | **clear** — `grep -rln "lastTelemetry" app/src/renderer/src/features/chat --include=*.test.ts` → 4파일, 모두 상태 값 단언(chatReducer.usage.test.ts:39-86) | **clear** — `grep -rnE "LOAD_SESSION\|lastTelemetry" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 6. rendering.md:203 은 도넛이 lastTelemetry 단일 소스라는 동작, state.md:17·37 은 LOAD_SESSION 의 보존 동작 — 코드 형태 규정 아님 | **risk** — 캐시 재열기 분기(preserveLocalState)에서 lastTelemetry 복원을 지나는 테스트를 찾지 못했다: preserveLocalState 를 쓰는 테스트 2파일(chatReducer.listen.test.ts:263 · chatReducer.model.test.ts:143·213)의 `grep -c lastTelemetry` → 0 · 0. 잠금 테스트를 먼저 더하면 safe 다 | **equal_or_better** — 세션 열기 1회당 객체 조립 1회 — 분기 앞으로 올려도 같다 |
| B-04 | **clear** — `git show c1af29f:app/src/renderer/src/features/chat/store/chatStore.ts \| awk 'NR>=349&&NR<=1010' \| grep -c await` → 0 — 두 조립은 한 콜백 안의 삼항 분기 | **clear** — `grep -rln "message.queued" app/src/renderer --include=*.test.ts` → 1(chatStore.test.ts), 케이스 730·918·1133·1238 은 pendingSteer 결과만 단언 | **clear** — `grep -rnE "message\.queued\|pendingSteer" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 3(runtime-ipc.md · state.md:131 — 슬라이스 존재와 큐 모델 서술, 조립 형태 규정 아님) | **risk** — 갱신 분기(같은 id 가 pending 에 이미 있음)를 지나는 테스트를 찾지 못했다: chatStore.test.ts 의 message.queued 케이스 4건(730·918·1133·1238)은 새 항목 추가 또는 낙관 커밋 skip 분기다. 구성상 동치(`{...item, ...새 항목}`)이나 회귀 그물이 없다 — 잠금 테스트를 먼저 더하면 safe 다 | **equal_or_better** — receive → case message.queued. 객체 조립 1회 + some/map 은 그대로 |
| B-05 | **clear** — `git show c1af29f:app/src/renderer/src/features/chat/store/chatStore.ts \| awk 'NR>=349&&NR<=1010' \| grep -c await` → 0 | **clear** — `grep -rln "turn.aborted" app/src/renderer/src/features/chat/store --include=*.test.ts` → 5파일, ingestChatEvent 뒤 상태만 단언(chatStore.errors.test.ts:62). `grep -n "no-fallthrough\|default-case\|switch-exhaustiveness" app/eslint.config.mjs` → 0 | **clear** — `grep -rnE "turn\.aborted" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 0 | **safe** — 두 본문이 문장 단위로 같다(946-948 ↔ 954-956). 회귀 그물: chatStore.errors.test.ts · chatStore.test.ts 의 turn.aborted·error 케이스 | **equal_or_better** — receive → 같은 세 문장 실행. 호출 수 같음 |
| B-06 | **clear** — `git show c1af29f:app/src/renderer/src/features/chat/store/chatStore.ts \| awk 'NR>=349&&NR<=1010' \| grep -c await` → 0 | **clear** — `grep -rlE "turn.retrying\|chat.activity" app/src/renderer/src/features/chat/store --include=*.test.ts` → 3파일, ingestChatEvent 뒤 상태만 단언. eslint 에 switch 관련 규칙 0(B-05 와 같은 명령) | **clear** — `grep -rnE "chat\.activity" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 2(rendering.md:37 · provider-runtime.md:93 — 스냅샷의 의미 서술, store 분기 형태 규정 아님) | **safe** — default(981-982)가 같은 문장을 실행한다. 회귀 그물: chatStore.listen.test.ts(chat.activity) · chatStore.planOwner.test.ts(turn.retrying) | **equal_or_better** — receive → dispatchTo 1회로 같다 |
| B-07 | **clear** — `git show c1af29f:app/src/main/adapters/claude/map.ts \| grep -c await` → 0 | **clear** — `grep -rnE "taskToolRunIds\|fileEditToolRunIds" app/src app/scripts --include=*.test.ts --include=*.mjs` → 0 | **clear** — `grep -rnE "taskToolRunIds" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 0 | **safe** — `git grep -n taskToolRunIds c1af29f -- app/src` → map.ts 3줄(117·613·614)뿐 — 읽는 곳 0 | **equal_or_better** — claudeToNormalized → assistant 분기. Task 도구 tool_use 마다 Set.add 1회가 사라진다 |
| B-08 | **clear** — `git show c1af29f:app/src/main/adapters/claude/map.ts \| grep -c await` → 0 | **clear** — `grep -rnE "taskToolRunIds\|fileEditToolRunIds" app/src app/scripts --include=*.test.ts --include=*.mjs` → 0 — 테스트는 집합을 직접 보지 않는다 | **clear** — `grep -rnE "fileEditToolRunIds\|MapContext" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 2(provider-runtime.md:359·361 — lastAssistantUsage·handoffArrival 서술) | **safe** — 두 기록은 같은 블록(607-620)에서 같은 조건으로 쓰이고 toolNames 를 지우는 곳이 없다(`grep -rn toolNames app/src/main/adapters/claude/*.ts` → map.ts 5줄). 회귀 그물: map.fileEdit.test.ts:62·70·75·85 | **equal_or_better** — claudeToNormalized → user 분기. tool_result 마다 Set.has 2회 + Map.get 4회 → Map.get 1회 + 문자열 비교 |
| B-09 | **clear** — `git show c1af29f:app/src/main/adapters/claude/map.ts \| grep -c await` → 0 — 타입 선언이라 실행 순서가 없다 | **clear** — `grep -rn "normalizeResultTelemetry" app/src --include=*.test.ts` → 0(비공개 함수) | **clear** — `grep -rnE "normalizeResultTelemetry" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 0 | **safe** — 타입 선언만 바뀐다 — 런타임 코드 0줄. 판정은 typecheck 와 map.test.ts 의 result 케이스 | **equal_or_better** — 런타임 코드 변화 0 |
| B-10 | **clear** — `git show c1af29f:app/src/main/adapters/claude/map.ts \| grep -c await` → 0 | **clear** — `grep -n "text_delta\|thinking_delta" app/src/main/adapters/claude/map.test.ts` → 케이스 287·295, 반환 이벤트만 단언 | **clear** — `grep -rnE "message\.reasoning\.delta" AGENTS.md app/AGENTS.md app/src/main/AGENTS.md app/src/renderer/AGENTS.md docs/arch docs/decisions` → 5(provider-runtime.md:52·71 · rendering.md:80·163 · observability.md:60 — wire→이벤트 대응과 델타 경로 서술, 매퍼 코드 형태 규정 아님) | **safe** — 나가는 이벤트의 필드가 같다. 회귀 그물: map.test.ts:287(text_delta) · 295(thinking_delta) | **equal_or_better** — claudeToNormalized → stream_event. 델타마다 비교 2회 + 객체 1개로 같다 |
<!-- /gen:premises -->

## 5. 관찰 — 중복이지만 후보가 아닌 것

같은 판정·조립이 두 번 이상 있지만 합쳐도 줄이 줄지 않아(plan K8: 감량 1줄 이상) 후보로 올리지 않았다. 감량이 아니라 **두 벌이 갈라질 위험**으로 읽어야 하는 항목이다.

| # | 무엇이 두 벌인가 | 자리 | 후보가 아닌 이유 |
|---|---|---|---|
| O-1 | 이벤트 → 메시지 파트 조립(reasoning · text · tool_call · tool_result · compact_boundary) | renderer `chatReducer.ts:1018-1159` ↔ main `features/history/writer.ts:373-547` · `tool-call-payload.ts:10-20` | 공용 빌더로 옮기면 빌더 선언만큼 줄이 는다(필드 약 34줄 ↔ 빌더+호출 약 35줄). 이미 갈라진 곳: `result`(`?? null`은 main만) · `subagentMeta`(main만) · `nonExecution` 판정식(`!== undefined` ↔ truthy) |
| O-2 | `tool_call` 소유 메시지 탐색 | `chatReducer.ts:1040-1050` · `1104-1110` (+ 역방향 `findToolCallPart` 2160) | `responseId` 분기가 한쪽에만 있어 헬퍼화 감량 0~1줄 |
| O-3 | 백그라운드 완료 통지 판정(`phase === 'settled' && background === true`) | `chatStore.ts:785` · `chatReducer.ts:1292` · `writer.ts:554` | 한 줄 가드 3회 — 감량 0 |
| O-4 | 새 채팅 대기열 전진(다음 payload 꺼내기 + 키·큐 갱신 + 전송) | `chatStore.ts:586-593` · `621-640` | 헬퍼가 patch와 payload를 함께 돌려줘야 해 감량 0 |
| O-5 | OpenCode 서버 retire 조립 · `entries` 소유 판정 | `session-context.ts:117-121` · `405-406` · `516-518` · `479·517·553` | 메서드화 순감량 1줄이고 자리마다 수명주기 순서가 다르다 |

## 6. 판정 단위별 L6

<!-- gen:units -->
| 구간 | 단위 | L6 | 근거 |
|---|---|---|---|
| A1 | `RECV_EVENT` | — | 분기 머리(ev.type switch) — 판정·조립은 아래 case 단위가 가짐 · `git grep -F 'RECV_EVENT'`: 같은 파일 3줄 · main+shared 0파일(test 제외) |
| A1 | `session.schedules` | — | L6 아님 — 미도달 no-op(B-02, L1). main 이 relay 전에 거른다(turn-coordinator.ts:349) · `git grep -F 'session.schedules'`: 같은 파일 1줄 · main+shared 5파일(test 제외) |
| A1 | `session.updated` | — | 짝 없음 — 이 이벤트의 상태 반영은 이 case 한 곳 · `git grep -F 'session.updated'`: 같은 파일 3줄 · main+shared 16파일(test 제외) |
| A1 | `worktree.preparing` | — | 짝 없음 — 이 이벤트의 상태 반영은 이 case 한 곳 · `git grep -F 'worktree.preparing'`: 같은 파일 1줄 · main+shared 2파일(test 제외) |
| A1 | `message.reasoning` | — | 파트 조립(text·parentToolRunId·signature)이 main app/src/main/features/history/writer.ts:376-385 와 두 벌 — 공용 빌더로 옮기면 줄이 늘어 후보 아님(관찰 O-1) · `git grep -F 'message.reasoning'`: 같은 파일 2줄 · main+shared 10파일(test 제외) |
| A1 | `response.boundary` | — | 짝 없음 — 이 이벤트의 상태 반영은 이 case 한 곳 · `git grep -F 'response.boundary'`: 같은 파일 1줄 · main+shared 3파일(test 제외) |
| A1 | `output.captured` | — | tool_call 소유 메시지 탐색(1040-1050)이 1104-1110 과 닮음 — responseId 분기가 달라 헬퍼화 감량 0~1줄, 후보 아님(관찰 O-2) · `git grep -F 'output.captured'`: 같은 파일 1줄 · main+shared 3파일(test 제외) |
| A1 | `message.completed` | — | 파트 조립이 main app/src/main/features/history/writer.ts:436-444 와 두 벌 — 관찰 O-1(감량 0 이하) · `git grep -F 'message.completed'`: 같은 파일 3줄 · main+shared 10파일(test 제외) |
| A1 | `tool.call.started` | — | 파트 조립이 main tool-call-payload.ts:10-20 과 두 벌(라이브만 editPreview 추가) — 관찰 O-1 · `git grep -F 'tool.call.started'`: 같은 파일 1줄 · main+shared 13파일(test 제외) |
| A1 | `tool.call.completed` | B-01 | B-01: 1121-1126 이 withoutId(168-169)와 같은 판정. 파트 조립은 main app/src/main/features/history/writer.ts:489-506 과 두 벌(main 만 subagentMeta·result ?? null) — 관찰 O-1 · `git grep -F 'tool.call.completed'`: 같은 파일 2줄 · main+shared 11파일(test 제외) |
| A1 | `turn.retrying` | — | 짝 없음 — 이 이벤트의 상태 반영은 이 case 한 곳 · `git grep -F 'turn.retrying'`: 같은 파일 1줄 · main+shared 4파일(test 제외) |
| A1 | `session.compacted` | — | 파트 조립(trigger·preTokens·postTokens)이 main app/src/main/features/history/writer.ts:536-545 와 두 벌 — 관찰 O-1 · `git grep -F 'session.compacted'`: 같은 파일 2줄 · main+shared 6파일(test 제외) |
| A1 | `telemetry` | — | TURN_END_RESET 은 헬퍼 상수로 단일. lastTelemetry 대입 조건은 이 자리 한 곳(LOAD_SESSION 은 조건 없는 복원) · `git grep -F 'telemetry'`: 같은 파일 19줄 · main+shared 18파일(test 제외) |
| A1 | `permission.requested` | — | planReviewToolInput 교정이 main app/src/main/features/history/writer.ts:413-431 에도 있음 — 판정 함수는 shared 단일이고 저장소가 달라(메모리 ↔ DB) 합칠 자리 없음. providerRequest 조건부 spread 3회(1201·1220·1241)는 한 줄씩이라 감량 0 · `git grep -F 'permission.requested'`: 같은 파일 2줄 · main+shared 4파일(test 제외) |
| A1 | `permission.resolved` | — | 짝 없음 — 이 이벤트의 상태 반영은 이 case 한 곳 · `git grep -F 'permission.resolved'`: 같은 파일 1줄 · main+shared 2파일(test 제외) |
| A1 | `chat.activity` | — | 짝 없음 — 이 이벤트의 상태 반영은 이 case 한 곳 · `git grep -F 'chat.activity'`: 같은 파일 1줄 · main+shared 3파일(test 제외) |
| A1 | `subagent.task` | — | settled+background 판정(1292)이 app/src/renderer/src/features/chat/store/chatStore.ts:785 · main app/src/main/features/history/writer.ts:554 와 세 벌 — 한 줄 가드, 감량 0(관찰 O-3). 파트 빌더는 shared subagentNoticePart 단일 · `git grep -F 'subagent.task'`: 같은 파일 1줄 · main+shared 10파일(test 제외) |
| A1 | `turn.ended` | — | 짝 없음 — 이 이벤트의 상태 반영은 이 case 한 곳 · `git grep -F 'turn.ended'`: 같은 파일 3줄 · main+shared 3파일(test 제외) |
| A1 | `turn.aborted` | — | 본문이 error 와 닮았으나 TURN_END_RESET·childApprovalState 두 헬퍼로 이미 단일화 — 남은 차이는 error 필드 1줄 · `git grep -F 'turn.aborted'`: 같은 파일 3줄 · main+shared 7파일(test 제외) |
| A1 | `error` | — | turn.aborted 와 같은 두 헬퍼를 씀 — 이미 단일화 · `git grep -F 'error'`: 같은 파일 18줄 · main+shared 168파일(test 제외) |
| A2 | `LOAD_SESSION` | B-03 | B-03: lastTelemetry·sessionCostUsd 복원 spread 가 1494-1500 과 1572-1579 에 두 벌. `state.sessionId === action.session.id` 는 7회(1468·1469·1506·1517·1528·1544·1549) — 한 줄 식이라 감량 0 · `git grep -F 'LOAD_SESSION'`: 같은 파일 7줄 · main+shared 0파일(test 제외) |
| A3 | `dispatchTo` | — | permissionUpdates 갱신 두 블록은 request/settlement 로 방향이 달라 중복 아님 · `git grep -F 'dispatchTo'`: 같은 파일 37줄 · main+shared 0파일(test 제외) |
| A3 | `patchEntry` | — | 추출 규칙 P2 가 잡은 호출식(정의는 구간 밖 336줄) — 판정·조립 없음 · `git grep -F 'patchEntry'`: 같은 파일 15줄 · main+shared 0파일(test 제외) |
| A3 | `userBubbleText` | — | 짝 없음 · `git grep -F 'userBubbleText'`: 같은 파일 2줄 · main+shared 0파일(test 제외) |
| A3 | `hasCommittedClientId` | — | 짝 없음 · `git grep -F 'hasCommittedClientId'`: 같은 파일 3줄 · main+shared 0파일(test 제외) |
| A3 | `isTerminalWithoutSession` | — | 터미널 집합(error·turn.aborted·telemetry)이 receive 의 세 case 와 같은 집합 — 여기는 라우팅 키, 저기는 게이트 해제라 일이 다름. 감량 0 · `git grep -F 'isTerminalWithoutSession'`: 같은 파일 2줄 · main+shared 0파일(test 제외) |
| A3 | `TURN_ACTIVITY_EVENTS` | — | shouldBeginTurn 전용 집합 — 단일 · `git grep -F 'TURN_ACTIVITY_EVENTS'`: 같은 파일 2줄 · main+shared 0파일(test 제외) |
| A3 | `shouldBeginTurn` | — | 0149 에서 receive·receiveDeltaBatch 공용 술어로 이미 단일화 · `git grep -F 'shouldBeginTurn'`: 같은 파일 3줄 · main+shared 0파일(test 제외) |
| A3 | `resolveSessionKey` | — | receive·receiveDeltaBatch 가 같은 함수를 씀 — 단일 · `git grep -F 'resolveSessionKey'`: 같은 파일 3줄 · main+shared 0파일(test 제외) |
| A3 | `resolveApprovalOwner` | — | 짝 없음 · `git grep -F 'resolveApprovalOwner'`: 같은 파일 2줄 · main+shared 0파일(test 제외) |
| A3 | `receiveDeltaBatch` | — | 짝 없음 · `git grep -F 'receiveDeltaBatch'`: 같은 파일 4줄 · main+shared 0파일(test 제외) |
| A3 | `setState` | — | 추출 규칙 P2 가 잡은 zustand 호출식 — 판정·조립 없음 · `git grep -F 'setState'`: 같은 파일 25줄 · main+shared 0파일(test 제외) |
| A3 | `sendNewChatPayload` | — | 짝 없음 · `git grep -F 'sendNewChatPayload'`: 같은 파일 5줄 · main+shared 0파일(test 제외) |
| A3 | `releaseNewChatGate` | — | 큐 전진 조립(586-590)이 promotePendingNewChat 621-633 과 두 벌 — 헬퍼화하면 반환 객체가 필요해 감량 0, 후보 아님(관찰 O-4) · `git grep -F 'releaseNewChatGate'`: 같은 파일 4줄 · main+shared 0파일(test 제외) |
| A3 | `promotePendingNewChat` | — | 큐 전진 조립이 releaseNewChatGate 와 두 벌 — 관찰 O-4. main 의 promote 신원 가드와는 방어 대상이 다름(주석 597-599) · `git grep -F 'promotePendingNewChat'`: 같은 파일 2줄 · main+shared 0파일(test 제외) |
| A3 | `receive` | — | 분기 머리 — 판정·조립은 아래 case 단위가 가짐. 터미널 게이트 해제 식(924·948·956)은 한 줄 3회 · `git grep -F 'receive'`: 같은 파일 9줄 · main+shared 20파일(test 제외) |
| A3 | `message.completed` | — | patchEntry 안 session/live 동일성 비교 꼴이 telemetry(913-923)와 닮음 — live 처리 내용이 달라 감량 0 · `git grep -F 'message.completed'`: 같은 파일 3줄 · main+shared 10파일(test 제외) |
| A3 | `message.reasoning` | — | 짝 없음 · `git grep -F 'message.reasoning'`: 같은 파일 5줄 · main+shared 10파일(test 제외) |
| A3 | `turn.retrying` | B-06 | B-06: default(981-982)와 같은 dispatch 한 문장 · `git grep -F 'turn.retrying'`: 같은 파일 1줄 · main+shared 4파일(test 제외) |
| A3 | `subagent.task` | — | settled+background 판정(785)이 reducer 1292 와 겹침 — 관찰 O-3 · `git grep -F 'subagent.task'`: 같은 파일 4줄 · main+shared 10파일(test 제외) |
| A3 | `message.queued` | B-04 | B-04: pending 항목 조립이 갱신 분기(813-820)와 추가 분기(825-832)에 두 벌 · `git grep -F 'message.queued'`: 같은 파일 5줄 · main+shared 3파일(test 제외) |
| A3 | `message.committed` | — | 짝 없음 · `git grep -F 'message.committed'`: 같은 파일 5줄 · main+shared 3파일(test 제외) |
| A3 | `chat.activity` | B-06 | B-06: default(981-982)와 같은 dispatch 한 문장 · `git grep -F 'chat.activity'`: 같은 파일 2줄 · main+shared 3파일(test 제외) |
| A3 | `session.schedules` | — | L6 아님 — 미도달 no-op(B-02, 소속 구간 A1) · `git grep -F 'session.schedules'`: 같은 파일 1줄 · main+shared 5파일(test 제외) |
| A3 | `message.submitted` | — | 짝 없음 · `git grep -F 'message.submitted'`: 같은 파일 1줄 · main+shared 3파일(test 제외) |
| A3 | `message.cancelled` | — | 짝 없음 · `git grep -F 'message.cancelled'`: 같은 파일 3줄 · main+shared 4파일(test 제외) |
| A3 | `telemetry` | — | 잔여 라이브 커밋 뒤 RECV_EVENT — 이 자리 한 곳 · `git grep -F 'telemetry'`: 같은 파일 3줄 · main+shared 18파일(test 제외) |
| A3 | `turn.ended` | — | 세션 일치 가드(933)가 permission.requested(940)와 같은 식 — 한 줄, 감량 0 · `git grep -F 'turn.ended'`: 같은 파일 2줄 · main+shared 3파일(test 제외) |
| A3 | `permission.requested` | — | 세션 일치 가드(940)가 turn.ended(933)와 같은 식 — 감량 0 · `git grep -F 'permission.requested'`: 같은 파일 2줄 · main+shared 4파일(test 제외) |
| A3 | `turn.aborted` | B-05 | B-05: error case 와 본문 3문장이 같다 · `git grep -F 'turn.aborted'`: 같은 파일 2줄 · main+shared 7파일(test 제외) |
| A3 | `error` | B-05 | B-05: turn.aborted case 와 본문 3문장이 같다 · `git grep -F 'error'`: 같은 파일 19줄 · main+shared 168파일(test 제외) |
| A3 | `session.updated` | — | 짝 없음 · `git grep -F 'session.updated'`: 같은 파일 8줄 · main+shared 16파일(test 제외) |
| A3 | `coalescer` | — | 짝 없음 · `git grep -F 'coalescer'`: 같은 파일 4줄 · main+shared 0파일(test 제외) |
| A3 | `ingestChatEvent` | — | 이벤트 sessionId 유무 판정(1000)이 receive 710 · isTerminalWithoutSession 481 과 닮음 — 폴백 대상이 달라(activeKey ↔ pendingNewChatKey) 합칠 수 없음 · `git grep -F 'ingestChatEvent'`: 같은 파일 2줄 · main+shared 0파일(test 제외) |
| A4 | `choices` | — | 인터페이스 멤버 선언(ManagedConnectionChoices) — 구현은 구간 밖 · `git grep -F 'choices'`: 같은 파일 1줄 · renderer+shared 5파일(test 제외) |
| A4 | `callerClient` | — | createOpencodeClient 옵션(baseUrl·headers·throwOnError)이 106-111·155-161·171-181 세 번 — 공용 상수화 감량 1줄, 후보 아님 · `git grep -F 'callerClient'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A4 | `release` | — | 인터페이스 멤버 — 구현은 acquire 543-547 · `git grep -F 'release'`: 같은 파일 11줄 · renderer+shared 15파일(test 제외) |
| A4 | `events` | — | 인터페이스 멤버 + ServerContext.events(302-329). wake 비우기 2문장이 298-299·308-309·388-389·432-433 네 번 — 헬퍼화 감량 0 · `git grep -F 'events'`: 같은 파일 7줄 · renderer+shared 16파일(test 제외) |
| A4 | `prepare` | — | ready 뒤 activate — 단일 · `git grep -F 'prepare'`: 같은 파일 3줄 · renderer+shared 4파일(test 제외) |
| A4 | `commands` | — | abort 재확인 쌍(249-250·262-263)은 await 뒤 재확인이라 중복이 아님 · `git grep -F 'commands'`: 같은 파일 12줄 · renderer+shared 5파일(test 제외) |
| A4 | `agents` | — | 인터페이스 멤버 — acquire 533 의 위임 한 줄 · `git grep -F 'agents'`: 같은 파일 2줄 · renderer+shared 25파일(test 제외) |
| A4 | `models` | — | 인터페이스 멤버 — acquire 534 의 위임 한 줄 · `git grep -F 'models'`: 같은 파일 2줄 · renderer+shared 20파일(test 제외) |
| A4 | `mcp` | — | 인터페이스 멤버 — acquire 535-538 · `git grep -F 'mcp'`: 같은 파일 14줄 · renderer+shared 24파일(test 제외) |
| A4 | `plugins` | — | 인터페이스 멤버 — acquire 539 · `git grep -F 'plugins'`: 같은 파일 2줄 · renderer+shared 24파일(test 제외) |
| A4 | `rememberCommands` | — | abort·active 판정 1회 — 단일 · `git grep -F 'rememberCommands'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A4 | `directory` | — | 요청 경로 검증·client 조립 — createOpencodeClient 옵션 반복은 callerClient 행 참조 · `git grep -F 'directory'`: 같은 파일 33줄 · renderer+shared 23파일(test 제외) |
| A4 | `signal` | — | AbortSignal.any 조합 헬퍼 — 165·257 은 timeout 없는 2항 조합이라 이 헬퍼를 못 씀 · `git grep -F 'signal'`: 같은 파일 79줄 · renderer+shared 3파일(test 제외) |
| A4 | `ready` | — | abort 재확인 쌍이 217-218·222-223·227-228 — then/catch 안은 await 뒤 재확인(경쟁 가드)이라 중복이 아님. 헬퍼화 감량 1줄 · `git grep -F 'ready'`: 같은 파일 9줄 · renderer+shared 27파일(test 제외) |
| A4 | `offer` | — | 큐 한도 판정 — 단일(핫패스) · `git grep -F 'offer'`: 같은 파일 3줄 · renderer+shared 1파일(test 제외) |
| A4 | `connectEvents` | — | startEvents 기동 판정(339)이 events 313 과 같은 식 — 한 줄, 감량 0 · `git grep -F 'connectEvents'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A4 | `startEvents` | — | epoch·abort 판정(365·393·396) — await 뒤 재확인. 구독자 종료 표식은 close 430-434 와 닮았으나 오류 문구가 다름 · `git grep -F 'startEvents'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A4 | `fail` | — | retire 조립(server.retire → options.retire)이 117-121·516-518 과 세 벌 — 메서드화 순감량 1줄이고 수명주기 순서가 자리마다 달라 후보 아님(관찰 O-5) · `git grep -F 'fail'`: 같은 파일 6줄 · renderer+shared 95파일(test 제외) |
| A4 | `resourceActivityChanged` | — | 바깥(449)·안(410) 두 층 — 위임 한 줄 · `git grep -F 'resourceActivityChanged'`: 같은 파일 4줄 · renderer+shared 0파일(test 제외) |
| A4 | `reconcileConnections` | — | 바깥(452)·안(414) 두 층 — 위임 · `git grep -F 'reconcileConnections'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A4 | `close` | — | 구독자 종료 표식 — startEvents 384-389 와 닮음(문구 다름) · `git grep -F 'close'`: 같은 파일 9줄 · renderer+shared 69파일(test 제외) |
| A4 | `configureResourceActivity` | — | 대입 한 줄 · `git grep -F 'configureResourceActivity'`: 같은 파일 1줄 · renderer+shared 0파일(test 제외) |
| A4 | `acquire` | — | entries 소유 판정(`entries.get(key) === x`)이 479·517·553 세 번 — 관찰 O-5 · `git grep -F 'acquire'`: 같은 파일 2줄 · renderer+shared 5파일(test 제외) |
| A4 | `finish` | — | entries 소유 판정 — 관찰 O-5 · `git grep -F 'finish'`: 같은 파일 6줄 · renderer+shared 8파일(test 제외) |
| A4 | `retireAll` | — | 단일 · `git grep -F 'retireAll'`: 같은 파일 1줄 · renderer+shared 0파일(test 제외) |
| A5 | `vaultKeysOf` | — | 0190 에서 네 곳을 한 함수로 접은 자리 — 단일 · `git grep -F 'vaultKeysOf'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A5 | `load` | — | 인터페이스 멤버(GrantPersistencePort) · `git grep -F 'load'`: 같은 파일 5줄 · renderer+shared 102파일(test 제외) |
| A5 | `save` | — | 인터페이스 멤버 — 구현 정규화는 persist(510) 한 곳 · `git grep -F 'save'`: 같은 파일 4줄 · renderer+shared 27파일(test 제외) |
| A5 | `createMemoryGrantPersistence` | — | 짝 없음 · `git grep -F 'createMemoryGrantPersistence'`: 같은 파일 1줄 · renderer+shared 0파일(test 제외) |
| A5 | `restore` | — | 짝 없음 · `git grep -F 'restore'`: 같은 파일 1줄 · renderer+shared 11파일(test 제외) |
| A5 | `entry` | — | 짝 없음 · `git grep -F 'entry'`: 같은 파일 38줄 · renderer+shared 31파일(test 제외) |
| A5 | `records` | — | 짝 없음 · `git grep -F 'records'`: 같은 파일 16줄 · renderer+shared 2파일(test 제외) |
| A5 | `credentialRevision` | — | 짝 없음 · `git grep -F 'credentialRevision'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A5 | `isVerified` | — | 짝 없음 · `git grep -F 'isVerified'`: 같은 파일 1줄 · renderer+shared 0파일(test 제외) |
| A5 | `markVerified` | — | 짝 없음 · `git grep -F 'markVerified'`: 같은 파일 1줄 · renderer+shared 0파일(test 제외) |
| A5 | `get` | — | 짝 없음 · `git grep -F 'get'`: 같은 파일 18줄 · renderer+shared 178파일(test 제외) |
| A5 | `put` | — | 필드 4개 갱신 — revoke 303-306 과 값이 반대 방향 · `git grep -F 'put'`: 같은 파일 6줄 · renderer+shared 123파일(test 제외) |
| A5 | `revoke` | — | 짝 없음 · `git grep -F 'revoke'`: 같은 파일 7줄 · renderer+shared 8파일(test 제외) |
| A5 | `deleteVaultKeys` | — | 짝 없음 · `git grep -F 'deleteVaultKeys'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A5 | `status` | — | 만료 비교식(`expiresAt <= clock()`)이 327·381·433·470·498 다섯 번 — 한 줄 식이고 자리마다 뜻이 달라(주석 369-373·458-466) 감량 0 · `git grep -F 'status'`: 같은 파일 7줄 · renderer+shared 101파일(test 제외) |
| A5 | `markExpired` | — | entry·grant 부재 조기 반환이 284-286·359-361·430-432 세 번 — 반환값이 달라 감량 0. 만료 꼬리는 settleExpired 로 단일 · `git grep -F 'markExpired'`: 같은 파일 6줄 · renderer+shared 0파일(test 제외) |
| A5 | `settleExpired` | — | markExpired·settleExpiry 의 공통 꼬리 — 단일 · `git grep -F 'settleExpired'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A5 | `settleExpiry` | — | 만료 꼬리는 settleExpired 공용 — 0190 에서 단일화 · `git grep -F 'settleExpiry'`: 같은 파일 5줄 · renderer+shared 0파일(test 제외) |
| A5 | `authKind` | — | 짝 없음 · `git grep -F 'authKind'`: 같은 파일 2줄 · renderer+shared 10파일(test 제외) |
| A5 | `isCurrentGrant` | — | 짝 없음 · `git grep -F 'isCurrentGrant'`: 같은 파일 1줄 · renderer+shared 0파일(test 제외) |
| A5 | `isCurrentUnexpiredGrant` | — | 만료 비교식 — status 행 참조 · `git grep -F 'isCurrentUnexpiredGrant'`: 같은 파일 1줄 · renderer+shared 0파일(test 제외) |
| A5 | `refreshTokenSecret` | — | 만료 기준이 secret 과 달라(refreshExpiresAt) 합치지 않음(주석 477) · `git grep -F 'refreshTokenSecret'`: 같은 파일 1줄 · renderer+shared 0파일(test 제외) |
| A5 | `secret` | — | status 와 vault 읽기를 일부러 한 번으로 묶음(주석 492-494) — 중복 아님 · `git grep -F 'secret'`: 같은 파일 13줄 · renderer+shared 3파일(test 제외) |
| A5 | `flush` | — | persist(records()) 위임 — 호출 2곳(375·397) · `git grep -F 'flush'`: 같은 파일 4줄 · renderer+shared 12파일(test 제외) |
| A5 | `persist` | — | 짝 없음 · `git grep -F 'persist'`: 같은 파일 15줄 · renderer+shared 10파일(test 제외) |
| A6 | `receivedOrigin` | — | 짝 없음 · `git grep -F 'receivedOrigin'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `RETRACTION_MEMORY_LIMIT` | — | 같은 상한 2048 이 750 에 리터럴로 한 번 더 — 상수 참조로 바꿔도 감량 0 · `git grep -F 'RETRACTION_MEMORY_LIMIT'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `retractedToolRuns` | — | 짝 없음 · `git grep -F 'retractedToolRuns'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A6 | `rememberToolRuns` | — | uuid 기억+상한 꼴이 746-750(receivedInputUuids)과 닮음 — 자료구조가 달라(Map ↔ Set) 감량 0 · `git grep -F 'rememberToolRuns'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `accrueSubagentMeta` | — | 짝 없음 · `git grep -F 'accrueSubagentMeta'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A6 | `mapTaskSystem` | — | subagent.task 조립 — mapTaskUpdated 와 필드 집합이 달라 중복 아님 · `git grep -F 'mapTaskSystem'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `num` | — | 숫자 가드 — 문자열 가드(`typeof x === "string" ? x : undefined`)는 헬퍼 없이 10여 회(176~409). 한 줄 식이라 감량 0 · `git grep -F 'num'`: 같은 파일 48줄 · renderer+shared 181파일(test 제외) |
| A6 | `assignNums` | — | usage 대입 패턴을 이미 한 곳으로 모은 헬퍼 · `git grep -F 'assignNums'`: 같은 파일 4줄 · renderer+shared 0파일(test 제외) |
| A6 | `usageSnapshot` | — | message_delta·assistant 두 경로 공용 — 단일 · `git grep -F 'usageSnapshot'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A6 | `readParentToolRunId` | — | 짝 없음 · `git grep -F 'readParentToolRunId'`: 같은 파일 4줄 · renderer+shared 0파일(test 제외) |
| A6 | `hasSingleToolResult` | — | 영수증·구조화 출력 공용 전제 — 단일 · `git grep -F 'hasSingleToolResult'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A6 | `applyPendingScheduleReceipt` | — | 짝 없음 · `git grep -F 'applyPendingScheduleReceipt'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `asyncLaunchReceipt` | — | 짝 없음 · `git grep -F 'asyncLaunchReceipt'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `asStringList` | — | 858-859 에서 같은 인자로 2회 호출 — hoist 해도 감량 0 · `git grep -F 'asStringList'`: 같은 파일 5줄 · renderer+shared 0파일(test 제외) |
| A6 | `mapTaskUpdated` | — | subagent.task 조립 — phase 별 필드가 다름 · `git grep -F 'mapTaskUpdated'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `claudeToNormalized` | — | uuid 읽기(375)가 mapClaudeMessage 642·738·767 에도 있음 — 인자로 넘겨도 감량 0 · `git grep -F 'claudeToNormalized'`: 같은 파일 1줄 · renderer+shared 1파일(test 제외) |
| A6 | `input.echo` | — | nativeMessageId 부여 case 라벨 — 조립은 752-756 한 곳 · `git grep -F 'input.echo'`: 같은 파일 4줄 · renderer+shared 1파일(test 제외) |
| A6 | `input.received` | — | nativeMessageId 부여 case 라벨 — 조립은 752-756 한 곳 · `git grep -F 'input.received'`: 같은 파일 3줄 · renderer+shared 1파일(test 제외) |
| A6 | `message.completed` | — | case 라벨 — 조립은 585-590 한 곳. renderer·writer 의 파트 조립과는 계층이 다름(SDK → 이벤트) · `git grep -F 'message.completed'`: 같은 파일 4줄 · renderer+shared 7파일(test 제외) |
| A6 | `message.reasoning` | — | case 라벨 — 조립은 596-602 한 곳 · `git grep -F 'message.reasoning'`: 같은 파일 6줄 · renderer+shared 5파일(test 제외) |
| A6 | `tool.call.started` | — | case 라벨 — 조립은 630-637 한 곳 · `git grep -F 'tool.call.started'`: 같은 파일 3줄 · renderer+shared 4파일(test 제외) |
| A6 | `tool.call.completed` | — | case 라벨 — 조립은 696-709 한 곳 · `git grep -F 'tool.call.completed'`: 같은 파일 5줄 · renderer+shared 4파일(test 제외) |
| A6 | `session.compacted` | — | case 라벨 — 조립은 471-479 한 곳 · `git grep -F 'session.compacted'`: 같은 파일 3줄 · renderer+shared 4파일(test 제외) |
| A6 | `mapClaudeMessage` | — | 분기 머리 — 판정·조립은 아래 msg.type 단위가 가짐 · `git grep -F 'mapClaudeMessage'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `system` | — | init · task_* · compact_boundary 분기 — 서로 다른 이벤트를 냄 · `git grep -F 'system'`: 같은 파일 6줄 · renderer+shared 21파일(test 제외) |
| A6 | `stream_event` | B-10 | B-10: text_delta(504-513)와 thinking_delta(514-523)의 이벤트 조립이 필드 하나만 다르다 · `git grep -F 'stream_event'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `assistant` | — | L6 아님 — taskToolRunIds 쓰기(612-615)는 읽는 곳 0(B-07, X1), fileEditToolRunIds(616-620)는 toolNames 에서 파생 가능(B-08, X3) · `git grep -F 'assistant'`: 같은 파일 22줄 · renderer+shared 15파일(test 제외) |
| A6 | `user` | — | L6 아님 — `ctx.toolNames?.get(toolRunId)` 4회(689·701)·fileEditToolRunIds.has 2회(679·691)는 B-08 이 함께 정리 · `git grep -F 'user'`: 같은 파일 11줄 · renderer+shared 41파일(test 제외) |
| A6 | `result` | B-09 | B-09: wire 타입 리터럴(779-809)이 normalizeResultTelemetry 인자 타입(913-934)과 usage·modelUsage 구간에서 같다 · `git grep -F 'result'`: 같은 파일 49줄 · renderer+shared 70파일(test 제외) |
| A6 | `overrideContext` | — | assistant·delta 공용 병합 — 단일 · `git grep -F 'overrideContext'`: 같은 파일 3줄 · renderer+shared 0파일(test 제외) |
| A6 | `normalizeResultTelemetry` | B-09 | B-09: 인자 타입 리터럴이 호출부 캐스트 타입과 두 벌 · `git grep -F 'normalizeResultTelemetry'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
| A6 | `applyCumulativeUsageDelta` | — | 누적 차분 — 단일 · `git grep -F 'applyCumulativeUsageDelta'`: 같은 파일 2줄 · renderer+shared 0파일(test 제외) |
<!-- /gen:units -->

## 재현

```sh
node docs/handoff/0315-supplementary-bloat-audit/scan/check.mjs --check    # 검사
node docs/handoff/0315-supplementary-bloat-audit/scan/check.mjs --ruling   # 중단 규칙 입력값
node --test docs/handoff/0315-supplementary-bloat-audit/scan/*.test.mjs    # 검사기 UT
```

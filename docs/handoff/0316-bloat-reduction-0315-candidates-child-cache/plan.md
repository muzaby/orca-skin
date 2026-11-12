# Plan — 0316-bloat-reduction-0315-candidates-child-cache

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0315 감사](../0315-supplementary-bloat-audit/audit.md) §3·§4 · [0315 verify](../0315-supplementary-bloat-audit/verify.md) §13(AC10 승인), [0314 plan](../0314-0305-derivative-closeout/plan.md) D-021 · [0314 장부](../0314-0305-derivative-closeout/ledger.md) C표, [0313 plan](../0313-subagent-summary-single-derivation/plan.md) D-013이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0316-bloat-reduction-0315-candidates-child-cache` |
| 작성자 | Claude Code |
| 일자 | 2026-11-12 |
| 매핑 | 0315 통과 후보 7건(B-01·B-05·B-06·B-07·B-08·B-09·B-10) · 0314 D-021 이월(child 메시지 파생 캐시) |
| 상태 | READY → impl/IMPL_DONE (r1) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0315의 V는 감사 산출물(검사기) 계약이라 코드 계약을 상속하지 않는다. 0313 요약 캐시 테스트는 VP-07이 회귀로 다시 닫는다 |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 리팩토링 — root `AGENTS.md` 협업 워크플로우) |
| 조사 기준 커밋 | `098acf8` (`git cat-file -t` → commit · `git rev-parse origin/main` 과 같음). 0315 감사 기준 `c1af29f` 이후 `app/` diff 0줄(`git diff --stat c1af29f 098acf8 -- app/` → 출력 없음) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0315 감사가 같은 파일 안에서 같은 판정·조립을 두 번 적거나 읽는 곳 없는 집합을 기록하는 자리 7곳을 통과 후보로 남겼고 사용자가 구현을 승인했다(0315 verify §13). 0314는 child 메시지 파생의 공유 캐시를 이월했다 — 호출 3곳 중 `AgentViews.tsx:68`이 메모 없이 렌더마다 세션 전 파트를 돈다(0314 D-021).
- 완료 후 달라지는 것: 7자리가 각각 한 벌이다. child 메시지는 (메시지 배열, 부모 tool run)마다 한 번 만들고 세 화면이 같은 결과를 함께 든다. 사용자·하네스가 보는 화면과 이벤트는 그대로다.
- 성공을 사용자 관점에서 한 문장으로: 서브에이전트 정착 표식·중단/오류로 끝난 턴·재시도 배너·활동 스냅샷·Claude 도구 결과·스트리밍 델타·사용량·child 대화가 지금과 똑같이 보이고, 그 뒤의 prod 코드는 7건에서 순감한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "0315 감사의 통과 후보 7건(B-01, B-05, B-06, B-07, B-08, B-09, B-10)을 구현하는 Plan 작성하라." | 라이브 세션 턴 1 |
| 명시 요구 | "0314 D-021로 이월된 child 메시지 파생 캐시(AgentView.tsx:68 메모)도 함께 넣어라." | 턴 1 |
| 명시 요구 | "구현 전에 각 후보의 전체를 현재 코드로 다시 측정하고, 틀린 것은 제외 결정으로 남겨라." | 턴 1 |
| 명시 요구 | "묶음(chatReducer, chatReducer.receive, claude/map.ts, 이월분)마다 커밋늘 나눠라." | 턴 1 |
| 명시 요구 | "조건은 ui 회귀 금지. 성능 최소 동등, 구조적 중복을 하나로 만들어서 얻는 감량이다." | 턴 1 |
| 명시 요구 | "단 무작정 라인수를 없애, 감량하는 행동은 하지 말 것." · "단순 테스트를 줄이는 것 자체를 목표로 삼지 않는다" | 턴 1 |
| 상속 | 구현 1건 승인 — "B-07은 `remove`라 승인 목록 대상이며 이 승인에 포함된다" | 0315 verify §13 |
| 상속 | child 메시지 파생의 공유 캐시는 "종결이 아니라 핸드오프 이월" | 0314 D-021 |
| 상속 | 메시지 배열 파생 캐시의 키는 배열 identity, 칸은 인자 값마다, 저장은 `WeakMap` | 0313 D-013 |
| 추론 의도 | "chatReducer.receive" 묶음은 `chatStore.ts`의 `receive()`다 — B-05·B-06의 자리이고 reducer 파일에는 `receive`가 없다(`rg -n "function receive" app/src/renderer/src/features/chat/reducer/chatReducer.ts` → 0) | 0315 audit §2 A3 |
| 추론 의도 | "AgentView.tsx:68"은 `harnesses/opencode/rightpanel/AgentViews.tsx:68`이다 | §8 전수 조사 |
| 추론 의도 | "구조적 중복을 하나로"는 이월분에도 건다 — child 캐시를 0313 요약 캐시의 사본으로 두지 않고 한 캐시 기제를 함께 쓴다(D-009) | 사용자 조건 문장 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 범위는 0315 통과 후보 7건과 0314 D-021 child 메시지 파생 캐시다 | "통과 후보 7건 … 구현하는 Plan 작성하라" · "D-021로 이월된 … 함께 넣어라" | 사용자 턴 1 | ACTIVE | — |
| D-002 | 구현 전에 후보마다 전체를 현재 코드로 다시 재고, 틀린 후보는 제외 결정으로 남긴다. 결과: 제외 0건, 감사 주장 정정 9건(§4) | "구현 전에 각 후보의 전체를 현재 코드로 다시 측정하고, 틀린 것은 제외 결정으로 남겨라." | 사용자 턴 1 | ACTIVE | — |
| D-003 | 커밋 묶음은 넷이다 — M1 `chatReducer.ts`(B-01) · M2 `chatStore.ts` `receive`(B-05·B-06) · M3 `adapters/claude/map.ts`(B-07~B-10) · M4 이월분. 묶음 커밋은 그 묶음의 코드와 잠금 테스트를 함께 담고, 설계·구현 보고 커밋과 섞지 않는다 | "묶음(chatReducer, chatReducer.receive, claude/map.ts, 이월분)마다 커밋늘 나눠라." · 규범 커밋 분리(handoff-plan 마무리) | 사용자 턴 1 | ACTIVE | — |
| D-004 | 조건 셋 — UI 회귀 금지 · 성능 최소 동등 · 구조적 중복을 하나로 만들어 얻는 감량 | "조건은 ui 회귀 금지. 성능 최소 동등, 구조적 중복을 하나로 만들어서 얻는 감량이다." | 사용자 턴 1 | ACTIVE | — |
| D-005 | 줄 수만 줄이는 변경은 하지 않는다 — 승인 자리 밖 정리·형식 압축·주석만 지우기 금지. 같은 꼴이라도 승인 목록 밖 자리(§6 O-1~O-3)는 손대지 않는다 | "단 무작정 라인수를 없애, 감량하는 행동은 하지 말 것." | 사용자 턴 1 | ACTIVE | — |
| D-006 | 테스트 감축은 목표가 아니다 — 기존 테스트 케이스 삭제 0. 기존 그물이 못 잡는 보존 동작과 새 캐시 동작에만 잠금 테스트를 더한다 | "단순 테스트를 줄이는 것 자체를 목표로 삼지 않는다" | 사용자 턴 1 | ACTIVE | — |
| D-007 | B-07(`taskToolRunIds` 제거)은 승인된 `remove`다 | "중단 규칙 판정 g4 … 가운데 구현 1건은 승인한다" | 0315 verify §13 | ACTIVE | — |
| D-008 | B-02·B-03·B-04(0315 걸림)와 넓은 감사 1단계는 범위 밖이다 | B-02는 0309 D-012가 유지하는 방어, B-03·B-04는 잠금 테스트 선행 필요(0315 audit 요약) · 넓은 감사는 INDEX 후보 표의 별도 행 | 0315 | ACTIVE | — |
| D-009 | 이월분은 `parts.ts`에 메시지 배열 파생 캐시 helper 하나를 두고 child 메시지와 서브에이전트 요약이 함께 쓴다. 키 = 배열 identity, 칸 = 파생 인자(부모 id · `includeNested`), `null` 결과도 칸에 든다. 소비처 두 곳의 child `useMemo`는 걷는다 | child 캐시를 0313 기제의 사본으로 두면 같은 파일 안 같은 캐시가 두 벌(L6)이 된다. 소비처 메모는 캐시와 같은 일을 겹쳐 한다 | 설계자 판단 | ACTIVE | — |
| D-010 | B-10은 델타 종류 비교 결과를 boolean 하나에 담아 이벤트 type 선택에 다시 쓴다. helper 함수·클로저·튜플 할당 꼴은 쓰지 않는다 | 이벤트 type을 다시 비교하는 단순 병합은 델타당 문자열 비교가 하나 는다(§4 B-10) — D-004 성능 조건 | 설계자 판단 | ACTIVE | — |
| D-011 | B-08 편집 패치 판정은 기억한 이름에 공용 술어 `carriesFileEditPatch`를 적용한다(리터럴 `'Edit'` 금지). tool_result당 이름 조회는 한 번이다 | 술어 정본이 `shared/file-edit-tool.ts:23-25`다(main·renderer 공용, 0228) | 설계자 판단 | ACTIVE | — |
| D-012 | B-09 result wire 형태는 모듈 안 이름 붙은 타입 하나(export 안 함)다. 호출부 좁히기와 `normalizeResultTelemetry` 인자가 그 이름을 쓴다. SDK 타입으로 바꾸지 않는다 | `map.ts:763` "SDK 타입 직접 의존을 피해 좁히기로 읽는다" | 설계자 판단 | ACTIVE | — |
| D-013 | 성능 동등은 이벤트·델타·렌더 1건당 수행하는 디스패치·스토어 쓰기·할당·컬렉션 조회·문자열 비교 수로 판정한다(§14). switch 라벨 비교 수는 판정 단위에서 뺀다 | B-06 뒤 default 경유 이벤트는 라벨 비교가 2 줄고 `chat.activity` +7 · `turn.retrying` +11이다(§14). 라벨 비교는 상수 시간이라 디스패치보다 작다 | 설계자 판단 | ACTIVE | — |
| D-014 | 새 잠금 테스트는 변경 전 코드에서 먼저 green임을 확인한 뒤 코드 변경을 얹는다. 캐시 테스트 5건은 새 요구라 변경 전 red가 기대값이다 | 기대값의 출처를 변경 전 동작으로 고정한다(0312 §7 선례). 설계 시점에 같은 순서로 확인했다(§8) | 설계자 판단 | ACTIVE | — |
| D-015 | 범위 밖 관찰 O-1~O-3은 고치지 않고 §6에 기록만 한다 | D-005 | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-015. D-001~D-006은 이번 턴 사용자 문장, D-007·D-008은 0315 상속, D-009~D-015는 설계자 판단이다.
- 완료 보고에 선택지로 알릴 결정: D-009(요약 캐시도 helper로 옮김 · 이월분은 +8줄) · D-013(성능 판정 단위) · D-015(관찰 3건).
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0.
  - D-001 ↔ AC1~AC8: 후보 7건(AC1~AC6)과 이월분(AC7·AC8)을 각각 요구한다.
  - D-002 ↔ §4 재측정 표: 제외 0건이라 AC에서 빠진 후보가 없다.
  - D-003 ↔ AC10(c): 묶음별 커밋과 커밋 안 파일 집합을 요구한다.
  - D-004 ↔ AC1~AC8(UI 동작) · AC9(성능) · AC10(a)(b)(감량).
  - D-005 ↔ AC10(b): prod diff hunk가 §10 자리에만 있다. D-006 ↔ AC10(d): 기존 케이스 삭제 0.
  - D-009 ↔ AC7·AC8 · D-010 ↔ AC6·AC9 · D-011 ↔ AC4 · D-012 ↔ AC5 · D-013 ↔ AC9 · D-014 ↔ §11 단계 표.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 7자리 모두 같은 판정·조립이 같은 파일에 두 벌이거나 읽는 곳 없는 기록이다. 이월분은 렌더마다 전 파트 순회라는 원인을 겨냥한다 | 아래 재측정 표 |
| 이미 기존 코드가 충족하는가 | 아니오 | §10 EP-01~EP-09 변경 전 출력 |
| 더 작은 해법이 있는가 | B-01~B-09는 감사안이 최소다. B-10은 감사안보다 줄이면 델타당 비교가 는다(D-010). 이월분은 `AgentViews.tsx`에 `useMemo`만 더하는 꼴(+3줄)이 작지만 D-021의 대상인 공유 캐시가 아니고 소비처 메모 세 벌이 남는다 | D-009 |
| 선행 자료의 주장을 코드와 대조했는가 | **정정 9건, 제외 0건** | 아래 표 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없음 | §16 |

재측정 표 — 후보마다 감사 주장 전체(대상·감량·UI·성능·회귀 그물)를 현재 코드로 다시 쟀다. 시제품은 `098acf8`의 스크래치 작업트리에 적용한 것이고 커밋하지 않았다(§8).

| 후보 | 감사 주장 | 현재 코드 실측 | 판정 |
|---|---|---|---|
| B-01 | `:1121-1126`이 `withoutId`(`:168-169`)와 같은 판정 · 4줄 · 그물 `chatReducer.task.test.ts:328-342` | 판정 같음, 네 표식 모두 `string[]`(`chatReducer.ts:435-444`) · 시제품 −4 · 그물은 비움만 본다 — 참조 보존(m01)·형제 맞바꿈(m04·m05) green | 유지 · 그물 정정 → T-01 |
| B-05 | 본문 3문장 같음 · 5줄 · 회귀 그물 있음 | 같음(`chatStore.ts:946-948` ↔ `:954-956`) · 시제품 −5 · 폴백 라우팅 게이트 항 제거(m08) green — 동치가 아니다: 폴백 라우팅된 종료에서 해제가 불리지 않아 대기열이 멈춘다(해제 함수의 키 가드 `:585`와 무관) | 유지 · 그물 정정 → T-02 |
| B-06 | default와 같은 한 문장 · 8줄 · `dispatchTo` 1회로 같다 | 같음(`:776-778`·`:855-857` ↔ `:981-982`) · 시제품 −8 · 라우팅 잠김(m12·m13 red) · 라벨 비교 수가 바뀐다 | 유지 · 성능 단위 정정(D-013) |
| B-07 | 쓰기만 있고 읽는 곳 0 · 10줄 | `rg -n taskToolRunIds app/src` → `map.ts` 3줄(117·613·614) · 유일 사용처를 잃은 import `isTaskToolName`(`:22`)이 함께 빠져 시제품 −11 | 유지 · 감량 정정 10→11 |
| B-08 | `has(id)` ≡ `carriesFileEditPatch(toolNames.get(id))` · 6줄 · Set.has 2+Map.get 4 → Map.get 1 | 쓰기 2곳이 같은 블록·같은 조건(`:607-620`) · `toolNames` 삭제 0 · 생산 컨텍스트 생성 2곳 모두 빈 값(`adapter.ts:528` · `native-history-map.ts:145`) · result 식이 한 줄로 접혀 시제품 −8 · `'Task'` 영수증 분기(n05) green | 유지 · 감량 정정 6→8 · 그물 정정 → T-04 |
| B-09 | 리터럴 두 벌 · 20줄 · 런타임 0 | 같음(`:779-809` ↔ `:913-934`) · 선언 설명 주석·선언 앞 빈 줄로 시제품 −18 · typecheck 3종 통과 | 유지 · 감량 정정 20→18 |
| B-10 | 두 분기 조립 같음 · 6줄 · 델타마다 비교 2회+객체 1개로 같다 | 같음(`:504-513` ↔ `:514-523`) · 시제품 −6 · type을 다시 비교하면 문자열 비교 +1, boolean에 담으면 같다 · 비문자열 본문 분기(n12) green | 유지 · 형태 정정(D-010) · 그물 정정 → T-06 |
| 이월 | `AgentViews.tsx:68` 메모 없음 · 나머지 두 곳은 각자 `useMemo` | 같음(`:68` · `InlineSubagentDetail.tsx:30-33` · `LegacySubAgentTile.tsx:140-143`) · child `createdAt`을 읽는 소비처 0 · 저장 메시지 배열 제자리 변경 0 · 시제품 +8 · 인라인 상세의 child 전달(c06)을 보는 테스트 0 | 유지 · 감량 아님(목적은 렌더당 전 파트 순회 제거) → T-07·T-08 |

- 정정 9건 = 그물 4(B-01·B-05·B-08·B-10) · 감량 수 3(B-07·B-08·B-09) · 성능 조건 2(B-06 판정 단위 · B-10 형태).
- 사용자에게 올릴 결정: 없음. D-009·D-013·D-015는 완료 보고에 선택지로 적는다.
- 코드 조사로 닫은 사실: §8.

## 5. 동작 / 사용자 흐름

UI 변화는 없다. 관측자는 앱 사용자(채팅 화면·우측 패널·서브에이전트 상세)와 Claude 매퍼 출력을 소비하는 history writer·renderer다.

```text
[renderer 수신] ingestChatEvent(ev) → coalescer → receive(ev)
  tool.call.completed       → default → reducer: 정착 id를 중단·일시정지·전환 중 표식에서 뺀다(없으면 같은 배열)
  turn.aborted | error      → reducer 반영 → 라이브 프리뷰 비움 → (세션 없음 | 폴백 라우팅)이면 새 채팅 대기열 전진
  turn.retrying | chat.activity → default → reducer(재시도 배너 · 활동 스냅샷)

[main 매퍼] claudeToNormalized(SDKMessage, ctx)
  assistant(tool_use) → 이름 기억 → user(tool_result) → 이름 한 번 조회 → 동행 규칙 → tool.call.completed
  stream_event(text | thinking 델타) → message.delta | message.reasoning.delta (child면 parentToolRunId)
  result → wire 형태 한 벌 → telemetry

[child 대화] AgentDetail · InlineSubagentDetail · LegacySubAgentContent → childMessageForParentToolRunId(messages, 부모)
  → 같은 배열·같은 부모면 저장된 결과 / 아니면 전 파트를 한 번 돌아 저장 → AssistantMessage(memo)
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 백그라운드 서브에이전트 정착 | 세 표식에서 그 id만 뺀다 | 일시정지·전환 중 표시가 사라진다 — 지금과 같다 |
| 무관한 도구 결과 | 표식 배열 참조를 그대로 둔다 | 작업 타일이 다시 그려지지 않는다 — 지금과 같다(지금은 잠금 없음 → T-01) |
| 중단·오류로 끝난 턴 | 반영 · 라이브 비움 · 대기열 판정 | 라이브 프리뷰가 사라지고 대기 중 새 채팅 전송이 나간다 — 지금과 같다 |
| 승격 전 낯선 sessionId의 종료 이벤트 | pending draft로 폴백 → 대기열 전진 | 같다(지금은 잠금 없음 → T-02) |
| 재시도·활동 스냅샷 | default가 reducer로 전달 | 재시도 배너·작업 중 표시가 같다 |
| Edit·Write·MultiEdit·Agent·Task·그 밖 도구 결과 | 이름 한 번 조회 → 동행 규칙 | diff 카드 줄번호·런치 영수증·작업 목록이 같다 |
| 텍스트·사고·child 델타 | 한 조립 | 스트리밍 텍스트·사고 블록·child 대화가 같다 |
| result | 같은 정규화 | 도넛·비용이 같다 |
| 서브에이전트 상세가 열린 채 다시 그림(상태줄 틱 등) | 캐시 적중 | 같은 child 대화 — 다시 계산하지 않고 `AssistantMessage` memo가 걸린다(AgentDetail은 지금 매번 계산) |

### 파생 UX / 엣지케이스

- loading / empty / error: child가 아직 없는 서브에이전트(대기 문구)도 `null`이 칸에 들어 다시 돌지 않는다 — 문구는 같다.
- cancel / retry / close / restart: 위 표. 캐시는 메시지 배열이 바뀌면 새로 계산하므로 재로드·재열기에 낡은 값이 남지 않는다.
- concurrency / multi-session: 키가 배열 identity라 세션마다 따로 든다. 두 화면이 같은 child를 동시에 그리면 한 객체를 함께 든다.
- keyboard / a11y / theme: 해당 없음 — DOM·스타일 변화 0.

## 6. 범위 / 비범위

- **범위**: `chatReducer.ts`의 tool.call.completed 두 식(B-01) · `chatStore.ts` `receive`의 세 case(B-05·B-06) · `adapters/claude/map.ts`의 MapContext 두 필드·쓰기 블록·import, tool_result 이름 조회, result 타입, stream_event 델타(B-07~B-10) · `lib/parts.ts` 캐시 helper·child 캐시·요약 캐시 이전과 `InlineSubagentDetail.tsx`·`LegacySubAgentTile.tsx`의 child 메모(이월) · §11 잠금 테스트.
- **비범위**: B-02·B-03·B-04와 넓은 감사(D-008) · `AgentViews.tsx`(코드 변경 없음 — 캐시가 그 호출을 덮는다) · `docs/arch/**`·`IPC_CONTRACT.md`(이번에 바꾸는 심볼을 서술하는 줄 0 — §8) · O-1~O-3(D-015).

범위 밖 관찰(D-015 — 고치지 않는다):

| # | 관찰 | 근거 | 이번에 하지 않는 이유 |
|---|---|---|---|
| O-1 | `chatReducer.ts:1845-1847`의 `expandedFiles` 추가가 `withId`(`:170`)와 같은 판정을 풀어 쓴다 | 같은 식 `includes ? 원본 : [...원본, x]` | 0315 감사 구간(A1 961-1329 · A2 1454-1596) 밖이고 승인 목록에 없다(D-005) |
| O-2 | `map.ts` `normalizeResultTelemetry`의 usage 4필드 매핑이 `usageSnapshot`(`:245-254`)과 같다 | 같은 키 4쌍 | 0315가 A6(map.ts 1-1019)을 전부 읽고 후보로 올리지 않았다 — 승인 밖 |
| O-3 | `docs/IPC_CONTRACT.md:585`가 `structuredOutput`이 실리는 도구를 목록으로 적는데 코드는 Write·MultiEdit 외 단일 결과 전부에 싣는다 | `map.test.ts:'일반 도구도 구조화 결과를 모델 콘텐츠와 별도로 보존한다 (0231)'`(Read) | 이번 변경이 동작을 바꾸지 않는 기존 문서 드리프트다 — 사용자 결정 대상 |

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| O-1~O-3 | 아니오 | 완료 보고에 알린다 |
| 넓은 감사 1단계 | 아니오 | INDEX 후보 표 0315 둘째 행 그대로 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 정착(tool.call.completed)은 그 id를 중단·일시정지·전환 중 표식에서 빼고 다른 id는 남긴다. 표식에 없던 id면 세 배열이 같은 참조다. 전환 완료 표식은 건드리지 않는다 — §10 R1 | VP-01 좌표 | `ingestChatEvent` → `receive` default → `chatReducer` → `useStoppingTasks`·`usePausedTasks` |
| R-02 | AT-02 / AC2 | turn.aborted·error는 reducer에 반영되고 라이브 프리뷰를 비운다. 세션 없음·폴백 라우팅이면 새 채팅 대기열이 전진한다 — §10 R2 | VP-02 좌표 | `ingestChatEvent` → `receive` → `releaseNewChatGate` |
| R-03 | AT-03 / AC3 | turn.retrying은 재시도 상태로, chat.activity는 활동 스냅샷으로 reducer에 닿는다 — §10 R3 | VP-03 좌표 | `ingestChatEvent` → `receive` default |
| R-04 | AT-04 / AC4 | tool_result 동행 규칙이 지금과 같다 — Edit 단일 결과는 `{ structuredPatch }`만(형태가 어긋나면 없음), Write·MultiEdit는 없음, Agent·Task 단일 결과의 런치 영수증은 `result`, 그 밖 단일 결과는 `tool_use_result`, 복수 결과는 없음. MapContext에 Task·편집 run id 집합이 없다 — §10 R4 | VP-04 좌표 · EP-04 검색 0 | SDK `assistant` → `user` → `claudeToNormalized` → `tool.call.completed` |
| R-05 | AT-05 / AC5 | result → telemetry 정규화(비용·시간·턴수·usage 4종·modelUsage·primary·contextWindow) 결과가 같다. wire 형태 선언이 한 벌이다 — §10 R5 | VP-05 좌표 · EP-05 검색 | SDK `result` → `claudeToNormalized` → `telemetry` |
| R-06 | AT-06 / AC6 | text 델타는 `message.delta`, thinking 델타는 `message.reasoning.delta`, child면 `parentToolRunId`, 본문이 문자열이 아니거나 그 밖 델타면 `[]` — §10 R6 | VP-06 좌표 | SDK `stream_event` → `claudeToNormalized` → coalescer |
| R-07 | AT-07 / AC7 | child 메시지는 (배열, 부모)마다 한 번 만든다 — 같은 입력은 같은 객체, 부모마다 따로, 배열이 바뀌면 새로(이전 칸 유지), child 없음(`null`)도 다시 돌지 않는다. 요약 캐시 규칙은 그대로다 — §10 R7 | VP-07 좌표 | 세 화면 → `childMessageForParentToolRunId`·`subagentTasksFromMessages` |
| R-08 | AT-08 / AC8 | child 대화를 그리는 세 화면이 자기 부모의 child를 그린다. AgentDetail은 같은 메시지로 다시 그릴 때 같은 child 객체를 쓰고 다른 배열이면 새로 만든다 — §10 R8 | VP-08 좌표 | `OpenCodeAgentContent` → `AgentDetail` · `AgentTaskRow`·`SubagentNoticeRow`·`CanonicalBackgroundContent` → `InlineSubagentDetail` · `SubAgentTileContent` → `LegacySubAgentContent` |
| R-09 | AT-09 / AC9 | 성능 최소 동등 — 후보·이월분마다 1건당 연산(D-013 단위)이 §14 표의 변경 후 값 이하다. 참조 보존(B-01)과 재계산 없음(이월분)은 테스트로, 핫패스 조회·비교 수는 gate로 본다 — §10 EP-09 | §10 EP-09 gate 3 · T-01(R1-b) · T-07a~d · T-08a. B-05·B-06·B-09는 수행 문장이 바뀌지 않아 R2·R3·R5 좌표가 본다 | 위 경로들 |
| R-10 | AT-10 / AC10 | 감량: (a) 묶음별 prod 순증감 — M1 ≤ −4 · M2 ≤ −13 · M3 ≤ −40 · 7건 합 ≤ −57 · M4 ≤ +10 (b) prod diff hunk가 §10 자리와 그 주석·import 줄에만 있다 (c) 묶음마다 커밋이 하나 이상이고 커밋 안 prod 파일이 그 묶음 것뿐이다 (d) 기존 테스트 케이스 삭제 0 | (a) `git diff --numstat` 묶음별 합 (b) `git diff -U0` hunk 머리를 §10 자리와 대조 (c) `git log --name-only` (d) `git diff <설계 커밋>..HEAD -- 'app/src/**/*.test.ts' \| grep -cE '^-\s*it(\.each)?\('` → 0 | 해당 없음 |
| R-11 | AT-11 / AC11 | §19 게이트가 green이거나 실패가 변경 전 같은 명령의 실패 집합과 같다(차집합 ∅, 환경 서명) | §19 명령 산출 · 기준선 식별자 집합 대조 | CI |
| R-12 | AT-12 / AC12 | 개발 빌드에서 Claude 스트리밍 텍스트·사고, Edit diff 카드, 백그라운드 서브에이전트 런치·정착 표식, 서브에이전트 상세의 child 대화(인라인·우측 패널), OpenCode 에이전트 상세, 중단·오류 뒤 라이브 프리뷰가 지금과 같다 | 사람 실기 — §19 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스는 이번 세션에 실재와 잡는 변이를 확인했다(§8 변이 표의 `잡은 테스트` 열).
- 기대값의 출처: 보존 동작 테스트 T-01~T-06·T-08은 변경 전 코드에서 green이고, 캐시 테스트 T-07(4건)·AgentDetail 케이스는 변경 전 red다(§8 — 설계 시점 확인, D-014).
- 사람 실기 항목: AC12. 판정·조립·캐시 로직은 AC1~AC9가 기계로 본다 — 자동 시각 회귀가 없어 마지막 그물로만 둔다(`app/src/renderer/AGENTS.md` 테스트 절).
- 총량 기준: AC10(a)의 임계는 시제품 실측(M1 −4 · M2 −13 · M3 −43 · M4 +8)에서 M3에 주석 문안 재량 3줄, M4에 2줄을 더한 값이다(§14).
- 0건 기준: AC4의 "집합 필드 없음"은 EP-04 음성 검색(0)과 R4의 양성 행동 단언(동행 규칙 표)을 짝짓는다. AC10(d)는 기존 케이스를 보존한다는 음성 기준이고, 양성은 §8 기준선 테스트 집합이 그대로 green인 것이다(AC11).

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 코드 계약 V가 없다.
- 기준 V 상속 근거: 없음. 0313 요약 캐시의 행동은 VP-07 회귀 입력으로 다시 닫는다.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 레벨 선택: 모듈 불변식·알고리즘(`MD↔UT`)이 7건과 캐시에, 렌더 소비처 경계(`AR↔IT`)가 이월분에 있다. `SD↔ST`는 두지 않는다 — 상태·수명주기·종단 경로가 바뀌지 않는다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-12 | R | §7 각 행 | NEW | — |
| AT-01~AT-12 | AT | §7 검증 수단 칸 | NEW | — |
| MD-01 | MD | §10 R1 정착 표식 해제 | CHANGED | `chatReducer.ts:1118-1126` · `:168-169` |
| MD-02 | MD | §10 R2 종료 이벤트 처리 | CHANGED | `chatStore.ts:945-957` |
| MD-03 | MD | §10 R3 전달만 하는 이벤트의 라우팅 | CHANGED | `chatStore.ts:776-778` · `:855-857` · `:981-982` |
| MD-04 | MD | §10 R4 tool_result 동행 규칙과 이름 기억 | CHANGED | `map.ts:21-22` · `:114-121` · `:607-620` · `:677-703` |
| MD-05 | MD | §10 R5 result wire 형태 | CHANGED | `map.ts:779-809` · `:913-934` |
| MD-06 | MD | §10 R6 스트림 델타 조립 | CHANGED | `map.ts:504-523` |
| MD-07 | MD | §10 R7 메시지 배열 파생 캐시 | CHANGED | `parts.ts:249-268` · `:293-321` (0313 D-013) |
| AR-01 | AR | §10 R8 child 메시지 소비처 | CHANGED | `AgentViews.tsx:68` · `InlineSubagentDetail.tsx:30-33` · `LegacySubAgentTile.tsx:139-143` |
| UT-01~UT-07 · IT-01 | UT · IT | §10 규칙 칸 ↔ 입력 칸 | NEW | §10 좌표 칸 |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | MD-01 ↔ UT-01 | REQUIRED | `RECV_EVENT(tool.call.completed)` → `case 'tool.call.completed'` → `withoutId` × 3 → `ChatState` 표식 배열 | §10 R1 | required — 형제 슬롯 넷(중단·일시정지·전환 중·전환 완료)의 계약이 다르고 참조 보존이 성능 계약이다. 변이 m01~m05 | EP-01 4자리 |
| VP-02 | MD-02 ↔ UT-02 | REQUIRED | `ingestChatEvent` → `receive` → `resolveSessionKey`(`pendingFallback`) → `case 'turn.aborted': case 'error':` → 디스패치 · `resetLive` · `releaseNewChatGate` | §10 R2 | required — 두 case를 한 본문으로 합치므로 라벨·문장·게이트 항이 하나씩 빠져도 다른 쪽이 통과한다. 변이 m06~m11 | EP-02 5자리 |
| VP-03 | MD-03 ↔ UT-03 | REQUIRED | `ingestChatEvent` → `receive` → `default:` → `dispatchTo(RECV_EVENT)` → reducer | §10 R3 | required — 명시 case를 지우는 변경이라 default 도달을 따로 본다. 변이 m12·m13 | EP-03 2자리 |
| VP-04 | MD-04 ↔ UT-04 | REQUIRED | SDK `assistant` → tool_use 블록 → `ctx.toolNames.set` → SDK `user` → tool_result 블록 → 이름 조회 1회 → 편집 판정 → `structuredOutput`·`result` → `tool.call.completed` | §10 R4 | required — 파생 집합을 이름 하나로 대체하므로 이름 기록·조회와 규칙 분기의 민감도를 본다. 변이 n01~n07 · n13 | EP-04 7자리 |
| VP-05 | MD-05 ↔ UT-05 | REQUIRED | SDK `result` → `msg as <wire 타입>` → `normalizeResultTelemetry(r)` → `telemetry` | §10 R5 | required — 타입만 바뀌어 런타임 테스트가 선언을 보지 않는다. 변이 t01·t02(typecheck) | EP-05 3자리 |
| VP-06 | MD-06 ↔ UT-06 | REQUIRED | SDK `stream_event` → `readParentToolRunId` → 델타 종류 판별 → 이벤트 조립 → `message.delta` / `message.reasoning.delta` | §10 R6 | required — 두 return을 하나로 접어 type·필드·전달이 서로 맞바뀔 수 있다. 변이 n08~n12 · n14 | EP-06 5자리 |
| VP-07 | MD-07 ↔ UT-07 | REQUIRED | `childMessageForParentToolRunId` / `subagentTasksFromMessages` → 캐시 helper(`WeakMap` → 칸) → `deriveChildMessage` / `deriveSubagentTasks` | §10 R7 | required — 캐시는 "덜 계산"이 목표라 결과만 보는 테스트가 우회·키 붕괴에 침묵한다. 변이 c01~c05 | EP-07 5자리 |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | `useChatSession(s => s.messages)` / props `messages` → `AgentDetail` · `InlineSubagentDetail` · `LegacySubAgentContent` → `childMessageForParentToolRunId` → `AssistantMessage` / `SubAgentTaskDetail` | §10 R8 | required — 소비처 메모를 걷는 자리라 전달 대상이 바뀌어도 다른 화면이 통과한다. 변이 c06·c07·c08 · c01(AgentDetail 경로) | EP-08 3자리 |
| VP-09 | R-01~R-09 ↔ AT-01~AT-09 | REQUIRED | 위 여덟 path의 상위 — renderer 채팅 스위트 · Claude 어댑터·매퍼 스위트 | VP-01~VP-08 좌표의 합 + §8 기준선에서 green이던 `src/renderer/src/features/chat` · `src/main/adapters/claude` 케이스가 그대로 green(실패 식별자 집합 = 기준선) + EP-09 gate | not selected — 하위 좌표·집합 대조·연산 수 gate가 직접 관측이다 | EP-09 3자리(연산 수) |
| VP-10 | R-10~R-12 ↔ AT-10~AT-12 | REQUIRED | diff·게이트·실기 | `gate:` AC10 (a)~(d) 명령 · §19 명령 산출 · 사람 실기 | not selected — 측정 명령이 직접 판정이다 | 0 — 코드 자리 없음 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/**` 수정 | §19 | 이번 변경이 만진 파일에서 난 실패와 기준선 밖 실패만 blocking |
| 테스트 풀·예산 가드 | 테스트 파일을 추가·수정한다 | `node scripts/check-test-budgets.mjs` · vitest unit 풀 가드 `[test-pools]` | 만진 파일의 위반만 blocking |
| 레이어 경계 | 같은 레이어 안 변경뿐이지만 lint가 boundaries를 함께 본다 | `npm run lint` | 전부 blocking |
| 문서 인벤토리·이름 검사기 | `docs/handoff/**` 수정 | `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` | 전부 blocking |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `withoutId`는 없는 id에 같은 참조를 돌려준다 — 표식 셀렉터가 참조로 memo하기 때문이다 | `chatReducer.ts:165-169` 주석·정의 |
| tool.call.completed는 중단 표식만 `withoutId`로 빼고 나머지 둘은 같은 식을 풀어 쓴다. 전환 완료(`backgroundedTaskIds`)는 건드리지 않는다 | `chatReducer.ts:1118-1135` |
| `receive`의 turn.aborted·error 본문은 문장 단위로 같다. 게이트 조건은 telemetry case에도 같은 식이 한 번 더 있다(경로 밖 형제) | `chatStore.ts:945-957` · `:924` |
| `releaseNewChatGate`는 `pendingNewChatKey !== expectedKey`면 아무것도 하지 않는다 — 알려진 세션 키로 불러도 무해하다 | `chatStore.ts:582-594` |
| `resolveSessionKey`는 모르는 sessionId를 미확정 pending draft로 폴백하고 `pendingFallback: true`를 돌려준다 | `chatStore.ts:514-524` |
| turn.retrying·chat.activity case는 default와 같은 한 문장이고, 그 밖에 디스패치만 하는 case는 없다 | `chatStore.ts:776-778` · `:855-857` · `:981-982` · switch 전수 |
| `taskToolRunIds`를 읽는 곳은 0이다. 구조화 출력은 Write·MultiEdit를 뺀 모든 단일 결과에 실린다(0231) | `map.ts:688-695` · `map.test.ts:'일반 도구도 구조화 결과를 모델 콘텐츠와 별도로 보존한다 (0231)'` |
| `fileEditToolRunIds`와 `toolNames`는 같은 블록·같은 조건(`toolRunId && toolName`)에서 쓰이고 지워지지 않는다. 편집 술어는 `name === 'Edit'`이다 | `map.ts:605-620` · `shared/file-edit-tool.ts:23-25` |
| 생산 `MapContext`는 둘이고 둘 다 빈 컨텍스트로 시작한다 | `adapter.ts:528-532` · `native-history-map.ts:145` |
| result의 usage·modelUsage 타입 리터럴이 호출부 캐스트와 정규화 인자에 두 벌이다. 정규화는 `assignNums(target, Record<string, unknown>)`로 값을 넘긴다 | `map.ts:779-809` · `:913-934` · `:236-242` |
| text·thinking 델타의 두 return은 type과 읽는 필드만 다르고, 두 이벤트 타입의 모양이 같다 | `map.ts:504-523` · `shared/ipc.ts:547` · `:631-636` |
| child 메시지는 부를 때마다 새 객체(`createdAt: Date.now()`)와 벗긴 파트를 만든다 | `parts.ts:249-268` |
| child 메시지 소비처는 `.parts`(그리고 `AssistantMessage`의 `incomplete`)만 읽는다 — `createdAt`을 읽는 곳 0 | `SubAgentTaskDetail.tsx:52,66-67` · `harnesses/common/transcript/AssistantMessage.tsx` · 아래 전수 |
| `AssistantMessage`는 `memo`다 — 같은 message 객체면 다시 그리지 않는다 | `components/transcript/AssistantMessage.tsx:7` |
| 0313 요약 캐시는 `WeakMap<배열, [최상위, 중첩]>`이고 계산 뒤 저장한다 | `parts.ts:293-321` |
| 테스트가 `vi.spyOn(모듈 네임스페이스, export)`로 컴포넌트의 export 호출을 센다 — 선례가 있다 | `opencode/rightpanel/tiles.memo.test.ts:20` |
| 인라인 상세 테스트는 상세 구현을 대역으로 바꾸고 `task`만 기록한다 — `childMessage`를 보는 단언 0 | `InlineSubagentDetail.test.ts:39-42` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `taskToolRunIds`·`fileEditToolRunIds` 소비 | `grep -rnE "taskToolRunIds\|fileEditToolRunIds" app/src --include=*.ts --include=*.tsx` | 8 | 전부 `map.ts`(선언 2 · 쓰기 4 · 편집 읽기 2). 테스트 0 |
| `isTaskToolName` (map.ts) | `grep -n isTaskToolName app/src/main/adapters/claude/map.ts` | 2 | import 1 · B-07 쓰기 블록 1 — B-07이 import를 함께 지운다 |
| `toolNames` 쓰기·지우기 | `grep -n "toolNames" app/src/main/adapters/claude/map.ts` (다른 claude 파일 0) | 5 | 선언 1 · `??=` 1 · `set` 1 · `get` 2줄(4회). 삭제 0 |
| 테스트가 `toolNames`를 직접 채우는 곳 | `grep -rn "toolNames" app/src/main/adapters --include=*.test.ts` | 1 | `map.test.ts:490` `'Agent'` — `'Edit'`을 직접 넣는 곳 0 |
| `MapContext` 생산 생성 | `grep -rn "const .*: MapContext = {" app/src/main --include=*.ts` (테스트 제외) | 2 | `adapter.ts:528` · `native-history-map.ts:145` |
| `childMessageForParentToolRunId` 호출 | `grep -rnE "childMessageForParentToolRunId\(" app/src/renderer/src -g '!*.test.*'` | 1+3 | 정의 1 · `AgentViews.tsx:68` · `InlineSubagentDetail.tsx:31` · `LegacySubAgentTile.tsx:141` |
| child 메시지 값을 읽는 prod 자리 | `grep -rnE "childMessage\b\|childMessage\.\|childMessage\?" app/src/renderer/src -g '!*.test.*'` + `AgentViews.tsx`의 `child` | 10+2줄 | 선언 2 · 전달 2 · 구조 분해·타입 2 · `.parts` 1 · 존재 판정 2 · `AssistantMessage` 전달 1 + AgentViews 존재 판정·전달 2 — `createdAt` 0 |
| 저장 메시지 배열·파트 제자리 변경 | `grep -rnE "messages\.(push\|splice\|pop\|shift\|unshift\|sort\|reverse\|fill)\(\|\.parts\.(push\|splice\|pop\|shift\|unshift\|sort\|reverse)\(" app/src/renderer/src/features/chat -g '!*.test.*'` | 1 | `turns.ts:43` — `groupTurns`가 새로 만든 지역 배열이다. 저장 배열 변경 0 |
| `subagentTasksFromMessages` 호출 | `grep -rn "subagentTasksFromMessages(" app/src/renderer/src -g '!*.test.*'` | 1+5 | 정의 1 · 호출 5 — helper 이전 뒤 시그니처 그대로 |
| `parts.ts`의 throw | `grep -n throw app/src/renderer/src/features/chat/lib/parts.ts` | 0 | 두 파생이 던지는 자리 0 |
| 이번 심볼을 서술하는 문서 | `grep -rn "taskToolRunIds\|fileEditToolRunIds\|childMessageForParentToolRunId\|subagentTaskCache\|withoutId\|normalizeResultTelemetry" docs/arch docs/decisions docs/*.md AGENTS.md app/AGENTS.md app/src/*/AGENTS.md` | 0 | 문서 갱신 없음 |
| 겹치는 INDEX 후보 행 | INDEX `## 새 handoff 후보` 대상 열 대조 | 3 | 0314 child 캐시(승격 — 이번 범위) · 0315 구현 1건(이번 handoff) · 0308 `chatStore.ts` `sessionBusy`(`:1627`·`:1731`·`:1767` — `receive`(`:698-983`) 밖, 이번 diff와 겹침 0 → 승격 아님) |

### 설계 시점 실측

`098acf8`의 스크래치 작업트리(`git worktree add --detach`)에 후보 7건과 이월분을 시제품으로 적용하고 변이를 심었다. 커밋하지 않았다.

- 정적 게이트: `npm run typecheck`(3종) exit 0 · `eslint ./src ./scripts` 0 error · 2 warning(변경 전과 같은 `Timeline.tsx:57`·`useTranscriptVirtualizer.ts:22`) · `check-test-budgets` OK · `check-product-naming` OK.
- 시제품 prod numstat: `map.ts` +35 −78(−43) · `chatStore.ts` 0 −13(−13) · `chatReducer.ts` +2 −6(−4) · `parts.ts` +36 −21(+15) · `InlineSubagentDetail.tsx` +1 −4(−3) · `LegacySubAgentTile.tsx` +1 −5(−4). 7건 합 −60 · 이월분 +8.
- 시제품 test numstat: +190 −2(인라인 상세 대역 2줄 교체 — 케이스 삭제 0).
- 기준선(변경 전 전체 vitest, 파일 필터 없음): 실패 68파일 · 320케이스 · 통과 8,376(sqlite 바인딩·Electron 미설치·Windows 경로 서명). 대상 스위트(`src/renderer/src/features/chat` · `src/main/adapters/claude`)의 실패 식별자 16행은 시제품 적용 전후 같은 집합이다(`diff` 출력 없음).
- 새 잠금 테스트를 변경 전 코드에 돌린 결과: 보존 동작 테스트 green, 캐시 테스트 4건과 AgentDetail 케이스만 red(D-014 기대).

변이 표 — 시제품(변경 후 코드)에 심었다. 1차 32건 → 못 잡음 9건, 2차 5건 → 못 잡음 1건, 새 잠금 테스트를 넣은 3차에서 못 잡음 10건이 전부 red.

| ID | 자리 | 바꾼 것 | 1·2차 결과 | 잡은 테스트(1·2차) | 3차(새 테스트 포함) |
|---|---|---|---|---|---|
| m01 | `withoutId` 정의 | `includes` 가드 제거(항상 `filter`) | 못 잡음 | — | 잡음(T-01) |
| m02 | 정착 · 일시정지 | `withoutId` 호출 제거(원본 유지) | 잡음 | `chatReducer.task.test.ts:'정착(부모 Task 권위 결과)이 오면 라이브 표식이 함께 끝난다'` | — |
| m03 | 정착 · 전환 중 | 같음 | 잡음 | 같음 | — |
| m04 | 정착 · 전환 중 | 원천을 `backgroundedTaskIds`로 맞바꿈 | 못 잡음 | — | 잡음(T-01) |
| m05 | 정착 · 일시정지 | 원천을 `stoppingTaskIds`로 맞바꿈 | 못 잡음 | — | 잡음(T-01) |
| m06 | `receive` turn.aborted 라벨 | 제거 | 잡음 | `chatStore.test.ts:'pending draft cancel 은 gate 를 해제하지 않고 실제 terminal 수신 때 큐를 진행한다'` · ``chatStore.gitTriggers.test.ts:'형제 `turn.aborted` 는 같은 자리에서 다른 일을 한다 — 산출을 맞바꾸면 갈린다'`` · `chatStore.planOwner.test.ts:'다음 queued draft를 열어도 승인은 dispatch된 draft에 붙고 늦은 해결은 다음 retry를 보존한다'` | — |
| m07 | `receive` error 라벨 | 제거 | 잡음 | `chatStore.test.ts:'error 는 잔여 라이브 프리뷰를 커밋 없이 버린다(기존 동작 동형)'` · `'init 전 sessionId 없는 error 는 pending draft 에 라우팅하고 큐를 진행한다'` | — |
| m08 | 종료 게이트 | `\|\| pendingFallback` 제거 | 못 잡음 | — | 잡음(T-02 두 케이스) |
| m09 | 종료 게이트 | `!evSessionId \|\|` 제거 | 잡음 | `chatStore.test.ts` 위 두 게이트 케이스 · `planOwner` 케이스 | — |
| m10 | 종료 본문 | `resetLive(key)` 제거 | 잡음 | `chatStore.test.ts:'error 는 잔여 라이브 프리뷰를 …'` · `gitTriggers` 케이스 | — |
| m11 | 종료 본문 | 디스패치 제거 | 잡음 | 위 + `chatStore.test.ts:'sessionId 없는 error 이벤트는 활성 엔트리로 폴백한다'` | — |
| m12 | `receive` | `case 'turn.retrying': return` 삽입 | 잡음 | `chatStore.planOwner.test.ts:'다음 queued draft를 …'`(`retry?.attempt` 단언) | — |
| m13 | `receive` | `case 'chat.activity': return` 삽입 | 잡음 | `chatStore.listen.test.ts:'transport 스냅샷이 listening 상태를 굴린다'` 외 7건 · `chatStore.schedules.test.ts` 4건 | — |
| n01 | 편집 판정 | `false` 고정 | 잡음 | `map.fileEdit.test.ts:'Edit tool_result 에 structuredPatch 만 투영해 싣는다'` · `'패치 형태가 어긋나면 싣지 않는다 (EP-05)'` · `native-history-map.test.ts:'retains native camelCase tool metadata without replaying usage or embedding full files'` | — |
| n02 | 편집 판정 | 이름이 있으면 `true` | 잡음 | `adapter.background.test.ts:'keeps model content and complete structured Agent/Bash results independently'` 외 18건 | — |
| n03 · n04 | structuredOutput 규칙 | `'MultiEdit'` 항 · `'Write'` 항 제거 | 잡음 | `map.fileEdit.test.ts:'Write/MultiEdit 에는 싣지 않는다 (D-009·D-010)'` | — |
| n05 | result 규칙 | `'Task'` 항 제거 | 못 잡음 | — | 잡음(T-04) |
| n06 | result 규칙 | `'Agent'` 항 제거 | 잡음 | `map.test.ts:'백그라운드 런치 영수증(tool_use_result.status=async_launched)을 result 로 싣는다 (0136)'` | — |
| n07 | 이름 조회 | `undefined` 고정 | 잡음 | `map.fileEdit.test.ts` 3건 · `map.test.ts` 영수증 · `native-history-map` 케이스 | — |
| n13 | 이름 기록 | `ctx.toolNames.set` 제거 | 잡음 | `map.fileEdit.test.ts` 3건 · `native-history-map` 케이스 | — |
| n08 | 델타 type 선택 | 두 type 맞바꿈 | 잡음 | `map.test.ts:'stream_event(text_delta) → message.delta'` · `'stream_event(thinking_delta) → message.reasoning.delta'` | — |
| n09 | 델타 본문 필드 | `text` ↔ `thinking` 맞바꿈 | 잡음 | 위 둘 · `map.background-metadata.test.ts:'routes child text and thinking deltas to their parent tool'` | — |
| n10 | child 전달 | `parentToolRunId` 펼침 제거 | 잡음 | `map.background-metadata.test.ts:'routes child text and thinking deltas …'` | — |
| n11 | thinking 분기 | 제거 | 잡음 | `map.test.ts:'stream_event(thinking_delta) …'` · `background-metadata` 케이스 | — |
| n12 | 문자열 가드 | `typeof text === 'string'` → `text !== undefined` | 못 잡음 | — | 잡음(T-06) |
| n14 | 종류 판별 | 판별 대상 `text_delta` → `thinking_delta` | 잡음 | `map.test.ts` 델타 두 케이스 · `background-metadata` 케이스 | — |
| t01 · t02 | wire 선언 | `num_turns` · `queued_turn_count` 필드 제거 | 잡음(typecheck) | `tsc -p tsconfig.node.json` TS2339 — 정규화의 `r.num_turns`·호출부의 `r.queued_turn_count`가 같은 선언을 읽는다 | — |
| c01 | child 캐시 | 캐시 우회(매번 파생) | 못 잡음 | — | 잡음(T-07 · T-08a) |
| c02 | child 칸 키 | 부모 무시(배열당 칸 하나) | 못 잡음 | — | 잡음(T-07 부모마다) |
| c03 | 적중 판정 | `!== undefined` → truthy(`null` 재계산) | 못 잡음 | — | 잡음(T-07 null) |
| c04 | 요약 칸 키 | `includeNested` 무시 | 잡음 | `parts.test.ts:'중첩 포함 여부마다 따로 든다'` | — |
| c05 | 저장 | 계산 뒤 저장 제거 | 잡음 | `parts.test.ts:'같은 메시지 배열의 요약은 한 번만 만든다'` · `'메시지 배열이 바뀌면 새로 계산한다'` · `'중첩 포함 여부마다 따로 든다'` | — |
| c06 | 인라인 상세 | child를 `null`로 | 못 잡음 | — | 잡음(T-08b) |
| c07 | 레거시 타일 | child를 `null`로 | 잡음 | `CanonicalBackgroundContent.wiring.test.ts:'구 모델 선택은 상세와 child 대화를 그린다'` | — |
| c08 | AgentDetail | child를 `null`로 | 잡음 | `opencode/rightpanel/Panel.render.test.ts:'renders grouped agents and child tool cards, result and model data'` | — |

### 수치 / 전칭 표현 검산

- 재측정 수치: 위 numstat · 변이 37건(1차 32 + 2차 5) = 잡음 27 + 못 잡음 10, 3차 10건 = 잡음 10.
- 내역 합 = 총계: prod −43 −13 −4 = −60(7건) · +15 −3 −4 = +8(이월분) · 합 −52.
- "읽는 곳 0"(B-07) 반례 검색: `taskToolRunIds` 전수 3줄이 선언·쓰기뿐이다. "createdAt을 읽는 소비처 0"(이월분): child 값 전수 12줄 중 `createdAt` 0.
- 문서 앵커·기존 테스트 케이스: 인용한 테스트 이름은 이번 세션 실행 출력에서 그대로 옮겼다(변이 표). 0313 D-013 · 0314 D-021 · 0315 §13은 해당 문서에서 확인했다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: MD-01~MD-07, AR-01.
- 현재 책임 소유자: renderer `chatReducer`(표식) · `chatStore.receive`(라우팅) · main `claudeToNormalized`(SDK → 정규 이벤트) · renderer `lib/parts.ts`(파생)와 세 화면.
- 현재 흐름과 중복:
  - 정착 표식 해제 — 세 표식 중 하나만 `withoutId`, 둘은 같은 식을 풀어 쓴다.
  - 종료 이벤트 — turn.aborted·error가 같은 세 문장을 각자 적는다. turn.retrying·chat.activity는 default와 같은 한 문장을 각자 적는다.
  - 도구 이름 — tool_use에서 이름(`toolNames`)과 이름에서 파생한 집합 둘(Task·편집)을 함께 기억하고, tool_result에서 집합 조회 2회 + 이름 조회 4회를 한다. Task 집합은 아무도 읽지 않는다.
  - result 타입 — usage·modelUsage 리터럴이 두 벌이다. 델타 — 같은 이벤트 조립이 두 벌이다.
  - child 메시지 — 부를 때마다 전 파트를 돌아 새 객체를 만든다. 두 화면은 각자 `useMemo`로 감싸고 AgentDetail은 감싸지 않는다.
- 오류/취소/정리 경로: 바뀌지 않는다.

```text
receive ─ case turn.aborted { 디스패치 · resetLive · 게이트 }      reducer tool.call.completed
        ─ case error        { 디스패치 · resetLive · 게이트 }        ├ withoutId(stopping)
        ─ case turn.retrying { 디스패치 }                             ├ includes ? filter : 원본 (paused)
        ─ case chat.activity { 디스패치 }                             └ includes ? filter : 원본 (backgrounding)
        ─ default            { 디스패치 }

tool_use → toolNames.set · taskToolRunIds.add(Task) · fileEditToolRunIds.add(Edit)
tool_result → fileEditToolRunIds.has ×2 · toolNames.get ×4 → structuredOutput · result
result → cast { …usage·modelUsage… } → normalizeResultTelemetry(r: { …usage·modelUsage… })
stream_event → if text { 조립 } · if thinking { 조립 }

AgentDetail ──(렌더마다)────────────┐
InlineSubagentDetail ─ useMemo ─────┼→ childMessageForParentToolRunId → 전 파트 순회 → 새 Message
LegacySubAgentContent ─ useMemo ────┘
subagentTasksFromMessages → WeakMap<배열, [최상위, 중첩]>
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같음.
- 변경 후 책임 소유자: 같음. `parts.ts`가 메시지 배열 파생 캐시를 한 기제로 소유한다.
- 변경 후 흐름:
  - 정착 표식 해제 — 세 표식 모두 `withoutId`.
  - 종료 이벤트 — turn.aborted·error가 한 본문을 쓴다. turn.retrying·chat.activity는 default가 처리한다.
  - 도구 이름 — tool_use는 이름만 기억한다. tool_result는 이름을 한 번 읽고 편집 판정은 `carriesFileEditPatch(이름)`이다.
  - result 타입 — 이름 붙은 선언 하나를 두 자리가 쓴다. 델타 — 조립 하나, 종류 판별은 boolean 하나.
  - child 메시지 — (배열, 부모)마다 한 번 만들어 저장한다. 세 화면은 export를 바로 부른다.
- 유지하는 메커니즘: `withoutId`/`withId` · `releaseNewChatGate` 키 가드 · `toolNames` · `carriesFileEditPatch`·`readFileEditStructuredPatch` · `normalizeResultTelemetry`·`assignNums` · 0313 캐시 의미(키·칸·수명·계산 뒤 저장).
- 제거/대체하는 메커니즘: `MapContext.taskToolRunIds`(삭제 — 읽는 곳 0) · `MapContext.fileEditToolRunIds`(대체 — `toolNames` + 술어) · 두 result 타입 리터럴(대체 — 이름 붙은 선언) · 요약 캐시의 튜플 칸(대체 — helper의 `Map` 칸) · 소비처 두 곳의 child `useMemo`(대체 — 공유 캐시).

```text
receive ─ case turn.aborted / case error { 디스패치 · resetLive · 게이트 }      reducer tool.call.completed
        ─ default { 디스패치 }  ← turn.retrying · chat.activity                   └ withoutId × 3

tool_use → toolNames.set
tool_result → toolName = toolNames.get (1회) → carriesFileEditPatch(toolName) → structuredOutput · result
result → cast ClaudeResultWire → normalizeResultTelemetry(r: ClaudeResultWire)
stream_event → isText = 종류 비교 1회 → text = isText ? text : (thinking ? thinking : undefined) → 조립 1벌

AgentDetail · InlineSubagentDetail · LegacySubAgentContent → childMessageForParentToolRunId ┐
subagentTasksFromMessages ─────────────────────────────────────────────────────────────────┼→ cachedByMessages(WeakMap → Map 칸)
                                                                                            └→ deriveChildMessage / deriveSubagentTasks
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 표식 해제 판정 1벌 + 인라인 2 · 종료 본문 2 · 이름 파생 집합 2 · result 리터럴 2 · 델타 조립 2 · 캐시 기제 1 + 소비처 메모 2 | 각각 1 | D-004 감량 조건 | MD-01~MD-07 · AR-01 / VP-01~VP-08 |
| data/control flow | tool_result에서 집합 2회 + 이름 4회 조회 · AgentDetail 렌더마다 전 파트 순회 | 이름 1회 · 캐시 적중 시 순회 0 | D-004 성능 조건 | VP-04 · VP-07·VP-08 · AC9 |
| state/contract | `MapContext`에 집합 필드 2 | 필드 0 — `toolNames` 하나 | B-07·B-08 | VP-04 · EP-04 |
| error/lifecycle | 변화 없음 | 캐시 항목은 배열과 함께 수거(`WeakMap`) | 0313 D-013 유지 | VP-07 |
| test seam/관측점 | 표식 참조·폴백 게이트·`'Task'` 영수증·비문자열 델타·child 캐시·인라인 child 전달을 보는 단언 0 | T-01~T-08 | D-006 · §4 그물 정정 | §10 규칙 칸 ↔ 입력 칸 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `renderer/…/reducer/chatReducer.ts` | 표식 배열 가감(`withoutId`·`withId`) | 배열·id → 배열(무변경이면 같은 참조) | 같은 파일 case 넷 |
| `renderer/…/store/chatStore.ts` `receive` | 이벤트 → 세션 키 라우팅·스토어 부작용 | `NormalizedEvent` → 디스패치·라이브·게이트 | coalescer `emit` |
| `main/adapters/claude/map.ts` | SDK 메시지 → 정규 이벤트 | `SDKMessage`·`MapContext` → `NormalizedEvent[]` | `adapter.ts` · `native-history-map.ts` |
| `renderer/…/lib/parts.ts` | 메시지 파생과 그 캐시(SSOT) | 메시지 배열·인자 → 공유 결과(읽기 전용) | 세 화면 · 요약 소비처 5곳 |

## 10. 계약 / 타입 / 강제 지점

검색 명령은 저장소 루트에서 돈다. "변경 전"은 `098acf8`, "변경 후"는 설계 시점 시제품의 출력이다.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-01 — EP-01 | 정착은 그 id만 표식에서 빼고 없으면 같은 참조, 전환 완료는 그대로 | `chatReducer.ts` `withoutId` | 구현자 | 4자리: S1 `withoutId` 정의 `:168-169` · S2 중단 `:1118` · S3 일시정지 `:1121-1123` · S4 전환 중 `:1124-1126` | `awk '/case .tool\.call\.completed.: \{/,/unseenSettledTaskKeys: markCompletedAgentTask/' app/src/renderer/src/features/chat/reducer/chatReducer.ts \| grep -nE "TaskIds = "` → 변경 전 3줄(`withoutId(` 1 · `.includes(` 2) / 변경 후 3줄 모두 `withoutId(` · `grep -n "^const withoutId" …chatReducer.ts` → 1 | 정착 뒤에도 일시정지·전환 중으로 보이거나, 무관한 결과마다 표식 배열 참조가 바뀌어 작업 타일이 매번 다시 그려진다 |
| MD-02 / VP-02 — EP-02 | 종료 두 이벤트는 반영·라이브 비움·게이트를 한 본문으로 | `chatStore.ts` `receive` | 구현자 | 5자리: S1 turn.aborted 라벨 `:945` · S2 error 라벨 `:951` · S3 디스패치 `:946`/`:954` · S4 `resetLive` `:947`/`:955` · S5 게이트 `:948`/`:956` | `awk '/^function receive\(/,/^}$/' app/src/renderer/src/features/chat/store/chatStore.ts \| grep -nE "case 'turn\.aborted'\|case 'error'\|resetLive\(key\)\|releaseNewChatGate\(key\)"` → 변경 전 7줄(라벨 2 · `resetLive` 2 · 게이트 3 — telemetry 1 포함) / 변경 후 5줄(라벨 2 연속 · `resetLive` 1 · 게이트 2 — telemetry 1 포함) | 중단·오류 뒤 라이브 프리뷰가 남거나, 승격 실패로 끝난 새 채팅 뒤 대기 중 전송이 나가지 않는다 |
| MD-03 / VP-03 — EP-03 | 전달만 하는 이벤트는 default가 reducer로 보낸다 | `chatStore.ts` `receive` default | 구현자 | 2자리: S1 turn.retrying 경로(`:776-778` → `:981-982`) · S2 chat.activity 경로(`:855-857` → `:981-982`) | `awk '/^function receive\(/,/^}$/' …chatStore.ts \| grep -nE "case 'turn\.retrying'\|case 'chat\.activity'\|^    default:"` → 변경 전 3줄 / 변경 후 1줄(`default:`) | 재시도 배너·활동 스냅샷(작업 중·예약 표시)이 화면에 반영되지 않는다 |
| MD-04 / VP-04 — EP-04 | tool_result 동행 규칙은 앞선 tool_use에서 기억한 이름 하나로 판정한다 | `map.ts` `toolNames` · `shared/file-edit-tool.ts` `carriesFileEditPatch` | 구현자 | 7자리: S1 이름 기록 `:608-609` · S2 이름 조회(변경 전 `:689`·`:701`의 4회 → 1회) · S3 편집 판정(변경 전 `:679`·`:691` 집합 조회 2회) · S4 structuredOutput 규칙 `:688-695` · S5 result 규칙 `:700-703` · S6 Task 집합 제거 `:22`·`:114-117`·`:610-615` · S7 편집 집합 제거 `:118-120`·`:616-620` | `grep -nE "toolNames\|carriesFileEditPatch\|taskToolRunIds\|fileEditToolRunIds\|isTaskToolName" app/src/main/adapters/claude/map.ts` → 변경 전 17줄 / 변경 후 6줄(import 1 · 필드 1 · 기록 2 · 조회 1 · 판정 1) · `grep -rnE "taskToolRunIds\|fileEditToolRunIds" app/src` → 8 / 0 · 규칙: `awk "/if \(p.type === 'tool_result'\) \{/,/isError: p.is_error/" …map.ts \| grep -nE "'Write'\|'MultiEdit'\|'Agent'\|'Task'\|fileEdit"` → 변경 전 6줄 / 변경 후 7줄(판정 변수 선언 1이 는다) | 편집 카드 줄번호가 사라지거나 파일 전체가 결과에 실리고, 백그라운드 런치가 완료처럼 보이고, 작업 타일이 목록을 만들지 못한다 |
| MD-05 / VP-05 — EP-05 | result wire 형태 선언 하나를 호출부와 정규화 인자가 함께 쓴다 | `map.ts` 이름 붙은 타입(D-012) | 구현자 | 3자리: S1 선언(신설) · S2 호출부 캐스트 `:779` · S3 정규화 인자 `:913` | `grep -nE "total_cost_usd\?: number\|cache_creation_input_tokens\?: number\|cacheCreationInputTokens\?: number" app/src/main/adapters/claude/map.ts` → 변경 전 6줄(두 벌) / 변경 후 3줄 · `grep -nE "const r = msg as unknown as\|function normalizeResultTelemetry\(r:" …map.ts` → 변경 전 2줄 모두 `{`(리터럴)로 끝남 / 변경 후 2줄 모두 같은 타입 이름 | 한쪽만 고쳐 두 형태가 갈라진다(이번 감량의 대상). 런타임 영향 없음 |
| MD-06 / VP-06 — EP-06 | text·thinking 델타는 type과 본문 필드만 다르고 조립은 하나다 | `map.ts` stream_event 분기 | 구현자 | 5자리: S1 종류 판별(text) · S2 종류 판별(thinking) · S3 type 선택 · S4 본문 문자열 가드 · S5 `parentToolRunId` 전달 | `awk "/if \(msg.type === 'stream_event'\)/,/^  }\$/" app/src/main/adapters/claude/map.ts \| grep -nE "text_delta\|thinking_delta\|'message\.delta'\|'message\.reasoning\.delta'\|parentToolRunId \?\|typeof"` → 변경 전 6줄(조립 2벌) / 변경 후 5줄(조립 1벌) | 스트리밍 텍스트가 사고 블록으로(또는 반대로) 보이거나, child 델타가 메인 화면에 섞이거나, 잘못된 델타가 화면에 찍힌다 |
| MD-07 / VP-07 — EP-07 | 메시지 배열 파생은 (배열 identity, 인자)마다 한 번 계산해 저장하고 `null`도 저장한다 | `parts.ts` 캐시 helper(D-009) | 구현자 | 5자리: S1 칸 확보(배열 → `Map`) · S2 적중 판정(`!== undefined`) · S3 계산 뒤 저장 · S4 child 래퍼(키 = 부모 id) · S5 요약 래퍼(키 = `includeNested`) | `grep -nE "new WeakMap<\|\.get\(messages\)\|\.set\(messages," app/src/renderer/src/features/chat/lib/parts.ts` → 변경 전 3줄(요약 선언·get·set) / 변경 후 4줄(캐시 선언 2 · helper get 1 · set 1) | 캐시가 빠지면 화면은 같고 계산만 는다. 키가 섞이면 다른 서브에이전트의 대화나 중첩 여부가 다른 요약이 보인다 |
| AR-01 / VP-08 — EP-08 | child 대화를 그리는 화면은 공유 캐시 export를 바로 부르고 소비처 메모를 두지 않는다 | `parts.ts` `childMessageForParentToolRunId` | 구현자 | 3자리: S1 `AgentViews.tsx:68` · S2 `InlineSubagentDetail.tsx:30-33` · S3 `LegacySubAgentTile.tsx:139-143` | `grep -rnE "childMessageForParentToolRunId\(" app/src/renderer/src --include=*.ts --include=*.tsx \| grep -v "\.test\."` → 정의 1 + 호출 3(전후 같음) · `grep -rn -B2 "childMessageForParentToolRunId(messages" app/src/renderer/src --include=*.tsx \| grep -c useMemo` → 2 / 0 | 화면이 다른 부모의 대화를 그리거나 대화가 비고, AgentDetail이 렌더마다 전 파트를 돈다 |
| R-09 / VP-09 — EP-09 | 핫패스 1건당 조회·비교가 변경 전 이하다(D-013) | §14 표 | 구현자 | 3자리: S1 tool_result당 이름 조회 수(B-08) · S2 run id 집합 연산 수(B-07·B-08) · S3 델타당 종류 비교 수(B-10) | `grep -o "ctx.toolNames?.get(" app/src/main/adapters/claude/map.ts \| wc -l` → 4 / 1 · `grep -oE "(taskToolRunIds\|fileEditToolRunIds)(\?)?\.(add\|has)\(" …map.ts \| wc -l` → 4 / 0 · `awk "/if \(msg.type === 'stream_event'\)/,/^  }\$/" …map.ts \| grep -oE "=== '(text\|thinking)_delta'" \| wc -l` → 2 / 2 | 도구 결과·델타마다 조회·비교가 늘어 핫패스 일이 는다(이벤트 type을 다시 비교하는 병합은 S3이 3이 된다) |

- 자리 목록은 위 검색 출력과 차집합 0이어야 한다. S 번호는 §10 안에서만 쓰는 이름이다.
- 같은 규칙이 여러 레이어에 있는가: 편집 술어는 `shared/file-edit-tool.ts` 하나(main 매퍼·renderer 카드 공용) — 이번 변경은 그 술어를 새로 부르기만 한다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드의 `true/false/undefined` 의미: `toolNames.get`의 `undefined`(앞선 tool_use 없음)는 "이름 모름"이고 편집도 영수증도 아닌 일반 결과로 판정한다 — 변경 전 집합 조회 `?.has`가 `undefined`(거짓)였던 것과 같다(R4-h).
- 외부 SDK 경계: 매퍼는 SDK 타입을 type-only로만 쓰고 좁히기로 읽는다(`map.ts:10` · `:763`). 이번 변경은 그 경계를 바꾸지 않는다(D-012).
- 열린 입력 집합을 판정하는 산출물: 해당 없음.

**선언 경계** — 이 계약이 다루지 않는 입력과 green인 채로 남는 차이다. verify는 이 안의 반례를 `경계`로 본다.

1. 같은 tool_use id가 다른 이름으로 다시 기록되는 입력(R4). 변경 전에는 편집 집합에 남아 패치를 싣고, 변경 후에는 마지막 이름으로 판정한다. 이 트리에서 그 입력을 만드는 생산 경로·테스트 0 — 이름 기록은 tool_use 블록 한 곳(`map.ts:609`)이고 생산 컨텍스트 2곳은 빈 값으로 시작한다(§8).
2. 알려진 세션 키로 라우팅된 종료 이벤트의 게이트 비해제(R2). `releaseNewChatGate`의 키 가드(`chatStore.ts:585`)가 맡는 이번 diff 밖 동작이라 게이트 조건을 `true`로 바꾸는 변이는 동치다.
3. child 메시지의 `createdAt`은 첫 계산 시각으로 고정된다(R7). 읽는 소비처 0(§8 전수).
4. 저장 메시지 배열을 제자리에서 바꾸는 입력(R7). 생산 코드 0(§8 전수) — 0313 D-013과 같은 전제.
5. 파생이 던지는 입력(R7 S3). `parts.ts` throw 0 — "계산 뒤 저장" 순서는 유지하되 테스트로 잠그지 않는다.
6. result wire 필드의 타입 오기(R5). 정규화는 `assignNums(…, Record<string, unknown>)`로 값을 넘겨 typecheck가 필드 타입을 보지 않는다(`map.ts:236`). 선언 제거는 typecheck가 잡는다(t01·t02).
7. 실행 시간 벤치마크(AC9). 1건당 연산 차이가 상수 1개 이하라 측정 잡음보다 작다 — 판정은 D-013 단위의 연산 수다.

### 규칙 칸 ↔ UT 입력 칸

| 규칙 | 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|---|
| R1-a 있는 id | 세 표식에 있음 · 형제 값 구별 | 중단 `['s1','a1']` · 일시정지 `['p1','a1']` · 전환 중 `['g1','a1']` · 전환 완료 `['b1','a1']` → `a1` 정착 | `['s1']` · `['p1']` · `['g1']` | T-01 (신규 — `chatReducer.task.test.ts` `0212 — 라이브 상태 표식`, 진입 `chatReducer(RECV_EVENT)`) |
| R1-b 없는 id | 세 표식에 없음 | 같은 상태 → `zz` 정착 | 세 배열이 `toBe` 원본 | T-01 |
| R1-c 전환 완료 | 정착이 건드리지 않음 | R1-a 입력 | 전환 완료가 `toBe` 원본 | T-01 |
| R1-d 단일 표식 비움 | 기존 | 일시정지·전환 중 `['a1']` → `a1` 정착 | 둘 다 `[]` | `chatReducer.task.test.ts:'정착(부모 Task 권위 결과)이 오면 라이브 표식이 함께 끝난다'` |
| R2-a turn.aborted 라벨 | 세션 없음 | pending draft 둘 · `turn.aborted`(sessionId 없음) | 대기열 전진 · 두 번째 전송 | `chatStore.test.ts:'pending draft cancel 은 gate 를 해제하지 않고 실제 terminal 수신 때 큐를 진행한다'` |
| R2-b error 라벨 · 반영 · 라이브 | 라이브 텍스트 있음 | 델타 뒤 `error` | 라이브 `''` · 메시지 0 · `error.message` | `chatStore.test.ts:'error 는 잔여 라이브 프리뷰를 커밋 없이 버린다(기존 동작 동형)'` |
| R2-c 게이트 · 세션 없음 | sessionId 없음 | pending draft 둘 · `error`(sessionId 없음) | 대기열 전진 | `chatStore.test.ts:'init 전 sessionId 없는 error 는 pending draft 에 라우팅하고 큐를 진행한다'` |
| R2-d 게이트 · 폴백 라우팅 | 모르는 sessionId → pending draft | pending draft 둘 · `turn.aborted`·`error` 각각 sessionId `'s-unpromoted'` | 대기열 `draft:b`로 전진 · 전송 2회 · draft:a `inflight` false | T-02 (신규 — `chatStore.test.ts` `0040 새-채팅 직렬 디스패치 게이트`, `it.each` 두 이벤트, 진입 `ingestChatEvent`) |
| R2-e turn.aborted 반영 | 세션 이벤트 | `turn.aborted`(sessionId) | reducer 산출 | ``chatStore.gitTriggers.test.ts:'형제 `turn.aborted` 는 같은 자리에서 다른 일을 한다 — 산출을 맞바꾸면 갈린다'`` |
| R3-a turn.retrying | default 도달 | `turn.retrying`(attempt 1) | `session.retry?.attempt` 1 | `chatStore.planOwner.test.ts:'다음 queued draft를 열어도 승인은 dispatch된 draft에 붙고 늦은 해결은 다음 retry를 보존한다'` |
| R3-b chat.activity | default 도달 | transport 스냅샷 | listening 상태 전이 | `chatStore.listen.test.ts:'transport 스냅샷이 listening 상태를 굴린다'` |
| R4-a Edit · 패치 | 단일 결과 · 유효 패치 | Edit tool_use → 결과(`structuredPatch` 정상) | `{ structuredPatch }`만 | `map.fileEdit.test.ts:'Edit tool_result 에 structuredPatch 만 투영해 싣는다'` |
| R4-b Edit · 형태 오류 | 패치 없음·줄 수 어긋남 | 같은 경로 | 없음 | `map.fileEdit.test.ts:'패치 형태가 어긋나면 싣지 않는다 (EP-05)'` |
| R4-c Write · MultiEdit | 이름 둘 | 각 tool_use → 결과 | 없음 | `map.fileEdit.test.ts:'Write/MultiEdit 에는 싣지 않는다 (D-009·D-010)'` |
| R4-d Agent 영수증 | `async_launched` 단일 결과 | `toolNames`에 `Agent` | `result` = 영수증 | `map.test.ts:'백그라운드 런치 영수증(tool_use_result.status=async_launched)을 result 로 싣는다 (0136)'` |
| R4-e Task 영수증 | 구 이름 · tool_use 경로 | `Task` tool_use → `async_launched` 결과 | `result` = 영수증 | T-04 (신규 — `map.test.ts` `claudeToNormalized`, 진입 `claudeToNormalized` assistant → user) |
| R4-f TaskXXX · 일반 도구 | 단일 결과 | `TaskCreate` · `Read` tool_use → 결과 | `structuredOutput` = `tool_use_result` | `map.test.ts:'TaskXXX tool_result 에 SDK 구조화 출력을 structuredOutput 으로 동행시킨다 (0204)'` · `'일반 도구도 구조화 결과를 모델 콘텐츠와 별도로 보존한다 (0231)'` |
| R4-g 복수 결과 | tool_result 2개 | TaskCreate 둘 · Edit 둘 | 없음 | `map.test.ts:'tool_result 블록이 여러 개면 귀속이 모호해 structuredOutput 을 싣지 않는다 (0204)'` · `map.fileEdit.test.ts:'tool_result 블록이 여러 개면 귀속이 모호해 싣지 않는다 (0204 규칙 승계)'` |
| R4-h 이름 모름 | 앞선 tool_use 없음 | 결과만 | `structuredOutput` = `tool_use_result` · `result` = content | `map.test.ts:'완료 구조화 출력과 wire content 를 모두 유지한다 (0231)'` |
| R5-a 정규화 | usage·비용·시간·턴수 | result(필드 전부) | 정규화 값 | `map.test.ts:'result → telemetry 가 cost·duration·num_turns·캐시 토큰을 정규화한다'` · `'result(usage) → telemetry'` |
| R5-b modelUsage | 단일·다중 모델 · contextWindow | result.modelUsage | camelCase · primary · 창 승격 | `map.test.ts:'result.modelUsage → camelCase 정규화 + 단일 모델이면 top-level model 채움'` · `'다중 모델이면 실사용량(input+cache) 최대 모델을 top-level 승격 (argmax, 0141)'` · `'result.modelUsage.contextWindow → per-model 전달 + 단일 모델이면 top-level 승격 (0134)'` |
| R5-c 선언 공유 | 두 자리가 한 선언을 읽음 | 선언에서 필드 제거(t01·t02) | typecheck red | `gate: cd app && ./node_modules/.bin/tsc --noEmit -p tsconfig.node.json --composite false` |
| R6-a text | 메인 | `text_delta` `'hi'` | `message.delta` `{ text: 'hi' }` | `map.test.ts:'stream_event(text_delta) → message.delta'` |
| R6-b thinking | 메인 | `thinking_delta` | `message.reasoning.delta` | `map.test.ts:'stream_event(thinking_delta) → message.reasoning.delta'` |
| R6-c child | 부모 있음 | 두 델타 + `parent_tool_use_id` | `parentToolRunId: 'agent'` | `map.background-metadata.test.ts:'routes child text and thinking deltas to their parent tool'` |
| R6-d 그 밖 델타 | `signature_delta` | — | `[]` | `map.test.ts:'stream_event(signature_delta) → [] (스트림에서 무시)'` |
| R6-e 비문자열 본문 | text·thinking 본문이 문자열 아님 | `{ text_delta, text: 42 }` · `{ thinking_delta, thinking: null }` | 둘 다 `[]` | T-06 (신규 — `map.test.ts`, 진입 `claudeToNormalized`) |
| R7-a child 적중 | 같은 배열·같은 부모 | child 텍스트 하나 | 두 번째 반환이 `toBe` 첫 반환 · 파트 = 벗긴 텍스트 | T-07a (신규 — `parts.test.ts`, 진입 export) |
| R7-b 부모마다 | 같은 배열·다른 부모 | 부모 `a`·`b`의 child | 각자 내용 · 각자 `toBe` 유지 | T-07b |
| R7-c 배열 바뀜 | 새 배열 | 같은 부모 child 하나 더 | 새 객체(`not.toBe`) · 두 파트 · 이전 배열은 이전 객체 | T-07c |
| R7-d `null` 저장 | child 없음 | `parts` getter로 읽기 횟수를 세는 메시지 | 두 번째 호출의 읽기 0 · 둘 다 `null` | T-07d |
| R7-e 요약 캐시 | 0313 규칙 셋 | 기존 | 같은 배열 `toBe` · 중첩 칸 분리 · 새 배열 재계산 | `parts.test.ts:'같은 메시지 배열의 요약은 한 번만 만든다'` · `'중첩 포함 여부마다 따로 든다'` · `'메시지 배열이 바뀌면 새로 계산한다'` |
| R8-a AgentDetail 재렌더 | 같은 messages 두 번 · 다른 배열 한 번 | `vi.spyOn(parts, 'childMessageForParentToolRunId')` + `renderToStaticMarkup(AgentDetail)` 세 번 | 호출 결과 1·2가 같은 객체(비 `null`) · 3이 다른 객체 · 본문에 child 텍스트 | T-08a (신규 — `harnesses/opencode/rightpanel/` 렌더 테스트, 진입 `AgentDetail`) |
| R8-b AgentDetail 내용 | 기존 | child 텍스트·도구 | `'Child answer'` 렌더 | `Panel.render.test.ts:'renders grouped agents and child tool cards, result and model data'` |
| R8-c 인라인 상세 child | 자기 child 있음 / 없음 | `top-agent`(중첩 호출 child) · `nested-agent`(child 없음) | 상세에 넘긴 child 파트 id `'nested-agent'` / `'none'` | T-08b (기존 `InlineSubagentDetail.test.ts` 두 케이스 확장 — 대역이 `childMessage`를 속성으로 기록) |
| R8-d 레거시 타일 child | 선택 있음 | 구 모델 선택 | child 본문 렌더 | `CanonicalBackgroundContent.wiring.test.ts:'구 모델 선택은 상세와 child 대화를 그린다'` |

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | 표식 가감 | `:1121-1126` 두 식 → `withoutId(state.pausedTaskIds, ev.toolRunId)` · `withoutId(state.backgroundingTaskIds, ev.toolRunId)`. 주석 `:1119-1120` 유지 | reducer 순수 단위 |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | `receive` 라우팅 | turn.aborted 본문(`:946-949`)과 뒤 빈 줄 삭제 → `case 'turn.aborted':` 바로 아래 `case 'error':`. error의 주석 2줄을 두 라벨 아래 본문 위에 둔다 · turn.retrying(`:776-779`)·chat.activity(`:855-858`) case와 뒤 빈 줄 삭제 | `ingestChatEvent` 스토어 단위 |
| `app/src/main/adapters/claude/map.ts` | 매퍼 | §11-A | `claudeToNormalized` 순수 단위 |
| `app/src/renderer/src/features/chat/lib/parts.ts` | 파생 캐시 | §11-B | export 순수 단위 |
| `…/harnesses/common/transcript/InlineSubagentDetail.tsx` | 인라인 상세 | `:30-33` `useMemo` → `const childMessage = childMessageForParentToolRunId(messages, toolRunId)` | 실행 하네스(`installFakeDom`) |
| `…/harnesses/claude/rightpanel/LegacySubAgentTile.tsx` | 레거시 타일 | `:139-143`(주석 1 + `useMemo` 4) → `const childMessage = selectedId ? childMessageForParentToolRunId(messages, selectedId) : null` | SSR 배선 테스트 |
| 테스트 6파일 | §10 입력 칸 | T-01 `chatReducer.task.test.ts` · T-02 `chatStore.test.ts` · T-04·T-06 `map.test.ts` · T-07 `parts.test.ts` · T-08a `harnesses/opencode/rightpanel/` 렌더 테스트(기존 파일 케이스 추가 또는 같은 디렉터리 새 파일) · T-08b `InlineSubagentDetail.test.ts` | — |

### 11-A. `map.ts` (B-07~B-10)

- B-07: import `isTaskToolName`(`:22`) · `taskToolRunIds` 주석·필드(`:114-117`) · 쓰기 블록(`:610-615`)을 지운다.
- B-08: `fileEditToolRunIds` 주석·필드(`:118-120`)와 쓰기 블록(`:616-620`)을 지운다. `toolNames` 필드 위에 "tool_result는 도구 이름을 싣지 않아 동행 규칙(편집 패치 0228 · 런치 영수증 0136)을 앞선 tool_use의 이름으로 판정한다"는 주석을 둔다(지운 두 주석이 하던 설명). tool_result 블록 머리(`:670-671`의 `meta`·`scheduleCall` 옆)에서 이름을 한 번 읽는다.

```ts
const toolName = ctx.toolNames?.get(toolRunId)
const fileEdit = toolName !== undefined && carriesFileEditPatch(toolName)
const fileEditPatch = fileEdit ? readFileEditStructuredPatch(toolUseResult) : null
// structuredOutput: toolName === 'Write' || toolName === 'MultiEdit' ? undefined : fileEdit ? … : toolUseResult
// result:           toolName === 'Agent' || toolName === 'Task' ? (launchReceipt ?? p.content) : p.content
```

- B-09: `normalizeResultTelemetry` 앞에 모듈 안 타입 하나를 둔다 — 필드는 지금 호출부 캐스트(`:779-809`)의 것 그대로(정규화 인자의 필드는 그 부분집합). 호출부는 `msg as unknown as <이름>`, 정규화는 `(r: <이름>)`. 이름은 구현자가 정한다(시제품 `ClaudeResultWire`).
- B-10: `:504-523` 두 분기를 아래 꼴로 접는다(D-010). 그 밖 델타를 무시한다는 주석(`:524`)은 유지한다.

```ts
const delta = ev?.delta
const isText = delta?.type === 'text_delta'
const text = isText ? delta.text : delta?.type === 'thinking_delta' ? delta.thinking : undefined
if (typeof text === 'string') {
  return [{ type: isText ? 'message.delta' : 'message.reasoning.delta', sessionId: ctx.sessionId,
            ...(parentToolRunId ? { parentToolRunId } : {}), delta: { text } }]
}
```

### 11-B. `parts.ts` (이월분 — D-009)

```ts
function cachedByMessages<K, V>(
  cache: WeakMap<readonly Message[], Map<K, V>>,
  messages: readonly Message[],
  key: K,
  derive: (messages: readonly Message[], key: K) => V   // 호출마다 클로저를 만들지 않는다
): V
// slots = cache.get(messages) ?? 새 Map 등록 → cached = slots.get(key) → cached !== undefined 면 반환
// 아니면 derive 뒤 slots.set(key, derived) — 계산 뒤 저장(0313 순서 유지)
const childMessageCache = new WeakMap<readonly Message[], Map<string, Message | null>>()
const subagentTaskCache = new WeakMap<readonly Message[], Map<boolean, readonly SubagentTaskSummary[]>>()
export function childMessageForParentToolRunId(messages: readonly Message[], parentToolRunId: string): Message | null
//   → cachedByMessages(childMessageCache, messages, parentToolRunId, deriveChildMessage)
// 기존 본문(`:253-267`)은 deriveChildMessage 로 이름만 옮긴다
export function subagentTasksFromMessages(messages: readonly Message[], includeNested = false)
//   → cachedByMessages(subagentTaskCache, messages, includeNested, deriveSubagentTasks)
```

- 튜플 타입 `SubagentTaskCacheEntry`(`:296-299`)와 요약 캐시의 인라인 칸 확보(`:309-320`)는 helper로 대체한다.
- 캐시 주석은 키·칸·수명(`WeakMap`)·공유 반환(고치지 않는다)만 적는다 — "소비처가 `useMemo([messages])`로 무효화한다"는 문장은 소비처 메모를 걷으므로 쓰지 않는다.
- 반환 타입은 `Message | null` 그대로다. 소비처는 읽기만 한다(§8 전수 — 쓰기 0).

### 단계와 커밋 (D-003 · D-014)

| 단계 | 내용 | 커밋 |
|---|---|---|
| M1 | T-01 추가 → 변경 전 코드에서 green 확인 → B-01 | `refactor(chat): 0316 M1 — …` (`chatReducer.ts` · `chatReducer.task.test.ts`) |
| M2 | T-02 추가 → 변경 전 green 확인 → B-05·B-06 | `refactor(chat): 0316 M2 — …` (`chatStore.ts` · `chatStore.test.ts`) |
| M3 | T-04·T-06 추가 → 변경 전 green 확인 → B-07·B-08·B-09·B-10 | `refactor(claude): 0316 M3 — …` (`map.ts` · `map.test.ts`) |
| M4 | T-08b 확장 → 변경 전 green 확인 → T-07·T-08a 추가(변경 전 red 확인) → 캐시 helper·소비처 | `refactor(chat): 0316 M4 — …` (`parts.ts` · 소비처 2 · 테스트 3) |
| 보고 | 변이 sweep · 전체 게이트 · `[구현자 기입]` · INDEX | `docs(handoff): 0316 r1 구현 보고 — IMPL_DONE` |

- 묶음 커밋 trailer는 구현 커밋 형식이다(`Agent: claude` · `Status` · `Criteria-*` · `Verified-By: pending`).
- 묶음 순서는 서로 독립이다(파일 교집합 0). 한 묶음의 게이트가 red면 다음 묶음으로 넘어가지 않는다.

### 테스트 가능성

- electron/DB 의존: 없음. 대상 테스트는 전부 unit 풀이다 — 타이머·git·자식 프로세스·SQLite 0이라 시간 예산 규칙(F~H′) 해당 자리 0.
- T-08a는 `vi.spyOn(모듈 네임스페이스, 'childMessageForParentToolRunId')`의 `mock.results`로 반환 동일성을 본다 — `tiles.memo.test.ts:20` 선례. 대역 없이 실제 구현을 통과시키므로 `AgentDetail`·캐시·`AssistantMessage`가 실행 구간 안이다.
- T-07d는 `parts` getter의 읽기 횟수로 "다시 돌지 않음"을 본다 — `null`은 `toBe`로 구별할 수 없다.
- T-08b는 기존 대역(`SubAgentTaskDetail` 모의)에 `childMessage` 기록만 더한다. 인라인 상세 → 캐시 export 구간은 실제 코드다.

## 12. End-to-end 영향

### producer → consumer

```text
SDK tool_use ─ toolNames ─ tool_result 동행 규칙 ─ tool.call.completed ─ history writer(payload 영속) · renderer 카드·작업 목록
SDK stream_event ─ 델타 조립 ─ coalescer ─ receiveDeltaBatch ─ live 슬라이스
SDK result ─ wire 타입 ─ normalizeResultTelemetry ─ telemetry ─ usage 원장 · 도넛
ingestChatEvent ─ receive ─ reducer ─ 표식 셀렉터 · 재시도 배너 · 활동 표시 · 새 채팅 대기열
ChatState.messages ─ parts 캐시 ─ child Message ─ AssistantMessage(memo) · SubAgentTaskDetail
```

- producer 기준: 매퍼 출력 이벤트의 필드 집합이 바뀌지 않는다(R4·R5·R6 기존 좌표가 `toEqual`로 본다).
- consumer 파생 규칙: child 메시지 소비처는 `.parts`만 읽는다(§8) — 공유 객체를 고치지 않는다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: 해당 없음 — 새 합성값 없음.

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음 — 등록·초기화 값이 늘지 않는다.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 캐시 칸은 첫 호출에 만든다. `MapContext`는 지금처럼 채널·이력 투영마다 빈 값으로 시작한다.
- 취소/중단 · 종료 · retry: 변화 없음 — 종료 이벤트의 세 문장은 순서까지 같다(디스패치 → 라이브 → 게이트).
- cleanup: 캐시 항목은 메시지 배열이 수거되면 함께 사라진다(`WeakMap`). 세션 캐시 무효화(`invalidateSessionCache`)에 따로 정리할 것이 없다 — 0313과 같다.
- 메모리 상한: 배열 하나당 칸 수 ≤ 그 배열로 child를 요청한 부모 수 + 요약 2. 화면에 뜬 상세 수를 넘지 않는다.
- 다중 저장소 쓰기: 코드에는 없다. 문서 쪽 판정·상태 사본은 `plan.md`(상태·`[구현자 기입]`)와 `INDEX.md` 보드 두 곳이다 — 같은 커밋에서 함께 갱신한다.

## 14. 성능 / 상한 / 최적화

단계 지도(시제품 실측 · D-013 단위):

| 후보 | 1건당 연산 — 변경 전 | 변경 후 | prod 순증감 |
|---|---|---|---|
| B-01 | tool.call.completed: `includes` 3 · `filter` ≤3 | 같음 | −4 |
| B-05 | 종료 이벤트: 디스패치 1 · `resetLive` 1 · 게이트 판정 1 | 같음 | −5 |
| B-06 | turn.retrying·chat.activity: 디스패치 1 | 디스패치 1(라벨 비교는 D-013 밖: default 경유 −2 · `chat.activity` +7 · `turn.retrying` +11) | −8 |
| B-07 | Task tool_use: `Set.add` 1(+첫 회 `Set` 생성) | 0 | −11 |
| B-08 | Edit tool_use: `Set.add` 1 · tool_result: `Set.has` 1~2 · `Map.get` 2~4 | tool_result: `Map.get` 1 · 문자열 비교(술어) 1 | −8 |
| B-09 | 런타임 코드 0 | 0 | −18 |
| B-10 | 델타: 문자열 비교 text 1 · thinking 2 · 그 밖 2 · 할당(배열·이벤트·delta·펼침) | 문자열 비교 같음 · boolean 판정 1 · 할당 같음 | −6 |
| 이월 | AgentDetail 렌더: 전 파트 순회 + `Message`·파트 사본 할당 · 두 화면: `useMemo` 의존성 비교 · 요약: 배열 칸 인덱스 | 적중: `WeakMap.get` 1 · `Map.get` 1(순회·할당 0) · 요약: `Map.get` 1 | +8 |

- 합: 7건 −60 · 이월분 +8 · 전체 −52. AC10(a) 임계는 이 값에 주석 재량을 더한 것이다(M3 3줄 · M4 2줄).
- 이월분이 순증인 이유(시제품 hunk 실측): helper +21(주석 3 포함)이 요약 캐시의 칸 확보 −11과 튜플 선언 −3을 대체하고, child 캐시·래퍼 +8을 더하며, 소비처 메모 −7을 걷는다(+21 +8 −11 −3 −7 = +8). 목적은 감량이 아니라 렌더당 전 파트 순회 제거다(§4).
- test는 늘어난다 — 시제품 +190 −2. 기존 케이스 삭제 0(D-006).
- 캐시로 잃는 부수 효과: child `createdAt`이 고정된다(선언 경계 3 — 읽는 곳 0). 캐시가 낡은 값을 줄 위험은 R7-c(배열 바뀜)와 선언 경계 4가 다룬다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음 — 포트·스키마·IPC·설정 변화 없음. `NormalizedEvent` 필드 그대로.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 표식 가감은 무변경이면 같은 참조(셀렉터 memo) | `chatReducer.ts:165-167` 주석(0212) | §10 R1-b | 유지 — 잠금 추가(T-01) |
| 정착은 일시정지·전환 중을 끝낸다 | `chatReducer.ts:1119-1120` 주석(0212) | §11 B-01 | 유지 |
| 폴백 라우팅으로 끝난 턴도 게이트를 푼다(r2) | `chatStore.ts:953` 주석 | §10 R2-d | 유지 — 잠금 추가(T-02) |
| `session.schedules` no-op 두 자리 유지 | 0309 D-012 | §6 비범위 | 유지 — 그 case를 건드리지 않는다 |
| 편집은 `structuredPatch`만, Write·MultiEdit는 싣지 않는다 | 0228 D-007·D-009·D-010 | §10 R4-a~c | 유지 |
| 런치 영수증은 단일 결과일 때만 `result`(0136) · TaskXXX·일반 도구 구조화 출력(0204·0231) | `map.ts:651-659` · `map.test.ts` | §10 R4-d~h | 유지 — `'Task'` 잠금 추가(T-04) |
| SDK 타입 직접 의존을 피해 좁혀 읽는다 | `map.ts:762-764` | D-012 | 유지 |
| message_delta 폴백 관측(0247) | `map.ts:495-503` | §11-A B-10 | 유지 — 바로 앞 블록이고 손대지 않는다 |
| 요약 캐시 키·칸·`WeakMap`·계산 뒤 저장 | 0313 D-013 · `parts.ts:293-321` | §11-B | 유지 — 저장 꼴만 튜플 → `Map` |
| 요약 반환은 읽기 전용(공유) | 0313 D-012 | §11-B | 유지 · child 반환에도 같은 주석 |
| child 캐시는 이월 | 0314 D-021 | D-001 | 이번 handoff가 닫는다 |
| 후보 표 겹침 | `INDEX.md ## 새 handoff 후보` | §8 전수 마지막 행 | 0314 child 캐시 행·0315 구현 행 승격, 0308 행은 겹침 0 |
| 테스트 동반 · reducer·변환기 단위 테스트 | `app/AGENTS.md` 에이전트 원칙 4 · `app/src/renderer/AGENTS.md` 테스트 | §11 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| B-06 뒤 두 이벤트의 라벨 비교가 는다 | D-013 단위 밖으로 두고 완료 보고에 알린다. default 경유 이벤트(도구 결과 등)는 2 준다 |
| B-08 뒤 같은 id·다른 이름 입력에서 판정이 달라진다 | 선언 경계 1 — 생산 경로·테스트 0 |
| 요약 캐시를 helper로 옮기며 0313 동작이 바뀐다 | 0313 테스트 셋(R7-e)과 c04·c05가 회귀로 본다 |
| 소비처 메모를 걷어 렌더마다 캐시 조회가 돈다 | 조회 2회(상수) — `useMemo` 의존성 비교와 같은 차수(§14) |
| 공유 child 객체를 한 화면이 고치면 다른 화면이 바뀐다 | 소비처 쓰기 0(§8) · 주석으로 고치지 않음을 적는다(0313 D-012와 같은 규칙) |
| 자동 시각 회귀가 없다 | 표시 입력(상태·이벤트·child 객체)을 단위로 잠그고 AC12 실기를 마지막 그물로 둔다 |

- 되돌리기 어려운 결정: 없음 — 내부 구현만 바뀐다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- 코드: §11 표의 prod 6파일 · 테스트 6파일(또는 T-08a 새 파일 포함 7).
- 문서: `docs/arch/**` 변경 없음(§8). `docs/generated/inventory.md`는 수치가 그대로라 가드 재생성 결과가 같아야 한다.
- handoff: 이 plan · `INDEX.md`(보드 행 · 후보 표 두 행 승격 표시).

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` — better-sqlite3 ABI · 제약 환경 게이트 가이드, CI 표 · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- 환경 제약: `app/node_modules`는 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts`로 설치한다. vitest 실패는 변경 전 같은 명령의 실패 식별자 집합(§8 기준선 320케이스)과 차집합으로 분리한다.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck` (`lint`는 `--fix` — 실행 뒤 트리 변화를 확인한다).
- 가드 스크립트: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs`.
- 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"`.
- 코드 수정 루프의 대상 스위트: `./node_modules/.bin/vitest run src/renderer/src/features/chat/reducer src/renderer/src/features/chat/store`(M1·M2) · `src/main/adapters/claude`의 테스트 중 기준선 실패 3파일(`adapter.native-plugins` · `native-resources` · `project-reconciliation`)을 뺀 목록 + `src/main/features/usage/tracker.test.ts` · `src/main/app/artifact-sdk-live.test.ts` · `src/main/app/chat-turn/native-session.claude-transcript.test.ts`(M3) · `src/renderer/src/features/chat/lib/parts.test.ts src/renderer/src/features/chat/harnesses src/renderer/src/features/chat/store/chatStore.entryUpdates.test.ts`(M4).
- 이번 handoff 전용: EP-01~EP-09 검색 · AC10 (a)~(d) 명령 · §8 변이 37건 재실행(구현 sweep의 바닥 — 변이 원문은 구현 코드에 맞춰 재앵커한다).
- 사람 실기(AC12): 개발 빌드에서 (a) Claude 세션에서 확장사고가 켜진 답이 스트리밍되고 사고 블록이 따로 보인다 (b) 파일 하나를 Edit하게 해 diff 카드 줄번호가 보이고 Write는 전체 본문으로 보인다 (c) 서브에이전트를 백그라운드로 띄워 런치 표시 → 정착 뒤 일시정지·전환 중 표시가 사라진다 (d) 서브에이전트 행을 펼친 인라인 상세와 우측 패널 상세에 child 대화가 보이고 상태줄이 도는 동안 깜빡이지 않는다 (e) OpenCode 세션 에이전트 상세에 child 답변이 보인다 (f) 응답 중 중단·오류로 끝난 턴의 라이브 프리뷰가 사라지고, 새 채팅을 연속으로 보내면 두 번째가 나간다.

## READY self-review

- [x] Decision Ledger — D-001~D-015. 사용자 문장 6개(D-001~D-006)를 원문으로 인용했고 상속 2건은 출처를 적었다.
- [x] Part I만으로 완료 상태가 읽힌다 — §1 성공 문장 · §5 상태 표 · §7 AC1~AC12.
- [x] 조건절·이유절을 재해석하지 않았다 — "틀린 것은 제외 결정으로" → §4 표가 후보마다 유지/정정/제외를 적었다(제외 0). "무작정 라인수를 없애" → D-005·AC10(b). "테스트를 줄이는 것 자체를 목표로 삼지 않는다" → D-006·AC10(d).
- [x] 사용자 결정과 코드 조사 사실을 갈랐다 — 사용자에게 올릴 결정 0, 완료 보고에 알릴 선택 3(D-009·D-013·D-015).
- [x] 수치·전칭·앵커·기존 테스트를 실측했다 — §8 전수 표 12행 · 변이 37건의 잡은 테스트 이름은 실행 출력에서 옮겼다.
- [x] 저장소 규칙과 후보 표 겹침을 설계 입력으로 확인했다 — §8 마지막 행 · §19 · 테스트 풀·예산 가드 시제품 통과.
- [x] 각 AC가 행동 단언·검증 수단·프로덕션 도달 경로를 가진다 — AC10·AC11은 측정, AC12는 실기.
- [x] Baseline V — 상속 V 없음.
- [x] 필요한 레벨: MD 7 · AR 1 · R 12. 모든 CHANGED·NEW 왼쪽 노드에 같은 레벨 REQUIRED pair가 있다(VP-01~VP-10).
- [x] INHERITED 노드 없음 — 0313 요약 캐시 동작은 MD-07의 회귀 입력(R7-e)으로 다시 닫는다.
- [x] 각 pair가 path · §10 자리 목록과 검색 명령 · 자리별 좌표를 가진다. 적대 증거를 고른 pair(VP-01~VP-08)는 이유와 변이 ID를 적었다.
- [x] 규칙 칸의 분기마다 입력이 있다 — §10 규칙 ↔ 입력 표 36행.
- [x] 선언 경계 7건 — 각각 측정 근거(검색·코드 줄·변이)를 붙였다. 열린 입력 집합 산출물 아님.
- [x] 운영 gate가 현재 변경 산출물에만 걸린다 — 기준선 실패 68파일은 차집합으로 분리한다.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC12는 시각·실제 SDK 스트림만.
- [x] semantic 목표를 structural proxy만으로 보지 않는다 — 감량(AC10)은 측정이고 보존 동작은 행동 좌표가 본다. 음성 검색(EP-04 0)은 양성 단언(R4 표)과 짝지었다.
- [x] "X가 쓰인다" 불변식의 장치가 X를 지우면 red다 — 이름 기록 제거(n13)·조회 고정(n07)·캐시 우회(c01)·child null(c06·c07·c08) 모두 red. 자리 불변식은 형제 맞바꿈(m04·m05·n08·n09·n14)도 red.
- [x] 정책 파라미터·배타 상태 — 해당 없음(새 상태 없음).
- [x] 참조 구현 — 해당 없음.
- [x] 신규 계약의 SSOT·강제 지점·seam — 캐시 helper(`parts.ts`) · EP-07 · export 반환 동일성.
- [x] producer/consumer 양쪽 — §12.
- [x] 상한 — §13 메모리 상한 · §14 연산 표. one-way door 없음.
- [x] 본문 완성 뒤 Ledger와 교차검증했다 — §3 갱신 메모의 대조 줄.
- [x] 문장 규칙 — 판정 먼저, 표 위주. Part I은 결과, Part II는 경로·계약으로 나눴다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §9).

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: Part I·II와 §11 단계 표대로 M1~M4를 묶음마다 커밋했다. 이름은 시제품과 같다(`ClaudeResultWire` · `cachedByMessages` · `deriveChildMessage`).
- 시제품과 다른 점(주석만): B-10 위 주석 2줄(시제품 1줄) · 캐시 helper의 적중 판정 위 주석 1줄 추가 → M3 −42(시제품 −43) · M4 +9(시제품 +8). 둘 다 AC10(a) 임계 안(M3 ≤ −40 · M4 ≤ +10).
- 이견 / 현실성 문제: 없음.
- ACTIVE Decision과 충돌하는 설계 발견: 없음.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

검색은 커밋된 HEAD(`git show HEAD:<파일>`)에 돌렸다 — 출력이 §10 "변경 후" 값과 전부 같다(차집합 0).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01 | 정착 표식 해제·참조 보존 | S1 정의 · S2 중단 · S3 일시정지 · S4 전환 중 (4) | 4/4 | EP-01 → 3줄 모두 `withoutId(` · 정의 1. S1 → T-01(무관 id `toBe`) · S2 → `'부모 Task 결과가 도착하면 중단 대기가 풀린다 — …'`·T-01 · S3·S4 → `'정착(부모 Task 권위 결과)이 오면 라이브 표식이 함께 끝난다'`·T-01 | 배열 원천: 표식마다 `['s1'│'p1'│'g1'│'b1','a1']` → 결과 `toEqual`·`toBe` | — |
| VP-02 | 종료 한 본문 | S1·S2 라벨 · S3 디스패치 · S4 `resetLive` · S5 게이트 (5) | 5/5 | EP-02 → 라벨 240·241 연속 · `resetLive` 1 · 게이트 2(telemetry 포함). S1 → `'pending draft cancel 은 gate 를 …'` · S2·S3·S4 → `'error 는 잔여 라이브 프리뷰를 …'` · S5 → `'init 전 sessionId 없는 error …'`(세션 없음)·T-02 2건(폴백) | 게이트 조건: sessionId 없음 / `'s-unpromoted'`(모르는 id) → `pendingNewChatKey`·전송 수 | — |
| VP-03 | default 전달 | S1 turn.retrying · S2 chat.activity (2) | 2/2 | EP-03 → `default:` 1줄. S1 → `chatStore.planOwner.test.ts:'다음 queued draft를 …'`(`retry?.attempt` 1) · S2 → `chatStore.listen.test.ts:'transport 스냅샷이 listening 상태를 굴린다'` 외 | 이벤트 type 두 가지 → reducer 상태 | — |
| VP-04 | 이름 하나로 동행 규칙 | S1 기록 · S2 조회 · S3 편집 판정 · S4 structuredOutput · S5 result · S6 Task 집합 제거 · S7 편집 집합 제거 (7) | 7/7 | EP-04 → 6줄 · 집합 `app/src` 0 · 규칙 7줄. S1·S2 → `map.fileEdit.test.ts` 3건(tool_use 경로) · S3 → `'Edit tool_result 에 structuredPatch 만 …'` · S4 → `'Write/MultiEdit 에는 싣지 않는다 …'`·`'일반 도구도 …(0231)'` · S5 → `'백그라운드 런치 영수증 …(0136)'`·T-04 · S6·S7 → EP-04 음성 0 + `'TaskXXX tool_result 에 SDK 구조화 출력을 …(0204)'`(양성) | 이름: Edit·Write·MultiEdit·Agent·Task·TaskCreate·Read·없음 → `structuredOutput`·`result` | — |
| VP-05 | wire 선언 한 벌 | S1 선언 · S2 캐스트 · S3 인자 (3) | 3/3 | EP-05 → 필드 3줄 · 캐스트·인자 모두 `ClaudeResultWire`. S1~S3 → `gate: tsc -p tsconfig.node.json`(t01·t02 TS2339) · 런타임 → `'result → telemetry 가 cost·duration·num_turns·캐시 토큰을 정규화한다'` 외 R5 | 선언 필드 제거 → 두 자리의 읽기가 각각 TS2339 | — |
| VP-06 | 델타 조립 한 벌 | S1·S2 판별 · S3 type · S4 문자열 가드 · S5 child (5) | 5/5 | EP-06 → 5줄. S1·S3 → `'stream_event(text_delta) → message.delta'` · S2 → `'stream_event(thinking_delta) → …'` · S4 → T-06 · S5 → `map.background-metadata.test.ts:'routes child text and thinking deltas to their parent tool'` | 본문 `'hi'`·`'음...'`·`42`·`null` · 부모 `'agent'` | — |
| VP-07 | 배열 파생 캐시 | S1 칸 확보 · S2 적중 · S3 저장 · S4 child 래퍼 · S5 요약 래퍼 (5) | 5/5 | EP-07 → 4줄. S1·S3 → T-07a·`'같은 메시지 배열의 요약은 한 번만 만든다'` · S2 → T-07d · S4 → T-07a·b·c · S5 → `'중첩 포함 여부마다 따로 든다'` | 배열 identity(같음/새 배열) · 부모 `a`/`b` · `includeNested` 둘 · `parts` getter 읽기 수 | — |
| VP-08 | 소비처가 캐시 export를 바로 부름 | S1 AgentViews · S2 인라인 상세 · S3 레거시 타일 (3) | 3/3 | EP-08 → 정의 1+호출 3 · 소비처 `useMemo` 0. S1 → T-08a·`Panel.render.test.ts:'renders grouped agents …'` · S2 → T-08b · S3 → `CanonicalBackgroundContent.wiring.test.ts:'구 모델 선택은 상세와 child 대화를 그린다'` | 같은 배열 2회·새 배열 1회 → 반환 identity · child 파트 id `'nested-agent'`/`'none'` | — |
| VP-09 | 핫패스 연산 수 | S1 이름 조회 · S2 집합 연산 · S3 델타 비교 (3) | 3/3 | EP-09 → 1 · 0 · 2. S1 → `gate:` g01(조회 하나 추가 → red) · S2 → EP-04 집합 0과 같은 술어 · S3 → `gate:` g03(type 재비교 → red) | 조회·비교 개수 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음.
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(verify 전).

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | T-01 · 위 표 | m01~m05 red · s01 red |
| VP-02 | REQUIRED | SELF_PASS | T-02 · 위 표 | m06~m11 red |
| VP-03 | REQUIRED | SELF_PASS | 위 표 | m12·m13 red |
| VP-04 | REQUIRED | SELF_PASS | T-04 · 위 표 | n01~n07·n13 red · s02·s03 red · s04 동치 |
| VP-05 | REQUIRED | SELF_PASS | typecheck gate · R5 | t01·t02 red |
| VP-06 | REQUIRED | SELF_PASS | T-06 · 위 표 | n08~n12·n14 red |
| VP-07 | REQUIRED | SELF_PASS | T-07a~d · 0313 셋 | c01~c05 red · s05 red |
| VP-08 | REQUIRED | SELF_PASS | T-08a·T-08b · 위 표 | c06~c08 red · s06 동치 |
| VP-09 | REQUIRED | SELF_PASS | VP-01~08 좌표 + 기준선 집합 대조 + EP-09 | g01·g03 red |
| VP-10 | REQUIRED | SELF_BLOCKED | AC10·AC11 측정 통과 | AC12 사람 실기 대기 — 이 환경은 Electron 바이너리를 받지 못한다 |

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

하네스 `mutate.py`로 마지막 커밋 트리에 45건을 심었다. 원문은 실제 코드에 재앵커했다(시제품과 문자열이 같아 옮긴 자리 0). 끝난 뒤 `git status` 출력 없음.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| m01 `withoutId` 가드 제거 · m02·m03 일시정지·전환 중 호출 제거 · m04·m05 원천 맞바꿈 | VP-01 선택 증거 | 최초 | 1 · 2 · 2 · 1 · 1 | 잠김 |
| s01 중단 표식 호출 제거 | sweep — EP-01 S2 | 최초 | 2 | 잠김 |
| m06·m07 라벨 제거 · m08 폴백 항 · m09 세션 없음 항 · m10 `resetLive` · m11 디스패치 | VP-02 선택 증거 | 최초 | 4 · 3 · 2 · 3 · 2 · 7 | 잠김 |
| m12 `turn.retrying` 버림 · m13 `chat.activity` 버림 | VP-03 선택 증거 | 최초 | 1 · 14 | 잠김 |
| n01 판정 false · n02 판정 이름 있으면 true · n03·n04 Write·MultiEdit 항 · n05·n06 Task·Agent 항 · n07 조회 고정 · n13 기록 제거 | VP-04 선택 증거 | 최초 | 3 · 19 · 1 · 1 · 1 · 1 · 6 · 5 | 잠김 |
| s02 `fileEditPatch` → `null` · s03 structuredOutput의 편집 분기 → `false` | sweep — EP-04 S3·S4 | 최초 | 2 · 3 | 잠김 |
| s04 `toolName !== undefined && …` → `carriesFileEditPatch(toolName ?? '')` | sweep — EP-04 S3 규칙 분기(가드 제거는 타입 진단 잔여물이라 `?? ''`로 밀었다) | 최초 | 0 (905 green) | 동치 — 술어가 `name === 'Edit'`(`shared/file-edit-tool.ts:23-25`)라 `''`·`undefined`가 같은 결과 |
| n08 type 맞바꿈 · n09 필드 맞바꿈 · n10 child 전달 제거 · n11 thinking 분기 제거 · n12 문자열 가드 → `!== undefined` · n14 판별 맞바꿈 | VP-06 선택 증거 | 최초 | 2 · 3 · 1 · 2 · 1 · 3 | 잠김 |
| t01 `num_turns` · t02 `queued_turn_count` 선언 제거 | VP-05 선택 증거 | 최초 | TS2339 (`map.ts:901` · `:810`) | 잠김 |
| g01 result 규칙에 이름 조회 하나 추가 · g03 type을 다시 비교 | 새 oracle — EP-09 gate 민감도 | 최초 | gate exit 1 · exit 1 | 잠김(테스트는 green인 변화라 gate만 잡는다) |
| c01 child 캐시 우회 · c02 child 키 붕괴 · c03 적중 truthy · c04 요약 키 붕괴 · c05 저장 제거 | VP-07 선택 증거 | 최초 | 5 · 2 · 1 · 1 · 8 | 잠김 |
| s05 칸 등록(`cache.set`) 제거 | sweep — EP-07 S1 | 최초 | 8 | 잠김 |
| c06 인라인 child null · c07 레거시 child null · c08 AgentDetail child null | VP-08 선택 증거 | 최초 | 1 · 1 · 2 | 잠김 |
| s06 레거시 `selectedId ?` 분기 → `childMessageForParentToolRunId(messages, selectedId ?? '')` | sweep — EP-08 S3 규칙 분기 | 최초 | 0 (996 green) | 동치 — 선택이 없으면 목록을 그려 child를 쓰지 않고, `''`를 부모로 가진 파트는 없다(`readParentToolRunId`가 빈 값을 버린다 · `map.ts:250-253`) |

- **분모 검산**: `선택 증거 37 · 인용 변이 0 · 새 oracle 2 · sweep 6 = 표 행 45` — 잡음 43 · 동치 2 · 못 잡음 0.
- sweep 범위: §10 자리 37개(EP-01~EP-09)마다 위 행 중 하나 이상이 닿는다. EP-04 S6·S7은 지운 자리라 기본 변이 대신 음성 검색 0과 R4-f 양성 단언으로 본다. EP-09 S2는 EP-04 집합 검색과 같은 술어다. 규칙 칸 36행은 §10 좌표의 입력으로 전부 실행된다(새 입력 T-01·T-02·T-04·T-06·T-07·T-08a·T-08b).
- **덮개 회귀**: 해당 없음 — 이전 verify 없음. 설계 시점 변이 37건은 이번에도 전부 잡음(m08·n05·n12·c01~c03·c06은 설계 시점 못 잡음 → 새 테스트로 잠김).

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 해당 없음 — 새 문구·상태 0 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 — `useMemo`를 걷어도 `childMessage`·`messages`·`selectedId`가 같은 컴포넌트 스코프에 있다 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 새 실패 경로 0 | — |
| 실패가 화면에서 "아무 일도 안 일어남"으로 보이지 않는가 | 해당 없음 — 종료 이벤트의 대기열 전진은 T-02가 본다 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 캐시 키가 배열 identity라 새 커밋(새 배열)은 새로 계산한다 — T-07c | — |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `normalizeResultTelemetry` 위 기존 주석의 첫 문단이 문장 중간에서 끊긴다(`… modelUsage 키(…)가` 다음 줄이 다른 문장) | ⚠️ 보고만 — 비귀속(이번 diff 밖 기존 상태) | `map.ts` B-09 선언 바로 아래 주석 |
| 2 | 이월분 helper가 0313 요약 캐시의 저장 꼴(튜플 → `Map`)을 바꿨다 | ✅ plan D-009 그대로 — 0313 테스트 셋 green, c04·c05 red | `parts.test.ts` 0313 세 케이스 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것: 없음(주석 줄 수만 위 설계 리뷰대로 다르다).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — 대체물 없음 | — |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 해당 없음 — 대체물 없음(공유 캐시는 plan 설계 그대로) | — |
| 재진입 | 해당 없음 | — |
| 다른 무효화 축 | 해당 없음 | — |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | prod 6: `chatReducer.ts` · `chatStore.ts` · `adapters/claude/map.ts` · `lib/parts.ts` · `InlineSubagentDetail.tsx` · `LegacySubAgentTile.tsx`. test 6: `chatReducer.task.test.ts` · `chatStore.test.ts` · `map.test.ts` · `parts.test.ts` · `InlineSubagentDetail.test.ts` · 신규 `opencode/rightpanel/AgentViews.cache.test.ts` |
| 실행 명령 | §19 전부 — 가드 4종 · `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run`(필터 없음) · `node --test "scripts/*.test.mjs"` · EP-01~EP-09 · AC10 명령 · `mutate.py` 45건 |
| **관측한 게이트 산출**(마지막 수정 뒤 실행) | migrations OK(34·2) · doc-inventory OK(링크 해석) · product-naming OK(2,227파일) · test-budgets OK(18) · lint 0 error · 2 warning(변경 전과 같은 `Timeline.tsx`·`useTranscriptVirtualizer.ts`) · lint 뒤 트리 변화 0 · typecheck 3종 exit 0 · `node --test` 868/868 · vitest 944파일 중 실패 68파일·320케이스 · 통과 8,386(기준선 8,376 + 새 케이스 10). 실패 식별자 347행이 기준선(`098acf8`)과 같다(`comm` 양방향 0) — 서명: sqlite 바인딩 162 · Electron 미설치 3 · `C:/` 경로 21 · 기준선과 같은 타임아웃 1 |
| **추가·수정 테스트의 subtree 규칙** | `git diff --name-only 354fe8a..HEAD -- '*.test.ts'` → 6파일. 추가 줄의 시간 예산·호스트·풀 신호(`timeout`·`setTimeout`·`scaleMs`·`child_process`·`spawn(`·`runGit`·`createRepo`·`better-sqlite3`·`process.env`·`HOME`·`FORCED_IO`·가짜 시계·`Date.now`) 0건 · `check-test-budgets` OK · vitest 출력 `[test-pools]` 0건 · 6파일 모두 실패 목록 밖 |
| V-pair 자기확인 | `SELF_PASS 9 / SELF_BLOCKED 1`(VP-10 — AC12 실기) |
| 강제 지점 전수 | 37/37 (EP-01 4 · EP-02 5 · EP-03 2 · EP-04 7 · EP-05 3 · EP-06 5 · EP-07 5 · EP-08 3 · EP-09 3) |
| **AC 자기보고**(`Criteria-Met`) | AC1 ✅ T-01 green·m01~m05·s01 red · AC2 ✅ T-02 2건·m06~m11 red · AC3 ✅ m12·m13 red · AC4 ✅ EP-04 집합 0·n01~n07·n13·s02·s03 red · AC5 ✅ EP-05 필드 3·t01·t02 red · AC6 ✅ T-06·n08~n12·n14 red · AC7 ✅ T-07 4건·c01~c05·s05 red · AC8 ✅ T-08a·T-08b·c06~c08 red · AC9 ✅ EP-09 1·0·2·g01·g03 red · AC10 ✅ (a) M1 −4 · M2 −13 · M3 −42 · 7건 −59 · M4 +9 (b) prod hunk 26개가 §10 자리·주석·import에만 (c) 커밋 4개의 prod 파일이 묶음 것뿐 (d) 삭제된 `it(` 0 · AC11 ✅ 위 게이트 · AC12 ⚠️ 사람 실기 대기 |
| **합계 검산** | `✅ 11 · ⚠️ 1 · ❌ 0 = 총 12` — 분모 12는 plan §7과 같다 |
| 블로커 / 역질문 | 없음. AC12는 사람 실기(§19 (a)~(f)) |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만 (r1)

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 해당 없음(첫 라운드).
- 그것을 막았어야 할 plan 지침·AC가 있었는가: 해당 없음 — 설계 시점에 시제품·변이로 못 잡던 10건을 먼저 찾아 plan에 테스트로 넣었고, 구현 sweep에서 새 못 잡음 0.
- 반복해서 부딪히는 환경 한계: Electron 바이너리·sqlite 네이티브 바인딩 부재(egress 차단) — vitest 실패 68파일은 변경 전과 같은 집합. AC12 실기를 이 환경에서 못 한다.
- 현재 라운드·impl 턴: `r1`.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

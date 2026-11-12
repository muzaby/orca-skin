# Plan — 0313-subagent-summary-single-derivation

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력은 [0305 감사](../0305-code-bloat-audit/audit.md) §3 C-34 · §8 C-34 2단계와 2026-11-12 사용자 결정(§2)이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0313-subagent-summary-single-derivation` |
| 작성자 | Claude Code |
| 일자 | 2026-11-12 |
| 매핑 | 0305 분할안 H-H(C-34) 가운데 2단계(구 모델 계산 시점)와 그 계산의 중복 |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` — 0231의 백그라운드 타일 V를 상속하지 않는다(화면 계약은 §7 AC3·AC4가 기존 테스트로 다시 닫는다) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 주체 | Claude (비기능 작업 — root `AGENTS.md` 협업 워크플로우) |
| 조사 기준 커밋 | `554959d` (`git cat-file -t` → commit · PR 브랜치 좌표, `main` 조상 아님 — `git rev-list --left-right --count origin/main...HEAD` → `0 40`) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 서브에이전트 요약(`subagentTasksFromMessages`)은 세션의 모든 파트를 도는 파생인데, 화면에 뜬 소비처마다 따로 계산한다. 백그라운드 타일은 정본 모델로 그리는 세션에서도 구 모델 요약을 먼저 계산하고 버린다.
- 완료 후 달라지는 것: 같은 메시지 배열의 요약은 한 번만 계산된다. 정본으로 그리는 타일은 구 모델 계산과 구 모델 전용 구독을 하지 않는다. 구 모델 표시는 한 파일에 모인다.
- 성공을 사용자 관점에서 한 문장으로: 화면은 한 글자도 달라지지 않고, 에이전트 행이 많은 긴 대화에서 스트리밍 중 계산량이 준다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "305진단 결과를 바탕으로 최적화 작업을 이어갈 것이다. 현재 306~312까지 진행됐다. 이어서 작업하라." | 라이브 세션 턴 1 |
| 명시 요구 | "실기는 모든 요소 최적화 후 사람이 한번에 진행할 예정이다." | 턴 2 |
| 명시 요구 | "C19 중간안은 현재와 다를 바가 없다. 화면 정책을 포함, 사용자 경험이 변경되는 것은 무엇이든 허용할 수 없다." | 턴 5 |
| 명시 요구 | "또한 단순 test감소 접근도 허용할 수 없다." | 턴 5 |
| 명시 요구 | "305 기반 리책토링 최적화의 필수조건은 퍼포먼스 유지 혹은 향상, 구조적 확장 용이가 필수 조건이다. 이러한 배경에서 plan 작성을 진행하라" | 턴 5 |
| 상속 | 회귀 금지 · 백그라운드/서브 에이전트 금지 · 단계마다 커밋 | 0305 plan D-003 · D-006 · D-007 |
| 추론 의도 | 남은 후보 가운데 턴 5의 세 조건(경험 불변 · 성능 유지/향상 · 확장 용이)을 모두 만족하는 것을 설계자가 고른다 — 사용자가 범위를 지정하지 않고 plan 작성을 지시했다 | 턴 5 · §4 |
| 추론 의도 | 채택 기준은 줄 수가 아니라 턴 5의 두 필수조건이다. 줄 수는 보고만 한다 | 턴 5 "필수조건은 …" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 사용자 경험이 달라지는 변경은 하지 않는다. 화면 정책(무엇을 언제 보이는가)도 포함한다 | "화면 정책을 포함, 사용자 경험이 변경되는 것은 무엇이든 허용할 수 없다" | 턴 5 | ACTIVE | — |
| D-002 | C-19(renderer 대기 예약 판정 제거)는 중간안까지 하지 않는다 | "C19 중간안은 현재와 다를 바가 없다" · D-001 | 턴 5 | ACTIVE | 0311 D-008을 확정 |
| D-003 | 0312 D-008(오류 종료 때 압축 요약 표시)은 하지 않는다 | 요약 메시지가 새로 보인다 — D-001 | 턴 5 · 설계자 적용 | ACTIVE | 0312 D-008 유지 |
| D-004 | 테스트를 줄이는 것 자체를 목표로 삼지 않는다. 테스트는 잠그는 동작이 사라질 때만 준다 | "단순 test감소 접근도 허용할 수 없다" | 턴 5 | ACTIVE | — |
| D-005 | 0305 기반 변경의 필수조건은 둘이다 — 성능 유지 또는 향상 · 구조적 확장 용이 | "퍼포먼스 유지 혹은 향상, 구조적 확장 용이가 필수 조건이다" | 턴 5 | ACTIVE | 0305 D-011("목표는 코드 감량")에 조건을 더한다 |
| D-006 | 사람 실기는 모든 최적화가 끝난 뒤 한 번에 한다. 이 handoff의 실기 항목은 그 목록에 넣고 진행을 막지 않는다 | "실기는 모든 요소 최적화 후 사람이 한번에 진행할 예정이다" | 턴 2 | ACTIVE | — |
| D-007 | 회귀 금지. 백그라운드·서브 에이전트를 쓰지 않는다. 단계(M1·M2)마다 커밋을 남긴다 | 0305 D-003 · D-006 · D-007 | 0305 plan §3 | ACTIVE | — |
| D-008 | 구현 대상은 셋이다 — (a) 요약 파생을 메시지 배열당 한 번만 계산 (b) 백그라운드 타일이 정본으로 그릴 때 구 모델 계산·구독을 하지 않음 (c) 구 모델 상세의 child 메시지 조회를 메모 | 남은 후보 중 D-001·D-005를 함께 만족하는 것이 이것이다(§4). 근거는 §8 | 설계자 조사 | ACTIVE | 사용자가 되돌리면 ΔV |
| D-009 | 구 모델 표시(목록·상세·헤더)는 전부 남긴다 | 걷으면 0231 이전 세션의 작업 표시가 달라진다 — D-001. 0231의 "과거 표시 fallback" 결정과 0307 D-004 보류를 그대로 둔다 | 턴 5 · 0307 D-004 | ACTIVE | — |
| D-010 | main의 `hasCanonical` 스위치(C-34 3단계)와 C-26은 하지 않는다 | 구 추적(`BackgroundTaskTracker.started`·`settled`)은 정본이 없는 세션에서 동작하는 경로다(`background-tasks.ts:84,97,109`). 실 어댑터에서 닿지 않는다는 것을 이 턴에 증명하지 못했고 성능 이득이 없다 | 설계자 조사 | ACTIVE | 0307 D-009 유지 |
| D-011 | C-23 · C-29 잔여 · `classifyAppCommand` · C-33은 이번 범위가 아니다 | C-23은 컴포넌트가 reducer 내부 액션을 보낼 수 있게 한다 · C-29 잔여는 가드를 약하게 한다 · `classifyAppCommand`는 확장 자리다(`provider-runtime.md:588`) — 셋은 D-005의 확장 조건에 맞지 않는다. C-33은 0307 D-004 보류가 유지된다 | 설계자 판단 | ACTIVE | 사용자가 고르면 새 handoff |
| D-012 | 요약 파생의 반환 타입은 `readonly SubagentTaskSummary[]`다 | 결과를 여러 소비처가 함께 든다. 한 곳이 배열을 고치면 다른 화면이 바뀐다 — 타입이 막는다 | 설계자 판단 | ACTIVE | — |
| D-013 | 캐시 키는 메시지 배열의 identity이고 `includeNested` 값마다 따로 든다. 저장은 `WeakMap`이다 | 소비처가 이미 `useMemo([messages])`로 identity를 무효화 기준으로 쓴다(§8). `WeakMap`은 배열이 버려지면 함께 사라져 상한이 필요 없다 | 설계자 판단 | ACTIVE | — |
| D-014 | 구 모델 표시 컴포넌트를 새 파일 `LegacySubAgentTile.tsx`로 옮긴다 | 타일 파일은 "어느 모델로 그릴지"만 고르고 모델별 표시는 파일 하나씩이 된다(D-005 확장 조건). 한 파일에 두면 컴포넌트가 6개다(`renderer/AGENTS.md` 분해 가이드) | 설계자 판단 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-014.
- 변경된 결정: 0305 D-011("목표는 코드 감량")은 유지하되 D-005가 필수조건을 더한다. 이 handoff는 줄 수를 합격 기준으로 쓰지 않는다(§2 추론 행).
- 유지되는 이전 결정: 0307 D-004(C-33·C-34 보류) · 0231 구 모델 표시 fallback · 0305 D-003·D-006·D-007.
- D-008·D-010·D-011은 사용자가 범위를 지정하지 않은 상태에서 설계자가 고른 것이다. 완료 보고에서 사용자에게 알린다.
- `ACTIVE 결정 ↔ AC` 대조: 충돌 0.
  - D-001·D-009 ↔ AC2·AC3·AC4: 세 행 모두 "변경 전과 같은 출력"을 요구한다. 표시를 바꾸거나 걷는 AC 없음.
  - D-004 ↔ AC1~AC4: 기존 테스트를 지우는 행 없음 — 신규 케이스 7건을 더한다(§7-A).
  - D-005 ↔ AC1·AC2·AC5: AC1·AC2가 계산 횟수를, AC5가 구조(모델별 파일 · 타입)를 본다.
  - D-006 ↔ AC8: 실기 항목이고 판정을 막지 않는다고 적었다.
  - D-010·D-011 ↔ §7: `rg 'hasCanonical\?|chatActions|classifyAppCommand|api/ipc' §7` → 0건.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | 파생이 소비처마다 도는 원인은 메모가 컴포넌트 인스턴스 단위라는 것이다(`AgentTaskRow.tsx:48-51`). `parts.ts:271-274` 주석이 같은 비용을 0149에서 한 소비처만 고쳤다고 적는다 |
| 이미 기존 코드가 충족하는가 | 아니다 | 공유 캐시 없음 — `rg -n "WeakMap" app/src/renderer/src/features/chat/lib/parts.ts` → 0건 |
| 더 작은 해법이 있는가 | (b)만 하면 타일은 줄지만 transcript 행의 중복이 남는다. (a)만 하면 정본 타일이 여전히 계산 1회와 구독 5개를 든다 | §14 표 |
| 선행 자료의 주장을 코드와 대조했는가 | 감사 C-34 "구 모델 계산 :87 :171 이 스위치보다 먼저 돈다" — 일치(지금은 `:89-95`·`:171-174`가 `:97`·`:181`보다 앞) | `SubAgentTileContent.tsx` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 없다 | 구 모델 표시를 남긴다(D-009). `state.md`의 `chatActions` 규칙을 건드리지 않는다 |

- 사용자에게 올릴 결정: 없음 — 범위 선택(D-008·D-010·D-011)은 완료 보고로 알린다.
- 코드 조사로 닫은 사실:
  - 남은 A 항목 가운데 D-001에 걸리는 것은 C-19 · 0312 D-008 · C-34 4단계다.
  - `createdAtMs`의 `Date.now()` 폴백(`parts.ts:331`)은 닿지 않는다 — 요약을 만드는 조건(`:321-325`)이 `createdAtByRun`을 채우는 조건(`:304`)의 부분집합이다. 캐시해도 값이 달라지지 않는다.

## 5. 동작 / 사용자 흐름

화면 동작은 바뀌지 않는다. 아래는 변경 전후 같은 결과를 내야 하는 흐름이다.

| 상황 | 화면(변경 전 = 변경 후) |
|---|---|
| 정본 상태가 있는 세션의 백그라운드 타일 | `CanonicalBackgroundContent`의 목록·상세, 헤더는 선택 항목 제목 또는 "백그라운드 작업" |
| 정본 상태가 없거나 비어 있는 세션의 타일 | 구 모델 목록(진행 중·완료 그룹), 선택하면 구 모델 상세, 헤더는 뒤로가기 + 작업 설명 |
| 구 모델에서 지운 완료 항목을 선택 상태로 다시 열기 | 상세·뒤로가기 헤더가 뜨지 않는다 |
| transcript의 에이전트 행 · 인라인 상세 | 상태·모델·도구 수·경과가 지금과 같다 |
| OpenCode 우측 패널의 에이전트 목록 | 지금과 같다 |

### 상태와 전이

| 전이 | 변경 전 | 변경 후 |
|---|---|---|
| 세션에 첫 정본 이벤트가 도착 | 같은 컴포넌트가 다른 요소를 돌려줘 구 모델 화면이 내려가고 정본 화면이 올라온다 | 구 모델 컴포넌트가 내려가고 정본 컴포넌트가 올라온다 — 화면 결과 같음 |
| 메시지 커밋(배열 identity 변경) | 소비처마다 요약을 다시 계산 | 첫 소비처가 계산하고 나머지는 그 결과를 읽는다 |

### 파생 UX / 엣지케이스

- 구 모델 컴포넌트에는 지역 상태가 없다(`useMemo`뿐) — 모델 전환 때 잃는 상태가 변경 전과 같다.
- 같은 배열을 `includeNested`가 다른 두 소비처가 읽으면 결과는 서로 다른 배열이다.

## 6. 범위 / 비범위

- **범위**: `lib/parts.ts`의 요약 파생 캐시와 반환 타입 · `SubAgentTileContent.tsx`의 모델 선택 · 새 파일 `LegacySubAgentTile.tsx` · `SubAgentTaskList`를 import하는 테스트 5파일의 경로 · 신규 테스트 · `design-components.md:231` 한 행 · `taskBoard.ts:9` 주석.
- **비범위**: 구 모델 표시의 내용(D-009) · main `hasCanonical` 스위치와 C-26(D-010) · C-19·0312 D-008(D-002·D-003) · C-23·C-29 잔여·`classifyAppCommand`·C-33(D-011) · `childMessageForParentToolRunId`·`persistedBackgroundModels`·`transcriptResultsByToolUseId`의 공유 캐시 · `ChatState`의 구 모델 id 배열.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| child 메시지·정본 보조 파생의 공유 캐시 | 아니오 | 같은 방식으로 더할 수 있다 — 이번에는 소비처가 1~2곳이라 하지 않는다 |
| C-34 3·4단계 · C-33 | 아니오 | 사용자 결정 뒤 새 handoff |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AC1 | 같은 메시지 배열과 같은 `includeNested`로 요약을 다시 구하면 처음 만든 배열을 그대로 받는다. 배열이 바뀌거나 `includeNested`가 다르면 새로 계산한 결과를 받는다 | `parts.test.ts` 신규 3건 — 반환 배열의 동일성(`toBe`)과 내용(§10 K1~K3) | `ChatState.messages` → `subagentTasksFromMessages` ← 소비처 5자리 |
| R-02 | AC2 | 정본으로 그리는 세션에서 백그라운드 타일의 본문과 헤더는 구 모델 요약과 child 메시지를 계산하지 않는다 | 신규 2건 — 계산 함수 호출 0회와 정본 마크업(§10 T1·T4) | `useBackgroundStore.sessions[id]` → `SubAgentTileContent`·`SubAgentTileHeader` |
| R-03 | AC3 | 정본이 없거나 비어 있는 세션에서 타일 본문과 헤더의 출력이 변경 전과 같다 | 기존 5건 + 신규 2건(§10 T2·T3·T5·T6) | 같은 경로 → `LegacySubAgentContent`·`LegacySubAgentHeader` |
| R-04 | AC4 | 요약을 읽는 다른 소비처(`AgentTaskRow` · `InlineSubagentDetail` · OpenCode `sessionPanelModel`)의 출력이 변경 전과 같다 | 기존 테스트 회귀(§7-A VP-04) | `ChatState.messages` → 각 소비처 |
| R-05 | AC5 | 요약 결과를 받은 쪽이 배열을 고치는 코드는 컴파일되지 않는다. 구 모델 표시 컴포넌트는 `LegacySubAgentTile.tsx` 한 파일에 있다 | `gate:npm run typecheck` · §10 EP-03 검색 | 해당 없음 |
| R-06 | AC6 | §19 게이트가 green이거나 실패가 기준선과 같은 환경 서명이다 | §19 명령 산출 | CI |
| R-07 | AC7 | prod·test 줄 수 변화를 보고한다. 합격 기준이 아니다(D-005) | `git diff --numstat <설계 커밋>..HEAD -- app/src` | 해당 없음 |
| R-08 | AC8 | 개발 빌드에서 백그라운드 타일(정본·구 모델)과 에이전트 행이 그대로다 | 사람 실기 — 일괄 실기 목록(D-006). 판정을 막지 않는다 | 실제 앱 |

### AC 검증 주의사항

- 기존 테스트 재사용: 인용한 케이스는 이번 세션에 `rg`로 실재를 확인했다 — `CanonicalBackgroundContent.wiring.test.ts:143,180,280` · `rightPanelTiles.render.test.ts:210` · `subagentWiring.render.test.ts:52,62,68`.
- 기대값의 출처: AC3의 신규 2건은 변경 전 코드(`554959d`)에서 먼저 green임을 확인한 뒤 구현한다.
- AC2의 호출 횟수는 구조 대리가 아니라 목표 자체다 — 요구가 "계산하지 않는다"이다. 화면이 같다는 것은 같은 케이스의 마크업 단언이 본다.
- AC1의 동일성 단언은 "다시 계산하지 않았다"의 직접 관측이다 — 계산은 매번 새 배열을 만든다(`parts.ts:318`).
- 사람 실기 항목: AC8. 로직은 AC1~AC4가 기계로 본다.
- 0건 기준: 없음.

## 7-A. V / Trace Matrix

- V mode 판정: Baseline V — 상속할 코드 계약 V가 없다.
- `SUPERSEDED` pair 이관: 해당 없음.
- 필요한 레벨: 모듈 불변식(`MD↔UT` — 캐시) · 조립 경계(`AR↔IT` — 타일의 모델 선택) · 사용자 결과(`R↔AT`). `SD↔ST`는 두지 않는다 — 수명주기·종단 경로가 바뀌지 않는다.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-08 | R | §7 각 행 | NEW | — |
| AT-01~AT-08 | AT | §7 검증 수단 칸 | NEW | — |
| MD-01 | MD | §10 요약 캐시 규칙 K1~K3 | NEW | — |
| AR-01 | AR | §10 타일 모델 선택 규칙 T1~T6 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01·MD-01 ↔ AT-01 | REQUIRED | `ChatState.messages` → `subagentTasksFromMessages(messages, includeNested)` → 캐시 조회/계산 → 소비처 | §10 K1~K3 — `parts.test.ts` 신규 3건 | required — 캐시는 "덜 계산"이 목표라 방향을 따로 본다. 변이: (a) 캐시 저장 제거 → K1 red (b) `includeNested` 구분 제거(두 변형이 한 칸) → K2 red (c) 키를 배열이 아닌 모듈 단일 칸으로 → K3 red | EP-01 (5자리) |
| VP-02 | R-02·R-03·AR-01 ↔ AT-02·AT-03 | REQUIRED | `useBackgroundStore.sessions[id]` → `SubAgentTileContent`·`SubAgentTileHeader`의 모델 선택 → `CanonicalBackgroundContent`·정본 헤더 / `LegacySubAgentContent`·`LegacySubAgentHeader` | §10 T1~T6 | required — 두 분기가 형제다. 변이: (d) 본문 선택 조건을 `canonical` 존재만으로 → T2 red (e) 본문 두 분기 맞바꿈 → T1·T2 red (f) 헤더 두 분기 맞바꿈 → T4·T5 red (g) 구 모델 요약 계산을 선택 컴포넌트로 되올림 → T1 red (h) 구 모델 본문에서 `projectLegacyBackgroundPanel` 제거 → T6 red | EP-02 (2자리) |
| VP-03 | R-05 ↔ AT-05 | REQUIRED | 소스 트리 | `gate:npm run typecheck` · EP-03 검색 | not selected — 타입과 파일 위치의 검사이고 동작 짝이 VP-01·VP-02다 | EP-03 (3자리) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `ChatState.messages` → `AgentTaskRow`·`InlineSubagentDetail`·`sessionPanelModel` → 화면 | 기존 테스트: `parts.test.ts`의 `subagentTasksFromMessages` 케이스(`:201,278,316,342,410`) · `rightPanelTiles.render.test.ts` · `taskSurface0212.render.test.ts` · `harnesses/opencode/rightpanel/activity.integration.test.ts` | not selected — 소비처 코드는 타입 한 곳 외에 바뀌지 않는다 | EP-01 중 3자리 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/src/renderer/**` 수정 | §19 | 이번 변경이 만진 파일에서 난 실패와 기준선 밖 실패만 blocking |
| 테스트 풀·예산 가드 | 테스트 파일을 추가·수정한다 | `[test-pools]` · `node scripts/check-test-budgets.mjs` | 만진 파일의 위반만 blocking |
| 문서 인벤토리·이름 검사기 | `design-components.md`를 고치고 새 소스 파일을 만든다 | `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` | 전부 blocking |
| lint boundaries · no-cycle | 파일을 나눈다 | `npm run lint` | 전부 blocking |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 대상 | 검색 | N | 의미 |
|---|---|---|---|
| 요약 파생 호출 자리 | `rg -n "subagentTasksFromMessages\(" app/src/renderer/src -g '!*.test.*'` | 6줄(정의 1 + 호출 5) | 호출: `SubAgentTileContent.tsx:90,172` · `AgentTaskRow.tsx:49` · `InlineSubagentDetail.tsx:27` · `opencode/rightpanel/model.ts:36` |
| 파생의 비용 | `parts.ts:293-338` | — | 전 파트 `flatMap` 1회 + `Map` 4개 + 순회 4회 |
| 타일의 모델 선택 자리 | `rg -n "hasCanonicalBackground\(" app/src/renderer/src -g '!*.test.*'` | 3줄(정의 1 + 사용 2) | `SubAgentTileContent.tsx:97`(헤더) · `:181`(본문) |
| 본문이 선택 전에 하는 일 | `SubAgentTileContent.tsx:157-179` | 구독 7 · 계산 2 | `messages`·`agentKind`·`selectedSubagentTaskId`·중단 대기·일시정지·백그라운드 전환·`taskStopErrors` 구독, 요약 계산(`:171`), child 메시지 조회(`:176`, 메모 없음) |
| 헤더가 선택 전에 하는 일 | `SubAgentTileContent.tsx:84-95` | 구독 2 · 계산 1 | `messages`·`selectedSubagentTaskId`, 선택이 있으면 요약 계산 |
| 메시지 상태의 제자리 변경 | `rg -n "parts\.push\(\|messages\[[^\]]+\] ?=[^=]" reducer store lib -g '!*.test.*'` | 1줄 | `parts.ts:262` — 지역 배열에 넣는 줄이다. 상태 배열을 고치는 자리 없음 |
| 요약 결과를 고치는 소비처 | 호출 5자리 읽기 | 0 | `.find` 3 · `.map` 1 · `projectLegacyBackgroundPanel`(filter) 2 |
| `SubAgentTaskList` import | `rg -l "SubAgentTaskList" app/src` | 6파일 | 정의 1 + 테스트 5 |
| 문서의 타일 파일 언급 | `rg -n "SubAgentTileContent" docs --glob '!docs/handoff/**' --glob '!docs/archive/**'` | 1줄 | `design-components.md:231` |

### 전수 조사

- 요약 호출 5자리는 위 검색 출력과 차집합 0이다.
- `messages` identity가 무효화 기준이라는 전제는 소비처 3곳의 `useMemo` 의존 배열이 이미 쓴다(`AgentTaskRow.tsx:50` · `InlineSubagentDetail.tsx:28` · `SubAgentTileContent.tsx:173`).
- 테스트의 메시지 시드는 새 배열을 대입한다(`subagentWiring.render.test.ts:45` · `CanonicalBackgroundContent.wiring.test.ts:183`) — 캐시가 이전 시드를 돌려주지 않는다.

### 수치 / 전칭 표현 검산

- "소비처 5자리" = 타일 2 + `AgentTaskRow` 1 + `InlineSubagentDetail` 1 + OpenCode 모델 1.
- "구독 7"(본문) = `:157,158,159,161,164,165,169`. `:153,155,156`의 `sessionId`·`panel`·`canonical`은 선택에 쓰이므로 세지 않았다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
ChatState.messages ──┬─ AgentTaskRow × R        → 각자 useMemo → 전 파트 순회
                     ├─ InlineSubagentDetail × I → 각자 useMemo → 전 파트 순회
                     ├─ SubAgentTileHeader       → (선택 있으면) 전 파트 순회 → 정본이면 버림
                     ├─ SubAgentTileContent      → 전 파트 순회 + child 조회 + 구독 7 → 정본이면 버림
                     └─ sessionPanelModel        → 전 파트 순회
```

### TO-BE

```text
ChatState.messages ── subagentTasksFromMessages ── WeakMap<배열, [최상위?, 중첩 포함?]>
                          ▲ 소비처 5자리가 같은 결과를 읽는다

SubAgentTileContent  ── 정본 여부(boolean selector) ─┬─ CanonicalBackgroundContent
                                                     └─ LegacySubAgentContent   (구독·계산은 여기서만)
SubAgentTileHeader   ── 정본 여부 ─┬─ 정본 헤더(같은 파일)
                                   └─ LegacySubAgentHeader
```

### AS-IS → TO-BE Delta

| 항목 | AS-IS | TO-BE |
|---|---|---|
| 요약 계산 | 소비처 인스턴스마다 | 배열·변형당 1회 |
| 정본 타일의 구 모델 계산 | 본문 1회 + child 조회 + 헤더 0~1회 | 0 |
| 정본 타일 본문의 구 모델 구독 | 7 | 0 |
| 구 모델 상세의 child 조회 | 렌더마다 | `useMemo([messages, selectedId])` |
| 구 모델 표시 코드 위치 | 타일 파일에 섞여 있음 | `LegacySubAgentTile.tsx` |

### 핵심 책임 분리

| 모듈 | 책임 | import 방향 |
|---|---|---|
| `lib/parts.ts` | 요약 파생과 그 캐시(SSOT) | lib 내부 |
| `SubAgentTileContent.tsx` | 어느 모델로 그릴지 선택 · 정본 헤더 | → `CanonicalBackgroundContent` · `LegacySubAgentTile` |
| `LegacySubAgentTile.tsx` | 구 모델 본문·헤더·목록 View | → lib · store · common (타일 파일을 import하지 않는다) |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-01·VP-04 — EP-01 | 요약은 `subagentTasksFromMessages`로만 얻는다 | `lib/parts.ts` | 구현자 | 5자리: `SubAgentTileContent.tsx:90,172`(이동 뒤 `LegacySubAgentTile.tsx`) · `AgentTaskRow.tsx:49` · `InlineSubagentDetail.tsx:27` · `opencode/rightpanel/model.ts:36` | `rg -n "subagentTasksFromMessages\(" app/src/renderer/src -g '!*.test.*'` → 정의 1 + 호출 5 | 캐시가 빠지면 화면은 같고 계산만 는다 — 게이트는 K1로만 red다. 캐시가 낡은 값을 주면 화면이 틀린다 — K3과 VP-04 기존 테스트가 본다 |
| AR-01 / VP-02 — EP-02 | 정본 여부 판정은 `hasCanonicalBackground` | `lib/canonicalBackground.ts:267` | 구현자 | 2자리: 타일 본문의 선택 · 타일 헤더의 선택 | `rg -n "hasCanonicalBackground\(" app/src/renderer/src -g '!*.test.*'` → 정의 1 + 사용 2 | 분기가 뒤바뀌면 다른 모델의 화면이 뜬다 — T1·T2·T4·T5 |
| VP-03 — EP-03 | 요약 결과는 읽기 전용 · 구 모델 표시는 한 파일 | `parts.ts` 반환 타입 · `LegacySubAgentTile.tsx` | 구현자 | 3자리: 반환 타입 1 · `SubAgentTaskList`의 `tasks` prop 타입 1 · 구 모델 요약을 부르는 파일 1 | `rg -n "SubagentTaskSummary\[\]" app/src/renderer/src -g '!*.test.*'` → 파생 안의 지역 누적 배열 1줄(`parts.ts:318`)을 뺀 전부가 `readonly` · `rg -l "projectLegacyBackgroundPanel\(" app/src/renderer/src/features/chat/harnesses -g '!*.test.*'` → `LegacySubAgentTile.tsx` 1파일 | 타입을 빼도 지금 소비처는 고치지 않으므로 동작은 같다 — 막는 것은 앞으로의 실수다 |

규칙 칸 ↔ UT 입력 칸:

| 규칙 | 분기 | 입력 | 기대 | 좌표 |
|---|---|---|---|---|
| K1 캐시 적중 | 같은 배열 · 같은 `includeNested` | 에이전트 호출 1건이 든 배열 `m`으로 두 번 호출(기본값) | 두 반환이 `toBe` 같다 | `parts.test.ts` 신규 "같은 메시지 배열의 요약은 한 번만 만든다" |
| K2 변형 구분 | 같은 배열 · `includeNested` 다름 | 최상위 에이전트 1 + 그 child 에이전트 1이 든 배열로 `false`·`true`·`false`·`true` 순 호출 | `false` 결과 길이 1 · `true` 결과 길이 2 · 같은 변형끼리 `toBe` 같다 | 신규 "중첩 포함 여부마다 따로 든다" |
| K3 무효화 | 다른 배열 | `m`과, 결과 파트 1개를 더한 새 배열 `m2` | `m2` 결과가 `m` 결과와 `toBe` 다르고 상태가 `completed`(`m`은 `running`) | 신규 "메시지 배열이 바뀌면 새로 계산한다" |
| T1 본문 · 정본 | 정본 상태에 호출·작업이 있다 | 정본 상태(`callState`+`withTask`) + 구 모델 에이전트 파트가 든 메시지 + `selectedSubagentTaskId` 지정 | 요약·child 조회 호출 0회 · 마크업이 `CanonicalBackgroundContent` 단독 렌더와 같다 | `CanonicalBackgroundContent.wiring.test.ts` 신규 "정본으로 그릴 때 구 모델 요약을 계산하지 않는다" |
| T2 본문 · 정본 비어 있음 | 정본 view는 있으나 `emptyBackgroundState()` | 구 모델 에이전트 2건 | 구 모델 목록·그룹 조작 | 기존 `…wiring.test.ts:180` |
| T2′ 본문 · 정본 view 없음 | `sessions[id]` 없음 | 구 모델 에이전트 0건 / 1건 | 빈 상태 문구 / 중단 실패 문구 | 기존 `rightPanelTiles.render.test.ts:210` · `subagentWiring.render.test.ts:52,62,68` |
| T3 본문 · 구 모델 선택 | 지우지 않은 항목이 선택됨 | 에이전트 1건(설명 `legacy detail`) + child 파트 1개(텍스트 `child body`) · 선택 = 그 id | 상세가 뜨고 `child body`를 포함 · 목록 그룹 표식(`data-background-group`) 없음 | `…wiring.test.ts` 신규 "구 모델 선택은 상세와 child 대화를 그린다" |
| T4 헤더 · 정본 | 정본 상태 있음 · 구 모델 선택 id 남아 있음 | T1과 같은 시드 | 요약 호출 0회 · 뒤로가기 없음 · 기본 제목 | T1 케이스의 헤더 단언 |
| T5 헤더 · 구 모델 선택 | 지우지 않은 항목이 선택됨 | T3과 같은 시드 | `aria-label="목록으로"` 버튼과 `legacy detail` | T3 케이스의 헤더 단언 |
| T6 헤더·본문 · 지운 항목 선택 | 완료 항목을 지운 뒤 선택 | 기존 시드 | 상세·뒤로가기 없음 | 기존 `…wiring.test.ts:180`(`:219-220`) |

- 자리 목록은 위 검색 출력과 차집합 0이다(이번 세션 실행 — §8).
- T1·T4의 호출 횟수 관측: 테스트가 `lib/parts`를 `vi.mock`으로 감싸 실제 구현을 부르는 `vi.fn`으로 둔다. 타일은 그 export를 부르므로 실행 구간 안이다.
- **선언 경계**:
  1. 정본 타일의 구독 수(7 → 0)와 렌더 횟수는 테스트로 잠그지 않는다 — SSR 렌더로는 관측되지 않고 변경 전에도 잠기지 않았다.
  2. 메시지 배열이나 그 안의 파트를 제자리에서 고치는 호출자는 다루지 않는다 — 트리에 그런 자리가 없다(§8, 1줄은 지역 배열).
  3. `createdAtMs`의 `Date.now()` 폴백은 닿지 않는 줄이라 캐시된 시각의 의미를 정하지 않는다(§4).
  4. `SubAgentTaskList` 안의 `projectLegacyBackgroundPanel` 재적용(`:230`)은 그대로 둔다 — View를 직접 렌더하는 테스트 4파일이 그 자리에 기대고, 이미 거른 목록에는 같은 결과다.
  5. `childMessageForParentToolRunId`의 메모(D-008 c)는 호출 횟수를 잠그지 않는다 — 결과는 T3이 본다.
- 열린 입력 집합을 판정하는 산출물: 해당 없음.
- 같은 규칙이 여러 레이어에 있는가: 정본 여부는 `hasCanonicalBackground` 한 곳, 요약은 `subagentTasksFromMessages` 한 곳.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

커밋 단위는 둘이다(D-007): **M1** 요약 캐시와 타입(AC1·AC4·AC5 일부) · **M2** 타일 모델 선택과 파일 분리(AC2·AC3·AC5).

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `lib/parts.ts` | 요약 파생 | 지금 본문을 비공개 `deriveSubagentTasks`로 두고, export 함수는 `WeakMap<readonly Message[], [top?, nested?]>`에서 변형 칸을 읽어 없으면 계산해 넣는다. 반환 타입 `readonly SubagentTaskSummary[]`. 매개변수도 `readonly Message[]` | `parts.test.ts` |
| `harnesses/claude/rightpanel/LegacySubAgentTile.tsx`(신규) | 구 모델 표시 | `LegacySubAgentContent`(지금 `:157-204`의 구독·계산·분기, child 조회는 `useMemo`) · `LegacySubAgentHeader`(지금 `:84-95,125-146`) · `SubAgentTaskList`·`STATUS_KEY`·`stopErrorText`·`EMPTY_IDS`를 옮긴다. `tasks` prop은 `readonly` | 기존 5파일 + `…wiring.test.ts` |
| `harnesses/claude/rightpanel/SubAgentTileContent.tsx` | 모델 선택 | 본문: `useBackgroundStore`에서 정본 여부 boolean만 구독해 두 컴포넌트 중 하나를 돌려준다. 헤더: 같은 판정으로 정본 헤더(지금 `:97-123`, 같은 파일의 비공개 컴포넌트) 또는 `LegacySubAgentHeader` | `…wiring.test.ts` · `…render.test.ts` |
| `store/backgroundStore.ts:58` · `lib/canonicalBackground.ts:116` | — | 이미 `readonly`를 받는다. 반환 타입만 필요하면 맞춘다 | — |
| 테스트 5파일 | — | `SubAgentTaskList` import 경로를 새 파일로 | — |
| `lib/taskBoard.ts:9` · `docs/arch/frontend/design-components.md:231` | — | 파일 이름 갱신 · 카탈로그에 새 파일 행 | — |

- 정본 여부 selector는 `(s) => { const v = sessionId ? s.sessions[sessionId] : undefined; return v !== undefined && hasCanonicalBackground(v.state) }` 꼴이다. boolean이라 정본 상태가 갱신돼도 선택 컴포넌트는 다시 그리지 않는다.
- 정본 헤더는 지금처럼 `canonical`·`panel`을 직접 구독한다.
- 신규 컴포넌트는 기존 마크업을 그대로 옮긴다 — 클래스·문구·요소 순서를 바꾸지 않는다(D-001).

### 테스트 가능성

- 캐시는 export 함수의 반환 동일성으로 관측한다. 캐시 자료구조를 export하지 않는다.
- T1·T4는 `CanonicalBackgroundContent.wiring.test.ts`의 `seed`·`render`를 그대로 쓴다. `lib/parts` mock은 파일 상단에 더하고 실제 구현을 통과시킨다 — 기존 케이스의 동작이 바뀌지 않는다.
- 새 테스트는 자식 프로세스·DB를 쓰지 않는다(unit 풀).

## 12. End-to-end 영향

### producer → consumer

| producer | 값 | consumer | 변경 |
|---|---|---|---|
| `chatReducer` | `ChatState.messages`(불변 갱신) | 요약 파생 | 없음 — identity를 키로 읽는다 |
| 요약 파생 | `readonly SubagentTaskSummary[]` | 소비처 5자리 | 타입만 |
| `backgroundStore` | `sessions[id].state` | 타일의 모델 선택 | 판정식 동일, 구독 모양만 boolean |

### 부팅/등록/초기화 변경 시 기존 소비처

- `tileRegistry.ts`는 `SubAgentTileContent`·`SubAgentTileHeader`를 그대로 import한다 — 변경 없음.

## 13. Lifecycle / 오류 / 정리

- 캐시 항목은 메시지 배열이 가비지 수집되면 함께 사라진다. 세션 캐시 무효화(`invalidateSessionCache`)에 별도 정리가 필요 없다.
- 파생이 던지면 캐시에 넣지 않는다 — 계산 뒤에 저장한다.
- 모델 전환 때 구 모델 컴포넌트가 내려간다. 내려가는 지역 상태는 변경 전과 같다(§5).

## 14. 성능 / 상한 / 최적화

메시지 배열 identity가 한 번 바뀔 때 전 파트 순회 횟수(R = 화면에 뜬 `AgentTaskRow` 수, I = 열린 인라인 상세 수).

| 화면 | AS-IS | TO-BE |
|---|---|---|
| Claude · 타일 닫힘 | R + I | ≤ 2 |
| Claude · 정본 타일 열림 | R + I + 1(+1 선택 시) + child 조회 | ≤ 2 |
| Claude · 구 모델 타일 열림 | R + I + 1(+1 선택 시) + child 조회(렌더마다) | ≤ 2 + child 조회 1 |
| OpenCode 패널 | R + I + 1 | ≤ 2 |

- 상한 2는 변형 수(`includeNested` false·true)다. 소비처 수와 무관하다.
- 잃는 부수 효과: 없음 — 파생은 순수하고(§4 폴백 제외) 결과를 고치는 소비처가 없다(§8).
- 메모리: 배열당 요약 배열 최대 2개. 배열이 살아 있는 동안만 든다.
- 확장: 새 소비처는 메모 배선 없이 함수를 부르면 된다. 표시 모델을 더하거나 걷을 때 고칠 자리는 선택 컴포넌트의 한 분기와 모델 파일 하나다.

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 결정/규칙 | 관계 |
|---|---|
| 0231 구 모델 표시 fallback | 유지(D-009) |
| 0307 D-004 C-33·C-34 보류 | 유지 — 이번 변경은 표시 범위를 바꾸지 않는다 |
| 0149 `subagentTaskDescription`(통지 행용 경량 조회) | 유지 — 요약 전체가 필요 없는 소비처다 |
| `renderer/AGENTS.md` 분해 가이드 | 따름(D-014) — 새 파일은 같은 하네스 디렉토리 |
| `renderer/AGENTS.md` 제작 계약 6 | 따름 — 카탈로그 행 갱신 |
| `import/no-cycle` | `LegacySubAgentTile.tsx`가 타일 파일을 import하지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| 어떤 테스트가 같은 배열을 고친 뒤 다시 요약을 구한다 | 전체 vitest로 찾는다. 나오면 테스트가 새 배열을 만들게 고친다(상태는 불변 갱신이 규칙) |
| `readonly` 전파로 타입 오류 | `typecheck` 3종. 소비처는 읽기만 한다(§8) |
| 파일 이동 중 마크업이 달라진다 | §18의 기존 SSR 테스트 6파일이 타일·목록 마크업을 본다 · 신규 T3·T5 |
| one-way door | 없음 — 저장·전송 형식이 바뀌지 않는다 |

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/lib/{parts.ts,taskBoard.ts}` · `harnesses/claude/rightpanel/{SubAgentTileContent.tsx,LegacySubAgentTile.tsx}`
- 테스트: `lib/parts.test.ts` · `harnesses/claude/rightpanel/CanonicalBackgroundContent.wiring.test.ts` · import 경로 5파일(`components/transcript/nonExecution.render.test.ts` · `harnesses/common/rightpanel/{subagentWiring,taskSurface0212,rightPanelTiles,BackgroundModelLabel}.render.test.ts`)
- 문서: `docs/arch/frontend/design-components.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md`(ABI · 제약 환경 · 로컬 확인) · `app/src/renderer/AGENTS.md`.
- 환경 제약: electron 바이너리가 없다. 0312 r1 verify의 기준선은 vitest 실패 식별자 320이고 차집합으로 분리한다.
- 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 가드: `node scripts/check-migrations-appendonly.mjs` · `node scripts/check-doc-inventory.mjs --check` · `node scripts/check-product-naming.mjs` · `node scripts/check-test-budgets.mjs`.
- 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"`.
- 사람 실기(AC8 — 일괄 실기 목록): (a) 백그라운드 에이전트를 띄운 세션의 타일 목록·상세·뒤로가기 (b) 0231 이전에 기록된 세션의 타일 목록·상세 (c) 에이전트 행이 여럿인 대화의 스트리밍 중 행 표시 (d) OpenCode 패널의 에이전트 목록.

## READY self-review

- [x] Decision Ledger가 여러 턴의 결정을 보존한다 — D-001~D-014, 0305 D-011·0307 D-004·0311 D-008·0312 D-008과의 관계 기입.
- [x] Part I만 읽어도 완료 상태가 이해된다 — §5 표 5행.
- [x] 조건절·이유절을 재해석하지 않았다 — §2에 턴 2·턴 5 원문 인용. 범위 선택은 추론 행으로 분리했다.
- [x] 사용자에게 물을 결정과 조사로 닫을 사실을 구분했다 — 범위는 지시("plan 작성을 진행하라")에 따라 설계자가 골라 D-008·D-010·D-011로 적었다.
- [x] 수치·전칭 표현·문서 앵커·기존 테스트 인용을 실측했다 — §8.
- [x] 저장소 규칙과 후보 표를 확인했다 — 분해 가이드 · no-cycle · unit 풀. 후보 표 6행 중 이번 파일과 겹치는 행 없음(0308 행은 `chatStore.ts`).
- [x] 각 AC가 행동 단언, 검증 수단, 도달 경로를 가진다 — §7 8행.
- [x] Baseline V다.
- [x] 모든 NEW node에 같은 레벨 REQUIRED pair가 있다 — MD-01은 VP-01, AR-01은 VP-02.
- [x] 영향받은 INHERITED node 없음.
- [x] 각 pair가 경로·§10 분모·자리별 좌표를 갖고, 적대 증거는 VP-01·VP-02만 선택했다.
- [x] 규칙 칸 분기마다 입력이 있다 — K1~K3 · T1~T6.
- [x] 선언 경계 5건을 근거와 함께 적었다. 새 검사기 없음.
- [x] 운영 gate 5행을 열거했다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — AC8은 시각 확인만.
- [x] semantic 목표를 structural proxy만으로 검증하지 않는다 — AC1·AC2 주의사항.
- [x] "X가 쓰인다" 불변식: 캐시 제거(a)·분기 맞바꿈(e)(f)·되올림(g)으로 본다.
- [x] 신규 모듈의 레이어·강제 지점·seam이 있다 — §9 책임 표 · §11.
- [x] producer/consumer를 확인했다 — §12.
- [x] worst-case와 one-way door를 적었다 — §14 · §17.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다 — 충돌 0.
- [x] 산출물 문장 규칙을 지켰다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> 필드와 표의 열은 [`plan.template.md`](../../../.agents/skills/handoff-plan/plan.template.md)의 `[구현자 기입]` 절을 그대로 쓴다.

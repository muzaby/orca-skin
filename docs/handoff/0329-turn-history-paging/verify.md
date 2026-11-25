# Verify — 0329-turn-history-paging

## 판정 — verify 2회째: **RETURN_TO_PLAN**

PLAN_GAP 2건(G1 · X1)이 있어 설계자가 먼저 정정한다. 검증 1의 D1~D9는 인용 변이 14/14가 잡혀 닫혔다. 그러나 막는 발견이 9건(D10~D18) 새로 나왔다. D10은 독립 축에서 재현한 현재 동작 결함이다(앞쪽 이력을 끌어오면 OpenCode 현재 턴 TODO에 이전 턴 TODO가 보인다). D11~D18은 ⑦ 잔여 sweep에서 열거 자리 87곳(못 잡음 변이 87개)이 잠기지 않은 것이다. 설계자가 G1·X1을 정정한 뒤 구현자가 D10~D18을 닫는다.

## 메타 (verify 2)

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `04958717..4e84dd6b`(app 8파일 +594/−25, 테스트 제외 production 3파일 +19/−7). r2 구현 커밋 `4e84dd6b` — 브랜치 `ccr-ca3d795a-2t0cmj`, `origin/main` 조상 아님 |
| 구현 전 plan 기준 | `2bc18d63`(V1 rev 5 + ΔV1~ΔV4). `4e84dd6b`의 plan diff는 머리말·메타 상태와 `[구현자 기입] r2` 절뿐 — 규범 행 변경 없음 |
| V mode / 유효 V | Baseline V V1 rev 5 + ΔV1~ΔV4 |
| 라운드 | 2 |
| 확장 창 | verify 2회째 — 창 안(마지막). ΔV3(D-023) 노드 R-03·SD-06·AR-05도 창 안(ΔV3 뒤 2회째) |
| 독립 축(⑥) | 2축. (a) 이력 앞삽입이 메시지 배열 위치에 의존하는 다른 상태를 옮기는가 → `openCodeTodoTurnStartIndex`가 고정돼 D10 재현. (b) 검색 보기 한쪽 방향이 오류일 때 반대쪽 유휴 채움 → r2가 양쪽을 모두 멈춘다. 규칙 칸 둘이 다르게 읽혀 G1 |
| 열거 sweep(⑦) | verify 1 전수 잔여 + diff 자리 + ③④. 시도 233 = 판정 231 + 무효 2(Y6 문법 오류 → Y6r, gA1 하네스 JSON 잘림 → gA1r). 잡음 124 · 못 잡음 88(이행 87 · 확장 1) · 못 잡음(단위, 등록 좌표가 잡음) 3 · 동치 16 |
| ⑦ 잔여 | 남음(§4 끝 목록 7항목). 이번 판정이 RETURN_TO_PLAN이라 다음 verify로 넘긴다 |
| 발견 분류 | 이행 9(D10은 현재 결함 재현 포함) · PLAN_GAP 1(G1, plan 내부 불일치) · 확장 1(X1) · 비귀속 1(N1 기존 Vitest 22건) |
| 구현 주체·문맥 | Codex 구현, Claude Code 검증. plan rev 5·ΔV1~ΔV4는 Claude Code 설계 — plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan validity (verify 2)

- 구현 커밋의 plan 변경: `git diff 04958717 4e84dd6b -- docs/handoff/0329-turn-history-paging/plan.md`는 머리말 2줄·메타 2행·`[구현자 기입] r2` 7절이다. Decision·AC·V·§10 변경 0.
- 창 밖 ΔV: 없음(이번은 verify 2회째).

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·상속·pair | 유효 | verify 1 판정 그대로. 이번 변경은 MD-04(VP-16) 안 |
| §10 자리 목록 | 유효 | 이번 ⑦ 발견은 모두 기존 EP 자리·규칙 칸·Q 입력 칸에서 인용된다 |
| 규칙 칸 정합 | **PLAN_GAP G1** | §10 ‘한 턴과 조각’은 유휴 채움 조건을 “오류 없음”이라고만 적는다. ‘양방향 커서·끝’은 “한 방향 실패가 다른 방향을 막지 않는다”고 적는다. 검색 보기에서 before가 오류일 때 after 자동 채움을 계속하는지는 두 칸만으로 정할 수 없다. r2는 멈추는 쪽을 골라 테스트로 고정했다(`useHistoryControls.test.ts` ‘fills both sides of a search turn one committed page at a time’ — `beforeState:'error'`에서 예약 0). r2 이전 코드는 after로 넘어갔다(`6b063bb0` `useHistoryControls.ts:43-48`) |
| 운영 gate | 유효 | §19-3 열거 |

## 1. Product & UX / ACTIVE Decision (verify 2 변경분)

| Decision | 기대 | r2 production path | 판정 |
|---|---|---|---|
| D-009 유휴 채움 | 직전 commit 전 다음 요청 0 | `idleSearchDirection.ts:10-15`를 훅 `useHistoryControls.ts:44`과 store `chatStore.ts:2776`이 함께 부른다 | ✅ D1 해소(I13·I5~I7 잡음) |
| D-012 · AC7 OpenCode 현재 TODO | 읽은 범위와 무관하게 live 소유자 기준 | `chatReducer.ts:1043` 전송 시 `messages.length`로 고정 → 앞삽입(`:1701` PREPEND_HISTORY) 뒤에도 그대로 | ❌ D10 |

## 2. 구현 결과 비판적 검토 — AC 전에 (verify 2)

| 질문 | 판정 | 근거 |
|---|---|---|
| 동시 요청 | ✅ | before 진행 중 after 자동 요청 false(`history-search.test.ts` ‘does not issue an automatic page while the %s search edge is pending’), 수동 반대쪽은 허용 |
| 위치 의존 상태 | ❌ D10 | 앞삽입이 배열 앞에 k개를 넣는데 `openCodeTodoTurnStartIndex`는 옮기지 않는다 |
| 한쪽 실패 | ⚠️ G1 | 자동 채움이 양쪽 모두 멈춘다. 수동 읽기와 재시도는 가능하다 |
| 늦은 응답 | ❌ D12 | 같은 hit 재선택 뒤 이전 탐색의 같은 커서 응답을 막는 것은 seq 비교 하나인데, 그 비교가 잠기지 않았다(S12) |

## 3. 역방향 탐색 (verify 2)

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 04958717..4e84dd6b` — 후보 1(형제 비대칭 0).

| 후보 | 판정 | 근거 |
|---|---|---|
| `SessionEntry` 테스트에만 등장 | 오탐 | 타입 전용 심볼. `chatStore.ts` 안에서 쓰인다 |
| `idleSearchDirection` 소비처 | 2곳 배선 | `useHistoryControls.ts:44` · `chatStore.ts:2776`. 테스트 전용 아님 |
| 같은 규칙 이중 구현 | 해소 | verify 1의 훅↔store 이중 조건이 한 함수로 합쳐졌다. 그래서 I5~I7이 동치에서 잡음으로 바뀌었다 |
| 새 테스트 5파일 | production 진입 | `history-port.integration.test.ts`는 실제 data handler·SQLite·창 transport를 지난다(T1~T3·W1 잡음으로 확인) |

## 4. 증거 재측정 (verify 2)

- **Q 좌표 대응(D9 후반)**: `[구현자 기입] r2` ‘Q와 실행된 테스트의 대응’ 표의 `파일:테스트명` 44개를 파일에서 다시 찾았다. 40개는 이름 그대로, 4개는 `it.each` 템플릿(`%s`·`%i`)으로 실재한다(`send.worktree.test.ts:360` · `turn-page.db.test.ts:194` · `useHistoryControls.test.ts` ‘postpones idle history reads during %s input…’). 없는 좌표 0.
- **①·②**: 닫는 이슈 D1~D9의 인용 변이 14개(I1·I2·I11·I12·I13·S7·S8·S10·C2·C3·P1·P3·P5·P7)가 모두 잡음이다. 각 실패는 변이가 흉내 낸 실수에서 나온 단언 실패였다(re* 로그). 등록 변이 중 이번에 돌린 것: ΔV1 ⑥ 분류 제거(gV5 · Q4b″ inertia 308.7px)·③ 스피너 높이(gE1 · states 7.25px)·ΔV2 (i) 좌표(A1 · 단위 10 red)·(ii) 첫 측정 재예약(gV14 · firstMeasurement 사례 red)·Q5b 송신 대상(Q5B)·Q9b 진행 위치(R3)·출판 포인터 선행(X4)·Q7 제거/스냅샷(R4·R5)·ΔV3 ①③④⑤⑥(N1·N3a~c·N4·N5a~c·N6) — 모두 잡음.
- **③**: verify 1의 못 잡음 14 → 14 잡음. 동치 17 중 I5~I8·I10·S3이 잡음으로 바뀌었다(이중 조건이 한 함수로 합쳐져 가리던 쪽이 사라짐). 나머지 S1·S2·S5·S6·C4~C6·P6·P9·P10은 동치가 유지된다(이번 실행 green, 코드 무변경).
- **④**: verify 1의 잡음 13(I3·I4·I9·S9·C1·P2·P4·P8·R1~R5) → 13 잡음. 덮개 회귀 0.
- **⑤ 형제 맞바꿈**: I13(before↔after 순서)·Z4(earlierTurn↔laterTurn)·N3a·N3b(원본 ID↔화면 ID)·N6(분기 출발점) — 모두 잡음.
- **⑥ 독립 축**: (a) 아래 재현. (b) G1.
  - (a) 재현: 임시 테스트(트리에 남기지 않음)에서 OpenCode 세션을 부분 이력 `[L1 user, L2 assistant(TodoWrite ‘old’ in_progress 성공)]`으로 `LOAD_SESSION(complete:false)` → `BEGIN_TURN`. 이때 `selectOpenCodeTodos` = `[]`. 이어 `PREPEND_HISTORY([E1 user, E2 assistant])`를 넣으면 `[{text:'old', status:'in_progress'}]`. 인덱스는 2 그대로이고 배열은 `[E1,E2,L1,L2]`이다.
- **⑦ 열거 sweep**: verify 1 잔여 표의 자리마다 기본 변이 1개를 심었다. 대응 범위는 아래 표의 ‘하한’이다.

### 고장 이력 (verify 2)

열은 ID · `파일:줄` · 종류 · 바꾼 내용 · 결과 · 잡은 테스트(잡음) 또는 근거(못 잡음·동치) · 분류다. 직전 결과는 verify 1 표의 같은 ID다(없으면 이번에 새로 심은 것). c 묶음의 `DB*`는 `deferredBody.ts`, `EC1`은 `chatStore.ts` 전환 취소다(발견 ID D1~D18과 겹치지 않게 이름을 바꿨다). 잡은 테스트가 ‘vitest n failed’로만 적힌 행은 하네스가 실패 이름을 남기지 않은 묶음(a·b·c)이다. 그중 ③ 인용 변이 19개는 로그를 남겨 다시 돌렸고(re*), 나머지는 실패 수만 관측했다.

| 하한 | 이번에 심은 ID |
|---|---|
| ① 등록 변이 | A1·gA1·gV5·gV14·gE1·Q5B·R3·X4·R4·R5·N1·N3a~c·N4·N5a~c·N6 |
| ② 인용 변이(D1~D9) | I1·I2·I11~I13·S7·S8·S10·C2·C3·P1·P3·P5·P7 |
| ③ 직전 못 잡음·동치 | 위 14 + I5~I8·I10·S1~S3·S5·S6·C4~C6·P6·P9·P10 |
| ④ 직전 잡음 | I3·I4·I9·S9·C1·P2·P4·P8·R1~R5 |
| ⑦ diff 자리 | I7b·I8b·I14~I17·S11~S14 |
| ⑦ 잔여 EP1 ①②③⑤ | Y1~Y7·Y2b·Y3b·Y4b·Y6r |
| ⑦ 잔여 EP2 ①③④⑤ · EP3 ①②③④ | W1~W6·T1~T15·DB1~DB10·B1~B6·Z1~Z5·P11·P12 |
| ⑦ 잔여 EP4′·EP4″ | G1~G6·V1~V9·V12~V14·V16·V17·E1~E3·gV2·gV12·gV13 |
| ⑦ 잔여 EP5 ②④⑥ | EC1·O8·R6~R10·Q5B |
| ⑦ 잔여 EP6 ①③④⑤⑥⑦⑧ | F1~F4·O1~O7·J1~J6·L1~L4·SR1~SR10 |
| ⑦ 잔여 EP7 ①~⑦ | PQ1~PQ6·K1~K13·H1·H2·TD1 |
| ⑦ 잔여 EP8 ①~④ | FK1~FK6·FK5b·FK8·FK9 |
| ⑦ 잔여 EP9 ①~⑤ | X1~X9·X2b |
| ⑦ 잔여 EP10 ①~⑧ | N1~N8·N7a·N7b |

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 / 근거 | 분류 |
|---|---|---|---|---|---|---|
| I1 | `useHistoryControls.ts:50` | 다른 값 | if (input.current.dragging \|\| performance.now… → if (performance.now() | 잡음 | useHistoryControls.test.ts ‘postpones idle history reads during poi…’ | — |
| I2 | `useHistoryControls.ts:50` | 다른 값 | performance.now() < input.current.until → false | 잡음 | useHistoryControls.test.ts ‘postpones idle history reads during whe…’ 외 1 | — |
| I3 | `useHistoryControls.ts:45` | 다른 값 | page.before?.kind !== 'withinTurn' \|\| page.be… → page.before?.kind !== 'within… | 잡음 | vitest 1 failed · 1561 passed (1562) | — |
| I4 | `useHistoryControls.ts:45` | 다른 값 | page.before?.kind !== 'withinTurn' \|\| → !page.before \|\| | 잡음 | vitest 1 failed · 1561 passed (1562) | — |
| I5 | `idleSearchDirection.ts:11` | 다른 값 | if (view.beforeState \|\| view.afterState) → if (view.afterState) | 잡음 | useHistoryControls.test.ts ‘fills both sides of a search turn one c…’ | — |
| I6 | `idleSearchDirection.ts:11` | 다른 값 | if (view.beforeState \|\| view.afterState) → if (view.beforeState) | 잡음 | useHistoryControls.test.ts ‘fills both sides of a search turn one c…’ 외 1 | — |
| I7 | `idleSearchDirection.ts:13` | 다른 값 | if (view.after?.kind === 'withinTurn') → if (view.after) | 잡음 | useHistoryControls.test.ts ‘fills both sides of a search turn one c…’ | — |
| I7b | `idleSearchDirection.ts:12` | 다른 값 | if (view.before?.kind === 'withinTurn') → if (view.before) | 잡음 | vitest 2 failed · 1560 passed (1562) | — |
| I8 | `useHistoryControls.ts:52` | 다른 값 | readSearchEdge(key, dir, true) → readSearchEdge(key, dir) | 잡음 | useHistoryControls.test.ts ‘fills both sides of a search turn one c…’ | — |
| I8b | `useHistoryControls.ts:53` | 다른 값 | chatActions.readPrevious(key, true) → chatActions.readPrevious(key) | 잡음 | vitest 4 failed · 1558 passed (1562) | — |
| I9 | `useHistoryControls.ts:58` | 제거 | window.cancelIdleCallback(idle) → (삭제) | 잡음 | vitest 1 failed · 1561 passed (1562) | — |
| I10 | `useHistoryControls.ts:59` | 제거 | window.clearTimeout(timer) → (삭제) | 잡음 | useHistoryControls.test.ts ‘requests one same-turn page after commi…’ | — |
| I11 | `useHistoryControls.ts:28` | 제거 | document.addEventListener('wheel', note, { capt… → (삭제) | 잡음 | useHistoryControls.test.ts ‘postpones idle history reads during whe…’ | — |
| I12 | `useHistoryControls.ts:29` | 제거 | document.addEventListener('keydown', note, true) → (삭제) | 잡음 | useHistoryControls.test.ts ‘postpones idle history reads during key…’ | — |
| I13 | `idleSearchDirection.ts:12` | 맞바꿈 | if (view.before?.kind === 'withinTurn') return … → if (view.after?.kind === 'wit… | 잡음 | useHistoryControls.test.ts ‘fills both sides of a search turn one c…’ | — |
| I14 | `useHistoryControls.ts:30` | 제거 | document.addEventListener('pointerdown', down, … → (삭제) | 잡음 | vitest 2 failed · 1560 passed (1562) | — |
| I15 | `useHistoryControls.ts:31` | 제거 | document.addEventListener('pointerup', up, true) → (삭제) | 잡음 | vitest 2 failed · 1560 passed (1562) | — |
| I16 | `useHistoryControls.ts:52` | 고정값 | } else if (dir) chatActions → } else if (false) chatActions | 잡음 | vitest 1 failed · 1561 passed (1562) | — |
| I17 | `useHistoryControls.ts:51` | 다른 값 | timer = window.setTimeout(schedule, HISTORY_GES… → timer = 0 | 잡음 | vitest 4 failed · 1558 passed (1562) | — |
| S3 | `chatStore.ts:2775` | 다른 값 | view[stateKey] === 'loading' \|\| (automatic &&… → view[stateKey] === 'loading' | 잡음 | vitest 2 failed · 1560 passed (1562) | — |
| S5 | `chatStore.ts:2774` | 다른 값 | getState().activeKey !== key \|\| view[stateKey… → view[stateKey] === 'loading' … | 동치 | 훅·컨트롤 키가 `useActiveSessionKey()`(`TranscriptView.tsx:14`) — verify 1 근거 유지 | 동치 |
| S7 | `chatStore.ts:2799` | 다른 값 | reply.status !== 'ok' \|\| reply.session.histor… → reply.status !== 'ok' | 잡음 | history-search.test.ts ‘rejects a different publication and ret…’ | — |
| S9 | `chatStore.ts:2775` | 다른 값 | view[stateKey] === 'loading' \|\| (automatic → (automatic | 잡음 | vitest 3 failed · 1559 passed (1562) | — |
| S11 | `chatStore.ts:2787` | 제거 | s.view[direction]?.cursor === edge.cursor && → (삭제) | 동치 | 방향별 단일 flight(S9 잡음) 동안 같은 방향 커서는 바뀌지 않고 새 탐색은 seq가 가른다 | 동치 |
| S12 | `chatStore.ts:2785` | 다른 값 | return s?.seq === seq && → return s?.seq !== undefined && | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| S1 | `chatStore.ts:2830` | 다른 값 | (automatic && (edge.kind !== 'withinTurn' \|\| … → (automatic && history.beforeS… | 동치 | 훅 `useHistoryControls.ts:45` withinTurn 조건(I4 잡음) | 동치 |
| S2 | `chatStore.ts:2830` | 다른 값 | (automatic && (edge.kind !== 'withinTurn' \|\| … → (automatic && edge.kind !== '… | 동치 | 훅 `:45` beforeState 조건(I3 잡음) | 동치 |
| S6 | `chatStore.ts:2828` | 다른 값 | key !== state.activeKey \|\| history.beforeStat… → history.beforeState === 'load… | 동치 | 훅·컨트롤 키가 `useActiveSessionKey()`(`TranscriptView.tsx:14`) — verify 1 근거 유지 | 동치 |
| S8 | `chatStore.ts:2850` | 다른 값 | reply.status !== 'ok' \|\| reply.session.histor… → reply.status !== 'ok' | 잡음 | history-search.test.ts ‘rejects a different publication and ret…’ | — |
| S10 | `chatStore.ts:2829` | 다른 값 | history.beforeState === 'loading' \|\| (automat… → (automatic && (edge | 잡음 | history-search.test.ts ‘rejects a different publication and ret…’ | — |
| S13 | `chatStore.ts:2849` | 다른 값 | if (entry.history !== loading \|\| getState().a… → if (getState().activeKey !== … | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| S14 | `chatStore.ts:2862` | 다른 값 | return rejected ? { ...entry, history: { ...his… → return false ? { ...entry, hi… | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| C1 | `history-page.ts:53` | 제거 | id !== req.sessionId \|\| → (삭제) | 잡음 | vitest 1 failed · 223 passed (224) | — |
| C2 | `history-page.ts:54` | 제거 | kind !== req.kind \|\| → (삭제) | 잡음 | turn-page.db.test.ts ‘rejects a cursor reused for another kin…’ | — |
| C3 | `history-page.ts:55` | 제거 | direction !== (before ? 'before' : 'after') \|\| → (삭제) | 잡음 | turn-page.db.test.ts ‘rejects a cursor reused for another kin…’ | — |
| C4 | `history-page.ts:59` | 제거 | if (g !== gen) return 'stale' → (삭제) | 동치 | 출판 시 이전 세대 행 삭제(`history-index-queries.ts:407`)로 `header()` 없음 → 같은 stale. 단 그 삭제(X8)도 이번에 못 잡음 | 동치 |
| C5 | `history-page.ts:61` | 다른 값 | if (!at \|\| at.message_key !== key) → if (!at) | 동치 | verify 1 근거 유지(코드 무변경, 이번 실행 green) | 동치 |
| C6 | `history-page.ts:63` | 다른 값 | if (!next \|\| (kind === 'withinTurn') !== (at.… → if (!next) | 동치 | verify 1 근거 유지(코드 무변경, 이번 실행 green) | 동치 |
| P1 | `history-page.ts:85` | 다른 값 | if (state.published !== generation \|\| state.p… → if (state.published !== gener… | 잡음 | turn-page.db.test.ts ‘returns stale if a source write commits…’ | — |
| P2 | `history-page.ts:91` | 다른 값 | if (ref.session !== id \|\| offset % HISTORY_BO… → if (offset % HISTORY_BODY_BYT… | 잡음 | vitest 1 failed · 223 passed (224) | — |
| P3 | `history-page.ts:113` | 다른 값 | if (!header \|\| header.body_bytes !== ref.byte… → if (!header) | 잡음 | turn-page.db.test.ts ‘reads a deferred UTF-8 body across chun…’ | — |
| P4 | `history-page.ts:157` | 제거 | if (req.generation !== generation) return { ...… → (삭제) | 잡음 | vitest 1 failed · 223 passed (224) | — |
| P5 | `history-page.ts:166` | 다른 값 | if (!current \|\| current.epoch !== locator.epo… → if (!current) | 잡음 | turn-page.db.test.ts ‘rechecks the archive epoch when ordinal…’ | — |
| P6 | `history-page.ts:164` | 제거 | if (locator.session !== id) return { ...echo, s… → (삭제) | 동치 | verify 1 근거 유지(코드 무변경, 이번 실행 green) | 동치 |
| P7 | `history-page.ts:171` | 다른 값 | if (req.cached?.generation === generation && re… → if (req.cached?.generation ==… | 잡음 | history-port.integration.test.ts ‘opens and refreshes the latest turn, th…’ 외 1 | — |
| P8 | `history-page.ts:109` | 다른 값 | if (ref.session !== id \|\| offset % HISTORY_BO… → if (offset % HISTORY_BODY_BYT… | 잡음 | vitest 1 failed · 223 passed (224) | — |
| P9 | `history-page.ts:210` | 제거 | \|\| (req.kind === 'latest' && ordinal > startO… → (삭제) | 동치 | verify 1 근거 유지(코드 무변경, 이번 실행 green) | 동치 |
| P10 | `history-page.ts:244` | 다른 값 | if (messages.length && fitsAlone) break → if (fitsAlone) break | 동치 | verify 1 근거 유지(코드 무변경, 이번 실행 green) | 동치 |
| R1 | `history-page.ts:202` | 다른 값 | start, ascending, HISTORY_PAGE_MESSAGES) → start, ascending, HISTORY_PAG… | 잡음 | vitest 5 failed · 219 passed (224) | — |
| R2 | `history-page.ts:240` | 다른 값 | if (bytes > available \|\| parts + h.part_count… → if (bytes > available) | 잡음 | vitest 2 failed · 222 passed (224) | — |
| R3 | `history-index-queries.ts:387` | 제거 | this.stmt('UPDATE history_index_state SET next_… → (삭제) | 잡음 | vitest 4 failed · 220 passed (224) | — |
| R4 | `projection.ts:641` | 제거 | entries.delete(observation.id) → (삭제) | 잡음 | vitest 1 failed · 223 passed (224) | — |
| R5 | `projection.ts:645` | 제거 | for (const id of [...entries.keys()]) if (!seen… → (삭제) | 잡음 | vitest 1 failed · 223 passed (224) | — |
| P11 | `history-page.ts:169` | 제거 | if (req.resume?.generation === generation) star… → (삭제) | 못 잡음 | 입력 없음 — D15 출처 참조 | 이행 D15 |
| P12 | `history-page.ts:111` | 다른 값 | if (ref.generation !== generation) return { ...… → const header | 잡음 | vitest 1 failed · 223 passed (224) | — |
| T1 | `session-load.ts:112` | 제거 | result.sessionId !== query.sessionId \|\| → (삭제) | 잡음 | vitest 1 failed · 1434 passed (1435) | — |
| T2 | `session-load.ts:113` | 제거 | result.requestId !== requestId \|\| → (삭제) | 잡음 | vitest 1 failed · 1434 passed (1435) | — |
| T3 | `session-load.ts:114` | 제거 | result.openGeneration !== query.openGeneration … → (삭제) | 잡음 | vitest 1 failed · 1434 passed (1435) | — |
| T4 | `session-load.ts:120` | 제거 | result.session.id !== query.sessionId \|\| → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T5 | `session-load.ts:121` | 제거 | new Set(result.session.messages.map((m) => m.id… → (삭제) | 잡음 | vitest 1 failed · 1434 passed (1435) | — |
| T6 | `session-load.ts:123` | 제거 | result.session.messages.reduce((sum, m) => sum … → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T7 | `session-load.ts:128` | 다른 값 | (m.deferredBody.session !== query.sessionId \|\… → (m.deferredBody.generation | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T8 | `session-load.ts:129` | 제거 | m.deferredBody.generation !== result.session.hi… → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T9 | `session-load.ts:129` | 다른 값 | m.deferredBody.generation !== result.session.hi… → m.deferredBody.generation !==… | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T10 | `session-load.ts:160` | 다른 값 | (query.kind !== 'body' \|\| query.offset !== re… → (query.kind !== 'body' \|\| | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T11 | `session-load.ts:162` | 다른 값 | result.nextOffset <= result.offset \|\| result.… → result.nextOffset <= result.o… | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T12 | `session-load.ts:163` | 다른 값 | result.nextOffset > query.ref.bytes \|\| result… → result.nextOffset > query.ref… | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T13 | `session-load.ts:157` | 제거 | query.cached?.messageKey !== result.messageKey … → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| T14 | `session-load.ts:109` | 다른 값 | if (request.cancelled \|\| result?.status === '… → if (result?.status === 'cance… | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| T15 | `session-load.ts:116` | 다른 값 | (query.kind === 'body' \|\| query.kind === 'met… → (query.kind === 'metadata' \|… | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| DB1 | `deferredBody.ts:57` | 다른 값 | if ( !current() \|\| reply.status !== 'body' \|… → if ( reply.status !== 'body' … | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| DB2 | `deferredBody.ts:60` | 제거 | reply.sessionId !== ref.session \|\| → (삭제) | 잡음 | vitest 1 failed · 1434 passed (1435) | — |
| DB3 | `deferredBody.ts:61` | 제거 | reply.openGeneration !== openGeneration \|\| → (삭제) | 잡음 | vitest 1 failed · 1434 passed (1435) | — |
| DB4 | `deferredBody.ts:61` | 다른 값 | reply.openGeneration !== openGeneration \|\| re… → reply.openGeneration !== open… | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| DB5 | `deferredBody.ts:67` | 제거 | !raw.length \|\| → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| DB6 | `deferredBody.ts:68` | 제거 | raw.length > HISTORY_BODY_BYTES \|\| → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| DB7 | `deferredBody.ts:69` | 제거 | reply.nextOffset !== offset + raw.length \|\| → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| DB8 | `deferredBody.ts:77` | 다른 값 | { stream: !reply.done } → { stream: false } | 잡음 | vitest 1 failed · 1434 passed (1435) | — |
| DB9 | `deferredBody.ts:82` | 다른 값 | if (!current() \|\| offset !== ref.bytes) → if (offset !== ref.bytes) | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| DB10 | `deferredBody.ts:84` | 다른 값 | if (!Array.isArray(parts) \|\| !parts.every((pa… → if (!Array.isArray(parts)) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| B1 | `chatStore.ts:2657` | 다른 값 | return ( state.activeKey === key && !!entry && → return ( !!entry && | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| B2 | `chatStore.ts:2659` | 다른 값 | !!entry && entry.search?.seq === seq && → !!entry && | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| B3 | `chatStore.ts:2661` | 제거 | (view?.generation ?? entry.history?.generation)… → (삭제) | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| B4 | `chatStore.ts:2661` | 제거 | && (view?.messages ?? entry.session.messages).s… → (삭제) | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| B5 | `chatStore.ts:2667` | 다른 값 | .then((parts) => { if (!current()) return false → .then((parts) => { | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| B6 | `chatStore.ts:2647` | 제거 | const prior = readingBodies.get(ref) if (prior)… → (삭제) | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| G1 | `historyGesture.ts:25` | 제거 | && now - this.lastTime < HISTORY_GESTURE_GAP_MS → (삭제) | 잡음 | TranscriptViewport.history-pull.test.ts ‘reserves the browser default only for a…’ 외 1 | — |
| G2 | `historyGesture.ts:25` | 다른 값 | this.direction === direction && now → now | 잡음 | historyGesture.test.ts ‘starts a new gesture on reversal, inter…’ 외 1 | — |
| G3 | `historyGesture.ts:28` | 다른 값 | if (continuing) return this.consumed ? 'consume… → if (continuing) return 'consu… | 잡음 | historyGesture.test.ts ‘honors an intervening user scroll witho…’ 외 1 | — |
| G4 | `historyGesture.ts:33` | 다른 값 | userScroll(): void { this.consumed = false → userScroll(): void { void 0 | 잡음 | historyGesture.test.ts ‘honors an intervening user scroll witho…’ | — |
| G5 | `historyGesture.ts:38` | 다른 값 | this.direction = undefined this.consumed = false → this.consumed = false | 잡음 | historyGesture.test.ts ‘starts a new gesture on reversal, inter…’ | — |
| G6 | `historyGesture.ts:23` | 제거 | if (!delta) return 'userInput' → (삭제) | 잡음 | historyGesture.test.ts ‘keeps ordinary upward input ordinary ev…’ | — |
| V1 | `TranscriptViewport.tsx:713` | 다른 값 | canConsumeScroll( { top: el.scrollTop, height: … → nestedScrollConsumes | 잡음 | TranscriptViewport.history-pull.test.ts ‘reserves the browser default only for a…’ | — |
| V2 | `TranscriptViewport.tsx:716` | 제거 | \|\| nestedScrollConsumes(target, el, delta) → (삭제) | 못 잡음 | 입력 없음 — D14 출처 참조 | 이행 D14 |
| V3 | `TranscriptViewport.tsx:707` | 다른 값 | \|\| controls[direction] === 'loading' ) return… → ) return false | 동치 | store loading 가드(`chatStore.ts:2775`·`:2829`, S9·S10 잡음)가 같은 요청을 거절 | 동치 |
| V4 | `TranscriptViewport.tsx:738` | 제거 | if (input !== 'userInput') event.preventDefault… → (삭제) | 잡음 | TranscriptViewport.history-pull.test.ts ‘reserves the browser default only for a…’ | — |
| V5 | `TranscriptViewport.tsx:735` | 다른 값 | if (input !== 'consumedPull') cancel() → cancel() | 못 잡음(단위) | 등록 좌표 Q4b″ 행 gV5가 잡음 | — |
| V6 | `TranscriptViewport.tsx:770` | 다른 값 | { passive: !historyEnabled } → { passive: true } | 잡음 | TranscriptViewport.history-pull.test.ts ‘reserves the browser default only for a…’ | — |
| V7 | `TranscriptViewport.tsx:750` | 다른 값 | key === 'PageUp' \|\| key === 'Home' → key === 'Home' | 못 잡음 | 입력 없음 — D14 출처 참조 | 이행 D14 |
| V8 | `TranscriptViewport.tsx:748` | 제거 | if ((event as KeyboardEvent).repeat) return → (삭제) | 못 잡음 | 입력 없음 — D14 출처 참조 | 이행 D14 |
| V9 | `TranscriptViewport.tsx:994` | 고정값 | {history?.after ? ( → {false ? ( | 잡음 | TranscriptViewport.history-pull.test.ts ‘reserves the browser default only for a…’ | — |
| V12 | `TranscriptViewport.tsx:835` | 제거 | if (footerRef.current) observer.observe(footerR… → (삭제) | 못 잡음 | 입력 없음 — D14 출처 참조 | 이행 D14 |
| V13 | `TranscriptViewport.tsx:289` | 다른 값 | const captured = activeAnchorRef.current ?? (el… → const captured = el ? capture… | 못 잡음 | 입력 없음 — D14 출처 참조 | 이행 D14 |
| V14 | `TranscriptViewport.tsx:513` | 다른 값 | (prevHeight !== undefined \|\| correcting) && → prevHeight !== undefined && | 못 잡음(단위) | 등록 좌표 Q4b″ 행 gV14가 잡음 | — |
| V16 | `TranscriptViewport.tsx:720` | 다른 값 | if (!controls.request(direction)) return false → controls.request(direction) | 못 잡음 | 입력 없음 — D14 출처 참조 | 이행 D14 |
| V17 | `TranscriptViewport.tsx:358` | 제거 | b.partKeys?.some((part) => part.startsWith(targ… → (삭제) | 못 잡음 | 입력 없음 — D15 출처 참조 | 이행 D15 |
| A1 | `anchor.ts:171` | 다른 값 | viewportOffsetPx: measureCharTop(targetEl, char… → viewportOffsetPx: targetEl.ge… | 잡음 | TranscriptViewport.harness.test.ts ‘claude code keeps the reading character…’ 외 6 | — |
| E1 | `HistoryEdge.tsx:35` | 다른 값 | className={'${HISTORY_HEAD_HEIGHT} flex → className={'${state === 'load… | 못 잡음(단위) | 등록 좌표 Q4b″ 행 gE1가 잡음 | — |
| E2 | `HistoryEdge.tsx:29` | 다른 값 | const indicator = pulling && state === 'loading… → const indicator = state | 못 잡음 | 입력 없음 — D14 출처 참조 | 이행 D14 |
| E3 | `HistoryEdge.tsx:46` | 다른 값 | disabled={busy} aria-busy={busy} → aria-busy={busy} | 동치 | store loading 가드(`chatStore.ts:2775`·`:2829`, S9·S10 잡음)가 같은 요청을 거절 | 동치 |
| SR1 | `searchReveal.ts:58` | 다른 값 | if (row && !row.closest('[inert],[hidden]')) → if (row) | 잡음 | searchReveal.test.ts ‘starts the two-second outline only on a…’ | — |
| SR2 | `searchReveal.ts:99` | 다른 값 | timer = window.setTimeout(release, 2000) → timer = window.setTimeout(rel… | 잡음 | searchReveal.test.ts ‘starts the two-second outline only on a…’ | — |
| SR3 | `searchReveal.ts:90` | 제거 | row.setAttribute('data-history-highlight', '') → (삭제) | 잡음 | searchReveal.test.ts ‘starts the two-second outline only on a…’ | — |
| SR4 | `searchReveal.ts:92` | 다른 값 | selection.keyboard && (document → (document | 잡음 | searchReveal.test.ts ‘starts the two-second outline only on a…’ | — |
| SR5 | `searchReveal.ts:98` | 제거 | announce() → (삭제) | 잡음 | searchReveal.test.ts ‘starts the two-second outline only on a…’ | — |
| SR6 | `searchReveal.ts:44` | 제거 | scroller.addEventListener('wheel', release, opt… → (삭제) | 잡음 | searchReveal.test.ts ‘user input or restoring a visit leaves …’ | — |
| SR7 | `searchReveal.ts:50` | 다른 값 | if (e.target !== highlighted && e.target !== in… → if (e.target !== highlighted)… | 못 잡음 | 입력 없음 — D15 출처 참조 | 이행 D15 |
| SR8 | `searchReveal.ts:84` | 제거 | if (selection.restore) { release() return } → (삭제) | 잡음 | searchReveal.test.ts ‘user input or restoring a visit leaves …’ | — |
| SR9 | `searchReveal.ts:33` | 제거 | highlighted?.removeAttribute('data-history-high… → (삭제) | 잡음 | searchReveal.test.ts ‘starts the two-second outline only on a…’ | — |
| SR10 | `searchReveal.ts:74` | 다른 값 | (!positioned && (box.top < viewport.top \|\| bo… → false | 못 잡음 | 입력 없음 — D15 출처 참조 | 이행 D15 |
| R6 | `chatReducer.ts:1740` | 제거 | if (next.messages.some((message) => message.def… → (삭제) | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| R7 | `chatReducer.ts:1683` | 다른 값 | if (!owner \|\| owner.deferredBody !== action.r… → if (!owner) return state | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| R8 | `chatReducer.ts:1696` | 다른 값 | state.historyComplete && !merged.messages.some(… → state.historyComplete | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| R9 | `chatReducer.ts:1754` | 다른 값 | complete && !messages.some((message) => message… → complete | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| R10 | `chatReducer.ts:868` | 다른 값 | (!owner \|\| owner.deferredBody) && → !owner && | 잡음 | chatReducer.prepend.test.ts ‘retains a tool patch and its publicatio…’ | — |
| J1 | `chatStore.ts:2567` | 다른 값 | !view \|\| view.after \|\| (entry.history → !view \|\| (entry.history | 잡음 | history-search.test.ts ‘opens a cold target without latest, pag…’ 외 6 | — |
| J2 | `chatStore.ts:2568` | 다른 값 | \|\| (entry.history && entry.history.generation… → ) return entry let rejected | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| J3 | `chatStore.ts:2582` | 다른 값 | if (rejected) return entry return { ...entry, s… → return { ...entry, session, h… | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| J4 | `chatStore.ts:2575` | 다른 값 | messages: view.messages, reachedStart: !view.be… → messages: view.messages, reac… | 잡음 | history-search.test.ts ‘opens a cold target without latest, pag…’ | — |
| J5 | `chatStore.ts:2587` | 다른 값 | generation: view.generation, before: view.befor… → generation: view.generation, … | 잡음 | history-search.test.ts ‘rejects a different publication and ret…’ 외 2 | — |
| J6 | `chatStore.ts:2591` | 다른 값 | search: { ...selection, view: undefined } } } → search: selection } } | 잡음 | history-search.test.ts ‘opens a cold target without latest, pag…’ 외 1 | — |
| O1 | `chatStore.ts:2482` | 다른 값 | if (!current()) return false if (reply.status !… → if (reply.status !== 'ok' && … | 잡음 | history-search.test.ts ‘drops a late or deleted target and leav…’ | — |
| O2 | `chatStore.ts:2490` | 제거 | entry.history?.generation !== reply.generation … → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| O3 | `chatStore.ts:2491` | 다른 값 | messageOrderFor(entry.session).messagePosition(… → false) ) return false | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| O4 | `chatStore.ts:2494` | 제거 | if (reply.status === 'ok' && !reply.session.mes… → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| O5 | `chatStore.ts:2505` | 고정값 | if ((!next.session.sessionId \|\| next.session.… → if (false) | 잡음 | history-search.test.ts ‘reads a bounded latest page for a cold …’ 외 2 | — |
| O6 | `chatStore.ts:2447` | 다른 값 | ): Promise<boolean> { cancelSearchRequest() → ): Promise<boolean> { | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| O7 | `chatStore.ts:2469` | 다른 값 | messageOrderFor(cached.session).messagePosition… → messageOrderFor(cached.sessio… | 못 잡음 | 입력 없음 — D15 출처 참조 | 이행 D15 |
| O8 | `chatStore.ts:2519` | 제거 | sessionApi.cancelLoad(previous?.history?.source… → (삭제) | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| L1 | `chatStore.ts:2732` | 다른 값 | if (reply.status !== 'ok') throw Error(reply.st… → patchEntry(key, (e) => { | 동치 | 비-ok 응답에서 `reply.session` 접근이 TypeError → 같은 catch(`returnFailed`) | 동치 |
| L2 | `chatStore.ts:2730` | 다른 값 | .then((reply) => { if (!current()) return if (r… → .then((reply) => { if (reply.… | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| L3 | `chatStore.ts:2724` | 제거 | if (entry.search.returning) return → (삭제) | 못 잡음 | ‘최신 대화로’ 반복 입력의 중복 요청 — 열거 원문 없음 | 확장 X1 |
| L4 | `chatStore.ts:2719` | 다른 값 | if (!latest \|\| entry.history \|\| entry.sessi… → if (!latest \|\| entry.sessio… | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| W1 | `oo.ts:367` | 호출 대체 | sessionLoads.loadLatest(sessionId), → sessionLoads.load(sessionId), | 잡음 | oo.test.ts ‘wires DB load and lazy refresh as separ…’ 외 2 | — |
| W3 | `chatStore.ts:488` | 고정값 | if (window && !window.before) session = chatRed… → if (false) session = chatRedu… | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| W4 | `chatStore.ts:498` | 다른 값 | history: window ? { ...window, openGeneration: … → history: undefined | 못 잡음 | 입력 없음 — D13 출처 참조 | 이행 D13 |
| EC1 | `chatStore.ts:2019` | 다른 값 | sessionApi.cancelLoad(s.sessions[s.activeKey]?.… → (삭제) | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| Q5B | `chatStore.ts:2847` | 호출 대체 | .then((reply: HistoryPageReply) => { patchEntry… → .then((reply: HistoryPageRepl… | 잡음 | history-search.test.ts ‘discards an ordinary earlier page on se…’ | — |
| W2 | `session-load.ts:172` | 고정값 | if (req.openGeneration !== undefined && req.req… → if (false) { | 잡음 | history-port.integration.test.ts ‘opens and refreshes the latest turn, th…’ | — |
| W5 | `session-load.ts:132` | 다른 값 | return client.isClosed() \|\| !active.has(req.r… → return reply | 못 잡음 | 입력 없음 — D12 출처 참조 | 이행 D12 |
| W6 | `session-load.ts:127` | 제거 | if (!job) return { ...echo, status: 'missing' } → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| F1 | `queries.ts:841` | 맞바꿈 | recovery ? 'archive' : row.native_id ? 'native'… → row.native_id ? 'native' : 'l… | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 2 | — |
| F2 | `queries.ts:842` | 다른 값 | recovery ? recovery[1] : (row.native_id ?? Stri… → row.native_id ?? String(row.m… | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 1 | — |
| F3 | `history-index-queries.ts:159` | 다른 값 | epoch: row.incarnation + '.' + row[source], → epoch: String(row.incarnation… | 잡음 | turn-page.db.test.ts ‘rechecks the archive epoch when ordinal…’ | — |
| F4 | `history-index-queries.ts:160` | 다른 값 | projectedKey } → projectedKey: undefined } | 잡음 | turn-page.db.test.ts ‘rechecks the archive epoch when ordinal…’ | — |
| Y1 | `history-index-queries.ts:331` | 다른 값 | if (isTurnStart(previous, msg)) turn = ordinal … → this.putMessage(id, gen, ordi… | 잡음 | turn-page.db.test.ts ‘keeps partless messages and same-time t…’ 외 1 | — |
| Y2 | `history-index-queries.ts:310` | 제거 | if (headers.some((h) => h.message_id <= frontie… → (삭제) | 못 잡음 | 입력 없음 — D17 출처 참조 | 이행 D17 |
| Y2b | `history-index-queries.ts:293` | 다른 값 | if (!headers.length \|\| headers.length > 128) … → if (!headers.length) return u… | 못 잡음 | 입력 없음 — D17 출처 참조 | 이행 D17 |
| Y3 | `history-index-queries.ts:282` | 다른 값 | !state.published \|\| state.rebuild \|\| → !state.published \|\| | 잡음 | turn-page.db.test.ts ‘rechecks the archive epoch when ordinal…’ | — |
| Y3b | `reader.ts:93` | 제거 | alias(projection.messages[i].id, 'native', key) → void key | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ | — |
| Y4 | `reader.ts:122` | 제거 | if (headers && recovery) archive.forEach((m, i)… → (삭제) | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 1 | — |
| Y4b | `reader.ts:128` | 다른 값 | return { messages: [...archive, ...messages], a… → return { messages: [...messag… | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 8 | — |
| Y5 | `history-page.ts:202` | 다른 값 | index.pageHeaders(id, generation, start, ascend… → index.pageHeaders(id, generat… | 잡음 | turn-page.db.test.ts ‘restores 200,000 partless messages in o…’ | — |
| Y7 | `history-index-queries.ts:359` | 다른 값 | this.stmt('UPDATE history_index_state SET publi… → this.stmt('UPDATE history_ind… | 잡음 | panel-summary.db.test.ts ‘isolates historical tasks, agents, proc…’ 외 3 | — |
| Z1 | `history-index-queries.ts:258` | 다른 값 | msg.parts.length, body.length ) → msg.parts.length, body.length… | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 20 | — |
| Z2 | `history-page.ts:250` | 다른 값 | bytes: h.body_bytes → bytes: h.body_bytes + 1 | 잡음 | history-port.integration.test.ts ‘opens and refreshes the latest turn, th…’ 외 2 | — |
| Z3 | `history-page.ts:30` | 다른 값 | at.turn === other.turn ? 'withinTurn' : → false ? 'withinTurn' : | 잡음 | history-port.integration.test.ts ‘opens and refreshes the latest turn, th…’ 외 5 | — |
| Z4 | `history-page.ts:30` | 맞바꿈 | before ? 'earlierTurn' : 'laterTurn' → before ? 'laterTurn' : 'earli… | 잡음 | history-port.integration.test.ts ‘opens and refreshes the latest turn, th…’ 외 1 | — |
| Z5 | `history-index-queries.ts:265` | 다른 값 | putChunk.run(id, gen, ordinal, offset, body.sub… → putChunk.run(id, gen, ordinal… | 잡음 | history-port.integration.test.ts ‘opens and refreshes the latest turn, th…’ 외 3 | — |
| X1 | `history-index-queries.ts:59` | 뒤집기 | ORDER BY s.updated_at DESC,s.id → ORDER BY s.updated_at ASC,s.id | 잡음 | turn-index.job.db.test.ts ‘prioritizes the requested session, resu…’ | — |
| X2 | `turn-index.ts:66` | 다른 값 | if (foreground) this.queue.unshift(job) else th… → this.queue.push(job) | 못 잡음 | 입력 없음 — D17 출처 참조 | 이행 D17 |
| X2b | `turn-index.ts:55` | 다른 값 | this.queue.unshift(pending) → this.queue.push(pending) | 잡음 | turn-index.job.db.test.ts ‘prioritizes the requested session, resu…’ | — |
| X3 | `history-index-queries.ts:381` | 고정값 | if (performance.now() >= deadline) { → if (false) { | 잡음 | turn-page.db.test.ts ‘keeps the previous publication intact w…’ | — |
| X4 | `history-index-queries.ts:387` | 다른 값 | 'UPDATE history_index_state SET next_ordinal=? … → 'UPDATE history_index_state S… | 잡음 | history-port.integration.test.ts ‘opens and refreshes the latest turn, th…’ 외 3 | — |
| X5 | `turn-index.ts:112` | 다른 값 | sourceBytes: job.source.sourceBytes → sourceBytes: 0 | 못 잡음 | 입력 없음 — D17 출처 참조 | 이행 D17 |
| X6 | `history-index-queries.ts:372` | 다른 값 | if (!state \|\| state.revision !== revision \|\… → if (!state \|\| state.buildin… | 동치 | `schedule()`가 조각마다 `begin()`(`turn-index.ts:93`)을 불러 revision이 바뀌면 building 세대를 새로 만든다(`history-index-queries.ts:86-101`) | 동치 |
| X7 | `history-index-queries.ts:67` | 다른 값 | 'SELECT h.* FROM history_index_state h JOIN ses… → 'SELECT h.* FROM history_inde… | 못 잡음 | 입력 없음 — D17 출처 참조 | 이행 D17 |
| X8 | `history-index-queries.ts:407` | 고정값 | if (state.published) this.stmt('DELETE FROM his… → if (false) this.stmt('DELETE … | 못 잡음 | 입력 없음 — D17 출처 참조 | 이행 D17 |
| X9 | `turn-index.ts:117` | 다른 값 | const next = this.queue.findIndex((other) => !o… → this.queue.push(job) | 못 잡음 | 입력 없음 — D17 출처 참조 | 이행 D17 |
| PQ1 | `history-panel-queries.ts:96` | 다른 값 | if (req.generation !== generation) return { ...… → const scope | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| PQ2 | `history-panel-queries.ts:99` | 제거 | if (req.checkpoint !== checkpoint) return { ...… → (삭제) | 잡음 | panel-summary.db.test.ts ‘isolates historical tasks, agents, proc…’ | — |
| PQ3 | `history-panel-queries.ts:143` | 제거 | if (cursor[3] !== checkpoint) return { ...echo,… → (삭제) | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| PQ4 | `history-panel-queries.ts:136` | 제거 | cursor[0] !== sessionId \|\| → (삭제) | 못 잡음 | 입력 없음 — D11 출처 참조 | 이행 D11 |
| PQ5 | `history-panel-queries.ts:172` | 제거 | reply.rows.length === HISTORY_PAGE_MESSAGES \|\| → (삭제) | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| PQ6 | `history-panel-queries.ts:40` | 다른 값 | messages.filter(contributesToPanels).map → messages.map | 동치 | `contributesToPanels`가 고르는 part(도구·첨부·자식)가 패널 투영의 입력 전부 — 확인 실행 green | 동치 |
| K1 | `historyPanels.ts:251` | 제거 | if (last.parts.length > frontier.parts) tail.un… → (삭제) | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K2 | `historyPanels.ts:247` | 고정값 | const at = frontier ? liveMessages.findIndex((m… → const at = -1 | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K3 | `historyPanels.ts:314` | 제거 | for (const source of live.taskContextSources())… → (삭제) | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K4 | `historyPanels.ts:281` | 제거 | for (const agent of live.subagentTasks(true)) a… → (삭제) | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K5 | `historyPanels.ts:363` | 제거 | for (const p of active.processes) processes.set… → (삭제) | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K6 | `historyPanels.ts:106` | 다른 값 | if (page.checkpoint === undefined \|\| !page.ro… → if (page.checkpoint === undef… | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K7 | `historyPanels.ts:108` | 제거 | const pending = this.pendingDetails.get(id) if … → (삭제) | 잡음 | partial-history.integration.test.ts ‘all session panels show unpublished liv…’ | — |
| K8 | `historyPanels.ts:132` | 제거 | if (bytes.length + offset !== reply.nextOffset)… → (삭제) | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K9 | `historyPanels.ts:144` | 다른 값 | !PanelItemSchema.safeParse(value).success \|\| … → !PanelItemSchema.safeParse(va… | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K10 | `historyPanels.ts:101` | 다른 값 | if (version === this.revision) this.set(kind, {… → if (version === this.revision… | 잡음 | partial-history.integration.test.ts ‘all session panels show unpublished liv…’ | — |
| K11 | `historyPanels.ts:87` | 고정값 | if (result.status === 'stale' && prior.next) { → if (false) { | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K12 | `historyPanels.ts:86` | 다른 값 | if (version !== this.revision) return if (resul… → if (result.status === 'stale' | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| K13 | `historyPanels.ts:124` | 제거 | if (this.revision !== version \|\| this.pages[k… → (삭제) | 잡음 | partial-history.integration.test.ts ‘retrieves the next keyset on demand and…’ | — |
| H1 | `chatReducer.ts:959` | 다른 값 | let count = state.publishedUserCount ?? 0 → let count = 0 | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| H2 | `chatReducer.ts:964` | 다른 값 | (state.publishedUserCount === undefined \|\| !i… → true | 못 잡음 | 입력 없음 — D16 출처 참조 | 이행 D16 |
| TD1 | `chatReducer.ts:1043` | 고정값 | openCodeTodoTurnStartIndex: state.messages.leng… → openCodeTodoTurnStartIndex: 0, | 잡음 | chatReducer.opencode-todo.test.ts ‘starts each todo projection at the curr…’ 외 1 | — |
| FK1 | `fork-display.ts:31` | 제거 | if (alias.source === 'native') db.nativeHistory… → (삭제) | 못 잡음 | 입력 없음 — D18 출처 참조 | 이행 D18 |
| FK2 | `fork-display.ts:34` | 제거 | db.artifacts.copyForFork(parent, child, copies) → (삭제) | 못 잡음 | 입력 없음 — D18 출처 참조 | 이행 D18 |
| FK3 | `fork.ts:38` | 제거 | db.recordForkPrefix(arrival.childSessionId, mar… → (삭제) | 잡음 | paged-recovery.integration.test.ts ‘full archive and fork retain the first,…’ | — |
| FK4 | `fork.ts:25` | 제거 | if (db.getLineage(arrival.childSessionId)) retu… → (삭제) | 잡음 | paged-recovery.integration.test.ts ‘full archive and fork retain the first,…’ | — |
| FK5 | `fork-native.ts:18` | 다른 값 | return messages.slice(lastInherited >= 0 ? last… → return messages.slice(i) | 못 잡음 | 입력 없음 — D18 출처 참조 | 이행 D18 |
| FK5b | `reader.ts:89` | 다른 값 | messages = [...prefix, ...projection.messages] → messages = projection.messages | 잡음 | paged-recovery.integration.test.ts ‘full archive and fork retain the first,…’ | — |
| FK6 | `chatStore.ts:1811` | 제거 | sourceSessionId: src.sessionId, → (삭제) | 잡음 | history-search.test.ts ‘uses the parent cursor only for the for…’ | — |
| FK8 | `native-session.ts:65` | 제거 | const blocked = overBudget(history) if (blocked… → (삭제) | 잡음 | native-session.test.ts ‘uses the selected engine model context …’ 외 2 | — |
| FK9 | `native-session.ts:73` | 다른 값 | archiveJson: JSON.stringify(archive.messages), → archiveJson: JSON.stringify(a… | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 3 | — |
| N1 | `adapter.ts:377` | 다른 값 | let replacement = randomUUID() while (replaceme… → return { sessionId, freshStar… | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 1 | — |
| N2 | `native-session.ts:89` | 다른 값 | nativeSessionId: created.sessionId, → nativeSessionId: request.sess… | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 4 | — |
| N3a | `adapter.ts:680` | 맞바꿈 | ? { sessionId: nativeId ?? undefined } → ? { sessionId: sessionId ?? u… | 잡음 | adapter.fork.test.ts ‘recreates an expired conversation with …’ | — |
| N3b | `adapter.ts:681` | 맞바꿈 | { resume: req.forkFrom ?? nativeId ?? undefined… → { resume: req.forkFrom ?? ses… | 잡음 | adapter.fork.test.ts ‘routes resumed events, permissions and …’ | — |
| N3c | `adapter.ts:556` | 다른 값 | const nativeId = req.nativeSessionId ?? session… → const nativeId = sessionId | 잡음 | adapter.fork.test.ts ‘recreates an expired conversation with …’ 외 1 | — |
| N4 | `adapter.ts:527` | 다른 값 | return req.nativeSessionId && req.sessionId ? r… → return live | 잡음 | adapter.fork.test.ts ‘routes resumed events, permissions and …’ | — |
| N5a | `adapter.ts:948` | 다른 값 | req.onPermissionModeChanged?.(routeSessionId(ms… → req.onPermissionModeChanged?.… | 잡음 | adapter.fork.test.ts ‘routes resumed events, permissions and …’ | — |
| N5b | `adapter.ts:738` | 다른 값 | adaptHooks(extensions.hooks, routeSessionId) → adaptHooks(extensions.hooks) | 잡음 | adapter.fork.test.ts ‘routes resumed events, permissions and …’ | — |
| N5c | `adapt.ts:307` | 다른 값 | sessionId: routeSessionId(input.session_id ?? '… → sessionId: input.session_id ?… | 잡음 | adapter.fork.test.ts ‘routes resumed events, permissions and …’ | — |
| N6 | `send.ts:620` | 맞바꿈 | ...(forkNativeId ? { forkFrom: forkNativeId } :… → ...(continuitySource ? { fork… | 잡음 | send.worktree.test.ts ‘uses the native source for forkFrom and…’ 외 1 | — |
| N7a | `continuation.ts:40` | 제거 | ...(input.base.nativeSessionId ? { nativeSessio… → (삭제) | 잡음 | continuation.test.ts ‘첨부를 싣지 않고 프레임 위임을 전부 넘긴다’ | — |
| N7b | `resolve-turn.ts:124` | 다른 값 | ? (await query.nativeRecovery(payload.sessionId… → ? undefined : undefined | 못 잡음 | 입력 없음 — D18 출처 참조 | 이행 D18 |
| N8 | `native-history.ts:37` | 다른 값 | const nativeId = recovery?.native_id ?? session… → const nativeId = sessionId | 잡음 | native-session.restored-history.db.test.ts ‘keeps the archive searchable and follow…’ 외 1 | — |
| gV5 | `TranscriptViewport.tsx:735` | 다른 값 | if (input !== 'consumedPull') cancel() → cancel() | 잡음 | Q4b″ inertia 사례 최대 이동 308.7px | — |
| gV14 | `TranscriptViewport.tsx:513` | 다른 값 | (prevHeight !== undefined \|\| correcting) && → prevHeight !== undefined && | 잡음 | Q4b″ firstMeasurement 사례 4/5회 실패 | — |
| gE1 | `HistoryEdge.tsx:35` | 다른 값 | className={'${HISTORY_HEAD_HEIGHT} flex → className={'${state === 'load… | 잡음 | Q4b″ states 사례 7.25px | — |
| gV12 | `TranscriptViewport.tsx:835` | 제거 | if (footerRef.current) observer.observe(footerR… → (삭제) | 못 잡음 | Q4b″ 사례가 운반값을 재지 않음 | 이행 D14 |
| gV13 | `TranscriptViewport.tsx:289` | 다른 값 | const captured = activeAnchorRef.current ?? (el… → const captured = el ? capture… | 못 잡음 | Q4b″ 사례가 운반값을 재지 않음 | 이행 D14 |
| gV2 | `TranscriptViewport.tsx:716` | 제거 | \|\| nestedScrollConsumes(target, el, delta) → (삭제) | 못 잡음 | Q4b″ 사례가 운반값을 재지 않음 | 이행 D14 |
| Y6r | `reader.ts:116` | 다른 값 | if (keys.has(key)) alias(key, 'local', String(r… → if (keys.has(key)) void row | 잡음 | history-port.integration.test.ts ‘opens and refreshes the latest turn, th…’ 외 4 | — |
| gA1r | `anchor.ts:171` | 다른 값 | viewportOffsetPx: measureCharTop(targetEl, char… → viewportOffsetPx: targetEl.ge… | 잡음 | Q4b″ top 11.27px · middle 27.27px | — |

- 검산: 판정 231 = 잡음 124 + 못 잡음 88 + 못 잡음(단위) 3 + 동치 16. 못 잡음 88 = D11 22 · D12 16 · D13 9 · D14 10 · D15 5 · D16 14 · D17 7 · D18 4 · X1 1.
- 무효 2: Y6(`reader.ts:116` 한 줄 `if` 본문을 지워 esbuild `Unexpected "else"` — 33개 스위트 로드 실패)은 `void row`로 바꾼 Y6r로, gA1(Q4b″ 하네스 `SyntaxError: Unterminated string in JSON`)은 같은 변이 gA1r로 다시 돌렸다.
- 대조: 묶음마다 oracle 변경 없는 대조 실행(주석 한 줄 추가)이 green이었다(CTRL_d0·d1·e0·e1·f0·f1 · GCTRL).
- 잡음의 실패 이유: d·e·f·g 묶음과 ③ 재실행(re*)은 로그에서 실패 테스트와 단언을 읽었고 모두 변이가 흉내 낸 실수의 단언 실패였다(예: reS10 ‘rejects a different publication and retries the same ordinary cursor’ `expected true to be false`). a·b·c 묶음의 나머지 잡음은 실패 수만 관측했다.
- 원복: 묶음마다 `mutate.py`가 원복을 확인했고, 마지막 `git status --short`는 비어 있었다.

### ⑦ 전수 잔여 — 다음 verify의 범위 (verify 2 뒤)

| pair / §10 | 남긴 항목 |
|---|---|
| VP-11 | ΔV4 등록 변이 3 ‘하한 식으로 균분’ |
| VP-02·16 · EP4′ ①⑦⑧ | 세 화면 진입 intent, 새 행 마운트 → 선택 취소 승계, 하네스 pin 해제 공존 |
| VP-17 · EP4″ ④ (iii) | 창 안 하네스 쓰기 주입(등록 변이) · D-022 `consumedPull` `preventDefault` 제거의 Q4b″ 실행(단위는 V4 잡음) |
| VP-13 · EP6 ② | 선택(클릭·Enter) → 탐색 번호·라우트(`SearchModal`·`OverlayLayer`) |
| VP-10 · EP8 ① | 원본 소실 판정(`native-session.ts` `result.status === 'missing'`) |
| VP-18 · EP10 형제 | 계보 출발점에 `native_id`를 넣는 형제 맞바꿈(등록 변이) |

## 5. 사람 실기 경계 (verify 2)

AC10(Windows 설치본 S-E1~S-E5)만 사람 몫이다. 위 결함은 모두 기계 검증 범위다.

## 6. V-pair closeout (verify 2)

| Pair | 결과 | 근거 |
|---|---|---|
| VP-16 MD-04↔UT-04 | **PAIR_FAIL** (root) | D1~D3은 닫혔다. D14(EP4′ ②⑤·EP4″ ④⑤ 입력 공백)와 G1(PLAN_GAP)이 남았다 |
| VP-12 MD-02↔UT-02 | **PAIR_FAIL** (root) | D5는 닫혔다(S10 잡음). D13(거부 시 커서 진행 S14)이 남았다 |
| VP-08 AR-02↔IT-02 | **PAIR_FAIL** (root) | D4·D6·D8은 닫혔다. D11(창 응답·본문 검사 15자리)·D12 일부(취소)가 남았다 |
| VP-07 AR-01↔IT-01 | **PAIR_FAIL** (root) | D7은 닫혔다(P1 잡음). D17(EP1 ① 꼬리 경계 Y2·Y2b · ④ 이전 세대 삭제 X8)이 남았다 |
| VP-15 SD-05↔ST-05 | **PAIR_FAIL** (root) | D17(EP9 ② 새 전경 작업 앞자리 X2 · 라운드 로빈 X9 · ④ 삭제 취소 X7 · ⑤ `prepared` X5) |
| VP-14 MD-03↔UT-03 | **PAIR_FAIL** (root) | D9은 닫혔다(P5·P7 잡음, Q 대응표 실재). D15(창 캐시 후보 O7·resume P11)가 남았다 |
| VP-05 SD-02↔ST-02 | **PAIR_FAIL** (root) | D10(현재 TODO 위치 — 재현), D16(패널 fold·live 권위·상세·인계) |
| VP-10 AR-04↔IT-04 | **PAIR_FAIL** (root) | D18(분기 사본 native 바인딩 FK1·산출물 FK2·native 접미 FK5) |
| VP-18 AR-05↔IT-05 | **PAIR_FAIL** (root) | D18(EP10 ⑦ `resolve-turn.ts:123` N7b). ①~⑥·⑧ 변이는 모두 잡음 |
| VP-13 SD-04↔ST-04 | **PAIR_FAIL** (root) | D13(EP6 ⑧ rejected 분기 J2·J3 · ‘최신 대화로’ 기존 이력 분기 L4) · D15(행 매칭·강조 수명 V17·SR7·SR10) |
| VP-09 AR-03↔IT-03 | BLOCKED_BY:VP-14 | target 경로 공유. locator 발급 F1~F4는 잡음 |
| VP-02 R-02↔AT-02 | BLOCKED_BY:VP-16 | |
| VP-04 SD-01↔ST-01 | BLOCKED_BY:VP-16 | |
| VP-01 R-01↔AT-01 | BLOCKED_BY:VP-07 | |
| VP-03 R-03↔AT-03 | BLOCKED_BY:VP-05 | |
| VP-19 SD-06↔ST-06 | PASS(돌린 범위) | EP10 ①②③⑦⑧ 중 ⑦은 VP-18 D18. Q14 좌표 `native-session.restored-history.db.test.ts` ‘keeps the archive searchable…’가 N1·N2·N8을 잡는다 |
| VP-11 MD-01↔UT-01 | PASS(돌린 범위) | R1·R2·Z1~Z5 잡음. 등록 변이 3은 잔여 |
| VP-17 MD-05↔UT-05 | PASS(돌린 범위) | A1(단위 10 red)·gV14(Q4b″ firstMeasurement). (iii)은 잔여 |
| VP-06 SD-03↔ST-03 REGRESSION | PASS | 전체 Vitest에서 0326 스위트 red 0, Q4b″ 대조 실행 통과 |

## 7. 숫자 재측정 (verify 2)

- Vitest 전체: 파일 9 failed / 1,137 passed / 4 skipped(1,150), 케이스 22 failed / 10,831 passed / 1 expected fail / 11 skipped(10,865). 구현 보고와 같다. 실패 9파일은 verify 1 기준선과 같은 목록이고 이번 diff(`2d730c29..4e84dd6b`)와 교집합 0이다.
- Node 스크립트 테스트: 1,104/1,104(`# fail 0`).
- Q4b″ 대조 실행(GCTRL): 판정 통과, 사례별 최대 이동은 방향 전환·만료 사례 밖 0.39px 이하.

## 8. gate (verify 2)

| 단계 | 결과 |
|---|---|
| `check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · `check-ui-thread` | 5/5 exit 0 (`append-only ok since v0.3.1` · `9 items, 127 channels` · `2742파일` · `18 real-git suites ok` · `OK`) |
| `npm run typecheck` | exit 0 (node·web·test) |
| `npm run lint` | exit 0 · 오류 0 · 경고 12. 실행 전후 `git status --short` 같음(빈 출력) |
| `./node_modules/.bin/vitest run`(필터 없음) | 22 failed — 실패 9파일(`adapter.native-plugins`·`native-resources`·`project-reconciliation`·`opencode/v1/adapter{,.instances,.persistent}`·`composer-catalog`·`composer-preparation-service`·`session-resources.claude-assembly`)이 verify 1 기준선과 같고 이번 diff와 교집합 0. Windows 경로 단언(로그에 `C:` 경로·win32 21줄). 비귀속 N1 |
| `node --test scripts/*.test.mjs` | 1,104/1,104 |
| `npx electron-vite build` · `smoke-hosts` · `smoke-preload out/preload` | exit 0 (`[smoke-hosts] OK` · `smoke-preload: OK`) |
| `xvfb-run -a node scripts/check-transcript-history.mjs` | exit 0 |

환경: 이전 세션의 Node ABI `better-sqlite3`를 그대로 썼다(`require('better-sqlite3')(':memory:')` 성공). 커밋 대상은 아니다.

## 9. Repository operation checks (verify 2)

- trailer: `git log -1 --format='%(trailers:only=true)' 4e84dd6b`가 `Agent: codex`·`Handoff`·`Status: implemented`·`Criteria-Met: 11/12`·`Criteria-Pending`·`Verified-By: pending`을 돌려준다. 본문의 ✅ 11 · ⚠️ 1 = 12와 같다.
- `[구현자 기입] r2` 일곱 필드: 7/7 있다. 강제 지점 표는 pair마다 `남긴 곳`을 적고 14개 pair를 SELF_BLOCKED로 인계했다.
- 대상 커밋 좌표: `4e84dd6b`는 `git cat-file -t` = commit, `origin/main` 조상 아님(브랜치 미병합). r1~r1.5 해시 5개도 `origin/main` 조상이 아니다. INDEX에는 브랜치 해시로 적는다.
- INDEX 행: 구현자가 `impl/IMPL_DONE`·다음 Claude로 바꿨다. 이번 커밋에서 `verify/RETURN_TO_PLAN`·다음 Claude(설계)로 고친다.

## 10. 사람 vs 에이전트 (verify 2)

AC10 Windows 실기만 사람에게 넘긴다. G1·X1은 제품 의미가 걸린 설계 판단이지만 D-009·D-015 안의 정합 문제라 설계자가 정정한다. 사용자 결정이 필요하다고 판단되면 설계 턴이 올린다.

## 11. 발견과 disposition (verify 2)

| # | 발견 | 출처 원문 | 분류 | disposition |
|---|---|---|---|---|
| G1 | 검색 보기 한쪽 방향 오류 시 반대쪽 유휴 채움을 계속하는가가 정해지지 않았다. r2는 멈춘다(`idleSearchDirection.ts:11`) | §10 ‘한 턴과 조각’ “오류 없음” ↔ ‘양방향 커서·끝’ “한 방향 실패가 다른 방향을 막지 않는다” | 이행(plan 내부 불일치) | **PLAN_GAP** |
| X1 | ‘최신 대화로’ 반복 입력 시 중복 요청 억제(`chatStore.ts:2724` `returning`)가 잠기지 않았다(L3) | 열거 원문 없음 | 확장(창 안) | **PLAN_GAP** — 채택 또는 경계 선언 |
| D10 | 앞삽입 뒤 OpenCode 현재 턴 TODO에 이전 턴 TODO가 보인다 — `openCodeTodoTurnStartIndex`(`chatReducer.ts:1043`)가 PREPEND_HISTORY(`:1701`)에서 옮겨지지 않는다. 독립 축 (a) 재현 | EP7 ⑥ “현재 턴 TODO 위치” · AC7 “OpenCode 현재 TODO … live 소유자를 따른다” · §5-C 표 “OpenCode 현재 턴 TODO … 어느 안이든 항상 보인다” | 이행(현재 결함 재현) | BLOCKING |
| D11 | 창 응답·본문 검사 미잠금: T4·T6~T13·T15(`session-load.ts:110-164`), DB4~DB7·DB10(`deferredBody.ts:57-85`), O2~O4(target useCached·대상 포함), R7(RESOLVE ref 일치), W6(`missing`↔`unavailable`), PQ1·PQ4(패널 세대·세션) | §10 요청/응답 “창도 일치 여부를 검사” · 본문 “ref는 세션·세대·메시지/part 키·kind·원문 바이트 길이에 결합” · EP2 ④ · EP3 ④ | 이행 | BLOCKING |
| D12 | 취소·늦은 응답 미잠금: S12(검색 seq — 같은 hit 재선택 뒤 같은 커서 응답), S13(이전 턴 응답의 history 동일성), T14·DB1·DB9·B1~B6(본문 읽기 중 취소·전환), L2·W5·O6·O8·EC1 | §10 ‘양방향 커서·끝’ “다른 navigationId의 응답은 적용 0” · 본문 “종료·오류·취소 시 부분 자료를 완성본으로 승격하지 않는다” · 사용자 제어 “이전 번호의 … pending request … 취소” · EP5 ②③ · Q6e ‘늦은 이전 navigationId 응답 적용 0’ | 이행 | BLOCKING |
| D13 | 거부·끝 표식·보류 미잠금: S14(거부된 앞삽입에서 커서 진행), J2·J3(합류 rejected), R6·R8·R9(지연 본문이 남았을 때 보류 정리), W3·W4(LOAD 끝 표식·history 창), L4 | §10 ‘빈 결과·겹침·오류’ “거부는 커서·끝 갱신 0” · ‘B의 끝 표식’ “유효한 보류를 고아로 버릴 수 없다” · EP5 ⑤ · EP6 ⑧ 분기 ‘세대 교체로 rejected’ · ‘하단 슬롯’ “엔트리에 최신 묶음이 없으면” | 이행 | BLOCKING |
| D14 | 입력·앵커 미잠금: V2·gV2(중첩 스크롤 제외 — 단위·Q4b″ 모두 green), V7(PageUp 요청), V8(키 반복), V16(store 거절 시 `consumedPull` 차단), E2(당김 표시), V12·gV12(하단 크기 변화 재예약), V13·gV13(활성 앵커 재사용) | EP4′ ② 분기 ‘위로 더 갈 수 있는 중첩 코드 블록 안 · 맨 위인 중첩 블록 안’ · ⑤ “키·버튼은 각 1회” · ③ ‘대기→당김→스피너’ · EP4″ ④ (ii) “머리/하단 크기 … 변화” · ⑤ “요청을 시작한 wheel과 consumedPull은 preventDefault” | 이행 | BLOCKING |
| D15 | 검색 표시·복귀 미잠금: V17(Work 묶음 행 매칭), SR7(최초 포커스 복귀), SR10(부분 가시 행 위치), P11(방문 resume 재해소), O7(보유하지 않은 캐시 후보 전송) | §10 ‘표시되는 지점’ “묶인 Work 활동 … 대상 소유 ID를 가진 표시 행” · ‘행 강조 수명’ · ‘이동 기록’ “방문별 세션·메시지 앵커를 재확인” · ‘캐시와 문맥’ “창은 실제로 보유한 세대/메시지 키” · EP6 ④⑤⑥③ | 이행 | BLOCKING |
| D16 | 패널 미잠금: K1·K2(기준점 이후 fold), K3~K5(live 권위), K6·K8·K9(상세 요청 검사), K11·K12(stale 재시도·늦은 응답), PQ3·PQ5(커서 기준점·행 상한), H1·H2(인계 user 수) | EP7 ②~⑤⑦ · Q7 ‘기준점 직전·직후’·‘상세 요청 1회’·‘인계’ | 이행 | BLOCKING |
| D17 | 색인·출판 미잠금: Y2·Y2b(로컬 꼬리 경계), Y6r는 잡음, X2(새 전경 작업 앞자리), X5(`prepared.sourceBytes`), X7(삭제 세션 취소), X8(이전 세대 삭제), X9(라운드 로빈) | EP1 ①④ · EP9 ②④⑤ · Q9b ‘우선 승격’·‘진행 중 삭제 → 취소’ | 이행 | BLOCKING |
| D18 | 분기·복구 ID 미잠금: FK1(분기 사본 native 바인딩), FK2(산출물 사본), FK5(native 접미 경계), N7b(`resolve-turn.ts:123` 다음 턴 `native_id`) | EP8 ③④ · EP10 ⑦ “복구 행 `native_id`를 `nativeSessionId`로” | 이행 | BLOCKING |
| N1 | Vitest 22건 red(Windows 경로, diff 밖 9파일) — verify 1과 같다 | — | 비귀속 | NON_BLOCKING |

설계자는 G1을 한 규칙으로 고정하고 X1을 채택하거나 경계로 선언한다. 이번이 열거 원문을 늘릴 수 있는 마지막 설계 턴이다(verify 2회째 뒤 동결). 구현자는 D10을 코드로 고치고 D11~D18의 각 변이가 red가 되도록 입력을 더하거나 동치를 코드 근거와 확인 실행으로 보인다.

## Review Signals — 사실만 (verify 2)

- verify 1의 못 잡음 14건이 모두 잡혔다. 같은 증상의 재발은 0이다.
- 이번 못 잡음 88건은 모두 verify 1이 ⑦ 잔여로 넘긴 자리에서 나왔다. r2는 잔여 sweep을 하지 않았고 인계만 했다(`[구현자 기입] r2` 강제 지점 표 ‘남긴 곳’).
- 독립 축 2개에서 발견 2건(D10 이행·현재 결함 재현, G1 plan 내부 불일치)이 나왔다.
- 검증 환경 한계: AC10 Windows 실기. Q4b″ 하네스가 한 번 JSON을 잘라 냈다(gA1, 재실행으로 판정).
- 하네스 비용: 변이 225개 × 스위트 재실행(main 약 20초, 렌더러 3,447건 약 1.5분, Electron 약 1.6분).

---

# verify 1회째 기록

## 판정 — verify 1회째: **FAIL**

막는 발견 9건은 모두 이행 결함이다. 그중 1건(D1)은 현재 동작이 ΔV4 규칙을 어기는 것으로 재현됐고, 나머지는 열거된 분기·입력이 테스트로 잠기지 않은 것이다. PLAN_GAP과 확장 후보는 0이므로 다음 주체는 구현자다. ⑦ 전수 잔여도 남아 있어 이 결함들을 고쳐도 다음 verify가 그 잔여를 이어서 돈다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0329-turn-history-paging` |
| 검증자 | Claude Code |
| 일자 | 2026-11-25 |
| 대상 커밋/range | `2d730c29..6b063bb0`(app 129파일 +9,787/−1,652). 구현 커밋 `53c63ce9`·`49643299`·`70d72f5f`·`05f65255`·`6b063bb0` — 모두 브랜치 `ccr-ca3d795a-2t0cmj`, `origin/main`(`d8684684`) 미병합 |
| 구현 전 plan 기준 | `2d730c29`(V1 rev 5) · ΔV1 `355697de` · ΔV2 `851788f9` · ΔV3 `8769b537` · ΔV4 `2bc18d63` |
| V mode / 유효 V | Baseline V V1 rev 5 + ΔV1~ΔV4 |
| 라운드 | 1 |
| 상태 | FAIL |
| 확장 창 | verify 1회째 — 창 안. 사용자 요구 변경 ΔV3(D-023)의 노드 R-03·SD-06·AR-05도 창 안 |
| 독립 축(⑥) | 2축. (a) 검색 보기에서 대상 턴 앞·뒤 잔여가 모두 있을 때의 유휴 채움 순서 → D1. (b) §19-4가 정한 투영 독립 fixture(보관본 끝 + 첫 native 메시지가 같은 턴, 연속 user, 같은 시각) → 통과 |
| 열거 sweep(⑦) | 1회째 전수 대상. 이번에 돌린 항목 44(EP3 ⑤ 규칙 칸 분기, EP2·EP5·EP6 요청·응답 검사 자리, EP1 ④·EP3 본문, 등록 변이 5). 못 잡음 14. **전수 잔여 있음**(§4 목록) → PASS 불가, 다음 verify로 넘어간다 |
| 발견 분류 | 이행 9(현재 결함 재현 1 포함) · 현재 0(D1은 열거 원문 위반으로 분류) · 확장 0 · 경계 0 · 비귀속 1(기존 Vitest 22건) |
| 구현 주체·문맥 | Codex 구현. 이번 plan rev 5·ΔV1~ΔV4는 Claude Code가 설계했으므로 plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 plan 규범 행을 바꿨는가: 아니오. `6b063bb0`의 plan diff는 머리말·메타 상태와 `[구현자 기입] r1.5` 절뿐이다(`git diff 2bc18d63 6b063bb0 -- docs/handoff/0329-turn-history-paging/plan.md`).
- 기준선이 diff로 성립하는가: 예. 설계 커밋(`2d730c29`·`355697de`·`851788f9`·`8769b537`·`2bc18d63`)과 구현 커밋이 분리돼 있다.
- Decision·Product/UX·AC·V·§10 변경: ΔV1~ΔV4는 설계 커밋이다. 이 중 사용자 결정에서 나온 것은 ΔV3 D-023·D-024 하나다(§2 원문 인용).
- 채점 기준: V1 rev 5 + ΔV1~ΔV4의 §10 계약 행, EP1~EP10, Q 좌표, §23 응답 채움 행.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·상속 | 유효 | Baseline V + ΔV1~ΔV4가 순서대로 노드를 고친다(§20-C·§21-C·§22-C·§23-C) |
| NEW/CHANGED ↔ REQUIRED pair | 유효 | ΔV4 MD-01 CHANGED ↔ VP-11 REQUIRED. ΔV3 R-03·SD-06·AR-05 ↔ VP-03·19·18 |
| INHERITED ↔ REGRESSION | 유효 | VP-06(0326 고정 ID·보류·pin) REGRESSION |
| §10 자리 목록·oracle | 유효 | 이번 발견은 모두 기존 자리·Q 입력 칸에서 인용된다. 목록 밖 운반 자리는 찾지 못했다 |
| 운영 gate | 유효 | §19-3이 `app/AGENTS.md` CI 대응 명령 전부를 열거한다 |

root PLAN_GAP 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 | 실제 production path |
|---|---|---|
| D-003·D-006·D-007 | 최신 턴 끝 묶음 → 이전 턴 1회씩 | `oo.ts:366` `loadLatest` → `session-load.ts:131` `readHistoryPage` → `chatStore.ts:483-497` LOAD+history → `readPrevious` `:2820` |
| D-009 | 같은 턴 잔여만, 유휴 1묶음씩, 직전 commit 전 다음 요청 0 | `useHistoryControls.ts:42-64` → `readPrevious`/`readSearchEdge(…, true)` |
| D-013·D-015 | 검색 대상 묶음 → 양방향 → 최신 합류 | `history-page.ts:162-172` target → `chatStore.ts:2763` `readSearchEdge` → `:2561` `joinSearchAtLatest` |
| D-010·D-012 | 세션 전체 패널 요약 | `history-panel-queries.ts` → `projection.ts:634-651` → `historyPanels.ts` |
| D-018 | 미색인 세션 우선 색인 후 `ok` | `session-load.ts:124` `index.prepare` → `history-index-queries.ts:375-410` 조각·출판 |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 동시 요청 | ❌ D1 | 검색 보기에서 `before` 유휴 요청이 진행 중이면 같은 effect가 `after`로 넘어가 두 번째 유휴 요청을 예약한다(`useHistoryControls.ts:43-48`) |
| false success | ✅ 관측 없음 | 창 transport가 echo·세대·ID 중복·part 상한·deferredBody 결합을 검사한다(`session-load.ts:111-165`) |
| 부분 실패·출판 | ✅ | 이전 세대는 출판 뒤에만 지운다(`history-index-queries.ts:403-410`). 독립 fixture도 통과 |
| refresh가 읽은 과거 턴을 버리는가 | ✅ | refresh 결과는 `isCurrent()`가 같은 `messages` 배열일 때만 적용한다(`chatStore.ts:2064-2070`). 앞삽입 뒤 refresh는 적용되지 않는다 |
| worst-case 응답 | ✅ | 메시지 128·part 256·256 KiB 안에서 탐욕 채움(`history-page.ts:202-260`). 등록 변이 R1·R2 red |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 2d730c29..6b063bb0` — 대상 83파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| `INDEX_SLICE_MS` 미사용 export | 정상 | 같은 파일 `history-index-queries.ts:376`에서 쓴다. export만 외부 참조 0 |
| `HistoryBodyRefSchema` 미사용 export | 정상 | 스키마 조합 내부에서 쓴다. 비귀속 |
| 테스트 전용 심볼 | 변경 무관 | 목록의 `adapt.ts`·`migrate.ts` 등은 이번 diff 전부터 있다 |
| 같은 규칙의 이중 구현 | 관측 | 유휴 채움 조건이 훅(`useHistoryControls.ts:43-49`)과 store(`chatStore.ts:2775`·`:2829`)에 이중으로 있다. 한쪽을 지운 변이는 다른 쪽이 가려 `동치`다(§4) |

## 4. 증거 재측정

- **plan Q 좌표 실재**: Q1(`turn-page.db.test.ts`)·Q3′ ‘greedy maximal…’·Q4 ‘three harnesses’·Q7 2파일·Q8 main·Q9b 파일은 있다. **Q2(`history-port.integration`·`history-open.integration`)·Q3(`history-body.integration`·`TranscriptViewport.body`)·Q5(`history-races`)·Q5b(`history-draft.integration`)·Q6a~e 테스트명·Q6d/e `history-search.integration`·Q8 `paged-fork`·Q9 `turn-index.upgrade.db`는 그 경로·이름으로 없다**(`rg -lF '<테스트명>' app/src` 0건). 구현자는 `history-search.test.ts`·`session-load.test.ts`·`ComposerInputController.session.test.ts`·`turn-page.db.test.ts`로 대체했다고 보고했지만, 강제 지점 표에 Q별 `파일:테스트명` 대응이 없다 → D9.
- **등록 변이(①)**: R1 메시지 상한 127 · R2 part 상한 제거 · R3 진행 ordinal 저장 제거(EP9 ④) · R4 작업 제거 무시 · R5 스냅샷 제거 무시(EP7 ①) — 5/5 red. 돌리지 않은 등록 변이는 ⑦ 잔여 목록에 있다.
- **③·④**: 첫 verify라 해당 없음.
- **독립 축(⑥)**: (a) → D1 재현. 임시 테스트(트리에 남기지 않음)로 `view={before:withinTurn,after:withinTurn}` → idle → `readSearchEdge` 1회 → `beforeState:'loading'` 커밋 → 예약된 idle 수 기대 0, 실제 1(`expected 1 to be +0`). (b) 보관본 `[n:a1 user, n:a2 assistant]` + native `[c1 a, c2 a(같은 시각), u2 u, u3 u, r2 a]` → 전체 원본 턴 `[[a1,a2,c1,c2],[u2,u3,r2]]`, 최신에서 `before`를 따라 모은 페이지가 같다(1/1 통과).
- **열거 sweep(⑦)**: `mutate.py` 44건(아래 고장 이력). 기본 변이는 그 항 하나만 바꿨다. `동치` 17건은 남은 쪽 가드가 같은 입력을 거절한다는 코드 근거와 원 변이의 green으로 적었다.

### 고장 이력

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 / 동치 근거 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| I1 | `useHistoryControls.ts:54` | 제거 | `dragging ||` 삭제 | 못 잡음 | 테스트의 pointerdown이 시간 창도 같이 열어 드래그 단독 분기를 가르지 못한다 | ⑦ EP3 ⑤ 입력 중 보류 | 이행 D2 |
| I2 | `:54` | 제거 | `performance.now() < until` → `false` | 못 잡음 | wheel·키 입력 중 유휴 입력이 없다 | ⑦ 같음 | 이행 D2 |
| I3 | `:49` | 제거 | `|| page.beforeState` 삭제 | 잡음 | `useHistoryControls.test.ts` ‘requests one same-turn page…’ | ⑦ 직전 요청 완료·오류 정지 | — |
| I4 | `:49` | 제거 | `before.kind !== 'withinTurn'` → `!before` | 잡음 | 같은 테스트 | ⑦ 같은 턴 한정 | — |
| I5 | `:44` | 제거 | `&& !view.beforeState` 삭제 | 동치 | store `chatStore.ts:2774` loading 가드가 요청을 막는다(S9 red) | ⑦ | — |
| I6 | `:46` | 제거 | `&& !view.afterState` 삭제 | 동치 | 같은 가드 | ⑦ | — |
| I7 | `:46` | 제거 | `after.kind === 'withinTurn'` → `after` | 동치 | store `:2775` automatic 가드가 다음 턴 요청을 거절한다 | ⑦ | — |
| I8 | `:56` | 제거 | `readSearchEdge(key, dir, true)`의 `true` 삭제 | 동치 | 훅이 같은 턴·무오류일 때만 부른다(`:44-46`) | ⑦ | — |
| I9 | `:62` | 제거 | `cancelIdleCallback` 삭제 | 잡음 | 같은 테스트(언마운트 뒤 idle 0) | ⑦ 전환·닫기 해제 | — |
| I10 | `:63` | 제거 | `clearTimeout` 삭제 | 동치 | 늦은 타이머의 요청은 store 활성 키·보기 가드에서 false(`:2773`·`:2827`) | ⑦ | — |
| I11 | `:27` | 제거 | wheel 리스너 삭제 | 못 잡음 | I2와 같은 공백 | ⑦ | 이행 D2 |
| I12 | `:28` | 제거 | keydown 리스너 삭제 | 못 잡음 | I2와 같은 공백 | ⑦ | 이행 D2 |
| I13 | `:45` | 맞바꿈 | 첫 분기 `'before'` → `'after'` | 못 잡음 | 검색 보기 유휴 채움 입력이 없다 | ⑦ ⑤ 같은 턴 한정(검색 대상 턴) | 이행 D3 |
| S1 | `chatStore.ts:2829` | 제거 | automatic `edge.kind` 검사 삭제 | 동치 | 훅 `:49` 가드(I4 red) | ⑦ | — |
| S2 | `:2829` | 제거 | automatic `error` 검사 삭제 | 동치 | 훅 `:49` 가드(I3 red) | ⑦ | — |
| S3 | `:2775` | 제거 | automatic `edge.kind` 검사 삭제 | 동치 | 훅 `:44-46` kind 조건 | ⑦ | D3이 같은 분기의 입력 공백을 다룬다 |
| S4 | `:2775` | 제거 | automatic `error` 검사 삭제 | 동치 | 훅 `:44-46` state 조건 | ⑦ | 같음 |
| S5 | `:2773` | 제거 | `activeKey !== key` 삭제 | 동치 | `TranscriptView.tsx:14` 훅·컨트롤 키가 `useActiveSessionKey()` | ⑦ | — |
| S6 | `:2827` | 제거 | `key !== activeKey` 삭제 | 동치 | 같은 근거 | ⑦ | — |
| S7 | `:2798` | 제거 | 응답 세대 ≠ 보기 세대 검사 삭제 | 못 잡음 | 다른 세대 `ok` 응답 입력이 없다 | ⑦ EP5 ③ | 이행 D4 |
| S8 | `:2849` | 제거 | 응답 세대 ≠ history 세대 검사 삭제 | 못 잡음 | 같음 | ⑦ EP5 ③ | 이행 D4 |
| S9 | `:2774` | 제거 | 검색 방향 loading 가드 삭제 | 잡음 | 6 렌더러 스위트 중 1 red | ⑦ | — |
| S10 | `:2828` | 제거 | 이전 턴 loading 가드 삭제 | 못 잡음 | 같은 커서 중복 요청 입력이 없다 | ⑦ EP5 ① | 이행 D5 |
| C1 | `history-page.ts:53` | 제거 | 커서 세션 검사 삭제 | 잡음 | `src/main/features/history` 1 red | ⑦ EP2 ② | — |
| C2 | `:54` | 제거 | 커서 종류 ≠ 요청 종류 검사 삭제 | 못 잡음 | 종류 혼용 입력이 없다 | ⑦ §10 요청/응답 | 이행 D6 |
| C3 | `:55` | 제거 | 커서 방향 검사 삭제 | 못 잡음 | 같음 | ⑦ 같음 | 이행 D6 |
| C4 | `:59` | 제거 | 커서 세대 ≠ 출판 세대 → stale 삭제 | 동치 | 출판 시 이전 세대 행을 지워(`history-index-queries.ts:408`) `header()`가 없음 → 같은 `stale` | ⑦ | — |
| C5 | `:61` | 제거 | message_key 대조 삭제 | 동치 | 한 세대 안의 ordinal→key는 불변(같은 세대 local append는 새 ordinal만 더함 `:328-336`) | ⑦ | — |
| C6 | `:63` | 제거 | withinTurn ↔ 같은 턴 일치 검사 삭제 | 동치 | 커서 종류는 같은 세대 헤더로 발급 시 계산되고(`:20-31`) 턴 번호는 세대 안에서 불변 | ⑦ | — |
| P1 | `:85` | 제거 | `published_revision !== revision` → stale 삭제 | 못 잡음 | `prepare()`와 읽기 사이 revision 변경 입력이 없다 | ⑦ EP1 ④ · Q9 ‘commit 직전 경쟁’ | 이행 D7 |
| P2 | `:91` | 제거 | 메타 ref 세션 검사 삭제 | 잡음 | 1 red | ⑦ | — |
| P3 | `:113` | 제거 | 본문 ref 바이트 길이 대조 삭제 | 못 잡음 | 길이가 다른 ref 입력이 없다 | ⑦ §10 본문 | 이행 D8 |
| P4 | `:157` | 제거 | visit 세대 검사 삭제 | 잡음 | 1 red | ⑦ | — |
| P5 | `:166` | 제거 | locator epoch 대조 삭제 | 못 잡음 | 새 archive의 같은 순번 locator 입력이 없다 | ⑦ Q6a | 이행 D9 |
| P6 | `:164` | 제거 | locator 세션 검사 삭제 | 동치 | `byAlias(id, …)`가 다른 세션 alias를 찾지 못해 `missing` — 이동 0으로 같다 | ⑦ | — |
| P7 | `:171` | 다른 값 | target `useCached`의 messageKey 대조 삭제 | 못 잡음 | ‘동일 세대이지만 다른 캐시 키’ 입력이 없다 | ⑦ Q6b | 이행 D9 |
| P8 | `:109` | 제거 | 본문 ref 세션 검사 삭제 | 잡음 | 1 red | ⑦ | — |
| P9 | `:210` | 제거 | latest 뒤쪽 이웃 차단 삭제 | 동치 | latest의 시작은 최대 ordinal이라 `header(+1)`이 없다 | ⑦ | — |
| P10 | `:244` | 제거 | `messages.length &&` 삭제 | 동치 | 빈 페이지에서는 `available`과 `fitsAlone`이 같은 양을 재서 둘이 동시에 참일 수 없다 | ⑦ | — |
| R1 | `:202` | 다른 값 | 메시지 상한 128 → 127 | 잡음 | `turn-page.db.test.ts` ‘greedy maximal…’ 4 red | ① ΔV4 | — |
| R2 | `:240` | 제거 | part 상한 판정 삭제 | 잡음 | 같은 파일 2 red | ① ΔV4 | — |
| R3 | `history-index-queries.ts:387` | 제거 | `next_ordinal` 저장 삭제 | 잡음 | `turn-index.job.db`·`turn-page.db` 3 red | ① EP9 ④ | — |
| R4 | `projection.ts:640` | 제거 | 작업 removed 무시 | 잡음 | `panel-summary.db.test.ts` 1 red | ① EP7 | — |
| R5 | `projection.ts:645` | 제거 | 스냅샷 제거 무시 | 잡음 | 같은 파일 1 red | ① EP7 | — |

- 검산: 시도 44 = 잡음 13 · 못 잡음 14 · 동치 17 · 경계 0. 못 잡음 14는 모두 이행(D2 4 · D3 1 · D4 2 · D5 1 · D6 2 · D7 1 · D8 1 · D9 2).
- 각 `잡음`의 실패 이유는 변이가 흉내 낸 실수에서 나온 단언 실패였다. 상태를 공유하는 묶음 실행이 없어 좌표별 재실행은 하지 않았다.
- 원복은 `mutate.py`가 확인했고, 실행 뒤 `git status --short`는 비어 있었다.

### ⑦ 전수 잔여 — 다음 verify의 범위

| pair / §10 | 남긴 항목 |
|---|---|
| VP-01·07 · EP1 ①②③⑤ | local 쓰기·native replace/binding·archive prepare 자리 기본 변이. 등록 변이 ‘전량 읽고 slice’(⑤) |
| VP-08 · EP2 ①③④⑤ · EP3 ①③④ | 창 호출·reader·조립·LOAD 단일 공개 자리. 본문 분할·UTF-8 복원·취소 자리 |
| VP-11 | ΔV4 등록 변이 3 ‘하한 식으로 균분’ |
| VP-02·12·16·17 · EP4′·EP4″ | 머리 슬롯·제스처 분류·앵커 캡처/복원 자리, Q4b″ 등록 변이 2(앵커 복원 제거·간격 판정 제거) |
| VP-02 · EP5 ②④⑥ | 세션 닫기 취소·reducer 보류 병합 자리. Q5b 등록 변이(송신 대상 맞바꿈) |
| VP-03·09·13·14 · EP6 ①②④⑤⑥⑦⑧ | FTS locator 발급, 선택→라우트, 행 마운트·강조 수명·취소, 하단 슬롯, `joinSearchAtLatest` 분기 4(최신 묶음 있음·cold·live 꼬리·rejected) |
| VP-05 · EP7 ②~⑦ | fold·상세 요청·실시간 권위·인계·현재 TODO·세 표시 상태 |
| VP-10 · EP8 ①~④ | 복구 판정·프롬프트 예산·분기 범위·물질화 |
| VP-15 · EP9 ①②③⑤ | 최근 순서·우선 승격·조각 양보·출판 뒤 응답. 등록 변이 ‘출판 포인터 선행 교체’ |
| VP-18·19 · EP10 ①~⑧ | ΔV3 복구 키 자리 전부 |

## 5. 사람 실기 경계

AC10(Windows 설치본 S-E1~S-E5)만 사람 몫이다. Linux Electron Q4b″는 이번에 다시 돌렸다(§8).

## 6. V-pair closeout

| Pair | 결과 | 근거 |
|---|---|---|
| VP-16 MD-04↔UT-04 | **PAIR_FAIL** (root) | D1·D2·D3 — EP3 ⑤ 유휴 채움 분기 |
| VP-04 SD-01↔ST-01 | BLOCKED_BY:VP-16 | 같은 턴 유휴 채움 경로가 VP-16 결함을 지난다 |
| VP-08 AR-02↔IT-02 | **PAIR_FAIL** (root) | D4(창 세대 재검사), D6(data 종류·방향 혼용 거부), D8(본문 ref 길이) |
| VP-12 MD-02↔UT-02 | **PAIR_FAIL** (root) | D5(이전 턴 중복 요청 억제) |
| VP-02 R-02↔AT-02 | BLOCKED_BY:VP-12 | AC3′ ‘반복·동시 입력 1회’가 같은 가드를 지난다 |
| VP-07 AR-01↔IT-01 | **PAIR_FAIL** (root) | D7(출판 revision 경쟁) |
| VP-01 R-01↔AT-01 | BLOCKED_BY:VP-07 | AC9 공개 세대 경로 공유 |
| VP-14 MD-03↔UT-03 | **PAIR_FAIL** (root) | D9(locator epoch·캐시 키) |
| VP-09·13·03 | BLOCKED_BY:VP-14 | 검색 target 경로 공유 |
| VP-11 MD-01↔UT-01 | PASS(돌린 범위) | R1·R2 red, `turn-page.db.test.ts` ‘greedy maximal…’ 실재. 등록 변이 3은 ⑦ 잔여 |
| VP-06 SD-03↔ST-03 REGRESSION | PASS | 전체 Vitest에서 0326 스위트(`TranscriptViewport.prepend`·`chatReducer.prepend` 포함) red 0 |
| VP-17 | PASS(돌린 범위) | Q4b″ gate 재실행 150/0. 등록 변이는 ⑦ 잔여 |
| VP-05·10·15·18·19 | 미판정 | 이번 verify에서 돌린 것은 R3~R5(잡음)뿐이다. 자리 sweep은 ⑦ 잔여에 있다 |

## 7. 숫자 재측정

- Vitest 전체: 파일 9 failed / 1,135 passed / 4 skipped(1,148), 케이스 22 failed / 10,816 passed / 1 expected fail / 11 skipped(10,850). 구현 보고와 같다.
- Node 스크립트 테스트 1,104/1,104 통과. Q4b″ 레코드 150 · 폐기 0 · 실패 0 · 검색 선택 6.
- AC11 긴 구 DB 첫 클릭(2,103.2 ms 보고)은 다시 재지 않았다(`measure-stage-e.mjs`는 Electron ABI가 필요하고 이 세션은 Node ABI로 DB 스위트를 돌렸다).

## 8. gate

| 단계 | 결과 |
|---|---|
| `check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · `check-ui-thread` | 5/5 exit 0 |
| `npm run lint` | exit 0 · 오류 0 · 경고 12. 실행 뒤 작업 트리 변화 없음 |
| `npm run typecheck` | exit 0(node·web·test) |
| `./node_modules/.bin/vitest run`(필터 없음) | 22 failed — 실패 9파일이 모두 이번 diff 밖이고 `C:/…` 경로·Windows 전용 단언(`adapter.native-plugins`·`project-reconciliation`·`composer-catalog` 등). 비귀속 기준선 |
| `node --test scripts/*.test.mjs` | 1,104/1,104 |
| `npx electron-vite build` · `smoke-hosts` · `smoke-preload out/preload` | 모두 OK |
| `xvfb-run -a node scripts/check-transcript-history.mjs` | exit 0 · 150 레코드 · 실패 0 |

환경: 이 세션에서 `npm rebuild better-sqlite3`(Node ABI)를 실행해 DB 스위트를 돌렸다. 커밋 대상은 아니다.

## 9. Repository operation checks

- trailer: 구현 커밋 5개 모두 `git log -1 --format='%(trailers:only=true)'`가 `Agent`·`Handoff`·`Status`·`Criteria-*`·`Verified-By`를 돌려준다.
- `[구현자 기입] r1.5` 일곱 필드: 7/7 있다. 다만 잠금 표에 `S/N` sweep 행과 검산 줄이 없고, 15개 pair를 `SELF_BLOCKED`로 인계했다(`plan.md` r1.5 강제 지점 표 아래 문단).
- 대상 커밋 좌표: `6b063bb0`은 `git cat-file -t` = commit이지만 `origin/main`의 조상이 아니다(브랜치 미병합). INDEX에는 브랜치 해시로 적고 병합 뒤 `main` 해시로 고친다.

## 10. 사람 vs 에이전트

AC10 Windows 실기만 사람에게 넘긴다. 위 결함은 전부 기계 검증 범위다.

## 11. 발견과 disposition

| # | 발견 | 출처 원문 | 분류 | disposition |
|---|---|---|---|---|
| D1 | 검색 보기에서 대상 턴 앞·뒤 잔여가 모두 있으면 `before` 유휴 요청이 진행 중일 때 `after` 유휴 요청을 하나 더 예약·발사한다(독립 축 a 재현) | §23-D 유휴 채움′ “직전 commit 전 다음 요청 0” · §10 한 턴과 조각 “직전 유휴 요청 완료” | 이행(재현) | BLOCKING |
| D2 | 입력 중 보류의 wheel·키·드래그 분기가 각각 잠기지 않았다(I1·I2·I11·I12) | EP3 ⑤ ‘입력 중 보류’ · 분기 입력 ‘입력 중 유휴’ | 이행 | BLOCKING |
| D3 | 검색 보기 유휴 채움 분기에 입력이 없다(I13). 훅 테스트는 `readSearchEdge`를 mock하지 않는다 | §10 한 턴과 조각 “검색 대상은 대상을 포함한 묶음” + §5-B “검색 대상 턴이 큰 경우에도” | 이행 | BLOCKING |
| D4 | 창이 다른 세대의 `ok` 응답을 거부하는 검사가 잠기지 않았다(S7·S8) | §10 요청/응답 “창도 일치 여부를 검사” · EP5 ③ | 이행 | BLOCKING |
| D5 | 같은 커서의 이전 턴 중복 요청 억제가 잠기지 않았다(S10) | AC3′ “반복·동시 입력 1회” · EP5 ① | 이행 | BLOCKING |
| D6 | data가 커서 종류·방향 혼용을 거부하는 검사가 잠기지 않았다(C2·C3) | §10 요청/응답 “세션/세대/종류 혼용 … data에서 거부” | 이행 | BLOCKING |
| D7 | 출판 revision 경쟁(`prepare()` 뒤 원본 변경) 시 stale 응답이 잠기지 않았다(P1) | EP1 ④ · Q9 입력 ‘commit 직전 경쟁’ | 이행 | BLOCKING |
| D8 | 본문 ref의 원문 바이트 길이 결합이 잠기지 않았다(P3) | §10 본문 “ref는 … 원문 바이트 길이에 결합” | 이행 | BLOCKING |
| D9 | locator epoch(P5)·target 캐시 키 불일치(P7)가 잠기지 않았다. 아울러 Q2·Q3·Q5·Q5b·Q6a~e·Q8 renderer·Q9 좌표가 plan의 경로·이름으로 없고 대체 테스트와의 대응이 강제 지점 표에 없다 | Q6a ‘새 archive의 같은 순번은 거부’ · Q6b ‘동일 세대이지만 다른 캐시 키’ · §10 “Q는 구현 시 만들 테스트의 좌표” | 이행 | BLOCKING |
| N1 | Vitest 22건 red(Windows 경로 단언, 이번 diff 밖 9파일) | — | 비귀속 | NON_BLOCKING |

다음 구현은 D1을 코드로 고치고 D2~D9에 해당 입력을 더해 각 변이가 red가 되게 한다. 그리고 Q마다 `파일:테스트명`을 강제 지점 표에 적는다. 동치 17건 중 근거에 동의하지 않으면 확인 실행으로 반박할 수 있다.

## Review Signals — 사실만

- 첫 verify다. 이전 라운드 증상과 비교할 대상이 없다.
- 못 잡음 14건은 모두 §10 계약 행이나 Q 입력 칸에서 원문을 인용할 수 있었다. 구현자가 남긴 곳에 적은 ‘세부 분기’와 같은 범주다.
- 독립 축 2개에서 발견 1건(D1, 이행)이 나왔고, 다른 축은 통과했다.
- 검증 환경 한계: AC10 Windows 실기, Electron ABI가 필요한 Q10 재측정.

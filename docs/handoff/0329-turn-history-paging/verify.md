# Verify — 0329-turn-history-paging

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

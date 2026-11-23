# Verify — 0327-worker-protocol-visible-views

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md). 구현 보고·`Criteria-Met`은 대조 출발점으로만 썼고, 아래 관측은 모두 이번 턴에 재현했다.

## 판정 (verify 1회째)

**RETURN_TO_PLAN** — 확장 후보 1건(H1 `check-visible-views.mjs` 실행 환경)이 확장 창 안이라 `PLAN_GAP`이다. 같은 판정 안에 이행 결함 4건(I1~I4)이 `BLOCKING`이므로 설계자가 H1을 채택·경계 선언한 뒤 구현자가 I1~I4를 고친다.

- 합계 재측정: ✅ 5 · ⚠️ 31 · ❌ 3 = 39(§5). 자기보고 `Criteria-Met: 24/39`와 다르다 — 자기보고 ✅ 24건 중 19건은 plan이 지정한 oracle 좌표가 트리에 없거나 등록 변이가 잡히지 않는다.
- 막지 않는 것: 게이트(lint·typecheck·가드 5종·node 스크립트·빌드·preload 스모크)는 이번 변경 범위에서 통과했고, vitest 실패 393건은 전부 환경·기준선이다(§9).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0327-worker-protocol-visible-views` |
| 검증자 | Claude Code |
| 일자 | 2026-11-23 |
| 대상 커밋/range | `322b19bd..0bb0783e` — 구현 `66d8191d`(r1) · `56042bc1`(r1.2) · `747ecb85`(r1.3) · `d87ae98e`(r1.4) · `0bb0783e`(r1.5). app 95파일 +7,149 / −1,002 |
| 구현 전 plan 기준 | `32711212`(V1 rev 3) → `322b19bd`(ΔV1) · `2f7eb731`(ΔV2) · `c0b367eb`(ΔV3) · `3b5a7421`(ΔV4) · `d2ed3db0`(ΔV5) |
| V mode / 유효 V | `Baseline V: V1 rev 3` / `V1 rev 3 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5` |
| 라운드 | 1 → 판정 뒤 2 |
| 상태 | RETURN_TO_PLAN |
| 확장 창 | verify 1회째 — 창 안. 사용자 요구 변경 ΔV로 다시 열린 노드: 해당 없음(창 자체가 열려 있음) |
| 독립 축(⑥) | 3축 · 시도 9 — 토큰 워커 줄 경계(I1·I2 변이) · 가상 행 추가 판정의 테스트 잠금(W1~W3 vitest · W1e~W3e Electron) · D-052 복사 가로채기 전수 검색(`rg onCopy\|'copy'\|claimCopy` 0건) |
| 열거 sweep(⑦) | 1회째지만 **부분** — ΔV2~ΔV5가 열거한 항목(EP-3 ③ · EP-13 ④⑧ · EP-26 ③~⑦ · EP-27 · EP-28 ①~④ · ΔV1 MD-05)만 돌렸다. V1 rev 3 EP-1~EP-25 는 plan 좌표 파일 다수가 없어(§5 I1) 심을 oracle이 없다 — 다음 verify가 전수를 이어 받는다 |
| 발견 분류 | 이행 4 · 현재 0 · 확장 1(막음 1 / 후보 표 0) · 경계 0 · 비귀속 1 |
| 구현 주체·문맥 | 구현 codex · 설계자 = 검증자(Claude) — plan validity는 자기 설계 감사다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋 다섯 개가 바꾼 `plan.md` 줄: 상태 줄 `:11`과 `[구현자 기입]` 절 추가뿐이다(`git diff -U0 <c>^..<c> -- plan.md` 의 hunk 머리 — r1 `:1348-1396` 은 템플릿 자리표시자 채움). AC·Decision·V 행 변경 0 → 원 기준으로 채점.
- 설계 커밋과 구현 커밋은 분리돼 있다(설계 `Status: designed` 5개 · 구현 `Agent: codex` 5개).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·상속 기준 | 유효 | Baseline V1 rev 3, ΔV1~ΔV5 적용 순서가 상단 `:9` 에 있다 |
| NEW/CHANGED ↔ REQUIRED pair | 유효 | ΔV2~ΔV5 V 변경표 — SD-07·MD-15·MD-16 NEW 모두 VP-52·VP-56·VP-57 |
| INHERITED ↔ REGRESSION | 유효 | VP-53~55·VP-58 |
| §10 자리 목록 재검색 | 유효(검사한 행) | EP-28 `rg` → 7줄(`:482·526·567·579·736·897·913`) = 자리 4 + 뺀 3, 차집합 0 |
| 운영 gate | **확장 후보 H1** | 구현자가 만든 `check-visible-views.mjs` 가 ΔV1 AC15·35 Electron 판정의 유일한 도구인데 운영 gate 표·종료 코드 계약에 없다(§11) |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| false success 가능성 | **있음** | `check-visible-views` 의 "새 행 마운트 뒤 클립보드 유지" 단언은 선택 노드가 스크롤로 언마운트되어 저절로 참이 된다 — 취소 알림을 지워도 6화면 통과(W3e · I3) |
| 실환경 실패 방식 | 결함 1 | 같은 도구가 root Linux 에서 `--no-sandbox` 를 붙이지 않아 Electron FATAL → exit 1(`check-transcript-selection.mjs:104` 에는 있다). 바이너리 부재 exit 3 경로도 없다(H1) |
| Product/UX A 대신 B | 없음(검사 범위) | D-052 앱 복사 가로채기 0건 · ΔV4 완료 경로·ΔV5 완료 우선은 직접 oracle 로 확인 |
| 최적화가 잃은 관측 | 미판정 | 문서 임차·모델 캐시 퇴거(AC9) 계수 oracle 이 없다(I1) |

## 3. 역방향 탐색

`scan-surface.sh` 는 돌리지 않았다 — 판정을 바꾸는 결함이 oracle 부재(I1)에서 이미 드러나 시간을 변이·실측에 썼다. 다음 verify 에서 수행한다(못 본 것).

## 4. 고장 이력

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 하한·출처 | 분류 |
|---|---|---|---|---|---|---|---|
| V5-1 | `worker/tokens.ts:62-63` | 뒤집기 | 범위 끝 검사 ↔ 예산 비교 순서 | 잡음 | `tokens.test.ts` t5(2) | ① ΔV5 | — |
| V5-2 | `tokens.ts:63` | 제거 | 예산 비교 `if (false)` | 잡음 | t5(3) | ① V1 rev 3 | — |
| Y1 | `tokens.ts:62` | 제거 | 범위 끝 완료 | 잡음 | t5(2) | ⑦ EP-3 ③ | — |
| Y2 | `tokens.ts:38` | 제거 | 빈 범위 조기 반환 | 잡음 | t5 n=0 | ⑦ EP-3 ③ | — |
| I1 | `tokens.ts:49` | 제거 | CRLF `\r` 절단 | 잡음 | t1–t8 | ⑥ | — |
| I2 | `tokens.ts:61` | 제거 | 체크포인트 저장 | 잡음 | 체크포인트 재개 | ⑥ | — |
| V57-1 | `openCodeBlocks.ts:532` | 뒤집기 | `isLiveSeg` → `active && index === segments.length - 1` | **부분** — ob1 잡음 · bg4a·bg4b ③ OpenCode **못 잡음** | ob1 | ① VP-57 | 이행(I2) |
| V57-2 | `openCodeBlocks.ts:736` | 빈 값 | `streaming: true` → `false` | 잡음 | ob5 | ① VP-57 | — |
| Y3 | `openCodeBlocks.ts:897` | 빈 값 | 같음 | 잡음 | ob6 외 | ⑦ EP-28 ③ | — |
| Y4 | `openCodeBlocks.ts:913` | 빈 값 | 같음 | 잡음 | ob5 증분 외 | ⑦ EP-28 ④ | — |
| V2-6 | `WorkerMarkdownTail.tsx:87` | 제거 | 접두 검사 | 잡음 | s15 | ① ΔV3 | — |
| Y5 | `WorkerMarkdownTail.tsx:102` | 제거 | `data-markdown-tail-parsed` | 잡음 | s13 외 | ⑦ EP-13 ⑧ | — |
| Y6 | `:101` | 제거 | `final` 분기 | 잡음 | s13e 외 | ⑦ EP-13 ⑧ | — |
| Y7 | `:96` | 제거 | 꼬리 > 50,000 → final 항 | 잡음 | 1건 | ⑦ EP-13 ⑧ | — |
| V2-1 | `useScrollAnchor.ts:105` | 제거 | 하단 추적 쓰기 | 잡음 | AT 실패 기록 90 | ① VP-52 | — |
| V2-2 | `ScrollController.tsx:179` | 뒤집기 | `state.pinned` → 늘 참 | 잡음 | 18 | ① | — |
| V2-3 | `pin.ts:69` | 제거 | pin 아님 → false | 잡음 | 36 | ① | — |
| V2-4 | `TranscriptViewport.tsx:440` | 다른 값 | 크기 보정 `true` | 잡음 | 81 | ① | — |
| V2-5 | `WorkerMarkdownTail.tsx:100` | 다른 값 | 뿌리 `max-h-[384px] overflow-auto` | 잡음 | 36 | ① | — |
| V56-1~4 · Y8 | `check-transcript-streaming.mjs:20·50·63·81·97` | 다른 값·제거 | 허용치 ≤2 ×2 · 빠진 기록 · parsed 글자 · 모르는 기록 | 잡음 5/5 | ks3 · ks4 · ks2 · ks10 · unknown | ① VP-56 · ⑦ EP-27 | — |
| W1 | `shared/ui/virtual/rowMount.ts:7` | 다른 값 | 추가 판정 → 크기 비교 | **못 잡음** — vitest `src/renderer` 실패 5 = SQLite 기준선만 | — | ① ΔV1 MD-05 | 이행(I3) |
| W2 | `rowMount.ts:7` | 다른 값 | 제거만으로도 참(`\|\| keys.length < size`) | **못 잡음** | — | ① ΔV1 MD-05 | 이행(I3) |
| W3 | `rowMount.ts:9` | 제거 | `notify?.()` | **못 잡음** | — | ⑥ | 이행(I3) |
| W1e~W3e | 같음 | 같음 | 위 셋을 Electron `check-visible-views` 로 | **못 잡음** — 6화면 `passed` | — | ⑥ | 이행(I3) |

- 원복: 매 실행 뒤 `mutate.py` "모든 파일 원문 그대로" + `git status --porcelain` 빈 출력. 원자료 [`evidence/v1-mutations.tsv`](evidence/v1-mutations.tsv).
- V2-1~V2-5 의 "잡은 테스트" 수는 실측 판정기 실패 기록 수다 — 화면별 분해는 판정기 출력 형태상 기록하지 않았다.
- V57-1 재현: 변이 아래 `streamingSessions.test.ts` verbose 6케이스 전부 ✓(opencode bg4a·bg4b 포함), `openCodeBlocks.test.ts` 는 `ob1` 만 ×.

## 5. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거 |
|---|---|---|---|
| VP-32 MD-03 ↔ UT-03 | UT | PASS | `tokens.test.ts` t5(n 7개) · t1–t8 · V5-1·V5-2·Y1·Y2 잡음 |
| VP-35 MD-06 ↔ UT-06 | UT | PAIR_FAIL | s7·s8·s11~s15 있음 · V1 rev 3 좌표 s1~s5·s9·s10 · ΔV2 s13a~d·f 이름 없음(I1) |
| VP-56 MD-15 ↔ UT-15 | UT | PASS | `check-transcript-streaming.test.mjs` ks · 등록 변이 5/5 |
| VP-57 MD-16 ↔ UT-16 | UT | PAIR_FAIL | 등록 변이 V57-1 의 bg4a·bg4b ③ OpenCode red 기대 미충족(I2) |
| VP-34 MD-05 ↔ UT-05 | UT | PAIR_FAIL | ΔV1 등록 변이(크기 비교·제거만 참) green(I3) |
| VP-52 SD-07 ↔ ST-07 | ST | BLOCKED_BY:VP-57 | P1·U1 18기록 verdict true · V2-1~V2-5 잡음 · EP-26 ⑨ OpenCode 완료 좌표가 VP-57 결함에 묶임 |
| VP-05 R-05 ↔ AT-05 | AT | BLOCKED_BY:VP-35·VP-57 | AC37·38 ✅ · AC26 좌표 부재 · AC39 ❌ |
| VP-09·VP-14·VP-26 (ΔV1 복사) | AT·ST·IT | BLOCKED_BY:VP-34 | Electron 복사 일치 6화면 ✓ · 취소 사례가 새 행 키 관측 없이 통과(I3) |
| VP-01·02·04·10·12·13·15·20~25·31·33·36·38·39·48·49·51 | 전 레벨 | PAIR_FAIL | plan 지정 oracle 파일 또는 케이스 이름이 트리에 없다(I1 표) |
| VP-03·30·37 · VP-06·11 | UT·AT·ST | 미판정 | 좌표 일부 존재(cp1·cp2·cb1·q4·q8~q10·q12·q13) — 등록 변이(VP-37 memo deps `theme` 등) 미실행 |
| VP-07 · VP-08·24 | AT·IT | 미판정 · PASS | AC29 measure 테스트 미대조 · `check-ui-thread.mjs` exit 0 + 신규 케이스 green |
| VP-40~47 · VP-50 · VP-53~55 · VP-58 | REGRESSION | 미판정(실행 green) | 전체 vitest 에서 해당 스위트 실패 0 · VP-50 `check-transcript-selection` 90기록 verdict true · 회귀 변이 미실행 |

### AT / AC 세부와 합계

| 결과 | AC |
|---|---|
| ✅ 5 | AC4(t5·q4 · V5-1·V5-2) · AC25(기존 산출물 테스트 green) · AC28(`check-ui-thread` exit 0 · 신규 케이스) · AC37·AC38(Electron P1·U1 18기록 · V2-1~V2-5 잡음) |
| ❌ 3 | AC15·AC35(취소 판정이 새 행 키를 관측하지 않음 · W1e~W3e) · AC39(V57-1) |
| ⚠️ 31 | AC1~3 · 5~14 · 16~24 · 26 · 27 · 29~34 · 36 — plan 좌표 파일·케이스 부재 또는 자기보고 ⚠️(I1). AC30 은 사람 실기(Windows) |

- 합계 재측정 `5 + 3 + 31 = 39`. 자기보고 `24/39`(trailer `0bb0783e` · plan `:2045`) — 불일치.
- INDEX 비고의 합계 사본 없음 — 대조 해당 없음.

### I1 — plan 지정 oracle 좌표 부재 (AC별)

| AC | 트리에 없는 plan 좌표 |
|---|---|
| AC1 | `protocol.keys.test.ts` pk1~pk6 |
| AC3·5·7 | `useWindowTokens.test.ts` wt1~wt5 · `client.queue.test.ts` q1~q3 · `VirtualMarkdownView.test.ts` m5 |
| AC8~14·16 | `fileDiffVirtual.render.test.ts` v1~v11 · `fileDiffExpandAll.render.test.ts` ea1~ea3 · `useDiffView.test.ts` dv1 · `worker/handler.test.ts` h12 · `diffView.test.ts` sb1·cx1·p1~p3 |
| AC17·20 | `useDiffRowTokens.test.ts` rt1~rt8 |
| AC18·19·20 | `DiffTable.virtual.test.ts` dt1~dt5 · `longToolBody.render.test.ts` lb1~lb5 · `readBody.test.ts` rd1·rd2 |
| AC22·23 | `VirtualCodeView.test.ts` x1~x7 · `VirtualMarkdownView.test.ts` m1~m4 |
| AC24·31 | `markdownDocumentBlocks.test.ts` mb1~mb11 · `MarkdownHast.fidelity.test.ts` f1·f3·f3b · `client.lanes.test.ts` l1·l2 · `handler.test.ts` h9 |
| AC26·27 | `WorkerMarkdownTail.test.ts` s1~s6·s9·s10 이름 |
| AC32·33·34·36 | `cardSyncCaps.test.ts` cs1~cs3b · `workToolBody.virtual.test.ts` wk1~wk4 · `diffScrollCoordinator.test.ts` sc1~sc3 · `client.queue.test.ts` q11 · 진단 fx2 |
| AC2·6·39 | 파일은 있으나 케이스 라벨(d1~d9 · q5~q7 · bg0~bg3)이 없어 자리별 좌표를 대응할 수 없다 |

- 검색: `git ls-files app` 파일명 대조와 `it(`/`test(`/`it.each(` 제목의 ID 접두 검색(`ids.txt` 3,465줄). 구현자가 다른 이름으로 같은 단언을 두었을 수 있으나 `[구현자 기입] r1.5` 에 §10 자리별 좌표 표가 없어 대응을 확인할 수 없다(I4).

## 7. 숫자 재측정

- 변경 파일 95(app) · 새 테스트 파일 9 · 수정 테스트 파일 15(`git diff --name-status 322b19bd..HEAD -- app`).
- EP-28 자리 4 / 검색 7줄 — plan 과 같다.

## 8. 사람 실기로 남는 것

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| AC30 Windows S-C0~S-C9 | Linux Electron 실측 3종(아래) | 같은 Windows 장비에서 0326 PASS 빌드 ↔ 0327 빌드 — plan §19 규약 |

## 9. 게이트 재실행 (마지막 수정 없음 — 검증 트리 `0bb0783e`)

| Gate | 결과 | 관측 |
|---|---|---|
| `npm run typecheck` | PASS | exit 0 |
| `npm run lint` | PASS | 오류 0 · 경고 10 · 실행 뒤 `git status` 변화 0 |
| 가드 5종(append-only · doc-inventory `--check` · product-naming · test-budgets · ui-thread) | PASS | 전부 exit 0 · product-naming 2,600파일 · test-budgets 실-git 18 |
| `vitest run`(필터 없음) | 기준선 | 1,100파일 · 10,519 테스트 · 통과 9,996 · 실패 393 · skip 130. 실패 371 = `better_sqlite3.node` NODE_MODULE_VERSION 140(Electron ABI · 환경) · 22 = `src/main` 9파일 — `322b19bd` 워크트리 같은 명령의 실패 집합과 차집합 ∅(양방향) · 변경 파일 ∩ 실패 파일 = ∅ |
| `node --test scripts/*.test.mjs` | PASS | 1,066 통과 · 실패 0 |
| `electron-vite build` · `smoke-preload` | PASS | exit 0 · `require 는 electron 뿐 · ooBridge 키 7` |
| `smoke-hosts` | 환경 | 데이터 호스트 준비 없음 · exit 1 — 같은 Electron ABI(140) SQLite 서명. 변경이 `src/main` 을 건드리지 않음 |
| `check-transcript-streaming`(xvfb) | PASS | exit 0 · 18기록 · verdict true · [`evidence/v1-check-transcript-streaming.json`](evidence/v1-check-transcript-streaming.json) |
| `check-transcript-selection`(VP-50 회귀) | PASS | exit 0 · 90기록 · verdict true · [`evidence/v1-check-transcript-selection.json`](evidence/v1-check-transcript-selection.json) |
| `check-visible-views` | 래퍼로 PASS · 원본 실패 | 원본: root 에서 Electron FATAL "Running as root without --no-sandbox" exit 1. `ELECTRON_BINARY` 래퍼(`--no-sandbox`)로 6화면 `passed` — [`evidence/v1-check-visible-views.txt`](evidence/v1-check-visible-views.txt) |

- 잔여물: `npm ci`(electron 바이너리 수동 설치 포함) · 임시 워크트리(삭제함) · 변이 원복 확인. 작업 트리에는 이 verify 산출물만 남는다.

## 10. Repository operation checks

| 검사 | 판정 | 근거 |
|---|---|---|
| trailer 파싱 | PASS | 구현 4 · 설계 5 커밋 `%(trailers:only=true)` 가 적힌 키 전부 반환 |
| `[구현자 기입]` 일곱 필드(r1.5) | **이행 결함 I4** | `r1.5 구현 인계` 는 설계 리뷰·잠금·제품 동작·구현 보고만 있다. 강제 지점 전수(§10 자리 전부·좌표·남긴 곳) · 놓친 잠재 문제 · sweep 검산 줄이 없다 |
| 대상 커밋 좌표 | 기입 | INDEX 자리표시자를 이 브랜치 해시로 채웠다. 전부 `origin/main` 조상 아님(PR 미병합) — 병합 뒤 main 해시로 교정한다 |
| `app/AGENTS.md` 변경 | PASS | 채택 의존성·verify 도구 한 줄 · 비밀·변동성 정보 없음 |

## 11. 발견 분류

| # | 발견 | 분류 | 근거(인용·재현) | disposition |
|---|---|---|---|---|
| I1 | plan 지정 oracle 좌표 부재 — 위 표 | 이행 | AC 표 "검증 수단" 칸 · `docs/handoff/AGENTS.md §공통 V` "좌표가 없는 자리는 닫힌 자리로 세지 않는다" | BLOCKING |
| I2 | VP-57 등록 변이에서 bg4a·bg4b ③ OpenCode green | 이행 | plan ΔV4 EP-28 "등록 변이(VP-57): ① 을 이전 식으로 되돌림 → ob1 · bg4a·bg4b ③ OpenCode red" · V57-1 재현 | BLOCKING |
| I3 | ΔV1 선택 취소 판정이 테스트로 잠기지 않음 | 이행 | ΔV1 MD-05 행 "추가 판정을 크기 비교로 바꾸거나 제거만으로도 참이 되게 바꾸면 테스트가 실패해야 한다" · VP-50 행 "취소 사례는 실제 새 행 키 관측을 증거로" · W1~W3e | BLOCKING |
| I4 | r1.5 `[구현자 기입]` 필드 접힘 | 이행 | `handoff-impl` 최소 계약 "같은 이름 필드를 다시 채운다 · 강제 지점 전수 표는 그 pair의 §10 자리 전부" | BLOCKING |
| H1 | `check-visible-views.mjs` — root `--no-sandbox` 미적용 · 바이너리 부재 exit 3 없음 · 판정부 단위 테스트 없음 · 운영 gate 표 밖 | 확장 | 원본 실행 FATAL 재현. plan 이 이 도구를 열거하지 않아 원문 인용 불가 | PLAN_GAP(창 안) |
| N1 | `smoke-hosts` 의 SQLite ABI 실패 | 비귀속 | 환경 서명 · `src/main` 변경 0 | NON_BLOCKING |

## Review Signals — 사실만

- 같은 증상의 이전 라운드: 없음(verify 1회째).
- 막았어야 할 plan 지침: I1·I4 는 `handoff-impl` "닫았다로 적는 행에 이번 턴 관측" · "강제 지점 전수 표" 조항이 있었다. 구현 보고는 ✅ 24 를 적었지만 자리별 좌표 표가 없었다.
- 반복 환경 한계: Electron ABI 와 Node ABI 동시 불가(SQLite 371) · root 컨테이너 Electron sandbox.
- 독립 축(⑥) 발견: 3축 9시도 중 I3 하나(W3·W1e~W3e) — 분류 이행.

# Verify — 0327-worker-protocol-visible-views

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md). 구현 보고·`Criteria-Met`은 대조 출발점으로만 썼고, 아래 관측은 모두 이번 턴에 재현했다.

## 판정 (verify 4회째)

**FAIL** — 이행 결함 3건(M1~M3)이 `BLOCKING`이다. 셋 다 §10 자리 검색 출력에 있는 줄인데, 그 자리의 코드가 두 분기로 나뉘어 oracle이 한 분기만 실행한다. `PLAN_GAP`은 없다.

- 닫힌 것: L1~L4. L1은 ΔV8 ①a·①b·①c 변이 13/14 red(V4-A4는 동치), L2~L4 인용 변이(E6-D10 · E7-D2 · E7-D4)는 red다.
- ⑦ 전수 잔여(verify 3 메타의 EP-5·8·9·11·15·16·19·21·22·24): 구현자 원장 241행을 다시 돌려 기록과 241/241 일치했다(자리 대표 158/158 포함) → 자리 단위 잔여 0.
- 합계 재측정: ✅ 37 · ⚠️ 1 · ❌ 2 = 40(§V4-5). 자기보고 `Criteria-Met: 39/40`과 다르다.
- 이번 변경 범위의 gate는 통과했다. vitest 실패 393건은 verify 3과 같은 SQLite ABI 기준선이다(§V4-9). verify 4회째라 review 발동 대상이 아니다 → 다음 주체 Codex(r5).

### V4 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `6a3574d4..f92d624a` — 구현 `f92d624a`(r4). 생산 코드 4파일(`protocol.ts` · `client.ts` · `limits.ts` · `FileDiffSection.tsx`) · 테스트 16파일 · evidence 5파일 |
| 구현 전 plan 기준 | `6a3574d4`(ΔV8) |
| 유효 V | `V1 rev 3 + ΔV1 + … + ΔV7 + ΔV8` |
| 라운드 | 4 → 판정 뒤 5 |
| 확장 창 | verify 4회째 — 창 밖. ΔV8 새 열거 항목(①a·①b·①c · pk7·pk7b·pk7c · q14·q14b · d11 · 등록 변이 · B35)의 출처는 plan 내부 정합(L1) — 출처 없는 항목 0. 사용자 요구 변경 ΔV 없음 |
| 독립 축(⑥) | 3축 · 시도 25 — ΔV8 산식의 뒤집기·합 → 마지막 문서·개행 문자·표본 크기·표본 원천 맞바꿈 · `FileDiffSection` 용량 대기 ↔ 실패 맞바꿈 · **§10 자리 검색 출력의 줄 단위 sweep**(EP-5 전 줄 · EP-22 전 줄 · 원장 원문이 파일에 두 번 이상 나오는 자리의 나머지 출현) |
| 열거 sweep(⑦) | ΔV8 대체·신설 항목 전수(V4-A·B·C) + 이번 diff가 닿은 이전 `잡음` 행(④ — verify 3 E1·E2·E4·E6·E7 재실행) + 직전 실패(L1~L4) + verify 3 전수 잔여(원장 241행 재실행). 잔여 0 |
| 못 본 것 | EP-8·9·11·15·16·19·21·24 검색 출력의 줄 단위 sweep(자리 단위는 원장 재실행으로 닫음 — 줄 단위는 독립 축이라 잔여로 세지 않는다) · AC30 Windows 실기 |
| 발견 분류 | 이행 3(M1~M3) · 현재 0 · 확장 2(후보 표) · 동치 2 · 비귀속 2 |
| 구현 주체·문맥 | 구현 codex · 설계자 = 검증자(Claude) |

### V4-0. 기준선 · plan validity

- 구현 커밋이 바꾼 `plan.md` hunk: `:11`(상태 줄) · 파생 이슈 표 L1~L4 상태 칸 · `[구현자 기입] r4` 추가. AC·Decision·V 행 변경 0 → 원 기준으로 채점. 상태 칸 `closed (r4 자기확인)`은 이번 판정으로 바꿨다.
- ΔV8 자리 검색 ⑴ → 46줄(`dd0528ae` 44 + import `:21` + 표본 `:152`) · ⑵ → 2줄(`protocol.ts:225` · `limits.ts:26`). ①a·①b·①c 각 1, 차집합 0.
- q14b 의 기대 문장 "markdown 이 먼저"는 레인이 달라(D-034) 순서로 관측되지 않는다. 테스트는 크기 값 `[200_000, 50_000, 5_000, 3_000]`을 직접 단언해 규칙 칸(①a markdown = `end − start`)을 잠근다(V4-A1 red) — 판정 영향 없음.

### V4-1. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| `chars / lines` 가 0 으로 나눌 수 있는가 | 없음 | 표본 줄 수는 1부터 센다(`client.ts:153`) · `requestDocs` 는 네 종류에서 항상 문서 ≥ 1(`protocol.ts:110-124` · `diffSource.ts:24`) |
| `documents.get(...)!` 가 빈 값일 수 있는가 | 없음 | `doc-unavailable` 검사(`client.ts:513-514`)가 같은 `requestDocs` 로 먼저 돈다 · 동기 실행 |
| 표본 비용 | 상한 지킴 | 루프는 `min(length, 65_536)`까지 · 등록부 새 항목에서만(`client.ts:452`) |
| `FileDiffSection` 이 `doc.unavailable` 폴백(창에서 전체 계산)을 지웠다 | 계약과 맞음 | B12 "Git 은 대기 표시" · §5 실패 문구 · 단일 패치는 `PATCH_MAX_BUFFER` 16MiB 라 문서 상한 32M자를 넘지 않아 영구 대기가 없다 |
| A 대신 B | 없음 | D-068 표본·합 ÷ 합이 그대로다(pk7b · V4-A5) |

### V4-2. 역방향 탐색

생산 코드 새 export `DocumentSample`(소비처 `client.ts`) · `sampleDocument`(파일 내부) — 미배선 0. `DiffLinesStatus` import 는 `FileDiffSection.tsx:550` 이 소비한다.

### V4-4. 고장 이력

원장 재실행: [`r4-mutations.jsonl`](evidence/r4-mutations.jsonl) 241행을 임시 워크트리 3곳에서 `mutate.py`로 다시 돌렸다 — red 238 · green 3(E7-D3 동치 · E7-D12 Y5 · V3-M7 Y2), 기록 `expect`와 241/241 일치([`v4-ledger-rerun.tsv`](evidence/v4-ledger-rerun.tsv)). 아래는 이번 턴의 새 변이다([`v4-mutations.spec.jsonl`](evidence/v4-mutations.spec.jsonl) · [`v4-mutations.tsv`](evidence/v4-mutations.tsv)).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| V4-A1 · A2 | `protocol.ts:242` | 제거 · 뒤집기 | 평균 곱 제거 · `lines / chars` | 잡음 | pk7 · q14 외 6 | ①⑦ · ⑥ | — |
| V4-A3 · A6 · A7 | `:241` · `:245` · `:230` | 다른 값 · 제거 | diffContext 7 → 1 · diffLocate ×16 제거 · diffContext 를 평균 분기 밖으로 | 잡음 3/3 | pk7 | ⑦ | — |
| V4-A4 | `:241` | 제거 | diffContext 분기 → `end − start \|\| 7` | 못 잡음 | — | ⑥ | 동치(diffContext 는 `NaN \|\| 7` = 7) · 빈 창(`start = end`)만 0 → 7×평균 — 확장(Y7) |
| V4-A5 | `:238-239` | 다른 값 | 합 → 마지막 문서만 | 잡음 | pk7b | ⑥ | — |
| V4-B1~B5 | `client.ts:152-156` · `:456` | 제거·다른 값·고정값 | 표본 상한 제거(등록 변이) · 줄 수 0부터 · `\r` · 표본 1,024 · 표본 고정 | 잡음 5/5 | d11 · q14 | ①⑦⑥ | — |
| V4-C1 · C2 | `client.ts:529` | 고정값 · 맞바꿈 | `lengthOf` 고정 · 문서 끝 65,536자 표본 | 잡음 2/2 | q14 · d11 | ⑦⑥ | — |
| V4-Q1 · Q2 | `client.ts:395` | 제거 · 뒤집기 | 크기 항 | 잡음 2/2 | q 계열 | ④ | — |
| V4-F1~F3 | `FileDiffSection.tsx:521` · `:550` | 제거 | 행 창 실패 항 · 첫 응답 실패 항 · 대기 표시 | 잡음 3/3 | fileDiffVirtual.render | ⑦(EP-18 ④) | — |
| V4-F4 | `:521` | 맞바꿈 | 용량 대기(`doc.unavailable`)를 실패 문구로 | 잡음 | fileDiffVirtual.render | ⑥ | — |
| RE1-C21~C24 · RE2-C1~C8·C26 · RE4-C9~C11·C25 | `protocol.ts` · `client.ts` | verify 3 원문 | 키 · 문서 수명 · 대기열 | 잡음 17/17(C8 시간 초과 — verify 3 과 같은 재전송 무한) | d · cs · q · pk | ④ | — |
| RE6-D10 · RE7-D2 · RE7-D4 | `diffView.ts:199` · `:87` · `:92` | verify 3 원문 | L2 · L3 · L4 | **잡음**(직전 못 잡음) | diffView | ②③ | L2~L4 닫힘 |
| RE6-D1 · RE7-D5~D9 · D11 | `diffView.ts` | verify 3 원문 | 짝 · 축·폭·펼침 등 | 잡음 7/7 | diffView · v | ④ | — |
| RE7-D3 | `diffView.ts:90` | 제거 | new 위치 색인 첫 일치 | 못 잡음 | — | ③ | 동치(verify 3 근거 그대로) |
| V4-E1~E3 | `DiffTable.tsx:207` · `:357` · `useSmallDiffSyntax.ts:24` | 고정값 | revision 원천 → `{}` | 잡음 3/3 | dt · v · rt | ⑥(EP-5 줄 단위) | — |
| V4-E4 · E5 · E6 | `useDiffAxes.ts:40` · `:48` · `:45` | 고정값 · 맞바꿈 | 축 old·new revision → `{}` · new id ↔ old | 잡음 3/3 | ax · rt | ⑥ | — |
| V4-W3 | `WorkToolBody.tsx:157` | 맞바꿈 | 일반 분기 응답 revision → `call.input` | 잡음 | wk4 | ⑥ | — |
| **V4-W1** | `WorkToolBody.tsx:147` | 다른 값 | details 분기 응답 Payload `scrollElement` → 빈 ref | **못 잡음** | — | ⑥ | 이행(M1) |
| **V4-W2** | `WorkToolBody.tsx:149` | 맞바꿈 | details 분기 응답 문서 id `:work:response` → `:work:request` | **못 잡음** | — | ⑥ | 이행(M2) |
| **V4-W4** | `ArtifactPreviewContent.tsx:96` | 고정값 | 코드 모드 `VirtualCodeView` revision `result` → `{}`(렌더마다 새 객체) | **못 잡음** | — | ⑥ | 이행(M3) |
| V4-W5 | `WorkToolBody.tsx:45` | 고정값 | Payload revision 폴백 `?? payload` → `?? {}` | 못 잡음 | — | ⑥ | 확장(Y6) |

- 원복: 매 실행 뒤 "모든 파일 원문 그대로" · 워크트리 5곳 `git status` 변화 0 · 작업 트리 미사용.

### V4-5. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거 |
|---|---|---|---|
| VP-36 MD-08 ↔ UT-07 | UT | PASS | ΔV8 등록 변이 V4-B1(d11) red · ①a·①b·①c 변이 13/14 red(A4 동치) · pk7·pk7b·pk7c·q14·q14b·d11 실재 · 원장 EP-1·EP-4 20행 red |
| VP-30 MD-01 ↔ UT-01 · VP-31 MD-02 ↔ UT-02 | UT | PASS | RE6-D10 · RE7-D2 · RE7-D4 red · 원장 EP-6·7 행 red |
| VP-11 SD-02 ↔ ST-02 · VP-06 R-06 ↔ AT-06 (REGRESSION) | ST · AT | PASS | V4-Q1·Q2 red · 원장 q·t·wt·fx 행 red |
| VP-01 | AT | PASS | 원장 EP-6·7·8 ⑦⑧·16·18·19·24 행 red · V4-F1~F4 red |
| VP-15 SD-06 ↔ ST-06 | ST | **PAIR_FAIL** | M1 · M2 — EP-22 ②③ 의 details 분기 줄이 wk1~wk4 실행 구간 밖 |
| VP-21 AR-02 ↔ IT-02 | IT | **PAIR_FAIL** | M2(EP-5 ⑨) · M3(EP-5 ⑮ 코드 모드) |
| VP-02 · VP-03 | AT | BLOCKED_BY:VP-15 · VP-21 | AC33 · AC22 |
| VP-09 · VP-14 · VP-26 · VP-34 · VP-59 · VP-50 · VP-52 | 전 레벨 | PASS | `check-visible-views` 23 · `check-transcript-selection` 90 · `check-transcript-streaming` 18기록 verdict true · 원장 행 red |
| 나머지 REQUIRED·REGRESSION | 전 레벨 | PASS | 원장 241/241 재현(자리 대표 158) |

| 결과 | AC |
|---|---|
| ❌ 2 | AC33(M1·M2) · AC22(M3) |
| ⚠️ 1 | AC30(Windows 사람 실기 — 사용자가 verify 단계로 지정, 이 환경 불가) |
| ✅ 37 | 나머지 — AC5·AC8·AC17 은 L1~L4 닫힘, AC10·AC18~21·AC32·AC34 는 원장 재실행으로 자리 전수 확인 |

- 합계 `37 + 1 + 2 = 40`. 자기보고 `39/40`(trailer `f92d624a` · r4 구현 보고) — 불일치.

### V4-9. 게이트 재실행 (검증 트리 `f92d624a`)

| Gate | 결과 | 관측 |
|---|---|---|
| 가드 5종 | PASS | append-only · doc-inventory `--check` · product-naming(2,629파일) · test-budgets(18 real-git) · ui-thread — 전부 exit 0 |
| `npm run lint` | PASS | 0 errors · 12 warnings — 경고 파일 9개 중 r4 변경 파일 0 · 실행 뒤 `git status` 변화 0 |
| `npm run typecheck` | PASS | exit 0 |
| `vitest run`(필터 없음) | 기준선 | 1,122 파일 · 10,750 테스트 · 통과 10,226 · 실패 393 · skip 130. 실패 파일은 전부 `src/main/**` + `settlement.integration.test.ts` — `NODE_MODULE_VERSION` 서명 80건. verify 3 과 같은 393 · r4 의 `src/main` 변경 0파일 |
| Unhandled Rejection 1 | 비귀속 | `src/main/adapters/claude/native-resources.test.ts` — r4 변경 밖 |
| `node --test scripts/*.test.mjs` | PASS | 1,097 통과 · 실패 0 |
| `electron-vite build` · `smoke-preload` | PASS | exit 0 · `require 는 electron 뿐 · ooBridge 키 7` |
| `smoke-hosts` | 환경 | 데이터 호스트 종료 코드 1 — SQLite ABI(N1 승계) |
| `check-visible-views`(운영 gate) | PASS | `xvfb-run` · exit 0 · 23기록 verdict true · Electron 39.8.10 — [`v4-check-visible-views.json`](evidence/v4-check-visible-views.json) |
| `check-transcript-selection` · `check-transcript-streaming` | PASS | exit 0 · 90 · 18기록 verdict true |

### V4-10. Repository operation checks

| 검사 | 판정 | 근거 |
|---|---|---|
| trailer 파싱 | PASS | `f92d624a` 6키 · `6a3574d4` 5키 반환 |
| `[구현자 기입] r4` 일곱 필드 | PASS | 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금(검산 `158 + 8 + 4 + 49 + 22 = 241`) · Product/UX · 놓친 잠재 문제 · 구현 보고 · Review Signals |
| 강제 지점 표 | 불일치 | VP-15·VP-21 을 `SELF_PASS` 로 적었지만 EP-22 ②③ · EP-5 ⑨⑮ 의 details·코드 모드 줄은 원장에 없다 |
| 대상 커밋 좌표 | 기입 | INDEX `(ΔV8 설계 — 검증자 기입)` → `6a3574d4` · `(r4 구현 — 검증자 기입)` → `f92d624a`(`git cat-file -t` commit). `origin/main` 조상 아님(PR 미병합) |

### V4-11. 발견 분류

| # | 발견 | 분류 | 근거(인용·재현) | disposition |
|---|---|---|---|---|
| M1 | 응답 Payload 의 `scrollElement` 를 details 분기(`WorkToolBody.tsx:147` — 링크·Task 결과)에서 빈 ref 로 바꿔도 green. wk1~wk4 는 링크·Task 입력이 없어 그 분기를 실행하지 않는다 | 이행 | EP-22 ② "응답 `Payload` 의 `VirtualCodeView scrollElement`(같은 컨테이너)" · 자리 검색 출력 `:147` · V4-W1 | BLOCKING |
| M2 | 같은 분기의 응답 문서 id(`:149`)를 `:work:request` 로 바꿔도 green — 결과 도착 때 요청 문서까지 바뀌는 실패 의미 | 이행 | EP-22 ③ "응답 `…:work:response` + `call.result`" · EP-5 ⑨ · 자리 검색 출력 `:149` · V4-W2 | BLOCKING |
| M3 | 산출물 코드 모드(`ArtifactPreviewContent.tsx:96`, 400줄 초과)의 revision 원천을 렌더마다 새 객체로 바꿔도 green. 원장 ep5.15 는 Markdown 분기(`:113`)만 심었다 | 이행 | EP-5 ⑮ "`ArtifactPreviewContent` → `result`" · 실패 의미 "렌더마다 새 객체를 원천으로 주면 다시 렌더마다 새 문서" · 자리 검색 출력 `:96` · V4-W4 | BLOCKING |
| Y6 | Payload revision 폴백(`WorkToolBody.tsx:45` `?? payload`)을 `{}` 로 바꿔도 green — 요청 입력이 객체가 아닐 때만 쓰인다 | 확장 | V4-W5 · EP-5 ⑧ 은 `call.input` 만 적고 폴백을 열거하지 않는다 | NEXT_HANDOFF(확장) |
| Y7 | 빈 창(`start = end`)의 크기 — diffContext 분기를 `end − start \|\| 7` 로 바꾸면 빈 창만 0 → 7×평균 | 확장 | V4-A4 · ①a 규칙 칸에 빈 창 입력이 없다 | NEXT_HANDOFF(확장) |
| N1 | `smoke-hosts` SQLite ABI | 비귀속 | 환경 서명 · `src/main` 변경 0 | NON_BLOCKING |
| N2 | `native-resources.test.ts` Unhandled Rejection | 비귀속 | r4 변경 밖 `src/main` | NON_BLOCKING |

- r5 지침(불변식): §10 자리 검색 출력의 **모든 줄**이 그 자리의 직접 oracle 실행 구간 안에 있어야 한다(10-B "출력의 모든 줄은 그 행의 자리"). 자리 대표 변이 1개는 그 줄들 중 하나만 잰다 — 분기마다 코드가 따로 있는 자리는 줄마다 변이를 심는다.

### V4 Review Signals — 사실만

- 이전 라운드와 비슷한 증상: verify 3 L2~L4 는 자리 문장의 항, 이번 M1~M3 은 같은 자리의 다른 분기 줄이다 — 두 번 다 자리당 대표 변이 1개가 그 자리 전체를 잰다고 셌다.
- 관련 지침: §공통 V "좌표가 닫는 자리는 그 테스트의 실행 구간 안의 자리뿐" · 10-B "출력의 모든 줄은 그 행의 자리".
- 반복 환경 한계: Electron ABI ↔ Node ABI 동시 불가(SQLite 393 · smoke-hosts) · Windows 실기(AC30).
- 독립 축(⑥) 발견: 3축 25시도 중 이행 3 · 확장 2. 이행 3건은 모두 줄 단위 sweep 축에서 나왔다.

---

## verify 3회째 (원문 보존)

## 판정 (verify 3회째)

**FAIL** — 이행 결함 4건(L1~L4)이 `BLOCKING`이다. 모두 V1 rev 3 §10 자리 문장의 항을 인용할 수 있는 결함이다. 그중 L1은 코드가 계약과 다르게 동작한다(작업 크기). `PLAN_GAP`은 없다. 확장 창 밖이라 확장 후보 5건은 새 handoff 후보 표로 보냈다.

- 닫힌 것: K1~K5 · I1(VP-48 h10·h11 · VP48-b) — 구현자 원장 144행을 다시 돌려 기록과 144/144 일치했다. K5는 실제 Chromium·react-dom 프로브로 따로 재현했다(§V3-1).
- 합계 재측정: ✅ 27 · ⚠️ 10 · ❌ 3 = 40(§V3-5). 자기보고 `Criteria-Met: 39/40`과 다르다.
- 막지 않는 것: 이번 변경 범위의 gate는 통과했다. vitest 실패 393건은 verify 2와 같은 SQLite ABI·`src/main` Windows 경로 기준선이다(§V3-9).
- verify 3회째에 PASS가 아니므로 다음 재구현 전에 `handoff-review`를 한다(SKILL 마무리). 그래서 다음 주체는 Claude(review)다.

### V3 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `4c72441f..dd0528ae` — 구현 `dd0528ae`(r3). 생산 코드 2파일(`usePanelSelection.ts` · `WorkToolBody.tsx`) · 도구 3파일(`measure-ui-inputs.mjs` · `visible-views/electron-main.mjs` · `probe.tsx`) · 테스트 18파일 |
| 구현 전 plan 기준 | `4c72441f`(ΔV7) |
| 유효 V | `V1 rev 3 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6 + ΔV7` |
| 라운드 | 3 → 판정 뒤 4 |
| 확장 창 | verify 3회째 — **창 밖**. ΔV7이 새로 넣은 열거 항목은 출처(확장 채택 · 현재 결함 K5 · plan 내부 정합)가 ΔV7 표에 있다. 사용자 요구 변경 ΔV 없음 |
| 독립 축(⑥) | 3축 · 시도 21 — 실제 react-dom·Chromium으로 K5 재현(가짜 hooks 밖) · 형태 변이(`useLayoutEffect` → `useEffect` · deps `[]` · `row.id` → `item.index` · 판정기 항 단위 분리) · I1 잔여의 V1 rev 3 자리 sweep(EP-1~4·6·7·12·18·23·25) |
| 열거 sweep(⑦) | ΔV7 대체·신설 항목 전수(EP-30 ⑤⑫⑮⑯ · EP-31 ②③④) + diff가 닿은 이전 `잡음` 행(④ — 원장 재실행) + 직전 실패 항목(I1 — V1 rev 3 pair). **I1은 부분**: EP-1~4·6·7·12·18·23·25 자리 47건을 돌렸다. EP-5·8·9·11·15·16·19·21·22·24는 원장의 pair당 1~6행만 재실행했고 자리 전수는 못 봤다 |
| 발견 분류 | 이행 4(L1~L4) · 현재 0 · 확장 5(후보 표) · 동치 2 · 경계 5 · 비귀속 1(N1 승계) |
| 구현 주체·문맥 | 구현 codex · 설계자 = 검증자(Claude) |

### V3-0. 기준선 · plan validity

- 구현 커밋이 바꾼 `plan.md` hunk: `:11`(상태 줄) · `:2129`·`:2134-2137`(파생 이슈 표의 상태 칸) · `:2562-2646`(`[구현자 기입] r3`). AC·Decision·V 행 변경 0 → 원 기준으로 채점. 상태 칸의 `closed (r3 자기확인)`은 이번 판정으로 바꿨다.
- EP-30 자리 검색(ΔV7 명령)을 다시 돌림 → 17줄 = 자리 16 + 뺀 1(`TranscriptViewport.tsx:509`), 차집합 0. `usePanelSelection.ts:26`(`}, [documentKey])`)이 ⑮ 자리로 잡힌다.
- EP-31 자리 검색 → 9줄(자리 6), plan과 같다.
- ΔV7 새 열거 항목의 출처 확인: ps9b·ps9c(현재 결함 K5 · plan 내부 정합) · ps13~ps17·po6·vv12~vv16(확장 채택 · plan 내부 정합) — 출처 없는 항목 0.

### V3-1. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| K5 수정이 실제 React 순서에서 맞는가 | 맞음 | 레이아웃 효과 정리 함수는 같은 커밋의 모든 레이아웃 효과 실행보다 먼저 돈다. 실제 react-dom 19.2.8·Electron 39.8.10 프로브([`evidence/v3-k5-probe/`](evidence/v3-k5-probe/))에서 pointerdown → 선택 → 새 키(억제) → 문서 `b` + 새 키 `[5,6,7]` 같은 커밋 뒤 `suppressed`: 변경 전 `yes` · 변경 후 `no` |
| 언마운트 때 정리 함수가 `setSuppressed`를 부른다 | 결함 아님 | React 19는 언마운트된 컴포넌트의 상태 갱신을 무시한다 |
| `WorkToolBody` 메모 키 변경 | 동치 | `workToolPresentation`·`workSearchResults`·`toolRunOutcome`이 읽는 필드는 `name`·`input`·`result`·`toolUseId`뿐이다(`providerTool`·`editPreview`·`parentToolRunId` 참조 0 — `rg`) |
| 측정 CLI `process.exit(0)` | 결함 아님 | stdout 쓰기 콜백 뒤에 종료한다 — 파이프에서도 출력이 잘리지 않는다 |
| A 대신 B | **있음 — L1** | EP-4 ① "작업 크기 `requestSize(request, lengthOf)` — tokens = 범위 줄 × 평균 줄 길이 · diffView = 창 행 × 평균 줄 길이 · codeView = 창 줄 × 평균 · … diffContext = 7 × 평균 줄 길이". 코드 `protocol.ts:220-238`은 줄 수(`end − start`)·`7`만 쓰고 `lengthOf`가 없다(`rg lengthOf` 0건). 2,000자 줄 200줄 tokens(400K자)가 10자 줄 300줄 codeView보다 앞선다 |

### V3-2. 역방향 탐색

`scan-surface.sh 4c72441f..dd0528ae` — 생산 코드 hunk 2파일, 새 export 0. 결함 0.

- `charsBefore`·`textChars`(diffView 응답) 생산자만 있고 소비처 0(`rg charsBefore src --glob '!*.test.*'` → `diffView.ts`·`codeView.ts`·`protocol.ts`뿐) — D-064로 복사 직렬화가 빠진 뒤 남은 필드다. 이번 diff 밖이라 확장 후보(Y5)로 둔다.

### V3-4. 고장 이력

원장 재실행: [`r3-mutations.jsonl`](evidence/r3-mutations.jsonl) 144행 전부를 `mutate.py`로 다시 돌렸다 — 단위·통합 137행 red 133 · green 4(S12g · J5x · J1d · S14s), Electron 7행 red 4 · green 3. 기록 `exit`와 144/144 일치([`evidence/v3-ledger-rerun.tsv`](evidence/v3-ledger-rerun.tsv)). 아래는 이번 턴의 새 변이다([`v3-mutations.spec.jsonl`](evidence/v3-mutations.spec.jsonl) · [`v3-mutations.tsv`](evidence/v3-mutations.tsv)).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| V3-M1 · M2 | `usePanelSelection.ts:23-24` · `:22` | 제거 | ⑮ 정리의 `setSuppressed(false)` · 제스처 idle | 잡음 | ps9 · ps9b | ⑦ | — |
| V3-M3 | `:19` | 다른 값 | 레이아웃 효과 → 패시브 효과(자식 레이아웃 알림 뒤) | 잡음 | ps9b | ⑥ | — |
| V3-M4 | `:26` | 다른 값 | deps `[documentKey]` → `[]` | 잡음 | ps9 · ps9b · ps9c | ⑥ | — |
| V3-M5 | `:60` | 고정값 | 범위 해제 조건 → `true`(진행 중이면 다른 패널 선택도 해제) | 못 잡음 | — | ⑥⑦ | 확장(Y1) |
| V3-M7 | `FileDiffSection.tsx:454` | 다른 값 | ⑤ 키 `row.id` → `item.index` | 못 잡음 | — | ⑥⑦ | 확장(Y2) |
| V3-M9~M13 | `check-visible-views.mjs:35-38` · `:56` | 제거 | ② 바깥 키 항을 순서·길이·빈 값·결과 없음으로 나눔 · ③ `crossExpected` 빈 값 | 잡음 5/5 | vv12 · vv12b · vv13b | ⑦ | — |
| V3-M14~M16 | `:54` · `:55` · `:33` | 고정값 | 화면·시나리오 한정 항 → `true` | 잡음 3/3 | vv1 외 30 | ⑤ | — |
| V3-M17 · M19 | `:25` · `:61` | 제거 | `keysBefore` 빈 배열 · c4 `selectionBefore` 빈 값 | 잡음 | vv4b · vv10b | ⑦ | — |
| V3-M18 | `:25` | 제거 | `keysAfter` 배열 검사 | 동치 | — | ⑦ | — `keysAfter` 없음이면 `.some` TypeError → `main` catch → `verdict: false` · exit 1 (fail-closed) |
| E1-C21~C24 | `protocol.ts:164` · `:187` · `:188` · `:193` | 제거 | 키에서 테마 · 단어 강조 · 펼침 범위 · codeView 끝 | 잡음 4/4 | pk 계열 | ⑦ I1 | — |
| E2-C1~C8 · C26 | `client.ts:225` · `:226` · `:234` · `:233` · `:242` · `:493` · `:365` · `:304` · `:440` | 제거·고정값 | 임차 중 닫기 · 대기 작업 중 닫기 · `doc.close` 전송 · 용량 반환 · 대기 문서 알림 · `doc-unavailable` · `unknown-doc` 재시도 · `sent` 기록 · 상한 | 잡음 9/9(C8 은 5분 시간 초과 — 재전송 무한) | d · cs · q 계열 | ⑦ I1 | — |
| E4-C9 · C10 · C11 · C25 | `client.ts:382` · `:381` · `:350` · `:481` | 제거·고정값 | 양보 횟수 · 등급 정렬 · 대기자 0 이면 버림 · `start < 0` | 잡음 4/4 | q 계열 | ⑦ I1 | — |
| E4-C13 | `client.ts:416` | 제거 | 대기 중 양보 작업 취소 시 `discard` | 못 잡음 | — | ⑥ | 확장(Y3) |
| E3-C14~C17 | `tokens.ts:61` · `:45` · `:43` · `:49` | 제거 | 체크포인트 기록 · 가까운 체크포인트 찾기 · 테마 사슬 상한 · `\r` | 잡음 4/4 | t 계열 · h11 | ⑦ I1 | — |
| E23-C18 | `state.ts:85` | 제거 | 문서 다시 열기·닫기 때 양보 작업 버림 | 못 잡음 | — | ⑥ | 확장(Y4) |
| E25-C19 | `state.ts:130` | 고정값 | `{ view }` 원천 → 원문 문서 | 잡음 | rd · v 계열 | ⑦ I1 | — |
| E6-D1 | `diffView.ts:18` | 제거 | 삭제 줄 짝 | 잡음 | cp1 | ⑦ I1 | — |
| E6-D10 | `diffView.ts:199` | 제거 | `options.highlightWords &&` | **못 잡음** | — | ⑦ I1 | 이행(L2) |
| E7-D2 | `diffView.ts:87` | 제거 | old 축 색인의 `added` 제외 | **못 잡음** | — | ⑦ I1 | 이행(L3) |
| E7-D3 | `diffView.ts:90` | 제거 | new 위치 색인 첫 일치 | 동치 | — | ⑦ I1 | — 한 파일 diff 안 `newLine` 은 유일하다(context·added 줄마다 다음 번호 · 공백 접기도 짝을 context 한 줄로 합침) |
| E7-D4 | `diffView.ts:92` | 제거 | 증감 수 `removed++` | **못 잡음** | — | ⑦ I1 | 이행(L4) |
| E7-D5~D9 · D11 | `:93` · `:138` · `:113` · `:112` · `:108` · `:210` | 다른 값·제거 | 폭 `displayColumns` · `canDown` 끝 항 · 펼침 정렬 · 문맥 3 · 배치 캐시 키 · 짝 행 ID | 잡음 6/6 | p · hx · sb · v 계열 | ⑦ I1 | — |
| E7-D12 | `diffView.ts:163` | 제거 | 행 글자 누적(`charsBefore`) | 못 잡음 | — | ⑥ | 확장(Y5 — 소비처 0) |
| E18-D13 | `diffViewPath.ts:5` | 다른 값 | 문자열 경계 `<=` → `<` | 잡음 | dv · v 계열 | ⑦ I1 | — |
| E12-K1~K5 · K7~K11 | `markdownDocumentBlocks.ts:89` · `:90` · `:91` · `:92` · `:98` · `:76` · `:55` · `:48` · `:67` · `:22` | 제거·다른 값 | 합치기 다섯 · HTML 끝 표지 · 끝 개행 · 조각 행 수 · 표 행 상한 · 조각 1개 · 주석 끝 | 잡음 10/10 | mb · f · m 계열 | ⑦ I1 | — |
| W3e · N6e · N8e · N10e · W1e · W2e · S5e | Electron 원장 | — | 원장 재실행(`xvfb-run`) | red 4 · green 3 — 기록과 7/7 일치 | 7화면 판정 | ④ | W1e·W2e·S5e 는 경계(ΔV6 VP-34 · ΔV7 po6 가 단위·통합에서 잡음) |

- 원복: 매 실행 뒤 `mutate.py` "모든 파일 원문 그대로". 변이는 임시 워크트리 두 곳에서 돌렸고 작업 트리는 건드리지 않았다.

### V3-5. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거 |
|---|---|---|---|
| VP-34 MD-05 ↔ UT-05 | UT | PASS | 원장 W1·W2·R2·W3 red 재현 |
| VP-59 MD-17 ↔ UT-17 | UT | PASS | ΔV7 등록 vv12·vv14 red · ②③④ 항 단위 V3-M9~M19 red(M18 동치) · J3f·J3l·J4c red |
| VP-26 AR-07 ↔ IT-07 | IT | PASS | po6: S5 red · ④~⑪ 원장 red. ⑤ 키 값 변이(V3-M7)는 확장 Y2 |
| VP-14 SD-05 ↔ ST-05 | ST | PASS | ps9b(D65 · V3-M3) · ps13(S12b) · ps17(S12i) · ⑮ 세 항(V3-M1·M2 · S15c) red · 실제 Chromium K5 재현 |
| VP-09 R-09 ↔ AT-09 | AT | PASS | `check-visible-views` exit 0 · 23기록 verdict true · 원장 Electron 행 아래 |
| VP-50 · VP-52 (REGRESSION) | AT · ST | PASS | `check-transcript-selection` 90기록 · `check-transcript-streaming` 18기록 · exit 0 |
| VP-48 | UT | PASS | VP48-a·b·c·touch red(h10 · h11 · h12) |
| VP-36 MD-07·MD-08 ↔ UT-07 | UT | **PAIR_FAIL** | L1 — `requestSize` 가 EP-4 ① 산식과 다르고, q2 는 `highlight`(`code.length`)만 대조한다 |
| VP-30 MD-01 ↔ UT-01 | UT | **PAIR_FAIL** | L2 — EP-6 ② "`highlightWords` 일 때" 항 제거 green |
| VP-31 MD-02 ↔ UT-02 | UT | **PAIR_FAIL** | L3 · L4 — EP-7 ① "축 줄 색인(old 는 added 제외)" · "증감 수" 항 제거 green |
| VP-06 · VP-01 · VP-11 | AT · AT · ST | BLOCKED_BY:VP-36 · VP-30·VP-31 · VP-36 | 하위 pair root 실패 |
| VP-02·03·04·05·10·12·13·15·20~25·32·33·35·37·38·39·49·51·56·57 | 전 레벨 | PASS(재실행 범위) | 원장 pair 행 red 재현 + 위 E1~E25 변이 red. EP-5·8·9·11·15·16·19·21·22·24 자리 전수는 못 봤다 |

| 결과 | AC |
|---|---|
| ❌ 3 | AC5(L1) · AC8(L2) · AC17(L3) |
| ⚠️ 10 | AC30(Windows 사람 실기) · AC10·AC18~AC22·AC32~AC34(EP-8·11·15·16·19·21·22·24 자리 전수 미수행 — 못 본 것) |
| ✅ 27 | 나머지 |

- 합계 `27 + 10 + 3 = 40`. 자기보고 `39/40`(trailer `dd0528ae` · plan r3 구현 보고) — 불일치. L4(증감 수)는 OpenCode 머리 증감 표시(`ToolBody.tsx:94` ← `DiffTable.tsx:337` 요약)로 가지만 그 동작을 적은 AC가 없어 VP-31 에만 귀속했다.

### V3-9. 게이트 재실행 (검증 트리 `dd0528ae`)

| Gate | 결과 | 관측 |
|---|---|---|
| 가드 5종 | PASS | append-only · doc-inventory `--check` · product-naming · test-budgets · ui-thread — 전부 exit 0 |
| `npm run lint` | PASS | exit 0 · 실행 뒤 `git status` 변화 0 |
| `npm run typecheck` | PASS | exit 0 |
| `vitest run`(필터 없음) | 기준선 | 2,843 스위트 · 10,726 테스트 · 통과 10,203 · 실패 393 · skip 130. 실패 파일 34개는 전부 `src/main/**` + `settlement.integration.test.ts`(SQLite) — `NODE_MODULE_VERSION`(Electron ABI) 46건 서명 + Windows 경로 단언. verify 2 와 같은 393 · r3 변경 파일 ∩ 실패 파일 = ∅ · r3 는 `src/main` 0파일 |
| `node --test scripts/*.test.mjs` | PASS | 1,097 통과 · 실패 0 |
| `electron-vite build` · `smoke-preload` | PASS | exit 0 · `require 는 electron 뿐 · ooBridge 키 7` |
| `smoke-hosts` | 환경 | 데이터 호스트 종료 코드 1 — verify 1·2 와 같은 SQLite ABI 서명(N1) |
| `check-visible-views`(운영 gate) | PASS | `xvfb-run` · exit 0 · 23기록 verdict true · Electron 39.8.10 — [`evidence/v3-check-visible-views.json`](evidence/v3-check-visible-views.json) |
| `check-transcript-selection` · `check-transcript-streaming` | PASS | exit 0 · 90 · 18기록 verdict true |

- 구현자 보고(`vitest` 실패 22)와 다른 것은 ABI 차이다 — 이 환경의 `better-sqlite3` 는 Electron ABI 라 SQLite 스위트 371건이 더 실패한다.
- 잔여물: 임시 워크트리 2곳(정리함) · K5 프로브는 저장소 밖에서 빌드하고 소스만 evidence 에 남겼다.

### V3-10. Repository operation checks

| 검사 | 판정 | 근거 |
|---|---|---|
| trailer 파싱 | PASS | `dd0528ae` 6키 · `4c72441f` 5키 반환 |
| `[구현자 기입] r3` 일곱 필드 | PASS | 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금(검산 줄 `87 · 11 · 12 · 34 = 144`) · Product/UX · 놓친 잠재 문제 · 구현 보고 · Review Signals |
| 대상 커밋 좌표 | 기입 | INDEX `(r3 구현 — 검증자 기입)` → `dd0528ae`(`git cat-file -t` commit). `origin/main` 조상 아님(PR 미병합) |
| 원장 형식 | PASS | `r3-mutations.jsonl` 144행 — `replace`·`with`·`occurrence`(1부터)를 `mutate.py` 형식으로 옮겨 그대로 적용됨 |

### V3-11. 발견 분류

| # | 발견 | 분류 | 근거(인용·재현) | disposition |
|---|---|---|---|---|
| L1 | 작업 크기가 EP-4 ① 산식과 다르다 — `requestSize` 에 평균 줄 길이(`lengthOf`)가 없고 tokens·diffView·codeView 는 줄 수, diffContext 는 `7` 이다. 같은 등급·같은 양보 횟수에서 큰 작업이 먼저 나갈 수 있다. q2 는 `highlight` 만 대조한다 | 이행 | EP-4 ① "작업 크기 `requestSize(request, lengthOf)` — tokens = 범위 줄 × 평균 줄 길이 · diffView = 창 행 × 평균 줄 길이 · codeView = 창 줄 × 평균 · diffLocate = 앵커 수 × 16 · diffContext = 7 × 평균 줄 길이 · markdown = `end − start`" · `protocol.ts:220-238` · `rg lengthOf` 0건 | BLOCKING |
| L2 | `diffView.ts:199` `options.highlightWords &&` 를 지워도 green — 단어 강조를 끈 보기에도 단어 범위가 실린다 | 이행 | EP-6 ② "행 창 `wordSpan` = … `changedWordSpan`(가시 행만 · `highlightWords` 일 때)" · E6-D10 | BLOCKING |
| L3 | `diffView.ts:87` old 축 색인의 `added` 제외를 지워도 green — 추가 줄 뒤 삭제 줄이 없는 축 행의 토큰을 찾는다(`FileDiffSection.tsx:923` 이 소비) | 이행 | EP-7 ① "축 줄 색인(old 는 added 제외 · new 는 removed 제외)" · E7-D2 | BLOCKING |
| L4 | `diffView.ts:92` `removed++` 를 지워도 green — 모델 요약의 삭제 수가 0 이 된다 | 이행 | EP-7 ① "… · 증감 수" · E7-D4 | BLOCKING |
| Y1 | 진행 중 제스처에서 다른 패널에만 선택이 있어도 범위를 해제하는 변이(`usePanelSelection.ts:60` → `true`) green | 확장 | V3-M5 · ⑫ 규칙 칸은 "접힌 선택이거나 이 화면 선택이면 범위 해제"만 적고 그 밖 분기를 입력으로 열거하지 않는다 — 다른 쪽을 "해제 안 함" 으로 읽으려면 해석이 필요하다 | NEXT_HANDOFF(확장) |
| Y2 | ⑤ 마운트 키를 `row.id` 대신 가상 인덱스로 바꿔도 green — 펼침으로 같은 인덱스에 다른 행이 올 때만 갈린다 | 확장 | V3-M7 · ⑤ 규칙 칸이 적은 분기(늦은 행 도착 · 창 밖 고정 행)는 인덱스 키로도 알림이 난다 | NEXT_HANDOFF(확장) |
| Y3 | 대기 중인 양보 작업을 취소할 때 워커의 중단 생성기를 버리는 `discard` 를 지워도 green | 확장 | E4-C13 · EP-4 ④ 는 실행 중 취소의 워커 교체만 적는다 | NEXT_HANDOFF(확장) |
| Y4 | 워커가 문서를 다시 열거나 닫을 때 그 문서의 양보 작업을 버리는 줄을 지워도 green | 확장 | E23-C18 · EP-23 ② 목록(체크포인트·줄 색인·diff 모델·파생 축·보기 문서)에 양보 작업이 없다 | NEXT_HANDOFF(확장) |
| Y5 | diffView·codeView 응답의 `charsBefore`·`textChars` 소비처 0 — D-064 뒤 남은 필드 | 확장 | E7-D12 · `rg charsBefore` 생산자만 | NEXT_HANDOFF(확장) |
| N1 | `smoke-hosts` SQLite ABI | 비귀속 | 환경 서명 · `src/main` 변경 0 | NON_BLOCKING |

### V3 Review Signals — 사실만

- 이전 라운드와 같은 증상: verify 1 이 "다음 verify 가 전수를 이어 받는다" 고 남긴 V1 rev 3 자리(EP-1~EP-25)가 verify 3 까지 전수 sweep 되지 않았다. 구현자 r3 강제 지점 표는 pair 마다 `SELF_PASS` 를 적었지만 원장은 pair 당 1~6행이다(I1 69행 / 자리 약 176).
- 막았어야 할 plan 지침: L1~L4 의 항은 V1 rev 3 §10 자리 문장에 이미 있었다. L1 은 구현 첫 라운드부터 산식과 달랐다(`requestSize` 시그니처에 `lengthOf` 없음).
- 반복 환경 한계: Electron ABI ↔ Node ABI 동시 불가(SQLite 371 · smoke-hosts).
- 독립 축(⑥) 발견: 3축 21시도 중 이행 0 · 확장 5(Y1~Y5) — L1 은 diff 비판 읽기, L2~L4 는 ⑦ I1 sweep 에서 나왔다.

---

## verify 2회째 (원문 보존)

## 판정 (verify 2회째)

**RETURN_TO_PLAN** — 확장 후보 5건(X1~X5)이 확장 창 안(2회째)이라 `PLAN_GAP`이다. 같은 판정 안에 이행 결함 5건(K1~K4 · I1 잔여)이 `BLOCKING`이라, 설계자가 X1~X5를 채택하거나 경계로 선언한 뒤 구현자가 K1~K4·I1을 고친다. 이번 판정 뒤의 설계 턴이 열거 원문을 늘릴 수 있는 마지막 턴이다.

- 닫힌 것: I3(W1·W2·W3 vitest red · W3e Electron 7화면 c2 red) · I4(`[구현자 기입] r2` 일곱 필드) · H1(root 래퍼 없이 exit 0 · vv 12케이스 · 종료 코드 경로).
- 합계 재측정: ✅ 6 · ⚠️ 31 · ❌ 3 = 40(§V2-5). 자기보고 `Criteria-Met: 25/40`과 다르다 — ΔV6 AC15·AC35·AC40 은 sweep 못 잡음(K1~K4), V1 rev 3 AC 다수는 구현자 스스로 pair 를 `SELF_BLOCKED` 로 남겼다.
- 막지 않는 것: 이번 변경 범위의 게이트는 통과했다. vitest 실패 393건은 SQLite ABI 371 + `src/main` Windows 경로 22 이고 변경 전 트리와 차집합 ∅ 이다(§V2-9).

### V2 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `1e9f5524..56f0ca03` — 구현 `56f0ca03`(r2). app 57파일 +4,849 / −1,069 (`git diff --stat 1e9f5524..56f0ca03 -- app`) |
| 구현 전 plan 기준 | `1e9f5524`(ΔV6) · `a6ee4d52`(verify 1 정정) |
| 유효 V | `V1 rev 3 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6` |
| 라운드 | 2 → 판정 뒤 3 |
| 확장 창 | verify 2회째 — 창 안(마지막). 이 뒤 설계 턴이 plan 동결 전 마지막 확장 턴 |
| 독립 축(⑥) | 3축 · 시도 12 — 생산자 자리 제거(S4·S5·S5e — 구현자 목록은 공급 값 `null`만) · 규칙 칸 항 단위 제거(⑫ 10항 · ⑮ 2항 · EP-31 13항 — 구현자는 항목 단위) · r2 의 새 행 유지(`useDiffViewWindow.ts` `retained`) 색인·무효화 읽기(발견 0) |
| 열거 sweep(⑦) | ΔV6 가 새로 열거한 EP-30 15자리·EP-31 6자리 전수 + 직전 실패(W1~W3) + diff 가 닿은 이전 `잡음` 행(④). V1 rev 3 EP-1~EP-25 는 구현자가 `SELF_BLOCKED` 로 남겨 이번에 돌리지 않았다(못 본 것 — 구현자가 닫았다고 주장한 뒤 verify 가 전수) |
| 발견 분류 | 이행 5(K1~K4 · I1 잔여) · 현재 0 · 확장 5(막음 5) · 동치 1(J5x) · 비귀속 1(N1 승계) |
| 구현 주체·문맥 | 구현 codex · 설계자 = 검증자(Claude) |

### V2-0. 기준선 · plan validity

- 구현 커밋이 바꾼 `plan.md` hunk 는 `:11`(상태 줄)과 `:2219-2416`(`[구현자 기입] r2`)뿐이다 — AC·Decision·V 행 변경 0, 원 기준으로 채점.
- EP-30 자리 검색 재실행 → 16줄(`FileDiffSection.tsx:451` 은 r2 diff 로 `:436` 에서 이동) = 자리 15 + 뺀 1(`TranscriptViewport.tsx:509`), 차집합 0. 술어 밖 검색 `rg "useMountedRows\(|VirtualRowMountContext" src --glob '!*.test.*'` 도 같은 공급자 3 · 생산자 2.
- EP-31 자리 검색 → 9줄(정의 5 · 사유 3 · 호출 1), plan 과 같다.

### V2-1. 구현 결과 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | 없음(검사 범위) | c2 기대값은 probe 통과 문자열이 아니라 `electron-main.mjs:93-107` 원자료, c1 기대값은 행 표지 slice(`:139`) — 판정기가 다시 계산 |
| 생산 코드 신규 경로 | 결함 0 | `useDiffViewWindow.ts` `retained` 는 같은 `source`·`options` 객체일 때만 이전 행을 쓰고 `index - retained.start` 로 색인 · 문서 ID `git:<path>` 의 revision 은 patch 객체 identity(`documents.ts` `revisionOf`)라 같은 경로의 다른 patch 와 충돌 없음 |
| A 대신 B | 없음 | 문자열 patch 의 200,000자 경로 판정은 EP-18 ① "patch ≤ 200,000" 원문과 같다 |
| 가려진 자리 | **있음 — K1** | Git 본문에서 `FileDiffSection.tsx:395` `useVirtualRows`(④)가 같은 스크롤마다 알림을 내 `:451` 행 ID 생산자(⑤)를 지워도 관측이 같다 |

### V2-2. 역방향 탐색

`scan-surface.sh 1e9f5524..56f0ca03` 후보 14 — 결함 0.

| 후보 | 판정 | 근거 |
|---|---|---|
| `*.testfixture.ts` 5심볼(`mountViewport`·`renderGit` 등) | 정상 | 테스트 전용 픽스처 파일 |
| `buildDiffRequirementSubmission` · `shouldCancelDiffRequirementDraft` | 오탐 | 같은 파일 `FileDiffSection.tsx:1301` · `:1321` 이 호출(파일 내부 참조) |
| `transcriptFixtures.ts` `generateTranscriptFixture` 외 | 정상 | `main.tsx:24` 개발 도구 동적 import 가 `installTranscriptDevTools` 로 진입 |
| 형제 정책 비대칭 | 없음 | 스크립트 §3 출력 `(없음)` |

### V2-4. 고장 이력

| ID | `파일:줄` | 종류 | 바꾼 내용 | 직전 결과 | 결과 | 잡은 테스트 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|---|
| W1 | `rowMount.ts:7` | 다른 값 | 추가 판정 → 크기 비교 | 못 잡음 | 잡음 | rm2·rm5 외(5) | ①③ | — |
| W2 | `:7` | 다른 값 | 제거만도 참 | 못 잡음 | 잡음 | rm3·ps11 외(3) | ①③ | — |
| R2 | `:8` | 제거 | 기준 갱신 | — | 잡음 | rm8 외(12) | ① | — |
| W3 | `:9` | 제거 | 알림 | 못 잡음 | 잡음 | 18 | ①③ | — |
| W3e | `:9` | 제거 | Electron | 못 잡음 | 잡음 | 7화면 c2 | ①③ | — |
| W1e · W2e | `:7` | 다른 값 | Electron | 못 잡음 | 못 잡음 | — | ③ | 경계 — ΔV6 VP-34 가 W1·W2 oracle 을 rm5·rm3 으로 고정(AT 등록 변이는 W3·`null` 뿐) |
| N6 · N8 · N10 | `TranscriptViewport.tsx:704` · `DiffReview.tsx:126` · `ArtifactViewer.tsx:132` | 빈 값 | 공급 `null` | — | 잡음 | tn1·tn4 · po1·po3 · po4·po5 | ① | — |
| N6e · N8e · N10e | 같음 | 빈 값 | Electron | — | 잡음 | transcript 3 · git 2 · artifact 2 화면 c2 | ① | — |
| R7 | `TranscriptViewport.tsx:463` | 제거 | 조기 반환 | — | 잡음 | tn2·tn3 | ① | — |
| R12f · R13 · R14u/c/b · R15 | `usePanelSelection.ts:33·41·45·49·50·22` | 제거 | 등록 6 | — | 잡음 6/6 | ps4 · ps5 · ps6 · ps7 · ps8 · ps9 | ① | — |
| S4 | `useVirtualRows.ts:45` | 제거 | 생산자 ④ | — | 잡음 | po4 외(2) | ⑦⑥ | — |
| S5 · S5e | `FileDiffSection.tsx:451` | 제거 | 생산자 ⑤(vitest · Electron) | — | **못 잡음** | — | ⑦⑥ | 이행(K1) |
| S9 · S11 | `DiffReview.tsx:128` · `ArtifactViewer.tsx:134` | 제거 | pointerdown 배선 | — | 잡음 | po3 · po5 | ⑦ | — |
| S7a~S7e | `TranscriptViewport.tsx:463-468` | 제거 | `none` 항 · `outside` 항 · 범위 해제 · 표시 해제 · 제스처 cancel | — | 잡음 5/5 | tn1~tn4 | ⑦ | — |
| S12a | `usePanelSelection.ts:60` | 제거 | `gesture.current === 'idle' &&` | — | **못 잡음** | — | ⑦⑥ | 이행(K2) |
| S12b | `:60` | 제거 | `!inside.current &&` | — | **못 잡음** | — | ⑦⑥ | 이행(K2) |
| S12c | `:60` | 제거 | `&& !contains(selection)` | — | **못 잡음** | — | ⑦⑥ | 이행(K2) |
| S12i | `:33` | 제거 | `anchorNode` 항(형제 `focusNode` 는 R12f) | — | **못 잡음** | — | ⑤⑦ | 이행(K2) |
| S12d · S12f · S12h · S13b · S15b | `:61` · `:61` · `:63` · `:39` · `:25` | 제거 | 범위 해제 · `contains` 항 · cancel · 안쪽 기록 · 제스처 idle | — | 잡음 5/5 | 12 · 12 · 7 · ps5 · ps9 | ⑦ | — |
| S12e · S12j · S12g | `:61` · `:31` · `:62` | 제거 | `isCollapsed ||` · `!selection.isCollapsed &&` · notify 의 안쪽 기록 리셋 | — | 못 잡음 | — | ⑥ | 확장(X1) |
| S15c | `:26` | 제거 | 문서 전환 시 안쪽 기록 초기화 | — | **못 잡음** | — | ⑦ | 이행(K3) |
| S14s | `:45` | 맞바꿈 | pointerup → pointercancel | — | 동치 | — | ⑤ | — (`selectionGuard.ts:45-48` 같은 분기) |
| J2k · J2c · J1m | `check-visible-views.mjs:32·39·88` | 제거 | 등록 3 | — | 잡음 | vv4 · vv5 · vv2·vv11 | ① | — |
| J1u · J2s · J2p · J3e · J3m · J4s · J5e · J6 | `:75·41·42·48·51·63·97·101` | 제거·다른 값 | sweep 8 | — | 잡음 8/8 | vv3 · vv6 · vv7 · vv8·vv9 · vv9 · vv10 · vv11 · vv11 | ⑦ | — |
| J3f · J3l | `:52` · `:53` | 제거 | `reachedFirst` · `reachedLast` | — | **못 잡음** | — | ⑦ | 이행(K4) |
| J4c | `:64` | 고정값 | c4 `clipboard === selectionBefore` | — | **못 잡음** | — | ⑦ | 이행(K4) |
| J2o · J3x · J4k · J1d | `:33-38` · `:54-56` · `:61` · `:74` | 고정값·제거 | transcript 바깥 키 · 교차 복사 · c4 새 키 · 중복 기록 | — | 못 잡음 | — | ⑥ | 확장(X2~X5) |
| J5x | `:102` | 제거 | `out.error` 조기 반환 | — | 동치 | — | ⑦ | — `records` 없는 out 은 `for…of undefined` TypeError → `:109` catch → exit 1, vv11 하네스 오류 입력 green |
| V57-1r · V57-2 · Y3 · Y4 | `openCodeBlocks.ts:531·736·897·913` | 뒤집기·빈 값 | 직전 잡음 | 잡음 | 잡음 4/4 | ob · bg4a·bg4b | ④ | — |
| V2-6 · Y5 · Y6 · Y7 | `WorkerMarkdownTail.tsx:87·102·101·96` | 제거 | 직전 잡음(oracle 파일 수정됨) | 잡음 | 잡음 4/4 | s13·s15 외 | ④ | — |
| VP48-a · VP48-c | `worker/state.ts:89·76` | 제거 | 닫기 문서 삭제 · 모델 LRU 퇴거 | — | 잡음 | handler 2 · 1 | ① VP-48 | — |
| VP48-b | `worker/state.ts:88` | 제거 | 닫기·교체 시 diff 모델 버림 | — | **못 잡음** | — | ① VP-48 | 이행(I1 — plan 좌표 h10 부재) |

- 원복: 매 실행 뒤 `mutate.py` "모든 파일 원문 그대로" + `git status --porcelain` 빈 출력. 원자료 [`evidence/v2-mutations.tsv`](evidence/v2-mutations.tsv) · spec [`evidence/v2-mutations.spec.jsonl`](evidence/v2-mutations.spec.jsonl).
- 하한 ④: r2 가 oracle 파일(`streamingSessions.test.ts` · `WorkerMarkdownTail.test.ts`)과 판정 도구(`check-transcript-selection.mjs`)를 고쳤다 — 해당 `잡음` 8행 재실행 8/8 red, `red → green` 0.

### V2-5. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거 |
|---|---|---|---|
| VP-34 MD-05 ↔ UT-05 | UT | PASS | `rowMount.test.ts` rm1~rm8 · 등록 W1·W2·R2·W3 red · ① 분기 rm1~rm5·rm7 |
| VP-59 MD-17 ↔ UT-17 | UT | PAIR_FAIL | 등록 3/3 red · ③ "첫·끝 행 도달" · ④ "clipboard === selectionBefore" 입력 없음(K4) |
| VP-26 AR-07 ↔ IT-07 | IT | PAIR_FAIL | 공급 `null` 3 · R7 · S4·S9·S11·S7a~e red · ⑤ 생산자 제거 green(K1) |
| VP-14 SD-05 ↔ ST-05 | ST | PAIR_FAIL | 등록 6/6 red · ⑫ 분기 4항(K2) · ⑮ 셋째 항(K3) 입력 없음 |
| VP-09 R-09 ↔ AT-09 | AT | BLOCKED_BY:VP-26 | `check-visible-views` 23기록 verdict true · W3e·N6e·N8e·N10e red · ⑤ 자리만 VP-26 과 같은 root(S5e green) |
| VP-50 (REGRESSION) | AT | PASS | `check-transcript-selection` exit 0 · 90기록 verdict true |
| VP-52 · VP-56 · VP-57 | ST · UT · UT | PASS | `check-transcript-streaming` exit 0 · 18기록 · ④ V57·V2-6·Y3~Y7 8/8 red |
| VP-48 | UT | PAIR_FAIL | plan 좌표 h10·h11 이 `handler.test.ts` 에 없다 · VP48-b green(I1) |
| VP-01~VP-51 의 나머지(V1 rev 3) | 전 레벨 | PAIR_FAIL(I1 승계) | 구현자가 `[구현자 기입] r2` 강제 지점 표에서 `SELF_BLOCKED` 로 남김. 이번엔 좌표 실재만 대조 — I1 표 파일 전부 존재, 라벨은 `d2/d7`·`rt1/rt2` 같은 합친 제목으로 존재, 부재는 h10·h11 |

| 결과 | AC |
|---|---|
| ✅ 6 | AC4 · AC25 · AC28 · AC37 · AC38 · AC39(bg0~bg4b 라벨 존재 · ④ 4/4 red) |
| ❌ 3 | AC15 · AC35(K1~K3) · AC40(K4) |
| ⚠️ 31 | 나머지 — 자기보고 ⚠️ 15(AC3·9·12·13·14·16·17·19·20·22·24·30·31·32·34) + 자기보고 ✅ 이지만 pair 가 `SELF_BLOCKED`·등록 변이 미실행인 16(AC1·2·5~8·10·11·18·21·23·26·27·29·33·36) |

- 합계 `6 + 3 + 31 = 40`. 자기보고 `25/40`(trailer `56f0ca03` · plan `:2369`) — 불일치. trailer `Criteria-Pending` 15개는 plan ⚠️ 15 행과 같다.

### V2-9. 게이트 재실행 (검증 트리 `56f0ca03`)

| Gate | 결과 | 관측 |
|---|---|---|
| `npm run typecheck` | PASS | exit 0 |
| `npm run lint` | PASS | 오류 0 · 경고 12 · 실행 뒤 `git status` 변화 0 |
| 가드 5종 | PASS | append-only · doc-inventory `--check` · product-naming 2,627파일 · test-budgets 실-git 18 · ui-thread — 전부 exit 0 |
| `vitest run`(필터 없음) | 기준선 | 2,842 스위트 · 10,696 테스트 · 통과 10,173 · 실패 393 · skip 130. 371 = `NODE_MODULE_VERSION`(Electron ABI · 환경) · 22 = `src/main` 9파일 Windows 경로. `1e9f5524` 워크트리 같은 파일 실행의 실패 27(=22 + settlement SQLite 5)과 양방향 차집합 ∅ · r2 변경 파일 ∩ 실패 파일 = ∅ |
| `node --test scripts/*.test.mjs` | PASS | 1,078 통과 · 실패 0 |
| `electron-vite build` · `smoke-preload` | PASS | exit 0 · `require 는 electron 뿐 · ooBridge 키 7` |
| `smoke-hosts` | 환경 | 데이터 호스트 종료 코드 1 — verify 1 과 같은 SQLite ABI 서명. r2 는 `src/main` 0파일 |
| `check-visible-views`(ΔV6 운영 gate) | PASS | root 에서 래퍼 없이 exit 0 · 23기록 verdict true · Electron 39.8.10 — [`evidence/v2-check-visible-views.json`](evidence/v2-check-visible-views.json) |
| `check-transcript-selection` · `check-transcript-streaming` | PASS | exit 0 · 90 · 18기록 — [`v2-check-transcript-selection.json`](evidence/v2-check-transcript-selection.json) · [`v2-check-transcript-streaming.json`](evidence/v2-check-transcript-streaming.json) |

- 잔여물: 임시 워크트리(삭제함) · 변이 원복 확인. 작업 트리에는 이 verify 산출물만 남는다.

### V2-10. Repository operation checks

| 검사 | 판정 | 근거 |
|---|---|---|
| trailer 파싱 | PASS | `56f0ca03` 6키 · `1e9f5524` 5키 반환 |
| `[구현자 기입] r2` 일곱 필드 | PASS | 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금(검산 줄 `14 · 4 · 3 · 4 = 25` = 표 21+4행) · Product/UX · 놓친 잠재 문제 · 구현 보고 · Review Signals |
| 대상 커밋 좌표 | 기입 | INDEX `(r2 구현 — 검증자 기입)` → `56f0ca03`. `origin/main` 조상 아님(PR 미병합) |
| `app/AGENTS.md` 변경 | PASS | `check-visible-views.mjs` 한 줄 · 비밀·변동성 정보 없음 |

### V2-11. 발견 분류

| # | 발견 | 분류 | 근거(인용·재현) | disposition |
|---|---|---|---|---|
| K1 | EP-30 ⑤ Git 행 ID 생산자를 지워도 po1·AT c2 `git-*` green — 같은 본문의 ④ 가 같은 커밋에 알림을 낸다 | 이행 | EP-30 ⑤ "Git 본문 마운트 키 = 그린 행의 `row.id`" · S5·S5e | BLOCKING |
| K2 | EP-30 ⑫ 규칙 칸의 분기 입력 누락 — 드래그 중·기록 없음(S12a) · 기록 있음·선택 밖(S12b) · 기록 없음·선택 안(S12c) · anchor 만 안(S12i) | 이행 | ⑫ "제스처 idle · 안쪽 기록 없음 · 선택이 이 화면에 없음 → 유지 · 끝 하나라도 이 화면 안 → 선택 해제 · 드래그 중 → 해제 + 억제" — 입력 칸이 규칙 칸보다 좁다 | BLOCKING |
| K3 | EP-30 ⑮ 셋째 항(안쪽 기록 초기화)을 지워도 ps9 green | 이행 | ⑮ "억제 해제 · 제스처 idle · 안쪽 기록 초기화 — 세 항" · S15c | BLOCKING |
| K4 | EP-31 ③ 첫·끝 행 도달 · ④ 클립보드 항 입력 없음 | 이행 | ③ "clipboard === expected · 마운트 행 < 150 · 첫·끝 행 도달" · ④ "selectionAfter === selectionBefore ∧ clipboard === selectionBefore" · J3f·J3l·J4c | BLOCKING |
| I1 | 잔여 — V1 rev 3 pair 다수 `SELF_BLOCKED` · 자기보고 ⚠️ 15 · `handler.test.ts` h10·h11 부재(구현 보고 강제 지점 표는 "h10~h13" 으로 적음) · VP48-b green | 이행 | VP-48 "h10(닫기 뒤 체크포인트·색인·모델·보기 문서 0)" · EP-23 ② "문서 닫기 → … diff 모델 … 삭제" | BLOCKING(승계) |
| X1 | 접힌·빈 선택의 처리 항(`usePanelSelection.ts:31` · `:61` `isCollapsed` · `:62` notify 안쪽 기록 리셋) — 지워도 green. 사용자 관측 차이는 빈 선택의 `removeAllRanges` 호출뿐 | 확장 | S12e·S12j·S12g · ⑫ 규칙 칸이 접힌 선택을 열거하지 않음 | PLAN_GAP(창 안) |
| X2 | 판정기 transcript c2 바깥 행 키 고정 검사(`:33-38`) 입력 없음 | 확장 | J2o · EP-31 ② 는 네 항만 열거 | PLAN_GAP |
| X3 | 판정기 transcript c1 본문 → 카드 교차 복사 항(`:54-56`) 입력 없음 | 확장 | J3x · EP-31 ③ 이 교차 기록을 열거하지 않음(하네스 계약 c1 에만 있음) | PLAN_GAP |
| X4 | 판정기 c4 의 B 새 키 항(`:61`) 입력 없음 | 확장 | J4k · EP-31 ④ 는 두 항만 열거 | PLAN_GAP |
| X5 | 판정기 중복 기록 거부(`:74 seen.has`) 입력 없음 | 확장 | J1d · EP-31 ① 은 모르는·빠진 기록만 열거 | PLAN_GAP |
| N1 | `smoke-hosts` SQLite ABI | 비귀속 | 환경 서명 · `src/main` 변경 0 | NON_BLOCKING |

### V2 Review Signals — 사실만

- 이전 라운드와 같은 증상: I1(plan 좌표 부재)이 h10·h11 로 남았다. 구현 보고 강제 지점 표가 존재하지 않는 좌표를 범위로 적었다(VP-48 "h10~h13").
- 막았어야 할 plan 지침: K1~K4 는 ΔV6 §10 규칙 칸·자리 문장에 항이 적혀 있었다. 구현자 sweep 은 항목 단위(공급 `null`·항 하나 제거 6개)였고 생산자 자리·규칙 칸 항 단위 변이는 없었다.
- 반복 환경 한계: Electron ABI ↔ Node ABI 동시 불가(SQLite 371 · smoke-hosts). root sandbox 는 해소.
- 독립 축(⑥) 발견: 3축 12시도 중 이행 3(K1 · K2 의 S12a·S12c·S12i 묶음 일부) · 확장 2(X1 · X2~X5 일부) — 나머지 K2·K3·K4 는 ⑦ sweep 에서 나왔다.

---

## verify 1회째 (원문 보존)

## 판정 (verify 1회째)

**RETURN_TO_PLAN** — 확장 후보 1건(H1 `check-visible-views.mjs` 실행 환경)이 확장 창 안이라 `PLAN_GAP`이다. 같은 판정 안에 이행 결함 3건(I1·I3·I4)이 `BLOCKING`이므로 설계자가 H1을 채택·경계 선언한 뒤 구현자가 I1·I3·I4를 고친다. I2 는 검증자 변이 위치 오류로 철회했다(아래 정정).

- 합계 재측정(정정 반영): ✅ 5 · ⚠️ 32 · ❌ 2 = 39(§5). 자기보고 `Criteria-Met: 24/39`와 다르다 — 자기보고 ✅ 24건 중 19건은 plan이 지정한 oracle 좌표가 트리에 없거나 등록 변이가 잡히지 않는다.
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
| 발견 분류 | 이행 3(I2 철회 전 4) · 현재 0 · 확장 1(막음 1 / 후보 표 0) · 경계 0 · 비귀속 1 |
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

## 정정 — I2 철회 (같은 verify 1회째 · 설계 턴 조사 중 발견)

**I2 는 결함이 아니다.** 고장 이력 V57-1 은 `openCodeBlocks.ts:531-532` 의 두 `isLiveSeg` 중 **둘째(6번째 인자 `live`)** 를 이전 식으로 바꿨다 — plan 등록 변이의 대상은 첫째(5번째 인자 `streaming`)다(`appendSegment(key, messageId, partKeys, gap, streaming, live, …)` `:405-415`). 계측 실행에서 행이 `live:true · streaming:false` 로 나와 위치 오류가 드러났다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| V57-1 (원 기록) | `openCodeBlocks.ts:532` | 맞바꿈(⑤ 성격) | `live` 인자 ← `active && index === segments.length - 1` | 잡음 | ob1 | — (등록 변이 아님) |
| V57-1r | `openCodeBlocks.ts:531` | 뒤집기 | `streaming` 인자 ← `active && index === segments.length - 1` | 잡음 | ob1 · `streamingSessions.test.ts` opencode bg4a · bg4b(3 failed / 39) | — |

- 판정 영향: VP-57 → **PASS**(등록 변이 2/2 · sweep Y3·Y4). VP-52 → **PASS**(P1·U1 18기록 · V2-1~V2-5 · EP-26 ⑨⑩ 좌표 bg4a·bg4b 존재). VP-05 → `BLOCKED_BY:VP-35`. AC39 ❌ → ⚠️(bg0~bg3 라벨 대응 — I1).
- verify 횟수·라운드·판정(RETURN_TO_PLAN)은 바뀌지 않는다. 원 고장 이력 행은 그 자리에 두었다.

## Review Signals — 사실만

- 같은 증상의 이전 라운드: 없음(verify 1회째).
- 막았어야 할 plan 지침: I1·I4 는 `handoff-impl` "닫았다로 적는 행에 이번 턴 관측" · "강제 지점 전수 표" 조항이 있었다. 구현 보고는 ✅ 24 를 적었지만 자리별 좌표 표가 없었다.
- 반복 환경 한계: Electron ABI 와 Node ABI 동시 불가(SQLite 371) · root 컨테이너 Electron sandbox.
- 독립 축(⑥) 발견: 3축 9시도 중 I3 하나(W3·W1e~W3e) — 분류 이행.

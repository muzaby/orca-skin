# Verify — 0311-bloat-reduction-pending-queue-claims

## 메타

| 항목 | 값 |
|---|---|
| slug | `0311-bloat-reduction-pending-queue-claims` |
| 검증자 | Claude Code (설계자 = 검증자 — plan validity는 자기 설계 감사) |
| 일자 | 2026-11-11 |
| 대상 커밋/range | `1582d12..89aa217` (구현 `efb750b`·`545ee4a`·`15733bc`·`e3db542` · 보고 `89aa217`) |
| 구현 전 plan 기준 | `1582d12` (`git cat-file -t` → commit). `c72103b`·`1582d12`는 PR 브랜치 좌표 — `origin/main` 조상 아님(rebase 병합 전) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 라운드 | 1 → 2 |
| 상태 | **RETURN_TO_PLAN** |
| 확장 창 | verify 1회째 — 창 안. ΔV로 다시 열린 노드 없음 |
| 독립 축(⑥) | 축 3개·17행 — 일치 항 맞바꿈 · 초기 상태 · 호출부 발신 인자(x1~x13 · x6 · x10 · x11). 못 잡음 4 |
| 열거 sweep(⑦) | 1회째 전수 — 등록 변이 (a)~(l) 전부(자리별 12 → 17행) + 형제 슬롯 맞바꿈(f1·f2·x1·x3). 못 잡음은 아래 4행뿐 |
| 발견 분류 | 이행 1 · 현재 0 · 확장 3(막음 3 / 후보 표 0) · plan 내부 불일치 1 · 경계 0 · 비귀속 0 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — `git diff 1582d12..HEAD -- plan.md`의 `-` 줄은 `상태 READY→IMPL_DONE`과 `[구현자 기입]` 템플릿 자리뿐. Decision·AC·V·§10·Part I/II 변경 0.
- 기준선이 diff로 성립하는가: 예(`1582d12` 설계 커밋이 구현과 분리).
- 채점에 사용할 원 기준: plan 원문 그대로.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| V mode·pair 구성 | 유효 | Baseline V1 · NEW/CHANGED 왼쪽 node마다 같은 레벨 REQUIRED pair(VP-01~04) · SD-01 REGRESSION |
| §10 자리 목록 | 유효 | 검색 5종 재실행 — EP-01·02·04 0줄, EP-03 정의 4·호출 7(`turn-request.ts:86,93,105,113,118` · `send.ts:635,761`), EP-05 `toPublic` 5·재발급 2·잔여 1(`:358,371,400,473,509` · `:463,468` · `:447`). 목록과 차집합 0 |
| 직접 oracle·적대 증거 | 유효 | VP-02·03·04 변이 (a)~(l) 등록 |
| **AC7 ↔ §14** | **PLAN_GAP** | R-07 AC7 "test는 늘지 않는다" ↔ §14 "순증이면 ⚠️ 보고(잠금을 줄여 맞추지 않는다)" — 구현자가 §14를 따르면 AC7이 반드시 미달이다. 기준 둘이 서로 모순 |

## 1. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 전부 아니면 무(부분 전이) | 유지 | `claimed`가 하나라도 불일치면 `undefined` → `move`가 `false`. 변이 d(부분 전이)가 24건 red |
| 상태 집합 | 유지 | 옛 `commitMany`·`reopenMany`는 `['submitting','submitted']`, 새 `move`는 `awaitsReceipt`(`submitting\|submitted`) — 같다 |
| 빈 claim | 유지 | `move([])` → `moved=[]` → `true`·알림 0(옛 `changed=false`와 같다) |
| `chainId` 폴백 제거 | 무해 | 대입 2자리(`send.ts:487`·`post-turn.ts:272`)가 모두 대기열 반환값 |
| `toPublic` 복사+`delete` | 동치 | 키 집합 P1 6건 green |

## 4. 증거 재측정

**고장 이력** — `mutate.py --cwd app`, oracle = `features/chat` 전체 + `turn-request.reopen` + `retry-submission` + `send.worktree`(374케이스). 종료 뒤 `git status` 변이 잔여 0.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 / 근거 | 하한 | 분류 |
|---|---|---|---|---|---|---|---|
| a | queue `claimed` | 제거 | `sameIds` 항 | 잡음(3) | K4·Q7 | ① | — |
| b | `claimed` | 제거 | `chainId` 항 | 잡음(3) | K4·Q7 | ① | — |
| uuid | `claimed` | 제거 | `uuid` 항 | 잡음(1) | K4 | ⑦ | — |
| c | `move` | 다른 값 | 술어 `isOpen` | 잡음(3) | K3·Q5 | ① | — |
| d | `claimed` | 뒤집기 | 불일치 `continue`(부분 전이) | 잡음(24) | K3 외 | ① | — |
| e | `canCommitMany` | 다른 값 | 술어 `awaitsReceipt` | 잡음(3) | K5·W1 | ① | — |
| f1·f2 | `commitMany`↔`reopenMany` | 맞바꿈 | 목표 상태 | 잡음(17·8) | K1·Q1 | ①⑤ | — |
| k | `move` | 제거 | 변화 있을 때만 알림 | 잡음(3) | K2·Q2 | ① | — |
| x1 | `canReopenMany` | 다른 값 | 술어 `submitting`만 | 잡음(9) | Q 계열 | ⑤⑥ | — |
| x3 | `claimed` | 고정값 | 상태 항 `true` | 잡음(10) | retry D 외 | ⑥ | — |
| x7 | `toPublic` | 다른 값 | `chainId`도 삭제 | 잡음(10) | P1·K | ⑥ | — |
| x8·x9 | `takeForRespawn`·`track` | 다른 값 | 초기 상태 `submitted` | 잡음(1·33) | P3 외 | ⑥ | — |
| x13·h2 | `takeForRespawn` | 다른 값 | 대기 항목 `chainId`·`uuid` | 잡음(1·1) | ABA·P3 | ⑥ | — |
| g | `toPublic` | 제거 | 배치 그대로 반환 | 잡음(6) | P1 | ① | — |
| h1 | `takeForRespawn` | 제거 | 이월 `uuid` 재발급 | 잡음(2) | P3 | ① | — |
| j | `messageCountForAttempts` | 다른 값 | `uuid` 대조 `false` | 잡음(1) | projector:184 | ① | — |
| i | `turn-request.ts` | 호출 대체 | 게터 조립 시점 캡처 | 잡음(10) | W2 | ① | — |
| l0~l4 | `turn-request.ts` 5자리 | 다른 값 | 세션 키 `queueKey` 고정 — 자리마다 | 잡음(2·2·2·3·2) | W1·W4 | ① | — |
| x10 | `turn-request.ts` rollback | 제거 | `&& activeTurn.dbSessionId`→`&& true` | 잡음(1) | W4 | ⑥ | — |
| **x5** | `pending-message-queue.ts:447` | 제거 | `!isOpen(batch.state) \|\|` | **못 잡음** | 374 green | ⑥⑦ | **이행** |
| **x4** | `pending-message-queue.ts:567` | 제거 | `sameIds`의 `a.length === b.length` | **못 잡음** | 374 green | ⑥ | **확장** |
| **x6** | `turn-request.ts:94` | 제거 | `committed &&` | **못 잡음** | 374 green | ⑥ | **확장** |
| **x11** | `turn-request.ts:96` | 다른 값 | 소유권 발신 `batch.ids.slice(0,1)` | **못 잡음** | 374 green | ⑥ | **확장** |

- 검산: 시도 30행 = 잡음 26 · 못 잡음 4 · 동치 0 · 경계 0. ③·④ 해당 없음(r1).
- x5 근거: 같은 `uuid`의 `confirmed` 배치가 있는 잔여 입력이 어느 테스트에도 없다 — `session-activity-projector.test.ts:184`는 `submitted` 배치만 쓴다. **인용**: R-04/AC4 "잔여 수는 잔여 `uuid`와 일치하는 **열린 배치**의 메시지 수다". 변이 줄은 구현이 바꾼 hunk(`attemptId`→`uuid`)에 있다.
- x4: K4 `fewer message ids`는 claim이 짧은 쪽뿐이고 `a`=추적 배치라 짧은 claim은 길이 항 없이도 거부된다. 긴 claim(`['a','b','c']`)이 입력 칸에 없다. `sameIds`는 diff 밖의 기존 줄이고 K4 칸은 "ids 다름"이라 긴 쪽을 인용하려면 해석이 필요하다 → 확장.
- x6·x11: 두 줄 모두 diff 밖의 기존 줄이고 W 칸은 `submitted` 값만 운반 항으로 적는다(`ids`·commit 실패 갈래 없음) → 확장.
- 소거 변이 잔여물 진단 0 — 각 변이는 치환이라 미사용 식별자가 생기지 않는다.
- 형제 슬롯 맞바꿈: f1↔f2(목표 상태)·x1(상태 술어) 검출 3/3.

## 5. V-pair closeout

| Pair | 레벨 | 결과 | 직접 증거 | §10 전수 |
|---|---|---|---|---|
| VP-01 | AT | PASS | EP-01·02·04 → 0·0·0줄 · `typecheck` 3종 error 0 | 3/3 |
| VP-02 | UT | PASS | K1~K8: `pending-message-queue.test.ts` 'K1…'·'K2…'·'K3…'(4)·'K4…'(5)·'Q8…' + Q1~Q7 · 변이 a·b·c·d·e·f·k 전부 red. x4는 확장(아래) | 4/4 |
| VP-03 | UT | **PAIR_FAIL** | P1(6)·P3·P5 green이나 P5가 `confirmed` 배치 입력 없음 — x5 못 잡음 | 5+2+1 중 잔여 1자리 미닫힘 |
| VP-04 | IT | PASS | W1~W4·`send.worktree` 2건 · 변이 i·l0~l4 red | 7/7 |
| VP-05 | ST | PASS(환경 한계 1) | 전체 vitest 실패 식별자 차집합 ∅(아래). `chat-turn.continuity`는 변경 전에도 파일 로드 실패 — 1줄 치환(`commitMany`)은 이 환경에서 관측 불가 | 0 |

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | EP-01·02·04 0줄 |
| AC2 | ✅ | VP-02 |
| AC3 | ✅ | P1 6건 · 변이 g·x7 |
| AC4 | ❌ | R-04 "열린 배치" 분기 입력 없음(x5) |
| AC5 | ✅ | 인용 테스트 단언 변경 없이 green · 실패 집합 차 ∅ |
| AC6 | ✅ | `git diff --stat 1582d12..HEAD -- renderer preload shared post-turn.ts enqueue.ts` 0줄 |
| AC7 | ⚠️ | prod +84 −132(순감 48 ≥ 45) · **test +200 −74 순증 126**(`git diff --numstat 1582d12..HEAD -- app/src`) — D2 |
| AC8 | ✅ | 아래 gate |
| AC9 | ⚠️ | 사람 실기 대기(§8) |

- **합계 재측정**: `✅ 6 · ⚠️ 2 · ❌ 1 = 총 9`. 자기보고 `7/9`(✅7)와 불일치 — AC4가 ❌. 커밋 trailer `Criteria-Met: 7/9` · INDEX 비고 "✅7·⚠️2"는 구현자 사본이라 같은 값이다.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| 정적 | PASS | `npm run lint` error 0·warning 2(기존 `useVirtualizer`) · `typecheck` 3종 error 0 · lint 뒤 `git status` 변화 0 |
| 가드 4종 | PASS | migrations ok · doc-inventory prose·links ok · product-naming OK 2222파일 · test-budgets 18 suites ok |
| vitest(필터 없음) | 기준선 한계 | 940파일 중 29 fail·22케이스 fail · 변경 전(`1582d12` worktree)도 29·22 — 실패 식별자 42줄 양방향 `diff` 0줄. 서명: Electron 바이너리·DB 바인딩 부재. `[test-pools]` 0줄 |
| `node --test scripts/*.test.mjs` | PASS | 868/868 |
| message-bus | PASS | 구현 4커밋·보고 커밋 trailer가 `%(trailers:only=true)`로 키 그대로 파싱(Agent·Handoff·Status·Criteria·Verified-By) |

## 8. 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| AC9 | 대기·취소·재개방·되돌림·이월의 상태 로직 전부(K·P·W) | 개발 빌드에서 plan §19 (a)~(d). 이 환경은 Electron 바이너리가 없어 불가 |

## 11. Repository operation checks

- INDEX 행: `impl / IMPL_DONE / Claude / 라운드 1` → 이번 턴에 `verify / RETURN_TO_PLAN / Claude(설계) / 라운드 2`로 갱신. 「다음 주체」는 Claude 하나. 비고 5줄 이내.
- 대상 커밋 좌표: 구현자 자리표시자 `(V1 설계 · r1 구현 — 검증자 기입)`를 `1582d12`(설계)·`efb750b..e3db542`(구현)로 채움 — `git cat-file -t` 전부 commit. `origin/main` 조상 아님(PR 브랜치).
- trailer: 구현 커밋 `Agent: claude` — 비기능 구현의 정당한 값. 해시 5개 실재.
- `[구현자 기입]` 7필드: 설계 리뷰 · 강제 지점 전수(pair §10 자리 전부 + 남긴 곳) · 잠금(30행, sweep 포함) · Product/UX · 잠재 문제 · 구현 보고 · Review Signals 전부 존재.
- `AGENTS.md` 변경 0 · `docs/arch` 변경은 `runtime-ipc.md:72` 1줄.

## 12. 구현자 코멘트

| 코멘트 | 판단 |
|---|---|
| `toPublic`을 복사+`delete`로(§8 lint 선례가 틀림) | 타당 — 동치. 설계자가 §8 한 줄을 정정 대상으로 받는다 |
| `send.ts:761` 케이스·W1 단언 선조치 | 타당 — 구현 세부 보완, 변이로 확인 |
| AC7 test 순증 ⚠️ | 구현은 §14를 따랐다 — 모순은 plan 쪽(D2) |

## 13. Finding disposition / 파생 이슈

| # | finding | 분류 · 근거 | 귀속 | disposition | 후속 |
|---|---|---|---|---|---|
| D1 | `messageCountForAttempts`의 `isOpen` 항 제거를 잡는 테스트 없음(x5) | **이행** — AC4 원문 "열린 배치의 메시지 수" 인용 | VP-03 · P5 · R-04 | BLOCKING(`PAIR_FAIL`) | 구현: `confirmed`된 잔여 `uuid` 배치를 포함한 P5 입력(기대 0) 추가 |
| D2 | AC7 "test는 늘지 않는다" ↔ §14 "순증이면 ⚠️" 모순 | plan 내부 불일치 | R-07 · §14 | PLAN_GAP | 설계자: AC7 test 조건을 정정하거나 순증 상한·사유로 대체 |
| D3 | `sameIds` 길이 항 제거 못 잡음 — 긴 claim 입력 없음(x4) | 확장 | VP-02 · K4 | PLAN_GAP | 설계자: K4 입력에 긴 claim 채택 또는 경계 선언 |
| D4 | `commitInitialSubmission`의 `committed &&` 제거 못 잡음 — 제출 확정 실패 시 발신 억제 입력 없음(x6) | 확장 | VP-04 · W 칸 | PLAN_GAP | 설계자: W 칸에 commit 실패 갈래 채택 또는 경계 |
| D5 | 소유권 발신의 `ids` 내용 단언 없음(x11) | 확장 | VP-04 · W1 | PLAN_GAP | 설계자: 운반 항에 `ids` 채택 또는 경계 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일 증상: 없음(1회째). AC7 test 순증은 0307(AC17)·0309에 이어 세 번째로 ⚠️ — 잠금 선행 감량 handoff에서 test 비증가 조건이 맞은 적 없음(구현자 보고와 같다).
- 관련 plan 지침: R-04 "열린 배치"가 P5 규칙 칸에 옮겨지지 않았다(규칙 칸 `잔여 uuid 일치·중복·모르는 값`).
- 사용자 결정 변경: 없음. 반복 환경 한계: Electron 바이너리 부재(vitest 29파일).
- 독립 축(⑥) 발견: 17행 중 못 잡음 4(이행 1 · 확장 3).

## 15. 결론

- 상태: **RETURN_TO_PLAN** — verify 1회째, 창 안. D2·D3~D5가 `PLAN_GAP`이라 설계자가 먼저다. D1(`BLOCKING`)은 그 뒤 구현이 닫는다.
- pair 결과: PASS 3(VP-01·02·04) · REGRESSION PASS 1(환경 한계 명시) · root PAIR_FAIL 1(VP-03) · BLOCKED_BY 0.
- Product/UX·ACTIVE Decision: 위반 0 — 관측 동작(제출·재개방·이월)은 변이로 확인됐다.
- 남은 사람 확인: AC9 실기.
- 다음 단계: 설계자가 D2 정정과 D3~D5 채택/경계를 ΔV1로 적고(규범 행만, 별도 설계 커밋), 구현 r2가 D1을 닫는다.

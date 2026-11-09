# Verify — 0301-session-resume-cwd-retry

## 메타

| 항목 | 값 |
|---|---|
| slug | `0301-session-resume-cwd-retry` |
| 검증자 | Claude Code |
| 일자 | 2026-11-09 |
| 대상 커밋/range | `01ca522..7854c06` (`d3f39e0` 진행분 + `7854c06` 완료) |
| 구현 전 plan 기준 | `01ca522` (설계 READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `01ca522:V1` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** (PLAN_GAP 1 + 이행 결함 1 동반) |
| 확장 창 | verify 1회째 — 창 안 · ΔV로 다시 열린 노드: 없음 |
| 독립 축(⑥) | 2축·시도 6 — (a) post-turn flush 가드(구현자 보고 밖 자리) 변이 3 (b) 기준선 전체 vitest 분리 |
| 열거 sweep(⑦) | 1회째 전수 — §10 자리 A2·B8·C1·E1·F14+서명·G3·H2 기준 변이 49 · 못 잡음 4(B3b·PT2·PT3 좁은 oracle, Fw7 형태변이) |
| 발견 분류 | 이행 1 · 현재 0 · 확장 1(막음 1 = PLAN_GAP) · 경계 0 · 비귀속 1 |
| 구현 주체·문맥 | 구현=Claude, 설계=Claude, 검증=Claude — plan validity는 자기 설계 감사다. 판정에는 쓰지 않음 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — `git diff 01ca522..HEAD -- plan.md`의 hunk는 `@@ -514` 하나, `[구현자 기입]` 이하뿐. Decision·AC·V·§10 규범 행 변경 0.
- 기준선이 diff로 성립하는가: 예(`01ca522`). 채점 기준 = 그 커밋의 D-001~D-016·AC1~AC17·VP-01~15·§10 A~H.
- 창 밖 ΔV 새 열거 항목: 해당 없음.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 상속 없음, V1 |
| NEW 노드 ↔ REQUIRED pair | 유효 | R4·SD1·AR4·MD6 ↔ VP-01~15 |
| 자리 목록(검색 재실행 차집합) | **목록 미고정 1** | §10 A·B·C·E·F·G·H 검색을 다시 돌려 구현 출력과 차집합 0 확인(B: queue 326·335, turn-request 123·125, coordinator 614·616·637, continuation 66). 그러나 VP-02 path가 지나는 `post-turn.ts` 자동 flush 가드는 B 목록 밖 운반 자리다(구현 보고 #1) → PLAN_GAP(D2) |
| 적대 증거 선택 | 유효 | VP-04·06·08만 선택, 나머지는 직접 oracle |
| 운영 gate 열거 | 유효 | 가드 3종·lint·typecheck·vitest·node --test |

## 1. Product & UX / Decision 대조

| Decision | 실제 path | 판정 |
|---|---|---|
| D-002·003·004 | `readClaudeNativeHistory` → `claudeTranscriptCwd`(`transcript-cwd.ts:11`) → realpath catch → unavailable | 일치 |
| D-005~D-008 | coordinator `:614` gate → `turn.retrying` → backoff → `:637` 재개방 → 재spawn | 일치 |
| D-009 | `session-runtime.ts:479` admission < `:482` started | 일치 |
| D-010·011·014·015 | `native-settings-file.ts` 없음·빈 `{}` · 깨짐 `{}`+경고 서명 1회 · 쓰기 읽기는 `parseJsonObject` 엄격 | 일치 (경고 detail에 내용 없음, data = file·reason) |
| D-012·013·016 | hook G2 전이 토스트 · 배너 행 제거 · `listFailed(cause)` | 일치 |

## 2. 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| false success | 없음 | 재개방 실패·gate 거짓 → `fail()`로 원래 오류 |
| 부분 실패 | 수용 | 재개방 뒤 재spawn 전 실패 → `submitting` → 기존 최종 rollback(§13) |
| 재시도 입력 중복 | 선언 경계 | §10 선언 경계 1항 |
| 구현자 선조치 #1 | **범위 밖 신규 동작** | `post-turn.ts` `returnedInput`이 held 복귀 입력의 자동 flush를 끊는다. 그 형태·분기가 §10에 없다 → D2 |
| worst-case 상한 | 변화 없음 | spawn ≤3, 토스트 상태당 1 |

## 3. 역방향 탐색 · 증거 재계수

- 신규 export 프로덕션 참조: `claudeTranscriptCwd`←`native-history.ts:235`, `canReopenMany`/`reopenMany`←`turn-request.ts`, `readClaude*`←catalog 2모듈. 테스트 전용 0.
- 구현 보고 합계: 강제 지점 32/32 = A2+B8+C1+E1+F15+G3+H2 ✅(검색 재열거 일치) · AC ✅16+⚠️1=17 ✅ 합계 일치.

## 4. 고장 이력 (`mutate.py`, 1회째 전수, 49행 + 폭 확인 3행)

잡음 45 · 못 잡음 4(아래). 원복 확인 "모든 파일 원문 그대로", `git status` 깨끗.

| ID | 자리 | 종류 | 결과 | 잡은 테스트(요약) | 분류 |
|---|---|---|---|---|---|
| V-A1a~e | `transcript-cwd.ts` relocated type·빈 문자열·findLast→find·first→last·relocated 분기 | 제거·뒤집기 | 잡음 | transcript-cwd/native-history 1~10 failed | — |
| V-A2a~c | `native-history.ts:235-241` catch·samePath·isAbsolute | 제거 | 잡음 | 1~4 failed | — |
| V-B1a·b, B2a~d | queue 두 메서드 상태 집합·원자성·전이·통지 | 제거·축소 | 잡음 | 1~5 failed | — |
| V-B3a·B4a·B4b | turn-request 키 맞바꿈·B4 claim 비움 | 맞바꿈·빈 값 | 잡음 | 2·2·3 failed | — |
| **V-B3b** | `turn-request.ts:124` `canReopenMany(…, batchClaims())` → `[]` | 빈 값 | **못 잡음** | VP-07 좌표 3파일 67 passed(0 failed). 넓은 범위에서는 +1 failed(다른 테스트가 잡음, VP-07 밖) | **이행 결함** |
| V-B5a~c, B6a~c, B7a~c | coordinator gate·재개방 실패·warn | 제거·뒤집기 | 잡음 | 1~6 failed | — |
| V-B8 | `continuation.ts:66` base 승계 | 제거 | 잡음 | 3 failed | — |
| V-C1a·b | admission 순서·rollback | 제거 | 잡음 | 1·1 failed | — |
| V-E1a~d | `parseJsonObject` null·빈·shape·trim | 제거 | 잡음 | 3~6 failed | — |
| V-Fw1~6 | 서명 1회·read 경고·회복 삭제·kind detail·manifest `{}` | 제거·맞바꿈 | 잡음 | 12~36 failed | — |
| V-Fw7 | warn `data`에 필드 추가(기대 green) | 형태 | 잡음(red 14) | 경고 data 정확 일치 단언이 있음 → 내용 비노출 잠금 | — |
| V-H1·H2, G2a~c | 원인 제거·전이 조건·event·title | 제거 | 잡음 | 1 failed 각 | — |
| V-PT1 | `post-turn.ts` `if (returnedInput) step='break'` 제거 | 제거 | 잡음 | worker crash(무한 flush) | — |
| **V-PT2** | `!activeTurn.controller.signal.aborted &&` 제거 | 제거 | **못 잡음** | 좌표 14 passed · 넓은 범위 110 = 변경 전 110(기준선 동일) | **확장 후보(D2)** |
| **V-PT3** | `batch.ids.some(…heldIds…)` → `true` | 호출 대체 | **좌표에서 못 잡음** | 좌표(retry-submission·concurrency-identity) 14 passed. 넓은 범위 +19 failed로만 잡힘 | **확장 후보(D2)** |

못 잡음 해석: V-B3b는 AC7 "재개방은 commit과 같은 세션 키·claim을 쓴다"와 VP-07 W1~W3("commit → canReopen 참")의 canReopen 쪽 claim 항을 단언하는 좌표가 없다(B4는 잡음 — 두 위임이 비대칭). V-PT2·PT3는 plan에 없는 자리라 이행이 아니라 확장이다.

## 5. V-pair closeout

| Pair | 판정 | 근거 |
|---|---|---|
| VP-01·06·10 | PASS | A 변이 8/8 잡음, 이행 22파일 gate 통과 |
| VP-02·05·12 | PASS | B5~B7 9/9 잡음, `retry-submission.test.ts` A~E |
| **VP-07** | **PAIR_FAIL** | B3 canReopen claim 항 좌표 없음(V-B3b). 나머지 B3a·B4a·B4b·B8 잡음 |
| VP-11 | PASS | B1·B2 6/6 |
| VP-13·14·08·03 | PASS | E 4/4, F 7/7 + 구현자 14자리 sweep 승계는 재실행 안 함(독립 변이 Fw1~7로 서명·사유·detail·manifest를 재측정) |
| VP-15 | PASS | C 2/2 |
| VP-04·09 | PASS | G 3/3 · H 2/2 |

AC 재계수: AC1~AC16 중 AC7만 영향(좌표 공백, 동작은 production에서 W3 입력으로 참 — 재현 실패 없음). 그 외 15 PASS. AC17 사람 실기 대기.

## 6. gate

| 명령(cwd=`app`) | 관측 |
|---|---|
| `check-migrations-appendonly` · `check-doc-inventory --check` · `check-test-budgets` | ok · ok(9 items·117 channels) · ok(20 suites) |
| `npm run typecheck` | exit 0 (tsc 2 프로젝트 출력 에러 0) |
| `eslint --no-fix` 변경·추가 src 파일 | 출력 0(error·warning 0) |
| 변경·추가 테스트 22파일 `vitest run` | 22 passed · 784 tests passed |
| 전체 `vitest run` | 69 files failed · 318 tests failed — 변경 전(`01ca522` worktree, 같은 명령) 69 · 318 **동일 수치**. 서명: better-sqlite3 네이티브 미빌드(`npm ci --ignore-scripts`)·Electron 미설치·Windows 전용 `restart-required`. Claude 인접 4파일(native-resources·adapter.native-plugins·project-reconciliation·claude-assembly)은 base 목록에도 있음. 파일 목록 전수 diff는 head 목록을 저장하지 못해 못 했음(수치·인접 파일만 대조) |
| `node --test scripts/*.test.mjs` | **못 돌림** — 이번 턴 실행 안 함, 미확인 |

환경 한계: ABI·Electron 때문에 DB 의존 스위트는 이 환경에서 판정 불가(기준선과 동일 실패).

## 7. repository operation

- INDEX 행: 상태 `impl/IMPL_DONE`·다음 주체 Claude 하나 — 실제와 일치. 이번 턴에 `verify/RETURN_TO_PLAN`으로 갱신.
- 대상 커밋 좌표: `d3f39e0`·`7854c06` — `git cat-file -t` commit. `origin/main` 참조가 이 환경에 없어 조상 확인은 **못 했음**.
- trailer: `Agent: claude` · `Status: implemented` · `Criteria-Met: 16/17` · `Verified-By: pending` 허용값. 진행분 `d3f39e0`은 `partial` · `0/17`.
- `[구현자 기입]` 일곱 필드: 설계 리뷰·강제 지점·잠금·UX·놓친 문제·구현 보고·Review Signals 모두 있음.
- `AGENTS.md` 변경: 없음.

## 8. 사람 vs 에이전트

사람: AC17 Windows 실기(a~d), post-turn 가드가 만든 "held로 남은 입력"의 화면 표시 품질(제품 결정 — 아래 D2 질문).

## 9. 판정

**RETURN_TO_PLAN.** PLAN_GAP 1(D2)이 있어 설계자가 먼저다. 이행 결함 1(D1)은 설계 턴 뒤 재구현이 닫는다.

## [검증자 기입] 파생 이슈 요약 (plan.md 표로 이관)

| # | 이슈 | 분류 | disposition |
|---|---|---|---|
| D1 | VP-07 좌표가 B3 canReopen의 claim 항을 잠그지 않음(V-B3b green) | 이행 결함 — AC7·VP-07 W1~W3 | BLOCKING · 재구현이 canReopen이 거짓이 돼야 하는 claim 불일치 입력을 더한다 |
| D2 | `post-turn.ts` `returnedInput` 자동 flush 차단은 §10 B 목록 밖 운반 자리 · PT2·PT3 좌표 없음 | 확장 후보(목록 미고정) | PLAN_GAP — 설계자가 B9로 채택(변이 PT1~PT3 포함)하거나 경계 선언. 사용자 결정 필요 여부: 차단된 입력이 held에 남아 다음 전송 때 같이 나가는 동작이 제품 의도인지 |
| D3 | 탭 배너 i18n 키 2개 소비처 0 | 비귀속 | NON_BLOCKING(구현 보고 #4) |

## Review Signals — 사실만

- 이전 라운드 없음. 구현자가 PT-2를 스스로 `못 잡음`으로 보고했고 독립 변이가 PT-3·B3b를 더 찾았다(독립 축 발견 2: 이행 1·확장 1).
- plan 열거에 post-turn 자리가 없었다(구현 보고 #1과 일치).
- 환경 한계: `origin/main` ref 없음, Electron·better-sqlite3 미빌드로 전체 vitest 기준선 69파일, `node --test` 미실행.

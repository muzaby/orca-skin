# Verify — 0296-opencode-wait-phases

## 메타

| 항목 | 값 |
|---|---|
| slug | `0296-opencode-wait-phases` |
| 검증자 | Claude Code |
| 일자 | 2026-11-06 |
| 대상 커밋/range | `13db37e..aa46653` (r1 `c598077` · r1.2 `dbef1b7` · r1.3 `aa46653`) |
| 구현 전 plan 기준 | `13db37e` |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `13db37e:V1` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** (이행 결함 8 + 확장 후보 3 — 확장 후보가 창 안 PLAN_GAP) |
| 확장 창 | verify 1회째 — 창 안 · 다시 열린 노드 없음 |
| 독립 축(⑥) | 5건 — 키 표현 맞바꿈(a3key·a7key·t3key) · 자식 세션 retry(X3) · 상태 기계 가드 제거(X4·X7) · retry 값 폴백(X2) · 승격·정리 경로(promote·clear) |
| 열거 sweep(⑦) | 1회째 전수 — §10 자리 EP-01 12 · EP-02 6 · EP-03 5 · EP-04 6 · EP-05 7 · EP-06 4 · EP-07 2 변이 + 등록 변이 8. EP-08 문서 3자리는 `rg` 재실행. 못 잡음 16(동치 3 제외 13) |
| 발견 분류 | 이행 8건(고장 행 10) · 현재 0 · 확장 3(막음 3 / 후보 표 0) · 경계 0 · 비귀속 1 |
| 구현 주체·문맥 | 구현 `argon`, 설계·검증 Claude. 설계자 = 검증자라 plan validity는 자기 설계 감사다 — 독립성은 ⑥이 맡는다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: hunk 2개 — 메타 `작성자` 칸과 `[구현자 기입]` 이하. Decision·AC·V·§10 변경 0.
- 기준선: diff로 성립(`13db37e` 설계 ↔ `c598077` 이후 구현).
- 채점 기준: `13db37e:V1` 원문.
- 설계 대비 차이 2건(`send.ts` `adapter` 타입 넓힘 · `send.harness`/`adapter.test` 호환 방어): 방어 분기(`activity?.`·`reportsWaitPhases === true`일 때만 6번째 인자·observer 부재 시 3-인자)는 원본 메커니즘에 없던 분기라 별도로 변이했다(a2·a3key·a7key·s5·s6).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode | 유효 | 상속할 V 없음 |
| NEW 노드 ↔ REQUIRED pair, INHERITED ↔ REGRESSION | 유효 | VP-01~19·25 / VP-20~24 |
| §10 자리 목록 ↔ 검색 재실행 차집합 | 유효 | EP-01 12 · EP-02(`rg` 출력 줄이 t1~t7로 귀속) · EP-03 s1~s7+c1 · EP-04 a1~a7 · EP-07 e1~e3 — 차집합 0, `MODEL_OUTPUT_EVENTS` 0건 |
| 직접 oracle 좌표 | 부분 유효 | 좌표는 실재. 일부 자리의 *운반 값·분기*에 입력이 없다(§고장 이력) — 구현 결함으로 분류 |
| 운영 gate 열거 | 유효 | lint·typecheck·vitest·test-budgets·doc-inventory·trailer |

- root PLAN_GAP: 없음. 확장 후보 3건이 창 안 PLAN_GAP이다(§파생 이슈).

## 1~3. Product/UX · 비판적 읽기 · 역방향 탐색

- D-001~D-010이 코드와 일치한다: 문구 원문(`ko.ts:499-508`), 채널 경계 호출 순서(`channel.ts`), 서버 pool 관찰(`server.ts:233·248`), 우선순위(`activityLabel.ts:59-63`).
- false success: 단계 비움이 c9(출력)·c10(finish)·c11(catch)·c12(finally)·a7(chain finally)로 겹쳐 있다. 겹침 탓에 c10·c12가 단독으로는 어떤 테스트도 red로 만들지 않는다 — 아래 고장 이력.
- producer ↔ consumer: `shared/ipc.ts` 한 곳, 렌더러는 스냅샷 값만 읽는다. SSOT: 모델 출력 판정은 `shared/model-output.ts` 한 곳(`MODEL_OUTPUT_EVENTS` 사본 0).
- 상한: 단계 전이 ≤ 8 + 2×retry(§14), 새 요청 0 — 코드상 네트워크 호출 추가 없음.
- `scan-surface.sh`는 실행하지 않았다(정독으로 대체). 미배선 후보: `reportsWaitPhases`는 `send.ts` 두 곳, `observer`는 adapter→server로 소비 — 배선 확인.

## 4. 고장 이력 (62건, 하네스 `mutate.py`, 원복 확인 완료)

잡음 46 · 못 잡음 16. 못 잡음 16의 분류: 이행 10행(이슈 8건) · 확장 3 · 동치 3(t3key·t4disp·X7).

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 결과 | 근거 | 분류 |
|---|---|---|---|---|---|---|---|
| M-05a·06a·09a1·10a·13a·16a·16b·18a | 등록 변이 8 | 맞바꿈·제거 | 구현자 등록 그대로(c9·c12는 분리 실행) | 각 oracle | 잡음 | 각 1~5 failed | — |
| M-09a2 (c12) | `channel.ts:468` | 제거 | finally `waitPhase.end()` 단독 제거 | adapter.startup·wait-phase·opencode-runtime | **못 잡음** | 36 passed. 터미널 오류 `return` 경로(`:432`)는 c10·c11을 건너뛰고 c12만 지난다 | 이행 |
| c10 | `channel.ts:443` | 제거 | finish 분기 `end()` 제거 | 같음 | **못 잡음** | 출력 없이 중단된 턴(finish만 지남)의 비움 입력 없음 | 이행 |
| c11 | `channel.ts:453` | 제거 | catch `end()` 제거 | 같음 | **못 잡음** | I5·I6이 catch를 지나지만 c12가 가린다. c11 단독 제거는 `null`↔오류 이벤트 순서만 바꾼다 | 이행 |
| c7 | `channel.ts:271` | 제거 | `session.command` 뒤 `accepted()` 제거 | 같음 | **못 잡음** | 명령 경로를 지나는 `wait phases` 케이스 없음 → 명령 턴은 `send`에서 `생각 중`까지 `요청을 보내는 중…`이 머문다 | 이행 |
| X3 (c8) | `channel.ts:426` | 맞바꿈 | root 판정(`sessionID === sessionId`) 제거 | 같음 | **못 잡음** | 자식 세션 retry 입력 없음 — §10 c8 "루프 root", 선언 경계 "child retry는 표시하지 않는다" | 이행 |
| a2 | `adapter.ts:33` | 제거 | `reportsWaitPhases = true` 제거 | APP + startup | **못 잡음** | IT-03은 가짜 `{reportsWaitPhases:true}`를 주입한다. 실제 `OpenCodeAdapter`가 플래그를 갖는지 관측하는 좌표 없음. 제거하면 `preparing`·`history` 단계가 프로덕션에서 사라진다 | 이행 |
| a3key | `send.ts:256` | 맞바꿈 | `reportWaitPhase` 키를 `provisionalKey`만으로 | APP | **못 잡음** | A1·A4는 새 세션만 — 재개 세션 키 분기 입력 없음(a7key와 한 묶음) | 이행 |
| a7key | `send.ts:740` | 맞바꿈 | 키를 `provisionalKey`만으로 | APP | **못 잡음** | A2·A3은 새 세션(`provisionalKey`)만. §10 a7 키 식의 `dbSessionId`·`payload.sessionId` 분기 입력 없음 | 이행 |
| r7deps | `PendingAssistantStatus.tsx:29` | 제거 | memo deps에서 `activityWaitPhase` 제거 | REN | **못 잡음** | §10 r7 "(+memo deps)". IT-04가 렌더 후 `waitPhase`만 바꿔 재렌더하는 케이스 없음 — 빠지면 첫 단계 문구에 고정된다 | 이행 |
| X4 | `wait-phase.ts:accepted` | 제거 | `current.kind !== 'send'` 가드 제거 | CH | **못 잡음** | §10 규칙 칸 "accepted→현재가 send일 때만". `send`가 아닌 현재에서 `accepted()`를 부르는 UT-01 입력 없음 | 이행 |
| t3key | `turn-request.ts:133` | 맞바꿈 | `dbSessionId ?? queueKey` → `queueKey` | CH | 못 잡음 | **동치**: `promote`가 `queueKey`를 별칭으로 등록(`canonicalKey`)해 같은 키로 수렴 | 동치 |
| t4disp | `projector.ts:95` | 제거 | `setWaitPhase`의 cleared/disposed 조기 반환 제거 | PJ | 못 잡음 | **동치**: `recompute`가 같은 조건을 이미 막아 emit 불변(`:187-188`). Map 잔여는 id 재사용 없음 | 동치 |
| X7 | `wait-phase.ts:end` | 제거 | `end()`의 `outputObserved` 초기화 제거 | CH | 못 잡음 | **동치**: 이후 단계는 항상 `sending()`(초기화)을 거친다 | 동치 |
| promote | `projector.ts:140` | 제거 | `promote`에서 기존 단계 이전 제거 | PJ | **못 잡음** | P6은 승격 *뒤* 설정만 본다. 승격 전 기록(`preparing`)이 새 키로 따라가는지 입력 없음 | 확장 |
| clear | `projector.ts:154` | 제거 | `clear`에서 Map 삭제 제거 | PJ | **못 잡음** | `cleared`가 emit을 막아 관측 동일 — Map 잔여만 | 확장 |
| X2 | `wait-phase.ts:status` | 다른 값 | 잘못된 attempt 폴백 `1`→`0` | CH | **못 잡음** | 비정상 attempt 입력 없음 — 규칙 칸은 `retry(attempt)`만 말함 | 확장 |

나머지 잡음 38건: c8(root 호출 제거)·c1·c2·c3·c4·c5·c6·t2·t3rm·t4canon·t5·t6attempt·s1·s2·s3·s5·s6·a3·a4·a5·a6·a7·r3·r4·r5·r6·r9idle·r9facts·r10·w2prep·w2retry·w3mcpsend·w3en·e2·e3·X1·X5·X6 (각 1~6 failed). 소거 변이 잔여물: 제거 변이는 모두 구문 유지, unused 잔여 진단은 보지 않았다.

## 5. V-pair closeout

| Pair | 판정 | 근거 |
|---|---|---|
| VP-01 (R-01↔AT-01) | PAIR_FAIL | c7·c10·c12 미잠금(위) |
| VP-02 | PASS | c4·c5·c6 red, I3 |
| VP-03 | PAIR_FAIL | c8 root 판정 미잠금(X3) |
| VP-04 | PASS | a4·a5·a6 red |
| VP-05 | PAIR_FAIL | r7 memo deps 미잠금 |
| VP-06 | PAIR_FAIL | a2(실제 어댑터 플래그) 미잠금. M-06a는 red |
| VP-07 | PASS | w2·w3 red, 9종 ko |
| VP-08 | PAIR_FAIL | c10·c11·c12 (VP-09 공유) |
| VP-09 | PAIR_FAIL | c12 단독, a7key |
| VP-10 | PAIR_FAIL | c7 |
| VP-11 | PASS | s1~s3 red |
| VP-12 | PAIR_FAIL | a7 키 분기(a7key) |
| VP-13 | PAIR_FAIL | r7deps (M-13a는 red) |
| VP-14 | PAIR_FAIL | 규칙 칸 `accepted` 분기(X4) |
| VP-15·16·17·18·19 | PASS | M-05a·16a·16b·18a red, S1~S5, 문서 `rg` |
| VP-20~24 REGRESSION | PASS | 기존 케이스 green(§gate) |
| VP-25 | SELF_BLOCKED | 사람 실기 — Windows 실제 OpenCode |

## 6. gate (실행·관측)

| gate | 결과 |
|---|---|
| `npm ci --ignore-scripts` + `ensure-sqlite-abi.mjs node` + electron `install.js` | 환경 복구 후 실행(작업 트리 변경 0) |
| `npm run typecheck` (node·web·test) | exit 0, 진단 0 |
| `npm run lint` | 0 errors · 2 warnings(기존 `useVirtualizer`) · 트리 변경 0 |
| §19 대상 vitest 12파일 | 12 passed · 227 passed(211 + `native-session` 16) · 0 failed |
| 인접 전체(`adapters`·`app`·`features/chat`·`renderer/features/chat`·`shared`) | 642 파일 중 9 failed · 22 failed 케이스 — **설계 커밋 `13db37e` 워크트리에서 같은 9파일 22건 동일 재현**(Windows 경로 `C:/…`·Claude 플러그인). 변경 무관 |
| `check-test-budgets.mjs` | exit 0 · `16 real-git suites ok` |
| `check-doc-inventory.mjs --check` | prose ok · links ok |
| `rg` EP-08 | `IPC_CONTRACT.md` `waitPhase` 포함 · `ux-domains.md` `모델 응답을 기다리는` 포함 |

## 9. repository operation

- 대상 커밋 좌표: V1 설계 `13db37e` · r1 `c598077` · r1.2 `dbef1b7` · r1.3 `aa46653` — 모두 `git cat-file -t` = commit, `main`에 포함(`merge-base --is-ancestor`).
- trailer: 파싱 정상(`Agent`·`Handoff`·`Status`·`Criteria-*`·`Verified-By`). 단 `Agent: argon`(dbef1b7·aa46653)은 root `AGENTS.md` 허용값(`codex|claude`) 밖이다 — 비귀속 NON_BLOCKING, 허용값 표의 갱신 여부는 사람이 정한다.
- `[구현자 기입]` 일곱 필드: 설계 리뷰·강제 지점 전수·잠금·Product/UX 파생·놓친 잠재 문제·구현 보고·Review Signals 모두 있음. 강제 지점 표는 52자리를 담았으나 `닫은 지점 7/7` 보고는 이번 검증으로 일부 정정된다(위 미잠금 자리).

## 파생 이슈 (→ plan `[검증자 기입]`)

| # | 분류 | 내용 | disposition |
|---|---|---|---|
| 1 | 이행 | c12 단독 제거 미검출 — 터미널 오류 `return` 경로 입력 + 단계 비움 관측 | BLOCKING (`PAIR_FAIL` VP-08·09) |
| 2 | 이행 | c10 미검출 — 출력 없이 finish(중단)한 뒤 비움 | BLOCKING (VP-01·08) |
| 3 | 이행 | c11 미검출 — catch `end()`가 오류 이벤트 publish 앞서 비우는지(순서) 또는 c12와 중복이면 한쪽 근거 | BLOCKING (VP-08) |
| 4 | 이행 | c7 미검출 — `session.command` 경로 `accepted()` | BLOCKING (VP-01·10) |
| 5 | 이행 | c8 root 판정 미검출 — 자식 세션 retry 입력 | BLOCKING (VP-03) |
| 6 | 이행 | a2 미검출 — 실제 `OpenCodeAdapter.reportsWaitPhases` 관측 좌표 | BLOCKING (VP-06) |
| 7 | 이행 | a7/a3 키 분기(`dbSessionId`·`payload.sessionId`) 입력 없음 — 재개 세션 | BLOCKING (VP-12·09) |
| 8 | 이행 | r7 memo deps — 재렌더로 단계가 바뀌는 케이스 | BLOCKING (VP-05·13) |
| 9 | 이행 | MD-01 `accepted` 비-send 분기 UT-01 입력 | BLOCKING (VP-14) |
| 10 | 확장 | `promote`가 승격 전 단계를 새 키로 옮기는지 | `PLAN_GAP` — 설계자 채택 또는 경계 선언 |
| 11 | 확장 | `clear` 후 Map 잔여(관측 동일) | `PLAN_GAP` |
| 12 | 확장 | 비정상 `retry.attempt` 폴백 | `PLAN_GAP` |

> 이슈 9는 위 표 X4와 같은 항목이다. 이행 결함은 이슈 8건이다: c12·c11(#1·#3 한 묶음) · c10 · c7 · c8 root · a2 · a3/a7 키 · r7 · X4. #9는 위 X4와 같다.

## 판정

**RETURN_TO_PLAN** — 확장 후보 3건(#10~12)이 창 안 `PLAN_GAP`이고, 이행 결함 8건(#1~9)이 함께 있다. 설계자가 #10~12를 채택하거나 경계로 선언한 뒤 같은 `plan/READY` 커밋으로 돌리면 구현자가 #1~9와 채택분을 한 번에 고친다. 제품 동작 결함은 재현하지 못했다 — 코드는 맞고 잠금만 비었다.

사람 몫: `Agent: argon` 허용값 여부 · AC15 Windows 실기.

## Review Signals — 사실만

- 반복 증상: 겹치는 정리 경로(c10·c11·c12·a7)가 서로 가려 단독 제거가 안 잡힘 — 0265·0292의 "운반 값·분기 입력" 유형과 같은 모양.
- 사용자 결정 변경 근거: 없음.
- 환경 한계: 이 세션은 `node_modules` 부재로 `npm ci --ignore-scripts` 후 `ensure-sqlite-abi`·electron 설치를 직접 했고, 인접 전체 스위트의 9파일 22케이스는 Linux에서 변경 전부터 실패한다.
- 독립 축(⑥) 발견: 5축에서 이행 3(a7key·c8 root·X4) · 확장 2(promote·X2) + 동치 3 — 구현자 등록 목록 밖.

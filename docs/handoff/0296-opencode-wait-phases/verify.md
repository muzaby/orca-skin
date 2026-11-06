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

---

## r2 검증 (2026-11-06)

### 메타

| 항목 | 값 |
|---|---|
| 대상 | `1c888d0..d94ba6a4` (r2 구현 `d94ba6a4`, `Agent: codex`) |
| 유효 V | `V1 + ΔV1` (기준 `1c888d0`) |
| 라운드 / 확장 창 | 2 / verify 2회째 — 창 안 |
| 판정 | **RETURN_TO_PLAN** (PLAN_GAP 1 · 이행 결함 0 · 현재 결함 0) |
| 기준선 | `plan.md` diff는 `[구현자 기입] (r2)` 절 추가뿐 — Decision·AC·V·§10 변경 0 |

### 결과

- 구현 보고 대조: production 변경은 `channel.ts` catch `end()` 1줄 삭제(D-012)뿐. 테스트 5파일이 I7~I10 · IT-02 플래그 · A4 키 · A6 · R6c/d · R7g/h · P9~P11을 더했다.
- 재현: 12파일 vitest **239 passed / 0 failed** · `hooks-deps` exit 0 · typecheck 3종 진단 0 · `check-test-budgets` ok · `check-doc-inventory` prose·links ok. trailer 파싱 정상(`Agent: codex` 허용값).
- 좌표: `13db37e`·`aa46653`·`16fb6dd`·`1c888d0`·`d94ba6a4` 모두 commit, `13db37e`·`aa46653`은 `main` 조상.
- 고장 이력 29건(`mutate.py`, 원복 확인): **ΔV1 N1~N13 14종 전부 red**(① 하한 · ③ r1 `못 잡음` 행 11개가 모두 잡힘). 독립 축(⑥) 15종 중 red 11 · green 4.

| ID | 자리 | 종류 | 결과 | 분류 |
|---|---|---|---|---|
| X1d | `send.ts:740` | `?? payload.sessionId` 제거 | **green** | **PLAN_GAP** — 아래 |
| X1b | `send.ts:256` | `leaderTurn?.dbSessionId ??` 제거 | green | 동치 — `reportWaitPhase`는 `:260·:273`뿐이고 둘 다 `leaderTurn`(`:419` 대입) 전이라 항상 null |
| X6 | `projector.ts promote` | 원천 `waitPhases.delete(source)` 제거 | green | 동치 — 별칭으로 원천 키가 target으로 수렴 |
| X7 | `projector.ts promote` | set/delete 순서 맞바꿈 | green | 동치 — `source ≠ target`이 보장됨 |
| X11 | `projector.ts setWaitPhase` | cleared/disposed 조기 반환 제거 | green | 동치(r1 t4disp와 같음) — `recompute`가 막음 |
| X1a·X1c·X2·X3·X4·X5·X8~X10·X12 | 키 맞바꿈·busy/retry·sending 초기화·observe·c4 등 | red | — |

### PLAN_GAP — a7 `payload.sessionId` 분기에 닿는 oracle이 없다

- ΔV1 EP-04 a7 oracle은 "재개 → **A4** `'session-1'`"이라 적는다. 그러나 A4는 `leaderTurn.dbSessionId`가 이미 `'session-1'`인 경로다. X1d(재개 키 식에서 `payload.sessionId` 제거)가 green인 것이 증거다.
- `payload.sessionId` 분기는 `leaderTurn`이 대입(`send.ts:419`)되기 전에 `resolveTurn`이 실패·중단하는 **재개 턴**에서만 쓰인다. 거기서 키가 `provisionalKey`로 빠지면 `session-1`의 `preparing`/`history`가 지워지지 않는다(false success 아님 — 화면 단계 잔류).
- 분류: plan 내부 불일치(oracle이 지목한 좌표가 분기에 도달하지 못함) → 창 안 `PLAN_GAP`. 구현자가 어긴 원문은 없고 현재 코드는 맞다(`payload.sessionId` 폴백이 있다).
- 설계자 몫: a7 oracle에 "재개 + `resolveTurn` 실패(`ok:false`) → 마지막 `setWaitPhase` 호출 `['session-1', null]`" 입력(예: IT-03 A7)과 등록 변이 N14(`:740`에서 `payload.sessionId` 제거)를 더한다.

### V-pair

VP-01~VP-24 PASS(VP-12는 a7 분기만 위 gap으로 보류), VP-25 `SELF_BLOCKED`(사람 실기).

### 파생 이슈

| # | 분류 | 내용 | disposition |
|---|---|---|---|
| 1 | 확장→plan 내부 불일치 | a7 `payload.sessionId` 분기 입력 부재(X1d) | `PLAN_GAP` — 설계자 |
| 2 | 비귀속 | 인접 전체 스위트의 Linux 변경 전 실패 9파일(r1 기록과 동일) | NON_BLOCKING |

### Review Signals — 사실만

- 반복 증상: r1의 "분기 입력 부재"와 같은 모양(a7 키 분기). 직전 plan이 지목한 A4가 분기에 닿지 않았다.
- 독립 축(⑥): 15종에서 gap 1 · 동치 4. 사용자 결정 변경 근거 없음.
- 환경 한계: `npm run lint`(`--fix`)가 이 세션에서 120초를 넘겨 백그라운드로 돌렸고, 완료 시 작업 트리 변화 여부를 아래에 적는다. 사람 몫: AC15 Windows 실기.

---

## r3 검증 (2026-11-06)

### 메타

| 항목 | 값 |
|---|---|
| 대상 | `8652135f..9a6aee64` (r3 구현 `9a6aee64`, `Agent: codex`) |
| 유효 V | `V1 + ΔV1 + ΔV2` (기준 `8652135f`) |
| 라운드 / 확장 창 | 3 / verify 3회째 — 창 밖, 다시 열린 노드 없음(ΔV2는 검증 수단만 CHANGED) |
| 판정 | **PASS** (기계 범위) — 막는 발견 0 · PLAN_GAP 0 · 다음 주체 사람(AC15 실기) |
| 기준선 | `plan.md` diff는 메타 `상태` 1칸 + `[구현자 기입] (r3)` 절 추가뿐 — Decision·AC·V·§10 변경 0 |
| 이력 | 공유 브랜치가 `main` 위로 재배치되어 r1 이후 해시가 바뀌었다(아래 좌표). 검증은 원격 `9a6aee64` 트리에서 했다 |

### 결과

- production diff는 `send.ts` 2줄(`:256` `provisionalKey` · `:740` `leaderTurn?.dbSessionId ?? provisionalKey`)이다. `git grep -n -E "setWaitPhase\?\.\(" -- send.ts` = 정확히 2줄(`:256·:740`). D-014 동치 사본·도달 불가 항이 사라졌다.
- 그 밖 변경은 테스트 4파일(`send.wait-phase`: 실제 `leaseKeyFor`(`importOriginal`)·`clientKey`·재개 `queueKey`·A4 `logicalKey` 0회·A7 / `adapter.startup`: I11 / `statusLine.waitPhase`: 스냅샷 전 기본 렌더)과 `IPC_CONTRACT.md` 우선순위 문장 1건이다. 문장은 `activityLabel.ts:59-63`(preparing·history가 `worktreePrepareStep` 뒤, 채널 단계가 앞)과 일치한다.
- 재현: 12파일 vitest **242 passed / 0 failed** · typecheck 3종(node·web·test) 진단 0 · eslint 4개 변경 파일 0건 · chat-turn·opencode·chat 디렉터리 `--max-warnings 0`은 변경 전 파일 2개(`Timeline.tsx:57`·`useTranscriptVirtualizer.ts:22` `incompatible-library`)의 경고 2건뿐(이번 diff 밖 → 비귀속) · `check-test-budgets` ok · `check-doc-inventory --check` prose·links ok. 작업 트리 변화 0(`--fix` 미사용, 원복 확인).
- trailer 파싱 정상: `Agent: codex` · `Handoff` · `Status: implemented` · `Criteria-Met: 14/15` · `Criteria-Pending` · `Verified-By: pending` 6키.
- 좌표: `13db37e`·`c598077`·`dbef1b7`·`aa46653`은 commit이며 `main` 조상. `4cdef9d3`(ΔV1 설계)·`1ca5460c`(r2)·`d70419d9`(r2 verify)·`8652135f`(ΔV2 설계)·`9a6aee64`(r3)는 commit이고 PR 브랜치 좌표(`main` 조상 아님). r1 verify는 `66bfdd5e`.
- `[구현자 기입] (r3)` 일곱 필드 모두 있음. 강제 지점 표 검산 `11+10+7+7+10+3+3+3 = 54` = 분모, 행 합계 일치.

### 고장 이력 (r3 — `mutate.py`, 원복 확인 완료)

| ID | `파일:줄` | 종류 | 바꾼 내용 | 결과 | 잡은 테스트 | 분류 |
|---|---|---|---|---|---|---|
| N7 | `send.ts:740` | 다른 값 | 키 → `provisionalKey` | 잡음 | A6 (1 failed) | — |
| N14 | `send.ts:256` | 맞바꿈 | `provisionalKey` → `logicalKey` | 잡음 | A1·A4·A7 (5 failed) | — |
| N15 | `send.ts:740` | 맞바꿈 | `dbSessionId` → `queueKey` | 잡음 | A6 (1 failed) | — |
| N16 | `send.ts:740` | 맞바꿈 | `?? provisionalKey` → `?? logicalKey` | 잡음 | A2·A3·A7 (3 failed) | — |
| H1 | `send.wait-phase.test.ts` | 조립 되돌림 | 상수 `leaseKeyFor` mock 복귀 | 잡음 | A4·A7 (2 failed) | — |
| N1~N5·N8~N13 (ΔV1 · ③④) | `channel.ts`·`adapter.ts`·`wait-phase.ts`·`projector.ts`·`PendingAssistantStatus.tsx` | 제거·다른 값 | 등록 그대로(N3은 `:271`·`:295` 두 곳 모두) | 잡음 | 각 1~5 failed · N8 `hooks-deps` | — |
| X-a7-remove·X-a7-const·X-a3-guard·X-preparing | `send.ts` | 제거·고정값 | a7 호출 삭제 · a7 `?? 'new:1'` · `reportsWaitPhases` 가드 제거 · `preparing` 제거 | 잡음 | A1~A7 (1~5 failed) | — |
| X-observe-noemit·noflag·I11-noemit | `wait-phase.ts:56-57` | 제거 | 첫 출력의 `emit(null)` / `outputObserved=true` 제거 | 잡음 | I11 포함 (4·1·1 failed) | — |
| X-ui-prio · IT04-reducer-default | `activityLabel.ts:61` · `chatReducer.ts:519` | 고정값 | 우선순위 술어 `true` · 초기 `activityWaitPhase`를 `{server}`로 | 잡음 | L-우선순위 2 failed · 기본 상태 렌더 1 failed | — |
| **X-a3-payload** | `send.ts:256` | 고정값 | `provisionalKey` → `payload.sessionId ?? 'new:1'` | **못 잡음** | 6 passed | 확장 후보 |

- 시행 중 못 잡음 1(`X-a3-payload`). 하한 ①(N7·N14~N16·H1) · ②(r3 파생 이슈 12가 인용한 N14~N16·H1) · ③(r2 `못 잡음` X1d는 D-014로 삭제된 항 — 자리 N7·N14~N16이 대신 red) · ④(N1~N13 전부 재실행) · ⑤(N14~N16 형제 맞바꿈) · ⑥(독립 축 6종) · ⑦(r3 diff가 닿은 항목: a3·a7·I11·IT-04 기본 상태) 모두 실행.
- 임시 가설 `IT04-default`(`activityLabel` 폴백)는 activity가 undefined라 닿지 않는 위치를 잘못 골랐다 — 판정에서 뺐다. 올바른 위치(`chatReducer.ts:519`)는 red.

### V-pair

VP-01~VP-24 **PASS** (UT→IT→ST→AT 순, 직접 oracle 좌표는 구현자 r3 강제 지점 표와 대조해 실재·실행 확인). VP-04·08·09·12는 ΔV2 하네스(실제 `leaseKeyFor`)에서 재판정: a3 키 `provisionalKey`(새 `'new:1'`·재개 `'session-1'`), a7 키 `leaderTurn?.dbSessionId ?? provisionalKey`가 A1·A2·A3·A4·A6·A7로 구별 값 5종(`'new:1'`·`'client:new:1'`·`'session-1'`·`'session:session-1'`·`'s-new'`)에서 잠겼다. VP-25 `SELF_BLOCKED`(AC15 사람 실기).

### 파생 이슈

| # | 분류 | 내용 | disposition |
|---|---|---|---|
| 1 | 확장 후보 | a3가 `payload.sessionId ?? 'new:1'`로 바뀌어도 green — 하네스 새 세션 `clientKey`가 리터럴과 같은 `'new:1'`이라 `clientKey` 경로 값이 구별되지 않는다(`clientKey`가 다른 값일 때만 갈린다) | `NEXT_HANDOFF(확장)` — 창 밖이라 후보 표에 기록, 고칠 의무 없음 |
| 2 | 비귀속 | 인접 스위트의 Linux 변경 전 실패(r1·r2 기록과 동일)와 `Timeline.tsx`·`useTranscriptVirtualizer.ts` lint 경고 2건 | NON_BLOCKING |

### 판정

**PASS** — 모든 `REQUIRED`·`REGRESSION` pair(VP-01~24)와 적용 gate가 PASS이고 막는 발견이 0이다. 창 밖 확장 후보 1건은 판정에 쓰지 않는다. VP-25(AC15 Windows 실기 4항)는 사람 몫이라 handoff는 archive로 가지 않고 `verify/PASS`(기계 범위)로 사람 대기한다.

### Review Signals — 사실만

- r2의 PLAN_GAP(a7 oracle 부재)이 ΔV2의 oracle(A7)·하네스 정합으로 닫혔다. 같은 모양이 다시 나온 곳은 없다: 하네스 조립이 production(`leaseKeyFor`)과 갈리는 유형(0262 r4)은 H1로 방향 확인.
- 사용자 결정 변경 근거 없음. 구현 주체 `codex`(`Agent: codex`), 설계=검증 Claude라 plan validity는 자기 설계 감사이며 독립성은 ⑥이 맡았다.
- ⑥ 독립 축 발견 1건(확장 후보). 환경 한계: Linux에서 `npm run typecheck`·`eslint`를 한 명령에 묶으면 메모리로 종료(exit 137)되어 분리 실행했다. 사람 몫: AC15 Windows 실기.

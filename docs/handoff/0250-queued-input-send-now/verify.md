# Verify — 0250-queued-input-send-now

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0250-queued-input-send-now` |
| 검증자 | Claude Code |
| 일자 | 2026-10-06 |
| 대상 커밋/range | `4bfa8291..5b919551` |
| 구현 전 plan 기준 | `4bfa8291` (V1 설계, plan/READY) |
| V mode / 유효 V | `Baseline V: V1` / `V1` |
| 검증 기준 plan revision | `4bfa8291:V1` |
| 라운드 | 1 |
| 상태 | **PASS (기계 범위)** — VP-13(AC13) 사람 실기 3건 대기(비차단) |
| 자기 검증 여부 | 아니오 — 설계·검증 Claude, 구현 Codex(`Agent: codex`). 그래도 독립 축 X1~X7을 추가했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: 메타 `상태` 1행 + `[구현자 기입]` 절만(`git diff 4bfa8291..5b919551 -- plan.md` hunk 2개: `@@ -12`·`@@ -518`).
- 기준선이 diff로 성립하는가: 예 — 설계 `4bfa8291`과 구현 `5b919551`이 별도 커밋.
- Decision Ledger · Product/UX Contract · AC · V node/pair · §10 · oracle 변경: 없음.
- 채점 기준: `4bfa8291:plan.md` §3·§7·§7-A·§10.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V mode·상속 기준 | 유효 | 상속할 명시 V 없음(§7-A — 0067·0151·0154·0166은 V 이전) |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R 11·SD 2·AR 6·MD 4 전부 REQUIRED pair 보유(VP-01~26) |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | R-02·R-08·R-09·SD-03 → VP-02·08·09·16 |
| pair별 path·§10 전수·직접 oracle | 유효 | 26행 모두 path·EP 분모 또는 `0 + 이유` 보유 |
| 선택적 적대 증거·이유 | 유효 | M1~M11 + VP-11 음성 게이트 민감도 |
| `SUPERSEDED` 이관 | 해당 없음 | Baseline |
| 운영 gate·범위 | 유효 | lint·typecheck·관련 vitest·inventory·trailer(§7-A) |

- root PLAN_GAP: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·D-002 | 응답 중 입력은 도구 경계에서 주입되지 않고 종료 후 flush | `reserveOnBusySession` → held → (PostToolBatch 훅 0건) → `post-turn.ts:235` `reserveHeld('turn-open')` |
| D-003 | hover에 '즉시 보내기'·'취소' | `PendingSteerTurn.tsx:34` → `pendingSteerControls.ts:16` |
| D-004·D-005·D-006 | 응답만 interrupt, 대기 전부 한 턴, 체인·백그라운드 유지 | `index.ts:148` 핸들러 → `abortContinuation='send-now'`(`:166`) → `interruptResponse`(`:109`) → `post-turn.ts:102` `abortResumePolicy` → flush |
| D-007·D-008 | Stop·hover 취소 현행 | `index.ts:197` `cancelAllHeld` → `:216` `'reception'` → `interruptResponse` |
| D-009 | 끊을 응답 없으면 무동작 | `admission.ts:26` `decideSendNow` · `session-runtime.ts:365` `responding` |
| D-010 | 중단 표시 재사용 | `interruptResponse` = 기존 Stop 시퀀스 이동(정착→finalize→`turn.aborted`) |
| D-011 | 게이트 계약·`canSteer`·`steerFailed` 삭제 | 7식별자 `git grep` 0건 |
| D-012 | `orca:chat:steerSendNow {sessionId}` | `shared/ipc.ts:26` · `protocol.ts:216` · preload `:150` |

```text
PendingSteerTurn 클릭 → runPendingSteerControl → chatActions.sendSteerNow(낙관 표식)
  → chatApi → preload invoke → handle(SteerSendNowSchema,'reject') → decideSendNow
  → turn.abortContinuation='send-now' → interruptResponse → SessionRuntime.markAborted → live.interrupt
  → drain(tail 폐기) → post-turn: resume·stopTasks=false → flush → pushTurn → message.submitted/committed
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | 안전 | `live.interrupt` 실패는 기존대로 삼킴(`session-runtime.ts` markAborted `.catch`). 표식이 interrupt보다 먼저라 루프는 `send-now`로 재개 |
| false success | 없음 | renderer 표식 `sendNowRequested`는 버튼 숨김 전용, 전달 판정은 main 이벤트만(`chatStore.ts:96` 주석·reducer 무변경) |
| partial failure/rollback | 안전 | IPC reject 시 요청 시점 id만 원복(`chatStore.ts:1117`), X4 변이 red |
| A 대신 B 구현 | 없음 | 대기 전부 병합(D-005)은 ST-02 `pushed === ['first\n\nsecond']` |
| 증상만 제거 | 아님 | 게이트 경로 자체 삭제 + IT-02가 실제 SDK 입력 0건 관측 |
| 재검증/취소 관측 손실 | 없음 | await 뒤 새 Stop 재판정 2자리(`post-turn.ts:179-186,222-228`), X6 red |
| worst-case 상한 | 유지 | 클릭당 IPC 1·interrupt ≤1 — ST-02 `sendNow()` 2회에 interrupt 1 |

- renderer `turn.aborted`는 `pendingSteer`를 비우지 않는다(`chatReducer.ts:1194` TURN_END_RESET은 세션 엔트리 밖) — 즉시 보내기 후 대기 버블이 '전달됨'까지 유지된다.

## 3. 역방향 탐색

`scan-surface.sh`는 `rg` 부재로 실행 불가 → `git grep`으로 대체.

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export | 정상 | `decideSendNow`·`abortResumePolicy`·`pendingSteerControls`·`runPendingSteerControl`·`SteerSendNowSchema`·`responding` 모두 prod 소비 1곳 이상 |
| 테스트 전용 참조 | 없음 | fixture가 production `buildTurnRequest`·`reserveOnBusySession`·IPC 핸들러를 직접 호출 — 로컬 재구현 0 |
| 형제 정책 비대칭 | 의도 | Stop=`reception`(태스크 중지)·send-now(유지) — `abortResumePolicy` 한 곳, X2 red |
| 등록값의 기존 소비처 | 무영향 | 채널 +1 → inventory `--check` green, `AppErrorTitle` −1 → registry 테스트 green |
| producer↔consumer | 일치 | renderer `activityForeground==='streaming'` ↔ main `responding` — 불일치 창은 D2(NON_BLOCKING) |
| 동일 규칙 중복 | SSOT 유지 | 정책 문자열 비교는 `features/chat/post-turn.ts:12-14`뿐, post-turn 4자리는 함수 호출 |

## 4. 기존 테스트 / semantic 검증 확인

- plan 인용 기존 테스트 존재: `post-turn.schedules.test.ts` 전체 30케이스 green(0250 신규 9 포함).
- structural proxy만으로 통과한 AC: 없음 — AC11 음성 게이트는 AC1(ST-01·IT-02) 행동과 짝.
- **선택된 적대 증거 재측정**: 등록 15자리(M1a·b, M2~M3, M4a·b, M5~M6, M7a·b, M8a·b, M9~M11) + VP-11 민감도 1 = 16 중 검출 16 · 미검출 0.
- **자리 미지정 등록 변이**: M1(ⓐ adapter·ⓑ main 2자리)·M4(루프 상단·listen 종료부 2자리)·M7/M8(helper·component 2자리) 전부 자리별 red.
- **이전 라운드 대조**: 해당 없음 — r1.
- **독립 축**(구현 보고에 없던 자리): X1~X7 7건 전부 red.
- 실행: 임시 러너가 production 파일을 바꾸고 대상 vitest 실행 후 `git checkout`으로 복원, 종료 시 트리 clean. 무변이 기준선은 같은 명령에서 전부 green(예: schedules 30/30, controls 16/16, store 58/58, runtime 79/79).

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1a adapter에 PostToolBatch 훅 → `pushInput` | `adapter-input.test.ts` | red 1 | VP-01·19 |
| M1b runtime 도구 완료 시 delegate → `reserveHeld('steer')` | schedules ST-01 | red 1 | VP-01·14 |
| M2 send-now 핸들러에 `cancelAllHeld` | schedules 0250 | red 4 | VP-04·15 |
| M3 `abortContinuation='send-now'` 삭제 | 같음 | red 5 | VP-04·15 |
| M4a 루프 상단 `stopTasks` 조건 삭제 | 같음 | red 2 | VP-05·25 |
| M4b listen 종료부 항상 정착 | 같음 | red 1 | VP-05·25 |
| M5 send-now에 `cancelChain` | 같음 | red 5 | VP-04·15 |
| M6 `not-responding` 판정 삭제 | admission + schedules | red 3 | VP-06·23 |
| M7a helper 액션 매핑 맞바꿈 | controls | red 2 | VP-03·26 |
| M7b component 전달 kind 맞바꿈 | controls | red 1 | VP-03·26 |
| M8a helper `submitted` 가드 삭제 | controls | red 6 | VP-03·26 |
| M8b component `submitted` 분기 제거 | controls | red 6 | VP-03·26 |
| M9 `makeContinuationTurn` 표식 상속 | turn-context | red 2 | VP-18 |
| M10 `reserveHeld` 역순 정렬 | schedules ST-01 | red 1 | VP-02·14 |
| M11 `responding`이 listen 프레임도 true | session-runtime | red 2 | VP-20·24 |
| VP-11 `export const canSteer` 잔류 | `git grep` 7식별자 | 0 → 1 → 원복 0 | VP-11 |
| X1 핸들러 `responding: true`(fail-open) | schedules 0250 | red 2 | 독립 — VP-06 형제 자리 |
| X2 정책 SSOT `stopTasks: true` | post-turn UT + schedules | red 3 | 독립 — VP-25 SSOT 자리 |
| X3 helper `foreground !== 'idle'` | controls | red 1 | 독립 — VP-26 |
| X4 store reject 원복 삭제 | chatStore | red 3 | 독립 — VP-21 |
| X5 component 라벨 슬롯 맞바꿈 | controls | red 7 | 독립 — 형제 슬롯 맞바꿈 |
| X6 await 후 새 Stop 재판정 제거(2자리) | schedules 0250 | red 2 | 독립 — 구현자 기입 #4 |
| X7 Stop `'reception'` 표식 삭제 | schedules 전체 | red 8 | 독립 — VP-08·16 |

- 동작 보존 추출 라운드: 아니오(단 `interruptResponse` 추출은 Stop 회귀 VP-16 green + X7 red로 확인).
- 형제 슬롯 맞바꿈: send-now↔cancel 액션(M7a·b)·라벨(X5) 검출.
- `N회` 관측 주체: fixture `live.interrupt` vi.fn — production sink `markAborted` 유일 호출부 대체.
- 순서 관측: `eventsAtPush[0]`에 `turn.aborted` 포함(ST-02).

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | req | 결과 | 직접 증거 |
|---|---|---|---|---|
| VP-23 MD-01↔UT-01 | UT | REQUIRED | PASS | admission 표 + M6 red |
| VP-24 MD-02↔UT-02 | UT | REQUIRED | PASS | runtime UT-02 + M11 red |
| VP-25 MD-03↔UT-03 | UT | REQUIRED | PASS | post-turn 정책 3행 + M4a·b·X2 red |
| VP-26 MD-04↔UT-04 | UT | REQUIRED | PASS | controls 16케이스 + M7·M8·X3·X5 red |
| VP-17 AR-01↔IT-01 | IT | REQUIRED | PASS | IT-01 등록·`{}`/`''` reject·accept, preload test |
| VP-18 AR-02↔IT-04 | IT | REQUIRED | PASS | turn-context 비상속 2 + M9 red, 쓰기2(`index.ts:166,216`)·읽기4 |
| VP-19 AR-03↔IT-02 | IT | REQUIRED | PASS | `adapter-input.test.ts` 실제 SDK 입력 0 + M1a red |
| VP-20 AR-04↔UT-02 | IT | REQUIRED | PASS | `turn.live = runtime`(`turn-coordinator.ts:320`)로 핸들러가 실제 게터 소비, X1 red |
| VP-21 AR-05↔IT-03 | IT | REQUIRED | PASS | chatStore 58/58 + X4 red |
| VP-22 AR-06↔IT-04 | IT | REQUIRED | PASS | Stop·send-now 각각 finalize 1·aborted 1(ST-02/04) |
| VP-14 SD-01↔ST-01 | ST | REQUIRED | PASS | ST-01 + M1b·M10 red |
| VP-15 SD-02↔ST-02 | ST | REQUIRED | PASS | ST-02 + M2·M3·M5 red |
| VP-16 SD-03↔ST-03 | ST | REGRESSION | PASS | 기존 Stop 케이스 포함 schedules 30/30 + X7 red |
| VP-01 R-01↔AT-01 | AT | REQUIRED | PASS | VP-14·19 공유 |
| VP-02 R-02↔AT-02 | AT | REGRESSION | PASS | ST-01 병합·ids 순서·첫 출력 committed + M10 red |
| VP-03 R-03↔AT-03 | AT | REQUIRED | PASS | VP-26 공유 |
| VP-04 R-04↔AT-04 | AT | REQUIRED | PASS | VP-15 공유 |
| VP-05 R-05↔AT-05 | AT | REQUIRED | PASS | ST-02/04 lease 유지·중지 0, Stop 대조 1 |
| VP-06 R-06↔AT-06 | AT | REQUIRED | PASS | IT-01 무중단 3상황 + M6·X1 red |
| VP-07 R-07↔AT-07 | AT | REQUIRED | PASS | ST-04(listen 변형) interrupt 1·push 1·중지 0 |
| VP-08 R-08↔AT-08 | AT | REGRESSION | PASS | VP-16 공유 + renderer draft 복원 기존 테스트 green |
| VP-09 R-09↔AT-09 | AT | REGRESSION | PASS | chatStore send-now 뒤 `cancelSteer`·draft 반환 |
| VP-10 R-10↔AT-10 | AT | REQUIRED | PASS | VP-17 공유 + inventory `--check` |
| VP-11 R-11↔AT-11 | AT | REQUIRED | PASS | `git grep` 0, 민감도 0→1 |
| VP-12 R-12↔AT-12 | AT | REQUIRED | PASS | runtime-ipc `:72,74` · IPC_CONTRACT `:29,43` · ADR-007 · README `:35` · INDEX `:49` |
| VP-13 R-13↔AT-13 | AT | REQUIRED | **사람 실기 대기** | §8 |

- root `PAIR_FAIL`: 없음. `BLOCKED_BY`: 없음.
- 실행 범위: 최초 검증 — 유효 V REQUIRED/REGRESSION 26건 전건.

### AT / AC 합계

| AC | 결과 | 증거 |
|---|---|---|
| AC1 | ✅ | ST-01·IT-02, M1a·b red |
| AC2 | ✅ | ST-01, M10 red |
| AC3 | ✅ | UT-04, M7·M8·X3·X5 red |
| AC4 | ✅ | ST-02, M2·M3·M5 red |
| AC5 | ✅ | ST-02/04, M4a·b·X2 red |
| AC6 | ✅ | UT-01·IT-01, M6·X1 red |
| AC7 | ✅ | ST-04 |
| AC8 | ✅ | schedules 30/30, X7 red |
| AC9 | ✅ | chatStore send-now 뒤 취소 |
| AC10 | ✅ | IT-01 reject/accept · inventory `--check` |
| AC11 | ✅ | `git grep` 0 · 민감도 1 |
| AC12 | ✅ | 문서 5자리 |
| AC13 | ⚠️ | 사람 실기 대기 |

- **합계 재측정**: ✅12 · ⚠️1 · ❌0 = 총13. 자기보고 12/13과 일치.
- **사본 대조**: 본문 12/13 ↔ trailer `Criteria-Met: 12/13` ↔ INDEX `✅12 · ⚠️1` 일치.

### §10 강제 지점 분모

| Pair | 계약 | plan 지점 | 재측정 | 결과 |
|---|---|---|---|---|
| VP-10·17 | EP-01~08 | 8 | 채널 `ipc.ts:26`·schema `protocol.ts:216`·interface `ipc.ts:947`·preload `:150`·api `:118`·handle `index.ts:148`·IPC_CONTRACT `:43`·inventory 101 channels | 8/8 PASS |
| VP-18 | EP-09~12 | 필드·쓰기2·읽기4·비상속 | `turn.ts:15` · `index.ts:166,216` · `post-turn.ts:102,184,208,226` · M9 red | 8/8 PASS |
| VP-11·19 | EP-13 | 삭제 18자리 | 7식별자 0 · prod `PostToolBatch` 0 | PASS |
| VP-20 | EP-14 | 선언·게터·소비 | `ports.ts:17` · `session-runtime.ts:365` · `index.ts:154` | 3/3 PASS |
| VP-21·26 | EP-15 | 표식·액션·helper·i18n | `chatStore.ts:97,1101,1694` · controls `:16,26` · ko/en `sendNow` | PASS |
| VP-22 | EP-16 | 호출 2 | `index.ts:167,217` | 2/2 PASS |
| VP-06·23 | EP-17 | 정의·소비 1 | `admission.ts:26` · `index.ts:151` | PASS |
| VP-12 | EP-18 | 5 | 위 VP-12 행 | 5/5 PASS |

- 표에 없는데 필요한 지점: 없음.

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| lint | PASS | 0 error · 1 warning(기존 `useTranscriptVirtualizer.ts:22` React Compiler) · 트리 무변경 |
| typecheck | PASS | node·web·test 3/3 무출력 종료 |
| 관련 vitest | PASS | 367파일 3812케이스 중 361파일 green, 6파일 11케이스 red = 전부 `NODE_MODULE_VERSION 140 vs 127` → Electron Node 모드 재실행 6/6파일 19/19 green |
| doc inventory | PASS | `generated doc ok (9 items, 101 channels)` · prose ok · links ok |
| trailer 파싱 | PASS | `5b919551` 6키 반환 |

## 8. 남은 사람 실기

| 항목 | 기계 검증 범위 | 남은 실기 |
|---|---|---|
| AC13-1 도구 여러 번 쓰는 응답 중 전송 | ST-01·IT-02(실제 adapter 훅 반복) | 실제 CLI에서 응답 안에 끼지 않고 종료 후 전송 |
| AC13-2 hover → 즉시 보내기 | UT-04 노출·매핑, ST-02 interrupt·병합 | hover 시각, 실제 CLI interrupt 후 부분 답변 유지·`run_in_background` 셸 생존 |
| AC13-3 중단 버튼 | VP-16·X7 | 대기 버블 제거·composer 복원 시각 |

## 9. 게이트 재실행

- 명령: `cd app && npm run lint && npm run typecheck` · `./node_modules/.bin/vitest run <plan §19 + preload·errors·i18n·shared> --maxWorkers=4` · `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron ./node_modules/vitest/vitest.mjs run <DB 6파일>` · `node scripts/check-doc-inventory.mjs --check`.
- `npm test` 미사용(ABI 전환 없음).
- 게이트가 트리를 바꿨는가: 아니오. 잔여물: 없음(`.ko.ts.swp`는 검증 시작 전부터 있던 미추적 파일, 손대지 않음).

## 11. Repository operation checks

- INDEX: 상태 `impl/IMPL_DONE`·다음 주체 Claude — 실제 상태와 일치. 좌표 `4bfa8291`(V1)·`5b919551`(r1) `git cat-file -t` = commit, 이번 커밋에서 기입.
- trailer: `Agent: codex`·`Status: implemented`·`Criteria-*`·`Verified-By: pending` 허용값·파싱 정상.
- `[구현자 기입]` 7필드(설계 리뷰·강제 지점·잠금·Product/UX·잠재 문제·구현 보고·Review Signals) 전수 존재.
- 삭제 reference: `makeSteerGateHook` 등 문서 인용은 runtime-ipc·adapters에서 제거 확인(AC12).

## 13. Finding disposition

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | 대기 버블 컨테이너가 `group/msg` 하나라 hover 시 모든 대기 버블의 버튼이 함께 보인다(`PendingSteerTurn.tsx:24`) — 구현자 기입 #1 | 비귀속(D-005로 대상은 대기 전부라 동작 결과 동일) | NON_BLOCKING | AC13 시각 확인 때 판단 |
| D2 | renderer `streaming`(채널 backlog로 `listening`)인데 main `responding=false`면 버튼을 눌러도 무동작·버튼만 사라진다 | D-009 의도(대기는 기존 경로로 전달) | NON_BLOCKING | 기록 |
| D3 | 검증 환경에 `rg` 없어 `scan-surface.sh` 불가 | 환경 | NON_BLOCKING | git grep 대체 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일 증상: 해당 없음(r1).
- 관련 plan 지침: AC1~AC12 모두 행동 oracle + 등록 변이 보유.
- 사용자 결정 변경: 없음.
- 반복 환경 한계: `rg` 부재(0249와 동일) · DB 스위트 ABI 서명(Electron Node 모드로 분리).

## 15. 결론

- 상태: **PASS (기계 범위)**.
- pair: REQUIRED/REGRESSION 25 PASS · VP-13 사람 실기 대기 · PAIR_FAIL 0 · PLAN_GAP 0.
- AC: ✅12 · ⚠️1 · ❌0.
- 변이: 등록 16 + 독립 7 = 23 전부 red.
- gate: lint·typecheck·관련 vitest(DB 6파일 Electron 모드 포함)·inventory·trailer PASS.
- 다음: 사람 실기 §8 3건. archive 이동은 실기 뒤.

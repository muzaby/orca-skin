# Verify — 0243-execution-timer-removal

> 절차 정본은 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0243-execution-timer-removal` |
| 검증자 | Claude Code |
| 일자 | 2026-09-28 |
| 대상 커밋/range | `34adcfbe..2c3d8021` (r1 구현 `2c3d8021`) |
| 구현 전 plan 기준 | `d24c13f8`(V1) · `34adcfbe`(ΔV1) |
| V mode / 유효 V | `Delta V`: `V1@d24c13f8 + ΔV1@34adcfbe` |
| 검증 기준 plan revision | `d24c13f8:V1` / `34adcfbe:ΔV1` |
| 라운드 | 1 |
| 상태 | **PASS** (기계 범위) — AC12 사람 실기 대기 |
| 자기 검증 여부 | 설계 V1 = Claude, ΔV1·구현 = Codex, 검증 = Claude. 구현자 ≠ 검증자 — 그래도 보고에 없던 독립 축 13건을 심었다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 상태와 `[구현자 기입]` 절만. 규범 행(Decision·AC·V·§10)은 `2c3d8021`에서 바뀌지 않았다(`git diff 34adcfbe 2c3d8021 -- plan.md`가 `## [구현자 기입]` 이하와 메타 2행).
- **기준선이 diff로 성립하는가**: 예. V1 `d24c13f8`, ΔV1 `34adcfbe`, 구현 `2c3d8021`이 서로 다른 커밋이다.
- **ΔV1은 구현 에이전트가 쓴 규범 정정이다**(`Agent: codex` · `Status: designed`). 설계자 승인 흔적은 커밋 본문의 "사용자 구현 요청에 앞서"뿐이다. 그래서 ΔV1이 V1을 **완화했는지**를 행마다 가렸다.

| ΔV1 변경 | V1 대비 | 판정 |
|---|---|---|
| AC3 신규(실제 runtime abort 전달) | 요구 추가 | 강화 |
| AC5 catch 조건 `runtime.cancelled && aborted` → `aborted` | V1 경로의 상위집합 | 강화 |
| AC11 oracle `rg -i stall` → `\bstall\b\|idle timeout` + persistence.md | V1 술어는 `install` 34행에 걸려 충족 불가였다(재현: 현재 트리 V1 술어 → install 행만 매치) | 결함 정정, 의도 보존 |
| AC13 신규(finalize 실패 격리) | 요구 추가, V1 §13의 틀린 전제("settleEmit이 격리") 폐기 | 강화 |
| VP-02·VP-05 REQUIRED → REGRESSION | 둘 다 PASS 조건에 들어 판정 효력 동일 | 중립 |
| EP-03 "11자리" → 삭제 inventory | AC2 oracle 불변, 전수는 inventory 47→0으로 오히려 넓음 | 중립 |

- Decision Ledger 변경: 없음(D-001~D-009 원문 유지).
- Product/UX Contract 변경: 없음.
- 채점에 사용할 원 기준: V1 AC1~AC12 원문 + ΔV1 AC3·AC5·AC11·AC13. V1 원문 기준으로도 전부 충족됨을 함께 확인했다.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 기준 `V1@d24c13f8` 실재(`git cat-file -t` commit) |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | CHANGED SD-01·AR-01 → VP-06·VP-07 REQUIRED |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | R-02·R-05 → VP-02·VP-05 |
| pair별 path·§10 전수·직접 oracle | 유효 | EP-01~08 모두 pair에 매핑 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 등록 변이 6(M1~M6) |
| `SUPERSEDED` pair의 AC·적대 증거 이관 | 해당 없음 | 대체 pair가 V1 변이를 전부 승계 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | lint·typecheck·관련 vitest·inventory(app cwd)·trailer |

- root PLAN_GAP과 영향 pair: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 stall 삭제 | 무출력 장시간에도 턴 유지 | `post-turn.ts coordinator.run` → 타이머 없음(`timers.ts` 삭제) |
| D-002 mail 예산 삭제 | 120초 초과 동기화 완료 | `mail/tools.ts sync(signal)` → `sync-manager.ts:75` 호출자 signal만 |
| D-003 접속·probe 유지 | POP3 connect/command timeout 유지 | `pop3-session` 타이머 무변경, `sync-manager.test.ts` 2케이스 |
| D-006 비사용자 중단 종료 | `turn.aborted` 1회 + 정착·마감 | controller abort → `abortRuntime`(`turn-coordinator.ts:306-309`) → frame.cancel → `deliverAbortTerminal` |
| D-007 라벨만 | error 0 | helper는 `error`를 보내지 않음 |
| D-008 reason | `user_cancelled \| interrupted` | `shared/ipc.ts:733` |

### end-to-end 흐름

```text
discard/chain/owner/controller abort
  → turn.controller 'abort' → abortRuntime → SessionRuntime.markAborted → frame.cancel
  → TurnCoordinator 종료 분기(정상 반환·catch·backoff·사전 abort)
  → deliverAbortTerminal: settleOpenToolRuns → finalize(격리) → forward turn.aborted{interrupted}
  → closeBoundary(aborted)
  → chatStore turn.aborted → chatReducer TURN_END_RESET → StatusLine null
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 수용 | 멈춘 도구는 자동 회수 없음 — §17 사용자 수용 트레이드오프 |
| false success 가능성 | 없음 | 비사용자 중단은 `interrupted`로, 성공 `telemetry`를 합성하지 않음(정상 반환 합성은 `!aborted` 조건 유지) |
| partial failure/rollback | 수용 | finalize throw는 로그 후 terminal 계속(X2 변이로 잠김 확인). DB 잔여는 부팅 복구(기존) |
| A가 아닌 B | 아니오 | 사용자 중단 경로는 기존 `user_cancelled` 유지, 비사용자만 `interrupted` |
| 증상만 제거 | 아니오 | 원인(타이머)을 삭제하고 terminal 누락 경로도 닫음 |
| 잃은 재검증/취소 관측 | 없음 | 취소는 signal 전파로 유지(AC10 cancel) |
| worst-case 상한 | 수용 | 턴당 `turn.aborted` ≤1(helper 가드 + handler ack). mail은 사서함 전체 순회가 상한(§14) |

- 동시성: chatCancel은 `cancelChain` → lease abort → turn controller → `abortRuntime`이 먼저 mark하고, 이어지는 `abortTurn`은 `abort.ts:15` 가드로 재mark를 건너뛴다. 핸들러는 동기 흐름에서 ack를 세우므로 coordinator helper(비동기 재개)와 경합하지 않는다.
- 승인 거부+interrupt(`approvals/coordinator.ts:79`)는 이제 runtime interrupt까지 동기로 일으킨다. 해당 주석이 경고하는 "deny 전파 소실"과 같은 축이지만 현재 renderer는 `interrupt:true`를 보내지 않는다(`chatStore.ts:1605-1634`) → D4 NON_BLOCKING.

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 34adcfbe..2c3d8021`

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export `WORKTREE_PREPARE_STEPS` 외 타입 7 | 정상 | 이번 diff가 만들지 않은 기존 심볼. `MailTimeouts`는 필드만 줄었다 |
| 테스트 전용 `RETRY_BACKOFF_MS`·`abortableDelay` 등 5 | 정상 | 파일 내부 프로덕션 사용, 타 파일 참조만 테스트 — 기존 |
| 형제 정책 비대칭 | 없음 | 스크립트 0건 |
| 신규 필드 `abortAcknowledged`의 소비처 | 무영향 | 쓰기 2(`index.ts:187`·`turn-coordinator.ts:301`)·읽기 1(`:283`). `makeContinuationTurn`이 새 객체로 만들어 상속 안 됨(`turn-context.ts:207`) |
| producer ↔ consumer | 일치 | renderer는 reason을 읽지 않음(`rg turn.aborted src/renderer` → 분기 2곳, reason 참조 0) |
| 동일 규칙 중복 | SSOT 유지 | 중단 terminal = helper, chatCancel만 즉시성 예외 + ack |
| 잔여 서술 | nit | `send.ts:411` 주석 "idle 완전 멈춤" — 삭제된 idle 타이머 서술(D5) |

## 4. 기존 테스트 / semantic 검증 확인

- plan 인용 기존 테스트: `turn-coordinator.test.ts` listen 케이스가 리터럴 시간으로 이전됨(M6 red 목록에 포함). `runtime-resilience` stall 6케이스·`timers.test.ts` 삭제, `abortableDelay` 케이스 유지 확인.
- AC4~AC13의 핵심 경로는 실제 `SessionRuntime`+`TurnCoordinator`+IPC 핸들러 하네스(`post-turn.schedules.test.ts:241` 5케이스)에서 실행된다 — 동명 재구현 아님.
- **선택된 적대 증거 재측정**: 등록 6건 중 검출 6 · 미검출 0. 일반 hunk 자동 확장 0.
- **자리 미지정 등록 변이**: VP-08 "타이머 재삽입"을 `controller.abort`만(M6)과 `markAborted+abort`(M6b) 두 자리로 심어 둘 다 red.
- **이전 라운드 대조**: 첫 검증 라운드 — 해당 없음.
- **독립 축**(보고에 없던 것): 13건 중 red 10 · green 3(X3·X4·X8 — 아래 판정).

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 정상 반환 helper 삭제 | 4스위트 103케이스 | red 6 | VP-02 등록 |
| M2 aborted catch helper 삭제 | 동일 | red 1 | VP-02 등록 |
| M3 backoff catch helper 삭제 | 동일 | red 1 | VP-02 등록 |
| M4 handler ack 삭제 | 동일 | red 1(IPC cancel) | VP-04 등록 |
| M5 stream terminal flag 삭제 | 동일 | red 2(AC7) | VP-06 등록 |
| M6 120초 controller abort 재삽입 | 동일 | red 4(AC1 3종 + listen 수명) | VP-08 등록 |
| M6b 120초 markAborted+abort 재삽입 | 동일 | red 4 | VP-08 등록, 형제 자리 |
| X1 abort listener 등록 삭제(EP-07) | 동일 | red 3(controller·chain·db-failure) | 독립 |
| X2 finalize try/catch 삭제(EP-08) | 동일 | red 2 | 독립 |
| X3 합성 telemetry 뒤 flag 삭제(EP-06 ②) | 동일 | **green** | 독립 — D1 |
| X4 generic error 뒤 flag 삭제(EP-06 ③) | 동일 | **green** | 독립 — D1 |
| X5 사전 abort 분기 삭제(EP-07) | 동일 | red 2 | 독립 |
| X6 finally listener 해제 삭제(EP-07) | 동일 | red 1 | 독립 |
| X7 `abortTurn` 중복 mark 가드 삭제 | 동일 | red 2 | 독립 |
| X8 helper의 ack 쓰기 삭제(EP-02 ②) | 동일 | **green** | 독립 — D1 |
| X9 helper의 ack 읽기 삭제 | 동일 | red 1 | 독립 |
| X10 helper reason `interrupted`↔`user_cancelled` 맞바꿈 | 동일 | red 8 | 독립(형제 슬롯) |
| X11 finalize를 settle보다 앞으로(순서) | 동일 | red 4 | 독립 |
| X12 catch를 V1 조건(`cancelled &&`)으로 되돌림 | 동일 | red 1 | 독립(ΔV1 AC5) |

- X3·X4·X8 green은 잠금 누락이 아니라 **관측 불가 자리**다: X4 뒤는 `closeAfterFailure → return`, X3은 `!aborted` 분기 직후 같은 동기 흐름에서 helper가 aborted로 즉시 반환, X8은 `terminalForwarded`가 같은 run 안에서 이미 막고 ack는 다음 턴에 상속되지 않는다. 방어적 쓰기이며 D1로 기록한다.
- 소거 변이 잔여물: 전부 typecheck 무관 치환이라 해당 없음(테스트가 판정).
- `N회` 관측 주체: IPC 하네스는 bus 이벤트 + `sendChatEvent` mock 합산으로 `turn.aborted`를 센다(두 producer 모두 포함).
- 순서 관측: bus 이벤트 배열의 `tool.call.completed` → `response.boundary end` 순서, X11로 민감도 확인.
- 재현: `node docs/handoff/0243-execution-timer-removal/evidence/verify-r1-mutations.mjs` → [결과](evidence/verify-r1-mutations.json). 실행 후 `git status --porcelain` 0행.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 |
|---|---|---|---|---|---|
| VP-08 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS | AC1 3종 · AC2 rg 0행 · M6/M6b red | EP-03 inventory 잔여 0 |
| VP-09 | MD-02 ↔ UT-02 / UT | REQUIRED | PASS | `sync-manager.test.ts` 4케이스 | EP-04 5/5 |
| VP-07 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | IPC 하네스 5케이스(cancel·discard·controller·chain·db-failure) | EP-02·07·08 |
| VP-06 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | AC3~5·7·13 · M5·X1·X5·X6 red | EP-01 4/3(+사전 abort)·EP-06 1/3 관측 가능(D1)·EP-07 4/4·EP-08 1/1 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | PASS(기계) | AC1 · AC12① 사람 실기 대기 | — |
| VP-02 | R-02 ↔ AT-02 / AT | REGRESSION | PASS(기계) | AC3~5·7~9·13 · M1~M3 red · AC12② 사람 실기 대기 | EP-01·02·07·08 |
| VP-03 | R-03 ↔ AT-03 / AT | REQUIRED | PASS | AC10 + mail 통합 28 | EP-04 |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | PASS | AC6 IPC cancel `user_cancelled` 1·M4 red | EP-02 |
| VP-05 | R-05 ↔ AT-05 / AT | REGRESSION | PASS | typecheck·AC11 rg 0행 | EP-05 10/10 |

- root `PAIR_FAIL`: 없음. 종속 `BLOCKED_BY`: 없음.
- 공유 증거: IPC 하네스 5케이스가 VP-02·04·06·07을 함께 닫는다 — VP-04는 cancel 케이스, 나머지는 비사용자 4케이스로 판정 범위를 나눴다.
- 실행 범위: 최초 검증 — 유효 V의 REQUIRED 7 · REGRESSION 2 전건.

### AT / AC 세부와 합계

| AC | 결과 | 검증 증거 |
|---|---|---|
| AC1 | ✅ | coordinator user·continuation·listen 30분 → abort·markAborted 0, telemetry 후 boundary `ended`, turn.aborted 0 |
| AC2 | ✅ | `rg` 금지 심볼(background-controller 제외) 0행; 엄격화 `rg -i stall`(install 제외) main 0행 |
| AC3 | ✅ | IPC 하네스 controller·chain: interrupt 1·run 종료. 사전 abort send 0·해제 후 mark 0(X5·X6 red) |
| AC4 | ✅ | return 케이스 순서 tool aborted → finalize → interrupted → boundary aborted(M1·X11 red) |
| AC5 | ✅ | throw(`cancelled=false`)·backoff 각 interrupted 1·error 0(M2·M3·X12 red) |
| AC6 | ✅ | 실제 chatCancel 합산 `user_cancelled` 1·finalize 1·interrupt 1(M4·X7·X9 red) |
| AC7 | ✅ | telemetry·error 기전달 뒤 turn.aborted 0(M5 red) |
| AC8 | ✅ | reducer inflight=false·turnStartedAt=null·error undefined, StatusLine 마크업 `''` |
| AC9 | ✅ | 실제 chatDiscardSession → interrupted 1·tool aborted·boundary aborted |
| AC10 | ✅ | 151초 성공·caller abort `cancelled`·connect/command `timeout` |
| AC11 | ✅ | union `user_cancelled \| interrupted`, ΔV1 rg 0행, V1 의도(stall 단어) 0행 |
| AC12 | ⚠️ | 사람 실기 대기 — Windows 200초 Bash/PowerShell, 진행 중 세션 폐기 시각 |
| AC13 | ✅ | 단위·IPC db-failure: interrupted 1·boundary aborted·error 0·run resolve(X2 red) |

- **합계 재측정**: `✅ 12 · ⚠️ 1 · ❌ 0 = 총 13` · 자기보고 12/13 · 일치.
- **합계 사본 대조**: 본문 12/13 ↔ trailer `Criteria-Met: 12/13` ↔ INDEX `AC 12/13` — 일치.

### pair별 plan §10 강제 지점 분모

| EP | plan 지점 | 코드에서 확인 | 결과 |
|---|---|---|---|
| EP-01 | 3 | `turn-coordinator.ts:566·573·598` + 사전 abort `:311` | PASS 3/3(+1) |
| EP-02 | 쓰기 2 | `index.ts:187` · `turn-coordinator.ts:301` | PASS 2/2 — `:301`은 관측 불가(D1) |
| EP-03 | inventory | 금지 심볼 main 0행, `timers.ts` 부재 | PASS |
| EP-04 | 5 | budget·setTimeout·루프 판정·catch 판정·clear·`syncMs` 모두 부재(`rg` 0행), 호출자 signal `:75` | PASS 5/5 |
| EP-05 | 10 | union 1·IPC 3·runtime-ipc 4·provider-runtime 1·persistence 1 — diff에서 10행 확인 | PASS 10/10 |
| EP-06 | 3 | `:463`·`:561`·`:620` | PASS 3/3 구현, 관측 가능 1(D1) |
| EP-07 | 4 | 등록 `:309`·사전 판정 `:311`·mark `:307`·해제 `:626` | PASS 4/4 |
| EP-08 | 1 | `:290-295` | PASS 1/1 |

- 표 밖 같은 불변식 지점: `abort.ts:15` 중복 mark 가드 — 구현자가 선조치·보고, X7로 잠김 확인.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| lint | PASS | error 0 · warning 1(`useTranscriptVirtualizer` 기존) · 실행 후 트리 변화 0 |
| typecheck | PASS | node·web·test 3구성, `error TS` 0 |
| 관련 vitest | PASS | 275파일 · 2398케이스 · 실패 0 · skip 0 (DB·electron 로드 스위트 포함) — [요약](evidence/verify-r1-tests.json) |
| doc inventory(app cwd) | PASS | 9항목·100채널, prose·links ok |
| message-bus | PASS | 세 커밋 trailer 파싱 확인(§11) |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `turn.aborted.reason` | typecheck 3구성 | renderer 미사용, 분기는 type만 | PASS |
| `MailTimeouts.syncMs` 제거 | 저장소 전체 `rg syncMs`(handoff·archive 제외) 0행 | 배포 TS가 넘기면 typecheck 오류로 드러남 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `turn.aborted` 프로덕션 생산자 `rg "type: 'turn.aborted'" app/src/main` → 2(handler·helper). plan 예측 2와 일치.
- abort 발생원 재열거: controller/abortTurn/markAborted 호출 중 턴 관련 10곳(`send.ts:266·416-417`·`supervisor.ts:181-182·282·293`·`index.ts:142·180`·`approvals/coordinator.ts:79`·`bootstrap.ts:882`·`session-chain-lease.ts:148`) — 전부 turn controller를 거쳐 새 listener에 도달.
- 0건 게이트의 예외: `background-controller.ts` `timedOut` 유지(D-003) 확인.
- 음성 oracle 엄격화: AC2를 `rg -i stall`(install 제외)로 엄격화 → main·shared·renderer에 `Crystallizing` 1행뿐(오탐). 문서도 `docs/*.md`·`arch`·`guides`·`decisions` 로 넓혀 0행.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| AC12① | 타이머 부재·30분 무출력 비중단(fake runtime) | 실제 CLI가 200초 무출력 Bash/PowerShell을 어떻게 다루는지(D-009) | 패키징 앱에서 `sleep 200`·`Start-Sleep 200` 요청, 턴 유지와 PowerShell 백그라운드 전환 여부 기록 |
| AC12② | 실제 SessionRuntime+IPC discard → interrupted 1, reducer·StatusLine | 실제 화면 스피너 소거·'응답 중단' 라벨·입력 가능 | 도구 실행 중 우측 세션 폐기 클릭 |

## 9. 게이트 재실행

- 환경 복구: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 후 첫 vitest에서 electron 미설치 7·ABI 8파일 실패 → `node node_modules/electron/install.js`(다운로드 성공) + `npm rebuild better-sqlite3`(Node ABI)로 복구 후 전건 재실행.
- 실제 명령: `npm run lint` · `npm run typecheck` · `./node_modules/.bin/vitest run src/main/features/chat src/main/app/chat-turn src/main/app/chat-turn.runtime-resilience.test.ts src/main/app/chat-turn.runtime-tools.test.ts src/main/app/chat-turn.continuity.test.ts src/main/features/plugins/mail src/main/app/deployment/mail.integration.test.ts src/main/features/sessions src/main/contracts src/main/infra/net/pop3-session.test.ts src/main/features/approvals src/renderer/src/features/chat` · `node scripts/check-doc-inventory.mjs --check`.
- **관측 산출**: 275파일/2398케이스 통과 · lint 0 error/1 warning · typecheck 3구성 진단 0.
- `npm test` 미사용. ABI는 Node로 남았다 — 이후 이 체크아웃에서 `dev/build` 하려면 Electron 재빌드 필요.
- 게이트의 작업 트리 변경: 없음(`git status --porcelain` 0행).
- 잔여물: 없음. 변이 runner는 임시 JSON을 OS temp에만 쓴다.

## 10. 검증 책임 분리

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/관련 테스트 | 실행·산출 관측 | — | PASS |
| AC ↔ production path | 1:1 대조 | — | 12/13 |
| 문서 계약·링크 | inventory·rg | — | PASS |
| Windows CLI·UI 실기 | — | **AC12** | 대기 |
| PR merge | — | **승인** | 대기 |

## 11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 상태 `impl/IMPL_DONE` → `verify/PASS`, 다음 주체 `사람`(AC12). 대상 커밋 칸의 자리표시자 2개를 `34adcfbe`(ΔV1)·`2c3d8021`(r1)로 기입, `git cat-file -t` 모두 commit. 비고 5줄 이내. archive 이동은 AC12 뒤.
- trailer 파싱: `d24c13f8`(Agent·Handoff·Status + 서명 2) · `34adcfbe`(Agent·Handoff·Status) · `2c3d8021`(Agent·Handoff·Status·Criteria-Met·Criteria-Pending·Verified-By) 모두 반환, 값 허용 범위.
- `[구현자 기입]` 7필드: 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals — 7/7.
- 삭제된 `timers.ts`의 살아 있는 소비처: 0(`rg "chat/timers"` 0행).

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| ΔV1로 AC3·AC13·EP-07·08 선정정 | 타당, 완화 없음(§0 표). 다만 규범 정정은 설계자 몫이다(D3) | 기준으로 채택 |
| `abortTurn` 중복 mark 가드 추가 | 구현 세부 보완 — 공개 결과 불변, X7로 잠김 | 수용 |
| mail 통합 `syncMs` 케이스를 command-timeout으로 교체 | AC10 결과 4종이 단위에서 각각 관측됨 | 수용 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| D1 | EP-06 ②③(`:561`·`:620`)과 EP-02 helper 쓰기(`:301`)는 관측 불가 자리 — X3·X4·X8 green | VP-06·VP-07 / §10 | NON_BLOCKING | 방어 코드로 두거나 후속 정리 시 제거. 동작 결함 없음 |
| D2 | `approval.identity` AC1 테스트는 requester 단독이라 coordinator 타이머와 결합하지 않는다 | VP-01 AC1 "승인 대기 중에도" | NON_BLOCKING | coordinator 타이머 재삽입은 M6가 이미 잡는다. 결합 케이스는 후속 선택 |
| D3 | ΔV1 규범 정정을 구현 에이전트가 작성(`Agent: codex`·`Status: designed`) | 협업 규칙 `docs/handoff/AGENTS.md §2 구현` | NON_BLOCKING | 내용은 완화 없음. Review Signal로 남김 |
| D4 | 승인 deny+interrupt가 이제 runtime interrupt를 동기 유발 — 주석이 경고한 deny 전파 소실 축 | 비귀속(renderer 미사용 경로) | NEXT_HANDOFF | `interrupt:true` 경로를 쓰게 되면 재검토 |
| D5 | `send.ts:411` 주석이 삭제된 idle 타이머를 서술 | 비귀속 | NON_BLOCKING | 다음 편집 시 정리 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 첫 라운드.
- 관련 plan 지침: V1 §13이 "settleEmit이 finalize 오류까지 격리"라고 적었으나 사실이 아니었고, V1 AC11 술어는 `install`에 걸려 충족 불가였다 — 둘 다 ΔV1이 구현 전에 고쳤다.
- 규범 정정 주체: ΔV1은 구현 에이전트가 설계 커밋으로 분리해 작성했다(D3).
- 반복된 검증 환경 한계: electron 바이너리 미설치·SQLite ABI — 이번 환경에서는 다운로드가 열려 복구됐다.

## 15. 결론

- 상태: **PASS** (기계 범위)
- pair 결과: REQUIRED 7 · REGRESSION 2 PASS · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision: D-001~D-009 충족(D-009·AC12는 사람 실기)
- AC: ✅12 · ⚠️1 · ❌0
- 운영 gate: lint·typecheck·vitest 275/2398·inventory·trailer PASS
- NON_BLOCKING D1·D2·D3·D5, NEXT_HANDOFF D4
- 남은 사람 확인: AC12 ①② Windows 실기, PR merge
- 다음 단계: 사람 실기 뒤 INDEX 행 archive 이동

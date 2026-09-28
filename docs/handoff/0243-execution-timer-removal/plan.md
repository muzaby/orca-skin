# Plan — 0243-execution-timer-removal

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`../AGENTS.md`](../AGENTS.md).
> 문서 순서가 계약이다: Part I Product & UX Contract → Part II Technical Design.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0243-execution-timer-removal` |
| 작성자 | Claude Code |
| 일자 | 2026-09-28 |
| 매핑 | 브랜치 `claude/long-task-response-halt-ms2z08` |
| 상태 | READY |
| V mode | `Baseline V` |
| 기준 V | `none` |
| 이번 V revision | `V1` |
| 유효 V | `V1` |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 출력 없이 120초 넘게 도는 도구(빌드·테스트 등)가 있으면 Orca stall 타이머가 턴을 끊는다. 끊긴 턴은 "응답 중단" 라벨은 뜨지만 스파크 스피너가 영구히 돈다(사용자 실측: 로그 `chat.turn.cancelled`, 재시작 시 DB 에는 `aborted` 로 종료).
- 완료 후 달라지는 것: ① 실행 시간 상한 타이머가 없어 긴 도구가 끝까지 돈다. ② 사용자가 누르지 않은 이유로 응답이 중단돼도 턴이 종료되고 스피너 없이 입력 대기로 돌아간다.
- 성공을 사용자 관점에서 한 문장으로: 오래 걸리는 작업은 끝날 때까지 기다리고, 어떤 이유로든 응답이 중단되면 "응답 중단" 라벨과 함께 바로 다음 입력을 받을 수 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "모든 도구의 타이머 제한을 제거." | 라이브 세션 `/handoff-plan` 인자 |
| 명시 요구 | "특정 이유로 응답중단이 되었을때는 어시스턴트의 턴도 종료할 것. 스피너표시 x. 사용자 턴 대기." | 같은 인자 |
| 명시 요구 | "probe, 접속 같은 성격의 타이머는 유지하고 실제 실행에 대한 중단타이머를 모두 없애는 형태" → 제시한 분류표에 "그 분류로 plan 작성해" | 라이브 세션 후속 턴 |
| 명시 요구 | 비사용자 중단 표시 = "'응답 중단' 라벨만" | AskUserQuestion 응답 |
| 추론 의도 | "스피너표시 x" 는 StatusLine 스파크 스피너(`StatusLine.tsx:124`)를 가리킨다 — 사용자가 "스파크 스피너 아이콘"으로 특정 | 앞선 진단 턴 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | Orca stall 120초 타이머(`features/chat/timers.ts`)를 **삭제**한다. 비활성화가 아니라 타이머·정책 필드·pause 배선·`'stall'` 원인까지 제거 | "실제 실행에 대한 중단타이머를 모두 없애는" | 사용자 턴 | ACTIVE | — |
| D-002 | mail_sync 전체 예산(`syncMs`, 기본 120초)을 **삭제**한다 | 실행 시간 상한 = 제거 대상 | 사용자 확정 분류표 | ACTIVE | — |
| D-003 | 접속·probe·응답 확인 타이머는 **유지**한다: POP3 연결 15초·명령 응답 30초, 인증 probe 15초, OAuth 콜백 10분, 제어 명령 응답 확인 15초(`background-controller`·`stop-subagent`), 앱 내부 작업(사용량·제목·git) | "probe, 접속 같은 성격의 타이머는 유지" · POP3 명령 30초는 무응답 감지로 분류(회색지대, 사용자 확정) | 사용자 턴 | ACTIVE | — |
| D-004 | CLI 내장 Bash 타임아웃은 **변경하지 않는다** — 초과 시 명령을 죽이지 않고 백그라운드로 넘긴다(SDK 0.3.267 `timedOutAfterMs`) | 실행 중단 타이머가 아님(회색지대, 사용자 확정) | 사용자 턴 | ACTIVE | — |
| D-005 | REPL·Monitor 인자 타임아웃은 **범위 밖** | 모델이 인자로 정하는 값이고 Orca 사용 여부 미확인(회색지대, 사용자 확정) | 사용자 턴 | ACTIVE | — |
| D-006 | 사용자가 누르지 않은 중단으로 턴이 끝나면 main 이 renderer 에 **종료 신호를 정확히 1회** 보낸다 — 열린 도구 `aborted` 정착 + assistant 마감 + `turn.aborted` | "어시스턴트의 턴도 종료 … 스피너표시 x. 사용자 턴 대기" | 사용자 턴 | ACTIVE | — |
| D-007 | 비사용자 중단의 화면 표시는 **'응답 중단' 라벨만**. 별도 오류 문구·원인 안내 없음 | AskUserQuestion 응답 | 사용자 턴 | ACTIVE | — |
| D-008 | `turn.aborted.reason` 을 `'user_cancelled' \| 'interrupted'` 로 한다. 생산자 0건인 `'timeout'` 은 제거 | 비사용자 중단을 `user_cancelled` 로 거짓 표기하지 않는다. renderer 는 reason 을 읽지 않는다(§8) | 설계 판단(코드 조사) | ACTIVE | — |
| D-009 | PowerShell 이 Bash 와 같은 타임아웃·자동 백그라운드 규칙을 쓰는지는 코드로 확인 불가 → **사람 실기 항목**으로 둔다 | SDK 0.3.267 타입에 PowerShell 스키마 0건 | 사용자 질의 턴 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-009 (신규 handoff).
- 변경된 결정: 없음. 진단 턴에서 제안했던 "tool_progress 하트비트로 stall 초기화"는 사용자가 "하트비트 기능 미포함"으로 배제했고 D-001(삭제)로 대체돼 결정으로 남기지 않는다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001↔AC1·AC2 · D-002↔AC10 · D-003↔AC10(연결·명령 타이머 유지 단언)·AC2(허용 목록) · D-004/D-005↔§6 비범위(AC 없음, 반대 요구 AC 0) · D-006↔AC4~AC7 · D-007↔AC8(오류 문구 0) · D-008↔AC11 · D-009↔AC12.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 | stall 발동 → `markAborted('stall')` → `frame.cancel()` 이 예외 없이 끝남 → coordinator 정상 반환 경로에서 renderer terminal 0건(`turn-coordinator.ts:538-553`). 두 요구가 각각 발동 원인과 고착 원인을 겨냥 |
| 이미 기존 코드가 충족하는가 | 부분 | 사용자 중단(`chat-turn/index.ts:174-192`)만 settle·finalize·`turn.aborted` 를 한다. 비사용자 중단 경로는 0 |
| 더 작은 해법 / 능력 자체가 없어도 되는가 | stall 은 없어도 된다 | 멈춘 도구는 중단 버튼(사용자 중단 경로)으로 회수된다. Bash 는 CLI 가 백그라운드로 넘긴다(D-004). listen 턴은 이미 stall 미무장(`turn-policy.ts:21`) |
| 선행 자료 대조 | 정정 1건 | `IPC_CONTRACT.md:499,527` "무응답 idle timeout 은 `error(stream_error)` 로 발행" — 영속 채널에서는 `frame.cancel()` 때문에 그 분기(`turn-coordinator.ts:560`)에 도달하지 않는다. 문서는 이번에 제거 |
| ACTIVE 결정·기존 채택 결정과 충돌 | 없음 | 0237 D-063(OPEN, `syncMs` 초과 반환 형상)은 D-002 로 대상이 사라진다 — 0237 문서는 수정하지 않고 §16 에 기록 |

- 사용자에게 올릴 결정: 없음 (분류·표시는 확정됨).
- 코드 조사로 닫은 사실: 비사용자 중단 발생원 전수(§8 전수 조사), renderer 가 `reason` 을 읽지 않음, mail_sync 는 사용자 중단 신호로 취소됨(`session-runtime.ts:110-114` → `mail/tools.ts:84`).

## 5. 동작 / 사용자 흐름

```text
[사용자 전송] → 턴 진행(스파크 스피너)
  → 도구가 출력 없이 N분 실행 → (타이머 없음) 계속 진행 → 결과 → 응답 완료 → 입력 대기
  ↘ [사용자 중단 버튼] → '응답 중단' → 입력 대기            (기존 동작 유지)
  ↘ [비사용자 중단: 세션 폐기·승인 거부+중단·체인 종료 등]
       → 열린 도구 '중단됨' 정착 → '응답 중단' 라벨 → 스피너 사라짐 → 입력 대기
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 턴 진행 중, 이벤트 없이 임의 시간 경과 | 아무 동작 없음 | 스피너 유지(작업 중) |
| 사용자 중단 버튼 | 기존 `chatCancel` 경로 + 중단 확인 표시 | '응답 중단', 스피너 사라짐 |
| 비사용자 중단, renderer 에 terminal 미전달 | coordinator 가 settle·finalize·`turn.aborted{interrupted}` 1회 | '응답 중단', 스피너 사라짐, 오류 문구 없음 |
| 중단 전에 `telemetry`/`error` 가 이미 전달됨 | 추가 신호 없음 | 기존 결과 그대로 |
| mail_sync 가 120초 넘게 진행 | 예산 없음 → 계속 | 동기화 완료 결과 |
| mail_sync 중 사용자 중단 | 신호 전파 → `cancelled` | 도구 결과 '취소' |

### 파생 UX / 엣지케이스

- cancel / restart: 재시작 시 DB 에는 기존과 같이 `response_boundary` `aborted` 가 남는다(변경 없음).
- concurrency: 사용자 중단 직후 coordinator 가 두 번째 `turn.aborted` 를 보내면 다음 턴 스피너를 지울 수 있다 → 중복 금지(AC6).
- 멈춘 도구(무한 대기): 자동 회수 없음. 사용자 중단 버튼으로 회수된다 — 사용자가 수용한 트레이드오프(§17).
- 폐쇄망/서버 무응답: POP3 연결·명령 타이머가 계속 감지한다(D-003).

## 6. 범위 / 비범위

- **범위**: Orca stall 타이머 삭제와 그 배선, 비사용자 중단 시 renderer terminal 보장, mail_sync 전체 예산 삭제, `turn.aborted.reason` 계약, 관련 문서(`IPC_CONTRACT.md`·`arch/backend/runtime-ipc.md`·`arch/backend/provider-runtime.md`).
- **비범위**: CLI 내장 도구 타임아웃(D-004·D-005), 접속·probe 타이머(D-003), 정착 문구 `'사용자가 중단했습니다'`(`settle.ts:73`)의 비사용자 중단 시 부정확성, 준비 단계(coordinator 진입 전) 중단의 renderer 신호, 미사용 `AbortCause 'retry'`.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 정착 문구 원인별 분기 | 아니오 | 후속 |
| 준비 단계 중단 신호 | 아니오 | 후속(현재 `chatCancel` 이 이미 `turn.aborted` 를 보냄) |
| `reason` 값 이름 | **예 — 공개 IPC 계약** | 지금 결정(D-008) |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | user·continuation 턴에서 이벤트 없이 30분이 지나도 턴이 중단되지 않고, 이후 `telemetry` 가 오면 정상 종료한다 | `TurnCoordinator` + fake runtime + fake timers: 30분 advance 후 `controller.signal.aborted === false`·`markAborted` 호출 0 → telemetry push → run resolve, boundary outcome `ended`, forward 에 `turn.aborted` 0건. 승인 대기 중(`requestApproval` 보류)에도 동일 | `post-turn.ts` `coordinator.run` → `runtime.send` 프레임 소비 |
| R-01 | AT-01 / AC2 | 실행 상한 타이머 코드가 main 에 없다 | `rg -n "STALL_TIMEOUT_MS\|createStallTimer\|armStall\|beginApprovalPause\|activeStall\|'stall'\|timedOut" app/src/main --glob '!**/*.test.ts'` → 0건. AC1(양성)과 짝 | 해당 없음 — 정적 게이트 |
| R-02 | AT-02 / AC4 | 비사용자 중단(`turn.controller.abort()` 만, `chatCancel` 없음)으로 프레임이 정상 종료되면 renderer 가 `turn.aborted{reason:'interrupted'}` 를 정확히 1회 받고, 그 전에 열린 도구가 `aborted` 로 정착하며 assistant 가 1회 마감된다 | coordinator 단위: 도구 started 후 abort + `frame` 종료 → forward 호출 중 `turn.aborted` 1건, 정착 `tool.call.completed(aborted)` 가 `response.boundary end` 보다 앞, `persist.finalizeTurn` 1회, boundary outcome `aborted` | `markAborted` → `frame.cancel()` → `turn-coordinator.ts` 정상 반환 |
| R-02 | AT-02 / AC5 | 같은 보장이 ① 스트림이 예외로 끝난 취소 경로(`runtime.cancelled && aborted`) ② retry backoff 중 abort 경로에서도 성립한다 | coordinator 단위 2케이스, AC4 와 같은 단언 | `turn-coordinator.ts` catch 분기 2곳 |
| R-04 | AT-04 / AC6 | 사용자 중단 버튼 경로는 `turn.aborted{user_cancelled}` 를 정확히 1회 보내고 coordinator 는 추가로 보내지 않는다 | chat-turn 핸들러 하네스(`post-turn.schedules.test.ts` 의 `ipc.handlers` 방식): 턴 진행 중 `chatCancel` 호출 → run 종료까지 `turn.aborted` 누적 1건·reason `user_cancelled` | `CHANNELS.chatCancel` 핸들러 → coordinator 종료 |
| R-02 | AT-02 / AC7 | 중단 시점에 `telemetry` 또는 `error` 가 이미 renderer 로 전달됐다면 `turn.aborted` 를 추가로 보내지 않는다 | coordinator 단위 2케이스: telemetry 후 abort / error forward 후 abort → `turn.aborted` 0건 | `turn-coordinator.ts` 종료 경로 |
| R-02 | AT-02 / AC8 | renderer 가 `turn.aborted{interrupted}` 를 받으면 `inflight=false`·`turnStartedAt=null`·`error` 미설정이 되고 StatusLine 이 렌더되지 않는다 | reducer 단위: interrupted 수신 후 상태 3종 단언 + `StatusLine` 은 `turnStartedAt==null && listenStartedAt==null` 이면 `null`(기존 `StatusLine.tsx:95`) | `chatStore` `turn.aborted` 분기 → `chatReducer` `TURN_END_RESET` |
| R-02 | AT-02 / AC9 | 세션 폐기(`chatDiscardSession`)로 진행 중 턴이 끝나면 renderer 가 `turn.aborted{interrupted}` 1건을 받는다 | chat-turn 핸들러 하네스: 턴 진행 중 discard 호출 → `turn.aborted` 1건 reason `interrupted` | `CHANNELS.chatDiscardSession` → `abortTurn` → coordinator |
| R-03 | AT-03 / AC10 | mail_sync 는 전체 시간 상한 없이 끝까지 진행하고, 호출자 신호 abort 시 `cancelled`, 연결·명령 타이머는 기존대로 `timeout` 을 낸다 | sync-manager 단위: 느린 fake 세션으로 121초 진행 → `synced:true` / signal abort → `error:'cancelled'` / 명령 무응답 → `timeout`(기존 `commandMs` 경로). `MailTimeouts` 에 `syncMs` 없음(typecheck) | `mail/tools.ts:84` `sync(context.getSignal())` → `createMailSyncManager().sync` |
| R-05 | AT-05 / AC11 | `turn.aborted.reason` 은 `'user_cancelled' \| 'interrupted'` 이고 문서가 같은 값을 적는다. stall·idle timeout 서술이 현재 문서에 없다 | typecheck(`shared/ipc.ts` union) + `rg -n "'timeout'" app/src/shared/ipc.ts` 의 `turn.aborted` 행 0 + `rg -n -i "stall" docs/arch docs/IPC_CONTRACT.md` 0건 | 정적 |
| R-01·R-02 | AT-06 / AC12 | Windows 실기: ① 3분 이상 무출력 Bash 명령과 PowerShell 명령이 턴을 끊지 않는다(PowerShell 이 백그라운드로 넘어가는지 기록) ② 진행 중 세션 폐기 시 스피너가 사라지고 '응답 중단' 라벨·입력 가능 | 사람 실기 — 실행 경로: 패키징 앱에서 `Start-Sleep 200`·`sleep 200` 요청, 우측 세션 폐기 | 실제 CLI 바이너리 |

### AC 검증 주의사항

- 기존 테스트 재사용: `turn-coordinator.test.ts:1241` "listen 턴은 STALL_TIMEOUT 경과에도 abort 하지 않는다" 는 상수 import 가 사라지므로 리터럴 시간으로 옮기고 user·continuation 케이스를 추가한다. `chat-turn.runtime-resilience.test.ts:12-110` 의 stall/pause 케이스 6건과 `timers.test.ts` 는 대상 코드와 함께 삭제한다. `abortableDelay` 케이스(`:114`)는 유지.
- 사람 실기 항목: AC12 는 실제 CLI 바이너리의 도구 동작(PowerShell 스키마 미공개)과 폐기 UI 를 요구해 순수 로직으로 내릴 수 없다. 로직 부분은 AC1·AC9 가 잠근다.
- N회 기준: `turn.aborted` sink 의 프로덕션 호출부 = `rg -n "type: 'turn.aborted'" app/src/main --glob '!**/*.test.ts'` → 현재 1(`chat-turn/index.ts:188`), 변경 후 2(+coordinator 헬퍼 1). AC4~AC7·AC9 의 "정확히 1회" 는 하네스가 두 호출부를 모두 실제로 태우는 AC6·AC9 에서만 총량으로 단언하고, coordinator 단위(AC4·AC5·AC7)는 coordinator 가 스스로 낸 호출만 센다.
- 순서 기준: AC4 의 "정착이 boundary end 보다 앞" 은 forward/bus spy 의 호출 순서 배열로 관측한다.
- 0건 기준(AC2): 허용 대상 분해 — `background-controller.ts:178` 의 지역변수 `timedOut` 은 제어 응답 확인(D-003)이라 유지 대상이며 술어에서 제외해야 한다 → AC2 검색은 `features/chat/background-controller.ts` 를 `--glob '!**/background-controller.ts'` 로 뺀다. `updater.ts`·`update` 류의 `stall` 부분문자열(`install`)은 `'stall'` 따옴표 술어로 제외된다.

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 명시적 V 없음 → Baseline V.
- 기준 V 상속 근거: 없음.
- `SUPERSEDED`로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §5 긴 실행 무중단 | NEW | — |
| R-02 | R | §5 비사용자 중단 → 턴 종료·스피너 없음 | NEW | — |
| R-03 | R | §5 mail_sync 무상한·취소 가능 | NEW | — |
| R-04 | R | §5 사용자 중단 1회 신호(회귀 방지) | NEW | — |
| R-05 | R | §10 `turn.aborted.reason` 계약·문서 | NEW | — |
| AT-01~AT-06 | AT | §7 | NEW | — |
| SD-01 | SD | §9 TO-BE — coordinator 의 모든 aborted 종료 경로가 renderer terminal 을 정확히 1회 보장 | NEW | — |
| AR-01 | AR | §9·§10 — `chatCancel` ↔ coordinator 중단 확인 플래그, `TurnPersistSink.finalizeTurn` 포트, IPC reason | NEW | — |
| MD-01 | MD | §11 — turn-policy·coordinator·session-state 에서 stall 제거 | NEW | — |
| MD-02 | MD | §11 — mail sync-manager 예산 제거 | NEW | — |
| ST-01 · IT-01 · UT-01 · UT-02 | ST/IT/UT | §7 AC 대응 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `post-turn.ts coordinator.run → runtime.send → frame.iterate → (무이벤트) → telemetry → closeBoundary` | AC1 단언 · AC12① | not selected — AC1 은 직접 행동(abort 여부) 관측 | EP-03 (11자리) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | `abort 발생원 → turn.controller.abort → coordinator 종료 경로 → deliverAbortTerminal → forward(turn.aborted) → chatStore → TURN_END_RESET → StatusLine null` | AC4·AC5·AC7·AC8·AC9 · AC12② | required — 헬퍼 호출 1자리를 지우면 해당 AC 가 red 여야 한다(3자리 각각 제거 변이) | EP-01 (3자리) · EP-02 (2자리) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | `mail/tools.ts:84 sync(signal) → sync-manager.sync → session.top/retr → store.saveMessage` | AC10 | not selected — 결과 코드 직접 관측 | EP-04 (5자리) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `chatCancel 핸들러 → abortAcknowledged=true → sendChatEvent(turn.aborted) → coordinator 종료 → 헬퍼 skip` | AC6 | required — 핸들러의 플래그 설정을 지우면 AC6 이 2건으로 red | EP-02 (2자리) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | `shared/ipc.ts union → coordinator/handler 생산 → 문서` | AC11 | not selected — typecheck 가 직접 판정 | EP-05 (3자리) |
| VP-06 | SD-01 ↔ ST-01 | REQUIRED | VP-02 와 같은 경로를 종료 분기 3종 × terminal 기전달 여부로 | AC4·AC5·AC7 | required — `terminalForwarded` 갱신 1자리를 지우면 AC7 red | EP-01 (3자리) · EP-06 (3자리) |
| VP-07 | AR-01 ↔ IT-01 | REQUIRED | `index.ts chatCancel/discard 핸들러 ↔ coordinator ↔ TurnPersistSink(HistoryWriter)` | AC6·AC9 | not selected — 하네스가 두 생산자를 모두 태워 총량 직접 관측 | EP-02 (2자리) |
| VP-08 | MD-01 ↔ UT-01 | REQUIRED | `turnPolicyFor → coordinator.run` | AC1(양성)·AC2(음성) | required — 음성 게이트(AC2)는 "없다" 만 잠근다. coordinator 에 `setTimeout(()=>abortTurn(...))` 을 다시 넣으면 AC1 이 red 여야 한다 | EP-03 (11자리) |
| VP-09 | MD-02 ↔ UT-02 | REQUIRED | `sync-manager.sync` 내부 | AC10 | not selected | EP-04 (5자리) |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/**` 수정 | `cd app && npm run lint && npm run typecheck` | 현재 변경이 유발한 실패만 blocking |
| 관련 순수 테스트 | 변경 모듈 | `./node_modules/.bin/vitest run src/main/features/chat src/main/app/chat-turn src/main/app/chat-turn.runtime-resilience.test.ts src/main/features/plugins/mail src/renderer/src/features/chat` | 동일. DB 로드 스위트의 ABI 실패는 기준선 분리(`app/AGENTS.md`) |
| 문서 인벤토리 | `docs/**` 수정 | `node app/scripts/check-doc-inventory.mjs --check` | 동일 |
| message-bus | 설계·구현 커밋 | `git log -1 --format='%(trailers:only=true)'` | trailer 파싱 0건이면 blocking |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| stall 은 user·continuation 턴에만 무장, 120초 무이벤트 시 `abortTurn(turn,'stall')` | `features/chat/turn-policy.ts:19-21` · `timers.ts:4,21` |
| 영속 채널 abort 는 `frame.cancel()` 로 예외 없이 끝나 `timedOut` catch 분기에 가지 않는다 | `session-runtime.ts` `markAborted` → `Frame.cancel()`(`:171-176`) · `turn-coordinator.ts:538-553` |
| 정상 반환 경로는 aborted 면 합성 telemetry 를 만들지 않는다 → renderer terminal 0 | `turn-coordinator.ts:538` `!sawTerminal && !aborted` |
| renderer 턴 종료 신호는 `telemetry`·`turn.aborted`·`error` 뿐 | `chatReducer.ts:1057,1196,1205` · `chatStore.ts:727,754,760` |
| 사용자 중단 경로만 settle·finalize·`turn.aborted` 를 보낸다 | `app/chat-turn/index.ts:174-192` |
| `finalizeTurn` 은 `HistoryWriter` 공개 메서드지만 `TurnPersistSink` 에 없다 | `history/writer.ts:196` · `chat/turn-sinks.ts:18-34` |
| renderer 는 `turn.aborted.reason` 을 읽지 않는다 | `rg "\.reason" chatStore.ts chatReducer.ts` → 0건 |
| mail_sync 는 사용자 중단 신호로 취소된다 | `session-runtime.ts:110-114` `interrupt()` → `mail/tools.ts:84` `sync(context?.getSignal())` → `sync-manager.ts:77` |
| Bash 초과 시 자동 백그라운드, MCP 도구 기본 무제한 | SDK 0.3.267 `sdk-tools.d.ts` `timedOutAfterMs` · `sdk.d.ts:507-509` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| turn controller abort 발생원(프로덕션) | `rg -n "controller\.abort\(\)\|abortTurn\(\|markAborted\(" app/src/main --glob '!**/*.test.ts'` 중 턴 관련 | 8 | stall(`timers.ts:21`, 삭제) · chatCancel(`index.ts:180`, 사용자) · discard(`index.ts:142`) · 승인 거부+중단(`approvals/coordinator.ts:79`) · lease 중단 전파(`send.ts:266`) · owner 소멸(`send.ts:416-417`) · shutdown(`bootstrap.ts:882`) · lease 닫기(`supervisor.ts:181-182,282,293`·`session-chain-lease.ts:148` → `send.ts:266` 경유) |
| 그중 renderer terminal 을 스스로 보내는 곳 | 위 목록에서 `turn.aborted` 송신 동반 | 1 | chatCancel 만. 나머지 7(stall 제외 6)은 coordinator 가 보장해야 함 |
| `turn.aborted` 생산자 | `rg -n "type: 'turn.aborted'" app/src/main --glob '!**/*.test.ts'` | 1 | `chat-turn/index.ts:188` |
| stall 제거 자리 | §10 EP-03 | 11 | 아래 표 |
| `syncMs` 사용처 | `rg -n "syncMs" app/src` | 3 | `types.ts:9` · `sync-manager.ts:76` · `mail.integration.test.ts:373-374`(테스트) |
| `'timeout'` reason 생산자 | `rg -n "reason: 'timeout'" app/src` | 0 | D-008 근거 |

### 수치 / 전칭 표현 검산

- 재측정 수치: stall 참조 프로덕션 파일 = `turn-policy`·`timers`·`turn-coordinator`·`abort`(주석)·`session-state`·`ports`·`session-runtime`·`approval`·`send`·`index`(주석) 10파일.
- "유일한" 반례 검색: "renderer 종료 신호는 3종뿐" — `rg -c '\.\.\.TURN_END_RESET' chatReducer.ts` → 4곳, 그중 `CANCEL_CHAT`(로컬 액션) 제외 시 이벤트 3종.
- 기존 테스트 케이스 존재 확인: `turn-coordinator.test.ts:1241` · `chat-turn.runtime-resilience.test.ts:12,26,42,56,74,96,114` · `timers.test.ts:5` 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, AR-01.
- 현재 책임 소유자: 실행 상한 = `createStallTimer`(coordinator attempt 마다). 중단 terminal = `chatCancel` 핸들러 단독.
- 흐름: `stall 120s → abortTurn → markAborted('stall') → frame.cancel() → for-await 정상 종료 → closeBoundary(aborted) → return` — renderer 는 boundary end 만 받고 terminal 없음.

```text
timers.ts setTimeout(120s)
  → abort.ts abortTurn → SessionRuntime.markAborted → Frame.cancel
  → TurnCoordinator.run 정상 반환 (aborted, 합성 telemetry 생략)
  → bus: response.boundary{end, aborted}   ← '응답 중단' 라벨
  → renderer inflight/turnStartedAt 유지   ← 스피너 고착
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01, AR-01.
- 변경 후 책임 소유자: 실행 상한 없음. 중단 terminal = coordinator 가 **모든 aborted 종료 경로**에서 보장, `chatCancel` 은 즉시 보내고 확인 플래그로 중복을 막는다.

```text
[임의 abort 발생원] → turn.controller.abort (+ markAborted 가능)
  → TurnCoordinator.run 종료 분기 3종
      └ aborted && !terminalForwarded && !turn.abortAcknowledged
          → deliverAbortTerminal: settleOpenToolRuns(aborted) → persist.finalizeTurn
                                   → forward turn.aborted{interrupted} → abortAcknowledged=true
  → closeBoundary(aborted)
  → renderer TURN_END_RESET → StatusLine null, '응답 중단' 라벨
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | stall 타이머가 턴을 끊음 | 삭제 | D-001 | MD-01 / VP-08 · `timers.ts` 삭제 |
| data/control flow | 비사용자 abort → terminal 0 | 3개 종료 분기에서 헬퍼 1회 | D-006 | SD-01 / VP-06 · AC4·AC5 |
| state/contract | `TurnContext` 에 중단 확인 없음, `reason: user_cancelled\|timeout` | `abortAcknowledged?`, `reason: user_cancelled\|interrupted` | 중복 방지·정확한 표기 | AR-01 / VP-04·VP-05 |
| error/lifecycle | 승인 대기 중 stall pause refcount | pause 배선 삭제(멈출 타이머가 없음) | D-001 | MD-01 / VP-08 · `approval.ts` |
| mail | 120초 예산 → `timeout` | 예산 없음, 신호 abort → `cancelled` | D-002 | MD-02 / VP-09 |
| test seam | stall fake-timer 테스트 | 장시간 무이벤트 비중단 테스트 + 종료 분기 테스트 | — | UT-01 / AC1·AC4 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `features/chat/turn-coordinator.ts` (L1) | 종료 분기에서 terminal 보장 | turn·persist·forward → `turn.aborted` | `app/chat-turn/post-turn.ts` |
| `features/chat/turn-sinks.ts` | `finalizeTurn?` 포트 선언 | — | coordinator. `HistoryWriter` 가 구조적으로 만족 |
| `contracts/turn.ts` | `abortAcknowledged?: boolean` | — | coordinator(읽기·쓰기) · `chat-turn/index.ts`(쓰기) |
| `app/chat-turn/index.ts` (컴포지션 루트) | 사용자 중단 즉시 신호 + 플래그 | — | IPC |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| SD-01 / VP-02·VP-06 · **EP-01** | aborted 종료 시 terminal 1회 | `turn-coordinator.ts` 헬퍼 `deliverAbortTerminal` | coordinator | 3자리: ① for-await 정상 종료 후 `closeBoundary()` 직전(`:550` 부근) ② catch `runtime.cancelled && aborted`(`:555`) ③ retry backoff abort catch(`:598`) | 자리 하나라도 빠지면 그 분기로 끝난 턴의 스피너가 고착 |
| AR-01 / VP-04·VP-07 · **EP-02** | 중복 금지 | `TurnContext.abortAcknowledged` | 쓰기: `chat-turn/index.ts` chatCancel(sendChatEvent 전) · 헬퍼(송신 후) / 읽기: 헬퍼 | 2자리(쓰기 2 — 핸들러·헬퍼, 읽기는 헬퍼 내부) | 누락 시 사용자 중단에 `turn.aborted` 2건 → 다음 턴 스피너 조기 소거 가능 |
| MD-01 / VP-01·VP-08 · **EP-03** | 실행 상한 없음 | 없음(삭제) | 구현자 | 11자리: `timers.ts`(파일 삭제) · `turn-policy.ts` `armStall` 필드·user·continuation 값 · `turn-coordinator.ts` `NOOP_STALL_TIMER`·`activeStall`·`beginApprovalPause`·`createStallTimer` 사용·`timedOut` 분기 · `approval.ts` `beginApprovalPause` dep·호출 · `send.ts:446` 배선 · `session-state.ts` `'stall'`·`timedOut` · `ports.ts` `markAborted` cause·`timedOut` · `session-runtime.ts` `timedOut` getter + 3 사용처(`:449,530,546` → `cancelled` 만) · 주석(`abort.ts:7`·`index.ts:3`) | 한 자리라도 남으면 AC2 red. 동작 잔존이면 AC1 red |
| MD-02 / VP-03·VP-09 · **EP-04** | mail 실행 상한 없음 | `sync-manager.ts` | 구현자 | 5자리: `budget` 생성·`setTimeout`(`:75-77`) · 루프 내 `budget.signal.aborted` 판정(`:140`) · catch 판정(`:180-181`) · `clearTimeout`(`:198`) · `types.ts:9` `syncMs` | 남으면 AC10 red(121초 케이스) |
| AR-01 / VP-05 · **EP-05** | `turn.aborted.reason` | `shared/ipc.ts:732` | 구현자 | 3자리: `shared/ipc.ts` union · `IPC_CONTRACT.md:528` 행 · `IPC_CONTRACT.md:499,527` idle timeout 서술 | 불일치 시 AC11 red |
| SD-01 / VP-06 · **EP-06** | `terminalForwarded` 갱신 | coordinator run-스코프 변수 | coordinator | 3자리: 스트림 `telemetry`·`error`·`turn.aborted` 이벤트 emit 시 · 합성 telemetry emit(`:545`) · `forward(error)` 2곳(`:615` 및 제거되는 stall 분기 제외) | 누락 시 이미 끝난 턴에 `turn.aborted` 추가 송신(AC7 red) |

- 같은 규칙이 여러 레이어에: 중단 terminal 규칙의 SSOT 는 coordinator 헬퍼. `chatCancel` 은 즉시성 때문에 직접 보내되 플래그로 헬퍼에 양보한다.
- 선택적 필드: `abortAcknowledged` `undefined`=미확인(헬퍼가 보냄), `true`=이미 보냄. `false` 는 쓰지 않는다.
- `실패 의미`에 다른 게이트 인용: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/chat/timers.ts` (+`.test.ts`) | — | 삭제 | — |
| `features/chat/turn-policy.ts` | 턴 종류 정책 | `armStall` 필드 제거 | 순수 단위 |
| `features/chat/turn-coordinator.ts` | 가로축 | stall 전부 제거, `terminalForwarded` 변수, `deliverAbortTerminal` 헬퍼, EP-01 3자리 호출 | fake runtime 단위 |
| `features/chat/turn-sinks.ts` | 포트 | `finalizeTurn?(turn)` 추가 | 타입 |
| `contracts/turn.ts` | 계약 | `abortAcknowledged?: boolean` | 타입 |
| `contracts/session-state.ts` · `contracts/ports.ts` | 계약 | `'stall'`·`timedOut` 제거 | 기존 단위 수정 |
| `features/sessions/session-runtime.ts` | 런타임 | `timedOut` 제거, 조건을 `!this.cancelled` 로 | 기존 단위 |
| `app/chat-turn/approval.ts` · `send.ts` | 배선 | `beginApprovalPause` 제거 | 기존 approval 테스트 수정 |
| `app/chat-turn/index.ts` | 핸들러 | chatCancel 에서 `turn.abortAcknowledged = true` 를 `sendChatEvent` 전에 설정 | 핸들러 하네스 |
| `shared/ipc.ts` | IPC 계약 | reason union 변경 | typecheck |
| `features/plugins/mail/sync-manager.ts` · `types.ts` | mail | 예산 제거, catch 판정 `operationSignal.aborted ? cancelled : error` | 단위 |
| `app/deployment/mail.integration.test.ts` | 테스트 | `syncMs` 케이스를 신호 abort 케이스로 대체 | — |
| 테스트 | — | `chat-turn.runtime-resilience.test.ts` stall 6케이스 삭제, `turn-coordinator.test.ts` stall 참조를 리터럴·신규 AC 케이스로 | — |
| `docs/IPC_CONTRACT.md` · `docs/arch/backend/runtime-ipc.md:23,45,49,86` · `docs/arch/backend/provider-runtime.md:91` | 문서 | stall·idle timeout 서술 제거, reason 갱신 | AC11 |

### 테스트 가능성

- electron 의존 분리: coordinator·sync-manager 는 이미 순수 단위 테스트 대상(electron import 없음).
- 순서 관측: bus·forward spy 를 한 배열에 push 해 `tool.call.completed` → `turn.aborted` → `response.boundary end` 순서를 단언.

## 12. End-to-end 영향

```text
abort 발생원 → TurnCoordinator(deliverAbortTerminal) → forward sendChatEvent → chatStore.turn.aborted → chatReducer TURN_END_RESET → PendingAssistantStatus/StatusLine
                                        └→ bus tool.call.completed → HistoryWriter(persist) · relay
```

- producer 기준: `turn.aborted` 는 "이 턴에서 renderer 가 받을 마지막 terminal" 이다.
- consumer 파생 규칙: renderer 는 reason 무관하게 동일 처리(기존).

| 기존 소비처 | 값 변경 시 영향 | 회귀 AC |
|---|---|---|
| `useSessionCompletion` — `turn.aborted` 는 완료 통지 대상 아님(`useSessionCompletion.test.ts:51` 케이스) | reason 값 무관 | AC8 |
| `chatStore` `releaseNewChatGate` | 비사용자 중단에도 게이트 해제 — 의도 | AC8 |

## 13. Lifecycle / 오류 / 정리

- 취소/중단: 사용자 = 기존 + 플래그. 비사용자 = coordinator 헬퍼.
- 종료/quit/renderer-gone: shutdown·owner 소멸도 헬퍼를 타지만 `sendChatEvent` 가 `isDestroyed` 면 무시(`infra/ipc/send.ts:30`) — 무해. shutdown 은 `bootstrap.ts:881` 이 먼저 정착하므로 헬퍼의 정착은 no-op(열린 도구 0).
- retry/timeout: retry backoff 중 abort 도 EP-01 ③.
- **다중 저장소 쓰기**: 헬퍼는 DB(정착 tool_result·finalize) → IPC 순. DB 실패 시 `settleEmit` 이 격리·로그(`turn-coordinator.ts:137-149`)하고 IPC 는 계속 → 화면은 종료, DB 는 재시작 시 `rebuildIncompleteMessageContent` 복구(기존). 허용.
- 문서 사본: 판정 상태는 이 `plan.md` 와 `INDEX.md` 두 곳 — 둘을 같은 커밋에서 갱신.

## 14. 성능 / 상한 / 최적화

- 새 출력: 턴당 `turn.aborted` 최대 1건(플래그).
- mail_sync 상한 제거의 최악: 사서함 전체 순회(0237 verify §636 관측: 날짜 혼재 시 전체 훑기 가능). 사용자 중단으로 회수 가능.

## 15. 외부 구현 포트 / 문서 계약

- 외부/배포가 구현할 port: `MailTimeouts`(배포 선언이 넘길 수 있는 설정). `syncMs` 제거는 배포 TS 가 넘기면 typecheck 오류로 드러난다 — 현재 저장소 내 배포 선언의 `syncMs` 사용 0건(`rg syncMs app/src/main/app/deployment --glob '!*.test.ts'`).
- semantics: `turn.aborted.reason` 은 renderer 미사용이라 의미 변경 영향 0.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| listen 턴 stall 미무장 | 0136·0143, `turn-policy.ts:21` | §11 `armStall` 제거 | 유지(모든 턴이 미무장으로 일반화) |
| 승인 중 auto-deny 금지, stall pause | `approvals/coordinator.ts:42-43` | §11 pause 배선 제거 | 유지(auto-deny 금지) / pause 는 대상 소멸로 삭제 |
| "무응답 idle timeout 은 `error(stream_error)`" | `IPC_CONTRACT.md:499,527` | §11 문서 제거 | 변경(D-001) |
| 0237 D-063(OPEN) `syncMs` 초과 반환 형상 | `0237/plan.md:1695` | §4·D-002 | 대상 소멸 — 0237 문서는 수정하지 않음 |
| 사용자 중단 정착 | 0239 foreground-cancel-settlement | §10 EP-02 | 유지(AC6 이 회귀 잠금) |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 진짜 멈춘 도구·CLI 는 자동 회수되지 않는다 | 사용자 중단 버튼(기존 경로)로 회수. 사용자 수용(진단 턴) |
| PowerShell 규칙 미확인 | AC12 실기 기록(D-009) |
| 정착 문구가 비사용자 중단에도 "사용자가 중단했습니다" | 비범위(§6). 표시 라벨은 '응답 중단' |

- 되돌리기 어려운 결정: `turn.aborted.reason` 값(D-008) — renderer 미사용이라 비용 낮음.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/features/chat/{timers.ts,timers.test.ts,turn-policy.ts,turn-coordinator.ts,turn-coordinator.test.ts,turn-sinks.ts,abort.ts}`
- `app/src/main/contracts/{turn.ts,session-state.ts,session-state.test.ts,ports.ts}`
- `app/src/main/features/sessions/{session-runtime.ts,session-runtime.test.ts}`
- `app/src/main/app/chat-turn/{index.ts,approval.ts,send.ts}` + approval·send 테스트 · `app/src/main/app/chat-turn.runtime-resilience.test.ts`
- `app/src/main/features/plugins/mail/{sync-manager.ts,types.ts}` · `app/src/main/app/deployment/mail.integration.test.ts`
- `app/src/shared/ipc.ts` · renderer reducer 테스트(AC8)
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/runtime-ipc.md` · `docs/arch/backend/provider-runtime.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`, `app/src/main/AGENTS.md`.
- ABI/네트워크: 이 환경은 electron 다운로드 403 가능 — `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-A 운영 gate 의 vitest 명령. `mail.integration.test.ts` 가 DB 로드면 ABI 기준선으로 분리 보고.
- 사람 실기: AC12.

## READY self-review

- [x] Decision Ledger 가 결정 9건을 보존한다 — D-001~D-009.
- [x] Part I 만으로 완료 상태를 설명한다 — §1·§5.
- [x] 조건절 원문 인용 — §2 사용자 문장 4건 원문.
- [x] Product/UX 핵심 동작 ↔ AC ↔ Technical Design — §5 표 6행 → AC1·AC6·AC4·AC7·AC10 → §9 TO-BE.
- [x] AS-IS·TO-BE 같은 축 — §9 Delta 6행.
- [x] Delta 각 행 → 파일/AC — §9 표 마지막 열.
- [x] AS-IS 에서 사라진 책임 — stall(삭제), pause 배선(삭제), mail 예산(삭제).
- [x] 수치·전칭 실측 — §8 전수 조사 6행.
- [x] AC 마다 행동 단언·검증·경로 — §7.
- [x] Baseline V — §7-A.
- [x] NEW node 마다 같은 레벨 REQUIRED pair — R-01~05·SD-01·AR-01·MD-01·02 → VP-01~09.
- [x] INHERITED 없음(Baseline).
- [x] pair 경로·§10 자리·oracle, 적대 증거 선택 이유 — VP-02·04·06·08.
- [x] 운영 gate 열거 — §7-A 4행.
- [x] 순수 로직을 사람 실기로 미루지 않음 — AC12 는 CLI 바이너리·UI 만.
- [x] 음성 게이트 AC2 는 양성 AC1 과 짝, 변이 VP-08.
- [x] 신규 계약 SSOT·강제 지점·seam — §10 EP-01~06.
- [x] 기존 소비처 — §12 표.
- [x] 상한 계산 — §14.
- [x] 게이트 명령이 `app/AGENTS.md` 와 일치 — §19.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과 §3 갱신 메모에 기록.
- [x] 문장 규칙 — 표 한 칸 3줄 이내 확인.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| … | … | … | … | … | … |

- §10에 없는데 같은 불변식이 필요했던 지점: …

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| … | … | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | … | … | … |

- **분모 검산**: …
- **덮개 회귀**: …

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님) | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

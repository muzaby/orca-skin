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
| 상태 | verify/PASS (r1) |
| V mode | `Delta V` |
| 기준 V | `V1@d24c13f8` (공유 브랜치에서 확인) |
| 이번 V revision | `ΔV1` — 구현 전 검토 보완 |
| 유효 V | `V1 + ΔV1` (아래 대체 행 우선) |

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

## ΔV1 — 중단 전달·저장 실패·검증 경로 정정

READY. 사용자 `handoff-impl` 요청에 따라 사전 검토의 누락을 구현 전에 닫는다. V1의 D-001~D-009와 제품 범위는 유지하며, 아래 행이 지목한 V1 규범 행만 대체한다.

### 근거와 결정 승계

| 발견 | 코드 관측 | 정정 |
|---|---|---|
| controller abort만으로 프레임이 닫히지 않음 | `SessionRuntime.wrapRequest`는 채널 signal을 사용하고 `consumeFrame`은 frame만 기다린다. 사전 프로브에서 controller abort 뒤 run 미완료, markAborted 뒤 완료 | coordinator가 run 동안 abort를 runtime에 전달하고 종료 후 구독을 제거 |
| finalize는 settleEmit 격리 밖 | `HistoryWriter.finalizeTurn`의 DB throw가 호출자까지 전파됨 | helper에서 finalize 오류를 별도 격리하고 terminal 전달을 계속 |
| 문서 음성 게이트의 오검출·누락 | `rg -i stall` 34행 중 단어 stall은 6행, 나머지는 install 등. `persistence.md:115`도 삭제 대상 | 단어 경계·idle timeout 술어로 정정, persistence 문서 포함 |
| 인벤토리 실행 cwd | 저장소 루트 실행은 `src/shared/ipc.ts` ENOENT, app 실행은 통과 | `cd app` 후 `node scripts/check-doc-inventory.mjs --check` |

- ACTIVE 결정 ↔ AC 대조: 충돌 0. D-006·D-007은 아래 AC3·AC13으로 누락 경로를 보완하고 D-001~D-005·D-008·D-009는 승계한다.
- 새 제품 결정은 없다. `AbortCause` 내부의 `user_cancelled`는 기존 런타임 중단 수단으로 재사용하며, 사용자에게 보내는 reason은 D-008의 `interrupted`다.
- V1 §13의 "settleEmit이 finalize 오류까지 격리" 주장은 폐기한다. UI는 기존 §5의 비사용자 중단 행으로 종료하고 실패한 DB 기록은 기존 부팅 복구 대상이다.

### AC 정정 및 추가

| AC | 대체 관계 | 행동·oracle | production path |
|---|---|---|---|
| AC3 | 신규 (V1에 AC3 행 없음) | 실제 SessionRuntime+coordinator에 무출력 채널을 연결하고 controller만 abort → runtime interrupt·run resolve·interrupted 1건. run 이전 abort는 send 0건, run 종료 후 abort는 runtime 추가 중단 0건 | controller → run abort listener → markAborted → frame.cancel → terminal |
| AC5 | V1 AC5 대체 | stream throw 시 controller가 aborted면 runtime.cancelled 값과 무관하게 interrupted 1건·error 0건. retry backoff abort도 동일; 기존 AC4의 정착·마감·boundary 순서를 승계 | catch abort 분기·backoff catch |
| AC11 | V1 AC11의 검색 oracle 대체 | reason union은 기존 행동 유지. `rg -n -i '\bstall\b|idle timeout' docs/arch docs/IPC_CONTRACT.md` 0행; 설치 관련 서술은 유지 | shared/ipc → 문서 4개(IPC·runtime-ipc·provider-runtime·persistence) |
| AC13 | 신규 | finalize throw를 주입해도 helper가 interrupted 1건·boundary aborted를 전달하고 run이 resolve, 오류 UI 이벤트 0건. 열린 tool 정착은 finalize 시도보다 먼저 | settleEmit → finalize 격리 → forward → boundary |

유효 AC는 1~13의 13행이다. AC12는 사람 실기로 유지하며 나머지는 기계 검증한다. V1 AC4는 frame 종료를 주입하는 단위 oracle로 유지하고 AC3가 실제 중단 배선을 별도로 잠근다.

### Delta V와 강제 지점

| Node | provenance | 변경 / 승계 |
|---|---|---|
| R-02·R-05 | INHERITED | D-006~D-008 사용자 결과·문서 일치 |
| SD-01·AR-01 | CHANGED | abort 전달·listener 수명·finalize 실패 격리 추가 |
| MD-01·MD-02·R-01·R-03·R-04 | INHERITED | V1 계약 유지 |

| Pair | V1 대체 관계 / requiredness | path·직접 oracle | 강제 지점 / 선택 적대 증거 |
|---|---|---|---|
| VP-02 | V1 VP-02 대체 / REGRESSION | 기존 경로 + abort listener, AC3~AC5·AC7~AC9·AC13·AC12② | EP-01·02·07·08. 기존 helper 호출 삭제 3자리 유지 |
| VP-05 | V1 VP-05 대체 / REGRESSION | 기존 reason·문서 경로, 정정 AC11 | EP-05, 기존 not selected 유지 |
| VP-06 | V1 VP-06 대체 / REQUIRED (SD-01↔ST-01) | 종료 3분기 + 사전 abort·DB 실패, AC3~AC5·AC7·AC13 | EP-01·06·07·08. stream terminal flag 삭제 변이 유지 |
| VP-07 | V1 VP-07 대체 / REQUIRED (AR-01↔IT-01) | controller·실제 runtime·IPC handler·persist 연결, AC3·AC6·AC9·AC13 | EP-02·07·08. 직접 행동 oracle, not selected 유지 |

나머지 VP-01·03·04·08·09는 V1의 REQUIRED·oracle·등록 변이를 그대로 실행한다. VP-02의 helper 삭제 3자리, VP-04의 handler flag 삭제, VP-06의 stream flag 삭제, VP-08의 120초 abort 재삽입 = 등록 변이 6개이며 폐기된 변이는 없다.

| EP | V1 대체 관계 | 실제 자리·강제 의미 |
|---|---|---|
| EP-01 | 기존 3자리 유지, catch 조건 정정 | 정상 for-await 종료·controller aborted catch·backoff abort catch에서 helper 호출. runtime.cancelled가 false여도 abort 의미 우선 |
| EP-03 | V1의 파일/심볼 묶음 11을 자리 수로 간주하지 않음 | 삭제 inventory는 §11 파일 목록과 `rg`의 실제 심볼·사용처를 비교해 구현 보고에서 열거. policy의 listen 값, getter 본문과 주석도 포함 |
| EP-05 | 문서 범위 보완 | reason union 1·IPC reason 행 1·IPC idle timeout 2·runtime-ipc stall 4·provider-runtime stall 1·persistence stall 1 = 10자리 |
| EP-06 | V1의 모호한 forward(error) 2곳 정정 | 성공한 stream terminal emit 뒤 1·합성 telemetry emit 뒤 1·generic error forward 뒤 1 = 3자리. 제거할 stall catch는 새 갱신 자리가 아님 |
| EP-07 | 신규 | run 구독 등록 1·pre-aborted 판정 1·runtime.markAborted 전달 1·finally 구독 해제 1 = 4자리. pre-aborted는 send 없이 helper로 종료 |
| EP-08 | 신규 | helper의 finalize try/catch 1. DB 오류는 로그만 남기며 이어지는 terminal 송신을 막지 않음 |

### 기술 보완·gate

- coordinator의 abort listener는 run 수명에 묶는다. 이미 runtime.cancelled면 markAborted를 반복하지 않으며, chatCancel은 기존 abortTurn 다음 동기 흐름에서 ack를 세워 helper와 중복하지 않는다.
- terminalForwarded는 emit/forward가 성공한 뒤 기록한다. abort helper는 정착 → finalize 시도 → interrupted 송신 → ack 순이며, finalize 실패만 독립 격리한다.
- V1 §11/§18 문서 목록에 `docs/arch/backend/persistence.md`를 추가한다. AC2의 background-controller 예외와 접속·probe 보존은 그대로다.
- 운영 gate는 V1을 승계하되 문서 검사는 app cwd로 정정한다. 실제 runtime/handler integration과 mail integration을 관련 테스트에 포함하고 DB ABI 실패는 별도 보고한다.
- READY 검산: 변경 SD-01·AR-01은 REQUIRED VP-06·07, 상위 R-02·R-05는 REGRESSION VP-02·05로 연결. 각 추가 AC는 EP-07·08 또는 정정 EP-05에 도달하며 기존 등록 변이 6개를 전부 승계한다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D-001~D-009를 보존했다. 실행 상한을 제거하고, 접속·명령 응답·제어 확인 타이머와 CLI 자체 동작을 유지했다.
- 이견 / 현실성 문제: 사전 조사에서 발견한 실제 runtime 중단 배선·finalize 실패 격리·문서 검색 범위는 위 ΔV1 설계 커밋으로 먼저 정정했다. 구현 기준은 V1+ΔV1이다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. AC12의 실제 CLI·Windows UI 관측은 기계 테스트로 대체하지 않았다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-02·06 | EP-01 aborted 종료 | 정상 반환·aborted catch·backoff catch 3 | `turn-coordinator.ts:566,573,598` | `rg -n deliverAbortTerminal app/src/main/features/chat/turn-coordinator.ts`: 정의·위 3곳·pre-abort 1곳. M1~M3 각각 2·1·1케이스 red | 없음 |
| VP-04·07 | EP-02 ack | handler·helper 쓰기 2 | `index.ts:187`, `turn-coordinator.ts:301`; helper 읽기 `:283` | 실제 IPC cancel 테스트: terminal 1·finalize 1·interrupt 1. M4에서 terminal 중복으로 1케이스 red | 없음 |
| VP-01·08 | EP-03 실행 상한 제거 | ΔV1 삭제 inventory | 아래 10파일·47검색행 + generic idle reset 2·clear 1 제거 | [삭제 inventory](evidence/r1-removal-inventory.json)의 기준선 집합을 현재 같은 술어와 대조: 잔여 `[]`. M6에서 장시간 실행 3종 등 4케이스 red | D-003 `background-controller` 지역변수 `timedOut`은 유지 |
| VP-03·09 | EP-04 mail 예산 | 생성·루프·catch·clear·타입 5묶음 | `sync-manager.ts:75,137,177` 호출자 signal; timer/clear 삭제, `types.ts` syncMs 삭제 | `rg -n 'syncMs|budget|setTimeout|clearTimeout'` 두 파일 0행. 실제 POP3 경로에서 151초 후 synced·3건 저장, 호출자 abort cancelled, 연결/명령 timeout | 없음 |
| VP-05 | EP-05 공개 계약·문서 | ΔV1 10자리 | IPC union 1·IPC 문서 3·runtime-ipc 4·provider-runtime 1·persistence 1 | `shared/ipc.ts:733` 및 IPC 문서 reason 행 일치. ΔV1 AC11 검색 0행, O2 주입 시 1행 | 없음 |
| VP-06 | EP-06 terminal 성공 기록 | stream·합성 telemetry·generic error 3 | `turn-coordinator.ts:463,561,620` | `rg -n terminalForwarded`에서 초기값·guard·helper ack와 별도로 3곳 확인. AC7 telemetry/error 뒤 추가 terminal 0, M5 2케이스 red | 없음 |
| VP-02·06·07 | EP-07 runtime 전달 수명 | 등록·사전 abort·mark·해제 4 | `turn-coordinator.ts:306~314,626` | 실제 SessionRuntime controller/chain abort 모두 run 종료·interrupt 1. 사전 abort send 0, 완료 후 abort mark 0 | 없음 |
| VP-02·06·07 | EP-08 저장 실패 격리 | finalize try/catch 1 | `turn-coordinator.ts:290~295` | 단위 finalize-failure + 실제 runtime DB-failure: tool 정착 후 finalize 시도, interrupted 1·boundary aborted·error 0 | 없음 |

EP-03 검색행은 의미상 강제 지점 수와 구분한다. [`r1-removal-inventory.json`](evidence/r1-removal-inventory.json)에 원문 행과 술어를 보존했다.

| 기준선 파일 (`app/src/main/` 기준) | 검색행 | 제거한 책임 |
|---|---:|---|
| `app/chat-turn/approval.ts` | 4 | pause dep·호출·관련 주석, release finally |
| `app/chat-turn/index.ts` | 1 | stall 헤더 주석 |
| `app/chat-turn/send.ts` | 1 | pause 배선 |
| `contracts/ports.ts` | 3 | stall 원인·timedOut 포트·주석 |
| `contracts/session-state.ts` | 3 | stall 원인·timedOut getter |
| `features/chat/abort.ts` | 1 | 삭제된 타이머 관련 주석 |
| `features/chat/timers.ts` | 4 | 타이머 파일 전체 |
| `features/chat/turn-coordinator.ts` | 18 | import·NOOP·activeStall·pause·생성·timedOut 분기·주석. generic idle reset 2·clear 1도 삭제 |
| `features/chat/turn-policy.ts` | 6 | armStall 필드·user/continuation/listen 값·주석 |
| `features/sessions/session-runtime.ts` | 6 | timedOut getter·판정 3곳·주석 |

- §10에 없는데 같은 불변식이 필요했던 지점: `abortTurn`의 중복 mark 방지 1곳(`abort.ts:15`). chatCancel은 cancelChain → controller listener → abortTurn 순이므로 마지막 mark가 중복됐다. `abort.test.ts` 4케이스와 실제 IPC cancel의 interrupt 1회 단언으로 닫았다.
- 별도 주석 정리: `features/approvals/coordinator.ts`의 idle pause 서술도 타이머 삭제와 함께 제거했다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED | AC1의 30분 무출력 3종·승인 대기 통과. AC12① 실제 Bash/PowerShell 실기 대기 | not selected — 직접 oracle |
| VP-02 | REGRESSION | SELF_BLOCKED | AC3~5·7~9·13 기계 경로 통과. AC12② 실제 폐기 UI 실기 대기 | M1~M3 전부 red |
| VP-03 | REQUIRED | SELF_PASS | AC10 느린 동기화·취소·연결/명령 timeout 4케이스 통과 | not selected — 직접 oracle |
| VP-04 | REQUIRED | SELF_PASS | 실제 chatCancel에서 user_cancelled 1건 | M4 red |
| VP-05 | REGRESSION | SELF_PASS | reason union·문서 일치, 단어 경계 검색 0행, typecheck 3구성 통과 | not selected; 문서 음성 oracle O2 감도 확인 |
| VP-06 | REQUIRED | SELF_PASS | 종료 3분기·사전 abort·listener 해제·기전달 terminal·DB throw 통과 | M5 red |
| VP-07 | REQUIRED | SELF_PASS | 실제 runtime과 IPC cancel/discard/controller/chain/DB-failure 5케이스 통과 | not selected — 직접 oracle |
| VP-08 | REQUIRED | SELF_PASS | 실행 상한 검색 0행·30분 무출력 비중단 통과 | M6 red, 소스 음성 oracle O1 감도 확인 |
| VP-09 | REQUIRED | SELF_PASS | 실제 POP3 명령 타이머를 사용하는 mail 단위 4케이스·기존 통합 28케이스 통과 | not selected — 직접 oracle |

자기확인 합계: SELF_PASS 7 · SELF_BLOCKED 2 = 9 pair. BLOCKED의 사유는 AC12 사람 실기이며 PLAN_GAP이나 기계 gate 실패가 아니다.

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 정상 반환 helper 삭제 | VP-02 등록 | 최초 구현 | AC4/5/13 return·finalize-failure / 2 | red |
| M2 aborted catch helper 삭제 | VP-02 등록 | 최초 구현 | AC4/5/13 throw / 1 | red |
| M3 backoff catch helper 삭제 | VP-02 등록 | 최초 구현 | AC5 abort during retry backoff / 1 | red |
| M4 handler ack 삭제 | VP-04 등록 | 최초 구현 | 실제 IPC cancel closes the active response exactly once / 1 | red |
| M5 stream terminal flag 삭제 | VP-06 등록 | 최초 구현 | AC7 forwarded telemetry·error / 2 | red |
| M6 실행 120초 abort 재삽입 | VP-08 등록 | 최초 구현 | AC1 user·continuation·listen 및 완료된 listen 수명 / 4 | red |
| O1 소스에 금지 토큰 재삽입 | AC2 음성 oracle 감도 | 신규 oracle 확인 | 동일 rg: 정상 0행 → 주입 1행 | 검출 |
| O2 현재 문서에 idle timeout 재삽입 | AC11 음성 oracle 감도 | 신규 oracle 확인 | 동일 rg: 정상 0행 → 주입 1행 | 검출 |

- **분모 검산**: 선택 증거 6 · 인용 변이 0 · 새 음성 oracle 감도 2 = 표 8행. 직접 행동 oracle에는 추가 proxy 변이를 만들지 않았다.
- **덮개 회귀**: 최초 구현이라 이전 verify의 red 변이는 없다. 삭제한 stall 동작 테스트는 D-001에 따라 30분 무중단 행동으로 대체했고 실행 제한 재삽입 M6을 검출했다.
- 재현: 루트에서 `python docs/handoff/0243-execution-timer-removal/evidence/r1-mutations.py`. 각 변이 후 원본 bytes 복구, 마지막 원복 스위트 74+21=95케이스 통과. [상세 결과](evidence/r1-mutations.json).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 새 문구 없음. interrupted를 chatStore→chatReducer가 소비하고 TURN_END_RESET 적용. 기존 ko `chat.agent.aborted`의 '응답 중단' 사용 | AC8 reducer·실제 StatusLine 렌더 테스트 통과 |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 테스트 전용 production 재배치 없음. 새 abort listener는 run의 바깥 try/finally로 모든 반환에서 해제 | AC3 완료 후 abort의 mark 0회 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | finalize 실패를 포함해 §5 '비사용자 중단, terminal 미전달' 행으로 종료 | ΔV1 AC13: error 0·interrupted 1 |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | interrupted 후 inflight=false·turnStartedAt=null·오류 없음·StatusLine 마크업 빈 문자열 | 실제 클릭·시각 결과는 AC12 대기 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 같은 run의 기전달 terminal/ack로 추가 종료를 막고 listener를 해제 | AC6·7·3 및 M4·M5 검출. 다른 턴으로의 이벤트 라우팅은 기존 규칙 유지 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | controller.abort만으로 실제 SessionRuntime 프레임이 안 닫힘 | ΔV1에 올린 뒤 run 수명 listener 구현 | 실제 runtime controller·chain 케이스 각각 interrupt 1·run 종료 |
| 2 | HistoryWriter.finalizeTurn throw가 terminal 송신을 막음 | ΔV1에 올린 뒤 helper의 finalize만 격리 | 단위·통합 DB-failure 케이스에서 terminal 1·error 0 |
| 3 | chatCancel의 cancelChain과 abortTurn이 같은 runtime을 두 번 중단 | abortTurn에서 이미 cancelled면 mark 생략 | 수정 전 실제 cancel 테스트 interrupt 2회 실패, 수정 후 1회 통과 |
| 4 | 비사용자 도구 정착도 '사용자가 중단했습니다'를 표시 | D-006 범위의 종료 처리는 구현. 세부 정착 문구는 §6 비범위 그대로 기록 | `settle.ts` 문구 변경 없음; 후속 제품 결정 대상 |
| 5 | coordinator 진입 전 준비 단계의 비사용자 중단 | §6 비범위 보존 | AC3 사전 abort는 coordinator가 호출된 경우만 보장 |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 핵심 메커니즘은 ΔV1 그대로다. V1이 mail 통합의 syncMs 케이스를 signal abort로 바꾸도록 했지만, 해당 케이스는 명령 timeout 보존으로 바꾸고 caller abort·120초 초과는 신규 sync-manager 단위에서 실제 POP3 경로로 검증했다. AC10의 모든 결과를 각각 관측한다.
- 추가 세부 수정: abortTurn 중복 mark 방지. ΔV1의 listener가 이미 중단한 runtime에 기존 chatCancel이 다시 mark하는 것을 막기 위한 것으로 공개 결과·Decision 변경은 없다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 새 만료 상태 없음. 실행 상한 제거 뒤 연결/명령 timeout까지 없어질 위험 | AC10 단위 4케이스: 전체 151초 성공, connect/command timeout 각각 유지 |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | controller listener와 abortTurn이 같은 runtime을 공유 | EP-07 파생 지점: 실제 cancel의 mark 1회, abort 단위 4케이스 |
| 재진입 | helper·IPC handler의 중복 종료 가능 | EP-02/06: AC6·7 통과, M4·M5 red |
| 다른 무효화 축 | 종료 후 이전 listener가 runtime에 남을 위험 | EP-07: AC3 정상 종료 후 abort mark 0. 메일의 새 공유/캐시 무효화 장치는 없음 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | chat coordinator·abort·policy·계약·session runtime·approval 배선, mail sync/type, 관련 테스트, IPC/아키텍처 4문서. timer 본체·테스트 삭제. 상세는 diff |
| 실행 명령 | 아래 재현 블록, 변이 runner. lint의 `--fix` 뒤 diff를 확인했고 해당 범위 밖 production 변경 없음 |
| **관측한 게이트 산출**(exit code 아님) | vitest **271파일/2365케이스 통과·실패0·skip0**, DB 통합 포함. lint **error 0·warning 1**(수정하지 않은 useTranscriptVirtualizer의 기존 incompatible-library). typecheck **node/web/test 3/3·진단0**. doc inventory **9항목·100채널·문서/링크 정상** |
| V-pair 자기확인 | SELF_PASS 7·SELF_BLOCKED 2(AC12 사람 실기), 총 9 |
| 강제 지점 전수 | EP-01~08 구현·검색·직접 행동 관측 완료. EP-03은 기준선 47검색행과 현재 잔여 0을 구분해 기록 |
| **AC 자기보고**(`Criteria-Met`) | **12/13**. 아래 AC별 관측; AC12만 사람 실기 대기 |
| **합계 검산** | **✅12 · ⚠️1 · ❌0 = 총13**. V1은 AC3 행이 없었고 ΔV1이 AC3·13을 추가한 유효 분모 사용 |
| 블로커 / 역질문 | 기계 gate 블로커·미해결 PLAN_GAP 없음. AC12 실제 Bash/PowerShell·폐기 UI는 검증자/사람에게 인계 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

| AC | 자기 상태 | 이번 턴 관측 |
|---|---|---|
| AC1 | ✅ | coordinator user/continuation/listen 각각 30분 abort 없음→telemetry 종료. approval.identity 승인 대기 30분 뒤에도 미종료→allow |
| AC2 | ✅ | 계획의 main 금지 심볼 검색 0행, 확장 inventory 47→0행. O1 검출 및 M6 4케이스 red |
| AC3 | ✅ | 실제 runtime controller/chain abort interrupt 1·run 종료; 사전 abort send 0·종료 후 mark 0 |
| AC4 | ✅ | 정상 반환에서 tool aborted→finalize→interrupted 1→boundary aborted 순서. M1 검출 |
| AC5 | ✅ | cancelled=false인 throw와 backoff abort 모두 interrupted 1·error 0. M2·M3 검출 |
| AC6 | ✅ | 실제 chatCancel 양쪽 producer 합산 user_cancelled 1·finalize 1. M4 검출 |
| AC7 | ✅ | telemetry/error 기전달 뒤 interrupted 0. M5 검출 |
| AC8 | ✅ | reducer inflight=false·turnStartedAt=null·error undefined, StatusLine 실제 렌더 빈 문자열 |
| AC9 | ✅ | 실제 chatDiscardSession 경유 interrupted 1·열린 tool aborted·boundary aborted |
| AC10 | ✅ | sync-manager 4케이스(151초 성공·caller abort·connect timeout·command timeout), mail 통합 28·POP3 session 40 통과 |
| AC11 | ✅ | reason user_cancelled/interrupted union·문서 일치, stall 단어/idle timeout 검색 0행·O2 검출·typecheck 3/3 |
| AC12 | ⚠️ | 실제 패키징 앱/CLI의 200초 Bash·PowerShell 및 폐기 클릭 시각 검증 미실시 |
| AC13 | ✅ | finalize throw 주입 시 단위와 실제 runtime 모두 interrupted 1·boundary aborted·error 0, run resolve |

✅ 행 12 + ⚠️ 행 1 + ❌ 행 0 = 13. 구현 메타와 INDEX를 `impl/IMPL_DONE`, 다음 주체 Claude(verify)로 동기화한다.

```powershell
# app cwd
npm.cmd run lint
npm.cmd run typecheck
npx.cmd vitest run src/main/features/chat src/main/app/chat-turn src/main/features/plugins/mail src/main/app/deployment/mail.integration.test.ts src/main/features/sessions src/main/contracts/session-state.test.ts src/main/infra/net/pop3-session.test.ts src/renderer/src/features/chat --maxWorkers=2
node scripts/check-doc-inventory.mjs --check
# repo root
python docs/handoff/0243-execution-timer-removal/evidence/r1-mutations.py
git diff --check
```

증거: [테스트 요약](evidence/r1-tests.json) · [lint](evidence/r1-lint.log) · [typecheck](evidence/r1-typecheck.log) · [변이 결과](evidence/r1-mutations.json). 테스트 요약은 vitest JSON의 파일별 상태·실행 수·실패명을 보존하고 중복 case 본문을 생략한 것이다.

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: r1 최초 구현. 재구현 라운드 없음.
- 그것을 막았어야 할 plan 지침·AC가 있었는가: V1은 중단 후 frame 종료와 finalize 오류 격리를 전제했으나 실제 구현과 달랐다. 사전 프로브 후 ΔV1 AC3·13/EP-07·08로 보완해 분리 커밋했다.
- 반복해서 부딪히는 환경 한계: 최종 gate의 ABI·네트워크 실패 없음. 실제 CLI/Windows 클릭 관측은 AC12의 원래 사람 실기 경계로 남음.
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

r1 검증 = PASS — 판정 원문은 [`verify.md`](verify.md).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| D1 | EP-06 ②③·EP-02 helper 쓰기는 관측 불가 자리(X3·X4·X8 green) | VP-06·VP-07 / §10 | 방어 코드 유지 또는 후속 정리 | NON_BLOCKING | open |
| D2 | 승인 대기 30분 테스트가 coordinator와 결합하지 않음 | VP-01 AC1 | 결합 케이스는 선택. M6가 타이머 재삽입을 잡음 | NON_BLOCKING | open |
| D3 | ΔV1 규범 정정을 구현 에이전트가 작성 | `docs/handoff/AGENTS.md §2` | Review Signal | NON_BLOCKING | open |
| D4 | deny+interrupt가 runtime interrupt를 동기 유발 | 비귀속(renderer 미사용) | 해당 경로 사용 시 재검토 | NEXT_HANDOFF | open |
| D5 | `send.ts:411` 삭제된 idle 타이머 주석 | 비귀속 | 다음 편집 시 정리 | NON_BLOCKING | open |

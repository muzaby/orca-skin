# Plan — 0052-turn-coordinator-firstclassing

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A 가 축복한 **가로축 구동체(TurnCoordinator) 1급화** — 비기능 리팩토링(= Claude 직접 plan→impl→verify).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0052-turn-coordinator-firstclassing` |
| 작성자 | Claude Code |
| 일자 | 2026-06-29 |
| 매핑 | PHASES (verify 승격 시) / PR (사용자 요청 시) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 51 구현을 해야한다. 수석 개발자의 실무적 관점에서 orca 개발방침을 준수하며, 모듈화/추상화를 적극 도입하여 어떻게 구조적 개발할지 비판적 검토를 진행하라." | 라이브 세션 요청(2026-06-29) |
| 명시 요구 | 범위 = **TurnCoordinator 1급화만**; 기록 = **신규 0052 핸드오프** | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | 0051(문서전용)은 이미 커밋·PASS 완료 → "51 구현"의 실질은 §A staging **P1 의 키스톤(TurnCoordinator)** 코드화 (추론, AskUserQuestion 으로 확인됨) | `git log`(75d5b80·5bc40a1·06baab4) + `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A` |

## Context (왜)

0050 이 P0(OneShot SessionRuntime·상태 SSOT·StallTimer·dangling 마감)을 출시했고, 0051 §A 가 **가로축(turn pipeline: stream→reduce→persist∥forward + 권한 재진입)의 1급 구동체 = TurnCoordinator** 를 식별·축복했다. 그러나 현재 가로축은 1급 객체가 아니라 `ipc/chat/send.ts:handleChatSend`(약 390줄)와 25-필드 god-object `InflightTurn` 에 인라인으로 흩어져 있다. 이 작업은 그 가로축을 **동작 보존**으로 L1 lifecycle 모듈로 추출해 (a) §A 세로축의 1급 시민으로 안착시키고 (b) 지금껏 IPC/electron 의존으로 단위테스트가 없던 가로축에 **첫 테스트 커버리지**를 부여한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| TurnCoordinator 는 §A 세로축에서 Supervisor↔SessionRuntime 사이의 1급 컴포넌트(현 `InflightTurn`/`send.ts`); persist=main-side·renderer 비의존; persist∥forward=병렬 독립 sink | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A` · `@docs/arch/backend/provider-runtime.md`(0051 포인터) |
| 가로축 로직(retry 루프·스트림 consume·reduce 부수효과·terminal 합성·error/settle)은 `handleChatSend` 454–604 에 인라인 | `app/src/main/ipc/chat/send.ts:454` |
| `OneShotSessionRuntime.send()` = adapter attempt 1회, **외부 retry 는 소비자가 소유** | `app/src/main/lifecycle/session-runtime.ts:17` |
| L1 은 L3(persist·forward·title)를 import 못 함 → 의존 역전(콜백/인터페이스 주입, 컴포지션 루트 배선) | `@app/src/main/AGENTS.md`(작업 규칙) |
| `import/no-cycle` 차단: `turn-context.ts` 가 `ports.ts` 를 import → sink 인터페이스를 ports.ts 에 두면 순환 | `app/src/main/lifecycle/turn-context.ts:3` · `app/eslint.config.mjs` |
| `subagent-settlement.ts` 는 순수(shared 만 import) → L1 이동 가능 | `app/src/main/ipc/chat/subagent-settlement.ts:1` |
| 기존 외부 의존: `router.ts` 가 `settleOpenToolRuns`(3-arg), 회복탄력성 테스트가 `abortableDelay/createIdleTimer/IDLE_TIMEOUT_MS/RETRY_BACKOFF_MS` 를 `./send` 에서 import | `app/src/main/ipc/router.ts:35,201` · `app/src/main/ipc/chat/send.runtime-resilience.test.ts:2` |

## 인수 기준 (Acceptance Criteria)

1. **TurnCoordinator(L1) 신설.** `lifecycle/turn-coordinator.ts` 가 retry+consume 루프·per-event reduce·persist∥forward fan-out·terminal 합성·error 분류/retry 결정·stall 타이머 소유 + `beginApprovalPause()` 를 1급으로 소유한다. send.ts 의 가로축 로직(454–604)을 **동작 보존**으로 이식.
2. **의존 역전(경계 준수).** 코디네이터는 L3 구체 클래스를 import 하지 않고 sink 인터페이스(`TurnPersistSink`·`TurnEventSink`·`TurnTitleHook`, 신규 `lifecycle/turn-sinks.ts`)만 주입받는다. `npm run lint`(boundaries) **L1→L3 import 위반 0**.
3. **settle/subagent 빌더 L1 이동.** `settleOpenToolRuns`·`settleSubagentTask`·`stopLiveSubagent` → `lifecycle/settle.ts`(주입 persist+forward), 순수 빌더 → `lifecycle/subagent-settlement.ts`. 기존 import 경로(`router.ts`·resilience 테스트·`subagent-settlement.test.ts`)는 **무회귀 배럴 re-export** 로 유지.
4. **send.ts 셸화.** `handleChatSend` 가 셋업(검증·dup-guard·provider/env/첨부·dangling 복구·turn 생성·등록·requestApproval 배선) + `coordinator.run` + finally 로 축소. cancel/stopSubagent 는 `settle.ts` 호출.
5. **가로축 단위테스트 신설.** `turn-coordinator.test.ts`(이벤트 순서·persist∥forward·terminal 합성·retry·promote·ask flush·approval pause) + `settle.test.ts`. 게이트 typecheck/lint/test/build 통과(기존 환경성 실패 제외).

## 범위 / 비범위

- **범위**: 가로축(TurnCoordinator) 1급화 + sink 인터페이스 추출 + settle/subagent 빌더 L1 이동 + send.ts 셸화 + 단위테스트. **동작 보존 리팩토링**(이벤트 시퀀스·DB parts·UX 무변경).
- **비범위(후속 핸드오프)**: ① **InflightTurn god-object 풀분리**(blast radius 큼 — sink 로 접촉면만 좁혀 포석) ② Persistent runtime + IdleCloseTimer ③ Supervisor cap/LRU + idempotent close 단일경로 ④ steer/queue admission ⑤ `orchestration/`→supervision 코드 리네임(0051 결정 2) ⑥ Conversation Continuity(§A Future).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `OneShotSessionRuntime`(L1)·`createStallTimer`(L1 timers)·`makeClassifiedError`(L1 runtime-errors)·`SessionRuntimeRegistry.promote`(L1)·`TurnPersistence`/`TitleGenerator`(L3, 구조적으로 sink 만족)·`sendChatEvent`(L3, forward 래핑).
- 전제: `OneShotSessionRuntime` 외부 retry 소유 계약(session-runtime.ts:17) 유지. `TurnRequest`(extensions/types) 형태 불변.
- **신규 의존성**: 없음.

## 설계

- **TurnCoordinator(L1)** = 가로축 구동체. 생성자 주입 `{ runtime, persist, forward, titles, registry, classifyError, concurrency, backgroundSubagents }`. `run(turn, request, {boundProjectId})` 가 send.ts:454–604 의 retry+consume+reduce+error 를 이식. `beginApprovalPause()` 가 현 attempt 의 stall 을 pause(refcount) — requestApproval(핸들러 잔류)이 호출.
- **권한 재진입**(§A: 단계 아님, 콜백): `requestApproval` 는 approvals(L3 broker)·idle-pause 결합으로 **핸들러에 남기고**, idle-pause 만 `coordinator.beginApprovalPause()` 로 위임. `request.requestApproval` 로 runtime.send 에 통과(canUseTool 재진입).
- **sink 인터페이스**는 `lifecycle/turn-sinks.ts`(ports.ts 아님 — `turn-context↔ports` 순환 회피). 기존 L3 클래스가 *무변경* 으로 구조적 만족.
- **settle/subagent 빌더 L1 이동** + L3 배럴 re-export(`src/main/AGENTS.md` "무회귀 분해" 패턴) → `router.ts`/resilience 테스트/subagent-settlement.test 무변경.
- 레이어: 신규 전부 L1 lifecycle. send.ts(L3)가 컴포지션 루트로 concrete 배선.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 동시성/멀티세션: 동시 턴 가드·세션키 라우팅·concurrency 증감 짝(누수 0) **동작 보존**.
- 엣지케이스(이식 시 보존): settle-before-aborted, promote-on-session.updated, ask 페어링 레이스, idle pause refcount, terminal 합성, retry(eventsReceived===0·MAX 2), cancelled/timedOut 분기, owner-gone 가드.
- UI/시각: 없음(순수 main-side 리팩토링, NormalizedEvent 시퀀스 불변).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 가로축이 CI 미커버 + 시각검증 의존 불변식을 인코딩 → 추출 시 회귀 위험 | **동작 보존 이식**(재설계 금지) + 불변식 체크리스트 + 신규 단위테스트로 핵심 순서 고정 |
| sink 인터페이스를 ports.ts 에 두면 import 순환 | 별도 `turn-sinks.ts` 모듈(turn-context 비참조) |
| god-object 동반 분리 유혹 | 명시적 비범위 — 접촉면만 sink 로 좁히고 후속 핸드오프로 |

- 되돌리기 어려운 결정: 없음(순수 구조 추출, 동작 동일).
- 단독 결정 금지 항목: 없음(범위·기록 방식은 AskUserQuestion 으로 확정).

## 영향 받는 파일

- 신규: `app/src/main/lifecycle/{turn-coordinator.ts, turn-coordinator.test.ts, settle.ts, settle.test.ts, turn-sinks.ts, subagent-settlement.ts}`
- 수정: `app/src/main/ipc/chat/send.ts`(셸화 + 무회귀 re-export), `app/src/main/ipc/chat/subagent-settlement.ts`(→ L1 배럴 re-export)

## 참고 문서

- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A` · `@docs/arch/backend/provider-runtime.md`(TurnCoordinator 포인터) · `@app/src/main/AGENTS.md`(L0→L3 DAG·의존 역전)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`(+`npm run build`).
- 신규 테스트: turn-coordinator(가로축 순수 구동) + settle 빌더.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용, 추론은 추론 표기(AskUserQuestion 확인).
- [x] 자료조사 — 모든 발견에 `파일:라인`·`@docs/…` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — 재사용 모듈 식별, 신규 의존성 0.
- [x] 파생 UX — 동시성/엣지케이스(불변식) 펼침.
- [x] 리스크 — 동작 보존·순환 회피·god-object 비범위 분리.

---

> **[구현자 기입]** — Claude 직접 구현(비기능).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 가로축=TurnCoordinator 추출은 §A 와 1:1. 의존 역전(sink 주입)이 L1 배치를 가능케 하고 동시에 테스트 가능성을 줌 — 이 둘이 같은 결정의 양면.
- 이견 / 보강: `settle` 헬퍼를 코디네이터 메서드가 아니라 **순수 함수(settle.ts)** 로 둔다 — cancel/stopSubagent 핸들러(코디네이터 인스턴스 없는 별도 IPC)도 공유해야 하므로 stateless 가 옳다. `stopLiveSubagent` 는 `turn` 대신 `live` 만 받게 좁혀 결합 축소.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | sink 인터페이스를 ports.ts 에 두면 `turn-context↔ports` import 순환 | ✅ 구현함 — 별도 `turn-sinks.ts` 모듈 신설 | `turn-context.ts:3` 가 ports import |
| 2 | `router.shutdown()` 가 settleOpenToolRuns 3-arg 로 호출 | ✅ 구현함 — send.ts 에 3-arg 무회귀 래퍼(forward=sendChatEvent) 유지 | `router.ts:201` |
| 3 | resilience 테스트가 `./send` 에서 retry/timer 헬퍼 import | ✅ 구현함 — send.ts 가 coordinator/timers 에서 re-export | `send.runtime-resilience.test.ts:2` |

## [구현자 기입] 구현 체크리스트

- [x] `turn-sinks.ts`(TurnEventSink·TurnPersistSink·TurnTitleHook)
- [x] `subagent-settlement.ts` L1 이동 + L3 배럴 re-export
- [x] `settle.ts`(+test) — 순수 settle 3종
- [x] `turn-coordinator.ts`(+test) — 가로축 구동 + beginApprovalPause
- [x] `send.ts` 셸화 + 무회귀 re-export + cancel/stopSubagent → settle.ts

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 6(turn-coordinator·turn-coordinator.test·settle·settle.test·turn-sinks·lifecycle/subagent-settlement) + 수정 2(ipc/chat/send.ts·ipc/chat/subagent-settlement.ts) |
| 실행 명령 | `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` |
| 게이트 결과 | typecheck ✅(node+web+test) / lint ✅(boundaries 0 — L1→L3 위반 0) / test ✅ 신규 14 green, 전체 541 passed · 12 fail=`db/queries.test.ts` better-sqlite3 Node ABI(클린 트리 동일·변경 무관) / build ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (push 후 기재) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | — | — | — |

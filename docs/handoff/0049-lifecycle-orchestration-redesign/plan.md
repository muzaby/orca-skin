# Plan — 0049-lifecycle-orchestration-redesign

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 라이프사이클·오케스트레이션 **구조 재설계**의 P0 구현 설계서다. 설계 정본은 [`@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md`](../../etc/orca_lifecycle_orchestration_design_draft_ko.md)(엔지니어링 리뷰 8건 반영본), 본 문서는 그것을 *코드 작업 단위*로 번역한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0049-lifecycle-orchestration-redesign` |
| 작성자 | Claude Code |
| 일자 | 2026-06-28 |
| 매핑 | PHASES 행 / PR (impl 후) |
| 상태 | DRAFT → READY |
| 구현 주체 | **Codex** (대규모 구조 재설계 — 비기능이나 규모로 Codex 배정, 사용자 재지정 가능) |
| 선행 | `/plan-eng-review`(2026-06-28) 결정 8건 — 설계서 `[리뷰 N]` 마커 |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "전체 아키텍처 재설계. 파일트리 재배치. 모듈화/단위 별 코드 재설계 요구." + "etc에 추가된 문서들을 모두 출처로 표기." | 라이브 세션 요청 |
| 명시 요구 | "사용자 기능적인 부분은 대부분 구현한 상태. 이제 구조적 재설계를 해야 하는 시점(라이프사이클·오케스트레이션)." | 라이브 세션(스킬 인자 context) |
| 명시 요구 | Orca 는 하네스/에이전트를 SDK 에 위임한 **경량 LLM 에이전트** — 컨셉에 맞는 라이프사이클·오케스트레이션 필요. | 라이브 세션(스킬 인자 context) |
| 명시 결정 | 엔지니어링 리뷰 8건(아래 인수 기준) — 사용자가 AskUserQuestion 으로 직접 채택. | `/plan-eng-review` 응답 8건 |
| 추론 의도 | "재설계"의 P0 = SessionRuntime 추출 + 상태머신 + dangling 복구 + 타이머 분리(구조), Persistent/steer-queue 는 P1. (리뷰 1 결정 기반 해석) | 설계서 §5.5 [리뷰 1] |

## Context (왜)

현재 핸들 수명은 **턴-스코프**다 — `query()` 가 턴마다 새로 열리고 `result` 도착 시 닫힌다(`adapters/claude.ts:335`). 세션 상태는 `InflightTurn` 의 암묵 플래그(`cancelled/timedOut/live`)에 흩어져 있고, 세션 핸들·레지스트리·타이머·복구가 `ipc/chat/` 오케스트레이션 코드(`send.ts` 677줄)에 섞여 있다. 기능은 대부분 동작하지만 **라이프사이클이 1급 구조물로 분리돼 있지 않다.**

설계서의 핵심 명제: opencode·hermes 가 길었던 8할은 "하네스를 직접 만드느라"이고 Orca 는 그 전부를 SDK 에서 빌린다 → **Orca 가 새로 설계할 단 하나의 구조물은 세션-스코프 `SessionRuntime`**(핸들 수명 + coarse 상태머신 + 레지스트리). 나머지는 이미 구축(DB SSOT·canUseTool·streaming-input plumbing)이거나 SDK 위임(루프·compaction·subagent).

이 작업은 그 단일 구조물을 추출하고, 흩어진 라이프사이클 책임을 그 아래로 재배치한다. **P0 는 OneShot 단일 구현 + 견고성**에 집중하고, Persistent(롱리브드 핸들)·steer/queue·핸들 cap 은 **P1 로 분리**한다(리뷰 1).

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 설계 정본 — 하네스 소유 스펙트럼, SessionRuntime, 20결정 + 리뷰 8건 | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md`(§1·§5·§5.5) |
| 라이프사이클 8계층 기준자 — 재설계가 충족/위임/연기를 판정하는 yardstick | `@docs/etc/lifecycle_management_ko.md`(§2~§8) |
| 오케스트레이션 7요소 기준자 — Orca 스코프(세션/턴 오케스트레이션, 멀티에이전트 비채택) | `@docs/etc/orchestration_report_ko.md`(§3·§8) |
| OpenCode real-world — run-coordinator(키당 1 drain·seq fencing)·steer/queue admission | `@docs/etc/study/opencode/opencode_orchestration_analysis_ko.md`(§2·§3) |
| OpenCode 라이프사이클 — 이벤트소싱 durable·failInterruptedTools·자동재시작 미채택 | `@docs/etc/study/opencode/opencode_lifecycle_analysis_ko.md`(§4·§7) |
| Hermes real-world — IterationBudget·delegate_task·Kanban (Orca 비채택 근거) | `@docs/etc/study/hermes-agent/hermes_orchestration_analysis_ko.md`(§3·§5) |
| Hermes 라이프사이클 — 동기 루프·ProcessRegistry·idle/daily reset·"활성 중 만료 금지" | `@docs/etc/study/hermes-agent/hermes_lifecycle_analysis_ko.md`(§3·§4) |
| SDK 스트리밍 입력이 다중 메시지·interrupt·"Session stays alive" 공식 보장(Persistent 정당화) | `@docs/spec/claude/agent-sdk/streaming-vs-single-mode.md:18-88` |
| `maxTurns` 는 스트리밍 세션 *전체* run 바운드(예제 maxTurns:10) → persistent 는 per-turn 한도 상실 | `@docs/spec/claude/agent-sdk/streaming-vs-single-mode.md:139` |
| streaming-input 에 `queue`+`wake` plumbing 이미 존재, seed 1건·`push()` 없음·close-on-result | `app/src/main/adapters/streaming-input.ts:26-52` · `adapters/claude.ts:335` |
| LiveTurn = 턴-스코프 핸들(events + control 5종). 세션-스코프 아님 | `app/src/main/adapters/types.ts:17-26` · `adapters/claude.ts:354-364` |
| TurnRegistry = 세션 키잉, 세션당 1 inflight(= run-coordinator 경량판 이미 존재) | `app/src/main/ipc/chat/turn-registry.ts:75-109` |
| InflightTurn god-object ~25필드(상태+ask페어링+subagent+title) | `app/src/main/ipc/chat/turn-registry.ts:15-72` |
| IDLE_TIMEOUT_MS=120s 가 busy 중 무이벤트 시 turn abort(=StallTimer, 핸들회수 아님) | `app/src/main/ipc/chat/send.ts:42·75-81·580-590` |
| dangling tool 정착은 in-process(settleOpenToolRuns)만, **부팅/resume 재조정 경로 없음** | `app/src/main/ipc/chat/send.ts:123-146` · `ipc/router.ts:199`(shutdown only) |
| canUseTool 게이트 + RISKY_TOOLS 존재. `disallowedTools` 는 sendMessage options 에 미주입 | `app/src/main/runtime-events/permission-bridge.ts:14-25` · `adapters/claude.ts:292-328` |
| main 레이어 DAG: L0 shared→L1 domain→L2 adapters→L3 ipc, 하향 의존만(boundaries 강제) | `app/src/main/AGENTS.md`(레이어 DAG) |
| ConcurrencyRegistry = 프로젝트별 턴 카운트(UI용), 핸들 수 cap 아님 | `app/src/main/ipc/chat/concurrency-registry.ts` |

## 인수 기준 (Acceptance Criteria)

> 엔지니어링 리뷰 8건을 검증 가능한 항목으로. verify 가 1:1 대조.

1. **[리뷰 1] SessionRuntime 인터페이스 + OneShot 단일 구현.** 신규 `SessionRuntime` 이 세션 1개의 라이브 실행을 owns 하며 소비 인터페이스는 `send(): AsyncIterable<NormalizedEvent>` · `interrupt()` · `setMode()` · `push()`(P0 stub) · `close()`. P0 는 **OneShot(close-on-result) 단일 구현**만 제공. Persistent 구현체는 만들지 않는다.
2. **[리뷰 1·⑳] 모드-무관 소비자 계약.** `send.ts`·`claude-map`·persist·PermissionBridge·telemetry 는 `NormalizedEvent` 만 소비하며 OneShot/Persistent 모드를 모른다 — close 정책이 유일한 모드 의존 계층. 단위 테스트가 "두 close 정책이 동일 NormalizedEvent 스트림 산출"을 검증(Persistent 는 stub 으로 mode-invariance 만).
3. **[리뷰 2] coarse 상태머신을 SessionRuntime 이 단일 소유.** `cold/live/busy/interrupting/error/closed` 전이를 SessionRuntime 이 owns, **비영속**(DB status 컬럼 없음, 부팅 시 cold 재구축). `InflightTurn` 의 `cancelled/timedOut/live` 가 이 상태의 *파생*으로 정리되어 별도 SSOT 가 없다.
4. **[리뷰 3] StallTimer / IdleCloseTimer 명시 분리.** 기존 `IDLE_TIMEOUT_MS` 경로는 **StallTimer**(busy 중 무이벤트→turn abort)로 개칭. **IdleCloseTimer**(live-idle 핸들 회수)는 별도 타이머·소유·트리거로 정의(P0 는 인터페이스/stub, 구현은 P1). 한 'idle' 로 합치지 않는다.
5. **[리뷰 5·⑪] resume/부팅 시 dangling tool 마감.** `tool_call` 은 있고 `tool_result` 가 없는 part 를 부팅·resume 진입 시 "interrupted"로 마감(`failInterruptedTools` 대응). 마감 안 하면 발생하는 "실행 중" 무한 렌더가 재현 테스트로 방어된다.
6. **[리뷰 5] P0 테스트 4종.** (a) 상태머신 전이 (b) resume/부팅 dangling 마감 (c) 모드-불변(2번) (d) **StallTimer 회귀**(busy 중 무이벤트→abort+"응답이 없어 턴을 중단했습니다" 보존) — 모두 electron 비의존 단위 테스트.
7. **[리뷰 6] 핸들 cap 축출 훅 예약.** `SessionRuntimeRegistry` 인터페이스에 축출 훅(예: `evictIdle()` 또는 cap 파라미터)을 예약한다 — P0 는 미사용(비용 0), 구현(cap+LRU)은 P1.
8. **[리뷰 4·7·8] 문서 정합.** 설계서의 disallowedTools 표기는 "D1 보류(미구현)"로 통일됨(완료) — 코드 변경 시 이 상태를 유지(canUseTool 1단). `maxTurns` 세션-스코프 함의(persistent per-turn 캡)는 P1 설계노트로 남긴다. resume 실패는 현행대로 "이 대화는 이어할 수 없습니다" 에러 종료(cold-fallback=Future).
9. **레이어 경계 0 / 게이트 통과.** 신규 `session/` 모듈은 L1 domain(SessionAdapter 주입, electron 비의존). `npm run lint`(boundaries 포함)·`typecheck`·`test` 통과, 신규 의존성 0.

## 범위 / 비범위

- **범위 (P0)**: SessionRuntime 인터페이스 + OneShot 구현, 상태머신(단일 소유·비영속), TurnRegistry→SessionRuntimeRegistry 재배치(+축출 훅 예약), StallTimer 개칭 + IdleCloseTimer 분리(인터페이스/stub), resume·부팅 dangling 마감, P0 테스트 4종, `send.ts` 를 SessionRuntime 소비자로 박리. 파일트리 재배치(아래 §설계).
- **비범위 (P1, 후속 핸드오프)**: Persistent 핸들 구현·cross-turn 수명·IdleCloseTimer 구현·핸들 cap+LRU·steer/queue UX·멀티세션 동시 라이브 핸들 정책·compaction 액션(`/compact`)·session handoff·maxTurns per-turn 캡·이벤트 ordering/seq·backpressure·렌더러 재연결·Windows 프로세스-트리 정리. (설계서 §5.5 P1 + §6-10)
- **비범위 (Future)**: resume cold-fallback(DB 이력 재구성)·goal 영속 1급화·cross-session 멀티에이전트·deliberation·별도 평가 세션·OpenCode 어댑터. (설계서 §5.5 Future)

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `SessionAdapter.sendMessage`→`LiveTurn`(`adapters/types.ts`), `createTurnInputStream`(`adapters/streaming-input.ts`), `TurnRegistry`/`InflightTurn`(`ipc/chat/turn-registry.ts`), `createIdleTimer`(`ipc/chat/send.ts`), `settleOpenToolRuns`(`send.ts`), DB queries(`db/queries.ts` dangling 조회·tool_result upsert).
- SDK 전제(문서 검증됨): 스트리밍 입력 세션이 다중 메시지·interrupt·"Session stays alive" 지원(`streaming-vs-single-mode.md`). **P0 는 이 전제를 OneShot 으로만 사용**(post-result push 는 P1 에서 비로소 의존).
- **신규 의존성**: 없음(예상). 새 npm 패키지 도입 금지 — 필요 시 ⚠️ 보고만.
- 전제: 기존 391+ 테스트가 better-sqlite3 ABI 환경에서 일부 red 인 것은 변경 무관(handoff 0019 dual-ABI). 신규 단위 테스트는 electron 비의존이라 영향 없음.

## 설계

### A. 파일트리 재배치 (모듈화)

라이프사이클 책임을 **신규 L1 domain 모듈 `src/main/session/`** 로 응집한다. SessionRuntime 은 `SessionAdapter`(L2)를 *주입*받아 하향 의존을 깬다(dependency inversion) → L1 유지·electron 비의존·vitest 가능.

```
[현재] 라이프사이클이 ipc/chat + adapters 에 분산
  adapters/
    claude.ts            ── LiveTurn 핸들 소유(턴-스코프) + close-on-result(:335)
    streaming-input.ts   ── TurnInputStream(queue+wake, push 없음)
    types.ts             ── LiveTurn 계약
  ipc/chat/
    send.ts (677줄)      ── 오케스트레이션 + createIdleTimer + settleOpenToolRuns + 상태 플래그
    turn-registry.ts     ── TurnRegistry + InflightTurn(~25필드 god-object)
    concurrency-registry.ts

[목표] 세션 라이프사이클을 src/main/session/ 로 응집 (L1 domain, 순수·주입식)
  session/                         ★ 신규 모듈
    session-runtime.ts   ── SessionRuntime: 핸들 수명 + close 정책(OneShot) + coarse 상태 소유
    session-state.ts     ── 상태머신(cold/live/busy/interrupting/error/closed) 순수 전이
    session-registry.ts  ── SessionRuntimeRegistry(← turn-registry.ts 이전·개명, 축출 훅 예약)
    timers.ts            ── StallTimer(← send.ts createIdleTimer 이전·개명) + IdleCloseTimer(stub)
    recovery.ts          ── dangling tool 마감(부팅·resume), failInterruptedTools 대응
    turn-context.ts      ── InflightTurn 의 *턴-로컬* 잔여(ask페어링·subagent·title)만 분리
    *.test.ts            ── P0 테스트 4종
  adapters/
    claude.ts            ── LiveTurn 반환은 유지, close 정책은 SessionRuntime 이 제어(close-on-result 호출자 이동)
    streaming-input.ts   ── push() 시그니처만 예약(P0 미사용), 구현은 P1
    types.ts             ── LiveTurn 유지 + (선택) SessionRuntime 소비 타입
  ipc/chat/
    send.ts              ── SessionRuntime 소비자로 박리(상태/타이머/레지스트리 위임 → 더 얇게)
    concurrency-registry.ts  ── 유지(프로젝트 턴 카운트)
```

- **레이어**: `session/` 은 L1 domain. `SessionAdapter` 를 생성자/팩토리 주입(컴포지션 루트 `ipc/router.ts`·`index.ts` 가 배선). `ipc/chat/send.ts`(L3)가 SessionRuntime 을 구동. boundaries: session→adapters 직접 의존 금지(주입으로 역전), session→shared·session 내부만.
- **`boundaries/elements`**: `src/main/session` 은 기본 L1 domain 분류로 떨어짐(별도 등록 불필요) — `app/eslint.config.mjs` 확인.

### B. SessionRuntime (인수 1·2·3)

```
SessionRuntime (세션 1개, 핸들 소유, 소비 인터페이스 모드-무관)
  상태: SessionState (cold|live|busy|interrupting|error|closed)  ← 단일 SSOT, 비영속
  send(content): AsyncIterable<NormalizedEvent>   ← 소비자가 보는 유일 표면
  interrupt() · setMode(mode) · setModel(m)        ← LiveTurn control 위임
  push(content)                                    ← P0 stub(throw/no-op), P1 Persistent 구현
  close()                                          ← close 정책: OneShot=on-result
   │
   ├ OneShot 구현: adapter.sendMessage()로 LiveTurn 생성, result 도착 시 close (= 현재 claude.ts:335 로직 이전)
   └ Persistent: (P1) 핸들 1개 보관 + push=generator push + idle/explicit close
```

- close-on-result 판정(`if msg.type==='result'`)을 `claude.ts:335`(어댑터)에서 SessionRuntime(OneShot 정책)으로 **끌어올린다** — 어댑터는 LiveTurn 만 돌려주고 수명은 런타임이 정한다.
- 상태 전이는 `session-state.ts` 순수 함수(`transition(state, event)`). SessionRuntime 이 NormalizedEvent/제어를 보고 호출. `InflightTurn.cancelled/timedOut/live` 는 `runtime.state` 파생 getter 로 대체(별도 SSOT 제거).

### C. 타이머 분리 (인수 4)

- `send.ts:createIdleTimer`/`IDLE_TIMEOUT_MS` → `session/timers.ts` 의 **`StallTimer`**(busy 중 무이벤트 N초→`turn.controller.abort()`, 의미·동작 보존). beginPause refcount(승인 대기) 로직 그대로 이전.
- **`IdleCloseTimer`**: live-idle 중 N분→핸들 close 인터페이스만 정의(P0 stub, busy 중 미발동 가드는 상태머신이 보장 — ⑤). 구현 P1.

### D. dangling 복구 (인수 5)

- `session/recovery.ts`: 부팅(`router.start`)·resume 진입 시 DB 에서 `tool_call` 있고 `tool_result` 없는 part 를 조회(`db/queries.ts` 신규/기존 쿼리)→`tool.call.completed`(reason:'interrupted') 합성·persist. `send.ts:settleOpenToolRuns` 의 *부팅판*. 멱등(upsert, `queries.ts:286` 패턴 재사용).

### 재사용할 기존 함수·파일
`adapters/claude.ts`(sendMessage)·`streaming-input.ts`(createTurnInputStream)·`turn-registry.ts`(→이전)·`send.ts`(createIdleTimer·settleOpenToolRuns→이전)·`db/queries.ts`(tool_result upsert)·`ipc/router.ts`(start/shutdown 배선).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 상태: 부팅 후 모든 세션 cold(라이브 핸들 0) → 첫 prompt 에서 live. 크래시 후 재진입 시 dangling 마감으로 "실행 중" 고착 해소.
- 동시성/멀티세션: 세션당 1 inflight(기존 TurnRegistry 불변식)는 유지. 동시 라이브 핸들 cap 은 P0 미적용(훅만 예약).
- 에러: resume 실패(jsonl 부재, `~/.claude` 삭제)→"이 대화는 이어할 수 없습니다" 에러 종료(현행 유지, cold-fallback=Future).
- a11y/테마: N/A(메인 프로세스 구조 변경, UI 무변경).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 대규모 파일 이동으로 import 경로·테스트 깨짐 | 배럴 re-export 로 무회귀 이전(0017 D2 패턴), 게이트 lint/typecheck/test 로 검출 |
| InflightTurn 분해 중 ask페어링/subagent 추적 회귀 | 턴-로컬 잔여를 `turn-context.ts` 로 그대로 이전(필드 의미 보존), 기존 subagent-settlement 테스트로 방어 |
| close 정책을 어댑터→런타임 이동 시 핸들/서브프로세스 누수 | OneShot=현재 동작 1:1 보존, finally 멱등 close 유지(claude.ts:347-351 로직 이전) |
| 상태머신을 별도 SSOT 로 만들면 InflightTurn 과 drift | 인수 3: SessionRuntime 단일 소유, InflightTurn 플래그는 파생 getter(별도 저장 금지) |
| Persistent 를 미리 만들고 싶은 유혹(스코프 크리프) | 인수 1: P0 는 OneShot 단일 구현, push()=stub. Persistent 는 P1 핸드오프 |

- 되돌리기 어려운 결정: 모듈 경로(`src/main/session/`) 신설 — 다른 import 가 붙기 전에 확정. (대안: `ipc/chat/` 하위 유지 → 그러나 L1 순수성·재사용 위해 별도 모듈 권장.)
- **단독 결정 금지(Open Question)**: 신규 모듈 디렉토리명(`session/` vs `session-runtime/` vs `lifecycle/`) — 구현 착수 전 사용자/설계자 확인 권장(`runtime/` 는 Python uv 런타임이라 충돌).

## 영향 받는 파일

- 신규: `app/src/main/session/{session-runtime,session-state,session-registry,timers,recovery,turn-context}.ts` + `*.test.ts`
- 이전/개명: `ipc/chat/turn-registry.ts`→`session/session-registry.ts`(SessionRuntimeRegistry), `send.ts` 의 createIdleTimer→`session/timers.ts`(StallTimer)
- 수정: `adapters/claude.ts`(close 정책 호출자 이동), `adapters/streaming-input.ts`(push 시그니처 예약), `ipc/chat/send.ts`(SessionRuntime 소비자로 박리), `ipc/router.ts`(부팅 시 recovery 배선), `adapters/types.ts`(소비 타입), `db/queries.ts`(dangling 조회)
- 문서: `docs/arch/backend/provider-runtime.md`(SessionRuntime·상태머신 1급화 반영), `docs/PHASES.md`(현재 작업중→승격), `docs/IPC_CONTRACT.md`(채널 변경 시에만 — 예상 무변경)

## 참고 문서

- **설계 정본**: `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md`(리뷰 8건 반영본)
- **기준자**: `docs/etc/lifecycle_management_ko.md` · `docs/etc/orchestration_report_ko.md`
- **real-world**: `docs/etc/study/opencode/{lifecycle,orchestration}_analysis_ko.md` · `docs/etc/study/hermes-agent/{lifecycle,orchestration}_analysis_ko.md`
- **SDK 원문**: `docs/spec/claude/agent-sdk/streaming-vs-single-mode.md`
- **구조**: `docs/arch/backend/provider-runtime.md`(§3 PermissionBridge·NormalizedEvent) · `app/src/main/AGENTS.md`(레이어 DAG)
- IPC 변경 시: `docs/IPC_CONTRACT.md`(§6 변경 절차 — 동시 갱신)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구(인수 6): `session/session-state.test.ts`(전이) · `session/recovery.test.ts`(dangling 마감) · `session/session-runtime.test.ts`(모드-불변 — OneShot vs Persistent-stub 동일 스트림) · `session/timers.test.ts`(StallTimer 회귀: busy 무이벤트→abort).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(라이브 세션)·리뷰 8건 출처 인용, 추론은 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`·SDK 원문) 부착.
- [x] 인수 기준 — 9개 번호, 리뷰 8건에 근거, 검증 가능.
- [x] 의존 기술 — 기존 모듈 식별, 신규 의존성 0 명시.
- [x] 파생 UX — 부팅 cold·크래시 복구·resume 실패·멀티세션 펼침.
- [x] 리스크 — 파일이동·god-object 분해·close 정책 이동·SSOT drift·스코프크리프 + 모듈명 Open Question 분리.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다. 설계자(Claude)는 위쪽을 쓴다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·**결정 필요** | … |

## [구현자 기입] 구현 체크리스트

- [ ] …

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

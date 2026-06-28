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
2. **[리뷰 1·⑳] 모드-무관 소비자 계약.** `send.ts`·`claude-map`·persist·PermissionBridge·telemetry 는 `SessionRuntime.send()` 의 `AsyncIterable<NormalizedEvent>` 만 소비하며 close 정책 타입을 **분기하지 않는다**. 검증은 *Persistent 구현이 아니라* 경량 **fake runtime**(동일 인터페이스, close 정책만 주입 가능)으로 한다 — Persistent 동작이 아니라 "소비자가 close 정책에 무지함"을 본다(보강 §4).
3. **[리뷰 2] coarse 상태머신을 SessionRuntime 이 단일 소유.** `cold/live/busy/interrupting/error/closed` 전이를 SessionRuntime 이 owns, **비영속**(DB status 컬럼 없음, 부팅 시 cold 재구축). `InflightTurn` 의 `cancelled/timedOut/live` 가 이 상태의 *파생*으로 정리되어 별도 SSOT 가 없다.
4. **[리뷰 3] StallTimer / IdleCloseTimer 명시 분리.** 기존 `IDLE_TIMEOUT_MS` 경로는 **StallTimer**(busy 중 무이벤트→turn abort)로 개칭. **IdleCloseTimer**(live-idle 핸들 회수)는 별도 타이머·소유·트리거로 정의(P0 는 인터페이스/stub, 구현은 P1). 한 'idle' 로 합치지 않는다.
5. **[리뷰 5·⑪] resume/부팅 시 dangling tool 마감.** `tool_call` 은 있고 `tool_result` 가 없는 part 를 부팅·resume 진입 시 "interrupted"로 마감(`failInterruptedTools` 대응). 마감 안 하면 발생하는 "실행 중" 무한 렌더가 재현 테스트로 방어된다.
6. **[리뷰 5] P0 테스트 4종.** (a) 상태머신 전이 (b) resume/부팅 dangling 마감 (c) 모드-불변(2번) (d) **StallTimer 회귀**(busy 중 무이벤트→abort+"응답이 없어 턴을 중단했습니다" 보존) — 모두 electron 비의존 단위 테스트.
7. **[리뷰 6] 핸들 cap 축출 훅 예약.** `SessionRuntimeRegistry` 인터페이스에 축출 훅(예: `evictIdle()` 또는 cap 파라미터)을 예약한다 — P0 는 미사용(비용 0), 구현(cap+LRU)은 P1.
8. **[리뷰 4·7·8] 문서 정합.** 설계서의 disallowedTools 표기는 "D1 보류(미구현)"로 통일됨(완료) — 코드 변경 시 이 상태를 유지(canUseTool 1단). `maxTurns` 세션-스코프 함의(persistent per-turn 캡)는 P1 설계노트로 남긴다. resume 실패는 현행대로 "이 대화는 이어할 수 없습니다" 에러 종료(cold-fallback=Future).
9. **레이어 경계 0 / 게이트 통과.** 신규 `lifecycle/`·`orchestration/` 모듈은 L1 domain(SessionAdapter 주입, electron 비의존). `npm run lint`(boundaries 포함)·`typecheck`·`test` 통과, 신규 의존성 0.
10. **[2026-06-28 결정] 앱-레벨 2축 모듈 구조.** 신규 모듈은 `session/` 하위가 아니라 최상위 **`lifecycle/`**(앱·프로세스·세션 생명주기) + **`orchestration/`**(애플리케이션 레벨 턴/세션 조율)로 신설. SessionRuntime 은 lifecycle 의 구성원. `concurrency-registry.ts`→`orchestration/concurrency.ts` 이전.
11. **[2026-06-28 결정] uv Python runtime 폐기.** `src/main/runtime/` 와 그 배선(`index.ts`·`router.ts` `ensure()`·`context.ts` 타입·`send.ts` `getEnv()` 합류)·system prompt 정책(`policies/python-runtime.md` + `registry.ts`/`loader.ts` 항목)·build(`fetch-uv`·`prepare-runtime`·`electron-builder.yml` extraResources·`scripts/fetch-uv.mjs`)를 제거. **IPC 채널 변경 없음** — `orca:runtime:{status,prepare,statusEvent}` 3채널은 이미 2026-06-11 제거됨(`IPC_CONTRACT.md` §216). 게이트(lint/typecheck/test)가 미참조를 보증하고, `IPC_CONTRACT.md` §216(PythonRuntime 유지 서술)·`app/AGENTS.md`·`app/src/main/AGENTS.md`(runtime 모듈/빌드 스크립트 소개)를 정합화한다. **⚠ 동반(보강 R2-4): `policies/python-runtime.md` 는 "`uv run python` 안내" 정책이자 현재 *유일한 정적 정책*이라 함께 제거 → `stableAppend` 빈 문자열·`ExtensionBuilder` 빈 정책 분기·`buildAppend.test.ts`/`loader.test.ts` 갱신.** 범위가 prompt 서브시스템까지 번지므로 **C4 별도 PR 권장**. (상세 체크리스트 보강 §5/R2-4.)

## 범위 / 비범위

- **범위 (P0)**: 앱-레벨 2축 모듈(`lifecycle/`·`orchestration/`) 신설 + SessionRuntime 인터페이스 + OneShot 구현, 상태머신(단일 소유·비영속), TurnRegistry→SessionRuntimeRegistry·concurrency-registry→orchestration 재배치(+축출 훅 예약), StallTimer 개칭 + IdleCloseTimer 분리(인터페이스/stub), resume·부팅 dangling 마감, **uv Python runtime 폐기**(배선·정책·build·IPC 채널 제거), P0 테스트 4종, `send.ts` 를 lifecycle+orchestration 소비자로 박리. 파일트리 재배치(아래 §설계).
- **비범위 (P1, 후속 핸드오프)**: Persistent 핸들 구현·cross-turn 수명·IdleCloseTimer 구현·핸들 cap+LRU·steer/queue UX·멀티세션 동시 라이브 핸들 정책·compaction 액션(`/compact`)·session handoff·maxTurns per-turn 캡·이벤트 ordering/seq·backpressure·렌더러 재연결·Windows 프로세스-트리 정리. (설계서 §5.5 P1 + §6-10)
- **비범위 (Future)**: resume cold-fallback(DB 이력 재구성)·goal 영속 1급화·cross-session 멀티에이전트·deliberation·별도 평가 세션·OpenCode 어댑터. (설계서 §5.5 Future)

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `SessionAdapter.sendMessage`→`LiveTurn`(`adapters/types.ts`), `createTurnInputStream`(`adapters/streaming-input.ts`), `TurnRegistry`/`InflightTurn`(`ipc/chat/turn-registry.ts`), `createIdleTimer`(`ipc/chat/send.ts`), `settleOpenToolRuns`(`send.ts`), DB queries(`db/queries.ts` dangling 조회·tool_result upsert).
- SDK 전제(문서 검증됨): 스트리밍 입력 세션이 다중 메시지·interrupt·"Session stays alive" 지원(`streaming-vs-single-mode.md`). **P0 는 이 전제를 OneShot 으로만 사용**(post-result push 는 P1 에서 비로소 의존).
- **신규 의존성**: 없음(예상). 새 npm 패키지 도입 금지 — 필요 시 ⚠️ 보고만. (uv 폐기로 `scripts/fetch-uv.mjs`·`resources/bin` 의존이 *줄어든다*.)
- **uv 제거 전제(인수 11)**: 코드에 하드코딩 Python MCP 참조 없음(확인). 번들 Python 을 쓰던 사용자는 시스템 Python 폴백 — 영향 사용자는 mcp.json 으로 직접 구성한 경우뿐. ⚠️ 제품 영향이라 사용자 결정 받음(이번 세션: "제거해도 좋다").
- 전제: 기존 531 테스트가 better-sqlite3 ABI 환경에서 일부 red 인 것은 변경 무관(handoff 0019 dual-ABI). 신규 단위 테스트는 electron 비의존이라 영향 없음.

## 설계

### A. 파일트리 재배치 (모듈화)

**두 축을 앱-레벨 최상위 모듈로 신설한다** — 설계서의 두 렌즈(8계층 lifecycle / 7요소 orchestration)와 1:1. `lifecycle/` 은 앱·프로세스·세션 *생명주기*(부팅·감시·종료/복구)를 표현하고, `orchestration/` 은 *애플리케이션 레벨 턴/세션 조율*(워크플로 하네스 §1.5)을 표현한다. SessionRuntime 은 `session/` 같은 별도 부모가 아니라 **lifecycle 의 한 구성원**이다. 둘 다 L1 domain 으로, `SessionAdapter`(L2)를 *주입*받아 하향 의존을 깬다(dependency inversion) → electron 비의존·vitest 가능.

**uv Python runtime 제거(Q2 결정: 0049 포함)**: `src/main/runtime/`(uv 격리 Python)은 코드상 하드코딩 Python MCP 의존이 없어 *번들 Python 을 쓰는 사용자에게만* 필요 → 폐기. turn env 의 `getEnv()` 합류·`policies/python-runtime.md` 정책·build(`fetch-uv`·`extraResources`)를 제거한다. **IPC 채널은 무변경**(`orca:runtime:*` 는 2026-06-11 이미 제거, `IPC_CONTRACT.md` §216). 상세 잔재 체크리스트는 보강 §5.

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

[목표] 두 축을 앱-레벨 최상위 모듈로 (둘 다 L1 domain, 순수·주입식)
  lifecycle/                       ★ 신규 — 앱·프로세스·세션 생명주기
    session-runtime.ts   ── SessionRuntime: 핸들 수명 + close 정책(OneShot) + coarse 상태 소유
    session-state.ts     ── 상태머신(cold/live/busy/interrupting/error/closed) 순수 전이
    session-registry.ts  ── SessionRuntimeRegistry: 세션-스코프 핸들+coarse 상태만(turn-registry.ts 를 *분할* — 개명 아님; god-object 는 turn-context 로). 축출 훅 예약
    timers.ts            ── StallTimer(← send.ts createIdleTimer 이전·개명) + IdleCloseTimer(stub)
    recovery.ts          ── dangling tool 마감(부팅·resume) + 부팅 시 전 세션 cold 재구축
    turn-context.ts      ── InflightTurn 의 *턴-로컬* 잔여(ask페어링·subagent·title)만 분리
    *.test.ts            ── P0 테스트 4종
  orchestration/                   ★ 신규 — 애플리케이션 레벨 턴/세션 조율(워크플로 하네스 §1.5)
    concurrency.ts       ── (← ipc/chat/concurrency-registry.ts 이전) 동시성 정책
    admission.ts         ── steer/queue 입력 admission seam (P0 stub, P1 구현)
    (turn-loop 정책)      ── 턴 시퀀싱 결정의 순수 부분(IPC 구동은 send.ts 에 잔존)
  adapters/
    claude.ts            ── LiveTurn 반환 유지, close 정책은 SessionRuntime 이 제어(close-on-result 호출자 이동)
    streaming-input.ts   ── push() 시그니처만 예약(P0 미사용), 구현은 P1
    types.ts             ── LiveTurn 유지 + (선택) SessionRuntime 소비 타입
  ipc/chat/
    send.ts              ── lifecycle+orchestration 소비자로 박리(상태/타이머/레지스트리/동시성 위임 → 더 얇게)
  ✗ runtime/                       ── uv Python 런타임 폐기(Q2: 0049 포함). index/router/context/send 배선 제거
```

- **레이어**: `lifecycle/`·`orchestration/` 둘 다 L1 domain. `SessionAdapter` 는 컴포지션 루트(`ipc/router.ts`·`index.ts`)가 주입. `ipc/chat/send.ts`(L3)가 둘을 소비·구동. boundaries: lifecycle/orchestration→adapters 직접 의존 금지(주입 역전), →shared·동일/하위 레이어만. orchestration→lifecycle(L1 내부) 허용, 역방향 금지.
- **`boundaries/elements`**: `src/main/lifecycle`·`src/main/orchestration` 은 기본 L1 domain 분류(별도 등록 불필요). 단 `src/main/runtime` 제거에 따라 elements 에 `runtime` 잔재가 있으면 정리 — `app/eslint.config.mjs` 확인.

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

- close-on-result 판정(`if msg.type==='result'`)을 `claude.ts:335`(어댑터)에서 SessionRuntime(OneShot 정책)으로 **끌어올린다**. ⚠ `input` 은 `claude.ts` 로컬 변수라 외부가 못 닫는다 → **`LiveTurn.close()` 명시 계약을 신설**(`adapters/types.ts`)해야 한다. 어댑터는 result 후 *자동 close 하지 않고*, 스트림 소진/취소 시 `events()` finally 의 멱등 close 와 SessionRuntime 의 `close()` 호출이 한 책임으로 수렴한다. 상세 계약은 보강 §3.
- 상태 전이는 `session-state.ts` 순수 함수(`transition(state, event)`). SessionRuntime 이 NormalizedEvent/제어를 보고 호출. `InflightTurn.cancelled/timedOut/live` 는 `runtime.state` 파생 getter 로 대체(별도 SSOT 제거).

### C. 타이머 분리 (인수 4)

- `send.ts:createIdleTimer`/`IDLE_TIMEOUT_MS` → `lifecycle/timers.ts` 의 **`StallTimer`**(busy 중 무이벤트 N초→`turn.controller.abort()`, 의미·동작 보존). beginPause refcount(승인 대기) 로직 그대로 이전.
- **`IdleCloseTimer`**: live-idle 중 N분→핸들 close 인터페이스만 정의(P0 stub, busy 중 미발동 가드는 상태머신이 보장 — ⑤). 구현 P1.

### D. dangling 복구 (인수 5)

- `lifecycle/recovery.ts`: 부팅(`router.start`)·resume 진입 시 DB 에서 dangling part(`type='tool_call'` 에 같은 `tool_run_id` 의 `type='tool_result'` 없음)를 조회→`tool.call.completed`(reason:'interrupted') 합성·persist. `send.ts:settleOpenToolRuns` 의 *부팅판*. ⚠ DB-only 복구라 조회가 **`message_id`(append 대상)·`tool_run_id`·부모/자식 transcript 판별 payload** 를 반드시 함께 반환해야 한다 — `upsertToolResultPart(messageId, toolRunId, payloadJson)` 가 append fallback 에 `message_id` 를 요구하기 때문(`queries.ts:288`, schema `0004_message_parts.sql`: message_id·idx·type·tool_run_id·payload_json). 신규 쿼리 명세는 보강 §2(라운드1). **추가(보강 R2-5): 같은 복구에서 orphaned incomplete assistant message(`complete=0`)도 `markComplete`(complete=1) 한다** — tool 만 닫고 메시지를 incomplete 로 두면 "도구 완료/응답 미완료" 혼합 상태가 된다. 멱등(upsert + markComplete).

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

- 되돌리기 어려운 결정: 최상위 모듈 경로(`src/main/lifecycle/`·`src/main/orchestration/`) 신설 + `src/main/runtime/`(uv) 폐기 — 다른 import 가 붙기 전에 확정.
- ~~모듈 디렉토리명 Open Question~~ **✅ 결정(2026-06-28 사용자)**: `session/` 하위가 아니라 **앱-레벨 최상위 `lifecycle/` + `orchestration/`**(라이프사이클=앱/프로세스/세션 생명주기, 오케스트레이션=애플리케이션 레벨 조율). SessionRuntime 은 lifecycle 의 구성원. `runtime/`(uv) 폐기로 이름 충돌 해소.
- 추가 리스크(uv 제거): 번들 Python MCP 를 쓰던 사용자는 시스템 Python 으로 폴백(없으면 해당 MCP 실패). 완화 — 코드상 하드코딩 Python MCP 없음 확인, system prompt 정책 제거로 모델 오안내 방지. 되돌림은 git revert(0049 단위).

## 영향 받는 파일

- 신규(lifecycle): `app/src/main/lifecycle/{session-runtime,session-state,session-registry,timers,recovery,turn-context}.ts` + `*.test.ts`
- 신규(orchestration): `app/src/main/orchestration/{concurrency,admission}.ts` + `*.test.ts`
- 이전/개명: `ipc/chat/turn-registry.ts`→`lifecycle/session-registry.ts`(SessionRuntimeRegistry), `send.ts:createIdleTimer`→`lifecycle/timers.ts`(StallTimer), `ipc/chat/concurrency-registry.ts`→`orchestration/concurrency.ts`
- 수정: `adapters/claude.ts`(close 정책 호출자 이동), `adapters/streaming-input.ts`(push 시그니처 예약), `ipc/chat/send.ts`(lifecycle+orchestration 소비자로 박리), `ipc/router.ts`(부팅 recovery 배선 + uv 배선 제거), `adapters/types.ts`(소비 타입), `db/queries.ts`(dangling 조회), `ipc/context.ts`(runtime 타입 제거)
- **제거(uv)**: `src/main/runtime/`(PythonRuntime·env·paths·index + `RuntimeStage`/`RuntimeStatus` 타입), `prompts/policies/python-runtime.md` + `prompts/registry.ts`·`loader.ts` 항목, `index.ts`·`router.ts`(`ensure()`·`status` on 핸들러)·`context.ts`(runtime 타입) 의 uv 배선, `send.ts:buildTurnEnv`/`getEnv()` 합류, `package.json`(`predev:fetch-uv`·`prepare-runtime`·`fetch-uv`)·`scripts/fetch-uv.mjs`·`electron-builder.yml` extraResources·`resources/bin`. **IPC 채널 무변경**(`orca:runtime:*` 이미 제거됨, 2026-06-11) — `IPC_CONTRACT.md` §216 의 "PythonRuntime 유지" 서술만 갱신.
- 문서: `docs/arch/backend/provider-runtime.md`(lifecycle/orchestration·SessionRuntime·상태머신 1급화), `docs/IPC_CONTRACT.md`(runtime:status 채널 제거), `docs/PHASES.md`(uv 런타임 행 정리·현재 작업중→승격), `app/AGENTS.md`·`app/src/main/AGENTS.md`(runtime 모듈 언급 제거·신규 2모듈 추가)

## 참고 문서

- **설계 정본**: `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md`(리뷰 8건 반영본)
- **기준자**: `docs/etc/lifecycle_management_ko.md` · `docs/etc/orchestration_report_ko.md`
- **real-world**: `docs/etc/study/opencode/{lifecycle,orchestration}_analysis_ko.md` · `docs/etc/study/hermes-agent/{lifecycle,orchestration}_analysis_ko.md`
- **SDK 원문**: `docs/spec/claude/agent-sdk/streaming-vs-single-mode.md`
- **구조**: `docs/arch/backend/provider-runtime.md`(§3 PermissionBridge·NormalizedEvent) · `app/src/main/AGENTS.md`(레이어 DAG)
- IPC 변경 시: `docs/IPC_CONTRACT.md`(§6 변경 절차 — 동시 갱신)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구(인수 6): `lifecycle/session-state.test.ts`(전이) · `lifecycle/recovery.test.ts`(dangling 마감) · `lifecycle/session-runtime.test.ts`(모드-불변 — OneShot vs Persistent-stub 동일 스트림) · `lifecycle/timers.test.ts`(StallTimer 회귀: busy 무이벤트→abort).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(라이브 세션)·리뷰 8건 출처 인용, 추론은 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`·SDK 원문) 부착.
- [x] 인수 기준 — 11개 번호(리뷰 8건 + 2축 모듈 구조 + uv 폐기), 검증 가능.
- [x] 의존 기술 — 기존 모듈 식별, 신규 의존성 0, uv 제거 영향·사용자 승인 명시.
- [x] 파생 UX — 부팅 cold·크래시 복구·resume 실패·멀티세션 + uv 제거 시 Python MCP 폴백.
- [x] 리스크 — 파일이동·god-object 분해·close 정책 이동·SSOT drift·스코프크리프·uv 제거 + 모듈명 Open Question 해소(2축 최상위).

## 설계 보강 — 구현 전 검토 라운드 (Codex 자문, plan/READY 유지)

> **Provenance**: 아래는 **구현 착수 전** plan 을 강화한 *설계 라운드* 다 — 모두 `plan/DRAFT→READY` 구간(아직 impl 턴 진입 전, 코드 0줄)에서 Claude(설계자)가 Codex 의 자문 검토를 반영한 것. 라이프사이클상 `impl/IN_PROGRESS` 가 아니다. 따라서 문서 하단의 **`[구현자 기입]` 블록은 여전히 비어 있어야 정상**이며, 실제 구현 턴에서 Codex 가 채운다. verify 는 "이 라운드들 = 구현 전 설계 강화 / `[구현자 기입]` = 구현 중 기록"으로 구분한다.

### 라운드 1 — Codex 1차 자문 (6건)

### 보강 1 — SessionRuntimeRegistry ↔ TurnContext 수명 분리 (개명 아님, 분할)
`turn-registry.ts:InflightTurn` 은 핸들 레지스트리가 아니라 *턴-로컬 god-object*(`pendingUserText`·`pendingAttachmentViews`·`currentAssistantMessageId`·`assistantText`·`pendingAskAnswers`·`askPendingIds`·`askResolved`·`subagentTaskIds`·`openToolRuns`·`subagentTypes`·`blockedSubagents`·`stoppedSubagents`)다. "이전·개명"이 아니라 **두 수명으로 분할**한다:
- **`lifecycle/session-registry.ts` (세션-스코프)**: `Map<sessionId, SessionRuntime>` + **`pendingByOwner` + `promote(runtime, sessionId)` 보존**(보강 R2-6 — sessionId 미발급 새-채팅을 owner 키로 두다 `session.updated` 시 승격, handoff 0040 owner-동일성 가드 포함). 핸들 + coarse 상태 + 축출 훅. *오직* 세션 수명.
- **`lifecycle/turn-context.ts` (턴-스코프)**: 위 턴-로컬 필드 전부. SessionRuntime 이 턴마다 생성/폐기. 인수 3("상태머신 단일 소유, InflightTurn 파생")이 흐려지지 않게, 이 둘을 한 객체로 합치지 않는다.

### 보강 2 — dangling recovery DB 쿼리 명세 (반쪽 복구 방지)
신규 쿼리 `findDanglingToolCalls()` 반환 행 = `{ message_id:number, tool_run_id:string, session_id:string, payload_json:string }`. 조건: `mp.type='tool_call'` AND `NOT EXISTS (같은 message scope 에 mp2.tool_run_id=mp.tool_run_id AND mp2.type='tool_result')`. 복구는 각 행에 `upsertToolResultPart(message_id, tool_run_id, payloadJson)` — `message_id` 가 있어야 append fallback(`queries.ts:110-113` `MAX(idx)+1`) 이 동작한다. 부모/자식 transcript 판별이 필요하면 `payload_json`(parentToolRunId)에서 파생. **`tool_run_id` 만 찾는 update-only 복구는 금지**(append 누락 → 반쪽 복구).

### 보강 3 — LiveTurn.close() 계약 (close 정책 이동 안전화)
현재 `LiveTurn`(`adapters/types.ts:17-26`)에 `close()` 없음. close 정책을 런타임으로 올리려면:
- `adapters/types.ts`: `LiveTurn` 에 `close(): void`(멱등) 추가. claude 어댑터는 내부 `input.close` 를 여기 위임.
- 어댑터는 result 후 **자동 close 하지 않는다**(현 `claude.ts:335` 의 `if result input.close()` 제거). 대신 OneShot SessionRuntime 이 result 이벤트를 보고 `live.close()` 호출.
- `events()` generator 의 finally(`claude.ts:347-351`) 멱등 close 는 *누수 백스톱*으로 유지(중복 호출 무해). **종료 권위 = SessionRuntime, 백스톱 = finally** 로 책임 명문화.
- ⚠ `LiveTurn.close()` 추가는 **모든 어댑터 구현체**(claude·`mock.ts`·향후 opencode)에 동시 적용해야 typecheck green — 보강 R2-2.

### 보강 4 — mode-invariance 테스트 경계 (Persistent 미구현과 양립)
인수 1(Persistent 구현 안 함)과 충돌 제거: P0 테스트는 *Persistent 동작*이 아니라 **소비자가 close 정책 타입에 무지함**을 검증한다. fixture = `FakeSessionRuntime`(동일 `send()` 인터페이스, close 정책을 생성자 파라미터로 받아 OneShot/가짜-persistent 두 모드 흉내). 테스트는 두 모드에서 `send.ts` 소비 결과(persist 호출·이벤트 순서)가 동일함만 본다. 실제 Persistent 클래스는 P1.

### 보강 5 — uv 제거 잔재 체크리스트 (코드·문서·빌드, IPC 무변경)
- 코드: `src/main/runtime/**` 삭제 · `index.ts`/`router.ts`(`ensure()`·`on('status')`·`runtime:statusEvent` 송출 잔재)/`context.ts`(`runtime` 필드·타입)/`send.ts`(`buildTurnEnv` 의 `getEnv()` 인자) 정리 · `src/shared/ipc.ts` 의 구 런타임 타입 이동 주석 제거.
- 빌드: `package.json`(`predev`·`fetch-uv`·`prepare-runtime`) · `scripts/fetch-uv.mjs` · `electron-builder.yml` extraResources · `resources/bin`.
- 문서: `app/AGENTS.md`(스택 표·빌드/실행 표의 uv 행)·`app/src/main/AGENTS.md`(L1 domain 목록의 `runtime`)·`docs/IPC_CONTRACT.md` §216(PythonRuntime 유지 서술 → 제거됨으로 갱신)·`docs/PHASES.md`(uv 런타임 행).
- **IPC 채널: 무변경**(`orca:runtime:*` 3채널 이미 2026-06-11 제거). 새 채널 추가/삭제 없음.

### 보강 6 — 단계별 커밋 경계 (회귀 국소화)
한 커밋에 "리팩터+기능+런타임 제거"를 섞지 않는다. **구현 순서(각 단계 게이트 green 후 다음)**:
1. **C1 lifecycle 추출(무동작 변화)**: `turn-registry`→`session-registry`+`turn-context` 분할, `createIdleTimer`→`timers.ts(StallTimer)`, `concurrency-registry`→`orchestration/concurrency`. 배럴 re-export 로 import 무회귀. send.ts 는 새 경로만 소비(로직 동일).
2. **C2 SessionRuntime + 상태머신**: OneShot SessionRuntime 도입, `LiveTurn.close()` 계약(보강 3), close 정책 이동, 상태 SSOT 화(InflightTurn 플래그→파생). 모드-불변 테스트(보강 4).
3. **C3 dangling recovery**: `recovery.ts` + `findDanglingToolCalls`(보강 2) + 부팅/resume 배선 + 재현 테스트.
4. **C4 uv 폐기**: 보강 5 체크리스트 + 문서 정합.
- 각 단계는 독립 리뷰 가능. C1 은 순수 이동(diff 큼·위험 낮음), C2 가 핵심 위험, C4 는 분리 가능(원하면 별도 PR). send.ts "박리"는 C1~C2 에 분산돼 한 번에 재작성하지 않는다.

### 라운드 2 — Codex 2차 자문 (6건)

#### 보강 R2-1 — provenance 정정
위 "Provenance" 노트로 해소: 라운드 1·2 는 *구현 전 설계 강화*(plan/READY), `[구현자 기입]` 은 impl 턴 전용으로 비워 둔다. 날짜가 아니라 **라운드 번호**로 추적한다.

#### 보강 R2-2 — `LiveTurn.close()` 는 *모든* SessionAdapter 구현체에 적용
보강 3 의 close 계약은 claude 뿐 아니라 **`LiveTurn` 을 반환하는 모든 어댑터**에 동시 적용해야 typecheck green. 현재 구현체: `adapters/claude.ts`, **`adapters/mock.ts`(:39-56 — `close()` 없음, C2 에서 추가 필수)**, 향후 opencode. `adapters/mock-scenarios.ts` 도 LiveTurn 생성 시 동일. C2 acceptance: `grep "sendMessage" src/main/adapters/*.ts` 의 모든 생산자가 `close()` 구현.

#### 보강 R2-3 — C1 은 send.ts 호환 re-export 로 "무동작" 보장
`send.runtime-resilience.test.ts:2` 가 `./send` 에서 `createIdleTimer, IDLE_TIMEOUT_MS, abortableDelay, RETRY_BACKOFF_MS` 를 import. C1 에서 `createIdleTimer`·`IDLE_TIMEOUT_MS` 만 `lifecycle/timers.ts` 로 옮기되, **`send.ts` 가 `export { createIdleTimer, IDLE_TIMEOUT_MS } from '../../lifecycle/timers'` 로 re-export** 해 기존 import 경로를 유지(무회귀). `abortableDelay`·`RETRY_BACKOFF_MS` 는 retry 로직이라 **이동 안 함**(send.ts 잔류). C1 게이트 = 테스트 import 무수정 통과.

#### 보강 R2-4 — uv 제거는 **유일 정적 정책(python-runtime) 제거**를 동반 (범위 확정)
`prompts/policies/python-runtime.md` 는 모델에게 *"`uv run python` 을 쓰라"* 고 지시하는 정책이고(`registry.ts:30` — **현재 유일한 정적 정책**), `loader.ts:7,13`·`extensions/builder.ts:6,42` 의 `stableAppend` 가 이를 항상 시스템 프롬프트에 합류시킨다. **결정: uv 제거 = 이 정책도 제거**(uv 없는데 uv 안내는 거짓). 결과: `registry.ts` 정책 0개·`stableAppend` 빈 문자열 → `ExtensionBuilder` 가 instructions 만 append(빈 정책 분기). **테스트 갱신 필수**: `buildAppend.test.ts`·`loader.test.ts`·registry 관련. → uv 제거가 prompt 서브시스템까지 번지므로 **C4 를 별도 PR 로 분리 권장**(범위 격리). *대안*(원하면): 정책을 system-Python 안내로 *재작성*해 stableAppend 유지 — 단 "uv 폐기" 취지와 어긋나므로 비권장.

#### 보강 R2-5 — dangling recovery 는 incomplete assistant message 도 마감
크래시/중단 시 assistant message 는 `complete=0` 으로 남는다(`persist.ts:57` 삽입, `queries.ts:106` `complete=1` 마감, schema `0009_message_complete.sql`). recovery 가 tool_result 만 닫고 메시지를 incomplete 로 두면 UI 가 "도구 완료/응답 미완료" 혼합 상태를 본다. **recovery 는 dangling tool 정착 + 해당 메시지 `markComplete`(complete=1) 를 함께** 수행한다(부팅 시 그 턴은 재개 불가 — 죽은 프로세스). §D 에 반영.

#### 보강 R2-6 — SessionRuntimeRegistry 는 pending 새-채팅 승격 semantics 보존
현 `TurnRegistry` 는 sessionId 미발급 새-채팅을 `pendingByOwner` 에 두고 `session.updated` 시 `promote(turn, sessionId)`(handoff 0040 — owner 동일성 가드로 resume 턴 오승격 방지). SessionRuntimeRegistry 는 `Map<sessionId, SessionRuntime>` *만이 아니라* **pendingByOwner + promote 도 유지**해야 한다(보강 1 의 session-registry 가 그대로 계승). 인수: `startNew`/`promote`/`finish` semantics 와 0040 가드 회귀 테스트 보존.

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

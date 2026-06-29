# Plan — 0053-runtime-supervisor-spine

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A staging P1 의 **Runtime Supervisor(세로축 unit #3) 척추 추출 + 단일 멱등 close/abort 경로** — 비기능 리팩토링(= Claude 직접 plan→impl→verify).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0053-runtime-supervisor-spine` |
| 작성자 | Claude Code |
| 일자 | 2026-06-29 |
| 매핑 | PHASES (verify 승격 시) / PR (사용자 요청 시) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 51 구현을 해야한다. 수석 개발자의 실무적 관점에서 orca 개발방침을 준수하며, 모듈화/추상화를 적극 도입하여 어떻게 구조적 개발할지 비판적 검토를 진행하라." | 라이브 세션 요청(2026-06-29) |
| 명시 요구 | 범위 = **Supervisor 척추 먼저**(RuntimeSupervisor 추출 + 단일 멱등 close/abort, 정책·죽은 코드 없이); 기록 = **신규 0053 핸드오프** | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | 0051(문서전용)·0052(TurnCoordinator)는 완료 → "51 구현"의 잔여 실질은 §A staging P1 의 **라이프사이클 자원 supervision**(세로축 unit #3). Persistent 가 없는 OneShot 에선 idle 핸들이 없어 idle/LRU/IdleClose 가 죽은 코드 → **척추(소유자 + 멱등 teardown)만 먼저** 세우고 정책은 0054 로 분리 (추론, AskUserQuestion 으로 확인됨) | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A.5` |

## Context (왜)

0050(P0)·0052(가로축 TurnCoordinator)가 끝났고, §A.5 P1 의 잔여는 **라이프사이클 자원 supervision** 묶음(Persistent runtime·cap/LRU·IdleCloseTimer·idempotent close)이다. 결정 ⑭ 의 판별식("없으면 *리소스가 샌다* → 라이프사이클")대로 이들은 §A 세로축 **unit #3 = Runtime Supervisor/Registry** 에 귀속한다. 그러나 현재 그 unit 은 1급 모듈이 아니라 keying 만 하는 `SessionRuntimeRegistry`(예약 스텁 `evictIdle` no-op·`maxIdleRuntimes` 미사용)이고, **teardown(finish)·abort(markAborted+abort) 프리미티브가 `send.ts`·`timers.ts` 에 산재**한다.

비판적 핵심: idle/LRU/IdleClose 는 **핸들이 idle 로 살아남는 Persistent 전까지 죽은 코드**다. 그래서 이 증분은 정책을 더하지 않고 **(a) Runtime Supervisor 를 1급 소유자로 추출**하고 **(b) 산재한 teardown/abort 를 단일 멱등 경로로 통합**한다 — 동작 보존. Persistent + 정책(cap/LRU/IdleClose)이 plug-in 할 seam 을 확정해 0054 를 de-risk 한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| §A 세로축 unit #3 = "Runtime Supervisor/Registry (SessionRuntime 집합: cap/LRU/busy 보호)"; cap/LRU/idle-close 가 세는 유닛 = SessionRuntime(자원) | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A.2·§A.3` |
| §A.5 staging: P1 = TurnCoordinator(✅0052)·**Persistent·steer/queue·IdleCloseTimer·Supervisor cap/LRU·idempotent close 단일 경로** | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A.5` |
| abort 프리미티브 `turn.live?.markAborted?.(cause); turn.controller.abort()` 가 chatCancel·stall 두 곳에 동일 코드로 중복; onOwnerGone 은 `turn.live` 가 아니라 **runtime 을 직접** mark(턴 시작 전 창 대비) | `app/src/main/ipc/chat/send.ts:291,424` · `app/src/main/lifecycle/timers.ts:20` |
| 레지스트리 수명: `startResume/startNew`·`promote`·`finish` 가 send.ts·coordinator 에 분산; finish 의 유일 호출자는 send.ts finally | `app/src/main/ipc/chat/send.ts:257,413` · `app/src/main/lifecycle/turn-coordinator.ts:118` |
| 레지스트리 소비자: `send.ts`(키잉·dup-guard)·`approvals.registerHandlers`(getBySession)·`router.shutdown`(all) | `app/src/main/ipc/chat/approvals.ts:85` · `app/src/main/ipc/router.ts:199` |
| `evictIdle()`·`maxIdleRuntimes` 는 0050 의 의도된 reserved hook(no-op) | `app/src/main/lifecycle/session-registry.ts:48` · `session-registry.test.ts:114` |
| L1 supervisor 가 L1 registry/turn-context/session-state 를 import(하향, 동일 레이어) — timers→supervisor 도 무순환(supervisor 는 timers 비참조) | `@app/src/main/AGENTS.md`(L1 DAG·no-cycle) |

## 인수 기준 (Acceptance Criteria)

1. **RuntimeSupervisor(L1) 신설.** `lifecycle/supervisor.ts` 가 `SessionRuntimeRegistry` 를 소유(래핑)하고 §A 세로축 unit #3 으로 안착한다 — 조회/등록/승격 위임 + `release(turn)`(단일 멱등 teardown) + 0054 seam(cap admission·idle/LRU·IdleClose·ConcurrencyRegistry 이관) 주석.
2. **단일 abort 프리미티브.** `abortTurn(turn, cause)`(supervisor.ts export)가 `turn.live?.markAborted?.(cause); turn.controller.abort()` 를 한 곳에 모은다. `chatCancel`·stall 타임아웃이 공유. `onOwnerGone` 은 **의도적 예외**(runtime 직접 mark — 턴 시작 전 창 보존, 주석 명시).
3. **단일 멱등 close.** `release(turn)` 는 WeakSet 가드로 2회 이상 호출돼도 registry.finish 효력 1회. send.ts finally 의 `turns.finish` 를 대체(동작 보존). 0054 의 self-idle close vs LRU eviction 합류 지점.
4. **컴포지션 루트 배선 + 무회귀 정리.** `router.ts` 가 `RuntimeSupervisor` 를 생성해 chat 핸들러·approvals·shutdown 에 주입. `ChatDeps.turns`→`supervisor`, `approvals.registerHandlers(supervisor,…)`. 죽은 `TurnRegistry` alias·배럴 value re-export 제거(타입 배럴만 유지). 동작·이벤트 시퀀스 무변경.
5. **단위테스트 신설.** `supervisor.test.ts`(abortTurn 3종·release 멱등·다중 턴 finish·조회 위임·기본 배선). 게이트 typecheck/lint(boundaries·no-cycle 0)/test/build 통과(기존 환경성 실패 제외).

## 범위 / 비범위

- **범위**: Runtime Supervisor(세로축 unit #3) 척추 추출 + 단일 멱등 close(`release`)/abort(`abortTurn`) 통합 + 컴포지션 루트 배선 + 죽은 alias 정리 + 단위테스트. **동작 보존 리팩토링**(이벤트 시퀀스·DB parts·UX 무변경, 정책 0).
- **비범위(후속 핸드오프 0054)**: ① Persistent SessionRuntime(close-policy variant, 결정 ⑳) ② cap admission 정책(reject/queue) ③ LRU/idle eviction(`evictIdle` 실구현) ④ IdleCloseTimer 실구현 ⑤ ConcurrencyRegistry 의 supervisor 소유 이관 ⑥ steer/queue admission ⑦ `orchestration/`→supervision 코드 리네임(0051 결정 2) ⑧ Conversation Continuity(§A Future).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `SessionRuntimeRegistry`(L1)·`TurnContext`/`AbortCause`(L1)·`RuntimeLiveTurn.markAborted`(L1 ports). 컴포지션 루트=`router.ts`(L3).
- 전제: `OneShotSessionRuntime` 단일 변종 유지(Persistent=0054). registry 의 reserved `evictIdle`/`maxIdleRuntimes` 그대로 보존.
- **신규 의존성**: 없음.

## 설계

- **RuntimeSupervisor(L1)** — `lifecycle/supervisor.ts`. 생성자 주입 `registry = new SessionRuntimeRegistry()`(테스트는 spy 주입). 조회(`getBySession`/`hasSession`/`hasPending`/`all`/`size`)·등록(`startResume`/`startNew`)·승격(`promote`)을 위임하고, `release(turn)` 가 WeakSet 멱등 가드 → `registry.finish`. 0054 seam 을 주석으로 명시.
- **abortTurn(turn, cause)** — 같은 모듈의 **standalone export**(supervisor 상태 불필요한 turn-level 프리미티브). `timers.ts`·`send.ts` 가 import. supervisor 가 timers 를 import 하지 않아 순환 없음.
- **onOwnerGone 예외** — `turn.live` 가 set 되기 전(coordinator.run 진입 전) owner 가 사라질 수 있어 `runtime.markAborted` 를 직접 호출(주석으로 근거 명시). 나머지 두 site(chatCancel·stall)만 `abortTurn` 으로 통합.
- 레이어: 신규 전부 L1 lifecycle. router.ts(L3)가 컴포지션 루트로 supervisor 배선. approvals(L3)는 `RuntimeSupervisor<unknown>` 의 `getBySession` 만 사용.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 동시성/멀티세션: 동시 턴 가드(`hasSession`/`hasPending`)·세션키 라우팅·shutdown 순회(`all`) **동작 보존**.
- 엣지케이스(보존): chatCancel 의 **낙관적 settle + turn.aborted forward 는 그대로**(척추는 abort/finish 통합만), stall pause refcount(timers), promote-on-session.updated, owner-gone pre-run mark.
- UI/시각: 없음(순수 main-side 리팩토링, NormalizedEvent 시퀀스 불변).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| onOwnerGone 을 abortTurn 으로 단순 통합하면 pre-run 창에서 runtime mark 누락(동작 변경) | onOwnerGone 은 의도적 예외로 유지(runtime 직접 mark) + 주석 근거. "3중복"은 실제 2 동일 + 1 변종 |
| release 멱등 가드가 현재 단일 호출자라 과해 보임 | 0054 의 self-idle/LRU 합류 seam — 지금 세워 두면 정책 추가 시 이중 정리 안전. 테스트로 잠금(죽은 코드 아님) |
| 컴포지션 루트 배선 광역 변경(turns→supervisor 다수 site) | 동작 보존(이벤트/DB 무변경) + 게이트(typecheck/lint/test)로 회귀 차단 |

- 되돌리기 어려운 결정: 없음(순수 구조 추출, 동작 동일).
- 단독 결정 금지 항목: 없음(범위·기록 방식은 AskUserQuestion 으로 확정).

## 영향 받는 파일

- 신규: `app/src/main/lifecycle/{supervisor.ts, supervisor.test.ts}`
- 수정: `app/src/main/lifecycle/timers.ts`(abortTurn 사용)·`app/src/main/lifecycle/session-registry.ts`(죽은 alias 제거)·`app/src/main/ipc/chat/send.ts`(supervisor 배선·abortTurn·release)·`app/src/main/ipc/chat/approvals.ts`(supervisor param)·`app/src/main/ipc/chat/turn-registry.ts`(타입 배럴만)·`app/src/main/ipc/router.ts`(supervisor 생성·주입·shutdown)
- 문서: `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A.3/§A.5`·`docs/arch/backend/provider-runtime.md`·`docs/handoff/INDEX.md`

## 참고 문서

- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A`(세로축 unit #3·staging) · `@docs/arch/backend/provider-runtime.md`(Supervisor 포인터) · `@app/src/main/AGENTS.md`(L0→L3 DAG·no-cycle)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`(+`npm run build`).
- 신규 테스트: supervisor(abortTurn·release 멱등·조회 위임).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용, 추론은 추론 표기(AskUserQuestion 확인).
- [x] 자료조사 — 모든 발견에 `파일:라인`·`@docs/…` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — 재사용 모듈 식별, 신규 의존성 0.
- [x] 파생 UX — 동시성/엣지케이스(불변식) 펼침, onOwnerGone 예외 명시.
- [x] 리스크 — 동작 보존·순환 회피·정책 비범위 분리.

---

> **[구현자 기입]** — Claude 직접 구현(비기능).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: §A.5 P1 의 idle/LRU/IdleClose 는 Persistent 가 idle 핸들을 만들기 전엔 죽은 코드 — "척추 먼저, 정책 0054" 가 죽은 코드를 피하는 올바른 분할. Supervisor 를 1급 소유자로 두면 0054 의 self-idle/LRU 가 `release` 단일 경로로 합류한다.
- 이견 / 보강: abort "3중복" 은 실제로 2 동일(chatCancel·stall) + 1 변종(onOwnerGone=runtime 직접). 변종을 무리하게 통합하면 pre-run mark 누락 → **onOwnerGone 은 예외로 남기고 근거 주석**. abortTurn 은 supervisor 메서드가 아니라 **standalone**(turn-level 프리미티브, supervisor 상태 불필요 + timers 가 supervisor 인스턴스 없이 호출). 죽은 `TurnRegistry` alias·배럴 value re-export 는 소유 이관으로 무용 → 제거(타입 배럴만 유지).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | onOwnerGone 이 `turn.live` 가 아니라 `runtime` 을 직접 mark — abortTurn 통합 시 pre-run 창 동작 변경 | ✅ 구현함 — onOwnerGone 유지 + 근거 주석, chatCancel·stall 만 abortTurn 통합 | `send.ts:286-295` (turn.live 는 coordinator.run:97 에서 set) |
| 2 | `chatCancel` 의 낙관적 settle + turn.aborted forward 가 finish 와 별개 | ✅ 구현함 — settle/forward 핸들러에 그대로 유지, abort 만 abortTurn 으로 | `send.ts:428-433` |
| 3 | 소유 이관 후 `TurnRegistry` alias·배럴 value re-export 가 dead | ✅ 구현함 — alias·value re-export 제거, `turn-registry.ts` 는 InflightTurn/TurnContext 타입 배럴만 | `session-registry.ts:58`·`turn-registry.ts:2` |

## [구현자 기입] 구현 체크리스트

- [x] `lifecycle/supervisor.ts` — RuntimeSupervisor(release 멱등·조회 위임·0054 seam) + standalone abortTurn
- [x] `lifecycle/timers.ts` — stall 콜백 → abortTurn
- [x] `ipc/chat/send.ts` — ChatDeps.supervisor·hasSession/hasPending/startResume/startNew·registry 주입·abortTurn(chatCancel)·release(finally)·getBySession(handlers)·onOwnerGone 주석
- [x] `ipc/chat/approvals.ts` — registerHandlers(supervisor) + getBySession
- [x] `ipc/router.ts` — RuntimeSupervisor 생성·주입(chat·approvals)·shutdown(all)
- [x] 죽은 alias 정리(`session-registry.ts`·`turn-registry.ts`)
- [x] `lifecycle/supervisor.test.ts`

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 2(supervisor·supervisor.test) + 수정 6(timers·session-registry·send·approvals·turn-registry·router) |
| 실행 명령 | `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` |
| 게이트 결과 | typecheck ✅(node+web+test) / lint ✅(boundaries L1↔L3 위반 0·no-cycle 0) / test ✅ 신규 supervisor 7 green + lifecycle 전부 green / 전체 실패 = `db/queries.test.ts` better-sqlite3 Node ABI + electron 바이너리 미설치 suite(persist·resilience) — **환경성**(클린 트리 동일·변경 무관) |
| 블로커 / 역질문 | 환경 제약: electron 바이너리 다운로드(proxy 차단)로 persist·resilience suite import 불가 → 타입체크/lint 로 정합 확인, 실기 회귀는 사람 검증 |
| 대상 커밋 | (push 후 기재) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (없음) | — | — | — |

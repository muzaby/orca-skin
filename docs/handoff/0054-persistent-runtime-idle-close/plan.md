# Plan — 0054-persistent-runtime-idle-close

> 0051 §A staging P1 잔여의 키스톤. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0054-persistent-runtime-idle-close` |
| 작성자 | Claude Code |
| 일자 | 2026-06-29 |
| 매핑 | PHASES 라이프사이클 P1(0050→0052→0053→**0054**) / PR (push 후) |
| 구현 주체 | **Claude** (비기능 — close-policy 추상화 + 거버넌스 배선, 게이트 뒤 동작 보존) |
| 상태 | DRAFT → READY → impl → verify |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 51 구현을 해야한다 … 모듈화/추상화를 적극 도입하여 어떻게 구조적 개발할지 비판적검토. 51에 대한 일부 구현이 52, 53에서 진행됐다" | 라이브 세션(2026-06-29) |
| 명시 확정 | 스코프 = **Persistent + IdleClose 만**(cap/LRU·steer/queue 는 0055); 기본 = **OneShot 유지**, Persistent 는 게이트 뒤 | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | "51 구현" = 문서전용 0051 이 아니라 51 §A 가 그린 **P1 코드 잔여**의 다음 칸(52·53 후속) = 0054 | 0053 plan.md 비범위(0054)·§A.5 footnote 가 0054 를 명시 |

## Context (왜)

0051 은 문서전용 택소노미 정제로 이미 `impl/IMPL_DONE`. 그 P1 구현은 0052(TurnCoordinator)·
0053(Supervisor 척추)으로 쪼개 진행됐다. 0053 은 "idle/LRU/IdleClose 는 Persistent 가 전제라
OneShot 에선 死코드"라며 척추만 세우고 정책을 0054 로 미뤘다. 본 핸드오프 = 그 잔여의 **키스톤
(Persistent runtime + IdleCloseTimer)**. 없으면 cap/LRU·steer/queue(0055)가 모두 死코드다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| decision ⑳ = "streaming-input 메커니즘 1개 + **close 정책 2종**, SessionRuntime 을 close 정책으로 파라미터화. P0 OneShot, Persistent=P1(인터페이스만 P0 고정)" | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §5.4 ⑳` |
| decision ② = IdleCloseTimer(live-idle 핸들 회수)는 StallTimer 와 **분리**(트리거 정반대), **P1·Persistent 전용** | 같은 문서 §5.4 ②·§3.279 |
| §5.5 P1 = "Persistent 핸들 + cross-turn 수명 + IdleCloseTimer + 핸들 cap". cap 은 사용자 선택으로 제외 | 같은 문서 §5.5 |
| 오늘 OneShot 실체 = `send.ts` 가 매 턴 새 런타임 생성 + finally 폐기(`release`는 turn registry 만 정리, runtime close 안 함) | `app/src/main/ipc/chat/send.ts:287,416` · `lifecycle/supervisor.ts:release` |
| 런타임 재진입 가능 — `beginSend` 는 closed 아니면 busy 재진입, terminal 후 state='live' | `lifecycle/session-runtime.ts:runAttempt` · 기존 test `session-runtime.test.ts:58` |
| 0053 seam = supervisor 헤더가 cap/idle/LRU/IdleClose/concurrency 이관을 "0054" 로 예약 | `lifecycle/supervisor.ts:7-12` · `0053/plan.md:52` |
| 순환 위험 — timers→supervisor(abortTurn) 역방향이 있어 supervisor→pool→timers 추가 시 cycle | `lifecycle/timers.ts:2` (import/no-cycle 강제, `app/src/main/AGENTS.md`) |
| 모드-불변 소비자 계약은 0050 이 FakeSessionRuntime 으로 이미 고정 | `lifecycle/session-runtime.test.ts:153` |

## 인수 기준 (Acceptance Criteria)

1. **close 정책 파라미터화(decision ⑳).** `SessionRuntime(adapter, closePolicy)` 단일 클래스 — `reusable` getter(persistent=true). `OneShotSessionRuntime` 는 무회귀 alias(기본 oneshot). 스트리밍 메커니즘·상태머신 불변(동작 보존).
2. **IdleCloseTimer 실구현(decision ②).** `createIdleCloseTimer(onIdle, timeoutMs=IDLE_CLOSE_TIMEOUT_MS)` — reset 무장/만료 1회 발동/clear 취소. StallTimer 와 별 상수·별 모듈 경로(트리거 정반대).
3. **RuntimePool — Persistent 핸들 idle 보존/회수.** 세션 키 보관 + IdleCloseTimer 소유. `take`(재사용·타이머 정지)·`keepIdle`(보존·무장)·`closeAll`. 정책-자유(reusable 만 들어옴). idle 타이머 소유를 런타임이 아닌 풀에 둔다.
4. **Supervisor 거버넌스 — turn teardown ≠ runtime close.** `acquireRuntime`(풀 재사용 or factory)·`releaseRuntime`(정상종료 reusable 만 idle 보존, 그 외 close)·`closeIdleRuntimes`. 기존 `release(turn)`(멱등 teardown)은 불변.
5. **게이트(capability+config) — OneShot 기본.** `ORCA_PERSISTENT_RUNTIME=1` 일 때만 persistent. send.ts 컴포지션 루트가 mode 해석→factory 주입. **게이트 OFF 에서 동작·이벤트·DB·UX 무변경.**
6. **순환 0 + 테스트.** abortTurn 을 `lifecycle/abort.ts` 로 분리해 supervisor→pool→timers→supervisor 순환 차단(no-cycle 0). 신규/확장 단위테스트 green(runtime-pool·timers·supervisor·session-runtime). 게이트 typecheck/lint/test 통과.

## 범위 / 비범위

- **범위**: AC 1~6 — close-policy 추상화·IdleCloseTimer·RuntimePool·Supervisor 거버넌스 배선·게이트·abortTurn 분리·테스트.
- **비범위(→ 0055 / Future)**: cap admission(reject/queue, open Q2 수치) · LRU/idle eviction(`evictIdle` 실구현) · ConcurrencyRegistry 의 Supervisor 소유 이관 · steer/queue admission + **true streaming-input**(단일 long-lived live) · `orchestration/`→supervision 리네임(0051 결정 2) · Conversation Continuity(§A Future).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `SessionRuntimeStatus`(session-state)·`SessionRuntimeRegistry`·`createStallTimer`·`RuntimeSupervisor.release`·`ManagedRuntime` 신규 포트.
- 전제: 모드-불변 소비자 계약(TurnCoordinator 는 close 정책에 무지)·`adapter.sendMessage` per-call(resume 기반)·duplicate-turn 가드(turn registry, 풀과 별개).
- **신규 의존성 0.** 게이트는 기존 `ORCA_SUBAGENT_BACKGROUND` 선례를 따른 env 1개.

## 설계

- **무엇이 Persistent 인가(과대주장 방지)**: 본 단계 = §5.5 의 "long-lived **핸들** + cross-turn 수명 + IdleCloseTimer". *서브프로세스 streaming-input* 재사용이 **아니다**(그건 steer/queue 0055 가 요구하는 어댑터 변경). OneShot 의 일회성 이유는 클래스가 아니라 *배선*(매 턴 새 런타임)이므로, 핵심 변경은 **소유/배선**(Supervisor 가 세션 키로 소유·재사용 + IdleCloseTimer 회수)이다.
- **채택 추상화 / 기각 대안**:
  - 단일 `SessionRuntime` + `ClosePolicy`(2클래스 기각 — 메커니즘 중복·⑳ 불일치).
  - idle 타이머는 **RuntimePool(소유자)** 가 소유(런타임 내장 기각 — 회수 정책을 실행 핸들에 결합).
  - **RuntimePool 별도 L1 모듈**(supervisor 인라인 기각 — 테스트성·단일책임, session-registry 합성 선례).
  - 상태 명칭은 코드 'live'(=ready/idle) 유지(GLOSSARY 'idle' 리네임 기각 — churn·회귀).
  - 동시성 회계는 per-turn 현행 유지(per-runtime 은 cap 0055·open Q2/Q5 에 묶임).
- **레이어 경계**: 신규 `abort.ts`·`runtime-pool.ts` 는 L1. timers 가 abort 를 import(supervisor 비참조)해 L1 순환 차단. send.ts(L3)·router.ts(L3) 가 컴포지션 루트.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 동시성/멀티세션: 풀은 세션 키 단위 — 서로 다른 세션은 독립 보존. 같은 세션 중복 send 는 기존 turn 가드가 차단(풀 무관).
- 엣지: ① 신규 세션 first turn(sessionId=null) → 재사용 불가·fresh, 종료 시 `turn.dbSessionId`(승격된 실 id) 키로 보존. ② 에러·중단(state≠live) → 비보존·즉시 close. ③ owner-gone mid-turn → interrupting → 비재사용·close. ④ 보관 중 외부 close → take 가 정리 후 fresh. ⑤ 앱 종료 → `closeIdleRuntimes`.
- UX: 게이트 OFF 기본이라 사용자 가시 변화 0(렌더러 무변경).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| Persistent 가 cross-turn 자원 누수 위험 | IdleCloseTimer 로 시간 경계 보장 + 게이트 OFF 기본. 구조적 단계라 idle 핸들은 live 서브프로세스 미보유(terminal 시 live.close) → 누수 표면 최소 |
| 게이트 OFF 인데 풀이 동작에 끼어들 위험 | OneShot=reusable false → releaseRuntime 이 즉시 close, 풀에 안 들어감(빈 풀 pass-through). 회귀 표면 0 |
| 구조적 Persistent 의 런타임 이득이 작음(서브프로세스 미재사용) | 의도적 — 아키텍처 seam 검증이 목적(0055 true streaming-input 이 순수 추가). plan 에 명시(과대주장 금지) |

- 되돌리기 어려운 결정: 없음(게이트 뒤, alias 무회귀).
- **단독 결정 금지 항목**: cap 수치(open Q2)·평가세션 cap 회계(open Q5) → 0055 로 분리(본 핸드오프 비범위).

## 영향 받는 파일

- 신규: `app/src/main/lifecycle/abort.ts` · `runtime-pool.ts` (+ 각 `*.test.ts`)
- 수정: `lifecycle/ports.ts`(ManagedRuntime) · `session-runtime.ts`(ClosePolicy/alias) · `timers.ts`(IdleCloseTimer 실구현·abort import) · `supervisor.ts`(pool 합성·acquire/release/closeIdle·abort 재export) · `ipc/chat/send.ts`(게이트·acquire·releaseRuntime) · `ipc/router.ts`(shutdown closeIdle)
- 테스트 확장: `timers.test.ts` · `supervisor.test.ts` · `session-runtime.test.ts`

## 참고 문서

- `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md §A·§5.4(⑳②)·§5.5`
- `docs/arch/backend/provider-runtime.md`(가로축 구동체·persist 비의존)
- IPC/DB 변경 없음.

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: runtime-pool(보존·재사용·만료·교체·closeAll) · timers(IdleClose fire/clear/default) · supervisor(acquire/release/closeIdle by policy&state) · session-runtime(closePolicy·reusable·alias).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(라이브 세션)·확정 스코프 인용, 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs §`·`파일:라인`).
- [x] 인수 기준 — 번호·검증 가능·조사 근거.
- [x] 의존 기술 — 신규 의존성 0(env 게이트만), 전제 식별.
- [x] 파생 UX — 멀티세션·엣지(null/error/owner-gone/외부close/shutdown) 펼침.
- [x] 리스크 — 누수·게이트 회귀·이득 과대주장 트레이드오프, open Q 는 0055 분리.

---

> **[구현자 기입]** 구현 주체 = Claude(비기능, 게이트 뒤 동작 보존).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의/진행: 키스톤=Persistent 라는 0053 의 판단(idle/LRU 死코드)이 맞다 → 본 증분은 정책 없이 **소유/배선 + IdleCloseTimer** 만. close-policy 를 런타임에, 보존 정책을 풀/supervisor 에 둔 분리가 §A "Supervisor 가 SessionRuntime 집합 소유"와 정합.
- 이견/우려: "구조적 Persistent"의 런타임 이득이 작다는 점(서브프로세스 미재사용)은 설계 §리스크에 명시 — 본 단계는 seam 검증이 본질이고 true streaming-input 은 0055 의 어댑터 작업으로 분리하는 게 정직하다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | supervisor→pool→timers→supervisor 순환(timers→supervisor abortTurn 역방향) | ✅ 구현함 — `abortTurn` 을 `lifecycle/abort.ts` 로 분리, supervisor 는 무회귀 re-export. timers/send/test 의 기존 import 경로 보존 | import/no-cycle(`app/src/main/AGENTS.md`) |
| 2 | acquire 는 incoming sessionId, release 는 dbSessionId(승격 후) — 키 비대칭 | ✅ 구현함 — acquire(null)=fresh, release 는 `turn.dbSessionId` 로 보존 → 다음 resume 턴이 재사용 | `send.ts` 신규 세션 승격 흐름 |
| 3 | 게이트 OFF 회귀 — release 가 OneShot 도 close 호출(종전엔 GC) | ✅ 구현함 — close()는 terminal 후 live=null 이라 사실상 status.close 만(무관찰), 회귀 0. resilience 테스트 stub 으로 green 확인 | `session-runtime.ts:close` |
| 4 | 앱 종료 시 idle 보존 핸들 누락 | ✅ 구현함 — `router.shutdown` 에 `closeIdleRuntimes()`(게이트 OFF 면 빈 풀 no-op) | `router.ts:shutdown` |

## [구현자 기입] 구현 체크리스트

- [x] `lifecycle/abort.ts` 신설 + `supervisor.ts` re-export
- [x] `lifecycle/timers.ts` IdleCloseTimer 실구현 + `IDLE_CLOSE_TIMEOUT_MS`
- [x] `lifecycle/ports.ts` `ManagedRuntime`
- [x] `lifecycle/session-runtime.ts` `SessionRuntime`+`ClosePolicy`+`reusable`+alias
- [x] `lifecycle/runtime-pool.ts` 신설
- [x] `lifecycle/supervisor.ts` pool 합성 + acquire/release/closeIdle + seam 주석 0055
- [x] `ipc/chat/send.ts` 게이트·acquireRuntime·releaseRuntime
- [x] `ipc/router.ts` shutdown closeIdleRuntimes
- [x] 테스트: runtime-pool(신규 7)·timers(확장)·supervisor(확장 6)·session-runtime(확장 3)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신규 `lifecycle/abort.ts`·`runtime-pool.ts`(+test) / 수정 `lifecycle/{ports,session-runtime,timers,supervisor}.ts`·`ipc/chat/send.ts`·`ipc/router.ts` / 테스트 `lifecycle/{timers,supervisor,session-runtime}.test.ts` |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `npm test` |
| 게이트 결과 | typecheck ✅ / lint ✅(boundaries·no-cycle 0) / test **578 passed**; lifecycle 9파일 55 green. 환경 제한: electron 미설치 2 suite(`persist`·`send.runtime-resilience`)는 import 차단 — **electron stub 으로 재실행 시 9 green** 확인(변경 무관) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (push 후 기재) |

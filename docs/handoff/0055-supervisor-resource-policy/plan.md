# Plan — 0055-supervisor-resource-policy

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A 가 정의하고 0053/0054 가 **척추만** 세운 라이프사이클 자원 supervision 의 **정책(policy)** 을 채우는 핸드오프다. 0053(Supervisor 척추)·0054(Persistent runtime + IdleCloseTimer + RuntimePool)가 남긴 "0055 seam" 을 **주입형 `RuntimePolicy` 추상화**로 닫는다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0055-supervisor-resource-policy` |
| 작성자 | Claude Code |
| 일자 | 2026-07-01 |
| 매핑 | PHASES 행(P1 라이프사이클 후속) / PR (요청 시) |
| 상태 | DRAFT → READY |
| 구현 주체 | **Claude** (비기능 = 인프라/리팩토링 — 0052~0054 선례. plan→impl→verify Claude 직접) |
| 선행 | `0051-lifecycle-taxonomy-refinement`(§A 개념 SSOT) · `0053-runtime-supervisor-spine`(척추) · `0054-persistent-runtime-idle-close`(Persistent/Pool) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 51 구현 — 수석 개발자 관점에서 모듈화/추상화를 적극 도입해 구조적 개발을 비판적 검토하라. 51 의 일부 구현은 52/53/54 에서 진행됐다." | 라이브 세션(2026-07-01) |
| 명시 결정 | 0055 범위 = **Supervisor 정책 클러스터만**(cap admission + LRU/idle eviction + ConcurrencyRegistry 소유 이관). steer/queue·streaming-input·`orchestration/` 리네임은 **제외**(별도 후속). | 라이브 세션(2026-07-01, AskUserQuestion) |
| 추론 의도 | 0053/0054 가 의도적으로 비운 정책 훅을, 코드베이스의 확립된 **의존역전(주입형 전략)** 패턴으로 채워 supervision 을 완성한다. 정책은 순수·주입형이어야 하고, 기본값은 현 동작을 바이트 보존해야 한다. | 설계자 해석 (0052 turn-sinks·0054 closePolicy 선례에 근거) |

## Context (왜)

0051 §A 세로축은 `Runtime Supervisor` 가 SessionRuntime 집합의 소유자로서 **cap/LRU/busy 보호(자원)** 를 책임진다고 정의한다(§A.3). 0053 은 그 **척추**(registry 소유 + 단일 멱등 `release`/`abortTurn`)만 세우고 정책을 비웠고, 0054 는 Persistent 핸들·`RuntimePool`·`IdleCloseTimer` 로 **정책이 물릴 대상**(long-lived 핸들)을 만들되 cap/LRU 자체는 다시 미뤘다. 두 핸드오프의 코드가 이 자리를 명시적으로 "0055 seam" 으로 예약한다:

- `app/src/main/lifecycle/supervisor.ts:9–12` — "정책은 여전히 비움: cap/LRU eviction·ConcurrencyRegistry 소유 이관은 0055 seam."
- `app/src/main/lifecycle/runtime-pool.ts:7–8` — "0055 seam: cap/LRU eviction(size 한도 초과 시 가장 오래된 idle 핸들부터 close)·ConcurrencyRegistry 소유 이관."
- `app/src/main/lifecycle/session-registry.ts:48–51` — `evictIdle()` 예약 no-op.

이 정책이 없으면 Persistent 게이트(`ORCA_PERSISTENT_RUNTIME=1`) ON 시 idle 풀이 **무제한**으로 서브프로세스를 잡고 있을 수 있고, 활성 턴 수에 상한이 없다(자원 누수/보호 부재). 0055 는 이를 **한 응집 단위**로 닫는다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| §A.3 세로축 unit #3 = Runtime Supervisor 가 "cap/LRU/busy 보호"; §A.5 staging P1 = "Supervisor cap/LRU + IdleClose". "cap/LRU/idle-close 가 세는 유닛 = SessionRuntime(자원)"(결정 ⑭ 교정) | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A.3·§A.5 · `@docs/GLOSSARY.md` §1 SessionRuntime |
| 척추 존재: Supervisor 가 registry+pool 소유, 멱등 `release`, `acquireRuntime`/`releaseRuntime`. 정책 비어 있음. admission 은 무제한 pass-through | `app/src/main/lifecycle/supervisor.ts:33-97` |
| RuntimePool: 세션 키 idle 보존 + IdleCloseTimer, `size` getter 존재하나 **cap 없음**. `idle: Map` = 삽입 순서 보존 → LRU 재귀성 출처로 사용 가능 | `app/src/main/lifecycle/runtime-pool.ts:13-65` |
| `SessionRuntimeRegistry.evictIdle()` = no-op 스텁, `maxIdleRuntimes` 미사용. **오배치 의심**: LRU 대상은 *busy* 레지스트리가 아니라 *idle 풀* | `app/src/main/lifecycle/session-registry.ts:7,48-55` |
| ConcurrencyRegistry(프로젝트별 in-flight): 컴포지션 루트가 생성(`router.ts:139`)·ctx 주입(`:186`)·코디네이터가 stream 경계에서 increment/decrement(`turn-coordinator.ts:99,158`). 배지 UX 용(`concurrencyEvent` IPC) | `app/src/main/orchestration/concurrency.ts` · `app/src/main/ipc/router.ts:139,186` · `app/src/main/lifecycle/turn-coordinator.ts:64,99,158` |
| admission 진입점 = `send.ts:264-265`(startResume/startNew), 런타임 인출 `:295`(acquireRuntime), 반납 `:430`(releaseRuntime) | `app/src/main/ipc/chat/send.ts:264-265,295,430` |
| 관리 대상 핸들 표면 = `ManagedRuntime`(state·reusable·close) | `app/src/main/lifecycle/ports.ts:43-47` |
| 의존역전 선례: sink 포트 주입(0052), closePolicy 파라미터화(0054). 게이트 OFF-기본 선례: `ORCA_PERSISTENT_RUNTIME`(0054) | `app/src/main/lifecycle/turn-sinks.ts` · `app/src/main/lifecycle/session-runtime.ts:32` |
| 멀티세션 동시 턴은 **의도된 설계**(동시 세션 턴 허용) — 전역 활성 cap 이 reject 하면 이를 깰 수 있음 | `@docs/handoff/INDEX.md` 0011·0013 행 |
| OpenCode 는 steer/queue admission 으로 초과분을 *큐잉* — Orca 는 0055 에서 queue 제외, reject 만(큐는 후속) | `@docs/etc/study/opencode/` (오케스트레이션 편) |

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조. 번호를 매긴다.

1. **`RuntimePolicy` 추상화 신설(순수).** `lifecycle/runtime-policy.ts` 에 `RuntimePolicy` 인터페이스 + `RuntimeLoadSnapshot` 타입 + `NoopRuntimePolicy`(무제한·무축출) + `CapLruPolicy`(cap 설정). 부수효과 0 — `runtime-policy.test.ts` 순수 단위테스트로 admit/eviction 결정 고정.
2. **cap admission.** Supervisor 가 admission 스냅샷(활성 runtimes·프로젝트 in-flight)으로 `policy.admit()` 판정 → `'reject'` 시 `send.ts` 가 **타입드 거부**로 표면화(조용한 드롭 금지·턴 생성 전 빠른 실패). **기본값(NoopPolicy·cap null)에서 현 동작 바이트 보존.**
3. **LRU/idle eviction.** `RuntimePool.size` 가 idle cap 초과 시 `policy.selectEvictions()`(가장 오래된 idle=Map 첫 키)가 지정한 핸들을 **기존 풀 close 경로**로 회수. 2차 close 경로 신설 금지 — `supervisor.ts:24-25` 의 "self-idle close ∥ LRU eviction 단일 정리 지점"·`released` WeakSet 멱등 준수(이중 정리 0).
4. **ConcurrencyRegistry 소유 이관.** 소유를 컴포지션 루트+코디네이터 → **Supervisor** 로 단일화(admission 정책이 프로젝트별 카운트를 읽음). **increment/decrement 타이밍은 현행(코디네이터 stream 경계) 유지** — `turn-coordinator.test.ts:107,195` 증가/감소 짝 테스트 무회귀. 배지 점등 타이밍 무변경.
5. **`evictIdle()` 오배치 스텁 정리.** `session-registry.ts` 의 speculative `evictIdle()`/`maxIdleRuntimes` 를 제거(또는 풀로 재배치) — LRU 대상은 idle 풀이므로 registry 스텁은 dead. dead code 0.
6. **게이트(설정/capability).** cap 은 **opt-in**(`ORCA_RUNTIME_CAP`·`ORCA_IDLE_RUNTIME_CAP`, 0054 `ORCA_PERSISTENT_RUNTIME` OFF-기본 패턴). 미설정 = 무제한 = 현 동작. ON 일 때만 정책 활성.
7. **위생.** 레이어 경계 0(L1 순수 정책·no-cycle 0), 신규 의존성 0, IPC/DB 무변경, 게이트 lint/typecheck/test green.

## 범위 / 비범위

- **범위**: `RuntimePolicy` 추상화 + cap admission(reject) + LRU/idle eviction + ConcurrencyRegistry 소유 이관 + `evictIdle` 스텁 정리 + opt-in 게이트. 신규 테스트 3종(policy·supervisor 확장·pool 확장).
- **비범위(후속 핸드오프)**: **steer/queue admission**(reject→queue 승격·admission 큐) + **true streaming-input**(단일 long-lived live 재사용)은 0056(별도) — `admit` 반환에 `'queue'` 를 forward-compat 로 예약만. **`orchestration/` → supervision 코드 리네임**은 §A "결정 2" 가 별도 핸드오프로 명시 — 본 핸드오프 미포함(모듈명 유지). cap 을 기본 ON 으로 켜는 결정(제품 UX)도 비범위(Open Question).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 기존 모듈: `RuntimeSupervisor`·`SessionRuntimeRegistry`·`RuntimePool`(0053/0054)·`ConcurrencyRegistry`(orchestration)·`ManagedRuntime`(ports). 전부 기존.
- 전제: idle 풀은 Persistent 게이트 ON 일 때만 채워짐 → LRU eviction 은 OneShot 기본에선 자연히 dormant(풀 미진입).
- 전제: `RuntimePool.idle` Map 삽입 순서 = LRU 재귀성 출처(별도 timestamp 필드 없이). robust 필요 시 `keptAt` 타임스탬프로 격상하는 옵션은 impl 판단.
- **신규 의존성: 0건**(순수 TS·기존 모듈만).

## 설계

### 핵심 통찰 — 세 "카운트" 를 분리 (혼동 함정)
naive 단일 cap 은 서로 다른 세 수량을 뭉갠다. §A("cap/LRU/idle-close 가 세는 유닛=SessionRuntime")를 정확히 분해:

| 수량 | 출처 | 정책 모먼트 |
|---|---|---|
| (a) 활성(busy) 턴 핸들 | `SessionRuntimeRegistry.size` | **admission(cap)** — 턴 진입 |
| (b) idle 보존 Persistent 핸들 | `RuntimePool.size` | **eviction(LRU)** — idle 삽입 |
| (c) 프로젝트별 in-flight | `ConcurrencyRegistry` | admission 정책 입력 + 소유 이관 |

→ cap(활성)과 LRU(idle)는 **다른 한도·다른 정책 메서드**. 한 한도로 합치지 않는다.

### 추상화 — 주입형 `RuntimePolicy` (전략, L1 순수)
0052 `turn-sinks` 포트 주입 / 0054 `closePolicy` 파라미터화 패턴을 잇는다. **메커니즘은 Supervisor/Pool, 규칙은 주입된 순수 정책.**

```ts
// app/src/main/lifecycle/runtime-policy.ts (신규 L1, 순수)
export interface RuntimeLoadSnapshot {
  activeRuntimes: number       // registry.size (a)
  idleRuntimes: number         // pool.size (b)
  projectInFlight: number      // concurrency.getCount(projectId) (c)
  idleOrder: string[]          // pool idle 키, 오래된→최신 (LRU 선택)
}
export interface RuntimePolicy {
  admit(s: RuntimeLoadSnapshot): 'admit' | 'reject'  // 0055; 'queue' 는 0056 예약
  selectEvictions(s: RuntimeLoadSnapshot): string[]  // idle cap 초과 시 close 할 sessionId
}
export class NoopRuntimePolicy implements RuntimePolicy { /* 무제한·무축출 = 현 동작 보존 */ }
export class CapLruPolicy implements RuntimePolicy {
  constructor(private cfg: { maxActive: number | null; maxIdle: number | null }) {}
}
```
- `admit` 반환 enum → 0056 steer/queue 가 `'queue'` 추가만. **정책은 순수**(no side effect); reject 실행·evict close 는 소유자(Supervisor/Pool)가 수행 → 순수 단위테스트.

### 배선 (소유 이관 — 타이밍 보존)
- **ConcurrencyRegistry**: `router.ts:139` 생성 유지하되 **Supervisor 생성자 주입**으로 소유 단일화. 코디네이터는 Supervisor 경유(또는 Supervisor 가 노출한 동일 인스턴스)로 increment/decrement — **타이밍(stream 경계) 현행 유지**. admission 정책이 프로젝트 카운트를 읽도록 Supervisor 가 스냅샷 조립.
- **admission**: `send.ts:264-265` 직전 `supervisor.admit(projectId, owner)` → `'reject'` 시 타입드 거부(turn 생성 전). Supervisor 가 스냅샷(registry.size·pool.size·concurrency) 조립·정책 위임.
- **eviction**: `releaseRuntime`→`pool.keepIdle` 후 `pool.size` 가 cap 초과면 `selectEvictions` 결과를 `pool.evict(sessionId)`(keepIdle 의 reap 재사용)로 회수. 단일 close 경로·멱등 준수.

### 모듈 분해 (파일 단위)
| 파일 | 변경 | 레이어 |
|---|---|---|
| `lifecycle/runtime-policy.ts` (신규) | `RuntimePolicy`·`RuntimeLoadSnapshot`·`CapLruPolicy`·`NoopRuntimePolicy`. 순수. | L1 |
| `lifecycle/supervisor.ts` | `RuntimePolicy` 주입(기본 Noop). `admit()` 공개(스냅샷 조립). ConcurrencyRegistry 소유. releaseRuntime eviction 훅. 멱등 close 단일 경로 보존. | L1 |
| `lifecycle/runtime-pool.ts` | 순서화 idle 스냅샷(`idleOrder`) + `evict(sessionId)`(reap 재사용). cap 인지. | L1 |
| `lifecycle/session-registry.ts` | `evictIdle()`/`maxIdleRuntimes` 스텁 정리(제거/재배치). | L1 |
| `orchestration/concurrency.ts` | 클래스 무변경 — 소유 배선만 이동. | L1 |
| `ipc/router.ts` · `ipc/chat/send.ts` | 컴포지션 루트: 정책·concurrency 소유 배선. admission reject 처리. | L3 |
| config/capability | `ORCA_RUNTIME_CAP`·`ORCA_IDLE_RUNTIME_CAP` 게이트(기본 무제한). | L1 |
| 테스트 | `runtime-policy.test.ts`(순수)·`supervisor.test.ts`(admission/eviction 확장)·`runtime-pool.test.ts`(LRU 확장). | — |

### 레이어 경계 준수
정책은 순수 L1(`import/no-cycle` 안전). Supervisor(L1)가 정책·concurrency·pool 을 소유하되 **L3 를 import 하지 않음**(reject 는 send.ts=L3 가 스냅샷/판정 결과를 받아 처리). 구체 provider 리터럴 없음(백엔드 중립, 0016).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **동시성/멀티세션**: 전역 활성 cap 이 turn 을 reject 하면 동시 세션 UX(0011/0013 의도)를 깰 수 있음 → **기본 무제한·명시 opt-in**. reject 시 사용자에게 보이는 에러/안내는 product-shaped → cap 기본 ON 전 사용자 결정(아래 리스크).
- **에러**: reject 는 조용한 드롭이 아니라 타입드 turn 거부(렌더러가 표면화 가능한 형태). 구체 에러 카테고리·UX 는 impl 에서 최소(게이트 뒤).
- **abort/owner-gone**: concurrency 소유 이관이 abort·owner-gone 경로의 decrement 누수를 만들지 않아야 함(0046 idle-pause 회귀 클래스) → 테스트로 고정.
- **빈 상태/로딩**: N/A(자원 정책, UI 무변경).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 전역 활성 cap reject 가 멀티세션 동시 턴 UX 를 깸 | 기본 무제한(게이트 OFF)·명시 opt-in·reject 타입드 표면화. cap 기본 ON 은 **사용자 결정**(Open Question). |
| `evictIdle` 스텁 처리(제거 vs 풀 재배치) | 구현 세부 → 선조치 가능. LRU 대상=idle 풀임을 근거로 registry 스텁 정리. |
| concurrency 소유 이관이 decrement 누수 유발 | 타이밍 현행 유지 + `turn-coordinator.test.ts` 짝 테스트 + abort/owner-gone 회귀 테스트. |
| LRU 재귀성을 Map 순서에 의존 | 최소 변경 채택·명시. robust 필요 시 `keptAt` 타임스탬프 격상(impl 판단). |

- 되돌리기 어려운 결정: 없음(게이트 뒤·기본 무변경).
- **단독 결정 금지 항목(Open Question)** → 사용자에게: **cap 을 기본 ON 으로 켤지 + reject 시 사용자 UX**(제품 의도). 0055 는 메커니즘만 게이트 뒤 안착.

## 영향 받는 파일

- `app/src/main/lifecycle/runtime-policy.ts` (신규)
- `app/src/main/lifecycle/supervisor.ts` · `runtime-pool.ts` · `session-registry.ts`
- `app/src/main/orchestration/concurrency.ts` (배선만)
- `app/src/main/ipc/router.ts` · `ipc/chat/send.ts` (컴포지션 루트 배선)
- config/capability 게이트 위치(0054 `ORCA_PERSISTENT_RUNTIME` 인접)
- 테스트 3종(신규/확장)

## 참고 문서

- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A.3·§A.5 (정본 개념)
- `@docs/GLOSSARY.md` §1 (SessionRuntime = cap/LRU 가 세는 자원 유닛)
- `@docs/handoff/0053-runtime-supervisor-spine/plan.md` · `0054-persistent-runtime-idle-close/plan.md` (선행 seam)
- IPC 변경 없음 → `IPC_CONTRACT.md` 무변경.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: `runtime-policy.test.ts`(순수 admit/eviction 결정), `supervisor.test.ts`(admission reject·eviction 훅·멱등), `runtime-pool.test.ts`(LRU 선택·cap).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(라이브 세션)·명시 결정(AskUserQuestion 2건) 인용, 추론은 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`) 부착.
- [x] 인수 기준 — 번호·검증 가능·자료조사 근거.
- [x] 의존 기술 — 기존 모듈 식별, 신규 의존성 0 명시.
- [x] 파생 UX — 동시성/에러/abort/owner-gone 엣지 펼침.
- [x] 리스크 — cap reject UX 를 Open Question(사용자 결정)으로 분리.

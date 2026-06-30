# Plan — 0055-runtime-resource-governance

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A staging **P1 의 "자원 거버넌스"** 증분이다 — 0052(가로축)·0053(척추)·0054(Persistent 전제) 위에 **cap/LRU/idle eviction + ConcurrencyRegistry 소유 이관**을 얹되, **정책은 추상화하고 기본값은 동작보존**으로 둔다. steer/queue 턴 admission 은 분리(0056).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0055-runtime-resource-governance` |
| 작성자 | Claude Code |
| 일자 | 2026-06-29 |
| 매핑 | PHASES 행 / PR (요청 시) |
| 상태 | DRAFT → **READY** |
| 구현 주체 | **Codex** (기능 — 자원 한도/축출 정책) |
| 선행 | `0054-persistent-runtime-idle-close`(Persistent 전제·RuntimePool·Supervisor 거버넌스) · `0051` §A(택소노미·결정 ⑭) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 51 구현 — 모듈화/추상화를 적극 도입해 구조적으로. 새 핸드오프 문서는 만들기만 하고 끝내라." | 라이브 세션(2026-06-29) |
| 명시 결정 | 남은 0055 seam 을 **분할**(0055=자원 거버넌스 / 0056=steer·queue admission). | 라이브 세션 AskUserQuestion(2026-06-29, "분할 0055+0056 권장" 채택) |
| 명시 결정 | busy/cap 초과 시 admission/cap 정책은 **Open Question 유지** — 정책 추상화 + 동작보존 기본값만 확정, 수치·reject/queue 선택은 사용자 결정에 위임. | 라이브 세션 AskUserQuestion(2026-06-29, "Open Question 유지 권장" 채택) |
| 추론 의도 | 0052~0054 의 "작은 동작보존 증분 + 게이트 뒤" 규율을 0055 도 따른다(기본 정책=무제한 → 기본 동작 0 변경). | 설계자 해석(0053/0054 패턴 일관) |

## Context (왜)

0054 가 Persistent SessionRuntime + RuntimePool + IdleCloseTimer 의 **구조와 전제**를 세웠지만, **정책은 비워 둔 채** seam 만 남겼다(`@app/src/main/lifecycle/supervisor.ts:9-12`, `@app/src/main/lifecycle/runtime-pool.ts:7-8`). idle/LRU/cap 이 死코드인 이유는 OneShot 기본이 매 턴 fresh·즉시 폐기라 pool 이 비기 때문이다(0054). Persistent 게이트가 켜지면 idle 핸들이 누적되므로, **그 인구를 한도로 묶고(cap) 초과분을 축출(LRU)** 하는 자원 거버넌스가 필요해진다. 0051 §A 결정 ⑭ 은 "cap/LRU/idle-close 가 세는 유닛 = SessionRuntime(자원) → 동시성=자원 라이프사이클(§2)"로 못 박았다. 본 핸드오프는 그 §2 자원 supervision 의 정책 계층을 **메커니즘과 분리해** 채운다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 0054 가 남긴 "0055 seam": cap admission(`startResume/startNew/acquireRuntime` 한도 초과 reject/queue)·idle/LRU eviction(`RuntimePool.size` 한도 + `registry.evictIdle()` 예약 no-op)·ConcurrencyRegistry 소유 이관 | `@app/src/main/lifecycle/supervisor.ts:9-12` · `@app/src/main/lifecycle/runtime-pool.ts:7-8` · INDEX 0054 행 "비범위(0055)" |
| §A 결정 ⑭: cap/LRU/idle-close 가 세는 유닛 = SessionRuntime(자원) → 동시성=라이프사이클(§2), 오케스트레이션 아님. 출시 `orchestration/` 코드명 유지(결정 2 — 리네임 연기) | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §5.4 ⑭ · §A · 0051 plan §결정 2 |
| §A staging P1 항목에 "Supervisor cap/LRU · idempotent close 단일경로(self-idle vs LRU)" 명시 | `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md` §Staging(P1) |
| RuntimePool 는 "정책-자유" 메커니즘으로 설계됨(reusable 만 진입, 타이머를 소유자=풀에 둠) — 정책 객체를 얹을 자리 | `@app/src/main/lifecycle/runtime-pool.ts:1-8` |
| Supervisor.acquireRuntime/releaseRuntime/release 이미 존재(풀 재사용·정상종료 보존·멱등 teardown). cap/eviction 의 hook 지점 | `@app/src/main/lifecycle/supervisor.ts:78-97` |
| RuntimePool.idle = sessionId 키 Map. `take`→delete, `keepIdle`→끝에 재삽입 → 삽입순서가 "마지막 idle 진입 recency"의 LRU 프록시(신규 필드 불필요) | `@app/src/main/lifecycle/runtime-pool.ts:14,20-47` |
| 게이트 `ORCA_PERSISTENT_RUNTIME=1` 만 persistent, 기본 OneShot → pool 빔 | INDEX 0054 행(⑤ 게이트) · `@app/src/main/lifecycle/session-runtime.ts`(closePolicy) |
| **3개의 "count" 혼재**: ConcurrencyRegistry(프로젝트별 활성 턴, 렌더러 경고게이트 0039) / Supervisor.size(활성 턴 핸들) / RuntimePool.size(idle 런타임) — cap 대상 disambiguation 필요 | `@app/src/main/orchestration/concurrency.ts` · `@app/src/main/lifecycle/session-registry.ts` · `@app/src/main/lifecycle/runtime-pool.ts:53-55` |
| 0050 plan 인수 #10 = "축출 훅 예약"(LRU evict hook). 본 핸드오프가 그 예약을 실구동 | INDEX 0050 행 · `@docs/handoff/0050-lifecycle-orchestration-redesign/plan.md` |
| 레이어: lifecycle·orchestration 둘 다 L1 domain → 동일 레이어 import 허용(no-cycle 가 순환만 차단) | `@app/src/main/AGENTS.md`(레이어 ↔ 디렉토리 매핑) |

## 인수 기준 (Acceptance Criteria)

1. **count 3종 disambiguation + 대상/축출 분리.** 코드(주석)+plan 에서 cap **count 대상 = SessionRuntime 인구(Supervisor active + Pool idle)**, **eviction victim = idle only** 임을 명시한다. `acquireRuntime` 가 active 턴을 닫도록 압력 주지 않는다 — active 초과는 0055 기본 무제한 pass-through(reject/queue 는 0056). ConcurrencyRegistry 의 프로젝트별 *턴* 경고게이트(0039·0056 소관)와 혼동 금지. (§A ⑭ 근거. QA #1.)
2. **`EvictionPolicy` 순수 추상화(Map 비의존).** RuntimePool 이 snapshot 을 만들고 policy 는 **victim sessionId 키만** 반환하는 순수 함수. shape: `interface IdleRuntimeEntry<RT=ManagedRuntime>{ sessionId: string; runtime: RT }` · `interface EvictionPolicy<RT=ManagedRuntime>{ selectVictims(entries: readonly IdleRuntimeEntry<RT>[], capacity: number): string[] }`. 기본 구현 = LRU(가장 오래된 idle 우선; `idle` Map 삽입순 = "마지막 idle 진입 recency" 프록시 → snapshot 앞부터). EvictionPolicy 는 Map 자체를 모른다. 단위테스트 포함. (QA #4.)
3. **`RuntimeCapPolicy` 주입 + union 축소 + 기본 무제한.** 0055 cap 정책 union = **`'accept' | 'evict-idle'` 만**(reject/queue 는 0056 으로 이관 — IPC 에러·normalized error·UX 가 0056 소관이라 0055 에서 throw 의미 확정 금지). 런타임 획득(`acquireRuntime`)·idle 보존(`keepIdle`) 경로에 cap hook. 기본 `UnlimitedRuntimeCapPolicy`(capacity 미결정 → 항상 `accept`) → **게이트 OFF/ON 모두 현 동작 보존**. (QA #5.)
4. **ConcurrencyRegistry 단일 진실원 — 소유 Supervisor 이관(파일 미이동).** 소유/생성을 컴포지션 루트→Supervisor 로 옮기고 **`RuntimeSupervisor.concurrency` getter** 로 노출. `send.ts` 는 `ctx.concurrency`→`supervisor.concurrency` 로 주입, **`RouterContext.concurrency`(`@app/src/main/ipc/context.ts:46`) 제거**(이중 진실원 차단). **`orchestration/concurrency.ts` 파일은 이동·리네임하지 않는다**(결정 2 = 코드 리네임 연기) — 생성 위치만 정렬. 소비(admission 판정)는 0056. (QA #2.)
5. **idempotent close 단일 helper — 기존 경로 전부 합류.** RuntimePool 의 모든 idle close 가 private `closeEntry(sessionId)` 하나로 수렴: `keepIdle` prev 교체(`@app/src/main/lifecycle/runtime-pool.ts:37`)·idle timer 콜백(:41)·`closeAll`(:60)·신규 evict. timer 콜백 = **Map 선제거 후 close**, LRU evict 와 거의 동시여도 2번째 호출 no-op. self-idle vs LRU 이중 close 0. 경쟁 회귀테스트 포함. (QA #3.)
6. **population snapshot(테스트/디버그).** `RuntimeSupervisor.getRuntimePopulation(): { active: number; idle: number; total: number }` — count 3종 검증·주석 근거용 L1 소형 메서드(production 과노출 회피). (QA #6.)
7. **게이트 OFF 동작·이벤트·DB·UX 무변경 + lifecycle 게이트 green.** 기본 OneShot(게이트 OFF)에서 pool 미진입 → cap/eviction 무력 → 이벤트 시퀀스·DB parts·UX 0 변경. `cd app && npm run lint && npm run typecheck && npm test` 통과, 신규 테스트(eviction·cap·close 경쟁·population) green.
8. **레이어 경계·순환 0.** boundaries(L1↔L3 하향만)·`import/no-cycle` 위반 0. Supervisor(L1)→`orchestration/concurrency`(L1) 동일레이어 import 가 순환을 만들지 않음 확인.

## 범위 / 비범위

- **범위**: cap/LRU/idle eviction **정책 추상화 + 메커니즘 배선 + 기본 동작보존**, ConcurrencyRegistry 소유 이관, idempotent close 단일경로. (전부 Persistent 게이트 뒤에서만 실효.)
- **비범위(후속/Open Question)**:
  - **steer/queue 턴 admission** → `0056-turn-admission-steer-queue`.
  - **cap 수치·over-cap 정책(evict-first vs reject)** → Open Question(아래). 본 핸드오프는 *기본 무제한*으로 출하하고 수치는 사용자 결정 후 config 주입.
  - **`orchestration/`→supervision 코드 리네임** → 별도 Future 핸드오프(결정 2).
  - **true streaming-input(단일 long-lived live 재사용)** → 후속.
  - **평가세션(internal evaluation session) cap 회계 포함 여부** → §A P1 경계 Open Question.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 모듈: `lifecycle/{supervisor,runtime-pool,timers,abort,session-runtime,ports}.ts` · `orchestration/concurrency.ts`. 전부 기존 L1.
- 전제: 0054 의 Persistent 게이트(`ORCA_PERSISTENT_RUNTIME`)·RuntimePool·Supervisor 거버넌스가 머지·동작. cap/eviction 은 그 위에서만 실효.
- **신규 의존성 0** (순수 TS 정책 객체 + 기존 모듈 배선).

## 설계

### 모듈화 — mechanism ↔ policy 분리 (핵심 추상화)
RuntimePool/Supervisor 는 **메커니즘**(저장·take/keepIdle/close·acquire/release)으로 유지하고, **판정은 정책 객체로 외출**한다. L1 메커니즘에는 매직넘버를 두지 않는다 — 수치는 config/컴포지션 루트에서 주입.

| 정책 | 시그니처(개념) | 기본 구현 | 주입 위치 |
|---|---|---|---|
| `EvictionPolicy<RT>` | `selectVictims(entries: readonly IdleRuntimeEntry<RT>[], capacity: number): string[]`(victim sessionId 키만, Map 비의존) | **LRU**(가장 오래된 idle 먼저; snapshot 앞부터) | `RuntimePool` 생성자(기본 LRU) |
| `RuntimeCapPolicy` | `admit(ctx: { active, idle, capacity }): 'accept' \| 'evict-idle'` | **`UnlimitedRuntimeCapPolicy`**(항상 `accept`) | `RuntimeSupervisor` 생성자/컴포지션 루트 |

- `acquireRuntime`/`keepIdle` 경로에서 cap 정책에 질의 → `evict-idle` 면 RuntimePool 이 `IdleRuntimeEntry[]` snapshot 을 만들어 `EvictionPolicy.selectVictims` 가 고른 키들을 **단일 close 경로**로 닫고 진행. **기본값 조합(무제한 → 항상 accept) = 현 동작.** `reject`/`queue` 는 0055 union 에 없음(0056 소관).
- **단일 close helper(F5)**: `RuntimePool` private `closeEntry(sessionId)`(타이머 clear → map delete → `runtime.close()` → `onReap`)로 **기존 4경로 전부 수렴** — `keepIdle` prev 교체(:37)·idle timer 콜백(:41, Map 선제거 후 close)·`closeAll`(:60)·신규 evict. 거의 동시 호출이어도 2번째는 no-op.

### count disambiguation (F1 + QA #1)
- **cap count 대상 = SessionRuntime 인구** = Supervisor active(턴 핸들) ∪ RuntimePool idle. 주로 idle 풀이 한도 압력의 진원(Persistent 누적).
- **eviction victim = idle only** — active 턴 핸들은 절대 축출 대상 아님(`acquireRuntime` 가 active 닫도록 압력 금지). active 초과는 0055 기본 무제한 pass-through, reject/queue 는 0056.
- `RuntimeSupervisor.getRuntimePopulation()` 가 `{active, idle, total}` 을 노출(QA #6) — 테스트·주석 검증 근거.
- ConcurrencyRegistry = 프로젝트별 *턴* 경고게이트(0039) → **소유만** Supervisor 로(아래), 소비(admission)는 0056. cap 카운트에 섞지 않는다.

### ConcurrencyRegistry 단일 진실원 (F3 + QA #2 — 파일 미이동)
- 현재(코드 확인): `@app/src/main/ipc/router.ts:139` 가 `new ConcurrencyRegistry`, `:186` 에서 `RouterContext.concurrency`(`@app/src/main/ipc/context.ts:46`)로 전달, `@app/src/main/ipc/chat/send.ts:319` 가 `ctx.concurrency` 를 TurnCoordinator 에 주입.
- 변경: **Supervisor 가 보유** + `concurrency` getter 로 코디네이터에 노출. `send.ts` 는 `supervisor.concurrency` 주입, **`RouterContext.concurrency` 제거**(소유=Supervisor·사용=Context 이중 진실원 차단). 개념상 §A ⑭(동시성=자원 supervision)과 정렬.
- **파일은 `orchestration/concurrency.ts` 그대로** — 결정 2(코드 리네임 연기) 위반 아님. Supervisor(L1)→orchestration(L1) import 는 동일레이어 허용. 생성 위치만 정렬.

### 재사용할 기존 함수·파일 + 권장 구조 (QA 요약)
- 재사용: `@app/src/main/lifecycle/supervisor.ts`(acquireRuntime/releaseRuntime/release/closeIdleRuntimes·seam 주석) · `@app/src/main/lifecycle/runtime-pool.ts`(take/keepIdle/size/closeAll) · `@app/src/main/lifecycle/timers.ts`(IdleCloseTimer) · `@app/src/main/lifecycle/abort.ts` · `@app/src/main/orchestration/concurrency.ts`.
- 권장 파일 구조:
  - `lifecycle/eviction-policy.ts` — 순수 LRU victim 선택(Map 비의존, `IdleRuntimeEntry`/`EvictionPolicy` 타입 + LRU 구현 + 테스트).
  - `lifecycle/runtime-cap-policy.ts`(또는 supervisor 내부 소형 타입) — `RuntimeCapPolicy` + 기본 `UnlimitedRuntimeCapPolicy`(capacity 수치 미결정).
  - `lifecycle/runtime-pool.ts` — idle 저장 메커니즘 + `evictToCapacity()`/`evictVictims()` + 단일 close helper.
  - `lifecycle/supervisor.ts` — active registry + idle pool 총괄 · cap hook · ConcurrencyRegistry 소유 · `getRuntimePopulation()`.
  - `ipc/router.ts` — 컴포지션 루트 배선만(정책 주입·supervisor 생성).
  - `ipc/chat/send.ts` — TurnCoordinator 에 `supervisor.concurrency` 전달(admission UX 결정 금지).
- 레이어 경계: 신규 정책 파일은 L1 `lifecycle/` — 하향 의존만, 매직넘버는 컴포지션 루트.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **동시성/멀티세션**: cap 초과 축출이 *다른* 세션의 idle 핸들을 닫을 때, 그 세션 재진입은 reseed(0051 §A: resume 실패 시 reseed≠recovery)로 자연 복귀 — 데이터 손실 없음(DB=SSOT). 단 cross-turn 컨텍스트 이점만 상실.
- **경쟁**: LRU evict vs IdleCloseTimer self-reap 동시 발화(F5) → 단일 close 경로로 멱등.
- **게이트 OFF**: pool 빔 → 본 기능 전부 무력(엣지 없음).
- **에러/중단 핸들**: `releaseRuntime` 이 이미 비정상 종료를 즉시 close — cap/evict 대상은 정상 idle 핸들만.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| ConcurrencyRegistry 소유 이관이 결정 2(코드 리네임 연기)와 충돌로 오해 | 파일 미이동·소유만 이관. plan/주석 명시. 리네임은 별도 Future 핸드오프. |
| cap 수치·over-cap 정책을 단독 결정 | **단독 결정 금지** → Open Question. 기본=무제한 동작보존으로 출하, 수치는 사용자 결정 후 config. |
| LRU 프록시(idle 진입순 ≠ 엄밀 last-use) 부정확 | 재사용 시 풀 재진입으로 recency 갱신 → 실용 LRU. 뉘앙스 주석. 엄밀 LRU 필요 시 후속 timestamp 필드(현 비범위). |
| evict 가 활성 턴 핸들을 닫는 사고 | cap 대상은 **idle 풀** 우선(active 는 release 후에만 풀 진입). evict victim = idle 엔트리만. |

- 되돌리기 어려운 결정: 없음(기본 무제한 → 동작보존, 정책은 후속 조정 가능).
- **단독 결정 금지 항목(Open Question)** → 사용자에게:
  - **OQ1. cap 수치** (idle 풀/전체 SessionRuntime 한도 값). 0054 verify "cap 수치=open Q2" 연속.
  - ~~OQ2. over-cap 정책(evict-first vs reject)~~ → **해소(QA #5)**: 0055 는 **evict-idle 로 확정**, `reject`/`queue`(획득 차단·UX) 는 **0056 으로 이관**(scope 경계 정렬). 0055 cap union = `accept | evict-idle`.
  - **OQ3. 평가세션(ownerless system runtime)의 cap 회계 포함 여부** (§A P1 경계).

## 영향 받는 파일

- `app/src/main/lifecycle/runtime-pool.ts`(snapshot·EvictionPolicy 주입·단일 close helper·evictToCapacity)
- `app/src/main/lifecycle/supervisor.ts`(RuntimeCapPolicy hook·ConcurrencyRegistry 소유+getter·getRuntimePopulation)
- 신규 `app/src/main/lifecycle/eviction-policy.ts`(+ `*.test.ts`) — 순수 LRU 정책(Map 비의존)
- 신규 `app/src/main/lifecycle/runtime-cap-policy.ts`(또는 supervisor 내부 소형 타입) — 기본 `UnlimitedRuntimeCapPolicy`
- `app/src/main/ipc/router.ts`(컴포지션 루트 — 정책/supervisor 배선)·`app/src/main/ipc/context.ts`(`RouterContext.concurrency` 제거)·`app/src/main/ipc/chat/send.ts`(`supervisor.concurrency` 주입)
- 테스트: `runtime-pool.test.ts`·`supervisor.test.ts` 확장(cap·evict·close 경쟁·population)
- (코드 변경 없음 항목) `orchestration/concurrency.ts` — **이동·리네임 금지**(소유 이관은 배선만)

## 참고 문서

- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §5.4 ⑭ · §A
- `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md`(§A staging) · `@docs/handoff/0054-persistent-runtime-idle-close/plan.md`
- `@docs/etc/study/opencode/`(steer/queue·seq fencing 참조 — 주로 0056) · `@app/src/main/AGENTS.md`(레이어)
- IPC 변경: **없음 예상**(자원 거버넌스는 main 내부). 채널 추가 시 `@docs/IPC_CONTRACT.md` §6 동시 갱신.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: `eviction-policy`(순수 LRU)·cap hook(무제한 기본 + 한도 주입 시 evict)·close 경쟁(self-idle vs LRU 멱등).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 + AskUserQuestion 출처 인용, 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`).
- [x] 인수 기준 — 7개 번호·검증 가능·조사 근거.
- [x] 의존 기술 — 기존 L1 모듈, 신규 의존성 0.
- [x] 파생 UX — 동시성/경쟁/게이트OFF/에러 핸들 펼침.
- [x] 리스크 — 결정2 충돌·cap 정책·LRU 프록시·evict 사고를 완화책과, Open Question 3건 사용자 분리.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다. 설계자(Claude)는 위쪽을 쓰고, 구현자는 이 블록만 추가한다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행:
  - 0055 의 핵심 경계인 **count=Supervisor active + Pool idle**, **eviction victim=idle only** 를 코드 주석과 `getRuntimePopulation()` 으로 고정했다.
  - `RuntimePool` 은 저장/close mechanism 으로 남기고, victim 선정은 `EvictionPolicy` 로 분리했다. policy 는 Map/Timer 를 직접 보지 않고 snapshot 과 capacity 만 받는다.
  - `RuntimeCapPolicy` 기본값은 `UnlimitedRuntimeCapPolicy` 로 유지해 게이트 OFF/ON 기본 동작을 보존했다.
  - `ConcurrencyRegistry` 는 `orchestration/concurrency.ts` 파일을 이동하지 않고 `RuntimeSupervisor` 소유 + getter 노출로만 이관했다.
- 이견 / 우려:
  - plan 의 `selectVictims(entries, capacity)` 에서 capacity 의미가 구현 중 모호해질 수 있어, 구현에서는 **idle target capacity** 로 명시했다. Supervisor 가 total cap 에서 active 를 빼 `RuntimePool.evictToCapacity(idleTargetCapacity)` 로 넘긴다.
  - 기본 무제한만 두면 bounded 경로가 테스트 전용 ad-hoc 이 될 수 있어, `BoundedRuntimeCapPolicy` 를 L1 정책으로 함께 제공했다. 단 실제 기본 주입은 여전히 무제한이다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `EvictionPolicy.capacity` 가 전체 cap 인지 idle cap 인지 모호하면 active 수가 섞여 과축출/부족축출 가능 | ✅ 구현함 — Supervisor 가 `idleTargetCapacity=max(0, capacity-active)` 로 변환하고, EvictionPolicy 는 idle target 만 받도록 주석/테스트 고정 | AC 1·2, QA #1 |
| 2 | `RuntimePool.closeEntry` 단일화를 하려면 `onReap` 이 entry 에 저장되어야 함 | ✅ 구현함 — idle entry 에 `onReap` 포함, prev 교체/timer/closeAll/evict 전부 단일 helper 경유 | AC 5, QA #3 |
| 3 | 기본 무제한 정책만 있으면 bounded cap seam 이 실제 주입 경로에서 검증되지 않음 | ✅ 구현함 — `BoundedRuntimeCapPolicy` 를 L1 정책으로 추가하고 supervisor 테스트에서 동일 constructor 경로로 검증 | AC 3 |
| 4 | `closeAll()` 이 Map 순회 중 삭제하면 순회 누락 위험 | ✅ 구현함 — key snapshot 기반 `closeAll()` 로 변경 | AC 5 |

## [구현자 기입] 구현 체크리스트

- [x] count 3종 disambiguation 주석/문서 (count=active+idle · victim=idle only)
- [x] EvictionPolicy 순수 추출(Map 비의존·victim 키 반환) + LRU 기본 + 테스트
- [x] RuntimeCapPolicy hook + 기본 Unlimited(union=accept|evict-idle)
- [x] ConcurrencyRegistry 소유 Supervisor 이관 + getter + `RouterContext.concurrency` 제거(파일 미이동)
- [x] idempotent close 단일 helper(기존 4경로 합류) + 경쟁 테스트
- [x] `getRuntimePopulation()` + population 테스트
- [x] 게이트 OFF 동작보존 확인

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/lifecycle/{eviction-policy,runtime-cap-policy,runtime-pool,supervisor}.ts`, 관련 테스트, `app/src/main/ipc/{router,context}.ts`, `app/src/main/ipc/chat/send.ts`, 본 plan 구현자 블록 |
| 실행 명령 | `git pull --ff-only`(upstream 없음으로 실패), `npm run lint`, `npm run typecheck`, `npm test`, `npm rebuild better-sqlite3 && npm test` |
| 게이트 결과 | lint ✅, typecheck ✅, 최초 test ⚠️ better-sqlite3 ABI 불일치 12건, rebuild 후 test ✅ 597/597 |
| 블로커 / 역질문 | 없음. cap 수치·평가세션 cap 회계는 plan Open Question 유지. |
| 대상 커밋 | `0baaea4` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | … | … | open |

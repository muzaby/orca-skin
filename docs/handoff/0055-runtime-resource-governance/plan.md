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

1. **count 3종 disambiguation 문서화.** 코드(주석) + 본 plan 에서 cap 의 대상이 **SessionRuntime 인구(Pool idle + Supervisor active)** 임을 명시하고, ConcurrencyRegistry 의 프로젝트별 *턴* 경고게이트(0039·0056 소관)와 혼동하지 않도록 가른다. (§A ⑭ 근거.)
2. **`EvictionPolicy` 추상화 + 기본 LRU.** 순수·주입형 정책으로 추출 — `(entries, capacity) → victims`. RuntimePool 메커니즘(저장/close)과 분리. 기본 구현 = LRU(가장 오래된 idle 우선, `idle.keys().next()` 프록시). 단위테스트 포함.
3. **`RuntimeCapPolicy` 주입 + 기본 무제한(동작보존).** 런타임 획득(`acquireRuntime`)·idle 보존(`keepIdle`) 경로에 cap 판정 hook. cap 초과 시 동작은 정책 위임(기본=무제한 pass-through). **기본값에서 게이트 OFF/ON 모두 현 동작 보존**.
4. **ConcurrencyRegistry 소유 Supervisor 이관 — 파일 미이동(결정 2 준수).** 소유/생성을 컴포지션 루트→Supervisor 로 옮기고 코디네이터엔 노출만. **`orchestration/concurrency.ts` 파일은 이동·리네임하지 않는다**(결정 2 = 코드 리네임 연기). plan·주석에 "소유 이관 ≠ 리네임" 명시. 소비(admission 판정)는 0056.
5. **idempotent close 단일경로(self-idle vs LRU 이중 close 0).** LRU eviction 과 IdleCloseTimer self-reap 이 같은 런타임을 동시에 닫아도 close 가 1회만 효력. eviction=타이머 clear 후 단일 경로 close, timer 발화=map 선제거. 경쟁 회귀테스트 포함.
6. **게이트 OFF 동작·이벤트·DB·UX 무변경 + lifecycle 게이트 green.** 기본 OneShot(게이트 OFF)에서 pool 미진입 → cap/eviction 무력 → 이벤트 시퀀스·DB parts·UX 0 변경. `cd app && npm run lint && npm run typecheck && npm test` 통과, 신규 테스트(eviction·cap·close 경쟁) green.
7. **레이어 경계·순환 0.** boundaries(L1↔L3 하향만)·`import/no-cycle` 위반 0. Supervisor(L1)→`orchestration/concurrency`(L1) 동일레이어 import 가 순환을 만들지 않음 확인.

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
| `EvictionPolicy` | `selectVictims(entries: IdleEntry[], capacity): IdleEntry[]` | **LRU**(가장 오래된 idle 먼저; `idle` Map 삽입순 프록시) | `RuntimePool` 생성자(기본 LRU) |
| `RuntimeCapPolicy` | `admit(ctx: { active, idle, capacity }): 'accept' \| 'evict' \| 'reject'` | **무제한**(`accept`) | `RuntimeSupervisor` 생성자/컴포지션 루트 |

- `acquireRuntime`/`keepIdle` 경로에서 cap 정책에 질의 → `evict` 면 `EvictionPolicy` victim 들을 **단일 close 경로**로 닫고 진행, `reject` 면 호출측에 신호(기본은 발생 안 함). **기본값 조합(무제한+LRU 미발동) = 현 동작.**
- victim close 와 IdleCloseTimer self-reap 의 **단일 close 경로**(F5): `RuntimePool` 내부 private `closeEntry(sessionId)`(타이머 clear → map delete → `runtime.close()` → `onReap`)로 양쪽이 수렴. timer 콜백·evict 모두 이 경로만 호출.

### count disambiguation (F1)
- **cap 대상 = SessionRuntime 인구** = Supervisor active(턴 핸들) ∪ RuntimePool idle. 주로 idle 풀이 한도 압력의 진원(Persistent 누적).
- ConcurrencyRegistry = 프로젝트별 *턴* 경고게이트(0039) → **소유만** Supervisor 로(아래), 소비(admission)는 0056. cap 카운트에 섞지 않는다.

### ConcurrencyRegistry 소유 이관 (F3 — 파일 미이동)
- 현재: 컴포지션 루트(`ipc/router.ts`)가 ConcurrencyRegistry 를 만들어 TurnCoordinator 에 직접 주입.
- 변경: **Supervisor 가 보유**(생성 또는 주입받아 소유) + getter 로 코디네이터에 노출. 개념상 §A ⑭(동시성=자원 supervision)과 정렬.
- **파일은 `orchestration/concurrency.ts` 그대로** — 결정 2(코드 리네임 연기) 위반 아님. Supervisor(L1)→orchestration(L1) import 는 동일레이어 허용.

### 재사용할 기존 함수·파일
- `@app/src/main/lifecycle/supervisor.ts`(acquireRuntime/releaseRuntime/release/closeIdleRuntimes·seam 주석) · `@app/src/main/lifecycle/runtime-pool.ts`(take/keepIdle/size/closeAll) · `@app/src/main/lifecycle/timers.ts`(IdleCloseTimer) · `@app/src/main/lifecycle/abort.ts` · `@app/src/main/orchestration/concurrency.ts`.
- 레이어 경계: 신규 정책 파일은 L1 `lifecycle/`(예: `eviction-policy.ts`·cap 은 supervisor 내부 또는 별 모듈) — 하향 의존만, 매직넘버는 컴포지션 루트.

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
  - **OQ2. over-cap 정책**: evict-idle-first(권장) vs reject(획득 차단).
  - **OQ3. 평가세션(ownerless system runtime)의 cap 회계 포함 여부** (§A P1 경계).

## 영향 받는 파일

- `app/src/main/lifecycle/runtime-pool.ts`(EvictionPolicy 주입·단일 close 경로·evict)
- `app/src/main/lifecycle/supervisor.ts`(RuntimeCapPolicy hook·ConcurrencyRegistry 소유)
- 신규 `app/src/main/lifecycle/eviction-policy.ts`(+ `*.test.ts`) — 순수 LRU 정책
- `app/src/main/ipc/router.ts`(컴포지션 루트 — 정책/registry 배선 이관)
- 테스트: `runtime-pool.test.ts`·`supervisor.test.ts` 확장(cap·evict·close 경쟁)
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

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·결정 필요 | … |

## [구현자 기입] 구현 체크리스트

- [ ] count 3종 disambiguation 주석/문서
- [ ] EvictionPolicy 추출 + LRU 기본 + 테스트
- [ ] RuntimeCapPolicy hook + 무제한 기본
- [ ] ConcurrencyRegistry 소유 Supervisor 이관(파일 미이동)
- [ ] idempotent close 단일경로 + 경쟁 테스트
- [ ] 게이트 OFF 동작보존 확인

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | … | … | open |

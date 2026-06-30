# Plan — 0056-turn-admission-steer-queue

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A staging **P1 의 "턴 admission"** 증분이다 — busy SessionRuntime 에 도착한 새 입력의 admission 을 **`AdmissionController`(메커니즘) + `AdmissionPolicy`(정책)** 로 1급화한다. **이번 범위 = framework only**: 추상화 seam + **현행 default(reject) 무회귀 보존**. 의도된 default 는 **steer** 이나 steer 는 streaming-input 선행이 없어 *지금 구현 불가* → steer/queue 메커니즘은 후속 핸드오프. (0054 가 정책을 비우고 seam 만 남겨 0055 가 채운 규율과 동일.)

## 메타

| 항목 | 값 |
|---|---|
| slug | `0056-turn-admission-steer-queue` |
| 작성자 | Claude Code |
| 일자 | 2026-06-29 (READY 승격 2026-06-30) |
| 매핑 | PHASES 행 / PR (요청 시) |
| 상태 | **READY** (OQ 사용자 결정 완료 → 인수 기준 8개 번호 고정 → self-review 전 항목 ✅) |
| 구현 주체 | **Codex** (기능 — 턴 admission abstraction) |
| 선행 | `0055-runtime-resource-governance`(ConcurrencyRegistry 소유 이관·Supervisor) · `0040`(새-채팅 직렬 디스패치/FIFO) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 결정 | 남은 0055 seam 을 **분할** — steer/queue 턴 admission 을 0055(자원 거버넌스)에서 떼어 별 핸드오프로. | 라이브 세션 AskUserQuestion(2026-06-29, "분할 0055+0056") |
| 명시 결정 (OQ1) | **의도된 default admission 동작 = steer**(실행 중 턴에 주입). | 라이브 세션 AskUserQuestion(2026-06-30, "Steer") |
| 명시 결정 (빌드 범위) | 이번 0056 = **framework only** — 추상화 + 현행 default(reject) 보존만 1급 배선. queue/steer 메커니즘은 후속. | 라이브 세션 AskUserQuestion(2026-06-30, "Framework only") |
| 명시 결정 (cap 축) | cap-over-capacity admission = **Accept 유지(inert, 0055 미러)** — cap reject/queue 실배선은 후속. | 라이브 세션 AskUserQuestion(2026-06-30, "Accept 유지") |
| 추론 의도 | UX 영향(2번째 메시지가 실행 중 턴을 가로채는가·기다리는가)이 커 steer/queue 메커니즘은 사람 시각검증이 필요한 후속 핸드오프. | 설계자 해석 |

## Context (왜)

현재 같은 세션이 busy(실행 중)일 때 새 입력은 `@app/src/main/ipc/chat/send.ts:163-179` 의 **인라인 hard reject 가드**가 처리한다(같은 세션 `supervisor.hasSession` / 새-채팅 슬롯 `supervisor.hasPending` → 에러 이벤트 "이미 진행 중인 턴이 있습니다", retryable). 이 정책이 코디네이터 셋업 코드에 박혀 있어 *교체·확장 지점*이 없다. 0051 §A 가로축은 입력을 `admission → acquire → send` 로 그렸고, P1 staging 에 steer/queue 를 적었다. 본 핸드오프는 그 인라인 가드를 **`AdmissionController`(메커니즘) + `AdmissionPolicy`(정책)** 로 추출해, *정책을 주입 지점으로* 만든다. 의도된 최종 default 는 steer 지만 steer 는 포트 부재로 지금 불가하므로(아래 자료조사 #2), 이번엔 **추상화 + 무회귀 reject default** 만 출하하고 실제 steer/queue 동작은 후속에 종속시킨다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **현행 default = 인라인 hard reject (≠ 경고게이트).** busy 시 같은 세션/새-채팅 슬롯의 2번째 send 를 에러 이벤트로 거부. 추출 대상은 바로 이 가드. | `@app/src/main/ipc/chat/send.ts:163-179` |
| **steer 는 현재 독립 구현 불가.** `streaming-input.ts` 는 턴-스코프(한 메시지 yield 후 `close()` 대기), `RuntimeLiveTurn`/`ManagedRuntime` 포트에 **`injectMessage` 없음**. steer 는 (a) 라이브 스트림 push 포트 메서드 + (b) cross-turn/persistent 입력 스트림 선행 요구 → **streaming-input 선행 핸드오프 종속**. | `@app/src/main/adapters/streaming-input.ts` · `@app/src/main/lifecycle/ports.ts:8-19,43-47` |
| `ConcurrencyRegistry` = 프로젝트별 활성 턴 **카운트 경고**(차단 없음, 0039). 0055 가 소유를 Supervisor 로 이관(`supervisor.concurrency`). admission 정책과 *별개* 축. | `@app/src/main/orchestration/concurrency.ts` · `@app/src/main/lifecycle/supervisor.ts:58-60` · INDEX 0039/0055 행 |
| busy 판정원 = `Supervisor.getBySession`(resume)·`hasPending`(새-채팅 owner). admission 입력 컨텍스트가 이 이중케이스를 보존해야 함. | `@app/src/main/lifecycle/supervisor.ts:76-86` · `@app/src/main/ipc/chat/send.ts:165-167` |
| 0040: 새-채팅 직렬 디스패치 게이트 + FIFO 큐 — queue 패턴 *선례*(단 새-채팅 슬롯 키잉, 세션별 턴 큐와 키 다름 → 패턴만 차용). | INDEX 0040 행 |
| §A 가로축: `입력→admission→acquire→send→query` + P1 staging 에 steer/queue 명시 | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A · `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md` §Staging(P1) |
| cap-driven `reject`/queue 는 0055 가 0056 으로 이관(0055 union=`accept\|evict-idle`). 단 cap default=무제한이라 현 동작=accept → 이번엔 inert seam. | `@docs/handoff/0055-runtime-resource-governance/plan.md` AC3·OQ2(해소) · `@app/src/main/lifecycle/supervisor.ts:136-142` |
| 외부 사례: OpenCode steer/queue admission + seq fencing | `@docs/etc/study/opencode/`(오케스트레이션 편) |

## 감독 스코프 (0051 §A 택소노미 — 축마다 다름)

**두 admission 축은 스코프가 다르다.** draft 가 뭉뚱그렸던 부분을 명시한다:

| 구분 | 스코프 | 0051 매핑 |
|---|---|---|
| `AdmissionController` 객체 | 애플리케이션-레벨 싱글톤(컴포지션 루트 배선, app-wide Supervisor 질의) | — |
| **이번 빌드 결정 (busy-session)** | **Orca Session 스코프** — 한 세션의 턴 슬롯 busy 만 판정. 다른 세션은 독립(멀티세션 동시성 보존 = 안 건드림). 결정 단위 = **SessionRuntime**(일시 핸들) | §A **가로축** turn-pipeline admission |
| cap-축 admission (후속·inert) | **애플리케이션 전체** — 전 세션 SessionRuntime population(active+idle) | 결정 ⑭ = §2 **자원 라이프사이클**(app-wide) |

→ **이번 0056(framework only)이 실제 감독하는 범위 = Orca Session 안**(세션별 가로축 턴 admission). 앱 전역 cap 인구 거버넌스는 별개 축이고 이번엔 inert seam 문서화만(0055 `RuntimeCapPolicy` 불변). 결정 단위는 **SessionRuntime** 이지 Orca Session(DB 진실)·전역 자원풀이 아니다.

## 인수 기준 (Acceptance Criteria)

1. **`AdmissionController` 1급화 (L1 `lifecycle/`).** busy 판정 시 주입된 `AdmissionPolicy` 를 질의해 `AdmissionDecision` 을 반환하는 **순수 결정기**(메커니즘↔정책 분리). 입력 컨텍스트 `{ sessionId, owner, hasInflight, isNewSession }` 가 resume/새-채팅 이중케이스(`hasSession`/`hasPending`)를 보존. **inflight 없음 → `accept`**(멀티세션 동시성 보존 — 정책 질의조차 안 함).
2. **기본 `RejectDuplicatePolicy` = `send.ts:163-179` 의 1:1 재현.** 동일 에러코드(`provider_connection_error`)·동일 문구·`retryable:true`·동일 이중케이스(sessionId 유무). `send.ts` 인라인 가드는 **제거하고 controller 위임으로 대체**(이중 게이트 0). 기본 동작·이벤트·DB·UX **0 변경**.
3. **`AdmissionDecision = 'accept' | 'reject' | 'queue' | 'steer'` — `queue`/`steer` 는 예약 seam(enactment 0).** union 타입엔 존재하되 기본 정책은 절대 반환하지 않고, enactment 경로도 없다(0054 가 cap union 을 비워둔 것과 동형). 후속 핸드오프 포인터 주석을 단다.
4. **enactment 레이어 분리.** L1 `AdmissionController` 는 **결정만** 반환. L3 `send.ts` 가 reject 결정을 기존 에러-이벤트 경로(`sendChatEvent`)로 enact 한다. L1 에 renderer forward·재디스패치 클로저 누수 0.
5. **cap 축 미접촉.** 0055 `RuntimeCapPolicy`(union `accept|evict-idle`) 불변. cap-over-capacity reject/queue 는 **비범위**(후속 seam 주석으로만 명시). cap default=무제한 → 현 동작=accept 보존.
6. **무회귀 게이트.** 이벤트·DB·UX 0 변경. `cd app && npm run lint && npm run typecheck && npm test` 통과 + 신규 `admission-controller.test.ts`(accept/reject 분기·이중케이스·`queue`/`steer` 미enact 회귀) green.
7. **레이어 경계·순환 0.** `AdmissionController`/`AdmissionPolicy` = L1 `lifecycle/`, 배선·정책 주입 = 컴포지션 루트(`router.ts`/`send.ts`). boundaries(L1↔L3 하향만)·`import/no-cycle` 0.
8. **IPC 무변경.** framework only — 신규 채널/NormalizedEvent variant 0. (후속에서 queue/steer 가 채널을 요구하면 그때 `@docs/IPC_CONTRACT.md` §6 갱신.)

## 범위 / 비범위

- **범위**: busy 런타임(같은 세션) 입력의 admission 을 `AdmissionController`+`AdmissionPolicy` 로 추출·1급화. 기본 `RejectDuplicatePolicy` 로 현행 동작 무회귀 보존. `AdmissionDecision` union 에 `queue`/`steer` 예약 seam.
- **비범위(후속)**:
  - **steer 메커니즘** → **streaming-input 선행 핸드오프 종속**(포트 `injectMessage` + cross-turn/persistent 입력 스트림). 의도된 default 지만 선행 없이는 불가.
  - **queue 메커니즘**(세션별 FIFO·0040 패턴 차용·컴포저 대기/취소/순서 UX) → 후속.
  - **cap-over-capacity reject/queue** → 후속(이번 inert/accept).
  - **`orchestration/`→supervision 코드 리네임** → Future(결정 2).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 모듈: `lifecycle/supervisor.ts`(getBySession·hasPending·hasSession)·`shared/ipc.ts`(`ClassifiedError`)·`runtime-errors/classifier.ts`(`makeClassifiedError`). 전부 기존.
- 전제: **0055 머지**(ConcurrencyRegistry 소유 Supervisor 이관 — admission 이 *별개 축*이라 직접 의존은 아니나 같은 Supervisor 표면 공유). 
- **신규 의존성 0** (순수 TS 정책 객체 + 기존 모듈 배선). IPC 무변경.

## 설계 (Framework only)

### 모듈화 — mechanism ↔ policy 분리 (핵심 추상화)
- **`AdmissionController`(L1)**: busy 판정 시점에만 질의되는 **순수 결정기**. inflight 없으면 `accept`(정책 미질의). busy 면 `AdmissionPolicy.decide(ctx)` 질의 → `AdmissionDecision`. Supervisor·renderer 를 직접 모르고, 필요한 조회는 작은 인터페이스(`hasInflight` 등)로 주입받아 테스트 가능.
- **`AdmissionPolicy`(L1, 주입)**: `decide(ctx: AdmissionContext): AdmissionDecision`. 기본 구현 `RejectDuplicatePolicy` = 현행 가드 1:1.
- **`AdmissionDecision = 'accept' | 'reject' | 'queue' | 'steer'`**: 안정 표면. 이번엔 `accept`/`reject` 만 enact, `queue`/`steer` 는 예약 seam.

| 요소 | 시그니처(개념) | 기본 구현 | 주입 위치 |
|---|---|---|---|
| `AdmissionPolicy` | `decide(ctx: { sessionId, owner, hasInflight, isNewSession }): AdmissionDecision` | **`RejectDuplicatePolicy`**(busy → `reject`, else `accept`) | 컴포지션 루트(`router.ts`) → `AdmissionController` |

### enactment 분리 (레이어 경계 — AC4)
- L1 `AdmissionController.admit(ctx)` → `AdmissionDecision`(순수).
- L3 `send.ts` 가 결정을 enact: `reject` → 기존 `sendChatEvent(error)` 경로(현 163-179 의 에러 블록을 그대로 재사용). `accept` → 계속 진행. `queue`/`steer` → **현재 도달 불가**(기본 정책이 반환 안 함) — 후속에서 L3 재디스패치/스트림 주입을 채운다.

### 재사용할 기존 함수·파일 + 권장 구조
- 재사용: `@app/src/main/ipc/chat/send.ts:163-179`(추출 원본)·`@app/src/main/runtime-errors/classifier.ts`(`makeClassifiedError`)·`@app/src/main/lifecycle/supervisor.ts`(busy 조회).
- 권장 파일 구조:
  - `lifecycle/admission-controller.ts` — `AdmissionController` + `AdmissionContext`/`AdmissionDecision` 타입.
  - `lifecycle/admission-policy.ts` — `AdmissionPolicy` 인터페이스 + 기본 `RejectDuplicatePolicy`.
  - `lifecycle/admission-controller.test.ts` — accept/reject 이중케이스 + `queue`/`steer` 미enact 회귀.
  - `ipc/chat/send.ts` — 인라인 가드 제거 → `admission.admit(...)` 위임 + reject enact.
  - `ipc/router.ts` — 컴포지션 루트 배선(정책 주입·controller 생성).
- 레이어: 신규 정책/컨트롤러 = L1 `lifecycle/` — 하향 의존만, 구체 enactment 는 L3.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **멀티세션**: inflight 없는 *다른* 세션 입력은 `accept`(현행 보존). 비활성 세션 입력은 기존 키 라우팅(0013/0033) 보존.
- **reject**: 현행과 동일 — 에러 토스트만. (입력 비활성화 등 UX 변경은 비범위.)
- **새-채팅 슬롯**: `sessionId=null` + `hasPending(owner)` 케이스도 `RejectDuplicatePolicy` 가 동일 처리(이중케이스).
- **권한 재진입(canUseTool)**: 기본 정책이 turn 흐름을 바꾸지 않으므로 0046 idle-pause/approval 경로와 상호작용 0(후속 steer/queue 도입 시 검증 항목으로 이월).
- **queue/steer(후속)**: 큐 대기 표시·취소·순서, steer 주입 타이밍·중복 권한 카드·subagent 영향 → 후속 핸드오프의 사람 시각검증 항목.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 추출이 현행 reject 동작을 미세하게 바꿈(에러코드/문구/이중케이스) | `RejectDuplicatePolicy` 를 163-179 **1:1 재현**으로 고정 + 회귀 테스트(AC2·6). |
| `queue`/`steer` union 멤버가 dead seam 으로 방치 | 후속 핸드오프 포인터 주석 + 미enact 회귀 테스트(AC3·6). 0054→0055 seam 선례. |
| 의도된 default(steer)와 출하 default(reject) 불일치 | **의도된 default=steer 를 forward-pointer 로 명시**(아래 후속). steer 는 streaming-input 선행 없이는 불가 — 선행 머지 후 별 핸드오프에서 default 전환. |
| cap 축과 혼동(두 admission 축) | §감독 스코프 표로 분리 명시. cap 은 inert(AC5). |

- 되돌리기 어려운 결정: 없음(framework only·무회귀, 정책은 후속 교체 가능).
- **후속 (단독 결정 아님 — 사용자 결정 기록됨)**:
  - **steer 의도 default**: streaming-input 선행(포트 `injectMessage` + cross-turn 스트림) 머지 → steer 메커니즘 + default 전환 핸드오프.
  - **queue 메커니즘 + 컴포저 UX**: 필요 시 별 핸드오프(0040 패턴).
  - **cap reject/queue + cap 회계(큐/평가세션 포함 여부)**: 0055 §A P1 경계 후속.

## 영향 받는 파일

- 신규 `app/src/main/lifecycle/admission-controller.ts`(+ `admission-controller.test.ts`)
- 신규 `app/src/main/lifecycle/admission-policy.ts`(`AdmissionPolicy` + `RejectDuplicatePolicy`)
- `app/src/main/ipc/chat/send.ts`(인라인 가드 163-179 제거 → controller 위임 + reject enact)
- `app/src/main/ipc/router.ts`(컴포지션 루트 — 정책 주입·controller 생성)
- (코드 변경 없음) `orchestration/concurrency.ts`·`lifecycle/supervisor.ts` 의 cap 경로 — 미접촉
- IPC: **변경 없음** (framework only)

## 참고 문서

- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A · `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md`(P1)
- `@docs/handoff/0055-runtime-resource-governance/plan.md`(선행·cap 축) · `@docs/etc/study/opencode/`(steer/queue 사례)
- IPC 변경 시(후속) `@docs/IPC_CONTRACT.md` §6.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `admission-controller` 분기(accept/reject·resume/새-채팅 이중케이스·`queue`/`steer` 미enact)·기본 정책 무회귀.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 + AskUserQuestion(OQ1·빌드범위·cap) 출처 인용, 추론 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`@docs/…`·`파일:라인`). 현행 baseline(reject)·steer 포트 부재 명시.
- [x] 인수 기준 — 8개 번호·검증 가능·framework only·무회귀.
- [x] 의존 기술 — 기존 L1 모듈, 신규 의존성 0, IPC 무변경.
- [x] 파생 UX — 멀티세션/reject/새-채팅 슬롯/권한 재진입 + queue/steer 후속 펼침.
- [x] 리스크 — 추출 회귀·dead seam·default 불일치·cap 혼동 완화책 + 후속 사용자 결정 기록.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 0056 은 실제 steer/queue 를 만들기보다, 현재 `send.ts` 인라인 중복 턴 가드를 L1 결정기 + L3 enactment 로 분리하는 것이 핵심이다. 이 방향은 0051 §A 의 가로축(`admission → acquire → send`)과 app/main 레이어 DAG 에 부합한다.
- 보강 적용: `AdmissionDecision` 은 후속 확장을 고려해 단순 문자열이 아니라 discriminated union 으로 구현했다. `RejectDuplicatePolicy` 는 reject reason 만 반환하고, renderer-facing `ClassifiedError` 생성은 L3 `send.ts` enactment 에 남겨 lifecycle policy 가 IPC/UX payload 에 과결합되지 않게 했다.
- 이견 / 우려: `queue`/`steer` 는 union seam 으로만 존재하므로 dead seam 위험이 있다. 기본 정책이 해당 결정을 반환하지 않는 테스트와 `send.ts` 후속 포인터 주석으로 이번 범위의 미enact 불변식을 고정했다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 단순 문자열 decision 은 후속 queue/steer 에 필요한 메타데이터 확장 시 breaking change 를 유발할 수 있음 | ✅ `AdmissionDecision` 을 `{ kind: ... }` discriminated union 으로 구현 | 후속 정책 교체 시 switch 기반 exhaustive 확장 가능 |
| 2 | L1 policy 가 `makeClassifiedError` 를 직접 만들면 lifecycle 이 renderer-facing error shape 에 결합됨 | ✅ policy 는 `reason: 'duplicate-turn'` 만 반환, 기존 에러 생성은 L3 enactment 에 유지 | AC4 enactment 분리 및 레이어 책임 보존 |
| 3 | resume 세션 busy 와 새-채팅 pending busy 가 boolean 하나로 뭉개질 수 있음 | ✅ `AdmissionTarget` 을 `existing-session` / `new-session-slot` 으로 구분 | 기존 `hasSession` / `hasPending` 이중케이스 회귀 방지 |
| 4 | `queue`/`steer` 예약 seam 이 실제 동작으로 새어 나올 수 있음 | ✅ 기본 정책 미반환 테스트 + L3 주석/fallback | 0056 framework-only 범위 보존 |

## [구현자 기입] 구현 체크리스트

- [x] AdmissionController(순수 결정·inflight 없으면 accept)
- [x] AdmissionPolicy + RejectDuplicatePolicy(163-179 1:1)
- [x] AdmissionDecision union(queue/steer 예약 seam·미enact)
- [x] send.ts 인라인 가드 제거 → 위임 + reject enact
- [x] router.ts 배선
- [x] admission-controller.test.ts(분기·이중케이스·미enact)
- [x] 게이트 green

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/lifecycle/admission-policy.ts`, `app/src/main/lifecycle/admission-controller.ts`, `app/src/main/lifecycle/admission-controller.test.ts`, `app/src/main/ipc/chat/send.ts`, `app/src/main/ipc/router.ts`, `docs/handoff/0056-turn-admission-steer-queue/plan.md`, `docs/handoff/INDEX.md` |
| 실행 명령 | `cd app && npm run lint`; `cd app && npm run typecheck`; `cd app && npm test`(초회 better-sqlite3 ABI mismatch); `cd app && npm rebuild better-sqlite3 && npm test` |
| 게이트 결과 | lint/typecheck 통과, test 는 초회 better-sqlite3 ABI mismatch 후 Node ABI rebuild 뒤 601/601 통과 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `d76d153` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | … | … | open |

# Plan — 0056-turn-admission-steer-queue

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A staging **P1 의 "턴 admission"** 증분이다 — busy SessionRuntime 에 도착한 새 입력을 **steer(주입) / queue(직렬) / reject(경고)** 중 무엇으로 받을지의 정책·메커니즘. **중심 동작이 product 포크라 사용자 정책 결정 전까지 `DRAFT`** 로 둔다(framework + Open Question 만 확정).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0056-turn-admission-steer-queue` |
| 작성자 | Claude Code |
| 일자 | 2026-06-29 |
| 매핑 | PHASES 행 / PR (요청 시) |
| 상태 | **DRAFT** (steer/queue/reject 기본값 = 사용자 결정 전 보류 → 결정 후 READY) |
| 구현 주체 | **Codex** (기능 — 턴 admission/UX) |
| 선행 | `0055-runtime-resource-governance`(ConcurrencyRegistry 소유 이관·Supervisor) · `0040`(새-채팅 직렬 디스패치/FIFO) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 결정 | 남은 0055 seam 을 **분할** — steer/queue 턴 admission 을 0055(자원 거버넌스)에서 떼어 별 핸드오프로. | 라이브 세션 AskUserQuestion(2026-06-29, "분할 0055+0056") |
| 명시 결정 | busy/cap 초과 시 admission 동작(steer vs queue vs reject) = **Open Question 유지** — framework·추상화만 두고 기본값은 사용자 결정. | 라이브 세션 AskUserQuestion(2026-06-29, "Open Question 유지") |
| 추론 의도 | UX 영향(2번째 메시지가 실행 중 턴을 가로채는가·기다리는가)이 커 사람 시각검증이 필요한 핸드오프. | 설계자 해석 |

## Context (왜)

현재 같은 세션이 busy(실행 중)일 때 새 입력의 처리는 일관된 1급 정책이 없다 — ConcurrencyRegistry 는 같은 projectId 동시 query 를 **렌더러 경고**로만 알리고(차단·락 없음, 0039), 새-채팅 동시성은 0040 의 직렬 디스패치 게이트로 막았다. 0051 §A 가로축은 입력을 `admission → acquire → send` 로 그렸고, P1 staging 에 "steer/queue" 를 적었다. 본 핸드오프는 busy 런타임에 대한 입력 처리를 **AdmissionController(메커니즘) + AdmissionPolicy(정책)** 로 1급화한다. 단 "가로채기(steer) vs 줄세우기(queue) vs 거부(reject)" 는 사용자 경험을 가르는 product 결정이라 기본값을 단독으로 정하지 않는다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 0054 seam: "steer/queue admission · true streaming-input" 0055 비범위로 예약 | `@app/src/main/lifecycle/supervisor.ts:10` · INDEX 0054 행 |
| §A 가로축: `입력→admission→acquire→send→query` + P1 staging 에 steer/queue 명시 | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A · `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md` §Staging(P1) |
| ConcurrencyRegistry = 프로젝트별 활성 턴 경고게이트(차단 없음). 0055 가 소유를 Supervisor 로 이관 | `@app/src/main/orchestration/concurrency.ts` · INDEX 0039 행 · `@docs/handoff/0055-runtime-resource-governance/plan.md` §4 |
| 0040: 새-채팅 직렬 디스패치 게이트 + FIFO 큐(`pendingNewChatKey`·`newChatQueue`) — queue 패턴 선례 | INDEX 0040 행 |
| `RuntimeLiveTurn` + streaming-input(long-lived AsyncIterable) — steer(실행 중 턴에 메시지 주입)의 메커니즘 토대 | `@app/src/main/lifecycle/ports.ts`(RuntimeLiveTurn) · `@app/src/main/adapters/streaming-input.ts` |
| Supervisor.getBySession 으로 in-flight 턴 조회 가능 → admission 진입에서 busy 판정 | `@app/src/main/lifecycle/supervisor.ts:48-54` |
| 외부 사례: OpenCode steer/queue admission + seq fencing | `@docs/etc/study/opencode/`(오케스트레이션 편) |

## 인수 기준 (Acceptance Criteria)

> **DRAFT** — 기본 정책(OQ1) 확정 후 번호별로 검증 가능하게 고정한다. 아래는 framework 골격.

1. **`AdmissionController` 1급화.** 턴 파이프라인 진입(`ipc/chat/send.ts` 컴포지션 루트 → 위임)에서 새 턴 요청 시 Supervisor in-flight(`getBySession`) 판정 후 `accept | queue | steer | reject` 분기. 메커니즘과 정책 분리.
2. **`AdmissionPolicy` 추상화 + 기본=현 동작 보존.** 주입형 정책. 기본 구현은 현 동작(멀티세션 턴 허용 + 같은 세션 경고게이트)을 보존 — 신규 blocking 0.
3. **선택된 정책 메커니즘 구현** (OQ1 결정에 따라 1+): queue=FIFO 직렬(0040 패턴 재사용)·steer=streaming-input 주입·reject=ConcurrencyRegistry 경고(0039 재사용).
4. **게이트/무회귀.** 기본 정책에서 이벤트·DB·기존 UX 0 변경. `cd app && npm run lint && npm run typecheck && npm test` 통과 + 신규 admission 테스트 green.
5. **레이어 경계·순환 0.** AdmissionController=L1, 컴포지션 루트 배선. boundaries·no-cycle 0.
6. **IPC/UX 정합(해당 시).** queue/steer 가 새 채널·NormalizedEvent variant 를 요구하면 `@docs/IPC_CONTRACT.md` §6 동시 갱신.

## 범위 / 비범위

- **범위**: busy 런타임 입력의 admission 정책·메커니즘(steer/queue/reject) 1급화. ConcurrencyRegistry **소비**(판정).
- **비범위**: cap/LRU 자원 거버넌스(0055)·ConcurrencyRegistry **소유 이관**(0055)·`orchestration/` 리네임(Future)·멀티에이전트 워크플로 handoff(Future continuity).

## 의존 기술 / 전제

- 기댈 모듈: `lifecycle/supervisor.ts`(getBySession·소유 registry)·`adapters/streaming-input.ts`(steer)·0040 FIFO 패턴·`orchestration/concurrency.ts`(reject/warn).
- 전제: **0055 머지**(ConcurrencyRegistry 소유 Supervisor 이관 — admission 이 소비). steer 는 true streaming-input(long-lived live 재사용) 전제 가능 → 의존 시 Open Question.
- 신규 의존성: 없음 예상(채널 추가 가능 — IPC_CONTRACT 갱신).

## 설계 (framework)

- **AdmissionController(메커니즘)** ← `AdmissionPolicy(정책)` 주입. 입력: `{ sessionId, hasInflight, runtimeState }`. 출력: `accept | queue | steer | reject`.
- **재사용**: queue → 0040 직렬 디스패치/FIFO. steer → `RuntimeLiveTurn` streaming-input 주입. reject → ConcurrencyRegistry 경고(0039).
- **기본 정책 = 현 동작 보존**(멀티세션 허용 + 경고게이트), 실제 동작 전환은 OQ1 결정 후.
- 레이어: AdmissionController = L1 `lifecycle/`(또는 turn pipeline 인접), 컴포지션 루트 배선·정책 주입.

## 파생 UX / 엣지케이스

- **queue**: 큐 대기 메시지의 컴포저 표시·취소·순서 — UX 결정(OQ).
- **steer**: 실행 중 턴 도구 호출 사이 주입 타이밍·중복 권한 카드·subagent 영향 — 검증 필요.
- **reject**: 경고만 vs 입력 비활성 — 0039 유지 여부.
- **멀티세션**: 비활성 세션 입력은 기존 키 라우팅(0013/0033) 보존.
- **a11y/시각**: 큐/steer 상태 표시는 사람 시각검증 필요.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| steer/queue/reject 기본값이 UX 를 가름 | **단독 결정 금지** → OQ1. 기본=현 동작 보존으로 출하 가능하게 framework 설계. |
| steer 가 true streaming-input(후속) 의존 | 의존 시 0056 을 streaming-input 후속에 종속 — OQ2 로 분리. |
| 권한 재진입(canUseTool)과 steer 주입 충돌 | 0046 idle pause/approval 경로와의 상호작용 검증 항목으로. |

- **단독 결정 금지 항목(Open Question)** → 사용자에게:
  - **OQ1. 기본 admission 동작**: steer vs queue vs reject(현 경고 유지).
  - **OQ2. steer 의 Persistent/true-streaming-input 의존 여부**(독립 구현 가능한가).
  - **OQ3. 큐 메시지 컴포저 UX**(표시·취소·순서).
  - **OQ4. cap(0055)과의 상호작용**(큐가 cap 회계에 포함되나).

## 영향 받는 파일 (예상)

- 신규 `app/src/main/lifecycle/admission-controller.ts`(+ policy + `*.test.ts`)
- `app/src/main/ipc/chat/send.ts`(진입에서 위임)
- `app/src/main/ipc/router.ts`(배선)
- (해당 시) `app/src/shared/ipc.ts` · `docs/IPC_CONTRACT.md`(채널/variant)

## 참고 문서

- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A · `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md`(P1)
- `@docs/handoff/0055-runtime-resource-governance/plan.md`(선행) · `@docs/etc/study/opencode/`(steer/queue 사례)
- IPC 변경 시 `@docs/IPC_CONTRACT.md` §6.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: AdmissionController 분기(accept/queue/steer/reject)·기본 정책 무회귀.

## 설계 self-review 체크리스트 (READY 전 — **현재 DRAFT**)

- [x] 사용자 의도 — 라이브 세션 + AskUserQuestion 출처.
- [x] 자료조사 — 레퍼런스 첨부.
- [ ] 인수 기준 — **OQ1(기본 정책) 결정 후** 번호 고정(현 framework 골격).
- [x] 의존 기술 — 0055 선행·streaming-input 의존(OQ2) 식별.
- [x] 파생 UX — queue/steer/reject·멀티세션·a11y 펼침.
- [x] 리스크 — Open Question 4건 사용자 분리.

> **READY 전환 조건**: OQ1(기본 admission 동작) 사용자 결정 → 인수 기준 번호 확정 → self-review 전 항목 ✅.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다 (READY 후).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ / ⚠️ | … |

## [구현자 기입] 구현 체크리스트

- [ ] (OQ1 결정 후 확정)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | … | … | open |

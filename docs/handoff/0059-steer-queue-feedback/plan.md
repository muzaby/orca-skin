# Plan — 0059-steer-queue-feedback

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A staging **P1 의 "steer/queue enactment"** 잔여를 채운다 — 0056 이 `AdmissionController`/`AdmissionPolicy` 를 framework-only 로 놓고 `queue`/`steer` 를 예약 seam 으로 남긴 것을, **실제 동작(피드백 끼어들기)** 으로 enact 한다. **backend 기전 + renderer UX 를 한 핸드오프에 통합**(사용자 결정)하되, 구현 순서는 **① 기전(main+IPC) → ② UX(renderer)** 로 단계화한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0059-steer-queue-feedback` |
| 작성자 | Claude Code |
| 일자 | 2026-07-01 |
| 매핑 | PHASES 행 / PR (요청 시) |
| 상태 | **READY** |
| 구현 주체 | **Codex** (기능 — 턴 admission steer/queue enactment + 컴포저/transcript UX) |
| 선행 | `0056-turn-admission-steer-queue`(AdmissionController framework) · `0052`(TurnCoordinator) · `0054`(streaming-input 스캐폴드·SessionRuntime) · `0013`(renderer 세션별 store 라우팅) · `0046`(approval idle-pause) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 (범위) | 0051 잔여 중 **A(steer/queue enactment)** 만 새 핸드오프로 설계. | 라이브 세션 AskUserQuestion(2026-07-01, "A만: steer/queue enactment") |
| 명시 요구 (구조) | backend+renderer 를 **단일 통합 핸드오프 0059** 에 담는다. | 라이브 세션 AskUserQuestion(2026-07-01, "통합: 단일 핸드오프 0059") |
| 명시 요구 (UX 1) | 어시스턴트 답변 진행 중 + 컴포저 입력이 **비어있지 않으면**: placeholder='피드백 보내기', **중단 버튼 → 보내기 버튼 토글**. 이 보내기는 일반 턴이 아니라 **steer/queue** 로 동작(툴팁으로 구분 안내). | 라이브 세션 요청(2026-07-01, 요구 1) |
| 명시 요구 (UX 2) | steer/queue 로 입력된 메시지는 **끼어들기(응답확정) 전까지** 진행중 어시스턴트 메시지 **아래 사용자 턴**에 위치하고, 버블 폰트는 **연하게/기울임**. | 라이브 세션 요청(2026-07-01, 요구 2) |
| 명시 요구 (UX 3) | 끼어들기 성공 시 **사용자 턴 메시지로 그 위치에 고정**, **DB 영속 + 정상 폰트**. | 라이브 세션 요청(2026-07-01, 요구 3) |
| 명시 요구 (UX 4) | 끼어들기 메시지는 **내부 queue 에 append**. 성공 전엔 사용자 버블 위치에서 **다중턴**으로 표시. 성공 시 **다중턴 아닌 단일턴으로 큐 전체를 한 번에 flush**(사용자 버블 1개). | 라이브 세션 요청(2026-07-01, 요구 4) |
| 명시 요구 (UX 5) | 끼어들기 성공 전, pending 메시지 **hover 시 취소 버튼** 활성. 클릭 시 **큐에서 삭제** + 해당 내용을 **컴포저 입력란에 자동 재주입**. | 라이브 세션 요청(2026-07-01, 요구 5) |
| 명시 정정 | **"큐 소비는 이벤트가 아니다"** — SDK 스트리밍 입력의 큐 소비는 output 이벤트가 아니라 producer-side pull 이다. | 라이브 세션 요청(2026-07-01) + [SDK 문서](https://code.claude.com/docs/ko/agent-sdk/streaming-vs-single-mode) |
| 추론 의도 | 요구 2~4 는 `steer`/`queue` 를 형제 결정이 아니라 **"pending 큐 → 끼어들기 flush" 단일 흐름**으로 본다(내 해석). flush 시점을 결정하는 것이 "끼어들기 성공"이며 그 신호는 producer pull. | 설계자 해석 |

## Context (왜)

현재 같은 세션이 busy 일 때 새 입력은 `AdmissionController`(0056)가 처리하지만, 기본 `RejectDuplicatePolicy` 가 **hard reject** 하고 `enactAdmissionDecision`(`@app/src/main/ipc/chat/send.ts:164-198`)이 `queue`/`steer` 도 동일 에러로 막는 **dead seam** 이다. 0051 §A 가로축(`입력→admission→acquire→send`)의 P1 staging 은 steer/queue 를 적었고, 0056 은 "steer 는 streaming-input 선행 핸드오프 종속"이라고 명시적으로 이 핸드오프를 forward-point 했다. 본 핸드오프는 그 선행이 이미 코드에 있음을 확인(아래 조사)하고, **피드백 끼어들기** 를 backend 기전 + renderer UX 로 완성한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| **streaming-input 스캐폴드 기존재.** `createTurnInputStream(content)` 은 내부 `queue`+`wake` 루프를 가진 턴-스코프 입력 스트림 — 최초 1건 yield 후 `close()` 까지 미종료. **`push()` 미노출**이라 다중 메시지 주입 불가. steer 의 결정적 seam. | `@app/src/main/adapters/streaming-input.ts` |
| **큐 소비 = producer pull, output 이벤트 아님.** prompt 는 SDK 가 `next()` 로 당기는 AsyncGenerator, 큐 메시지는 "순차 처리". 소비를 알리는 output 이벤트 없음 → 우리 제너레이터의 yield 지점에서 결정적으로 관측. | [SDK streaming-input 문서](https://code.claude.com/docs/ko/agent-sdk/streaming-vs-single-mode) |
| **포트에 `injectMessage` 없음.** `LiveTurn`/`RuntimeLiveTurn`/`ManagedRuntime` 에 mid-turn 입력 주입 표면 부재. 단 "라이브 미지원 백엔드는 no-op 반환 가능" 규약은 이미 문서화 → capability 폴백 패턴 재사용. | `@app/src/main/adapters/types.ts:13-28` · `@app/src/main/lifecycle/ports.ts:8-19,43-47` |
| **AdmissionDecision 예약 seam.** `queue`/`steer` union 멤버 존재, enact 만 비어있음(0054→0055 seam 규율 동형). 기본 정책이 반환 안 함. | `@app/src/main/lifecycle/admission-policy.ts:13-18` · `@app/src/main/ipc/chat/send.ts:183-196` |
| **TurnCoordinator = 가로축 구동체.** 스트림 소비→reduce→persist∥forward 소유. StallTimer·approval pause 소유. steer flush 의 자연 소유자. | `@app/src/main/lifecycle/turn-coordinator.ts` · `@docs/arch/backend/provider-runtime.md` §A.3 |
| **컴포저 send 경로는 inflight 하드 리턴.** `submit()`(`draft.trim()===''||inflight` return)·`showCancelButton = inflight || toolApprovalPending` → busy 중 send 경로 없음. steer 는 **별도 action path** 필요. | `@app/src/renderer/src/features/chat/components/Composer.tsx:283-296,489-513` |
| **UserTurn 은 이미 다중 버블.** `turn.messages.map(UserMessage)` — 다중턴 pending 표시·단일 flush 둘 다 기존 턴 모델에 적합. UserMessage 폰트=`text-body text-ink`. | `@app/src/renderer/src/features/chat/components/transcript/UserTurn.tsx:11-19` · `.../UserMessage.tsx:28-32` |
| **세션별 store 라우팅.** chatStore `sessions: Record<sessionId,…>` + 비활성 세션 이벤트 백그라운드 누적. pending steer 도 세션별로 격리. | `@app/src/main/…`(0013) · INDEX 0013 행 |
| **hover 취소 UX = group 스코프.** 자체 hover 컴포넌트는 `group/<이름>`+`group-hover/<이름>:` 로 격리(익명 group 버그 회피). | `@app/AGENTS.md` "그룹 스코프 격리" · `UserTurn.tsx:13`(`group/msg`) |
| **개념 정본.** 3엔티티·2축·pending 큐·"Runtime close ≠ Conversation close". | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A · `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md` |
| 외부 사례: OpenCode steer/queue admission + seq fencing. | `@docs/etc/study/opencode/`(오케스트레이션 편) |

### 핵심 재정의 (요구 2~4 가 드러낸 진짜 모델)

0056 은 `steer` vs `queue` 를 **형제 결정**으로 뒀지만, 요구는 **단일 흐름 "pending 큐 → 끼어들기 flush"** 다:
- inflight 중 모든 피드백 제출 = **내부 FIFO 에 enqueue** → pending 버블(연하게/기울임)로 렌더(여러 개면 다중턴 모양, DB 미영속).
- **"끼어들기(성공)" = SDK 가 큐를 pull 한 순간**(producer-side, 이벤트 아님) → **큐 전체를 단일 user 턴으로 flush**(버블 1개), DB 영속, 정상 폰트.
- 따라서 `steer` = 주입 기전 / `queue` = 항상 존재하는 staging 버퍼. 차이는 **소비(flush) 시점**뿐: interrupt 병용(현재 답변 절단 후 즉시 소비) vs sequential(현재 턴 완료 후 소비). 감지 기전(producer pull)은 두 정책 공통. → **소비 시점 정책은 Open Question**(리스크 §).

## 인수 기준 (Acceptance Criteria)

> ① 기전(main+IPC) → ② UX(renderer). verify 가 1:1 대조.

**① 기전 (main + IPC)**

1. **streaming-input `push` + `onConsume`.** `createTurnInputStream` 에 `push(content)`(내부 queue.push + wake) 노출 + **`onConsume` producer-side 콜백**(SDK 가 pull 해 yield 되는 순간 발화). 소비 시 **현재 큐 전체를 단일 `SDKUserMessage` 로 합쳐 yield**(요구 4 단일 flush 를 기전 레벨 보장). close 멱등 유지. 순수 모듈 단위 테스트.
2. **포트 확장 + capability.** `LiveTurn`(L2)·`RuntimeLiveTurn`/`ManagedRuntime`(L1) 에 `injectMessage(content)?` + `canSteer`(capability) 추가. claude 어댑터=`input.push` 배선, mock=no-op(`canSteer=false`). 미지원 백엔드 무회귀.
3. **`SteerQueue`(신규 L1, 순수).** 세션별 순서 버퍼(id·text·ts) — `enqueue`/`cancel(id)`/`drainForFlush()→합친 content`/`pending()`. **multi→single 병합 로직 소유**. 단위 테스트(순서·취소·병합·빈 큐).
4. **TurnCoordinator `steer`.** `steer(content)` = enqueue + StallTimer.reset(주입=활동); **`onConsume` 발화 시** `SteerQueue.drainForFlush()` → **단일 user 메시지 persist∥forward**(pending→confirmed). L1 은 결정·기전만, renderer forward 는 L3 sink 로(0056 AC4 계승).
5. **`SteerQueuePolicy`(capability-aware).** inflight 면 `steer`(canSteer) / `queue`(불가 시 turn-end drain) 반환, 둘 다 불가면 `reject` 폴백. 컴포지션 루트에서 `RejectDuplicatePolicy` 대체(`@app/src/main/ipc/router.ts:228`).
6. **enactment(L3).** `enactAdmissionDecision` 의 `queue`/`steer` 분기를 실제 enact(코디네이터 큐 위임)로 교체 — 현 hard-reject 대체(`@app/src/main/ipc/chat/send.ts:183-196`). `chat:steerCancel` 핸들러가 `SteerQueue.cancel(id)`.
7. **영속 규칙.** pending 은 **DB 미영속**, flush 시에만 **user 메시지 1행(합친 content)** 기록. 스키마 무변경(기존 messages/parts 재사용). 마이그레이션 0.
8. **IPC 계약.** 신규 채널 `chat:steer`·`chat:steerCancel` + `NormalizedEvent`(또는 ChatEvent) `steer.queued{id,text,sessionId}`·`steer.flushed{ids,messageId,sessionId}`·`steer.cancelled{id,sessionId}`. **`@docs/IPC_CONTRACT.md` §6 절차로 동시 갱신**(채널 수·variant 표).
9. **레이어 경계·무회귀.** 신규 L1(`steer-queue`) + 정책/포트 = 하향 의존만, boundaries·`import/no-cycle` 0. steer 미사용(기존 단일 턴) 경로 동작·이벤트·DB 0 변경.

**② UX (renderer)**

10. **컴포저 feedbackMode(요구 1).** `inflight && draft.trim()!==''` → placeholder='피드백 보내기', 버튼 stop→send 토글, 툴팁으로 "피드백(끼어들기) — 일반 턴과 구분" 안내. **별도 `steer` action path**(현 `submit`/`send` 는 inflight 하드 리턴). **feedbackMode 에서도 중단 수단 유지**(요구 1 파생 엣지 — §파생 UX).
11. **pending 버블(요구 2·4).** chatStore `pendingSteer`(세션별) 를 활성 assistant 턴 **아래**에 렌더 — 여러 개면 다중턴 모양. 폰트 **연하게/기울임**(`UserMessage` `pending` prop: 정상 `text-body text-ink` / pending `italic text-ink3`).
12. **hover 취소(요구 5).** pending 버블 hover 시 취소 버튼(`group/msg`+`group-hover/msg:` 스코프 격리). 클릭 → `cancelSteer(id)`: store pending 제거 + `chat:steerCancel` + **해당 내용을 컴포저 draft 로 자동 재주입**(seed 패턴).
13. **flush(요구 3·4).** `steer.flushed` → pending 제거, 영속된 **단일 user 턴**(버블 1개, 정상 폰트)이 그 위치에 렌더. 다중 pending→단일 병합은 main(SteerQueue)이 수행 → renderer 는 pending 드롭만.
14. **UX 무회귀·시각 검증.** 비-feedback 경로(일반 턴 전송·중단·승인 카드)는 현행 유지. pending 폰트·multi→single 전환·툴팁·hover 취소는 **사람 시각검증**(verify 책임분리).

## 범위 / 비범위

- **범위**: 피드백 끼어들기(steer/queue) 의 backend 기전(streaming-input push·SteerQueue·포트·정책·enactment·IPC 이벤트) + renderer UX(컴포저 토글·pending 버블·hover 취소·flush).
- **비범위(후속)**:
  - **큐 소비 시점 정책(interrupt vs sequential)** 의 최종 확정 — Open Question(리스크 §). 기본은 안전한 sequential 로 두고 interrupt 병용은 사용자 결정 후.
  - **cap-over-capacity reject/queue**(0055 인접 축) — 본 핸드오프 미접촉.
  - **`orchestration/`→supervision 코드 리네임**(결정 2) — Future.
  - Conversation Continuity(handoff/fork/reseed) — Future.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기댈 모듈: `adapters/streaming-input.ts`·`adapters/claude.ts`(query streaming input)·`lifecycle/{turn-coordinator,session-runtime,admission-*,ports}.ts`·`ipc/chat/{send,persist}.ts`·`ipc/router.ts`·renderer `features/chat`(Composer·UserTurn·UserMessage·chatStore). 전부 기존.
- SDK 전제: **스트리밍 입력 모드에서 prompt AsyncGenerator 에 다중 user 메시지 push 가능**(문서 "대기 중인 메시지") + 소비=producer pull. 코드가 이미 `query({prompt: input.stream})` 사용 → 기전 존재, 다중 push+`onConsume` 감지가 신규분.
- **신규 의존성 0**(순수 TS + 기존 모듈 배선 + IPC 채널 추가). IPC_CONTRACT 갱신 필수.

## 설계

### 모듈화 — 레이어별 최소 변경(하향 의존 보존)

| 레이어 | 변경 | 성격 |
|---|---|---|
| L2 `adapters/streaming-input.ts` | `push(content)` + `onConsume` producer 콜백(소비 시 큐 합쳐 단일 yield), close 멱등 | 순수·무회귀·소비 감지 단일 격리점 |
| L2 `adapters/types.ts`·L1 `lifecycle/ports.ts` | `injectMessage(content)?` + `canSteer` capability | 포트 확장(미지원=no-op) |
| L2 `adapters/claude.ts`·`mock.ts` | claude=push 배선 / mock=no-op | 어댑터 구체 |
| L1 `lifecycle/session-runtime.ts` | `injectMessage` 위임(setPermissionMode/interrupt 미러) | 위임 계열 |
| **L1 `lifecycle/steer-queue.ts`(신규)** | 세션별 순서 버퍼·enqueue/cancel/drainForFlush/pending·**multi→single 병합** | 순수·단위테스트 |
| L1 `lifecycle/turn-coordinator.ts` | `steer(content)`=enqueue+StallTimer.reset; onConsume→drain→단일 user persist∥forward; 턴 종료 잔여 큐→다음턴 dispatch | 가로축 구동체 소유 |
| L1 `lifecycle/admission-policy.ts` | `SteerQueuePolicy`(capability-aware) | 정책 교체점 |
| L3 `ipc/chat/send.ts` | `enactAdmissionDecision` steer/queue enact + `chat:steerCancel` | enactment(레이어 책임) |
| L3 `ipc/router.ts` | 정책 스왑·steer 채널 배선 | 컴포지션 루트 |
| L0/L3 IPC | `chat:steer`·`chat:steerCancel` + `steer.queued/flushed/cancelled` | 계약 갱신 |
| renderer `chatStore` | `pendingSteer[]`(세션별) + `steer(text)`/`cancelSteer(id)`(draft-refill 동반) + `steer.*` 핸들러 | optimistic·0013 라우팅 미러 |
| renderer `Composer.tsx` | feedbackMode 토글·placeholder·툴팁·별도 steer 경로·중단 수단 유지 | UX |
| renderer `transcript/UserMessage.tsx`·`UserTurn.tsx`(+ pending 소스 합성) | `pending` prop(폰트) + hover 취소 버튼 | UX |

### 재사용할 기존 함수·파일

- `createTurnInputStream`(확장)·`TurnCoordinator`(steer 메서드)·`AdmissionController`/`AdmissionPolicy`(정책 교체)·`makeClassifiedError`(reject 폴백 enact)·`UserTurn`/`UserMessage`(다중 버블·폰트 prop)·컴포저 `initialDraft`/`seededRef`(취소 재주입 seed)·0013 세션별 이벤트 라우팅.
- 레이어: 신규 `steer-queue`·정책·포트=L1 `lifecycle/`, enactment=L3, renderer=`features/chat`(4-layer).

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **주입 user 메시지의 transcript/DB 순서·경계**(assistant 진행 중 삽입) — 최대 correctness 리스크. persist 순서(assistant 진행 중 user row) + renderer 그룹핑 정합.
- **권한 재진입(0046 idle-pause) 중 steer 도착** — 승인 대기 중 큐 유지(소비 안 함) vs 즉시 주입. 기본: 큐 유지, 승인 해소 후 정상 소비.
- **feedbackMode 중 중단 수단 유지**(요구 1 파생) — send 로 토글되면 stop 상실 → stop 을 별도 위치 유지 또는 조합(구현 결정, 시각검증).
- **abort/cancel·interrupt 와 steer 경합** — pending 있는 채 턴 취소 시 pending 처리(폐기 vs draft 복원).
- **StallTimer/maxTurns** — 주입=활동 → 타이머 reset(무한 대기 방지).
- **assistant 가 소비 전 종료** — 잔여 큐를 다음 턴으로 drain(steer 아닌 일반 턴), pending→confirmed 버블 전환 일관성.
- **capability 미지원 폴백** — `canSteer=false` → reject, 멀티세션 독립성 보존.
- **optimistic 롤백** — steer 실패 시 pending 버블 복구/에러 안내.
- **pending 취소→draft 재주입**(요구 5) — 재주입 시 컴포저에 기존 draft 존재 시 덮어쓰기/병합 정책, 다중 pending 개별 취소 순서, hover 버튼 group-hover 스코프 격리.
- 멀티세션: 비활성 세션의 pending steer 는 세션별 store 격리(0013).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **끼어들기 성공 감지** 를 output 이벤트로 오설계 | **producer-side pull(`onConsume`)로 확정** — 사용자 정정 반영, SDK 문서 근거. 단일 격리점(streaming-input). |
| 큐 소비 *시점*(interrupt vs sequential)이 UX 느낌을 좌우하고 되돌리기 성격 | **Open Question — 사용자 결정.** 기본 sequential(안전), interrupt 병용은 결정 후. 감지 기전은 공통이라 정책만 교체. |
| 주입 user 메시지가 assistant 진행 중 DB/transcript 에 끼어 순서 깨짐 | persist∥forward 순서 규약 + 단위/통합 테스트(주입 메시지 위치) + 사람 시각검증. |
| default 전환(reject→steer)이 기존 동작 가시 변경 | 0056 OQ1="steer" 사용자 결정 기록 → 방향 확정. 무회귀(비-feedback 경로)는 기계 검증, feedback UX 는 사람 시각검증. |
| feedbackMode 에서 중단 버튼 상실 | 중단 수단 별도 유지(구현 결정) — 파생 UX 등재. |
| pending seam 이 dead 로 방치 | enact + 이벤트 + UX 를 한 핸드오프에서 완결(0056 framework-only 를 실제 동작으로). |

- 되돌리기 어려운 결정: 큐 소비 시점 정책(→ Open Question). IPC 채널 추가(추가는 안전, 계약 갱신 필수).
- **단독 결정 금지 항목(Open Question)** → 사용자에게:
  - **큐 소비 시점 = interrupt(현재 답변 절단 후 즉시) vs sequential(현재 턴 완료 후)?** 기본 sequential 제안.

## 영향 받는 파일

- L2/L1 신규·수정: `app/src/main/adapters/streaming-input.ts`·`adapters/types.ts`·`adapters/claude.ts`·`adapters/mock.ts`·`lifecycle/ports.ts`·`lifecycle/session-runtime.ts`·**`lifecycle/steer-queue.ts`(신규)**·`lifecycle/turn-coordinator.ts`·`lifecycle/admission-policy.ts`
- L3: `app/src/main/ipc/chat/send.ts`·`app/src/main/ipc/chat/persist.ts`·`app/src/main/ipc/router.ts` + `app/src/shared/{ipc,protocol}.ts`(채널·이벤트·zod)
- renderer: `app/src/renderer/src/features/chat/store/chatStore.ts`·`components/Composer.tsx`·`components/transcript/{UserMessage,UserTurn}.tsx`(+ 그룹핑에 pending 합성)·preload 채널
- 테스트: `lifecycle/steer-queue.test.ts`·`adapters/streaming-input.test.ts`(push/onConsume)·`turn-coordinator.test.ts`(steer flush)·`admission-*.test.ts`(steer/queue 분기)
- 문서: `docs/IPC_CONTRACT.md`(§6 절차·채널 수·variant)

## 참고 문서

- `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A · `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md`(P1) · `@docs/handoff/0056-turn-admission-steer-queue/plan.md`(framework·forward-pointer)
- [SDK streaming-input 문서](https://code.claude.com/docs/ko/agent-sdk/streaming-vs-single-mode)(큐 소비=producer pull) · `@docs/etc/study/opencode/`(steer/queue 사례)
- **IPC 변경**: `@docs/IPC_CONTRACT.md` (§6 변경 절차 — 반드시 동시 갱신)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: `steer-queue`(순서·취소·multi→single 병합·빈 큐) · `streaming-input`(push·onConsume·close 멱등) · `turn-coordinator`(onConsume→단일 flush persist∥forward) · `admission-policy`(steer/queue/reject 분기·capability 폴백).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청(범위·구조·UX 1~5·"큐 소비=이벤트 아님" 정정) 출처 인용, 추론(단일 흐름 재정의) 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`·SDK 웹 URL). streaming-input 스캐폴드·producer pull·컴포저 하드리턴·다중 버블 근거.
- [x] 인수 기준 — 14개 번호(① 기전 1~9 / ② UX 10~14)·검증 가능·무회귀.
- [x] 의존 기술 — 기존 L1/L2/L3+renderer, SDK 스트리밍 입력 전제, 신규 의존성 0, IPC 갱신 표기.
- [x] 파생 UX — 순서·권한 pause·중단 수단·경합·타이머·소비 전 종료·폴백·롤백·취소 재주입·멀티세션.
- [x] 리스크 — 감지 기전 확정·소비 시점 OQ·순서·default 전환·중단 상실 완화책 + Open Question(소비 시점) 사용자 분리.

---

> **[구현자 기입]** 이하는 구현 턴(Codex)에서 채운다. 설계자(Claude)는 위쪽을, 구현자는 이 블록만 추가한다(공유 파일 충돌 회피).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: …
- 이견 / 우려: …

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 구현함 / ⚠️ 보고만·결정 필요 | … |

## [구현자 기입] 구현 체크리스트

- [ ] streaming-input `push`/`onConsume`(단일 flush 병합)
- [ ] 포트 `injectMessage`/`canSteer` + claude/mock 배선
- [ ] `SteerQueue`(신규) + 단위 테스트
- [ ] TurnCoordinator `steer`(onConsume→단일 persist∥forward)
- [ ] `SteerQueuePolicy` + router 정책 스왑
- [ ] enactAdmissionDecision steer/queue + `chat:steerCancel`
- [ ] IPC 채널·이벤트 + IPC_CONTRACT §6
- [ ] chatStore `pendingSteer`/`steer`/`cancelSteer`/`steer.*` 핸들러
- [ ] Composer feedbackMode(placeholder·토글·툴팁·중단 유지)
- [ ] pending 버블(폰트)·hover 취소·flush 전환
- [ ] 게이트 green

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | lint / typecheck / test (N passed) |
| 블로커 / 역질문 | (없으면 "없음") |
| 대상 커밋 | `<hash>` |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | … | … | … | open |

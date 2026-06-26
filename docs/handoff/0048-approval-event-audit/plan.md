# Plan — 0048-approval-event-audit

> 승인/거부/세션허용 이벤트 전달 및 도구 inflight 고착 race 감사 (audit-only).
> 정본 규칙: [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0048-approval-event-audit` |
| 작성자 | Claude Code |
| 일자 | 2026-06-26 |
| 매핑 | PHASES 미승격 후보(문서 전용·0001/0045 선례) / PR 미정 |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "approval card 에서 각종 도구 승인/거부 등이 정상 동작하지 않는 사례. 승인/거부/허용 이벤트를 발생시켰을 때 정상 전달되는지 엄격히 검토. 예의주시: ① 즉시 ② 한참 지난 후 ③ 여러 스택 쌓았다 한 번에. 수신자: 메인 에이전트·서브에이전트." | 라이브 세션 요청(2026-06-26) |
| 명시 요구(정밀화) | "타이머/abort 정책이 꼬여 race condition 으로 내부 배선이 끊기지 않는지, 승인/거부가 닿지 않아 도구가 **inflight 에 고착**되지 않는지를 **코드 레벨에서 엄격히** 분석." | 라이브 세션 요청(2026-06-26, plan 거부 피드백) |
| 사용자 결정 | 범위 = **감사/검증 전용 문서**(app 코드 무수정, 확정 결함 수정은 후속 핸드오프). 서브에이전트 축 = **양쪽 다**(해소 경로 + UI 귀속). | 라이브 세션 Q&A(AskUserQuestion, 2026-06-26) |
| 추론 의도 | 관찰된 "먹통" 증상의 1차 용의자는 *승인 카드가 렌더되지 않아 사용자 응답 경로가 영구 소실*되는 case 다(아래 C1). — *해석*(코드 트레이스 기반). | 본 plan 자료조사 |

## Context (왜)

최근 핸드오프(0046 idle-pause·0047 plan deny race·0038 terminal-event 보장·0033 idle-timeout/abort·0042~0044 서브에이전트 라우팅)가 **승인/거부 ↔ 타이머/abort ↔ 턴 종료 ↔ 멀티세션 라우팅** 배선을 연달아 건드렸다. 그 결과 approval card 의 승인/거부가 SDK 권한 게이트에 닿지 않아 도구가 "실행 중"으로 무한 고착되는 사례가 보고된다.

이 핸드오프는 **수정이 아니라 감사**다: 보류된 승인이 *반드시* 해소되는지를 코드 레벨에서 증명하거나, 깨지는 race 를 반례로 특정한다. 확정된 결함은 심각도·권장 수정안만 카탈로그화하고 실제 코드 수정은 후속 핸드오프로 분리한다.

## 자료조사 (Research)

### 승인 보류의 해소 불변식 — "보류된 canUseTool 은 어떻게 풀리는가"

`canUseTool` 은 `await requestApproval(...)` 로 SDK `query()` 를 **일시정지**한다(`app/src/main/ask/broker.ts:1-7`, `app/src/main/adapters/claude.ts:94`). 보류 Promise 를 해소(=배선 복구)하는 경로는 **정확히 셋**뿐이다:

| # | 해소 경로 | 코드 레퍼런스 |
|---|---|---|
| **S1** | 사용자 응답 → `orca:permission:respond` → `ApprovalCoordinator.respond` → `broker.resolve` | `app/src/main/ipc/chat/approvals.ts:49-52` |
| **S2** | `turn.controller.abort()` → `regSignal` abort → broker `onAbort` → `settle(deny,'aborted')` | `app/src/main/ask/broker.ts:54-55,83-90` · `app/src/main/ipc/chat/send.ts:447-449,452` |
| **S3** | SDK `control_cancel_request` → `options.signal`(sdkSignal) abort → S2 와 동일 경로 | `app/src/main/adapters/claude.ts:92-95` · `app/src/main/ipc/chat/send.ts:447-448` |
| — | broker `settle` 은 **멱등** — 첫 종료가 승자, 중복·늦은 응답·abort-후-도착은 무해하게 무시 | `app/src/main/ask/broker.ts:75-90` |

### 핵심 비대칭 (코드로 확인)

1. **승인 보류 중 idle-timeout 은 정지된다.** `requestApproval` 진입 시 `activeIdle?.beginPause()` → `pauseDepth++` → 첫 진입에서 `clear()`(타이머 제거)하고, 보류 동안 모든 `reset()` 은 no-op(`send.ts:71-99,446`). broker 는 `timeoutMs` 를 **의도적으로 미사용**(`approvals.ts:29-30`, `broker.ts:14-20,59`). ⇒ **장기지연 auto-deny 없음** — 사용자가 3분을 기다려도 idle 이 턴을 죽이지 않는다(설계상 안전).
2. **턴 outer `finally` 는 `controller.abort()` 를 호출하지 않는다.** `send.ts:629-633` = owner-gone 리스너 제거 + `turns.finish(turn)` 뿐. attempt-loop `finally` 도 `idle.clear()` + `activeIdle=null` 만(`send.ts:624-627`). ⇒ S2 를 트리거하는 `controller.abort()` 는 **오직** 사용자 취소(`chatCancel`, `send.ts:644`)·idle-timeout(`send.ts:78-79`, 단 승인 중 정지)·owner-gone(`send.ts:401-404`)·SDK-cancel(S3)에서만 발생.

> **귀결**: 승인 카드가 렌더되지 않으면 **S1 이 영구 소실**되고(클릭 대상 없음), idle-timeout 은 pause 로 막혀 있어, **명시 취소·owner-gone·SDK-cancel 외에는 도구가 inflight 로 무한 고착**된다. 이것이 "배선이 끊겨 승인/거부가 닿지 않음"의 코드-레벨 실체다.

### 승인 요청 발행 경로

| 발견 | 레퍼런스 |
|---|---|
| `requestApproval`: 세션 자동허용 즉시 통과 → `approvalId=randomUUID()` → `permission.requested` 발행(sessionId=`turn.dbSessionId`) → `beginPause()` → `await approvals.register(approvalId, turn, regSignal)` → `permission.resolved` 발행 | `app/src/main/ipc/chat/send.ts:407-475` |
| `regSignal = sdkSignal ? AbortSignal.any([controller.signal, sdkSignal]) : controller.signal` | `app/src/main/ipc/chat/send.ts:447-449` |
| `canUseTool` 분기: Agent/Task(서브에이전트 자체)·AskUserQuestion·ExitPlanMode·`isRiskyTool` → 그 외 auto-allow | `app/src/main/adapters/claude.ts:94-174` |
| risky deny passthrough: `{behavior:'deny', message, ...(interrupt ? {interrupt} : {})}` | `app/src/main/adapters/claude.ts:167-171` |
| `ApprovalCoordinator`: `turnsByApproval` Map(approvalId→turn) + `sessionAllowedTools`(dbSessionId→Set) + `respond` 부수효과(세션허용 갱신·deny+interrupt→abort) | `app/src/main/ipc/chat/approvals.ts:16-68` |

### 렌더러 라우팅·리듀서

| 발견 | 레퍼런스 |
|---|---|
| `receive()` 최종 라우팅 — `sessionId` 있고 Record 에 있으면 그 키, 없는 sessionId 면 terminal/active 폴백, **그 외(sessionId 있으나 Record 미존재) `return`(폐기)** | `app/src/renderer/src/features/chat/store/chatStore.ts:261-276` |
| session.updated 시 pending new-chat promote(`!sessions[ev.sessionId]` 조건) | `app/src/renderer/.../store/chatStore.ts:265-267` |
| `permission.requested(tool_approval)` → `pendingToolApprovals` 큐 **append**(덮어쓰지 않음, 0046 r2) | `app/src/renderer/.../reducer/chatReducer.ts:361-374` |
| `permission.resolved` → approvalId 로 큐에서 **idempotent filter** 제거(SDK 취소 대비 정리) | `chatReducer.ts:376-390` |
| `turn.aborted`·`error` → `pendingToolApprovals: []` 전체 클리어 + `inflight:false` | `chatReducer.ts:392-414` |
| 승인 핸들러: `approveTool`/`approveToolForSession`/`denyTool` = `void permissionApi.respond(...)`(fire-and-forget) + `dispatchActive(RESOLVE_TOOL_APPROVAL)` | `chatStore.ts:629-649` |
| `denyTool` resolution = `{behavior:'deny', interrupt:false}` | `chatStore.ts:642-648` |

### IPC·관련 핸드오프

| 발견 | 레퍼런스 |
|---|---|
| permission 채널 2종(`orca:permission:respond`·`:setMode`), `PermissionRespond={approvalId, resolution}`, `permission.requested/resolved` variant | `@docs/IPC_CONTRACT.md §2.13` · `app/src/shared/ipc.ts:207-248,373-385` |
| 0046 r4 — idle pause refcount(`pauseDepth`)로 동시 서브에이전트 child 이벤트의 `reset()` 재무장 차단 | `@docs/handoff/0046-approval-idle-pause/` |
| 0047 r7 — plan reject: `{deny, interrupt:true}`+`CANCEL_CHAT` 동기 abort 가 deny 전파를 죽이는 race → clean deny 로 수정 | `@docs/handoff/0047-plan-panel-comments/` |
| 0038 — 비-terminal 종료 시 polyfill telemetry 로 `inflight` 항상 클리어 보장 | `@docs/handoff/0038-turn-state-error-ux/` |
| 0040 — 새-채팅 re-key/promote 신원가드(직렬 디스패치) | `@docs/handoff/0040-new-chat-race-early-registration/` |

## 인수 기준 (Acceptance Criteria)

> 감사 실행 턴(다음=Claude)이 충족하고, verify 가 1:1 대조한다.

1. **해소 불변식 확립** — S1/S2/S3 표 + "idle-pause·outer-finally 비대칭"을 코드 증거(`파일:라인`)로 문서화한다.
2. **C1(렌더러 폐기) 판정** — 세 발생 창(새-채팅 re-key·resume/다중창·엔트리 eviction) 각각에 대해 "`permission.requested.sessionId` 가 항상 `sessions` Record 키임"을 이벤트 순서·promote 로직으로 **증명 또는 반례 구성**.
3. **C2~C5 판정** — 각 후보를 확인 또는 반증(증거 첨부).
4. **서브에이전트 양축 결론** — ① 내부 위험도구가 부모 `canUseTool` 을 거치는지(해소 경로) ② 카드가 서브에이전트 타일에 귀속되는지(`parentToolRunId` 전파) 각각 결론.
5. **감사 매트릭스** — {승인·거부·세션허용} × {즉시·장기지연·스택일괄} × {메인·서브에이전트} 전 셀에 판정(정상/결함/미확정) + 증거.
6. **결과물** — 확정 결함마다 심각도 + 권장 수정안(코드 위치) 카탈로그(**수정 미수행**, 후속 핸드오프 후보 등재) + 사람 GUI 재현 체크리스트.

## 범위 / 비범위

- **범위**: 정적 코드 트레이스(main 송신·broker·approvals·send 이벤트루프 + renderer 라우팅·리듀서·핸들러) · 기존 단위테스트 판독 · mock/wireLog 분석 · 감사 보고서(plan.md 하단 또는 동 디렉토리 `audit.md`).
- **비범위**: **app 코드 수정 전부**(확정 결함 수정은 별도 핸드오프 — 사용자 결정). OpenCode·다중 백엔드. 승인 카드 시각 디자인. UI 귀속 결함의 실제 구현.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 사용: `InteractionBroker`·`ApprovalCoordinator`·`createIdleTimer`·`receive`/`chatReducer`. **신규 의존성 0.**
- 전제: 감사 대상 브랜치 HEAD 는 0047(`3fc1d6a`) 기준. SDK `canUseTool`/`options.signal`/`control_cancel_request` 동작은 Claude Agent SDK 계약을 따른다(서브에이전트 내부 도구의 canUseTool 경유 여부는 **감사 대상 미지수** — 코드+실기로 확정).
- Electron GUI 실런타임 재현은 본 환경에서 불가 → 사람 책임으로 분리(아래 책임표).

## 설계 (감사 방법론)

### 1순위 — C1: 렌더러 `permission.requested` 조용한 폐기 (S1 영구 소실)

`receive()`(`chatStore.ts:269-276`)는 `sessionId` 가 있으나 `sessions` Record 키가 아니면 이벤트를 **`return`(폐기)** 한다. `permission.requested` 는 비-terminal·`turn.dbSessionId` 동봉(`send.ts:440`)이므로, 그 sessionId 가 Record 에 없으면 **카드 미렌더 → 승인/거부 불가 → S1 소실 → 도구 inflight + idle pause 무한**.
- **발생 창 분석**: ① 새-채팅 re-key — main `session.updated`→`turns.promote`(`send.ts:528-530`) 와 renderer `promotePendingNewChat`(`chatStore.ts:265-267`) 의 순서·키 일치. permission 이벤트가 promote 완료 *전* 도착하거나 sessionId 가 promote 대상과 불일치하면 폐기. ② resume/다중 창 — Record 미등록 세션의 권한요청. ③ 턴 중 `invalidateSessionCache` eviction.
- **증명/반례**: main 의 이벤트 발행 순서(session.updated → … → permission.requested)가 renderer Record 등록을 **항상 선행**함을 보이거나, 코얼레서·re-key 창에서 깨지는 시퀀스를 반례로 구성.

### 2~5순위 — race/abort 정책

- **C2 (deny interrupt 동기 abort race, 0047 r7 재발 감시)**: `respond` 가 `broker.resolve`(마이크로태스크) 직후 `controller.abort()`(동기) 하면 deny 가 SDK 전파 전 query 가 죽는다(`approvals.ts:52,65-66`). risky deny 는 renderer 가 `interrupt:false`(`chatStore.ts:646`) → 안전. **감사**: risky/tool 경로에 `interrupt:true` 재유입 0 확인(`claude.ts:167-171`).
- **C3 (`activeIdle` 인스턴스 교차)**: outer `let activeIdle`, attempt 마다 재할당(`send.ts:398,488-489`), `releaseIdle` 은 인스턴스별 클로저. 승인 보류 중 stream throw 시 — broker 미settle(but query 사망으로 moot) + `idle.clear()`/`activeIdle=null`(`send.ts:624-627`) + `error` 이벤트가 렌더 큐 클리어(`chatReducer.ts:403-414`)로 자가치유. pauseDepth 잔류가 **살아있는 타이머를 남기지 않음**(teardown 에서 timer clear) 확인.
- **C4 (거부 후 종료 보장, 0038)**: risky deny=`interrupt:false`→clean deny→SDK 계속→비-terminal 종료 시 polyfill telemetry(`send.ts:569-576`). "거부 후 in-progress 고착" 회귀 부재 트레이스.
- **C5 (owner-gone/cancel 동시도착, S2)**: `chatCancel`(`send.ts:644`)·`onOwnerGone`(`send.ts:403`)·idle-timeout(`send.ts:78`)가 보류 승인을 abort settle 하고 `settleOpenToolRuns(aborted)`(`send.ts:647,119-146`)로 transcript inflight 정착하는지 확인.

### 서브에이전트 양축

- **해소 경로**: `isSubagentTool` 은 Agent/Task 도구 *자체*만 매치(`claude.ts:96-109`). 서브에이전트 *내부* 위험도구가 부모 `canUseTool` 을 거치면 동일 broker(approvalId 키)로 S1 도달 — **SDK 동작을 코드+실기로 확정**. 미경유면 카드 자체가 없음(별도 결론).
- **UI 귀속**: `agentPermissionRequest(approvalId, outbound, dbSessionId)`(`send.ts:440`)에 **`parentToolRunId` 부재** → 서브에이전트발 카드가 메인 컴포저 스택에 표시(서브에이전트 타일 미중첩). 0042~0044 의 child 이벤트는 `parentToolRunId` 로 타일 중첩하지만 permission 이벤트는 빠져 있음 — 갭 확정, 권장 수정안만 기록.

### 명시 반증 (비-결함)

- approvalId 재사용/교차세션 충돌 — `randomUUID()`(`send.ts:418`) 전역 유일 → 반증.
- "장기지연 auto-deny" — 승인 보류 중 idle pause(위 비대칭) → 반증.
- 스택일괄 단일슬롯 덮어쓰기 — 0046 r2 큐화(`chatReducer.ts:361-374`) → 반증.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **동시성/멀티세션**: 비활성 세션 권한요청의 백그라운드 누적·전환 후 응답(`dispatchActive` 가 activeKey 로 RESOLVE 디스패치하되 권위 `permission.resolved` 가 정확 세션 정리 — 자가치유, 경미). 3건 동시(메인+서브에이전트) pauseDepth 0 복귀.
- **에러/취소**: 거부 후 턴 계속 vs 취소 후 종료의 의미 구분(`reason:'user_cancelled'` turn.aborted vs deny).
- **빈/지연 상태**: 응답 없는 장기 보류는 정상(시간제한 없음) — 단 카드가 보여야 한다(C1).
- **a11y/테마**: 본 감사 비대상(시각 검증은 사람).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| GUI 실런타임 재현 불가(환경) → 일부 race 는 정적 트레이스로만 추론 | 사람 GUI 체크리스트로 보완(책임 분리), 추론은 "미확정"으로 표기 |
| 서브에이전트 내부 도구의 canUseTool 경유 여부가 SDK 비공개 동작 | 코드 트레이스 + 실기 확인 병행, 단정 금지(Open Question 후보) |
| 감사 결과 결함 확정 시 수정 욕구 | **단독 수정 금지** — 사용자 결정 후 후속 핸드오프(범위 합의) |

- 되돌리기 어려운 결정: 없음(문서 전용).
- **단독 결정 금지(Open Question)** → 사용자에게: 확정 결함의 수정 착수 여부·우선순위.

## 영향 받는 파일

- `docs/handoff/0048-approval-event-audit/plan.md` (본 문서, 신규)
- `docs/handoff/INDEX.md` (0048 행 추가)
- **app 코드 무변경** (audit-only).

## 참고 문서

- `docs/IPC_CONTRACT.md §2.13`(permission 채널·variant)
- `docs/arch/backend/provider-runtime.md`(PermissionBridge·NormalizedEvent §3)
- 선행 핸드오프: `docs/handoff/{0046,0047,0038,0033,0040,0042,0043,0044}-*/`
- IPC 변경 없음 → `IPC_CONTRACT.md` 갱신 불필요.

## 게이트

- app 게이트 N/A(문서 전용, app 코드 무변경). 대신 **정적 트레이스 증거 + 인용 `파일:라인` 현행성**으로 대체.
- 신규 테스트 요구: 없음(감사). 단 감사가 *누락 단위테스트*(예: receive 폐기 분기, 멀티세션 승인 라우팅)를 식별하면 권장사항으로 등재(구현은 후속).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(라이브 세션)·정밀화·Q&A 결정을 출처로 인용, 추론은 추론 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인`/`@docs/…` 레퍼런스 첨부(작성 시 현행 코드와 재대조 완료).
- [x] 인수 기준 — 번호·검증가능·자료조사 근거.
- [x] 의존 기술 — 신규 의존성 0, SDK 미지수는 감사 대상으로 분리.
- [x] 파생 UX — 멀티세션·에러/취소·지연 엣지 펼침.
- [x] 리스크 — GUI 추론 한계·SDK 비공개 동작·수정 단독금지 분리.

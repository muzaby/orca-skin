# Backend Architecture — Provider Runtime Model (범용 정규화 계층)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (BACKEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [standardization.md](./standardization.md) (배포 계층 표준화 — *짝 문서*), [adapters.md](./adapters.md), [persistence.md](./persistence.md), [../frontend/rendering.md](../frontend/rendering.md), [../frontend/ux-domains.md](../frontend/ux-domains.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.
>
> **가로축 구동체 (TurnCoordinator, 2026-06-29 정제 0051):** 본 문서의 `NormalizedEvent`·`PermissionBridge` 가 흐르는 *턴 실행 파이프라인*(stream → reduce → **persist ∥ forward** + 권한 재진입 콜백)을 구동하는 1급 컴포넌트는 **TurnCoordinator**(`lifecycle/turn-coordinator.ts`, handoff 0052)다. 원칙: **DB 영속(persist)은 main-side·renderer 생존 무관**, renderer forwarding 은 별도 best-effort fan-out, 권한은 단계가 아니라 `canUseTool` 재진입 콜백이다. 개념 정본은 `etc/orca_lifecycle_orchestration_design_draft_ko.md` §A(용어 3분리 + 2축 모델).
>
> **세로축 자원 supervision (RuntimeSupervisor, handoff 0053):** SessionRuntime 집합의 소유자(§A 세로축 unit #3)는 **`RuntimeSupervisor`**(`lifecycle/supervisor.ts`)다 — `SessionRuntimeRegistry` 를 소유하고 턴 핸들 teardown(`release`, 멱등)과 abort 프리미티브(`abortTurn` = `markAborted`+`controller.abort`)를 **단일 경로**로 모은다. 현재는 **척추**만 안착(정책 0); cap admission·LRU/idle eviction·IdleCloseTimer·Persistent runtime 은 0054 에서 이 소유자에 plug-in 한다.

> **상태**: 📐 *설계 확정 · 구현 대기*. 본 절은 **인터페이스/설계만** 정의하며 현재 코드 동작을 바꾸지 않는다 (코드 변경 0). 여기 정의한 타입은 **정본(SSOT)** 이며, ../frontend/ 의 렌더링·UX 문서(rendering.md·ux-domains.md)은 이 타입들을 *참조만* 한다(중복 정의 금지).
>
> **계층 위치 + 방법론 (짝 문서 [standardization.md](./standardization.md))**: 이 문서는 **런타임 정규화**(세션 *실행 중* 의 이벤트·권한·세션 흐름)를 다룬다. **배포 계층 표준화**(무엇을 배포·주입하는가 — AGENTS.md·MCP·SKILL.md)는 standardization.md 가 짝으로 다루며, 그 **ExtensionDeployer 산출물이 런타임 설정 입력이 되는 단방향** 연결이다. 또한 여기 정의한 정본 인터페이스는 *목표 카탈로그*다 — 구현은 **rule of three** 로 점진 추출하며, **v1 은 `permission.requested` 를 우선 정규화**하고 나머지 이벤트는 소비자가 생길 때 케이스를 추가한다(EventStream union 미완성 허용, standardization.md §1·§6 과 정합).
>
> **출처 신뢰 원칙**: 각 사실 옆에 출처 태그를 표기한다 — `[검증-타입]`(SDK 타입 시그니처로 확정, spec 문서 근거) / `[검증-런타임]`(현재 코드 구동/소비로 확인) / `[미확인-런타임]`(타입은 있으나 동작·형식 미검증) / `[N/A-claude]`(Claude SDK 에 대응 개념 없음 — OpenCode 전용) / `[미확인-opencode]`(OpenCode SDK 미설치로 미정). **교정(2026-06)**: Claude Agent SDK 는 `node_modules` 미설치라도 리포에 버전관리된 spec 문서(`docs/spec/claude/agent-sdk/typescript.md`)로 타입이 확정된다 — 따라서 Claude 축의 옛 `[미확인]` 은 spec 문서로 대조해 `[검증-타입]`/`[미확인-런타임]`/`[N/A-claude]` 로 분해했다(claude-probe.ts 정정 완료). **OpenCode SDK 만 여전히 미설치**라 그쪽 항목은 `[미확인-opencode]` 로 §13 절차를 거쳐 확정한다.
>
> **rename 범위 밖**: 실제 코드 심볼(`ChatEvent`·`SessionAdapter`·`makeCanUseTool` 등)은 이번 라운드에서 변경하지 않는다. 본 절의 *목표 타입명*(`NormalizedEvent` 등)과 현행 코드명의 대응은 §12 매핑표로만 둔다.

## 1. 왜 — 현재 결합의 3가지 괴리

Phase 3++ 구현은 claude-code SDK 에 강하게 결합돼 있어, 범용(OpenCode + Claude) 런타임 모델과 어긋난다. 핵심 명제: **이 앱은 "툴 이름 매핑" 앱이 아니라, 서로 다른 SDK 런타임을 공통 이벤트·세션·권한·직접 호출 모델로 정규화하는 앱이다.**

| 괴리 | 현재 코드 | 목표 |
|---|---|---|
| 이벤트가 provider-specific | `ChatEvent`(`src/shared/ipc.ts`, 9종) 가 Claude SDK 메시지 모양. `sessionId`/`provider`/`toolRunId` 정규화 축 없음 | `NormalizedEvent` (§2) + `permission.requested` 1급 이벤트 |
| 일반 권한 승인 UX 부재 | `makeCanUseTool`(`src/main/adapters/claude-code.ts`) 가 `AskUserQuestion`/`ExitPlanMode` 만 surface, **그 외 모든 tool 을 무조건 allow** | PermissionBridge + ApprovalResolution 2분기 (§3) |
| capability/revert/app-command/telemetry/audit/error 계층 부재 | 없음 | §4 ~ §11 |

> **2계층·Hook 연속성**: 본 정규화 계층은 신규 발명이 아니라 [adapters.md](./adapters.md) 의 **2계층 모델**(Tier A `OrcaCapabilities` / Tier B 얇은 `SessionAdapter`)과 **Hook 정규화 모델**([adapters.md §3](./adapters.md))의 *다음 단계*다. 그 모델의 `sendMessage(req: TurnRequest)` 객체 시그니처는 **이미 코드에 채택됨**([adapters.md §1.3](./adapters.md)) — 정규화 계층은 그 위에 `NormalizedEvent`(아웃바운드 이벤트)와 권한/세션/revert 정규화를 추가한다. `OrcaHookSet`·`OrcaHookDecision`([adapters.md §3](./adapters.md))은 §3 의 권한 결정 흐름과 의미가 겹치며, 구현 시 단일 결정 모델로 합류 검토.

## 2. NormalizedEvent — provider 중립 이벤트

**① 설명.** OpenCode 는 `event.subscribe()` SSE 스트림(`event.type` + `event.properties`)을 `[검증]`, Claude 는 `query()`/`ClaudeSDKClient` 메시지 async iterator + `canUseTool` 콜백을 사용한다 `[검증]`. 이 둘을 단일 이벤트 union 으로 정규화한다. 모든 이벤트는 `sessionId` 를 갖고(멀티세션 라우팅), 권한 요청은 1급 이벤트다.

**② 예시.** "Bash 한 줄 실행" 한 턴이 현재는 `tool_use` → `tool_result` 두 `ChatEvent` 로 흐른다. 정규화 후엔 `sessionId`/`provider`/`toolRunId` 를 가진 `tool.call.started` → `tool.call.completed` 가 되어, 같은 `toolRunId` 로 start/complete 를 매칭하고 어느 provider/세션에서 왔는지 식별한다.

**③ 현재 코드 갭.** 스테이지 B1/B1′ (`f61658f`·`3973112`) 로 와이어가 `NormalizedEvent`(`session.updated`·`message.delta/completed`·`tool.call.started/completed`·`telemetry`·`error`)로 전면 전환되고 매핑이 `adapters/claude-map.ts` 의 `claudeToNormalized` 로 이관됨(구 `ChatEvent` 타입 완전 제거, PR #47). `sessionId`/`toolRunId` 정규화 축 확보. **잔여 갭**: `provider` 축은 claude 고정값(`ProviderId` 에 opencode seam만).

**④ 인터페이스 (정본).**

```ts
type ProviderId = 'claude-code' | 'opencode'

type NormalizedEvent =
  | { type: 'message.delta';      sessionId: string; provider: ProviderId; messageId: string; delta: unknown }
  | { type: 'message.completed';  sessionId: string; provider: ProviderId; messageId: string; message: unknown } // [미확인] payload 모양
  | { type: 'message.reasoning';  sessionId: string; provider: ProviderId; text: string; signature?: string } // 확장사고 완성 블록 [검증-타입: BetaThinkingBlock] — 영속
  | { type: 'message.reasoning.delta'; sessionId: string; provider: ProviderId; delta: { text: string } } // 확장사고 라이브 [검증-타입: BetaThinkingDelta] — transient(미저장)
  | { type: 'tool.call.started';  sessionId: string; provider: ProviderId; toolRunId: string; toolName: string; args: unknown }
  | { type: 'tool.call.completed';sessionId: string; provider: ProviderId; toolRunId: string; result: unknown; isError: boolean; durationMs?: number }
  | { type: 'permission.requested'; sessionId: string; provider: ProviderId; approvalId: string; origin: 'agent' | 'app'; action: PermissionAction } // §3
  | { type: 'permission.resolved';  sessionId: string; provider: ProviderId; approvalId: string; resolution: ApprovalResolution }
  | { type: 'session.updated';    sessionId: string; provider: ProviderId; patch: unknown }
  | { type: 'telemetry';          sessionId: string; provider: ProviderId; usage: ProviderReportedTelemetry } // §8
  | { type: 'error';              sessionId?: string; provider: ProviderId; error: ClassifiedError }           // §6

// 한 provider 원본 1개가 N개 NormalizedEvent 로 분해될 수 있다(delta+tool 동시).
type ProviderEventMapper = { provider: ProviderId; map(raw: unknown): NormalizedEvent[] }
```

**claude SDK 메시지 ↔ `NormalizedEvent` 매핑표** (`adapters/claude-map.ts` 의 `claudeToNormalized` 로 구현 — SDK 메시지를 `NormalizedEvent` 로 **직접** 정규화, 구 `ChatEvent` 중간표현 제거) `[검증: 현재 코드]`:

| claude SDK 메시지(subtype) | → `NormalizedEvent` | 비고 |
|---|---|---|
| `init` | `session.updated`(최초) — `sessionId`/`model`/`cwd` 주입 | 현재 sessionId 출처 |
| `assistant_delta` | `message.delta` | 스트리밍 텍스트 (`text_delta`) |
| `stream_event`(thinking_delta) | `message.reasoning.delta` | 라이브 확장사고 (transient). 미수신 시 발생 안 함 |
| `assistant`(text block) | `message.completed` | 완성본. **블록 단위로 emit** — 한 assistant 메시지의 여러 text 블록을 말미에 합치지 않고 만나는 위치에서 각각 emit(메시지 내부 "텍스트 → 도구 → 텍스트" 순서 보존). 빈 text 블록은 스킵 |
| `assistant`(thinking block) | `message.reasoning` | 확장사고 — `text`+opaque `signature`. `display:'omitted'` 면 미발생 |
| `tool_use` | `tool.call.started` | `toolUseId` → `toolRunId`. content 배열 순서 그대로(text/tool 인터리브 보존) |
| `tool_result` | `tool.call.completed` | `isError`/`durationMs` 보존 |
| `result` | `telemetry` | `usage` → `ProviderReportedTelemetry` (§8) |
| `error` | `error` | `ErrorCode` → `ClassifiedError` (§6) |
| `ask_question` | `permission.requested`(`origin:'agent'`) | Claude `AskUserQuestion` 의 합성 — §3 |
| `plan_review` | `permission.requested`(`origin:'agent'`) | Claude `ExitPlanMode` 의 합성 — §3 |

> `[미확인]`: OpenCode `event.type` enum 전수와 Claude 메시지 타입 전수는 `types.gen.ts` / Claude SDK 타입에서 추출해 위 매핑을 완성한다(§13). 현재 union 은 골격이다.

## 3. 권한 정규화 파이프라인

#### permission.requested 는 1급 이벤트 (`origin`)

**① 설명.** 권한 요청은 반드시 `origin` 을 갖는다. `agent` = 에이전트가 tool 을 쓰려다 발생, `app` = 앱이 직접 SDK API 를 호출하려다 발생(§3 AppCommandPolicy).

**② 예시.** 현재 자동 allow 되는 `Bash rm -rf build/` 가 `permission.requested{origin:'agent', action:{kind:'shell', label:'rm -rf build/', risk:'high'}}` 로 surface → 렌더러 ApprovalCard(../frontend/ux-domains.md §1.6) 가 뜨고, 사용자 결정이 콜백으로 회신된다.

**③ 현재 코드 갭.** 스테이지 B2 (`a78a247`) 로 `permission.requested`/`permission.resolved` 가 **1급 `NormalizedEvent`** 가 됨 — router 가 ask/plan/tool 을 `permission.requested`(`approvalId=requestId`)로 emit, reducer 가 `action.kind`(ask_question/plan_review/tool_approval 3종)로 분기. `runtime-events/permission-bridge.ts` 가 합성·`AppCommandPolicy` 3분기 seam 보유. **스테이지 C 마무리로 `tool_approval` 게이트 활성** — `makeCanUseTool`(`src/main/adapters/claude-code.ts`)이 `RISKY_TOOLS` 화이트리스트(`Bash`·`Write`·`Edit`·`MultiEdit`·`NotebookEdit`, `permission-bridge.ts` 의 `isRiskyTool`)에 든 도구를 `tool_approval` 로 surface 하고, 안전 도구(Read/Glob/Grep 등)는 `{behavior:'allow'}` passthrough(Claude Code 웹/CLI 기본 패턴). 권한 응답은 단일 `permissionRespond` 채널 + `InteractionBroker<ApprovalResolution>` 로 통일됐다(구 askRespond/planRespond 2채널·ask/plan 2브로커 통합). "세션 동안 허용"은 `allow.updatedPermissions{scope:'session'}` → router 의 `sessionAllowedTools: Map<sessionId, Set<toolName>>` 로 앱 레벨 관리(SDK `updatedPermissions` 미사용). **잔여 갭**: `allowedTools=mcp__<name>__*` 와일드카드(adapters.md §1.3)는 여전히 "차단 안 함" 전제 · 위험 화이트리스트는 정적 상수(per-tool risk 등급·정규식 매칭은 후속).

**④ 인터페이스 (정본).**

```ts
type PermissionAction = { kind: string; label: string; input?: unknown; risk?: 'low' | 'medium' | 'high' }
```

- **OpenCode (agent)**: event 스트림에서 permission request 감지 → `postSessionByIdPermissionsByPermissionId({path, body})` → `boolean` 회신 `[검증]`.
- **Claude (agent)**: `canUseTool` 콜백 지점에서 합성 `permission.requested` 발행 → UI 결정 후 콜백을 `PermissionResult` 로 resolve. `canUseTool` 은 권한 평가의 마지막 단계 `[검증]`.

#### ApprovalResolution — 2분기 (4값 모델 폐기)

**① 설명.** 실제 Claude `PermissionResult` 는 **2분기**다. "modified input" 은 `allow` 의 `updatedInput` 필드, "interrupt" 는 `deny` 의 boolean. `allow` 에는 향후 자동승인 규칙을 갱신하는 `updatedPermissions` 가 있다(trust escalation 직결).

**② 예시.** (a) 사용자가 Bash 인자를 `rm -rf build/` → `rm -rf build/tmp/` 로 고쳐 승인 = `allow{updatedInput}`. (b) "이 세션 동안 Read 는 자동 허용" = `allow{updatedPermissions:[addRules…]}`. (c) "거부하고 에이전트 중단" = `deny{interrupt:true}`.

**③ 현재 코드 갭.** 현행 `AskResult`/`PlanDecision`(`src/shared/ipc.ts`)은 이 2분기의 *도메인 특수형*이다(answered/skipped, approved/rejected/revise). `makeCanUseTool` 이 Claude `PermissionResult` 를 직접 반환하지만 정규 `ApprovalResolution` 추상이 없어 OpenCode 와 공유 불가.

**④ 인터페이스 (정본).**

```ts
type ApprovalResolution =
  | { type: 'allow'; updatedInput?: unknown; updatedPermissions?: PermissionUpdate[] }
  | { type: 'deny';  message?: string; interrupt?: boolean }

// Claude TS 기준 [검증]
type PermissionUpdate =
  | { type: 'addRules' | 'replaceRules' | 'removeRules'; rules: unknown[]; behavior: 'allow' | 'deny' | 'ask'; destination?: unknown }
  | { type: 'setMode'; mode: NormalizedPermissionMode }
```

**Provider 별 downcast (OpenCode boolean 손실표)**:

| Provider | allow | deny |
|---|---|---|
| OpenCode | `body:true` — `updatedInput`/`updatedPermissions` **표현 불가, 무시(손실)** | `body:false` |
| Claude | `{behavior:'allow', updatedInput, updatedPermissions}` | `{behavior:'deny', message, interrupt}` |

> UI 는 OpenCode 세션에서 `updatedInput`/`updatedPermissions` 가 손실됨을 **명시**(provider capability 차이) — ../frontend/ux-domains.md §1.6 ApprovalCard 가 배지로 표시.

#### PendingApprovalStateMachine

**① 설명.** 콜백형(Claude `canUseTool` Promise)과 이벤트형(OpenCode SSE + response endpoint) 승인을 동일 상태 모델로 처리: `requested → resolving → resolved(allow|deny)`, 이탈 분기 `timed_out`/`aborted`.

**③ 현재 코드 갭.** `src/main/ask/broker.ts` 의 `InteractionBroker<T>`(register/resolve + abort signal + default-on-cancel)가 이 상태기계를 구현한다. 스테이지 C 마무리로 router 가 ask/plan 2브로커를 단일 `InteractionBroker<ApprovalResolution>`(`approvals`)로 통합해 **ask·plan·tool 전 종류**의 권한 요청이 하나의 broker 를 거친다. **`timed_out` 분기 구현 완료** — `register(…, opts?: { timeoutMs, timeoutValue, onSettle })` 가 선택적 wall-clock timeout 을 받고, 종료 경로(`resolved`/`timed_out`/`aborted`)를 단일 `settle()` 로 정리하며 `PendingApprovalState`(`'requested'|'resolving'|'resolved'|'timed_out'|'aborted'`)를 `onSettle` 로 통지한다(`opts` 미전달 시 종전 동작 100% 동일). 단 router 는 timeout 을 **와이어링하지 않는다** — 승인 카드 표시 중 벽시계 auto-deny 는 UX 를 해치므로 mechanism 만 준비(OpenCode 이벤트형·서버 permission TTL 도입 시 소비). **잔여: OpenCode 이벤트형 편입**(SSE permission request → broker).

**④ 인터페이스 (정본).**

```ts
type PendingApprovalState = 'requested' | 'resolving' | 'resolved' | 'timed_out' | 'aborted'

interface PermissionBridge {                          // agent-originated approval 만 담당
  request(ev: Extract<NormalizedEvent, { type: 'permission.requested' }>): Promise<ApprovalResolution>
  // Claude: resolved 도달 시 canUseTool Promise 를 PermissionResult 로 resolve
  // OpenCode: resolved 도달 시 postSessionByIdPermissionsByPermissionId 호출(boolean downcast)
}
```

#### AppCommandPolicy — 3분기 (app-originated)

**① 설명.** OpenCode 는 앱이 *직접* 호출하는 상태변경/권한우회 API 를 제공한다. 이는 agent tool permission gate **바깥**이므로 앱 자체 정책이 필요하다 `[검증]`. read-only / bypass-risk / state-changing 3분기.

**② 예시.** `file.read`(무프롬프트 통과) vs `session.shell`(agent gate 밖 → 항상 승인) vs `session.revert`(상태 변경 → 승인 + audit). Claude 단독에선 대부분 무의미하나 **OpenCode 확장점**으로 필요.

**③ 현재 코드 갭.** 없음(Claude 단독이라 app-originated direct call 표면이 아직 없음). OpenCode 어댑터 도입 시 필수.

**④ 인터페이스 (정본).**

```ts
type AppCommandKind =
  | 'read_only_direct_action'      // file.read, find.text/files/symbols, file.status
  | 'bypass_risk_direct_action'    // session.shell, session.command, direct file mutation
  | 'state_changing_direct_action' // session.revert/unrevert/abort/delete/share/init

const DEFAULT_APP_COMMAND_POLICY: Record<AppCommandKind, 'pass' | 'require_approval'> = {
  read_only_direct_action: 'pass',
  bypass_risk_direct_action: 'require_approval',
  state_changing_direct_action: 'require_approval',
}
```

> `session.summarize` 의 side effect(요약을 세션에 저장하는지)는 공식 문서상 불명확 `[미확인]` → 확정 전까지 보수적으로 `state_changing` 분류.

#### PermissionModeController — 세션 중 신뢰 상향

**① 설명.** Claude 는 `Query.setPermissionMode()`(TS)/`set_permission_mode()`(Python)로 mid-session 모드를 즉시 전환한다 `[검증-타입]`(typescript.md Query 인터페이스). 모드 전수: `default | acceptEdits | plan | dontAsk | bypassPermissions | auto`(auto=TS 전용 모델 분류기) `[검증-타입]`(typescript.md:520). **선결조건**: 이 control 메서드들은 typescript.md Query 주석상 **스트리밍 입력 모드 전용**("Only available in streaming input mode") — 즉 `query()` 에 `prompt` 를 `string` 이 아닌 `AsyncIterable<SDKUserMessage>` 로 넘겨 장수명 `Query` 핸들을 유지해야 열린다.

**② 예시.** 사용자가 "계획만 보기(plan)" 로 시작했다가, 신뢰가 쌓이면 런타임에 `accept_edits` 로 올려 파일 편집 자동 수락. 이후 `allow` 시 `updatedPermissions` 로 규칙 누적.

**③ 현재 코드 갭.** 현행은 per-turn `permissionMode: 'plan' | 'acceptEdits'`(`src/shared/ipc.ts`, 2종)만 `SendChatMessage` 로 전달. **mid-session 전환 없음**. 또 현재 어댑터(`claude-code.ts`)는 `prompt: text(string)` 로 `query()` 를 매 턴 **one-off** 호출한다. **교정**: 런타임 전환의 선행 조건은 "장수명 `ClaudeSDKClient` 클래스"가 아니라 **스트리밍 입력 모드 전환**이다 — 동일 `query()` 함수에 `prompt` 만 `AsyncIterable<SDKUserMessage>` 로 넘기면 반환된 `Query` 핸들에서 `setPermissionMode`/`interrupt`/`setModel` 이 열린다(별도 클라이언트 클래스 불요). 입력 큐가 살아있는 동안 generator 가 `return` 되지 않아야 핸들이 유지된다. runtime-ipc.md §1(동시성)의 멀티세션 `requestRegistry` 와 세션별 `Query` 핸들 수명을 연결한다.

**④ 인터페이스 (정본).**

```ts
type NormalizedPermissionMode =
  | 'default' | 'accept_edits' | 'plan' | 'dont_ask' | 'bypass' | 'auto_classified'

interface PermissionModeController {
  getCurrentMode(): NormalizedPermissionMode
  setMode(mode: NormalizedPermissionMode): Promise<void>            // Claude: setPermissionMode / OpenCode: 앱 레벨 에뮬레이션 [미확인-opencode]
}
```

> **구현 상태**: ✅ **PR③ 라이브 전환까지 구현 완료.** `NormalizedPermissionMode`(6종)·`toClaudePermissionMode`·`fromUiPermissionMode`(`src/shared/permission-mode.ts`) + 세션-키 `PermissionModeController`(`src/main/runtime-events/permission-mode-controller.ts`, sessionId 인자) + Vitest. **router/adapter 와이어링·라이브 `Query.setPermissionMode` 위임 완료** — 어댑터가 매 턴 streaming input 모드(`createTurnInputStream` → `prompt: AsyncIterable<SDKUserMessage>`, `src/main/adapters/streaming-input.ts`)로 `query()` 를 호출해 살아있는 `Query` 핸들을 유지하고, `src/main/adapters/claude-code.ts:209-212` 가 `setPermissionMode`/`interrupt`/`setModel` 을 핸들에 위임한다. `src/main/ipc/router.ts:728-745` 의 `handlePermissionSetMode`(채널 `orca:permission:setMode`)가 ① controller(세션 SSOT) 갱신 + ② 진행 중 턴이면 `turn.live.setPermissionMode(toClaudePermissionMode(mode))` 즉시 위임. **잔여: 풀 크로스턴 멀티세션**(resume-from-DB SSOT 충돌·구동 UI 부재 — Phase 4).

| Provider | 처리 |
|---|---|
| Claude | `setPermissionMode` 런타임 전환. `auto`(TS)=모델 분류기 승인 |
| OpenCode | 동일 런타임 mode setter 가 공식 문서에 없음 → 앱 레벨 "이후 같은 종류 자동 승인" 에뮬레이션 `[미확인]` |

> **권한 평가 순서 불일치 `[부분 불확실]`**: 공식 문서에 두 서술이 병존한다 — (a) `Hooks → Deny → Mode → Allow → canUseTool`, (b) `PreToolUse Hook → Deny → Allow → Ask → Mode → canUseTool → PostToolUse Hook`. **둘 다 1차 출처이며 불일치.** 구현은 hooks 3분기(allow/deny/passthrough)·ask rules·Pre/PostToolUse hook 까지 포함한 완전 파이프라인으로 모델링하고, 대상 SDK 버전 기준으로 단일화한다(§13).

## 4. SessionCapability + CapabilityProbe

**① 설명.** provider 는 대칭이 아니다. 세션 기능을 런타임에 탐지(probe)해 `AppSession.capabilities` 에 캐시하고, UI 는 `false` 인 액션 버튼을 **사전 비활성/숨김**(사후 `capability_unsupported` 에러보다 UX 우월).

**② 예시.** OpenCode 는 `session.children`/`share`/`init`(AGENTS.md) `[검증]`, Claude 는 `continueConversation`/`resume`/`forkSession` `[검증]`. 서로 대응이 없으므로 사이드바/메뉴가 가용한 액션만 노출.

**③ 현재 코드 갭.** ✅ **해소** — `SessionAdapter.describe(): ProviderDescriptor` 추가(`src/main/adapters/types.ts`). claude 는 **정적 서술자** `CLAUDE_DESCRIPTOR`(`src/main/capabilities/claude-probe.ts`)를 반환한다 — 능력은 세션별이 아니라 backend 별 고정이고, 타입으로 확정되는 능력은 spec 문서로 검증되므로 런타임 introspection 이 불필요하다(`discover()` 가 async 인 건 opencode introspection seam 용). 능력은 `backend:list` 가 `registry.describeAll()` 로 computed-on-the-fly 부착(영속 안 함 — 백엔드의 함수). 순수 DTO 는 `src/shared/ipc.ts`(SSOT), main 재노출 + `CapabilityProbe` 는 `src/main/capabilities/types.ts`. UI 는 `BackendStatus` 지표 + Composer cancel 게이팅으로 소비. 필드별 출처 태그(`[검증-타입]`/`[검증-런타임]`/`[미확인-런타임]`/`[N/A-claude]`/`[미확인-opencode]`)로 audit trail 보존.

**④ 인터페이스 (정본).**

```ts
interface SessionCapabilities {
  // lifecycle
  continue?: boolean; resume?: boolean; fork?: boolean; persistSessionFalse?: boolean; delete?: boolean; update?: boolean
  // structure / control
  children?: boolean; summarize?: boolean; abort?: boolean; share?: boolean; init?: boolean
  liveModeSwitch?: boolean  // 세션 중 권한 모드 라이브 전환 (Claude setPermissionMode, 스트리밍 입력 전용). ✅ 구현 완료(router.ts:728-745 + claude-code.ts:209-212).
  // context
  contextInjectionNoReply?: boolean; structuredOutput?: boolean
  // revert (§5)
  conversationRevert?: boolean; conversationUnrevert?: boolean; fileCheckpointCreate?: boolean; fileCheckpointRestore?: boolean
}

interface CapabilityProbe {
  provider: ProviderId
  discover(): Promise<{ session: SessionCapabilities; revert: RevertCapabilities; cancellation: CancellationCapability }>
}
```

| 기능 | OpenCode | Claude Code |
|---|---|---|
| continue/resume/fork | 동일 표면 없음 `[미확인-opencode]` | `continue`/`resume`/`forkSession` (typescript.md Options) `[검증-타입]` |
| children / summarize / share | `session.*` `[검증]` | Claude SDK 대응 함수 없음 `[N/A-claude]` |
| abort / init | `session.*` `[검증]` | AbortController / system:init `[검증-런타임]` |
| noReply context injection | `session.prompt({noReply:true})` `[검증]` | `systemPrompt.append` (typescript.md:484) — 형식 `[미확인-런타임]` |
| structured output | `session.prompt({format})` `[검증]` | `Options.outputFormat` json_schema (typescript.md:465) `[검증-타입]`, 출력 형식 `[미확인-런타임]` |

## 5. RevertManager — 되돌리기 의미 분리 (핵심)

**① 설명.** **conversation revert ≠ file revert. 절대 합치지 않는다.** 대화/메시지 상태 되돌리기와 파일 변경 snapshot/복원은 별개 개념·별개 capability.

**② 예시.** OpenCode `session.revert`/`unrevert` = 대화 상태 되돌리기 `[검증]`. Claude file checkpointing(실험적, `betas` 로 활성화) = 파일 snapshot/복원 `[검증]`. 한쪽만 있는 provider 에서 다른 쪽 버튼은 숨긴다.

**③ 현재 코드 갭.** ✅ **seam 구현** — `RevertManager`(`src/main/capabilities/revert-manager.ts`)가 `RevertCapabilities` 를 주입받아 메서드 4개(`revertConversation`/`unrevertConversation`/`createFileCheckpoint`/`restoreFileCheckpoint`)를 각자 자기 cap 으로 가드한다. **단일 revert() 금지** — conversation↔file 을 절대 병합하지 않는다. claude 는 전 cap false 라 오늘 모든 메서드가 "미지원" throw 이고 호출자도 없다(§5 의미 분리를 코드로 앵커 + 테스트로만 운동되는 seam). cap=true 백엔드(OpenCode 대화 revert / Claude file checkpoint beta) 도입 시 활성화.

**④ 인터페이스 (정본).**

```ts
interface RevertCapabilities {
  conversationRevert: boolean; conversationUnrevert: boolean
  fileCheckpointCreate: boolean; fileCheckpointRestore: boolean
}
interface CancellationCapability {
  sessionAbort?: boolean   // OpenCode: session.abort [검증]
  denyInterrupt?: boolean  // Claude: PermissionResultDeny.interrupt [검증]
  abortSignal?: boolean    // Claude: ToolPermissionContext.signal [미확인 — 현재 "future" 표기]
}
```

## 6. ErrorClassifier — 8분류 + cancellation 분리

**① 설명.** `error` 이벤트는 분류돼야 재시도/표시 정책을 결정할 수 있다. 8 category + retryable 플래그.

**③ 현재 코드 갭.** 현행은 `detectError()`(`src/main/adapters/claude-code.ts`) 휴리스틱(401/OAuth/expired 정규식 → `auth.expired`)과 `ErrorCode` enum(`sdk.*`/`auth.expired`/`protocol.parse`/`internal`; 구 `cli.*` 코드는 PR #47 에서 제거)뿐 — 정규 분류기/`retryable` 없음.

**④ 인터페이스 (정본).**

```ts
type ErrorCategory =
  | 'provider_connection_error'  // OpenCode 서버 다운, Claude 바이너리 부재
  | 'auth_error'                 // API key 무효/누락 (현행 auth.expired)
  | 'permission_denied'          // user deny / policy deny
  | 'tool_execution_error'       // shell exit≠0, file read 실패
  | 'stream_error'               // SSE 끊김, iterator 오류
  | 'capability_unsupported'     // 예: Claude 에 OpenCode식 find.* 없음
  | 'schema_validation_error'    // structured output 검증 실패
  | 'user_cancelled'             // abort/interrupt

interface ClassifiedError { category: ErrorCategory; message: string; retryable: boolean; provider?: ProviderId; cause?: unknown }
interface ErrorClassifier { classify(error: unknown, ctx: { provider: ProviderId; phase: string }): ClassifiedError }
```

## 7. 정규화 Persistence — AppMessagePart

**① 설명.** 이벤트 스트림과 별개로 대화 기록을 저장·재렌더링하는 내부 모델. OpenCode 가 messages 를 `{ info: Message, parts: Part[] }[]` 로 다루는 것을 반영해 **parts** 모델을 둔다. 무거운 페이로드(stdout/파일 본문)는 별도 blob store 로 분리해 메시지 행을 가볍게 유지.

**③ 현재 코드.** ✅ **구현 완료** — `0004_message_parts.sql` 가 `message_parts(message_id FK, idx, type, tool_run_id, payload_json)` 를 신설하고 기존 `messages.content`/`tool_calls` 를 parts 로 backfill 후 `tool_calls` 를 DROP 한다(정식 배포 전이라 하위호환 불요). `messages.content` 는 **text/reasoning parts 의 concat 캐시**로 유지해 FTS5 contentless 트리거를 건드리지 않는다. `router.persist` 가 한 턴의 모든 파트(text/reasoning/tool_call/tool_result/error)를 같은 assistant 메시지에 순서대로 append 하고(`DbQueries.appendPart`/`upsertToolResultPart`), `handleSessionLoad` 가 `loadParts` 로 `LoadedMessage.parts: AppMessagePart[]` 를 재구성한다. **claude 가 채우는 종류**: text/tool_call/tool_result/error + **reasoning**(확장사고 — `claude-map` 이 `assistant` content 의 `thinking` block → `message.reasoning` 이벤트, signature opaque 보관). `file`/`diff`/`structured_output` 은 union 정의만 두고 OpenCode 어댑터 도입 시 채운다(seam). blob 분리(무거운 stdout/파일 본문)는 후속(Phase 4).

**④ 인터페이스 (정본).**

```ts
interface AppSession { id: string; provider: ProviderId; providerSessionId: string; title?: string; cwd?: string; capabilities: SessionCapabilities; createdAt: string; updatedAt: string }
interface AppMessage { id: string; sessionId: string; providerMessageId?: string; role: 'user'|'assistant'|'system'|'tool'|'context'; parts: AppMessagePart[]; createdAt: string }
// ✅ 구현형(`app/src/shared/ipc.ts`). reasoning.signature 는 멀티턴 재전송 무결성용 opaque.
type AppMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; signature?: string }
  | { type: 'tool_call'; toolRunId: string; toolName: string; args: unknown }   // 무거운 페이로드는 blobRef 로 분리(후속)
  | { type: 'tool_result'; toolRunId: string; result: unknown; isError: boolean; durationMs?: number }
  | { type: 'file'; path: string; readType?: 'raw' | 'patch'; content?: string }
  | { type: 'diff'; patch: string }
  | { type: 'structured_output'; value: unknown }
  | { type: 'error'; error: unknown }
```

> 구현 전략: 스트리밍 중 `tool_call` part 를 먼저 append → `tool.call.completed` 도착 시 동일 `toolRunId` 로 `tool_result` 매칭. 무거운 stdout/파일 본문은 blob 로 빼고 행엔 ref 만.

## 8. TelemetryService

**① 설명.** provider 가 usage/cost 를 제공하면 쓰고, 없으면 앱이 자체 집계. 2계층.

**③ 구현 상태.** `claude-map.ts` 가 `result` 메시지에서 `ProviderReportedTelemetry`(cost·model·modelUsage·input/output·캐시 토큰·durationMs·numTurns)를 정규화해 `telemetry` 이벤트에 싣고, reducer(`chatReducer` telemetry case)가 `lastTelemetry` + 세션 누적 `sessionCostUsd`(턴별 누산 — cost-tracking.md §147 SDK 세션 합계 미제공) + app-measured `lastTurnLatencyMs`(전송→telemetry 벽시계)를 산출. 렌더러 `UsagePanel`(구 TelemetryPanel, ../frontend/rendering.md §1.9)이 표시. **잔여(후속)**: AppMeasured 전체 집계(eventCount/bytesStreamed/errorRate/cancelRate)·DB 영속·세션 통계 화면.

- **컨텍스트 입력 = 마지막 assistant 스냅샷, 비용 = result 누적 (2-소스 분리).** `claude-map.ts` 의 `MapContext.lastAssistantUsage` 가 매 `assistant` 메시지의 `message.usage`(Anthropic shape: `input_tokens`/`output_tokens`/`cache_read_input_tokens`/`cache_creation_input_tokens`)를 최신값으로 보관한다(ctx 는 턴 1회 생성·스트림 전체 공유 → 마지막 것이 남음). `result` 정규화 시 telemetry 의 **컨텍스트 입력 3종(`inputTokens`·`cacheReadTokens`·`cacheCreationTokens`) 중 스냅샷에 존재하는 필드만 이 스냅샷으로 덮는다**(없는 필드는 `result.usage` 값 보존 — field-merge). 이유: `result.usage` 는 멀티스텝(도구 N회) 턴에서 단계별 입력이 누적돼 과대 집계되므로 `/context` 상단 %("모델이 *마지막으로* 본 입력 / 윈도우")와 어긋난다. **`else delete` 금지** — 스냅샷이 `input` 만 주고 `cache_read` 를 안 줄 때 result 의 `cache_read` 를 지우면 `contextTokens` 가 input(≈1)으로 붕괴해 도넛이 0~1% 로 무너진다. **`costUsd`·`durationMs`·`numTurns`·`modelUsage`·`model` 은 result 누적값 유지**(비용은 턴 전체 합이 맞음). 스냅샷 미수신 시 `result.usage` 로 graceful fallback. `/context` 와 100% 일치는 불가 — 개념·수치 *근사*가 목표. 단위 테스트는 `claude-map.test.ts`(멀티스텝 스냅샷 vs 누적·fallback·cache 보존).
- **핸드오프 도착 턴 컨텍스트 무효화 (0127).** `TurnRequest.handoff` → `MapContext.handoffArrival` 표식. 압축 경계(compact_boundary) *전* 의 assistant usage 는 원본 세션 전체 이력의 승계 컨텍스트라 스냅샷으로 캡처하지 않고, 경계 없이 끝난 result 는 telemetry 의 컨텍스트 3종을 제거한다(도넛/경고 '미측정' 시작 — 새 세션이 원본 사용량을 승계하지 않음). 경계 통과 후에는 기존 압축-후 근사(post_tokens/요약 크기)·실측 스냅샷 경로 그대로. 자동 연속 턴은 `forkFrom` 과 함께 플래그를 제거한다(chat-turn).
- **빈 컨텍스트 턴 적재 스킵 (`/context` 등).** `router.ts` telemetry case 는 `usage` 가 있고 `hasContextTokens(usage)`(`usage/usageMap.ts` — input+cacheRead+cacheCreation > 0) 일 때만 `usage_events` 1행 적재한다. `/context`·`/help` 류 로컬 슬래시 명령은 모델 미호출이라 컨텍스트·비용 둘 다 없는 빈 행을 만드는데, 이를 적재하면 `getLatestUsage`(최신행) 복원 시 직전 도넛을 0 으로 덮는다. 라이브 쪽 짝 가드는 reducer(`contextTokens > 0` 일 때만 `lastTelemetry` 교체, rendering.md §1.9).

**④ 인터페이스 (정본 — `[검증-런타임]` cost-tracking.md 로 필드 확정).** 구현된 정본 타입은 `src/shared/ipc.ts` 의 `ProviderReportedTelemetry`/`TelemetryModelUsage`(claude `result` 의 snake/camel 혼용을 camelCase 정규화).

```ts
interface TelemetryModelUsage { costUsd?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number; contextWindow?: number }
interface ProviderReportedTelemetry { model?: string; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheCreationTokens?: number; costUsd?: number; durationMs?: number; numTurns?: number; contextWindow?: number; modelUsage?: Record<string, TelemetryModelUsage> }
// contextWindow(0134) = SDK result modelUsage[].contextWindow 실측(단일 모델 턴은 top-level 승격).
// renderer 분모 단일 진입점 contextWindowOf() 가 ① top-level ② modelUsage[model] ③ 모델명
// 휴리스틱(contextWindowFor — 1M 패밀리 마커 + 200k 기본) 순으로 해석. DB 비영속 — 재로드 복원
// 경로는 ③ 폴백(현행 패밀리는 정확, 미지 신모델만 다음 라이브 턴까지 기본값).
interface AppMeasuredTelemetry { latencyMs?: number; toolDurationMs?: number; streamDurationMs?: number; eventCount?: number; bytesStreamed?: number; errorRate?: number; cancelRate?: number } // latencyMs 만 구현(reducer lastTurnLatencyMs), 나머지 후속
```

## 9. AuthStore — 키 저장소가 아니라 주입 전략

**① 설명.** provider 별 auth 주입 지점이 다르므로 단일 "키 저장소"가 아니라 **주입 전략**으로 모델링한다. 비밀값은 OS keychain/secret store 에 두고 메모리 노출 최소화.

**③ 현재 코드 갭.** 현행은 (a) Claude SDK 가 `~/.claude` 자격증명 자동 사용(security.md §1.3) + (b) MCP 인증 비밀만 safeStorage(security.md §1.4) — provider-중립 주입 전략 추상 없음. security.md §1.4 의 safeStorage 모델을 "주입 전략" 으로 재서술하면 그대로 AuthStore 의 한 갈래가 된다.

**④ 인터페이스 (정본).**

```ts
type ClaudeAuthMode =
  | { kind: 'api_key'; env: { ANTHROPIC_API_KEY: string } }
  | { kind: 'local_binary'; pathToClaudeCodeExecutable: string }  // 구독 세션 [검증]
  | { kind: 'bedrock'; region: string }
  | { kind: 'vertex'; project: string }

type AuthInjection =
  | { provider: 'opencode';        via: 'auth.set'; body: { id: string; type: 'api'; key: string } }     // 서버 API [검증]
  | { provider: 'claude-code';     via: 'process_env_or_binary'; mode: ClaudeAuthMode }
  | { provider: 'openai_compatible'; via: 'baseURL+apiKey'; baseURL: string; apiKey: string }            // OpenCode provider 경유 [검증]

interface AuthStore { resolve(provider: ProviderId): Promise<AuthInjection> }
```

## 10. AuditLog

**① 설명.** permission/app-command/revert/shell 실행을 기록. 입출력은 원문 대신 **해시**로 저장(민감 데이터 노출 축소). 기록은 PermissionBridge·AppCommandPolicy 결정 지점에 **hook 으로 박는다**. state-changing/bypass-risk 는 audit 누락이 곧 보안 공백이므로 기록 실패 시 액션을 막는 **fail-closed** 옵션.

**③ 현재 코드 갭.** 없음(감사 로그 미도입).

**④ 인터페이스 (정본).**

```ts
interface AuditLogEntry {
  id: string; sessionId: string; actor: 'user' | 'agent' | 'app'; provider: ProviderId
  origin: 'agent' | 'app'; action: string; risk: 'low' | 'medium' | 'high'
  decision?: ApprovalResolution; inputHash?: string; outputHash?: string; createdAt: string
}
```

## 11. ModelProviderConfig — 게이트웨이를 합치지 않는다

**① 설명.** 두 런타임의 모델 구조는 **비대칭**이라 앱 공통 추론 게이트웨이를 두지 않는다. provider 별 "모델 설정 표면"만 정규화해 노출하고, 추론 트래픽은 각 런타임이 처리.

**② 예시.** OpenCode 는 `opencode.json` `provider` 섹션에서 75+ provider + 임의 `baseURL` override + `@ai-sdk/openai-compatible`(LiteLLM/vLLM/Ollama/LM Studio) 등록 `[검증]`. Claude Agent SDK 는 모델이 SDK 에 결합 — `model`/`fallbackModel` + 인증 경로로만 제한 `[검증]`. 따라서 "커스텀 OpenAI-compatible provider 추가" UI 는 **OpenCode runtime 일 때만** 노출.

**③ 현재 코드 갭.** 없음(claude 고정). OpenCode 도입 시 분기.

**④ 인터페이스 (정본).**

```ts
type ModelProviderConfig =
  | { runtime: 'opencode'; providers: Array<{ id: string; npm?: string; name?: string; baseURL?: string; models: Record<string, { name?: string; limit?: { context?: number; output?: number } }> }> }
  | { runtime: 'claude-code'; model?: string; fallbackModel?: string; auth: ClaudeAuthMode }
```

## 12. 현행명 → 목표명 매핑표 (rename 범위 밖 — 문서로만)

> 실제 코드 심볼은 이번 라운드에서 변경하지 않는다(사용자 확정). 이름 정렬은 *구조가 실제로 바뀌는 구현 PR* 로 미룬다.

| 현행 코드 심볼 | 위치 | 목표명 | 비고 |
|---|---|---|---|
| `ChatEvent` | `src/shared/ipc.ts` | `NormalizedEvent` | sessionId/provider/toolRunId 필드 추가 시 함께 rename |
| `tool_use` / `tool_result` | 〃 | `tool.call.started` / `tool.call.completed` | toolUseId→toolRunId |
| `ask_question` / `plan_review` | 〃 | `permission.requested(origin:'agent')` | 합성 |
| `AskResult` / `PlanDecision` | 〃 | `ApprovalResolution` 특수형 | ✅ 와이어는 단일 `permissionRespond`(`{approvalId, resolution}`)로 2분기 일반화 완료(스테이지 C). `AskResult`/`PlanDecision` 은 어댑터/router 내부 도메인 표현으로 잔존 |
| `InteractionBroker` | `src/main/ask/broker.ts` | `PermissionBridge` + `PendingApprovalStateMachine` | ✅ ask/plan 2브로커 → 단일 `InteractionBroker<ApprovalResolution>`(전체 tool) 통합 완료(스테이지 C) |
| `makeCanUseTool` | `src/main/adapters/claude-code.ts` | (PermissionBridge 어댑트) | ✅ 위험 도구 게이트(`RISKY_TOOLS`) 활성 — 단일 `requestApproval(action)` 콜백 소비(스테이지 C) |
| `detectError` | 〃 | `ErrorClassifier.classify` | 8분류 |
| `permissionMode`(2종) | `src/shared/ipc.ts` | `NormalizedPermissionMode`(6종) | + 런타임 전환 |
| `usage`(result) | adapters.md §1.5 | `ProviderReportedTelemetry`(구현됨 §8) | + AppMeasured(latency 만, 나머지 후속) |

## 13. 구현 전 SDK 타입 확정 절차 (`[미확인]` 일괄)

> **선결 제약 (교정 2026-06)**: **Claude SDK 타입은 리포의 spec 문서(`docs/spec/claude/agent-sdk/typescript.md`)로 확정 가능**하므로 Claude 축 항목은 아래 표에서 spec 대조로 해소했다. **OpenCode SDK 만 여전히 미설치**라 그쪽 항목은 실제 타입 파일을 받아 확정한 **뒤** 구현에 들어간다.

| 항목 | 확인 위치 | 상태 |
|---|---|---|
| OpenCode `event.type` enum 전수 (§2 매핑 완성) | `packages/sdk/js/src/gen/types.gen.ts` | `[미확인-opencode]` |
| Claude 권한 평가 순서 단일화(hooks/ask/Pre·PostToolUse 포함) | 대상 SDK 버전 permissions 문서 | `[부분 불확실]`(공식 문서 2서술 병존, §3) |
| Claude usage/cost 노출 형식 (§8) | `result` 메시지 타입 (cost-tracking.md) | `[검증-타입]` 해소 — `total_cost_usd`·`modelUsage{costUSD,inputTokens,outputTokens,cacheReadInputTokens,cacheCreationInputTokens}`·`usage{cache_*_input_tokens}`·`duration_ms`·`num_turns` 로 §8 구현. 런타임 실측값 일치는 GUI 1회 확인 권장 |
| OpenCode usage/cost 노출 형식 | `session.message` / `Message` 타입 | `[미확인-opencode]` |
| OpenCode mode setter 부재 확정 (§3) | `types.gen.ts` / 서버 OpenAPI | `[미확인-opencode]` |
| Claude children/summarize/share 대응 (§4) | typescript.md (대응 함수 없음) | `[N/A-claude]` 확정 — abort/init 은 `[검증-런타임]` |
| OpenCode file checkpoint 대응 (§5) | 서버 OpenAPI | `[미확인-opencode]` |
| `session.summarize` side effect (§3 분류) | `types.gen.ts` / 서버 동작 | `[미확인-opencode]` |
| `forkSession`/`persistSession`/`includePartialMessages` 정확한 옵션명 | typescript.md:457/470/460 | `[검증-타입]` 확정 |
| Claude `ToolPermissionContext.signal`(abort) 실사용 가능 여부 | typescript.md (canUseTool signal) | `[미확인-런타임]`(타입 존재, 실사용 구동검증) |
| Claude structured output 형식 (FRONTEND `StructuredOutputState` 흡수 가능?) | typescript.md:465 `outputFormat` | `[검증-타입]` 형식 존재 — 출력 매핑 `[미확인-런타임]` |

---


## 14. Provider Event Mapping Table (구현 전 골격)

§2 의 `NormalizedEvent` 는 구현 시 **provider 원본 → normalized 매핑표**가 있어야 한다. OpenCode 는 `event.subscribe()` SSE(`event.type`+`event.properties`), Claude 는 async iterator 메시지 + `canUseTool` 콜백이다 `[검증]`. 현재 골격(전수는 §13 절차로 확정):

| Provider | 원본 | → NormalizedEvent |
|---|---|---|
| OpenCode | `event.subscribe()` 스트림 | `message.delta` / `tool.call.*` / `permission.requested(origin:agent)` / `session.updated` |
| Claude | `query()`/`ClaudeSDKClient` 메시지 | `message.delta` / `message.completed` / `tool.call.*` / `session.updated` / `telemetry` |
| Claude | `canUseTool` 콜백 | `permission.requested(origin:agent)` 합성 |
| App | `session.shell`/`command` 등 직접 호출 직전 | `permission.requested(origin:app)` 합성 (§3 AppCommandPolicy) |

> `ProviderEventMapper.map(raw)` 는 **1:N** 가능(한 원본이 delta+tool 로 분해). `[미확인]`: OpenCode `event.type` enum 전수 = `types.gen.ts`, Claude 메시지 타입 전수 = SDK 타입.

## 15. Capability Discovery — 런타임 probe + 사전 게이팅

§4 의 capability 타입은 런타임에 탐지해 `AppSession.capabilities` 에 캐시하고, UI 는 `false` 인 액션 버튼을 **사전 비활성/숨김**(사후 `capability_unsupported` 에러보다 UX 우월).

> **현재 구현 (claude 단독).** 능력은 backend 별 고정이고 타입 확정분은 spec 문서로 검증되므로 *런타임 introspection* 대신 **정적 서술자**(`CLAUDE_DESCRIPTOR`)를 반환한다(§13 교정). 영속은 **computed-on-the-fly** — `AppSession.capabilities` DB 컬럼 없이 `backend:list` 응답에 매번 다시 계산해 붙인다(capabilities 는 세션별 데이터가 아니라 백엔드의 함수). `discover()` 가 async 인 건 opencode SDK 메서드 introspection seam 을 위함. UI 소비자: `BackendStatus` 지원-기능 지표 + Composer cancel 버튼 `cancellation.sessionAbort` 게이팅(claude 는 true 라 오늘 실효 0 — 미래 백엔드 seam).

| Capability | 탐지 방법 |
|---|---|
| OpenCode direct API 존재 (`DirectBackendCapabilities` §17) | SDK client 메서드 존재 / `types.gen.ts` |
| OpenCode provider 목록 / agents / health | `config.providers()` / `app.agents()` / `global.health()` `[검증]` |
| Claude session 기능 | SDK 타입 / options 지원 여부 `[미확인]` |
| Claude permission modes | `setPermissionMode` 호출 가능 여부 |
| Claude executable | `pathToClaudeCodeExecutable` 설정 가능 `[검증]` |

## 16. PermissionBridge 필수 경로 테스트 (구현 전 정의)

§3 의 2분기 + OpenCode boolean downcast 손실이 의도대로 동작하는지 아래 경로를 검증한다:

```text
Claude canUseTool → permission.requested(agent) → allow          → callback resolve {behavior:'allow', updatedInput}
Claude canUseTool → permission.requested(agent) → deny+interrupt → callback resolve {behavior:'deny', interrupt:true}
OpenCode perm event → permission.requested(agent) → allow        → postSession...Permissions...(true)  // updatedInput/Permissions 손실
App session.shell  → permission.requested(app)   → allow         → 직접 호출 실행 + audit (§10)
App file.read      → (read_only, policy 'pass')                  → 프롬프트 없이 실행 + (선택) audit
```

> Test Matrix 축(Provider × Session × Permission × Direct command × File × Search × Stream × UI × Telemetry)은 구현 PR 에서 §13 의 `[미확인]` 확정 후 채운다.

## 17. DirectBackendAPI — capability-gated optional layer

**① 설명.** provider 대칭이 아니다. OpenCode 는 `find.*`/`file.*`/`session.*` 직접 API 가 풍부하나 `[검증]`, Claude 는 disk 세션 + `continue`/`resume`/`fork` 만 제공하고 OpenCode식 `find.*`/`file.read` 직접 API 는 공식 미확인 `[미확인]`. 따라서 DirectBackendAPI 는 **공통 필수가 아니라 capability 기반 optional** 이다 — §15 probe 결과가 `false` 면 UI 가 해당 액션 버튼을 사전 비활성/숨김(사후 `capability_unsupported` 에러보다 UX 우월).

**② 예시.** OpenCode `find.files({ type:'file'|'directory', directory, limit:1–200 })` `[검증]`, `file.read` → `{ type:'raw'|'patch', content }` `[검증]`(렌더 분기는 ../frontend/rendering.md §1.6 — `raw`→FilePreviewCard / `patch`→DiffCard). `find.text/files/symbols` 는 agent tool result 일 수도, app-originated direct search(§3 AppCommandPolicy `read_only`)일 수도 있어 `origin` 배지로 구분. Claude 세션에선 이 버튼들이 숨겨진다.

**③ 현재 코드 갭.** 없음(claude 단독 — OpenCode 어댑터 도입 시 노출). §15 가 "OpenCode direct API 존재"를 *탐지*만 언급하고 타입은 본 절이 정본.

**④ 인터페이스 (정본).**

```ts
interface DirectBackendCapabilities {
  findText?: boolean
  findFiles?: boolean        // 옵션: type('file'|'directory'), directory(검색 루트 override), limit(1–200) [검증]
  findSymbols?: boolean
  fileReadRaw?: boolean      // file.read { type:'raw' }
  fileReadPatch?: boolean    // file.read { type:'patch' }
  fileStatus?: boolean
  sessionChildren?: boolean
  conversationRevert?: boolean
  conversationUnrevert?: boolean
  contextInjectionNoReply?: boolean  // session.prompt({ noReply:true }) → context-only UserMessage [검증]
  structuredOutput?: boolean         // session.prompt({ format:{ type:'json_schema', schema, retryCount? } }) [검증]
}
```

> OpenCode 측은 `[검증]`, Claude 대응(`find.*`/`file.read` 직접 API)은 공식 미확인 `[미확인]`(§13). DirectBackendAPI 노출 여부는 §15 CapabilityProbe 가 결정.

## 18. WorkspaceManager — cwd / allowed dirs / sandbox scope

**① 설명.** 작업 경로·허용 디렉토리·파일 컨텍스트·sandbox 범위를 한 곳에서 관리한다. provider 호출 직전 cwd/allowed-dirs 를 주입하고, app-originated direct file 접근(§3 AppCommandPolicy)의 경계를 정한다.

**② 예시.** "이 세션은 `~/proj` 와 그 하위만 접근" → WorkspaceManager 가 allowed dirs 게이트. Electron `sandbox:true`([security.md](./security.md) §1)와 결합해 파일 mutation 범위를 워크스페이스로 제한.

**③ 현재 코드 갭.** cwd 는 `AppSession.cwd`(§7) + `init` 이벤트(§2)로만 흐르고, allowed-dirs/file-context 정규 추상 없음. Electron `sandbox:true`(security.md §1)는 *프로세스 수준* 격리일 뿐 워크스페이스 범위 추상이 아니다.

**④ 인터페이스 (정본).**

```ts
interface WorkspaceManager {
  cwd(sessionId: string): string
  allowedDirs(sessionId: string): string[]
  isWithinScope(sessionId: string, path: string): boolean   // app-originated file 접근 게이트 (§3)
}
```

## 19. ConfigManager — Claude options ↔ OpenCode config merge

**① 설명.** provider 별 런타임 옵션 표면을 병합한다. Claude 는 `options`(model/permissionMode/cwd/env…), OpenCode 는 서버 `config`(`config.get`/`config.providers`)를 갖는다 `[검증]`. ConfigManager 는 앱 공통 설정 + provider 설정을 merge 해 어댑터에 전달. §11 `ModelProviderConfig` 가 *모델 설정 표면 노출* 이라면, ConfigManager 는 *런타임 옵션 병합* 이다(경계 구분).

**③ 현재 코드 갭.** 현행은 claude `query()` options 를 `SendChatMessage`(`src/shared/ipc.ts`)에서 직접 구성 — OpenCode config merge 표면 없음. electron-store 설정(`src/main/settings/store.ts`)과 provider config 의 병합 추상 미존재.

**④ 인터페이스 (정본).**

```ts
interface ConfigManager {
  resolve(provider: ProviderId, sessionId: string): {
    claude?: { model?: string; permissionMode?: NormalizedPermissionMode; cwd?: string; env?: Record<string, string> }
    opencode?: unknown   // config.get / config.providers 병합 결과 [검증: 표면 존재 / 미확인: 정확한 스키마]
  }
}
```

## 20. 구현 우선순위 (P0 / P1)

설계 항목의 구현 시퀀싱. **P0** = 범용 런타임의 필수 골격(권한·이벤트·세션), **P1** = 렌더링·직접 API·운영 계층. 항목은 본 문서(또는 frontend) 절로 링크.

### P0

| 항목 | 위치 |
|---|---|
| NormalizedEvent | §2 — ✅ 구현 (스테이지 B1/B1′, `claudeToNormalized`. 잔여: `provider` 축 claude 고정·OpenCode seam) |
| permission.requested 1급 이벤트 | §3 — ✅ 구현 (스테이지 B2, `agentPermissionRequest`) |
| PermissionBridge | §3 — ✅ 구현 (`InteractionBroker<ApprovalResolution>` 단일 통합. 잔여: OpenCode 이벤트형) |
| PendingApprovalStateMachine | §3 — ✅ 구현 (register/settle + `timed_out` 분기 + `onSettle`. 잔여: OpenCode 이벤트형 편입) |
| ApprovalResolution (2분기) | §3 — ✅ 구현 (`ipc.ts` allow/deny discriminated union + `protocol.ts` 스키마) |
| AppCommandPolicy (3분기) | §3 — 🔴 seam (`classifyAppCommand`, 빈 표·fallback `require_approval`. claude 단독 기능 표면 0 — slash command/OpenCode 도입 시 채움) |
| PermissionModeController | §3 — ✅ 구현 (라이브 `setPermissionMode` 위임 포함. 잔여: 풀 크로스턴 멀티세션 — Phase 4) |
| SessionCapability + CapabilityProbe | §4 / §15 — ✅ 구현 (claude 정적 probe `CLAUDE_DESCRIPTOR` + `SessionAdapter.describe()` + `backend:list` computed-on-the-fly 부착 + UI 사전 게이팅) |
| RevertManager | §5 — ✅ seam 구현 (cap-가드 4메서드, claude 전 cap false 라 throw-only) |

### P1

| 항목 | 위치 |
|---|---|
| ToolRendererRegistry | ../frontend/rendering.md §1.6 |
| DirectBackendAPI | §17 |
| TelemetryService | §8 |
| WorkspaceManager | §18 |
| ConfigManager | §19 |
| AuthStore | §9 |
| AuditLog | §10 |
| ErrorClassifier | §6 |
| 정규화 Persistence (AppMessagePart) | §7 — ✅ 구현 (message_parts + reasoning. file/diff/structured_output·blob 분리는 seam) |

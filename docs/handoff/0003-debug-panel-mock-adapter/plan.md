# Plan — 0003-debug-panel-mock-adapter

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0003-debug-panel-mock-adapter` |
| 작성자 | Claude Code |
| 일자 | 2026-06-10 |
| 매핑 | PHASES "현재 작업 중" → 보드. PR 은 본 작업 단위 1개 |
| 상태 | READY |

## Context (왜)

LLM API 없이 renderer 사이드(스트리밍·사고 블록·도구 카드·권한 승인 카드·에러 처리·컨텍스트 도넛)를 **라이브 디버깅**하기 위한 dev 전용 하네스. 사용자 확정 결정:

- **Mock 생성 레이어 = main 프로세스 MockAdapter.** 라우터의 권한 합성·DB 영속화·IPC 송신 전 경로를 그대로 타서 승인/거부 왕복(`orca:permission:respond` → `InteractionBroker`)까지 실제로 동작해야 한다. renderer 가짜 브리지는 승인 흐름이 깨져서 기각.
- **기존 Tweaks(테마/밀도/사이드바)는 새 디버그 패널 내 섹션으로 유지.**
- **트리거 = 패널에서 mock 모드 토글 + 시나리오 선택 → 채팅 전송 시 시나리오 스트리밍** (실사용 흐름과 동일).
- **컨텍스트 사용량 조정 슬라이더 포함** — 추후 "사용량 높음 → /compact 또는 핸드오프+새 세션 제안" UX 를 renderer 에서 디버깅하기 위함. 도넛/경고는 `contextTokens(t) = inputTokens + cacheRead + cacheCreation` ÷ `contextWindowFor(model)`(기본 200k) 로 계산되고 `nearCompaction` 헬퍼가 이미 있다(`features/chat/lib/{telemetry,contextWindow}.ts`) — mock telemetry 토큰 합을 ratio × 200k 로 채우면 그대로 구동.

핵심 설계 결정 4가지:

1. **ProviderId 에 'mock' 을 추가하지 않고 `'claude-code'` 로 위장.** `Backend`/`db/types.ts`/`SettingsSchema`/renderer 소비처 리플을 피하고, 와이어·DB·reducer 가 실트래픽과 100% 동형(디버그 하네스의 목적 그 자체). mock 여부는 라우터의 dev 전용 메모리 상태가 보유. DB `sessions.backend` 엔 CHECK 제약 없음(`0001_initial.sql`).
2. **MockAdapter 는 `req.requestApproval(action)` 만 호출.** 라우터의 `requestApproval` 클로저(`router.ts:284-319`)가 approvalId 발급 → `agentPermissionRequest()` 합성 → broker 대기 → 회신 해소, ask 답변 합성(`flushAskAnswers`), 세션 자동 허용(`sessionAllowedTools`), deny+interrupt→abort 까지 전부 기존 경로로 처리한다.
3. **DB 영속화는 그대로 탄다** — persist 경로 자체가 디버그 대상(세션 로드/FTS 재구성 검증). 단 mock telemetry 는 `costUsd: 0` 으로 비용 원장 오염만 차단.
4. **dev 게이트 = `import.meta.env.DEV`** (main·renderer 공통 — `app/src/main/env.d.ts` 가 이미 `vite/client` 참조라 main 에서도 타입 안전. 기존 `is.dev` 는 미패키징 빌드 전반에서 true 라 "npm run dev 한정" 요구에 부정확). 빌드타임 상수라 prod 에서 핸들러 등록·패널이 dead-code 제거된다.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 검증 가능 항목.

1. `app/src/shared/ipc.ts` 에 `CHANNELS.debugGetMock = 'orca:debug:getMock'` · `CHANNELS.debugSetMock = 'orca:debug:setMock'` + `MOCK_SCENARIO_IDS`(8종: `text_streaming`·`reasoning`·`tool_calls`·`tool_approval`·`ask_question`·`plan_review`·`error`·`full`) + `MockScenarioId` + `DebugMockState { enabled: boolean; scenarioId: MockScenarioId; contextUsageRatio: number }` 정의.
2. `app/src/shared/protocol.ts` 에 `DebugMockPatchSchema`(세 필드 모두 optional, `contextUsageRatio` 는 0~1 범위 검증) 추가.
3. `app/src/main/adapters/mock-scenarios.ts` — electron 비의존 순수 모듈. `MockStep` = `emit | delay | approval | telemetry` 4종 + `runScenario(steps, ctx): AsyncGenerator<NormalizedEvent>` 인터프리터: emit 시 `sessionId`/`provider: 'claude-code'` 주입, 매 스텝 `signal.aborted` 체크(중단 시 즉시 종료), `delay` 는 주입 가능한 `sleep`(기본 setTimeout, signal 과 race), `approval` 은 `ctx.requestApproval` await 후 allow/deny 분기(분기는 `MockStep[]` 또는 `(res: ApprovalResolution) => MockStep[]`), `requestApproval` 부재 시 자동 allow.
4. `telemetry` 스텝이 emit 하는 usage: `inputTokens + cacheReadTokens + cacheCreationTokens` 합 == `round(ctx.contextUsageRatio × 200_000)`, `costUsd: 0`, `model: 'mock-sonnet'`.
5. 시나리오 8종이 `SCENARIOS: Record<MockScenarioId, MockStep[]>` 로 정의되고, `full` 시나리오 산출 이벤트의 `type` 집합이 `NormalizedEvent` union 11종 전수와 일치한다 (`permission.requested`/`permission.resolved` 는 라우터가 합성·발행하므로 approval 스텝 존재로 갈음 — 테스트에서 fake requestApproval 경유 검증).
6. `ask_question` 시나리오에서 `tool.call.started`(toolName `'AskUserQuestion'`, args 에 questions) 가 approval 스텝보다 **선행** — 라우터 `flushAskAnswers`(`router.ts:344-348, 367-394`) 의 tool_result 합성·영속 실경로가 작동하도록.
7. `plan_review` 시나리오: allow → 실행 이벤트 / deny+message → 수정판 plan 으로 재 approval / deny+interrupt → 라우터 abort 로 generator 종료, 3분기 모두 표현.
8. `error` 시나리오: delta 수회 후 `error` 이벤트(`ClassifiedError`, `retryable: true`)로 종료하며 telemetry 미발행 (claude 실패 경로와 동형).
9. `app/src/main/adapters/mock.ts` — `MockAdapter implements SessionAdapter`(`adapters/types.ts`), `id = 'claude-code'`. `sendMessage(req)` 가 `LiveTurn` 반환: `interrupt()` 호출 시 스트림 종료, `setPermissionMode`/`setModel` 은 no-op, 새 채팅(`req.sessionId == null`) 시 `randomUUID()` 발급·resume 시 보존, 생성자 주입 `getState: () => DebugMockState` 로 scenarioId·contextUsageRatio 를 **매 턴** 읽는다.
10. `app/src/main/ipc/router.ts` — `debugMock` 메모리 상태(기본 `{ enabled: false, scenarioId: 'full', contextUsageRatio: 0.3 }`, **비영속**), `import.meta.env.DEV` 일 때만 ① MockAdapter 인스턴스화 ② debug 핸들러 2개 등록(get 은 상태 반환, set 은 `DebugMockPatchSchema.parse` 후 병합·반환). `handleChatSend` 의 어댑터 선택이 mock enabled 시 MockAdapter — **이외 라우터 경로(persist·requestApproval·flushAskAnswers·cancel·setMode)는 무변경**.
11. 라우터 `requestApproval` 클로저가 broker 해소 직후 `permission.resolved` 이벤트(`{ approvalId, resolution, sessionId? }`)를 renderer 로 send 한다 (mock/실경로 공통 — 현재 main 어디서도 미발행이라 11종 전수 재현의 유일한 공백. renderer reducer 는 기존 no-op 처리 유지).
12. preload 에 `window.orca.debug.{getMock,setMock}` 노출(상시 — prod 안전성은 main 미등록이 보장) + `app/src/renderer/src/shared/api/ipc.ts` 에 `debugApi` 래퍼 추가.
13. `shared/ui/TweaksPanel.tsx` → `shared/ui/FloatingPanel.tsx` 로 `git mv` 개명·일반화: `FloatingPanel`(title 필수 prop)·`PanelSection`·`PanelToggle`·`PanelRadio` + 신규 atom `PanelSelect`(네이티브 select 스타일링 — 시나리오 8종은 280px 세그먼트 라디오에 안 들어감)·`PanelSlider`(range input + 현재값 % 표시). `TweaksPanel.tsx` 는 삭제되고 잔존 import 0건.
14. `features/debug/` 신설(`components/DebugPanel.tsx` + `hooks/useDebugMock.ts` + `index.ts` barrel): DebugPanel 은 `FloatingPanel title="디버그"` 안에 Mock 섹션(모드 토글 + 시나리오 select + 컨텍스트 사용량 슬라이더 0~100%) + 기존 테마/레이아웃 tweaks 섹션 이식(`useTweakContext()` 그대로). useDebugMock 은 mount 시 `debugApi.getMock()` 동기화 + `setMock(patch)` 낙관적 갱신 후 main 응답으로 확정.
15. `app/OverlayLayer.tsx` — `#app-frame-debug` 슬롯 div 는 유지(DOM 마커 체계 보존, `arch/frontend/dom-architecture.md`)하고 내부를 `{import.meta.env.DEV && <DebugPanel />}` 로 교체 (기존 인라인 Tweaks 조립 제거).
16. 테스트: `mock-scenarios.test.ts`(sleep 스텁 + fake requestApproval 로 시나리오 시퀀스 단언 · allow/deny 분기 · abort 즉시 종료 · 기준 6 의 선행 순서 · 기준 5 의 11종 가드 · 기준 4 의 telemetry ratio — 0/0.95 경계 포함) + `mock.test.ts`(sessionId 발급/보존 · interrupt 종료 · requestApproval 부재 시 자동 allow). 기존 스위트(`chatReducer.*`·broker 등) **무변경** 통과.
17. 게이트 통과: `cd app && npm run lint`(boundaries 위반 0) `&& npm run typecheck && npm test`.
18. prod 게이트: `npm run build` 산출물 `out/main` 에 debug 핸들러 **등록 코드** 부재(`CHANNELS` 문자열 상수 잔존은 무방), renderer 번들에 DebugPanel 미포함.

## 범위 / 비범위

- **범위**: 위 인수 기준 1–18 (`app/**` 코드 + 테스트).
- **비범위**:
  - `docs/IPC_CONTRACT.md`(debug 도메인 §2.x 신설·총 채널 35→37·§3 `permission.resolved` 발행 주체)·`docs/arch/frontend/layers.md`(features/debug + FloatingPanel) 갱신 — **Claude 가 verify 단계에서 수행** (도메인 분리: Codex=`app/**`, Claude=`docs/**`).
  - `permission.resolved` 의 renderer 신규 처리(no-op 유지 — IPC_CONTRACT §3 계약 그대로).
  - mock 모드 영속화(의도적 비영속 — 재시작 시 OFF), 시나리오 외부 파일화, prod tree-shake 최적화 추가 작업.
  - /compact·핸드오프 제안 UX 자체 (본 작업은 그 디버깅 *수단* 만 제공).

## 설계

### 시나리오 DSL + 인터프리터 (`mock-scenarios.ts`)

이벤트 스펙은 `NormalizedEvent` 에서 `sessionId`/`provider` 를 뺀 모양(distributive omit — 인터프리터가 주입):

```ts
export type MockStep =
  | { kind: 'emit'; event: MockEventSpec }
  | { kind: 'delay'; ms: number }
  | { kind: 'telemetry' }                                  // ctx.contextUsageRatio 로 usage 산출
  | { kind: 'approval'; action: PermissionAction           // requestId 는 빈 문자열 — 라우터가 approvalId 주입(기존 규약, router.ts:295-300)
      allow: MockStep[] | ((res: ApprovalResolution) => MockStep[])
      deny:  MockStep[] | ((res: ApprovalResolution) => MockStep[]) }

export interface MockCtx {
  sessionId: string
  contextUsageRatio: number
  signal?: AbortSignal
  requestApproval?: (a: PermissionAction) => Promise<ApprovalResolution>
  sleep?: (ms: number) => Promise<void>                    // 테스트 주입용
}
```

시나리오 공통 골격: prelude `session.updated`(`patch: { model: 'mock-sonnet', cwd }`) → 본문 → `message.completed` → telemetry 스텝. `tool_approval` 시나리오 예시:

```ts
tool_approval: [
  emit({ type: 'message.delta', delta: { text: '위험 도구를 실행하겠습니다…' } }), delay(300),
  { kind: 'approval',
    action: { kind: 'tool_approval', toolName: 'Bash', input: { command: 'rm -rf /tmp/mock' } },
    allow: [
      emit({ type: 'tool.call.started', toolRunId: 'mock-bash-1', toolName: 'Bash', args: { command: 'rm -rf /tmp/mock' } }),
      delay(600),
      emit({ type: 'tool.call.completed', toolRunId: 'mock-bash-1', result: { stdout: 'ok' }, isError: false, durationMs: 600 }),
      ...closing('삭제 완료.')
    ],
    deny: [...closing('거부되어 실행하지 않았습니다.')] }
]
```

### MockAdapter (`mock.ts`)

```ts
export class MockAdapter implements SessionAdapter {
  readonly id = 'claude-code' as const
  constructor(private readonly getState: () => DebugMockState) {}
  sendMessage(req: TurnRequest): LiveTurn {
    const internal = new AbortController()                 // req.signal 과 결합해 interrupt 지원
    const st = this.getState()
    const ctx: MockCtx = {
      sessionId: req.sessionId ?? randomUUID(),            // 새 채팅이면 session.updated 가 이 id 로 sessions row 생성
      contextUsageRatio: st.contextUsageRatio,
      signal: /* req.signal + internal 결합 */,
      requestApproval: req.requestApproval
    }
    return { events: runScenario(SCENARIOS[st.scenarioId], ctx),
      setPermissionMode: async () => {}, interrupt: async () => internal.abort(), setModel: async () => {} }
  }
  // describe()/isInstalled()/install() — 스텁 (describe 는 claude-code descriptor 재사용 가능)
}
```

### 라우터 와이어링 (`router.ts` — 변경 4곳, 모두 소규모)

```ts
private readonly debugMock: DebugMockState = { enabled: false, scenarioId: 'full', contextUsageRatio: 0.3 }
private readonly mockAdapter = import.meta.env.DEV ? new MockAdapter(() => this.debugMock) : null

// register() 말미
if (import.meta.env.DEV) {
  ipcMain.handle(CHANNELS.debugGetMock, async () => ({ ...this.debugMock }))
  ipcMain.handle(CHANNELS.debugSetMock, async (_e, raw) => {
    Object.assign(this.debugMock, DebugMockPatchSchema.parse(raw))
    return { ...this.debugMock }
  })
}

// handleChatSend (현 L230) — 어댑터 선택 1줄
const adapter = this.mockAdapter && this.debugMock.enabled ? this.mockAdapter : this.registry.getActive()

// requestApproval 클로저 — broker 해소(현 L302) 직후
this.sendChatEvent(wc, { type: 'permission.resolved', provider: 'claude-code',
  sessionId: turn.dbSessionId ?? undefined, approvalId, resolution })
```

### 재사용할 기존 함수·유틸·파일

| 대상 | 경로 | 용도 |
|---|---|---|
| `SessionAdapter` / `LiveTurn` / `TurnRequest` | `app/src/main/adapters/types.ts`, `extensions/types.ts` | MockAdapter 가 구현할 계약 |
| `requestApproval` 클로저 + `InteractionBroker` | `app/src/main/ipc/router.ts:284-319`, `ask/broker.ts` | 권한 왕복 — 재구현 금지, 콜백만 호출 |
| `agentPermissionRequest` | `app/src/main/runtime-events/permission-bridge.ts` | 라우터가 이미 사용 — 무변경 |
| `NormalizedEvent` 11종 / `PermissionAction` / `ApprovalResolution` | `app/src/shared/ipc.ts` | 시나리오 이벤트 타입 정본 |
| 테스트 fixture 패턴 | `app/src/main/adapters/claude-map.test.ts`, `features/chat/reducer/chatReducer.*.test.ts` | "입력→이벤트 배열" 단언 스타일 |
| `useTweakContext` / `settingsApi` | `shared/theme/TweakProvider.tsx`, `shared/api/ipc.ts` | 기존 tweaks 섹션 이식 — 로직 무변경 |
| 기존 패널 atom | `shared/ui/TweaksPanel.tsx` (→ FloatingPanel.tsx) | 개명·일반화, 신규 작성 아님 |

### 레이어 경계 준수

`features/debug` → `shared`(ui·theme·api) ✓ · `app/OverlayLayer` → `features/debug` ✓ · 타 feature import 없음 ✓ · feature 내 IPC 는 `shared/api/ipc.ts` 래퍼 경유만(`window.orca.*` 직접 호출 금지).

## 영향 받는 파일

신규: `app/src/main/adapters/mock-scenarios.ts`(+`.test.ts`) · `app/src/main/adapters/mock.ts`(+`.test.ts`) · `app/src/renderer/src/shared/ui/FloatingPanel.tsx`(git mv) · `app/src/renderer/src/features/debug/{components/DebugPanel.tsx, hooks/useDebugMock.ts, index.ts}`

수정: `app/src/shared/ipc.ts` · `app/src/shared/protocol.ts` · `app/src/main/ipc/router.ts` · `app/src/preload/index.ts` · `app/src/renderer/src/shared/api/ipc.ts` · `app/src/renderer/src/app/OverlayLayer.tsx`

삭제: `app/src/renderer/src/shared/ui/TweaksPanel.tsx`(개명으로 대체)

## 참고 문서

- `docs/arch/backend/provider-runtime.md` §2(NormalizedEvent)·§3(PermissionBridge·ApprovalResolution 2분기)
- `docs/IPC_CONTRACT.md` §2(채널 카탈로그)·§3(variant 표)·§6(변경 절차 — 문서 갱신은 Claude verify 단계)
- `docs/arch/frontend/layers.md`(4-layer)·`dom-architecture.md`(`#app-frame-debug` 슬롯)
- `app/AGENTS.md`(작업 규칙·테스트 동반 원칙·스타일)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 인수 기준 16 (시나리오 인터프리터 = 순수 변환기, MockAdapter = 어댑터 — `app/AGENTS.md` 원칙 4 대상).
- 수동(사람/검증 단계): 인수 기준 18 + `npm run dev` 시각 검증(시나리오별 카드·plan reject 턴 중단·"세션 동안 허용" 재전송 시 카드 미표시·슬라이더 90%+ → 도넛/`nearCompaction` 경고).

---

## [Codex 기입] 구현 체크리스트

- [ ] …

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | `npm run lint` / `typecheck` / `test` |
| 게이트 결과 | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | … |

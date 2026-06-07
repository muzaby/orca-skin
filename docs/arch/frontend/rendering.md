# Frontend Architecture — Rendering (렌더링·ToolRendererRegistry·streaming)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (FRONTEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [../backend/provider-runtime.md](../backend/provider-runtime.md), [ux-domains.md](./ux-domains.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 컴포넌트 렌더링 전략

### 1.1 메시지 리스트 가상화

- **현재: 미사용.** `features/chat/components/ChatTile.tsx` 의 메시지 리스트는 일반 `messages.map(...)` 렌더링.
- 도입 임계값·라이브러리·시점 모두 **TBD**. Phase 1 mockup 단계에서는 메시지 수가 적어 문제 없음.
- Phase 3+ 로컬 DB 도입과 함께 검토 권장.

### 1.2 스트리밍 렌더링 최적화

- `message.delta` 이벤트마다 `pendingDelta` 에 누적(`chatReducer.ts`). UI 업데이트 **16ms throttle 구현 완료** — `features/chat/lib/eventCoalescer.ts` 가 델타(message.delta·message.reasoning.delta)를 `requestAnimationFrame` 한 틱마다 모아 한꺼번에 dispatch 하고, React 19 자동 배칭이 그 틱의 N개 dispatch 를 1렌더로 묶는다(프레임당 1렌더, reducer 무변경). 비-델타 이벤트(message.completed·tool.call.*·telemetry)는 버퍼를 먼저 flush 한 뒤 emit 해 순서를 보존(§1.7 Option B). `useChat` 구독부가 코얼레서를 생성·주입하고 세션 전환(newChat/loadSession)·언마운트 시 `dispose()` 로 스테일 델타를 폐기한다.
- **정정(2026-06, 코드가 진실)**: 마크다운 파싱은 스트리밍 *중에도* 라이브로 수행한다 — `PendingAssistant` 가 `pendingDelta` 를 `<Markdown>` 으로 렌더(과거 "스트리밍 중 plain text" 서술은 구현과 불일치라 폐기). 코드 블록 하이라이팅(shiki)은 ToolCard 첫 오픈까지 지연(비용 회피).
- `message.completed` 도착 시 `pendingDelta` 를 `text` 파트로 commit 하고 비운다(provider-runtime.md §7).

### 1.3 마크다운 + 코드 블록

| 항목 | 구현 |
|---|---|
| Markdown 렌더러 | `features/chat/components/markdown/Markdown.tsx` — react-markdown + remarkGfm. h1~h4, p, a, ul/ol, blockquote, table, code 각각 커스터마이즈. |
| 이미지 정책 | **data-uri 만 허용** (보안). 외부 URL 차단. |
| 링크 정책 | 외부 링크 클릭은 `shell.openExternal` 경유 (Main 측에서 처리). target=_blank rel=noopener noreferrer 표시. |
| 코드 블록 | `features/chat/components/markdown/CodeBlock.tsx` — shiki 싱글톤 비동기 로드. 지원 언어 11종 (typescript / tsx / javascript / jsx / python / bash / json / yaml / html / css / markdown). 테마 3종 (github-light / github-dark / one-light). |
| 테마 추적 | `document.documentElement.dataset.theme` 의 MutationObserver. data-theme 변경 시 코드 블록 자동 재렌더링. |
| 로딩 fallback | shiki 로드 전엔 plain `<pre>` 표시. 로드 완료 후 HTML replace. |
| 복사 버튼 | named group (`group/codeblock` + `group-hover/codeblock:opacity-100`) 으로 hover 범위 자기 자신으로 한정. (`app/CLAUDE.md` 의 named group 규칙 참조.) |

### 1.4 마크다운 보안

- HTML 렌더링: react-markdown 의 기본값 (raw HTML 비활성) 유지.
- 이미지: data-uri 만 허용 (위 §1.3).
- 외부 URL 자동 차단: `will-navigate` (Main) + `setWindowOpenHandler` (Main).

### 1.5 Custom Titlebar / 윈도우 컨트롤 (Phase 3+)

- BrowserWindow: `frame: false` + macOS `titleBarStyle: 'hidden'` + `trafficLightPosition: { x: 12, y: 10 }` (`app/src/main/index.ts`).
- `data-platform` 부착: App boot effect 에서 `documentElement.dataset.platform = window.orca.platform` 1회 (preload 가 sync 노출).
- IPC: `window.orca.window.{minimize,maximize,close}()` 3개 (IPC_CONTRACT §2.8).
- macOS 분기: `WinControls` 가 `window.orca.platform === 'darwin'` 일 때 `null` 반환 — OS traffic light 가 그린다. 헤더 좌측 패딩 80px 로 traffic light 영역 회피.
- drag 영역: `[-webkit-app-region:drag]` inline 클래스 대신 `style={{ WebkitAppRegion: 'drag' }}` (dom-architecture.md.3 의 2-layer 패턴).
- **header-left 내용물 (Phase 3++)**: 액션 5-버튼 툴바 — `menu` (시스템 메뉴 popover · 자식 `종료` → `windowApi.close()`) · `panelL` (사이드바 접기 토글 · `setTweak('sidebarCollapsed', !current)`) · `search` (대화 검색 모달 열기 — `SearchModal`) · `arrowL` / `arrowR` (`navigate(-1)` / `navigate(1)` 항상 enabled, 추적 없음). 모든 버튼은 `data-behavior="no-drag"` 영역 안. 기존 brand + breadcrumb 표시는 제거 (브랜드는 Sidebar 의 `app-frame-sidebar-brand` 로 이동).

### 1.6 ToolRendererRegistry (설계 확정 / 구현 대기)

> **상태**: 📐 설계 확정 · 구현 대기. 정본 타입(`NormalizedEvent`/`AppMessagePart`)은 [../backend/provider-runtime.md](../backend/provider-runtime.md) 가 소유 — 본 절은 *렌더링 계약*만 정의(참조).

**① 설명.** 렌더러는 **이벤트 타입이 아니라 의미(semantic kind)** 로 카드를 선택한다. 같은 `tool.call.completed` 라도 결과 형태에 따라 다른 카드로 분기한다. 예: ../backend/provider-runtime.md §7 의 `file` part 가 `readType:'raw'` 면 `FilePreviewCard`, `'patch'` 면 `DiffCard`.

**② 예시.** OpenCode `file.read` → `{ type:'raw'|'patch', content }` `[검증]`. `selectFileRenderer(read) = read.type==='patch' ? 'diff' : 'file_preview'`. `find.text/files/symbols` 는 agent tool result 일 수도, app-originated direct search(../backend/provider-runtime.md §17 DirectBackendAPI)일 수도 있어 둘 다 `SearchCard` 로 가되 `origin` 배지를 표시.

**③ 현재 코드.** ✅ **표준화 완료** — `features/chat/components/transcript/registry.ts` 의 `RenderableKind` 가 정본 taxonomy(`terminal·file_preview·diff·search·approval·agent_task·session_graph·context_injection·structured_output·error·telemetry`) + 실용 fallback `generic` + AskUserQuestion 컴팩트 본문용 `ask`(비정본)로 정렬됐다. `match`/`resolve` 는 도구 이름이 아니라 **`ToolCall`(= tool_call+tool_result 파트 페어의 렌더 view)** 를 받아 result shape 까지 검사 가능(§1.6 "의미로 분류"). 본 레지스트리는 *도구 본문* 만 다루므로 `terminal`(Bash/PowerShell)·`file_preview`(Read)·`diff`(Write/Edit/MultiEdit)·`ask`·`generic` 만 등록한다. `search`·`agent_task`·`session_graph`·`context_injection`·`approval`(별도 `ApprovalCard`)·`telemetry`(§1.9)는 OpenCode/별도 표면 전용이라 미등록 seam. 매칭은 순수 함수라 단위 테스트 대상.

**③′ 콘텐츠 순서 보존 렌더 (AssistantMessage).** `AssistantMessage` 는 더 이상 파트를 타입별로 뭉쳐(reasoning→도구그룹→텍스트…) 고정 순서로 렌더하지 않는다. `lib/parts.ts` 의 `messageSegments(parts)` 가 parts 를 **만나는 순서대로** "연속 동종" 으로 묶은 `MessageSegment[]`(`reasoning`/`tools`/`ask`/`text`/`structured`/`error`)로 투영하고, `AssistantMessage` 는 그 배열을 순서대로 기존 컴포넌트(`ReasoningBlock`/`ToolGroup`/`AskExchange`/`Markdown`/`StructuredOutputCard`/`ErrorCard`)에 1:1 매핑한다 → 모델이 말한 "텍스트 → 도구 → 텍스트" 흐름이 화면에 그대로 보인다. 단일 도구는 `ToolGroup` 이 헤더 없이 `ToolCard` 만, 연속 병렬 도구만 그룹으로 묶는다. **sub-agent(Task/Agent)는 별도 처리 없이 `tools` 세그먼트의 일반 도구 카드로 순서 안에 끼어 렌더된다(자동 충족).** 영속된 `error`/`structured_output` 파트가 로드 세션에서 안 보이던 갭도 이 디스패치로 메웠다. 이 순서 보존의 백엔드 짝은 `claude-map` 이 assistant content 블록을 **순서 그대로 emit**(텍스트 말미 합치기 폐기, provider-runtime.md §2)하는 것이다.

**④ 인터페이스 (렌더링 계약).**

```ts
type RenderableKind =
  | 'terminal' | 'file_preview' | 'diff' | 'search'
  | 'approval' | 'agent_task' | 'session_graph'
  | 'context_injection' | 'structured_output' | 'error' | 'telemetry'

interface ToolRenderer<P = unknown> {
  kind: RenderableKind
  match(input: NormalizedEvent | AppMessagePart): boolean   // 정본 타입: ../backend/provider-runtime.md §2 / ../backend/provider-runtime.md §7
  toProps(input: NormalizedEvent | AppMessagePart): P
}
interface ToolRendererRegistry { register(r: ToolRenderer): void; resolve(input: NormalizedEvent | AppMessagePart): ToolRenderer | undefined }
```

| Renderer | 대상 | 현행 대응 |
|---|---|---|
| `TerminalCard`(`terminal`) | shell/command 실행 | ✅ `BashBody` |
| `FilePreviewCard`(`file_preview`) | `file.read` `raw`, Read | ✅ `FileBody` |
| `DiffCard`(`diff`) | `file.read` `patch`, edit/write | ✅ `DiffBody` |
| `SearchCard`(`search`) | `find.*`, grep/glob | 🔴 seam (OpenCode 전용 소스) |
| `ApprovalCard`(`approval`) | `permission.requested` | ✅ `ApprovalCard`(plan_review + tool_approval, 레지스트리 밖) — ux-domains.md §1.6 |
| `AgentTaskCard` / `SessionGraphCard` / `ContextInjectionCard` | subagent / `children`·`fork`·`revert` / `noReply` | 🔴 seam (OpenCode 전용) |
| `StructuredOutputCard`(`structured_output`) | `format:json_schema` 결과 | ⏳ 최소 구현(`StructuredOutputCard` — value→pretty JSON. claude 미와이어라 소스 없음) — §1.7 |
| `ErrorCard`(`error`) | error 파트 | ✅ `ErrorCard`(트랜스크립트 인라인) + `state.error` 배너(라이브 턴) |
| `TelemetryPanel`(`telemetry`) | usage·cost·latency | ✅ `TelemetryPanel`(cost·model·latency·토큰 분해) — Composer usage 도넛 트리거 Popover, §1.9 |

### 1.7 StructuredOutput 렌더링 (설계 확정 / 구현 대기)

**① 설명.** OpenCode `session.prompt({ format: { type:'json_schema', schema, retryCount? } })` 와 실패 시 `result.data.info.error`(`StructuredOutputError`)를 UI 상태로 정규화 `[검증]`. Claude 측 형식은 `[미확인]`(../backend/provider-runtime.md §13) — 동일 상태로 흡수 가능한지 구현 전 확인.

**③ 현재 코드 갭.** structured_output 은 최소 구현(`StructuredOutputCard`, claude 소스 없음 — §1.6). reasoning 은 **라이브 스트리밍 구현됨** — `message.reasoning.delta`(claude `thinking_delta`) → `pendingReasoning` → `PendingAssistant` 가 펼친 `ReasoningBlock` 프리뷰로 표시, 완성 시 `message.reasoning` 이 영속 reasoning 파트(접이식)로 대체. 런타임이 `thinking_delta` 를 안 흘리면 완성 블록만 표시(graceful).

**④ 인터페이스.**

```ts
type StructuredOutputState =
  | { status: 'valid'; value: unknown; schema: unknown }
  | { status: 'invalid'; error: unknown; raw?: string }
  | { status: 'retrying'; attempt: number; maxRetries: number }
```

`StructuredOutputCard` 는 `valid`=트리/접기 뷰, `invalid`=raw + 검증오류, `retrying`=진행 표시.

### 1.8 Streaming lifecycle & backpressure (설계 확정 / 구현 대기)

**① 설명.** OpenCode SSE 와 Claude async iterator 를 단일 lifecycle 로 정규화: `open → streaming → (reconnect)* → closed`. partial 재조립 / 중복 dedup(eventId) / 순서 보장(monotonic seq) / 긴 tool 출력 버퍼링·절단.

**③ 현재 코드 갭.** 현행은 §1.2 의 16ms throttle + `assistant_delta` 누적만. dedup/재연결/절단 정책 없음(`orca:chat:event` 가 ordered+lossless 1채널이라 단일 세션에선 충분).

**④ 인터페이스.**

```ts
type StreamLifecycleState = 'open' | 'streaming' | 'reconnecting' | 'closed' | 'errored'
interface StreamBufferPolicy { maxBytesPerToolRun: number; truncateStrategy: 'head'|'middle'|'tail'; preserveLastLines: number }
interface ReconnectPolicy { maxRetries: number; backoffMs: (attempt: number) => number; resumeFrom?: 'last_seq' | 'restart' }
```

- `TerminalCard` stdout/stderr 는 `maxBytesPerToolRun` 으로 캡 → 초과 시 `truncated:true` props 로 "잘림" 표시.
- SSE 재연결 시 마지막 `seq` 까지 dedup. Claude iterator 는 재연결 개념 없음 → `resumeFrom:'restart'` + 쿼리 재실행 정책 별도.
- auto-scroll pin **구현 완료** (`ChatTile.tsx`): 스크롤 컨테이너가 맨 아래(`scrollHeight-scrollTop-clientHeight < 24px`)에 붙어 있을 때만 스트리밍을 따라 내려간다(로그 뷰어 패턴). 사용자가 위로 스크롤하면 `pinnedRef` 해제 → 과거 대화 고정. 단, 새 user 메시지(사용자 전송)는 항상 따라 내려가며 재-pin. pin 해제 상태에선 컴포저 기준 상단·가로 중앙(`Composer.tsx` 의 `absolute bottom-full left-1/2`)에 **"맨 아래로" 버튼**(`chevD` 아이콘)을 띄워 클릭 시 재-pin. 버튼 props 는 optional — transcript 가 없는 랜딩(NewChat/Project)엔 미전달.

### 1.9 TelemetryPanel (구현 완료)

**① 설명.** provider-reported(token/cost/model) + app-measured(latency) 를 패널로. 정본 타입: ../backend/provider-runtime.md §8.

**② 구현.** `features/chat/components/TelemetryPanel.tsx` — 턴 종료 `telemetry` 이벤트가 실은 `ProviderReportedTelemetry`(cost·model·modelUsage·input/output·캐시 토큰·durationMs·numTurns)와 reducer 가 산출한 app-measured latency(`lastTurnLatencyMs` = 전송→telemetry 벽시계) + 세션 누적 비용(`sessionCostUsd`, SDK 가 세션 합계 미제공이라 턴마다 누산 — cost-tracking.md §147)을 행으로 표시. 값 없는 행은 생략. Composer 풋터의 usage 도넛(`UsageCircle`)을 클릭 트리거로 삼아 `shared/ui/Popover.tsx` 안에 띄운다(`state.lastTelemetry` 없으면 도넛만 — 현행 graceful). 모든 값은 추정치(청구 권위 아님).

**③ (해소) 과거 갭.** 구 `UsageCircle` 는 `pendingInputTokens / 200_000` 비율 도넛만 표시했고 cost·model·latency 가 없었다 — 본 패널로 보강.

---


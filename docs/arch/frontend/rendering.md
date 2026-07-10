# Frontend Architecture — Rendering (렌더링·ToolRendererRegistry·streaming)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-07-10 (handoff 0094 — §1.9 UsagePanel(0079~0082)·라이브 reasoning StreamingMarkdown(0093) 동기화)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [../backend/provider-runtime.md](../backend/provider-runtime.md), [ux-domains.md](./ux-domains.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 컴포넌트 렌더링 전략

### 1.1 메시지 리스트 가상화

- **현재: 미사용.** `features/chat/components/ChatTile.tsx` 의 메시지 리스트는 일반 `messages.map(...)` 렌더링.
- 도입 임계값·라이브러리·시점 모두 **TBD**. Phase 1 mockup 단계에서는 메시지 수가 적어 문제 없음.
- Phase 3+ 로컬 DB 도입과 함께 검토 권장.

### 1.2 스트리밍 렌더링 최적화 (0008 재설계)

- **델타 경로는 reducer 를 우회한다.** `features/chat/lib/eventCoalescer.ts` 가 델타(message.delta·message.reasoning.delta)를 rAF 한 틱마다 모아 `chatStore.receive` 로 비우고(비-델타는 버퍼 선-flush 로 순서 보존, §1.7 Option B), receive 는 델타를 Zustand `live` 슬라이스(`{text, reasoning}`)에만 누적한다 — 커밋 슬라이스(`session`) identity 불변. 결과: **델타 프레임의 재렌더는 live 를 구독하는 라이브 리프뿐** — text 델타 → `LiveText`(+`LiveStatus` 토큰 근사), reasoning 델타 → `LiveReasoning`(`ReasoningBlock streaming` → `StreamingMarkdown` 경유 — 델타 프레임당 전문 재파스 없이 꼬리만 재파스, 0093). transcript(커밋 메시지)·Composer·셸·호스트는 깨어나지 않는다(state.md §1.4).
- **라이브 마크다운은 꼬리 블록만 재파스** — `StreamingMarkdown` 이 누적 소스를 `lib/markdownBlocks.ts` 의 `splitStableBlocks` 로 "확정 블록들 + 꼬리"로 분할, 확정 블록은 memo 된 `<Markdown>`(string shallow)으로 고정하고 꼬리만 매 델타 unified 재파스한다(프레임당 O(전문)→O(꼬리)). 분할 경계는 보수적(펜스/loose list/들여쓰기 코드 비분할, 완결 줄 뒤만 확정 = append-stable). 코드 블록 하이라이팅(shiki)은 ToolCard 첫 오픈까지 지연(비용 회피).
- **커밋 경로는 카드 단위로 격리** — `message.completed`(완성본 text 파트 커밋)·`tool.call.*` 는 reducer 커밋으로 마지막 message identity 만 교체하고, `AssistantMessage` 가 `reconcileSegments`(lib/parts.ts) 로 직전 렌더와 대조해 내용 미변경 세그먼트/ToolCall view 의 identity 를 재사용한다 → memo 된 `ToolGroup`/`ToolCard`/`ReasoningBlock`/`Markdown` 이 shallow 로 bail — **tool.call.completed 1건 = 결과가 도착한 ToolCard 1개 재렌더**. `message.completed` 없이 끝난 턴의 잔여 live.text 는 telemetry 시점에 `COMMIT_PENDING_TEXT` 폴백으로 굳힌다(error/cancel 은 폐기 — 기존 동작 동형).

### 1.3 마크다운 + 코드 블록

| 항목 | 구현 |
|---|---|
| Markdown 렌더러 | `shared/ui/markdown/Markdown.tsx` — react-markdown + remarkGfm. h1~h4, p, a, ul/ol, blockquote, table, code 각각 커스터마이즈. (`features/chat/components/markdown/` 에는 `StreamingMarkdown` 만 잔류) |
| 이미지 정책 | **data-uri 만 허용** (보안). 외부 URL 차단. |
| 링크 정책 | 외부 링크 클릭은 `shell.openExternal` 경유 (Main 측에서 처리). target=_blank rel=noopener noreferrer 표시. |
| 코드 블록 | `shared/ui/markdown/CodeBlock.tsx` — shiki 싱글톤 비동기 로드. 지원 언어 11종 (typescript / tsx / javascript / jsx / python / bash / json / yaml / html / css / markdown). shiki 테마 3종 (github-light / github-dark / one-light — 앱 테마 2종(white/dark)과 별개). |
| 테마 추적 | `document.documentElement.dataset.theme` 의 MutationObserver. data-theme 변경 시 코드 블록 자동 재렌더링. |
| 로딩 fallback | shiki 로드 전엔 plain `<pre>` 표시. 로드 완료 후 HTML replace. |
| 복사 버튼 | named group (`group/codeblock` + `group-hover/codeblock:opacity-100`) 으로 hover 범위 자기 자신으로 한정. (`app/AGENTS.md` 의 named group 규칙 참조.) |

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
| `UsagePanel`(`telemetry`) | usage·한도 | ✅ `UsagePanel`(구 TelemetryPanel — 컨텍스트 프로그레스바 + 주간/월간 한도 바, 0079~0082) — Composer usage 도넛 트리거 Popover, §1.9 |

### 1.7 StructuredOutput 렌더링 (설계 확정 / 구현 대기)

**① 설명.** OpenCode `session.prompt({ format: { type:'json_schema', schema, retryCount? } })` 와 실패 시 `result.data.info.error`(`StructuredOutputError`)를 UI 상태로 정규화 `[검증]`. Claude 측 형식은 `[미확인]`(../backend/provider-runtime.md §13) — 동일 상태로 흡수 가능한지 구현 전 확인.

**③ 현재 코드 갭.** structured_output 은 최소 구현(`StructuredOutputCard`, claude 소스 없음 — §1.6). reasoning 은 **라이브 스트리밍 구현됨** — `message.reasoning.delta`(claude `thinking_delta`) → live 슬라이스 `live.reasoning` 누적 → `PendingAssistant` 의 `LiveReasoning` 이 펼친 `ReasoningBlock`(`streaming` prop → `StreamingMarkdown`, 0093) 프리뷰로 표시, 완성 시 `message.reasoning` 이 영속 reasoning 파트(접이식)로 대체. 런타임이 `thinking_delta` 를 안 흘리면 완성 블록만 표시(graceful).

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
- auto-scroll pin **구현 완료** (`hooks/useScrollAnchor.ts`, 0008 이전): 스크롤 컨테이너가 맨 아래(`scrollHeight-scrollTop-clientHeight < 24px`)에 붙어 있을 때만 스트리밍을 따라 내려간다(로그 뷰어 패턴). 사용자가 위로 스크롤하면 `pinnedRef` 해제 → 과거 대화 고정. pin 해제 상태에선 컴포저 기준 상단·가로 중앙(`Composer.tsx` 의 `absolute bottom-full left-1/2`)에 **"맨 아래로" 버튼**(`chevD` 아이콘)을 띄워 클릭 시 재-pin. 버튼 props 는 optional — transcript 가 없는 랜딩(NewChat/Project)엔 미전달. 바닥 추적은 콘텐츠 wrapper(ReadingColumn) **ResizeObserver**(`pinned && inflight` 게이트)가 수행 — idle 중 성장(ToolCard 펼침·shiki 교체)엔 no-op 으로 네이티브 scroll anchoring 과 싸우지 않는다(컨테이너는 `[overflow-anchor:none]` 으로 자체 제어).
- **새 user 메시지 50% 미드라인 앵커 — CSS 예약공간 방식 (0008 재설계, 구 JS spacer 폐기)**: transcript 를 **교환(Exchange — user 턴 + 후속 assistant 턴들, `lib/turns.ts groupExchanges`)** 단위 wrapper 로 렌더하고, 스크롤 컨테이너를 `[container-type:size]` size container 로 둔 뒤 **라이브 전송으로 생긴 마지막 교환에만 `min-h-[50cqh]`** 를 준다. 스크롤 바닥 = 교환 top 이 정확히 미드라인(cqh 는 content-box 기준이라 py-5 패딩과 수학이 맞음). 전송 시 `useScrollAnchor` 가 `scrollTo({top: scrollHeight, behavior:'smooth'})` 1회 — min-height 가 같은 커밋의 레이아웃에 이미 반영돼 측정/2단 rAF 핵이 불필요하다.
  - **fill 단계 레이아웃 JS = 0**: 답변이 예약공간 내부를 채우는 동안 `scrollHeight` 불변 → 스크롤 이벤트/측정/보정 전무, 버블은 미드라인에 정지. 예약을 초과하면 scrollHeight 가 자라며 pin-follow(RO)가 이어받는다. Composer 성장/윈도 리사이즈는 cqh 가 CSS 로 자동 추종.
  - **회수 정책 = 다음 메시지까지 유지 (사용자 결정 2026-06-11)**: 턴 완료 후 짧은 답변의 잔여 여백은 회수하지 않는다(보이는 중 제거 = 콘텐츠가 여백만큼 내려오는 움직임이 기하학적으로 불가피). 다음 전송에서 이전 교환이 "마지막"에서 벗어나며 같은 레이아웃 flush 의 새 예약+앵커 스크롤에 가려 **무점프 해제**된다.
  - **앵커 트리거 = reducer `sendCount`**(SEND 마다 단조 증가): 메시지 배열 휴리스틱(로드된 세션의 마지막 user 메시지 오탐) 없이 라이브 전송만 정확히 감지. **세션 전환 판정 = sessionId 변화 ∧ messages 교체 동시** — `session.updated` 의 null→id 발급은 messages 를 안 건드리므로 턴 중 예약이 풀리지 않고, 로드/캐시 복원/NEW_CHAT 은 예약 해제 + 즉시 바닥 점프(옛 세션 하단에 여백이 남지 않음).
  - smooth 앵커 진행 중 "맨 아래로" 버튼 깜빡임은 프로그래매틱 플래그 + `scrollend` 로 억제. 교환 wrapper 는 재부모화가 없어(경계 영원 안정) ToolCard 열림·shiki 상태가 보존된다.

### 1.9 컨텍스트 사용량 도넛/패널 (구현 완료)

**① 설명.** Composer 풋터 usage 도넛 = **마지막 턴 컨텍스트 비율**. 클릭 시 패널에 컨텍스트 4항목.

**② 구현.** 도넛/패널은 **`state.lastTelemetry` 단일 소스로 구동**한다(`pendingInputTokens` 폐기). 컨텍스트 사용량 토큰 = `contextTokens = input + cacheRead + cacheCreation`(**출력 제외**, `features/chat/lib/telemetry.ts`) = **`/context` 상단 분자와 같은 정의**(전체 컨텍스트 점유). 도넛 비율 = `contextTokens / contextWindowFor(model)`. 윈도우는 **기본 200k, 모델명에 `'1m'` 포함 시 1M**(`features/chat/lib/contextWindow.ts` — 정적 맵/env 불필요). 패널 컴포넌트는 **`UsagePanel.tsx`**(0079 에서 `TelemetryPanel.tsx` 대체): **컨텍스트 창 프로그레스바(`Meter`, `used / window (pct%)`) + 구분선 + 주간/월간 사용량 한도 바 + 우측 `>` 버튼(설정 사용량 탭 이동)**. 구 신규입력/캐시읽기/캐시생성 분해 행은 제거됐다(0079 AC4). 한도 바는 실사용 SSOT(costStore)와 월 한도(`spendingLimitUsd`·provider 한도)를 `computeUsageLimits`(`src/shared/usage/limits.ts` — 공용 파생 SSOT)로 파생만 한다. `state.lastTelemetry` 없으면 컨텍스트 섹션 미표시, cost summary 미도착이면 한도 섹션 숨김.

- **컨텍스트 입력 = 마지막 assistant 스냅샷 (`/context` 근사 교정)**: 도넛/패널의 컨텍스트 입력 3종(input·cacheRead·cacheCreation)은 **그 턴 *마지막* assistant 메시지의 `usage`** 다(턴 누적 아님). 매퍼(`claude-map.ts`)가 `result.usage`(멀티스텝에서 단계별 입력이 합산돼 과대 집계) 대신 `ctx.lastAssistantUsage` 로 덮어 `/context` 상단 %("모델이 마지막으로 본 입력 / 윈도우")와 같은 정의로 근사한다. **스냅샷에 있는 필드만 덮는다** — 없는 필드는 `result.usage` 값을 보존한다(스냅샷이 `input` 만 주고 `cache_read` 를 안 줄 때 `delete` 하면 `contextTokens` 가 input(≈1)으로 붕괴 → 도넛 0~1%; field-merge 로 방지). **비용(`costUsd`)·지연·`numTurns`·`modelUsage`·`model` 은 result 누적값 유지**(비용은 턴 전체 합이 맞음). `/context` 와 100% 일치는 불가(클라이언트가 모든 입력 구성요소를 보지 못함) — *근사*가 목표.
- **컨텍스트 0 턴은 도넛 소스 미갱신 (`/context` 등 로컬 슬래시 명령)**: `/context`·`/help` 등은 모델을 호출하지 않아 컨텍스트(=비용)가 없는 빈 telemetry 를 만든다. 이 빈 값이 직전 도넛을 0 으로 덮지 않게 두 지점에서 가드: ① **라이브** — reducer `telemetry` case 가 `contextTokens(telemetry) > 0` 일 때만 `lastTelemetry` 교체(턴 종료 `inflight:false` 등은 그대로). ② **복원** — main `router.ts` 가 `hasContextTokens(usage)`(`usage/usageMap.ts`) 일 때만 `usage_events` 적재 → 빈 행이 최신 행으로 복원돼 0 으로 덮는 일 방지(`getLatestUsage` 단순 최신행 쿼리 유지).
- **compaction 임박 경고**: `nearCompaction(used, window)`(`contextWindow.ts`) = `used ≥ (window - AUTOCOMPACT_BUFFER) * 0.835`. `AUTOCOMPACT_BUFFER`(~33k)는 CLI 버전·`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 에 따라 가변인 *추정값*. true 면 도넛 progress arc 가 경고색(`--color-warn`, `UsageCircle.warn` prop), title 에 "컨텍스트 한계 임박", 패널에 "곧 컨텍스트 정리(compaction)" 경고 행(추정값 캡션 포함).

**③ 세션 영속 + 비용 원장 (구현 완료).** 과거엔 메모리 전용이라 `SEND`/세션 전환/재시작 시 도넛이 사라졌다. 이제 턴 종료마다 **per-turn `usage_events` 원장**(`0005_usage_events.sql` — `session_id`(세션 삭제 시 `SET NULL`)·`model`·`created_at`·input/output/cache 토큰·`cost_usd`)에 1행 적재(`insertUsageEvent`). 세션 로드 시 **최신 행에서 `lastTelemetry` 재구성**(`getLatestUsage` + main `usage/usageMap.ts` `usageRowToTelemetry`) → `LoadedSession.lastTelemetry` 로 복원(reducer `LOAD_SESSION`/`LOAD_SESSION_FROM_CACHE`, 메모리 캐시 `CachedSession` 도 포함). `SEND` 는 `lastTelemetry` 를 비우지 않아 턴 진행 중에도 유지 → 컨텍스트는 세션 수명(새 대화에서만 0) 동안 항상 표시. **비용/지연/모델 행은 패널에서 제거** — 비용은 원장이 SSOT 이며 시간(`created_at`)·모델별 집계로 1일/주/월 사용량을 산출(추후 usage 화면; 스키마만 준비). `sessionCostUsd`/`lastTurnLatencyMs` state 필드 폐기.

**⑤ 빈 reasoning 카드 스킵 (구현 완료).** 빈/공백 "사고 과정" 카드가 뜨던 문제 해소 — `claude-map`(빈 `thinking` emit 안 함)·`messageSegments`(빈 reasoning 파트 스킵)·`ReasoningBlock`(합친 텍스트 공백이면 `null`) 3층 가드. 라이브 경로 `PendingAssistant` 는 기존 `{pendingReasoning && …}` 로 이미 가드됨.

---


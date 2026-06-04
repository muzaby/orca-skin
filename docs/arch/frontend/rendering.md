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

- `assistant_delta` 이벤트마다 `pendingDelta` 에 누적. UI 업데이트는 **16ms throttle** (60Hz 리렌더 상한).
- 마크다운 파싱은 `pendingDelta` 가 메시지로 commit 되는 시점 (`assistant_message`) 에 1회만 — 스트리밍 중에는 plain text.
- 코드 블록 하이라이팅도 동일하게 지연 (shiki async 로드).

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

**② 예시.** OpenCode `file.read` → `{ type:'raw'|'patch', content }` `[검증]`. `selectFileRenderer(read) = read.type==='patch' ? 'diff' : 'file_preview'`. `find.text/files/symbols` 는 agent tool result 일 수도, app-originated direct search 일 수도 있어 둘 다 `SearchCard` 로 가되 `origin` 배지를 표시.

**③ 현재 코드 갭.** 현행은 **registry 없음** — `features/chat/components/transcript/ToolCard.tsx` 가 tool **이름** 으로 switch-case 분기(Bash/PowerShell→`BashBody`, Write/Edit/MultiEdit→`DiffBody`, Read→`FileBody`, AskUserQuestion→`AskBody`, default→`KeyValueBody`). semantic kind 추상·plugin 등록 패턴 없음.

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
| `TerminalCard` | shell/command 실행 | `BashBody` |
| `FilePreviewCard` | `file.read` `raw` | `FileBody` |
| `DiffCard` | `file.read` `patch`, edit/write | `DiffBody` |
| `SearchCard` | `find.*`, grep/glob | (없음) |
| `ApprovalCard` | `permission.requested` | `PlanApprovalCard`(plan 한정) — ux-domains.md §1.6 |
| `AgentTaskCard` / `SessionGraphCard` / `ContextInjectionCard` | subagent / `children`·`fork`·`revert` / `noReply` | (없음) |
| `StructuredOutputCard` | `format:json_schema` 결과 | (없음) — §1.7 |
| `ErrorCard` / `TelemetryPanel` | error / usage·cost | `state.error` 카드 / `UsageCircle`(비율만) — §1.9 |

### 1.7 StructuredOutput 렌더링 (설계 확정 / 구현 대기)

**① 설명.** OpenCode `session.prompt({ format: { type:'json_schema', schema, retryCount? } })` 와 실패 시 `result.data.info.error`(`StructuredOutputError`)를 UI 상태로 정규화 `[검증]`. Claude 측 형식은 `[미확인]`(../backend/provider-runtime.md §13) — 동일 상태로 흡수 가능한지 구현 전 확인.

**③ 현재 코드 갭.** 미구현. reasoning/thinking 블록 전용 렌더도 없음(현재 일반 텍스트로 스트리밍).

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
- auto-scroll 은 사용자가 위로 스크롤하면 pin 해제(로그 뷰어 패턴).

### 1.9 TelemetryPanel (설계 확정 / 구현 대기)

**① 설명.** provider-reported(token/cost/model) + app-measured(latency/duration/event count) 를 패널로. 정본 타입: ../backend/provider-runtime.md §8.

**③ 현재 코드 갭.** 현행 `shared/ui/UsageCircle.tsx` 가 `state.pendingInputTokens / 200_000` 비율 도넛만 표시. cost·model·latency·세션별 통계 없음.

---


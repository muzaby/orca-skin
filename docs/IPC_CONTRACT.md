# IPC Contract

> 이 문서는 Main ↔ Renderer 간 IPC 채널의 **단일 진실 공급원 (SSOT)** 이다.
> 채널을 추가/변경할 때는 코드와 이 문서를 함께 갱신한다.
> 최종 업데이트: 2026-06-10
> 관련 문서: [ARCHITECTURE.md](ARCHITECTURE.md), [ARCHITECTURE.md](ARCHITECTURE.md), [GLOSSARY.md](./GLOSSARY.md), [TRD.md](./TRD.md) §5

## 1. 명명 규칙

- 형식: `orca:<domain>:<action>` — 소문자 + 콜론 구분
- 도메인 (15개): `chat`, `backend`, `install`, `settings`, `skills`, `files`, `session`, `project`, `window`, `search`, `mcp`, `runtime`, `cost`, `permission`, `debug`(dev 전용)
- 방향:
  - Renderer → Main 요청: `ipcMain.handle` + `ipcRenderer.invoke` (Promise 반환)
  - Main → Renderer 이벤트: `webContents.send` + `ipcRenderer.on` (단방향 push)
- preload 노출: `window.orca.<domain>.<action>(...)` 형태 (`app/src/preload/index.ts`)
- 채널 상수: `app/src/shared/ipc.ts` 의 `CHANNELS` 객체. 문자열 리터럴 직접 사용 금지.
- 입력 검증: 모든 `ipcMain.handle` 핸들러는 **zod 스키마 (`app/src/shared/protocol.ts`)** 로 페이로드 검증. 검증 실패 시 에러 throw.

## 2. 채널 카탈로그 (총 38 채널)

도메인별 분포: `chat` 3 · `backend` 1 · `install` 2 · `settings` 2 · `skills` 1 · `files` 1 · `session` 6 · `project` 5 · `window` 3 · `search` 1 · `mcp` 4 · `runtime` 3 · `cost` 2 · `permission` 2 (`respond` · `setMode`) · `debug` 2 (dev 전용 — `getMock` · `setMock`).

`app/src/shared/ipc.ts` 의 `CHANNELS` 상수와 1:1 일치. **단, `debug` 2채널은 `import.meta.env.DEV` 일 때만 `ipcMain.handle` 로 등록된다** (CHANNELS 상수 문자열은 상존하나 prod 핸들러 미등록 — §2.13 참조).

### 2.1 Chat

| 채널 | 방향 | 페이로드 | 응답/스트림 | 설명 |
|---|---|---|---|---|
| `orca:chat:send` | R→M (invoke) | `SendChatMessage` = `{ sessionId: string \| null; text: string }` | `Promise<void>` (ack) | 메시지 전송. 응답은 `orca:chat:event` 스트림으로 발행. `sessionId === null` 이면 새 세션. |
| `orca:chat:event` | M→R (send) | — | `ChatEvent` (반복) | 어댑터 정규화 스트림. variant 정의는 §3 참조. |
| `orca:chat:cancel` | R→M (invoke) | `CancelChat` = `{ sessionId: string }` | `Promise<void>` | 진행 중 요청 취소 (`AbortSignal` 전파). |

### 2.2 Backend

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:backend:list` | R→M (invoke) | — | `BackendListResult` = `{ backends: { id: Backend; installed: boolean; version?: string; capabilities?: ProviderDescriptor }[]; active?: Backend }` | 등록된 어댑터의 설치 상태 + 활성 백엔드 + 능력 서술자(`capabilities`, computed-on-the-fly — provider-runtime.md §4/§15). 신규 채널 아님(기존 페이로드 비파괴 확장). |

> **예약 (현재 미노출)**: `orca:backend:select` — 단일 백엔드 (`claude-code`) 라 호출자가 없어 preload 에서 의도적으로 제외. opencode 어댑터 활성화 PR 에서 재노출.

### 2.3 Install

| 채널 | 방향 | 페이로드 | 응답/스트림 | 설명 |
|---|---|---|---|---|
| `orca:install:start` | R→M (invoke) | `StartInstall` = `{ backend: Backend }` | `Promise<void>` (ack) | 백엔드 설치 시작. 진행 상태는 `orca:install:status` 스트림. **현재 claude-code 는 SDK `optionalDependencies` 가 binary 를 자동 해소** 하므로 즉시 `done: true` 반환. |
| `orca:install:status` | M→R (send) | — | `InstallStatus` = `{ step: string; progress?: number; log?: string; error?: string; done?: boolean }` | 설치 라인별 진행 이벤트. |

### 2.4 Settings

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:settings:get` | R→M (invoke) | — | `Settings` | electron-store 의 전체 설정 객체. |
| `orca:settings:set` | R→M (invoke) | `SettingsPatch` = `Partial<Settings>` | `Settings` | 부분 패치 후 병합·검증된 전체 객체 반환. |

`Settings` 타입 (`app/src/shared/ipc.ts`):
```typescript
interface Settings {
  theme: 'classic' | 'dark' | 'cool'
  density: 'compact' | 'normal' | 'comfortable'
  sidebarCollapsed: boolean
  sidebarWidth: number          // 180–480, default 248 (Phase 3+ 도입)
  lastBackend: Backend | null
  lastSessionId: string | null
  windowBounds: { x: number; y: number; width: number; height: number } | null
  mcpEnabled: Record<string, boolean>                 // MCP 서버 on/off (키=name). 부재 ⇒ true
  mcpMeta: Record<string, { description: string }>    // MCP Orca 전용 메타 (mcp.json 순정 유지)
}
```
> MCP 서버 정의의 진실은 `~/.config/orca/mcp.json`(순정 Claude `mcpServers` 스키마 + `${VAR}`). `enabled`/`description` 만 settings 가 보유한다 — `orca:mcp:*` 핸들러가 mcp.json + secret-store + settings 를 함께 조율([arch/backend/security.md](arch/backend/security.md) §1.4).

### 2.5 Skills

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:skills:list` | R→M (invoke) | — | `SkillInfo[]` = `{ name: string; description: string; argumentHint?: string }[]` | 부팅 시 1회 스캔된 SKILL.md 카탈로그. **핫리로드 없음** (재시작 필요). |

> **현재 스캔 경로 (claude-code 전용)**: `~/.claude/skills/<name>/SKILL.md` + `<cwd>/.claude/skills/<name>/SKILL.md`. **Future**: 어댑터별 스캔 경로 분리 — [arch/backend/adapters.md](arch/backend/adapters.md) / §7 참조.

### 2.6 Files

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:files:list` | R→M (invoke) | `ListFilesRequest` = `{ cwd: string; relDir: string }` | `FileEntry[]` = `{ name: string; isDirectory: boolean }[]` | `@` 파일 경로 자동완성용. `cwd` 기준 `relDir` 의 직속 항목 한 단계만 리스팅. |

### 2.7 Session

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:session:cwd` | R→M (invoke) | — | `Promise<string>` | 현재 작업 디렉토리. 파일 자동완성·`init` 이벤트의 `cwd` 검증용. |
| `orca:session:list` | R→M (invoke) | — | `SessionListItem[]` | 사이드바 '최근 대화' 메타 목록. DB SSOT — `updatedAt` 내림차순. |
| `orca:session:load` | R→M (invoke) | `LoadSessionRequest` = `{ sessionId: string }` | `LoadedSession \| null` | 세션 메시지를 순서 보존 parts(`LoadedMessage.parts: AppMessagePart[]`, provider-runtime.md §7)로 일괄 로드. Phase 3 lazy load 진입점. `LoadedSession` 은 마지막 턴 통계 `lastTelemetry?: ProviderReportedTelemetry`(`turn_usage` 최신 부모 행 + `turn_model_usage` 자식 행에서 재구성)를 실어 컨텍스트 도넛/패널을 세션 수명 동안 복원. 비용은 `turn_usage` 원장(`0006`)이 SSOT — 일/주/월 시간 집계용이며 모델별 분해는 `turn_model_usage` 에 보존한다. |
| `orca:session:delete` | R→M (invoke) | `DeleteSessionRequest` = `{ sessionId: string }` | `Promise<void>` | hard delete (CASCADE — messages/tool_calls 동반 삭제). `lastSessionId` 가 대상이면 settings 도 해제. |
| `orca:session:rename` | R→M (invoke) | `RenameSessionRequest` = `{ sessionId: string; title: string }` | `Promise<void>` | title 덮어쓰기 + `updatedAt` 갱신. title 길이 1–120 자. 사용자 rename 으로 간주해 DB `title_source='user'` 로 표기한다. |
| `orca:session:titleEvent` | M→R (send) | `SessionTitleEvent` = `{ sessionId: string; title: string }` | — | 새 세션 첫 턴 종료 후 main 이 자동 요약 제목을 영속화하면 모든 창에 push 한다. renderer 는 사이드바 목록과 활성 세션 헤더를 새로고침 없이 갱신한다. |

### 2.7-b Project (Phase 3)

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:project:list` | R→M (invoke) | — | `Project[]` | 모든 프로젝트, `updatedAt` 내림차순. |
| `orca:project:create` | R→M (invoke) | `CreateProjectRequest` = `{ name: string; instructions: string }` | `Project` | 생성 + 신규 row 반환. name 1–120 자, instructions 최대 8000 자. |
| `orca:project:update` | R→M (invoke) | `UpdateProjectRequest` = `{ id: string; name?: string; instructions?: string }` | `Promise<void>` | 부분 업데이트. null 인자는 기존 값 유지. |
| `orca:project:delete` | R→M (invoke) | `{ id: string }` | `Promise<void>` | ON DELETE SET NULL — sessions.project_id 정리. 세션 자체는 보존. |
| `orca:project:listSessions` | R→M (invoke) | `ListProjectSessionsRequest` = `{ projectId: string }` | `SessionListItem[]` | 프로젝트 소속 세션만. |

### 2.8 Window (Phase 3+)

`frame: false` 커스텀 타이틀바의 `WinControls` 가 호출. macOS 는 OS traffic light 가 윈도우 조작을 담당하므로 `WinControls` 가 null 을 반환 → 이 채널 호출자가 없다 (채널 자체는 플랫폼 공통 노출).

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:window:minimize` | R→M (invoke) | — | `Promise<void>` | 현재 BrowserWindow 최소화 (`mainWindow.minimize()`). |
| `orca:window:maximize` | R→M (invoke) | — | `Promise<void>` | 최대화 토글 (`isMaximized() ? unmaximize() : maximize()`). |
| `orca:window:close` | R→M (invoke) | — | `Promise<void>` | 윈도우 종료 (`mainWindow.close()`). |

추가:
- **preload 노출**: `window.orca.window.{minimize,maximize,close}()`.
- **핸들러 위치**: `app/src/main/index.ts` 의 `createWindow` 내부 (router 가 아닌 직접 부착 — 윈도우 인스턴스 직접 참조 필요).
- **`window.orca.platform`** (sync 노출): `'darwin' | 'win32' | 'linux'`. `<html data-platform>` 부착 + WinControls 플랫폼 분기에 사용.

### 2.9 Search (Phase 3++)

대화 이력 전체 검색. Header 의 검색 버튼이 여는 `SearchModal` 이 단일 호출자. 백엔드는 SQLite FTS5 가상 테이블 (`messages_fts`) — `0003_messages_fts.sql` 마이그레이션이 INSERT/UPDATE/DELETE 트리거로 `messages` 와 동기 유지.

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:search:messages` | R→M (invoke) | `SearchMessagesRequest` = `{ q: string; limit?: number }` (q: 1–200자, limit: 1–100, default 30) | `SearchHit[]` | FTS5 검색. 결과는 rank 정렬, 최대 `limit` 개. |

`SearchHit` 타입 (`app/src/shared/ipc.ts`):
```typescript
interface SearchHit {
  messageId: number
  sessionId: string
  sessionTitle: string | null
  role: 'user' | 'assistant'
  createdAt: number
  // SQLite snippet() 가 생성한 `<mark>…</mark>` 포함 발췌. 렌더러는 split-parse 후
  // React 노드로 재구성 (innerHTML 우회로 XSS 방어).
  snippet: string
}
```

추가:
- **입력어 prefix 매칭**: `toFtsMatch` (`app/src/main/db/queries.ts`) 가 공백 토큰 분리 후 *모든 토큰* 에 `*` wildcard 부착 (예: `진행 중` → `"진행"* "중"*`). 어느 토큰이든 미완성으로 타이핑 중일 수 있다는 가정. 짧은 토큰의 매치 폭증은 LIMIT + FTS5 rank 정렬로 흡수.
- **실행 위치**: main thread 직접 (better-sqlite3 sync). FTS5 latency 가 단위 ms 라 worker thread 도입 보류 — 향후 perf 회귀 시 `utilityProcess` 로 위임 검토.
- **렌더러 debounce**: 150ms + request id supersede 로 stale 응답 폐기.

### 2.10 MCP (Phase 3++)

전역 MCP 서버 설정 CRUD. `/skills` 화면(`SkillsMcpView`)이 단일 호출자. **영속화는 파일-백드 모델** — 정의의 진실은 `~/.config/orca/mcp.json`(순정 Claude `mcpServers` 스키마 + `${VAR}`), **인증 비밀은 secret-store(`orca-secrets` + `safeStorage`)에 env-var 이름으로 암호화 저장**(mcp.json 엔 `${VAR}` 만, renderer 엔 `hasAuth` boolean 만), enabled/description 은 settings(`mcpEnabled`/`mcpMeta`). 활성화된 서버는 `handleChatSend` 가 `McpStore.buildQueryOptions()`(→ `toClaudeConfig`)로 변환해 매 query 의 `mcpServers` + `allowedTools`(`mcp__<name>__*`) 옵션에 주입. 상세 = [arch/backend/security.md](arch/backend/security.md) §1.4.

> IPC DTO 표면(`McpServer` + 4채널)은 파일-백드 재설계 전후로 **불변**이다(preload/renderer 무영향). `id` = 서버 `name`(고유 키), `authEnvKey` 는 stdio·http 양쪽에서 비밀을 주입할 env-var 이름.

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:mcp:list` | R→M (invoke) | — | `McpServer[]` | 전역 MCP 서버 목록 (DTO — 비밀 제외, `hasAuth` 포함). |
| `orca:mcp:add` | R→M (invoke) | `CreateMcpServerRequest` | `McpServer` | 서버 추가. `name` 유일 + `^[A-Za-z0-9_-]+$`. transport 별 필수 필드 검증. |
| `orca:mcp:update` | R→M (invoke) | `UpdateMcpServerRequest` = `{ id } & Partial<...>` | `McpServer \| null` | 부분 수정 (토글 enabled 포함). `auth` 미지정=유지, `''`=제거, 그 외=secret-store 재저장. `authEnvKey` 변경 시 기존 비밀을 새 이름으로 이전. |
| `orca:mcp:delete` | R→M (invoke) | `DeleteMcpServerRequest` = `{ id }` | `Promise<void>` | 서버 삭제. |

`McpServer` DTO (`app/src/shared/ipc.ts`):
```typescript
interface McpServer {
  id: string
  name: string
  description: string
  transport: 'stdio' | 'http'
  enabled: boolean
  command: string | null   // stdio
  args: string[]           // stdio
  authEnvKey: string | null // stdio — 인증값을 주입할 env 이름 (비밀 아님)
  url: string | null       // http
  hasAuth: boolean         // 인증 비밀 보유 여부 (raw 값은 main safeStorage 만 접근)
}
```

소스(mcp.json)→SDK 매핑(`toClaudeConfig`, 구조 항등): stdio → `{ command, args, env: { [authEnvKey]: '${authEnvKey}' } }`, http → `{ type:'http', url, headers: { Authorization: 'Bearer ${authEnvKey}' } }`, sse → 그대로 보존(SDK 가 sse 트랜스포트 지원). `${VAR}` 는 query 직전 resolver(safeStorage→process.env)로 확장되며, 미해결 시 해당 서버는 드롭된다.

### 2.11 Runtime (Python — uv 격리 인터프리터)

앱이 `<userData>/runtime` 에 제공하는 uv 기반 격리 Python 환경의 상태/제어. 부팅 시 `IpcRouter.start()` 가 `PythonRuntime.ensure()` 를 비동기로 킥하며, 진행 상태는 `orca:runtime:statusEvent` 로 모든 창에 브로드캐스트된다. agent 의 도구 실행에는 `handleChatSend` 가 `PythonRuntime.getEnv()` 의 `UV_*`/`PATH` 를 SDK `query().options.env` 로 주입한다. 인터프리터는 첫 실행 시 `uv python install 3.12` 로 확보(4-A); operator 가 `UV_PYTHON_INSTALL_MIRROR`/`UV_DEFAULT_INDEX`/`PIP_INDEX_URL` 를 환경에 지정하면 그 값으로 수렴(미설정 시 github/공개 PyPI).

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:runtime:status` | R→M (invoke) | — | `RuntimeStatus` | 현재 런타임 상태 1회 조회 (renderer 마운트 시 초기 동기화). |
| `orca:runtime:prepare` | R→M (invoke) | — | `Promise<void>` | 초기화 재시도/수동 준비 트리거. 진행은 statusEvent 로 스트리밍. |
| `orca:runtime:statusEvent` | M→R (send) | `RuntimeStatus` | — | 초기화 진행 상태 스트림 (preparing 단계 로그 청크 포함). |

`RuntimeStatus` (`app/src/shared/ipc.ts`):
```typescript
type RuntimeStage = 'idle' | 'preparing' | 'ready' | 'error'
interface RuntimeStatus {
  stage: RuntimeStage
  ready: boolean
  log?: string    // preparing 단계 라벨 또는 자식 프로세스 stdout/stderr 청크
  error?: string  // stage === 'error' 일 때만
}
```


### 2.12 Cost (Phase 3++)

일/주/월 비용·토큰 누적 summary. Main 의 `CostTracker` 가 `turn_usage.created_at` 기준 SQL `SUM` 으로 재계산하고, Renderer 는 표시 UI 없이 읽기전용 Context 미러만 유지한다.

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:cost:summary` | R→M (invoke) | — | `CostSummary` | 현재 캐시된 일/주/월 비용·토큰 누적값 1회 조회. 앱 부팅 시 main 이 1회 `recompute()` 한 값을 반환한다. |
| `orca:cost:summaryEvent` | M→R (send) | `CostSummary` | — | telemetry 저장 직후 `CostTracker.recordAndBroadcast()` 가 모든 창에 push 하는 summary 갱신 이벤트. |

`CostSummary` 타입 (`app/src/shared/ipc.ts`):
```typescript
interface CostPeriodSummary {
  totalCostUsd: number
  inputTokens: number
  outputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
}
interface CostSummary {
  day: CostPeriodSummary
  week: CostPeriodSummary
  month: CostPeriodSummary
  updatedAt: number
}
```

### 2.13 Debug (dev 전용 — MockAdapter 하네스)

LLM API 없이 renderer 의 스트리밍·사고 블록·도구 카드·권한 승인 카드·에러·컨텍스트 도넛을 라이브 디버깅하기 위한 **dev 전용** 채널. main 의 `MockAdapter`(`adapters/mock.ts`, `id='claude-code'` 위장)가 라우터의 권한 합성·DB 영속화·IPC 송신 경로를 실트래픽과 동형으로 타며, renderer 의 `features/debug` 패널(`FloatingPanel`)이 단일 호출자다.

> **prod 안전성**: `debug` 도메인은 `import.meta.env.DEV` 게이트 안에서만 `ipcMain.handle` 로 등록되고 MockAdapter 도 그때만 인스턴스화된다(빌드타임 상수라 prod 번들에서 dead-code 제거 — `out/main` 에 핸들러 등록 코드 부재, `out/renderer` 에 DebugPanel 미포함). preload 는 `window.orca.debug` 를 상시 노출하나, prod 에선 main 핸들러가 없어 invoke 가 무효다. mock 모드 상태(`debugMock`)는 **비영속** — 재시작 시 OFF.

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:debug:getMock` | R→M (invoke) | — | `DebugMockState` = `{ enabled: boolean; scenarioId: MockScenarioId; contextUsageRatio: number }` | 현재 mock 상태 1회 조회 (패널 마운트 시 동기화). |
| `orca:debug:setMock` | R→M (invoke) | `Partial<DebugMockState>` (`DebugMockPatchSchema` — 세 필드 optional, `contextUsageRatio` 0~1) | `DebugMockState` | mock 상태 부분 패치 후 병합된 전체 반환. `enabled` 토글 시 `handleChatSend` 의 어댑터 선택이 MockAdapter ↔ 활성 어댑터로 분기. |

`MockScenarioId` 8종 (`app/src/shared/ipc.ts` `MOCK_SCENARIO_IDS`): `text_streaming` · `reasoning` · `tool_calls` · `tool_approval` · `ask_question` · `plan_review` · `error` · `full`. `full` 은 `NormalizedEvent` union 11종을 전수 산출(권한 2종은 approval 스텝이 라우터를 경유해 합성). 시나리오 telemetry 는 `costUsd: 0`·`model: 'mock-sonnet'`, 컨텍스트 토큰 합 = `round(contextUsageRatio × 200_000)` 로 도넛/`nearCompaction` 경고를 구동.

### 2.14 예약 / 미노출 채널

코드에 채널 상수는 없지만 향후 도입이 예약된 도메인:

| 도메인 | 도입 시점 | 채택 결정 |
|---|---|---|
| `backend:select` | opencode 어댑터 활성화 시 | 단일 백엔드라 현재 미노출 |
| `message:*` (개별 append / delete 등) | **Future** | 현재는 chat 턴 단위로 main 이 일괄 persist — 개별 메시지 조작 API 필요 시 도입 |
| `credentials:set` / `credentials:hasKey` | **Phase 3+** | safeStorage 자격증명 저장 ([arch/backend/security.md](arch/backend/security.md)) |
| `skills:reload` | **Future** | 핫리로드 도입 시 |
| `routines:*` | **Future** | Sidebar nav 의 `/routines` placeholder 가 활성 페이지로 승격될 때 |

## 3. NormalizedEvent variant 정의

> **표준화 스테이지 B (provider-runtime.md §2)**: `orca:chat:event` 의 와이어 타입은 provider 중립 **`NormalizedEvent`** 다. 모든 이벤트가 `sessionId`·`provider` 를 갖고, tool 은 `toolRunId` 로 start/complete 를 매칭한다. claude 어댑터는 SDK 메시지를 `claudeToNormalized`(`adapters/claude-map.ts`)로 이 타입에 **직접** 정규화한다(구 `ChatEvent` 중간표현은 제거됨). `app/src/shared/ipc.ts` 의 `NormalizedEvent` union 이 정본.

| `type` | 필드(공통: `sessionId`·`provider`) | 발생 시점 | Renderer 처리 (`chatReducer.ts`) |
|---|---|---|---|
| `session.updated` | `patch: { model?; cwd? }` | 어댑터의 첫 메시지 (SDK `SDKSystemMessage.init`) | `state.sessionId` 저장, `state.cwd` 갱신 |
| `message.delta` | `delta: { text }` | LLM 스트리밍 (SDK `text_delta`) | `pendingDelta += text` |
| `message.completed` | `message: { text }` | LLM 턴 종료 (SDK `SDKAssistantMessage` text block) | 현재 assistant 메시지에 `text` 파트 append, `pendingDelta` 비움 |
| `message.reasoning` | `text; signature?` | 확장사고 블록 (SDK `SDKAssistantMessage` thinking block) | 현재 assistant 메시지에 `reasoning` 파트 append (signature 는 opaque 보관) + `pendingReasoning` 비움 |
| `message.reasoning.delta` | `delta: { text }` | 확장사고 라이브 (SDK `thinking_delta`) | `pendingReasoning += text` (transient, 미저장). `message.delta` 와 동형 — 런타임 미수신 시 발생 안 함 |
| `tool.call.started` | `toolRunId; toolName; args` | LLM 도구 호출 (SDK `tool_use` block) | 현재 assistant 메시지에 `tool_call` 파트 append |
| `tool.call.completed` | `toolRunId; result; isError; durationMs?` | 도구 실행 완료 (SDK `tool_result` block) | `tool_result` 파트 append (`toolRunId` 로 `tool_call` 과 페어링) |
| `telemetry` | `usage?: ProviderReportedTelemetry` (model·input/output·캐시 토큰·costUsd·durationMs·numTurns·modelUsage) | 어댑터 턴 종료 (SDK `SDKResultMessage`) | `inflight = false`, `pendingInputTokens`·`lastTelemetry`·`sessionCostUsd`(누산)·`lastTurnLatencyMs` 갱신 → TelemetryPanel |
| `error` | `error: { code; message; recoverable }` (`sessionId?`) | 어댑터 catch 또는 SDK 에러 | `state.error` 설정, `inflight = false` |
| `permission.requested` | `approvalId; origin; action: PermissionAction` | AskUserQuestion·ExitPlanMode·**위험 도구 게이트**(canUseTool) | `action.kind` 로 분기 → `pendingAsks` / `pendingPlanReview` / `pendingToolApproval`. 응답은 단일 `permissionRespond`(`{approvalId, resolution}`, approvalId=requestId) |
| `permission.resolved` | `approvalId; resolution: ApprovalResolution` | 라우터 `requestApproval` 클로저가 broker 해소 직후 발행(mock/실경로 공통 — audit/telemetry 용) | no-op(카드는 respond 시 로컬 RESOLVE_* 로 닫힘) |

`PermissionAction` = `{kind:'ask_question', request} | {kind:'plan_review', request} | {kind:'tool_approval', toolName, input}`. `ApprovalResolution` = `{behavior:'allow', updatedInput?, updatedPermissions?} | {behavior:'deny', message?, interrupt?}` (claude `PermissionResult` 와 동형 + 앱 레벨 세션 권한 `updatedPermissions:[{toolName, scope:'session'}]`).

**권한 응답 채널 단일화.** ask/plan/tool 세 종류의 승인 응답은 모두 단일 `permissionRespond`(`orca:permission:respond`, renderer→main invoke) 채널로 흐른다(구 `askRespond`/`planRespond` 2채널 통합). 페이로드 = `{approvalId, resolution: ApprovalResolution}`. main(`InteractionBroker<ApprovalResolution>`)이 `approvalId` 로 보류 중인 `canUseTool` Promise 를 해소한다. 부수효과: ① `allow.updatedPermissions{scope:'session'}` → 해당 세션의 자동 허용 도구 집합 갱신(같은 세션 이후 턴 카드 미surface), ② `deny.interrupt` → 해당 턴 abort(plan reject). **위험 도구 게이트**: `makeCanUseTool` 이 화이트리스트(`Bash`·`Write`·`Edit`·`MultiEdit`·`NotebookEdit`, `permission-bridge.ts` 의 `RISKY_TOOLS`)에 든 도구만 `tool_approval` 로 surface 하고, 안전 도구는 자동 통과한다.

**권한 모드 라이브 전환 (PR③).** `permissionSetMode`(`orca:permission:setMode`, renderer→main invoke). 페이로드 = `{sessionId, mode: NormalizedPermissionMode}`(정규화 6종 — `default`·`accept_edits`·`plan`·`dont_ask`·`bypass`·`auto_classified`). main 은 두 경로로 적용한다: ① `PermissionModeController`(세션 SSOT) 갱신 → 다음 턴 send 페이로드에 반영, ② 같은 세션의 진행 중 턴이 있으면 그 턴의 라이브 핸들로 즉시 `Query.setPermissionMode`(`toClaudePermissionMode` 변환) — 그 턴의 이후 도구부터 적용. 턴-스코프 스트리밍 입력(`prompt: AsyncIterable<SDKUserMessage>`)에서만 control 메서드가 열린다(resume-from-DB 모델 유지). 위험 모드(`bypass`·`dont_ask`)는 렌더러 `ModeMenu` 가 2-스텝 확인으로 가드한다.

## 4. 에러 코드

`app/src/shared/ipc.ts:25-34` 의 `ErrorCode` 그대로.

| code | 의미 | 발생 위치 | 회복 방법 |
|---|---|---|---|
| `sdk.crashed` | SDK 의 `query()` 내부 예외 | claude-code 어댑터 | 새 대화 (보통 `recoverable: true`) |
| `sdk.spawn-failed` | SDK 가 platform binary 해소 실패 / 활성 백엔드 부재 | claude-code 어댑터 부팅·router | 인스톨러 다이얼로그 |
| `auth.expired` | SDK 가 401 / OAuth / expired 패턴 throw | claude-code 어댑터 | `claude /login` 안내 모달 (AuthExpiredModal) |
| `protocol.parse` | 어댑터 정규화 실패 (예상치 못한 SDKMessage 형태) | claudeToNormalized | 새 대화 |
| `internal` | 그 외 알 수 없는 에러 | router / 어댑터 | 새 대화 |

> 구 `cli.*` 코드 그룹(`cli.not-installed`/`cli.spawn-failed`/`cli.crashed`/`cli.timeout`)은 Phase 3 SDK 마이그레이션 후 제거됨(legacy 정리).

> `cli.*` 코드 그룹은 Phase 3 SDK 마이그레이션 이후 deprecated. 후속 PR 에서 정리 예정.

## 5. 타입 정의 위치

| 파일 | 역할 | import 가능한 곳 |
|---|---|---|
| `app/src/shared/ipc.ts` | 순수 TS 타입 + `CHANNELS` 상수. **zod 의존 없음.** | main / preload / renderer 모두 |
| `app/src/shared/protocol.ts` | zod 런타임 스키마 (`SendChatMessageSchema` 등) | **main 전용** (renderer/preload 에서 import 금지) |

**충돌 시 코드 우선** — 이 문서는 사람과 AI agent 를 위한 요약이며, 타입과 어긋날 경우 코드가 진실의 기준.

## 6. 변경 절차

채널을 추가·변경할 때 다음 순서를 따른다:

1. `app/src/shared/ipc.ts` — 채널 상수 + 타입 정의 추가/변경
2. `app/src/shared/protocol.ts` — zod 스키마 추가 (요청 검증 필요 시)
3. `app/src/main/ipc/router.ts` — `ipcMain.handle` 등록 + 검증 로직
4. `app/src/preload/index.ts` — `window.orca.<domain>.<action>` 노출 추가
5. Renderer 사용처 (`app/src/renderer/src/shared/api/ipc.ts`, feature provider/hook 또는 컴포넌트)
6. **이 문서 §2 의 표 갱신** (도메인 추가 시 §2.x 신설, 총 채널 수/도메인별 분포도 동시 갱신)
7. 영향 받는 FRONTEND/BACKEND 문서 anchor 업데이트
8. PR 설명에 IPC 변경 사항 명시

## 7. 보안 / 제약

- preload 는 명시된 채널만 노출. `ipcRenderer` 직접 노출 금지.
- Renderer 에서 채널 이름 문자열 하드코딩 금지 — `window.orca.*` 만 사용.
- 모든 invoke 핸들러는 `try/catch` + 직렬화 가능한 에러 (`{ code, message, recoverable }`) 반환.
- 민감 정보 (자격증명·파일 전체 경로 등) 는 로그에 마스킹.


## Agent domain (0010)

| Channel | Direction | Payload | Response | Notes |
|---|---|---|---|---|
| `orca:agent:list` | renderer → main | none | `AgentEnvironment[]` | orca.json agents 를 renderer-safe DTO 로 반환한다. `authToken`/`baseUrl`/`env`/secret 값 필드는 존재하지 않는다. |

`orca:chat:send` 는 optional `providerKey?: string | null`, `modelFamily?: string | null` 를 수용한다. `orca:session:load` 의 `LoadedSession` 은 optional `providerKey?: string | null` 를 반환한다. 활성 채널 총수는 39개다.

# IPC Contract

> 이 문서는 Main ↔ Renderer 간 IPC 채널의 **단일 진실 공급원 (SSOT)** 이다.
> 채널을 추가/변경할 때는 코드와 이 문서를 함께 갱신한다.
> 최종 업데이트: 2026-05-26
> 관련 문서: [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md), [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md), [GLOSSARY.md](./GLOSSARY.md), [TRD.md](./TRD.md) §5

## 1. 명명 규칙

- 형식: `orca:<domain>:<action>` — 소문자 + 콜론 구분
- 도메인 (12개): `chat`, `backend`, `install`, `settings`, `skills`, `files`, `session`, `project`, `window`, `search`, `mcp`, `runtime`
- 방향:
  - Renderer → Main 요청: `ipcMain.handle` + `ipcRenderer.invoke` (Promise 반환)
  - Main → Renderer 이벤트: `webContents.send` + `ipcRenderer.on` (단방향 push)
- preload 노출: `window.orca.<domain>.<action>(...)` 형태 (`app/src/preload/index.ts`)
- 채널 상수: `app/src/shared/ipc.ts` 의 `CHANNELS` 객체. 문자열 리터럴 직접 사용 금지.
- 입력 검증: 모든 `ipcMain.handle` 핸들러는 **zod 스키마 (`app/src/shared/protocol.ts`)** 로 페이로드 검증. 검증 실패 시 에러 throw.

## 2. 채널 카탈로그 (총 31 채널)

도메인별 분포: `chat` 3 · `backend` 1 · `install` 2 · `settings` 2 · `skills` 1 · `files` 1 · `session` 5 · `project` 5 · `window` 3 · `search` 1 · `mcp` 4 · `runtime` 3.

`app/src/shared/ipc.ts` 의 `CHANNELS` 상수와 1:1 일치.

### 2.1 Chat

| 채널 | 방향 | 페이로드 | 응답/스트림 | 설명 |
|---|---|---|---|---|
| `orca:chat:send` | R→M (invoke) | `SendChatMessage` = `{ sessionId: string \| null; text: string }` | `Promise<void>` (ack) | 메시지 전송. 응답은 `orca:chat:event` 스트림으로 발행. `sessionId === null` 이면 새 세션. |
| `orca:chat:event` | M→R (send) | — | `ChatEvent` (반복) | 어댑터 정규화 스트림. variant 정의는 §3 참조. |
| `orca:chat:cancel` | R→M (invoke) | `CancelChat` = `{ sessionId: string }` | `Promise<void>` | 진행 중 요청 취소 (`AbortSignal` 전파). |

### 2.2 Backend

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:backend:list` | R→M (invoke) | — | `BackendListResult` = `{ backends: { id: Backend; installed: boolean; version?: string }[]; active?: Backend }` | 등록된 어댑터의 설치 상태 + 활성 백엔드. |

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
> MCP 서버 정의의 진실은 `~/.config/orca/mcp.json`(순정 Claude `mcpServers` 스키마 + `${VAR}`). `enabled`/`description` 만 settings 가 보유한다 — `orca:mcp:*` 핸들러가 mcp.json + secret-store + settings 를 함께 조율(BACKEND §8.4).

### 2.5 Skills

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:skills:list` | R→M (invoke) | — | `SkillInfo[]` = `{ name: string; description: string; argumentHint?: string }[]` | 부팅 시 1회 스캔된 SKILL.md 카탈로그. **핫리로드 없음** (재시작 필요). |

> **현재 스캔 경로 (claude-code 전용)**: `~/.claude/skills/<name>/SKILL.md` + `<cwd>/.claude/skills/<name>/SKILL.md`. **Future**: 어댑터별 스캔 경로 분리 — BACKEND_ARCHITECTURE.md §4 / §7 참조.

### 2.6 Files

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:files:list` | R→M (invoke) | `ListFilesRequest` = `{ cwd: string; relDir: string }` | `FileEntry[]` = `{ name: string; isDirectory: boolean }[]` | `@` 파일 경로 자동완성용. `cwd` 기준 `relDir` 의 직속 항목 한 단계만 리스팅. |

### 2.7 Session

| 채널 | 방향 | 페이로드 | 응답 | 설명 |
|---|---|---|---|---|
| `orca:session:cwd` | R→M (invoke) | — | `Promise<string>` | 현재 작업 디렉토리. 파일 자동완성·`init` 이벤트의 `cwd` 검증용. |
| `orca:session:list` | R→M (invoke) | — | `SessionListItem[]` | 사이드바 '최근 대화' 메타 목록. DB SSOT — `updatedAt` 내림차순. |
| `orca:session:load` | R→M (invoke) | `LoadSessionRequest` = `{ sessionId: string }` | `LoadedSession \| null` | 세션 메시지 + 툴콜 일괄 로드. Phase 3 lazy load 진입점. |
| `orca:session:delete` | R→M (invoke) | `DeleteSessionRequest` = `{ sessionId: string }` | `Promise<void>` | hard delete (CASCADE — messages/tool_calls 동반 삭제). `lastSessionId` 가 대상이면 settings 도 해제. |
| `orca:session:rename` | R→M (invoke) | `RenameSessionRequest` = `{ sessionId: string; title: string }` | `Promise<void>` | title 덮어쓰기 + `updatedAt` 갱신. title 길이 1–120 자. |

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

전역 MCP 서버 설정 CRUD. `/skills` 화면(`SkillsMcpView`)이 단일 호출자. **영속화는 파일-백드 모델** — 정의의 진실은 `~/.config/orca/mcp.json`(순정 Claude `mcpServers` 스키마 + `${VAR}`), **인증 비밀은 secret-store(`orca-secrets` + `safeStorage`)에 env-var 이름으로 암호화 저장**(mcp.json 엔 `${VAR}` 만, renderer 엔 `hasAuth` boolean 만), enabled/description 은 settings(`mcpEnabled`/`mcpMeta`). 활성화된 서버는 `handleChatSend` 가 `McpStore.buildQueryOptions()`(→ `toClaudecodeConfig`)로 변환해 매 query 의 `mcpServers` + `allowedTools`(`mcp__<name>__*`) 옵션에 주입. 상세 = BACKEND §8.4.

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

소스(mcp.json)→SDK 매핑(`toClaudecodeConfig`): stdio → `{ command, args, env: { [authEnvKey]: '${authEnvKey}' } }`, http → `{ type:'http', url, headers: { Authorization: 'Bearer ${authEnvKey}' } }`. `${VAR}` 는 query 직전 resolver(safeStorage→process.env)로 확장되며, 미해결 시 해당 서버는 드롭된다. `sse` 소스는 프로그래매틱 mcpServers 에서 `http` 로 강제.

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

### 2.12 예약 / 미노출 채널

코드에 채널 상수는 없지만 향후 도입이 예약된 도메인:

| 도메인 | 도입 시점 | 채택 결정 |
|---|---|---|
| `backend:select` | opencode 어댑터 활성화 시 | 단일 백엔드라 현재 미노출 |
| `message:*` (개별 append / delete 등) | **Future** | 현재는 chat 턴 단위로 main 이 일괄 persist — 개별 메시지 조작 API 필요 시 도입 |
| `credentials:set` / `credentials:hasKey` | **Phase 3+** | safeStorage 자격증명 저장 (BACKEND §8) |
| `skills:reload` | **Future** | 핫리로드 도입 시 |
| `routines:*` | **Future** | Sidebar nav 의 `/routines` placeholder 가 활성 페이지로 승격될 때 |

## 3. ChatEvent variant 정의

`app/src/shared/ipc.ts:37-47` 의 discriminated union 그대로.

| `type` | `data` 스키마 | 발생 시점 | Renderer 처리 (`chatReducer.ts`) |
|---|---|---|---|
| `init` | `{ sessionId: string; model?: string; cwd: string }` | 어댑터의 첫 메시지 (SDK `SDKSystemMessage.init`) | `state.sessionId` 저장, `state.cwd` 갱신 |
| `assistant_delta` | `{ text: string }` | LLM 스트리밍 (SDK `SDKPartialAssistantMessage.text_delta`) | `pendingDelta += text` (16ms throttle 리렌더) |
| `assistant_message` | `{ text: string }` | LLM 턴 종료 (SDK `SDKAssistantMessage` 완성본의 text block) | `pendingDelta` → `messages` 의 새 assistant 메시지로 commit |
| `tool_use` | `{ toolUseId: string; name: string; input: unknown }` | LLM 의 도구 호출 (SDK `SDKAssistantMessage` 의 `tool_use` block) | 현재 assistant 메시지에 ToolCall 부착 |
| `tool_result` | `{ toolUseId: string; output: unknown; isError: boolean; durationMs?: number }` | 도구 실행 완료 (SDK `SDKUserMessage` 의 `tool_result` block) | `toolUseId` 매칭하여 ToolCall 업데이트 |
| `result` | `{ usage?: { inputTokens: number; outputTokens: number } }` | 어댑터 턴 종료 (SDK `SDKResultMessage`) | `inflight = false`, `pendingInputTokens` 갱신 |
| `error` | `{ code: ErrorCode; message: string; recoverable: boolean }` | 어댑터 catch 또는 SDK 에러 | `state.error` 설정, `inflight = false` |

## 4. 에러 코드

`app/src/shared/ipc.ts:25-34` 의 `ErrorCode` 그대로.

| code | 의미 | 발생 위치 | 회복 방법 |
|---|---|---|---|
| `sdk.crashed` | SDK 의 `query()` 내부 예외 | claude-code 어댑터 | 새 대화 (보통 `recoverable: true`) |
| `sdk.spawn-failed` | SDK 가 platform binary 해소 실패 | claude-code 어댑터 부팅 | 인스톨러 다이얼로그 |
| `cli.not-installed` *(deprecated)* | CLI 미발견. Phase 3 SDK 마이그레이션 이후 사실상 발생 안 함 | (legacy) | — |
| `cli.spawn-failed` *(deprecated)* | CLI 실행 실패 | (legacy) | — |
| `cli.crashed` *(deprecated)* | CLI 비정상 종료 | (legacy) | — |
| `cli.timeout` *(deprecated)* | CLI 응답 timeout | (legacy) | — |
| `auth.expired` | SDK 가 401 / OAuth / expired 패턴 throw | claude-code 어댑터 | `claude /login` 안내 모달 (AuthExpiredModal) |
| `protocol.parse` | 어댑터 정규화 실패 (예상치 못한 SDKMessage 형태) | normalize 함수 | 새 대화 |
| `internal` | 그 외 알 수 없는 에러 | router / 어댑터 | 새 대화 |

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
5. Renderer 사용처 (`app/src/renderer/src/state/use*.ts` 또는 컴포넌트)
6. **이 문서 §2 의 표 갱신** (도메인 추가 시 §2.x 신설)
7. 영향 받는 FRONTEND/BACKEND 문서 anchor 업데이트
8. PR 설명에 IPC 변경 사항 명시

## 7. 보안 / 제약

- preload 는 명시된 채널만 노출. `ipcRenderer` 직접 노출 금지.
- Renderer 에서 채널 이름 문자열 하드코딩 금지 — `window.orca.*` 만 사용.
- 모든 invoke 핸들러는 `try/catch` + 직렬화 가능한 에러 (`{ code, message, recoverable }`) 반환.
- 민감 정보 (자격증명·파일 전체 경로 등) 는 로그에 마스킹.

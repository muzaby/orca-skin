// IPC 채널 이름 + 순수 TS 타입. zod 의존 없음 — preload (sandbox=true) 와 renderer 모두 안전하게 import.
// main 프로세스의 런타임 검증 (zod 스키마) 은 ./protocol.ts 에 별도로 둔다.

// Phase 2 활성 채널 (preload 노출 대상). 미사용 채널은 의도적으로 누락.
export const CHANNELS = {
  chatSend: 'orca:chat:send',
  chatEvent: 'orca:chat:event',
  chatCancel: 'orca:chat:cancel',
  backendList: 'orca:backend:list',
  installStart: 'orca:install:start',
  installStatus: 'orca:install:status',
  settingsGet: 'orca:settings:get',
  settingsSet: 'orca:settings:set',
  skillsList: 'orca:skills:list',
  filesList: 'orca:files:list',
  sessionCwd: 'orca:session:cwd',
  sessionList: 'orca:session:list',
  sessionLoad: 'orca:session:load',
  sessionDelete: 'orca:session:delete',
  sessionRename: 'orca:session:rename',
  projectList: 'orca:project:list',
  projectCreate: 'orca:project:create',
  projectUpdate: 'orca:project:update',
  projectDelete: 'orca:project:delete',
  projectListSessions: 'orca:project:listSessions',
  windowMinimize: 'orca:window:minimize',
  windowMaximize: 'orca:window:maximize',
  windowClose: 'orca:window:close',
  searchMessages: 'orca:search:messages',
  mcpList: 'orca:mcp:list',
  mcpAdd: 'orca:mcp:add',
  mcpUpdate: 'orca:mcp:update',
  mcpDelete: 'orca:mcp:delete',
  runtimeStatus: 'orca:runtime:status',
  runtimePrepare: 'orca:runtime:prepare',
  runtimeStatusEvent: 'orca:runtime:statusEvent'
} as const

// Backend (Phase 2: claude-code 단일. opencode 는 future work)
export type Backend = 'claude-code'

// Error 코드 (TRD §6.6)
// Phase 3 (SDK 마이그레이션): sdk.* 가 신규 표준. cli.* 는 CLI spawn 시기 호환을 위해 보존
// (deprecated — 후속 PR 에서 정리).
export type ErrorCode =
  | 'sdk.crashed'
  | 'sdk.spawn-failed'
  | 'cli.not-installed'
  | 'cli.spawn-failed'
  | 'cli.crashed'
  | 'cli.timeout'
  | 'auth.expired'
  | 'protocol.parse'
  | 'internal'

// ChatEvent (TRD §6.2) — 어댑터→Renderer 정규화 스트림
export type ChatEvent =
  | { type: 'init'; data: { sessionId: string; model?: string; cwd: string } }
  | { type: 'assistant_delta'; data: { text: string } }
  | { type: 'assistant_message'; data: { text: string } }
  | { type: 'tool_use'; data: { toolUseId: string; name: string; input: unknown } }
  | {
      type: 'tool_result'
      data: { toolUseId: string; output: unknown; isError: boolean; durationMs?: number }
    }
  | { type: 'result'; data: { usage?: { inputTokens: number; outputTokens: number } } }
  | { type: 'error'; data: { code: ErrorCode; message: string; recoverable: boolean } }

// IPC payloads (TRD §5.2 의 활성 부분)
export interface SendChatMessage {
  sessionId: string | null
  // 새 채팅 첫 메시지의 소속 프로젝트. resume(sessionId != null) 의 경우는 무시되고,
  // main 이 sessionId → project_id → instructions 를 DB 에서 직접 조회한다.
  projectId: string | null
  text: string
}

export interface CancelChat {
  sessionId: string
}

export interface BackendListResult {
  backends: { id: Backend; installed: boolean; version?: string }[]
  active?: Backend
}

export interface StartInstall {
  backend: Backend
}

export interface InstallStatus {
  step: string
  progress?: number
  log?: string
  error?: string
  done?: boolean
}

// Settings (TRD §6.7 / §10 anchor "재시작 재개"). Phase 2+ 영속화 도입.
export type ThemePref = 'classic' | 'dark' | 'cool'
export type DensityPref = 'compact' | 'normal' | 'comfortable'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Settings {
  theme: ThemePref
  density: DensityPref
  sidebarCollapsed: boolean
  sidebarWidth: number
  lastBackend: Backend | null
  lastSessionId: string | null
  windowBounds: WindowBounds | null
  // MCP 서버 enabled on/off (키 = 서버 name). 부재 ⇒ enabled=true.
  mcpEnabled: Record<string, boolean>
  // MCP 서버 Orca 전용 메타(description) — mcp.json(순정 Claude 스키마) 에 없는 필드.
  mcpMeta: Record<string, { description: string }>
}

export type SettingsPatch = Partial<Settings>

// 스킬 카탈로그 — main 이 ~/.claude/skills/ 와 <cwd>/.claude/skills/ 의 SKILL.md
// frontmatter 를 부팅 시 스캔한 결과. 슬래시 명령 자동완성 UI 용.
export interface SkillInfo {
  name: string
  description: string
  argumentHint?: string
}

// `@` 파일 경로 자동완성 — `cwd` 기준 `relDir` 의 직속 항목 한 단계만 리스팅.
export interface ListFilesRequest {
  cwd: string
  relDir: string
}

export interface FileEntry {
  name: string
  isDirectory: boolean
}

// 세션 카탈로그 (사이드바 "최근 대화") — Phase 3 로컬 DB SSOT.
export interface SessionListItem {
  id: string
  backend: Backend
  title: string | null
  updatedAt: number
  preview: string | null
  projectId: string | null
}

export interface LoadSessionRequest {
  sessionId: string
}

export interface DeleteSessionRequest {
  sessionId: string
}

export interface RenameSessionRequest {
  sessionId: string
  title: string
}

// 로드된 세션 — Renderer 의 chatReducer state 와 1:1 대응.
export interface LoadedToolCall {
  toolUseId: string
  name: string
  input: unknown
  result?: { output: unknown; isError: boolean }
}

export interface LoadedMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  toolCalls?: LoadedToolCall[]
}

export interface LoadedSession {
  id: string
  backend: Backend
  title: string | null
  messages: LoadedMessage[]
}

// 프로젝트 (Phase 3+) — 대화 묶음 + 전용 시스템 프롬프트 (instructions).
export interface Project {
  id: string
  name: string
  instructions: string
  createdAt: number
  updatedAt: number
}

export interface CreateProjectRequest {
  name: string
  instructions: string
}

export interface UpdateProjectRequest {
  id: string
  name?: string
  instructions?: string
}

export interface DeleteProjectRequest {
  id: string
}

export interface ListProjectSessionsRequest {
  projectId: string
}

// 대화 검색 (Phase 3++ Header 검색 모달) — FTS5 백엔드.
export interface SearchMessagesRequest {
  q: string
  limit?: number
}

export interface SearchHit {
  messageId: number
  sessionId: string
  sessionTitle: string | null
  role: 'user' | 'assistant'
  createdAt: number
  // SQLite snippet() 가 생성한 `<mark>…</mark>` 포함 발췌. 렌더러는 split-parse 후
  // React 노드로 재구성 (innerHTML 사용 금지 — XSS 방어).
  snippet: string
}

// MCP 서버 설정 (전역) — claude-agent-sdk query 의 mcpServers / allowedTools 로 주입.
// stdio: 로컬 프로세스 (command + args). http: streamable HTTP 엔드포인트 (url).
export type McpTransport = 'stdio' | 'http'

// renderer 로 노출되는 DTO. 인증 비밀(authEnc)은 절대 포함하지 않고 보유 여부(hasAuth)만 전달.
export interface McpServer {
  id: string
  name: string
  description: string
  transport: McpTransport
  enabled: boolean
  // stdio
  command: string | null
  args: string[]
  // 인증값을 주입할 환경변수 이름 (stdio 전용, 비밀 아님)
  authEnvKey: string | null
  // http
  url: string | null
  // 인증 비밀 보유 여부 (raw 값은 main 만 safeStorage 복호화로 접근)
  hasAuth: boolean
}

// 생성/수정 요청 — 비밀값(auth)은 평문으로 전달되며 main 이 safeStorage 로 암호화 저장.
// auth 가 undefined 면 비밀 미변경(수정 시 기존 유지), 빈 문자열이면 비밀 제거.
export interface CreateMcpServerRequest {
  name: string
  description: string
  transport: McpTransport
  enabled: boolean
  command?: string
  args?: string[]
  authEnvKey?: string
  url?: string
  auth?: string
}

export interface UpdateMcpServerRequest {
  id: string
  name?: string
  description?: string
  transport?: McpTransport
  enabled?: boolean
  command?: string
  args?: string[]
  authEnvKey?: string
  url?: string
  auth?: string
}

export interface DeleteMcpServerRequest {
  id: string
}

// Python 런타임 (uv 기반 격리 인터프리터) 상태.
// 초기화 단계: idle(미시작) → preparing(진행 중) → ready(준비됨) | error(실패).
export type RuntimeStage = 'idle' | 'preparing' | 'ready' | 'error'

export interface RuntimeStatus {
  stage: RuntimeStage
  ready: boolean
  // 진행 단계 라벨 또는 자식 프로세스 stdout/stderr 누적 청크.
  log?: string
  // stage === 'error' 일 때만.
  error?: string
}

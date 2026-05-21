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
  projectListSessions: 'orca:project:listSessions'
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
  lastBackend: Backend | null
  lastSessionId: string | null
  windowBounds: WindowBounds | null
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

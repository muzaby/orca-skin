import { ipcMain, app, webContents, type WebContents, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  CHANNELS,
  SendChatMessageSchema,
  CancelChatSchema,
  StartInstallSchema,
  ListFilesRequestSchema,
  LoadSessionRequestSchema,
  DeleteSessionRequestSchema,
  RenameSessionRequestSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  DeleteProjectSchema,
  ListProjectSessionsSchema,
  SearchMessagesRequestSchema,
  DeleteMcpServerSchema,
  type BackendListResult,
  type ChatEvent,
  type FileEntry,
  type InstallStatus,
  type LoadedMessage,
  type LoadedSession,
  type LoadedToolCall,
  type McpServer,
  type Project,
  type SearchHit,
  type SessionListItem,
  type Settings,
  type SkillInfo
} from '../../shared/protocol'
import { AdapterRegistry } from '../adapters/registry'
import { Installer } from '../installer'
import { SettingsStore } from '../settings/store'
import { McpStore } from '../mcp/store'
import { scanSkills } from '../skills/scan'
import { listDir } from '../files/scan'
import { initDb, type DbQueries } from '../db'
import { PythonRuntime, PY_AGENT_RULES } from '../runtime'
import type { RuntimeStatus } from '../../shared/ipc'

interface InflightTurn {
  controller: AbortController
  // sendMessage 호출 시점에 채워두는 사용자 입력. claude-code 의 init 이벤트가
  // session_id 를 발급한 시점에 DB 에 user message row 로 저장한다.
  pendingUserText: string | null
  // init 이벤트로 확정된 DB sessionId. resume 의 경우 sendMessage 인자와 같다.
  dbSessionId: string | null
  // 새 채팅 첫 메시지일 때 renderer 가 전달한 projectId. init 이벤트의 insertSession
  // 시점에 함께 row 에 박혀 별도 UPDATE 없이 binding 이 끝난다. resume 경로면 항상 null.
  pendingProjectId: string | null
  // 현재 assistant turn 의 message row id. tool_use 가 먼저 yield 되어도 같은
  // row 에 묶이도록, assistant_message 또는 tool_use 중 먼저 도착한 쪽에서 생성.
  // assistant_message 처리 후 / tool_result 도착 시 reset 한다.
  currentAssistantMessageId: number | null
}

export class IpcRouter {
  private readonly registry = new AdapterRegistry()
  private readonly installer = new Installer(this.registry)
  private readonly inflight = new Map<WebContents, InflightTurn>()
  readonly settings = new SettingsStore()
  readonly mcp = new McpStore()
  readonly runtime = new PythonRuntime()
  // 부팅 시 1회 스캔하여 메모리에 캐시. fs.watch hot-reload 는 본 PR 범위 밖 (재시작).
  private skillsCache: SkillInfo[] = []
  // chat send 와 files list, session cwd 노출에서 모두 동일하게 사용하는 단일
  // cwd. 현재는 home 으로 고정 — 향후 사용자 선택 디렉토리로 확장 가능.
  private defaultCwd: string = ''
  private db!: DbQueries

  async start(): Promise<void> {
    this.db = initDb()
    await this.registry.refreshInstallState()
    this.defaultCwd = app.getPath('home')
    // ClaudeCodeAdapter 가 사용하는 cwd 와 동일한 값으로 스킬 스캔.
    this.skillsCache = await scanSkills(this.defaultCwd).catch(() => [])
    this.register()
    // Python 런타임 (uv 격리 인터프리터) 비동기 초기화. await 하지 않아 부팅을 막지
    // 않는다 — 진행 상태는 runtime:statusEvent 로 모든 webContents 에 스트리밍된다.
    void this.runtime.ensure()
  }

  private register(): void {
    ipcMain.handle(CHANNELS.chatSend, this.handleChatSend)
    ipcMain.handle(CHANNELS.chatCancel, this.handleChatCancel)
    ipcMain.handle(CHANNELS.backendList, this.handleBackendList)
    ipcMain.handle(CHANNELS.installStart, this.handleInstallStart)
    ipcMain.handle(CHANNELS.settingsGet, this.handleSettingsGet)
    ipcMain.handle(CHANNELS.settingsSet, this.handleSettingsSet)
    ipcMain.handle(CHANNELS.skillsList, this.handleSkillsList)
    ipcMain.handle(CHANNELS.filesList, this.handleFilesList)
    ipcMain.handle(CHANNELS.sessionCwd, this.handleSessionCwd)
    ipcMain.handle(CHANNELS.sessionList, this.handleSessionList)
    ipcMain.handle(CHANNELS.sessionLoad, this.handleSessionLoad)
    ipcMain.handle(CHANNELS.sessionDelete, this.handleSessionDelete)
    ipcMain.handle(CHANNELS.sessionRename, this.handleSessionRename)
    ipcMain.handle(CHANNELS.projectList, this.handleProjectList)
    ipcMain.handle(CHANNELS.projectCreate, this.handleProjectCreate)
    ipcMain.handle(CHANNELS.projectUpdate, this.handleProjectUpdate)
    ipcMain.handle(CHANNELS.projectDelete, this.handleProjectDelete)
    ipcMain.handle(CHANNELS.projectListSessions, this.handleProjectListSessions)
    ipcMain.handle(CHANNELS.searchMessages, this.handleSearchMessages)
    ipcMain.handle(CHANNELS.mcpList, this.handleMcpList)
    ipcMain.handle(CHANNELS.mcpAdd, this.handleMcpAdd)
    ipcMain.handle(CHANNELS.mcpUpdate, this.handleMcpUpdate)
    ipcMain.handle(CHANNELS.mcpDelete, this.handleMcpDelete)
    ipcMain.handle(CHANNELS.runtimeStatus, this.handleRuntimeStatus)
    ipcMain.handle(CHANNELS.runtimePrepare, this.handleRuntimePrepare)
    // 런타임 초기화 진행 상태를 모든 창에 브로드캐스트.
    this.runtime.on('status', (st: RuntimeStatus) => {
      for (const wc of webContents.getAllWebContents()) {
        if (!wc.isDestroyed()) wc.send(CHANNELS.runtimeStatusEvent, st)
      }
    })
  }

  private sendChatEvent(wc: WebContents, ev: ChatEvent): void {
    if (!wc.isDestroyed()) wc.send(CHANNELS.chatEvent, ev)
  }

  private sendInstallStatus(wc: WebContents, st: InstallStatus): void {
    if (!wc.isDestroyed()) wc.send(CHANNELS.installStatus, st)
  }

  private handleChatSend = async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = SendChatMessageSchema.safeParse(raw)
    if (!parsed.success) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        data: {
          code: 'internal',
          message: 'invalid chat:send payload',
          recoverable: false
        }
      })
      return
    }

    const adapter = this.registry.getActive()
    if (!adapter) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        data: {
          code: 'cli.not-installed',
          message: '활성 백엔드가 없습니다.',
          recoverable: true
        }
      })
      return
    }

    const controller = new AbortController()
    // resume 경로면 sessions row 에 이미 binding 된 projectId 가 있으므로 그쪽에서 조회.
    // 새 채팅 경로(sessionId=null)면 renderer 가 보낸 projectId 를 init 시점에 binding.
    const turn: InflightTurn = {
      controller,
      pendingUserText: parsed.data.text,
      dbSessionId: parsed.data.sessionId,
      pendingProjectId: parsed.data.sessionId ? null : parsed.data.projectId,
      currentAssistantMessageId: null
    }
    this.inflight.set(event.sender, turn)

    // 프로젝트 지침 조회. 매 send 마다 1회 prepared statement — DB SSOT, 캐시 없음.
    // 따라서 지침 편집이 같은 세션의 다음 메시지부터 즉시 반영된다.
    let systemPromptAppend: string | undefined
    if (parsed.data.sessionId) {
      const ins = this.db.getProjectInstructionsForSession(parsed.data.sessionId)
      if (ins && ins.trim() !== '') systemPromptAppend = ins
    } else if (parsed.data.projectId) {
      const p = this.db.getProject(parsed.data.projectId)
      if (p && p.instructions.trim() !== '') systemPromptAppend = p.instructions
    }

    // resume 경로: sessionId 가 들어왔다는 건 이전 init 으로 sessions row 가 이미
    // 존재한다는 의미. 다음 init 이벤트를 기다리지 않고 user 메시지를 즉시 기록.
    if (parsed.data.sessionId) {
      const now = Date.now()
      this.db.appendMessage({
        sessionId: parsed.data.sessionId,
        role: 'user',
        content: parsed.data.text,
        createdAt: now
      })
      this.db.updateSessionPreview(parsed.data.sessionId, previewOf(parsed.data.text), now)
      turn.pendingUserText = null
    }

    // Python 런타임 도구 사용 규약을 항상 시스템 프롬프트에 합류. 프로젝트 지침이
    // 있으면 그 뒤에 붙인다 (둘 다 SDK 기본 claude_code preset 뒤로 append).
    const promptAppend = systemPromptAppend
      ? `${systemPromptAppend}\n\n${PY_AGENT_RULES}`
      : PY_AGENT_RULES

    // 전역 MCP 설정 — 활성화된 서버를 query 옵션(mcpServers + allowedTools)으로 주입.
    const mcpOptions = this.mcp.buildQueryOptions()

    // Python 런타임 env (uv 격리). ready 전이면 null → SDK 기본 env 로 동작.
    const pyEnv = this.runtime.getEnv() ?? undefined

    const cwd = this.defaultCwd
    try {
      for await (const ev of adapter.sendMessage(
        parsed.data.sessionId,
        parsed.data.text,
        cwd,
        controller.signal,
        promptAppend,
        mcpOptions,
        pyEnv
      )) {
        this.persist(turn, ev)
        this.sendChatEvent(event.sender, ev)
      }
    } catch (err) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        data: {
          code: 'internal',
          message: err instanceof Error ? err.message : String(err),
          recoverable: false
        }
      })
    } finally {
      this.inflight.delete(event.sender)
    }
  }

  // 어댑터가 yield 한 ChatEvent 를 DB 에 기록. tool_use 가 assistant_message 보다
  // 먼저 도착해도 같은 message row 에 묶이도록 currentAssistantMessageId 를 유지한다.
  // 새 SDKAssistantMessage 의 경계는 assistant_message 완료 시점 또는 tool_result
  // 도착 시점에서 reset 한다 — SDK 가 한 turn 안에서 (assistant → user(tool_result)
  // → assistant) 순으로 메시지를 흘리기 때문.
  private persist(turn: InflightTurn, ev: ChatEvent): void {
    const now = Date.now()
    switch (ev.type) {
      case 'init': {
        const sessionId = ev.data.sessionId
        turn.dbSessionId = sessionId
        const title = turn.pendingUserText ? previewOf(turn.pendingUserText, 60) : null
        this.db.insertSession({
          id: sessionId,
          backend: 'claude-code',
          title,
          projectId: turn.pendingProjectId,
          createdAt: now
        })
        if (turn.pendingUserText) {
          this.db.appendMessage({
            sessionId,
            role: 'user',
            content: turn.pendingUserText,
            createdAt: now
          })
          this.db.updateSessionPreview(sessionId, previewOf(turn.pendingUserText), now)
          if (title) this.db.updateSessionTitle(sessionId, title)
          turn.pendingUserText = null
        }
        break
      }
      case 'tool_use': {
        if (!turn.dbSessionId) break
        if (turn.currentAssistantMessageId == null) {
          turn.currentAssistantMessageId = this.db.appendMessage({
            sessionId: turn.dbSessionId,
            role: 'assistant',
            content: '',
            createdAt: now
          })
        }
        this.db.appendToolCall({
          messageId: turn.currentAssistantMessageId,
          toolUseId: ev.data.toolUseId,
          name: ev.data.name,
          inputJson: JSON.stringify(ev.data.input ?? null)
        })
        break
      }
      case 'assistant_message': {
        if (!turn.dbSessionId) break
        if (turn.currentAssistantMessageId != null) {
          this.db.updateMessageContent(turn.currentAssistantMessageId, ev.data.text)
        } else {
          turn.currentAssistantMessageId = this.db.appendMessage({
            sessionId: turn.dbSessionId,
            role: 'assistant',
            content: ev.data.text,
            createdAt: now
          })
        }
        this.db.updateSessionPreview(turn.dbSessionId, previewOf(ev.data.text), now)
        turn.currentAssistantMessageId = null
        break
      }
      case 'tool_result': {
        this.db.updateToolCallResult(
          ev.data.toolUseId,
          JSON.stringify(ev.data.output ?? null),
          ev.data.isError ? 'error' : 'ok'
        )
        turn.currentAssistantMessageId = null
        break
      }
      // assistant_delta 는 transient 라 DB 미저장. result / error 는 별도 row 없음.
    }
  }

  private handleChatCancel = async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    CancelChatSchema.parse(raw)
    const turn = this.inflight.get(event.sender)
    if (turn) turn.controller.abort()
  }

  private handleBackendList = async (): Promise<BackendListResult> => {
    const backends = this.registry.list()
    const active = this.registry.getActiveId() ?? undefined
    return { backends, ...(active ? { active } : {}) }
  }

  private handleInstallStart = async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = StartInstallSchema.parse(raw)
    for await (const st of this.installer.start(parsed.backend)) {
      this.sendInstallStatus(event.sender, st)
    }
  }

  private handleSettingsGet = async (): Promise<Settings> => {
    return this.settings.getAll()
  }

  private handleSettingsSet = async (
    _event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<Settings> => {
    return this.settings.patch(raw)
  }

  private handleSkillsList = async (): Promise<SkillInfo[]> => {
    return this.skillsCache
  }

  private handleFilesList = async (
    _event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<FileEntry[]> => {
    const parsed = ListFilesRequestSchema.safeParse(raw)
    if (!parsed.success) return []
    return listDir(parsed.data.cwd, parsed.data.relDir)
  }

  // Renderer 가 세션 init 이벤트 전에도 cwd 를 알 수 있도록 노출. chat send 와
  // 동일한 cwd 단일 소스 — 현재는 home 고정.
  private handleSessionCwd = async (): Promise<string> => {
    return this.defaultCwd
  }

  private handleSessionList = async (): Promise<SessionListItem[]> => {
    return this.db.listSessions().map(toSessionListItem)
  }

  private handleSessionLoad = async (
    _event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<LoadedSession | null> => {
    const parsed = LoadSessionRequestSchema.safeParse(raw)
    if (!parsed.success) return null

    const rows = this.db.loadMessages(parsed.data.sessionId)
    if (rows.length === 0) return null
    const sessions = this.db.listSessions(1000)
    const meta = sessions.find((s) => s.id === parsed.data.sessionId)
    if (!meta) return null

    const tools = this.db.loadToolCalls(parsed.data.sessionId)
    const toolsByMessage = new Map<number, LoadedToolCall[]>()
    for (const tc of tools) {
      const result =
        tc.result_json == null
          ? undefined
          : {
              output: safeJsonParse(tc.result_json),
              isError: tc.status === 'error'
            }
      const call: LoadedToolCall = {
        toolUseId: tc.tool_use_id,
        name: tc.name,
        input: safeJsonParse(tc.input_json),
        ...(result ? { result } : {})
      }
      const list = toolsByMessage.get(tc.message_id) ?? []
      list.push(call)
      toolsByMessage.set(tc.message_id, list)
    }

    const messages: LoadedMessage[] = rows.map((m) => {
      const calls = toolsByMessage.get(m.id)
      return {
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        ...(calls && calls.length > 0 ? { toolCalls: calls } : {})
      }
    })

    return {
      id: meta.id,
      backend: meta.backend,
      title: meta.title,
      messages
    }
  }

  private handleSessionDelete = async (_event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = DeleteSessionRequestSchema.safeParse(raw)
    if (!parsed.success) return
    this.db.deleteSession(parsed.data.sessionId)
    // 영속화된 lastSessionId 가 삭제 대상이면 같이 해제.
    const current = this.settings.getAll()
    if (current.lastSessionId === parsed.data.sessionId) {
      this.settings.patch({ lastSessionId: null })
    }
  }

  private handleSessionRename = async (_event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = RenameSessionRequestSchema.safeParse(raw)
    if (!parsed.success) return
    this.db.renameSession(parsed.data.sessionId, parsed.data.title, Date.now())
  }

  private handleProjectList = async (): Promise<Project[]> => {
    return this.db.listProjects().map(toProject)
  }

  private handleProjectCreate = async (
    _event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<Project> => {
    const parsed = CreateProjectSchema.parse(raw)
    const id = randomUUID()
    const now = Date.now()
    this.db.insertProject({
      id,
      name: parsed.name,
      instructions: parsed.instructions,
      createdAt: now
    })
    return {
      id,
      name: parsed.name,
      instructions: parsed.instructions,
      createdAt: now,
      updatedAt: now
    }
  }

  private handleProjectUpdate = async (_event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = UpdateProjectSchema.parse(raw)
    this.db.updateProject(
      parsed.id,
      { name: parsed.name, instructions: parsed.instructions },
      Date.now()
    )
  }

  private handleProjectDelete = async (_event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = DeleteProjectSchema.parse(raw)
    // ON DELETE SET NULL 이 sessions.project_id 를 정리. 세션 자체는 보존.
    this.db.deleteProject(parsed.id)
  }

  private handleProjectListSessions = async (
    _event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<SessionListItem[]> => {
    const parsed = ListProjectSessionsSchema.parse(raw)
    return this.db.listSessionsByProject(parsed.projectId).map(toSessionListItem)
  }

  // 대화 검색 — main thread 에서 FTS5 prepared statement 실행. better-sqlite3 가
  // sync 라 main 이 블록되지만 FTS5 + LIMIT 30 의 latency 는 단위 ms 수준으로
  // renderer 의 150ms debounce 하에서 체감 영향 없음. perf 회귀 발생 시 utilityProcess
  // 로 이전 검토 (계획 문서 §Worker thread 보류 근거).
  private handleSearchMessages = async (
    _event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<SearchHit[]> => {
    const parsed = SearchMessagesRequestSchema.safeParse(raw)
    if (!parsed.success) return []
    const rows = this.db.searchMessages(parsed.data.q, parsed.data.limit ?? 30)
    return rows.map((r) => ({
      messageId: r.message_id,
      sessionId: r.session_id,
      sessionTitle: r.session_title,
      role: r.role,
      createdAt: r.created_at,
      snippet: r.snippet
    }))
  }

  private handleMcpList = async (): Promise<McpServer[]> => {
    return this.mcp.list()
  }

  private handleMcpAdd = async (_event: IpcMainInvokeEvent, raw: unknown): Promise<McpServer> => {
    return this.mcp.add(raw)
  }

  private handleMcpUpdate = async (
    _event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<McpServer | null> => {
    return this.mcp.update(raw)
  }

  private handleMcpDelete = async (_event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    const parsed = DeleteMcpServerSchema.parse(raw)
    this.mcp.remove(parsed.id)
  }

  // 현재 런타임 상태 조회 (renderer 마운트 시점의 초기 동기화용). 인자 없음.
  private handleRuntimeStatus = async (): Promise<RuntimeStatus> => {
    return this.runtime.status
  }

  // 실패 후 재시도 또는 수동 준비 트리거. 진행 상태는 statusEvent 로 별도 스트리밍.
  private handleRuntimePrepare = async (): Promise<void> => {
    await this.runtime.retry()
  }
}

function previewOf(text: string, max = 80): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? collapsed.slice(0, max) : collapsed
}

function toSessionListItem(r: {
  id: string
  backend: 'claude-code'
  title: string | null
  updated_at: number
  last_message_preview: string | null
  project_id: string | null
}): SessionListItem {
  return {
    id: r.id,
    backend: r.backend,
    title: r.title,
    updatedAt: r.updated_at,
    preview: r.last_message_preview,
    projectId: r.project_id
  }
}

function toProject(r: {
  id: string
  name: string
  instructions: string
  created_at: number
  updated_at: number
}): Project {
  return {
    id: r.id,
    name: r.name,
    instructions: r.instructions,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

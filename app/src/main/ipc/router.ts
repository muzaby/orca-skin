import { ipcMain, app, type WebContents, type IpcMainInvokeEvent } from 'electron'
import {
  CHANNELS,
  SendChatMessageSchema,
  CancelChatSchema,
  StartInstallSchema,
  ListFilesRequestSchema,
  LoadSessionRequestSchema,
  DeleteSessionRequestSchema,
  RenameSessionRequestSchema,
  type BackendListResult,
  type ChatEvent,
  type FileEntry,
  type InstallStatus,
  type LoadedMessage,
  type LoadedSession,
  type LoadedToolCall,
  type SessionListItem,
  type Settings,
  type SkillInfo
} from '../../shared/protocol'
import { AdapterRegistry } from '../adapters/registry'
import { Installer } from '../installer'
import { SettingsStore } from '../settings/store'
import { scanSkills } from '../skills/scan'
import { listDir } from '../files/scan'
import { initDb, type DbQueries } from '../db'

interface InflightTurn {
  controller: AbortController
  // sendMessage 호출 시점에 채워두는 사용자 입력. claude-code 의 init 이벤트가
  // session_id 를 발급한 시점에 DB 에 user message row 로 저장한다.
  pendingUserText: string | null
  // init 이벤트로 확정된 DB sessionId. resume 의 경우 sendMessage 인자와 같다.
  dbSessionId: string | null
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
    const turn: InflightTurn = {
      controller,
      pendingUserText: parsed.data.text,
      dbSessionId: parsed.data.sessionId,
      currentAssistantMessageId: null
    }
    this.inflight.set(event.sender, turn)

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

    const cwd = this.defaultCwd
    try {
      for await (const ev of adapter.sendMessage(
        parsed.data.sessionId,
        parsed.data.text,
        cwd,
        controller.signal
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
    return this.db.listSessions().map((r) => ({
      id: r.id,
      backend: r.backend,
      title: r.title,
      updatedAt: r.updated_at,
      preview: r.last_message_preview
    }))
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
}

function previewOf(text: string, max = 80): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > max ? collapsed.slice(0, max) : collapsed
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

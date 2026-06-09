import { ipcMain, app, webContents, type WebContents, type IpcMainInvokeEvent } from 'electron'
import { is } from '@electron-toolkit/utils'
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
  PermissionRespondSchema,
  SetPermissionModeSchema,
  type BackendListResult,
  type FileEntry,
  type InstallStatus,
  type AppMessagePart,
  type LoadedMessage,
  type LoadedSession,
  type McpServer,
  type Project,
  type SearchHit,
  type SessionListItem,
  type Settings,
  type SkillInfo
} from '../../shared/protocol'
import { usageRowToTelemetry, hasContextTokens } from '../usage/usageMap'
import { AdapterRegistry } from '../adapters/registry'
import { Installer } from '../installer'
import { SettingsStore } from '../settings/store'
import { McpStore } from '../mcp/store'
import { migrateMcpToFile } from '../mcp/migrate'
import { ensureConfigDir } from '../config/paths'
import { migrateConfigToSources } from '../config/migrate-sources'
import { deploy } from '../deploy/deployer'
import { scanSkills } from '../skills/scan'
import { listDir } from '../files/scan'
import { initDb, type DbQueries } from '../db'
import type { LoadedPartRow } from '../db/types'
import { PythonRuntime, PY_AGENT_RULES } from '../runtime'
import { ExtensionBuilder } from '../extensions/builder'
import { InteractionBroker } from '../ask/broker'
import { agentPermissionRequest } from '../runtime-events/permission-bridge'
import { PermissionModeController } from '../runtime-events/permission-mode-controller'
import { toClaudePermissionMode } from '../../shared/permission-mode'
import type { LiveTurn } from '../adapters/types'
import { makeClassifiedError } from '../runtime-errors/classifier'
import { claudeErrorClassifier } from '../runtime-errors/claude-classifier'
import type {
  ApprovalResolution,
  NormalizedEvent,
  PermissionAction,
  RuntimeStatus
} from '../../shared/ipc'

interface InflightTurn {
  controller: AbortController
  // 이 턴의 라이브 핸들 (PR③). orca:permission:setMode 가 진행 중 턴이면 여기로 모드를 즉시
  // 전환한다(Query.setPermissionMode). sendMessage 직후 채워진다.
  live: LiveTurn | null
  // sendMessage 호출 시점에 채워두는 사용자 입력. claude-code 의 init 이벤트가
  // session_id 를 발급한 시점에 DB 에 user message row 로 저장한다.
  pendingUserText: string | null
  // init 이벤트로 확정된 DB sessionId. resume 의 경우 sendMessage 인자와 같다.
  dbSessionId: string | null
  // 새 채팅 첫 메시지일 때 renderer 가 전달한 projectId. init 이벤트의 insertSession
  // 시점에 함께 row 에 박혀 별도 UPDATE 없이 binding 이 끝난다. resume 경로면 항상 null.
  pendingProjectId: string | null
  // 현재 assistant turn 의 message row id. 한 턴의 모든 파트(reasoning/text/tool_*/error)를
  // 같은 메시지에 순서대로 누적하고, 턴 종료(telemetry) 시 reset 한다.
  currentAssistantMessageId: number | null
  // 현재 assistant 메시지의 text 파트 누적본 — messages.content(FTS5 캐시) 동기화용.
  // currentAssistantMessageId 갱신 시 함께 ''로 리셋.
  assistantText: string
  // AskUserQuestion 답변 영속. SDK 는 canUseTool 의 answers 를 메시지 스트림으로 되돌리지
  // 않으므로(answers 담은 tool_result 미발행), router 가 answer 와 tool_use id 가 모두
  // 확보되는 시점에 tool_result 를 합성한다(flushAskAnswers). 2-큐로 도착 순서 무관.
  pendingAskAnswers: Array<{ answers: Record<string, string | string[]>; response?: string }>
  // 답을 아직 못 받은 AskUserQuestion tool_use id 들(FIFO).
  askPendingIds: string[]
  // 합성 완료된 id → answers. 실제 tool_result 가 뒤늦게 와도 clobber 하지 않도록 재주입용.
  askResolved: Map<string, { answers: Record<string, string | string[]>; response?: string }>
}

export class IpcRouter {
  readonly settings = new SettingsStore()
  readonly mcp = new McpStore(this.settings)
  // resolver 팩토리를 lazy arrow 로 넘긴다 — 호출은 턴 실행 시점이라 this.mcp 가 이미 할당돼 있다
  // (field-init 순서 무관). 비밀 확장은 어댑터의 어댑트 시점에만.
  private readonly registry = new AdapterRegistry(() => this.mcp.resolver())
  private readonly installer = new Installer(this.registry)
  private readonly inflight = new Map<WebContents, InflightTurn>()
  // canUseTool(AskUserQuestion / ExitPlanMode / 위험 도구) ↔ renderer 응답을 잇는 단일 Promise
  // 다리. approvalId 로 키잉되며 ApprovalResolution(allow/deny 2분기)으로 해소된다.
  private readonly approvals = new InteractionBroker<ApprovalResolution>()
  // "세션 동안 허용"으로 부여된 도구 — 같은 세션의 이후 턴에서 카드 없이 자동 허용. 키 =
  // dbSessionId, 값 = 허용된 toolName 집합. 프로세스 메모리에만 보존(영속 안 함).
  private readonly sessionAllowedTools = new Map<string, Set<string>>()
  // 세션별 권한 모드 SSOT (PR②/③). orca:permission:setMode 와 handleChatSend 가 갱신한다.
  private readonly permissionModes = new PermissionModeController()
  readonly runtime = new PythonRuntime()
  // 부팅 시 1회 스캔하여 메모리에 캐시. fs.watch hot-reload 는 본 PR 범위 밖 (재시작).
  private skillsCache: SkillInfo[] = []
  // chat send 와 files list, session cwd 노출에서 모두 동일하게 사용하는 단일
  // cwd. 현재는 home 으로 고정 — 향후 사용자 선택 디렉토리로 확장 가능.
  private defaultCwd: string = ''
  private db!: DbQueries
  // Extension 계층 조립기. db 가 !-asserted 라 field-init 시점엔 undefined → start() 에서 initDb() 이후 생성.
  private extensions!: ExtensionBuilder

  async start(): Promise<void> {
    this.db = initDb()
    // 빌더는 db 인스턴스가 필요해 여기서 생성(field-init 금지). skills 는 lazy getter 라 스캔
    // 완료 전에 만들어도 무방 — 턴 실행 시점에 최신 skillsCache 를 읽는다.
    this.extensions = new ExtensionBuilder(
      this.db,
      this.mcp,
      () => this.skillsCache,
      PY_AGENT_RULES
    )
    await this.registry.refreshInstallState()
    this.defaultCwd = app.getPath('home')
    // ~/.config/orca 보장 → sources/ 레이아웃 이전(1회) → 레거시 MCP 이전(1회) →
    // 정규 소스 → dist/<engine> 배포(ExtensionDeployer). 어느 단계 실패도 부팅을 막지
    // 않는다(채팅/세션 기능은 독립). sources 이전이 MCP 이전보다 먼저여야 한다 —
    // 구 루트 mcp.json 을 sources/mcp/ 로 옮긴 뒤 mcpFileExists() 가 sources/ 를 보게.
    await ensureConfigDir().catch((e) => console.warn('[boot] ensureConfigDir 실패:', e))
    try {
      migrateConfigToSources()
    } catch (e) {
      console.warn('[boot] sources 마이그레이션 건너뜀:', e)
    }
    try {
      migrateMcpToFile(this.settings)
    } catch (e) {
      console.warn('[boot] MCP 마이그레이션 건너뜀:', e)
    }
    try {
      const r = deploy('claude-code')
      if (!r.validation.ok) {
        for (const err of r.validation.errors) console.warn('[deploy] 검증 경고:', err)
      }
    } catch (e) {
      console.warn('[boot] 배포 건너뜀:', e)
    }
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
    ipcMain.handle(CHANNELS.permissionRespond, this.handlePermissionRespond)
    ipcMain.handle(CHANNELS.permissionSetMode, this.handlePermissionSetMode)
    // 런타임 초기화 진행 상태를 모든 창에 브로드캐스트.
    // 렌더러 런타임 UI 가 제거되어 dev 에선 터미널 로깅으로 진행/에러를 관찰한다.
    this.runtime.on('status', (st: RuntimeStatus) => {
      if (is.dev) {
        if (st.stage === 'error') console.error('[runtime] error:', st.error)
        else console.log('[runtime]', st.stage, st.log ?? '')
      }
      for (const wc of webContents.getAllWebContents()) {
        if (!wc.isDestroyed()) wc.send(CHANNELS.runtimeStatusEvent, st)
      }
    })
  }

  private sendChatEvent(wc: WebContents, ev: NormalizedEvent): void {
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
        provider: 'claude-code',
        error: makeClassifiedError('schema_validation_error', 'invalid chat:send payload', {
          retryable: false,
          provider: 'claude-code'
        })
      })
      return
    }

    const adapter = this.registry.getActive()
    if (!adapter) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        provider: 'claude-code',
        error: makeClassifiedError('provider_connection_error', '활성 백엔드가 없습니다.', {
          retryable: true,
          provider: 'claude-code'
        })
      })
      return
    }

    const controller = new AbortController()
    // resume 경로면 sessions row 에 이미 binding 된 projectId 가 있으므로 그쪽에서 조회.
    // 새 채팅 경로(sessionId=null)면 renderer 가 보낸 projectId 를 init 시점에 binding.
    const turn: InflightTurn = {
      controller,
      live: null,
      pendingUserText: parsed.data.text,
      dbSessionId: parsed.data.sessionId,
      pendingProjectId: parsed.data.sessionId ? null : parsed.data.projectId,
      currentAssistantMessageId: null,
      assistantText: '',
      pendingAskAnswers: [],
      askPendingIds: [],
      askResolved: new Map()
    }
    this.inflight.set(event.sender, turn)

    // resume 경로: sessionId 가 들어왔다는 건 이전 init 으로 sessions row 가 이미
    // 존재한다는 의미. 다음 init 이벤트를 기다리지 않고 user 메시지를 즉시 기록.
    if (parsed.data.sessionId) {
      const now = Date.now()
      this.persistUserMessage(parsed.data.sessionId, parsed.data.text, now)
      this.db.updateSessionPreview(parsed.data.sessionId, previewOf(parsed.data.text), now)
      turn.pendingUserText = null
    }

    // 백엔드 중립 확장 리소스(지침+PY_AGENT_RULES · MCP · skills · hooks)를 빌더가 조립.
    // resume 면 projectId 는 세션 바인딩에서 조회되므로 null 을 넘긴다.
    const extensions = this.extensions.build(
      parsed.data.sessionId,
      parsed.data.sessionId ? null : parsed.data.projectId
    )

    // Python 런타임 env (uv 격리) 는 확장 묶음이 아니라 TurnRequest 직속. ready 전이면 SDK 기본 env.
    const pyEnv = this.runtime.getEnv() ?? undefined

    // 단일 권한 승인 위임 — 어댑터의 canUseTool 이 ask_question·plan_review·tool_approval 중
    // 하나를 PermissionAction 으로 넘기면, approvalId 를 발급해 permission.requested 이벤트로
    // renderer 에 surface 하고 broker 가 응답(또는 turn abort)까지 Promise 를 보류한다.
    // tool_approval 은 "세션 동안 허용"으로 부여된 도구면 카드 없이 즉시 allow 한다.
    const wc = event.sender
    const requestApproval = async (action: PermissionAction): Promise<ApprovalResolution> => {
      // 세션 자동 허용된 위험 도구는 카드 미surface — 즉시 통과.
      if (action.kind === 'tool_approval') {
        const sid = turn.dbSessionId
        if (sid && this.sessionAllowedTools.get(sid)?.has(action.toolName)) {
          return { behavior: 'allow' }
        }
      }
      const approvalId = randomUUID()
      // 어댑터가 넘긴 request.requestId 는 비어 있으므로 approvalId 를 주입한다 — renderer 의
      // 카드(pendingAsks/pendingPlanReview)가 이 id 로 permissionRespond 회신할 수 있게.
      const outbound: PermissionAction =
        action.kind === 'tool_approval'
          ? action
          : action.kind === 'ask_question'
            ? { kind: 'ask_question', request: { ...action.request, requestId: approvalId } }
            : { kind: 'plan_review', request: { ...action.request, requestId: approvalId } }
      this.sendChatEvent(wc, agentPermissionRequest('claude-code', approvalId, outbound))
      const resolution = await this.approvals.register(approvalId, controller.signal, {
        behavior: 'deny'
      })
      // ask_question 후처리 — 답변을 큐에 적재 후 즉시 페어링 시도(tool_use id 가 먼저 와
      // 있을 수도 있다). SDK 가 answers 를 메시지 스트림으로 안 돌려주므로 router 가 합성한다.
      if (action.kind === 'ask_question' && resolution.behavior === 'allow') {
        const ui = (resolution.updatedInput ?? {}) as {
          answers?: Record<string, string | string[]>
          response?: unknown
        }
        turn.pendingAskAnswers.push({
          answers: ui.answers ?? {},
          ...(typeof ui.response === 'string' ? { response: ui.response } : {})
        })
        this.flushAskAnswers(turn, wc)
      }
      return resolution
    }

    // 세션 모드 SSOT 동기화 — resume 경로(sessionId 확정)에서 이번 턴 모드를 controller 에 기록.
    // 라이브 전환(setMode IPC)과 다음 턴이 같은 출처를 읽도록 한다.
    if (parsed.data.sessionId && parsed.data.permissionMode) {
      void this.permissionModes.setMode(parsed.data.sessionId, parsed.data.permissionMode)
    }

    const cwd = this.defaultCwd
    try {
      // sendMessage 가 query() 를 즉시 시작하므로 try 안에서 호출 — 동기 throw 도 동일 경로로 분류.
      const live = adapter.sendMessage({
        sessionId: parsed.data.sessionId,
        text: parsed.data.text,
        cwd,
        signal: controller.signal,
        extensions,
        env: pyEnv,
        requestApproval,
        permissionMode: parsed.data.permissionMode
      })
      turn.live = live
      for await (const ev of live.events) {
        this.persist(turn, ev)
        this.sendChatEvent(event.sender, ev)
        // AskUserQuestion tool 호출이 도착하면 id 를 페어링 큐에 넣고 답변과 매칭 시도.
        if (ev.type === 'tool.call.started' && ev.toolName === 'AskUserQuestion') {
          turn.askPendingIds.push(ev.toolRunId)
          this.flushAskAnswers(turn, event.sender)
        }
      }
    } catch (err) {
      this.sendChatEvent(event.sender, {
        type: 'error',
        provider: 'claude-code',
        error: claudeErrorClassifier.classify(err, {
          provider: 'claude-code',
          phase: 'sendMessage'
        })
      })
    } finally {
      this.inflight.delete(event.sender)
    }
  }

  // AskUserQuestion 답변과 tool_use id 를 페어링해 tool_result 를 합성한다(SDK 가 answers 를
  // 안 돌려주므로). 페어가 생길 때마다 DB 저장 + renderer 로 tool_result ChatEvent 전송 →
  // 카드가 결과를 받아 '질문 중'→'요청됨' 으로 전이하고 AskExchange 가 답변 버블을 렌더한다.
  private flushAskAnswers(turn: InflightTurn, wc: WebContents): void {
    while (turn.pendingAskAnswers.length > 0 && turn.askPendingIds.length > 0) {
      const toolUseId = turn.askPendingIds.shift()!
      const a = turn.pendingAskAnswers.shift()!
      const output = {
        answers: a.answers,
        ...(a.response !== undefined ? { response: a.response } : {})
      }
      turn.askResolved.set(toolUseId, a)
      // AskUserQuestion 은 SDK tool_result 가 안 오므로 합성 — 현재 assistant 메시지에
      // tool_result 파트를 upsert(실제 tool_result 가 늦게 와도 같은 toolRunId 로 덮어쓴다).
      if (turn.currentAssistantMessageId != null) {
        this.db.upsertToolResultPart(
          turn.currentAssistantMessageId,
          toolUseId,
          JSON.stringify({ result: output, isError: false })
        )
      }
      this.sendChatEvent(wc, {
        type: 'tool.call.completed',
        sessionId: turn.dbSessionId ?? '',
        provider: 'claude-code',
        toolRunId: toolUseId,
        result: output,
        isError: false
      })
    }
  }

  // 현재 assistant 메시지를 보장(없으면 빈 메시지 생성 + text 캐시 리셋)하고 id 를 반환한다.
  // 한 턴의 reasoning/text/tool_*/error 파트를 같은 메시지에 순서대로 묶기 위한 진입점.
  private ensureAssistantMessage(turn: InflightTurn, sessionId: string): number {
    if (turn.currentAssistantMessageId == null) {
      turn.currentAssistantMessageId = this.db.appendMessage({
        sessionId,
        role: 'assistant',
        content: '',
        createdAt: Date.now()
      })
      turn.assistantText = ''
    }
    return turn.currentAssistantMessageId
  }

  // user 메시지 1건을 messages row + text 파트로 영속한다(content 는 FTS5 캐시).
  private persistUserMessage(sessionId: string, text: string, createdAt: number): void {
    const id = this.db.appendMessage({ sessionId, role: 'user', content: text, createdAt })
    this.db.appendPart({
      messageId: id,
      type: 'text',
      toolRunId: null,
      payloadJson: JSON.stringify({ text })
    })
  }

  // 어댑터가 yield 한 NormalizedEvent 를 DB 에 순서 보존 parts 로 기록(provider-runtime.md §7).
  // 한 턴의 모든 assistant 파트는 같은 메시지에 누적되고 telemetry(턴 종료)에서 reset 한다.
  private persist(turn: InflightTurn, ev: NormalizedEvent): void {
    const now = Date.now()
    switch (ev.type) {
      case 'session.updated': {
        // claude 의 system/init — sessionId 발급 시점. sessions row 생성 + 대기 user 메시지 기록.
        const sessionId = ev.sessionId
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
          this.persistUserMessage(sessionId, turn.pendingUserText, now)
          this.db.updateSessionPreview(sessionId, previewOf(turn.pendingUserText), now)
          if (title) this.db.updateSessionTitle(sessionId, title)
          turn.pendingUserText = null
        }
        break
      }
      case 'message.reasoning': {
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'reasoning',
          toolRunId: null,
          payloadJson: JSON.stringify({
            text: ev.text,
            ...(ev.signature !== undefined ? { signature: ev.signature } : {})
          })
        })
        break
      }
      case 'tool.call.started': {
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'tool_call',
          toolRunId: ev.toolRunId,
          payloadJson: JSON.stringify({ toolName: ev.toolName, args: ev.args ?? null })
        })
        break
      }
      case 'message.completed': {
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'text',
          toolRunId: null,
          payloadJson: JSON.stringify({ text: ev.message.text })
        })
        turn.assistantText += ev.message.text
        this.db.updateMessageContent(id, turn.assistantText)
        this.db.updateSessionPreview(turn.dbSessionId, previewOf(ev.message.text), now)
        break
      }
      case 'tool.call.completed': {
        if (!turn.dbSessionId) break
        // 합성으로 이미 답변을 채운 AskUserQuestion id 에 실제 tool_result 가 뒤늦게 오면
        // 저장된 answers 로 재주입해 빈 output 으로 덮어쓰지 않게 한다.
        const resolved = turn.askResolved.get(ev.toolRunId)
        if (resolved) {
          ev.result = {
            answers: resolved.answers,
            ...(resolved.response !== undefined ? { response: resolved.response } : {})
          }
        }
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.upsertToolResultPart(
          id,
          ev.toolRunId,
          JSON.stringify({
            result: ev.result ?? null,
            isError: ev.isError,
            ...(ev.durationMs !== undefined ? { durationMs: ev.durationMs } : {})
          })
        )
        break
      }
      case 'error': {
        if (!turn.dbSessionId) break
        const id = this.ensureAssistantMessage(turn, turn.dbSessionId)
        this.db.appendPart({
          messageId: id,
          type: 'error',
          toolRunId: null,
          payloadJson: JSON.stringify({ error: ev.error })
        })
        break
      }
      case 'telemetry': {
        // 턴 종료 — 사용량 1행을 원장(usage_events)에 적재. 시간/모델별 집계(추후 usage 화면) +
        // 세션 최신 행에서 컨텍스트 도넛/패널 복원의 원천. usage 없거나 컨텍스트 0(/context 등
        // 로컬 슬래시 명령 — 모델 미호출)이면 스킵 — 빈 행이 최신 행으로 도넛을 0으로 덮지 않게.
        const u = ev.usage
        if (turn.dbSessionId && u && hasContextTokens(u)) {
          this.db.insertUsageEvent({
            sessionId: turn.dbSessionId,
            model: u.model ?? null,
            createdAt: now,
            inputTokens: u.inputTokens ?? null,
            outputTokens: u.outputTokens ?? null,
            cacheReadTokens: u.cacheReadTokens ?? null,
            cacheCreationTokens: u.cacheCreationTokens ?? null,
            costUsd: u.costUsd ?? null
          })
        }
        // 다음 assistant 파트는 새 메시지에 묶이도록 reset.
        turn.currentAssistantMessageId = null
        turn.assistantText = ''
        break
      }
      // message.delta 는 transient(미저장). permission.* 는 별도 row 없음.
    }
  }

  private handleChatCancel = async (event: IpcMainInvokeEvent, raw: unknown): Promise<void> => {
    CancelChatSchema.parse(raw)
    const turn = this.inflight.get(event.sender)
    if (turn) turn.controller.abort()
  }

  private handleBackendList = async (): Promise<BackendListResult> => {
    // 능력 서술자를 computed-on-the-fly 로 각 엔트리에 부착(DB 미관여 — §4). capabilities 는
    // 백엔드의 함수(세션별 데이터 아님)라 영속하지 않고 매 응답에 다시 계산해 붙인다.
    const descriptors = this.registry.describeAll()
    const backends = this.registry.list().map((b) => ({ ...b, capabilities: descriptors[b.id] }))
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

    // 세션의 모든 파트를 메시지 순서(message_idx) → 파트 순서(part_idx)로 조회해 재구성.
    const partRows = this.db.loadParts(parsed.data.sessionId)
    if (partRows.length === 0) return null
    const sessions = this.db.listSessions(1000)
    const meta = sessions.find((s) => s.id === parsed.data.sessionId)
    if (!meta) return null

    const messages: LoadedMessage[] = []
    let curId: number | null = null
    let cur: LoadedMessage | null = null
    for (const r of partRows) {
      if (r.message_id !== curId) {
        cur = { role: r.role, parts: [], createdAt: r.created_at }
        messages.push(cur)
        curId = r.message_id
      }
      cur!.parts.push(partFromRow(r))
    }

    // 세션 마지막 턴 사용량 → 컨텍스트 도넛/패널 복원(세션 수명 동안 표시).
    const usage = this.db.getLatestUsage(parsed.data.sessionId)
    const lastTelemetry = usage ? usageRowToTelemetry(usage) : undefined

    return {
      id: meta.id,
      backend: meta.backend,
      title: meta.title,
      messages,
      ...(lastTelemetry ? { lastTelemetry } : {})
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

  // 단일 권한 응답 — renderer 가 ask/plan/tool 승인을 approvalId + ApprovalResolution 으로
  // 회신. broker 가 보류 중이던 canUseTool Promise 를 해소해 query 가 재개된다. 두 가지 부수효과:
  //   ① allow + updatedPermissions(scope:session) → 해당 세션의 sessionAllowedTools 갱신
  //      (같은 세션 이후 턴에서 자동 허용).
  //   ② deny + interrupt → 해당 턴 abort (plan reject 의 turn-abort 동작 보존).
  private handlePermissionRespond = async (
    event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<void> => {
    const parsed = PermissionRespondSchema.safeParse(raw)
    if (!parsed.success) return
    const { approvalId, resolution } = parsed.data
    this.approvals.resolve(approvalId, resolution)

    if (resolution.behavior === 'allow' && resolution.updatedPermissions) {
      const sid = this.inflight.get(event.sender)?.dbSessionId
      if (sid) {
        const set = this.sessionAllowedTools.get(sid) ?? new Set<string>()
        for (const p of resolution.updatedPermissions) {
          if (p.scope === 'session') set.add(p.toolName)
        }
        this.sessionAllowedTools.set(sid, set)
      }
    }

    if (resolution.behavior === 'deny' && resolution.interrupt) {
      this.inflight.get(event.sender)?.controller.abort()
    }
  }

  // 권한 모드 라이브 전환 (orca:permission:setMode, PR③). 두 경로:
  //   ① controller(세션 SSOT) 갱신 — 다음 턴 send 가 이 값을 싣는다.
  //   ② 진행 중 턴(같은 세션)이면 Query.setPermissionMode 로 즉시 전환 — 그 턴의 이후 도구부터 반영.
  private handlePermissionSetMode = async (
    event: IpcMainInvokeEvent,
    raw: unknown
  ): Promise<void> => {
    const parsed = SetPermissionModeSchema.safeParse(raw)
    if (!parsed.success) return
    const { sessionId, mode } = parsed.data
    void this.permissionModes.setMode(sessionId, mode)

    const turn = this.inflight.get(event.sender)
    if (turn?.live && turn.dbSessionId === sessionId) {
      try {
        await turn.live.setPermissionMode(toClaudePermissionMode(mode))
      } catch {
        // 라이브 전환 실패(핸들이 막 닫힘 등)는 무시 — controller 값이 다음 턴에 반영된다.
      }
    }
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

// message_parts 한 행 → AppMessagePart. payload_json 은 type 외 필드의 JSON 이고, tool_*
// 의 toolRunId 는 별도 컬럼이라 재부착한다. payload 는 우리가 쓴 것이라 shape 가 보장된다.
function partFromRow(r: LoadedPartRow): AppMessagePart {
  const payload = safeJsonParse(r.payload_json)
  const base = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<
    string,
    unknown
  >
  const part: Record<string, unknown> = { type: r.type, ...base }
  if (r.tool_run_id != null) part.toolRunId = r.tool_run_id
  return part as unknown as AppMessagePart
}

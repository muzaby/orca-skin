import type {
  PermissionRespond,
  BootReport,
  SetPermissionMode,
  Backend,
  BackendListResult,
  AgentEnvironment,
  CostSummary,
  ProviderUsageEntry,
  UsageStats,
  UsageStatsRange,
  ConcurrencyEvent,
  NormalizedEvent,
  CreateMcpServerRequest,
  CreateProjectRequest,
  ProviderInfo,
  ProviderPlatformState,
  ProviderStepInfo,
  ProviderLoginRequest,
  ProviderContinueRequest,
  ProviderReauthRequest,
  ProviderRevokeRequest,
  FileEntry,
  PickedAttachment,
  OpenPathRequest,
  ReadAttachmentResult,
  InstallStatus,
  LoadedSession,
  McpServer,
  Project,
  SearchHit,
  SendChatMessage,
  CancelSteer,
  SessionListItem,
  SessionTitleEvent,
  Settings,
  SettingsPatch,
  NotifyShow,
  SkillInfo,
  AuthorSkillRequest,
  UploadSkillRequest,
  SetSkillEnabledRequest,
  SkillTargetRequest,
  UpdateMcpServerRequest,
  UpdateProjectRequest,
  DebugMockState,
  CreateEngineRequest,
  UpdateEngineRequest,
  EngineReadResult,
  EngineUserSettingsResult,
  EngineWriteResult,
  UpdateState,
  UpdateProgress,
  UpdateCheckResult,
  UpdateInstallResult
} from '../../../../shared/ipc'

// renderer 의 모든 IPC 호출 진입점. window.orca.* 의 얇은 typed 패스-스루로,
// features/ 내부 hook · 컴포넌트가 직접 window 객체에 의존하지 않도록 격리한다.
// IPC 계약이 바뀌면 이 파일 한 곳만 갱신.

export const chatApi = {
  send: (req: SendChatMessage): Promise<void> => window.orca.chat.send(req),
  cancelSteer: (req: CancelSteer): Promise<void> => window.orca.chat.cancelSteer(req),
  cancel: (sessionId: string): Promise<void> => window.orca.chat.cancel(sessionId),
  stopSubagent: (sessionId: string, toolUseId: string): Promise<void> =>
    window.orca.chat.stopSubagent(sessionId, toolUseId),
  // 세션 전체 중단(0151 r2) — Stop 잔여가 있을 때만 UI 가 호출한다.
  discardSession: (sessionId: string): Promise<void> => window.orca.chat.discardSession(sessionId),
  onEvent: (handler: (ev: NormalizedEvent) => void): (() => void) =>
    window.orca.chat.onEvent(handler)
}

export const bootApi = {
  report: (): Promise<BootReport> => window.orca.boot.report(),
  whenReady: (): Promise<void> => window.orca.boot.whenReady()
}

export const backendApi = {
  list: (): Promise<BackendListResult> => window.orca.backend.list()
}

export const agentApi = {
  list: (): Promise<AgentEnvironment[]> => window.orca.agent.list()
}

export const engineApi = {
  add: (req: CreateEngineRequest): Promise<EngineWriteResult> => window.orca.engine.add(req),
  update: (req: UpdateEngineRequest): Promise<EngineWriteResult> => window.orca.engine.update(req),
  delete: (key: string): Promise<void> => window.orca.engine.delete(key),
  read: (key: string): Promise<EngineReadResult> => window.orca.engine.read(key),
  importUserSettings: (): Promise<EngineUserSettingsResult> =>
    window.orca.engine.importUserSettings()
}

export const installApi = {
  start: (backend: Backend): Promise<void> => window.orca.install.start(backend),
  onStatus: (handler: (st: InstallStatus) => void): (() => void) =>
    window.orca.install.onStatus(handler)
}

export const settingsApi = {
  get: (): Promise<Settings> => window.orca.settings.get(),
  set: (patch: SettingsPatch): Promise<Settings> => window.orca.settings.set(patch)
}

export const notifyApi = {
  show: (req: NotifyShow): Promise<void> => window.orca.notify.show(req)
}

export const skillApi = {
  list: (): Promise<SkillInfo[]> => window.orca.skills.list(),
  author: (req: AuthorSkillRequest): Promise<SkillInfo[]> => window.orca.skills.author(req),
  upload: (req: UploadSkillRequest): Promise<SkillInfo[]> => window.orca.skills.upload(req),
  setEnabled: (req: SetSkillEnabledRequest): Promise<SkillInfo[]> =>
    window.orca.skills.setEnabled(req),
  open: (req: SkillTargetRequest): Promise<void> => window.orca.skills.open(req),
  showInFolder: (req: SkillTargetRequest): Promise<void> => window.orca.skills.showInFolder(req),
  remove: (req: SkillTargetRequest): Promise<SkillInfo[]> => window.orca.skills.remove(req)
}

export const fileApi = {
  list: (cwd: string, relDir: string): Promise<FileEntry[]> => window.orca.files.list(cwd, relDir),
  pickAttachments: (): Promise<PickedAttachment[]> => window.orca.files.pickAttachments(),
  pickDirectory: (): Promise<string | null> => window.orca.files.pickDirectory(),
  openPath: (req: OpenPathRequest): Promise<void> => window.orca.files.openPath(req),
  readAttachment: (path: string): Promise<ReadAttachmentResult> =>
    window.orca.files.readAttachment(path),
  pathForFile: (file: File): string => window.orca.files.pathForFile(file)
}

export const concurrencyApi = {
  onEvent: (handler: (ev: ConcurrencyEvent) => void): (() => void) =>
    window.orca.concurrency.onEvent(handler)
}

export const sessionApi = {
  cwd: (): Promise<string> => window.orca.session.cwd(),
  list: (): Promise<SessionListItem[]> => window.orca.session.list(),
  load: (sessionId: string): Promise<LoadedSession | null> => window.orca.session.load(sessionId),
  delete: (sessionId: string): Promise<void> => window.orca.session.delete(sessionId),
  rename: (sessionId: string, title: string): Promise<void> =>
    window.orca.session.rename(sessionId, title),
  setPinned: (sessionId: string, pinned: boolean): Promise<void> =>
    window.orca.session.setPinned(sessionId, pinned),
  onTitle: (handler: (ev: SessionTitleEvent) => void): (() => void) =>
    window.orca.session.onTitle(handler)
}

export const projectApi = {
  list: (): Promise<Project[]> => window.orca.project.list(),
  create: (req: CreateProjectRequest): Promise<Project> => window.orca.project.create(req),
  update: (req: UpdateProjectRequest): Promise<void> => window.orca.project.update(req),
  delete: (id: string): Promise<void> => window.orca.project.delete(id),
  setPinned: (id: string, pinned: boolean): Promise<void> =>
    window.orca.project.setPinned(id, pinned),
  listSessions: (projectId: string): Promise<SessionListItem[]> =>
    window.orca.project.listSessions(projectId)
}

export const windowApi = {
  minimize: (): Promise<void> => window.orca.window.minimize(),
  maximize: (): Promise<void> => window.orca.window.maximize(),
  close: (): Promise<void> => window.orca.window.close()
}

export const searchApi = {
  messages: (q: string, limit?: number): Promise<SearchHit[]> =>
    window.orca.search.messages(q, limit)
}

export const costApi = {
  summary: (): Promise<CostSummary> => window.orca.cost.summary(),
  onSummary: (handler: (summary: CostSummary) => void): (() => void) =>
    window.orca.cost.onSummary(handler),
  providerSummaries: (providerKeys: string[]): Promise<ProviderUsageEntry[]> =>
    window.orca.cost.providerSummaries(providerKeys),
  refreshProviderUsageReport: (providerKey: string): Promise<ProviderUsageEntry> =>
    window.orca.cost.refreshProviderUsageReport(providerKey),
  setProviderLimit: (providerKey: string, limitUsd: number | null): Promise<ProviderUsageEntry> =>
    window.orca.cost.setProviderLimit(providerKey, limitUsd),
  usageStats: (range: UsageStatsRange): Promise<UsageStats> => window.orca.cost.usageStats(range)
}

export const permissionApi = {
  respond: (req: PermissionRespond): Promise<void> => window.orca.permission.respond(req),
  setMode: (req: SetPermissionMode): Promise<void> => window.orca.permission.setMode(req)
}

export const updateApi = {
  state: (): Promise<UpdateState> => window.orca.update.state(),
  check: (): Promise<UpdateCheckResult> => window.orca.update.check(),
  download: (): Promise<UpdateCheckResult> => window.orca.update.download(),
  quitAndInstall: (): Promise<UpdateInstallResult> => window.orca.update.quitAndInstall(),
  onState: (handler: (state: UpdateState) => void): (() => void) =>
    window.orca.update.onState(handler),
  onProgress: (handler: (progress: UpdateProgress) => void): (() => void) =>
    window.orca.update.onProgress(handler)
}

// 구 `authApi`·`pluginApi` 두 표면을 하나로 합친 자리(0181). 게이트 화면과 카탈로그 provider
// 탭이 같은 API 를 쓴다 — 앱 로그인과 서비스 연결의 차이는 `ProviderInfo.kind` 뿐이다.
export const providerApi = {
  list: (): Promise<ProviderInfo[]> => window.orca.provider.list(),
  state: (): Promise<ProviderPlatformState> => window.orca.provider.state(),
  login: (req: ProviderLoginRequest): Promise<ProviderStepInfo> => window.orca.provider.login(req),
  continue: (req: ProviderContinueRequest): Promise<ProviderStepInfo> =>
    window.orca.provider.continue(req),
  reauth: (req: ProviderReauthRequest): Promise<ProviderStepInfo> =>
    window.orca.provider.reauth(req),
  revoke: (req: ProviderRevokeRequest): Promise<void> => window.orca.provider.revoke(req),
  onState: (handler: (state: ProviderPlatformState) => void): (() => void) =>
    window.orca.provider.onState(handler)
}

export const debugApi = {
  getMock: (): Promise<DebugMockState> => window.orca.debug.getMock(),
  setMock: (patch: Partial<DebugMockState>): Promise<DebugMockState> =>
    window.orca.debug.setMock(patch)
}

export const mcpApi = {
  list: (): Promise<McpServer[]> => window.orca.mcp.list(),
  add: (req: CreateMcpServerRequest): Promise<McpServer> => window.orca.mcp.add(req),
  update: (req: UpdateMcpServerRequest): Promise<McpServer | null> => window.orca.mcp.update(req),
  delete: (id: string): Promise<void> => window.orca.mcp.delete(id)
}

// 플랫폼 식별자. preload 가 sync 노출하지만, 모듈 로드 시점에 window.orca 가
// 아직 없을 수 있어 호출 시점에 lazy 평가.
export function getPlatform(): 'darwin' | 'win32' | 'linux' | undefined {
  if (typeof window === 'undefined') return undefined
  return window.orca?.platform
}

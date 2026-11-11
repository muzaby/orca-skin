import type {
  ArtifactActionResult,
  ArtifactCatalogItem,
  ArtifactListRequest,
  ArtifactRef,
  ArtifactSaveRequest,
  ArtifactSaveResult,
  ArtifactSetPinnedRequest,
  ArtifactStatusItem,
  ArtifactStatusRequest,
  ArtifactTargetRequest,
  ArtifactTrashResult
} from '../../../../shared/artifacts'
import type {
  BackgroundEvent,
  BackgroundSessionState,
  BackgroundTaskRequest,
  PromoteBackgroundTaskRequest
} from '../../../../shared/background-task'
import type {
  ComposerCatalogInvalidated,
  ComposerCatalogRequest,
  ComposerCatalogResult
} from '../../../../shared/composer-catalog'
import type {
  AddSessionDirectoryRequest,
  AddSessionDirectoryResult,
  AgentEnvironment,
  AuthorSkillRequest,
  Backend,
  BackendListResult,
  BootReport,
  CancelSteer,
  ConcurrencyEvent,
  CreateEngineRequest,
  CreateMcpServerRequest,
  CreateProjectRequest,
  DebugMockState,
  DeleteSessionResult,
  EngineReadResult,
  EngineUserSettingsResult,
  EngineWriteResult,
  FileEntry,
  GitBranchList,
  GitCheckoutRequest,
  GitCheckoutResult,
  GitDiffPatch,
  GitDiffPatchRequest,
  GitSnapshotRequest,
  GitSnapshotResult,
  GitStatus,
  InstallStatus,
  LoadedSession,
  McpServer,
  NormalizedEvent,
  NotifyShow,
  OpenContextFileRequest,
  OpenContextFileResult,
  OpenPathRequest,
  PermissionRespond,
  PickedAttachment,
  Project,
  ProviderConnectRequest,
  ProviderConnectionInfo,
  ProviderContinueRequest,
  ProviderLoginRequest,
  ProviderPlatformState,
  ProviderReauthRequest,
  ProviderRevokeRequest,
  ProviderStepInfo,
  ReadAttachmentResult,
  RefreshSessionResult,
  SearchHit,
  SendChatMessage,
  SessionListItem,
  SessionTitleEvent,
  SetPermissionMode,
  SetSkillEnabledRequest,
  Settings,
  SettingsPatch,
  SkillInfo,
  SkillTargetRequest,
  SteerSendNow,
  UpdateCheckResult,
  UpdateEngineRequest,
  UpdateInstallResult,
  UpdateMcpServerRequest,
  UpdateProgress,
  UpdateProjectRequest,
  UpdateState,
  UploadSkillRequest,
  UsageStats,
  UsageStatsRange
} from '../../../../shared/ipc'
import type {
  DraftNativeResourcesRequest,
  ExtensionsChanged,
  NativeResources,
  OpenCodePluginsChanged,
  SetGlobalNativeResourceResult
} from '../../../../shared/native-resources'
import type { NormalizedPermissionMode } from '../../../../shared/permission-mode'
// 사용량 타입 정본은 `shared/usage/limits.ts` (ipc.ts 에 두면 순환).
import type { UsageDelta, UsageLimitsView } from '../../../../shared/usage/limits'

// renderer 의 모든 IPC 호출 진입점. window.oo.* 의 얇은 typed 패스-스루로,
// features/ 내부 hook · 컴포넌트가 직접 window 객체에 의존하지 않도록 격리한다.
// IPC 계약이 바뀌면 이 파일 한 곳만 갱신.

export const errorApi = {
  revealLog: (): Promise<void> => window.oo.error.revealLog()
}

export const chatApi = {
  backgroundState: (sessionId: string): Promise<BackgroundSessionState> =>
    window.oo.chat.backgroundState(sessionId),
  onBackgroundEvent: (handler: (event: BackgroundEvent) => void): (() => void) =>
    window.oo.chat.onBackgroundEvent(handler),
  stopBackgroundTask: (req: BackgroundTaskRequest): Promise<void> =>
    window.oo.chat.stopBackgroundTask(req),
  promoteBackgroundTask: (req: PromoteBackgroundTaskRequest): Promise<void> =>
    window.oo.chat.promoteBackgroundTask(req),
  send: (req: SendChatMessage): Promise<void> => window.oo.chat.send(req),
  cancelSteer: (req: CancelSteer): Promise<void> => window.oo.chat.cancelSteer(req),
  sendSteerNow: (req: SteerSendNow): Promise<void> => window.oo.chat.sendSteerNow(req),
  cancel: (sessionId: string): Promise<void> => window.oo.chat.cancel(sessionId),
  stopSubagent: (sessionId: string, toolUseId: string): Promise<void> =>
    window.oo.chat.stopSubagent(sessionId, toolUseId),
  backgroundSubagent: (sessionId: string, toolUseId: string): Promise<void> =>
    window.oo.chat.backgroundSubagent(sessionId, toolUseId),
  // 세션 전체 중단(0151 r2) — Stop 잔여가 있을 때만 UI 가 호출한다.
  discardSession: (sessionId: string): Promise<void> => window.oo.chat.discardSession(sessionId),
  onEvent: (handler: (ev: NormalizedEvent) => void): (() => void) => window.oo.chat.onEvent(handler)
}

export const bootApi = {
  report: (): Promise<BootReport> => window.oo.boot.report(),
  whenReady: (): Promise<void> => window.oo.boot.whenReady()
}

export const backendApi = {
  list: (): Promise<BackendListResult> => window.oo.backend.list()
}

export const harnessApi = {
  recheck: (backend: import('../../../../shared/ipc').Backend) =>
    window.oo.harness.recheck(backend),
  onAvailability: (
    handler: (state: import('../../../../shared/ipc').HarnessAvailability) => void
  ) => window.oo.harness.onAvailability(handler)
}

export const agentApi = {
  list: (): Promise<AgentEnvironment[]> => window.oo.agent.list()
}

export const engineApi = {
  add: (req: CreateEngineRequest): Promise<EngineWriteResult> => window.oo.engine.add(req),
  update: (req: UpdateEngineRequest): Promise<EngineWriteResult> => window.oo.engine.update(req),
  delete: (key: string): Promise<void> => window.oo.engine.delete(key),
  read: (key: string): Promise<EngineReadResult> => window.oo.engine.read(key),
  importUserSettings: (engine: Backend = 'claude'): Promise<EngineUserSettingsResult> =>
    window.oo.engine.importUserSettings(engine)
}

export const installApi = {
  start: (backend: Backend): Promise<void> => window.oo.install.start(backend),
  onStatus: (handler: (st: InstallStatus) => void): (() => void) =>
    window.oo.install.onStatus(handler)
}

export const settingsApi = {
  get: (): Promise<Settings> => window.oo.settings.get(),
  set: (patch: SettingsPatch): Promise<Settings> => window.oo.settings.set(patch)
}

export const notifyApi = {
  show: (req: NotifyShow): Promise<void> => window.oo.notify.show(req)
}

export const skillApi = {
  list: (): Promise<SkillInfo[]> => window.oo.skills.list(),
  author: (req: AuthorSkillRequest): Promise<SkillInfo[]> => window.oo.skills.author(req),
  upload: (req: UploadSkillRequest): Promise<SkillInfo[]> => window.oo.skills.upload(req),
  setEnabled: (req: SetSkillEnabledRequest): Promise<SkillInfo[]> =>
    window.oo.skills.setEnabled(req),
  open: (req: SkillTargetRequest): Promise<void> => window.oo.skills.open(req),
  showInFolder: (req: SkillTargetRequest): Promise<void> => window.oo.skills.showInFolder(req),
  remove: (req: SkillTargetRequest): Promise<SkillInfo[]> => window.oo.skills.remove(req)
}

export const fileApi = {
  list: (cwd: string, relDir: string): Promise<FileEntry[]> => window.oo.files.list(cwd, relDir),
  pickAttachments: (): Promise<PickedAttachment[]> => window.oo.files.pickAttachments(),
  pickDirectory: (): Promise<string | null> => window.oo.files.pickDirectory(),
  openPath: (req: OpenPathRequest): Promise<void> => window.oo.files.openPath(req),
  openContextFile: (req: OpenContextFileRequest): Promise<OpenContextFileResult> =>
    window.oo.files.openContextFile(req),
  readAttachment: (path: string): Promise<ReadAttachmentResult> =>
    window.oo.files.readAttachment(path),
  pathForFile: (file: File): string => window.oo.files.pathForFile(file)
}

export const gitApi = {
  status: async (cwd: string): Promise<GitStatus> =>
    (await window.oo.git.snapshot({ cwd, includeSummary: false })).status,
  snapshot: (req: GitSnapshotRequest): Promise<GitSnapshotResult> => window.oo.git.snapshot(req),
  branches: (cwd: string): Promise<GitBranchList> => window.oo.git.branches(cwd),
  checkout: (req: GitCheckoutRequest): Promise<GitCheckoutResult> => window.oo.git.checkout(req),
  diffPatch: (req: GitDiffPatchRequest): Promise<GitDiffPatch> => window.oo.git.diffPatch(req)
}

export const concurrencyApi = {
  onEvent: (handler: (ev: ConcurrencyEvent) => void): (() => void) =>
    window.oo.concurrency.onEvent(handler)
}

export const sessionApi = {
  globalExtensions: (backend: Backend): Promise<NativeResources> =>
    window.oo.session.globalExtensions(backend),
  setGlobalExtension: (
    request: Parameters<typeof window.oo.session.setGlobalExtension>[0]
  ): Promise<SetGlobalNativeResourceResult> => window.oo.session.setGlobalExtension(request),
  openGlobalExtension: (
    request: Parameters<typeof window.oo.session.openGlobalExtension>[0]
  ): Promise<void> => window.oo.session.openGlobalExtension(request),
  composerCatalog: (request: ComposerCatalogRequest): Promise<ComposerCatalogResult> =>
    window.oo.session.composerCatalog(request),
  releaseComposerCatalog: (owner: string): Promise<void> =>
    window.oo.session.releaseComposerCatalog(owner),
  onComposerCatalogInvalidated: (
    handler: (event: ComposerCatalogInvalidated) => void
  ): (() => void) => window.oo.session.onComposerCatalogInvalidated(handler),
  onExtensionsChanged: (handler: (event: ExtensionsChanged) => void): (() => void) | undefined =>
    globalThis.window?.oo?.session?.onExtensionsChanged?.(handler),
  onOpenCodePluginsChanged: (
    handler: (event: OpenCodePluginsChanged) => void
  ): (() => void) | undefined =>
    globalThis.window?.oo?.session?.onOpenCodePluginsChanged?.(handler),
  onManagedMcpChanged: (handler: (event: { revision: number }) => void): (() => void) | undefined =>
    globalThis.window?.oo?.session?.onManagedMcpChanged?.(handler),
  nativeResources: (
    request: string | DraftNativeResourcesRequest,
    observation?: import('../../../../shared/native-resources').NativeResourceObservation
  ): Promise<NativeResources> =>
    observation
      ? window.oo.session.nativeResources(request, observation)
      : window.oo.session.nativeResources(request),
  addDirectory: (request: AddSessionDirectoryRequest): Promise<AddSessionDirectoryResult> =>
    window.oo.session.addDirectory(request),
  cwd: (): Promise<string> => window.oo.session.cwd(),
  list: (): Promise<SessionListItem[]> => window.oo.session.list(),
  refresh: (sessionId: string): Promise<RefreshSessionResult> =>
    window.oo.session.refresh(sessionId),
  load: (sessionId: string): Promise<LoadedSession | null> => window.oo.session.load(sessionId),
  delete: (sessionId: string): Promise<DeleteSessionResult> => window.oo.session.delete(sessionId),
  rename: (sessionId: string, title: string): Promise<void> =>
    window.oo.session.rename(sessionId, title),
  setPinned: (sessionId: string, pinned: boolean): Promise<void> =>
    window.oo.session.setPinned(sessionId, pinned),
  onTitle: (handler: (ev: SessionTitleEvent) => void): (() => void) =>
    window.oo.session.onTitle(handler)
}

export const projectApi = {
  list: (): Promise<Project[]> => window.oo.project.list(),
  create: (req: CreateProjectRequest): Promise<Project> => window.oo.project.create(req),
  update: (req: UpdateProjectRequest): Promise<void> => window.oo.project.update(req),
  delete: (id: string): Promise<void> => window.oo.project.delete(id),
  setPinned: (id: string, pinned: boolean): Promise<void> =>
    window.oo.project.setPinned(id, pinned),
  listSessions: (projectId: string): Promise<SessionListItem[]> =>
    window.oo.project.listSessions(projectId)
}

export const windowApi = {
  minimize: (): Promise<void> => window.oo.window.minimize(),
  maximize: (): Promise<void> => window.oo.window.maximize(),
  close: (): Promise<void> => window.oo.window.close()
}

export const searchApi = {
  messages: (q: string, limit?: number): Promise<SearchHit[]> => window.oo.search.messages(q, limit)
}

export const costApi = {
  // providerKey 생략 = 전역. 반환값은 Main 이 완성한 정본이라 renderer 가 재계산하지 않는다.
  usage: (providerKey?: string): Promise<UsageLimitsView | null> =>
    window.oo.cost.usage(providerKey),
  onUsage: (handler: (delta: UsageDelta) => void): (() => void) => window.oo.cost.onUsage(handler),
  // 원격을 실제로 부른다(1분 cron 대기 없음). fetcher 없는 배포에선 main 이 no-op → 로컬 재조회.
  refreshUsage: (providerKey: string): Promise<UsageLimitsView> =>
    window.oo.cost.refreshUsage(providerKey),
  setProviderLimit: (providerKey: string, limitUsd: number | null): Promise<UsageLimitsView> =>
    window.oo.cost.setProviderLimit(providerKey, limitUsd),
  usageStats: (range: UsageStatsRange): Promise<UsageStats> => window.oo.cost.usageStats(range)
}

export const permissionApi = {
  respond: (req: PermissionRespond): Promise<void> => window.oo.permission.respond(req),
  setMode: (req: SetPermissionMode): Promise<NormalizedPermissionMode | undefined> =>
    window.oo.permission.setMode(req)
}

export const updateApi = {
  state: (): Promise<UpdateState> => window.oo.update.state(),
  check: (): Promise<UpdateCheckResult> => window.oo.update.check(),
  download: (): Promise<UpdateCheckResult> => window.oo.update.download(),
  quitAndInstall: (): Promise<UpdateInstallResult> => window.oo.update.quitAndInstall(),
  onState: (handler: (state: UpdateState) => void): (() => void) =>
    window.oo.update.onState(handler),
  onProgress: (handler: (progress: UpdateProgress) => void): (() => void) =>
    window.oo.update.onProgress(handler)
}

// 구 `authApi`·`pluginApi` 두 표면을 하나로 합친 자리(0181). 게이트 화면과 카탈로그 provider
// 탭이 같은 API 를 쓴다 — 앱 로그인과 서비스 연결의 차이는 `ProviderInfo.kind` 뿐이다.
export const providerApi = {
  state: (): Promise<ProviderPlatformState> => window.oo.provider.state(),
  login: (req: ProviderLoginRequest): Promise<ProviderStepInfo> => window.oo.provider.login(req),
  continue: (req: ProviderContinueRequest): Promise<ProviderStepInfo> =>
    window.oo.provider.continue(req),
  reauth: (req: ProviderReauthRequest): Promise<ProviderStepInfo> => window.oo.provider.reauth(req),
  revoke: (req: ProviderRevokeRequest): Promise<void> => window.oo.provider.revoke(req),
  connect: (req: ProviderConnectRequest): Promise<ProviderConnectionInfo> =>
    window.oo.provider.connect(req),
  onState: (handler: (state: ProviderPlatformState) => void): (() => void) =>
    window.oo.provider.onState(handler)
}

export const debugApi = {
  getMock: (): Promise<DebugMockState> => window.oo.debug.getMock(),
  setMock: (patch: Partial<DebugMockState>): Promise<DebugMockState> =>
    window.oo.debug.setMock(patch)
}

export const mcpApi = {
  list: (): Promise<McpServer[]> => window.oo.mcp.list(),
  add: (req: CreateMcpServerRequest): Promise<McpServer> => window.oo.mcp.add(req),
  update: (req: UpdateMcpServerRequest): Promise<McpServer | null> => window.oo.mcp.update(req),
  delete: (id: string): Promise<void> => window.oo.mcp.delete(id)
}

// 플랫폼 식별자. preload 가 sync 노출하지만, 모듈 로드 시점에 window.oo 가
// 아직 없을 수 있어 호출 시점에 lazy 평가.
export function getPlatform(): 'darwin' | 'win32' | 'linux' | undefined {
  if (typeof window === 'undefined') return undefined
  return window.oo?.platform
}

export const artifactApi = {
  catalog: (): Promise<ArtifactCatalogItem[]> => window.oo.artifacts.catalog(),
  setPinned: (req: ArtifactSetPinnedRequest): Promise<ArtifactActionResult> =>
    window.oo.artifacts.setPinned(req),
  list: (req: ArtifactListRequest): Promise<ArtifactRef[]> => window.oo.artifacts.list(req),
  status: (req: ArtifactStatusRequest): Promise<ArtifactStatusItem[]> =>
    window.oo.artifacts.status(req),
  save: (req: ArtifactSaveRequest): Promise<ArtifactSaveResult> => window.oo.artifacts.save(req),
  reveal: (req: ArtifactTargetRequest): Promise<ArtifactActionResult> =>
    window.oo.artifacts.reveal(req),
  trash: (req: ArtifactTargetRequest): Promise<ArtifactTrashResult> =>
    window.oo.artifacts.trash(req)
}

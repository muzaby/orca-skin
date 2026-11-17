import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { CHANNEL_OWNER, type ChannelOwner } from '../shared/channel-owner'
import {
  HOST_CONNECT_CHANNEL,
  HOST_EXITED_CHANNEL,
  HOST_PORT_CHANNEL,
  type HostName
} from '../shared/host-protocol'
import { createHostPortClient, type ClientPort, type HostPortClient } from './host-port'
import type { AppErrorReport } from '../shared/app-error'
import type {
  RunNowResult,
  ScheduledPromptReport,
  ScheduledPromptStart,
  ScheduledRun,
  ScheduledTask,
  ScheduledTaskInput
} from '../shared/scheduled-tasks'
import type {
  ArtifactActionResult,
  ArtifactCatalogItem,
  ArtifactListRequest,
  ArtifactPreviewResult,
  ArtifactRef,
  ArtifactSaveRequest,
  ArtifactSaveResult,
  ArtifactSetPinnedRequest,
  ArtifactStatusItem,
  ArtifactStatusRequest,
  ArtifactTargetRequest,
  ArtifactTrashResult
} from '../shared/artifacts'
import type {
  BackgroundEvent,
  BackgroundSessionState,
  BackgroundTaskRequest,
  PromoteBackgroundTaskRequest
} from '../shared/background-task'
import type {
  ComposerCatalogInvalidated,
  ComposerCatalogRequest,
  ComposerCatalogResult
} from '../shared/composer-catalog'
import {
  CHANNELS,
  type AddSessionDirectoryRequest,
  type AddSessionDirectoryResult,
  type AgentEnvironment,
  type AuthorSkillRequest,
  type Backend,
  type BackendListResult,
  type HarnessAvailability,
  type BootReport,
  type CancelSteer,
  type ConcurrencyEvent,
  type CreateEngineRequest,
  type CreateMcpServerRequest,
  type CreateProjectRequest,
  type DebugMockState,
  type DeleteSessionResult,
  type EngineReadResult,
  type EngineUserSettingsResult,
  type EngineWriteResult,
  type FileEntry,
  type GitBranchList,
  type GitCheckoutRequest,
  type GitCheckoutResult,
  type GitDiffPatch,
  type GitDiffPatchRequest,
  type GitSnapshotRequest,
  type GitSnapshotResult,
  type InstallStatus,
  type LoadedSession,
  type McpServer,
  type NormalizedEvent,
  type NotifyShow,
  type OpenContextFileRequest,
  type OpenContextFileResult,
  type OpenPathRequest,
  type PermissionRespond,
  type PickedAttachment,
  type Project,
  type ProviderConnectRequest,
  type ProviderConnectionInfo,
  type ProviderContinueRequest,
  type ProviderLoginRequest,
  type ProviderPlatformState,
  type ProviderReauthRequest,
  type ProviderRevokeRequest,
  type ProviderStepInfo,
  type ReadAttachmentResult,
  type RefreshSessionResult,
  type SearchHit,
  type SendChatMessage,
  type SessionListItem,
  type SessionTitleEvent,
  type SetPermissionMode,
  type SetSkillEnabledRequest,
  type Settings,
  type SettingsPatch,
  type SkillInfo,
  type SkillTargetRequest,
  type SteerSendNow,
  type UpdateCheckResult,
  type UpdateEngineRequest,
  type UpdateInstallResult,
  type UpdateMcpServerRequest,
  type UpdateProgress,
  type UpdateProjectRequest,
  type UpdateState,
  type UploadSkillRequest,
  type UsageStats,
  type UsageStatsRange
} from '../shared/ipc'
import type {
  DraftNativeResourcesRequest,
  ExtensionsChanged,
  GlobalNativeResourceTarget,
  NativeResources,
  OpenCodePluginsChanged,
  SetGlobalNativeResource,
  SetGlobalNativeResourceResult
} from '../shared/native-resources'
import type { NormalizedPermissionMode } from '../shared/permission-mode'
// 사용량 타입은 `shared/usage/limits.ts` 가 소유한다(ipc.ts 에 두면 순환) — 타입 전용 import 라
// 빌드에서 지워지므로 preload 에 런타임 코드가 딸려오지 않는다.
import { LOG_IPC_PAYLOAD_MAX_BYTES, type LogInput, type SerializedError } from '../shared/logging'
import type { UsageDelta, UsageLimitsView } from '../shared/usage/limits'

// ── 전송 선택 (0324 EP-8′ · AC24′) ─────────────────────────────────────────────────────────────
// 채널마다 처리하는 프로세스가 하나다(`CHANNEL_OWNER`). 셸 채널은 `ipcRenderer`, 호스트 채널은 셸이
// 넘긴 그 호스트의 포트로 간다 — main JS 를 지나지 않는다. 포트는 이 격리 월드에만 있고 renderer 에는
// 넘기지 않는다(D-026).
const OWNER_BY_CHANNEL = new Map<string, ChannelOwner>(
  (Object.keys(CHANNELS) as Array<keyof typeof CHANNELS>).map((key) => [
    CHANNELS[key],
    CHANNEL_OWNER[key]
  ])
)

function ownerOf(channel: string): ChannelOwner {
  const owner = OWNER_BY_CHANNEL.get(channel)
  if (!owner) throw new Error(`소유 프로세스가 없는 채널: ${channel}`)
  return owner
}

const hosts: Record<HostName, HostPortClient> = {
  agent: createHostPortClient({
    host: 'agent',
    requestConnect: () => ipcRenderer.send(HOST_CONNECT_CHANNEL, { host: 'agent' })
  }),
  data: createHostPortClient({
    host: 'data',
    requestConnect: () => ipcRenderer.send(HOST_CONNECT_CHANNEL, { host: 'data' })
  })
}

function wrapPort(port: MessagePort): ClientPort {
  return {
    postMessage: (message) => port.postMessage(message),
    onMessage: (listener) => {
      // `onmessage` 대입이 포트를 시작한다.
      port.onmessage = (event: MessageEvent) => listener(event.data)
    },
    close: () => port.close()
  }
}

ipcRenderer.on(HOST_PORT_CHANNEL, (event: IpcRendererEvent, payload: { host?: unknown }) => {
  const port = event.ports[0]
  if (!port || (payload?.host !== 'agent' && payload?.host !== 'data')) return
  hosts[payload.host].attachPort(wrapPort(port))
})
ipcRenderer.on(HOST_EXITED_CHANNEL, (_event: IpcRendererEvent, payload: { host?: unknown }) => {
  if (payload?.host === 'agent' || payload?.host === 'data') hosts[payload.host].hostExited()
})
// 이 문서의 포트를 달라 — 새로 읽힌 문서는 옛 포트를 갖고 있지 않다.
ipcRenderer.send(HOST_CONNECT_CHANNEL, { host: 'all' })

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  const owner = ownerOf(channel)
  if (owner === 'shell') return ipcRenderer.invoke(channel, payload) as Promise<T>
  return hosts[owner].invoke(channel, payload) as Promise<T>
}

// 로그 전송 (0123) — 유일한 one-way send. 크기 상한 초과·직렬화 불가는 조용히 폐기한다
// (로깅 실패가 renderer 를 깨면 안 된다). 공통 필드(timestamp 등)는 main 이 강제 부여.
function sendLog(input: LogInput): void {
  try {
    if (JSON.stringify(input).length > LOG_IPC_PAYLOAD_MAX_BYTES) return
    ipcRenderer.send(CHANNELS.logEmit, input)
  } catch {
    // 직렬화 불가 payload — 폐기.
  }
}

// 공개 메서드가 채널과 payload 타입을 지정한다. Electron 이벤트 객체는 경계를 넘기지 않는다.
function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const owner = ownerOf(channel)
  if (owner !== 'shell') return hosts[owner].on(channel, (payload) => handler(payload as T))
  const listener = (_event: IpcRendererEvent, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.off(channel, listener)
}

// renderer가 사용하는 제한된 공개 표면. 임의 채널이나 ipcRenderer 원본은 노출하지 않는다.
const oo = {
  error: {
    onReport: (handler: (report: AppErrorReport) => void): (() => void) =>
      subscribe(CHANNELS.errorReportEvent, handler),
    drain: (): Promise<AppErrorReport[]> => invoke(CHANNELS.errorDrain),
    revealLog: (): Promise<void> => invoke(CHANNELS.errorRevealLog)
  },
  boot: {
    report: (): Promise<BootReport> => invoke(CHANNELS.bootReport),
    // main start() 완료 게이트(0109) — resolve 될 때까지 나머지 부트 스텝을 시작하지 않는다.
    whenReady: (): Promise<void> => invoke(CHANNELS.bootWhenReady)
  },
  chat: {
    backgroundState: (sessionId: string): Promise<BackgroundSessionState> =>
      invoke(CHANNELS.chatBackgroundState, { sessionId }),
    onBackgroundEvent: (handler: (event: BackgroundEvent) => void): (() => void) =>
      subscribe(CHANNELS.chatBackgroundEvent, handler),
    stopBackgroundTask: (req: BackgroundTaskRequest): Promise<void> =>
      invoke(CHANNELS.chatStopBackgroundTask, req),
    promoteBackgroundTask: (req: PromoteBackgroundTaskRequest): Promise<void> =>
      invoke(CHANNELS.chatPromoteBackgroundTask, req),
    send: (req: SendChatMessage): Promise<void> => invoke(CHANNELS.chatSend, req),
    cancelSteer: (req: CancelSteer): Promise<void> => invoke(CHANNELS.chatSteerCancel, req),
    sendSteerNow: (req: SteerSendNow): Promise<void> => invoke(CHANNELS.chatSteerSendNow, req),
    onEvent: (handler: (ev: NormalizedEvent) => void): (() => void) =>
      subscribe(CHANNELS.chatEvent, handler),
    cancel: (sessionId: string): Promise<void> => invoke(CHANNELS.chatCancel, { sessionId }),
    stopSubagent: (sessionId: string, toolUseId: string): Promise<void> =>
      invoke(CHANNELS.chatStopSubagent, { sessionId, toolUseId }),
    // 서브에이전트 foreground → background 전환(0212). 중단과 같은 좌표를 쓰고 실패는 reject 로
    // 그대로 올라간다 — renderer 가 요청 표식을 되돌리고 사유를 낸다.
    backgroundSubagent: (sessionId: string, toolUseId: string): Promise<void> =>
      invoke(CHANNELS.chatBackgroundSubagent, { sessionId, toolUseId }),
    // 세션 전체 중단(0151 r2) — Stop 잔여가 있을 때만 UI 가 제시한다. 런타임 폐기라
    // 백그라운드 서브에이전트도 함께 종료된다.
    discardSession: (sessionId: string): Promise<void> =>
      invoke(CHANNELS.chatDiscardSession, { sessionId })
  },
  backend: {
    list: (): Promise<BackendListResult> => invoke(CHANNELS.backendList)
  },
  harness: {
    recheck: (backend: Backend): Promise<HarnessAvailability> =>
      invoke(CHANNELS.harnessRecheck, { backend }),
    onAvailability: (handler: (state: HarnessAvailability) => void): (() => void) =>
      subscribe(CHANNELS.harnessAvailability, handler)
  },
  agent: {
    list: (): Promise<AgentEnvironment[]> => invoke(CHANNELS.agentList)
  },
  engine: {
    add: (req: CreateEngineRequest): Promise<EngineWriteResult> => invoke(CHANNELS.engineAdd, req),
    update: (req: UpdateEngineRequest): Promise<EngineWriteResult> =>
      invoke(CHANNELS.engineUpdate, req),
    delete: (key: string): Promise<void> => invoke(CHANNELS.engineDelete, { key }),
    read: (key: string): Promise<EngineReadResult> => invoke(CHANNELS.engineRead, { key }),
    importUserSettings: (engine: Backend = 'claude'): Promise<EngineUserSettingsResult> =>
      invoke(CHANNELS.engineImportUserSettings, { engine })
  },
  install: {
    start: (backend: Backend): Promise<void> => invoke(CHANNELS.installStart, { backend }),
    onStatus: (handler: (st: InstallStatus) => void): (() => void) =>
      subscribe(CHANNELS.installStatus, handler)
  },
  settings: {
    get: (): Promise<Settings> => invoke(CHANNELS.settingsGet),
    set: (patch: SettingsPatch): Promise<Settings> => invoke(CHANNELS.settingsSet, patch)
  },
  skills: {
    list: (): Promise<SkillInfo[]> => invoke(CHANNELS.skillsList),
    author: (req: AuthorSkillRequest): Promise<SkillInfo[]> => invoke(CHANNELS.skillsAuthor, req),
    upload: (req: UploadSkillRequest): Promise<SkillInfo[]> => invoke(CHANNELS.skillsUpload, req),
    setEnabled: (req: SetSkillEnabledRequest): Promise<SkillInfo[]> =>
      invoke(CHANNELS.skillsSetEnabled, req),
    open: (req: SkillTargetRequest): Promise<void> => invoke(CHANNELS.skillsOpen, req),
    showInFolder: (req: SkillTargetRequest): Promise<void> =>
      invoke(CHANNELS.skillsShowInFolder, req),
    remove: (req: SkillTargetRequest): Promise<SkillInfo[]> => invoke(CHANNELS.skillsRemove, req)
  },
  artifacts: {
    catalog: (): Promise<ArtifactCatalogItem[]> => invoke(CHANNELS.artifactCatalog, {}),
    setPinned: (req: ArtifactSetPinnedRequest): Promise<ArtifactActionResult> =>
      invoke(CHANNELS.artifactSetPinned, req),
    preview: (req: ArtifactTargetRequest): Promise<ArtifactPreviewResult> =>
      invoke(CHANNELS.artifactPreview, req),
    list: (req: ArtifactListRequest): Promise<ArtifactRef[]> => invoke(CHANNELS.artifactList, req),
    status: (req: ArtifactStatusRequest): Promise<ArtifactStatusItem[]> =>
      invoke(CHANNELS.artifactStatus, req),
    save: (req: ArtifactSaveRequest): Promise<ArtifactSaveResult> =>
      invoke(CHANNELS.artifactSave, req),
    reveal: (req: ArtifactTargetRequest): Promise<ArtifactActionResult> =>
      invoke(CHANNELS.artifactReveal, req),
    trash: (req: ArtifactTargetRequest): Promise<ArtifactTrashResult> =>
      invoke(CHANNELS.artifactTrash, req)
  },
  files: {
    list: (cwd: string, relDir: string): Promise<FileEntry[]> =>
      invoke(CHANNELS.filesList, { cwd, relDir }),
    pickAttachments: (): Promise<PickedAttachment[]> => invoke(CHANNELS.filesPickAttachments),
    pickDirectory: (): Promise<string | null> => invoke(CHANNELS.filesPickDirectory),
    openPath: (req: OpenPathRequest): Promise<void> => invoke(CHANNELS.filesOpenPath, req),
    openContextFile: (req: OpenContextFileRequest): Promise<OpenContextFileResult> =>
      invoke(CHANNELS.filesOpenContextFile, req),
    readAttachment: (path: string): Promise<ReadAttachmentResult> =>
      invoke(CHANNELS.filesReadAttachment, { path }),
    pathForFile: (file: File): string => webUtils.getPathForFile(file)
  },
  git: {
    snapshot: (req: GitSnapshotRequest): Promise<GitSnapshotResult> =>
      invoke(CHANNELS.gitSnapshot, req),
    branches: (cwd: string): Promise<GitBranchList> => invoke(CHANNELS.gitBranches, { cwd }),
    checkout: (req: GitCheckoutRequest): Promise<GitCheckoutResult> =>
      invoke(CHANNELS.gitCheckout, req),
    diffPatch: (req: GitDiffPatchRequest): Promise<GitDiffPatch> =>
      invoke(CHANNELS.gitDiffPatch, req)
  },
  session: {
    onManagedMcpChanged: (handler: (event: { revision: number }) => void): (() => void) =>
      subscribe(CHANNELS.managedMcpChanged, handler),
    composerCatalog: (request: ComposerCatalogRequest): Promise<ComposerCatalogResult> =>
      invoke(CHANNELS.composerCatalog, request),
    releaseComposerCatalog: (owner: string): Promise<void> =>
      invoke(CHANNELS.composerCatalogRelease, { owner }),
    onComposerCatalogInvalidated: (
      handler: (event: ComposerCatalogInvalidated) => void
    ): (() => void) => subscribe(CHANNELS.composerCatalogInvalidated, handler),
    onExtensionsChanged: (handler: (event: ExtensionsChanged) => void): (() => void) =>
      subscribe(CHANNELS.extensionsChanged, handler),
    onOpenCodePluginsChanged: (handler: (event: OpenCodePluginsChanged) => void): (() => void) =>
      subscribe(CHANNELS.extensionOpenCodePluginsChanged, handler),
    onNativeResourcesChanged: (
      handler: (event: import('../shared/native-resources').NativeResourcesChanged) => void
    ): (() => void) => subscribe(CHANNELS.sessionNativeResourcesChanged, handler),
    nativeResources: (
      request: string | DraftNativeResourcesRequest,
      observation?: import('../shared/native-resources').NativeResourceObservation
    ): Promise<NativeResources> =>
      invoke(CHANNELS.sessionNativeResources, {
        ...(typeof request === 'string' ? { sessionId: request } : request),
        ...(observation ? { observation } : {})
      }),
    globalExtensions: (backend: Backend): Promise<NativeResources> =>
      invoke(CHANNELS.extensionCatalog, { backend }),
    setGlobalExtension: (
      request: SetGlobalNativeResource
    ): Promise<SetGlobalNativeResourceResult> => invoke(CHANNELS.extensionSetEnabled, request),
    openGlobalExtension: (request: GlobalNativeResourceTarget): Promise<void> =>
      invoke(CHANNELS.extensionOpen, request),
    addDirectory: (request: AddSessionDirectoryRequest): Promise<AddSessionDirectoryResult> =>
      invoke(CHANNELS.sessionAddDirectory, request),
    cwd: (): Promise<string> => invoke(CHANNELS.sessionCwd),
    list: (): Promise<SessionListItem[]> => invoke(CHANNELS.sessionList),
    refresh: (sessionId: string): Promise<RefreshSessionResult> =>
      invoke(CHANNELS.sessionRefresh, { sessionId }),
    load: (sessionId: string): Promise<LoadedSession | null> =>
      invoke(CHANNELS.sessionLoad, { sessionId }),
    delete: (sessionId: string): Promise<DeleteSessionResult> =>
      invoke(CHANNELS.sessionDelete, { sessionId }),
    rename: (sessionId: string, title: string): Promise<void> =>
      invoke(CHANNELS.sessionRename, { sessionId, title }),
    setPinned: (sessionId: string, pinned: boolean): Promise<void> =>
      invoke(CHANNELS.sessionSetPinned, { sessionId, pinned }),
    onTitle: (handler: (ev: SessionTitleEvent) => void): (() => void) =>
      subscribe(CHANNELS.sessionTitleEvent, handler)
  },
  project: {
    list: (): Promise<Project[]> => invoke(CHANNELS.projectList),
    create: (req: CreateProjectRequest): Promise<Project> => invoke(CHANNELS.projectCreate, req),
    update: (req: UpdateProjectRequest): Promise<void> => invoke(CHANNELS.projectUpdate, req),
    delete: (id: string): Promise<void> => invoke(CHANNELS.projectDelete, { id }),
    setPinned: (id: string, pinned: boolean): Promise<void> =>
      invoke(CHANNELS.projectSetPinned, { id, pinned }),
    listSessions: (projectId: string): Promise<SessionListItem[]> =>
      invoke(CHANNELS.projectListSessions, { projectId })
  },
  // 예약 작업.
  schedule: {
    list: (): Promise<ScheduledTask[]> => invoke(CHANNELS.scheduleList),
    create: (req: ScheduledTaskInput): Promise<ScheduledTask> =>
      invoke(CHANNELS.scheduleCreate, req),
    update: (req: ScheduledTaskInput & { id: string }): Promise<ScheduledTask> =>
      invoke(CHANNELS.scheduleUpdate, req),
    delete: (id: string): Promise<void> => invoke(CHANNELS.scheduleDelete, { id }),
    setEnabled: (id: string, enabled: boolean): Promise<void> =>
      invoke(CHANNELS.scheduleSetEnabled, { id, enabled }),
    runNow: (id: string): Promise<RunNowResult> => invoke(CHANNELS.scheduleRunNow, { id }),
    listRuns: (id: string): Promise<ScheduledRun[]> => invoke(CHANNELS.scheduleListRuns, { id }),
    reportPrompt: (report: ScheduledPromptReport): Promise<void> =>
      invoke(CHANNELS.schedulePromptReport, report),
    onChanged: (handler: () => void): (() => void) => subscribe(CHANNELS.scheduleChanged, handler),
    onPromptStart: (handler: (payload: ScheduledPromptStart) => void): (() => void) =>
      subscribe(CHANNELS.schedulePromptStart, handler)
  },
  // 커스텀 타이틀바 (frame:false) 의 WinControls 가 호출. macOS 는 OS traffic light 사용으로
  // 호출 자체가 없으나 채널은 플랫폼 공통으로 노출.
  window: {
    minimize: (): Promise<void> => invoke(CHANNELS.windowMinimize),
    maximize: (): Promise<void> => invoke(CHANNELS.windowMaximize),
    close: (): Promise<void> => invoke(CHANNELS.windowClose)
  },
  search: {
    messages: (q: string, limit?: number): Promise<SearchHit[]> =>
      invoke(CHANNELS.searchMessages, { q, limit })
  },
  mcp: {
    list: (): Promise<McpServer[]> => invoke(CHANNELS.mcpList),
    add: (req: CreateMcpServerRequest): Promise<McpServer> => invoke(CHANNELS.mcpAdd, req),
    update: (req: UpdateMcpServerRequest): Promise<McpServer | null> =>
      invoke(CHANNELS.mcpUpdate, req),
    delete: (id: string): Promise<void> => invoke(CHANNELS.mcpDelete, { id })
  },
  cost: {
    // providerKey 생략 = 전역. Main 이 UsageLimitsView 를 완성해 주므로 renderer 는 파생하지 않는다.
    usage: (providerKey?: string): Promise<UsageLimitsView | null> =>
      invoke(CHANNELS.costUsage, providerKey ? { providerKey } : {}),
    onUsage: (handler: (delta: UsageDelta) => void): (() => void) =>
      subscribe(CHANNELS.costUsageEvent, handler),
    // 원격 즉시 동기화(쓰기). `usage` 와 달리 원격을 실제로 부르고 0014 캐시를 갱신한다.
    refreshUsage: (providerKey: string): Promise<UsageLimitsView> =>
      invoke(CHANNELS.costRefreshUsage, { providerKey }),
    setProviderLimit: (providerKey: string, limitUsd: number | null): Promise<UsageLimitsView> =>
      invoke(CHANNELS.costSetProviderLimit, { providerKey, limitUsd }),
    usageStats: (range: UsageStatsRange): Promise<UsageStats> =>
      invoke(CHANNELS.costUsageStats, { range })
  },
  // provider 플랫폼 (0181) — 로그인 게이트 + 카탈로그 provider 탭. `state` 는 초기 스냅샷
  // invoke 와 변화 구독이 **같은 채널**이다(main 이 같은 객체를 양방향으로 나른다).
  provider: {
    state: (): Promise<ProviderPlatformState> => invoke(CHANNELS.providerState),
    login: (req: ProviderLoginRequest): Promise<ProviderStepInfo> =>
      invoke(CHANNELS.providerLogin, req),
    continue: (req: ProviderContinueRequest): Promise<ProviderStepInfo> =>
      invoke(CHANNELS.providerContinue, req),
    reauth: (req: ProviderReauthRequest): Promise<ProviderStepInfo> =>
      invoke(CHANNELS.providerReauth, req),
    revoke: (req: ProviderRevokeRequest): Promise<void> => invoke(CHANNELS.providerRevoke, req),
    // 로그인 프리 호스트 연결(0291) — 배포 연결 로직을 실행하고 최종 상태를 돌려준다.
    connect: (req: ProviderConnectRequest): Promise<ProviderConnectionInfo> =>
      invoke(CHANNELS.providerConnect, req),
    onState: (handler: (state: ProviderPlatformState) => void): (() => void) =>
      subscribe(CHANNELS.providerState, handler)
  },
  concurrency: {
    onEvent: (handler: (ev: ConcurrencyEvent) => void): (() => void) =>
      subscribe(CHANNELS.concurrencyEvent, handler)
  },
  // 권한 응답 (ask/plan/tool 단일 채널) — 사용자의 승인/거부를 approvalId + resolution 으로
  // main 에 회신. 요청 수신은 별도 채널이 아니라 chat.onEvent 의 permission.requested 이벤트.
  permission: {
    respond: (req: PermissionRespond): Promise<void> => invoke(CHANNELS.permissionRespond, req),
    // 세션 진행 중 권한 모드 라이브 전환 (PR③).
    setMode: (req: SetPermissionMode): Promise<NormalizedPermissionMode | undefined> =>
      invoke(CHANNELS.permissionSetMode, req)
  },
  debug: {
    getMock: (): Promise<DebugMockState> => invoke(CHANNELS.debugGetMock),
    setMock: (patch: Partial<DebugMockState>): Promise<DebugMockState> =>
      invoke(CHANNELS.debugSetMock, patch)
  },
  // OS 네이티브 알림(응답완료 등). main 이 창 포커스 여부로 표시를 게이트한다.
  notify: {
    show: (req: NotifyShow): Promise<void> => invoke(CHANNELS.notifyShow, req)
  },
  update: {
    state: (): Promise<UpdateState> => invoke(CHANNELS.updateState),
    check: (): Promise<UpdateCheckResult> => invoke(CHANNELS.updateCheck),
    download: (): Promise<UpdateCheckResult> => invoke(CHANNELS.updateDownload),
    quitAndInstall: (): Promise<UpdateInstallResult> => invoke(CHANNELS.updateQuitAndInstall),
    onState: (handler: (state: UpdateState) => void): (() => void) =>
      subscribe(CHANNELS.updateStateEvent, handler),
    onProgress: (handler: (progress: UpdateProgress) => void): (() => void) =>
      subscribe(CHANNELS.updateProgressEvent, handler)
  },
  // renderer 로그 인제스트 (0123) — 제한된 4메서드만. ipcRenderer 원본·임의 채널은 미노출.
  log: {
    debug: (event: string, scope: string, data?: Record<string, unknown>): void =>
      sendLog({ level: 'debug', event, scope, data }),
    info: (event: string, scope: string, data?: Record<string, unknown>): void =>
      sendLog({ level: 'info', event, scope, data }),
    warn: (event: string, scope: string, data?: Record<string, unknown>): void =>
      sendLog({ level: 'warn', event, scope, data }),
    error: (
      event: string,
      scope: string,
      error?: SerializedError,
      data?: Record<string, unknown>
    ): void => sendLog({ level: 'error', event, scope, error, data })
  },
  // 데스크톱 플랫폼 식별자. renderer 의 `<html data-platform>` 에 부착되고,
  // WinControls 가 macOS 에서 null 을 반환하는 분기 등에 사용.
  platform: process.platform as 'darwin' | 'win32' | 'linux'
}

export type OoApi = typeof oo

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('oo', oo)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.oo = oo
}

import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import {
  CHANNELS,
  type BootReport,
  type PermissionRespond,
  type SetPermissionMode,
  type Backend,
  type BackendListResult,
  type AgentEnvironment,
  type UsageStats,
  type UsageStatsRange,
  type ConcurrencyEvent,
  type NormalizedEvent,
  type CreateMcpServerRequest,
  type CreateProjectRequest,
  type ProviderInfo,
  type ProviderPlatformState,
  type ProviderStepInfo,
  type ProviderLoginRequest,
  type ProviderContinueRequest,
  type ProviderReauthRequest,
  type ProviderRevokeRequest,
  type FileEntry,
  type GitBranchList,
  type GitCheckoutRequest,
  type GitCheckoutResult,
  type GitStatus,
  type PickedAttachment,
  type OpenPathRequest,
  type ReadAttachmentResult,
  type InstallStatus,
  type LoadedSession,
  type McpServer,
  type Project,
  type SearchHit,
  type SendChatMessage,
  type CancelSteer,
  type SessionListItem,
  type SessionTitleEvent,
  type Settings,
  type SettingsPatch,
  type NotifyShow,
  type SkillInfo,
  type AuthorSkillRequest,
  type UploadSkillRequest,
  type SetSkillEnabledRequest,
  type SkillTargetRequest,
  type UpdateMcpServerRequest,
  type UpdateProjectRequest,
  type DebugMockState,
  type CreateEngineRequest,
  type UpdateEngineRequest,
  type EngineReadResult,
  type EngineUserSettingsResult,
  type EngineWriteResult,
  type UpdateState,
  type UpdateProgress,
  type UpdateCheckResult,
  type UpdateInstallResult
} from '../shared/ipc'
// 사용량 타입은 `shared/usage/limits.ts` 가 소유한다(ipc.ts 에 두면 순환) — 타입 전용 import 라
// 빌드에서 지워지므로 preload 에 런타임 코드가 딸려오지 않는다.
import type { UsageDelta, UsageLimitsView } from '../shared/usage/limits'
import { LOG_IPC_PAYLOAD_MAX_BYTES, type LogInput, type SerializedError } from '../shared/logging'

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

// Phase 2 노출 표면 — renderer 가 실제 사용하는 6개 채널만.
// 추가 채널 (backend.select, settings.*) 은 사용처 도입 시점에 다시 등록.
const orca = {
  boot: {
    report: (): Promise<BootReport> => ipcRenderer.invoke(CHANNELS.bootReport),
    // main start() 완료 게이트(0109) — resolve 될 때까지 나머지 부트 스텝을 시작하지 않는다.
    whenReady: (): Promise<void> => ipcRenderer.invoke(CHANNELS.bootWhenReady)
  },
  chat: {
    send: (req: SendChatMessage): Promise<void> => ipcRenderer.invoke(CHANNELS.chatSend, req),
    cancelSteer: (req: CancelSteer): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.chatSteerCancel, req),
    onEvent: (handler: (ev: NormalizedEvent) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, ev: NormalizedEvent): void => handler(ev)
      ipcRenderer.on(CHANNELS.chatEvent, listener)
      return () => ipcRenderer.off(CHANNELS.chatEvent, listener)
    },
    cancel: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.chatCancel, { sessionId }),
    stopSubagent: (sessionId: string, toolUseId: string): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.chatStopSubagent, { sessionId, toolUseId }),
    // 세션 전체 중단(0151 r2) — Stop 잔여가 있을 때만 UI 가 제시한다. 런타임 폐기라
    // 백그라운드 서브에이전트도 함께 종료된다.
    discardSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.chatDiscardSession, { sessionId })
  },
  backend: {
    list: (): Promise<BackendListResult> => ipcRenderer.invoke(CHANNELS.backendList)
  },
  agent: {
    list: (): Promise<AgentEnvironment[]> => ipcRenderer.invoke(CHANNELS.agentList)
  },
  engine: {
    add: (req: CreateEngineRequest): Promise<EngineWriteResult> =>
      ipcRenderer.invoke(CHANNELS.engineAdd, req),
    update: (req: UpdateEngineRequest): Promise<EngineWriteResult> =>
      ipcRenderer.invoke(CHANNELS.engineUpdate, req),
    delete: (key: string): Promise<void> => ipcRenderer.invoke(CHANNELS.engineDelete, { key }),
    read: (key: string): Promise<EngineReadResult> =>
      ipcRenderer.invoke(CHANNELS.engineRead, { key }),
    importUserSettings: (): Promise<EngineUserSettingsResult> =>
      ipcRenderer.invoke(CHANNELS.engineImportUserSettings)
  },
  install: {
    start: (backend: Backend): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.installStart, { backend }),
    onStatus: (handler: (st: InstallStatus) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, st: InstallStatus): void => handler(st)
      ipcRenderer.on(CHANNELS.installStatus, listener)
      return () => ipcRenderer.off(CHANNELS.installStatus, listener)
    }
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke(CHANNELS.settingsGet),
    set: (patch: SettingsPatch): Promise<Settings> =>
      ipcRenderer.invoke(CHANNELS.settingsSet, patch)
  },
  skills: {
    list: (): Promise<SkillInfo[]> => ipcRenderer.invoke(CHANNELS.skillsList),
    author: (req: AuthorSkillRequest): Promise<SkillInfo[]> =>
      ipcRenderer.invoke(CHANNELS.skillsAuthor, req),
    upload: (req: UploadSkillRequest): Promise<SkillInfo[]> =>
      ipcRenderer.invoke(CHANNELS.skillsUpload, req),
    setEnabled: (req: SetSkillEnabledRequest): Promise<SkillInfo[]> =>
      ipcRenderer.invoke(CHANNELS.skillsSetEnabled, req),
    open: (req: SkillTargetRequest): Promise<void> => ipcRenderer.invoke(CHANNELS.skillsOpen, req),
    showInFolder: (req: SkillTargetRequest): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.skillsShowInFolder, req),
    remove: (req: SkillTargetRequest): Promise<SkillInfo[]> =>
      ipcRenderer.invoke(CHANNELS.skillsRemove, req)
  },
  files: {
    list: (cwd: string, relDir: string): Promise<FileEntry[]> =>
      ipcRenderer.invoke(CHANNELS.filesList, { cwd, relDir }),
    pickAttachments: (): Promise<PickedAttachment[]> =>
      ipcRenderer.invoke(CHANNELS.filesPickAttachments),
    pickDirectory: (): Promise<string | null> => ipcRenderer.invoke(CHANNELS.filesPickDirectory),
    openPath: (req: OpenPathRequest): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.filesOpenPath, req),
    readAttachment: (path: string): Promise<ReadAttachmentResult> =>
      ipcRenderer.invoke(CHANNELS.filesReadAttachment, { path }),
    pathForFile: (file: File): string => webUtils.getPathForFile(file)
  },
  git: {
    status: (cwd: string): Promise<GitStatus> => ipcRenderer.invoke(CHANNELS.gitStatus, { cwd }),
    branches: (cwd: string): Promise<GitBranchList> =>
      ipcRenderer.invoke(CHANNELS.gitBranches, { cwd }),
    checkout: (req: GitCheckoutRequest): Promise<GitCheckoutResult> =>
      ipcRenderer.invoke(CHANNELS.gitCheckout, req)
  },
  session: {
    cwd: (): Promise<string> => ipcRenderer.invoke(CHANNELS.sessionCwd),
    list: (): Promise<SessionListItem[]> => ipcRenderer.invoke(CHANNELS.sessionList),
    load: (sessionId: string): Promise<LoadedSession | null> =>
      ipcRenderer.invoke(CHANNELS.sessionLoad, { sessionId }),
    delete: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.sessionDelete, { sessionId }),
    rename: (sessionId: string, title: string): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.sessionRename, { sessionId, title }),
    setPinned: (sessionId: string, pinned: boolean): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.sessionSetPinned, { sessionId, pinned }),
    onTitle: (handler: (ev: SessionTitleEvent) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, ev: SessionTitleEvent): void => handler(ev)
      ipcRenderer.on(CHANNELS.sessionTitleEvent, listener)
      return () => ipcRenderer.off(CHANNELS.sessionTitleEvent, listener)
    }
  },
  project: {
    list: (): Promise<Project[]> => ipcRenderer.invoke(CHANNELS.projectList),
    create: (req: CreateProjectRequest): Promise<Project> =>
      ipcRenderer.invoke(CHANNELS.projectCreate, req),
    update: (req: UpdateProjectRequest): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.projectUpdate, req),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(CHANNELS.projectDelete, { id }),
    setPinned: (id: string, pinned: boolean): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.projectSetPinned, { id, pinned }),
    listSessions: (projectId: string): Promise<SessionListItem[]> =>
      ipcRenderer.invoke(CHANNELS.projectListSessions, { projectId })
  },
  // 커스텀 타이틀바 (frame:false) 의 WinControls 가 호출. macOS 는 OS traffic light 사용으로
  // 호출 자체가 없으나 채널은 플랫폼 공통으로 노출.
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke(CHANNELS.windowMinimize),
    maximize: (): Promise<void> => ipcRenderer.invoke(CHANNELS.windowMaximize),
    close: (): Promise<void> => ipcRenderer.invoke(CHANNELS.windowClose)
  },
  search: {
    messages: (q: string, limit?: number): Promise<SearchHit[]> =>
      ipcRenderer.invoke(CHANNELS.searchMessages, { q, limit })
  },
  mcp: {
    list: (): Promise<McpServer[]> => ipcRenderer.invoke(CHANNELS.mcpList),
    add: (req: CreateMcpServerRequest): Promise<McpServer> =>
      ipcRenderer.invoke(CHANNELS.mcpAdd, req),
    update: (req: UpdateMcpServerRequest): Promise<McpServer | null> =>
      ipcRenderer.invoke(CHANNELS.mcpUpdate, req),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(CHANNELS.mcpDelete, { id })
  },
  cost: {
    // providerKey 생략 = 전역. Main 이 UsageLimitsView 를 완성해 주므로 renderer 는 파생하지 않는다.
    usage: (providerKey?: string): Promise<UsageLimitsView | null> =>
      ipcRenderer.invoke(CHANNELS.costUsage, providerKey ? { providerKey } : {}),
    onUsage: (handler: (delta: UsageDelta) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, delta: UsageDelta): void => handler(delta)
      ipcRenderer.on(CHANNELS.costUsageEvent, listener)
      return () => ipcRenderer.off(CHANNELS.costUsageEvent, listener)
    },
    // 원격 즉시 동기화(쓰기). `usage` 와 달리 원격을 실제로 부르고 0014 캐시를 갱신한다.
    refreshUsage: (providerKey: string): Promise<UsageLimitsView> =>
      ipcRenderer.invoke(CHANNELS.costRefreshUsage, { providerKey }),
    setProviderLimit: (providerKey: string, limitUsd: number | null): Promise<UsageLimitsView> =>
      ipcRenderer.invoke(CHANNELS.costSetProviderLimit, { providerKey, limitUsd }),
    usageStats: (range: UsageStatsRange): Promise<UsageStats> =>
      ipcRenderer.invoke(CHANNELS.costUsageStats, { range })
  },
  // provider 플랫폼 (0181) — 로그인 게이트 + 카탈로그 provider 탭. `state` 는 초기 스냅샷
  // invoke 와 변화 구독이 **같은 채널**이다(main 이 같은 객체를 양방향으로 나른다).
  provider: {
    list: (): Promise<ProviderInfo[]> => ipcRenderer.invoke(CHANNELS.providerList),
    state: (): Promise<ProviderPlatformState> => ipcRenderer.invoke(CHANNELS.providerState),
    login: (req: ProviderLoginRequest): Promise<ProviderStepInfo> =>
      ipcRenderer.invoke(CHANNELS.providerLogin, req),
    continue: (req: ProviderContinueRequest): Promise<ProviderStepInfo> =>
      ipcRenderer.invoke(CHANNELS.providerContinue, req),
    reauth: (req: ProviderReauthRequest): Promise<ProviderStepInfo> =>
      ipcRenderer.invoke(CHANNELS.providerReauth, req),
    revoke: (req: ProviderRevokeRequest): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.providerRevoke, req),
    onState: (handler: (state: ProviderPlatformState) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, state: ProviderPlatformState): void => handler(state)
      ipcRenderer.on(CHANNELS.providerState, listener)
      return () => ipcRenderer.off(CHANNELS.providerState, listener)
    }
  },
  concurrency: {
    onEvent: (handler: (ev: ConcurrencyEvent) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, ev: ConcurrencyEvent): void => handler(ev)
      ipcRenderer.on(CHANNELS.concurrencyEvent, listener)
      return () => ipcRenderer.off(CHANNELS.concurrencyEvent, listener)
    }
  },
  // 권한 응답 (ask/plan/tool 단일 채널) — 사용자의 승인/거부를 approvalId + resolution 으로
  // main 에 회신. 요청 수신은 별도 채널이 아니라 chat.onEvent 의 permission.requested 이벤트.
  permission: {
    respond: (req: PermissionRespond): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.permissionRespond, req),
    // 세션 진행 중 권한 모드 라이브 전환 (PR③).
    setMode: (req: SetPermissionMode): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.permissionSetMode, req)
  },
  debug: {
    getMock: (): Promise<DebugMockState> => ipcRenderer.invoke(CHANNELS.debugGetMock),
    setMock: (patch: Partial<DebugMockState>): Promise<DebugMockState> =>
      ipcRenderer.invoke(CHANNELS.debugSetMock, patch)
  },
  // OS 네이티브 알림(응답완료 등). main 이 창 포커스 여부로 표시를 게이트한다.
  notify: {
    show: (req: NotifyShow): Promise<void> => ipcRenderer.invoke(CHANNELS.notifyShow, req)
  },
  update: {
    state: (): Promise<UpdateState> => ipcRenderer.invoke(CHANNELS.updateState),
    check: (): Promise<UpdateCheckResult> => ipcRenderer.invoke(CHANNELS.updateCheck),
    download: (): Promise<UpdateCheckResult> => ipcRenderer.invoke(CHANNELS.updateDownload),
    quitAndInstall: (): Promise<UpdateInstallResult> =>
      ipcRenderer.invoke(CHANNELS.updateQuitAndInstall),
    onState: (handler: (state: UpdateState) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, state: UpdateState): void => handler(state)
      ipcRenderer.on(CHANNELS.updateStateEvent, listener)
      return () => ipcRenderer.off(CHANNELS.updateStateEvent, listener)
    },
    onProgress: (handler: (progress: UpdateProgress) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, progress: UpdateProgress): void => handler(progress)
      ipcRenderer.on(CHANNELS.updateProgressEvent, listener)
      return () => ipcRenderer.off(CHANNELS.updateProgressEvent, listener)
    }
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

export type OrcaApi = typeof orca

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('orca', orca)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.orca = orca
}

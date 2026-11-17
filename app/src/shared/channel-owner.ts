// 채널마다 처리하는 프로세스 (0324 EP-8′ · AR-06′ · D-034~D-038).
//
// 요청 채널은 그 프로세스가 핸들러를 등록하고, 통지 채널은 그 프로세스가 보낸다. preload 는 이
// 표로 전송을 고른다 — `shell` 은 `ipcRenderer`, `agent`·`data` 는 각 호스트의 포트다. 채널을 더하면
// 여기에도 적어야 typecheck 가 통과한다.
//
// - 셸: 창 조작 · 부팅 대기 · 업데이트 · renderer 로그 수신 · 알림(셸 서비스만 부른다).
// - 에이전트 호스트(실행): 턴·런타임 · 승인 · 하네스·엔진·확장 · 컴포저 카탈로그 · git · 제목·동시성 통지.
// - 데이터 호스트(상태): 세션·프로젝트·검색·첨부 · 산출물 · 설정 · MCP · 스킬 · 사용량 · 예약 작업 ·
//   인증 · 오류 보고·부팅 보고(D-042).

import { CHANNELS } from './ipc'

export type ChannelOwner = 'shell' | 'agent' | 'data'

export const CHANNEL_OWNER = {
  errorReportEvent: 'data',
  errorDrain: 'data',
  errorRevealLog: 'data',
  chatSend: 'agent',
  chatSteerCancel: 'agent',
  chatSteerSendNow: 'agent',
  chatEvent: 'agent',
  chatBackgroundState: 'agent',
  chatBackgroundEvent: 'agent',
  chatStopBackgroundTask: 'agent',
  chatPromoteBackgroundTask: 'agent',
  chatCancel: 'agent',
  chatStopSubagent: 'agent',
  chatBackgroundSubagent: 'agent',
  chatDiscardSession: 'agent',
  bootReport: 'data',
  bootWhenReady: 'shell',
  backendList: 'agent',
  harnessAvailability: 'agent',
  harnessRecheck: 'agent',
  agentList: 'agent',
  installStart: 'agent',
  installStatus: 'agent',
  settingsGet: 'data',
  settingsSet: 'data',
  skillsList: 'data',
  skillsAuthor: 'data',
  skillsUpload: 'data',
  skillsSetEnabled: 'data',
  skillsOpen: 'data',
  skillsShowInFolder: 'data',
  skillsRemove: 'data',
  filesList: 'data',
  filesPickAttachments: 'data',
  filesPickDirectory: 'data',
  filesOpenPath: 'data',
  filesOpenContextFile: 'data',
  filesReadAttachment: 'data',
  artifactList: 'data',
  artifactCatalog: 'data',
  artifactSetPinned: 'data',
  artifactStatus: 'data',
  artifactPreview: 'data',
  artifactSave: 'data',
  artifactReveal: 'data',
  artifactTrash: 'data',
  gitSnapshot: 'agent',
  gitBranches: 'agent',
  gitCheckout: 'agent',
  gitDiffPatch: 'agent',
  sessionCwd: 'data',
  sessionList: 'data',
  sessionLoad: 'data',
  sessionRefresh: 'data',
  sessionLoadChunk: 'data',
  sessionLoadCancel: 'data',
  sessionDelete: 'data',
  sessionRename: 'data',
  sessionSetPinned: 'data',
  sessionNativeResources: 'agent',
  extensionCatalog: 'agent',
  extensionsChanged: 'agent',
  extensionOpenCodePluginsChanged: 'agent',
  managedMcpChanged: 'data',
  extensionSetEnabled: 'agent',
  extensionOpen: 'agent',
  composerCatalog: 'agent',
  composerCatalogRelease: 'agent',
  composerCatalogInvalidated: 'agent',
  sessionNativeResourcesChanged: 'agent',
  sessionAddDirectory: 'data',
  sessionTitleEvent: 'agent',
  projectList: 'data',
  projectCreate: 'data',
  projectUpdate: 'data',
  projectDelete: 'data',
  projectSetPinned: 'data',
  projectListSessions: 'data',
  scheduleList: 'data',
  scheduleCreate: 'data',
  scheduleUpdate: 'data',
  scheduleDelete: 'data',
  scheduleSetEnabled: 'data',
  scheduleRunNow: 'data',
  scheduleListRuns: 'data',
  schedulePromptReport: 'data',
  scheduleChanged: 'data',
  schedulePromptStart: 'data',
  windowMinimize: 'shell',
  windowMaximize: 'shell',
  windowClose: 'shell',
  searchMessages: 'data',
  mcpList: 'data',
  mcpAdd: 'data',
  mcpUpdate: 'data',
  mcpDelete: 'data',
  costUsage: 'data',
  costUsageEvent: 'data',
  costSetProviderLimit: 'data',
  costRefreshUsage: 'data',
  costUsageStats: 'data',
  concurrencyEvent: 'agent',
  permissionRespond: 'agent',
  permissionSetMode: 'agent',
  debugGetMock: 'agent',
  debugSetMock: 'agent',
  engineAdd: 'agent',
  engineUpdate: 'agent',
  engineDelete: 'agent',
  engineRead: 'agent',
  engineImportUserSettings: 'agent',
  notifyShow: 'shell',
  updateState: 'shell',
  updateCheck: 'shell',
  updateDownload: 'shell',
  updateQuitAndInstall: 'shell',
  updateStateEvent: 'shell',
  updateProgressEvent: 'shell',
  logEmit: 'shell',
  providerLogin: 'data',
  providerContinue: 'data',
  providerReauth: 'data',
  providerRevoke: 'data',
  providerConnect: 'data',
  providerState: 'data'
} as const satisfies Record<keyof typeof CHANNELS, ChannelOwner>

const OWNER_BY_NAME: ReadonlyMap<string, ChannelOwner> = new Map(
  (Object.keys(CHANNELS) as Array<keyof typeof CHANNELS>).map((key) => [
    CHANNELS[key],
    CHANNEL_OWNER[key]
  ])
)

// 채널 이름(`oo:…`)의 소유자. 표에 없는 이름은 던진다 — 받는 쪽 없는 요청은 영원히 대기한다.
export function channelOwner(channel: string): ChannelOwner {
  const owner = OWNER_BY_NAME.get(channel)
  if (!owner) throw new Error(`소유 프로세스가 정해지지 않은 채널: ${channel}`)
  return owner
}

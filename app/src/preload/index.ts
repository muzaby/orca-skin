import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  CHANNELS,
  type Backend,
  type BackendListResult,
  type ChatEvent,
  type CreateProjectRequest,
  type FileEntry,
  type InstallStatus,
  type LoadedSession,
  type Project,
  type SearchHit,
  type SendChatMessage,
  type SessionListItem,
  type Settings,
  type SettingsPatch,
  type SkillInfo,
  type UpdateProjectRequest
} from '../shared/ipc'

// Phase 2 노출 표면 — renderer 가 실제 사용하는 6개 채널만.
// 추가 채널 (backend.select, settings.*) 은 사용처 도입 시점에 다시 등록.
const orca = {
  chat: {
    send: (req: SendChatMessage): Promise<void> => ipcRenderer.invoke(CHANNELS.chatSend, req),
    onEvent: (handler: (ev: ChatEvent) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, ev: ChatEvent): void => handler(ev)
      ipcRenderer.on(CHANNELS.chatEvent, listener)
      return () => ipcRenderer.off(CHANNELS.chatEvent, listener)
    },
    cancel: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.chatCancel, { sessionId })
  },
  backend: {
    list: (): Promise<BackendListResult> => ipcRenderer.invoke(CHANNELS.backendList)
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
    list: (): Promise<SkillInfo[]> => ipcRenderer.invoke(CHANNELS.skillsList)
  },
  files: {
    list: (cwd: string, relDir: string): Promise<FileEntry[]> =>
      ipcRenderer.invoke(CHANNELS.filesList, { cwd, relDir })
  },
  session: {
    cwd: (): Promise<string> => ipcRenderer.invoke(CHANNELS.sessionCwd),
    list: (): Promise<SessionListItem[]> => ipcRenderer.invoke(CHANNELS.sessionList),
    load: (sessionId: string): Promise<LoadedSession | null> =>
      ipcRenderer.invoke(CHANNELS.sessionLoad, { sessionId }),
    delete: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.sessionDelete, { sessionId }),
    rename: (sessionId: string, title: string): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.sessionRename, { sessionId, title })
  },
  project: {
    list: (): Promise<Project[]> => ipcRenderer.invoke(CHANNELS.projectList),
    create: (req: CreateProjectRequest): Promise<Project> =>
      ipcRenderer.invoke(CHANNELS.projectCreate, req),
    update: (req: UpdateProjectRequest): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.projectUpdate, req),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(CHANNELS.projectDelete, { id }),
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

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  CHANNELS,
  type Backend,
  type BackendListResult,
  type ChatEvent,
  type FileEntry,
  type InstallStatus,
  type LoadedSession,
  type SendChatMessage,
  type SessionListItem,
  type Settings,
  type SettingsPatch,
  type SkillInfo
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
  }
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

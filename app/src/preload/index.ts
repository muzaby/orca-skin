import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  CHANNELS,
  type Backend,
  type BackendListResult,
  type ChatEvent,
  type InstallStatus,
  type SendChatMessage
} from '../shared/protocol'

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
    list: (): Promise<BackendListResult> => ipcRenderer.invoke(CHANNELS.backendList),
    select: (backend: Backend): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.backendSelect, { backend })
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
    get: (key: string): Promise<unknown> => ipcRenderer.invoke(CHANNELS.settingsGet, { key }),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke(CHANNELS.settingsSet, { key, value })
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

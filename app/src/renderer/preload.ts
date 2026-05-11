import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('orca', {
  chat: {
    send: (payload: any) => ipcRenderer.invoke('orca:chat:send', payload),
    onEvent: (callback: (evt: any) => void) => {
      ipcRenderer.on('orca:chat:event', (_, evt) => callback(evt));
    },
    cancel: (sessionId: string) =>
      ipcRenderer.invoke('orca:chat:cancel', { sessionId }),
  },
  backend: {
    list: () => ipcRenderer.invoke('orca:backend:list'),
    select: (backend: string) =>
      ipcRenderer.invoke('orca:backend:select', { backend }),
  },
  logger: {
    info: (msg: string) => ipcRenderer.invoke('orca:log:send', { level: 'info', msg }),
    debug: (msg: string) => ipcRenderer.invoke('orca:log:send', { level: 'debug', msg }),
    warn: (msg: string) => ipcRenderer.invoke('orca:log:send', { level: 'warn', msg }),
    error: (msg: string) => ipcRenderer.invoke('orca:log:send', { level: 'error', msg }),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('orca:settings:get', { key }),
    set: (key: string, value: any) => ipcRenderer.invoke('orca:settings:set', { key, value }),
  },
});

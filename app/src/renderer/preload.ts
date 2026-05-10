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
});

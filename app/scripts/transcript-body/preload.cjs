// Sandboxed Electron preloads expose the built-in electron module through CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('bodyProbe', {
  meta: () => ipcRenderer.invoke('body:meta'),
  page: (request) => ipcRenderer.invoke('body:page', request),
  delta: (offset) => ipcRenderer.invoke('body:delta', offset),
  expected: (offset) => ipcRenderer.invoke('body:expected', offset)
})

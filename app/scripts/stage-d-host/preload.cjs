// eslint-disable-next-line @typescript-eslint/no-require-imports -- The sandboxed Electron preload runs as CommonJS.
const { ipcRenderer } = require('electron')

ipcRenderer.once('stage-d-port', (event) => {
  window.postMessage({ type: 'stage-d-port' }, '*', event.ports)
})

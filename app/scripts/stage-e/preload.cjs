// eslint-disable-next-line @typescript-eslint/no-require-imports -- Sandboxed diagnostic preload.
const { ipcRenderer } = require('electron')
ipcRenderer.once('stage-e-port', (event) => window.postMessage('stage-e-port', '*', event.ports))

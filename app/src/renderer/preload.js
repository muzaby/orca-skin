const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orca', {
  chat: {
    /**
     * @param {object} payload
     * @returns {Promise<object>}
     */
    send: (payload) => ipcRenderer.invoke('orca:chat:send', payload),

    /**
     * @param {(evt: object) => void} callback
     */
    onEvent: (callback) => {
      ipcRenderer.on('orca:chat:event', (_, evt) => callback(evt));
    },

    /**
     * @param {string} sessionId
     * @returns {Promise<void>}
     */
    cancel: (sessionId) =>
      ipcRenderer.invoke('orca:chat:cancel', { sessionId }),
  },

  backend: {
    /**
     * @returns {Promise<object[]>}
     */
    list: () => ipcRenderer.invoke('orca:backend:list'),

    /**
     * @param {string} backend
     * @returns {Promise<void>}
     */
    select: (backend) =>
      ipcRenderer.invoke('orca:backend:select', { backend }),
  },

  logger: {
    /**
     * @param {string} msg
     * @returns {Promise<void>}
     */
    info: (msg) => ipcRenderer.invoke('orca:log:send', { level: 'info', msg }),

    /**
     * @param {string} msg
     * @returns {Promise<void>}
     */
    debug: (msg) => ipcRenderer.invoke('orca:log:send', { level: 'debug', msg }),

    /**
     * @param {string} msg
     * @returns {Promise<void>}
     */
    warn: (msg) => ipcRenderer.invoke('orca:log:send', { level: 'warn', msg }),

    /**
     * @param {string} msg
     * @returns {Promise<void>}
     */
    error: (msg) => ipcRenderer.invoke('orca:log:send', { level: 'error', msg }),
  },

  settings: {
    /**
     * @param {string} key
     * @returns {Promise<any>}
     */
    get: (key) => ipcRenderer.invoke('orca:settings:get', { key }),

    /**
     * @param {string} key
     * @param {any} value
     * @returns {Promise<void>}
     */
    set: (key, value) => ipcRenderer.invoke('orca:settings:set', { key, value }),
  },
});

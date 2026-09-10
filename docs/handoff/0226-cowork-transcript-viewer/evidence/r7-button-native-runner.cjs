const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const cache = path.resolve(process.argv[2])
app.disableHardwareAcceleration()
app.setPath('userData', fs.mkdtempSync(path.join(cache, 'profile-')))
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, width: 1400, height: 1000,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true }
  })
  const result = { success: false, errors: [], screens: [], blockedRequests: [], consoleMessages: [] }
  win.webContents.on('console-message', event => result.consoleMessages.push(event.message))
  win.webContents.session.webRequest.onBeforeRequest((request, callback) => {
    const block = /^https?:/.test(request.url)
    if (block) result.blockedRequests.push(request.url)
    callback({ cancel: block })
  })
  const invoke = (method, ...args) => win.webContents.executeJavaScript(`window.${method}(${args.map(value => JSON.stringify(value)).join(',')})`)
  // Native input may start the CSS transition on a later frame under host load.
  // Await the actual finite button transitions before comparing exact RGB values.
  const settleButtonStyles = async () => {
    await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    await win.webContents.executeJavaScript("Promise.all([...document.querySelectorAll('main .btn-squish')].flatMap(element => element.getAnimations()).map(animation => animation.finished.catch(() => {})))")
  }
  const screen = async name => {
    await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    fs.writeFileSync(path.join(cache, `${name}.png`), (await win.webContents.capturePage()).toPNG())
    result.screens.push(`${name}.png`)
  }
  const key = keyCode => {
    win.webContents.focus()
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode })
    if (keyCode === 'Return') win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode })
  }
  try {
    await win.loadFile(path.join(cache, 'fixture.html'))
    result.stylesheets = await win.webContents.executeJavaScript('[...document.styleSheets].map(sheet => sheet.href)')
    await invoke('nativeMount')
    for (const theme of ['white', 'dark']) {
      for (const width of [1400, 720]) {
        win.setSize(width, 1000)
        for (const surface of ['engine', 'projects', 'skills', 'mcp']) {
          const prefix = `${theme}-${width}-${surface}`
          win.webContents.sendInputEvent({ type: 'mouseMove', x: 1, y: 1 })
          const point = await invoke('nativeShow', theme, surface)
          await settleButtonStyles()
          await invoke('nativeInspect', surface, 'rest')
          await screen(prefix)
          win.webContents.sendInputEvent({ type: 'mouseMove', ...point })
          await settleButtonStyles()
          await invoke('nativeInspect', surface, 'hover')
          if (surface === 'engine') continue
          win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
          win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
          await invoke('nativeOpened', surface, 'click')
          await screen(`${prefix}-open`)
          key('Escape')
          await invoke('nativeClosed', surface, 'click')
          await invoke('nativeFocus', surface)
          key('Return')
          await invoke('nativeOpened', surface, 'enter')
          key('Escape')
          await invoke('nativeClosed', surface, 'enter')
        }
        await invoke('nativeProviders')
      }
    }
    result.observed = await win.webContents.executeJavaScript('window.nativeReport')
    result.success = Object.values(result.observed.checks).every(Boolean) && !result.observed.errors.length && !result.blockedRequests.length && !result.consoleMessages.length
  } catch (error) {
    result.errors.push(String(error.stack || error))
    result.observed = await win.webContents.executeJavaScript('window.nativeReport').catch(() => null)
    fs.writeFileSync(path.join(cache, 'failure.png'), (await win.webContents.capturePage()).toPNG())
  }
  fs.writeFileSync(path.join(cache, 'result.json'), JSON.stringify(result, null, 2))
  app.exit(result.success ? 0 : 1)
})

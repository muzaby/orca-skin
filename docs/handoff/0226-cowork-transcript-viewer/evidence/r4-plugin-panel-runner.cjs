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
  const run = async (name, expression) => {
    await win.webContents.executeJavaScript(expression)
    await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    fs.writeFileSync(path.join(cache, `${name}.png`), (await win.webContents.capturePage()).toPNG())
    result.screens.push(`${name}.png`)
  }
  try {
    await win.loadFile(path.join(cache, 'fixture.html'))
    await run('skills-list-1400', 'window.nativeMount()')
    await run('tab-keyboard', 'window.nativeTabKeyboard()')
    await run('skills-detail-1400', 'window.nativeSkill()')
    await run('skills-switched', 'window.nativeSkillSwitch()')
    win.webContents.debugger.attach('1.3')
    const start = await win.webContents.executeJavaScript('window.nativeDragGeometry()')
    for (const event of [
      { type: 'mouseMoved', x: start.x, y: start.y, buttons: 0 },
      { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 },
      { type: 'mouseMoved', x: start.x - 100, y: start.y, button: 'left', buttons: 1 },
      { type: 'mouseReleased', x: start.x - 100, y: start.y, button: 'left', buttons: 0, clickCount: 1 }
    ]) await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', event)
    await run('skills-resized', 'window.nativeAfterDrag()')
    await run('skills-expanded', 'window.nativeExpand()')
    await run('skills-restored', 'window.nativeRestore()')
    await run('skills-closed', 'window.nativeClose()')
    await run('mcp-detail-1400', 'window.nativeMcp()')
    await run('providers-detail-1400', 'window.nativeProviders()')
    await run('mcp-renamed', 'window.nativeMcpRename()')
    await run('mcp-removed', 'window.nativeMcpRemove()')
    for (const width of [960, 720]) {
      win.setSize(width, 1000)
      await run(`skills-detail-${width}`, 'window.nativeNarrow()')
    }
    result.observed = await win.webContents.executeJavaScript('window.nativeReport')
    result.success = Object.values(result.observed.checks).every(Boolean) && !result.observed.errors.length && !result.blockedRequests.length
  } catch (error) {
    result.errors.push(String(error.stack || error))
    result.observed = await win.webContents.executeJavaScript('window.nativeReport').catch(() => null)
    fs.writeFileSync(path.join(cache, 'failure.png'), (await win.webContents.capturePage()).toPNG())
  }
  fs.writeFileSync(path.join(cache, 'result.json'), JSON.stringify(result, null, 2))
  app.exit(result.success ? 0 : 1)
})

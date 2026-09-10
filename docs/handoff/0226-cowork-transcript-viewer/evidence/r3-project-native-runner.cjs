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
    await run('project-1400', 'window.nativeMount()')
    await run('project-pinned', 'window.nativePin(true)')
    await run('project-unpinned', 'window.nativePin(false)')
    await run('new-1400', 'window.nativeNew()')
    await run('new-project-expanded', 'window.nativeBackground()')
    await run('artifacts-1400', 'window.nativeArtifacts()')
    await run('plugins-1400', 'window.nativePlugins()')
    await run('plugins-mcp', 'window.nativePluginTab("mcp")')
    await run('plugins-connections', 'window.nativePluginTab("providers")')
    await run('projects-1400', 'window.nativeProjects()')
    await run('projects-filters', 'window.nativeProjectFilters()')
    for (const width of [960, 720]) {
      win.setSize(width, 1000)
      await run(`project-${width}`, 'window.nativeProject()')
      await run(`new-${width}`, 'window.nativeNew()')
      await run(`artifacts-${width}`, 'window.nativeArtifacts()')
      await run(`plugins-${width}`, 'window.nativePlugins()')
      await run(`projects-${width}`, 'window.nativeProjects()')
    }
    for (const width of [1400, 720]) {
      win.setSize(width, 1000)
      await run(`engine-${width}`, 'window.nativeEngine()')
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

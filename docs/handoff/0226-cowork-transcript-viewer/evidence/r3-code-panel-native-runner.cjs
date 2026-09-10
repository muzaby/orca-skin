const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path')
const cache = path.resolve(process.argv[2])
app.disableHardwareAcceleration()
app.setPath('userData', fs.mkdtempSync(path.join(cache, 'profile-')))
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1450, height: 1050, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } })
  const result = { success: false, errors: [], screens: [], rendered: {}, blockedRequests: [], consoleMessages: [], manifest: JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json'), 'utf8')) }
  win.webContents.on('console-message', details => result.consoleMessages.push(details.message))
  win.webContents.session.webRequest.onBeforeRequest((request, callback) => { const external = /^https?:/.test(request.url); if (external) result.blockedRequests.push(request.url); callback({ cancel: external }) })
  try {
    await win.loadFile(path.join(cache, 'fixture.html'))
    for (const [name, expression] of [['docked', 'window.nativeMount()'], ['expanded', 'window.nativeExpand()'], ['restored', 'window.nativeRestore()'], ['reopened', 'window.nativeClose()']]) {
      await win.webContents.executeJavaScript(expression)
      await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
      await new Promise(resolve => setTimeout(resolve, 240))
      result.rendered[name] = await win.webContents.executeJavaScript(`(() => {
        const host = document.querySelector('[data-side-pane-host]');
        const surface = document.querySelector('[data-side-pane-expanded]');
        return { host: host?.getBoundingClientRect().toJSON(), surface: surface?.getBoundingClientRect().toJSON(), windowScrollY: scrollY };
      })()`)
      if (name === 'expanded' && !['x', 'y', 'width', 'height'].every(key => Math.abs(result.rendered[name].host[key] - result.rendered[name].surface[key]) < 1)) throw new Error('Expanded bounds shifted before screenshot')
      fs.writeFileSync(path.join(cache, name + '.png'), (await win.webContents.capturePage()).toPNG())
      result.screens.push(name + '.png')
    }
    result.observed = await win.webContents.executeJavaScript('window.nativeReport')
    result.success = Object.values(result.observed.checks).every(Boolean) && result.observed.errors.length === 0 && result.blockedRequests.length === 0
  } catch (error) { result.errors.push(String(error.stack || error)); result.observed = await win.webContents.executeJavaScript('window.nativeReport').catch(() => null); fs.writeFileSync(path.join(cache, 'failure.png'), (await win.webContents.capturePage()).toPNG()) }
  fs.writeFileSync(path.join(cache, 'result.json'), JSON.stringify(result, null, 2))
  app.exit(result.success ? 0 : 1)
})

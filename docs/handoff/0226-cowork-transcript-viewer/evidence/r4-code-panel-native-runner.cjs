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
      if (name === 'docked') await win.webContents.executeJavaScript(`(async () => {
        const opened = [];
        window.orca.files.openPath = async request => { opened.push(request); return { ok: true }; };
        const button = document.querySelector('[data-diff-file-open="src/validation.ts"]');
        button.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        const checks = window.nativeReport.checks;
        checks['file-reveal-retains-path-and-mode'] = opened.length === 1 && opened[0].path.replaceAll('\\\\', '/') === 'C:/fixture/src/validation.ts' && opened[0].mode === 'reveal';
        checks['file-reveal-uses-material-file-open'] = button.querySelector('svg path').getAttribute('d') === 'M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v240h-80v-200H520v-200H240v640h360v80H240Zm638 15L760-183v89h-80v-226h226v80h-90l118 118-56 57Zm-638-95v-640 640Z';
        if (!checks['file-reveal-retains-path-and-mode'] || !checks['file-reveal-uses-material-file-open']) throw Error('File reveal regression');
      })()`)
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

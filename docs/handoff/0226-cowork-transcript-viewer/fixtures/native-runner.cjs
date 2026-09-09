const { app, BrowserWindow } = require('electron')
const fs = require('node:fs'), path = require('node:path')
const cache = path.resolve(process.argv[2])
app.disableHardwareAcceleration()
app.setPath('userData', fs.mkdtempSync(path.join(cache, 'profile-')))
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1450, height: 1050,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } })
  const paint = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { win.webContents.removeListener('paint', painted); reject(new Error('Native paint timed out')) }, 5000)
    const painted = () => { clearTimeout(timer); resolve() }
    win.webContents.once('paint', painted)
    win.webContents.invalidate()
  })
  const result = { success: false, errors: [], screens: [], blockedRequests: [], consoleMessages: [], manifest: JSON.parse(fs.readFileSync(path.join(cache, 'manifest.json'), 'utf8')) }
  win.webContents.on('console-message', details => result.consoleMessages.push(details.message))
  win.webContents.session.webRequest.onBeforeRequest((request, callback) => {
    const external = /^https?:/.test(request.url)
    if (external) result.blockedRequests.push(request.url)
    callback({ cancel: external })
  })
  try {
    win.webContents.debugger.attach('1.3')
    await win.loadFile(path.join(cache, 'fixture.html'))
    const scenes = [
      ['overview', 'window.nativeMount()'], ['transcript', 'window.nativeTranscript()'],
      ['markdown', 'window.nativeOpen(0)'], ['source', 'window.nativeCode().then(window.nativeSyntax)'],
      ['actions', 'window.nativeActions()'], ['back', 'window.nativeClose()'],
      ['html', 'window.nativeOpen(1).then(window.nativeHtml)'], ['html-back', 'window.nativeClose()'],
      ['code', 'window.nativeOpen(2)'], ['code-back', 'window.nativeClose()'],
      ['image', 'window.nativeOpen(3).then(window.nativeImage)'], ['image-back', 'window.nativeClose()'],
      ['transcript-entry', "window.nativeOpen(0, 'transcript')"], ['dark', 'window.nativeDark()'],
      ['late-close', 'window.nativeLateClose()'],
      ['session-switch', 'window.nativeSessionSwitch()'], ['retry', 'window.nativeRetry()'],
      ['unmount', 'window.nativeUnmount()'], ['code-mode', 'window.nativeCodeMode()']
    ]
    for (const [name, expression] of scenes) {
      await win.webContents.executeJavaScript(expression)
      if (name === 'html') {
        // DOMSnapshot reads the real opaque frame without enabling scripts or same-origin.
        await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        fs.writeFileSync(path.join(cache, 'html-inspection.png'), (await win.webContents.capturePage()).toPNG())
        let snapshot = await win.webContents.debugger.sendCommand('DOMSnapshot.captureSnapshot', { computedStyles: ['padding-top', 'background-color'] })
        const targets = await win.webContents.debugger.sendCommand('Target.getTargets')
        result.targets = targets.targetInfos.map(target => ({ targetId: target.targetId, type: target.type, url: target.url }))
        const frameTarget = targets.targetInfos.find(target => target.type === 'iframe')
        if (frameTarget) {
          const attached = await win.webContents.debugger.sendCommand('Target.attachToTarget', { targetId: frameTarget.targetId, flatten: true })
          snapshot = await win.webContents.debugger.sendCommand('DOMSnapshot.captureSnapshot', { computedStyles: ['padding-top', 'background-color'] }, attached.sessionId)
        }
        const decode = index => snapshot.strings[index]
        result.htmlFrames = snapshot.documents.map(doc => decode(doc.documentURL))
        const doc = snapshot.documents.find(doc => decode(doc.documentURL) === 'about:srcdoc')
        if (!doc) throw new Error(`Native HTML frame did not load: ${JSON.stringify(result.htmlFrames)}`)
        const names = doc.nodes.nodeName.map(decode)
        const body = names.indexOf('BODY'), html = names.indexOf('HTML')
        const attrs = index => Object.fromEntries((doc.nodes.attributes[index] ?? []).reduce((pairs, value, offset, values) => offset % 2 ? pairs : [...pairs, [decode(value), decode(values[offset + 1])]], []))
        const styles = doc.layout.styles[doc.layout.nodeIndex.indexOf(body)].map(decode)
        const rootStyles = doc.layout.styles[doc.layout.nodeIndex.indexOf(html)].map(decode)
        const observed = {
          rootStyle: attrs(body).class === 'report' && attrs(html).lang === 'ko' && styles[0] === '32px' && styles[1] === 'rgb(240, 248, 245)' && rootStyles[1] === 'rgba(0, 0, 0, 0)',
          inert: !names.some((name, index) => ['SCRIPT','IFRAME','TEMPLATE','animate'].includes(name) || (name === 'A' && attrs(index).href) || (name === 'IMG' && attrs(index).src?.startsWith('https:')))
        }
        await win.webContents.executeJavaScript(`window.nativeReport.checks['html-root-styles-preserved']=${observed.rootStyle};window.nativeReport.checks['html-active-content-removed']=${observed.inert}`)
        if (!observed.rootStyle || !observed.inert) throw new Error('HTML style or isolation regression')
      }
      await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
      await paint()
      fs.writeFileSync(path.join(cache, `${name}.png`), (await win.webContents.capturePage()).toPNG())
      result.screens.push(`${name}.png`)
    }
    result.observed = await win.webContents.executeJavaScript('window.nativeReport')
    result.success = Object.values(result.observed.checks).every(Boolean) && result.observed.errors.length === 0 && result.blockedRequests.length === 0
  } catch (error) {
    result.errors.push(String(error.stack || error))
    result.observed = await win.webContents.executeJavaScript('window.nativeReport').catch(() => null)
    fs.writeFileSync(path.join(cache, 'failure.png'), (await win.webContents.capturePage()).toPNG())
  }
  fs.writeFileSync(path.join(cache, 'result.json'), JSON.stringify(result, null, 2))
  app.exit(result.success ? 0 : 1)
})

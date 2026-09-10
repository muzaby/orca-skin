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
      ['catalog-all', 'window.nativeMount()'], ['catalog-pinned', 'window.nativePinned()'],
      ['catalog-search', 'window.nativeSearch()'], ['catalog-search-empty', 'window.nativeSearchEmpty()'],
      ['catalog-menu', 'window.nativeMenu()'], ['catalog-pin-unpin', 'window.nativePin()'],
      ['catalog-pin-failure', 'window.nativePinFailure()'], ['catalog-preview', 'window.nativePreview()'],
      ['catalog-expanded', 'window.nativeExpand()'], ['catalog-download-close', 'window.nativeDownload()'],
      ['html', 'window.nativeHtml()'], ['catalog-image', 'window.nativeImage()'],
      ['catalog-code', 'window.nativeCode()'], ['catalog-delete-dialog', 'window.nativeDelete()'],
      ['catalog-deleted', 'window.nativeConfirmDelete()'], ['catalog-route-race', 'window.nativeLateRoute()'],
      ['catalog-preview-top', 'window.nativePreviewTop()'],
      ['catalog-dark', 'window.nativeDark()'],
      ['catalog-html-resize-target', 'window.nativeHtml()'], ['catalog-resize', 'resize:catalog'], ['catalog-resize-restored', 'window.nativeResizeRestore()'],
      ['catalog-drag-close', 'cancel:catalog'],
      ['chat-task', 'window.nativeChat()'], ['chat-output-cards', 'window.nativeOutputCards()'], ['chat-task-expanded', 'window.nativeTaskExpand()'],
      ['chat-task-restored', 'window.nativeTaskRestore()'],
      ['chat-html', 'window.nativeChatViewer()'], ['chat-resize', 'resize:transcript'],
      ['chat-viewer-expanded', 'window.nativeChatViewerExpand()'],
      ['chat-viewer-restored', 'window.nativeChatViewerRestore()'],
      ['chat-change-target-ready', 'window.nativeChatViewer()'], ['chat-change-target', 'target:transcript'],
      ['chat-plan', 'window.nativeChat("code")'], ['chat-plan-expanded', 'window.nativeTaskExpand("code")'], ['chat-plan-restored', 'window.nativeTaskRestore()']
    ]
    const selectedScenes = process.argv[3] === 'plan' ? [['catalog-all','window.nativeMount()'],['chat-plan','window.nativeChat("code")'],['chat-plan-expanded','window.nativeTaskExpand("code")'],['chat-plan-restored','window.nativeTaskRestore()']] : scenes
    for (const [name, expression] of selectedScenes) {
      if (expression.startsWith('resize:') || expression.startsWith('cancel:') || expression.startsWith('target:')) {
        const rect = await win.webContents.executeJavaScript('window.nativeResizeReady()')
        const x = Math.round(rect.x+rect.width/2), y = Math.round(rect.y+Math.min(250,rect.height/2))
        win.webContents.sendInputEvent({ type:'mouseMove', x, y })
        win.webContents.sendInputEvent({ type:'mouseDown', x, y, button:'left', clickCount:1 })
        await new Promise(resolve => setTimeout(resolve,100))
        // Cross the live iframe before growing the pane again.
        win.webContents.sendInputEvent({ type:'mouseMove', x:x+180, y, button:'left' })
        await new Promise(resolve => setTimeout(resolve,100))
        if (expression.startsWith('target:')) {
          await win.webContents.executeJavaScript('window.nativeChangeDuringDrag()')
          win.webContents.sendInputEvent({ type:'mouseMove', x:x-60, y, button:'left' })
          win.webContents.sendInputEvent({ type:'mouseUp', x:x-60, y, button:'left', clickCount:1 })
          await win.webContents.executeJavaScript('window.nativeAfterTargetChange()')
        } else if (expression.startsWith('cancel:')) {
          await win.webContents.executeJavaScript('window.nativeCancelDrag()')
          win.webContents.sendInputEvent({ type:'mouseUp', x:x+180, y, button:'left', clickCount:1 })
        } else {
          win.webContents.sendInputEvent({ type:'mouseMove', x:x-85, y, button:'left' })
          await new Promise(resolve => setTimeout(resolve,100))
          win.webContents.sendInputEvent({ type:'mouseUp', x:x-85, y, button:'left', clickCount:1 })
          await win.webContents.executeJavaScript(`window.nativeResizeCheck(${JSON.stringify(expression.split(':')[1])})`)
        }
      } else await win.webContents.executeJavaScript(expression)
      if (name === 'html') {
        // DOMSnapshot reads the real opaque frame without enabling scripts or same-origin.
        await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
        fs.writeFileSync(path.join(cache, 'html-inspection.png'), (await win.webContents.capturePage()).toPNG())
        const deadline = Date.now() + 5000
        const attachedFrames = new Map()
        const snapshotOptions = { computedStyles: ['padding-top', 'background-color'] }
        const hasLoadedFrame = value => value.documents.some(doc => value.strings[doc.documentURL] === 'about:srcdoc' && doc.nodes.nodeName.some((name, index) => value.strings[name] === 'BODY' && doc.layout.nodeIndex.includes(index)))
        let snapshot
        do {
          snapshot = await win.webContents.debugger.sendCommand('DOMSnapshot.captureSnapshot', snapshotOptions)
          if (hasLoadedFrame(snapshot)) break
          const targets = await win.webContents.debugger.sendCommand('Target.getTargets')
          result.targets = targets.targetInfos.map(target => ({ targetId: target.targetId, type: target.type, url: target.url }))
          for (const frameTarget of targets.targetInfos.filter(target => target.type === 'iframe')) {
            let sessionId = attachedFrames.get(frameTarget.targetId)
            if (!sessionId) {
              const attached = await win.webContents.debugger.sendCommand('Target.attachToTarget', { targetId: frameTarget.targetId, flatten: true })
              sessionId = attached.sessionId
              attachedFrames.set(frameTarget.targetId, sessionId)
            }
            snapshot = await win.webContents.debugger.sendCommand('DOMSnapshot.captureSnapshot', snapshotOptions, sessionId)
            if (hasLoadedFrame(snapshot)) break
          }
          if (hasLoadedFrame(snapshot)) break
          await new Promise(resolve => setTimeout(resolve, 100))
        } while (Date.now() < deadline)
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
      await new Promise(resolve => setTimeout(resolve, 240))
      await paint()
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

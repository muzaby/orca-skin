import { app, BrowserWindow } from 'electron'
const [origin] = process.argv.slice(-3)
app.whenReady().then(async () => {
  const records = []
  const win = new BrowserWindow({
    width: 1440,
    height: 840,
    useContentSize: true,
    webPreferences: { sandbox: true, backgroundThrottling: false }
  })
  let stage = 'boot'
  const timer = setTimeout(() => {
    process.stdout.write(
      'OO_RESULT ' + JSON.stringify({ records, error: 'Timed out at ' + stage }) + '\n',
      () => app.exit(1)
    )
  }, 240000)
  try {
    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 3) console.error(message)
    })
    for (const reduced of [false, true]) {
      const wc = win.webContents
      stage = 'load ' + reduced
      await win.loadURL(origin)
      stage = 'emulate ' + reduced
      wc.debugger.attach('1.3')
      await wc.debugger.sendCommand('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]
      })
      try {
        stage = 'measure ' + reduced
        const result = await wc.executeJavaScript('window.measureRightPanel()')
        records.push(...result.map((row) => ({ ...row, reduced })))
        stage = 'native drag ' + reduced
        await wc.executeJavaScript('window.preparePanelDrag()')
        win.setContentSize(690, 840)
        const clamped = await wc.executeJavaScript('window.checkClampedWidth()')
        records.push({ ...clamped, reduced })
        win.setContentSize(1440, 840)
        const { x, y, before } = await wc.executeJavaScript('window.preparePanelDrag()')
        const mouse = (type, position, options = {}) =>
          wc.debugger.sendCommand('Input.dispatchMouseEvent', { type, x: position, y, ...options })
        await mouse('mouseMoved', x)
        await mouse('mousePressed', x, { button: 'left', buttons: 1, clickCount: 1 })
        const dragSamples = []
        for (const offset of [16, 32, 48, 64]) {
          await mouse('mouseMoved', x - offset, { buttons: 1 })
          const sample =
            await wc.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>{
            const frame=document.querySelector('[data-right-panel-frame]'), rect=frame.getBoundingClientRect()
            resolve({width:rect.width,right:rect.right,transition:getComputedStyle(frame).transitionDuration})
          }))`)
          dragSamples.push({ ...sample, expected: before + offset })
        }
        await mouse('mouseReleased', x - 64, { button: 'left', clickCount: 1 })
        const drag = await wc.executeJavaScript(
          'window.checkPanelDrag(' + JSON.stringify(before) + ',64)'
        )
        records.push({ ...drag, reduced })
        records.push({
          name: 'native-drag-no-transition',
          reduced,
          ok: dragSamples.every(
            (s) => Math.abs(s.expected - s.width) <= 1 && parseFloat(s.transition) === 0
          ),
          samples: dragSamples
        })
        const equalWidths = await wc.executeJavaScript('window.checkEqualWidths()')
        records.push({ ...equalWidths, reduced })
      } catch (error) {
        records.push({ ok: false, reduced, error: String(error) })
      }
      wc.debugger.detach()
    }
    await new Promise((resolve) =>
      process.stdout.write('OO_RESULT ' + JSON.stringify({ records }) + '\n', resolve)
    )
  } finally {
    clearTimeout(timer)
    app.quit()
  }
})

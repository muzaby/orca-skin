import { app, BrowserWindow } from 'electron'
import { setTimeout as delay } from 'node:timers/promises'

const [origin, screens] = process.argv.slice(-3)
const records = []
app.whenReady().then(async () => {
  const deadline = setTimeout(() => {
    process.stdout.write(
      'OO_RESULT ' + JSON.stringify({ records, error: 'Timed out driving history probe' }) + '\n'
    )
    app.exit(1)
  }, 90000)
  try {
    const win = new BrowserWindow({
      width: 1000,
      height: 600,
      useContentSize: true,
      show: true,
      webPreferences: { sandbox: true, backgroundThrottling: false }
    })
    win.focus()
    const wc = win.webContents
    const probe = (method) => wc.executeJavaScript('window.historyProbe.' + method + '()', true)
    for (const screen of screens.split(',')) {
      for (const scenario of ['top', 'followup', 'middle', 'inertia', 'states', 'reverse']) {
        try {
          await win.loadURL(origin + '/?screen=' + screen)
          const { x, y, start } = await probe('prepare')
          const wheel = (delta) =>
            wc.sendInputEvent({
              type: 'mouseWheel',
              x,
              y,
              deltaX: 0,
              deltaY: -delta,
              canScroll: true,
              hasPreciseScrollingDeltas: true
            })
          if (scenario === 'states') {
            const states = await probe('states')
            records.push({ screen, scenario, start, states, ...(await probe('result')) })
            continue
          }
          wheel(-10)
          let momentum
          if (scenario === 'inertia') {
            momentum = (async () => {
              for (let i = 1; i < 30; i++) {
                await delay(16)
                wheel(-8)
              }
            })()
          }
          await delay(32)
          if (scenario === 'middle') await probe('middle')
          const commit = await probe('commit')
          if (scenario === 'followup' || scenario === 'reverse') {
            await delay(35)
            wheel(scenario === 'reverse' ? 18 : -10)
          }
          await momentum
          const result = await probe('result')
          records.push({
            screen,
            scenario,
            start,
            ...commit,
            ...result,
            lineShiftPx: result.after.top - commit.before.top,
            wheelAfterCommitMs: result.wheels
              .filter((w) => w.at >= commit.commitAt)
              .map((w) => w.at - commit.commitAt)
          })
        } catch (e) {
          records.push({ screen, scenario, error: String(e) })
        }
      }
    }
    process.stdout.write(
      'OO_RESULT ' +
        JSON.stringify({
          electron: process.versions.electron,
          platform: process.platform,
          records
        }) +
        '\n'
    )
  } catch (e) {
    process.stdout.write('OO_RESULT ' + JSON.stringify({ error: String(e) }) + '\n')
  }
  clearTimeout(deadline)
  app.exit()
})

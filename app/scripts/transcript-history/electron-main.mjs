import { app, BrowserWindow } from 'electron'
import { setTimeout as delay } from 'node:timers/promises'
import { scenarios } from './scenarios.mjs'

const [origin, screens, repetitions] = process.argv.slice(-3)
const records = []
const discarded = []
const searches = []

async function measure(wc, screen, scenario) {
  await wc.loadURL(origin + '/?' + new URLSearchParams({ screen, scenario }))
  const probe = (method) => wc.executeJavaScript('window.historyProbe.' + method + '()', true)
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
  if (scenario === 'states')
    return { start, states: await probe('states'), ...(await probe('result')) }
  wheel(-10)
  if (scenario === 'nested') {
    await probe('nestedBoundary')
    await delay(230)
    wheel(-10)
  }
  const momentum =
    scenario === 'inertia'
      ? (async () => {
          for (let i = 1; i < 30; i++) {
            await delay(16)
            wheel(-8)
          }
        })()
      : undefined
  if (scenario === 'middle') await probe('middle')
  const commit = await probe('commit')
  if (scenario === 'followup' || scenario === 'reverse' || scenario === 'expired') {
    await delay(scenario === 'expired' ? 230 : 35)
    wheel(scenario === 'reverse' ? 18 : -10)
  }
  await momentum
  const result = await probe('result')
  return {
    start,
    ...commit,
    ...result,
    lineShiftPx: result.after.top - commit.before.top,
    wheelAfterCommitMs: result.wheels
      .filter((w) => w.at >= commit.commitAt)
      .map((w) => w.at - commit.commitAt)
  }
}
function report(result) {
  return new Promise((resolve, reject) => {
    process.stdout.write('OO_RESULT ' + JSON.stringify(result) + '\n', (error) =>
      error ? reject(error) : resolve()
    )
  })
}

app.whenReady().then(async () => {
  const deadline = setTimeout(
    async () => {
      await report({ records, discarded, error: 'History probe timed out' })
      app.exit(1)
    },
    90000 * Math.max(1, Number(repetitions))
  )
  try {
    const win = new BrowserWindow({
      width: 1000,
      height: 600,
      useContentSize: true,
      show: true,
      webPreferences: { sandbox: true, backgroundThrottling: false }
    })
    win.focus()
    for (const screen of screens.split(',')) {
      for (const keyboard of [false, true]) {
        try {
          const wc = win.webContents
          await wc.loadURL(origin + '/?' + new URLSearchParams({ screen, scenario: 'search' }))
          const probe = (method) =>
            wc.executeJavaScript('window.historyProbe.' + method + '()', true)
          await probe('searchInput')
          wc.sendInputEvent({ type: 'char', keyCode: 'x' })
          const point = await probe('searchOption')
          if (keyboard) {
            wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
            wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
          } else {
            wc.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point })
            wc.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point })
          }
          searches.push({ screen, keyboard, ...(await probe('searchResult')) })
        } catch (error) {
          searches.push({ screen, keyboard, error: String(error) })
        }
      }
    }
    for (let run = 0; run < Number(repetitions); run++) {
      for (const screen of screens.split(',')) {
        for (const scenario of scenarios) {
          try {
            for (let attempt = 0; ; attempt++) {
              const result = await measure(win.webContents, screen, scenario)
              const wheels = result.wheels
              if (
                scenario === 'followup' &&
                wheels.length === 2 &&
                wheels[1].timestamp - wheels[0].timestamp >= 200
              ) {
                discarded.push({ run, screen, scenario, attempt, wheels })
                if (attempt >= 3) throw Error('Could not deliver follow-up within the gesture gap')
                continue
              }
              records.push({ run, screen, scenario, ...result })
              break
            }
          } catch (e) {
            records.push({ run, screen, scenario, error: String(e) })
          }
        }
      }
    }
    await report({
      electron: process.versions.electron,
      platform: process.platform,
      records,
      discarded,
      searches
    })
  } catch (error) {
    await report({ error: String(error) })
  }
  clearTimeout(deadline)
  app.exit()
})

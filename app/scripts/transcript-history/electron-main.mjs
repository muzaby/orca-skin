import { app, BrowserWindow } from 'electron'
import { setTimeout as delay } from 'node:timers/promises'
import { scenarios } from './scenarios.mjs'

const [origin, screens, repetitions] = process.argv.slice(-3)
const records = []
const discarded = []

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
app.whenReady().then(async () => {
  const deadline = setTimeout(
    () => {
      process.stdout.write(
        'OO_RESULT ' +
          JSON.stringify({ records, discarded, error: 'History probe timed out' }) +
          '\n'
      )
      app.exit(1)
    },
    90000 * Number(repetitions)
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
    process.stdout.write(
      'OO_RESULT ' +
        JSON.stringify({
          electron: process.versions.electron,
          platform: process.platform,
          records,
          discarded
        }) +
        '\n'
    )
  } catch (e) {
    process.stdout.write('OO_RESULT ' + JSON.stringify({ error: String(e) }) + '\n')
  }
  clearTimeout(deadline)
  app.exit()
})

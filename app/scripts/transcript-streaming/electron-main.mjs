import { app, BrowserWindow } from 'electron'
import { STEPS } from './steps.mjs'
const [origin, screens, runs] = process.argv.slice(-3)
async function drive(win) {
  const records = []
  for (const screen of screens.split(','))
    for (const scenario of ['P1', 'U1'])
      for (let run = 0; run < Number(runs); run++) {
        const r = { screen, scenario, run, steps: [] }
        records.push(r)
        const call = (method, ...args) =>
          win.webContents.executeJavaScript(
            `window.probe.${method}(${args.map((x) => JSON.stringify(x)).join(',')})`
          )
        try {
          await win.loadURL(origin + '/?screen=' + screen)
          for (const { step } of STEPS) {
            await call('advance', step)
            if (step === 'sync@4000' && scenario === 'U1') {
              for (let wheel = 0; wheel < 20; wheel++) {
                const p = await call('locateReadingPosition')
                if (p.tailBelow && p.rowTopAbove && p.anchor) {
                  r.preconditions = p
                  break
                }
                win.webContents.sendInputEvent({
                  type: 'mouseWheel',
                  x: 400,
                  y: 260,
                  deltaX: 0,
                  deltaY: 260,
                  hasPreciseScrollingDeltas: true,
                  canScroll: true
                })
                await new Promise((resolve) => setTimeout(resolve, 100))
              }
            }
            r.steps.push(await call('observe', step))
          }
        } catch (error) {
          r.error = String(error)
        }
      }
  return records
}
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 900,
      height: 560,
      useContentSize: true,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    win.focus()
    console.log(
      'OO_RESULT ' +
        JSON.stringify({ electron: process.versions.electron, records: await drive(win) })
    )
  } catch (error) {
    console.log('OO_RESULT ' + JSON.stringify({ error: String(error) }))
  }
  app.exit(0)
})

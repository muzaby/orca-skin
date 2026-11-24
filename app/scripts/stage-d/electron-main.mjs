import { app, BrowserWindow } from 'electron'
import { pngImage } from '../measure-ui-inputs.mjs'

const [origin, scenarios, runs] = process.argv.slice(-3)
const width = 4032
const height = 3024

app.whenReady().then(async () => {
  try {
    const window = new BrowserWindow({
      width: 900,
      height: 560,
      webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false }
    })
    await window.loadURL(origin)
    if (scenarios === 'catalogs') {
      const catalogs = await window.webContents.executeJavaScript(
        `window.measureCatalogs(${Number(runs)})`
      )
      console.log('OO_RESULT ' + JSON.stringify({ electron: process.versions.electron, catalogs }))
      return
    }
    const calculations = await window.webContents.executeJavaScript(
      `window.measureCalculations(${Number(runs)})`
    )
    const images = Array.from({ length: 5 }, (_, seed) =>
      pngImage(width, height, seed).toString('base64')
    )
    const { records, budget } = await window.webContents.executeJavaScript(
      `window.measureImageOverlap(${JSON.stringify(images)}, ${Number(runs)})`
    )
    const heightRecords = await window.webContents.executeJavaScript(
      `window.measureHeight(${Number(runs)})`
    )
    const planGeometry = await window.webContents.executeJavaScript('window.measurePlanGeometry()')
    const installLog = await window.webContents.executeJavaScript('window.measureInstallLog()')
    console.log(
      'OO_RESULT ' +
        JSON.stringify({
          electron: process.versions.electron,
          fixture: 'S-D2 worker overlap',
          width,
          height,
          images: images.length,
          label: 'diagnostic',
          records,
          heightRecords,
          planGeometry,
          installLog,
          calculations,
          budget
        })
    )
  } catch (error) {
    console.log('OO_RESULT ' + JSON.stringify({ error: String(error) }))
  } finally {
    app.exit(0)
  }
})

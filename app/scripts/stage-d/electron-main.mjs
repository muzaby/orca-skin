import { app, BrowserWindow, MessageChannelMain, utilityProcess } from 'electron'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { pngImage } from '../measure-ui-inputs.mjs'

const [origin, scenarios, runs] = process.argv.slice(-3)
const width = 4032
const height = 3024

app.whenReady().then(async () => {
  let agent
  try {
    const window = new BrowserWindow({
      width: 900,
      height: 560,
      webPreferences: {
        ...(scenarios.startsWith('installer=') && {
          preload: fileURLToPath(new URL('../stage-d-host/preload.cjs', import.meta.url))
        }),
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false
      }
    })
    // Chromium can hide the message of an exception thrown by a page expression.
    const evaluate = async (source) => {
      const result = await window.webContents.executeJavaScript(
        `(async () => { try { return { value: await (${source}) } } catch (error) { return { failure: String(error) } } })()`
      )
      if (result.failure) throw Error(result.failure)
      return result.value
    }
    await window.loadURL(origin)
    if (scenarios === 'panel-timings') {
      const samples = []
      for (let run = 0; run <= Number(runs); run++) {
        const sample = await evaluate('window.measurePanelTimings()')
        if (run) samples.push(sample)
      }
      console.log('OO_RESULT ' + JSON.stringify({ electron: process.versions.electron, samples }))
      return
    }
    if (scenarios === 'resources') {
      const samples = []
      for (let run = 0; run <= Number(runs); run++) {
        const sample = await evaluate('window.measureResources()')
        if (run) samples.push(sample)
      }
      console.log('OO_RESULT ' + JSON.stringify({ electron: process.versions.electron, samples }))
      return
    }
    if (scenarios === 'geometry') {
      const geometry = await evaluate('window.measurePlanGeometry()')
      console.log('OO_RESULT ' + JSON.stringify({ electron: process.versions.electron, geometry }))
      return
    }
    if (scenarios === 'overlap') {
      const images = Array.from({ length: 5 }, (_, seed) =>
        pngImage(width, height, seed).toString('base64')
      )
      const overlap = await evaluate(`window.measureStreamOverlap(${JSON.stringify(images)})`)
      console.log('OO_RESULT ' + JSON.stringify({ electron: process.versions.electron, overlap }))
      return
    }
    if (scenarios.startsWith('installer=')) {
      agent = utilityProcess.fork(scenarios.slice('installer='.length), [], { stdio: 'pipe' })
      let hostError = ''
      agent.stderr.on('data', (chunk) => {
        hostError = (hostError + chunk).slice(-1500)
      })
      const signal = async (expected) => {
        const result = await Promise.race([
          once(agent, 'message'),
          once(agent, 'exit').then(([code]) => {
            throw Error('installer host exit ' + code + ' ' + hostError)
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(Error('host timed out ' + expected + ' ' + hostError)), 15000)
          )
        ])
        if (result[0] !== expected) throw Error('installer host ' + result[0])
      }
      await signal('ready')
      const { port1, port2 } = new MessageChannelMain()
      const connected = signal('connected')
      agent.postMessage('connect', [port1])
      await connected
      await evaluate(
        "void (window.stageDInstall = new Promise((resolve,reject)=>window.addEventListener('message',e=>window.measureInstallFlow(e.ports[0]).then(resolve,reject),{once:true})))"
      )
      window.webContents.postMessage('stage-d-port', null, [port2])
      const install = await evaluate(
        "Promise.race([window.stageDInstall,new Promise((_,reject)=>setTimeout(()=>reject(Error('no installer result')),40000))])"
      )
      console.log('OO_RESULT ' + JSON.stringify({ electron: process.versions.electron, install }))
      return
    }
    if (scenarios === 'interactions') {
      const catalogSelection = await evaluate('window.measureCatalogSelection()')
      const resources = await evaluate('window.measureResources()')
      const provider = await evaluate('window.measureProviderFlow()')
      const commentIndex = await evaluate('window.measureCommentIndex()')
      const inputs = await evaluate('window.measurePanelInputs()')
      const composer = []
      for (const source of ['dialog', 'drag_drop', 'clipboard']) {
        composer.push(await evaluate(`window.measureComposerFlow(${JSON.stringify(source)})`))
      }
      console.log(
        'OO_RESULT ' +
          JSON.stringify({
            electron: process.versions.electron,
            composer,
            inputs,
            catalogSelection,
            commentIndex,
            provider,
            resources
          })
      )
      return
    }
    if (scenarios === 'catalogs') {
      const catalogs = await evaluate(`window.measureCatalogs(${Number(runs)})`)
      console.log('OO_RESULT ' + JSON.stringify({ electron: process.versions.electron, catalogs }))
      return
    }
    const calculations = await evaluate(`window.measureCalculations(${Number(runs)})`)
    const images = Array.from({ length: 5 }, (_, seed) =>
      pngImage(width, height, seed).toString('base64')
    )
    const { records, budget } = await evaluate(
      `window.measureImageOverlap(${JSON.stringify(images)}, ${Number(runs)})`
    )
    const heightRecords = await evaluate(`window.measureHeight(${Number(runs)})`)
    const planGeometry = await evaluate('window.measurePlanGeometry()')
    const installLog = await evaluate('window.measureInstallLog()')
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
    agent?.kill()
    app.exit(0)
  }
})

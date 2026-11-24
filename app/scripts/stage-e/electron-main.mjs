import { app, BrowserWindow, MessageChannelMain, utilityProcess } from 'electron'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [origin, options] = process.argv.slice(-3)
const { bundle, size, root } = JSON.parse(options)
const fixture = await mkdtemp(join(tmpdir(), 'oo-stage-e-'))
app.setPath('userData', fixture)
app.whenReady().then(async () => {
  let host
  let window
  let timer
  let hostError = ''
  try {
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(Error('Timed out waiting for the baseline measurement')),
        120000
      )
    })
    host = utilityProcess.fork(
      bundle,
      [fixture, join(root, 'src/main/infra/db/migrations'), size],
      {
        stdio: 'pipe'
      }
    )
    host.stderr.on('data', (data) => {
      hostError = (hostError + data).slice(-2500)
    })
    const exited = once(host, 'exit').then(([code]) => {
      throw Error('Data host exited with ' + code)
    })
    const checked = (operation) => Promise.race([operation, deadline, exited])
    const [signal] = await checked(once(host, 'message'))
    if (signal !== 'ready') throw Error('Fixture did not start')
    window = new BrowserWindow({
      width: 900,
      height: 560,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false,
        preload: fileURLToPath(new URL('./preload.cjs', import.meta.url))
      }
    })
    await checked(window.loadURL(origin))
    const { port1, port2 } = new MessageChannelMain()
    host.postMessage('connect', [port1])
    window.webContents.postMessage('stage-e-port', null, [port2])
    const result = await checked(
      window.webContents.executeJavaScript('window.measureHistoryOpen()')
    )
    const response = once(host, 'message')
    host.postMessage('metrics')
    const [metrics] = await checked(response)
    const anchor =
      size === 'small'
        ? await checked(window.webContents.executeJavaScript('window.baselineAnchor()'))
        : undefined
    console.log(
      'OO_RESULT ' +
        JSON.stringify({
          ...result,
          ...metrics,
          anchor,
          platform: process.platform,
          electron: process.versions.electron
        })
    )
  } catch (error) {
    console.log('OO_RESULT ' + JSON.stringify({ error: String(error), hostError }))
  } finally {
    clearTimeout(timer)
    window?.destroy()
    if (host) {
      const stopped = once(host, 'exit')
      if (host.kill()) await stopped
    }
    await rm(fixture, { recursive: true, force: true, maxRetries: 3 })
    app.quit()
  }
})

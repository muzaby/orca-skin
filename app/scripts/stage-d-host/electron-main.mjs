import { app, BrowserWindow, MessageChannelMain, utilityProcess } from 'electron'
import { mkdtempSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [origin, options, runs] = process.argv.slice(-3)
const { bundle, sha, baseline, flows } = JSON.parse(options)
const fixture = mkdtempSync(join(tmpdir(), 'oo-stage-d-host-'))
app.setPath('userData', fixture)

function waitFor(worker, expected) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(Error('No host ' + expected + ' signal')), 30_000)
    function receive(message) {
      if (message === expected) finish()
    }
    function exited(code) {
      finish(Error('Diagnostic host exited with ' + code))
    }
    function finish(error) {
      clearTimeout(timer)
      worker.off('message', receive)
      worker.off('exit', exited)
      if (error) reject(error)
      else resolve()
    }
    worker.on('message', receive)
    worker.once('exit', exited)
  })
}

app.whenReady().then(async () => {
  let host
  let window
  let hostError = ''
  try {
    const cwd = join(fixture, 'workspace')
    await mkdir(cwd)
    for (let offset = 0; offset < 20_000; offset += 200) {
      await Promise.all(
        Array.from({ length: 200 }, (_, i) => {
          const index = offset + i
          const prefix = index % 1000 === 0 ? '.src-' : index % 2 === 0 ? 'src-' : 'file-'
          return writeFile(join(cwd, prefix + index + '.txt'), '')
        })
      )
    }
    host = utilityProcess.fork(bundle, [cwd, flows ? 'flows' : 'measure'], { stdio: 'pipe' })
    host.stderr?.on('data', (chunk) => {
      hostError = (hostError + chunk).slice(-3000)
    })
    await waitFor(host, 'ready')
    window = new BrowserWindow({
      width: 900,
      height: 560,
      webPreferences: {
        preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false
      }
    })
    await window.loadURL(origin)
    const rendererReady = await window.webContents.executeJavaScript(
      'typeof window.measureHostQueries === "function"'
    )
    if (!rendererReady) throw Error('Diagnostic renderer did not load')
    const { port1, port2 } = new MessageChannelMain()
    const connected = waitFor(host, 'connected')
    host.postMessage('connect', [port1])
    await connected
    window.webContents.postMessage('stage-d-port', null, [port2])
    const result = await window.webContents.executeJavaScript(
      flows
        ? `window.measureDataFlows(${JSON.stringify(cwd)}, ${flows === 'usage' ? Number(runs) : 0})`
        : `window.measureHostQueries(${JSON.stringify(cwd)}, ${Number(runs)})`
    )
    console.log(
      'OO_RESULT ' +
        JSON.stringify({
          ...result,
          sha,
          baseline,
          environment: 'linux-electron',
          electron: process.versions.electron
        })
    )
  } catch (error) {
    console.log('OO_RESULT ' + JSON.stringify({ error: String(error), hostError }))
  } finally {
    window?.destroy()
    host?.kill()
    await rm(fixture, { recursive: true, force: true, maxRetries: 3 })
    app.exit()
  }
})

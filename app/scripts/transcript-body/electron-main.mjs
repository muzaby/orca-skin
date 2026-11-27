import { app, BrowserWindow, clipboard, ipcMain } from 'electron'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { findVisibleTarget } from './find-target.mjs'
import { middleCorpus, measureMiddleSelection } from './middle-selection.mjs'
import { fixture } from './fixtures.mjs'

const [url] = process.argv.slice(-3)
const params = new URL(url).searchParams
const input = params.get('input')
const run = Number(params.get('run'))
const screen = params.get('screen')
const budget = input === 'B5' ? 600000 : 180000
const chunkBytes = 65536

function find(wc, needle, findNext, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const updates = []
    let selectionArea
    const timer = setTimeout(
      () => finish(Error('findInPage timed out ' + JSON.stringify({ requestId, updates }))),
      timeoutMs
    )
    const listener = (_event, result) => {
      updates.push([
        result.requestId,
        result.finalUpdate,
        result.matches,
        result.activeMatchOrdinal
      ])
      if (result.requestId !== requestId) return
      if (result.selectionArea?.width) selectionArea = result.selectionArea
      if (result.finalUpdate) finish(undefined, { ...result, selectionArea })
    }
    function finish(error, result) {
      clearTimeout(timer)
      wc.removeListener('found-in-page', listener)
      if (error) reject(error)
      else resolve(result)
    }
    wc.on('found-in-page', listener)
    const requestId = wc.findInPage(needle, { findNext })
  })
}

app.whenReady().then(async () => {
  let timer, win, measured
  try {
    const original = fixture(input)
    const middle =
      params.get('variant') === 'middle-source-parts' && input === 'B5'
        ? middleCorpus(original)
        : undefined
    const source = middle?.source ?? original
    const bytes = Buffer.from(
      JSON.stringify(middle?.parts ?? [{ type: 'text', text: source }]),
      'utf8'
    )
    const meta = {
      input,
      screen,
      run,
      bytes: bytes.length,
      fixtureSha: createHash('sha256').update(bytes).digest('hex'),
      characters: source.length,
      utf8Bytes: Buffer.byteLength(source),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      os: process.platform
    }
    ipcMain.handle('body:meta', () => meta)
    ipcMain.handle('body:page', (_event, request) => {
      const { offset, requestId, sessionId, openGeneration } = request
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        offset >= bytes.length ||
        offset % chunkBytes
      )
        throw Error('invalid page offset')
      const nextOffset = Math.min(offset + chunkBytes, bytes.length)
      return {
        status: 'body',
        requestId,
        sessionId,
        openGeneration,
        offset,
        nextOffset,
        base64: bytes.subarray(offset, nextOffset).toString('base64'),
        done: nextOffset === bytes.length
      }
    })
    ipcMain.handle('body:delta', (_event, offset) =>
      source.slice(offset, offset + (offset === 0 ? 4100 : 8000))
    )
    ipcMain.handle('body:expected', (_event, offset) => source.slice(offset, offset + 65536))
    win = new BrowserWindow({
      width: 1000,
      height: 600,
      useContentSize: true,
      show: true,
      webPreferences: {
        sandbox: true,
        backgroundThrottling: false,
        preload: fileURLToPath(new URL('./preload.cjs', import.meta.url))
      }
    })
    const wc = win.webContents

    async function js(code) {
      const report = await wc.executeJavaScript(
        '(async () => {try {return {value: await (' +
          code +
          ')}} catch(e){return {error: String(e), stack:e.stack}}})()'
      )
      if (report.error) throw Error(code + ': ' + report.error + ' ' + report.stack)
      return report.value
    }
    const crashed = new Promise((_, reject) =>
      wc.once('render-process-gone', (_e, details) => reject(Error('renderer ' + details.reason)))
    )
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error('Renderer exceeded watchdog')), budget + 15000)
    })
    const result = await Promise.race([
      crashed,
      timeout,
      (async () => {
        await win.loadURL(url)
        await wc.executeJavaScript(
          "new Promise(resolve => {const poll = () => typeof window.measureBody === 'function' ? resolve() : setTimeout(poll, 10); poll()})"
        )
        const measurement = await js('window.measureBody(' + budget + ')')
        measured = { ...meta, ...measurement }
        if (!measurement.complete || params.has('calibrate')) return measurement
        if (middle) {
          return {
            ...measurement,
            variant: 'middle-source-parts',
            ...(await measureMiddleSelection(
              wc,
              clipboard,
              js,
              (...args) => find(...args, budget),
              middle
            ))
          }
        }
        const semantic = await js('window.verifyBody()')
        Object.assign(measured, semantic)
        const expected = await js('window.selectBodyText()')
        const sentinel = `0331:${screen}/${input}/${run}`
        clipboard.writeText(sentinel)
        wc.copy()
        let copied = sentinel
        for (let i = 0; i < 40 && copied === sentinel; i++) {
          await new Promise((resolve) => setTimeout(resolve, 25))
          copied = clipboard.readText()
        }
        const searchTarget = await js('window.revealBody()')
        const needle = { B1: '라마바 완료', B3: 'stream 완료', B4: 'link 완료' }[input] ?? '완료'
        const native = await findVisibleTarget(wc, find, needle, () => js('window.markerRect()'))
        return {
          ...measurement,
          ...semantic,
          searchTarget,
          ...native,
          selectionMatches:
            typeof expected === 'string' && expected.length > 0 && copied === expected
        }
      })()
    ])
    await new Promise((resolve) =>
      process.stdout.write('OO_RESULT ' + JSON.stringify({ ...meta, ...result }) + '\n', resolve)
    )
  } catch (error) {
    await new Promise((resolve) =>
      process.stdout.write(
        'OO_RESULT ' +
          JSON.stringify({ ...measured, screen, input, run, error: String(error) }) +
          '\n',
        resolve
      )
    )
  } finally {
    clearTimeout(timer)
    win?.destroy()
    app.exit()
  }
})

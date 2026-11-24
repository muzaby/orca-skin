/* eslint-disable @typescript-eslint/no-unused-vars -- The runner inserts the production callbacks that reference these bindings. */
import { app, BrowserWindow, net, protocol as electronProtocol } from 'electron'
import { existsSync, mkdtempSync } from 'node:fs'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { openShellState } from '../../src/main/app/shell/shell-state-file'
import { FileTransport } from '../../src/main/infra/log/file-transport'
import { LogManager } from '../../src/main/infra/log/log-manager'
import { setRootLogger } from '../../src/main/infra/log/registry'
import { reportError } from '../../src/main/infra/error-report'
import { PRODUCT_SLUG } from '../../src/shared/product'
import { UI_TASK_BUDGET_MS } from '../../src/shared/perf-budget'

let RENDERER_DIST: string
let taskMs = 0
const protocol = {
  handle(scheme: string, handler: (request: Request) => Promise<Response>): void {
    electronProtocol.handle(scheme, (request) => {
      const started = performance.now()
      const reply = handler(request)
      taskMs = performance.now() - started
      return reply
    })
  }
}

// Production protocol and close handlers are injected by the runner.
/* PRODUCTION_PROTOCOL */

function registerBounds(
  mainWindow: BrowserWindow,
  shellState: ReturnType<typeof openShellState>
): void {
  /* PRODUCTION_BOUNDS */
}

electronProtocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

async function measureAssets(dir: string): Promise<unknown> {
  RENDERER_DIST = join(dir, 'renderer')
  await mkdir(RENDERER_DIST)
  const page = '<!doctype html><p>stage-d-index</p>'
  const css = 'p{font-weight:700}'
  await writeFile(join(RENDERER_DIST, 'index.html'), page)
  await writeFile(join(RENDERER_DIST, 'style.css'), css)
  registerAppProtocol()
  const cases = [
    ['asset', 'style.css', css, 'text/css'],
    ['missing', 'not-present.css', page, 'text/html'],
    ['spa', 'deep-link/current', page, 'text/html'],
    ['root', '', page, 'text/html']
  ] as const
  const samples = Object.fromEntries(cases.map(([kind]) => [kind, []])) as Record<
    (typeof cases)[number][0],
    { mainMs: number; responseMs: number }[]
  >
  for (let index = 0; index < 1000; index++) {
    const [kind, name, expected, mime] = cases[index % cases.length]
    const started = performance.now()
    const reply = await net.fetch('app://renderer/' + name)
    if ((await reply.text()) !== expected || !reply.headers.get('content-type')?.startsWith(mime))
      throw Error('Asset mismatch: ' + kind)
    samples[kind].push({ mainMs: taskMs, responseMs: performance.now() - started })
  }
  const window = new BrowserWindow({ show: false })
  try {
    await window.loadURL('app://renderer/deep-link/current')
    const rendered = await window.webContents.executeJavaScript(
      "document.querySelector('p')?.textContent"
    )
    if (rendered !== 'stage-d-index') throw Error('SPA deep link did not render')
  } finally {
    window.destroy()
  }
  return samples
}

async function measureState(dir: string): Promise<unknown> {
  const defaults = openShellState(dir)
  if (defaults.getAll().uiLocale !== 'ko' || defaults.windowBounds() !== null)
    throw Error('Absent shell/legacy settings must use defaults')
  const bounds = { width: 760, height: 580, x: 5, y: 15 }
  const saved = { ...bounds, x: 37 }
  const legacy = join(dir, `${PRODUCT_SLUG}-settings.json`)
  const shellFile = join(dir, `${PRODUCT_SLUG}-shell-state.json`)
  const legacyBytes = JSON.stringify({ uiLocale: 'en', windowBounds: bounds })
  await writeFile(legacy, legacyBytes)
  const started = performance.now()
  const state = openShellState(dir)
  const inherited = { locale: state.getAll().uiLocale, bounds: state.windowBounds() }
  const inheritMs = performance.now() - started
  if (inherited.locale !== 'en' || inherited.bounds?.x !== bounds.x)
    throw Error('Inheritance mismatch')
  const window = new BrowserWindow({ ...saved, show: false })
  const actual = window.getBounds()
  registerBounds(window, state)
  const closeStarted = performance.now()
  window.close()
  const closeMs = performance.now() - closeStarted
  const reopenStarted = performance.now()
  const reopened = openShellState(dir)
  const restored = { locale: reopened.getAll().uiLocale, bounds: reopened.windowBounds() }
  const reopenMs = performance.now() - reopenStarted
  if (
    restored.locale !== 'en' ||
    !restored.bounds ||
    !Object.keys(actual).every((key) => {
      const dimension = key as keyof typeof actual
      return restored.bounds?.[dimension] === actual[dimension]
    })
  )
    throw Error('Window bounds mismatch')
  if ((await readFile(legacy, 'utf8')) !== legacyBytes) throw Error('Legacy settings changed')
  const windowModes: Record<string, boolean | null> = {}
  for (const mode of ['minimized', 'maximized'] as const) {
    const testWindow = new BrowserWindow({ ...bounds, show: false })
    let active = false
    try {
      await testWindow.loadURL('about:blank')
      registerBounds(testWindow, openShellState(dir))
      testWindow.show()
      const event = mode === 'minimized' ? 'minimize' : 'maximize'
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, 500)
        function done(): void {
          clearTimeout(timer)
          testWindow.off(event, done)
          resolve()
        }
        testWindow.once(event, done)
        testWindow[event]()
      })
      active = mode === 'minimized' ? testWindow.isMinimized() : testWindow.isMaximized()
    } finally {
      testWindow.close()
    }
    windowModes[mode] = active ? openShellState(dir).windowBounds()?.x === actual.x : null
    if (windowModes[mode] === false) throw Error('Non-normal window overwrote saved bounds')
  }
  await writeFile(shellFile, '{ broken')
  let corruption: Record<string, unknown>
  try {
    const repaired = openShellState(dir)
    const recovered = { locale: repaired.getAll().uiLocale, bounds: repaired.windowBounds() }
    if (recovered.locale !== 'en' || recovered.bounds?.x !== bounds.x)
      throw Error('Recovery mismatch')
    corruption = { recovered }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    corruption = { error: error.name }
  }
  return { inherited, restored, windowModes, corruption, inheritMs, closeMs, reopenMs }
}

async function measureLogs(dir: string): Promise<unknown> {
  const logging = new FileTransport({ dir, maxBytes: 2200, maxFiles: 4, flushIntervalMs: 25 })
  const flushMs: number[] = []
  const flush = logging.flushSync.bind(logging)
  logging.flushSync = () => {
    const before = performance.now()
    flush()
    flushMs.push(performance.now() - before)
  }
  for (let offset = 0; offset < 1000; offset += 100) {
    for (let row = offset; row < offset + 100; row++) logging.write(JSON.stringify({ row }))
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  logging.write(JSON.stringify({ row: 1000 }))
  logging.close()
  const files = [
    'application.3.jsonl',
    'application.2.jsonl',
    'application.1.jsonl',
    'application.jsonl'
  ]
  const sequence = (
    await Promise.all(files.map((file) => readFile(join(dir, file), 'utf8')))
  ).flatMap((content) =>
    content
      .trimEnd()
      .split('\n')
      .map((line) => JSON.parse(line).row as number)
  )
  if (sequence.at(-1) !== 1000 || sequence.some((row, index) => row !== sequence[0] + index))
    throw Error('Log sequence mismatch')
  let deniedWrite: boolean | null = null
  if (process.getuid && process.getuid() !== 0) {
    const denied = join(dir, 'write-denied')
    await mkdir(denied, { mode: 0o500 })
    try {
      const errors: string[] = []
      const blocked = new FileTransport({
        dir: denied,
        onInternalError: (error) => errors.push(error)
      })
      blocked.write('{"row":1}')
      blocked.flushSync()
      blocked.write('{"row":2}')
      blocked.close()
      deniedWrite = blocked.isDisabled && errors.length === 1 && !existsSync(blocked.filePath)
      if (!deniedWrite) throw Error('Denied log writes were not isolated')
    } finally {
      await chmod(denied, 0o700)
    }
  }
  return {
    flushMs,
    retained: sequence.length,
    first: sequence[0],
    last: sequence.at(-1),
    deniedWrite
  }
}

async function measureFinalLogs(dir: string): Promise<unknown> {
  const transport = new FileTransport({ dir })
  const manager = new LogManager({
    transport,
    appVersion: 'fixture',
    sessionId: 'fixture',
    dev: false
  })
  const rootLog = manager.logger('main', { process: 'main' })
  setRootLogger(rootLog)
  const flushLogSync = (): void => manager.flushSync()
  const closeLog = (): void => manager.close()
  /* PRODUCTION_FATAL */
  /* PRODUCTION_QUIT */
  try {
    rootLog.info('probe.before-fatal', { row: 1 })
    const fatalStart = performance.now()
    process.emit('uncaughtException', new Error('isolated fixture'))
    const fatalMs = performance.now() - fatalStart
    const fatalRecords = await readFile(transport.filePath, 'utf8')
    rootLog.info('probe.before-quit', { row: 2 })
    const quitStart = performance.now()
    app.emit('will-quit', {} as Electron.Event)
    const quitMs = performance.now() - quitStart
    const records = await readFile(transport.filePath, 'utf8')
    const events = records
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).event as string)
    if (
      !records.startsWith(fatalRecords) ||
      events.join(',') !==
        [
          'probe.before-fatal',
          'app.uncaught.exception',
          'probe.before-quit',
          'app.quit.started'
        ].join(',')
    )
      throw Error('Fatal or quit records missing')
    return { fatalMs, quitMs, events }
  } finally {
    setRootLogger(null)
    manager.close()
  }
}

const dir = mkdtempSync(join(tmpdir(), 'oo-stage-d-shell-'))
app.setPath('userData', dir)
app.on('window-all-closed', () => {})

void app
  .whenReady()
  .then(async () => {
    try {
      const assets = await measureAssets(dir)
      const state = await measureState(dir)
      const logs = await measureLogs(join(dir, 'logs'))
      const finalLogs = await measureFinalLogs(join(dir, 'final-logs'))
      console.log(
        'OO_RESULT ' +
          JSON.stringify({
            environment: 'linux-electron',
            electron: process.versions.electron,
            budget: UI_TASK_BUDGET_MS,
            assets,
            assetsVerified: 'body-and-mime',
            deepLinkRendered: true,
            state,
            logs,
            finalLogs
          })
      )
    } finally {
      await rm(dir, { recursive: true, force: true, maxRetries: 3 })
    }
  })
  .then(
    () => app.exit(),
    (error) => {
      console.error(error)
      app.exit(1)
    }
  )

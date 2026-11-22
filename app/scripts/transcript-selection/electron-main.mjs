// 0326 ΔV2 AT-07 Electron driver (D-104). Real Chromium input through `webContents.sendInputEvent`
// and the system clipboard through Electron `clipboard`. Prints one `OO_RESULT <json>` line.
import { app, BrowserWindow, clipboard } from 'electron'

const [origin, screensArg, runsArg] = process.argv.slice(-3)
const screens = process.env.OO_SELECTION_SCREENS?.split(',') ?? screensArg.split(',')
const runs = Number(process.env.OO_SELECTION_RUNS ?? runsArg)
const SENTINEL = 'oo-clipboard-sentinel'
// A short wheel that mounts new rows while the selected rows at the bottom stay mounted (ΔV2 rev 3).
const MOUNT_WHEEL = Number(process.env.OO_SELECTION_WHEEL ?? 300)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function drive(win) {
  const wc = win.webContents
  const js = (code) => wc.executeJavaScript(code, true)
  const probe = (call) => js(`globalThis.ooProbe.${call}`)
  const settle = async () => {
    await probe('settle()')
    await wait(30)
  }
  const send = (event) => wc.sendInputEvent(event)
  const down = (p) => send({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 })
  const move = (p, held = true) =>
    send({
      type: 'mouseMove',
      x: p.x,
      y: p.y,
      button: held ? 'left' : undefined,
      modifiers: held ? ['leftButtonDown'] : []
    })
  const up = (p) => send({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 })
  const key = (keyCode, modifiers) => {
    send({ type: 'keyDown', keyCode, modifiers })
    send({ type: 'keyUp', keyCode, modifiers })
  }
  const wheel = async (deltaY, held) => {
    const r = await probe('scrollerRect()')
    send({
      type: 'mouseWheel',
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      deltaX: 0,
      // Chromium wheel ticks: a negative delta scrolls the content down.
      deltaY: -deltaY,
      hasPreciseScrollingDeltas: true,
      canScroll: true,
      modifiers: held ? ['leftButtonDown'] : []
    })
    await settle()
  }
  const selection = async () => (await probe('state()')).selection

  async function drag(pair, { reverse = false, release = true } = {}) {
    const a = await probe(`point(${JSON.stringify(pair.start[0])}, ${pair.start[1]})`)
    const b = await probe(`point(${JSON.stringify(pair.end[0])}, ${pair.end[1]})`)
    const [from, to] = reverse ? [b, a] : [a, b]
    down(from)
    for (let step = 1; step <= 6; step++) {
      move({
        x: Math.round(from.x + ((to.x - from.x) * step) / 6),
        y: Math.round(from.y + ((to.y - from.y) * step) / 6)
      })
      await wait(8)
    }
    if (release) up(to)
    await settle()
    return to
  }
  async function copyPaste() {
    key('C', ['control'])
    await settle()
    await probe('focusPaste()')
    key('V', ['control'])
    await settle()
    return probe('pasted()')
  }
  async function pickAndExpect(kind) {
    const pair = await probe(`pick(${JSON.stringify(kind)})`)
    const expected = await probe(
      `expected(${JSON.stringify(pair.start)}, ${JSON.stringify(pair.end)})`
    )
    return { pair, expected }
  }
  const clear = async () => {
    await js('document.getSelection().removeAllRanges()')
    clipboard.writeText(SENTINEL)
    await settle()
  }

  const scenarios = {
    // ① copy — one paragraph, several blocks forward and reverse
    async A1() {
      const { pair, expected } = await pickAndExpect('single')
      await drag(pair)
      return { expected, selectionText: [await selection()], pasted: await copyPaste() }
    },
    async A2() {
      const { pair, expected } = await pickAndExpect('multi')
      await drag(pair)
      return { expected, selectionText: [await selection()], pasted: await copyPaste() }
    },
    async A3() {
      const { pair, expected } = await pickAndExpect('multi')
      await drag(pair, { reverse: true })
      return { expected, selectionText: [await selection()], pasted: await copyPaste() }
    },
    // ② mount during a held drag → cancel, no revival in the same gesture, sentinel kept, next drag works
    async B1() {
      const { pair } = await pickAndExpect('multi-bottom')
      const end = await drag(pair, { release: false })
      const ends = await probe('selectionRowKeys()')
      await probe('mark()')
      await wheel(MOUNT_WHEEL, true)
      const endsMounted = await probe(`rowsMounted(${JSON.stringify(ends)})`)
      const afterCancel = await selection()
      const r = await probe('scrollerRect()')
      const moves = []
      for (let i = 1; i <= 3; i++) {
        move({ x: Math.round(r.x + 40 * i), y: Math.round(r.y + r.height / 2 + 20 * i) })
        await settle()
        moves.push(await selection())
      }
      up({ x: Math.round(r.x + 120), y: Math.round(r.y + r.height / 2 + 60) })
      await settle()
      const state = await probe('state()')
      key('C', ['control'])
      await settle()
      const clip = clipboard.readText()
      void end
      const next = await pickAndExpect('multi')
      await drag(next.pair)
      return {
        mountedKeys: state.mountedKeys,
        endsMounted,
        cancelMs: state.cancelMs,
        selectionText: [afterCancel, ...moves],
        clipboard: clip,
        expected: next.expected,
        pasted: await copyPaste()
      }
    },
    // ③ control — a scroll that mounts no row keeps the selection
    async B2() {
      const { pair, expected } = await pickAndExpect('multi')
      await drag(pair)
      const before = await selection()
      await probe('mark()')
      await wheel(4, false)
      const state = await probe('state()')
      return {
        mountedKeys: state.mountedKeys,
        selectionText: [before, await selection()],
        expected,
        pasted: await copyPaste()
      }
    },
    // ④ after release, keyboard extension and a streamed block also cancel
    async C1() {
      const { pair } = await pickAndExpect('multi-bottom')
      await drag(pair)
      const ends = await probe('selectionRowKeys()')
      await probe('mark()')
      await wheel(MOUNT_WHEEL, false)
      return cancelled(ends)
    },
    async C2() {
      const { pair } = await pickAndExpect('multi')
      await drag(pair)
      const ends = await probe('selectionRowKeys()')
      await probe('mark()')
      // Shift+↓ extends a non-editable selection line by line until the focus scrolls rows in.
      // (Chromium's Shift+PageDown does not scroll non-editable content, so it mounts nothing.)
      for (let i = 0; i < 12; i++) {
        key('Down', ['shift'])
        await settle()
      }
      return cancelled(ends)
    },
    async C3() {
      await probe("scrollTo('bottom')")
      await settle()
      const { pair } = await pickAndExpect('multi')
      const end = await drag(pair, { release: false })
      const ends = await probe('selectionRowKeys()')
      await probe('mark()')
      await probe(`appendBlock(${Date.now() % 100000})`)
      await settle()
      const result = await cancelled(ends)
      up(end)
      await settle()
      return result
    },
    // ⑤ outside DOM change and a same-key row update keep the selection
    async C4() {
      const { pair, expected } = await pickAndExpect('multi')
      await drag(pair, { release: false })
      const before = await selection()
      await probe('mark()')
      await probe('outsideMutate()')
      await settle()
      const afterOutside = await selection()
      const r = await probe('scrollerRect()')
      up({ x: Math.round(r.x + 10), y: Math.round(r.y + 10) })
      await settle()
      const released = await selection()
      await probe('lateResult()')
      await settle()
      const state = await probe('state()')
      return {
        mountedKeys: state.mountedKeys,
        selectionText: [before, afterOutside, await selection()],
        released,
        expected,
        pasted: await copyPaste()
      }
    },
    // ⑤ a selection outside the transcript survives a row mount
    async C5() {
      const { from, to } = await probe('composerPoints()')
      down(from)
      move(to)
      up(to)
      await settle()
      const before = await selection()
      await probe('mark()')
      await wheel(900, false)
      const state = await probe('state()')
      return { mountedKeys: state.mountedKeys, selectionText: [before, await selection()] }
    }
  }

  async function cancelled(ends) {
    const endsMounted = await probe(`rowsMounted(${JSON.stringify(ends)})`)
    const state = await probe('state()')
    key('C', ['control'])
    await settle()
    return {
      mountedKeys: state.mountedKeys,
      endsMounted,
      cancelMs: state.cancelMs,
      selectionText: [state.selection],
      clipboard: clipboard.readText()
    }
  }

  const records = []
  for (const screen of screens) {
    const load = async () => {
      await win.loadURL(`${origin}/?screen=${screen}`)
      await js(
        'new Promise((r) => { const t = () => globalThis.ooProbe?.ready ? r() : setTimeout(t, 20); t() })'
      )
      await settle()
    }
    await load()
    const only = process.env.OO_SELECTION_ONLY?.split(',')
    for (const [scenario, run] of Object.entries(scenarios)) {
      if (only && !only.includes(scenario)) continue
      for (let n = 0; n < runs; n++) {
        // An appended block stays in the session — start each C3 run from the loaded fixture.
        if (scenario === 'C3') await load()
        await probe("scrollTo('top')")
        await clear()
        await probe('mark()')
        let record
        try {
          record = await run()
        } catch (error) {
          record = { error: String(error?.message ?? error) }
        }
        const perf = await probe('state()')
        records.push({
          screen,
          scenario,
          run: n,
          sentinel: SENTINEL,
          copyPrevented: perf.copyPrevented,
          longTasks: perf.longTasks,
          cancelMs: record.cancelMs ?? perf.cancelMs,
          ...record
        })
        // Leave no gesture or selection to the next run.
        up({ x: 5, y: 5 })
        await clear()
      }
    }
  }
  return records
}

app.whenReady().then(async () => {
  let output
  try {
    const win = new BrowserWindow({
      show: true,
      width: 1000,
      height: 600,
      useContentSize: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        devTools: false
      }
    })
    win.focus()
    output = {
      electron: process.versions.electron,
      platform: process.platform,
      records: await drive(win)
    }
  } catch (error) {
    output = {
      electron: process.versions.electron,
      platform: process.platform,
      error: String(error?.stack ?? error)
    }
  }
  process.stdout.write('OO_RESULT ' + JSON.stringify(output) + '\n')
  app.exit(0)
})

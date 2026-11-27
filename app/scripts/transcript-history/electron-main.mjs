import { app, BrowserWindow } from 'electron'
import { setTimeout as delay } from 'node:timers/promises'
import { completeEntryAttempt, recordMissedEntry } from './entry-window.mjs'
import { scenarios } from './scenarios.mjs'

const [origin, screens, repetitions] = process.argv.slice(-3)
const records = []
const discarded = []
const searches = []

async function measure(wc, screen, scenario) {
  await wc.loadURL(origin + '/?' + new URLSearchParams({ screen, scenario }))
  const probe = (method) => wc.executeJavaScript('window.historyProbe.' + method + '()', true)
  if (scenario === 'unitOpen') {
    await probe('unitReady')
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Home' })
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Home' })
  }
  if (scenario === 'framesUnit') {
    const point = await probe('unitReady')
    wc.sendInputEvent({
      type: 'mouseWheel',
      ...point,
      deltaX: 0,
      deltaY: 100,
      canScroll: true,
      hasPreciseScrollingDeltas: true
    })
  }
  if (scenario === 'unitOpen' || scenario === 'framesUnit') return probe('unit')
  if (['openFrames', 'entryPrepend', 'entryCancel'].includes(scenario)) {
    const entry = await probe('entry')
    const cancel = async () => {
      wc.sendInputEvent({
        type: 'mouseWheel',
        x: 350,
        y: 250,
        deltaX: 0,
        deltaY: 100,
        canScroll: true,
        hasPreciseScrollingDeltas: true
      })
      await probe('waitWheel')
    }
    return completeEntryAttempt(scenario, entry, cancel, () => probe('entrySettle'))
  }
  // Reach the head through normal keyboard input so both harnesses release bottom-follow.
  await probe('focusForHome')
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Home' })
  wc.sendInputEvent({ type: 'keyUp', keyCode: 'Home' })
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
  if (scenario === 'pullShort') {
    wheel(-10)
    const opening = await probe('waitPull')
    return { start, opening, ...(await probe('short')) }
  }
  if (scenario === 'pullEnd') {
    wheel(-10)
    return { start, heights: await probe('waitPull'), ...(await probe('result')) }
  }
  if (scenario === 'pullHold' || scenario === 'pullFailure' || scenario === 'pullSuccess') {
    wheel(-10)
    const opening = await probe('waitPull')
    wheel(-12)
    const held = await probe('waitPull')
    if (scenario === 'pullFailure') {
      return { start, opening, held, closing: await probe('fail'), ...(await probe('result')) }
    }
    const commit = await probe('commit')
    return { start, opening, held, ...commit, ...(await probe('result')) }
  }
  if (['frames', 'framesSmoothCss'].includes(scenario)) {
    const commit = await probe('commit')
    return { start, ...commit, ...(await probe('result')) }
  }
  wheel(-10)
  if (scenario === 'nested') {
    await probe('nestedBoundary')
    await delay(230)
    wheel(-10)
    await delay(32)
  }
  await probe('waitWheel')
  const momentum =
    scenario === 'inertia'
      ? (async () => {
          for (let i = 1; i < 30; i++) {
            await delay(16)
            wheel(-8)
            await wc.executeJavaScript('window.historyProbe.waitForWheels(' + (i + 1) + ')')
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
    10000 * screens.split(',').length * Math.max(3, scenarios.length * Number(repetitions))
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
              if (result.missedEntry) {
                recordMissedEntry(discarded, { run, screen, scenario, attempt }, result.missedEntry)
                continue
              }
              const wheels = result.wheels
              const continuous =
                (scenario === 'followup' && wheels?.length === 2) ||
                (scenario === 'inertia' && wheels?.length === 30)
              if (
                continuous &&
                wheels.some((w, i) => i > 0 && w.timestamp - wheels[i - 1].timestamp >= 200)
              ) {
                discarded.push({ run, screen, scenario, attempt, wheels })
                if (attempt >= 11) throw Error('Could not deliver input within the gesture gap')
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

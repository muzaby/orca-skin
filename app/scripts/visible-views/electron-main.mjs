import { app, BrowserWindow, clipboard } from 'electron'
import { setTimeout as delay } from 'node:timers/promises'
const [origin, screenList] = process.argv.slice(-3)
const records = [],
  messages = []
async function main() {
  app.on('window-all-closed', () => {})
  await app.whenReady()
  const win = new BrowserWindow({
    width: 1350,
    height: 800,
    webPreferences: { backgroundThrottling: false }
  })
  const wc = win.webContents,
    read = (code) => wc.executeJavaScript(code)
  wc.on('console-message', (_event, level, message) => {
    if (level >= 2 && !message.includes('Electron Security Warning')) messages.push(message)
  })
  const probe = async (name, ...args) => {
    const packet = await read(
      '(()=>{try{return {value:window.probe.' +
        name +
        '(...' +
        JSON.stringify(args) +
        ')}}catch(e){return {error:String(e)}}})()'
    )
    if (packet.error) throw Error([name, ...args, packet.error].join(' '))
    return packet.value
  }
  async function until(fn, label) {
    const end = Date.now() + 15000
    do {
      if (await fn()) return
      await delay(60)
    } while (Date.now() < end)
    throw Error('timeout ' + label)
  }
  async function load(screens) {
    await win.loadURL('about:blank')
    await win.loadURL(origin + '/#' + screens.join(','))
    win.focus()
    wc.focus()
    await until(() => read('!!window.probe'), 'renderer ' + screens)
    for (const s of screens) {
      for (let i = 0; i < 5 && !(await probe('line', s, 0)); i++) {
        await delay(300)
        if (s.startsWith('transcript') && !(await probe('line', s, 0))) await probe('open', s)
      }
      await until(() => probe('line', s, 0), s + ' first ' + (await probe('info', s)))
    }
  }
  async function mouse(type, p) {
    wc.sendInputEvent({
      type,
      ...p,
      button: 'left',
      clickCount: 1,
      ...(type === 'mouseMove' ? { modifiers: ['leftButtonDown'] } : {})
    })
    await delay(45)
  }
  async function drag(s, from, to, release = true) {
    await read('getSelection().removeAllRanges()')
    const a = await probe('point', s, ...from),
      b = await probe('point', s, ...to)
    await mouse('mouseDown', a)
    await mouse('mouseMove', b)
    if (release) await mouse('mouseUp', b)
    return b
  }
  async function copy() {
    for (const type of ['keyDown', 'keyUp'])
      wc.sendInputEvent({
        type,
        keyCode: 'C',
        modifiers: [process.platform === 'darwin' ? 'meta' : 'control']
      })
    await delay(100)
    return clipboard.readText()
  }
  async function marker(s, n) {
    return s === 'artifact-markdown' ? 'Heading ' + n : 'const row' + n + ' = ' + n
  }
  async function bump(s) {
    await probe('scroll', s, 150)
    await delay(250)
  }
  async function cancel(s) {
    await probe('scroll', s, 0)
    await delay(150)
    const pos = await drag(s, [3, 4], [1, 1], false)
    const selectionBefore = await probe('select', s),
      keysBefore = await probe('keys', s)
    const outerBefore = await probe('outerKeys', s)
    await bump(s)
    const keysAfter = await probe('keys', s),
      selectionAfter = await read('getSelection().toString()'),
      endpointsConnected = await probe('connected')
    clipboard.writeText('unchanged')
    const result = {
      screen: s,
      scenario: 'c2',
      keysBefore,
      keysAfter,
      selectionBefore,
      selectionAfter,
      endpointsConnected,
      outerBefore,
      outerAfter: await probe('outerKeys', s),
      clipboard: await copy()
    }
    await mouse('mouseUp', pos)
    return result
  }
  for (const s of screenList.split(',')) {
    await load([s])
    const first = await probe('line', s, 0)
    const startCount = (await probe('keys', s)).length
    await until(async () => {
      await probe('scroll', s, -1)
      return probe('last', s)
    }, s + ' last')
    if (!['artifact-markdown', 'transcript-work'].includes(s))
      await until(
        () =>
          read(
            "Array.from(document.querySelectorAll('span[style]')).some(el => el.style.color && el.textContent.includes('const'))"
          ),
        s + ' syntax tokens'
      )
    const mounted = Math.max(startCount, (await probe('keys', s)).length)
    await probe('scroll', s, 0)
    await until(() => probe('line', s, 1), s + ' return')
    await delay(200)
    const geometry = { reachedFirst: first, reachedLast: true, mounted }
    async function partial(scenario, row) {
      const start = scenario === 'c5' ? 3 : 1,
        end = scenario === 'c5' ? 7 : 5
      const expected = (await marker(s, row)).slice(start, end)
      if (s === 'artifact-markdown')
        await until(() => probe('markdownReady', s, row), s + ' mounted Markdown blocks')
      else if (s !== 'transcript-work')
        await until(() => probe('coloredLine', s, row), s + ' source tokens')
      await drag(s, [row, end], [row, start])
      const selectionBefore = await read('getSelection().toString()')
      clipboard.writeText('unchanged')
      return {
        screen: s,
        scenario,
        ...geometry,
        expected,
        selectionBefore,
        clipboard: await copy()
      }
    }
    const c1 = await partial('c1', 1)
    if (s.startsWith('transcript')) {
      const header = {
        'transcript-file': '읽음\nsample.ts\nsample.ts',
        'transcript-diff': '업데이트됨\nsample.ts\nsample.ts',
        'transcript-work': '\nFixtureTool\n요청'
      }[s]
      c1.crossExpected = 'sible fixture paragraph\n\n' + header + '\nconst row0 = 0\nconst'
      await drag(s, [1, 5], [-1, 2])
      clipboard.writeText('unchanged')
      c1.crossClipboard = await copy()
    }
    records.push(c1, await cancel(s))
    await probe('scroll', s, 0)
    await delay(250)
    records.push(await partial('c5', 2))
    if (s === 'git-inline') {
      await read("document.querySelector('[data-diff-requirement-add]').click()")
      await until(
        () => read("!!document.querySelector('[data-diff-requirement-draft] textarea')"),
        'draft'
      )
      await read("document.querySelector('textarea').focus()")
      const draftGeometry = () =>
        read(`(() => {
        const input = document.querySelector('[data-diff-requirement-draft] textarea')
        const row = input.closest('[data-window-row]')
        const next = row.nextElementSibling
        return next && { height: row.offsetHeight, gap: next.offsetTop - row.offsetTop,
          focused: input === document.activeElement }
      })()`)
      await until(async () => {
        const g = await draftGeometry()
        return g && g.focused && Math.abs(g.gap - g.height) <= 1
      }, 'initial measured draft row')
      const before = await draftGeometry()
      await read(`(() => {
        const input = document.querySelector('[data-diff-requirement-draft] textarea')
        input.style.minHeight = (input.offsetHeight + 64) + 'px'
      })()`)
      await until(async () => {
        const g = await draftGeometry()
        return g && g.focused && g.height >= before.height + 60 && Math.abs(g.gap - g.height) <= 1
      }, 'resized draft moves the next row')
      await probe('scroll', s, -1)
      await until(
        async () =>
          (await probe('last', s)) && (await read("document.activeElement.tagName==='TEXTAREA'")),
        'pinned draft'
      )
      await read("document.querySelector('[data-jump]').click()")
      await until(
        () =>
          read(
            "(()=>{const box=document.querySelector('[data-diff-requirement-marker=remote]')?.getBoundingClientRect();const frame=document.querySelector('[data-diff-scroll-owner]').getBoundingClientRect();return box && box.top>=frame.top && box.bottom<=frame.bottom})()"
          ),
        'remote requirement'
      )
    }
  }
  const pair = ['git-inline', 'transcript-diff']
  await load(pair)
  for (const [s, other] of [pair, [...pair].reverse()]) {
    await probe('scroll', s, 0)
    await probe('scroll', other, 0)
    // Token arrival replaces the text nodes a native drag needs as endpoints.
    await until(() => probe('coloredLine', s, 2), s + ' c4 source tokens')
    await drag(s, [2, 5], [2, 1])
    const selectionBefore = await probe('select', s),
      keysBefore = await probe('keys', other)
    await bump(other)
    clipboard.writeText('unchanged')
    records.push({
      screen: s,
      scenario: 'c4',
      keysBefore,
      keysAfter: await probe('keys', other),
      selectionBefore,
      selectionAfter: await read('getSelection().toString()'),
      clipboard: await copy()
    })
  }
  console.log('OO_RESULT ' + JSON.stringify({ electron: process.versions.electron, records }))
  app.exit(0)
}
void main().catch((error) => {
  console.log(
    'OO_RESULT ' + JSON.stringify({ error: String(error) + messages.slice(-4).join(' '), records })
  )
  app.exit(1)
})

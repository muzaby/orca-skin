// 0330 W-048 파일럿 — W1(긴 대화 입력·스크롤·드래그)을 CDP 합성 입력으로 재생하며 trace 를 기록한다.
//   node pilot-w1.mjs setup <port>              새 대화에 '안녕'을 보내고 답 완료까지 기다린다(측정 아님)
//   node pilot-w1.mjs run <port> <out.json>      기록 시작 → 표식 → P1 전송 → 한글 200키 → 휠 10초 → 경계 드래그 10초 → 기록 끝
// 합성 입력이다: 한글은 IME 조합이 아니라 keyDown(text) 이고 휠·드래그도 CDP Input 이벤트다 — 실행표 note 에 남긴다.
import { writeFileSync } from 'node:fs'

const P1 = '1부터 3000까지 한 줄에 하나씩 숫자만 출력하라'
const CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'toplevel', '__metadata']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const json = async (port, path) => (await fetch(`http://127.0.0.1:${port}${path}`)).json()

function client(url) {
  const ws = new WebSocket(url)
  let next = 1
  const pending = new Map()
  const listeners = []
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) (pending.get(msg.id)(msg), pending.delete(msg.id))
    else for (const l of listeners) l(msg)
  }
  const open = new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)))
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = next++
      pending.set(id, (m) => (m.error ? rej(Error(method + ': ' + m.error.message)) : res(m.result)))
      ws.send(JSON.stringify({ id, method, params }))
    })
  return { open, send, on: (f) => listeners.push(f), close: () => ws.close() }
}

async function page(port) {
  const t = (await json(port, '/json/list')).find((x) => x.type === 'page' && x.url.startsWith('app://'))
  const c = client(t.webSocketDebuggerUrl)
  await c.open
  const evaluate = async (expression) => {
    const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  return { c, evaluate }
}

const rectOf = (sel) => `(()=>{const e=${sel};if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}})()`
const textarea = "document.querySelector('textarea[aria-label=\"메시지 입력\"]')"
const assistantCount = "document.querySelectorAll('[data-message-id]').length"
const streaming = "!![...document.querySelectorAll('button')].find(b=>/중지|정지|stop/i.test(b.getAttribute('aria-label')||''))"

async function key(c, text) {
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', text, unmodifiedText: text, key: text })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: text })
}
async function enter(c) {
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
}
async function focus(p) {
  const r = await p.evaluate(rectOf(textarea))
  if (!r) throw Error('입력창 없음')
  await p.c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 })
  await p.c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 })
}
async function waitDone(p, timeoutMs) {
  const t0 = Date.now()
  let stable = 0
  let last = -1
  while (Date.now() - t0 < timeoutMs) {
    await sleep(1000)
    const s = await p.evaluate(`({s:${streaming},n:${assistantCount},t:document.querySelector('[data-message-id]:last-of-type')?.innerText?.length??0})`)
    stable = !s.s && s.t === last ? stable + 1 : 0
    last = s.t
    if (stable >= 3) return true
  }
  return false
}

async function setup(port) {
  const p = await page(port)
  await focus(p)
  await p.c.send('Input.insertText', { text: '안녕' })
  await enter(p.c)
  const done = await waitDone(p, 120000)
  console.log(JSON.stringify({ setup: done ? 'done' : 'timeout', url: await p.evaluate('location.href'), messages: await p.evaluate(assistantCount) }))
  p.c.close()
}

async function run(port, out) {
  const version = await json(port, '/json/version')
  const b = client(version.webSocketDebuggerUrl)
  await b.open
  const events = []
  let finished
  const complete = new Promise((r) => (finished = r))
  b.on((m) => {
    if (m.method === 'Tracing.dataCollected') events.push(...m.params.value)
    if (m.method === 'Tracing.tracingComplete') finished()
  })
  const p = await page(port)
  const log = []
  const at = (step) => log.push({ step, t: new Date().toISOString() })
  await b.send('Tracing.start', { traceConfig: { includedCategories: CATEGORIES, excludedCategories: ['*'] }, transferMode: 'ReportEvents' })
  await p.evaluate("performance.mark('oo-measure-start')")
  const startedAt = new Date().toISOString()
  at('start')
  // ① P1 전송
  await focus(p)
  await p.c.send('Input.insertText', { text: P1 })
  await enter(p.c)
  at('send-P1')
  await sleep(2500)
  // ② 스트리밍 중 한글 200키(전송하지 않음)
  await focus(p)
  const hangul = '가나다라마바사아자차카타파하'
  for (let i = 0; i < 200; i++) {
    await key(p.c, hangul[i % hangul.length])
    await sleep(40)
  }
  at('typed-200')
  // ③ 휠 10초(대화 영역 가운데)
  const area = await p.evaluate(rectOf("document.querySelector('[data-transcript-session]')||document.querySelector('main')"))
  const t1 = Date.now()
  let dir = -1
  while (Date.now() - t1 < 10000) {
    await p.c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: area.x, y: area.y, deltaX: 0, deltaY: dir * 120 })
    if ((Date.now() - t1) % 2000 < 60) dir = -dir
    await sleep(50)
  }
  at('wheel-10s')
  // ④ 패널 경계 드래그 10초
  const sep = await p.evaluate(rectOf("document.querySelector('[role=separator]')||document.querySelector('[class*=col-resize]')"))
  if (sep) {
    await p.c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sep.x, y: sep.y, button: 'left', clickCount: 1 })
    const t2 = Date.now()
    while (Date.now() - t2 < 10000) {
      const dx = Math.sin(((Date.now() - t2) / 2000) * Math.PI * 2) * 120
      await p.c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sep.x + dx, y: sep.y, button: 'left', buttons: 1 })
      await sleep(16)
    }
    await p.c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sep.x, y: sep.y, button: 'left', clickCount: 1 })
    at('drag-10s')
  } else at('drag-skipped:no-separator')
  await b.send('Tracing.end')
  await complete
  const endedAt = new Date().toISOString()
  at('end')
  writeFileSync(out, JSON.stringify({ traceEvents: events, metadata: { startedAt, endedAt, steps: log, source: 'cdp Tracing + CDP synthetic input (pilot-w1.mjs)' } }))
  console.log(JSON.stringify({ out, events: events.length, startedAt, endedAt, steps: log }))
  p.c.close()
  b.close()
}

const [cmd, port, out] = process.argv.slice(2)
if (cmd === 'setup') await setup(port)
else if (cmd === 'run') await run(port, out)
else (console.error('setup <port> | run <port> <out>'), (process.exitCode = 2))

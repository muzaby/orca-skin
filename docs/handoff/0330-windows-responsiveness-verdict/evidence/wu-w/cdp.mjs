// 0330 W-049 — 진단 빌드(`--remote-debugging-port`)에 CDP로 붙어 사전 점검·trace 기록을 한다(측정 전용).
//   node cdp.mjs eval <port> "<식>"              앱 창(app://)에서 식을 평가해 JSON 으로 출력
//   node cdp.mjs eval-file <port> <file.js>       파일 내용을 평가(visibility-marks.js 주입 등)
//   node cdp.mjs record <port> <seconds> <out.json>  브라우저 Tracing 으로 N초 기록(DevTools 성능 패널 범주)
// Node 22 의 내장 WebSocket 만 쓴다.
import { readFileSync, writeFileSync } from 'node:fs'

const CATEGORIES = [
  '-*', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame',
  'devtools.timeline.frame', 'blink.user_timing', 'toplevel', 'latencyInfo', 'benchmark', 'graphics.pipeline',
  'cc', 'gpu', 'v8.execute', 'blink', 'loading', '__metadata'
].join(',')

async function json(port, path) {
  const r = await fetch(`http://127.0.0.1:${port}${path}`)
  return r.json()
}

function client(url) {
  const ws = new WebSocket(url)
  let next = 1
  const pending = new Map()
  const listeners = []
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    } else for (const l of listeners) l(msg)
  }
  const open = new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = rej
  })
  return {
    open,
    on: (f) => listeners.push(f),
    send: (method, params = {}) =>
      new Promise((res) => {
        const id = next++
        pending.set(id, res)
        ws.send(JSON.stringify({ id, method, params }))
      }),
    close: () => ws.close()
  }
}

async function appPage(port) {
  const list = await json(port, '/json/list')
  const page = list.find((t) => t.type === 'page' && t.url.startsWith('app://'))
  if (!page) throw Error('app:// 페이지 없음: ' + list.map((t) => t.type + ' ' + t.url).join(' | '))
  return page
}

async function evaluate(port, expression) {
  const c = client((await appPage(port)).webSocketDebuggerUrl)
  await c.open
  const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  c.close()
  return r.result?.exceptionDetails ? { error: r.result.exceptionDetails.text, detail: r.result.result?.description } : r.result?.result?.value
}

async function record(port, seconds, out) {
  const version = await json(port, '/json/version')
  const c = client(version.webSocketDebuggerUrl)
  await c.open
  const events = []
  let done
  const finished = new Promise((res) => (done = res))
  c.on((m) => {
    if (m.method === 'Tracing.dataCollected') events.push(...m.params.value)
    if (m.method === 'Tracing.tracingComplete') done()
  })
  await c.send('Tracing.start', { traceConfig: { includedCategories: CATEGORIES.split(',').filter((x) => !x.startsWith('-')), excludedCategories: ['*'] }, transferMode: 'ReportEvents' })
  // ΔV6 W-050 — 추출기가 앱 창 렌더러를 고르는 표식. 기록이 시작된 뒤에 찍어야 trace 에 남는다.
  const marked = await evaluate(port, "performance.mark('oo-measure-start'), 'marked'")
  if (marked !== 'marked') throw Error('표식 실패: ' + JSON.stringify(marked))
  const startedAt = new Date().toISOString()
  process.stderr.write(`기록 시작 ${startedAt} — ${seconds}초\n`)
  await new Promise((r) => setTimeout(r, seconds * 1000))
  await c.send('Tracing.end')
  await finished
  const endedAt = new Date().toISOString()
  c.close()
  writeFileSync(out, JSON.stringify({ traceEvents: events, metadata: { startedAt, endedAt, source: 'cdp Tracing', categories: CATEGORIES } }))
  console.log(JSON.stringify({ out, events: events.length, startedAt, endedAt }))
}

const [cmd, port, a, b] = process.argv.slice(2)
if (cmd === 'eval') console.log(JSON.stringify(await evaluate(port, a)))
else if (cmd === 'eval-file') console.log(JSON.stringify(await evaluate(port, readFileSync(a, 'utf8'))))
else if (cmd === 'record') await record(port, Number(a), b)
else {
  console.error('사용법: eval <port> <식> | eval-file <port> <file> | record <port> <초> <out>')
  process.exitCode = 2
}

// 원인 분리 프로브(표본 아님): A = 입력창 200키 후 4초 대기, B = 타이핑 없이 휠 5초. 각 run 에서 ≥160ms 작업 시각을 낸다.
import { spawn, execSync } from 'node:child_process'
import { cpSync, rmSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
const PORT = 9333
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const json = async (p) => (await fetch(`http://127.0.0.1:${PORT}${p}`)).json()
function client(url) {
  const ws = new WebSocket(url); let n = 1; const pend = new Map(); const ls = []
  ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) (pend.get(x.id)(x), pend.delete(x.id)); else for (const l of ls) l(x) }
  const open = new Promise((r) => (ws.onopen = r))
  return { open, on: (f) => ls.push(f), send: (method, params = {}) => new Promise((r) => { const id = n++; pend.set(id, (x) => r(x.result)); ws.send(JSON.stringify({ id, method, params })) }), close: () => ws.close() }
}
const kill = () => { try { execSync(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -like 'C:\\orca-W\\run1\\diag-*' } | Stop-Process -Force"`, { stdio: 'ignore' }) } catch {} }
const [variant, spell] = process.argv.slice(2)
kill()
const prof = 'C:/orca-W/work/probe-cause'
if (existsSync(prof)) rmSync(prof, { recursive: true, force: true })
cpSync('C:/orca-W/profiles/real-copy', prof, { recursive: true })
spawn('C:/orca-W/run1/diag-515ff58d/app/dist/win-unpacked/orcinus-orca.exe', [`--remote-debugging-port=${PORT}`], { env: { ...process.env, OO_MEASURE_USER_DATA: prof }, detached: true, stdio: 'ignore' }).unref()
let pg
for (let i = 0; i < 60 && !pg; i++) { try { pg = (await json('/json/list')).find((x) => x.type === 'page' && x.url.startsWith('app://')) } catch {} ; await sleep(1000) }
const p = client(pg.webSocketDebuggerUrl); await p.open
const ev = async (e) => (await p.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value
for (let i = 0; i < 30 && !(await ev("!!document.querySelector('textarea[aria-label=\"메시지 입력\"]')")); i++) await sleep(1000)
await sleep(2000)
if (spell === 'nospell') await ev("document.querySelector('textarea[aria-label=\"메시지 입력\"]').spellcheck=false")
const b = client((await json('/json/version')).webSocketDebuggerUrl); await b.open
const events = []; let done; const fin = new Promise((r) => (done = r))
b.on((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') done() })
await b.send('Tracing.start', { traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'toplevel', '__metadata'], excludedCategories: ['*'] }, transferMode: 'ReportEvents' })
await ev("performance.mark('oo-measure-start')")
const t0 = Date.now()
const marks = []
if (variant === 'A') {
  const r = await ev("(()=>{const r=document.querySelector('textarea[aria-label=\"메시지 입력\"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
  await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 })
  for (let i = 0; i < 200; i++) { const ch = '가나다라마바사'[i % 7]; await p.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); await sleep(40) }
  marks.push('typedEnd@' + ((Date.now() - t0) / 1000).toFixed(1))
  await sleep(4000)
} else {
  for (let i = 0; i < 100; i++) { await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 300, deltaX: 0, deltaY: i % 40 < 20 ? -120 : 120 }); await sleep(50) }
  marks.push('wheelEnd@' + ((Date.now() - t0) / 1000).toFixed(1))
}
await b.send('Tracing.end'); await fin
const mark = events.find((e) => e.name === 'oo-measure-start')
const mains = events.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain' && e.pid === mark.pid)
const tid = mains[0]?.tid
const big = events.filter((e) => e.name === 'RunTask' && e.pid === mark.pid && e.tid === tid && e.dur >= 100000).map((e) => (e.dur / 1000).toFixed(0) + 'ms@' + ((e.ts - mark.ts) / 1e6).toFixed(1))
console.log(variant, spell ?? 'spell-default', marks.join(' '), 'tasks>=100ms:', big.join(', ') || '-')
kill(); process.exit(0)

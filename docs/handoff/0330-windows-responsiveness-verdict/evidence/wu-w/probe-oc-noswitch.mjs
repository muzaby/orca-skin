// 확인 프로브(표본 아님): OpenCode(Big Pickle) 100턴 세션에서 P1 전송 — 세션 전환 없이(A) / 전환 있음(B) 완료 여부.
import { spawn, execSync } from 'node:child_process'
import { cpSync, rmSync, existsSync, readFileSync } from 'node:fs'
const PORT = 9333, sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const json = async (p) => (await fetch(`http://127.0.0.1:${PORT}${p}`)).json()
const kill = () => { try { execSync(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -like 'C:\\orca-W\\run1\\diag-*' } | Stop-Process -Force"`, { stdio: 'ignore' }) } catch {} }
function client(url) { const ws = new WebSocket(url); let n = 1; const pend = new Map(); ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) (pend.get(x.id)(x), pend.delete(x.id)) }; return { open: new Promise((r) => (ws.onopen = r)), send: (method, params = {}) => new Promise((r) => { const id = n++; pend.set(id, (x) => r(x.result)); ws.send(JSON.stringify({ id, method, params })) }) } }
const variant = process.argv[2] // noswitch | switch
kill()
const prof = 'C:/orca-W/work/probe-oc-' + variant
if (existsSync(prof)) rmSync(prof, { recursive: true, force: true })
cpSync('C:/orca-W/profiles/h100-opencode', prof, { recursive: true })
spawn('C:/orca-W/run1/diag-515ff58d/app/dist/win-unpacked/orcinus-orca.exe', [`--remote-debugging-port=${PORT}`], { env: { ...process.env, OO_MEASURE_USER_DATA: prof }, detached: true, stdio: 'ignore' }).unref()
let pg; for (let i = 0; i < 60 && !pg; i++) { try { pg = (await json('/json/list')).find((x) => x.type === 'page' && x.url.startsWith('app://')) } catch {}; await sleep(1000) }
const p = client(pg.webSocketDebuggerUrl); await p.open
const ev = async (e) => (await p.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value
for (let i = 0; i < 30 && !(await ev("!!document.querySelector('textarea[aria-label=\"메시지 입력\"]')")); i++) await sleep(1000)
await sleep(2000)
const A = JSON.parse(readFileSync('C:/orca-W/profiles/h100-opencode.json', 'utf8')).url.split('/chat/')[1]
await ev(`document.querySelector('.app-frame-session-row[data-session-id="${A}"]').click()`); await sleep(2500)
const t = await ev("(()=>{const r=document.querySelector('textarea[aria-label=\"메시지 입력\"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: t.x, y: t.y, button: 'left', clickCount: 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: t.x, y: t.y, button: 'left', clickCount: 1 })
await p.send('Input.insertText', { text: '1부터 3000까지 한 줄에 하나씩 숫자만 출력하라' })
await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
if (variant === 'switch') {
  await sleep(3000)
  const B = await ev(`[...document.querySelectorAll('.app-frame-session-row')].map(e=>e.dataset.sessionId).find(id=>id!=="${A}")`)
  await ev(`document.querySelector('.app-frame-session-row[data-session-id="${B}"]').click()`); await sleep(2500)
  await ev(`document.querySelector('.app-frame-session-row[data-session-id="${A}"]').click()`); await sleep(1500)
}
let last = '', stable = 0
for (let i = 0; i < 150 && stable < 5; i++) { await sleep(1000); const s = await ev("document.querySelector('[data-transcript-session]').innerText.slice(-120)"); stable = s === last ? stable + 1 : 0; last = s }
await ev("(()=>{const sc=document.querySelector('[data-transcript-session]');sc.scrollTop=sc.scrollHeight})()"); await sleep(1000)
console.log(variant, JSON.stringify((await ev("document.querySelector('[data-transcript-session]').innerText.slice(-160)")).replace(/\n/g, ' / ')))
kill(); process.exit(0)

// 확인 프로브(표본 아님): h100 Claude Code 세션을 열고 상단에서 휠 한 제스처 → 앞삽입 전·후 화면을 캡처한다.
import { spawn, execSync } from 'node:child_process'
import { cpSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
const PORT = 9333, sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const json = async (p) => (await fetch(`http://127.0.0.1:${PORT}${p}`)).json()
const kill = () => { try { execSync(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -like 'C:\\orca-W\\run1\\diag-*' } | Stop-Process -Force"`, { stdio: 'ignore' }) } catch {} }
function client(url) { const ws = new WebSocket(url); let n = 1; const pend = new Map(); ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) (pend.get(x.id)(x), pend.delete(x.id)) }; return { open: new Promise((r) => (ws.onopen = r)), send: (method, params = {}) => new Promise((r) => { const id = n++; pend.set(id, (x) => r(x.result)); ws.send(JSON.stringify({ id, method, params })) }) } }
kill()
const prof = 'C:/orca-W/work/probe-pull'
if (existsSync(prof)) rmSync(prof, { recursive: true, force: true })
cpSync('C:/orca-W/profiles/h100-claude-code', prof, { recursive: true })
const meta = JSON.parse(readFileSync('C:/orca-W/profiles/h100-claude-code.json', 'utf8'))
cpSync('C:/orca-W/profiles/h100-claude-code.native.jsonl', meta.native)
spawn('C:/orca-W/run1/diag-515ff58d/app/dist/win-unpacked/orcinus-orca.exe', [`--remote-debugging-port=${PORT}`], { env: { ...process.env, OO_MEASURE_USER_DATA: prof }, detached: true, stdio: 'ignore' }).unref()
let pg; for (let i = 0; i < 60 && !pg; i++) { try { pg = (await json('/json/list')).find((x) => x.type === 'page' && x.url.startsWith('app://')) } catch {}; await sleep(1000) }
const p = client(pg.webSocketDebuggerUrl); await p.open
const ev = async (e) => (await p.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value
for (let i = 0; i < 30 && !(await ev("!!document.querySelector('[data-transcript-session]')")); i++) await sleep(1000)
await sleep(3000)
const shot = async (f) => writeFileSync(f, Buffer.from((await p.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
const state = () => ev("(()=>{const sc=document.querySelector('[data-transcript-session]');const top=sc.getBoundingClientRect().top;const el=[...sc.querySelectorAll('[data-message-id]')].find(e=>e.getBoundingClientRect().bottom>top+4);return {n:window.__ooDev.blockCount(),st:sc.scrollTop,first:el?.innerText.slice(0,30),firstTop:el&&Math.round(el.getBoundingClientRect().top-top),edge:document.querySelector('[data-history-edge=before]')?.dataset.historyState}})()")
const r = await ev("(()=>{const r=document.querySelector('[data-transcript-session]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
console.log('open', JSON.stringify(await state()))
await shot('C:/orca-W/pull-0-open.png')
await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.x, y: r.y, deltaX: 0, deltaY: -120 })
await sleep(2000)
console.log('after-1', JSON.stringify(await state()))
await shot('C:/orca-W/pull-1-after.png')
await sleep(1000)
await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.x, y: r.y, deltaX: 0, deltaY: -120 })
await sleep(2000)
console.log('after-2', JSON.stringify(await state()))
await shot('C:/orca-W/pull-2-after.png')
kill(); process.exit(0)

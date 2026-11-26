// 확인 프로브(표본 아님): h100 Claude Code — 본문이 넘친 상태에서 상단 당김 한 번, 앞삽입 전·후(10프레임)에
// ① 첫 가시 메시지 요소 top ② 화면 가운데 줄 글자(caretRangeFromPoint) top ③ 화면 위쪽 1/4 줄 글자 top 을 잰다.
import { spawn, execSync } from 'node:child_process'
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
const PORT = 9333, sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const json = async (p) => (await fetch(`http://127.0.0.1:${PORT}${p}`)).json()
const kill = () => { try { execSync(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -like 'C:\\orca-W\\run1\\diag-*' } | Stop-Process -Force"`, { stdio: 'ignore' }) } catch {} }
function client(url) { const ws = new WebSocket(url); let n = 1; const pend = new Map(); ws.onmessage = (m) => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) (pend.get(x.id)(x), pend.delete(x.id)) }; return { open: new Promise((r) => (ws.onopen = r)), send: (method, params = {}) => new Promise((r) => { const id = n++; pend.set(id, (x) => r(x.result)); ws.send(JSON.stringify({ id, method, params })) }) } }
kill()
const prof = 'C:/orca-W/work/probe-glyph'
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
const r = await ev("(()=>{const r=document.querySelector('[data-transcript-session]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()")
const wheel = async () => { await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.x, y: r.y, deltaX: 0, deltaY: -120 }) }
// 첫 당김(본문이 짧아 밀림) — 넘친 상태 만들기
// 본문이 화면보다 300px 이상 넘칠 때까지 당긴다(제스처 사이 1.5초) — 그 뒤 아래로 조금 내려 읽는 위치를 만든다.
for (let k = 0; k < 8; k++) {
  const s = await ev("(()=>{const sc=document.querySelector('[data-transcript-session]');return sc.scrollHeight-sc.clientHeight})()")
  if (s > 300) break
  for (let i = 0; i < 15; i++) { await wheel(); await sleep(150); if ((await ev("document.querySelector('[data-transcript-session]').scrollTop")) <= 0) break }
  await sleep(1500)
}
for (let i = 0; i < 2; i++) { await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.x, y: r.y, deltaX: 0, deltaY: 120 }); await sleep(250) }
await sleep(1500)
console.log('state', JSON.stringify(await ev("(()=>{const sc=document.querySelector('[data-transcript-session]');return {st:sc.scrollTop,sh:sc.scrollHeight,ch:sc.clientHeight,n:window.__ooDev.blockCount()}})()")))
const ARM = `new Promise((res)=>{const sc=document.querySelector('[data-transcript-session]');const R=sc.getBoundingClientRect();const n0=window.__ooDev.blockCount();
  const glyphAt=(fy)=>{const y=R.top+R.height*fy;for(const x of [R.left+40,R.left+R.width*0.3,R.left+R.width*0.5,R.right-80]){const c=document.caretRangeFromPoint(x,y);if(c&&c.startContainer.nodeType===3){const rg=document.createRange();rg.setStart(c.startContainer,c.startOffset);rg.setEnd(c.startContainer,Math.min(c.startOffset+1,c.startContainer.length));return {node:c.startContainer,off:c.startOffset,top:rg.getBoundingClientRect().top,text:c.startContainer.data.slice(c.startOffset,c.startOffset+12)}}}return null};
  const topOf=(g)=>{if(!g||!g.node.isConnected)return null;const rg=document.createRange();rg.setStart(g.node,g.off);rg.setEnd(g.node,Math.min(g.off+1,g.node.length));return rg.getBoundingClientRect().top};
  const first=()=>{const t=R.top;const el=[...sc.querySelectorAll('[data-message-id]')].find(e=>e.getBoundingClientRect().bottom>t+4);return el?{el,top:el.getBoundingClientRect().top}:null};
  let A={f:first(),g25:glyphAt(0.25),g50:glyphAt(0.5),st:sc.scrollTop,sh:sc.scrollHeight};const t0=performance.now();
  const tick=()=>{const n=window.__ooDev.blockCount();if(n!==n0){const seq=[];let k=0;const step=()=>{seq.push({f:A.f&&A.f.el.isConnected?Math.round((A.f.el.getBoundingClientRect().top-A.f.top)*10)/10:null,g25:A.g25?Math.round((topOf(A.g25)-A.g25.top)*10)/10:null,g50:A.g50?Math.round((topOf(A.g50)-A.g50.top)*10)/10:null,st:Math.round(sc.scrollTop)});if(++k<10)requestAnimationFrame(step);else res({before:{st:A.st,sh:A.sh,ch:sc.clientHeight,g25:A.g25?.text,g50:A.g50?.text,first:A.f?.el.innerText.slice(0,20)},seq})};step();return}
    if(performance.now()-t0>8000){res({timeout:true});return}A={f:first(),g25:glyphAt(0.25),g50:glyphAt(0.5),st:sc.scrollTop,sh:sc.scrollHeight};requestAnimationFrame(tick)};requestAnimationFrame(tick)})`
const watch = ev(ARM)
// 넘친 상태에서 위로 — 상단 도달까지 150ms 간격, 도달하면 멈춤
for (let i = 0; i < 30; i++) { await wheel(); await sleep(150); const st = await ev("document.querySelector('[data-transcript-session]').scrollTop"); if (st <= 0) break }
await sleep(450); await wheel() // 상단에서 시작하는 새 제스처 — 이 tick 이 요청을 연다
const out = await watch
console.log(JSON.stringify(out, null, 0))
writeFileSync('C:/orca-W/probe-glyph.json', JSON.stringify(out, null, 1))
kill(); process.exit(0)

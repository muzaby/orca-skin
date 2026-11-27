// 0330 W4 실측 러너 — 이미지 5장 첨부 직후 전송·세션 전환 (기반: w2-runner.mjs)(W-053 CDP 합성 입력) — 저장된 대화 열기 → 상단 당김 제스처 5회.
//   node w2-runner.mjs <sha8> <harness> <repeat> <history-1|history-100>
// 측정 전: 프로필 복원(history-1 은 '안녕' 1턴 세션을 이 run 에서 만든다) → '새 대화'로 옮긴 뒤 앱 재기동.
// 기록: 표식 → 사이드바 세션 행 클릭 → 첫 본문 → [제스처 = 상단에 닿을 때까지 20ms 간격 휠 ↑, 닿은 뒤 300ms 더] × 5.
// 측정자 확인 값(checks): requests-per-gesture-is-1 = 제스처마다 추가된 턴이 ≤1 이고 이력이 남았을 때 정확히 1
//   (이후 빌드만 — 이전 빌드는 전량 열기라 판정 대상 아님), reading-offset = 제스처 끝 → 1.5초 뒤 첫 가시 메시지 top 변화의 최대 px.
import { execSync, spawn } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { cardGuard, cardsTaken, writeTrace } from './cdp-lib.mjs'

const SHAS = { d8684684: 'd86846844dc9ea092f394f942621b78dc3d50e02', '515ff58d': '515ff58d60eb5d76744cc34aaad20bc7f186d928' }
const SIDE = { d8684684: 'before', '515ff58d': 'after' }
const HARNESS = { 'claude-code': { mode: '코드', model: /^sonnet/ }, 'claude-work': { mode: '작업', model: /^sonnet/ }, opencode: { mode: '코드', model: /^Big Pickle/ } }
const CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'toplevel', '__metadata']
const PORT = 9333
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [sha8, harness, repeat] = process.argv.slice(2)
const load = 'default'
if (!SHAS[sha8] || !HARNESS[harness] || !/^[1-9]$/.test(repeat ?? '')) (console.error('사용법: <sha8> <harness> <repeat>'), process.exit(2))
const H100 = false
const runsheet = 'C:/orca-W/phase1/runs.tsv'
const rawDir = 'C:/orca-W/phase1/raw'
const runId = `w4-${sha8}-${harness}-r${repeat}`
const exe = `C:/orca-W/run1/diag-${sha8}/app/dist/win-unpacked/orcinus-orca.exe`
const profile = `C:/orca-W/work/${runId}`
const log = (...a) => console.error(new Date().toISOString(), runId, ...a)

const killDiag = () => { try { execSync(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -like 'C:\\orca-W\\run1\\diag-*' } | Stop-Process -Force"`, { stdio: 'ignore' }) } catch {} }
function prepareProfile() {
  if (existsSync(profile)) rmSync(profile, { recursive: true, force: true })
  cpSync(H100 ? `C:/orca-W/profiles/h100-${harness}` : 'C:/orca-W/profiles/real-copy', profile, { recursive: true })
  if (H100) {
    const meta = JSON.parse(readFileSync(`C:/orca-W/profiles/h100-${harness}.json`, 'utf8'))
    if (meta.native && existsSync(`C:/orca-W/profiles/h100-${harness}.native.jsonl`)) cpSync(`C:/orca-W/profiles/h100-${harness}.native.jsonl`, meta.native)
    return
  }
  const Database = createRequire('C:/workspace/github/claude/orca-skin/app/package.json')('better-sqlite3')
  const db = new Database(join(profile, 'orcinus-orca.db'))
  const t = Date.now()
  db.prepare('INSERT INTO projects (id,name,instructions,created_at,updated_at,cwd,cwd_key) VALUES (?,?,?,?,?,?,?)').run('measure-scratch', 'measure-scratch', '', t, t, 'C:\\orca-W\\work\\scratch', 'c:/orca-w/work/scratch')
  db.close()
}
const launch = () => spawn(exe, [`--remote-debugging-port=${PORT}`], { env: { ...process.env, OO_MEASURE_USER_DATA: profile }, detached: true, stdio: 'ignore' }).unref()
const json = async (path) => (await fetch(`http://127.0.0.1:${PORT}${path}`)).json()
function client(url) {
  const ws = new WebSocket(url); let next = 1; const pending = new Map(); const listeners = []
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) (pending.get(msg.id)(msg), pending.delete(msg.id)); else for (const l of listeners) l(msg) }
  const open = new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)))
  const send = (method, params = {}) => new Promise((res, rej) => { const id = next++; pending.set(id, (m) => (m.error ? rej(Error(method + ': ' + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id, method, params })) })
  return { open, send, on: (f) => listeners.push(f), close: () => ws.close() }
}
const TEXTAREA = "document.querySelector('textarea[aria-label=\"메시지 입력\"]')"
async function page() {
  for (let i = 0; i < 60; i++) {
    try {
      const t = (await json('/json/list')).find((x) => x.type === 'page' && x.url.startsWith('app://'))
      if (t) {
        const c = client(t.webSocketDebuggerUrl); await c.open
        const evaluate = async (expression) => { const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value }
        for (let k = 0; k < 60 && !(await evaluate(`!!${TEXTAREA}`).catch(() => false)); k++) await sleep(1000)
        await evaluate(cardGuard(process.env.OO_CARD_POLICY || 'deny')).catch(() => {})
        await sleep(1500)
        return { c, evaluate }
      }
    } catch {}
    await sleep(1000)
  }
  throw Error('앱 페이지 없음')
}
async function click(p, x, y) { await p.c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }); await p.c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }) }
const rectOf = (sel) => `(()=>{const e=${sel};if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,top:r.top,h:r.height}})()`
async function enter(c) { await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }) }
async function waitDone(p, timeoutMs) {
  const len = "(document.querySelector('[data-transcript-session],.app-frame-transcript')||document.querySelector('main')).innerText.length"
  const t0 = Date.now(); const base = await p.evaluate(len); let stable = 0, last = base, changed = false
  while (Date.now() - t0 < timeoutMs) { await sleep(1000); const n = await p.evaluate(len); if (n !== base) changed = true; stable = changed && n === last ? stable + 1 : 0; last = n; if (stable >= 4) return true }
  return false
}
async function newChat(p) { await p.evaluate("(async()=>{[...document.querySelectorAll('button')].find(b=>b.offsetParent&&b.innerText.trim()==='새 대화')?.click();await new Promise(r=>setTimeout(r,1500))})()") }
async function makeH1(p) {
  const h = HARNESS[harness]
  const r = await p.evaluate(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const btn=f=>[...document.querySelectorAll('button')].find(b=>b.offsetParent&&f(b));
    btn(b=>b.innerText.trim()==='새 대화')?.click();await w(800);btn(b=>b.getAttribute('aria-label')===${JSON.stringify(h.mode)})?.click();await w(400);
    btn(b=>b.getAttribute('aria-label')==='작업 폴더 선택')?.click();await w(500);[...document.querySelectorAll('[role=menuitemradio]')].find(e=>e.innerText.includes('measure-scratch'))?.click();await w(500);
    const m=[...document.querySelectorAll('main button')].find(b=>b.offsetParent&&/\\//.test(b.innerText)&&!b.getAttribute('aria-label'));m?.click();await w(600);
    [...document.querySelectorAll('[role=menuitemradio]')].find(e=>${h.model}.test(e.innerText.trim()))?.click();await w(600);return document.querySelector('[data-harness]')?.dataset.harness})()`)
  // history-1 = 과거 1턴 + 최신 1턴 — 두 번 보낸다. 최신 턴은 화면보다 길게(80줄) — 본문이 넘쳐야 읽던 위치(D-016)를 잰다.
  for (const text of ['안녕', '코드 블록 하나 안에 1부터 80까지 한 줄에 하나씩 숫자만 출력하라']) {
    const t = await p.evaluate(rectOf(TEXTAREA)); await click(p, t.x, t.y)
    await p.c.send('Input.insertText', { text }); await enter(p.c)
    if (!(await waitDone(p, 180000))) throw Error('h1 준비: 답 시간 초과')
  }
  await sleep(1000)
  return { harness: r, url: await p.evaluate('location.href') }
}

// 가상화로 DOM 행은 일부뿐이라 모델 블록 수(`__ooDev.blockCount`)로 센다. 이전 빌드(d8684684)는 `__ooDev`가 없어 -1.


const SC = "document.querySelector('[data-transcript-session],.app-frame-transcript')"
const IMAGES = [1, 2, 3, 4, 5].map((i) => ({ name: `image-${i}.png`, b64: readFileSync(`C:/orca-W/inputs/image-${i}.png`).toString('base64') }))
async function newSession(p) {
  const h = HARNESS[harness]
  await p.evaluate(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const btn=f=>[...document.querySelectorAll('button')].find(b=>b.offsetParent&&f(b));
    btn(b=>b.innerText.trim()==='새 대화')?.click();await w(800);btn(b=>b.getAttribute('aria-label')===${JSON.stringify(h.mode)})?.click();await w(400);
    btn(b=>b.getAttribute('aria-label')==='작업 폴더 선택')?.click();await w(500);[...document.querySelectorAll('[role=menuitemradio]')].find(e=>e.innerText.includes('measure-scratch'))?.click();await w(500);
    const m=[...document.querySelectorAll('main button')].find(b=>b.offsetParent&&b.innerText.includes('/')&&!b.getAttribute('aria-label'));m?.click();await w(600);
    [...document.querySelectorAll('[role=menuitemradio]')].find(e=>${h.model}.test(e.innerText.trim()))?.click();await w(600)})()`)
}
// 컴포저 첨부 상태 — 첨부 이름(이미지 alt·title·data 속성)과 초안 글자.
const COMPOSER = `(()=>{const ta=document.querySelector('textarea[aria-label="메시지 입력"]');let box=ta;for(let i=0;i<6&&box;i++)box=box.parentElement;
  const names=[...(box?box.querySelectorAll('img,[data-attachment-name],[title],[aria-label]'):[])].map(e=>e.getAttribute('data-attachment-name')||e.getAttribute('alt')||e.getAttribute('title')||e.getAttribute('aria-label')||'').filter(n=>n.includes('image-')&&n.includes('.png'));
  return {draft:ta?ta.value:null,names:[...new Set(names)]}})()`
async function record(p, sidB) {
  const b = client((await json('/json/version')).webSocketDebuggerUrl); await b.open
  const events = []; let finished; const complete = new Promise((r) => (finished = r))
  b.on((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') finished() })
  const steps = []; const at = (s) => steps.push({ step: s, t: new Date().toISOString() })
  await b.send('Tracing.start', { traceConfig: { includedCategories: CATEGORIES, excludedCategories: ['*'] }, transferMode: 'ReportEvents' })
  await p.evaluate("performance.mark('oo-measure-start')")
  const startedAt = new Date().toISOString(); at('start')
  const ta = await p.evaluate(rectOf(TEXTAREA)); await click(p, ta.x, ta.y)
  // ① 5장 붙여넣기(합성 paste — DataTransfer 파일) + 초안
  const pasted = await p.evaluate(`(()=>{const dt=new DataTransfer();for(const im of ${JSON.stringify(IMAGES)}){const bin=atob(im.b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);dt.items.add(new File([u],im.name,{type:'image/png'}))}
    const ta=document.querySelector('textarea[aria-label="메시지 입력"]');ta.focus();ta.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));return dt.files.length})()`)
  await p.c.send('Input.insertText', { text: 'W4 초안 — 받은 이미지 파일 이름만 순서대로 한 줄에 답하라' })
  await sleep(1500)
  const before = await p.evaluate(COMPOSER); at('pasted')
  // ② A(새 대화 초안) → B → 새 대화 : 초안·첨부 유지, B 컴포저에는 없음
  const rowB = await p.evaluate(rectOf(`document.querySelector('.app-frame-session-row[data-session-id=${JSON.stringify(sidB)}]')`))
  await click(p, rowB.x, rowB.y); await sleep(1500)
  const inB = await p.evaluate(COMPOSER); at('to-B')
  const nb = await p.evaluate(rectOf("[...document.querySelectorAll('button')].find(b=>b.offsetParent&&b.innerText.trim()==='새 대화')"))
  await click(p, nb.x, nb.y); await sleep(1500)
  const back = await p.evaluate(COMPOSER); at('back-A')
  // ③ 곧바로 전송
  const t2 = await p.evaluate(rectOf(TEXTAREA)); await click(p, t2.x, t2.y); await enter(p.c); at('send')
  await sleep(4000)
  const bubble = await p.evaluate(`(()=>{const sc=${SC};const imgs=[...sc.querySelectorAll('img,[data-attachment-name],[title]')].map(i=>i.getAttribute('data-attachment-name')||i.getAttribute('alt')||i.getAttribute('title')||'').filter(n=>n.includes('image-')&&n.includes('.png'));return {imgs,draftAfter:document.querySelector('textarea[aria-label="메시지 입력"]')?.value??null}})()`)
  at('bubble')
  await sleep(6000)
  await b.send('Tracing.end'); await complete
  const endedAt = new Date().toISOString(); b.close()
  const mark = events.find((e) => e.name === 'oo-measure-start')
  return { startedAt, endedAt, steps, pasted, before, inB, back, bubble, kept: mark ? events.filter((e) => e.ph === 'M' || e.pid === mark.pid) : events, total: events.length }
}

killDiag(); prepareProfile(); launch()
let code = 0
try {
  const p = await page()
  const sidB = await p.evaluate(`[...document.querySelectorAll('.app-frame-session-row')].map(e=>e.dataset.sessionId)[0]`)
  await newSession(p)
  const r = await record(p, sidB)
  const want = IMAGES.map((x) => x.name)
  const uniqBubble = [...new Set(r.bubble.imgs)]
  const order = JSON.stringify(uniqBubble.slice(-5)) === JSON.stringify(want)
  const kept = r.before.names.length === 5 && JSON.stringify(r.back.names) === JSON.stringify(r.before.names) && r.back.draft === r.before.draft && r.inB.names.length === 0
  const checks = SIDE[sha8] === 'after' ? `source-order-preserved=${order ? 'ok' : 'fail'};draft-kept-on-switch=${kept ? 'ok' : 'fail'}` : ''
  mkdirSync(rawDir, { recursive: true })
  const file = runId + '.json'
  const cards = await p.evaluate(cardsTaken).catch(() => [])
  writeTrace(join(rawDir, file), r.kept, { cards, startedAt: r.startedAt, endedAt: r.endedAt, steps: r.steps, pasted: r.pasted, before: r.before, inB: r.inB, back: r.back, bubble: r.bubble, totalEvents: r.total, kept: 'measure-mark pid + metadata', source: 'w4-runner.mjs CDP Tracing + CDP synthetic input' })
  appendFileSync(runsheet, ['0330', 'W4', 'images-5-send-switch', load, harness, 'diagnostic', SIDE[sha8], SHAS[sha8], repeat, runId, r.startedAt, r.endedAt, file, checks, `CDP 합성 입력 · 첨부 ${r.before.names.length} · 복귀 ${r.back.names.length} · B ${r.inB.names.length} · 버블 ${uniqBubble.length}` + ' · 카드 ' + cards.length + (cards.length ? ' ' + JSON.stringify(cards.map((c) => c.kind + '→' + c.action)) : '')].join('\t') + '\n')
  log('ok', JSON.stringify({ before: r.before, inB: r.inB, back: r.back, bubble: { n: uniqBubble.length, names: uniqBubble } }))
  p.c.close()
} catch (e) { log('FAIL', e.message); code = 1 } finally { killDiag() }
process.exit(code)

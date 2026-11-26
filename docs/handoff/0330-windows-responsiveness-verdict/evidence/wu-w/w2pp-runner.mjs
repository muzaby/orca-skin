// 0330 W2″ 실측 러너 — 검색 결과 클릭/Enter → 대상 행 강조 (기반: w2-runner.mjs)(W-053 CDP 합성 입력) — 저장된 대화 열기 → 상단 당김 제스처 5회.
//   node w2-runner.mjs <sha8> <harness> <repeat> <history-1|history-100>
// 측정 전: 프로필 복원(history-1 은 '안녕' 1턴 세션을 이 run 에서 만든다) → '새 대화'로 옮긴 뒤 앱 재기동.
// 기록: 표식 → 사이드바 세션 행 클릭 → 첫 본문 → [제스처 = 상단에 닿을 때까지 20ms 간격 휠 ↑, 닿은 뒤 300ms 더] × 5.
// 측정자 확인 값(checks): requests-per-gesture-is-1 = 제스처마다 추가된 턴이 ≤1 이고 이력이 남았을 때 정확히 1
//   (이후 빌드만 — 이전 빌드는 전량 열기라 판정 대상 아님), reading-offset = 제스처 끝 → 1.5초 뒤 첫 가시 메시지 top 변화의 최대 px.
import { execSync, spawn } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const SHAS = { d8684684: 'd86846844dc9ea092f394f942621b78dc3d50e02', '515ff58d': '515ff58d60eb5d76744cc34aaad20bc7f186d928' }
const SIDE = { d8684684: 'before', '515ff58d': 'after' }
const HARNESS = { 'claude-code': { mode: '코드', model: /^sonnet/ }, 'claude-work': { mode: '작업', model: /^sonnet/ }, opencode: { mode: '코드', model: /^Big Pickle/ } }
const CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'toplevel', '__metadata']
const PORT = 9333
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [sha8, harness, repeat, input] = process.argv.slice(2)
const load = 'default'
if (!SHAS[sha8] || !HARNESS[harness] || !/^[1-9]$/.test(repeat ?? '') || !['click', 'enter'].includes(input)) (console.error('사용법: <sha8> <harness> <repeat> <click|enter>'), process.exit(2))
// 과거를 읽는 중에 live 결과가 도착한다. Claude 하네스는 100턴 템플릿(원본 jsonl 복원), OpenCode 는 원본이 전역 DB 라
// 앞 run 의 P1 답이 쌓여 문맥 압축·응답 변형이 났다(probe-oc-noswitch) — run 마다 새 2턴 세션(인사 + 80줄 코드 블록)을 만든다.
const H100 = true // 100턴 세션의 63턴을 검색해 연다
const runsheet = 'C:/orca-W/phase1/runs.tsv'
const rawDir = 'C:/orca-W/phase1/raw'
const runId = `w2pp-${sha8}-${harness}-${input}-r${repeat}`
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


const QUERY = '확인 63'
async function record(p) {
  const b = client((await json('/json/version')).webSocketDebuggerUrl); await b.open
  const events = []; let finished; const complete = new Promise((r) => (finished = r))
  b.on((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') finished() })
  const steps = []; const at = (s) => steps.push({ step: s, t: new Date().toISOString() })
  await b.send('Tracing.start', { traceConfig: { includedCategories: CATEGORIES, excludedCategories: ['*'] }, transferMode: 'ReportEvents' })
  await p.evaluate("performance.mark('oo-measure-start')")
  const startedAt = new Date().toISOString(); at('start')
  const sb = await p.evaluate(rectOf("document.querySelector('button[aria-label=\"검색\"]')"))
  if (!sb) throw Error('검색 버튼 없음')
  await click(p, sb.x, sb.y); await sleep(700)
  const inp = await p.evaluate(rectOf("document.querySelector('input[aria-label=\"대화 검색\"],input[placeholder*=\"검색\"]')"))
  if (!inp) throw Error('검색 입력 없음')
  await click(p, inp.x, inp.y)
  await p.c.send('Input.insertText', { text: QUERY }); at('typed')
  let opt = null
  for (let i = 0; i < 40 && !opt; i++) { await sleep(150); opt = await p.evaluate(rectOf(`[...document.querySelectorAll('[role=option]')].find(e=>e.innerText.includes(${JSON.stringify(QUERY)}))`)) }
  if (!opt) throw Error('검색 결과 없음')
  at('result-shown')
  if (input === 'click') await click(p, opt.x, opt.y)
  else {
    await p.c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
    await p.c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  }
  at('selected')
  // 강조가 붙은 대상 행이 화면 안에 보이고 검색어를 담는가 — 3초 동안 관찰, 해제까지 5초 더 본다.
  let hl = null
  for (let i = 0; i < 30 && !hl; i++) {
    await sleep(100)
    hl = await p.evaluate(`(()=>{const e=document.querySelector('[data-history-highlight]');if(!e)return null;const sc=document.querySelector('[data-transcript-session],.app-frame-transcript').getBoundingClientRect();const r=e.getBoundingClientRect();return {text:e.innerText.slice(0,40),inView:r.bottom>sc.top&&r.top<sc.bottom,ms:${100}*0}})()`)
  }
  at(hl ? 'highlight-on' : 'highlight-none')
  let clearedAfter = null
  if (hl) for (let i = 0; i < 50; i++) { await sleep(100); if (!(await p.evaluate("!!document.querySelector('[data-history-highlight]')"))) { clearedAfter = (i + 1) * 100; break } }
  at('observed')
  await b.send('Tracing.end'); await complete
  const endedAt = new Date().toISOString(); b.close()
  const mark = events.find((e) => e.name === 'oo-measure-start')
  return { startedAt, endedAt, steps, hl, clearedAfter, kept: mark ? events.filter((e) => e.ph === 'M' || e.pid === mark.pid) : events, total: events.length }
}

killDiag(); prepareProfile(); launch()
let code = 0
try {
  const p = await page()
  await newChat(p)
  const r = await record(p)
  const ok = !!r.hl && r.hl.inView && r.hl.text.includes(QUERY)
  const checks = SIDE[sha8] === 'after' ? `highlight-on-target=${ok ? 'ok' : 'fail'}` : ''
  mkdirSync(rawDir, { recursive: true })
  const file = runId + '.json'
  writeFileSync(join(rawDir, file), JSON.stringify({ traceEvents: r.kept, metadata: { startedAt: r.startedAt, endedAt: r.endedAt, steps: r.steps, highlight: r.hl, clearedAfterMs: r.clearedAfter, totalEvents: r.total, kept: 'measure-mark pid + metadata', source: 'w2pp-runner.mjs CDP Tracing + CDP synthetic input' } }))
  appendFileSync(runsheet, ['0330', 'W2pp', 'search-' + input, load, harness, 'diagnostic', SIDE[sha8], SHAS[sha8], repeat, runId, r.startedAt, r.endedAt, file, checks, 'CDP 합성 입력 · 강조 ' + JSON.stringify(r.hl) + ' · 해제 ' + r.clearedAfter + 'ms'].join('\t') + '\n')
  log('ok', JSON.stringify({ hl: r.hl, cleared: r.clearedAfter, steps: r.steps.map((x) => x.step) }))
  p.c.close()
} catch (e) { log('FAIL', e.message); code = 1 } finally { killDiag() }
process.exit(code)

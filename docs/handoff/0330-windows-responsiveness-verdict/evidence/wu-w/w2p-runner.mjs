// 0330 W2′ 실측 러너 (기반: w2-runner.mjs)(W-053 CDP 합성 입력) — 저장된 대화 열기 → 상단 당김 제스처 5회.
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
const [sha8, harness, repeat] = process.argv.slice(2)
const load = 'default'
if (!SHAS[sha8] || !HARNESS[harness] || !/^[1-9]$/.test(repeat ?? '')) (console.error('사용법: <sha8> <harness> <repeat>'), process.exit(2))
// 과거를 읽는 중에 live 결과가 도착한다. Claude 하네스는 100턴 템플릿(원본 jsonl 복원), OpenCode 는 원본이 전역 DB 라
// 앞 run 의 P1 답이 쌓여 문맥 압축·응답 변형이 났다(probe-oc-noswitch) — run 마다 새 2턴 세션(인사 + 80줄 코드 블록)을 만든다.
const H100 = harness !== 'opencode'
const runsheet = 'C:/orca-W/phase1/runs.tsv'
const rawDir = 'C:/orca-W/phase1/raw'
const runId = `w2p-${sha8}-${harness}-r${repeat}`
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

const P1 = '1부터 3000까지 한 줄에 하나씩 숫자만 출력하라'
const SC = "document.querySelector('[data-transcript-session],.app-frame-transcript')"
const textOf = `(${SC}?.innerText??'')`
async function clickRow(p, sid) {
  const row = await p.evaluate(rectOf(`document.querySelector('.app-frame-session-row[data-session-id=${JSON.stringify(sid)}]')`))
  if (!row) throw Error('세션 행 없음: ' + sid)
  await click(p, row.x, row.y)
  await sleep(1500)
}
async function toBottom(p) {
  const r = await p.evaluate(rectOf(SC))
  for (let i = 0; i < 80; i++) { await p.c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.x, y: r.y, deltaX: 0, deltaY: 600 }); await sleep(30) }
  await sleep(800)
}
async function record(p, sidA, sidB) {
  const b = client((await json('/json/version')).webSocketDebuggerUrl); await b.open
  const events = []; let finished; const complete = new Promise((r) => (finished = r))
  b.on((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') finished() })
  const steps = []; const at = (s) => steps.push({ step: s, t: new Date().toISOString() })
  await b.send('Tracing.start', { traceConfig: { includedCategories: CATEGORIES, excludedCategories: ['*'] }, transferMode: 'ReportEvents' })
  await p.evaluate("performance.mark('oo-measure-start')")
  const startedAt = new Date().toISOString(); at('start')
  // ① 과거를 읽는다 — 위로 휠
  const r = await p.evaluate(rectOf(SC))
  for (let i = 0; i < 12; i++) { await p.c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: r.x, y: r.y, deltaX: 0, deltaY: -240 }); await sleep(60) }
  at('read-up')
  // ② 읽는 중에 전송 → live 결과가 도착한다
  const ta = await p.evaluate(rectOf(TEXTAREA)); await click(p, ta.x, ta.y)
  await p.c.send('Input.insertText', { text: P1 }); await enter(p.c); at('send-P1')
  await sleep(3000)
  // ③ A → B → A (스트리밍 중 세션 전환)
  await clickRow(p, sidB); at('to-B')
  await sleep(2500)
  await clickRow(p, sidA); at('back-A')
  // ④ 측정 창은 A 복귀 뒤 30초로 고정한다 — OpenCode 는 복귀 시 저장 앵커(위쪽)로 돌아가 하단 스트리밍이
  // 마운트되지 않아 글자 수 안정으로 완료를 판정하면 너무 일찍 끝난다(w2p-oc 1차). 완료 확인은 기록 뒤에 따로 한다.
  await sleep(30000)
  at('window-30s')
  await b.send('Tracing.end'); await complete
  const endedAt = new Date().toISOString(); b.close()
  const mark = events.find((e) => e.name === 'oo-measure-start')
  return { startedAt, endedAt, steps, kept: mark ? events.filter((e) => e.ph === 'M' || e.pid === mark.pid) : events, total: events.length }
}

killDiag(); prepareProfile(); launch()
let code = 0
try {
  const p = await page()
  const sidA = H100 ? JSON.parse(readFileSync(`C:/orca-W/profiles/h100-${harness}.json`, 'utf8')).url.split('/chat/')[1] : (await makeH1(p)).url.split('/chat/')[1]
  const sidB = await p.evaluate(`[...document.querySelectorAll('.app-frame-session-row')].map(e=>e.dataset.sessionId).find(id=>id&&id!==${JSON.stringify(sidA)})`)
  await clickRow(p, sidA)
  const r = await record(p, sidA, sidB)
  // 판정 확인(측정 밖): A 하단에서 답 끝(2999/3000) 또는 미완료 표시가 보일 때까지 최대 180초 기다린다.
  for (let i = 0; i < 60; i++) {
    await toBottom(p)
    const t = await p.evaluate(textOf)
    if (/(^|\D)(2999|3000)(\D|$)/.test(t) || t.includes('응답이 완료되지 않았습니다')) break
    await sleep(2000)
  }
  const a = await p.evaluate(`(()=>{const t=${textOf};return {tail:t.slice(-160).split(String.fromCharCode(10)).join(' | '),p1:t.split(${JSON.stringify(P1)}).length-1,has3000:/(^|\\n)3000(\\n|$)/.test(t),has2999:t.includes('2999')}})()`)
  await clickRow(p, sidB); await toBottom(p)
  const bb = await p.evaluate(`(()=>{const t=${textOf};return {p1:t.split(${JSON.stringify(P1)}).length-1,has2999:t.includes('2999')}})()`)
  // 긴 답은 DOM 에 끝 줄까지 다 마운트되지 않을 수 있어 2999·3000 중 하나로 끝 부분 도착을 본다(원본 jsonl 은 3000 으로 끝남).
  const ok = a.p1 === 1 && (a.has3000 || a.has2999) && bb.p1 === 0 && !bb.has2999
  const checks = SIDE[sha8] === 'after' ? `applied-once-correct-session=${ok ? 'ok' : 'fail'}` : ''
  mkdirSync(rawDir, { recursive: true })
  const file = runId + '.json'
  writeFileSync(join(rawDir, file), JSON.stringify({ traceEvents: r.kept, metadata: { startedAt: r.startedAt, endedAt: r.endedAt, steps: r.steps, sidA, sidB, checkA: a, checkB: bb, totalEvents: r.total, kept: 'measure-mark pid + metadata', source: 'w2p-runner.mjs CDP Tracing + CDP synthetic input' } }))
  appendFileSync(runsheet, ['0330', 'W2p', 'live-large-turn', load, harness, 'diagnostic', SIDE[sha8], SHAS[sha8], repeat, runId, r.startedAt, r.endedAt, file, checks, 'CDP 합성 입력 · A ' + JSON.stringify(a) + ' · B ' + JSON.stringify(bb) + ' · ' + r.steps.map((x) => x.step).join('>')].join('\t') + '\n')
  log('ok', JSON.stringify({ a, b: bb, steps: r.steps.map((x) => x.step) }))
  p.c.close()
} catch (e) { log('FAIL', e.message); code = 1 } finally { killDiag() }
process.exit(code)

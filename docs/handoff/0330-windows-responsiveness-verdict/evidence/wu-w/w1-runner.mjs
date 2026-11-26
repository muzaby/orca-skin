// 0330 W1 실측 러너(W-053 CDP 합성 입력). run 하나 = 프로필 복원 → 진단 빌드 기동 → 새 대화(하네스·폴더) 준비
// → '안녕' 1턴 → 기록(표식 → P1 → 한글 200키 → 휠 10초 → 경계 드래그 10초) → 종료 → 실행표 한 줄.
//   node w1-runner.mjs <sha8> <harness> <repeat> [--runsheet <tsv>] [--raw <dir>]
// 저장 trace 는 측정 표식 pid 의 이벤트와 메타데이터(`ph:'M'`)만 남긴다 — 추출기가 쓰는 전부다(§25 E1′·E3′).
import { execSync, spawn } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const SHAS = { d8684684: 'd86846844dc9ea092f394f942621b78dc3d50e02', '515ff58d': '515ff58d60eb5d76744cc34aaad20bc7f186d928' }
const SIDE = { d8684684: 'before', '515ff58d': 'after' }
const HARNESS = {
  'claude-code': { mode: '코드', model: /^sonnet/ },
  'claude-work': { mode: '작업', model: /^sonnet/ },
  opencode: { mode: '코드', model: /^Big Pickle/ }
}
const P1 = '1부터 3000까지 한 줄에 하나씩 숫자만 출력하라'
const CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'toplevel', '__metadata']
const PORT = 9333
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d)
const [sha8, harness, repeat] = process.argv.slice(2)
if (!SHAS[sha8] || !HARNESS[harness] || !/^[1-9]$/.test(repeat ?? '')) {
  console.error('사용법: <d8684684|515ff58d> <claude-code|claude-work|opencode> <반복>')
  process.exit(2)
}
const runsheet = arg('--runsheet', 'C:/orca-W/phase1/runs.tsv')
const rawDir = arg('--raw', 'C:/orca-W/phase1/raw')
const runId = `w1-${sha8}-${harness}-h1-r${repeat}`
const exe = `C:/orca-W/run1/diag-${sha8}/app/dist/win-unpacked/orcinus-orca.exe`
const profile = `C:/orca-W/work/${runId}`
const log = (...a) => console.error(new Date().toISOString(), runId, ...a)

function killDiag() {
  try {
    execSync(`powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -like 'C:\\orca-W\\run1\\diag-*' } | Stop-Process -Force"`, { stdio: 'ignore' })
  } catch {}
}

function prepareProfile() {
  if (existsSync(profile)) rmSync(profile, { recursive: true, force: true })
  cpSync('C:/orca-W/profiles/real-copy', profile, { recursive: true })
  const Database = createRequire('C:/workspace/github/claude/orca-skin/app/package.json')('better-sqlite3')
  const db = new Database(join(profile, 'orcinus-orca.db'))
  const t = Date.now()
  db.prepare('INSERT INTO projects (id,name,instructions,created_at,updated_at,cwd,cwd_key) VALUES (?,?,?,?,?,?,?)').run('measure-scratch', 'measure-scratch', '', t, t, 'C:\\orca-W\\work\\scratch', 'c:/orca-w/work/scratch')
  db.close()
  mkdirSync('C:/orca-W/work/scratch', { recursive: true })
}

const json = async (path) => (await fetch(`http://127.0.0.1:${PORT}${path}`)).json()
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
async function page() {
  for (let i = 0; i < 60; i++) {
    try {
      const t = (await json('/json/list')).find((x) => x.type === 'page' && x.url.startsWith('app://'))
      if (t) {
        const c = client(t.webSocketDebuggerUrl)
        await c.open
        const evaluate = async (expression) => {
          const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
          if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
          return r.result.value
        }
        for (let k = 0; k < 60; k++) {
          if (await evaluate(`!!${TEXTAREA}`).catch(() => false)) break
          await sleep(1000)
        }
        await sleep(1500)
        return { c, evaluate }
      }
    } catch {}
    await sleep(1000)
  }
  throw Error('앱 페이지 없음')
}

const rectOf = (sel) => `(()=>{const e=${sel};if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`
const TEXTAREA = "document.querySelector('textarea[aria-label=\"메시지 입력\"]')"
async function click(p, x, y) {
  await p.c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await p.c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}
async function focus(p) {
  const r = await p.evaluate(rectOf(TEXTAREA))
  if (!r) throw Error('입력창 없음')
  await click(p, r.x, r.y)
}
async function enter(c) {
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
}
async function waitDone(p, timeoutMs) {
  // 구 빌드(d8684684)는 `data-message-id`가 없다(W-035) — 본문 영역 글자 수가 바뀐 뒤 3초 멈추면 완료로 본다.
  const len = "(document.querySelector('[data-transcript-session]')||document.querySelector('main')).innerText.length"
  const t0 = Date.now()
  const base = await p.evaluate(len)
  let stable = 0
  let last = base
  let changed = false
  while (Date.now() - t0 < timeoutMs) {
    await sleep(1000)
    const n = await p.evaluate(len)
    const busy = await p.evaluate("!![...document.querySelectorAll('button')].find(b=>/중지|정지|stop/i.test((b.getAttribute('aria-label')||'')+(b.title||'')))")
    if (n !== base) changed = true
    stable = changed && !busy && n === last ? stable + 1 : 0
    last = n
    if (stable >= 4) return true
  }
  return false
}

async function setup(p) {
  const h = HARNESS[harness]
  const result = await p.evaluate(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));
    const btn=(f)=>[...document.querySelectorAll('button')].find(b=>b.offsetParent&&f(b));
    btn(b=>b.innerText.trim()==='새 대화')?.click();await w(800);
    const mode=btn(b=>b.getAttribute('aria-label')===${JSON.stringify(h.mode)});if(!mode)return 'no-mode';mode.click();await w(400);
    const fold=btn(b=>b.getAttribute('aria-label')==='작업 폴더 선택');if(!fold)return 'no-folder';fold.click();await w(500);
    const item=[...document.querySelectorAll('[role=menuitemradio]')].find(e=>e.innerText.includes('measure-scratch'));if(!item)return 'no-scratch';item.click();await w(500);
    const model=[...document.querySelectorAll('main button')].find(b=>b.offsetParent&&/\\//.test(b.innerText)&&!b.getAttribute('aria-label'));if(!model)return 'no-model';model.click();await w(600);
    const opt=[...document.querySelectorAll('[role=menuitemradio]')].find(e=>${h.model}.test(e.innerText.trim()));if(!opt)return 'no-model-option';opt.click();await w(600);
    return {mode:${JSON.stringify(h.mode)},folder:fold.innerText,model:model.innerText,harness:document.querySelector('[data-harness]')?.dataset.harness}})()`)
  if (typeof result === 'string') throw Error('setup: ' + result)
  log('setup', JSON.stringify(result))
  await focus(p)
  await p.c.send('Input.insertText', { text: '안녕' })
  await enter(p.c)
  if (!(await waitDone(p, 180000))) throw Error('setup: 첫 답 시간 초과')
  return result
}

async function record(p) {
  const b = client((await json('/json/version')).webSocketDebuggerUrl)
  await b.open
  const events = []
  let finished
  const complete = new Promise((r) => (finished = r))
  b.on((m) => {
    if (m.method === 'Tracing.dataCollected') events.push(...m.params.value)
    if (m.method === 'Tracing.tracingComplete') finished()
  })
  const steps = []
  const at = (s) => steps.push({ step: s, t: new Date().toISOString() })
  await b.send('Tracing.start', { traceConfig: { includedCategories: CATEGORIES, excludedCategories: ['*'] }, transferMode: 'ReportEvents' })
  await p.evaluate("performance.mark('oo-measure-start')")
  const startedAt = new Date().toISOString()
  at('start')
  await focus(p)
  await p.c.send('Input.insertText', { text: P1 })
  await enter(p.c)
  at('send-P1')
  await sleep(2500)
  await focus(p)
  const hangul = '가나다라마바사아자차카타파하'
  for (let i = 0; i < 200; i++) {
    const ch = hangul[i % hangul.length]
    await p.c.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch })
    await p.c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch })
    await sleep(40)
  }
  at('typed-200')
  const area = await p.evaluate(rectOf("document.querySelector('[data-transcript-session]')||document.querySelector('main')"))
  let t1 = Date.now(), dir = -1
  while (Date.now() - t1 < 10000) {
    await p.c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: area.x, y: area.y, deltaX: 0, deltaY: dir * 120 })
    if ((Date.now() - t1) % 2000 < 60) dir = -dir
    await sleep(50)
  }
  at('wheel-10s')
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
  } else at('drag-skipped')
  await b.send('Tracing.end')
  await complete
  const endedAt = new Date().toISOString()
  b.close()
  const mark = events.find((e) => e.name === 'oo-measure-start')
  const kept = mark ? events.filter((e) => e.ph === 'M' || e.pid === mark.pid) : events
  return { startedAt, endedAt, steps, kept, total: events.length }
}

killDiag()
prepareProfile()
const child = spawn(exe, [`--remote-debugging-port=${PORT}`], { env: { ...process.env, OO_MEASURE_USER_DATA: profile }, detached: true, stdio: 'ignore' })
child.unref()
let code = 0
try {
  const p = await page()
  const s = await setup(p)
  const r = await record(p)
  mkdirSync(rawDir, { recursive: true })
  const file = runId + '.json'
  writeFileSync(join(rawDir, file), JSON.stringify({ traceEvents: r.kept, metadata: { startedAt: r.startedAt, endedAt: r.endedAt, steps: r.steps, setup: s, totalEvents: r.total, kept: 'measure-mark pid + metadata', source: 'w1-runner.mjs CDP Tracing + CDP synthetic input' } }))
  if (!existsSync(runsheet)) writeFileSync(runsheet, ['owner', 'scenario', 'operation', 'load', 'harness', 'build', 'side', 'sha', 'repeat', 'runId', 'startedAt', 'endedAt', 'traceFile', 'checks', 'note'].join('\t') + '\n')
  appendFileSync(runsheet, ['0330', 'W1', 'long-chat-type-wheel-drag', 'history-1', harness, 'diagnostic', SIDE[sha8], SHAS[sha8], repeat, runId, r.startedAt, r.endedAt, file, '', 'CDP 합성 입력 · ' + r.steps.map((x) => x.step).join('>')].join('\t') + '\n')
  log('ok', r.kept.length, '/', r.total, 'events', r.steps.at(-1).step)
  p.c.close()
} catch (e) {
  log('FAIL', e.message)
  code = 1
} finally {
  killDiag()
}
process.exit(code)

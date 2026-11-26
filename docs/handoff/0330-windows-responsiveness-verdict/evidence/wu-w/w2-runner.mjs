// 0330 W2 실측 러너(W-053 CDP 합성 입력) — 저장된 대화 열기 → 상단 당김 제스처 5회.
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
const [sha8, harness, repeat, load] = process.argv.slice(2)
if (!SHAS[sha8] || !HARNESS[harness] || !/^[1-9]$/.test(repeat ?? '') || !['history-1', 'history-100'].includes(load)) (console.error('사용법: <sha8> <harness> <repeat> <history-1|history-100>'), process.exit(2))
const H100 = load === 'history-100'
const runsheet = 'C:/orca-W/phase1/runs.tsv'
const rawDir = 'C:/orca-W/phase1/raw'
const runId = `w2-${sha8}-${harness}-${H100 ? 'h100' : 'h1'}-r${repeat}`
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
const COUNT = "window.__ooDev?.blockCount?.() ?? -1"
const EDGE = "document.querySelector('[data-history-edge=before]')?.dataset.historyState ?? 'none'"
const ANCHOR = `(()=>{const sc=document.querySelector('[data-transcript-session],.app-frame-transcript');if(!sc)return null;const top=sc.getBoundingClientRect().top;const el=[...sc.querySelectorAll('[data-message-id]')].find(e=>e.getBoundingClientRect().bottom>top+4);return el?{id:el.dataset.messageId,top:el.getBoundingClientRect().top,scrollTop:sc.scrollTop}:{id:null,top:0,scrollTop:sc.scrollTop}})()`

async function record(p, sessionId) {
  const b = client((await json('/json/version')).webSocketDebuggerUrl); await b.open
  const events = []; let finished; const complete = new Promise((r) => (finished = r))
  b.on((m) => { if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); if (m.method === 'Tracing.tracingComplete') finished() })
  const steps = []; const at = (s) => steps.push({ step: s, t: new Date().toISOString() })
  await b.send('Tracing.start', { traceConfig: { includedCategories: CATEGORIES, excludedCategories: ['*'] }, transferMode: 'ReportEvents' })
  await p.evaluate("performance.mark('oo-measure-start')")
  const startedAt = new Date().toISOString(); at('start')
  const row = await p.evaluate(rectOf(`document.querySelector('.app-frame-session-row[data-session-id=${JSON.stringify(sessionId)}]')`))
  if (!row) throw Error('세션 행 없음: ' + sessionId)
  await click(p, row.x, row.y); at('open-click')
  for (let i = 0; i < 40 && !(await p.evaluate(`(document.querySelector('[data-transcript-session],.app-frame-transcript')?.innerText.length??0)>0`)); i++) await sleep(100)
  await sleep(1500); at('opened')
  const sc = await p.evaluate(rectOf("document.querySelector('[data-transcript-session],.app-frame-transcript')"))
  const gestures = []
  // 제스처 = 상단 도달까지 20ms 간격 휠 ↑ + 도달 뒤 300ms. 끝난 뒤 페이지 안에서 rAF 로 블록 수 변화를 기다리며
  // 변화 직전·직후 프레임의 첫 가시 메시지 top 을 잰다(앞삽입 순간의 읽던 위치 차). 변화 없으면 1.5초 뒤 끝.
  // 제스처 시작 전에 페이지 안 관찰자를 건다 — rAF 마다 첫 가시 메시지 top 을 기억하다가 블록 수가 바뀐 첫 프레임에
  // 같은 요소의 top 과 비교한다(앞삽입 순간 읽던 위치 차 px). 휠 이동 자체는 같은 프레임 안에서 빼지 못하므로,
  // 변화 직전 프레임과 변화 프레임 사이에 휠 tick 이 들어가면 그만큼 섞인다 — 20ms 간격 tick 이라 섞임은 ≤ 1 tick 분량.
  const ARM = `(()=>{const sc=document.querySelector('[data-transcript-session],.app-frame-transcript');const n0=window.__ooDev?.blockCount?.()??-1;const w={n0,result:null,lastWheel:0};window.__w2=w;sc.addEventListener('wheel',()=>{w.lastWheel=performance.now()},{passive:true,capture:true});
    // 읽던 글줄(D-016) = 화면 가운데 줄의 글자(caretRangeFromPoint) — 앱의 앵커도 글자 단위다(anchor.ts).
    // 첫 가시 메시지 요소 top 은 앞삽입 뒤 그 메시지에 시각 행이 붙어 함께 움직여 읽던 위치를 나타내지 않는다(probe-glyph).
    const anchor=()=>{const R=sc.getBoundingClientRect();for(const fy of [0.5,0.25,0.75])for(const x of [R.left+40,R.left+R.width*0.3,R.left+R.width*0.5,R.right-80]){const c=document.caretRangeFromPoint(x,R.top+R.height*fy);if(c&&c.startContainer.nodeType===3&&sc.contains(c.startContainer)){const node=c.startContainer,off=c.startOffset;const g={node,off,get el(){return node},top:0};const rg=document.createRange();rg.setStart(node,off);rg.setEnd(node,Math.min(off+1,node.length));g.top=rg.getBoundingClientRect().top;return g}}return null};
    const glyphTop=(g)=>{if(!g||!g.node.isConnected)return null;const rg=document.createRange();rg.setStart(g.node,g.off);rg.setEnd(g.node,Math.min(g.off+1,g.node.length));return rg.getBoundingClientRect().top};
    let a=anchor();let prev=performance.now();const t0=prev;let scrollable=sc.scrollHeight>sc.clientHeight+1;
    const tick=(now)=>{const n=window.__ooDev?.blockCount?.()??-1;
      if(n!==n0){const t1=glyphTop(a);const wheelMixed=w.lastWheel>=prev;const top0=a?.top,ms=performance.now()-t0;
        const g0=a;const tops=[t1];let k=0;const settle=()=>{tops.push(glyphTop(g0));if(++k<10)requestAnimationFrame(settle);else{const last=tops.at(-1);
          w.result={n,ms,scrollable,wheelMixed:wheelMixed||w.lastWheel>=prev,firstFrame:t1!=null&&!wheelMixed?Math.abs(t1-top0):null,offset:last!=null&&!(w.lastWheel>=prev)?Math.abs(last-top0):null,tops:tops.map(x=>x==null?null:Math.round((x-top0)*10)/10)}}};requestAnimationFrame(settle);return}
      prev=performance.now();scrollable=sc.scrollHeight>sc.clientHeight+1;
      if(performance.now()-t0>6000){w.result={n,offset:null,ms:null};return}
      a=anchor();requestAnimationFrame(tick)};requestAnimationFrame(tick);return n0})()`
  for (let g = 0; g < 5; g++) {
    const edge = await p.evaluate(EDGE)
    const nStart = await p.evaluate(ARM)
    const t0 = Date.now(); let reachedAt = 0
    // tick 간격 150ms — HISTORY_GESTURE_GAP_MS(200) 안이라 한 제스처이고, 요청(~50ms 뒤 앞삽입)이 다음 tick 전에 끝난다.
    // 블록 수가 바뀌었거나 요청 상태가 보이면 멈춘다. 상단에 닿은 뒤엔 tick 하나만 더.
    while (Date.now() - t0 < 4000) {
      await p.c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: sc.x, y: sc.y, deltaX: 0, deltaY: -120 })
      await sleep(150)
      const st = await p.evaluate(`({top:document.querySelector('[data-transcript-session],.app-frame-transcript').scrollTop,n:${COUNT},edge:${EDGE}})`)
      if (st.n !== nStart || ['pull', 'loading'].includes(st.edge)) break
      if (reachedAt) break
      if (st.top <= 0) reachedAt = Date.now()
    }
    await sleep(1500)
    const w = await p.evaluate('window.__w2.result')
    const total = (await p.evaluate(COUNT)) - nStart
    gestures.push({ edge, added: total, firstChangeMs: w?.ms ?? null, scrollable: w?.scrollable ?? null, offset: w?.offset ?? null, firstFrame: w?.firstFrame ?? null, tops: w?.tops ?? null, wheelMixed: w?.wheelMixed ?? null, reachedTop: !!reachedAt })
    await sleep(300)
  }
  at('gestures-5')
  await b.send('Tracing.end'); await complete
  const endedAt = new Date().toISOString(); b.close()
  const mark = events.find((e) => e.name === 'oo-measure-start')
  return { startedAt, endedAt, steps, gestures, kept: mark ? events.filter((e) => e.ph === 'M' || e.pid === mark.pid) : events, total: events.length }
}

killDiag(); prepareProfile(); launch()
let code = 0
try {
  let p = await page()
  let sessionId
  if (H100) sessionId = JSON.parse(readFileSync(`C:/orca-W/profiles/h100-${harness}.json`, 'utf8')).url.split('/chat/')[1]
  else sessionId = (await makeH1(p)).url.split('/chat/')[1]
  await newChat(p); p.c.close(); killDiag(); await sleep(2000)
  launch(); p = await page(); await newChat(p)
  const r = await record(p, sessionId)
  const added = r.gestures.map((g) => g.added)
  // 읽던 위치(D-016 ±1px)는 앞삽입 직전에 본문이 넘쳐(스크롤 가능) 있었고 그 프레임에 휠이 없던 앞삽입만 센다 —
  // 본문이 화면보다 짧으면 위에 붙은 턴이 내용을 밀 수밖에 없다(probe-pull-shot 캡처 확인).
  const offsets = r.gestures.filter((g) => g.scrollable && g.wheelMixed === false && g.offset != null).map((g) => g.offset)
  // 이력이 남은 동안(앞 제스처들이 한 턴씩 더한 동안) 정확히 1, 이력 끝 뒤에는 0 — 한 제스처에 2 이상이면 실패.
  // 제스처마다: 시작 상태가 'end'(이력 시작 도달)면 +0, 아니면 한 턴(+1~+4 블록 — 확인 턴 = 사용자·답·시각 3블록).
  // 계약(0329 S-E2): 플릭 1회당 이전 턴 요청 ≤ 1(한 묶음) — 한 제스처에 두 턴 이상이면 실패. 이력 시작('end') 뒤엔 0.
  // 상단까지 스크롤해 닿기만 한 제스처는 요청이 없을 수 있다(다음 제스처가 당긴다). 5회 중 한 번도 안 당겨지면 실패.
  const reqOk = r.gestures.every((g) => g.added >= 0 && g.added <= 4 && (g.edge !== 'end' || g.added === 0)) && (r.gestures.some((g) => g.added > 0) || r.gestures.every((g) => g.edge === 'end'))
  const checks = SIDE[sha8] === 'after' ? `requests-per-gesture-is-1=${reqOk ? 'ok' : 'fail'};reading-offset=${offsets.length ? Math.max(...offsets).toFixed(2) : 'NaN'}` : ''
  mkdirSync(rawDir, { recursive: true })
  const file = runId + '.json'
  writeFileSync(join(rawDir, file), JSON.stringify({ traceEvents: r.kept, metadata: { startedAt: r.startedAt, endedAt: r.endedAt, steps: r.steps, gestures: r.gestures, sessionId, totalEvents: r.total, kept: 'measure-mark pid + metadata', source: 'w2-runner.mjs CDP Tracing + CDP synthetic input' } }))
  appendFileSync(runsheet, ['0330', 'W2', 'open-pull', load, harness, 'diagnostic', SIDE[sha8], SHAS[sha8], repeat, runId, r.startedAt, r.endedAt, file, checks, 'CDP 합성 입력 · 제스처 추가 메시지 ' + added.join('/')].join('\t') + '\n')
  log('ok', JSON.stringify(r.gestures))
  p.c.close()
} catch (e) { log('FAIL', e.message); code = 1 } finally { killDiag() }
process.exit(code)

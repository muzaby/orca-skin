// Codex 작성. 실제 production Electron 앱의 UI/선택/저장 경로를 실행한다.
// cwd=app: electron ../docs/handoff/0224-work-agent-layer/fixtures/work-native.cjs [--live]
// 출력은 임시 fixture에 보존한다. 사용자 Orca DB/config는 읽거나 수정하지 않는다.
const { app, BrowserWindow } = require('electron')
// 자동 시험 환경의 GPU 프로세스 DLL 제한을 피한다. renderer 보안 옵션은 변경하지 않는다.
app.disableHardwareAcceleration()
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')

const live = process.argv.includes('--live')
const originalHome = os.homedir()
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orca-work-native-'))
const home = path.join(root, 'home')
const data = path.join(root, 'data')
fs.mkdirSync(home, { recursive: true })
fs.mkdirSync(data, { recursive: true })
process.env.USERPROFILE = home
// 실제 모델 평가만 설치된 CLI의 표준 인증 저장소를 사용한다. 내용을 복사/출력하지 않는다.
if (live && !process.env.CLAUDE_CONFIG_DIR)
  process.env.CLAUDE_CONFIG_DIR = path.join(originalHome, '.claude')
app.setPath('userData', data)
app.setPath('appData', data)
fs.writeFileSync(path.join(data, 'orca-settings.json'), JSON.stringify({
  uiLocale: 'ko', sidebarCollapsed: true,
  scheduler: { updateCheck: { enabled: false }, usageRecompute: { enabled: false } }
}))

const report = { author: 'Codex', live, root, checks: {}, errors: [] }
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
async function until(read, timeout = 30000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const value = await read()
    if (value) return value
    await delay(100)
  }
  throw new Error('Native fixture timed out waiting for expected state')
}
app.on('browser-window-created', (_event, win) => {
  // 테스트 창은 숨긴 채 실제 renderer/preload/security 옵션을 그대로 사용한다.
  win.show = () => {}
  win.webContents.setBackgroundThrottling(false)
  win.setSize(1200, 850)
})

require(path.resolve(__dirname, '../../../../app/out/main/index.js'))

async function run() {
  await app.whenReady()
  const win = await until(() => BrowserWindow.getAllWindows()[0])
  const js = source => win.webContents.executeJavaScript(source, true)
  await until(() => js('Boolean(window.orca && document.querySelector("textarea"))'))
  await js('window.orca.boot.whenReady()')
  const info = await js(`({
    buttons: [...document.querySelectorAll('[role="group"][aria-label="작업 종류 선택"] button')]
      .map(b => ({label:b.getAttribute('aria-label'), pressed:b.getAttribute('aria-pressed')})),
    placeholder: document.querySelector('textarea').placeholder
  })`)
  assert.deepEqual(info.buttons, [
    { label: '작업', pressed: 'false' }, { label: '코딩', pressed: 'true' }
  ])
  report.checks.defaultCodingAndOrder = true
  await js(`window.__input = document.querySelector('textarea'); window.__input.focus()`)
  await win.webContents.insertText('보존할 초안')
  await js(`document.querySelector('[aria-label="작업 종류 선택"] button').click()`)
  await until(() => js(`document.querySelector('[aria-label="작업 종류 선택"] button').getAttribute('aria-pressed') === 'true'`))
  const draft = await js(`({same:window.__input === document.querySelector('textarea'), value:document.querySelector('textarea').value, placeholder:document.querySelector('textarea').placeholder})`)
  assert.equal(draft.same, true)
  assert.equal(draft.value, '보존할 초안')
  assert.notEqual(draft.placeholder, info.placeholder)
  report.checks.modeKeepsComposerAndChangesHint = true
  await js(`document.querySelector('[aria-label="코딩"]').focus()`)
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' })
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' })
  await until(() => js(`document.querySelector('[aria-label="코딩"]').getAttribute('aria-pressed') === 'true'`))
  report.checks.keyboardSpace = true
  await js(`window.__keys=[]; for (const type of ['keydown','keypress','keyup']) document.addEventListener(type, e => window.__keys.push({type:e.type,key:e.key,target:e.target.getAttribute('aria-label')})); document.querySelector('[aria-label="작업"]').focus()`)
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
  win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' })
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
  await until(() => js(`document.querySelector('[aria-label="작업"]').getAttribute('aria-pressed') === 'true'`))
  report.checks.keyboardEnter = true
  report.keyboardEvents = await js('window.__keys')
  await js(`document.querySelector('textarea').focus(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
  await delay(500)
  fs.writeFileSync(path.join(root, 'work-light.png'), (await win.webContents.capturePage()).toPNG())
  await js(`window.orca.settings.set({theme:'dark'})`)
  win.webContents.reload()
  await until(() => js(`Boolean(document.querySelector('textarea')) && document.documentElement.dataset.theme === 'dark'`))
  await js(`document.querySelector('[aria-label="작업"]').click(); document.querySelector('textarea').focus()`)
  await js(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
  win.setSize(1201, 850)
  await delay(200)
  win.setSize(1200, 850)
  await delay(500)
  fs.writeFileSync(path.join(root, 'work-dark.png'), (await win.webContents.capturePage()).toPNG())
  win.setSize(640, 760)
  await delay(500)
  report.checks.narrowNoHorizontalOverflow = await js(`document.documentElement.scrollWidth <= window.innerWidth`)
  assert.equal(report.checks.narrowNoHorizontalOverflow, true)
  fs.writeFileSync(path.join(root, 'work-narrow.png'), (await win.webContents.capturePage()).toPNG())
  if (!live) return

  win.setSize(1200, 850)
  await js(`document.documentElement.dataset.theme = 'white'; window.__events=[]; window.orca.chat.onEvent(e=>window.__events.push(e)); document.querySelector('textarea').focus(); document.querySelector('textarea').select()`)
  await win.webContents.insertText('가상 회의 메모: Alpha 시험은 화요일 재실행. 민수는 합성 입력 준비, 지연은 결과 표 검토. 실패 기준은 오차 3% 초과. 실제 고객 데이터는 없음. 이 메모의 결정과 담당자별 실행 항목을 정리한 meeting-summary.md 파일을 만들어 제공해 주세요.')
  await until(() => js(`!document.querySelector('[data-behavior="action:send"]').disabled`))
  await js(`document.querySelector('[data-behavior="action:send"]').click()`)
  const started = Date.now()
  await until(() => js(`window.__events.some(e=>e.type==='session.updated'||e.type==='error')`), 95000)
  const sessionId = await js(`window.__events.find(e=>e.type==='session.updated')?.sessionId ?? null`)
  report.sessionId = sessionId
  if (sessionId) {
    await until(() => js(`window.__events.some(e=>e.type==='response.boundary'&&e.boundary.phase==='end') || window.__events.some(e=>e.type==='error')`), 120000)
    const loaded = await js(`window.orca.session.load(${JSON.stringify(sessionId)})`)
    report.checks.persistedWork = loaded?.agentKind === 'work'
    report.checks.publisherCard = loaded?.messages.some(m => m.parts.some(p => p.type === 'artifact')) ?? false
    report.parts = loaded?.messages.flatMap(m => m.parts.map(p => p.type))
  }
  report.durationMs = Date.now() - started
  report.eventTypes = await js(`window.__events.map(e=>e.type)`)
  report.usage = await js(`window.__events.filter(e=>e.type==='telemetry').map(e=>e.usage ?? null)`)
  report.modelErrors = await js(`window.__events.filter(e=>e.type==='error').map(e=>({category:e.error?.category, message:e.error?.message}))`)
  fs.writeFileSync(path.join(root, 'work-result.png'), (await win.webContents.capturePage()).toPNG())
  if (sessionId) await js(`window.orca.chat.cancel(${JSON.stringify(sessionId)})`)
  assert.equal(report.checks.persistedWork, true)
  assert.equal(report.checks.publisherCard, true)
}

run().catch(async error => {
  report.errors.push(error.message)
  process.exitCode = 1
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    report.observed = await win.webContents.executeJavaScript(`({
      eventTypes: (window.__events ?? []).map(e=>e.type),
      keyboardEvents: window.__keys,
      sessionId: (window.__events ?? []).find(e=>e.type==='session.updated')?.sessionId,
      errorCategories: (window.__events ?? []).filter(e=>e.type==='error').map(e=>e.error?.category)
    })`).catch(() => null)
    fs.writeFileSync(path.join(root, 'failure.png'), (await win.webContents.capturePage()).toPNG())
  }
}).finally(() => {
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2))
  process.stdout.write(JSON.stringify(report) + '\n')
  app.exit(report.errors.length ? 1 : 0)
})

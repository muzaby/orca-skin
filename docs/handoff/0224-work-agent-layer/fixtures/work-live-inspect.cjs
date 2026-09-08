// Codex 작성. 실제 live 시험의 격리 데이터로 production 앱을 새 프로세스에서 연다.
// electron work-live-inspect.cjs <orca-work-native-* root> [--compare]
// --compare만 같은 가상 회의 메모 요약과 합성 Coding 질문을 실제 Claude에 보낸다.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { createHash, randomUUID } = require('node:crypto')
const assert = require('node:assert/strict')
const root = path.resolve(process.argv[2])
assert.match(path.basename(root), /^orca-work-native-/)
const firstRun = JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8'))
assert.equal(firstRun.live, true)
assert.equal(path.resolve(firstRun.root), root)
assert.equal(firstRun.errors.length, 0)
const compare = process.argv.includes('--compare')
const originalHome = os.homedir()
process.env.USERPROFILE = path.join(root, 'home')
if (compare && !process.env.CLAUDE_CONFIG_DIR)
  process.env.CLAUDE_CONFIG_DIR = path.join(originalHome, '.claude')
app.setPath('userData', path.join(root, 'data'))
app.setPath('appData', path.join(root, 'data'))
app.disableHardwareAcceleration()
app.on('browser-window-created', (_event, win) => {
  win.show = () => {}
  win.webContents.setBackgroundThrottling(false)
  win.setSize(1280, 900)
})
const report = { author: 'Codex', root, compare, originalSessionId: firstRun.sessionId, startedAt: new Date().toISOString(), checks: {}, errors: [] }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(read, timeout = 30000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await read()
    if (value) return value
    await delay(100)
  }
  throw new Error('Live inspection timed out')
}
const appDir = path.resolve(__dirname, '../../../../app')
require(path.join(appDir, 'out/main/index.js'))
async function run() {
  await app.whenReady()
  const win = await until(() => BrowserWindow.getAllWindows()[0])
  const js = source => win.webContents.executeJavaScript(source, true)
  await until(() => js('Boolean(window.orca && document.querySelector("textarea"))'))
  await js('window.orca.boot.whenReady()')
  const sid = JSON.stringify(firstRun.sessionId)
  const loaded = await js(`window.orca.session.load(${sid})`)
  assert.equal(loaded.agentKind, 'work')
  const parts = loaded.messages.flatMap(message => message.parts)
  const artifacts = parts.filter(part => part.type === 'artifact').map(part => part.artifact)
  assert.equal(artifacts.length, 1)
  const artifact = artifacts[0]
  const list = await js(`window.orca.artifacts.list({sessionId:${sid}})`)
  assert.deepEqual(list, artifacts)
  const statuses = await js(`window.orca.artifacts.status({sessionId:${sid},publicationIds:[${JSON.stringify(artifact.publicationId)}]})`)
  assert.equal(statuses[0].availability.state, 'present')
  report.checks.reopenedWorkAndPublication = true
  report.artifact = artifact
  const Database = require(path.join(appDir, 'node_modules/better-sqlite3'))
  const db = new Database(path.join(root, 'data/orca.db'), { readonly: true })
  try {
    const row = db.prepare(`SELECT p.id AS publicationId, p.session_id AS sessionId,
      p.message_id AS messageId, p.tool_run_id AS toolRunId, p.card_attached AS cardAttached,
      p.input_source AS inputSource, f.id AS artifactFileId, f.relative_path AS relativePath,
      f.size_bytes AS sizeBytes, f.hash FROM session_artifacts p
      JOIN artifact_files f ON f.id=p.artifact_file_id WHERE p.id=?`).get(artifact.publicationId)
    assert.equal(row.sessionId, firstRun.sessionId)
    assert.equal(row.artifactFileId, artifact.artifactFileId)
    assert.equal(row.cardAttached, 1)
    assert.ok(row.messageId && row.toolRunId)
    const call = parts.find(part => part.type === 'tool_call' && part.toolRunId === row.toolRunId)
    assert.equal(call.toolName, 'mcp__orca_artifacts__publish_artifact')
    const publishedRoot = path.join(root, 'home/.config/orca/artifacts')
    const publishedPath = path.resolve(publishedRoot, row.relativePath)
    assert.ok(publishedPath.startsWith(publishedRoot + path.sep))
    const publishedBytes = fs.readFileSync(publishedPath)
    const sourceBytes = fs.readFileSync(row.inputSource)
    assert.deepEqual(publishedBytes, sourceBytes)
    assert.equal(publishedBytes.length, row.sizeBytes)
    assert.equal(row.sizeBytes, artifact.sizeBytes)
    assert.equal(createHash('sha256').update(publishedBytes).digest('hex'), row.hash)
    const content = publishedBytes.toString('utf8')
    for (const term of ['Alpha', '화요일', '민수', '지연', '3%']) assert.ok(content.includes(term), term)
    fs.writeFileSync(path.join(root, 'published-meeting-summary.md'), publishedBytes)
    report.file = { source: row.inputSource, publishedPath, sizeBytes: row.sizeBytes, sha256: row.hash, messageId: row.messageId, toolRunId: row.toolRunId }
    report.checks.fileBytesAndDatabaseLink = true
  } finally { db.close() }
  const boundaries = parts.filter(part => part.type === 'response_boundary').map(part => part.boundary)
  assert.ok(boundaries.length >= 2 && boundaries.length % 2 === 0)
  for (let index = 0; index < boundaries.length; index += 2) {
    assert.deepEqual(boundaries.slice(index, index + 2).map(boundary => boundary.phase), ['begin', 'end'])
    assert.equal(boundaries[index].id, boundaries[index + 1].id)
    assert.equal(boundaries[index + 1].outcome, 'ended')
  }
  report.checks.reopenedEndedBoundary = true
  report.toolNames = parts.filter(part => part.type === 'tool_call').map(part => part.toolName)
  await js(`history.pushState(null,'','/chat/'+${sid}); dispatchEvent(new PopStateEvent('popstate'))`)
  await until(() => js(`Boolean(document.querySelector('[data-agent="work"]'))`))
  await until(() => js(`document.querySelectorAll('article[aria-label='+CSS.escape(${JSON.stringify(artifact.title)})+']').length === 2`))
  await until(() => js(`Boolean(document.querySelector('[data-context="task"] article')) && !document.querySelector('article button[aria-label="다운로드"]').disabled`))
  await delay(600)
  report.ui = await js(`({
    route:location.pathname,
    cards:[...document.querySelectorAll('article')].map(a=>({title:a.getAttribute('aria-label'),inTask:!!a.closest('[data-context="task"]')})),
    sections:[...document.querySelectorAll('[data-context="task"] section>button')].map(b=>({text:b.textContent,expanded:b.getAttribute('aria-expanded')})),
    responseStates:[...document.querySelectorAll('[data-response-outcome]')].map(n=>n.getAttribute('data-response-outcome'))
  })`)
  assert.equal(report.ui.cards.filter(card => card.title === artifact.title && card.inTask).length, 1)
  assert.equal(report.ui.cards.filter(card => card.title === artifact.title && !card.inTask).length, 1)
  assert.deepEqual(report.ui.responseStates, Array(boundaries.length / 2).fill('ended'))
  report.checks.reopenedTranscriptAndOutput = true
  // 숨은 native 창의 이전 paint를 캡처하지 않도록 실제 창 크기 변경 후 기다린다.
  win.setSize(1281, 900)
  await delay(200)
  win.setSize(1280, 900)
  await delay(600)
  fs.writeFileSync(path.join(root, 'work-reopened.png'), (await win.webContents.capturePage()).toPNG())
  fs.writeFileSync(path.join(root, 'loaded-session.json'), JSON.stringify(loaded, null, 2))
  if (!compare) return

  await js(`window.__compare=[]; window.orca.chat.onEvent(event=>window.__compare.push({at:Date.now(),event})); true`)
  const requests = [
    { sessionId: firstRun.sessionId, projectId: null, agentKind: 'work', text: '방금 작성한 가상 회의 메모의 결정과 담당자를 한 문장으로 요약해 주세요. 새 파일 생성이나 게시는 하지 마세요.' },
    { sessionId: null, projectId: null, agentKind: 'coding', clientKey: `coding-test-${randomUUID()}`, text: '합성 Coding 확인: JavaScript 표현식 2 + 3의 결과를 숫자만 답하세요. 파일과 도구는 사용하지 마세요.' }
  ]
  await js(`window.__compareDone=false; window.__compareFailure=null; Promise.all(${JSON.stringify(requests)}.map(request=>window.orca.chat.send(request))).then(()=>window.__compareDone=true).catch(error=>window.__compareFailure=error.message); true`)
  await until(() => js('window.__compareDone || window.__compareFailure'), 120000)
  assert.equal(await js('window.__compareFailure'), null)
  const events = await js('window.__compare')
  assert.equal(events.filter(item => item.event.type === 'error').length, 0)
  const codingId = events.find(item => item.event.type === 'session.updated' && item.event.sessionId !== firstRun.sessionId)?.event.sessionId
  assert.ok(codingId)
  const coding = await js(`window.orca.session.load(${JSON.stringify(codingId)})`)
  assert.equal(coding.agentKind, 'coding')
  const work = await js(`window.orca.session.load(${sid})`)
  assert.equal(work.agentKind, 'work')
  assert.equal(coding.messages.flatMap(message=>message.parts).some(part=>part.type === 'response_boundary'), false)
  assert.ok(coding.messages.some(message=>message.role === 'assistant' && message.parts.some(part=>part.type === 'text' && part.text.includes('5'))))
  const live = new Set()
  let overlap = false
  for (const { event } of events) {
    if (event.type !== 'chat.activity') continue
    if (event.foreground === 'idle') live.delete(event.sessionId)
    else live.add(event.sessionId)
    if (live.has(firstRun.sessionId) && live.has(codingId)) overlap = true
  }
  assert.equal(overlap, true)
  assert.deepEqual(await js(`window.orca.artifacts.list({sessionId:${sid}})`), artifacts)
  report.checks.concurrentCodingAndWork = true
  report.compareResult = { codingId, overlap, events: events.map(({at,event})=>({at,type:event.type,sessionId:event.sessionId,...(event.type === 'chat.activity' ? {foreground:event.foreground} : {})})), usage: events.filter(item=>item.event.type==='telemetry').map(item=>item.event.usage) }
}
run().catch(async error => {
  report.errors.push(error.message)
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    fs.writeFileSync(path.join(root, 'reopen-failure.png'), (await win.webContents.capturePage()).toPNG())
  }
}).finally(() => {
  report.finishedAt = new Date().toISOString()
  const output = path.join(root, compare ? 'compare-report.json' : 'reopen-report.json')
  fs.writeFileSync(output, JSON.stringify(report, null, 2))
  process.stdout.write(JSON.stringify({output,checks:report.checks,errors:report.errors})+'\n')
  app.exit(report.errors.length ? 1 : 0)
})

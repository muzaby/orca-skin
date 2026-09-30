import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  utilityProcess,
  type NativeImage,
  type UtilityProcess
} from 'electron'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { registerMailArchiveHandlers } from '../../src/main/app/handlers/mail-archive'
import { registerMailArchivePluginHandlers } from '../../src/main/app/handlers/mail-archive-plugin'
import {
  createMailArchiveToolServer,
  initializeMailArchivePlugin
} from '../../src/main/features/plugins/mail-archive/plugin'
import { RuntimeToolRegistry } from '../../src/main/features/extensions/runtime-tool-registry'
import { ARCHIVE_MCP_TOOLS } from '../../src/shared/mail-archive-plugin'
import type { ArchiveEvidence } from '../../src/shared/mail-archive-plugin'
import { createMailArchiveWorkerFactory } from '../../src/main/features/plugins/mail-archive/worker-host'
import { createMailArchiveService } from '../../src/main/features/plugins/mail-archive/service'
import { archiveSourceId } from '../../src/main/features/plugins/mail-archive/identity'
import type { MailArchiveEmlBatchItem } from '../../src/main/features/plugins/mail-archive/types'
import { CHANNELS } from '../../src/shared/ipc'
import type { MailArchiveSearchRequest } from '../../src/shared/mail-archive'
import Database from 'better-sqlite3'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { adaptRuntimeTools } from '../../src/main/adapters/claude-runtime-tools'

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function main(): Promise<void> {
  app.on('window-all-closed', () => {})
  await app.whenReady()
  const probe = new Database(':memory:')
  probe.close()
  const root = await mkdtemp(join(tmpdir(), 'orca-mail-ui-'))
  const children = new Set<UtilityProcess>()
  let sourceForks = 0
  const production = createMailArchiveWorkerFactory({
    fork: (path, serviceName) => {
      const child = utilityProcess.fork(path, [], { serviceName, stdio: 'pipe' })
      if (serviceName.endsWith('Source')) sourceForks++
      children.add(child)
      child.on('exit', () => children.delete(child))
      child.stderr?.on('data', (data) => process.stderr.write(data))
      return child
    }
  })
  let holdBatch = false
  const batchEntered = deferred()
  const releaseBatch = deferred()
  const service = createMailArchiveService(root, {
    createIndex: (path) => {
      const index = production.createIndex(path)
      return new Proxy(index, {
        get(target, property) {
          if (property === 'upsertBatch')
            return async (input: Parameters<typeof index.upsertBatch>[0]) => {
              if (holdBatch) {
                holdBatch = false
                batchEntered.resolve()
                await releaseBatch.promise
              }
              return target.upsertBatch(input)
            }
          const value = Reflect.get(target, property)
          return typeof value === 'function' ? value.bind(target) : value
        }
      })
    },
    createSource: () => production.createSource()
  })
  async function preprocess(path: string): Promise<MailArchiveEmlBatchItem> {
    const source = production.createSource()
    const items: MailArchiveEmlBatchItem[] = []
    try {
      await source.run(
        {
          jobId: 'preprocess',
          epoch: 'preprocess',
          sourceKind: 'eml',
          sourceId: archiveSourceId('eml', path),
          sourcePath: path
        },
        {
          onReady: async () => ({ action: 'scan', revision: 1 }),
          onBatch: async (_revision, mails) => {
            for (const { sourceKind, sourceId, identityKey, ...item } of mails) {
              assert.equal(sourceKind, 'eml')
              assert.ok(sourceId)
              assert.ok(identityKey)
              items.push(item)
            }
          },
          onComplete: async (completion) => {
            assert.equal(completion.startFingerprint, completion.endFingerprint)
          }
        },
        new AbortController().signal
      )
      assert.equal(items.length, 1)
      return items[0]!
    } finally {
      source.close()
    }
  }
  const searches: MailArchiveSearchRequest[] = []
  let holdQuery: string | null = null
  const queryEntered = deferred()
  const releaseQuery = deferred()
  registerMailArchiveHandlers({
    ...service,
    search: async (request) => {
      const found = await service.search(request)
      searches.push(request)
      if (request.query === holdQuery) {
        holdQuery = null
        queryEntered.resolve()
        await releaseQuery.promise
      }
      return found
    }
  })
  // Unrelated app settings/provider discovery are fixture values; archive IPC is production.
  const settings = {
    theme: 'white',
    density: 'normal',
    sidebarCollapsed: false,
    sidebarWidth: 248,
    appFont: 'sans',
    uiLocale: 'ko',
    notifyOnComplete: false,
    spendingLimitUsd: 90
  }
  ipcMain.handle(CHANNELS.settingsGet, () => settings)
  ipcMain.handle(CHANNELS.settingsSet, (_event, patch) => Object.assign(settings, patch))
  ipcMain.handle(CHANNELS.agentList, () => [])
  ipcMain.handle(CHANNELS.providerState, () => ({ providers: [], bypass: false }))
  ipcMain.handle(CHANNELS.mcpList, () => [])
  ipcMain.handle(CHANNELS.skillsList, () => [])
  ipcMain.handle(CHANNELS.sessionList, () =>
    ['s1', 's2'].map((id) => ({
      id,
      title: `Saved ${id}`,
      updatedAt: 0,
      preview: null,
      projectId: null,
      cwd: null,
      pinnedAt: null,
      backend: 'claude',
      agentKind: 'code'
    }))
  )
  let picked: string[] = []
  let confirmRemoval = 1
  const exported = join(root, 'saved-attachment.txt')
  dialog.showOpenDialog = (async () => ({
    canceled: picked.length === 0,
    filePaths: picked
  })) as typeof dialog.showOpenDialog
  dialog.showMessageBox = (async () => ({
    response: confirmRemoval,
    checkboxChecked: false
  })) as typeof dialog.showMessageBox
  dialog.showSaveDialog = (async () => ({
    canceled: false,
    filePath: exported
  })) as typeof dialog.showSaveDialog
  const output = process.env.ORCA_MAIL_UI_OUTPUT!
  const screenshots = process.env.ORCA_MAIL_UI_SCREENSHOTS!
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      preload: join(output, 'preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: true,
      backgroundThrottling: false
    }
  })
  const runtimeTools = new RuntimeToolRegistry()
  const plugin = initializeMailArchivePlugin(
    service,
    (id) => ['s1', 's2'].includes(id),
    () => ['s1', 's2'],
    () => runtimeTools.snapshot().servers.has('orca_mail_archive')
  )
  await plugin.ready()
  let holdEvidence = false
  const evidenceEntered = deferred()
  const releaseEvidence = deferred()
  registerMailArchivePluginHandlers(
    {
      ...plugin,
      resolve: async (sessionId, id) => {
        const result = await plugin.resolve(sessionId, id)
        if (holdEvidence) {
          holdEvidence = false
          evidenceEntered.resolve()
          await releaseEvidence.promise
        }
        return result
      }
    },
    (event) => event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
  )
  let mcpClient: Client | undefined
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.error(`renderer: ${message}`)
  })
  let passed = 0
  function pass(label: string): void {
    console.log(`PASS ${++passed} ${label}`)
  }
  async function evaluate<T>(code: string): Promise<T> {
    return win.webContents.executeJavaScript(code, true)
  }
  async function waitFor(expression: string, label: string): Promise<void> {
    const end = Date.now() + 15_000
    while (Date.now() < end) {
      if (await evaluate<boolean>(expression)) return
      await delay(60)
    }
    throw new Error(`UI assertion timed out: ${label}`)
  }
  async function click(text: string, selector = 'button'): Promise<void> {
    await evaluate(
      `(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('Button missing: ' + ${JSON.stringify(text)}); button.click() })()`
    )
    await delay(40)
  }
  async function fill(label: string, value: string): Promise<void> {
    await evaluate(`(() => {
      const field = document.querySelector('input[aria-label=' + JSON.stringify(${JSON.stringify(label)}) + ']') ?? [...document.querySelectorAll('label')].find(l => l.querySelector('span')?.textContent === ${JSON.stringify(label)})?.querySelector('input');
      if (!field) throw new Error('Input missing: ' + ${JSON.stringify(label)});
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)});
      field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
    })()`)
    await delay(40)
  }
  const resultCount = `document.querySelector('main > div.flex.min-h-0')?.querySelector('section')?.querySelectorAll('button').length`
  async function results(count: number): Promise<void> {
    await waitFor(`${resultCount} === ${count}`, `${count} result rows`)
  }
  async function screenshot(name: string): Promise<void> {
    await evaluate(`(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    })()`)
    const painted = new Promise<NativeImage>((resolve) => {
      win.webContents.once('paint', (_event, _rectangle, frame) => resolve(frame))
    })
    win.webContents.invalidate()
    await writeFile(join(screenshots, `${name}.png`), (await painted).toPNG())
  }
  try {
    const folder = join(root, 'eml')
    await mkdir(folder)
    const plain =
      '현행 본문 😀\r\n> QUOTE_NEEDLE 이전 질문\r\ninline reply 유지\r\n-- \r\nEngineer\r\nEmail: qa@example.test\r\nPhone: +82 10 1234 5678\r\n'
    const snapshot =
      '현행 본문 😀\n> QUOTE_NEEDLE 이전 질문\ninline reply 유지\n-- \nEngineer\nEmail: qa@example.test\nPhone: +82 10 1234 5678'
    const mail = `From: QA Engineer <qa@example.test>\r\nTo: Receiver <team@example.test>\r\nCc: Reviewer <review@example.test>\r\nDate: Tue, 29 Sep 2026 12:00:00 +0900\r\nMessage-ID: <primary@example.test>\r\nSubject: UI primary\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="mixed"\r\n\r\n--mixed\r\nContent-Type: multipart/alternative; boundary="alt"\r\n\r\n--alt\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${plain}\r\n--alt\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<b>ALT_NEEDLE</b><script>window.pwned = true</script>\r\n--alt--\r\n--mixed\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="report.txt"\r\n\r\nATTACHMENT_BYTES\r\n--mixed--\r\n`
    const primary = join(folder, 'primary.eml')
    const secondary = join(folder, 'secondary.eml')
    await writeFile(primary, mail)
    await writeFile(
      secondary,
      'From: other@example.test\r\nTo: team@example.test\r\nMessage-ID: <secondary@example.test>\r\nSubject: UI secondary\r\n\r\nSECOND_ONLY'
    )
    await win.loadFile(join(output, 'renderer/mail-archive-ui.html'))
    await waitFor(`!!document.querySelector('main')`, 'actual page mounted')
    await results(0)
    await click('자료원 관리')
    await waitFor(
      `!![...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === 'PST 파일 추가')`,
      'actual settings slot renders management'
    )
    assert.equal(
      await evaluate(`document.querySelector('[role=dialog] [aria-current=page]')?.textContent`),
      '메일 보관함'
    )
    assert.equal(
      await evaluate(
        `!![...document.querySelectorAll('[role=dialog] button')].find(b => /EML/i.test(b.textContent))`
      ),
      false,
      'EML input GUI is absent'
    )
    assert.equal(
      await evaluate(
        `'pickEmlFolder' in window.orca.mailArchive || 'importEmlBatch' in window.orca.mailArchive`
      ),
      false,
      'internal EML input is not a renderer API'
    )
    const items = [await preprocess(primary), await preprocess(secondary)]
    await service.importEmlBatch(items, (progress) =>
      win.webContents.send(CHANNELS.mailArchiveProgress, progress)
    )
    await waitFor(
      `document.querySelector('[role=dialog]')?.textContent.includes('검색 가능한 메일 2개')`,
      'internal EML completion in settings'
    )
    await results(2)
    await screenshot('settings-white')
    pass(
      'PST-only settings, private normalized EML API, actual source/index workers and shared result refresh'
    )
    await click('보관함 열기')
    await waitFor(`!document.querySelector('[role=dialog]')`, 'settings navigation closes modal')
    await delay(150)
    const countBeforeTyping = searches.length
    await fill('메일 검색어', 'QUOTE_NEEDLE')
    await delay(150)
    assert.equal(searches.length, countBeforeTyping, 'typing does not execute searches')
    await click('검색')
    await results(1)
    await click('UI primary', 'main section button strong')
    // Strong is inside the real result button; click bubbles through React's handler.
    await waitFor(
      `document.querySelector('article h2')?.textContent === 'UI primary'`,
      'selected message'
    )
    assert.equal(
      await evaluate(
        `!![...document.querySelectorAll('article details')].find(d => d.querySelector('summary')?.textContent.includes('인용문') && d.open)`
      ),
      true
    )
    assert.equal(
      await evaluate(
        `!![...document.querySelectorAll('article details')].find(d => d.querySelector('summary')?.textContent.includes('서명') && !d.open)`
      ),
      true
    )
    await screenshot('body-white')
    await click('원문 전체 보기')
    assert.equal(
      await evaluate(`document.querySelector('article section pre')?.textContent`),
      snapshot
    )
    await click('대체 본문 보기')
    assert.equal(
      await evaluate(
        `document.querySelector('article section pre')?.textContent.includes('ALT_NEEDLE')`
      ),
      true
    )
    assert.equal(
      await evaluate(
        `!!document.querySelector('article b, article script') || window.pwned === true`
      ),
      false
    )
    await click('원문 전체 보기')
    assert.equal(
      await evaluate(`document.querySelector('article section pre')?.textContent`),
      snapshot
    )
    await click('구간 접어 보기')
    pass(
      'UTF-16 segment roundtrip, hit auto-expansion, conservative folding and full/alternative inert text'
    )
    await click('첨부 저장')
    await waitFor(
      `document.querySelector('main')?.textContent.includes('report.txt을(를) 저장했습니다.')`,
      'attachment save receipt'
    )
    assert.equal((await readFile(exported, 'utf8')).trim(), 'ATTACHMENT_BYTES')
    pass('real attachment picker IPC, source worker extraction and saved bytes')
    await click('검색 필터', 'summary')
    await fill('보낸 사람', 'qa@example')
    await fill('받는 사람', 'team@example')
    await fill('참조', 'review@example')
    await fill('첨부 이름', 'report.txt')
    await fill('시작일', '2026-09-29')
    await fill('종료일', '2026-09-29')
    await click('검색')
    await results(1)
    const applied = searches.at(-1)!
    assert.equal(applied.from, 'qa@example')
    assert.equal(applied.to, 'team@example')
    assert.equal(applied.cc, 'review@example')
    assert.equal(applied.attachmentName, 'report.txt')
    assert.equal(applied.sentBefore! - applied.sentAfter!, 86_400_000)
    await fill('시작일', '2026-09-30')
    const beforeInvalid = searches.length
    await click('검색')
    assert.equal(searches.length, beforeInvalid)
    assert.equal(
      await evaluate(
        `document.querySelector('main [role=alert]')?.textContent.includes('종료일은 시작일보다 빠를 수 없습니다.')`
      ),
      true
    )
    await results(1)
    pass(
      'field and inclusive local-day filters across UI/schema/SQL, reversed dates preserve results'
    )
    for (const field of ['보낸 사람', '받는 사람', '참조', '첨부 이름', '시작일', '종료일'])
      await fill(field, '')
    await fill('메일 검색어', '')
    await click('검색')
    await results(2)
    const copy = join(root, 'copy.eml')
    await writeFile(copy, mail)
    const copyItem = await preprocess(copy)
    holdBatch = true
    await click('자료원 관리')
    const copying = service.importEmlBatch([copyItem], (progress) =>
      win.webContents.send(CHANNELS.mailArchiveProgress, progress)
    )
    await batchEntered.promise
    await waitFor(
      `document.querySelector('[role=dialog]')?.textContent.includes('처리')`,
      'actual in-progress status'
    )
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
    await waitFor(`!document.querySelector('[role=dialog]')`, 'close settings during import')
    assert.equal((await service.stats()).progress?.state, 'running')
    releaseBatch.resolve()
    await copying
    await waitFor(
      `document.querySelector('select[aria-label="자료원"]')?.options.length === 6`,
      'completion shared after modal close'
    )
    await click('자료원 관리')
    confirmRemoval = 0
    await click('자료원 제거', '[aria-label="primary.eml 자료원 제거"]')
    assert.equal((await service.sources()).length, 3)
    confirmRemoval = 1
    await click('자료원 제거', '[aria-label="primary.eml 자료원 제거"]')
    await waitFor(
      `document.querySelector('[role=dialog]')?.textContent.includes('공유 메일 1개 유지')`,
      'shared source removal receipt'
    )
    await click('보관함 열기')
    await results(2)
    await waitFor(
      `document.querySelector('article dl')?.textContent.includes('copy.eml')`,
      'surviving detail source refreshed'
    )
    assert.equal(await readFile(primary, 'utf8'), mail)
    pass(
      'import survives settings close, removal cancellation, shared-mail preservation and refreshed detail'
    )
    holdQuery = 'QUOTE_NEEDLE'
    await fill('메일 검색어', holdQuery)
    await click('검색')
    await queryEntered.promise
    await fill('메일 검색어', 'SECOND_ONLY')
    // Submit through Chromium's implicit form submission.
    await evaluate(`document.querySelector('input[aria-label="메일 검색어"]').focus()`)
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
    win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
    await results(1)
    await waitFor(
      `document.querySelector('main section strong')?.textContent === 'UI secondary'`,
      'newer search completes first'
    )
    releaseQuery.resolve()
    await delay(120)
    assert.equal(
      await evaluate(`document.querySelector('main section strong')?.textContent`),
      'UI secondary'
    )
    pass('Enter-only submit and reversed IPC responses cannot replace newer search results')
    picked = [join(root, 'missing.pst')]
    await click('자료원 관리')
    await click('PST 파일 추가')
    await waitFor(
      `document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('원본 파일에 접근할 수 없습니다.')`,
      'translated import error'
    )
    assert.equal(
      await evaluate(
        `document.querySelector('[role=dialog] [role=alert]')?.textContent.includes(${JSON.stringify(root)})`
      ),
      false
    )
    picked = []
    await click('다시 확인')
    await waitFor(
      `!document.querySelector('[role=dialog] [role=alert]')`,
      'retry clears stale error'
    )
    await click('PST 파일 추가')
    assert.equal((await service.sources()).length, 2)
    pass('translated failure/retry and picker cancellation preserve verified source state')
    await screenshot('settings-error-recovered-white')
    await click('보관함 열기')
    await fill('메일 검색어', 'QUOTE_NEEDLE')
    await click('검색')
    await results(1)
    await click('UI primary', 'main section button strong')
    await waitFor(
      `document.querySelector('article h2')?.textContent === 'UI primary'`,
      'primary reopened'
    )
    await evaluate(`document.documentElement.dataset.theme = 'dark'`)
    await screenshot('body-dark')
    win.setSize(640, 900)
    await screenshot('body-dark-narrow')
    await click('자료원 관리')
    await screenshot('settings-dark-narrow')
    await click('보관함 열기')
    await fill('메일 검색어', 'draft-not-submitted')
    await click('자료원 관리')
    await click('자료원 제거', '[aria-label="copy.eml 자료원 제거"]')
    await waitFor(
      `document.querySelector('[role=dialog]')?.textContent.includes('공유 메일 0개 유지')`,
      'last-source removal receipt'
    )
    await click('보관함 열기')
    await results(0)
    await waitFor(`!document.querySelector('article')`, 'removed selection cleared')
    assert.equal(searches.at(-1)?.query, 'QUOTE_NEEDLE', 'source changes use applied conditions')
    assert.equal(
      await evaluate(`document.querySelector('input[aria-label="메일 검색어"]')?.value`),
      'draft-not-submitted'
    )
    assert.equal((await stat(copy)).isFile(), true)
    pass(
      'applied query survives source removal, unsubmitted draft retained and removed detail cleared'
    )
    win.setSize(1280, 900)
    await fill('메일 검색어', '')
    await click('검색')
    await results(1)
    picked = [resolve('node_modules/pst-extractor/example/testdata/enron.pst')]
    await click('자료원 관리')
    await click('PST 파일 추가')
    await waitFor(
      `document.querySelector('[role=dialog]')?.textContent.includes('새 저장 71개')`,
      'PST file registration completes'
    )
    assert.equal((await service.stats()).pstMessages, 71)
    await click('보관함 열기')
    await results(50)
    assert.equal(
      await evaluate(
        `!![...document.querySelectorAll('select[aria-label="자료원"] option')].find(o => o.textContent.startsWith('enron.pst'))`
      ),
      true
    )
    pass(
      'PST file picker registration, worker normalization/segments, searchable completion and archive navigation'
    )
    await click('플러그인 검사', 'a')
    await click('MCP')
    await waitFor(
      `!!document.querySelector('[data-mail-archive-plugin]') && !document.querySelector('[data-mail-archive-plugin]')?.textContent.includes('불러오는')`,
      'plugin mounted'
    )
    await waitFor(
      `document.querySelector('[data-mail-archive-plugin]')?.textContent.includes('AI 도구가 활성화되지')`,
      'default build is unregistered'
    )
    assert.equal(runtimeTools.snapshot().servers.size, 0)
    // This is the user's deployment role, not automatic registration in Bootstrap.
    const server = createMailArchiveToolServer()
    runtimeTools.add(server)
    await click('다시 확인')
    await waitFor(
      `document.querySelector('[data-mail-archive-plugin]')?.textContent.includes('메일 검색 도구를 사용할')`,
      'registered state'
    )
    await evaluate(
      `(() => {const label=[...document.querySelectorAll('[data-mail-archive-plugin] label')].find(l=>l.textContent.includes('enron.pst'));label.querySelector('input[type=checkbox]').click()})()`
    )
    await click('이 대화에 허용 저장')
    await waitFor(
      `document.querySelector('[data-mail-archive-plugin]')?.textContent.includes('허용 범위를 저장')`,
      'scope saved via real IPC'
    )
    pass('Plugin MCP slot, inactive default, caller registration, real session/source scope IPC')
    await screenshot('mcp-plugin-card')
    const context = {
      cwd: root,
      extraDirs: [],
      getSignal: () => new AbortController().signal,
      waitForSession: async () => 's1'
    }
    const beforeForks = sourceForks
    const adapted = adaptRuntimeTools(runtimeTools.snapshot(), context) as {
      mcpServers: Record<string, { instance: { connect(transport: unknown): Promise<void> } }>
    }
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await adapted.mcpServers.orca_mail_archive.instance.connect(serverTransport)
    mcpClient = new Client({ name: 'archive-ui-fixture', version: '1' })
    await mcpClient.connect(clientTransport)
    const listed = (await mcpClient.listTools()).tools
    assert.deepEqual(
      listed.map((tool) => tool.name),
      [...ARCHIVE_MCP_TOOLS]
    )
    assert.ok(listed.every((tool) => tool.annotations?.readOnlyHint === true))
    const found = await mcpClient.callTool({
      name: 'archive_search',
      arguments: { query: '', limit: 20 }
    })
    assert.equal(found.isError, undefined)
    const mailIds = (
      (found.structuredContent as Record<string, unknown>).mails as { id: string }[]
    ).map((mail) => mail.id)
    assert.ok(mailIds.length > 0)
    const forbiddenId = (await service.search({ query: 'SECOND_ONLY' }))[0]!.id
    assert.equal(
      (await mcpClient.callTool({ name: 'archive_thread', arguments: { id: forbiddenId } }))
        .isError,
      true
    )
    const result = await mcpClient.callTool({ name: 'archive_get', arguments: { id: mailIds[0] } })
    assert.equal(result.isError, undefined)
    assert.deepEqual(result.content, [
      { type: 'text', text: JSON.stringify(result.structuredContent) }
    ])
    const evidence = (
      (result.structuredContent as Record<string, unknown>).evidence as ArchiveEvidence[]
    )[0]!
    assert.ok(evidence)
    assert.equal(sourceForks, beforeForks, 'MCP reads the index without reopening source files')
    assert.equal((await plugin.resolve('s2', evidence.id)).state, 'forbidden')
    await evaluate(`window.postMessage({type:'evidence',id:${JSON.stringify(evidence.id)}},'*')`)
    for (const label of ['완료 근거', '진행 근거']) {
      await waitFor(
        `!![...document.querySelectorAll('a')].find(a=>a.textContent===${JSON.stringify(label)})`,
        'citation link'
      )
      await evaluate(
        `(() => {const link=[...document.querySelectorAll('a')].find(a=>a.textContent===${JSON.stringify(label)});link.focus();link.click()})()`
      )
      await waitFor(
        `!!document.querySelector('[data-mail-archive-evidence] mark')`,
        'evidence viewer'
      )
      assert.equal(
        await evaluate(`document.querySelector('[data-mail-archive-evidence] mark')?.textContent`),
        evidence.text
      )
      assert.equal(await evaluate(`document.activeElement?.textContent`), '닫기')
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' })
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' })
      assert.equal(await evaluate(`document.activeElement?.textContent`), '닫기')
      await screenshot(label === '완료 근거' ? 'mcp-evidence-completed' : 'mcp-evidence-streaming')
      if (label === '완료 근거') {
        await evaluate(`document.documentElement.dataset.theme = 'white'`)
        win.setSize(640, 900)
        await waitFor(`window.innerWidth <= 640`, 'narrow evidence viewport')
        await delay(180)
        await screenshot('mcp-evidence-white-narrow')
        await evaluate(`document.documentElement.dataset.theme = 'dark'`)
        await delay(180)
        await screenshot('mcp-evidence-dark-narrow')
        win.setSize(1280, 900)
      }
      await click('닫기')
      await waitFor(
        `document.activeElement?.textContent===${JSON.stringify(label)}`,
        'focus restored to citation'
      )
    }
    holdEvidence = true
    await click('완료 근거', 'a')
    await evidenceEntered.promise
    await waitFor(
      `document.querySelector('[data-mail-archive-evidence]')?.textContent.includes('불러오는')`,
      'evidence request is still pending'
    )
    await evaluate(`window.postMessage({type:'session',id:'s2'},'*')`)
    await waitFor(
      `!document.querySelector('[data-mail-archive-evidence]')`,
      'session switch closes viewer'
    )
    releaseEvidence.resolve()
    await delay(120)
    assert.equal(await evaluate(`!!document.querySelector('[data-mail-archive-evidence]')`), false)
    await click('완료 근거', 'a')
    await waitFor(
      `document.querySelector('[data-mail-archive-evidence]')?.textContent.includes('현재 대화에서 이 근거를 열 수 없습니다')`,
      'new session cannot open previous evidence'
    )
    await click('닫기')
    await evaluate(`window.postMessage({type:'session',id:'s1'},'*')`)
    await delay(120)
    assert.equal(await evaluate(`!!document.querySelector('[data-mail-archive-evidence]')`), false)
    pass('session switch discards delayed evidence and denies cross-session citation')
    await click('허용 해제')
    await waitFor(
      `document.querySelector('[data-mail-archive-plugin]')?.textContent.includes('허용을 해제')`,
      'scope revoked'
    )
    assert.equal(
      (await mcpClient.callTool({ name: 'archive_search', arguments: { query: '' } })).isError,
      true
    )
    await click('완료 근거', 'a')
    await waitFor(
      `document.querySelector('[data-mail-archive-evidence]')?.textContent.includes('현재 대화에서 이 근거를 열 수 없습니다')`,
      'revoked citation denied'
    )
    await click('닫기')
    pass(
      'real worker tool read, persisted evidence, completed/streaming clicks, exact highlight/focus, revoked denial'
    )
    console.log(`MAIL_ARCHIVE_UI ${passed}/${passed}; screenshots: ${screenshots}`)
  } finally {
    await mcpClient?.close()
    plugin.close()
    releaseEvidence.resolve()
    releaseBatch.resolve()
    releaseQuery.resolve()
    const exits = [...children].map((child) => once(child, 'exit'))
    service.close()
    for (const child of children) child.kill()
    await Promise.all(exits)
    await rm(root, { recursive: true, force: true })
    win.destroy()
  }
}

void main()
  .then(() => app.exit(0))
  .catch((error: unknown) => {
    console.error(error)
    app.exit(1)
  })

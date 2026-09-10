import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from '@source/renderer/src/app/Sidebar'
import { useArtifactCatalogViewer } from '@source/renderer/src/app/hooks/useArtifactCatalogViewer'
import { ArtifactsPage } from '@source/renderer/src/pages/ArtifactsPage'
import { TweakProvider } from '@source/renderer/src/shared/theme'
import { ConfirmDialogHost } from '@source/renderer/src/shared/ui/ConfirmDialogHost'
import { useArtifactViewerStore, openArtifactViewer, closeArtifactViewer } from '@source/renderer/src/features/chat/store/artifactViewerStore'
import { ChatTile } from '@source/renderer/src/features/chat/components/ChatTile'
import { initialChatState } from '@source/renderer/src/features/chat/reducer/chatReducer'
import { useChatStore } from '@source/renderer/src/features/chat/store/chatStore'
import { SettingsSchema } from '@source/shared/protocol'
import { htmlSource } from './native-data.mjs'

const report = { checks: {}, errors: [], calls: [], boundary: 'Actual production Sidebar, ArtifactsPage, ArtifactsView, catalog store, app useArtifactCatalogViewer, ArtifactViewer and confirmation dialog; synthetic IPC catalog/pin/trash/preview/save responses.' }
window.nativeReport = report
window.addEventListener('error', event => report.errors.push(String(event.error?.stack || event.message)))
window.addEventListener('unhandledrejection', event => report.errors.push(String(event.reason)))
const tick = () => new Promise(resolve => setTimeout(resolve, 180))
const check = (name, value) => { report.checks[name] = !!value; if (!value) throw new Error(name) }
const find = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
const click = async element => {
  if (!element) throw new Error('Missing native click target')
  element.focus()
  flushSync(() => element.click())
  await tick()
}
const key = async (element, name) => {
  element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
  await tick()
}
const nav = label => all('nav button').find(button => button.textContent.trim() === label)
const action = name => find('[data-behavior="viewer:' + name + '"]')
const row = id => find('[data-artifact-catalog-row="' + id + '"]')
const open = id => find('[data-artifact-catalog-open="' + id + '"]')
const menu = id => find('[data-artifact-catalog-menu="' + id + '"]')
const menuAction = label => all('[role="menuitem"]').find(button => button.textContent.trim() === label)
const tab = name => find('[data-catalog-tab="' + name + '"]')
const list = () => find('[data-artifact-catalog-list]')
const visibleRows = () => all('[data-artifact-catalog-row]').map(node => node.dataset.artifactCatalogRow)

const titles = [
  ['markdown', 'sensor-validation.md', '센서 검증 결과 보고서', '센서 성능 검증'],
  ['html', 'inspection-dashboard.html', '검증 결과 대시보드', '출력 형식 분석'],
  ['text', 'test-plan.ts', '자동 검증 스크립트', '반복 검증 자동화'],
  ['image', 'signal-flow.svg', '신호 흐름 다이어그램', '센서 성능 검증'],
  ['markdown', 'acceptance-checklist.md', '인수 테스트 체크리스트', '릴리스 준비'],
  ['markdown', 'weekly-review.md', '이번 주 검토 메모', '센서 성능 검증'],
  ['html', 'coverage.html', '검증 범위 요약', '출력 형식 분석'],
  ['markdown', 'measurement-notes.md', '측정 환경 기록', '실험 환경 구성'],
  ['text', 'analysis.py', '결과 분석 코드', '반복 검증 자동화'],
  ['markdown', 'release-notes.md', '릴리스 검토 기록', '릴리스 준비'],
  ['markdown', 'edge-cases.md', '예외 조건 검토', '센서 성능 검증'],
  ['markdown', 'next-steps.md', '후속 작업 정리', '릴리스 준비']
]
const refs = titles.map(([kind, filename, title, sessionTitle], index) => ({
  publicationId: 'p' + index, artifactFileId: 'f' + index, sessionId: index % 2 ? 'session-b' : 'session-a',
  title, filename, kind, category: 'artifact', sessionTitle, pinned: index === 1 || index === 4,
  publishedAt: 1788990000000 - index * 86400000, sizeBytes: 200
}))
const ordinary = [
  { ...refs[0], publicationId: 'ordinary-pdf', artifactFileId: 'ordinary-pdf', title: '검증 발표자료', filename: 'validation.pptx', category: 'file', kind: 'file' },
  { ...refs[0], publicationId: 'ordinary-text', artifactFileId: 'ordinary-text', title: '검토 노트', filename: 'notes.md', category: 'file', kind: 'markdown' }
]
let saved = [...refs, ...ordinary]
let delayed = null
let failPin = false
let failSave = false
const markdown = '# 센서 검증 결과 보고서\n\n모든 센서가 정상 범위에 있습니다.\n\n| 검증 항목 | 결과 |\n| --- | --- |\n| 신호 품질 | 통과 |\n| 색 정확도 | 통과 |\n| 응답 시간 | 통과 |\n\n## 검토 메모\n\n다음 단계의 인수 테스트를 진행할 수 있습니다.\n'
const previews = {
  markdown: { state: 'ready', format: 'markdown', mimeType: 'text/markdown', content: markdown, language: 'markdown' },
  html: { ...window.nativeHtmlPreview, content: htmlSource },
  text: { state: 'ready', format: 'text', mimeType: 'text/plain', content: Array.from({ length: 70 }, (_, i) => 'const measurement' + (i + 1) + ' = { sensor: "A", passed: true };').join('\n'), language: 'typescript' },
  image: { state: 'ready', format: 'image', mimeType: 'image/svg+xml', content: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="440" height="220"><rect width="440" height="220" rx="16" fill="#edf5f3"/><circle cx="100" cy="110" r="45" fill="#0c7c73"/><path d="M160 110H270" stroke="#0c7c73" stroke-width="4"/><rect x="280" y="60" width="110" height="100" rx="12" fill="#99cbbc"/></svg>') }
}
window.orca = {
  platform: 'win32',
  settings: {
    get: async () => SettingsSchema.parse({ theme: 'white', notifyOnComplete: false }),
    set: async () => undefined
  },
  artifacts: {
    list: async () => [...refs, ...ordinary],
    status: async ({ publicationIds }) => publicationIds.map(publicationId => ({ publicationId, artifactFileId: [...refs, ...ordinary].find(item => item.publicationId === publicationId).artifactFileId, availability: { state: 'present', sizeBytes: 200, modifiedAt: 1788990000000 } })),
    catalog: async () => { report.calls.push(['catalog']); return saved.filter(item => item.category !== 'file').map(item => ({ ...item })) },
    setPinned: async req => {
      report.calls.push(['pin', req])
      if (failPin) { failPin = false; return { ok: false, reason: 'io-error' } }
      saved = saved.map(item => item.publicationId === req.publicationId ? { ...item, pinned: req.pinned } : item)
      return { ok: true }
    },
    trash: async req => { report.calls.push(['trash', req]); saved = saved.filter(item => item.publicationId !== req.publicationId); return { outcome: 'trashed', deletionRecorded: true } },
    preview: async req => {
      report.calls.push(['preview', req])
      if (delayed) return new Promise(resolve => { delayed.resolve = resolve })
      return previews[[...refs, ...ordinary].find(item => item.publicationId === req.publicationId).kind] || { state: 'unavailable', reason: 'unsupported-format' }
    },
    save: async req => { report.calls.push(['save', req]); const failure = failSave; failSave = false; return { outcome: 'completed', items: req.publicationIds.map(publicationId => ({ publicationId, outcome: failure ? 'failed' : 'saved', ...(failure ? { reason: 'forbidden' } : {}) })) } },
    reveal: async req => { report.calls.push(['reveal', req]); return { ok: true } }, openFolder: async () => ({ ok: true })
  },
  agent: { list: async () => [] }, provider: { onState: () => () => {} },
  skills: { list: async () => [] },
  git: { status: async () => ({ isRepo: false, branch: null, dirty: false, ahead: 0, behind: 0 }) },
  files: { pickDirectory: async () => null, openPath: async () => ({ ok: true }) },
  session: { addDirectory: async () => ({ ok: true, extraDirs: [] }) },
  chat: { onEvent: () => () => {} }, permission: { respond: async () => {} }
}

function Shell() {
  const props = useArtifactCatalogViewer()
  const location = useLocation()
  window.nativeNavigate = useNavigate()
  return <div className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg [font-family:var(--font-app)] text-[13px] leading-[1.45] text-ink">
    <div className="flex h-10 shrink-0 items-center border-b border-border px-4 text-caption text-ink3">Orca</div>
    <div className="flex min-h-0 flex-1">
      <Sidebar projectsSlot={null} pinnedSlot={null} sessionsSlot={null} footerSlot={null} onOpenPlugins={() => undefined} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col" data-native-route={location.pathname}>
        <Routes>
          <Route path="/artifacts" element={<ArtifactsPage {...props} />} />
          <Route path="/chat" element={<ChatTile backendLabel="Claude" canAbort initialDraft="아직 보내지 않은 검토 메모" />} />
          <Route path="*" element={<div className="p-8 text-ink3">아티팩트 메뉴에서 결과를 확인하세요.</div>} />
        </Routes>
      </main>
    </div>
    <ConfirmDialogHost />
  </div>
}
const root = createRoot(document.getElementById('root'))
window.nativeMount = async () => {
  flushSync(() => root.render(<MemoryRouter initialEntries={['/new']}><TweakProvider><Shell /></TweakProvider></MemoryRouter>))
  await tick()
  await click(nav('아티팩트'))
  check('nav-opens-artifacts-route', find('[data-native-route]').dataset.nativeRoute === '/artifacts')
  check('nav-active-page', nav('아티팩트').getAttribute('aria-current') === 'page')
  check('title-and-two-tabs', find('[data-artifact-catalog] h1').textContent === '아티팩트12' && all('[role="tab"]').length === 2 && tab('all').textContent === '전체' && tab('pinned').textContent === '고정됨')
  check('initial-total-count', find('[data-artifact-catalog-count]').textContent === '12')
  check('ordinary-files-excluded', !row('ordinary-pdf') && !row('ordinary-text') && visibleRows().length === refs.length)
  check('vertical-list-without-thumbnails', all('[data-artifact-catalog-row] img').length === 0 && row('p1').getBoundingClientRect().top > row('p0').getBoundingClientRect().top)
  check('only-requested-toolbar-controls', !/새 아티팩트|공유됨|내 것/.test(find('[data-artifact-catalog-list]').textContent))
  check('catalog-css-container-loaded', getComputedStyle(list()).containerName === 'catalog')
  report.font = { appVariable: document.documentElement.style.getPropertyValue('--font-app'), body: getComputedStyle(document.body).fontFamily, app: getComputedStyle(find('.app-frame-root')).fontFamily }
  check('production-app-font-default', report.font.appVariable === 'var(--font-sans)' && report.font.app.includes('Segoe UI') && !report.font.app.includes('Times New Roman'))
  return report
}
window.nativePinned = async () => {
  await click(tab('pinned'))
  check('pinned-tab-filters', visibleRows().join(',') === 'p1,p4')
  check('pinned-preserves-total-count', find('[data-artifact-catalog-count]').textContent === '12')
  return report
}
window.nativeSearch = async () => {
  await click(tab('all'))
  await click(find('[data-behavior="catalog:search-toggle"]'))
  const input = find('[data-artifact-catalog-search]')
  check('search-toggle-focuses-input', input && document.activeElement === input)
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '  SENSOR-VALIDATION.MD  ')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await tick()
  check('search-filters-real-rows', visibleRows().join(',') === 'p0')
  check('search-preserves-total-count', find('[data-artifact-catalog-count]').textContent === '12')
  return report
}
window.nativeSearchEmpty = async () => {
  const input = find('[data-artifact-catalog-search]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'no matching artifact')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await tick()
  check('search-empty-feedback', visibleRows().length === 0 && find('[role="tabpanel"]').textContent.includes('검색 결과가 없습니다'))
  await key(input, 'Escape')
  check('search-escape-restores-all', !find('[data-artifact-catalog-search]') && visibleRows().length === refs.length)
  return report
}
window.nativeMenu = async () => {
  await click(menu('p0'))
  check('menu-only-pin-delete', all('[role="menuitem"]').map(node => node.textContent.trim()).join(',') === '고정,삭제')
  report.menuFocus = { active: document.activeElement?.outerHTML, visible: getComputedStyle(find('[role="menu"]')).visibility }
  check('menu-keyboard-focus', document.activeElement === menuAction('고정'))
  return report
}
window.nativePin = async () => {
  await click(menuAction('고정'))
  check('pin-exact-request', report.calls.some(([kind, req]) => kind === 'pin' && req.publicationId === 'p0' && req.sessionId === 'session-a' && req.pinned))
  await click(tab('pinned'))
  check('newly-pinned-visible', visibleRows().join(',') === 'p0,p1,p4')
  await click(nav('새 대화'))
  await click(nav('아티팩트'))
  await click(tab('pinned'))
  check('pinned-state-after-reload', visibleRows().join(',') === 'p0,p1,p4')
  await click(menu('p0'))
  check('menu-offers-unpin', !!menuAction('고정 해제'))
  await click(menuAction('고정 해제'))
  check('unpin-removes-from-pinned', visibleRows().join(',') === 'p1,p4')
  return report
}
window.nativePinFailure = async () => {
  await click(tab('all'))
  failPin = true
  await click(menu('p0'))
  await click(menuAction('고정'))
  check('pin-failure-visible', find('[role="alert"]')?.textContent.includes('고정 상태를 변경하지 못했습니다'))
  await click(tab('pinned'))
  check('pin-failure-preserves-state', visibleRows().join(',') === 'p1,p4')
  await click(nav('새 대화'))
  await click(nav('아티팩트'))
  return report
}
window.nativePreview = async () => {
  window.nativeOrigin = open('p0')
  await click(window.nativeOrigin)
  list().scrollTop = 180
  window.nativeScroll = list().scrollTop
  check('viewer-in-gallery-route', !!find('[data-artifact-catalog-viewer]') && find('[data-native-route]').dataset.nativeRoute === '/artifacts')
  check('viewer-uses-app-key', useArtifactViewerStore.getState().selection.sessionKey === 'artifact-catalog:session-a')
  check('markdown-rendered', find('[data-artifact-viewer-body] h1')?.textContent === '센서 검증 결과 보고서')
  check('preview-identity', report.calls.some(([kind, req]) => kind === 'preview' && req.sessionId === 'session-a' && req.publicationId === 'p0'))
  return report
}
window.nativeExpand = async () => {
  const previous = list()
  const width = find('[data-artifact-viewer]').getBoundingClientRect().width
  await click(action('expand'))
  check('expanded-list-preserved-inert', list() === previous && list().inert)
  check('viewer-expands', find('[data-artifact-viewer]').getBoundingClientRect().width > width)
  assertExpanded('catalog')
  return report
}
window.nativeDownload = async () => {
  await click(action('download'))
  check('download-exact-publication', report.calls.some(([kind, req]) => kind === 'save' && req.sessionId === 'session-a' && req.publicationIds.join(',') === 'p0'))
  check('download-success-feedback', find('[data-artifact-viewer] [role="status"]')?.textContent.includes('저장됨'))
  await click(action('expand'))
  await click(action('close'))
  check('viewer-close-restores-list-focus', !find('[data-artifact-viewer]') && !list().hidden && document.activeElement === window.nativeOrigin)
  check('viewer-close-preserves-scroll', list().scrollTop === window.nativeScroll)
  list().scrollTop = 0
  return report
}
window.nativeHtml = async () => {
  await click(open('p1'))
  check('html-sandbox', find('iframe')?.getAttribute('sandbox') === '')
  check('html-preview-source-sanitized', !find('iframe').srcdoc.includes('<script>') && find('iframe').srcdoc.includes('class="report"'))
  check('html-script-not-executed', !window.__unsafeExecuted)
  return report
}
window.nativeImage = async () => {
  await click(action('close'))
  await click(open('p3'))
  await tick()
  check('image-only-in-viewer', all('[data-artifact-catalog-row] img').length === 0 && find('[data-artifact-viewer-body] img')?.naturalWidth === 440)
  return report
}
window.nativeCode = async () => {
  await click(action('close'))
  await click(open('p2'))
  await tick()
  check('code-source-visible', find('[data-artifact-viewer-body]').textContent.includes('measurement70'))
  const scrollable = find('[data-artifact-viewer-body]')
  scrollable.scrollTop = scrollable.scrollHeight
  check('code-bounded-inner-scroll', scrollable.scrollTop > 0 && scrollable.clientHeight < scrollable.scrollHeight)
  scrollable.scrollTop = 0
  return report
}
window.nativeDelete = async () => {
  await click(action('close'))
  await click(open('p4'))
  await click(menu('p4'))
  await click(menuAction('삭제'))
  check('delete-confirms-trash-meaning', find('[role="dialog"]')?.textContent.includes('휴지통'))
  return report
}
window.nativeConfirmDelete = async () => {
  await click(all('[role="dialog"] button').find(button => button.textContent.trim() === '삭제'))
  check('delete-exact-target', report.calls.some(([kind, req]) => kind === 'trash' && req.sessionId === 'session-a' && req.publicationId === 'p4'))
  check('delete-removes-row-and-selected-viewer', !row('p4') && !find('[data-artifact-viewer]'))
  check('delete-updates-total-count', find('[data-artifact-catalog-count]').textContent === '11')
  await click(nav('새 대화'))
  await click(nav('아티팩트'))
  check('delete-persists-after-reload', !row('p4'))
  return report
}
window.nativeLateRoute = async () => {
  delayed = {}
  await click(open('p0'))
  const pending = delayed
  await click(nav('새 대화'))
  delayed = null
  pending.resolve(previews.markdown)
  await tick()
  check('route-exit-clears-pending-selection', useArtifactViewerStore.getState().selection === null)
  await click(nav('아티팩트'))
  check('late-response-does-not-reopen-viewer', !find('[data-artifact-viewer]'))
  return report
}
window.nativeDark = async () => { document.documentElement.dataset.theme = 'dark'; await tick(); return report }
window.nativePreviewTop = async () => { list().scrollTop = 0; await click(open('p0')); return report }

function assertExpanded(surface) {
  const host = find('[data-side-pane-host]').getBoundingClientRect()
  const pane = find('[data-side-pane-expanded]').getBoundingClientRect()
  report[surface + 'ExpandedBounds'] = { host: host.toJSON(), pane: pane.toJSON() }
  check(surface + '-fills-own-host', Math.abs(host.x-pane.x)<1 && Math.abs(host.y-pane.y)<1 && Math.abs(host.width-pane.width)<1 && Math.abs(host.height-pane.height)<1)
  check(surface + '-leaves-nav-visible', pane.x >= find('nav').getBoundingClientRect().right)
}
window.nativeResizeReady = async () => {
  const handle = find('[data-side-pane-resize]')
  check('shared-left-handle-present', handle?.getAttribute('role') === 'separator' && getComputedStyle(handle.firstElementChild).opacity !== '0')
  const pane = handle.closest('[data-resizable-side-pane]')
  window.resizeBefore = { width: pane.getBoundingClientRect().width, previewCalls: report.calls.filter(([kind]) => kind === 'preview').length, viewer: find('[data-artifact-viewer]'), iframe: !!find('[data-artifact-viewer] iframe') }
  return handle.getBoundingClientRect().toJSON()
}
window.nativeResizeCheck = async name => {
  await tick()
  const handle = find('[data-side-pane-resize]'), pane = handle.closest('[data-resizable-side-pane]')
  check(name + '-drag-changes-width', Math.abs(pane.getBoundingClientRect().width-window.resizeBefore.width)>15)
  check(name + '-drag-keeps-viewer-dom', window.resizeBefore.viewer === find('[data-artifact-viewer]'))
  check(name + '-drag-no-preview-reload', window.resizeBefore.previewCalls === report.calls.filter(([kind]) => kind === 'preview').length)
  check(name + '-drag-shield-cleaned', !find('[data-side-pane-drag-shield]'))
  check(name + '-drag-with-live-iframe', window.resizeBefore.iframe)
  const width = pane.getBoundingClientRect().width
  await key(handle, 'ArrowLeft')
  check(name + '-keyboard-resize', pane.getBoundingClientRect().width === Math.min(width+20, Number(handle.getAttribute('aria-valuemax'))))
  await key(handle, 'Home')
  check(name + '-keyboard-min-bound', pane.getBoundingClientRect().width === Number(handle.getAttribute('aria-valuemin')))
  await key(handle, 'End')
  check(name + '-keyboard-max-bound', pane.getBoundingClientRect().width === Number(handle.getAttribute('aria-valuemax')))
  // Keep a readable split after checking both clamps.
  await key(handle, 'ArrowRight')
  window.normalWidth = pane.getBoundingClientRect().width
  return report
}
window.nativeResizeRestore = async () => {
  const viewer = find('[data-artifact-viewer]')
  await click(action('expand'))
  assertExpanded('catalog-resized')
  await click(action('expand'))
  check('catalog-restores-resized-width', find('[data-side-pane-resize]').closest('[data-resizable-side-pane]').getBoundingClientRect().width === window.normalWidth)
  check('catalog-expand-keeps-viewer-dom', find('[data-artifact-viewer]') === viewer)
  return report
}
window.nativeCancelDrag = async () => {
  check('drag-shield-exists-before-close', !!find('[data-side-pane-drag-shield]'))
  await click(action('close'))
  check('close-during-drag-cleans-shield', !find('[data-side-pane-drag-shield]'))
  return report
}
window.nativeChangeDuringDrag = async () => {
  check('target-change-starts-during-drag', !!find('[data-side-pane-drag-shield]'))
  await openArtifactViewer('native-work', 'native-work', refs[0])
  await tick()
  window.targetChangeWidth = useArtifactViewerStore.getState().widths.transcript
  check('target-change-cleans-drag-shield', !find('[data-side-pane-drag-shield]'))
  check('target-change-shows-new-publication', !!find('[data-artifact-viewer="p0"]'))
  return report
}
window.nativeAfterTargetChange = async () => {
  await tick()
  check('old-drag-cannot-resize-new-target', useArtifactViewerStore.getState().widths.transcript === window.targetChangeWidth)
  await click(action('close'))
  delayed = {}
  const request = openArtifactViewer('native-work', 'native-work', refs[1])
  await tick()
  const pending = delayed
  delayed = null
  flushSync(() => useChatStore.setState(state => ({ activeKey: 'other-session', sessions: { ...state.sessions, 'other-session': { ...state.sessions['native-work'], session: { ...state.sessions['native-work'].session, sessionId: 'other-session' } } } })))
  await tick()
  pending.resolve(previews.html)
  await request
  await tick()
  check('session-change-discards-pending-viewer-response', useArtifactViewerStore.getState().selection === null && !find('[data-artifact-viewer]'))
  return report
}
window.nativeChat = async (kind = 'work') => {
  closeArtifactViewer()
  document.documentElement.dataset.theme = 'white'
  const messages = [
    { role: 'user', createdAt: 1, parts: [{ type: 'text', text: '센서 검증 결과를 정리하고 발표자료를 만들어 주세요.' }] },
    { role: 'assistant', createdAt: 2, parts: [
      { type: 'text', text: '검증 결과를 정리했습니다. 주요 측정값과 검토 메모를 확인할 수 있습니다.\n\n' + Array.from({length: 18}, (_, i) => `${i+1}. 센서 검증 항목을 확인했습니다.`).join('\n') },
      ...[refs[0], ...ordinary].map(artifact => ({ type: 'artifact', artifact }))
    ] }
  ]
  const session = { ...initialChatState, agentKind: kind, sessionId: 'native-work', title: '센서 검증 결과', cwd: 'C:/fixture', agentPanelInitialized: true, messages, planContent: '# 검증 계획\n\n' + Array.from({length:100}, (_,i) => `${i+1}. 검증 조건을 확인합니다.`).join('\n'), rightPanelTiles: kind === 'work' ? [{ id: 'column1', tiles: ['task'] }] : [{ id: 'column0', tiles: ['subagent'] }, { id: 'column1', tiles: ['plan'] }] }
  flushSync(() => useChatStore.setState({ activeKey: 'native-work', sessions: { 'native-work': { session, live: { text: '', reasoning: '' }, subagentMeta: {} } } }))
  flushSync(() => window.nativeNavigate('/chat'))
  await tick(); await tick()
  const transcript = find('[data-chat-pane-content]')
  check(kind + '-actual-chat-mounted', !!transcript && !!find('[data-context="' + (kind === 'work' ? 'task' : 'plan') + '"]'))
  window.chatContent = transcript
  window.chatDraft = find('textarea') || find('[contenteditable="true"]')
  window.chatDraftText = window.chatDraft?.value || window.chatDraft?.textContent
  check(kind + '-fixture-has-real-draft', window.chatDraftText === '아직 보내지 않은 검토 메모')
  window.overview = find('[data-artifact-overview]')
  window.overviewWidth = window.overview.getBoundingClientRect().width
  return report
}
window.nativeOutputCards = async () => {
  const card = id => window.chatContent.querySelector('[data-artifact-preview="' + id + '"]')?.closest('article')
  const ppt = card('ordinary-pdf'), md = card('ordinary-text'), artifact = card('p0')
  check('ordinary-ppt-md-actual-transcript-cards', ppt?.textContent.includes('PPTX') && md?.textContent.includes('MD'))
  check('artifact-only-subtitle', artifact?.textContent.includes('아티팩트') && !ppt.textContent.includes('아티팩트') && !md.textContent.includes('아티팩트'))
  const menuButton = [...ppt.querySelectorAll('button')].at(-1)
  await click(menuButton)
  const menuText = find('[role="menu"]')?.textContent || all('[data-radix-popper-content-wrapper]').map(node=>node.textContent).join('')
  const items = all('[data-context="floating"] button')
  check('file-menu-no-metadata-or-openfolder', items.length === 4 && !/validation.pptx|바이트|결과 폴더/.test(items.map(node=>node.textContent).join('')))
  const reveal = items.find(node => /탐색기/.test(node.textContent))
  await click(reveal)
  check('reveal-success-quiet', report.calls.some(([kind]) => kind === 'reveal') && !all('[data-chat-pane-content] [role="status"]').some(node => /열림|저장됨/.test(node.textContent)))
  await click([...ppt.querySelectorAll('button')].find(node => node.textContent.trim() === '다운로드'))
  check('save-success-quiet', !all('[data-chat-pane-content] [role="status"]').some(node => /저장됨/.test(node.textContent)))
  failSave = true
  await click([...ppt.querySelectorAll('button')].find(node => node.textContent.trim() === '다운로드'))
  check('save-failure-remains-visible', all('[data-chat-pane-content] [role="status"]').some(node => node.textContent.includes('validation.pptx')))
  await click(ppt.querySelector('[data-artifact-preview]'))
  check('ordinary-binary-viewer-download-enabled', !!find('[data-artifact-viewer="ordinary-pdf"]') && !action('download').disabled)
  await click(action('download'))
  check('ordinary-binary-viewer-download-target', report.calls.some(([kind, req]) => kind === 'save' && req.publicationIds.join(',') === 'ordinary-pdf'))
  await click(action('close'))
  return report
}
window.nativeTaskExpand = async (kind = 'work') => {
  const tile = find('[data-context="' + (kind === 'work' ? 'task' : 'plan') + '"]')
  const viewport = find('[data-artifact-overview]').parentElement
  viewport.scrollLeft = viewport.scrollWidth
  const horizontalScroll = viewport.scrollLeft
  if (kind === 'code') check('code-fixture-horizontal-scroll', horizontalScroll > 0)
  const tileScrollers = [...tile.querySelectorAll('*')].filter(node => node.scrollHeight > node.clientHeight+4 && /auto|scroll/.test(getComputedStyle(node).overflowY))
  for (const node of tileScrollers) node.scrollTop = 80
  await tick()
  const tileScrollPositions = tileScrollers.map(node => node.scrollTop)
  const scroller = find('.app-frame-transcript')
  scroller.scrollTop = 160
  const previousScroll = scroller.scrollTop
  const button = [...tile.querySelectorAll('button')].find(node => node.getAttribute('aria-label')?.includes('넓게 보기'))
  await click(button)
  assertExpanded(kind + '-tile')
  check(kind + '-tile-keeps-transcript-inert', window.chatContent === find('[data-chat-pane-content]') && window.chatContent.inert)
  window.nativeTaskRestore = async () => {
  await click(button)
  check(kind + '-tile-restores-overview-width', window.overview.getBoundingClientRect().width === window.overviewWidth)
  check(kind + '-tile-restores-draft-dom', window.chatDraft === (find('textarea') || find('[contenteditable="true"]')) && window.chatDraftText === (window.chatDraft?.value || window.chatDraft?.textContent))
  check(kind + '-tile-restores-input-enabled', !window.chatContent.inert)
  check(kind + '-tile-restores-transcript-scroll', scroller.scrollTop === previousScroll)
  check(kind + '-tile-restores-inner-scroll', tileScrollers.every((node, index) => node.scrollTop === tileScrollPositions[index]))
  check(kind + '-tile-restores-horizontal-scroll', viewport.scrollLeft === horizontalScroll)
  return report
  }
  return report
}
window.nativeChatViewer = async () => {
  await openArtifactViewer('native-work', 'native-work', refs[1])
  await tick()
  check('chat-viewer-keeps-overview-mounted', find('[data-artifact-overview]') === window.overview && window.overview.hidden && window.overview.inert)
  return report
}
window.nativeChatViewerExpand = async () => {
  const viewer = find('[data-artifact-viewer]')
  const scroller = find('.app-frame-transcript')
  scroller.scrollTop = 160
  window.beforeViewerScroll = scroller.scrollTop
  await click(action('expand'))
  assertExpanded('transcript-viewer')
  check('chat-viewer-keeps-transcript-inert', window.chatContent === find('[data-chat-pane-content]') && window.chatContent.inert)
  window.chatViewerBeforeExpand = viewer
  return report
}
window.nativeChatViewerRestore = async () => {
  await click(action('expand'))
  check('chat-viewer-restores-resized-width', find('[data-side-pane-resize]').closest('[data-resizable-side-pane]').getBoundingClientRect().width === window.normalWidth)
  check('chat-viewer-expand-keeps-dom', find('[data-artifact-viewer]') === window.chatViewerBeforeExpand)
  await click(action('close'))
  check('chat-close-restores-overview-dom-width', find('[data-artifact-overview]') === window.overview && window.overview.getBoundingClientRect().width === window.overviewWidth)
  check('chat-close-preserves-draft', window.chatDraft === (find('textarea') || find('[contenteditable="true"]')) && window.chatDraftText === (window.chatDraft?.value || window.chatDraft?.textContent))
  check('chat-close-preserves-scroll', find('.app-frame-transcript').scrollTop === window.beforeViewerScroll)
  return report
}


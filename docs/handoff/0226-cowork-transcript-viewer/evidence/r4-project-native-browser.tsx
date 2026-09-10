import React from 'react'
import { SettingsSchema } from '@source/shared/protocol'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Sidebar } from '@source/renderer/src/app/Sidebar'
import { useSidebarSlots } from '@source/renderer/src/app/hooks/useSidebarSlots'
import { useSessionHandlers } from '@source/renderer/src/app/hooks/useSessionHandlers'
import { useChatSessionsSync } from '@source/renderer/src/app/hooks/useChatSessionsSync'
import { useChatRouteSync } from '@source/renderer/src/app/hooks/useChatRouteSync'
import { ProjectLandingPage } from '@source/renderer/src/pages/ProjectLandingPage'
import { NewChatLandingPage } from '@source/renderer/src/pages/NewChatLandingPage'
import { ProjectsPage } from '@source/renderer/src/pages/ProjectsPage'
import { PluginsPage } from '@source/renderer/src/pages/PluginsPage'
import { AgentPage } from '@source/renderer/src/pages/AgentPage'
import { ArtifactsPage } from '@source/renderer/src/pages/ArtifactsPage'
import { TweakProvider } from '@source/renderer/src/shared/theme'
import { useProjectsStore } from '@source/renderer/src/features/projects/store/projectsStore'
import { useSessionsStore } from '@source/renderer/src/features/sessions/store/sessionsStore'
import { useChatStore, chatActions, bootstrapChat } from '@source/renderer/src/features/chat/store/chatStore'
import { initialChatState } from '@source/renderer/src/features/chat/reducer/chatReducer'
import { useAgentStore } from '@source/renderer/src/shared/stores/agentStore'

// 실DB·외부 SDK 없이 production renderer와 store의 배치/이벤트 동작을 확인한다.
const report = window.nativeReport = { checks: {}, errors: [], calls: [], geometry: {} }
window.addEventListener('error', event => report.errors.push(String(event.error?.stack || event.message)))
window.addEventListener('unhandledrejection', event => report.errors.push(String(event.reason)))
const tick = () => new Promise(resolve => setTimeout(resolve, 150))
const check = (key, value) => {
  report.checks[key] = !!value
}
const click = async node => {
  if (!node) throw new Error('Missing click target')
  flushSync(() => node.click())
  await tick()
}
const byText = (selector, text) => [...document.querySelectorAll(selector)].find(node => node.textContent.trim() === text)
const box = node => {
  if (!node) throw new Error('Missing geometry target')
  const { x, y, width, height, right, bottom } = node.getBoundingClientRect()
  return { x, y, width, height, right, bottom }
}
const same = (a, b) => Math.abs(a - b) < 1
const project = (id, cwd, name = 'sensor-review') => ({ id, cwd, name, instructions: `Initial ${id}`, createdAt: 1, updatedAt: 2, pinnedAt: null })
let projects = [
  project('a', 'C:\\Engineering\\sensor-review'),
  project('b', 'D:\\Research\\sensor-review'),
  project('desktop', 'C:\\Users\\me\\OneDrive\\Desktop', 'Desktop'),
  project('legacy', null, '이전 프로젝트')
]
const sessions = [
  { id: 's1', projectId: 'a', title: '카메라 센서 검증 결과 검토', agentKind: 'work' },
  { id: 's2', projectId: 'a', title: '응답 시간 측정 결과 정리', agentKind: 'code' },
  { id: 'orphan', projectId: null, title: '프로젝트가 없는 이전 대화', agentKind: 'work' },
  { id: 'pinned', projectId: null, title: '다음 검증 항목 정리', agentKind: 'work', pinnedAt: 12 }
].map(session => ({ backend: 'claude', updatedAt: 1788990000000, preview: '이 메타는 표시하지 않음', cwd: 'C:\\Engineering\\sensor-review', pinnedAt: null, ...session }))
const artifacts = ['센서 검증 보고서', '지연 시간 분석', '테스트 수행 요약', '카메라 스펙 비교', '회귀 테스트 결과', '최종 검토 의견'].map((title, index) => ({
  artifactFileId: `file-${index}`, publicationId: `publication-${index}`, sessionId: 's1', sessionTitle: sessions[0].title,
  title, filename: `report-${index}.md`, kind: 'markdown', relativePath: `report-${index}.md`,
  sizeBytes: 2048, publishedAt: 1788990000000, pinned: index === 0
}))
const skill = { name: '검증 보고서', description: '검증 결과를 정리합니다.', sourceId: 'orca', sourceLabel: 'Orcinus orca 스킬', sourceKind: 'orca', enabled: true, canToggle: true, canDelete: false, isBuiltin: true, path: 'fixture://skill' }
const chatListeners = new Set()
const emitChatEvent = event => { for (const listener of chatListeners) listener(event) }
let environments = []
window.orca = {
  platform: 'win32',
  settings: { get: async () => SettingsSchema.parse({}), set: async patch => ({ ...SettingsSchema.parse({}), ...patch }) },
  chat: { onEvent: listener => { chatListeners.add(listener); return () => chatListeners.delete(listener) }, send: async request => report.calls.push(['send', request]) },
  session: { cwd: async () => 'C:\\Users\\me\\OneDrive\\Desktop', onTitle: () => () => {}, list: async () => sessions, load: async () => null },
  concurrency: { onEvent: () => () => {} },
  project: {
    list: async () => projects,
    listSessions: async id => { report.calls.push(['project-sessions', id]); return sessions.filter(session => session.projectId === id) },
    setPinned: async (id, pinned) => { report.calls.push(['pin-project', id, pinned]); projects = projects.map(project => project.id === id ? { ...project, pinnedAt: pinned ? 100 : null } : project) },
    create: async request => { const created = { ...project('manual-project', null, request.name), instructions: request.instructions }; projects = [...projects, created]; return created },
    update: async patch => { projects = projects.map(project => project.id === patch.id ? { ...project, ...patch } : project) }
  },
  agent: { list: async () => environments },
  provider: { state: async () => ({ providers: [], step: null }), onState: () => () => {} },
  skills: { list: async () => [skill] },
  mcp: { list: async () => [] },
  artifacts: { catalog: async () => artifacts },
  files: { list: async () => [], pickDirectory: async () => null },
  git: { status: async () => ({ isRepo: false, branch: null, dirty: false }) }
}
useProjectsStore.setState({ list: projects, loading: false })
useSessionsStore.setState({ byId: Object.fromEntries(sessions.map(session => [session.id, session])), recentIds: sessions.map(session => session.id), projectSessionIds: { a: ['s1', 's2'], b: [], desktop: [], legacy: [] }, loading: false })
useChatStore.setState({ sessions: { __new__: { session: { ...initialChatState, agentKind: 'work' }, live: { text: '', reasoning: '' }, subagentMeta: {} } }, activeKey: '__new__', pendingNewChatKey: null })
bootstrapChat()
function App() {
  useChatRouteSync()
  useChatSessionsSync()
  const slots = useSidebarSlots(useSessionHandlers())
  window.nativeNavigate = useNavigate()
  return <div className="app-frame-root flex h-full w-full bg-bg [font-family:var(--font-app)] text-[13px] leading-[1.45] text-ink"><Sidebar {...slots} /><main className="app-frame-main flex min-h-0 min-w-0 flex-1 flex-col"><Routes>
    <Route path="/projects/:projectId" element={<ProjectLandingPage />} />
    <Route path="/projects" element={<ProjectsPage />} />
    <Route path="/new" element={<NewChatLandingPage />} />
    <Route path="/artifacts" element={<ArtifactsPage onOpen={() => {}} onDeleted={() => {}} />} />
    <Route path="/plugins" element={<PluginsPage />} />
    <Route path="/agent" element={<AgentPage />} />
  </Routes></main></div>
}
const root = createRoot(document.getElementById('root'))
async function navigate(path) {
  flushSync(() => window.nativeNavigate(path))
  await tick(); await tick()
}
function noOverflow(name) {
  const main = document.querySelector('.app-frame-main')
  check(`${name}-${innerWidth}-no-main-overflow`, main.scrollWidth <= main.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1)
}
const navRow = id => document.querySelector(`.app-frame-sidebar-scroll [data-project-id="${id}"]`)
window.nativeMount = async () => {
  flushSync(() => root.render(<TweakProvider><MemoryRouter initialEntries={['/projects/a']}><App /></MemoryRouter></TweakProvider>))
  await tick(); await tick(); await document.fonts.ready
  report.typography = { root: getComputedStyle(document.querySelector('.app-frame-root')).fontFamily, title: getComputedStyle(document.querySelector('h1')).fontFamily, rootSize: getComputedStyle(document.documentElement).fontSize }
  check('production-default-app-font', report.typography.root.includes('Segoe UI'))
  const nav = document.querySelector('.app-frame-sidebar-scroll')
  check('pinned-before-projects', nav.textContent.indexOf('고정됨') < nav.textContent.indexOf('프로젝트'))
  check('recent-group-restored', nav.textContent.includes('최근 대화'))
  check('unassigned-session-discoverable', nav.textContent.includes('프로젝트가 없는 이전 대화'))
  for (const project of projects.filter(project => project.cwd)) {
    const row = navRow(project.id), name = row.querySelector('[data-project-name]'), path = row.querySelector('[data-project-path]')
    check(`nav-${project.id}-name-before-full-path`, name.textContent === project.name && path.textContent === project.cwd && !!(name.compareDocumentPosition(path) & Node.DOCUMENT_POSITION_FOLLOWING))
    check(`nav-${project.id}-muted-smaller-path`, parseFloat(getComputedStyle(path).fontSize) < parseFloat(getComputedStyle(name).fontSize) && getComputedStyle(path).color !== getComputedStyle(name).color)
  }
  await window.nativeProject()
}
window.nativeProject = async () => {
  await navigate('/projects/a')
  const title = document.querySelector('h1'), composer = document.querySelector('[data-surface="cwd-panel"]'), row = document.querySelector('[data-context="project-session"]')
  const geometry = report.geometry[`project-${innerWidth}`] = { title: box(title), composer: box(composer), row: box(row) }
  check(`project-${innerWidth}-column-aligned`, same(geometry.title.x, geometry.composer.x) && same(geometry.row.x, geometry.composer.x))
  check(`project-${innerWidth}-title-composer-list-order`, geometry.title.y < geometry.composer.y && geometry.composer.y < geometry.row.y)
  check(`project-${innerWidth}-no-chat-metadata`, !row.textContent.includes('이 메타는') && !row.querySelector('time'))
  noOverflow('project')
}
window.nativePin = async pinned => {
  await click(navRow('a').querySelector('button[aria-haspopup]'))
  await click(byText('[role="menuitem"]', pinned ? '고정' : '고정 해제'))
  await tick()
  const row = navRow('a')
  check(`project-${pinned ? 'pin' : 'unpin'}-ipc`, report.calls.some(call => call[0] === 'pin-project' && call[1] === 'a' && call[2] === pinned))
  check(`project-${pinned ? 'pin' : 'unpin'}-moves-group`, !!row.closest(pinned ? '[data-context="pinned"]' : '[data-context="projects"]'))
  check(`project-${pinned ? 'pin' : 'unpin'}-no-duplicate`, document.querySelectorAll('.app-frame-sidebar-scroll [data-project-id="a"]').length === 1)
}
window.nativeNew = async () => {
  await navigate('/new')
  const current = report.geometry[`new-${innerWidth}`] = box(document.querySelector('[data-surface="cwd-panel"]'))
  const project = report.geometry[`project-${innerWidth}`].composer
  check(`project-new-${innerWidth}-same-horizontal-insets`, same(current.x, project.x) && same(current.width, project.width))
  noOverflow('new')
}
window.nativeBackground = async () => {
  const oldCollapsed = navRow('a').querySelector('button[aria-expanded]').getAttribute('aria-expanded')
  chatActions.newChat()
  const state = useChatStore.getState(), pending = state.activeKey
  useChatStore.setState({ sessions: { ...state.sessions, 'unrelated-draft': { ...state.sessions[pending] } }, activeKey: 'unrelated-draft', pendingNewChatKey: pending })
  projects = [...projects, project('new-project', 'E:\\Reviews\\new-project', 'new-project')]
  const receipt = { type: 'session.updated', sessionId: 'background-session', patch: { projectId: 'new-project', cwd: 'E:\\Reviews\\new-project', projectCreated: true } }
  emitChatEvent(receipt)
  await tick(); await tick()
  check('new-project-row-expands-after-session-confirmation', navRow('new-project')?.querySelector('button[aria-expanded]')?.getAttribute('aria-expanded') === 'true')
  check('new-project-loads-child-conversations', report.calls.some(call => call[0] === 'project-sessions' && call[1] === 'new-project'))
  check('new-project-preserves-existing-collapse', navRow('a').querySelector('button[aria-expanded]').getAttribute('aria-expanded') === oldCollapsed)
  check('background-confirmation-preserves-current-draft', useChatStore.getState().activeKey === 'unrelated-draft')
  await click(navRow('new-project').querySelector('button[aria-expanded]'))
  emitChatEvent(receipt)
  await tick()
  check('duplicate-created-receipt-preserves-user-collapse', navRow('new-project').querySelector('button[aria-expanded]').getAttribute('aria-expanded') === 'false')
  await click(navRow('new-project').querySelector('button[aria-expanded]'))
}
window.nativeArtifacts = async () => {
  await navigate('/artifacts')
  check(`artifacts-${innerWidth}-count-unit`, document.querySelector('[data-artifact-catalog-count]').textContent === '6개')
  report.geometry[`artifacts-${innerWidth}`] = { title: box(document.querySelector('h1')), tabs: box(document.querySelector('[role="tablist"]')), firstTab: box(document.querySelector('[role="tab"]')) }
  check(`artifacts-${innerWidth}-six-list-rows`, document.querySelectorAll('[data-artifact-catalog-row]').length === 6)
  noOverflow('artifacts')
}
window.nativePlugins = async () => {
  await navigate('/plugins')
  const geometry = report.geometry[`plugins-${innerWidth}`] = { title: box(document.querySelector('h1')), tabs: box(document.querySelector('[role="tablist"]')), firstTab: box(document.querySelector('[role="tab"]')) }
  const artifacts = report.geometry[`artifacts-${innerWidth}`]
  check(`plugins-${innerWidth}-catalog-title-position`, same(geometry.title.x, artifacts.title.x) && same(geometry.title.y, artifacts.title.y))
  check(`plugins-${innerWidth}-catalog-tabs-position`, same(geometry.tabs.x, artifacts.tabs.x) && same(geometry.tabs.y, artifacts.tabs.y))
  check(`plugins-${innerWidth}-catalog-tab-height`, same(geometry.firstTab.height, artifacts.firstTab.height))
  check(`plugins-${innerWidth}-three-tabs`, [...document.querySelectorAll('[role="tab"]')].map(tab => tab.textContent).join('|') === '스킬|MCP|연결')
  check(`plugins-${innerWidth}-skills-visible`, document.querySelector('[role="tabpanel"]').textContent.includes('검증 보고서'))
  noOverflow('plugins')
}
window.nativePluginTab = async tab => {
  await click(document.querySelector(`[data-extensions-tab="${tab}"]`))
  check(`plugin-${tab}-tab-switch`, document.querySelector(`[data-extensions-tab="${tab}"]`).getAttribute('aria-selected') === 'true' && !!document.querySelector('[role="tabpanel"]'))
}
window.nativeProjects = async () => {
  await navigate('/projects')
  const artifacts = report.geometry[`artifacts-${innerWidth}`]
  const title = box(document.querySelector('h1'))
  check(`projects-${innerWidth}-catalog-title-position`, same(title.x, artifacts.title.x) && same(title.y, artifacts.title.y))
  const rows = [...document.querySelectorAll('[data-project-catalog-row]')]
  report.geometry[`projects-${innerWidth}`] = rows.map(box)
  check(`projects-${innerWidth}-vertical-list`, rows.length === projects.length && rows.every((row, index) => index === 0 || (same(box(row).x, box(rows[0]).x) && box(row).y >= box(rows[index - 1]).bottom - 1)))
  for (const project of projects.filter(project => project.cwd)) {
    const row = rows.find(row => row.textContent.includes(project.cwd))
    const title = row?.querySelector(`[title="${project.name}"]`), path = row?.querySelector('[data-project-catalog-path]')
    check(`projects-${innerWidth}-${project.id}-cwd-below-title`, !!title && !!path && box(path).y >= box(title).bottom - 1 && !row.textContent.includes(project.instructions))
  }
  noOverflow('projects')
}
function setInput(node, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value)
  node.dispatchEvent(new Event('input', { bubbles: true }))
}
window.nativeProjectFilters = async () => {
  const catalogRow = id => document.querySelector(`[data-project-catalog-row="${id}"]`)
  await click(catalogRow('a').querySelector('[aria-haspopup="menu"]'))
  await click(byText('[role="menuitem"]', '고정'))
  await click(document.querySelector('[data-project-tab="pinned"]'))
  check('project-catalog-pinned-filter', document.querySelectorAll('[data-project-catalog-row]').length === 1 && !!catalogRow('a'))
  await click(catalogRow('a').querySelector('[aria-haspopup="menu"]'))
  await click(byText('[role="menuitem"]', '고정 해제'))
  await tick()
  check('project-catalog-unpin-removes-row', !catalogRow('a'))
  check('project-catalog-unpin-restores-tab-focus', document.activeElement === document.querySelector('[data-project-tab="pinned"]'))
  await click(document.querySelector('[data-project-tab="all"]'))
  await click(document.querySelector('[data-project-catalog] button[aria-label="프로젝트 검색"]'))
  setInput(document.querySelector('[data-project-catalog] input[type="search"]'), 'D:\\Research')
  await tick()
  check('project-catalog-search-by-full-path', document.querySelectorAll('[data-project-catalog-row]').length === 1 && !!catalogRow('b'))
  await click(byText('[data-project-catalog] button', '새 프로젝트'))
  setInput(document.querySelector('[role="dialog"] input'), '새 수동 프로젝트')
  await tick()
  await click(byText('[role="dialog"] button', '만들기'))
  await tick()
  check('project-catalog-create-resets-filters', document.querySelector('[data-project-tab="all"]').getAttribute('aria-selected') === 'true' && !!catalogRow('manual-project') && !document.querySelector('[data-project-catalog] input[type="search"]'))
}
async function catalogKeyboard(scope, marker, name) {
  const tabs = [...scope.querySelectorAll(`[${marker}]`)]
  await click(tabs[0])
  tabs[0].focus()
  for (const [key, index] of [['ArrowLeft', 1], ['ArrowRight', 0], ['ArrowRight', 1], ['End', 1], ['Home', 0]]) {
    flushSync(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
    await tick()
    const selected = tabs[index]
    check(`${name}-${key}-${index}-selects-and-focuses-tab`, selected.getAttribute('aria-selected') === 'true' && document.activeElement === selected)
    check(`${name}-${key}-${index}-single-tabstop`, tabs.every((tab, current) => tab.tabIndex === (current === index ? 0 : -1)))
    const panel = scope.querySelector('[role="tabpanel"]')
    check(`${name}-${key}-${index}-aria-connected`, selected.getAttribute('aria-controls') === panel.id && panel.getAttribute('aria-labelledby') === selected.id)
  }
}
async function catalogSearch(scope, name, label, query, rowSelector, expectedId) {
  const toggle = scope.querySelector(`button[aria-label="${label}"]`)
  const before = scope.querySelectorAll(rowSelector).length
  const title = scope.querySelector('h1').textContent
  await click(toggle)
  let input = scope.querySelector('input[type="search"]')
  check(`${name}-search-opens-and-focuses-input`, !!input && document.activeElement === input && toggle.getAttribute('aria-expanded') === 'true')
  check(`${name}-search-aria-controls-input`, toggle.getAttribute('aria-controls') === input.id)
  setInput(input, query)
  await tick()
  check(`${name}-search-filters-target`, scope.querySelectorAll(rowSelector).length === 1 && !!scope.querySelector(expectedId))
  check(`${name}-search-preserves-title-total`, scope.querySelector('h1').textContent === title)
  let bubbled = false
  const bubble = event => { if (event.key === 'Escape') bubbled = true }
  window.addEventListener('keydown', bubble)
  flushSync(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
  await tick()
  window.removeEventListener('keydown', bubble)
  check(`${name}-search-escape-stops-propagation`, !bubbled)
  check(`${name}-search-escape-closes-and-restores-trigger`, !scope.querySelector('input[type="search"]') && document.activeElement === toggle && toggle.getAttribute('aria-expanded') === 'false')
  check(`${name}-search-escape-clears-filter`, scope.querySelectorAll(rowSelector).length === before)
  await click(toggle)
  input = scope.querySelector('input[type="search"]')
  check(`${name}-search-reopens-empty`, input.value === '')
  setInput(input, query)
  await tick()
  await click(toggle)
  check(`${name}-search-toggle-close-clears-filter-and-focuses`, !scope.querySelector('input[type="search"]') && scope.querySelectorAll(rowSelector).length === before && document.activeElement === toggle)
}
window.nativeCatalogControls = async () => {
  await navigate('/projects')
  let scope = document.querySelector('[data-project-catalog]')
  await catalogKeyboard(scope, 'data-project-tab', 'project-tabs')
  await catalogSearch(scope, 'project', '프로젝트 검색', 'D:\\Research', '[data-project-catalog-row]', '[data-project-catalog-row="b"]')
  await navigate('/artifacts')
  scope = document.querySelector('[data-artifact-catalog]')
  await catalogKeyboard(scope, 'data-catalog-tab', 'artifact-tabs')
  await catalogSearch(scope, 'artifact', '아티팩트 검색', 'report-1.md', '[data-artifact-catalog-row]', '[data-artifact-catalog-row="publication-1"]')
  await click(scope.querySelector('[data-catalog-tab="pinned"]'))
  check('artifact-pinned-filter-preserves-total', scope.querySelectorAll('[data-artifact-catalog-row]').length === 1 && scope.querySelector('[data-artifact-catalog-count]').textContent === '6개')
  await click(scope.querySelector('[data-catalog-tab="all"]'))
}
window.nativeEngine = async () => {
  environments = [
    { key: 'claude/review', adapter: 'claude', provider: 'review', source: 'settings', supported: true, models: [{ alias: 'sonnet', model: '검증용 모델', oneMillionContext: false, isDefault: true }] },
    { key: 'claude/analysis', adapter: 'claude', provider: 'analysis', source: 'settings', supported: true, models: [{ alias: 'opus', model: '분석용 모델', oneMillionContext: false, isDefault: true }] },
    { key: 'claude/runtime', adapter: 'claude', provider: 'runtime', source: 'runtime', readOnly: true, supported: true, models: [] }
  ]
  await useAgentStore.getState().refresh()
  await navigate('/agent')
  const title = document.querySelector('h1'), count = document.querySelector('[data-engine-catalog-count]')
  check(`engine-${innerWidth}-settings-count-excludes-runtime`, count.textContent === '2개')
  check(`engine-${innerWidth}-count-beside-title`, box(count).x >= box(title).right && box(count).y >= box(title).y && box(count).bottom <= box(title).bottom + 1)
  check(`engine-${innerWidth}-no-header-metadata`, title.parentElement.children.length === 3 && !document.querySelector('.app-frame-main').textContent.includes('provider settings'))
  check(`engine-${innerWidth}-settings-and-runtime-cards-preserved`, ['claude/review', 'claude/analysis', 'claude/runtime'].every(key => document.querySelector('.app-frame-main').textContent.includes(key)))
  noOverflow('engine')
}

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
  { id: 's1', projectId: 'a', title: '카메라 / 센서 검증 결과 검토', agentKind: 'work' },
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
useChatStore.setState({ sessions: {
  __new__: { session: { ...initialChatState, agentKind: 'work' }, live: { text: '', reasoning: '' }, subagentMeta: {} },
  'nav-draft': { session: { ...initialChatState, agentKind: 'work', title: '분기 / 초안', projectId: 'a', forkFrom: 's1' }, live: { text: '', reasoning: '' }, subagentMeta: {} }
}, activeKey: '__new__', pendingNewChatKey: null })
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
// r7: production page buttons only. Host sends real mouse/key input; IPC remains isolated.
report.styles = {}
const targetButton = surface => byText('main button', surface === 'engine' ? '엔진 추가' : surface === 'projects' ? '새 프로젝트' : '추가')
const stageKey = surface => `${document.documentElement.dataset.theme}-${innerWidth}-${surface}`
window.nativeMount = async () => {
  flushSync(() => root.render(<TweakProvider><MemoryRouter initialEntries={['/agent']}><App /></MemoryRouter></TweakProvider>))
  await tick(); await tick(); await document.fonts.ready
}
window.nativeShow = async (theme, surface) => {
  document.documentElement.dataset.theme = theme
  await navigate(surface === 'engine' ? '/agent' : surface === 'projects' ? '/projects' : '/plugins')
  if (surface === 'skills' || surface === 'mcp') await click(document.querySelector(`[data-extensions-tab="${surface}"]`))
  await tick()
  const button = targetButton(surface), rect = box(button), main = document.querySelector('main')
  check(`${stageKey(surface)}-within-main`, rect.x >= box(main).x && rect.right <= box(main).right && rect.bottom <= innerHeight)
  noOverflow(stageKey(surface))
  check(`${stageKey(surface)}-dropdown-contract`, surface === 'skills' ? button.getAttribute('aria-expanded') === 'false' && button.querySelectorAll('svg').length === 2 : !button.hasAttribute('aria-expanded') && button.querySelectorAll('svg').length === 1)
  return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) }
}
window.nativeInspect = async (surface, state) => {
  await tick()
  const button = targetButton(surface), body = getComputedStyle(button), fill = getComputedStyle(button.querySelector('.btn-squish')), icon = button.querySelector('svg')
  const style = Object.fromEntries(['height', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'paddingLeft', 'paddingRight', 'columnGap', 'borderRadius', 'color'].map(key => [key, body[key]]))
  Object.assign(style, { fill: fill.backgroundColor, border: fill.borderWidth, iconWidth: getComputedStyle(icon).width, iconMarkup: icon.innerHTML })
  const key = `${stageKey(surface)}-${state}`
  report.styles[key] = style
  const reference = report.styles[`${document.documentElement.dataset.theme}-${innerWidth}-engine-${state}`]
  check(`${key}-matches-engine`, !!reference && Object.entries(reference).every(([key, value]) => style[key] === value))
  check(`${key}-readable-primary`, style.fill !== 'rgba(0, 0, 0, 0)' && style.color !== style.fill && style.iconWidth === '13px')
  if (state === 'hover') check(`${key}-actual-hover`, button.matches(':hover'))
}
window.nativeOpened = async (surface, method) => {
  await tick()
  const popup = document.querySelector(surface === 'skills' ? '[data-context="floating"]' : '[role="dialog"]')
  const expected = surface === 'projects' ? '새 프로젝트' : surface === 'skills' ? '스킬 지침 작성' : 'MCP 서버 추가'
  check(`${stageKey(surface)}-${method}-opens-correct-surface`, !!popup && popup.textContent.includes(expected))
  if (popup) { const rect = box(popup); check(`${stageKey(surface)}-${method}-popup-within-viewport`, rect.x >= 0 && rect.right <= innerWidth && rect.y >= 0 && rect.bottom <= innerHeight) }
  if (surface === 'skills') check(`${stageKey(surface)}-${method}-expanded-dropdown`, targetButton(surface).getAttribute('aria-expanded') === 'true' && popup.querySelectorAll('[role="menuitem"]').length === 2)
  if (surface === 'projects') check(`${stageKey(surface)}-${method}-name-focused`, document.activeElement === popup?.querySelector('input'))
}
window.nativeClosed = async (surface, method) => {
  await tick()
  check(`${stageKey(surface)}-${method}-escape-closes`, !document.querySelector('[role="dialog"]') && !document.querySelector('[data-context="floating"]'))
  if (surface === 'skills') check(`${stageKey(surface)}-${method}-dropdown-reset`, targetButton(surface).getAttribute('aria-expanded') === 'false')
}
window.nativeFocus = surface => targetButton(surface).focus()
window.nativeProviders = async () => {
  await click(document.querySelector('[data-extensions-tab="providers"]'))
  check(`${document.documentElement.dataset.theme}-${innerWidth}-providers-hide-add`, !byText('main button', '추가'))
}

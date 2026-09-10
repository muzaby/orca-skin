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
import { TweakProvider } from '@source/renderer/src/shared/theme'
import { useProjectsStore } from '@source/renderer/src/features/projects/store/projectsStore'
import { useSessionsStore } from '@source/renderer/src/features/sessions/store/sessionsStore'
import { useChatStore, chatActions, bootstrapChat, ingestChatEvent } from '@source/renderer/src/features/chat/store/chatStore'
import { initialChatState } from '@source/renderer/src/features/chat/reducer/chatReducer'

const report = window.nativeReport = { checks: {}, errors: [], calls: [] }
window.addEventListener('error', e => report.errors.push(String(e.error?.stack || e.message)))
window.addEventListener('unhandledrejection', e => report.errors.push(String(e.reason)))
const tick = () => new Promise(resolve => setTimeout(resolve, 200))
const check = (key, value) => { report.checks[key] = !!value; if (!value) throw new Error(key) }
const click = async node => { if (!node) throw new Error('missing click'); flushSync(() => node.click()); await tick() }
const byText = (selector, text) => [...document.querySelectorAll(selector)].find(node => node.textContent.trim() === text)
const project = (id, cwd, name = 'sensor-review') => ({ id, cwd, name, instructions: `Initial ${id}`, createdAt: 1, updatedAt: 2, pinnedAt: null })
let projects = [project('a', 'C:\\Engineering\\sensor-review'), project('b', 'D:\\Research\\sensor-review'), project('legacy', null, '이전 프로젝트')]
const sessions = [
  { id: 's1', projectId: 'a', title: '카메라 센서 검증 결과 검토', agentKind: 'work' },
  { id: 's2', projectId: 'a', title: '응답 시간 측정 결과 정리', agentKind: 'code' },
  { id: 'pinned', projectId: null, title: '다음 검증 항목 정리', agentKind: 'work', pinnedAt: 12 }
].map(s => ({ backend: 'claude', updatedAt: 1788990000000, preview: '이 메타는 표시하지 않음', cwd: 'C:\\Engineering\\sensor-review', pinnedAt: null, ...s }))
let failSave = false
let resolveDesktop
const desktopPromise = new Promise(resolve => { resolveDesktop = resolve })
window.orca = {
  platform: 'win32',
  settings: { get: async () => SettingsSchema.parse({}), set: async p => ({...SettingsSchema.parse({}),...p}) },
  chat: { onEvent: () => () => {}, send: async request => report.calls.push(['send', request]) },
  session: { cwd: () => desktopPromise, onTitle: () => () => {}, list: async () => sessions, load: async () => null },
  concurrency: { onEvent: () => () => {} },
  project: { list: async () => { report.calls.push(['list-projects']); return projects }, listSessions: async id => sessions.filter(s => s.projectId === id), update: async patch => { report.calls.push(['update', patch]); if (failSave) { failSave = false; throw new Error('Expected save failure') }; projects = projects.map(p => p.id === patch.id ? {...p, ...patch} : p) } },
  agent: { list: async () => [] },
  provider: { state: async () => ({providers: []}), onState: () => () => {} },
  skills: { list: async () => [] },
  files: { list: async () => [], pickDirectory: async () => null },
  git: { status: async () => ({ isRepo: false, branch: null, dirty: false }) }
}
useProjectsStore.setState({ list: projects, loading: false })
useSessionsStore.setState({ byId: Object.fromEntries(sessions.map(s => [s.id, s])), recentIds: sessions.map(s => s.id), projectSessionIds: { a: ['s1','s2'], b: [], legacy: [] }, loading: false })
useChatStore.setState({ sessions: { __new__: { session: { ...initialChatState, agentKind: 'work' }, live: {text:'',reasoning:''}, subagentMeta:{} } }, activeKey:'__new__',pendingNewChatKey:null })
bootstrapChat()
function App() {
  useChatRouteSync()
  useChatSessionsSync()
  const slots = useSidebarSlots(useSessionHandlers())
  const navigate = useNavigate()
  window.nativeNavigate = navigate
  return <div className="app-frame-root flex h-full w-full bg-bg [font-family:var(--font-app)] text-[13px] leading-[1.45] text-ink"><Sidebar {...slots} onOpenPlugins={() => {}} /><main className="app-frame-main flex min-h-0 min-w-0 flex-1 flex-col"><Routes><Route path="/projects/:projectId" element={<ProjectLandingPage />} /><Route path="/new" element={<NewChatLandingPage />} /></Routes></main></div>
}
const root = createRoot(document.getElementById('root'))
window.nativeMount = async () => {
  flushSync(() => root.render(<TweakProvider><MemoryRouter initialEntries={['/projects/a']}><App /></MemoryRouter></TweakProvider>))
  await tick(); await tick()
  resolveDesktop('C:\\Users\\me\\OneDrive\\Desktop')
  await tick()
  await document.fonts.ready
  report.typography = {fontApp:document.documentElement.style.getPropertyValue('--font-app'),root:getComputedStyle(document.querySelector('.app-frame-root')).fontFamily,title:getComputedStyle(document.querySelector('h1')).fontFamily,rootSize:getComputedStyle(document.documentElement).fontSize,fonts:document.fonts.status}
  check('production-default-app-font',report.typography.fontApp === 'var(--font-sans)' && report.typography.root.includes('Segoe UI'))
  check('production-explicit-title-serif',report.typography.title.includes('Source Serif 4'))
  check('production-density-normal',report.typography.rootSize === '13px')
  const state = useChatStore.getState(); const session = state.sessions[state.activeKey].session
  check('project-cwd-beats-late-global-default', session.cwd === projects[0].cwd)
  const nav = document.querySelector('.app-frame-sidebar-scroll')
  check('pinned-before-projects', nav.textContent.indexOf('고정됨') < nav.textContent.indexOf('프로젝트'))
  check('no-recent-group', !nav.textContent.includes('최근 대화'))
  check('all-projects-visible', nav.querySelectorAll('[data-context="project"]').length === 3)
  check('same-basename-path-prefixes', [...nav.querySelectorAll('[data-project-path-prefix]')].map(n => n.textContent).join('|') === 'C:\\Engineering\\|D:\\Research\\')
  const title = document.querySelector('h1'); const cwd = document.querySelector('[data-surface="cwd-panel"]'); const rows = document.querySelectorAll('[data-context="project-session"]')
  check('title-composer-list-order', title.getBoundingClientRect().top < cwd.getBoundingClientRect().top && cwd.getBoundingClientRect().top < rows[0].getBoundingClientRect().top)
  check('project-chat-list-two-rows', rows.length === 2)
  check('no-chat-row-metadata', [...rows].every(row => !row.textContent.includes('이 메타는') && !row.querySelector('time')))
  check('no-right-instructions', !document.body.textContent.includes('Initial a') && document.querySelectorAll('aside').length === 1)
  report.layout = [...document.querySelectorAll('main,main>section,main>section>div,main>section>div>div')].map(n => ({tag:n.tagName,class:n.className,width:n.getBoundingClientRect().width,display:getComputedStyle(n).display,maxWidth:getComputedStyle(n).maxWidth}))
  report.rowPadding = getComputedStyle(rows[0].querySelector('button')).paddingTop
  check('shared-catalog-row-geometry', rows[0].classList.contains('group/catalog-row') && parseFloat(report.rowPadding) > 0)
  return report
}
async function openInstructions() {
  await click(document.querySelector('[aria-label="프로젝트 메뉴"]'))
  check('instructions-menu-wired', !!byText('[role="menuitem"]', '지침 편집') && !document.body.textContent.includes('세부사항 수정'))
  await click(byText('[role="menuitem"]', '지침 편집'))
  check('instructions-dialog-open', !!document.querySelector('[role="dialog"] textarea'))
}
function setText(node, value) {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(node, value)
  node.dispatchEvent(new Event('input', {bubbles:true}))
}
window.nativeEdit = async () => {
  await openInstructions()
  check('instructions-loaded', document.querySelector('[role="dialog"] textarea').value === 'Initial a')
  setText(document.querySelector('[role="dialog"] textarea'), '모든 검증 결과를 한국어로 정리하세요.')
  await tick(); failSave = true
  await click(byText('[role="dialog"] button', '저장'))
  check('save-failure-visible-and-retryable', !!document.querySelector('[role="dialog"] [role="alert"]') && !byText('[role="dialog"] button', '저장').disabled)
  return report
}
window.nativeSave = async () => {
  await click(byText('[role="dialog"] button', '저장'))
  check('save-closes-dialog', !document.querySelector('[role="dialog"]'))
  await openInstructions()
  check('saved-instructions-reload', document.querySelector('[role="dialog"] textarea').value === '모든 검증 결과를 한국어로 정리하세요.')
  setText(document.querySelector('[role="dialog"] textarea'), '취소할 수정')
  await click(byText('[role="dialog"] button', '취소'))
  check('cancel-keeps-saved-instructions', projects[0].instructions === '모든 검증 결과를 한국어로 정리하세요.')
  await openInstructions()
  return report
}
window.nativeSwitch = async () => {
  await click(byText('[role="dialog"] button', '취소'))
  await click([...document.querySelectorAll('[data-context="project"]')][1])
  await tick()
  const state = useChatStore.getState(); check('next-project-cwd', state.sessions[state.activeKey].session.cwd === projects[1].cwd)
  check('next-project-empty-list', document.querySelectorAll('[data-context="project-session"]').length === 0)
  check('project-a-instructions-preserved', projects[0].instructions === '모든 검증 결과를 한국어로 정리하세요.')
  return report
}
window.nativeNew = async () => {
  flushSync(() => window.nativeNavigate('/new')); await tick()
  const state = useChatStore.getState(); check('new-landing-desktop', state.sessions[state.activeKey].session.cwd === 'C:\\Users\\me\\OneDrive\\Desktop')
  return report
}

window.nativeBackground = async () => {
  const before = report.calls.filter(c => c[0] === 'list-projects').length
  chatActions.newChat()
  const state = useChatStore.getState()
  const pending = state.activeKey
  useChatStore.setState({sessions:{...state.sessions,'unrelated-draft':{...state.sessions[pending]}},activeKey:'unrelated-draft',pendingNewChatKey:pending})
  projects = [...projects, project('background-project', 'E:/Reviews/new-project', 'new-project')]
  ingestChatEvent({type:'session.updated',sessionId:'background-session',patch:{projectId:'background-project',cwd:'E:/Reviews/new-project'}})
  await tick(); await tick()
  check('background-confirmation-does-not-switch-view',useChatStore.getState().activeKey === 'unrelated-draft')
  check('background-event-refreshes-project-catalog',report.calls.filter(c => c[0] === 'list-projects').length > before && document.querySelectorAll('[data-context="project"]').length === 4)
  return report
}
window.nativeLoading = async () => {
  flushSync(() => { useProjectsStore.setState({list:[],loading:true}); window.nativeNavigate('/projects/b') })
  await tick()
  check('direct-url-waits-for-project-catalog',!document.querySelector('textarea') && !document.querySelector('[aria-label="프로젝트 메뉴"]') && !!document.querySelector('[role="status"]'))
  return report
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import { SettingsSchema } from '@source/shared/protocol'
import { Sidebar } from '@source/renderer/src/app/Sidebar'
import { PluginsPage } from '@source/renderer/src/pages/PluginsPage'
import { TweakProvider } from '@source/renderer/src/shared/theme'

const report = window.nativeReport = { checks: {}, errors: [], calls: [], geometry: {} }
window.addEventListener('error', event => report.errors.push(String(event.error?.stack || event.message)))
window.addEventListener('unhandledrejection', event => report.errors.push(String(event.reason)))
const tick = () => new Promise(resolve => setTimeout(resolve, 140))
const check = (key, value) => { report.checks[key] = !!value }
const click = async node => {
  if (!node) throw Error('Missing click target')
  flushSync(() => node.click())
  await tick(); await tick()
}
const textButton = (root, text) => [...root.querySelectorAll('button')].find(node => node.textContent.trim() === text)
const box = node => {
  if (!node) throw Error('Missing geometry target')
  const { x, y, width, height, right, bottom } = node.getBoundingClientRect()
  return { x, y, width, height, right, bottom }
}
const near = (a, b) => Math.abs(a - b) < 1
const makeSkill = (name, sourceId, description) => ({
  name, sourceId, sourceLabel: sourceId === 'orca' ? 'Orca 스킬' : '외부 스킬',
  description, body: `# ${name}\n\n**굵은 본문**과 검증 절차입니다.\n\n- 항목 하나\n- 항목 둘`,
  sourceKind: 'orca', enabled: true, canToggle: true, canRemove: true,
  skillDir: `C:\\fixture\\${name}`, skillPath: `C:\\fixture\\${name}\\SKILL.md`, createdAt: 1788990000000
})
let skills = [makeSkill('검증 보고서', 'orca', '카메라 검증 결과를 문서로 정리합니다.'), makeSkill('분석 도우미', 'custom', '측정 결과에서 변화와 이상값을 찾습니다.')]
skills[1].body += Array.from({ length: 25 }, (_, index) => `\n\n## 분석 단계 ${index + 1}\n\n측정 결과의 기준과 변화를 확인하고 검증 내용을 기록합니다.`).join('')
let servers = [
  { id: 'mcp-a', name: 'mcp-a', description: '문서와 컨텍스트를 읽는 로컬 도구', transport: 'stdio', command: 'node', args: ['fixture-server.js'], enabled: true, url: null, authEnvKey: null, hasAuth: false },
  { id: 'mcp-b', name: 'mcp-b', description: '원격 검증 결과 도구', transport: 'http', command: null, args: [], enabled: false, url: 'https://fixture.invalid/mcp', authEnvKey: null, hasAuth: false }
]
const fields = [{ name: 'token', label: '연결 토큰', type: 'password', required: true }]
const providers = ['mcp-a', 'connection-b'].map((id, index) => ({
  id, label: index ? '검증 서비스' : '사내 자료실', kind: 'service', origin: `https://${id}.invalid`,
  auth: [{ kind: 'pat', label: 'PAT', fields }], status: 'none', activeAuthKind: null, principal: null,
  expiresAt: null, tools: [`mcp__${id}__search`]
}))
window.orca = {
  platform: 'win32',
  settings: { get: async () => SettingsSchema.parse({}), set: async patch => ({ ...SettingsSchema.parse({}), ...patch }) },
  skills: {
    list: async () => skills,
    remove: async target => { report.calls.push(['remove-skill', target]); skills = skills.filter(skill => skill.sourceId !== target.sourceId || skill.name !== target.name); return skills },
    setEnabled: async request => { skills = skills.map(skill => skill.sourceId === request.sourceId && skill.name === request.name ? { ...skill, enabled: request.enabled } : skill); return skills }
  },
  mcp: {
    list: async () => servers,
    update: async request => { report.calls.push(['update-mcp', request]); if (window.nativeHoldMcp) await new Promise(resolve => { window.nativeReleaseMcp = resolve }); servers = servers.map(server => server.id === request.id ? { ...server, ...request, id: request.name ?? server.id } : server) },
    delete: async id => { report.calls.push(['delete-mcp', id]); servers = servers.filter(server => server.id !== id) }
  },
  provider: {
    state: async () => ({ providers, step: null }), onState: () => () => {},
    login: async request => { report.calls.push(['connect', request]); return { kind: 'input-required', providerId: request.providerId, authKind: 'pat', fields } },
    continue: async request => { report.calls.push(['submit', request]); return { kind: 'done', providerId: request.providerId } }
  }
}
const host = () => document.querySelector('[data-context="extensions-catalog"]')
const list = () => document.querySelector('[role="tabpanel"]')
const rows = () => [...list().querySelectorAll('[data-extensions-row]')]
const row = id => list().querySelector(`[data-extensions-row="${id}"]`)
const rowButton = id => row(id)?.querySelector('button')
const pane = () => document.querySelector('[data-resizable-side-pane]')
const surface = () => document.querySelector('[data-side-pane-surface]')
const detail = () => document.querySelector('[data-extension-detail-panel]') ?? pane()
const root = createRoot(document.getElementById('root'))
let currentTab = 'skills'
async function selectTab(tab) {
  await click(document.querySelector(`[data-extensions-tab="${tab}"]`))
  currentTab = tab
}
function flatList(key, count) {
  check(`${key}-flat-list-count`, rows().length === count)
  check(`${key}-no-table-or-group-headings`, !list().querySelector('table,thead,th,[aria-controls^="catalog-group"]'))
  check(`${key}-shared-artifact-row`, rows().every(node => node.classList.contains('group/catalog-row')))
}
function layout(key) {
  const target = host(), frame = document.querySelector('.app-frame-main')
  report.geometry[key] = { host: box(target), pane: pane() ? box(pane()) : null, list: box(list()) }
  check(`${key}-no-main-overflow`, frame.scrollWidth <= frame.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1)
  if (pane()) check(`${key}-list-and-panel-visible`, box(document.querySelector('[data-extensions-catalog-list]')).width >= 220 && box(pane()).width > 0)
}
async function select(id, title) {
  const before = list()
  await click(rowButton(id))
  check(`${currentTab}-${id}-list-stays-mounted`, list() === before)
  check(`${currentTab}-${id}-selected-row`, rowButton(id)?.getAttribute('aria-pressed') === 'true')
  check(`${currentTab}-${id}-detail-visible`, !!pane() && detail().textContent.includes(title))
  check(`${currentTab}-${id}-two-rows-retained`, rows().length === 2)
}
async function menuEscape(key, id, title) {
  const trigger = detail().querySelector('[aria-label="더 보기"]')
  trigger.focus()
  await click(trigger)
  check(`${key}-menu-open-with-trigger-focus`, !!document.querySelector('[role="menu"]') && document.activeElement === trigger)
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await tick(); await tick()
  check(`${key}-first-escape-closes-menu-only`, !document.querySelector('[role="menu"]') && !!pane())
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await tick(); await tick()
  check(`${key}-second-escape-closes-detail`, !pane())
  check(`${key}-escape-restores-origin-focus`, document.activeElement === rowButton(id))
  await select(id, title)
}
window.nativeMount = async () => {
  flushSync(() => root.render(<TweakProvider><MemoryRouter initialEntries={['/plugins']}><div className="app-frame-root flex h-full w-full overflow-hidden bg-bg [font-family:var(--font-app)] text-[13px] leading-[1.45] text-ink"><Sidebar projectsSlot={null} pinnedSlot={null} footerSlot={null} /><main className="app-frame-main flex min-h-0 min-w-0 flex-1 flex-col"><PluginsPage /></main></div></MemoryRouter></TweakProvider>))
  await tick(); await tick(); await document.fonts.ready
  flatList('skills', 2)
  check('initial-no-detail-panel', !pane())
  layout('skills-list-1400')
}
window.nativeTabKeyboard = async () => {
  const tabs = [...host().querySelectorAll('[data-extensions-tab]')]
  tabs[0].focus()
  for (const [key, index] of [['ArrowLeft', 2], ['ArrowRight', 0], ['ArrowRight', 1], ['End', 2], ['Home', 0]]) {
    flushSync(() => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
    await tick()
    const selected = tabs[index]
    check(`plugin-${key}-${index}-selects-and-focuses-tab`, selected.getAttribute('aria-selected') === 'true' && document.activeElement === selected)
    check(`plugin-${key}-${index}-single-tabstop`, tabs.every((tab, current) => tab.tabIndex === (current === index ? 0 : -1)))
    check(`plugin-${key}-${index}-aria-connected`, selected.getAttribute('aria-controls') === list().id && list().getAttribute('aria-labelledby') === selected.id)
    check(`plugin-${key}-${index}-flat-rows-visible`, rows().length === 2 && !pane())
  }
}
window.nativeSkill = async () => {
  await select('orca/검증 보고서', '검증 보고서')
  check('skill-rendered-markdown', !!detail().querySelector('strong') && !detail().querySelector('pre'))
  layout('skills-detail-1400')
}
window.nativeSkillSwitch = async () => {
  await menuEscape('skill', 'orca/검증 보고서', '검증 보고서')
  await click(detail().querySelector('[aria-label="텍스트 원문"]'))
  check('skill-plain-mode-enabled', !!detail().querySelector('pre'))
  await select('custom/분석 도우미', '분석 도우미')
  check('switch-skill-resets-plain-local-state', !detail().querySelector('pre') && !!detail().querySelector('strong'))
}
window.nativeDragGeometry = () => {
  const separator = document.querySelector('[data-side-pane-resize]'), bounds = box(separator)
  report.geometry.beforeDrag = box(pane())
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}
window.nativeAfterDrag = async () => {
  await tick()
  check('mouse-drag-resizes-side-panel', box(pane()).width > report.geometry.beforeDrag.width + 40)
  check('mouse-drag-cleans-shield', !document.querySelector('[data-side-pane-drag-shield]'))
  const separator = document.querySelector('[data-side-pane-resize]')
  const width = box(pane()).width
  separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  await tick()
  check('keyboard-resizes-side-panel', box(pane()).width < width)
  report.geometry.normalPane = box(pane())
  layout('skills-resized-1400')
}
window.nativeExpand = async () => {
  window.nativeListBeforeExpand = list()
  window.nativeDetailBeforeExpand = detail()
  window.nativeDetailScroll = detail().lastElementChild
  window.nativeDetailScroll.scrollTop = 240
  window.nativeDetailScroll.dispatchEvent(new Event('scroll', { bubbles: true }))
  await tick()
  window.nativeDetailScrollTop = window.nativeDetailScroll.scrollTop
  check('detail-has-real-scroll-offset', window.nativeDetailScrollTop === 240)
  check('extension-expand-uses-common-label', document.querySelector('[data-behavior="extension-detail:expand"]').getAttribute('aria-label') === '패널 펼치기')
  await click(document.querySelector('[data-behavior="extension-detail:expand"]'))
  check('extension-restore-uses-common-label', document.querySelector('[data-behavior="extension-detail:expand"]').getAttribute('aria-label') === '원래 크기로')
  const a = box(surface()), b = box(host())
  check('expanded-covers-entire-plugin-host', near(a.x, b.x) && near(a.y, b.y) && near(a.width, b.width) && near(a.height, b.height))
  check('expanded-retains-list-dom', list() === window.nativeListBeforeExpand)
  check('expanded-disables-background-list', !!list().closest('[inert]'))
  check('expanded-hides-resize-handle', !document.querySelector('[data-side-pane-resize]'))
  check('expanded-preserves-detail-dom', detail() === window.nativeDetailBeforeExpand)
}
window.nativeRestore = async () => {
  await click(document.querySelector('[data-behavior="extension-detail:expand"]'))
  check('restore-preserves-user-width', near(box(pane()).width, report.geometry.normalPane.width))
  check('restore-releases-inert', !list().closest('[inert]'))
  check('restore-preserves-detail-scroll-dom', detail().lastElementChild === window.nativeDetailScroll)
  check('restore-preserves-detail-scroll-offset', window.nativeDetailScroll.scrollTop === window.nativeDetailScrollTop)
}
window.nativeClose = async () => {
  const origin = rowButton('custom/분석 도우미')
  check('extension-close-uses-common-label', document.querySelector('[data-behavior="extension-detail:close"]').getAttribute('aria-label') === '닫기')
  await click(document.querySelector('[data-behavior="extension-detail:close"]'))
  check('close-removes-detail-panel', !pane())
  check('close-restores-origin-focus', document.activeElement === origin)
  check('close-clears-selected-state', origin.getAttribute('aria-pressed') === 'false')
}
window.nativeMcp = async () => {
  await selectTab('mcp')
  flatList('mcp', 2)
  await select('mcp-a', 'mcp-a')
  check('mcp-detail-configuration-visible', detail().textContent.includes('fixture-server.js'))
  await menuEscape('mcp', 'mcp-a', 'mcp-a')
  layout('mcp-detail-1400')
}
window.nativeProviders = async () => {
  await selectTab('providers')
  check('tab-switch-closes-panel', !pane())
  flatList('providers', 2)
  await select('mcp-a', '사내 자료실')
  check('cross-tab-id-collision-stays-provider', !detail().textContent.includes('fixture-server.js'))
  await click(textButton(detail(), '연결'))
  const input = detail().querySelector('input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'fixture-only-value')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await tick()
  await select('connection-b', '검증 서비스')
  check('provider-switch-clears-auth-step', !detail().querySelector('input'))
  await click(textButton(detail(), '연결'))
  check('provider-switch-clears-input-state', detail().querySelector('input').value === '')
  layout('provider-detail-1400')
}
window.nativeMcpRename = async () => {
  await selectTab('mcp')
  await select('mcp-a', 'mcp-a')
  await click(detail().querySelector('[aria-label="더 보기"]'))
  await click(textButton(document.querySelector('[data-surface="popover"]') ?? document, '편집'))
  const input = document.querySelector('[role="dialog"] input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'mcp-renamed')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await tick()
  window.nativeHoldMcp = true
  await click(textButton(document.querySelector('[role="dialog"]'), '저장'))
  const dialog = document.querySelector('[role="dialog"]')
  const pendingInput = dialog.querySelector('input')
  pendingInput.focus()
  pendingInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await tick()
  check('mcp-pending-save-blocks-escape', document.querySelector('[role="dialog"]') === dialog && !!pane())
  await click(dialog.parentElement)
  check('mcp-pending-save-blocks-backdrop', document.querySelector('[role="dialog"]') === dialog && !!pane())
  check('mcp-pending-save-disables-cancel', textButton(dialog, '취소').disabled)
  window.nativeHoldMcp = false
  window.nativeReleaseMcp()
  await tick()
  await tick()
  check('mcp-save-resolution-closes-dialog', !document.querySelector('[role="dialog"]'))
  check('mcp-rename-keeps-list-and-detail-selected', !!row('mcp-renamed') && rowButton('mcp-renamed').getAttribute('aria-pressed') === 'true' && detail().textContent.includes('mcp-renamed'))
  check('mcp-rename-removes-old-row', !row('mcp-a'))
}
window.nativeMcpRemove = async () => {
  await click(detail().querySelector('[aria-label="더 보기"]'))
  await click(textButton(document, '제거'))
  await click(textButton(document.querySelector('[role="dialog"]'), '제거'))
  await tick()
  check('mcp-remove-closes-stale-panel', !row('mcp-renamed') && !pane())
  check('mcp-remove-keeps-other-row', !!row('mcp-b'))
  check('mcp-remove-focus-returns-to-tab', document.activeElement === document.querySelector('[data-extensions-tab="mcp"]'))
}
window.nativeNarrow = async () => {
  await selectTab('skills')
  await select('orca/검증 보고서', '검증 보고서')
  layout(`skills-detail-${innerWidth}`)
}

// 실제 React 컴포넌트·store와 합성 IPC를 사용한다. 첨부 원본의 지시/개인정보는 재생하지 않는다.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { AssistantTurn } from '@source/renderer/src/features/chat/components/transcript/AssistantTurn'
import { UserMessage } from '@source/renderer/src/features/chat/components/transcript/UserMessage'
import { RightPanel } from '@source/renderer/src/features/chat/components/rightpanel/RightPanel'
import { initialChatState } from '@source/renderer/src/features/chat/reducer/chatReducer'
import { useChatStore } from '@source/renderer/src/features/chat/store/chatStore'
import { agentUiPolicy } from '@source/renderer/src/features/chat/lib/agentPresentation'
import { getHighlighter } from '@source/renderer/src/shared/ui/markdown/syntax'
import { htmlSource } from './native-data.mjs'

const report = { checks: {}, errors: [], calls: [] }
window.nativeReport = report
window.addEventListener('error', event => report.errors.push(String(event.error?.stack || event.message)))
window.addEventListener('unhandledrejection', event => report.errors.push(String(event.reason)))
const tick = () => new Promise(resolve => setTimeout(resolve, 140))
const check = (name, value) => {
  report.checks[name] = !!value
  if (!value) throw new Error(name)
}
const click = async element => {
  if (!element) throw new Error('Missing native click target')
  element.focus()
  flushSync(() => element.click())
  await tick()
}
const find = selector => document.querySelector(selector)
const action = name => find(`[data-behavior="viewer:${name}"]`)
const refs = [
  ['markdown', 'tool_audit.md', 'Tool audit'],
  ['html', 'report.html', '검증 결과'],
  ['text', 'session-transcript.jsonl', 'Session transcript'],
  ['image', 'sensor.svg', '센서 다이어그램']
].map(([kind, filename, title], index) => ({
  publicationId: `p${index}`, artifactFileId: `f${index}`, kind, filename, title,
  publishedAt: 1788990000000, sizeBytes: 180
}))
const markdown = '# Cowork 도구 출력 분석\n\n- 생성: 2026-09-10\n- 목적: 작업 결과의 표현과 파일 뷰어 확인\n- 상태: 검증 완료\n'
const previews = [
  { state: 'ready', format: 'markdown', mimeType: 'text/markdown', content: markdown, language: 'markdown' },
  { ...window.nativeHtmlPreview, content: htmlSource },
  { state: 'ready', format: 'text', mimeType: 'application/json', content: Array.from({ length: 100 }, (_, i) => JSON.stringify({ id: i + 1, status: 'completed', output: '검증 결과' })).join('\n'), language: 'json' },
  { state: 'ready', format: 'image', mimeType: 'image/svg+xml', content: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="440" height="220"><rect width="440" height="220" rx="16" fill="#edf5f3"/><circle cx="100" cy="110" r="45" fill="#0c7c73"/><path d="M160 110H270" stroke="#0c7c73" stroke-width="4"/><rect x="280" y="60" width="110" height="100" rx="12" fill="#99cbbc"/></svg>') }
]
let delayed = null
let failNextPreview = false
window.orca = {
  artifacts: {
    list: async () => refs,
    status: async ({ publicationIds }) => publicationIds.map(id => ({ publicationId: id, artifactFileId: refs.find(ref => ref.publicationId === id).artifactFileId, availability: { state: 'present', sizeBytes: 180, modifiedAt: 1788990000000 } })),
    preview: async req => {
      report.calls.push(['preview', req])
      if (delayed) return new Promise(resolve => { delayed.resolve = resolve })
      if (failNextPreview) { failNextPreview = false; return { state: 'unavailable', reason: 'missing' } }
      return previews[Number(req.publicationId.slice(1))]
    },
    save: async req => { report.calls.push(['save', req]); return { outcome: 'cancelled', items: [] } },
    reveal: async () => ({ ok: true }),
    openFolder: async () => ({ ok: true })
  },
  files: { pickDirectory: async () => null, openPath: async () => ({ ok: true }) },
  session: { addDirectory: async () => ({ ok: true, extraDirs: [] }) },
  chat: { onEvent: () => () => {} },
  permission: { respond: async () => {} }
}
const result = (toolRunId, value, isError = false) => ({ type: 'tool_result', toolRunId, result: value, isError })
const call = (toolRunId, toolName, args) => ({ type: 'tool_call', toolRunId, toolName, args })
const messages = [{ role: 'assistant', createdAt: 1788990000000, parts: [
  { type: 'response_boundary', boundary: { phase: 'begin', id: 'response1' } },
  { type: 'text', text: '작업 환경을 확인하고 결과를 정리하겠습니다.' },
  call('command1', 'Bash', { command: 'pwd\nls -la', description: '작업 환경 확인' }),
  result('command1', Array.from({ length: 28 }, (_, i) => `${i + 1}  sensor_${String(i).padStart(2, '0')}  completed  2026-09-10`).join('\n')),
  call('task1', 'TaskCreate', { activeForm: '도구 출력 분석 중', description: '도구의 요청과 응답을 확인합니다.', subject: '도구 출력 분석' }),
  { ...result('task1', 'Task #1 created successfully: 도구 출력 분석'), structuredOutput: { task: { id: '1', subject: '도구 출력 분석', description: '도구의 요청과 응답을 확인합니다.', status: 'pending' } } },
  call('search1', 'WebSearch', { query: '센서 검증 보고서' }),
  result('search1', 'Links: [{"title":"센서 검증 가이드","url":"https://example.com/guide"},{"title":"결과 보고서 작성","url":"https://example.com/report"}]'),
  call('output1', 'TaskOutput', { block: false, task_id: 'missing-task', timeout: 1000 }),
  result('output1', '<tool_use_error>No task found with ID: missing-task</tool_use_error>', true),
  { type: 'text', text: '분석을 마쳤습니다. 아래 결과 파일에서 내용을 확인할 수 있습니다.' },
  { type: 'response_boundary', boundary: { phase: 'end', id: 'response1', outcome: 'ended' } },
  ...refs.map(artifact => ({ type: 'artifact', artifact }))
] }]
const taskParts = [{ role: 'assistant', createdAt: 1, parts: [call('task-list', 'TaskList', {}), { ...result('task-list', '작업 목록'), structuredOutput: { tasks: [
  { id: '1', subject: '도구 출력 분석', description: '요청 및 응답 검토', status: 'completed' },
  { id: '2', subject: '결과 파일 검증', description: '미리보기 확인', status: 'completed' },
  { id: '3', subject: '검증 결과 정리', description: '최종 결과 작성', status: 'in_progress' }
] } }] }]
const root = createRoot(document.getElementById('root'))
function mount(kind = 'work') {
  const session = { ...initialChatState, agentKind: kind, sessionId: 'native-work', title: 'Cowork 출력 분석', messages: [...messages, ...taskParts], cwd: 'C:/fixture', extraDirs: ['C:/fixture/Documents'], agentPanelInitialized: true, rightPanelTiles: kind === 'work' ? [{ id: 'column1', tiles: ['task'] }] : [] }
  flushSync(() => useChatStore.setState({ sessions: { 'native-work': { session, live: { text: '', reasoning: '' }, subagentMeta: {} } }, activeKey: 'native-work' }))
  flushSync(() => root.render(<div className="flex h-full w-full min-w-0 flex-1 bg-bg p-3">
    <main className="min-w-0 flex-1 overflow-auto px-8 py-6" data-native-transcript>
      <div className="mx-auto flex max-w-[900px] flex-col gap-8">
        <UserMessage message={{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: '도구의 요청과 응답을 분석하고 결과를 파일로 정리해 주세요.' }] }} />
        <AssistantTurn turn={{ role: 'assistant', startIndex: 0, messages }} transcriptPolicy={agentUiPolicy(kind).transcript} pending />
      </div>
    </main>
    <RightPanel />
  </div>))
}
window.nativeMount = async () => { mount(); await tick(); await tick(); return report }
window.nativeTranscript = async () => {
  const summary = find('[data-agent="work"] button[aria-expanded]')
  await click(summary)
  check('activity-summary-unframed', getComputedStyle(summary.parentElement).borderWidth === '0px')
  const toggles = [...document.querySelectorAll('[data-agent="work"] button[aria-expanded="false"]')]
  for (const toggle of toggles) await click(toggle)
  const text = find('[data-agent="work"]').textContent
  check('request-response-error-visible', ['요청', '응답', '오류'].every(label => text.includes(label)))
  check('order-retained', text.indexOf('작업 환경 확인') < text.indexOf('도구 출력 분석'))
  check('search-links-visible', !!find('[data-agent="work"] a[href="https://example.com/guide"]'))
  const body = find('[data-work-tool-body="command1"]')
  check('whole-tool-body-bounded', body.clientHeight <= 250 && body.scrollHeight > body.clientHeight)
  body.scrollTop = body.scrollHeight
  check('tool-body-scrolls', body.scrollTop > 0)
  body.scrollTop = 0
  check('search-original-available-collapsed', !!find('[data-work-tool-body="search1"] details:not([open])'))
  return report
}
window.nativeOpen = async (index, variant = 'list') => {
  const prefix = variant === 'list' ? '[data-artifact-overview] ' : '[data-native-transcript] '
  const trigger = find(`${prefix}[data-artifact-preview="p${index}"]`) ?? find(`[data-artifact-preview="p${index}"]`)
  window.nativeOrigin = trigger
  await click(trigger)
  check(`viewer-${index}-visible`, !!find('[data-artifact-viewer]'))
  check(`viewer-${index}-title`, find('[data-artifact-viewer]').textContent.includes(refs[index].title))
  return report
}
window.nativeCode = async () => { await click(find('[role="radio"][aria-label="코드"]')); check('source-visible', find('[data-artifact-viewer-body]').textContent.includes('# Cowork')); return report }
window.nativeSyntax = async () => {
  const highlighter = await getHighlighter()
  check('syntax-engine-works-under-production-csp', highlighter.codeToHtml('# heading', { lang: 'markdown', theme: 'github-light' }).includes('color:'))
  for (const lang of ['typescript', 'javascript', 'tsx', 'jsx', 'python', 'bash', 'json', 'yaml', 'html', 'css', 'markdown']) {
    check(`syntax-${lang}`, highlighter.codeToHtml('const x = "hello"; # 123\n<div>value</div>', { lang, theme: 'github-light' }).includes('class="shiki'))
  }
  await tick()
  check('viewer-source-highlighted', !!find('[data-artifact-viewer-body] .shiki'))
  check('source-line-numbers-visible', getComputedStyle(find('[data-artifact-viewer-body] .line'), '::before').content.includes('counter(line)'))
  return report
}
window.nativeClose = async () => {
  await click(action('close'))
  check('viewer-closed', !find('[data-artifact-viewer]'))
  check('origin-focus-restored', document.activeElement === window.nativeOrigin)
  return report
}
window.nativeActions = async () => {
  await click(action('download'))
  check('download-exact-publication', report.calls.some(([kind, req]) => kind === 'save' && req.sessionId === 'native-work' && req.publicationIds[0] === 'p0'))
  const initial = find('[data-artifact-viewer]').getBoundingClientRect().width
  await click(action('expand'))
  check('viewer-expands', find('[data-artifact-viewer]').getBoundingClientRect().width > initial)
  await click(action('expand'))
  return report
}
window.nativeHtml = async () => { check('html-sandbox', find('iframe')?.getAttribute('sandbox') === ''); check('html-script-not-executed', !window.__unsafeExecuted); return report }
window.nativeImage = async () => { const img = find('[data-artifact-viewer-body] img'); await tick(); check('image-decoded', !!img && img.naturalWidth === 440); return report }
window.nativeDark = async () => { document.documentElement.dataset.theme = 'dark'; await tick(); return report }
window.nativeSessionSwitch = async () => {
  delayed = {}
  await window.nativeOpen(0)
  const pending = delayed
  flushSync(() => useChatStore.setState(state => ({
    activeKey: 'other-session',
    sessions: { ...state.sessions, 'other-session': { ...state.sessions['native-work'], session: { ...state.sessions['native-work'].session, sessionId: 'other-session' } } }
  })))
  await tick()
  delayed = null
  pending.resolve(previews[0])
  await tick()
  check('session-switch-clears-viewer', !find('[data-artifact-viewer]'))
  await window.nativeMount()
  return report
}
window.nativeCodeMode = async () => {
  mount('code')
  await tick()
  check('code-retains-original-tool-cards', !find('[data-work-tool-body]') && !find('[data-agent="work"]'))
  await window.nativeOpen(0, 'transcript')
  check('viewer-opens-without-existing-tiles', !!find('[data-artifact-viewer]'))
  await window.nativeClose()
  return report
}
window.nativeRetry = async () => {
  failNextPreview = true
  await window.nativeOpen(0)
  check('viewer-error-has-retry', !!find('[data-artifact-viewer] [role="alert"]') && !!action('retry'))
  await click(action('retry'))
  check('viewer-retry-loads-document', !!find('[data-artifact-viewer-body] h1'))
  await window.nativeClose()
  return report
}
window.nativeUnmount = async () => {
  delayed = {}
  await window.nativeOpen(0)
  const pending = delayed
  flushSync(() => root.render(null))
  delayed = null
  pending.resolve(previews[0])
  await tick()
  await window.nativeMount()
  check('unmount-discards-request', !find('[data-artifact-viewer]'))
  return report
}
window.nativeLateClose = async () => {
  await window.nativeClose()
  delayed = {}
  await window.nativeOpen(0)
  const pending = delayed
  await window.nativeClose()
  delayed = null
  pending.resolve(previews[0])
  await tick()
  check('late-response-after-close-discarded', !find('[data-artifact-viewer]'))
  return report
}

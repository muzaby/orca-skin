import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MemoryRouter } from 'react-router-dom'
import { TweakProvider } from '@source/renderer/src/shared/theme'
import { ChatTile } from '@source/renderer/src/features/chat/components/ChatTile'
import { initialChatState } from '@source/renderer/src/features/chat/reducer/chatReducer'
import { chatActions, useChatStore } from '@source/renderer/src/features/chat/store/chatStore'
import { SettingsSchema } from '@source/shared/protocol'

const report = { checks: {}, errors: [], boundary: 'Production ChatTile/RightPanel/GitContextBar/DiffReview/ResizableSidePane and production CSS in offscreen Electron. Synthetic IPC and seeded Git snapshot; no provider or repository operations.' }
window.nativeReport = report
window.addEventListener('error', event => report.errors.push(String(event.error?.stack || event.message)))
window.addEventListener('unhandledrejection', event => report.errors.push(String(event.reason)))
const tick = () => new Promise(resolve => setTimeout(resolve, 180))
const check = (name, value) => { report.checks[name] = !!value; if (!value) throw new Error(name) }
const find = selector => document.querySelector(selector)
const click = async element => { if (!element) throw Error('Missing click target'); element.focus(); flushSync(() => element.click()); await tick() }
const state = () => useChatStore.getState().sessions['native-code'].session
window.orca = {
  platform: 'win32', settings: { get: async () => SettingsSchema.parse({ theme: 'white', notifyOnComplete: false }), set: async () => undefined },
  artifacts: { list: async () => [], status: async () => [] },
  agent: { list: async () => [] }, provider: { onState: () => () => {} }, skills: { list: async () => [] },
  git: { status: async () => ({ isRepo: true, root: 'C:/fixture', branch: 'feature-panel', detached: false }) },
  files: { pickDirectory: async () => null, openPath: async () => ({ ok: true }) },
  session: { addDirectory: async () => ({ ok: true, extraDirs: [] }) },
  chat: { onEvent: () => () => {} }, permission: { respond: async () => {} }
}
const base = { kind: 'worktree-base', oid: 'a'.repeat(40), ref: 'main' }
const files = ['src/validation.ts', 'docs/results.md'].map((path, file) => ({ path, status: 'modified', added: 120, removed: 0, kind: 'text', lines: Array.from({ length: 120 }, (_, index) => ({ type: 'added', oldLine: null, newLine: index + 1, text: file ? `검증 기록 ${index + 1}` : `const measurement${index + 1} = { sensor: "A", passed: true };` })) }))
const summaryFiles = files.map(({ path, added, removed, status }) => ({ path, added, removed, status, binary: false }))
const summary = { isRepo: true, base, files: summaryFiles, totals: { added: 240, removed: 0 }, filesTruncated: false, commits: [], commitsTruncated: false, commitFilesUnavailable: false, uncommitted: { files: summaryFiles, totals: { added: 240, removed: 0 }, filesTruncated: false } }
const session = { ...initialChatState, agentKind: 'code', sessionId: 'native-code', title: '변경사항 패널 전체 보기', cwd: 'C:/fixture', agentPanelInitialized: true,
  messages: [{ role: 'user', createdAt: 1, parts: [{ type: 'text', text: '센서 검증 코드 변경사항을 검토해 주세요.' }] }, { role: 'assistant', createdAt: 2, parts: [{ type: 'text', text: '변경사항 검토를 마쳤습니다.\n\n' + Array.from({ length: 50 }, (_, i) => `${i + 1}. 검증 조건과 코드 변경사항을 확인했습니다.`).join('\n') }] }],
  planContent: '# 검토 계획\n\n' + Array.from({ length: 80 }, (_, i) => `${i + 1}. 측정 항목 확인`).join('\n'),
  rightPanelTiles: [{ id: 'column-plan', tiles: ['plan'] }, { id: 'column-diff', tiles: ['diff'] }], rightPanelColWidths: [360, 420],
  gitStatus: { cwd: 'C:/fixture', status: { isRepo: true, root: 'C:/fixture', branch: 'feature-panel', detached: false } },
  gitSnapshotRequest: { key: 'native-code', generation: 1 }, gitSnapshot: { ...initialChatState.gitSnapshot, summary, patch: { isRepo: true, base, files, filesTruncated: false, contextLimited: false, unavailable: false }, expandedFiles: ['src/validation.ts'], sidebarVisible: true }
}
flushSync(() => useChatStore.setState({ activeKey: 'native-code', sessions: { 'native-code': { session, live: { text: '', reasoning: '' }, subagentMeta: {} } } }))
const root = createRoot(document.getElementById('root'))
let before
window.nativeMount = async () => {
  flushSync(() => root.render(<MemoryRouter><TweakProvider><div className="app-frame-root flex h-full w-full flex-col overflow-hidden bg-bg [font-family:var(--font-app)] text-[13px] leading-[1.45] text-ink"><div className="flex h-10 shrink-0 items-center border-b border-border px-4 text-caption text-ink3">Orca · Code</div><main className="flex min-h-0 min-w-0 flex-1 flex-col"><ChatTile backendLabel="Claude" canAbort initialDraft="아직 보내지 않은 검토 메모" /></main></div></TweakProvider></MemoryRouter>))
  await tick(); await tick()
  const tile = find('[data-context="diff"]'), viewport = find('[data-artifact-overview]').parentElement
  viewport.scrollLeft = viewport.scrollWidth
  const scroll = find('[data-diff-scroll-owner]'), transcript = find('.app-frame-transcript')
  scroll.scrollTop = 180; transcript.scrollTop = 140
  await tick()
  before = { tile, viewport, scroll, transcript, content: find('[data-chat-pane-content]'), draft: find('textarea'), button: find('[data-diff-expand-panel]'), horizontal: viewport.scrollLeft, top: scroll.scrollTop, transcriptTop: transcript.scrollTop, overviewWidth: find('[data-artifact-overview]').getBoundingClientRect().width, columns: JSON.stringify(state().rightPanelColWidths), selection: state().gitSnapshot }
  check('actual-code-diff-content', !!tile && !!find('[data-diff-file="src/validation.ts"]'))
  check('fixture-horizontal-and-diff-scroll', before.horizontal > 0 && before.top > 0)
  check('fixture-live-composer-draft', before.draft?.value === '아직 보내지 않은 검토 메모')
  check('single-existing-diff-expand-button', tile.querySelectorAll('[data-diff-expand-panel]').length === 1 && before.button.getAttribute('aria-pressed') === 'false')
  return report
}
window.nativeExpand = async () => {
  await click(before.button)
  const host = find('[data-side-pane-host]').getBoundingClientRect(), pane = find('[data-side-pane-expanded]').getBoundingClientRect()
  report.bounds = { host: host.toJSON(), pane: pane.toJSON() }
  check('diff-covers-entire-transcript-host', ['x', 'y', 'width', 'height'].every(key => Math.abs(host[key] - pane[key]) < 1))
  check('same-diff-node-and-controls', before.tile === find('[data-context="diff"]') && before.scroll === find('[data-diff-scroll-owner]') && before.button === find('[data-diff-expand-panel]') && !!find('[data-diff-comparison-trigger]') && !!find('[data-diff-view-trigger]'))
  check('transcript-composer-mounted-inert', before.content === find('[data-chat-pane-content]') && before.content.inert && before.draft === find('textarea'))
  check('expanded-button-restores-panel', before.button.getAttribute('aria-pressed') === 'true' && before.button.getAttribute('aria-label') === '패널 크기 되돌리기')
  check('column-width-and-selection-unchanged-on-expand', JSON.stringify(state().rightPanelColWidths) === before.columns && state().gitSnapshot === before.selection)
  return report
}
window.nativeRestore = async () => {
  before.scroll.scrollTop = 460
  await tick(); await click(before.button); await tick()
  check('restore-removes-overlay-and-inert', !find('[data-side-pane-expanded]') && !before.content.inert)
  check('restore-preserves-nodes-draft', before.scroll === find('[data-diff-scroll-owner]') && before.draft === find('textarea') && before.draft.value === '아직 보내지 않은 검토 메모' && !before.draft.disabled)
  check('restore-diff-scroll-position', Math.abs(before.scroll.scrollTop - before.top) < 1)
  check('restore-horizontal-and-transcript-scroll', Math.abs(before.viewport.scrollLeft - before.horizontal) < 1 && Math.abs(before.transcript.scrollTop - before.transcriptTop) < 1)
  check('restore-column-width-and-selection', JSON.stringify(state().rightPanelColWidths) === before.columns && state().gitSnapshot === before.selection && Math.abs(find('[data-artifact-overview]').getBoundingClientRect().width - before.overviewWidth) < 1)
  return report
}
window.nativeClose = async () => {
  await click(before.button)
  await click(before.tile.querySelector('[data-diff-tile-header]').lastElementChild.lastElementChild)
  check('close-expanded-diff-removes-overlay', !find('[data-context="diff"]') && !find('[data-side-pane-expanded]') && !before.content.inert)
  check('close-retains-other-panel-and-draft', !!find('[data-context="plan"]') && before.draft === find('textarea') && before.draft.value === '아직 보내지 않은 검토 메모')
  flushSync(() => chatActions.setRightPanelTileActive('diff', true))
  await tick()
  check('reopen-diff-is-docked', !!find('[data-context="diff"]') && !find('[data-side-pane-expanded]') && find('[data-diff-expand-panel]').getAttribute('aria-pressed') === 'false')
  check('reopen-preserves-git-selection', state().gitSnapshot === before.selection)
  return report
}

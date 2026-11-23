import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createDiffRequirementItem } from '@renderer/features/chat/harnesses/common/rightpanel/diffRequirements'
import type { DiffRequirementDraft } from '@renderer/features/chat/reducer/chatReducer'
import { DiffReview } from '@renderer/features/chat/harnesses/common/rightpanel/DiffReview'
import { ArtifactViewer } from '@renderer/features/chat/harnesses/common/rightpanel/ArtifactViewer'
import { TranscriptView } from '@renderer/features/chat/components/transcript/TranscriptView'
import { chatReducer, initialChatState } from '@renderer/features/chat/reducer/chatReducer'
import { useChatStore } from '@renderer/features/chat/store/chatStore'
import { hunksToDiffLines } from '@renderer/shared/compute/diffModel'
import type { AppMessagePart } from '../../src/shared/ipc'
import css from '@renderer/styles/app.css?inline'
const style = document.createElement('style')
style.textContent =
  css +
  '\n#root{height:570px;display:flex} .probe-panel{height:560px;min-width:0;flex:1;display:flex;flex-direction:column}'
document.head.appendChild(style)
window.addEventListener('error', (e) => console.error(e.error?.stack ?? e.message))
const rows = Array.from({ length: 5001 }, (_, i) => 'const row' + i + ' = ' + i)
const text = rows.join('\n'),
  path = 'sample.ts'
const file = {
  path,
  status: 'modified' as const,
  kind: 'text' as const,
  added: rows.length,
  removed: 0,
  lines: hunksToDiffLines([{ value: text, added: true }])
}
const remoteRequirement = createDiffRequirementItem({
  id: 'remote',
  sessionId: 'probe',
  base: { kind: 'none' },
  filePath: path,
  lines: file.lines,
  lineIndex: 4600,
  comment: 'selected remote row',
  createdAt: 1
})
const artifactCode = rows
  .map((line, i) => (i === 2500 ? line + ' // ' + 'x'.repeat(5 * 1024 * 1024) : line))
  .join('\n')
const screens = location.hash.slice(1).split(',')
const kind = screens.find((s) => s.startsWith('transcript-'))
const key = 'probe',
  agentKind = kind === 'transcript-work' ? 'work' : 'code'
const intro = 'Visible fixture paragraph'
if (kind) {
  const toolName =
    kind === 'transcript-work' ? 'FixtureTool' : kind === 'transcript-file' ? 'Read' : 'Write'
  const parts: AppMessagePart[] = [
    { type: 'text', text: intro },
    {
      type: 'tool_call',
      toolRunId: 'fixture',
      toolName,
      args:
        toolName === 'Read'
          ? { file_path: path }
          : toolName === 'Write'
            ? { file_path: path, content: text }
            : [{ type: 'text', text }]
    },
    {
      type: 'tool_result',
      toolRunId: 'fixture',
      isError: false,
      result: toolName === 'FixtureTool' ? rows.map((l) => 'response ' + l).join('\n') : text
    }
  ]
  const session = chatReducer(
    { ...initialChatState, sessionId: key, backend: 'claude', agentKind },
    {
      type: 'LOAD_SESSION',
      session: {
        id: key,
        title: key,
        agentKind,
        backend: 'claude',
        messages: [
          { id: 'u', role: 'user', createdAt: 1, parts: [{ type: 'text', text: 'Open the file' }] },
          { id: 'a', role: 'assistant', createdAt: 2, parts }
        ]
      },
      complete: true
    } as never
  )
  useChatStore.setState({
    activeKey: key,
    sessions: {
      [key]: {
        session,
        live: { text: '', reasoning: '', reasoningVisible: false },
        subagentMeta: {}
      }
    }
  } as never)
}
function Transcript(): React.JSX.Element {
  const state = useChatStore((s) => s.sessions[key].session)
  return (
    <TranscriptView
      backend="claude"
      agentKind={agentKind}
      messages={state.messages}
      inflight={false}
      loadingSession={false}
      anchored={false}
      pendingSteer={[]}
      scrollRef={useRef(null)}
      contentRef={useRef(null)}
      onScroll={() => {}}
    />
  )
}
function Git({ screen }: { screen: string }): React.JSX.Element {
  const [draft, setDraft] = useState<DiffRequirementDraft | null>(null),
    [selected, setSelected] = useState<string | null>(null)
  return (
    <>
      <DiffReview
        summary={null}
        hasRequest
        patch={{
          files: [file],
          base: { kind: 'none' },
          isRepo: true,
          filesTruncated: false,
          contextLimited: false,
          unavailable: false
        }}
        comparison={{ kind: 'all' }}
        expandedFiles={new Set([path])}
        sidebarVisible={false}
        view={{
          layout: screen === 'git-inline' ? 'inline' : 'side-by-side',
          wrapLines: false,
          highlightWords: true,
          ignoreWhitespace: false
        }}
        draft={draft}
        onDraftChange={setDraft}
        activeRequirementId={selected}
        requirements={[remoteRequirement]}
        onToggleExpanded={() => {}}
        onExpandFile={() => {}}
        onOpenFile={() => {}}
        onPickComparison={() => {}}
      />
      <button data-jump onClick={() => setSelected('remote')}>
        Locate
      </button>
    </>
  )
}
function Panel({ screen }: { screen: string }): React.JSX.Element {
  if (screen.startsWith('git')) return <Git screen={screen} />
  if (screen.startsWith('transcript')) return <Transcript />
  const md = screen === 'artifact-markdown',
    content = md ? rows.map((_, i) => '## Heading ' + i).join('\n\n') : artifactCode
  return (
    <ArtifactViewer
      selection={{
        sessionKey: key,
        sessionId: key,
        request: 1,
        expanded: true,
        loading: false,
        mode: md ? 'preview' : 'code',
        artifact: {
          publicationId: key,
          artifactFileId: key,
          title: path,
          filename: md ? 'sample.md' : path,
          kind: md ? 'markdown' : 'text',
          sizeBytes: content.length,
          publishedAt: 1
        },
        result: {
          state: 'ready',
          format: md ? 'markdown' : 'text',
          content,
          language: md ? 'markdown' : 'typescript',
          mimeType: 'text/plain'
        }
      }}
    />
  )
}
createRoot(document.getElementById('root')!).render(
  screens.map((screen) => (
    <section className="probe-panel" data-screen={screen} key={screen}>
      <Panel screen={screen} />
    </section>
  ))
)

function panel(screen: string): HTMLElement {
  return document.querySelector<HTMLElement>('[data-screen="' + screen + '"]')!
}
function line(screen: string, index: number): HTMLElement | undefined {
  const marker =
    screen === 'artifact-markdown' ? 'Heading ' + index : 'const row' + index + ' = ' + index
  return Array.from(
    panel(screen)?.querySelectorAll<HTMLElement>('h2,[data-virtual-text],pre') ?? []
  ).find((el) => el.textContent === marker)
}
function owner(screen: string): HTMLElement {
  if (screen.startsWith('git'))
    return panel(screen).querySelector<HTMLElement>('[data-diff-scroll-owner]')!
  if (screen.startsWith('artifact'))
    return panel(screen).querySelector<HTMLElement>('[data-artifact-viewer-body]')!
  if (screen === 'transcript-work')
    return panel(screen).querySelector<HTMLElement>('[data-work-tool-body]')!
  const list = panel(screen).querySelector<HTMLElement>(
    screen === 'transcript-diff' ? '[data-virtual-diff]' : '[data-virtual-code]'
  )
  if (!list?.parentElement) throw Error('missing scroll owner ' + screen)
  return list.parentElement
}
function caret(screen: string, index: number, offset: number): Range {
  const el =
    index < 0
      ? Array.from(panel(screen).querySelectorAll('p')).find((p) => p.textContent === intro)
      : line(screen, index)
  if (!el) throw Error('missing text ' + index)
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    const n = node as Text
    if (offset > n.length) {
      offset -= n.length
      continue
    }
    const range = document.createRange()
    range.setStart(n, offset)
    range.collapse(true)
    return range
  }
  throw Error('bad offset')
}
function point(screen: string, index: number, offset: number): { x: number; y: number } {
  const r = caret(screen, index, offset).getBoundingClientRect()
  return { x: Math.round(r.left), y: Math.round(r.top + r.height / 2) }
}
function keys(screen: string): string[] {
  const q = panel(screen)
  const lists = Array.from(
    q.querySelectorAll('[data-virtual-git],[data-virtual-diff],[data-virtual-code]')
  )
  if (!lists.length && screen === 'artifact-markdown') {
    const md = q.querySelector('[data-index] h2')?.closest('[data-index]')?.parentElement
    if (md) lists.push(md)
  }
  return lists.flatMap((list, index) =>
    Array.from(
      list.querySelectorAll('[data-index]'),
      (row) => index + '/' + (row.getAttribute('data-window-row') ?? row.getAttribute('data-index'))
    )
  )
}
Object.assign(window, {
  probe: {
    line: (s: string, i: number) => !!line(s, i),
    coloredLine: (s: string, i: number) => !!line(s, i)?.querySelector('span[style*="color"]'),
    markdownReady: (s: string, i: number) =>
      line(s, i)?.tagName === 'H2' && !panel(s).querySelector('[data-md-block-pending]'),
    point,
    keys,
    outerKeys(s: string) {
      return Array.from(
        panel(s).querySelectorAll('[data-transcript-viewport] [data-block-key]'),
        (el) => el.getAttribute('data-block-key')
      )
    },
    open(s: string) {
      const p = panel(s)
      const button = p.querySelector<HTMLElement>(
        '[aria-expanded=false],details:not([open]) > summary'
      )
      if (button) button.click()
    },
    scroll(s: string, to: number) {
      const el = owner(s)
      el.scrollTop = to < 0 ? el.scrollHeight : to
    },
    last(s: string) {
      return s === 'transcript-work'
        ? panel(s).innerText.includes('response const row5000 = 5000')
        : !!line(s, 5000)
    },
    info(s: string) {
      return (
        panel(s).innerText.slice(0, 240) +
        ' ' +
        Array.from(panel(s).querySelectorAll('button,summary'))
          .map((b) => b.outerHTML.slice(0, 160))
          .join(' ')
      )
    },
    select() {
      const selection = getSelection()!
      Object.assign(window, { endpoints: [selection.anchorNode, selection.focusNode] })
      return selection.toString()
    },
    connected() {
      return (window as unknown as { endpoints: Node[] }).endpoints.every((n) => n?.isConnected)
    }
  }
})
